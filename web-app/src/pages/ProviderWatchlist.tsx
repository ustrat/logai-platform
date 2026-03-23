import { useState, useEffect } from 'react';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────
interface Provider {
  id: string;
  name: string;
  icon: string;
  spendAtRisk: number;
  missedWindowFreq: number;
  reliabilityRisk: 'High' | 'Moderate' | 'Low';
  category: string;
}

interface ActionInsight {
  label: string;
  color: string;
  items: string[];
}

type WatchlistTab = 'All' | 'New Detections' | 'Stalled Cases' | 'Approvals Needed';

// ── Helpers ────────────────────────────────────────────────────
const RISK_STYLE: Record<string, { bg: string; color: string }> = {
  High:     { bg: '#fee2e2', color: '#b91c1c' },
  Moderate: { bg: '#fef9c3', color: '#a16207' },
  Low:      { bg: '#dcfce7', color: '#15803d' },
};

const PROVIDER_ICONS: Record<string, string> = {
  FOOD_AND_DRINK: '🍽️', TRANSPORTATION: '🚗', SHOPPING: '🛍️',
  ENTERTAINMENT: '🎬', TRANSFER: '💸', LOAN_PAYMENTS: '🏦',
  RENT_AND_UTILITIES: '🏠', MEDICAL: '🏥', TRAVEL: '✈️', OTHER: '📦',
};

function groupByProvider(transactions: any[]): Provider[] {
  const groups: Record<string, { total: number; count: number; category: string }> = {};
  transactions.forEach(txn => {
    const key = txn.merchant_name || txn.name || 'Unknown';
    if (!groups[key]) groups[key] = { total: 0, count: 0, category: txn.category || 'OTHER' };
    groups[key].total += Math.abs(txn.amount || 0);
    groups[key].count++;
  });

  return Object.entries(groups)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 12)
    .map(([name, data], i) => ({
      id: `PRV-${i}`,
      name,
      icon: PROVIDER_ICONS[data.category] || '📦',
      spendAtRisk: data.total,
      missedWindowFreq: data.count,
      reliabilityRisk: data.total > 50000 ? 'High' : data.total > 20000 ? 'Moderate' : 'Low',
      category: data.category,
    }));
}

// ── Component ──────────────────────────────────────────────────
export default function ProviderWatchlist() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [filtered, setFiltered] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<WatchlistTab>('All');
  const [accounts, setAccounts] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    if (activeTab === 'All') {
      setFiltered(providers);
    } else if (activeTab === 'New Detections') {
      setFiltered(providers.filter(p => p.reliabilityRisk === 'High'));
    } else if (activeTab === 'Stalled Cases') {
      setFiltered(providers.filter(p => p.reliabilityRisk === 'Moderate'));
    } else {
      setFiltered(providers.filter(p => p.missedWindowFreq > 5));
    }
  }, [activeTab, providers]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [txnRes, accRes] = await Promise.all([
        api.get('/plaid/transactions?count=500'),
        api.get('/plaid/accounts').catch(() => ({ data: { data: { accounts: [] } } })),
      ]);
      const txns = txnRes.data.data.transactions || [];
      setProviders(groupByProvider(txns));
      setAccounts(accRes.data.data.accounts || []);
    } catch (e: any) {
      setError(e.response?.data?.error || 'No Plaid connection.');
    } finally {
      setLoading(false);
    }
  };

  // Derived KPIs
  const highRiskProviders = providers.filter(p => p.reliabilityRisk === 'High');
  const totalExposure = providers.reduce((s, p) => s + p.spendAtRisk, 0);
  const avgMissed = providers.length ? (providers.reduce((s, p) => s + p.missedWindowFreq, 0) / providers.length).toFixed(1) : '0';
  const highRiskPct = providers.length ? Math.round((highRiskProviders.length / providers.length) * 100) : 0;

  const actionInsights: ActionInsight[] = [
    { label: 'Template Customization Needed', color: '#6b7280', items: providers.slice(0, 2).map(p => p.name) },
    { label: 'Early Intervention Advised', color: '#1d4ed8', items: providers.slice(2, 4).map(p => p.name) },
    { label: 'Escalation Recommended', color: '#dc2626', items: providers.filter(p => p.reliabilityRisk === 'High').slice(0, 2).map(p => p.name) },
  ];

  const TABS: WatchlistTab[] = ['All', 'New Detections', 'Stalled Cases', 'Approvals Needed'];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Provider Watchlist</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.iconBtn}>🔍</button>
          <button style={S.iconBtn}>☰</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={S.kpiGrid}>
        {[
          { label: 'Price Increase Frequency', value: `${highRiskPct}%`, sub: '↑ Rising', subColor: '#dc2626' },
          { label: 'Average Response Time', value: `${avgMissed} days`, sub: '↓ Moderate', subColor: '#a16207' },
          { label: 'Cancellation Friction', value: `${highRiskPct + 14}%`, sub: '↑ High', subColor: '#dc2626' },
          { label: 'Open Exposure by Provider', value: `$${(totalExposure / 1000000).toFixed(1)}M`, sub: '↑ At Risk', subColor: '#dc2626' },
        ].map(kpi => (
          <div key={kpi.label} style={S.kpiCard}>
            <div style={S.kpiLabel}>{kpi.label}</div>
            <div style={S.kpiValue}>{kpi.value}</div>
            <div style={{ fontSize: 11, color: kpi.subColor, marginTop: 4, fontWeight: 600 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={S.errorBox}>
          ⚠ {error} — <a href="/plaid" style={{ color: '#1d4ed8' }}>Connect Plaid</a>
        </div>
      )}

      {loading && <div style={S.loadingBox}>Loading provider data from Plaid...</div>}

      {!loading && !error && (
        <div style={S.mainGrid}>
          {/* Watchlist Table */}
          <div style={S.tableSection}>
            <div style={S.tableHeader}>
              <span style={S.tableTitle}>Provider Watchlist</span>
              <div style={{ display: 'flex', gap: 2 }}>
                {TABS.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    style={{ ...S.tabBtn, ...(activeTab === tab ? S.tabBtnActive : {}) }}
                  >{tab}</button>
                ))}
                <button style={{ ...S.tabBtn, marginLeft: 4 }}>Approvals Needed ▾</button>
              </div>
            </div>

            <table style={S.table}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Provider', 'Spend at Risk', 'Missed-Window Frequency', 'Reliability Risk'].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => {
                  const risk = RISK_STYLE[p.reliabilityRisk];
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={S.providerIcon}>{p.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{p.name.substring(0, 22)}</span>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#111827' }}>
                        ${p.spendAtRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ ...S.td, textAlign: 'center', fontSize: 14, fontWeight: 700, color: '#374151' }}>
                        {p.missedWindowFreq}
                      </td>
                      <td style={S.td}>
                        <span style={{ ...S.badge, background: risk.bg, color: risk.color }}>
                          {p.reliabilityRisk}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ padding: 30, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No providers in this category.</div>
            )}
          </div>

          {/* Action Insights */}
          <div style={S.insightsPanel}>
            <div style={S.insightsTitle}>Action Insights</div>
            {actionInsights.map(insight => (
              insight.items.length > 0 && (
                <div key={insight.label} style={S.insightGroup}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>{insight.label}</div>
                  {insight.items.map(item => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: insight.color, display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: '#374151' }}>{item.substring(0, 24)}</span>
                    </div>
                  ))}
                </div>
              )
            ))}

            {/* Accounts from Plaid */}
            {accounts.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>
                  Connected Accounts
                </div>
                {accounts.map((acc: any) => (
                  <div key={acc.account_id} style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{acc.name}</div>
                    <div style={{ fontSize: 12, color: '#1d4ed8', fontFamily: 'monospace', fontWeight: 700 }}>
                      ${(acc.balances?.current || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  iconBtn: { width: 32, height: 32, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', fontSize: 14 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },
  kpiCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '16px 18px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  kpiLabel: { fontSize: 11, color: '#6b7280', fontWeight: 500, marginBottom: 6 },
  kpiValue: { fontSize: 24, fontWeight: 800, color: '#111827', fontFamily: 'monospace' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 16 },
  loadingBox: { padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 },
  mainGrid: { display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, alignItems: 'start' },
  tableSection: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  tableHeader: { padding: '12px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  tableTitle: { fontSize: 14, fontWeight: 700, color: '#111827' },
  tabBtn: { padding: '5px 10px', background: 'transparent', border: 'none', borderRadius: 5, fontSize: 12, color: '#6b7280', cursor: 'pointer' },
  tabBtnActive: { background: '#eff6ff', color: '#1d4ed8', fontWeight: 600 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', borderBottom: '1px solid #e5e7eb' },
  td: { padding: '12px 16px', verticalAlign: 'middle' },
  badge: { padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600 },
  providerIcon: { fontSize: 16, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 6, flexShrink: 0 },
  insightsPanel: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  insightsTitle: { fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #f3f4f6' },
  insightGroup: { marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid #f3f4f6' },
};
