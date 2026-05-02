import { useState } from 'react';
import { Siren, Zap, ChevronUp, CheckCircle, Copy, MessageSquare } from 'lucide-react';
import { escalateAIApi, type EscalationInput, type EscalationType, type EscalationOutcome } from '../services/addonsApi';

const TYPES: EscalationType[] = ['refund_dispute', 'renewal_dispute', 'billing_error', 'service_failure', 'contract_breach'];
const OUTCOMES: EscalationOutcome[] = ['full_refund', 'partial_refund', 'credit', 'contract_amendment', 'renewal_waiver', 'no_resolution'];
const TIER_LABELS = ['', 'Tier 1 — Support', 'Tier 2 — Manager', 'Tier 3 — Leadership', 'Executive'];
const TIER_COLORS = ['', '#1d4ed8', '#ea580c', '#dc2626', '#7c3aed'];

const STATUS_COLOR: Record<string, string> = {
  open: '#6b7280', tier_1: '#1d4ed8', tier_2: '#ea580c',
  tier_3: '#dc2626', executive: '#7c3aed', resolved: '#16a34a', withdrawn: '#6b7280',
};

function label(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

export default function EscalateAI() {
  const [form, setForm] = useState<EscalationInput>({ type: 'refund_dispute', vendor: '', description: '', amountAtStake: 0, currency: 'USD', triggeredBy: 'manual' });
  const [escalations, setEscalations] = useState<any[]>([]);
  const [selected, setSelected]       = useState<any>(null);
  const [loading, setLoading]         = useState(false);
  const [drafting, setDrafting]       = useState(false);
  const [advanceNote, setAdvanceNote] = useState('');
  const [resolveOutcome, setResolveOutcome] = useState<EscalationOutcome>('full_refund');
  const [resolveNote, setResolveNote] = useState('');
  const [error, setError]             = useState('');
  const [tab, setTab]                 = useState<'new' | 'active'>('new');
  const [copied, setCopied]           = useState(false);

  async function loadEscalations() {
    try {
      const data: any = await escalateAIApi.listEscalations();
      setEscalations(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message); }
  }

  async function initiate() {
    if (!form.vendor || !form.description || !form.amountAtStake) { setError('Vendor, description, and amount are required.'); return; }
    setLoading(true); setError('');
    try {
      const data: any = await escalateAIApi.initiate(form);
      setEscalations(e => [data.escalation, ...e]);
      setSelected(data.escalation);
      setTab('active');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function advance(id: string) {
    try {
      const data: any = await escalateAIApi.advance(id, advanceNote);
      setEscalations(e => e.map(x => x.id === id ? data : x));
      setSelected(data);
      setAdvanceNote('');
    } catch (e: any) { setError(e.message); }
  }

  async function generateDraft(id: string) {
    setDrafting(true);
    try {
      const data: any = await escalateAIApi.draft(id);
      setEscalations(e => e.map(x => x.id === id ? { ...x, drafts: [...(x.drafts ?? []), data.draft] } : x));
      setSelected((s: any) => s?.id === id ? { ...s, drafts: [...(s.drafts ?? []), data.draft] } : s);
    } catch (e: any) { setError(e.message); }
    finally { setDrafting(false); }
  }

  async function resolve(id: string) {
    try {
      const data: any = await escalateAIApi.resolve(id, resolveOutcome, resolveNote);
      setEscalations(e => e.map(x => x.id === id ? data : x));
      setSelected(data);
    } catch (e: any) { setError(e.message); }
  }

  function copyDraft(draft: any) {
    navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 };
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', background: '#ffffff', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13 };
  const lbl: React.CSSProperties  = { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: 4 };

  return (
    <div style={{ padding: 24, maxWidth: 960, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Siren size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)' }}>EscalateAI™</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.5px' }}>
        STRUCTURED ESCALATION WORKFLOWS — REFUNDPILOT™ / REFUNDIQ™ / RENEWALGUARD™
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['new', 'active'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'active') loadEscalations(); }}
            style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent', color: tab === t ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent', cursor: 'pointer', textTransform: 'uppercase' }}>
            {t === 'new' ? 'Initiate Escalation' : `Active (${escalations.length})`}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      {tab === 'new' && (
        <div style={card}>
          <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 16 }}>ESCALATION INTAKE</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>ESCALATION TYPE</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as EscalationType }))} style={{ ...input, appearance: 'none' }}>
                {TYPES.map(t => <option key={t} value={t}>{label(t)}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>TRIGGERED BY</label>
              <select value={form.triggeredBy} onChange={e => setForm(f => ({ ...f, triggeredBy: e.target.value as any }))} style={{ ...input, appearance: 'none' }}>
                <option value="manual">Manual</option>
                <option value="refundpilot">RefundPilot™</option>
                <option value="renewalguard">RenewalGuard™</option>
              </select>
            </div>
            <div>
              <label style={lbl}>VENDOR *</label>
              <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. Adobe Inc." style={input} />
            </div>
            <div>
              <label style={lbl}>AMOUNT AT STAKE *</label>
              <input type="number" value={form.amountAtStake || ''} onChange={e => setForm(f => ({ ...f, amountAtStake: parseFloat(e.target.value) || 0 }))} placeholder="0.00" style={input} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>DESCRIPTION *</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3} placeholder="Describe the dispute or issue in detail..."
                style={{ ...input, resize: 'vertical' }} />
            </div>
          </div>
          <button onClick={initiate} disabled={loading}
            style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 24px', background: loading ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}>
            <Zap size={13} /> {loading ? 'INITIATING...' : 'LAUNCH ESCALATION'}
          </button>
        </div>
      )}

      {tab === 'active' && (
        <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 1fr' : '1fr', gap: 20 }}>
          {/* List */}
          <div>
            {escalations.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                <Siren size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <p style={{ fontSize: 13 }}>No escalations yet. Initiate one to get started.</p>
              </div>
            )}
            {escalations.map((e: any) => (
              <div key={e.id} onClick={() => setSelected(selected?.id === e.id ? null : e)}
                style={{ ...card, cursor: 'pointer', borderLeft: `3px solid ${STATUS_COLOR[e.status] ?? '#888'}`, background: selected?.id === e.id ? 'rgba(245,158,11,0.04)' : 'var(--bg-surface)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: 10, color: STATUS_COLOR[e.status], fontWeight: 700, letterSpacing: '1px' }}>{e.status?.replace(/_/g, ' ').toUpperCase()}</span>
                    <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 700, marginTop: 4 }}>{e.vendor}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label(e.type)}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>${e.amountAtStake?.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{e.currency}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
                  {[1, 2, 3, 4].map(tier => (
                    <div key={tier} style={{ flex: 1, height: 4, borderRadius: 2, background: e.currentTier >= tier ? TIER_COLORS[tier] : 'var(--bg-elevated)' }} />
                  ))}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 4 }}>
                    {TIER_LABELS[e.currentTier] ?? 'Tier ' + e.currentTier}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail panel */}
          {selected && (
            <div>
              <div style={card}>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 12 }}>ESCALATION ACTIONS</div>

                {selected.status !== 'resolved' && selected.status !== 'executive' && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: 4 }}>ADVANCE NOTE</label>
                    <input value={advanceNote} onChange={e => setAdvanceNote(e.target.value)} placeholder="Reason for advancing to next tier..." style={input} />
                    <button onClick={() => advance(selected.id)}
                      style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.25)', borderRadius: 6, color: '#ea580c', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                      <ChevronUp size={12} /> ADVANCE TIER
                    </button>
                  </div>
                )}

                <button onClick={() => generateDraft(selected.id)} disabled={drafting}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.25)', borderRadius: 6, color: '#1d4ed8', fontSize: 11, cursor: 'pointer', fontWeight: 700, marginBottom: 16 }}>
                  <MessageSquare size={12} /> {drafting ? 'DRAFTING...' : 'GENERATE DRAFT'}
                </button>

                {selected.status !== 'resolved' && (
                  <div>
                    <div style={{ fontSize: 10, color: '#16a34a', fontWeight: 700, letterSpacing: '1px', marginBottom: 8 }}>RESOLVE ESCALATION</div>
                    <select value={resolveOutcome} onChange={e => setResolveOutcome(e.target.value as EscalationOutcome)} style={{ ...input, marginBottom: 8 }}>
                      {OUTCOMES.map(o => <option key={o} value={o}>{label(o)}</option>)}
                    </select>
                    <input value={resolveNote} onChange={e => setResolveNote(e.target.value)} placeholder="Resolution notes..." style={{ ...input, marginBottom: 8 }} />
                    <button onClick={() => resolve(selected.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 6, color: '#16a34a', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                      <CheckCircle size={12} /> RESOLVE
                    </button>
                  </div>
                )}
              </div>

              {/* Latest draft */}
              {selected.drafts?.length > 0 && (
                <div style={{ ...card, borderLeft: '3px solid #1d4ed8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, color: '#1d4ed8', fontWeight: 700, letterSpacing: '1px' }}>
                      LATEST DRAFT — {TIER_LABELS[selected.drafts[selected.drafts.length - 1]?.tier] ?? 'Draft'}
                    </span>
                    <button onClick={() => copyDraft(selected.drafts[selected.drafts.length - 1])}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, color: copied ? '#16a34a' : 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}>
                      <Copy size={10} /> {copied ? 'COPIED' : 'COPY'}
                    </button>
                  </div>
                  {(() => {
                    const d = selected.drafts[selected.drafts.length - 1];
                    return (
                      <>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>TO: {d.recipient}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 10 }}>{d.subject}</div>
                        <pre style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, background: 'var(--bg-elevated)', borderRadius: 6, padding: 12 }}>{d.body}</pre>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* History timeline */}
              <div style={card}>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 12 }}>ESCALATION HISTORY</div>
                {selected.history?.map((h: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[h.toStatus] ?? '#888', flexShrink: 0, marginTop: 4 }} />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>{h.fromStatus?.replace(/_/g, ' ')} → {h.toStatus?.replace(/_/g, ' ')}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{h.note}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{new Date(h.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
