import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ⚠️ Replace with your computer's local IP address when testing on a real device
// Find it by running `ipconfig` in Windows terminal — look for IPv4 Address
// Example: http://192.168.1.42:4000
const API_BASE = '192.168.1.155';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
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
};

export default api;