import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Mail, Wifi, WifiOff, RefreshCw, X, Plus, Check,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Eye,
  CheckCircle2, Archive, Zap, BarChart3,
} from 'lucide-react';
import { emailIntelApi } from '../services/emailIntelApi';

// ── Types ─────────────────────────────────────────────────────────────────────
type Provider = 'gmail' | 'outlook' | 'imap';
type SignalStatus = 'new' | 'reviewed' | 'actioned' | 'dismissed';

interface Connection {
  id: string; provider: Provider; email: string;
  status: 'connected' | 'error' | 'disconnected';
  errorMessage?: string; lastScanAt?: string;
}

interface DetectedSignal {
  productKey: string; productName: string; signalType: string;
  confidence: number; matchedOn: string[]; snippet: string;
  extracted: Record<string, string | number | undefined>;
}

interface EmailSignal {
  id: string; connectionId: string; subject: string; from: string;
  date: string; status: SignalStatus; signals: DetectedSignal[];
}

interface ProductMeta { key: string; name: string; accent: string }
interface MatrixRow {
  count: number; avgConfidence: number;
  signalTypes: Record<string, number>;
  topSenders: Record<string, number>;
}

interface Correlation {
  matrix: Record<string, MatrixRow>;
  crossProduct: { products: string[]; count: number }[];
  totalSignals: number; totalEmailsScanned: number; newCount: number;
  products: ProductMeta[];
}

// ── Provider metadata ─────────────────────────────────────────────────────────
const PROVIDER_CFG: Record<Provider, { label: string; icon: string; color: string; bg: string }> = {
  gmail:   { label: 'Gmail',           icon: 'G', color: '#ea4335', bg: 'rgba(234,67,53,0.1)' },
  outlook: { label: 'Microsoft/Outlook', icon: 'O', color: '#0078d4', bg: 'rgba(0,120,212,0.1)' },
  imap:    { label: 'IMAP (Any Provider)', icon: 'M', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
};

const STATUS_ACTION: Record<SignalStatus, { next: SignalStatus; label: string; color: string }> = {
  new:      { next: 'reviewed', label: 'Mark Reviewed', color: '#0891b2' },
  reviewed: { next: 'actioned', label: 'Mark Actioned', color: '#22c55e' },
  actioned: { next: 'dismissed', label: 'Dismiss',       color: '#94a3b8' },
  dismissed:{ next: 'new',      label: 'Reopen',         color: '#f59e0b' },
};

const STATUS_COLORS: Record<SignalStatus, string> = {
  new:       '#f59e0b',
  reviewed:  '#0891b2',
  actioned:  '#22c55e',
  dismissed: '#374151',
};

// ── IMAP Connect Modal ────────────────────────────────────────────────────────
function ImapModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ host: '', port: 993, secure: true, user: '', password: '' });
  const [preset, setPreset] = useState('');

  const PRESETS = [
    { label: 'Gmail (App Password)', host: 'imap.gmail.com', port: 993, secure: true },
    { label: 'Outlook / Microsoft 365', host: 'outlook.office365.com', port: 993, secure: true },
    { label: 'Yahoo Mail', host: 'imap.mail.yahoo.com', port: 993, secure: true },
    { label: 'Custom / Corporate', host: '', port: 993, secure: true },
  ];

  const applyPreset = (p: typeof PRESETS[0]) => {
    setForm(f => ({ ...f, host: p.host, port: p.port, secure: p.secure }));
    setPreset(p.label);
  };

  const mutation = useMutation({
    mutationFn: () => emailIntelApi.connectImap(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emailConnections'] }); onClose(); },
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 500 }}>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 28, width: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)', margin: 0 }}>CONNECT VIA IMAP</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={15} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8 }}>QUICK PRESET</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => applyPreset(p)}
                style={{ padding: '5px 10px', borderRadius: 4, border: `1px solid ${preset === p.label ? '#f59e0b' : 'var(--border)'}`, background: preset === p.label ? 'rgba(245,158,11,0.08)' : 'transparent', color: preset === p.label ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {['host','user','password'].map(k => (
          <div key={k} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 5 }}>{k.toUpperCase()}</div>
            <input type={k === 'password' ? 'password' : 'text'} value={(form as any)[k]}
              onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              placeholder={k === 'host' ? 'imap.gmail.com' : k === 'user' ? 'you@gmail.com' : 'App password'}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
        ))}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 5 }}>PORT</div>
            <input type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: parseInt(e.target.value) }))}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box' }} />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.secure} onChange={e => setForm(f => ({ ...f, secure: e.target.checked }))} />
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>TLS/SSL</span>
          </label>
        </div>

        <div style={{ padding: '8px 12px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 4, marginBottom: 16, fontSize: 11, color: '#94a3b8', lineHeight: 1.5 }}>
          For Gmail/Outlook, generate an <strong style={{ color: '#f59e0b' }}>app password</strong> (not your account password):<br/>
          Gmail → Google Account → Security → App passwords<br/>
          Outlook → Account → Security → Advanced → App passwords
        </div>

        {mutation.isError && (
          <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, marginBottom: 12, fontSize: 11, color: '#ef4444' }}>
            {(mutation.error as any)?.response?.data?.error || 'Connection failed'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={!form.host || !form.user || !form.password || mutation.isPending}
            style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: '#22c55e', color: '#000', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
            {mutation.isPending ? 'CONNECTING...' : 'CONNECT'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Signal Card ───────────────────────────────────────────────────────────────
function SignalCard({ email, products, onStatusChange }: {
  email: EmailSignal;
  products: ProductMeta[];
  onStatusChange: (id: string, s: SignalStatus) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const topSignals = email.signals.slice(0, expanded ? undefined : 3);
  const isNew = email.status === 'new';
  const action = STATUS_ACTION[email.status];

  const productMap = Object.fromEntries(products.map(p => [p.key, p]));

  return (
    <div style={{ background: 'var(--bg-surface)', border: `1px solid ${isNew ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, borderRadius: 6, marginBottom: 8, overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[email.status], flexShrink: 0, marginTop: 5 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email.subject}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{email.from} · {new Date(email.date).toLocaleDateString()}</div>
          {/* Product tags */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
            {[...new Set(email.signals.map(s => s.productKey))].map(pk => {
              const p = productMap[pk];
              if (!p) return null;
              const count = email.signals.filter(s => s.productKey === pk).length;
              return (
                <span key={pk} style={{ fontSize: 9, padding: '2px 8px', borderRadius: 12, background: `${p.accent}18`, color: p.accent, fontWeight: 700, letterSpacing: '0.5px' }}>
                  {p.name} {count > 1 ? `×${count}` : ''}
                </span>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={() => onStatusChange(email.id, action.next)}
            style={{ padding: '4px 10px', borderRadius: 4, border: `1px solid ${action.color}30`, background: `${action.color}10`, color: action.color, cursor: 'pointer', fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap' }}>
            {action.label}
          </button>
          <button onClick={() => setExpanded(e => !e)} style={{ padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Expanded signals */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px 14px 36px' }}>
          {topSignals.map((sig, i) => {
            const p = productMap[sig.productKey];
            return (
              <div key={i} style={{ marginBottom: 10, padding: '8px 12px', background: 'var(--bg-base)', borderRadius: 4, borderLeft: `2px solid ${p?.accent || 'var(--border-bright)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: p?.accent || 'var(--text-secondary)', letterSpacing: '0.5px' }}>{sig.signalType.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 10, color: sig.confidence >= 0.9 ? '#22c55e' : sig.confidence >= 0.75 ? '#f59e0b' : '#94a3b8' }}>
                    {Math.round(sig.confidence * 100)}% confidence
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontStyle: 'italic', lineHeight: 1.4 }}>"{sig.snippet}"</div>
                {Object.entries(sig.extracted).filter(([, v]) => v !== undefined).map(([k, v]) => (
                  <span key={k} style={{ fontSize: 10, marginRight: 10, color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{k}:</span> {v}
                  </span>
                ))}
              </div>
            );
          })}
          {email.signals.length > 3 && !expanded && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>+{email.signals.length - 3} more signals</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Correlation Matrix ────────────────────────────────────────────────────────
function CorrelationMatrix({ data }: { data: Correlation }) {
  const maxCount = Math.max(...data.products.map(p => data.matrix[p.key]?.count || 0), 1);

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 16 }}>
        {data.products.map(product => {
          const row    = data.matrix[product.key] || { count: 0, avgConfidence: 0, signalTypes: {}, topSenders: {} };
          const pct    = row.count / maxCount;
          const topType = Object.entries(row.signalTypes).sort((a, b) => b[1] - a[1])[0];

          return (
            <div key={product.key} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', borderLeft: `3px solid ${product.accent}`, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: product.accent, marginBottom: 8 }}>{product.name}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{row.count}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>signals detected</div>

              {/* Signal bar */}
              <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, margin: '10px 0 8px' }}>
                <div style={{ height: '100%', width: `${pct * 100}%`, background: product.accent, borderRadius: 2, transition: 'width 0.4s ease' }} />
              </div>

              {topType && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                  Top: <span style={{ color: '#fff' }}>{topType[0].replace(/_/g, ' ')}</span> ({topType[1]})
                </div>
              )}
              {row.avgConfidence > 0 && (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  Avg confidence: <span style={{ color: row.avgConfidence >= 0.85 ? '#22c55e' : '#f59e0b' }}>{Math.round(row.avgConfidence * 100)}%</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Cross-product overlaps */}
      {data.crossProduct.length > 0 && (
        <div>
          <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 10 }}>MULTI-PRODUCT SIGNAL OVERLAPS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {data.crossProduct.slice(0, 6).map((cp, i) => {
              const colors = cp.products.map(pk => data.products.find(p => p.key === pk)?.accent || '#666');
              return (
                <div key={i} style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {cp.products.map((pk, j) => (
                    <span key={pk} style={{ fontSize: 10, color: colors[j], fontWeight: 700 }}>
                      {data.products.find(p => p.key === pk)?.name?.split('™')[0]}
                    </span>
                  )).reduce((acc: React.ReactNode[], el, j) => j === 0 ? [el] : [...acc, <span key={`+${j}`} style={{ color: 'var(--text-muted)', fontSize: 10 }}>+</span>, el], [])}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>×{cp.count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmailIntelligence() {
  const qc = useQueryClient();
  const [tab, setTab]            = useState<'feed' | 'correlation'>('feed');
  const [showImapModal, setShowImapModal] = useState(false);
  const [filterProduct, setFilterProduct] = useState('');
  const [filterStatus, setFilterStatus]   = useState<SignalStatus | ''>('');

  // URL params (post OAuth redirect)
  const params        = new URLSearchParams(window.location.search);
  const connected     = params.get('connected');
  const connectError  = params.get('error');

  const connectionsQ = useQuery({
    queryKey: ['emailConnections'],
    queryFn: () => emailIntelApi.getConnections().then(r => r.data.data.connections as Connection[]),
  });

  const signalsQ = useQuery({
    queryKey: ['emailSignals', filterProduct, filterStatus],
    queryFn: () => emailIntelApi.getSignals({
      product: filterProduct || undefined,
      status:  filterStatus  || undefined,
      limit: 100,
    }).then(r => r.data.data as { signals: EmailSignal[]; total: number }),
  });

  const correlationQ = useQuery({
    queryKey: ['emailCorrelation'],
    queryFn: () => emailIntelApi.getCorrelation().then(r => r.data.data as Correlation),
    enabled: tab === 'correlation',
  });

  const scanMutation = useMutation({
    mutationFn: () => emailIntelApi.scan({ daysSince: 90 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['emailSignals'] }); qc.invalidateQueries({ queryKey: ['emailCorrelation'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => emailIntelApi.deleteConnection(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emailConnections'] }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SignalStatus }) => emailIntelApi.updateSignal(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['emailSignals'] }),
  });

  const gmailOAuth = useMutation({
    mutationFn: () => emailIntelApi.getGmailAuthUrl().then(r => r.data.data.url as string),
    onSuccess: (url) => window.location.href = url,
  });

  const outlookOAuth = useMutation({
    mutationFn: () => emailIntelApi.getOutlookAuthUrl().then(r => r.data.data.url as string),
    onSuccess: (url) => window.location.href = url,
  });

  const connections = connectionsQ.data || [];
  const signals     = signalsQ.data?.signals || [];
  const corr        = correlationQ.data;
  const newCount    = signals.filter(s => s.status === 'new').length;
  const products    = corr?.products || [];

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #0891b2, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Mail size={16} color="#fff" />
            </div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>Email Intelligence</h1>
            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(8,145,178,0.1)', color: '#0891b2', fontWeight: 600 }}>Signal Intelligence</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Scan subscriber email for signals across all 7 ValuePilot products</p>
        </div>
        <button onClick={() => scanMutation.mutate()} disabled={connections.length === 0 || scanMutation.isPending}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: connections.length === 0 ? 'var(--bg-elevated)' : '#0891b2', border: 'none', borderRadius: 6, color: connections.length === 0 ? 'var(--text-muted)' : '#fff', cursor: connections.length === 0 ? 'default' : 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px' }}>
          {scanMutation.isPending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
          {scanMutation.isPending ? 'SCANNING...' : 'SCAN NOW'}
        </button>
      </div>

      {/* Status banners */}
      {connected && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#22c55e' }}>
          <CheckCircle2 size={14} /> {connected.charAt(0).toUpperCase() + connected.slice(1)} account connected successfully
        </div>
      )}
      {connectError && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#ef4444' }}>
          <AlertCircle size={14} /> Connection error: {decodeURIComponent(connectError)}
        </div>
      )}
      {scanMutation.isSuccess && scanMutation.data && (
        <div style={{ padding: '10px 14px', background: 'rgba(8,145,178,0.08)', border: '1px solid rgba(8,145,178,0.2)', borderRadius: 6, marginBottom: 16, fontSize: 12, color: '#0891b2' }}>
          Scan complete — {scanMutation.data.data.data.totalNewSignals} new signals found across {scanMutation.data.data.data.scanResults.length} account{scanMutation.data.data.data.scanResults.length !== 1 ? 's' : ''}
        </div>
      )}

      {/* Connected accounts */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 20px', marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)' }}>CONNECTED ACCOUNTS</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <ProviderButton label="Gmail" color="#ea4335" onClick={() => gmailOAuth.mutate()} loading={gmailOAuth.isPending} />
            <ProviderButton label="Outlook" color="#0078d4" onClick={() => outlookOAuth.mutate()} loading={outlookOAuth.isPending} />
            <ProviderButton label="IMAP" color="#22c55e" onClick={() => setShowImapModal(true)} />
          </div>
        </div>

        {connections.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <Mail size={28} style={{ display: 'block', margin: '0 auto 10px', opacity: 0.3 }} />
            <div style={{ fontSize: 12, marginBottom: 4 }}>No email accounts connected</div>
            <div style={{ fontSize: 11 }}>Connect Gmail, Outlook, or any IMAP account to start scanning</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {connections.map(conn => {
              const cfg = PROVIDER_CFG[conn.provider];
              return (
                <div key={conn.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg-elevated)', border: `1px solid ${conn.status === 'connected' ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`, borderRadius: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: cfg.color }}>{cfg.icon}</div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>{conn.email}</div>
                    <div style={{ fontSize: 10, color: conn.status === 'connected' ? '#22c55e' : '#ef4444' }}>
                      {conn.status === 'connected' ? (conn.lastScanAt ? `Last scan ${new Date(conn.lastScanAt).toLocaleDateString()}` : 'Connected — not yet scanned') : conn.errorMessage || 'Error'}
                    </div>
                  </div>
                  <button onClick={() => deleteMutation.mutate(conn.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', marginLeft: 4 }}><X size={12} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {([['feed', 'SIGNAL FEED', Mail], ['correlation', 'PRODUCT CORRELATION', BarChart3]] as [string, string, React.ElementType][]).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id as any)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'transparent', border: 'none', borderBottom: tab === id ? '2px solid #f59e0b' : '2px solid transparent', color: tab === id ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 11, letterSpacing: '1px', fontWeight: tab === id ? 700 : 400 }}>
            <Icon size={12} /> {label}
            {id === 'feed' && newCount > 0 && <span style={{ fontSize: 9, padding: '1px 6px', background: '#f59e0b', borderRadius: 10, color: '#000', fontWeight: 700 }}>{newCount}</span>}
          </button>
        ))}
      </div>

      {/* ── SIGNAL FEED ── */}
      {tab === 'feed' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {([['', 'All Status'], ['new', 'New'], ['reviewed', 'Reviewed'], ['actioned', 'Actioned'], ['dismissed', 'Dismissed']] as [string, string][]).map(([v, l]) => (
              <button key={v} onClick={() => setFilterStatus(v as any)}
                style={{ padding: '5px 12px', borderRadius: 4, border: `1px solid ${filterStatus === v ? '#f59e0b' : 'var(--border)'}`, background: filterStatus === v ? 'rgba(245,158,11,0.08)' : 'transparent', color: filterStatus === v ? '#f59e0b' : 'var(--text-muted)', cursor: 'pointer', fontSize: 10, fontWeight: filterStatus === v ? 700 : 400 }}>
                {l}
              </button>
            ))}
            {products.length > 0 && (
              <select value={filterProduct} onChange={e => setFilterProduct(e.target.value)}
                style={{ padding: '5px 10px', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 4, color: filterProduct ? '#fff' : 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}>
                <option value="">All Products</option>
                {products.map(p => <option key={p.key} value={p.key}>{p.name}</option>)}
              </select>
            )}
          </div>

          {signalsQ.isLoading ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /></div>
          ) : signals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-muted)' }}>
              <Mail size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.2 }} />
              <div style={{ fontSize: 13, marginBottom: 4 }}>{connections.length === 0 ? 'Connect an email account to get started' : 'No signals detected yet'}</div>
              <div style={{ fontSize: 11 }}>{connections.length > 0 ? 'Run a scan to analyse your emails' : ''}</div>
            </div>
          ) : (
            signals.map(email => (
              <SignalCard
                key={email.id}
                email={email}
                products={products}
                onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              />
            ))
          )}
        </>
      )}

      {/* ── CORRELATION ── */}
      {tab === 'correlation' && (
        correlationQ.isLoading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}><Loader2 size={20} style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }} /></div>
        ) : !corr || corr.totalSignals === 0 ? (
          <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-muted)' }}>
            <BarChart3 size={32} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.2 }} />
            <div style={{ fontSize: 13 }}>Scan emails to generate product correlation data</div>
          </div>
        ) : (
          <>
            {/* Summary bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'TOTAL SIGNALS',   value: corr.totalSignals,       color: '#f59e0b' },
                { label: 'EMAILS SCANNED',  value: corr.totalEmailsScanned, color: '#0891b2' },
                { label: 'NEW / UNREVIEWED', value: corr.newCount,          color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', borderLeft: `3px solid ${s.color}`, boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: 9, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6 }}>{s.label}</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)' }}>{s.value}</div>
                </div>
              ))}
            </div>
            <CorrelationMatrix data={corr} />
          </>
        )
      )}

      {showImapModal && <ImapModal onClose={() => setShowImapModal(false)} />}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ProviderButton({ label, color, onClick, loading }: { label: string; color: string; onClick: () => void; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={loading}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: 'transparent', border: `1px solid ${color}40`, borderRadius: 4, color, cursor: loading ? 'default' : 'pointer', fontSize: 10, fontWeight: 700 }}>
      {loading ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Plus size={11} />}
      {label}
    </button>
  );
}
