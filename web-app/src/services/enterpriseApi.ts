import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const client = axios.create({ baseURL: API_BASE });

export const enterpriseApi = {
  // Stats
  getStats: () =>
    client.get('/enterprise/stats', { headers: authHeader() }),

  // Customers
  getCustomers: () =>
    client.get('/enterprise/customers', { headers: authHeader() }),
  createCustomer: (data: Record<string, unknown>) =>
    client.post('/enterprise/customers', data, { headers: authHeader() }),
  updateCustomer: (id: string, data: Record<string, unknown>) =>
    client.put(`/enterprise/customers/${id}`, data, { headers: authHeader() }),

  // Orders
  getOrders: (params?: { status?: string; customerId?: string }) =>
    client.get('/enterprise/orders', { headers: authHeader(), params }),
  getOrder: (id: string) =>
    client.get(`/enterprise/orders/${id}`, { headers: authHeader() }),
  createOrder: (data: Record<string, unknown>) =>
    client.post('/enterprise/orders', data, { headers: authHeader() }),
  updateOrder: (id: string, data: Record<string, unknown>) =>
    client.put(`/enterprise/orders/${id}`, data, { headers: authHeader() }),
  submitOrder: (id: string) =>
    client.post(`/enterprise/orders/${id}/submit`, {}, { headers: authHeader() }),
  approveOrder: (id: string, comment?: string) =>
    client.post(`/enterprise/orders/${id}/approve`, { comment }, { headers: authHeader() }),
  rejectOrder: (id: string, comment: string) =>
    client.post(`/enterprise/orders/${id}/reject`, { comment }, { headers: authHeader() }),

  // Invoices
  createInvoice: (orderId: string, data: { sentTo?: string; dueDate?: string; notes?: string }) =>
    client.post(`/enterprise/orders/${orderId}/invoice`, data, { headers: authHeader() }),
  markPaid: (invoiceId: string) =>
    client.post(`/enterprise/invoices/${invoiceId}/mark-paid`, {}, { headers: authHeader() }),
  previewUrl: (invoiceId: string) =>
    `${API_BASE}/enterprise/invoices/${invoiceId}/preview?token=${localStorage.getItem('token')}`,
};
