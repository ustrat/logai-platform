import { useState, useEffect } from 'react';
import api from '../services/api';

const STRATEGIES = [
  {
    key: 'cancel', label: 'Cancel Before Billing', color: '#6b7280',
    bestFit: 'High churn risk', confidence: 'Moderate', cycleTime: 'Immediate',
    evidence: 'Contract terms', notes: 'High costs cited',
    steps: {
      initial:   ['Identify churn signals', 'Review contract terms', 'Calculate cancellation cost'],
      execution: ['Send cancellation notice', 'Process final billing', 'Archive account data'],
      followup:  ['Document outcome', 'Update CRM', 'Analyze churn reason'],
    },
    details: { cycleTime: 'Immediate', confidence: 'Moderate', keyEvidence: 'Contract Terms, Usage Data', providerNotes: 'High costs cited' },
  },
  {
    key: 'downgrade', label: 'Downgrade Plan', color: 'var(--blue-light)',
    bestFit: 'Overpaying client', confidence: 'Moderate', cycleTime: '1-2 Weeks',
    evidence: 'Usage data', notes: 'Budget limits confirmed',
    steps: {
      initial:   ['Review current plan usage', 'Identify suitable lower tier', 'Prepare cost comparison'],
      execution: ['Present downgrade options', 'Negotiate service cutbacks', 'Process plan change'],
      followup:  ['Confirm client satisfaction', 'Monitor usage patterns', 'Set review reminder'],
    },
    details: { cycleTime: '1-2 Weeks', confidence: 'Moderate', keyEvidence: 'Usage Data, Budget Reports', providerNotes: 'Budget limits confirmed' },
  },
  {
    key: 'pause', label: 'Pause Service', color: '#8b5cf6',
    bestFit: 'Seasonal needs', confidence: 'Low', cycleTime: '1-3 Weeks',
    evidence: 'Special requests', notes: 'Temporary arrangement',
    steps: {
      initial:   ['Confirm pause eligibility', 'Define pause duration', 'Document special requests'],
      execution: ['Process service suspension', 'Notify relevant teams', 'Set resumption date'],
      followup:  ['Monitor pause period', 'Send resumption reminder', 'Confirm reactivation'],
    },
    details: { cycleTime: '1-3 Weeks', confidence: 'Low', keyEvidence: 'Special Requests, Seasonal Data', providerNotes: 'Temporary arrangement' },
  },
  {
    key: 'renegotiate', label: 'Renegotiate Price', color: 'var(--blue)',
    bestFit: 'Price concerns', confidence: 'High', cycleTime: '2-3 Weeks',
    evidence: 'Benchmark data', notes: 'Client open to deal', highlight: true,
    steps: {
      initial:   ['Review current pricing', 'Analyze competitor benchmarks', "Identify client's budget constraints"],
      execution: ['Propose discount options', 'Offer value-added services', 'Discuss contract adjustments', 'Present ROI analysis'],
      followup:  ['Gain internal approvals', 'Finalize new agreement', 'Confirm client acceptance', 'Set follow-up reminders'],
    },
    details: { cycleTime: '2-3 Weeks', confidence: 'High', keyEvidence: 'Benchmark Data, Client Surveys', providerNotes: 'Client open to deal' },
  },
  {
    key: 'continue', label: 'Continue Subscription', color: 'var(--green)',
    bestFit: 'Satisfied client', confidence: 'High', cycleTime: 'Ongoing',
    evidence: 'Positive feedback', notes: 'Stable usage confirmed',
    steps: {
      initial:   ['Confirm client satisfaction', 'Review renewal terms', 'Prepare renewal package'],
      execution: ['Present renewal offer', 'Confirm loyalty benefits', 'Process renewal'],
      followup:  ['Send confirmation', 'Update contract dates', 'Schedule next review'],
    },
    details: { cycleTime: 'Ongoing', confidence: 'High', keyEvidence: 'Positive Feedback, Usage Reports', providerNotes: 'Stable usage confirmed' },
  },
  {
    key: 'escalate', label: 'Escalation', color: 'var(--red)',
    bestFit: 'Critical issues', confidence: 'Low', cycleTime: 'Escalate Fast',
    evidence: 'Complaints filed', notes: 'Requires immediate attention',
    steps: {
      initial:   ['Document critical issues', 'Identify escalation path', 'Gather complaint evidence'],
      execution: ['Escalate to senior team', 'Initiate intensive support', 'Apply emergency measures'],
      followup:  ['Track resolution progress', 'Report to management', 'Document lessons learned'],
    },
    details: { cycleTime: 'Escalate Fast', confidence: 'Low', keyEvidence: 'Complaints Filed, Incident Reports', providerNotes: 'Requires immediate attention' },
  },
];

const STEP_LABELS = ['Initial Assessment', 'Execution Steps', 'Follow-Up'];
const STEP_KEYS = ['initial', 'execution', 'followup'] as const;

export default function StrategySelector() {
  const [active, setActive] = useState('renegotiate');
  const [clientName, setClientName] = useState('');

  useEffect(() => {
    api.get('/plaid/transactions?count=3').then(res => {
      const txns = res.data.data.transactions || [];
      if (txns.length > 0) setClientName(txns[0].merchant_name || txns[0].name || '');
    }).catch(() => {});
  }, []);

  const strat = STRATEGIES.find(s => s.key === active) || STRATEGIES[3];

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '3px', color: 'var(--amber)', marginBottom: 4 }}>
            RENEWAL MANAGEMENT
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Strategy Selector
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            {clientName ? `Strategies for ${clientName}` : 'Select and configure a renewal strategy'}
          </p>
        </div>
      </div>

      {/* Strategy Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 16 }}>
        {STRATEGIES.map(s => (
          <div
            key={s.key}
            onClick={() => setActive(s.key)}
            style={{
              padding: '14px 12px', borderRadius: 'var(--radius-lg)', cursor: 'pointer',
              border: '1px solid var(--border)',
              borderTop: `4px solid ${s.color}`,
              background: active === s.key ? 'var(--bg-elevated)' : 'var(--bg-surface)',
              boxShadow: active === s.key ? 'var(--shadow-md)' : 'var(--shadow-sm)',
              transition: 'all 0.15s',
              outline: active === s.key ? `2px solid ${s.color}` : 'none',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: active === s.key && s.highlight ? s.color : 'var(--text-primary)', marginBottom: 8 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Best Fit:</span> {s.bestFit}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Confidence:</span> {s.confidence}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Cycle:</span> {s.cycleTime}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Evidence:</span> {s.evidence}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Panel */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderTop: `4px solid ${strat.color}`, borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: strat.color }}>{strat.label} Strategy</div>
          <div style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
            <span style={{ padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              Cycle: <strong style={{ color: 'var(--text-primary)' }}>{strat.details.cycleTime}</strong>
            </span>
            <span style={{ padding: '3px 10px', background: 'var(--bg-elevated)', borderRadius: 10, border: '1px solid var(--border)' }}>
              Confidence: <strong style={{ color: 'var(--text-primary)' }}>{strat.details.confidence}</strong>
            </span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0 }}>
          {STEP_KEYS.map((key, i) => (
            <div key={key} style={{ padding: '16px 18px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '1px', color: '#fff', background: i === 2 ? 'var(--green)' : 'var(--navy)', padding: '7px 12px', borderRadius: 'var(--radius)', marginBottom: 12 }}>
                {STEP_LABELS[i]}
              </div>
              {(strat.steps[key] as string[]).map(item => (
                <div key={item} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6, alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-secondary)', alignItems: 'center' }}>
          <span>Key Evidence: <strong style={{ color: 'var(--text-primary)' }}>{strat.details.keyEvidence}</strong></span>
          <span>Provider Notes: <strong style={{ color: 'var(--text-primary)' }}>{strat.details.providerNotes}</strong></span>
        </div>
      </div>
    </div>
  );
}
