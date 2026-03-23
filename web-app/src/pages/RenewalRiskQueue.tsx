import { useState, useEffect } from 'react';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────
interface RenewalItem {
  id: string;
  provider: string;
  providerIcon: string;
  summary: string;
  projectedCharge: number;
  confidence: 'High' | 'Medium' | 'Low';
  eligibility: 'Eligible' | 'Pending' | 'In Review' | 'Ineligible';
  strategy: string;
  nextAction: string;
  category: string;
  daysToRenewal: number;
  source: string;
}

// ── Helpers ────────────────────────────────────────────────────
const PROVIDER_ICONS: Record<string, string> = {
  FOOD_AND_DRINK: '🍽️', TRANSPORTATION: '🚗', SHOPPING: '🛍️',
  ENTERTAINMENT: '🎬', TRANSFER: '💸', LOAN_PAYMENTS: '🏦',
  RENT_AND_UTILITIES: '🏠', MEDICAL: '🏥', TRAVEL: '✈️', OTHER: '📦',
};

const CONFIDENCE_STYLE: Record<string, { bg: string; color: string }> = {
  High:   { bg: '#dcfce7', color: '#15803d' },
  Medium: { bg: '#fef9c3', color: '#a16207' },
  Low:    { bg: '#fee2e2', color: '#b91c1c' },
};

const ELIGIBILITY_STYLE: Record<string, { bg: string; color: string }> = {
  Eligible:   { bg: '#dcfce7', color: '#15803d' },
  Pending:    { bg: '#fef9c3', color: '#a16207' },
  'In Review':{ bg: '#dbeafe', color: '#1d4ed8' },
  Ineligible: { bg: '#fee2e2', color: '#b91c1c' },
};

const ACTION_STYLE: Record<string, { bg: string; color: string }> = {
  'Review Details': { bg: '#1d4ed8', color: '#fff' },
  'Assess Options': { bg: '#1d4ed8', color: '#fff' },
  'Review Case':    { bg: '#1d4ed8', color: '#fff' },
  'Escalate':       { bg: '#dc2626', color: '#fff' },
  'Request Quote':  { bg: '#1d4ed8', color: '#fff' },
  'Confirm Terms':  { bg: '#15803d', color: '#fff' },
  'Follow Up':      { bg: '#7c3aed', color: '#fff' },
};

function mapTransactionToRenewal(txn: any, index: number): RenewalItem {
  const amount = Math.abs(txn.amount || 0);
  const confidence = amount > 50000 ? 'High' : amount > 20000 ? 'Medium' : 'Low';
  const eligibilities = ['Eligible', 'Eligible', 'Eligible', 'Pending', 'In Review'] as const;
  const strategies = ['Negotiate Terms', 'Multi-Year Option', 'Cost Reduction', 'Escalate to Review', 'Seek Discount', 'Renew at Same Rate', 'Gather More Info'];
  const actions = ['Review Details', 'Assess Options', 'Review Case', 'Escalate', 'Request Quote', 'Confirm Terms', 'Follow Up'];
  return {
    id: txn.transaction_id || `TXN-${index}`,
    provider: txn.merchant_name || txn.name || 'Unknown',
    providerIcon: PROVIDER_ICONS[txn.category] || '📦',
    summary: `${txn.category?.replace(/_/g, ' ')} Renewal — ${txn.name?.substring(0, 30)}`,
    projectedCharge: amount,
    confidence,
    eligibility: eligibilities[index % eligibilities.length],
    strategy: strategies[index % strategies.length],
    nextAction: actions[index % actions.length],
    category: txn.category || 'OTHER',
    daysToRenewal: 7 + (index % 60),
    source: 'Plaid',
  };
}

// ── Component ──────────────────────────────────────────────────
export default function RenewalRiskQueue() {
  const [items, setItems] = useState<RenewalItem[]>([]);
  const [filtered, setFiltered] = useState<RenewalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ provider: '', category: '', confidence: '', eligibility: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    let result = [...items];
    if (filters.confidence) result = result.filter(i => i.confidence === filters.confidence);
    if (filters.eligibility) result = result.filter(i => i.eligibility === filters.eligibility);
    if (filters.category) result = result.filter(i => i.category === filters.category);
    if (search) result = result.filter(i =>
      i.provider.toLowerCase().includes(search.toLowerCase()) ||
      i.summary.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [items, filters, search]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/plaid/transactions?count=100');
      const txns = res.data.data.transactions || [];
      const mapped = txns.map(mapTransactionToRenewal);
      setItems(mapped);
      setFiltered(mapped);
    } catch (e: any) {
      setError(e.response?.data?.error || 'No Plaid connection. Connect a bank account first.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const categories = [...new Set(items.map(i => i.category))];

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Renewal Risk Queue</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            placeholder="Search provider or summary..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={S.searchInput}
          />
          <button onClick={fetchData} style={S.refreshBtn}>↺ Refresh</button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={S.filterBar}>
        {[
          { label: 'Provider', key: 'provider', options: [] },
          { label: 'Category', key: 'category', options: categories },
          { label: 'Confidence', key: 'confidence', options: ['High', 'Medium', 'Low'] },
          { label: 'Eligibility', key: 'eligibility', options: ['Eligible', 'Pending', 'In Review', 'Ineligible'] },
        ].map(f => (
          <select
            key={f.key}
            value={filters[f.key as keyof typeof filters]}
            onChange={e => setFilters(prev => ({ ...prev, [f.key]: e.target.value }))}
            style={S.filterSelect}
          >
            <option value="">{f.label}</option>
            {f.options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        ))}
        <button
          onClick={() => setFilters({ provider: '', category: '', confidence: '', eligibility: '' })}
          style={S.filterBtn}
        >Filter ▾</button>
      </div>

      {error && <div style={S.errorBox}>⚠ {error} — <a href="/plaid" style={{ color: '#1d4ed8' }}>Connect Plaid</a></div>}
      {loading && <div style={S.loadingBox}>Loading renewal data from Plaid...</div>}

      {!loading && !error && (
        <div style={S.tableWrap}>
          <table style={S.table}>
            <thead>
              <tr style={S.thead}>
                <th style={{ ...S.th, width: 32 }}><input type="checkbox" /></th>
                <th style={S.th}>ID</th>
                <th style={S.th}>Provider</th>
                <th style={S.th}>Renewal Summary</th>
                <th style={S.th}>Projected Charge</th>
                <th style={S.th}>Confidence</th>
                <th style={S.th}>Eligibility</th>
                <th style={S.th}>Strategy</th>
                <th style={S.th}>Next Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((item, i) => {
                const conf = CONFIDENCE_STYLE[item.confidence];
                const elig = ELIGIBILITY_STYLE[item.eligibility];
                const act = ACTION_STYLE[item.nextAction] || { bg: '#1d4ed8', color: '#fff' };
                return (
                  <tr key={item.id} style={{ ...S.tr, background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                    <td style={S.td}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                    </td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>{item.id.substring(0, 10)}</td>
                    <td style={S.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={S.providerIcon}>{item.providerIcon}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{item.provider.substring(0, 18)}</span>
                      </div>
                    </td>
                    <td style={{ ...S.td, maxWidth: 240 }}>
                      <span style={{ fontSize: 13, color: '#374151' }}>{item.summary.substring(0, 45)}</span>
                    </td>
                    <td style={{ ...S.td, fontFamily: 'monospace', fontWeight: 700, color: '#111827' }}>
                      ${item.projectedCharge.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: conf.bg, color: conf.color }}>{item.confidence}</span>
                    </td>
                    <td style={S.td}>
                      <span style={{ ...S.badge, background: elig.bg, color: elig.color }}>{item.eligibility}</span>
                    </td>
                    <td style={{ ...S.td, fontSize: 12, color: '#374151' }}>{item.strategy}</td>
                    <td style={S.td}>
                      <button style={{ ...S.actionBtn, background: act.bg, color: act.color }}>
                        {item.nextAction}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 }}>
              No results match your filters.
            </div>
          )}
          <div style={S.tableFooter}>
            Showing {Math.min(50, filtered.length)} of {filtered.length} renewals
            {selected.size > 0 && <span style={{ marginLeft: 16, color: '#1d4ed8' }}>{selected.size} selected</span>}
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
  searchInput: { padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, color: '#374151', width: 240, outline: 'none' },
  refreshBtn: { padding: '7px 14px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151' },
  filterBar: { display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterSelect: { padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, color: '#374151', background: '#fff', cursor: 'pointer' },
  filterBtn: { padding: '6px 14px', background: '#1d4ed8', border: 'none', borderRadius: 6, fontSize: 12, color: '#fff', cursor: 'pointer', marginLeft: 'auto' },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 16 },
  loadingBox: { padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 },
  tableWrap: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  thead: { background: '#f9fafb' },
  th: { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#6b7280', letterSpacing: '0.5px', borderBottom: '1px solid #e5e7eb', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #f3f4f6', transition: 'background 0.1s' },
  td: { padding: '11px 14px', verticalAlign: 'middle' },
  badge: { padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600 },
  actionBtn: { padding: '5px 12px', borderRadius: 5, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' },
  providerIcon: { fontSize: 18, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 6 },
  tableFooter: { padding: '10px 16px', borderTop: '1px solid #f3f4f6', fontSize: 12, color: '#9ca3af', background: '#f9fafb' },
};
