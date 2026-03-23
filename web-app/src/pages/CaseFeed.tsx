import { useState, useEffect } from 'react';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────
type CaseStage = 'New Risk Detected' | 'Provider Response' | 'Approval Pending' | 'Keep Decision Made' | 'Evidence Required';
type CaseTab = 'New Detections' | 'Stalled Cases' | 'Approvals Needed' | 'Provider Updates';

interface Case {
  id: string;
  company: string;
  amount: number;
  tag: string;
  tagColor: string;
  stage: CaseStage;
  owner: string;
  assignee: string;
  primaryAction: string;
  primaryActionStyle: 'blue' | 'green' | 'orange' | 'gray';
  secondaryAction?: string;
  icon: string;
  tab: CaseTab;
}

// ── Helpers ────────────────────────────────────────────────────
const STAGE_CONFIGS: { stage: CaseStage; primaryAction: string; primaryActionStyle: 'blue' | 'green' | 'orange' | 'gray'; secondaryAction?: string; tagColor: string }[] = [
  { stage: 'New Risk Detected',   primaryAction: 'Review Case',      primaryActionStyle: 'blue',   tagColor: '#ef4444' },
  { stage: 'Provider Response',   primaryAction: 'View Response',    primaryActionStyle: 'blue',   secondaryAction: 'Reply Received: View Response', tagColor: '#3b82f6' },
  { stage: 'Approval Pending',    primaryAction: 'Approve Request',  primaryActionStyle: 'green',  secondaryAction: 'Awaiting Your Approval', tagColor: '#f59e0b' },
  { stage: 'Keep Decision Made',  primaryAction: 'Confirm Keep',     primaryActionStyle: 'gray',   secondaryAction: 'Decision Made: Keep Provider', tagColor: '#10b981' },
  { stage: 'Evidence Required',   primaryAction: 'Upload Evidence',  primaryActionStyle: 'orange', secondaryAction: 'Request Evidence: Upload Docs', tagColor: '#8b5cf6' },
];

const TAGS = ['High Cost Claims', 'Utilization Spike', 'Quality of Care', 'Member Churn', 'Missing Documentation', 'Price Increase', 'Renewal Risk'];
const TABS: CaseTab[] = ['New Detections', 'Stalled Cases', 'Approvals Needed', 'Provider Updates'];
const OWNERS = ['Alice R.', 'James P.', 'Sara M.', 'David T.', 'Karen L.', 'Mike B.'];

function mapTransactionToCase(txn: any, index: number): Case {
  const config = STAGE_CONFIGS[index % STAGE_CONFIGS.length];
  const tabs: CaseTab[] = ['New Detections', 'New Detections', 'Stalled Cases', 'Approvals Needed', 'Provider Updates'];
  return {
    id: txn.transaction_id || `CASE-${index}`,
    company: txn.merchant_name || txn.name || 'Unknown Provider',
    amount: Math.abs(txn.amount || 0),
    tag: TAGS[index % TAGS.length],
    tagColor: config.tagColor,
    stage: config.stage,
    owner: OWNERS[index % OWNERS.length],
    assignee: OWNERS[(index + 1) % OWNERS.length],
    primaryAction: config.primaryAction,
    primaryActionStyle: config.primaryActionStyle,
    secondaryAction: config.secondaryAction,
    icon: '🏢',
    tab: tabs[index % tabs.length],
  };
}

const ACTION_STYLES: Record<string, React.CSSProperties> = {
  blue:   { background: '#1d4ed8', color: '#fff' },
  green:  { background: '#15803d', color: '#fff' },
  orange: { background: '#ea580c', color: '#fff' },
  gray:   { background: '#374151', color: '#fff' },
};

// ── Component ──────────────────────────────────────────────────
export default function CaseFeed() {
  const [cases, setCases] = useState<Case[]>([]);
  const [activeTab, setActiveTab] = useState<CaseTab>('New Detections');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/plaid/transactions?count=50');
      const txns = res.data.data.transactions || [];
      setCases(txns.map(mapTransactionToCase));
    } catch (e: any) {
      setError(e.response?.data?.error || 'No Plaid connection.');
    } finally {
      setLoading(false);
    }
  };

  const filtered = cases.filter(c => c.tab === activeTab);
  const tabCounts = TABS.reduce((acc, tab) => {
    acc[tab] = cases.filter(c => c.tab === tab).length;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div style={S.page}>
      <div style={S.header}>
        <h1 style={S.title}>Case Feed</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                ...S.tab,
                ...(activeTab === tab ? S.tabActive : {}),
              }}
            >
              {tab}
              {tabCounts[tab] > 0 && (
                <span style={{ ...S.tabCount, background: activeTab === tab ? '#1d4ed8' : '#e5e7eb', color: activeTab === tab ? '#fff' : '#6b7280' }}>
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
          <button style={S.filterDropdown}>Filter ▾</button>
        </div>
      </div>

      {error && (
        <div style={S.errorBox}>
          ⚠ {error} — <a href="/plaid" style={{ color: '#1d4ed8' }}>Connect Plaid</a>
        </div>
      )}

      {loading && <div style={S.loadingBox}>Loading cases from Plaid...</div>}

      {!loading && !error && (
        <div style={S.caseList}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13, background: '#fff', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              No cases in this category.
            </div>
          )}
          {filtered.map(c => (
            <div key={c.id} style={S.caseCard}>
              {/* Company Header */}
              <div style={S.caseCompany}>
                <span style={S.companyIcon}>{c.icon}</span>
                <span style={S.companyName}>{c.company}</span>
              </div>

              {/* Case Body */}
              <div style={S.caseBody}>
                <div style={S.caseLeft}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: '#111827', fontFamily: 'monospace' }}>
                    ${c.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.tagColor, display: 'inline-block' }} />
                    <span style={{ fontSize: 12, color: '#374151', fontWeight: 500 }}>{c.tag}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    👤 {c.assignee}
                  </div>
                </div>

                <div style={S.caseMiddle}>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    Stage <span style={{ color: '#111827', fontWeight: 600 }}>{c.stage}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                    Owner {c.owner}
                  </div>
                </div>

                <div style={S.caseRight}>
                  {c.secondaryAction && (
                    <div style={S.secondaryActionBox}>
                      <span style={{ fontSize: 11, color: '#374151' }}>
                        {c.secondaryAction.includes(':')
                          ? <>
                              <span style={{ color: '#6b7280' }}>{c.secondaryAction.split(':')[0]}:</span>
                              <span style={{ color: '#1d4ed8', marginLeft: 4 }}>{c.secondaryAction.split(':')[1]}</span>
                            </>
                          : c.secondaryAction
                        }
                      </span>
                    </div>
                  )}
                  <button style={{ ...S.actionBtn, ...ACTION_STYLES[c.primaryActionStyle] }}>
                    {c.primaryAction}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { padding: '28px 32px', background: '#f8fafc', minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
  title: { fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 },
  tab: { padding: '7px 14px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', fontSize: 13, color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  tabActive: { color: '#1d4ed8', borderBottom: '2px solid #1d4ed8', fontWeight: 600 },
  tabCount: { padding: '1px 7px', borderRadius: 10, fontSize: 11, fontWeight: 600 },
  filterDropdown: { padding: '7px 12px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer', color: '#374151', marginLeft: 8 },
  errorBox: { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', fontSize: 13, marginBottom: 16 },
  loadingBox: { padding: 40, textAlign: 'center', color: '#6b7280', fontSize: 13 },
  caseList: { display: 'flex', flexDirection: 'column', gap: 12 },
  caseCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  caseCompany: { padding: '12px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 },
  companyIcon: { fontSize: 16, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f3f4f6', borderRadius: 6 },
  companyName: { fontSize: 14, fontWeight: 700, color: '#111827' },
  caseBody: { padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 },
  caseLeft: { minWidth: 160 },
  caseMiddle: { flex: 1 },
  caseRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, minWidth: 200 },
  secondaryActionBox: { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 10px', fontSize: 11 },
  actionBtn: { padding: '8px 16px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' },
};
