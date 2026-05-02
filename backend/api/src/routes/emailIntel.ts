/**
 * ValuePilot Email Intelligence — Internal API
 *
 * Not user-facing. Provides:
 *   - Account connection management (OAuth + IMAP setup)
 *   - Internal insight query endpoints (consumed by other features/dashboards)
 *   - Manual scan trigger (admin/dev use)
 *
 * The background service in emailBackground.ts owns all scanning logic.
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { getSecrets } from '../lib/secretsManager';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildGmailAuthUrl, exchangeGmailCode,
  buildOutlookAuthUrl, exchangeOutlookCode,
  testImapConnection,
  GmailCredentials, OutlookCredentials, ImapCredentials,
} from '../services/emailConnector';
import {
  triggerImmediateScan,
  getLatestInsights,
  getInsightHistory,
  getServiceStatus,
} from '../services/emailBackground';

const router = Router();
router.use(authenticate);

const STORE_FILE = path.join(__dirname, '../../.email-intel.json');

type Provider = 'gmail' | 'outlook' | 'imap';

interface Connection {
  id:            string;
  userId:        string;
  provider:      Provider;
  email:         string;
  status:        'connected' | 'error' | 'disconnected';
  errorMessage?: string;
  gmailCreds?:   GmailCredentials;
  outlookCreds?: OutlookCredentials;
  imapCreds?:    ImapCredentials;
  lastScanAt?:   string;
  scannedIds:    string[];
}

interface ConnectionStore {
  connections: Connection[];
  signals:     any[];
}

function load(): ConnectionStore {
  try {
    if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {}
  return { connections: [], signals: [] };
}

function save(s: ConnectionStore) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(s, null, 2)); } catch {}
}

// ── Gmail OAuth ───────────────────────────────────────────────────────────────
router.get('/connect/gmail/url', (req: Request, res: Response) => {
  const { clientId, clientSecret } = getSecrets().google;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:4000/api/v1/email-intel/connect/gmail/callback`;
  res.json({ success: true, data: { url: buildGmailAuthUrl(clientId, clientSecret, redirectUri) } });
});

router.get('/connect/gmail/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };
  const base = process.env.APP_URL || 'http://localhost:3000';
  if (error || !code) return res.redirect(`${base}/settings?emailError=${error || 'missing_code'}`);

  const user = (req as any).user;
  try {
    const { clientId, clientSecret } = getSecrets().google;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || `http://localhost:4000/api/v1/email-intel/connect/gmail/callback`;
    const { accessToken, refreshToken, email } = await exchangeGmailCode(code, clientId, clientSecret, redirectUri);

    const store = load();
    store.connections = store.connections.filter(c => !(c.userId === user.userId && c.provider === 'gmail'));
    store.connections.push({
      id: randomUUID(), userId: user.userId, provider: 'gmail', email, status: 'connected',
      gmailCreds: { accessToken, refreshToken, clientId, clientSecret },
      scannedIds: [], createdAt: new Date().toISOString(),
    } as any);
    save(store);
    res.redirect(`${base}/settings?emailConnected=gmail`);
  } catch (err: any) {
    res.redirect(`${base}/settings?emailError=${encodeURIComponent(err.message)}`);
  }
});

// ── Outlook OAuth ─────────────────────────────────────────────────────────────
router.get('/connect/outlook/url', (req: Request, res: Response) => {
  const clientId    = process.env.MS_CLIENT_ID;
  const tenantId    = process.env.MS_TENANT_ID || 'common';
  const redirectUri = process.env.MS_REDIRECT_URI || `http://localhost:4000/api/v1/email-intel/connect/outlook/callback`;
  if (!clientId) return res.status(400).json({ success: false, error: 'Set MS_CLIENT_ID in .env' });
  res.json({ success: true, data: { url: buildOutlookAuthUrl(clientId, tenantId, redirectUri) } });
});

router.get('/connect/outlook/callback', async (req: Request, res: Response) => {
  const { code, error } = req.query as { code?: string; error?: string };
  const base = process.env.APP_URL || 'http://localhost:3000';
  if (error || !code) return res.redirect(`${base}/settings?emailError=${error || 'missing_code'}`);

  const user = (req as any).user;
  try {
    const clientId    = process.env.MS_CLIENT_ID!;
    const clientSecret = process.env.MS_CLIENT_SECRET!;
    const tenantId    = process.env.MS_TENANT_ID || 'common';
    const redirectUri = process.env.MS_REDIRECT_URI || `http://localhost:4000/api/v1/email-intel/connect/outlook/callback`;
    const { accessToken, refreshToken, email } = await exchangeOutlookCode(code, clientId, clientSecret, tenantId, redirectUri);

    const store = load();
    store.connections = store.connections.filter(c => !(c.userId === user.userId && c.provider === 'outlook'));
    store.connections.push({
      id: randomUUID(), userId: user.userId, provider: 'outlook', email, status: 'connected',
      outlookCreds: { accessToken, refreshToken, clientId, clientSecret, tenantId },
      scannedIds: [],
    } as any);
    save(store);
    res.redirect(`${base}/settings?emailConnected=outlook`);
  } catch (err: any) {
    res.redirect(`${base}/settings?emailError=${encodeURIComponent(err.message)}`);
  }
});

// ── IMAP ──────────────────────────────────────────────────────────────────────
router.post('/connect/imap', async (req: Request, res: Response) => {
  const user = req.user!;
  const { host, port, secure, user: imapUser, password } = req.body;
  if (!host || !imapUser || !password)
    return res.status(400).json({ success: false, error: 'host, user, and password are required' });

  const creds: ImapCredentials = { host, port: port || 993, secure: secure !== false, user: imapUser, password };
  const test = await testImapConnection(creds);
  if (!test.success)
    return res.status(400).json({ success: false, error: `IMAP connection failed: ${test.error}` });

  const store = load();
  store.connections = store.connections.filter(c => !(c.userId === user.userId && c.provider === 'imap' && c.email === imapUser));
  store.connections.push({
    id: randomUUID(), userId: user.userId, provider: 'imap', email: imapUser,
    status: 'connected', imapCreds: creds, scannedIds: [],
  });
  save(store);
  res.json({ success: true, data: { connected: true, email: imapUser } });
});

// ── Connection management ─────────────────────────────────────────────────────
router.get('/connections', (req: Request, res: Response) => {
  const user  = req.user!;
  const store = load();
  const conns = store.connections
    .filter(c => c.userId === user.userId)
    .map(({ gmailCreds: _g, outlookCreds: _o, imapCreds: _i, scannedIds: _s, ...safe }) => safe);
  res.json({ success: true, data: { connections: conns } });
});

router.delete('/connections/:id', (req: Request, res: Response) => {
  const user  = req.user!;
  const store = load();
  store.connections = store.connections.filter(c => !(c.id === req.params.id && c.userId === user.userId));
  save(store);
  res.json({ success: true, data: { deleted: true } });
});

// ── Internal insight queries ──────────────────────────────────────────────────

// Latest consolidated insight record for the current user
router.get('/insights/latest', (req: Request, res: Response) => {
  const user    = req.user!;
  const insight = getLatestInsights(user.userId);
  res.json({ success: true, data: { insight } });
});

// Full history (last N runs)
router.get('/insights/history', (req: Request, res: Response) => {
  const user    = req.user!;
  const limit   = Math.min(parseInt(req.query.limit as string) || 10, 50);
  const history = getInsightHistory(user.userId, limit);
  res.json({ success: true, data: { history } });
});

// Per-product insight summary (useful for dashboards embedding signal counts)
router.get('/insights/products', (req: Request, res: Response) => {
  const user    = req.user!;
  const insight = getLatestInsights(user.userId);
  if (!insight) return res.json({ success: true, data: { products: [] } });

  const products = Object.entries(insight.byProduct).map(([key, val]) => ({
    productKey: key, ...val,
    runAt:      insight.runAt,
    emailsProcessed: insight.emailsProcessed,
  }));
  res.json({ success: true, data: { products, runAt: insight.runAt, emailsProcessed: insight.emailsProcessed } });
});

// Service status (for health checks / admin)
router.get('/status', (_req: Request, res: Response) => {
  res.json({ success: true, data: getServiceStatus() });
});

// Manual scan trigger (for setup/testing)
router.post('/scan/trigger', async (_req: Request, res: Response) => {
  try {
    await triggerImmediateScan();
    res.json({ success: true, data: { triggered: true, message: 'Scan completed' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
