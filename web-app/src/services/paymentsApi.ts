import api from './api';

export const paymentsApi = {
  getProducts:           ()                                               => api.get('/payments/products'),
  getSubscription:       ()                                               => api.get('/payments/subscription'),
  createCheckoutSession: (priceId: string, successUrl: string, cancelUrl: string) =>
    api.post('/payments/checkout', { priceId, successUrl, cancelUrl }),
  createPortalSession:   ()                                               => api.post('/payments/portal', {}),
};

export const catalogApi = {
  getProducts:  ()                                                         => api.get('/catalog/products'),
  getProduct:   (productKey: string)                                       => api.get(`/catalog/products/${productKey}`),
  seed:         ()                                                         => api.post('/catalog/seed'),
  syncStripe:   ()                                                         => api.post('/catalog/sync-stripe'),
};
