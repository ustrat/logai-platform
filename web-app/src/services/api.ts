import axios from 'axios';
import { userManager } from '../auth/oidcConfig';

const api = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
});

// Attach the ID token (carries plan/entitlements claims from Pre-Token Lambda) to every request.
// Falls back to the legacy vp_auth store for backward-compatibility during migration.
api.interceptors.request.use(async (config) => {
  try {
    const user = await userManager.getUser();
    if (user && !user.expired) {
      config.headers.Authorization = `Bearer ${user.id_token ?? user.access_token}`;
      return config;
    }
  } catch {}

  // Legacy fallback (removed once all sessions migrate to OIDC)
  try {
    const raw = localStorage.getItem('vp_auth');
    const token = raw ? JSON.parse(raw).token : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {}

  return config;
});

// Handle 401 by attempting a silent token refresh, then retrying once.
api.interceptors.response.use(
  res => res,
  async err => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        await userManager.signinSilent();
        const user = await userManager.getUser();
        if (user && !user.expired) {
          original.headers.Authorization = `Bearer ${user.id_token ?? user.access_token}`;
          return api(original);
        }
      } catch {}
    }
    return Promise.reject(err);
  },
);

export const inferenceApi = {
  analyze:    (params: { account_id?: string; limit?: number }) =>
                api.post('/inference/analyze', params),
  anomalies:  (accountId: string) => api.get(`/inference/anomalies/${accountId}`),
  train:      () => api.post('/inference/train'),
  accounts:   () => api.get('/inference/accounts'),
  summary:    () => api.get('/inference/summary'),
  reload:     () => api.post('/inference/reload'),
};

export const plaidApi = {
  linkToken:      () => api.post('/plaid/link-token'),
  exchangeToken:  (public_token: string) => api.post('/plaid/exchange-token', { public_token }),
  transactions:   (count = 100) => api.get(`/plaid/transactions?count=${count}`),
  accounts:       () => api.get('/plaid/accounts'),
  status:         () => api.get('/plaid/status'),
  sandboxConnect: () => api.post('/plaid/sandbox/connect'),
  disconnect:     () => api.delete('/plaid/disconnect'),
};

export const entitlementApi = {
  me:           () => api.get('/entitlements/me'),
  check:        (featureKey: string) => api.get(`/entitlements/check/${featureKey}`),
  version:      () => api.get('/entitlements/version'),
  subscription: () => api.get('/entitlements/subscription'),
  catalog:      (planId: string) => api.get(`/entitlements/catalog/${planId}`),
};

export const profileApi = {
  get:                  ()                                        => api.get('/profile'),
  save:                 (data: { firstName: string; lastName: string }) => api.put('/profile', data),
  getNotifications:     ()                                        => api.get('/profile/notifications'),
  saveNotifications:    (preferences: Record<string, boolean>)   => api.put('/profile/notifications', { preferences }),
};

export default api;
