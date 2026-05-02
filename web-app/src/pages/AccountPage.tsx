import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { profileApi, entitlementApi, plaidApi } from '../services/api';
import {
  UserCircle, Bell, Link2, Mail, CreditCard, Check, ChevronDown, ChevronUp, Lock,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface Profile { userId: string; firstName: string; lastName: string; email: string; }
interface PlaidStatus { connected: boolean; itemId?: string; }

const NOTIFICATION_LABELS: Record<string, string> = {
  renewals:              'Renewals',
  risk_queue:            'Risk Queue',
  case_feed:             'Case Feed',
  watchlist:             'Watchlist',
  event_normalization:   'Event Normalization',
  eligibility_review:    'Eligibility Review',
  probability_workbench: 'Probability Workbench',
  strategy_selector:     'Strategy Selector',
  subscriptions:         'Subscriptions',
  smart_reminder:        'Smart Reminder',
  auto_draft:            'Auto Draft',
  spend_analyzer:        'Spend Analyzer',
  contract_watch:        'Contract Watch',
  currency_guard:        'Currency Guard',
  tax_normalizer:        'Tax Normalizer',
  escalate_ai:           'Escalate AI',
  email_intel:           'Email Intelligence',
  plaid:                 'Plaid Banking',
  ai_intelligence:       'AI Intelligence',
};

// ── Sub-components ─────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ComponentType<any>; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon size={14} color="var(--blue)" />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{title}</span>
        </div>
        {open ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
      </button>
      {open && <div style={{ padding: '4px 18px 18px', borderTop: '1px solid var(--border)' }}>{children}</div>}
    </div>
  );
}

function SaveButton({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: saving || saved ? 'var(--bg-elevated)' : 'var(--blue)', color: saving || saved ? 'var(--text-muted)' : '#fff', fontSize: 12, fontWeight: 700, padding: '8px 18px', borderRadius: 'var(--radius)', border: 'none', cursor: saving ? 'wait' : 'pointer', letterSpacing: '0.3px' }}>
      {saved ? <><Check size={12} /> Saved</> : saving ? 'Saving…' : 'Save Changes'}
    </button>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: checked ? 'var(--blue)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: checked ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </button>
  );
}

function ConnectorRow({ label, icon: Icon, userId, locked, lockedMsg }: {
  label: string; icon: React.ComponentType<any>; userId?: string; locked?: boolean; lockedMsg?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: locked ? 'var(--bg-elevated)' : 'var(--blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {locked ? <Lock size={13} color="var(--text-muted)" /> : <Icon size={13} color="var(--blue)" />}
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: locked ? 'var(--text-muted)' : 'var(--text-primary)' }}>{label}</div>
          {locked
            ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{lockedMsg}</div>
            : userId
              ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>{userId}</div>
              : <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 2 }}>Not connected</div>}
        </div>
      </div>
      {!locked && (
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: userId ? 'var(--green)' : 'var(--text-muted)', background: userId ? 'var(--green-dim)' : 'var(--bg-elevated)', padding: '3px 8px', borderRadius: 4 }}>
          {userId ? 'CONNECTED' : 'NOT SET'}
        </span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AccountPage() {
  const { user: authUser } = useAuthStore();

  const [profile, setProfile]             = useState<Profile | null>(null);
  const [firstName, setFirstName]         = useState('');
  const [lastName, setLastName]           = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved]   = useState(false);

  const [notifPrefs, setNotifPrefs]       = useState<Record<string, boolean>>({});
  const [notifSaving, setNotifSaving]     = useState(false);
  const [notifSaved, setNotifSaved]       = useState(false);

  const [emailEntitled, setEmailEntitled] = useState(false);
  const [plaidEntitled, setPlaidEntitled] = useState(false);
  const [plaidStatus, setPlaidStatus]     = useState<PlaidStatus>({ connected: false });
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, notifRes, emailEntRes, plaidEntRes] = await Promise.allSettled([
        profileApi.get(),
        profileApi.getNotifications(),
        entitlementApi.check('email_intel'),
        entitlementApi.check('plaid_basic'),
      ]);
      if (profileRes.status === 'fulfilled') {
        const p = profileRes.value.data.data;
        setProfile(p);
        setFirstName(p.firstName || '');
        setLastName(p.lastName || '');
      }
      if (notifRes.status === 'fulfilled') setNotifPrefs(notifRes.value.data.data || {});
      if (emailEntRes.status === 'fulfilled') setEmailEntitled(emailEntRes.value.data.data?.active === true);
      if (plaidEntRes.status === 'fulfilled') setPlaidEntitled(plaidEntRes.value.data.data?.active === true);
      try {
        const plaidRes = await plaidApi.status();
        setPlaidStatus({ connected: plaidRes.data.data?.connected === true, itemId: plaidRes.data.data?.item_id });
      } catch { /* not connected */ }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      await profileApi.save({ firstName: firstName.trim(), lastName: lastName.trim() });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } finally { setProfileSaving(false); }
  };

  const saveNotifications = async () => {
    setNotifSaving(true);
    try {
      await profileApi.saveNotifications(notifPrefs);
      setNotifSaved(true);
      setTimeout(() => setNotifSaved(false), 2500);
    } finally { setNotifSaving(false); }
  };

  const toggleAll = (val: boolean) =>
    setNotifPrefs(prev => Object.fromEntries(Object.keys(prev).map(k => [k, val])));

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTop: `3px solid var(--blue)`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  const email = profile?.email || authUser?.email || '';

  return (
    <div style={{ padding: 24, maxWidth: 760, margin: '0 auto' }}>

      {/* Header — matches AI Intel style */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserCircle size={16} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Account</h1>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 600 }}>Profile &amp; Settings</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Profile, notification preferences, and data connectors.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Account Info */}
        <Section title="Account Info" icon={UserCircle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 5, textTransform: 'uppercase' }}>First Name</div>
              <input style={inp} value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 5, textTransform: 'uppercase' }}>Last Name</div>
              <input style={inp} value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 5, textTransform: 'uppercase' }}>Login ID</div>
              <div style={readOnly}>{email}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.05em', marginBottom: 5, textTransform: 'uppercase' }}>Role</div>
              <div style={readOnly}>{authUser?.role?.toUpperCase() || 'ADMIN'}</div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <SaveButton saving={profileSaving} saved={profileSaved} onClick={saveProfile} />
          </div>
        </Section>

        {/* Notifications */}
        <Section title="Notifications" icon={Bell}>
          <div style={{ display: 'flex', gap: 8, margin: '12px 0 4px' }}>
            <button style={smallBtn} onClick={() => toggleAll(true)}>Enable All</button>
            <button style={smallBtn} onClick={() => toggleAll(false)}>Disable All</button>
          </div>
          <div>
            {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
                <Toggle checked={notifPrefs[key] !== false} onChange={v => setNotifPrefs(prev => ({ ...prev, [key]: v }))} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <SaveButton saving={notifSaving} saved={notifSaved} onClick={saveNotifications} />
          </div>
        </Section>

        {/* Connectors */}
        <Section title="Connectors" icon={Link2}>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '12px 0', lineHeight: 1.6 }}>
            Connectors supply data signals for AI inference. Requires the matching add-on entitlement.
          </p>
          <ConnectorRow
            label="Email Intelligence"
            icon={Mail}
            userId={emailEntitled ? email : undefined}
            locked={!emailEntitled}
            lockedMsg="Requires Email Intelligence add-on"
          />
          <ConnectorRow
            label="Plaid Banking"
            icon={CreditCard}
            userId={plaidEntitled && plaidStatus.connected ? plaidStatus.itemId : undefined}
            locked={!plaidEntitled}
            lockedMsg="Requires Plaid Basic or Plaid Full add-on"
          />
        </Section>

      </div>
    </div>
  );
}

// ── Shared inline style constants ──────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  background: 'var(--bg-base)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text-primary)',
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
};

const readOnly: React.CSSProperties = {
  padding: '8px 10px',
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text-muted)',
  fontSize: 13, fontFamily: 'var(--font-mono)',
};

const smallBtn: React.CSSProperties = {
  fontSize: 11, color: 'var(--text-muted)',
  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', padding: '4px 12px', cursor: 'pointer',
};
