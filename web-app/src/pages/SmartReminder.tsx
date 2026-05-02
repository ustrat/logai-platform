import { useState } from 'react';
import { Bell, Plus, X, Clock, Zap, CheckCircle } from 'lucide-react';
import { smartReminderApi, type Commitment } from '../services/addonsApi';

const PRIORITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#d97706',
  low:      '#16a34a',
};

const STATUS_COLOR: Record<string, string> = {
  active:    '#1d4ed8',
  snoozed:   '#7c3aed',
  dismissed: '#6b7280',
  completed: '#16a34a',
};

export default function SmartReminder() {
  const [commitments, setCommitments] = useState<Commitment[]>([{ text: '', counterparty: '', dueDate: '', context: '' }]);
  const [reminders, setReminders]     = useState<any[]>([]);
  const [insight, setInsight]         = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [tab, setTab]                 = useState<'analyze' | 'reminders'>('analyze');

  function addCommitment() {
    setCommitments(c => [...c, { text: '', counterparty: '', dueDate: '', context: '' }]);
  }

  function removeCommitment(i: number) {
    setCommitments(c => c.filter((_, idx) => idx !== i));
  }

  function updateCommitment(i: number, field: keyof Commitment, value: string) {
    setCommitments(c => c.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  async function analyze() {
    const valid = commitments.filter(c => c.text.trim() && c.counterparty.trim());
    if (!valid.length) { setError('Add at least one commitment with text and counterparty.'); return; }
    setLoading(true); setError('');
    try {
      const result: any = await smartReminderApi.analyze(valid);
      setReminders(result.schedules ?? []);
      setInsight(result.overallInsight ?? '');
      setTab('reminders');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadReminders() {
    try {
      const data: any = await smartReminderApi.listReminders();
      setReminders(Array.isArray(data) ? data : []);
    } catch (e: any) { setError(e.message); }
  }

  async function dismiss(id: string) {
    await smartReminderApi.dismiss(id);
    setReminders(r => r.map(x => x.id === id ? { ...x, status: 'dismissed' } : x));
  }

  async function snooze(id: string) {
    const until = new Date(Date.now() + 86_400_000).toISOString();
    await smartReminderApi.snooze(id, until);
    setReminders(r => r.map(x => x.id === id ? { ...x, status: 'snoozed', snoozeUntil: until } : x));
  }

  const card: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 8, padding: 20, marginBottom: 16,
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', marginTop: 4, padding: '8px 10px',
    background: '#ffffff', border: '1px solid var(--border)',
    borderRadius: 6, color: 'var(--text-primary)', fontSize: 13,
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Bell size={20} color="#f59e0b" />
        <h1 style={{ fontSize: 20, fontWeight: 800, letterSpacing: '1px', color: 'var(--text-primary)' }}>SmartReminder™</h1>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24, letterSpacing: '0.5px' }}>
        AI-PRIORITIZED REMINDER CALIBRATION — FOLLOWUP™ / COMMITMENTIQ™
      </p>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {(['analyze', 'reminders'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'reminders') loadReminders(); }}
            style={{
              padding: '8px 16px', fontSize: 11, fontWeight: 700, letterSpacing: '1px',
              background: tab === t ? 'rgba(245,158,11,0.12)' : 'transparent',
              color: tab === t ? '#f59e0b' : 'var(--text-muted)',
              border: 'none', borderBottom: tab === t ? '2px solid #f59e0b' : '2px solid transparent',
              cursor: 'pointer', textTransform: 'uppercase',
            }}>
            {t === 'analyze' ? 'Analyze Commitments' : `Active Reminders (${reminders.length})`}
          </button>
        ))}
      </div>

      {error && <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid #dc2626', borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#dc2626' }}>{error}</div>}

      {tab === 'analyze' && (
        <>
          {commitments.map((c, i) => (
            <div key={i} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px' }}>COMMITMENT #{i + 1}</span>
                {commitments.length > 1 && (
                  <button onClick={() => removeCommitment(i)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px' }}>COMMITMENT TEXT *</label>
                  <input value={c.text} onChange={e => updateCommitment(i, 'text', e.target.value)}
                    placeholder="e.g. John will send the revised proposal by Friday"
                    style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px' }}>COUNTERPARTY *</label>
                  <input value={c.counterparty} onChange={e => updateCommitment(i, 'counterparty', e.target.value)}
                    placeholder="e.g. John Smith, Acme Corp"
                    style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px' }}>DUE DATE</label>
                  <input type="date" value={c.dueDate} onChange={e => updateCommitment(i, 'dueDate', e.target.value)}
                    style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '1px' }}>CONTEXT</label>
                  <input value={c.context} onChange={e => updateCommitment(i, 'context', e.target.value)}
                    placeholder="e.g. From contract negotiation email, $45k deal"
                    style={inputStyle} />
                </div>
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
            <button onClick={addCommitment}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>
              <Plus size={13} /> Add Commitment
            </button>
            <button onClick={analyze} disabled={loading}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px', background: loading ? 'rgba(245,158,11,0.3)' : '#f59e0b', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '1px' }}>
              <Zap size={13} /> {loading ? 'CALIBRATING...' : 'GENERATE SCHEDULE'}
            </button>
          </div>
        </>
      )}

      {tab === 'reminders' && (
        <>
          {insight && (
            <div style={{ ...card, borderLeft: '3px solid #f59e0b', marginBottom: 20 }}>
              <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700, letterSpacing: '1px', marginBottom: 6 }}>AI INSIGHT</div>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{insight}</p>
            </div>
          )}

          {reminders.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <Bell size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <p style={{ fontSize: 13 }}>No reminders yet. Analyze commitments to generate schedules.</p>
            </div>
          )}

          {reminders.map((r: any) => (
            <div key={r.id} style={{ ...card, borderLeft: `3px solid ${PRIORITY_COLOR[r.priority] ?? '#888'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: PRIORITY_COLOR[r.priority], letterSpacing: '1px', marginRight: 8 }}>
                    {r.priority?.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 10, color: STATUS_COLOR[r.status] ?? '#888', letterSpacing: '1px' }}>
                    {r.status?.toUpperCase()}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => snooze(r.id)} title="Snooze 24h"
                    style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 5, padding: '4px 8px', color: '#7c3aed', cursor: 'pointer', fontSize: 10 }}>
                    SNOOZE
                  </button>
                  <button onClick={() => dismiss(r.id)}
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 5, padding: '4px 8px', color: '#6b7280', cursor: 'pointer', fontSize: 10 }}>
                    DISMISS
                  </button>
                </div>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 6 }}>{r.commitment}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>→ {r.counterparty}</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  <Clock size={10} style={{ marginRight: 4 }} />
                  Next: <span style={{ color: 'var(--text-primary)' }}>{new Date(r.nextReminderAt).toLocaleDateString()}</span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Channel: <span style={{ color: 'var(--text-primary)' }}>{r.channel}</span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>Cadence: {r.cadence}</div>
              {r.suggestedMessage && (
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: 'var(--text-secondary)', fontStyle: 'italic', borderLeft: '2px solid var(--border)' }}>
                  "{r.suggestedMessage}"
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
