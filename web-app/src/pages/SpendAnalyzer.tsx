import { useState } from 'react';
import { PieChart, Zap, Plus, Trash2 } from 'lucide-react';
import { spendAnalyzerApi, type SpendRecord } from '../services/addonsApi';

const SEVERITY_COLOR: Record<string, string> = {
  high: '#dc2626', medium: '#ea580c', low: '#d97706',
};

function emptyRecord(): SpendRecord {
  return { vendor: '', amount: 0, currency: 'USD', category: '', department: '', date: new Date().toISOString().slice(0, 10) };
}

export default function SpendAnalyzer() {
  const [records, setRecords]     = useState<SpendRecord[]>([emptyRecord()]);
  const [report, setReport]       = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [tab, setTab]             = useState<'input' | 'clusters' | 'anomalies' | 'optimize'>('input');

  function updateRecord(i: number, field: keyof SpendRecord, value: string | number) {
    setRecords(r => r.map((x, idx) => idx === i ? { ...x, [field]: value } : x));
  }

  async function analyze() {
    const valid = records.filter(r => r.vendor.trim() && r.amount > 0);
    if (valid.length === 0) { setError('Add at least one record with vendor and amount.'); return; }
    setLoading(true); setError('');
    try {
      const data: any = await spendAnalyzerApi.analyze(valid);
      setReport(data.report);
      setTab('clusters');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 };
  const input: React.CSSProperties = { width: '100%', padding: '7px 10px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12 };

  const tabs = ['input', 'clusters', 'anomalies', 'optimize'] as const;
  const tabLabels = { input: 'Input Data', clusters: 'Clusters', anomalies: 'Anomalies', optimize: 'Optimize' };

  return (
    <div style={{ padding: 24, maxWidth: 960, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <PieChart size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)' }}>SpendAnalyzer™</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.5px' }}>
        ENTERPRISE SAAS SPEND CLUSTERING — ENTERPRISEPILOT™
      </p>

      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'TOTAL SPEND', value: `$${report.totalSpend?.toLocaleString()}` },
            { label: 'CLUSTERS', value: report.clusters?.length ?? 0 },
            { label: 'REDUNDANCIES', value: report.redundancies?.length ?? 0 },
            { label: 'OPT SCORE', value: `${report.optimizationScore ?? 0}/100` },
          ].map(m => (
            <div key={m.label} style={{ ...card, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} disabled={t !== 'input' && !report}
            style={{ padding: '8px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent', color: tab === t ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent', cursor: t !== 'input' && !report ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: t !== 'input' && !report ? 0.4 : 1 }}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      {tab === 'input' && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Vendor', 'Amount', 'Currency', 'Category', 'Department', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i}>
                    {(['vendor', 'amount', 'currency', 'category', 'department', 'date'] as (keyof SpendRecord)[]).map(f => (
                      <td key={f} style={{ padding: '6px 6px' }}>
                        <input type={f === 'amount' ? 'number' : f === 'date' ? 'date' : 'text'}
                          value={r[f] as any} onChange={e => updateRecord(i, f, f === 'amount' ? parseFloat(e.target.value) || 0 : e.target.value)}
                          placeholder={f === 'vendor' ? 'Acme Corp' : f === 'amount' ? '0' : ''}
                          style={{ ...input, width: f === 'amount' ? '90px' : f === 'currency' ? '70px' : '100%' }} />
                      </td>
                    ))}
                    <td style={{ padding: '6px' }}>
                      <button onClick={() => setRecords(r => r.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setRecords(r => [...r, emptyRecord()])}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              <Plus size={12} /> Add Row
            </button>
            <button onClick={analyze} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: loading ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}>
              <Zap size={13} /> {loading ? 'ANALYZING...' : 'ANALYZE SPEND'}
            </button>
          </div>
        </>
      )}

      {tab === 'clusters' && report && (
        <>
          {report.insights?.length > 0 && (
            <div style={{ ...card, borderLeft: '3px solid #f59e0b', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>EXECUTIVE INSIGHTS</div>
              {report.insights.map((ins: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', padding: '3px 0', display: 'flex', gap: 8 }}>
                  <span style={{ color: '#f59e0b' }}>→</span> {ins}
                </div>
              ))}
            </div>
          )}
          {report.clusters?.map((c: any, i: number) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>{c.category}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>${c.totalSpend?.toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>${c.avgMonthly?.toLocaleString()}/mo avg</div>
                </div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {c.vendors?.map((v: string) => (
                  <span key={v} style={{ fontSize: 10, padding: '3px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text-muted)' }}>{v}</span>
                ))}
              </div>
              {c.insight && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, fontStyle: 'italic' }}>{c.insight}</p>}
            </div>
          ))}
        </>
      )}

      {tab === 'anomalies' && report && (
        <>
          {report.budgetAnomalies?.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>No budget anomalies detected.</p>}
          {report.budgetAnomalies?.map((a: any, i: number) => (
            <div key={i} style={{ ...card, borderLeft: `3px solid ${SEVERITY_COLOR[a.severity] ?? '#888'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 11, color: SEVERITY_COLOR[a.severity], fontWeight: 700, letterSpacing: '1px' }}>{a.severity?.toUpperCase()}</span>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginTop: 4 }}>{a.vendor}</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: SEVERITY_COLOR[a.severity] }}>${a.amount?.toLocaleString()}</div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>{a.reason}</p>
            </div>
          ))}
        </>
      )}

      {tab === 'optimize' && report && (
        <>
          {report.redundancies?.map((r: any, i: number) => (
            <div key={i} style={{ ...card, borderLeft: '3px solid #1d4ed8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 12, color: '#1d4ed8', fontWeight: 700, letterSpacing: '1px' }}>REDUNDANCY — {r.category}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                    {r.vendors?.map((v: string) => <span key={v} style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span>)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#16a34a' }}>+${r.potentialSaving?.toLocaleString()}/mo</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>potential saving</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 10 }}>{r.recommendation}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
