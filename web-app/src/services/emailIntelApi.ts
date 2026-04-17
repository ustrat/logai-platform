import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';
const client   = axios.create({ baseURL: API_BASE });

function auth() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const emailIntelApi = {
  // Connections
  getConnections:    () => client.get('/email-intel/connections', { headers: auth() }),
  deleteConnection:  (id: string) => client.delete(`/email-intel/connections/${id}`, { headers: auth() }),
  connectImap:       (data: { host: string; port: number; secure: boolean; user: string; password: string }) =>
    client.post('/email-intel/connect/imap', data, { headers: auth() }),
  getGmailAuthUrl:   () => client.get('/email-intel/connect/gmail/url', { headers: auth() }),
  getOutlookAuthUrl: () => client.get('/email-intel/connect/outlook/url', { headers: auth() }),

  // Scan
  scan: (opts?: { daysSince?: number; minConfidence?: number }) =>
    client.post('/email-intel/scan', opts || {}, { headers: auth() }),

  // Results
  getSignals:     (params?: { product?: string; status?: string; minConfidence?: number; limit?: number; offset?: number }) =>
    client.get('/email-intel/signals', { headers: auth(), params }),
  updateSignal:   (id: string, status: string) =>
    client.patch(`/email-intel/signals/${id}`, { status }, { headers: auth() }),
  getCorrelation: () => client.get('/email-intel/correlation', { headers: auth() }),
};
