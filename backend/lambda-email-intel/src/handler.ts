/**
 * ValuePilot Email Intelligence — AWS Lambda Handler
 *
 * Trigger:  EventBridge Scheduler (every 4 hours by default)
 * Runtime:  Node.js 20.x
 * Timeout:  10 minutes
 * Memory:   512 MB
 *
 * Flow:
 *   1. List all users with connected email accounts (from S3)
 *   2. For each user, load their connections
 *   3. Fetch new emails via Gmail API / MS Graph / IMAP
 *   4. Tokenize + signal-detect each email
 *   5. Generate per-product insights
 *   6. Write insight record to S3
 *   7. Optionally publish a summary to SNS for downstream consumers
 *
 * Env vars (set in template.yaml / SSM):
 *   S3_BUCKET                — state bucket
 *   SNS_TOPIC_ARN            — (optional) publish summary after each run
 *   EMAIL_LOOKBACK_DAYS      — default 90
 *   EMAIL_MIN_CONFIDENCE     — default 0.60
 *   GOOGLE_CLIENT_ID/SECRET  — Gmail OAuth app
 *   MS_CLIENT_ID/SECRET/TENANT — Outlook OAuth app
 */

import { ScheduledEvent, Context } from 'aws-lambda';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { randomUUID } from 'crypto';

import {
  listAllUserIds,
  loadConnections,
  saveConnections,
  saveInsight,
  Connection,
  InsightRecord,
} from './s3Store';

import {
  fetchGmailMessages,
  fetchOutlookMessages,
  fetchImapMessages,
} from './emailConnector';

import {
  detectSignals,
  generateInsights,
  EmailEntities,
  DetectedSignal,
} from './signalEngine';

// ── Config ────────────────────────────────────────────────────────────────────
const LOOKBACK_DAYS   = parseInt(process.env.EMAIL_LOOKBACK_DAYS   || '90');
const MIN_CONFIDENCE  = parseFloat(process.env.EMAIL_MIN_CONFIDENCE || '0.60');
const MAX_MESSAGES    = 500;
const SNS_TOPIC       = process.env.SNS_TOPIC_ARN;

const sns = SNS_TOPIC ? new SNSClient({ region: process.env.AWS_REGION || 'us-east-1' }) : null;

// ── Scan a single connection ──────────────────────────────────────────────────
interface ScanResult {
  scanned:     number;
  rawSignals:  InsightRecord['rawSignals'];
}

async function scanConnection(conn: Connection, since: Date): Promise<ScanResult> {
  let messages: Awaited<ReturnType<typeof fetchGmailMessages>> = [];

  if (conn.provider === 'gmail' && conn.gmailCreds) {
    messages = await fetchGmailMessages(
      { ...conn.gmailCreds,
        clientId:     process.env.GOOGLE_CLIENT_ID     || conn.gmailCreds.clientId,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || conn.gmailCreds.clientSecret,
      },
      since, MAX_MESSAGES,
    );
  } else if (conn.provider === 'outlook' && conn.outlookCreds) {
    messages = await fetchOutlookMessages(
      { ...conn.outlookCreds,
        clientId:     process.env.MS_CLIENT_ID     || conn.outlookCreds.clientId,
        clientSecret: process.env.MS_CLIENT_SECRET || conn.outlookCreds.clientSecret,
        tenantId:     process.env.MS_TENANT_ID     || conn.outlookCreds.tenantId,
      },
      since, MAX_MESSAGES,
    );
  } else if (conn.provider === 'imap' && conn.imapCreds) {
    messages = await fetchImapMessages(conn.imapCreds, since, MAX_MESSAGES);
  }

  // Only process messages we haven't seen before
  const newMessages = messages.filter(m => !conn.scannedIds.includes(m.id));
  const rawSignals:  InsightRecord['rawSignals'] = [];

  for (const msg of newMessages) {
    const { signals, entities } = detectSignals(msg.subject, msg.from, msg.body);
    const filtered = signals.filter(s => s.confidence >= MIN_CONFIDENCE);

    if (filtered.length > 0) {
      rawSignals.push({
        messageId: msg.id,
        subject:   msg.subject,
        from:      msg.from,
        date:      msg.date.toISOString(),
        signals:   filtered,
        entities,
      });
    }

    conn.scannedIds.push(msg.id);
  }

  // Keep scannedIds ring buffer (last 20 000 per connection)
  if (conn.scannedIds.length > 20000) conn.scannedIds = conn.scannedIds.slice(-20000);

  return { scanned: newMessages.length, rawSignals };
}

// ── Lambda handler ────────────────────────────────────────────────────────────
export async function handler(event: ScheduledEvent, context: Context): Promise<void> {
  console.log(JSON.stringify({ msg: 'Email Intel scan starting', requestId: context.awsRequestId, event: event['detail-type'] || 'Scheduled' }));

  const startedAt = Date.now();

  // Discover all users with connections
  const userIds = await listAllUserIds();
  console.log(JSON.stringify({ msg: `Found ${userIds.length} user(s) with email connections` }));

  const globalSummary: Record<string, { users: number; emails: number; signals: number }> = {};

  for (const userId of userIds) {
    console.log(JSON.stringify({ msg: `Processing user ${userId}` }));

    const connections = await loadConnections(userId);
    const activeConns = connections.filter(c => c.status === 'connected');
    if (activeConns.length === 0) continue;

    let totalScanned = 0;
    const allRawSignals: InsightRecord['rawSignals'] = [];

    for (const conn of activeConns) {
      const since = conn.lastScanAt
        ? new Date(conn.lastScanAt)
        : new Date(Date.now() - LOOKBACK_DAYS * 86400 * 1000);

      try {
        console.log(JSON.stringify({ msg: `Scanning ${conn.provider} account ${conn.email} since ${since.toISOString()}` }));

        const { scanned, rawSignals } = await scanConnection(conn, since);

        totalScanned += scanned;
        allRawSignals.push(...rawSignals);
        conn.lastScanAt = new Date().toISOString();
        conn.status     = 'connected';
        delete conn.errorMessage;

        console.log(JSON.stringify({
          msg:      `Scanned ${conn.email}`,
          scanned,
          signalEmails: rawSignals.length,
          provider: conn.provider,
        }));
      } catch (err: any) {
        console.error(JSON.stringify({ msg: `Error scanning ${conn.email}`, error: err.message }));
        conn.status       = 'error';
        conn.errorMessage = err.message;
      }
    }

    // Persist updated connection state (scannedIds + lastScanAt)
    await saveConnections(userId, connections);

    // Generate product insights
    const allSignals  = allRawSignals.flatMap(r => r.signals as DetectedSignal[]);
    const allEntities = allRawSignals.map(r => r.entities as EmailEntities);
    const productInsights = generateInsights(allSignals, allEntities);

    const byProduct: InsightRecord['byProduct'] = {};
    for (const pi of productInsights) {
      if (pi.signalCount > 0) {
        byProduct[pi.productKey] = {
          count:         pi.signalCount,
          urgency:       pi.urgency,
          summary:       pi.summary,
          avgConfidence: pi.avgConfidence,
        };
      }
    }

    const record: InsightRecord = {
      id:              randomUUID(),
      userId,
      runAt:           new Date().toISOString(),
      emailsProcessed: totalScanned,
      signalsFound:    allSignals.length,
      byProduct,
      rawSignals:      allRawSignals,
    };

    await saveInsight(record);

    console.log(JSON.stringify({
      msg:       `Insight record saved for user ${userId}`,
      emails:    totalScanned,
      signals:   allSignals.length,
      products:  Object.keys(byProduct).length,
      byProduct: Object.fromEntries(Object.entries(byProduct).map(([k, v]) => [k, v.count])),
    }));

    // Accumulate global summary
    for (const [pk, v] of Object.entries(byProduct)) {
      if (!globalSummary[pk]) globalSummary[pk] = { users: 0, emails: 0, signals: 0 };
      globalSummary[pk].users++;
      globalSummary[pk].signals += v.count;
    }
    if (!globalSummary['_total']) globalSummary['_total'] = { users: 0, emails: 0, signals: 0 };
    globalSummary['_total'].users++;
    globalSummary['_total'].emails   += totalScanned;
    globalSummary['_total'].signals  += allSignals.length;
  }

  const elapsed = Date.now() - startedAt;

  console.log(JSON.stringify({
    msg:     'Email Intel scan complete',
    elapsed: `${elapsed}ms`,
    summary: globalSummary,
  }));

  // Publish summary to SNS (for dashboards / alerting)
  if (sns && SNS_TOPIC && globalSummary._total?.signals > 0) {
    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC,
      Subject:  `ValuePilot Email Intel — ${globalSummary._total.signals} signals detected`,
      Message:  JSON.stringify({
        runAt:    new Date().toISOString(),
        elapsed:  `${elapsed}ms`,
        users:    globalSummary._total.users,
        emails:   globalSummary._total.emails,
        signals:  globalSummary._total.signals,
        byProduct: Object.fromEntries(
          Object.entries(globalSummary)
            .filter(([k]) => k !== '_total')
            .map(([k, v]) => [k, v.signals])
        ),
      }),
    }));
  }
}
