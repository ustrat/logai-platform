import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const client = axios.create({ baseURL: API_BASE });

export const paymentsApi = {
  /** Fetch all active products + prices from Stripe */
  getProducts: () =>
    client.get('/payments/products', { headers: authHeader() }),

  /** Get all active subscriptions for the current user */
  getSubscription: () =>
    client.get('/payments/subscription', { headers: authHeader() }),

  /** Create Stripe Checkout session using a Stripe price ID directly */
  createCheckoutSession: (priceId: string, successUrl: string, cancelUrl: string) =>
    client.post('/payments/checkout', { priceId, successUrl, cancelUrl }, { headers: authHeader() }),

  /** Create Stripe Customer Portal session */
  createPortalSession: () =>
    client.post('/payments/portal', {}, { headers: authHeader() }),
};
