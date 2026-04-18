import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ⚠️ Replace with your computer's local IP address when testing on a real device
// Find it by running `ipconfig` in Windows terminal — look for IPv4 Address
// Example: http://192.168.1.42:4000
export const API_BASE_KEY = 'api_base_url';
const DEFAULT_API_BASE = 'http://192.168.1.155:4000';

let _apiBase = DEFAULT_API_BASE;

// Axios instance — declared first so helper functions below can reference it safely
const api = axios.create({
  baseURL: 'http://192.168.1.155:4000/api/v1',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  // Always use the current _apiBase — picks up changes from loadApiBase()
  config.baseURL = `${_apiBase}/api/v1`;
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export async function loadApiBase() {
  const stored = await SecureStore.getItemAsync(API_BASE_KEY);
  // Replace emulator-only address with LAN IP (migration for real devices)
  if (stored && stored.includes('10.0.2.2')) {
    _apiBase = DEFAULT_API_BASE;
    await SecureStore.setItemAsync(API_BASE_KEY, _apiBase);
  } else if (stored) {
    _apiBase = stored;
  }
  api.defaults.baseURL = `${_apiBase}/api/v1`;
  return _apiBase;
}

export async function saveApiBase(url: string) {
  _apiBase = url.replace(/\/$/, '');
  await SecureStore.setItemAsync(API_BASE_KEY, _apiBase);
  api.defaults.baseURL = `${_apiBase}/api/v1`;
}

export function getApiBase() {
  return _apiBase;
}

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
};

export const plaidApi = {
  status: () => api.get('/plaid/status'),
  createLinkToken: () => api.post('/plaid/link-token'),
  connectSandbox: () => api.post('/plaid/sandbox/connect'),
  disconnect: () => api.delete('/plaid/disconnect'),
  transactions: (limit = 50, offset = 0) =>
    api.get(`/plaid/transactions?limit=${limit}&offset=${offset}`),
  accounts: () => api.get('/plaid/accounts'),
};

export const subscriptionsApi = {
  list: (days = 365, minConfidence = 0.4) =>
    api.get(`/subscriptions?days=${days}&min_confidence=${minConfidence}`),
};

export default api;
