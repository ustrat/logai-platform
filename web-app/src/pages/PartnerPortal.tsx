import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Building2, Shield, Search, Plus, Upload, Download,
  MoreHorizontal, CheckCircle2, XCircle, PauseCircle, Trash2,
  Edit3, ChevronDown, ChevronUp, AlertTriangle, Activity,
  FileText, Settings2, X, Loader2, Lock, Globe,
} from 'lucide-react';
import { partnerPortalApi } from '../services/partnerPortalApi';

// ─── Types ─────────────────────────────────────────────────────────────────────
type OrgType = 'federal' | 'commercial';
type MemberStatus = 'active' | 'pending' | 'revoked' | 'suspended';
type MemberRole = 'org_admin' | 'manager' | 'user' | 'viewer';

interface LicensePool {
  total: number;
  used: number;
  available: number;
}

interface OrgData {
  orgId: string;
  orgName: string;
  orgType: OrgType;
  domain: string;
  licensePools: Record<string, LicensePool>;
  ssoEnabled: boolean;
  ssoProvider?: string;
  agencyName?: string;
  fismaLevel?: string;
  contractNumber?: string;
  cotrEmail?: string;
  accountManager?: string;
  totalMembers: number;
}

interface Member {
  id: string;
  email: string;
  name: string;
  department: string;
  jobTitle: string;
  role: MemberRole;
  productKeys: string[];
  status: MemberStatus;
  accessLevel: string;
  agencyCode?: string;
  cacEnabled?: boolean;
  clearanceLevel?: string;
  costCenter?: string;
  managerId?: string;
  notes?: string;
  assignedBy: string;
  assignedAt: string;
  lastActiveAt?: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actorEmail: string;
  targetEmail?: string;
  targetName?: string;
  detail: string;
  timestamp: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const PRODUCT_LABELS: Record<string, string> = {
  renewalguard: 'RenewalGuard',
  refundpilot:  'RefundPilot',
};

const ROLE_LABELS: Record<MemberRole, string> = {
  org_admin: 'Admin',
  manager:   'Manager',
  user:      'User',
  viewer:    'Viewer',
};

const STATUS_CONFIG: Record<MemberStatus, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',    color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  pending:   { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  suspended: { label: 'Suspended', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
  revoked:   { label: 'Revoked',   color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
};

const CLEARANCE_LEVELS = ['None', 'Public Trust', 'Secret', 'Top Secret', 'TS/SCI'];

// ─── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', borderLeft: `3px solid ${accent}` }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: accent, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function PoolBar({ product, pool }: { product: string; pool: LicensePool }) {
  const pct = pool.total > 0 ? Math.round((pool.used / pool.total) * 100) : 0;
  const warn = pct >= 90;
  const color = warn ? '#ef4444' : pct >= 70 ? '#f59e0b' : '#22c55e';
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '1px' }}>{PRODUCT_LABELS[product] || product}</span>
        <span style={{ fontSize: 11, color: warn ? '#ef4444' : 'var(--text-muted)' }}>{pool.used} / {pool.total}</span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{pool.available} available</div>
    </div>
  );
}

function StatusBadge({ status }: { status: MemberStatus }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.revoked;
  return (
    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, fontWeight: 700, letterSpacing: '0.5px' }}>
      {cfg.label}
    </span>
  );
}

function RoleBadge({ role }: { role: MemberRole }) {
  const colors: Record<MemberRole, string> = {
    org_admin: '#7c3aed', manager: '#0891b2', user: 'rgba(255,255,255,0.5)', viewer: 'rgba(255,255,255,0.3)',
  };
  return (
    <span style={{ fontSize: 10, color: colors[role] || '#999', letterSpacing: '0.5px' }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

// ─── Add Member Modal ──────────────────────────────────────────────────────────
function AddMemberModal({ orgType, products, onClose, onSave }: {
  orgType: OrgType;
  products: string[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    email: '', name: '', department: '', jobTitle: '',
    role: 'user' as MemberRole,
    productKeys: [products[0] || 'renewalguard'],
    accessLevel: 'standard',
    // Federal
    agencyCode: '', clearanceLevel: 'None', cacEnabled: false,
    // Commercial
    costCenter: '', notes: '',
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const toggleProduct = (p: string) => {
    setForm(f => ({
      ...f,
      productKeys: f.productKeys.includes(p) ? f.productKeys.filter(x => x !== p) : [...f.productKeys, p],
    }));
  };

  const isFederal = orgType === 'federal';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '1px', color: 'var(--text-primary)' }}>ASSIGN LICENCE</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        {/* Identity */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="FULL NAME *" value={form.name} onChange={v => set('name', v)} placeholder="Jane Smith" />
          <Field label="EMAIL ADDRESS *" value={form.email} onChange={v => set('email', v)} placeholder="jane@agency.gov" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="DEPARTMENT" value={form.department} onChange={v => set('department', v)} placeholder="IT Security" />
          <Field label="JOB TITLE" value={form.jobTitle} onChange={v => set('jobTitle', v)} placeholder="Systems Analyst" />
        </div>

        {/* Role */}
        <SelectField label="PORTAL ROLE" value={form.role} onChange={v => set('role', v)}
          options={[['org_admin','Admin'],['manager','Manager'],['user','User'],['viewer','Viewer']]} />

        {/* Products */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>PRODUCT LICENCES</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {products.map(p => (
              <button key={p} onClick={() => toggleProduct(p)}
                style={{ padding: '5px 14px', borderRadius: 4, fontSize: 11, cursor: 'pointer', border: `1px solid ${form.productKeys.includes(p) ? '#f59e0b' : 'var(--border)'}`, background: form.productKeys.includes(p) ? 'rgba(245,158,11,0.1)' : 'transparent', color: form.productKeys.includes(p) ? '#f59e0b' : 'var(--text-muted)', fontWeight: form.productKeys.includes(p) ? 700 : 400 }}>
                {PRODUCT_LABELS[p] || p}
              </button>
            ))}
          </div>
        </div>

        {/* Federal-specific */}
        {isFederal && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Shield size={12} color="#7c3aed" />
              <span style={{ fontSize: 10, letterSpacing: '1.5px', color: '#7c3aed' }}>FEDERAL FIELDS</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <Field label="AGENCY CODE" value={form.agencyCode} onChange={v => set('agencyCode', v)} placeholder="DOD-7890" />
              <SelectField label="CLEARANCE LEVEL" value={form.clearanceLevel} onChange={v => set('clearanceLevel', v)}
                options={CLEARANCE_LEVELS.map(l => [l, l])} />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.cacEnabled} onChange={e => set('cacEnabled', e.target.checked)} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>CAC/PIV authentication enabled</span>
            </label>
          </div>
        )}

        {/* Commercial-specific */}
        {!isFederal && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 14 }}>
            <Field label="COST CENTER" value={form.costCenter} onChange={v => set('costCenter', v)} placeholder="CC-1234" />
          </div>
        )}

        <Field label="NOTES" value={form.notes} onChange={v => set('notes', v)} placeholder="Optional notes..." />

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={() => {
            if (!form.email || !form.name) return;
            onSave(form);
          }} style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: '#f59e0b', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700, letterSpacing: '0.5px' }}>
            ASSIGN LICENCE
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div style={{ marginBottom: 2 }}>
      <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }} />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 5 }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12 }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ─── Org Settings Panel ────────────────────────────────────────────────────────
function OrgSettingsPanel({ org, onClose }: { org: OrgData; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    orgName: org.orgName,
    orgType: org.orgType as OrgType,
    domain: org.domain,
    ssoEnabled: org.ssoEnabled,
    ssoProvider: org.ssoProvider || '',
    agencyName: org.agencyName || '',
    fismaLevel: org.fismaLevel || '',
    contractNumber: org.contractNumber || '',
    cotrEmail: org.cotrEmail || '',
    accountManager: org.accountManager || '',
  });

  const mutation = useMutation({
    mutationFn: () => partnerPortalApi.updateOrg(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['partnerOrg'] }); onClose(); },
  });

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const isFederal = form.orgType === 'federal';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 28, width: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '1px', color: 'var(--text-primary)' }}>ORGANISATION SETTINGS</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <SelectField label="ACCOUNT TYPE" value={form.orgType} onChange={v => set('orgType', v)}
          options={[['federal','Federal Government'],['commercial','Commercial Enterprise']]} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <Field label="ORGANISATION NAME" value={form.orgName} onChange={v => set('orgName', v)} />
          <Field label="PRIMARY DOMAIN" value={form.domain} onChange={v => set('domain', v)} placeholder="agency.gov" />
        </div>

        {isFederal ? (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Shield size={12} color="#7c3aed" />
              <span style={{ fontSize: 10, letterSpacing: '1.5px', color: '#7c3aed' }}>FEDERAL / GOVERNMENT</span>
            </div>
            <Field label="AGENCY NAME" value={form.agencyName} onChange={v => set('agencyName', v)} placeholder="Dept of Homeland Security" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <SelectField label="FISMA LEVEL" value={form.fismaLevel} onChange={v => set('fismaLevel', v)}
                options={[['','Select...'],['low','Low'],['moderate','Moderate'],['high','High']]} />
              <Field label="CONTRACT NUMBER" value={form.contractNumber} onChange={v => set('contractNumber', v)} placeholder="GS-10F-0123X" />
            </div>
            <Field label="COTR EMAIL" value={form.cotrEmail} onChange={v => set('cotrEmail', v)} placeholder="cotr@agency.gov" />
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Globe size={12} color="#0891b2" />
              <span style={{ fontSize: 10, letterSpacing: '1.5px', color: '#0891b2' }}>COMMERCIAL ENTERPRISE</span>
            </div>
            <Field label="ACCOUNT MANAGER" value={form.accountManager} onChange={v => set('accountManager', v)} placeholder="Account manager name" />
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ssoEnabled} onChange={e => set('ssoEnabled', e.target.checked)} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>SSO / SAML integration</span>
            </label>
          </div>
          {form.ssoEnabled && (
            <Field label="SSO PROVIDER" value={form.ssoProvider} onChange={v => set('ssoProvider', v)} placeholder="Okta, Azure AD, Ping..." />
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: '#f59e0b', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {mutation.isPending ? 'SAVING...' : 'SAVE SETTINGS'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Member Row Actions ────────────────────────────────────────────────────────
function MemberActions({ member, orgType, onRevoke, onSuspend, onDelete }: {
  member: Member;
  orgType: OrgType;
  onRevoke: () => void;
  onSuspend: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding: '4px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
        <MoreHorizontal size={13} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 28, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, zIndex: 100, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          {member.status !== 'revoked' && (
            <MenuBtn icon={<PauseCircle size={12} />} label={member.status === 'suspended' ? 'Reinstate' : 'Suspend'} color="#f97316"
              onClick={() => { setOpen(false); onSuspend(); }} />
          )}
          {member.status !== 'revoked' && (
            <MenuBtn icon={<XCircle size={12} />} label="Revoke Licence" color="#ef4444"
              onClick={() => { setOpen(false); onRevoke(); }} />
          )}
          <MenuBtn icon={<Trash2 size={12} />} label="Delete" color="#ef4444"
            onClick={() => { setOpen(false); onDelete(); }} />
        </div>
      )}
    </div>
  );
}

function MenuBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 14px', background: 'transparent', border: 'none', color: color || 'var(--text-muted)', cursor: 'pointer', fontSize: 11, textAlign: 'left' }}>
      {icon} {label}
    </button>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function PartnerPortal() {
  const qc = useQueryClient();

  // UI state
  const [tab, setTab] = useState<'roster' | 'audit'>('roster');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Queries
  const orgQuery = useQuery({
    queryKey: ['partnerOrg'],
    queryFn: () => partnerPortalApi.getOrg().then(r => r.data.data as { org: OrgData; licensePools: Record<string, LicensePool>; totalMembers: number }),
  });

  const membersQuery = useQuery({
    queryKey: ['partnerMembers', search, filterStatus, filterProduct, filterDept],
    queryFn: () => partnerPortalApi.getMembers({
      search: search || undefined,
      status: filterStatus || undefined,
      product: filterProduct || undefined,
      department: filterDept || undefined,
    }).then(r => r.data.data as { members: Member[]; total: number; departments: string[] }),
  });

  const auditQuery = useQuery({
    queryKey: ['partnerAudit'],
    queryFn: () => partnerPortalApi.getAuditLog(50).then(r => r.data.data as { entries: AuditEntry[]; total: number }),
    enabled: tab === 'audit',
  });

  // Mutations
  const addMember = useMutation({
    mutationFn: (data: Record<string, unknown>) => partnerPortalApi.addMember(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partnerMembers'] });
      qc.invalidateQueries({ queryKey: ['partnerOrg'] });
      setShowAddModal(false);
    },
  });

  const revokeMember = useMutation({
    mutationFn: (id: string) => partnerPortalApi.revokeMember(id, 'Revoked by admin'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partnerMembers'] }),
  });

  const suspendMember = useMutation({
    mutationFn: (id: string) => partnerPortalApi.suspendToggle(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['partnerMembers'] }),
  });

  const deleteMember = useMutation({
    mutationFn: (id: string) => partnerPortalApi.deleteMember(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['partnerMembers'] });
      qc.invalidateQueries({ queryKey: ['partnerOrg'] });
    },
  });

  const org = orgQuery.data?.org;
  const pools = orgQuery.data?.licensePools || {};
  const members = membersQuery.data?.members || [];
  const departments = membersQuery.data?.departments || [];
  const products = Object.keys(pools);
  const isFederal = org?.orgType === 'federal';

  const totalSeats = Object.values(pools).reduce((s, p) => s + p.total, 0);
  const usedSeats  = Object.values(pools).reduce((s, p) => s + p.used, 0);
  const activeCount = members.filter(m => m.status === 'active').length;

  if (orgQuery.isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 10, color: 'var(--text-muted)' }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Loading portal...
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1200, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: isFederal ? 'linear-gradient(135deg, #7c3aed, #0891b2)' : 'linear-gradient(135deg, #0891b2, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isFederal ? <Shield size={16} color="#fff" /> : <Building2 size={16} color="#fff" />}
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Partner Portal</h1>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: isFederal ? 'rgba(124,58,237,0.1)' : 'rgba(8,145,178,0.1)', color: isFederal ? '#7c3aed' : '#0891b2', fontWeight: 600 }}>
              {isFederal ? 'FEDERAL' : 'COMMERCIAL'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            {org?.orgName || 'Your Organisation'} · {org?.domain}
            {isFederal && org?.contractNumber && (
              <span style={{ marginLeft: 10, color: '#7c3aed' }}>· Contract {org.contractNumber}</span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSettings(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 11 }}>
            <Settings2 size={13} /> Settings
          </button>
          <button onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: 'var(--amber)', border: 'none', borderRadius: 6, color: '#000', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>
            <Plus size={13} /> ASSIGN LICENCE
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="TOTAL SEATS" value={totalSeats} sub={`${usedSeats} allocated`} accent="#f59e0b" />
        <StatCard label="AVAILABLE" value={totalSeats - usedSeats} sub="seats remaining" accent="#22c55e" />
        <StatCard label="ACTIVE MEMBERS" value={activeCount} sub={`${members.filter(m => m.status === 'pending').length} pending`} accent="#0891b2" />
        <StatCard label="UTILISATION" value={totalSeats > 0 ? `${Math.round((usedSeats / totalSeats) * 100)}%` : '—'} sub="of pool used" accent={usedSeats / totalSeats >= 0.9 ? '#ef4444' : '#7c3aed'} />
      </div>

      {/* Licence pools */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 14 }}>LICENCE POOLS</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, products.length)}, 1fr)`, gap: 24 }}>
          {products.map(p => <PoolBar key={p} product={p} pool={pools[p]} />)}
          {products.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No licence pools configured.</div>}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([['roster', 'MEMBER ROSTER', Users], ['audit', 'AUDIT LOG', FileText]] as [string, string, React.ElementType][]).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id as 'roster' | 'audit')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: tab === id ? '2px solid #f59e0b' : '2px solid transparent', color: tab === id ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, letterSpacing: '1px', fontWeight: tab === id ? 700 : 400 }}>
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {/* ── ROSTER TAB ── */}
      {tab === 'roster' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, padding: '7px 12px' }}>
              <Search size={13} color="var(--text-muted)" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, department..."
                style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, flex: 1 }} />
            </div>
            <FilterSelect value={filterStatus} onChange={setFilterStatus} options={[['','All Status'],['active','Active'],['pending','Pending'],['suspended','Suspended'],['revoked','Revoked']]} />
            {products.length > 1 && (
              <FilterSelect value={filterProduct} onChange={setFilterProduct} options={[['','All Products'], ...products.map(p => [p, PRODUCT_LABELS[p] || p] as [string, string])]} />
            )}
            {departments.length > 0 && (
              <FilterSelect value={filterDept} onChange={setFilterDept} options={[['','All Departments'], ...departments.map(d => [d, d] as [string, string])]} />
            )}
            {(search || filterStatus || filterProduct || filterDept) && (
              <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterProduct(''); setFilterDept(''); }}
                style={{ padding: '7px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                <X size={11} /> Clear
              </button>
            )}
          </div>

          {/* Table */}
          {membersQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
            </div>
          ) : members.length === 0 ? (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '48px 24px', textAlign: 'center' }}>
              <Users size={32} color="var(--text-muted)" style={{ display: 'block', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>No members found</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Assign your first licence to get started.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px', gap: 0, padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                {['MEMBER', 'DEPARTMENT', 'PRODUCTS', 'ROLE', 'STATUS', ''].map((h, i) => (
                  <div key={i} style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', fontWeight: 700 }}>{h}</div>
                ))}
              </div>

              {/* Rows */}
              {members.map(member => (
                <div key={member.id}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr 80px', gap: 0, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', alignItems: 'center', cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === member.id ? null : member.id)}>
                    {/* Member */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#f59e0b', flexShrink: 0 }}>
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{member.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{member.email}</div>
                        </div>
                        {isFederal && member.cacEnabled && (
                          <span title="CAC/PIV Enabled" style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(124,58,237,0.1)', color: '#7c3aed', borderRadius: 3 }}>CAC</span>
                        )}
                        {isFederal && member.clearanceLevel && member.clearanceLevel !== 'None' && (
                          <span style={{ fontSize: 9, padding: '1px 6px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', borderRadius: 3 }}>{member.clearanceLevel}</span>
                        )}
                      </div>
                    </div>
                    {/* Department */}
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{member.department}</div>
                      {member.jobTitle && <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{member.jobTitle}</div>}
                    </div>
                    {/* Products */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {member.productKeys.map(p => (
                        <span key={p} style={{ fontSize: 9, padding: '2px 6px', background: 'rgba(245,158,11,0.08)', color: '#f59e0b', borderRadius: 3 }}>{PRODUCT_LABELS[p] || p}</span>
                      ))}
                    </div>
                    {/* Role */}
                    <RoleBadge role={member.role} />
                    {/* Status */}
                    <StatusBadge status={member.status} />
                    {/* Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={e => e.stopPropagation()}>
                      <MemberActions
                        member={member}
                        orgType={org?.orgType || 'commercial'}
                        onRevoke={() => revokeMember.mutate(member.id)}
                        onSuspend={() => suspendMember.mutate(member.id)}
                        onDelete={() => { if (confirm(`Remove ${member.name}?`)) deleteMember.mutate(member.id); }}
                      />
                      {expandedId === member.id ? <ChevronUp size={12} color="var(--text-muted)" /> : <ChevronDown size={12} color="var(--text-muted)" />}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {expandedId === member.id && (
                    <div style={{ padding: '12px 16px 16px 56px', background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        <DetailCell label="Assigned" value={new Date(member.assignedAt).toLocaleDateString()} />
                        {isFederal && <DetailCell label="Agency Code" value={member.agencyCode || '—'} />}
                        {isFederal && <DetailCell label="Clearance" value={member.clearanceLevel || '—'} />}
                        {!isFederal && <DetailCell label="Cost Center" value={member.costCenter || '—'} />}
                        <DetailCell label="Access Level" value={member.accessLevel} />
                        {member.notes && <DetailCell label="Notes" value={member.notes} />}
                        {member.lastActiveAt && <DetailCell label="Last Active" value={new Date(member.lastActiveAt).toLocaleDateString()} />}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── AUDIT TAB ── */}
      {tab === 'audit' && (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {auditQuery.isLoading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} />
            </div>
          ) : !auditQuery.data?.entries.length ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No audit entries yet.</div>
          ) : (
            auditQuery.data.entries.map(entry => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <AuditIcon action={entry.action} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{entry.detail}</div>
                  {entry.targetEmail && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{entry.targetName} · {entry.targetEmail}</div>}
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>by {entry.actorEmail} · {new Date(entry.timestamp).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {showAddModal && org && (
        <AddMemberModal
          orgType={org.orgType}
          products={products}
          onClose={() => setShowAddModal(false)}
          onSave={data => addMember.mutate(data)}
        />
      )}
      {showSettings && org && (
        <OrgSettingsPanel org={{ ...org, licensePools: pools, totalMembers: orgQuery.data?.totalMembers || 0 }} onClose={() => setShowSettings(false)} />
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function DetailCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 3 }}>{label.toUpperCase()}</div>
      <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ padding: '7px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function AuditIcon({ action }: { action: string }) {
  const map: Record<string, { icon: React.ReactNode; color: string }> = {
    assign:         { icon: <CheckCircle2 size={14} />, color: '#22c55e' },
    revoke:         { icon: <XCircle size={14} />,      color: '#ef4444' },
    suspend:        { icon: <PauseCircle size={14} />,  color: '#f97316' },
    reinstate:      { icon: <Activity size={14} />,     color: '#22c55e' },
    modify:         { icon: <Edit3 size={14} />,        color: '#0891b2' },
    bulk_import:    { icon: <Upload size={14} />,       color: '#7c3aed' },
    settings_change:{ icon: <Settings2 size={14} />,   color: '#f59e0b' },
  };
  const cfg = map[action] || { icon: <AlertTriangle size={14} />, color: 'var(--text-muted)' };
  return <div style={{ color: cfg.color, marginTop: 1, flexShrink: 0 }}>{cfg.icon}</div>;
}
