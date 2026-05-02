import { useState } from 'react';
import { Scale, Zap, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { taxNormalizerApi, type TaxLineItem } from '../services/addonsApi';

const CLASS_COLOR: Record<string, string> = {
  correct: '#16a34a', overcharged: '#dc2626', undercharged: '#ea580c',
  exempt_eligible: '#1d4ed8', misclassified: '#7c3aed',
};

const RISK_COLOR: Record<string, string> = { high: '#dc2626', medium: '#ea580c', low: '#d97706' };

function emptyLine(): TaxLineItem {
  return { vendor: '', country: '', region: '', taxType: 'VAT', taxRate: 0, grossAmount: 0, taxAmount: 0, netAmount: 0, currency: 'USD', invoiceDate: new Date().toISOString().slice(0, 10) };
}

export default function TaxNormalizer() {
  const [lines, setLines]   = useState<TaxLineItem[]>([emptyLine()]);
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [tab, setTab]       = useState<'input' | 'results' | 'compliance'>('input');

  function updateLine(i: number, field: keyof TaxLineItem, value: string | number) {
    setLines(l => l.map((x, idx) => idx === i ? { ...x, [field]: value } : x));
  }

  async function normalize() {
    const valid = lines.filter(l => l.vendor.trim() && l.country.trim() && l.grossAmount > 0);
    if (!valid.length) { setError('Add at least one line with vendor, country, and gross amount.'); return; }
    setLoading(true); setError('');
    try {
      const data: any = await taxNormalizerApi.normalize(valid);
      setReport(data.report);
      setTab('results');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const input: React.CSSProperties = { width: '100%', padding: '7px 8px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-primary)', fontSize: 12 };
  const card: React.CSSProperties  = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 };

  return (
    <div style={{ padding: 24, maxWidth: 1060, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Scale size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)' }}>TaxNormalizer™</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.5px' }}>
        CROSS-JURISDICTION TAX INTELLIGENCE — BOARDERPILOT™
      </p>

      {report && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'TOTAL OVERCHARGE', value: `$${report.totalOverchargeUSD?.toFixed(2)}` },
            { label: 'LINES ANALYZED', value: report.lineItemCount ?? 0 },
            { label: 'JURISDICTIONS', value: report.jurisdictionsFound?.length ?? 0 },
            { label: 'COMPLIANCE FLAGS', value: report.complianceFlags?.length ?? 0 },
          ].map(m => (
            <div key={m.label} style={{ ...card, textAlign: 'center', padding: 14 }}>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px', marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b' }}>{m.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['input', 'results', 'compliance'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} disabled={t !== 'input' && !report}
            style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent', color: tab === t ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent', cursor: t !== 'input' && !report ? 'not-allowed' : 'pointer', textTransform: 'uppercase', opacity: t !== 'input' && !report ? 0.4 : 1 }}>
            {t === 'input' ? 'Tax Lines' : t === 'results' ? 'Normalization' : 'Compliance'}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      {tab === 'input' && (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>{['Vendor', 'Country', 'Tax Type', 'Rate %', 'Gross', 'Tax Amt', 'Net', 'CCY', 'Invoice Date', ''].map(h => (
                  <th key={h} style={{ padding: '8px 6px', textAlign: 'left', fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: '5px 4px' }}><input value={l.vendor} onChange={e => updateLine(i, 'vendor', e.target.value)} placeholder="Vendor" style={{ ...input, width: 110 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input value={l.country} onChange={e => updateLine(i, 'country', e.target.value.toUpperCase())} placeholder="GB" style={{ ...input, width: 55 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input value={l.taxType} onChange={e => updateLine(i, 'taxType', e.target.value)} placeholder="VAT" style={{ ...input, width: 70 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="number" step="0.01" value={l.taxRate || ''} onChange={e => updateLine(i, 'taxRate', parseFloat(e.target.value) || 0)} placeholder="20" style={{ ...input, width: 60 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="number" value={l.grossAmount || ''} onChange={e => updateLine(i, 'grossAmount', parseFloat(e.target.value) || 0)} placeholder="0" style={{ ...input, width: 80 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="number" value={l.taxAmount || ''} onChange={e => updateLine(i, 'taxAmount', parseFloat(e.target.value) || 0)} placeholder="0" style={{ ...input, width: 80 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="number" value={l.netAmount || ''} onChange={e => updateLine(i, 'netAmount', parseFloat(e.target.value) || 0)} placeholder="0" style={{ ...input, width: 80 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input value={l.currency} onChange={e => updateLine(i, 'currency', e.target.value.toUpperCase())} placeholder="USD" style={{ ...input, width: 55 }} /></td>
                    <td style={{ padding: '5px 4px' }}><input type="date" value={l.invoiceDate} onChange={e => updateLine(i, 'invoiceDate', e.target.value)} style={{ ...input, width: 130 }} /></td>
                    <td style={{ padding: '5px 4px' }}>
                      <button onClick={() => setLines(l => l.filter((_, idx) => idx !== i))} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setLines(l => [...l, emptyLine()])}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              <Plus size={12} /> Add Line
            </button>
            <button onClick={normalize} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: loading ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}>
              <Zap size={13} /> {loading ? 'NORMALIZING...' : 'NORMALIZE TAX'}
            </button>
          </div>
        </>
      )}

      {tab === 'results' && report && (
        <>
          {report.insights?.length > 0 && (
            <div style={{ ...card, borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>KEY FINDINGS</div>
              {report.insights.map((ins: string, i: number) => (
                <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', padding: '3px 0', display: 'flex', gap: 8 }}>
                  <span style={{ color: '#f59e0b' }}>→</span> {ins}
                </div>
              ))}
            </div>
          )}

          {report.normalizedLines?.map((l: any, i: number) => (
            <div key={i} style={{ ...card, borderLeft: `3px solid ${CLASS_COLOR[l.classification] ?? '#888'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span style={{ fontSize: 10, color: CLASS_COLOR[l.classification], fontWeight: 700, letterSpacing: '1px' }}>{l.classification?.replace(/_/g, ' ').toUpperCase()}</span>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginTop: 4 }}>{l.vendor} — {l.jurisdiction}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{l.taxType} · Treatment: {l.treatmentCode}</div>
                </div>
                {l.overchargeUSD > 0 && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>-${l.overchargeUSD?.toFixed(2)}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>overcharge (USD)</div>
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
                <div><div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>APPLIED RATE</div><div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700, marginTop: 2 }}>{l.appliedRate}%</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>EXPECTED RATE</div><div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700, marginTop: 2 }}>{l.expectedRate}%</div></div>
                <div><div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>VARIANCE</div><div style={{ fontSize: 12, color: '#ea580c', fontWeight: 700, marginTop: 2 }}>{l.rateVariance?.toFixed(2)}%</div></div>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>{l.recommendation}</p>
            </div>
          ))}

          {report.optimizationOpportunities?.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700, letterSpacing: '1px', marginBottom: 12 }}>OPTIMIZATION OPPORTUNITIES</div>
              {report.optimizationOpportunities.map((o: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700 }}>{o.type}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 3 }}>{o.description}</div>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#16a34a', flexShrink: 0 }}>+${o.estimatedSavingUSD?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'compliance' && report && (
        <>
          {report.complianceFlags?.length === 0 && <p style={{ color: '#16a34a', fontSize: 13, padding: '20px 0' }}>No compliance flags detected.</p>}
          {report.complianceFlags?.map((f: any, i: number) => (
            <div key={i} style={{ ...card, borderLeft: `3px solid ${RISK_COLOR[f.severity] ?? '#888'}` }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} color={RISK_COLOR[f.severity]} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, color: RISK_COLOR[f.severity], fontWeight: 700, letterSpacing: '1px' }}>{f.severity?.toUpperCase()} RISK — {f.vendor}</div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 6 }}>{f.description}</p>
                </div>
              </div>
            </div>
          ))}
          {report.jurisdictionSummary?.map((j: any, i: number) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{j.jurisdiction}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {j.taxTypes?.map((t: string) => <span key={t} style={{ fontSize: 10, padding: '2px 7px', background: 'var(--bg-elevated)', borderRadius: 10, color: 'var(--text-muted)' }}>{t}</span>)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, padding: '3px 8px', background: `rgba(${j.complianceRisk === 'high' ? '220,38,38' : j.complianceRisk === 'medium' ? '234,88,12' : '217,119,6'},0.08)`, borderRadius: 12, color: RISK_COLOR[j.complianceRisk] ?? '#888', fontWeight: 700, letterSpacing: '1px' }}>{j.complianceRisk?.toUpperCase()} RISK</span>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#dc2626', marginTop: 6 }}>-${j.overchargeUSD?.toFixed(2)}</div>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
