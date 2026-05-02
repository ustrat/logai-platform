import { useState } from 'react';
import { Globe, Zap, Plus, Trash2 } from 'lucide-react';
import { currencyGuardApi, type FxTransaction } from '../services/addonsApi';

const SEV_COLOR: Record<string, string> = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };

function emptyTx(): FxTransaction {
  return { vendor: '', sourceCurrency: '', targetCurrency: 'USD', sourceAmount: 0, targetAmount: 0, appliedRate: 0, transactionDate: new Date().toISOString().slice(0, 10), channel: '', invoiceRef: '' };
}

export default function CurrencyGuard() {
  const [transactions, setTransactions] = useState<FxTransaction[]>([emptyTx()]);
  const [report, setReport]             = useState<any>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [tab, setTab]                   = useState<'input' | 'results'>('input');

  function updateTx(i: number, field: keyof FxTransaction, value: string | number) {
    setTransactions(t => t.map((x, idx) => idx === i ? { ...x, [field]: value } : x));
  }

  async function analyze() {
    const valid = transactions.filter(t => t.vendor.trim() && t.sourceCurrency.trim() && t.sourceAmount > 0);
    if (!valid.length) { setError('Add at least one valid transaction.'); return; }
    setLoading(true); setError('');
    try {
      const data: any = await currencyGuardApi.analyze(valid);
      setReport(data.report);
      setTab('results');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const input: React.CSSProperties = { width: '100%', padding: '7px 8px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12 };
  const card: React.CSSProperties  = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 };

  return (
    <div style={{ padding: 24, maxWidth: 960, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Globe size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)' }}>CurrencyGuard™</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.5px' }}>
        FX INEFFICIENCY DETECTION — BOARDERPILOT™ / DRIVEPILOT™
      </p>

      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'TOTAL FX LOSS', value: `$${report.totalLossUSD?.toFixed(2)}` },
            { label: 'AVG SPREAD', value: `${report.avgSpreadPct?.toFixed(2)}%` },
            { label: 'INEFFICIENCIES', value: report.inefficiencies?.length ?? 0 },
            { label: 'PAIRS ANALYZED', value: report.currencyPairsAnalyzed?.length ?? 0 },
          ].map(m => (
            <div key={m.label} style={{ ...card, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['input', 'results'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} disabled={t === 'results' && !report}
            style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent', color: tab === t ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent', cursor: t === 'results' && !report ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: t === 'results' && !report ? 0.4 : 1 }}>
            {t === 'input' ? 'Input Transactions' : 'FX Analysis'}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      {tab === 'input' && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Vendor', 'From CCY', 'To CCY', 'Src Amount', 'Tgt Amount', 'Rate Applied', 'Date', ''].map(h => (
                  <th key={h} style={{ padding: '8px 8px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {transactions.map((t, i) => (
                  <tr key={i}>
                    <td style={{ padding: '5px 4px' }}><input value={t.vendor} onChange={e => updateTx(i, 'vendor', e.target.value)} placeholder="Acme Ltd" style={{ ...input, width: 120 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input value={t.sourceCurrency} onChange={e => updateTx(i, 'sourceCurrency', e.target.value.toUpperCase())} placeholder="GBP" style={{ ...input, width: 60 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input value={t.targetCurrency} onChange={e => updateTx(i, 'targetCurrency', e.target.value.toUpperCase())} placeholder="USD" style={{ ...input, width: 60 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="number" value={t.sourceAmount || ''} onChange={e => updateTx(i, 'sourceAmount', parseFloat(e.target.value) || 0)} placeholder="0" style={{ ...input, width: 90 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="number" value={t.targetAmount || ''} onChange={e => updateTx(i, 'targetAmount', parseFloat(e.target.value) || 0)} placeholder="0" style={{ ...input, width: 90 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="number" step="0.0001" value={t.appliedRate || ''} onChange={e => updateTx(i, 'appliedRate', parseFloat(e.target.value) || 0)} placeholder="1.2500" style={{ ...input, width: 90 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="date" value={t.transactionDate} onChange={e => updateTx(i, 'transactionDate', e.target.value)} style={{ ...input, width: 130 }} /></td>
                    <td style={{ padding: '5px 4px' }}>
                      <button onClick={() => setTransactions(t => t.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setTransactions(t => [...t, emptyTx()])}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              <Plus size={12} /> Add Transaction
            </button>
            <button onClick={analyze} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: loading ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}>
              <Zap size={13} /> {loading ? 'ANALYZING...' : 'DETECT INEFFICIENCIES'}
            </button>
          </div>
        </>
      )}

      {tab === 'results' && report && (
        <>
          {report.insights?.length > 0 && (
            <div style={{ ...card, borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>FX INTELLIGENCE INSIGHTS</div>
              {report.insights.map((ins: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', padding: '3px 0', display: 'flex', gap: 8 }}>
                  <span style={{ color: '#f59e0b' }}>→</span> {ins}
                </div>
              ))}
            </div>
          )}

          {report.inefficiencies?.map((fx: any, i: number) => (
            <div key={i} style={{ ...card, borderLeft: `3px solid ${SEV_COLOR[fx.severity] ?? '#888'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 10, color: SEV_COLOR[fx.severity], fontWeight: 700, letterSpacing: '1px' }}>{fx.severity?.toUpperCase()}</span>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginTop: 4 }}>{fx.vendor} — {fx.currencyPair}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: SEV_COLOR[fx.severity] }}>-${fx.lossAmountUSD?.toFixed(2)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>FX loss (USD)</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>APPLIED RATE</div>
                  <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, marginTop: 2 }}>{fx.appliedRate}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>MID-MARKET RATE</div>
                  <div style={{ fontSize: 13, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>{fx.marketRate}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>SPREAD</div>
                  <div style={{ fontSize: 13, color: '#ea580c', fontWeight: 700, marginTop: 2 }}>{fx.spreadPct?.toFixed(2)}%</div>
                </div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>{fx.recommendation}</p>
            </div>
          ))}

          {report.optimizationActions?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 12 }}>OPTIMIZATION ACTIONS</div>
              {report.optimizationActions.map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <span style={{ fontSize: 10, padding: '2px 6px', background: a.priority === 'high' ? 'rgba(220,38,38,0.08)' : 'rgba(245,158,11,0.08)', borderRadius: 10, color: a.priority === 'high' ? '#dc2626' : '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginRight: 8 }}>{a.priority?.toUpperCase()}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{a.action}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#16a34a' }}>+${a.potentialSavingUSD?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
