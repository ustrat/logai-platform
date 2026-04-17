/**
 * ValuePilot Unified Email Connector
 * Supports Gmail (OAuth2), Microsoft Graph/Outlook (OAuth2), and IMAP (any provider)
 * All three providers expose the same EmailMessage interface.
 */

import { ImapFlow } from 'imapflow';
import { simpleParser, ParsedMail } from 'mailparser';
import { google, gmail_v1 } from 'googleapis';
import { Readable } from 'stream';

export type EmailProvider = 'gmail' | 'outlook' | 'imap';

export interface EmailMessage {
  id:       string;
  subject:  string;
  from:     string;
  date:     Date;
  body:     string;   // plain-text excerpt (first 2 000 chars)
  snippet:  string;   // short preview
}

export interface GmailCredentials {
  accessToken:  string;
  refreshToken: string;
  clientId:     string;
  clientSecret: string;
}

export interface OutlookCredentials {
  accessToken:  string;
  refreshToken: string;
  clientId:     string;
  clientSecret: string;
  tenantId:     string;
}

export interface ImapCredentials {
  host:     string;
  port:     number;
  secure:   boolean;
  user:     string;
  password: string;  // app password or OAuth XOAUTH2 string
}

// ── Gmail ─────────────────────────────────────────────────────────────────────
export async function fetchGmailMessages(
  creds: GmailCredentials,
  since: Date,
  maxMessages = 200,
): Promise<EmailMessage[]> {
  const oauth2Client = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
  oauth2Client.setCredentials({
    access_token:  creds.accessToken,
    refresh_token: creds.refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const afterEpoch = Math.floor(since.getTime() / 1000);

  // Search for messages since date
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: `after:${afterEpoch}`,
    maxResults: maxMessages,
  });

  const messageIds = listRes.data.messages || [];
  const messages: EmailMessage[] = [];

  for (const msg of messageIds) {
    try {
      const detail = await gmail.users.messages.get({
        userId:  'me',
        id:      msg.id!,
        format:  'full',
      });

      const payload  = detail.data.payload;
      const headers  = payload?.headers || [];
      const subject  = headers.find(h => h.name?.toLowerCase() === 'subject')?.value || '(no subject)';
      const from     = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
      const dateStr  = headers.find(h => h.name?.toLowerCase() === 'date')?.value || '';
      const snippet  = detail.data.snippet || '';

      // Extract body from parts
      let body = '';
      function extractBody(parts: gmail_v1.Schema$MessagePart[] | undefined) {
        if (!parts) return;
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body += Buffer.from(part.body.data, 'base64').toString('utf8');
          }
          if (part.parts) extractBody(part.parts);
        }
      }
      // Also check top-level body
      if (payload?.mimeType === 'text/plain' && payload.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf8');
      } else {
        extractBody(payload?.parts);
      }

      messages.push({
        id:      msg.id!,
        subject,
        from,
        date:    new Date(dateStr),
        body:    body.slice(0, 2000),
        snippet,
      });
    } catch { /* skip unreadable messages */ }
  }

  return messages;
}

export function buildGmailAuthUrl(clientId: string, clientSecret: string, redirectUri: string): string {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt:      'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  });
}

export async function exchangeGmailCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  const profile = await google.oauth2({ version: 'v2', auth: oauth2Client }).userinfo.get();
  return {
    accessToken:  tokens.access_token!,
    refreshToken: tokens.refresh_token!,
    email:        profile.data.email!,
  };
}

// ── Microsoft Graph / Outlook ─────────────────────────────────────────────────
export function buildOutlookAuthUrl(clientId: string, tenantId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id:     clientId,
    response_type: 'code',
    redirect_uri:  redirectUri,
    response_mode: 'query',
    scope:         'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access',
    prompt:        'consent',
  });
  return `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params}`;
}

export async function exchangeOutlookCode(
  code: string,
  clientId: string,
  clientSecret: string,
  tenantId: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; email: string }> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      scope:         'https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read offline_access',
    }),
  });
  const data = await res.json() as { access_token: string; refresh_token: string };

  // Get user email
  const meRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const me = await meRes.json() as { mail?: string; userPrincipalName?: string };

  return {
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    email:        me.mail || me.userPrincipalName || '',
  };
}

export async function fetchOutlookMessages(
  creds: OutlookCredentials,
  since: Date,
  maxMessages = 200,
): Promise<EmailMessage[]> {
  // Refresh token if needed (simplified — use refresh_token grant)
  const refreshRes = await fetch(`https://login.microsoftonline.com/${creds.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      grant_type:    'refresh_token',
      refresh_token: creds.refreshToken,
      scope:         'https://graph.microsoft.com/Mail.Read offline_access',
    }),
  });
  const refreshed = await refreshRes.json() as { access_token: string };
  const token     = refreshed.access_token || creds.accessToken;

  const sinceISO = since.toISOString();
  const url = `https://graph.microsoft.com/v1.0/me/messages?$top=${maxMessages}&$filter=receivedDateTime ge ${sinceISO}&$select=id,subject,from,receivedDateTime,bodyPreview,body&$orderby=receivedDateTime desc`;

  const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json() as { value?: any[] };

  return (data.value || []).map((msg: any) => ({
    id:      msg.id,
    subject: msg.subject || '(no subject)',
    from:    msg.from?.emailAddress?.address || '',
    date:    new Date(msg.receivedDateTime),
    body:    (msg.body?.content || '').replace(/<[^>]*>/g, ' ').slice(0, 2000),
    snippet: msg.bodyPreview || '',
  }));
}

// ── IMAP (universal) ──────────────────────────────────────────────────────────
export async function fetchImapMessages(
  creds: ImapCredentials,
  since: Date,
  maxMessages = 200,
): Promise<EmailMessage[]> {
  const client = new ImapFlow({
    host:   creds.host,
    port:   creds.port,
    secure: creds.secure,
    auth:   { user: creds.user, pass: creds.password },
    logger: false,
  });

  await client.connect();
  const messages: EmailMessage[] = [];

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uids = await client.search({ since }, { uid: true });
      const uidArray = Array.isArray(uids) ? uids : [];
      const recentUids = uidArray.slice(-maxMessages);

      for await (const msg of client.fetch(recentUids, { source: true, envelope: true }, { uid: true })) {
        try {
          let parsed: ParsedMail;
          if (msg.source instanceof Readable) {
            parsed = await simpleParser(msg.source);
          } else {
            parsed = await simpleParser(msg.source as Buffer);
          }
          messages.push({
            id:      String(msg.uid),
            subject: parsed.subject || '(no subject)',
            from:    parsed.from?.text || '',
            date:    parsed.date || new Date(),
            body:    (parsed.text || '').slice(0, 2000),
            snippet: (parsed.text || '').slice(0, 160),
          });
        } catch { /* skip malformed */ }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return messages;
}

export async function testImapConnection(creds: ImapCredentials): Promise<{ success: boolean; error?: string }> {
  const client = new ImapFlow({
    host: creds.host, port: creds.port, secure: creds.secure,
    auth: { user: creds.user, pass: creds.password },
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
