/**
 * ValuePilot Partner Portal — License Management API
 *
 * Supports bulk enterprise license assignment for:
 *   - Federal Government (agency, clearance, CAC/PIV)
 *   - Commercial Enterprise (department, cost centre, SSO)
 *
 * Storage: JSON file (swap to DB via env flag when ready)
 */

import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const router = Router();
router.use(authenticate);

// ── Data store (JSON file, survives restarts) ─────────────────────────────────
const STORE_FILE = path.join(__dirname, '../../.partner-portal.json');

type OrgType    = 'federal' | 'commercial';
type LicenseTier = 'standard' | 'elevated' | 'top_secret'; // federal clearance levels
type MemberStatus = 'active' | 'pending' | 'revoked' | 'suspended';
type MemberRole   = 'org_admin' | 'manager' | 'user' | 'viewer';

interface Member {
  id:           string;
  orgId:        string;
  email:        string;
  name:         string;
  department:   string;
  jobTitle:     string;
  role:         MemberRole;
  productKeys:  string[];   // which ValuePilot products this seat covers
  status:       MemberStatus;
  accessLevel:  LicenseTier;
  // Federal-specific
  agencyCode?:     string;
  cacEnabled?:     boolean;
  clearanceLevel?: string;
  // Commercial-specific
  costCenter?: string;
  managerId?:  string;
  // Metadata
  assignedBy:  string;
  assignedAt:  string;
  lastActiveAt?: string;
  notes?:      string;
}

interface AuditEntry {
  id:        string;
  orgId:     string;
  action:    'assign' | 'revoke' | 'modify' | 'suspend' | 'reinstate' | 'bulk_import' | 'settings_change';
  actorId:   string;
  actorEmail: string;
  targetEmail?: string;
  targetName?:  string;
  detail:    string;
  timestamp: string;
  ipAddress?: string;
}

interface OrgSettings {
  orgId:      string;
  orgName:    string;
  orgType:    OrgType;
  domain:     string;
  // License pool per product
  licensePools: Record<string, { total: number; reserved: number }>;
  ssoEnabled: boolean;
  ssoProvider?: string;
  // Federal
  agencyName?:    string;
  fismaLevel?:    'low' | 'moderate' | 'high';
  contractNumber?: string;
  cotrEmail?:     string;
  // Commercial
  accountManager?: string;
  // Timestamps
  createdAt:  string;
  updatedAt:  string;
}

interface Store {
  orgs:    Record<string, OrgSettings>;
  members: Member[];
  audit:   AuditEntry[];
}

function loadStore(): Store {
  try {
    if (fs.existsSync(STORE_FILE)) return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
  } catch {}
  return { orgs: {}, members: [], audit: [] };
}

function saveStore(store: Store) {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2)); } catch {}
}

function getOrCreateOrg(userId: string, email: string): { store: Store; org: OrgSettings } {
  const store  = loadStore();
  const orgId  = `org_${userId}`;
  if (!store.orgs[orgId]) {
    const domain = email.split('@')[1] || 'unknown.org';
    store.orgs[orgId] = {
      orgId, orgName: domain, orgType: 'commercial', domain,
      licensePools: {
        renewalguard: { total: 25, reserved: 0 },
        refundpilot:  { total: 25, reserved: 0 },
      },
      ssoEnabled: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    saveStore(store);
  }
  return { store, org: store.orgs[orgId] };
}

function addAudit(store: Store, entry: Omit<AuditEntry, 'id' | 'timestamp'>) {
  store.audit.unshift({ id: randomUUID(), timestamp: new Date().toISOString(), ...entry });
  // Keep last 500 entries
  if (store.audit.length > 500) store.audit = store.audit.slice(0, 500);
}

function usedLicenses(members: Member[], orgId: string, productKey: string) {
  return members.filter(m => m.orgId === orgId && m.status === 'active' && m.productKeys.includes(productKey)).length;
}

// ── GET /org — org settings + licence summary ─────────────────────────────────
router.get('/org', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const members = store.members.filter(m => m.orgId === org.orgId);

  const poolSummary = Object.entries(org.licensePools).reduce((acc, [product, pool]) => {
    const used = usedLicenses(store.members, org.orgId, product);
    acc[product] = { total: pool.total, used, available: pool.total - used };
    return acc;
  }, {} as Record<string, { total: number; used: number; available: number }>);

  res.json({ success: true, data: { org, licensePools: poolSummary, totalMembers: members.length } });
});

// ── PUT /org — update org settings ───────────────────────────────────────────
router.put('/org', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const allowed = ['orgName', 'orgType', 'domain', 'ssoEnabled', 'ssoProvider',
    'agencyName', 'fismaLevel', 'contractNumber', 'cotrEmail', 'accountManager'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) (org as any)[key] = req.body[key];
  }
  org.updatedAt = new Date().toISOString();
  store.orgs[org.orgId] = org;
  addAudit(store, { orgId: org.orgId, action: 'settings_change', actorId: user.userId, actorEmail: user.email, detail: 'Organisation settings updated' });
  saveStore(store);
  res.json({ success: true, data: { org } });
});

// ── PUT /org/pool — adjust licence pool sizes ────────────────────────────────
router.put('/org/pool', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const { product, total } = req.body;
  if (!product || typeof total !== 'number' || total < 0)
    return res.status(400).json({ success: false, error: 'product and total (number) are required' });
  if (!org.licensePools[product]) org.licensePools[product] = { total: 0, reserved: 0 };
  org.licensePools[product].total = total;
  org.updatedAt = new Date().toISOString();
  store.orgs[org.orgId] = org;
  saveStore(store);
  res.json({ success: true, data: { product, total } });
});

// ── GET /members — list all members ──────────────────────────────────────────
router.get('/members', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  let members = store.members.filter(m => m.orgId === org.orgId);

  // Filters
  const { status, department, product, search, role } = req.query as Record<string, string>;
  if (status)     members = members.filter(m => m.status === status);
  if (department) members = members.filter(m => m.department === department);
  if (role)       members = members.filter(m => m.role === role);
  if (product)    members = members.filter(m => m.productKeys.includes(product));
  if (search) {
    const q = search.toLowerCase();
    members = members.filter(m =>
      m.email.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q),
    );
  }

  // Unique departments for filter UI
  const allMembers = store.members.filter(m => m.orgId === org.orgId);
  const departments = [...new Set(allMembers.map(m => m.department).filter(Boolean))].sort();

  res.json({ success: true, data: { members, total: members.length, departments } });
});

// ── POST /members — assign a single licence ───────────────────────────────────
router.post('/members', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const { email, name, department, jobTitle, role, productKeys, accessLevel,
    agencyCode, cacEnabled, clearanceLevel, costCenter, managerId, notes } = req.body;

  if (!email || !name) return res.status(400).json({ success: false, error: 'email and name are required' });

  const products: string[] = Array.isArray(productKeys) ? productKeys : ['renewalguard'];

  // Check licence availability
  for (const product of products) {
    const pool = org.licensePools[product];
    if (!pool) continue;
    const used = usedLicenses(store.members, org.orgId, product);
    if (used >= pool.total)
      return res.status(409).json({ success: false, error: `No available licences for ${product}. Used ${used}/${pool.total}.` });
  }

  // Check for duplicate
  const existing = store.members.find(m => m.orgId === org.orgId && m.email.toLowerCase() === email.toLowerCase() && m.status !== 'revoked');
  if (existing) return res.status(409).json({ success: false, error: 'This email already has an active licence in your organisation.' });

  const member: Member = {
    id: randomUUID(), orgId: org.orgId, email, name,
    department: department || 'Unassigned',
    jobTitle:   jobTitle   || '',
    role:       role       || 'user',
    productKeys: products,
    status:     'active',
    accessLevel: accessLevel || 'standard',
    agencyCode, cacEnabled: !!cacEnabled, clearanceLevel,
    costCenter, managerId, notes,
    assignedBy: user.userId, assignedAt: new Date().toISOString(),
  };

  store.members.push(member);
  addAudit(store, { orgId: org.orgId, action: 'assign', actorId: user.userId, actorEmail: user.email, targetEmail: email, targetName: name, detail: `Licence assigned for ${products.join(', ')}` });
  saveStore(store);
  res.status(201).json({ success: true, data: { member } });
});

// ── POST /members/bulk — CSV bulk import ──────────────────────────────────────
router.post('/members/bulk', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const { members: rows, productKeys } = req.body;

  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ success: false, error: 'members array is required' });

  const products: string[] = Array.isArray(productKeys) ? productKeys : ['renewalguard'];
  const results = { added: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    if (!row.email || !row.name) { results.errors.push(`Row missing email/name: ${JSON.stringify(row)}`); results.skipped++; continue; }

    const dupe = store.members.find(m => m.orgId === org.orgId && m.email.toLowerCase() === row.email.toLowerCase() && m.status !== 'revoked');
    if (dupe) { results.skipped++; continue; }

    // Licence check (just total across all products)
    for (const product of products) {
      const pool = org.licensePools[product];
      if (pool && usedLicenses(store.members, org.orgId, product) >= pool.total) {
        results.errors.push(`Licence pool exhausted for ${product}`);
        results.skipped++;
        continue;
      }
    }

    store.members.push({
      id: randomUUID(), orgId: org.orgId,
      email: row.email, name: row.name,
      department: row.department || 'Unassigned',
      jobTitle: row.jobTitle || '', role: row.role || 'user',
      productKeys: products, status: 'active', accessLevel: row.accessLevel || 'standard',
      agencyCode: row.agencyCode, cacEnabled: !!row.cacEnabled, clearanceLevel: row.clearanceLevel,
      costCenter: row.costCenter, managerId: row.managerId, notes: row.notes,
      assignedBy: user.userId, assignedAt: new Date().toISOString(),
    });
    results.added++;
  }

  addAudit(store, { orgId: org.orgId, action: 'bulk_import', actorId: user.userId, actorEmail: user.email, detail: `Bulk import: ${results.added} added, ${results.skipped} skipped` });
  saveStore(store);
  res.json({ success: true, data: results });
});

// ── PUT /members/:id — update a member ────────────────────────────────────────
router.put('/members/:id', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const idx = store.members.findIndex(m => m.id === req.params.id && m.orgId === org.orgId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Member not found' });

  const editable = ['name', 'department', 'jobTitle', 'role', 'productKeys', 'accessLevel',
    'agencyCode', 'cacEnabled', 'clearanceLevel', 'costCenter', 'managerId', 'notes'];
  for (const key of editable) {
    if (req.body[key] !== undefined) (store.members[idx] as any)[key] = req.body[key];
  }

  addAudit(store, { orgId: org.orgId, action: 'modify', actorId: user.userId, actorEmail: user.email, targetEmail: store.members[idx].email, targetName: store.members[idx].name, detail: 'Member record updated' });
  saveStore(store);
  res.json({ success: true, data: { member: store.members[idx] } });
});

// ── POST /members/:id/revoke ───────────────────────────────────────────────────
router.post('/members/:id/revoke', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const idx = store.members.findIndex(m => m.id === req.params.id && m.orgId === org.orgId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Member not found' });

  store.members[idx].status = 'revoked';
  addAudit(store, { orgId: org.orgId, action: 'revoke', actorId: user.userId, actorEmail: user.email, targetEmail: store.members[idx].email, targetName: store.members[idx].name, detail: req.body.reason || 'Licence revoked' });
  saveStore(store);
  res.json({ success: true, data: { member: store.members[idx] } });
});

// ── POST /members/:id/suspend ─────────────────────────────────────────────────
router.post('/members/:id/suspend', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const idx = store.members.findIndex(m => m.id === req.params.id && m.orgId === org.orgId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Member not found' });

  const action = store.members[idx].status === 'suspended' ? 'reinstate' : 'suspend';
  store.members[idx].status = action === 'suspend' ? 'suspended' : 'active';
  addAudit(store, { orgId: org.orgId, action, actorId: user.userId, actorEmail: user.email, targetEmail: store.members[idx].email, targetName: store.members[idx].name, detail: `Member ${action}d` });
  saveStore(store);
  res.json({ success: true, data: { member: store.members[idx], action } });
});

// ── DELETE /members/:id ───────────────────────────────────────────────────────
router.delete('/members/:id', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const idx = store.members.findIndex(m => m.id === req.params.id && m.orgId === org.orgId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Member not found' });

  const { email, name } = store.members[idx];
  store.members.splice(idx, 1);
  addAudit(store, { orgId: org.orgId, action: 'revoke', actorId: user.userId, actorEmail: user.email, targetEmail: email, targetName: name, detail: 'Member permanently removed' });
  saveStore(store);
  res.json({ success: true, data: { deleted: true } });
});

// ── GET /audit — audit log ────────────────────────────────────────────────────
router.get('/audit', (req: Request, res: Response) => {
  const user = req.user!;
  const { store, org } = getOrCreateOrg(user.userId, user.email);
  const limit  = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const offset = parseInt(req.query.offset as string) || 0;
  const entries = store.audit.filter(e => e.orgId === org.orgId).slice(offset, offset + limit);
  const total   = store.audit.filter(e => e.orgId === org.orgId).length;
  res.json({ success: true, data: { entries, total, limit, offset } });
});

export default router;
