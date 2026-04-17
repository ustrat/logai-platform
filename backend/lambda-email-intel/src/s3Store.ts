/**
 * S3 Storage Adapter
 * Replaces the local JSON file store used in development.
 *
 * Bucket layout:
 *   {BUCKET}/connections/{userId}.json   — email account connections
 *   {BUCKET}/insights/{userId}/latest.json  — latest insight run
 *   {BUCKET}/insights/{userId}/{runId}.json — historical runs (kept 30 days)
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

const s3     = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const BUCKET = process.env.S3_BUCKET!;

async function s3Get<T>(key: string, fallback: T): Promise<T> {
  try {
    const res  = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await res.Body!.transformToString('utf8');
    return JSON.parse(body) as T;
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return fallback;
    throw err;
  }
}

async function s3Put(key: string, value: unknown): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        JSON.stringify(value, null, 2),
    ContentType: 'application/json',
  }));
}

// ── Connection types ──────────────────────────────────────────────────────────
export type Provider = 'gmail' | 'outlook' | 'imap';

export interface GmailCreds {
  accessToken: string; refreshToken: string;
  clientId: string;    clientSecret: string;
}

export interface OutlookCreds {
  accessToken: string; refreshToken: string;
  clientId: string;    clientSecret: string; tenantId: string;
}

export interface ImapCreds {
  host: string; port: number; secure: boolean; user: string; password: string;
}

export interface Connection {
  id:            string;
  userId:        string;
  provider:      Provider;
  email:         string;
  status:        'connected' | 'error' | 'disconnected';
  errorMessage?: string;
  // Credentials stored directly (encrypted at rest by S3 SSE)
  gmailCreds?:   GmailCreds;
  outlookCreds?: OutlookCreds;
  imapCreds?:    ImapCreds;
  lastScanAt?:   string;
  scannedIds:    string[];   // ring buffer of processed message IDs
}

export interface ConnectionFile {
  connections: Connection[];
}

// ── Connection store ──────────────────────────────────────────────────────────
export async function loadConnections(userId: string): Promise<Connection[]> {
  const file = await s3Get<ConnectionFile>(`connections/${userId}.json`, { connections: [] });
  return file.connections;
}

export async function saveConnections(userId: string, connections: Connection[]): Promise<void> {
  await s3Put(`connections/${userId}.json`, { connections });
}

export async function listAllUserIds(): Promise<string[]> {
  const res     = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: 'connections/' }));
  const objects = res.Contents || [];
  return objects
    .map(o => o.Key?.replace('connections/', '').replace('.json', '') || '')
    .filter(Boolean);
}

// ── Insight store ─────────────────────────────────────────────────────────────
export interface InsightRecord {
  id:              string;
  userId:          string;
  runAt:           string;
  emailsProcessed: number;
  signalsFound:    number;
  byProduct:       Record<string, { count: number; urgency: string; summary: string; avgConfidence: number }>;
  rawSignals:      {
    messageId: string; subject: string; from: string; date: string;
    signals: any[];    entities: any;
  }[];
}

export async function saveInsight(record: InsightRecord): Promise<void> {
  const userId = record.userId;
  // Write as latest
  await s3Put(`insights/${userId}/latest.json`, record);
  // Write as historical (keyed by runId)
  await s3Put(`insights/${userId}/${record.id}.json`, record);
}

export async function loadLatestInsight(userId: string): Promise<InsightRecord | null> {
  return s3Get<InsightRecord | null>(`insights/${userId}/latest.json`, null);
}

export async function loadInsightHistory(userId: string, limit = 10): Promise<InsightRecord[]> {
  const res = await s3.send(new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: `insights/${userId}/`,
  }));
  const objects = (res.Contents || [])
    .filter(o => !o.Key?.endsWith('latest.json'))
    .sort((a, b) => (b.LastModified?.getTime() || 0) - (a.LastModified?.getTime() || 0))
    .slice(0, limit);

  const records: InsightRecord[] = [];
  for (const obj of objects) {
    const record = await s3Get<InsightRecord | null>(obj.Key!, null);
    if (record) records.push(record);
  }
  return records;
}
