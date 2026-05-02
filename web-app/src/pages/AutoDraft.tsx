import { useState } from 'react';
import { FileText, Zap, Copy, RefreshCw } from 'lucide-react';
import { autoDraftApi, type DraftRequest, type DraftTone, type DraftType } from '../services/addonsApi';

const TONES: DraftTone[]  = ['professional', 'assertive', 'conciliatory', 'urgent', 'friendly'];
const TYPES: DraftType[]  = ['follow_up', 'commitment_reminder', 'escalation', 'acknowledgement', 'proposal'];

function label(s: string) { return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()); }

export default function AutoDraft() {
  const [form, setForm] = useState<DraftRequest>({
    type: 'follow_up', tone: 'professional', context: '',
    recipient: '', recipientRole: '', senderName: '',
    commitmentText: '', deadline: '', previousResponse: '',
  });
  const [result, setResult]     = useState<any>(null);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading]   = useState(false);
  const [refining, setRefining] = useState(false);
  const [error, setError]       = useState('');
  const [copied, setCopied]     = useState(false);
  const [tab, setTab]           = useState<'compose' | 'history'>('compose');
  const [history, setHistory]   = useState<any[]>([]);

  function update(field: keyof DraftRequest, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function generate() {
    if (!form.context || !form.recipient || !form.senderName) {
      setError('Context, recipient, and sender name are required.'); return;
    }
    setLoading(true); setError(''); setResult(null);
    try {
      const data: any = await autoDraftApi.generate(form);
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function refine() {
    if (!feedback.trim() || !result?.draft?.id) return;
    setRefining(true);
    try {
      const data: any = await autoDraftApi.refine(result.draft.id, feedback);
      setResult(data);
      setFeedback('');
    } catch (e: any) { setError(e.message); }
    finally { setRefining(false); }
  }

  async function loadHistory() {
    try {
      const data: any = await autoDraftApi.history();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message); }
  }

  function copyDraft() {
    if (!result?.draft) return;
    navigator.clipboard.writeText(`Subject: ${result.draft.subject}\n\n${result.draft.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: '#ffffff',
    border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
  };
  const lbl: React.CSSProperties = { fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px', display: 'block', marginBottom: 4 };
  const card: React.CSSProperties = { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, marginBottom: 16 };

  return (
    <div style={{ padding: 24, maxWidth: 900, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <FileText size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)' }}>AutoDraft™</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.5px' }}>
        AUTOMATED RESPONSE DRAFTING — FOLLOWUP™ / COMMITMENTIQ™
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['compose', 'history'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'history') loadHistory(); }}
            style={{ padding: '8px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '1px', background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent', color: tab === t ? '#f59e0b' : 'var(--text-muted)', border: 'none', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent', cursor: 'pointer', textTransform: 'uppercase' }}>
            {t === 'compose' ? 'Compose Draft' : 'Draft History'}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      {tab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: result ? '1fr 1fr' : '1fr', gap: 20 }}>
          {/* Form */}
          <div>
            <div style={card}>
              <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 16 }}>DRAFT PARAMETERS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>DRAFT TYPE</label>
                  <select value={form.type} onChange={e => update('type', e.target.value as DraftType)} style={{ ...input, appearance: 'none' }}>
                    {TYPES.map(t => <option key={t} value={t}>{label(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>TONE</label>
                  <select value={form.tone} onChange={e => update('tone', e.target.value as DraftTone)} style={{ ...input, appearance: 'none' }}>
                    {TONES.map(t => <option key={t} value={t}>{label(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>RECIPIENT *</label>
                  <input value={form.recipient} onChange={e => update('recipient', e.target.value)} placeholder="e.g. Sarah Johnson" style={input} />
                </div>
                <div>
                  <label style={lbl}>RECIPIENT ROLE</label>
                  <input value={form.recipientRole} onChange={e => update('recipientRole', e.target.value)} placeholder="e.g. VP of Finance" style={input} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>YOUR NAME *</label>
                  <input value={form.senderName} onChange={e => update('senderName', e.target.value)} placeholder="e.g. Alex Kim" style={input} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>CONTEXT / SITUATION *</label>
                  <textarea value={form.context} onChange={e => update('context', e.target.value)}
                    rows={3} placeholder="Describe the situation requiring this communication..."
                    style={{ ...input, resize: 'vertical' }} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={lbl}>COMMITMENT TO FOLLOW UP ON</label>
                  <input value={form.commitmentText} onChange={e => update('commitmentText', e.target.value)} placeholder="e.g. They promised to send the signed contract" style={input} />
                </div>
                <div>
                  <label style={lbl}>DEADLINE</label>
                  <input type="date" value={form.deadline} onChange={e => update('deadline', e.target.value)} style={input} />
                </div>
                <div>
                  <label style={lbl}>PREVIOUS RESPONSE</label>
                  <input value={form.previousResponse} onChange={e => update('previousResponse', e.target.value)} placeholder="e.g. No reply, or last reply text" style={input} />
                </div>
              </div>
              <button onClick={generate} disabled={loading}
                style={{ marginTop: 16, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: loading ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}>
                <Zap size={13} /> {loading ? 'DRAFTING...' : 'GENERATE DRAFT'}
              </button>
            </div>
          </div>

          {/* Result */}
          {result && (
            <div>
              <div style={{ ...card, borderLeft: '3px solid #16a34a' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, letterSpacing: '1px' }}>DRAFT READY</span>
                  <button onClick={copyDraft} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, color: copied ? '#16a34a' : 'var(--text-muted)', fontSize: 10, cursor: 'pointer' }}>
                    <Copy size={11} /> {copied ? 'COPIED!' : 'COPY'}
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>SUBJECT</div>
                <div style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 14 }}>{result.draft?.subject}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>BODY</div>
                <pre style={{ fontSize: 12, color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.7, background: 'var(--bg-elevated)', borderRadius: 6, padding: 12 }}>
                  {result.draft?.body}
                </pre>
              </div>

              {result.keyPoints?.length > 0 && (
                <div style={card}>
                  <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 10 }}>KEY POINTS</div>
                  {result.keyPoints.map((p: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: 'var(--text-primary)', padding: '4px 0', display: 'flex', gap: 8 }}>
                      <span style={{ color: '#f59e0b' }}>→</span> {p}
                    </div>
                  ))}
                </div>
              )}

              <div style={card}>
                <div style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 10 }}>REFINE DRAFT</div>
                <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
                  rows={2} placeholder="e.g. Make it shorter, add urgency, reference the $50k contract value..."
                  style={{ ...input, resize: 'vertical', marginBottom: 8 }} />
                <button onClick={refine} disabled={refining || !feedback.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: 'rgba(29,78,216,0.08)', border: '1px solid rgba(29,78,216,0.25)', borderRadius: 6, color: '#1d4ed8', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}>
                  <RefreshCw size={12} /> {refining ? 'REFINING...' : 'REFINE'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <FileText size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>No draft history yet.</p>
            </div>
          ) : history.map((d: any) => (
            <div key={d.id} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700 }}>{label(d.type)} · {label(d.tone)}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{new Date(d.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>{d.subject}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>To: {d.recipient} · Refinements: {d.refinements}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
