import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const client = axios.create({ baseURL: API_BASE });

export const partnerPortalApi = {
  getOrg: () =>
    client.get('/partner/org', { headers: authHeader() }),

  updateOrg: (data: Record<string, unknown>) =>
    client.put('/partner/org', data, { headers: authHeader() }),

  updatePool: (product: string, total: number) =>
    client.put('/partner/org/pool', { product, total }, { headers: authHeader() }),

  getMembers: (params?: { status?: string; department?: string; product?: string; search?: string; role?: string }) =>
    client.get('/partner/members', { headers: authHeader(), params }),

  addMember: (data: Record<string, unknown>) =>
    client.post('/partner/members', data, { headers: authHeader() }),

  bulkImport: (members: Record<string, unknown>[], productKeys: string[]) =>
    client.post('/partner/members/bulk', { members, productKeys }, { headers: authHeader() }),

  updateMember: (id: string, data: Record<string, unknown>) =>
    client.put(`/partner/members/${id}`, data, { headers: authHeader() }),

  revokeMember: (id: string, reason?: string) =>
    client.post(`/partner/members/${id}/revoke`, { reason }, { headers: authHeader() }),

  suspendToggle: (id: string) =>
    client.post(`/partner/members/${id}/suspend`, {}, { headers: authHeader() }),

  deleteMember: (id: string) =>
    client.delete(`/partner/members/${id}`, { headers: authHeader() }),

  getAuditLog: (limit = 50, offset = 0) =>
    client.get('/partner/audit', { headers: authHeader(), params: { limit, offset } }),
};
