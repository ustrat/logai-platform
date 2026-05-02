import { useState } from 'react';
import { FileSearch, RefreshCw, Zap, AlertTriangle } from 'lucide-react';
import { contractWatchApi, type ContractInput } from '../services/addonsApi';

const RISK_COLOR: Record<string, string> = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
const STATUS_BG: Record<string, string>  = {
  active: 'rgba(22,163,74,0.08)', expiring_soon: 'rgba(234,88,12,0.08)',
  expired: 'rgba(220,38,38,0.08)', in_renewal: 'rgba(29,78,216,0.08)', terminated: 'rgba(107,114,128,0.08)',
};

function emptyForm(): ContractInput {
  return { vendor: '', description: '', value: 0, currency: 'USD', startDate: new Date().toISOString().slice(0, 10), endDate: '', autoRenew: false, noticePeriodDays: 30 };
}

export default function ContractWatch() {
  const [form, setForm]           = useState<ContractInput>(emptyForm());
  const [contracts, setContracts] = useState<any[]>([]);
  const [selected, setSelected]   = useState<any>(null);
  const [loading, setLoading]     = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState('');
  const [tab, setTab]             = useState<'add' | 'watch'>('add');

  async function loadContracts() {
    try {
      const data: any = await contractWatchApi.listContracts();
      setContracts(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message); }
  }

  async function addContract() {
    if (!form.vendor || !form.endDate) { setError('Vendor and end date are required.'); return; }
    setLoading(true); setError('');
    try {
      const data: any = await contractWatchApi.monitor(form);
      setContracts(c => [data.contract, ...c]);
      setForm(emptyForm());
      setTab('watch');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      const data: any = await contractWatchApi.refresh();
      setContracts(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message); }
    finally { setRefreshing(false); }
  }

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 };
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13 };
  const lbl: React.CSSProperties  = { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: 4 };

  return (
    <div style={{ padding: 24, maxWidth: 900, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <FileSearch size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)' }}>ContractWatch™</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.5px' }}>
        CONTRACT LIFECYCLE MONITORING — ENTERPRISEPILOT™
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['add', 'watch'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'watch') loadContracts(); }}
            style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent', color: tab === t ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent', cursor: 'pointer', textTransform: 'uppercase' }}>
            {t === 'add' ? 'Add Contract' : `Monitored (${contracts.length})`}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      {tab === 'add' && (
        <div style={card}>
          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 16 }}>CONTRACT DETAILS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>VENDOR *</label>
              <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Salesforce" style={input} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>DESCRIPTION</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Enterprise CRM License — 200 seats" style={input} />
            </div>
            <div>
              <label style={lbl}>CONTRACT VALUE *</label>
              <input type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: parseFloat(e.target.value) || 0 }))} style={input} />
            </div>
            <div>
              <label style={lbl}>CURRENCY</label>
              <input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} style={input} />
            </div>
            <div>
              <label style={lbl}>START DATE</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={input} />
            </div>
            <div>
              <label style={lbl}>END DATE *</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} style={input} />
            </div>
            <div>
              <label style={lbl}>NOTICE PERIOD (DAYS)</label>
              <input type="number" value={form.noticePeriodDays} onChange={e => setForm(f => ({ ...f, noticePeriodDays: parseInt(e.target.value) || 30 }))} style={input} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="checkbox" id="autoRenew" checked={form.autoRenew} onChange={e => setForm(f => ({ ...f, autoRenew: e.target.checked }))} />
              <label htmlFor="autoRenew" style={{ fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer' }}>Auto-renews</label>
            </div>
          </div>
          <button onClick={addContract} disabled={loading}
            style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', background: loading ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}>
            <Zap size={13} /> {loading ? 'ANALYZING...' : 'MONITOR CONTRACT'}
          </button>
        </div>
      )}

      {tab === 'watch' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={refresh} disabled={refreshing}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer' }}>
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} /> REFRESH ALL
            </button>
          </div>

          {contracts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <FileSearch size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>No contracts monitored yet. Add one to start tracking.</p>
            </div>
          )}

          {contracts.map((c: any) => (
            <div key={c.id} style={{ ...card, borderLeft: `3px solid ${RISK_COLOR[c.riskLevel] ?? '#888'}`, cursor: 'pointer' }}
              onClick={() => setSelected(selected?.id === c.id ? null : c)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700 }}>{c.vendor}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.description}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, padding: '3px 8px', background: STATUS_BG[c.status] ?? 'var(--bg-elevated)', borderRadius: 12, color: RISK_COLOR[c.riskLevel] ?? '#888', fontWeight: 700, letterSpacing: '1px' }}>
                    {c.status?.replace(/_/g, ' ').toUpperCase()}
                  </span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginTop: 6 }}>${c.value?.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>EXPIRES</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 2 }}>{new Date(c.endDate).toLocaleDateString()}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>DAYS LEFT</div>
                  <div style={{ fontSize: 12, color: c.daysUntilExpiry < 30 ? '#dc2626' : 'var(--text-primary)', marginTop: 2 }}>{c.daysUntilExpiry}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '1.5px' }}>AUTO-RENEW</div>
                  <div style={{ fontSize: 12, color: c.autoRenew ? '#ea580c' : '#16a34a', marginTop: 2 }}>{c.autoRenew ? 'YES' : 'NO'}</div>
                </div>
              </div>

              {selected?.id === c.id && c.triggers?.length > 0 && (
                <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 10 }}>LIFECYCLE TRIGGERS</div>
                  {c.triggers.map((t: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                      <AlertTriangle size={13} color={t.urgency === 'immediate' ? '#dc2626' : t.urgency === 'soon' ? '#ea580c' : '#d97706'} style={{ flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>{t.description}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{t.action} · {new Date(t.triggerDate).toLocaleDateString()}</div>
                      </div>
                    </div>
                  ))}
                  {c.recommendation && (
                    <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, fontSize: 12, color: 'var(--text-primary)', fontStyle: 'italic' }}>
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>Recommendation: </span>{c.recommendation}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
