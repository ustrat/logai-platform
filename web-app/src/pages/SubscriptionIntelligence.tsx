import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';

interface Subscription {
  id: string;
  merchant: string;
  category: string;
  frequency: 'monthly' | 'quarterly' | 'annual' | 'weekly' | 'irregular';
  frequencyLabel: string;
  amountPerOccurrence: number;
  annualCost: number;
  confidence: number;
  occurrences: number;
  lastCharged: string;
  nextExpected: string;
  status: 'active' | 'cancelled' | 'at_risk';
  amountVariance: number;
  dayVariance: number;
}

interface Summary {
  totalMonthlyEstimate: number;
  totalAnnualEstimate: number;
  subscriptionCount: number;
  byFrequency: Record<string, number>;
  byCategory: Record<string, number>;
  atRiskCount: number;
  highConfidenceCount: number;
}

const FREQ_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  Monthly:   { bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
  Quarterly: { bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  Annual:    { bg: '#fef9c3', color: '#a16207', border: '#fde047' },
  Weekly:    { bg: '#f3e8ff', color: '#7c3aed', border: '#c4b5fd' },
  Irregular: { bg: '#f3f4f6', color: '#4b5563', border: '#d1d5db' },
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active:    { bg: '#dcfce7', color: '#15803d' },
  cancelled: { bg: '#fee2e2', color: '#b91c1c' },
  at_risk:   { bg: '#fef9c3', color: '#a16207' },
};

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 0.8 ? '#16a34a' : value >= 0.6 ? '#f59e0b' : '#dc2626';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, color, fontWeight: 700, width: 32 }}>{Math.round(value * 100)}%</span>
    </div>
  );
}

export default function SubscriptionIntelligence() {
  const [filterFreq, setFilterFreq] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortBy, setSortBy] = useState<'annualCost' | 'confidence' | 'nextExpected'>('annualCost');
  const [search, setSearch] = useState('');

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await api.get('/subscriptions?days=365&min_confidence=0.4');
      return res.data.data as { subscriptions: Subscription[]; summary: Summary; metadata: any };
    },
    retry: false,
  });

  const subs = data?.subscriptions || [];
  const summary = data?.summary;

  const filtered = subs
    .filter(s => !filterFreq || s.frequencyLabel === filterFreq)
    .filter(s => !filterStatus || s.status === filterStatus)
    .filter(s => !search || s.merchant.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'annualCost') return b.annualCost - a.annualCost;
      if (sortBy === 'confidence') return b.confidence - a.confidence;
      return new Date(a.nextExpected).getTime() - new Date(b.nextExpected).getTime();
    });

  const freqOptions = [...new Set(subs.map(s => s.frequencyLabel))];

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <p style={S.headerLabel}>ML SUBSCRIPTION DETECTION</p>
          <h1 style={S.title}>Subscription Intelligence</h1>
          <p style={S.subtitle}>AI-detected recurring charges from Plaid transaction history</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{ ...S.refreshBtn, opacity: isFetching ? 0.6 : 1, cursor: isFetching ? 'wait' : 'pointer' }}
        >
          {isFetching ? '⟳ Analyzing...' : '↺ Re-analyze'}
        </button>
      </div>

      {isError && (
        <div style={S.errorBox}>
          ⚠ No Plaid connection or subscription data unavailable. —{' '}
          <a href="/plaid" style={{ color: '#1d4ed8' }}>Connect Plaid</a>
        </div>
      )}

      {isLoading && (
        <div style={S.loadingBox}>
          <div style={S.spinner} />
          <span>Running subscription detection algorithm...</span>
        </div>
      )}

      {summary && (
        <>
          {/* KPI Cards */}
          <div style={S.kpiGrid}>
            <KPICard label="Est. Monthly Spend" value={`$${summary.totalMonthlyEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="across all active subs" color="#1d4ed8" />
            <KPICard label="Est. Annual Spend" value={`$${summary.totalAnnualEstimate.toLocaleString()}`} sub="projected yearly cost" color="#7c3aed" />
            <KPICard label="Detected Subscriptions" value={String(summary.subscriptionCount)} sub={`${summary.highConfidenceCount} high confidence`} color="#15803d" />
            <KPICard label="At Risk" value={String(summary.atRiskCount)} sub="may have cancelled" color={summary.atRiskCount > 0 ? '#dc2626' : '#15803d'} highlight={summary.atRiskCount > 0} />
          </div>

          {/* Frequency & Category breakdown */}
          <div style={S.breakdownGrid}>
            <div style={S.breakdownCard}>
              <p style={S.breakdownTitle}>BY FREQUENCY</p>
              {Object.entries(summary.byFrequency).map(([freq, count]) => {
                const style = FREQ_COLORS[freq] || FREQ_COLORS.Irregular;
                return (
                  <div key={freq} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ ...S.freqBadge, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>{freq}</span>
                    <div style={{ flex: 1, height: 8, background: '#f3f4f6', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${(count / summary.subscriptionCount) * 100}%`, height: '100%', background: style.color, borderRadius: 4 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', width: 20 }}>{count}</span>
                  </div>
                );
              })}
            </div>
            <div style={S.breakdownCard}>
              <p style={S.breakdownTitle}>TOP CATEGORIES</p>
              {Object.entries(summary.byCategory).slice(0, 6).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#374151' }}>{cat.replace(/_/g, ' ')}</span>
                  <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{count}</span>
                </div>
              ))}
            </div>
            <div style={S.breakdownCard}>
              <p style={S.breakdownTitle}>DETECTION METADATA</p>
              {data?.metadata && (
                <>
                  <MetaRow label="Days Analyzed" value={String(data.metadata.days_analyzed)} />
                  <MetaRow label="Transactions Scanned" value={String(data.metadata.transactions_scanned)} />
                  <MetaRow label="Min Confidence" value={`${data.metadata.min_confidence_filter * 100}%`} />
                  <MetaRow label="Generated" value={new Date(data.metadata.generated_at).toLocaleTimeString()} />
                </>
              )}
            </div>
          </div>

          {/* Filters */}
          <div style={S.filterBar}>
            <input
              placeholder="Search merchant..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={S.searchInput}
            />
            <select value={filterFreq} onChange={e => setFilterFreq(e.target.value)} style={S.select}>
              <option value="">All Frequencies</option>
              {freqOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={S.select}>
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="at_risk">At Risk</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={S.select}>
              <option value="annualCost">Sort: Annual Cost</option>
              <option value="confidence">Sort: Confidence</option>
              <option value="nextExpected">Sort: Next Charge</option>
            </select>
            <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 'auto' }}>
              {filtered.length} of {subs.length} subscriptions
            </span>
          </div>

          {/* Subscription Table */}
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                  {['MERCHANT', 'CATEGORY', 'FREQUENCY', 'AMOUNT', 'ANNUAL COST', 'CONFIDENCE', 'OCCURRENCES', 'LAST CHARGED', 'NEXT EXPECTED', 'STATUS'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub, i) => {
                  const freq = FREQ_COLORS[sub.frequencyLabel] || FREQ_COLORS.Irregular;
                  const status = STATUS_COLORS[sub.status];
                  return (
                    <tr key={sub.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={S.td}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{sub.merchant.substring(0, 22)}</div>
                        {sub.amountVariance > 10 && (
                          <div style={{ fontSize: 10, color: '#f59e0b' }}>±{sub.amountVariance}% variance</div>
                        )}
                      </td>
                      <td style={{ ...S.td, fontSize: 11, color: '#6b7280' }}>{sub.category.replace(/_/g, ' ')}</td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: freq.bg, color: freq.color, border: `1px solid ${freq.border}` }}>
                          {sub.frequencyLabel}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#111827' }}>
                        ${sub.amountPerOccurrence.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#1d4ed8' }}>
                        ${sub.annualCost.toLocaleString()}
                      </td>
                      <td style={{ ...S.td, minWidth: 120 }}>
                        <ConfidenceBar value={sub.confidence} />
                      </td>
                      <td style={{ ...S.td, textAlign: 'center', fontWeight: 700, color: '#374151' }}>{sub.occurrences}x</td>
                      <td style={{ ...S.td, fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{sub.lastCharged}</td>
                      <td style={{ ...S.td, fontSize: 11, fontFamily: 'monospace', color: sub.status === 'at_risk' ? '#a16207' : '#374151', fontWeight: sub.status === 'at_risk' ? 700 : 400 }}>
                        {sub.nextExpected}
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: status.bg, color: status.color }}>
                          {sub.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
                No subscriptions match your filters.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function KPICard({ label, value, sub, color, highlight }: { label: string; value: string; sub: string; color: string; highlight?: boolean }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${highlight ? color : '#e5e7eb'}`, borderRadius: 8, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
      <div style={{ fontSize: 10, letterSpacing: '1.5px', color: '#6b7280', marginBottom: 6, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, fontFamily: 'monospace' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#374151' }}>{value}</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  headerLabel: { fontSize: 10, letterSpacing: '3px', color: '#1d4ed8', marginBottom: 4, fontWeight: 600 },
  title: { fontSize: 24, fontWeight: 800, color: '#111827', margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: '#6b7280', margin: 0 },
  refreshBtn: { padding: '8px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 16 },
  loadingBox: { display: 'flex', alignItems: 'center', gap: 12, padding: 40, color: '#6b7280', fontSize: 13, justifyContent: 'center' },
  spinner: { width: 20, height: 20, border: '2px solid #e5e7eb', borderTop: '2px solid #1d4ed8', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 },
  breakdownGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 },
  breakdownCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  breakdownTitle: { fontSize: 10, letterSpacing: '2px', color: '#6b7280', fontWeight: 700, marginBottom: 12 },
  freqBadge: { padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' },
  filterBar: { display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' },
  searchInput: { padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, width: 200, outline: 'none' },
  select: { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' },
  tableWrap: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px', whiteSpace: 'nowrap' },
  td: { padding: '11px 14px', verticalAlign: 'middle' },
  badge: { padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' },
};
