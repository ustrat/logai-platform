/**
 * ValuePilot Email Intelligence Background Service
 *
 * Runs on a configurable schedule (default: every 4 hours).
 * Connects to all stored email accounts, fetches new messages,
 * tokenizes content, detects signals, and writes product insights.
 *
 * No user interaction required — fully autonomous.
 *
 * Env vars:
 *   EMAIL_SCAN_INTERVAL_HOURS  — how often to run (default: 4)
 *   EMAIL_LOOKBACK_DAYS        — how far back on first scan (default: 90)
 *   EMAIL_MIN_CONFIDENCE       — minimum signal confidence to store (default: 0.60)
 */

import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from '../config/logger';
import { detectSignals, generateInsights, EmailEntities, DetectedSignal } from './signalEngine';
import {
  fetchGmailMessages,
  fetchOutlookMessages,
  fetchImapMessages,
  GmailCredentials,
  OutlookCredentials,
  ImapCredentials,
} from './emailConnector';

// ── Storage paths ─────────────────────────────────────────────────────────────
const CONNECTIONS_FILE = path.join(__dirname, '../../.email-intel.json');
const INSIGHTS_FILE    = path.join(__dirname, '../../.email-insights.json');

// ── Config ────────────────────────────────────────────────────────────────────
const INTERVAL_HOURS   = parseFloat(process.env.EMAIL_SCAN_INTERVAL_HOURS || '4');
const LOOKBACK_DAYS    = parseInt(process.env.EMAIL_LOOKBACK_DAYS || '90');
const MIN_CONFIDENCE   = parseFloat(process.env.EMAIL_MIN_CONFIDENCE || '0.60');
const INTERVAL_MS      = INTERVAL_HOURS * 60 * 60 * 1000;

// ── Data types ────────────────────────────────────────────────────────────────
type Provider = 'gmail' | 'outlook' | 'imap';

interface Connection {
  id:         string;
  userId:     string;
  provider:   Provider;
  email:      string;
  status:     'connected' | 'error' | 'disconnected';
  gmailCreds?:   GmailCredentials;
  outlookCreds?: OutlookCredentials;
  imapCreds?:    ImapCredentials;
  lastScanAt?:   string;
  scannedIds:    string[];
  errorMessage?: string;
}

interface ConnectionStore {
  connections: Connection[];
  signals:     any[];
}

export interface InsightRecord {
  id:          string;
  userId:      string;
  runAt:       string;
  emailsProcessed: number;
  signalsFound: number;
  byProduct:   Record<string, { count: number; urgency: string; summary: string; avgConfidence: number }>;
  rawSignals:  { messageId: string; subject: string; from: string; date: string; signals: DetectedSignal[]; entities: EmailEntities }[];
}

interface InsightStore {
  insights:   InsightRecord[];
  lastRunAt?: string;
  nextRunAt?: string;
}

// ── Store helpers ─────────────────────────────────────────────────────────────
function loadConnections(): ConnectionStore {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) return JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf8'));
  } catch {}
  return { connections: [], signals: [] };
}

function saveConnections(store: ConnectionStore) {
  try { fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(store, null, 2)); } catch {}
}

function loadInsights(): InsightStore {
  try {
    if (fs.existsSync(INSIGHTS_FILE)) return JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf8'));
  } catch {}
  return { insights: [] };
}

function saveInsights(store: InsightStore) {
  try { fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(store, null, 2)); } catch {}
}

// ── Core scan ─────────────────────────────────────────────────────────────────
async function scanAccount(conn: Connection, since: Date): Promise<{
  scanned: number;
  rawSignals: InsightRecord['rawSignals'];
}> {
  let messages: Awaited<ReturnType<typeof fetchGmailMessages>> = [];

  if (conn.provider === 'gmail' && conn.gmailCreds) {
    messages = await fetchGmailMessages(conn.gmailCreds, since, 500);
  } else if (conn.provider === 'outlook' && conn.outlookCreds) {
    messages = await fetchOutlookMessages(conn.outlookCreds, since, 500);
  } else if (conn.provider === 'imap' && conn.imapCreds) {
    messages = await fetchImapMessages(conn.imapCreds, since, 500);
  }

  // Skip already-processed message IDs
  const newMessages = messages.filter(m => !conn.scannedIds.includes(m.id));
  const rawSignals: InsightRecord['rawSignals'] = [];

  for (const msg of newMessages) {
    const { signals, entities } = detectSignals(msg.subject, msg.from, msg.body);
    const filteredSignals = signals.filter(s => s.confidence >= MIN_CONFIDENCE);

    if (filteredSignals.length > 0) {
      rawSignals.push({
        messageId: msg.id,
        subject:   msg.subject,
        from:      msg.from,
        date:      msg.date.toISOString(),
        signals:   filteredSignals,
        entities,
      });
    }

    conn.scannedIds.push(msg.id);
  }

  // Keep ring buffer (last 20 000 IDs per account)
  if (conn.scannedIds.length > 20000) conn.scannedIds = conn.scannedIds.slice(-20000);

  return { scanned: newMessages.length, rawSignals };
}

// ── Main scan loop ────────────────────────────────────────────────────────────
async function runScan(): Promise<void> {
  logger.info('[EmailIntel] Background scan starting…');

  const connStore = loadConnections();
  const insStore  = loadInsights();
  const activeConns = connStore.connections.filter(c => c.status === 'connected');

  if (activeConns.length === 0) {
    logger.info('[EmailIntel] No connected accounts — skipping scan');
    return;
  }

  // Group connections by user
  const byUser = activeConns.reduce((acc, c) => {
    if (!acc[c.userId]) acc[c.userId] = [];
    acc[c.userId].push(c);
    return acc;
  }, {} as Record<string, Connection[]>);

  for (const [userId, userConns] of Object.entries(byUser)) {
    let totalScanned = 0;
    const allRawSignals: InsightRecord['rawSignals'] = [];

    for (const conn of userConns) {
      const since = conn.lastScanAt
        ? new Date(conn.lastScanAt)
        : new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000);

      try {
        logger.info(`[EmailIntel] Scanning ${conn.email} (${conn.provider}) since ${since.toISOString()}`);
        const { scanned, rawSignals } = await scanAccount(conn, since);
        totalScanned += scanned;
        allRawSignals.push(...rawSignals);
        conn.lastScanAt    = new Date().toISOString();
        conn.status        = 'connected';
        conn.errorMessage  = undefined;
        logger.info(`[EmailIntel] ${conn.email}: ${scanned} emails processed, ${rawSignals.length} signal emails found`);
      } catch (err: any) {
        logger.error(`[EmailIntel] Scan error for ${conn.email}: ${err.message}`);
        conn.status       = 'error';
        conn.errorMessage = err.message;
      }
    }

    // Generate product insights from accumulated signals
    const allSignals = allRawSignals.flatMap(r => r.signals);
    const allEntities = allRawSignals.map(r => r.entities);
    const productInsights = generateInsights(allSignals, allEntities);

    const byProduct: InsightRecord['byProduct'] = {};
    for (const pi of productInsights) {
      byProduct[pi.productKey] = {
        count:         pi.signalCount,
        urgency:       pi.urgency,
        summary:       pi.summary,
        avgConfidence: pi.avgConfidence,
      };
    }

    const record: InsightRecord = {
      id:               randomUUID(),
      userId,
      runAt:            new Date().toISOString(),
      emailsProcessed:  totalScanned,
      signalsFound:     allSignals.length,
      byProduct,
      rawSignals:       allRawSignals,
    };

    insStore.insights.unshift(record);
    logger.info(`[EmailIntel] User ${userId}: ${allSignals.length} total signals across ${Object.keys(byProduct).length} products`);
  }

  // Keep last 50 insight run records
  insStore.insights = insStore.insights.slice(0, 50);
  insStore.lastRunAt = new Date().toISOString();
  insStore.nextRunAt = new Date(Date.now() + INTERVAL_MS).toISOString();

  saveConnections(connStore);
  saveInsights(insStore);

  logger.info(`[EmailIntel] Scan complete. Next run at ${insStore.nextRunAt}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Call from index.ts on server startup */
export function startEmailBackgroundService(): void {
  logger.info(`[EmailIntel] Background service starting — interval: ${INTERVAL_HOURS}h, lookback: ${LOOKBACK_DAYS}d, min confidence: ${MIN_CONFIDENCE}`);

  // Run immediately on startup, then on interval
  runScan().catch(err => logger.error(`[EmailIntel] Initial scan failed: ${err.message}`));
  setInterval(() => {
    runScan().catch(err => logger.error(`[EmailIntel] Scheduled scan failed: ${err.message}`));
  }, INTERVAL_MS);
}

/** Trigger an immediate scan (e.g. from internal API) */
export async function triggerImmediateScan(): Promise<void> {
  await runScan();
}

/** Get latest insights for a user (for internal API consumption) */
export function getLatestInsights(userId: string): InsightRecord | null {
  const store = loadInsights();
  return store.insights.find(r => r.userId === userId) || null;
}

/** Get insight history for a user */
export function getInsightHistory(userId: string, limit = 10): InsightRecord[] {
  const store = loadInsights();
  return store.insights.filter(r => r.userId === userId).slice(0, limit);
}

/** Get service status */
export function getServiceStatus(): { lastRunAt?: string; nextRunAt?: string; intervalHours: number } {
  const store = loadInsights();
  return { lastRunAt: store.lastRunAt, nextRunAt: store.nextRunAt, intervalHours: INTERVAL_HOURS };
}
