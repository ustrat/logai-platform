import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
};

export const inferenceApi = {
  analyze: (params: { account_id?: string; limit?: number }) =>
    api.post('/inference/analyze', params),
  anomalies: (accountId: string) =>
    api.get(`/inference/anomalies/${accountId}`),
  train: () => api.post('/inference/train'),
  accounts: () => api.get('/inference/accounts'),
  summary: () => api.get('/inference/summary'),
  reload: () => api.post('/inference/reload'),
};
export const plaidApi = {
  linkToken: () => api.post('/plaid/link-token'),
  exchangeToken: (public_token: string) => api.post('/plaid/exchange-token', { public_token }),
  transactions: (count = 100) => api.get(`/plaid/transactions?count=${count}`),
  accounts: () => api.get('/plaid/accounts'),
  status: () => api.get('/plaid/status'),
  sandboxConnect: () => api.post('/plaid/sandbox/connect'),
  disconnect: () => api.delete('/plaid/disconnect'),
};
export default api;