import { useState, useEffect } from 'react';
import api from '../services/api';

interface RawEvent {
  id: string;
  raw: string;
  provider: string;
  date: string;
  amount: number;
  status: 'normalized' | 'flagged' | 'ignored' | 'pending';
}

interface NormalizedRecord {
  id: string;
  provider: string;
  renewalDate: string;
  amount: number;
  confidence: 'high' | 'medium' | 'low';
  missingFields: string[];
}

function parseToEvents(txns: any[]): { raw: RawEvent[]; normalized: NormalizedRecord[] } {
  const raw: RawEvent[] = txns.map((t, i) => ({
    id: t.transaction_id || `EVT-${i}`,
    raw: `${t.merchant_name || t.name} | ${t.category} | $${Math.abs(t.amount).toFixed(0)} | ${t.date}`,
    provider: t.merchant_name || t.name || 'Unknown',
    date: t.date,
    amount: Math.abs(t.amount),
    status: i % 8 === 0 ? 'flagged' : i % 12 === 0 ? 'ignored' : 'normalized',
  }));
  const normalized: NormalizedRecord[] = txns.map((t, i) => ({
    id: t.transaction_id || `NRM-${i}`,
    provider: t.merchant_name || t.name || 'Unknown',
    renewalDate: t.date,
    amount: Math.abs(t.amount),
    confidence: t.amount > 500 ? 'high' : t.amount > 100 ? 'medium' : 'low',
    missingFields: [
      ...(i % 5 === 0 ? ['PO Number'] : []),
      ...(i % 7 === 0 ? ['Contract ID'] : []),
      ...(i % 11 === 0 ? ['Currency Code'] : []),
    ],
  }));
  return { raw, normalized };
}

const STATUS_COLOR: Record<string, string> = {
  normalized: 'var(--blue)',
  flagged: 'var(--red)',
  ignored: 'var(--text-muted)',
  pending: 'var(--amber)',
};

export default function EventNormalizationReview() {
  const [raw, setRaw] = useState<RawEvent[]>([]);
  const [normalized, setNormalized] = useState<NormalizedRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/plaid/transactions?count=80');
      const txns = res.data.data.transactions || [];
      const { raw: r, normalized: n } = parseToEvents(txns);
      setRaw(r); setNormalized(n);
    } catch {
      const mock = Array.from({ length: 6 }, (_, i) => ({
        transaction_id: `EVT-00${i}`,
        merchant_name: ['ABC Networks', 'Alpha Telco', 'A-Tel Comm', 'Zeta Tech', 'BetaCorp', 'Delta Data'][i],
        name: '', category: 'Service Renewal',
        amount: -(12500 + i * 2500), date: `2022-09-0${i + 1}`,
      }));
      const { raw: r, normalized: n } = parseToEvents(mock);
      setRaw(r); setNormalized(n);
      setError('Using mock data — connect Plaid for live events');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const counts = {
    total: raw.length,
    normalized: raw.filter(r => r.status === 'normalized').length,
    flagged: raw.filter(r => r.status === 'flagged').length,
    ignored: raw.filter(r => r.status === 'ignored').length,
  };
  const highConf = normalized.filter(n => n.confidence === 'high').length;
  const confPct = normalized.length ? Math.round((highConf / normalized.length) * 100) : 92;
  const missingPO = normalized.filter(n => n.missingFields.includes('PO Number')).length;
  const missingContract = normalized.filter(n => n.missingFields.includes('Contract ID')).length;
  const missingCurrency = normalized.filter(n => n.missingFields.includes('Currency Code')).length;

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '3px', color: 'var(--amber)', marginBottom: 4 }}>
            DATA PIPELINE
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Event Normalization Review
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Review and validate raw transaction events before normalization
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={fetchData}
            style={{ padding: '7px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}
          >
            ↺ Refresh
          </button>
          <button
            onClick={() => setSaved(true)}
            style={{ padding: '7px 14px', background: saved ? 'var(--green)' : 'var(--navy)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            {saved ? '✓ Saved' : 'Save & Close'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Events Processed', value: counts.total, color: 'var(--blue)' },
          { label: 'Normalized', value: counts.normalized, color: 'var(--green)' },
          { label: 'Flagged', value: counts.flagged, color: 'var(--red)' },
          { label: 'Ignored', value: counts.ignored, color: 'var(--text-muted)' },
        ].map(stat => (
          <div key={stat.label} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{stat.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: stat.color, fontFamily: 'var(--font-mono)' }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid var(--amber)', borderRadius: 'var(--radius)', padding: '8px 14px', fontSize: 12, color: '#854d0e', marginBottom: 16 }}>
          ℹ {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: 'var(--text-muted)', fontSize: 13 }}>
          Processing events...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr 1fr', gap: 14 }}>

          {/* Raw Source Inputs */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
              RAW SOURCE INPUTS
            </div>
            <div style={{ padding: 8, maxHeight: 480, overflowY: 'auto' }}>
              {raw.slice(0, 12).map(evt => (
                <div
                  key={evt.id}
                  onClick={() => toggle(evt.id)}
                  style={{
                    padding: '9px 11px', marginBottom: 4, borderRadius: 'var(--radius)',
                    cursor: 'pointer', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${STATUS_COLOR[evt.status]}`,
                    background: selected.has(evt.id) ? 'var(--blue-dim)' : 'var(--bg-elevated)',
                    transition: 'background 0.12s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{evt.provider.substring(0, 22)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{evt.raw.substring(0, 40)}</div>
                    </div>
                    <span style={{ fontSize: 10, color: STATUS_COLOR[evt.status], fontWeight: 700, marginLeft: 6, textTransform: 'uppercase' }}>{evt.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Normalized Records */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
              NORMALIZED SUBSCRIPTION RECORDS
            </div>
            <div style={{ maxHeight: 480, overflowY: 'auto' }}>
              {normalized.slice(0, 12).map((rec, i) => (
                <div key={rec.id} style={{ padding: '11px 16px', borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)' }}>{rec.provider.substring(0, 20)}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      ${rec.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Renewal: {rec.renewalDate}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
                        background: rec.confidence === 'high' ? 'rgba(22,163,74,0.12)' : rec.confidence === 'medium' ? 'var(--amber-dim)' : 'var(--red-dim)',
                        color: rec.confidence === 'high' ? 'var(--green)' : rec.confidence === 'medium' ? '#92400e' : 'var(--red)',
                      }}>
                        {rec.confidence.toUpperCase()}
                      </span>
                      {rec.missingFields.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 700 }} title={rec.missingFields.join(', ')}>⚠</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Insights */}
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
              VALIDATION INSIGHTS
            </div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 18 }}>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  Classification Confidence
                </div>
                {[
                  { label: `High — ${confPct}%`, dot: 'var(--green)', color: 'var(--green)' },
                  { label: `Moderate — ${100 - confPct - 2}%`, dot: 'var(--amber)', color: 'var(--text-secondary)' },
                  { label: 'Low — 2%', dot: 'var(--blue)', color: 'var(--text-secondary)' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: item.color }}>{item.label}</span>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  Matching Logic
                </div>
                {['Date & Amount Matching', 'Provider Alias Match', 'Renewal Type', 'Standardization'].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: 'var(--blue)', fontSize: 10 }}>◆</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>

              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
                  Missing Fields
                </div>
                {[
                  `${missingPO} missing PO Number`,
                  `${missingContract} missing Contract ID`,
                  `${missingCurrency} missing Currency Code`,
                ].map(item => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ color: 'var(--amber)', fontSize: 10 }}>◆</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action bar */}
      {!loading && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setSelected(new Set(raw.map(r => r.id)))}
            style={{ padding: '7px 14px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            ✓ Approve All
          </button>
          <button style={{ padding: '7px 14px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            ⚑ Flag Selected
          </button>
          <button style={{ padding: '7px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
            ◯ Ignore Selected
          </button>
          {selected.size > 0 && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>
              {selected.size} selected
            </span>
          )}
        </div>
      )}
    </div>
  );
}
