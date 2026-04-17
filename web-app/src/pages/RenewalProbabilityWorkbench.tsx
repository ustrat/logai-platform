import { useState, useEffect } from 'react';
import api from '../services/api';

interface WorkbenchData {
  confidence: number;
  positiveIndicators: string[];
  negativeIndicators: string[];
  providerBehavior: string[];
  priceChangeSensitivity: string[];
  usageDecline: string[];
  spendImpact: string[];
}

function buildWorkbench(txn: any): WorkbenchData {
  const amount = Math.abs(txn?.amount || 50000);
  const conf = Math.min(95, Math.max(20, Math.round(50 + (amount / 2000))));
  return {
    confidence: conf,
    positiveIndicators: ['Strong Retention History', 'High Engagement'],
    negativeIndicators: ['Recent Service Complaints', 'Competitive Offers'],
    providerBehavior: ['Prior Concessions Given', 'Policy Changes'],
    priceChangeSensitivity: ['Reactive to Rate Increases', 'Discount Dependent'],
    usageDecline: ['Decreased Utilization', 'Feature Underuse'],
    spendImpact: ['Cost Increase Risk', 'Value vs. Expense'],
  };
}

const STRATEGIES = [
  { key: 'cancel',      label: 'Cancel',                color: '#6b7280', bestFit: 'High churn risk',   confidence: 'Moderate', cycleTime: 'Immediate',    evidence: 'Contract terms',     notes: 'High costs' },
  { key: 'downgrade',   label: 'Downgrade Plan',        color: 'var(--blue-light)', bestFit: 'Overpaying client',  confidence: 'Moderate', cycleTime: '1-2 Weeks',    evidence: 'Usage data',         notes: 'Budget limits' },
  { key: 'pause',       label: 'Pause Service',         color: '#8b5cf6', bestFit: 'Seasonal needs',    confidence: 'Low',      cycleTime: '1-3 Weeks',    evidence: 'Special requests',   notes: 'Temporary' },
  { key: 'renegotiate', label: 'Renegotiate Price',     color: 'var(--blue)', bestFit: 'Price concerns',    confidence: 'High',     cycleTime: '2-3 Weeks',    evidence: 'Benchmark data',     notes: 'Open to deal', highlight: true },
  { key: 'continue',    label: 'Continue',              color: 'var(--green)', bestFit: 'Satisfied client',  confidence: 'High',     cycleTime: 'Ongoing',      evidence: 'Positive feedback',  notes: 'Stable usage' },
  { key: 'escalate',    label: 'Escalation',            color: 'var(--red)', bestFit: 'Critical issues',   confidence: 'Low',      cycleTime: 'Escalate Fast', evidence: 'Complaints filed',  notes: 'Requires attention' },
];

const RENEGOTIATE_STEPS = {
  initial:     ['Review current pricing', 'Analyze competitor benchmarks', "Identify client's budget constraints"],
  negotiation: ['Propose discount options', 'Offer value-added services', 'Discuss contract adjustments', 'Present ROI analysis'],
  approval:    ['Gain internal approvals', 'Finalize new agreement', 'Confirm client acceptance', 'Set follow-up reminders'],
};

const INDICATORS = [
  { label: 'Positive Indicators',       key: 'positiveIndicators',       dotColor: 'var(--green)',  textColor: 'var(--green)' },
  { label: 'Negative Indicators',       key: 'negativeIndicators',       dotColor: 'var(--red)',    textColor: 'var(--red)' },
  { label: 'Provider Behavior History', key: 'providerBehavior',         dotColor: 'var(--text-muted)', textColor: 'var(--text-muted)' },
  { label: 'Price Change Sensitivity',  key: 'priceChangeSensitivity',   dotColor: 'var(--amber)',  textColor: 'var(--text-muted)' },
  { label: 'Usage Decline',             key: 'usageDecline',             dotColor: 'var(--blue)',   textColor: 'var(--text-muted)' },
  { label: 'Spend Impact',              key: 'spendImpact',              dotColor: '#8b5cf6',       textColor: 'var(--text-muted)' },
] as const;

export default function RenewalProbabilityWorkbench() {
  const [data, setData] = useState<WorkbenchData>(buildWorkbench(null));
  const [activeStrategy, setActiveStrategy] = useState('renegotiate');

  useEffect(() => {
    api.get('/plaid/transactions?count=5').then(res => {
      const txns = res.data.data.transactions || [];
      if (txns.length > 0) setData(buildWorkbench(txns[0]));
    }).catch(() => {});
  }, []);

  const conf = data.confidence;
  const needleDeg = 180 - (conf / 100) * 180;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const activeStrat = STRATEGIES.find(s => s.key === activeStrategy) || STRATEGIES[3];

  const gaugeColor = conf >= 80 ? 'var(--green)' : conf >= 60 ? 'var(--amber)' : conf >= 40 ? '#f97316' : 'var(--red)';

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '3px', color: 'var(--amber)', marginBottom: 4 }}>
            ML ANALYTICS
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Renewal Probability Workbench
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            AI-powered renewal probability assessment and strategy recommendation
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, marginBottom: 14 }}>

        {/* Gauge card */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: 16, fontWeight: 600 }}>CONFIDENCE LEVEL</div>
          <svg viewBox="0 0 300 170" style={{ width: '100%', maxWidth: 260, height: 'auto' }}>
            {[
              { color: '#dc2626', startDeg: 180, endDeg: 144, label: 'Low' },
              { color: '#f97316', startDeg: 144, endDeg: 108, label: 'Moderate' },
              { color: '#f59e0b', startDeg: 108, endDeg: 72,  label: 'Caution' },
              { color: '#84cc16', startDeg: 72,  endDeg: 36,  label: 'Likely' },
              { color: '#16a34a', startDeg: 36,  endDeg: 0,   label: 'High' },
            ].map(seg => {
              const r = 110, cx = 150, cy = 150;
              const x1 = cx + r * Math.cos(toRad(seg.startDeg));
              const y1 = cy + r * Math.sin(toRad(seg.startDeg));
              const x2 = cx + r * Math.cos(toRad(seg.endDeg));
              const y2 = cy + r * Math.sin(toRad(seg.endDeg));
              const mid = (seg.startDeg + seg.endDeg) / 2;
              return (
                <g key={seg.label}>
                  <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 0 ${x2} ${y2} Z`} fill={seg.color} opacity="0.9" />
                  <text x={cx + (r + 16) * Math.cos(toRad(mid))} y={cy + (r + 16) * Math.sin(toRad(mid))} textAnchor="middle" fontSize="8" fontWeight="700" fill="#fff">{seg.label}</text>
                </g>
              );
            })}
            <circle cx="150" cy="150" r="55" fill="var(--bg-base)" />
            <line x1="150" y1="150" x2={150 + 90 * Math.cos(toRad(needleDeg))} y2={150 + 90 * Math.sin(toRad(needleDeg))} stroke="var(--navy)" strokeWidth="3" strokeLinecap="round" />
            <circle cx="150" cy="145" r="8" fill="var(--navy)" />
            <circle cx="150" cy="145" r="4" fill="#fff" />
            <rect x="0" y="152" width="300" height="20" fill="var(--bg-base)" />
          </svg>
          <div style={{ fontSize: 28, fontWeight: 800, color: gaugeColor, fontFamily: 'var(--font-mono)', marginTop: 8 }}>{conf}%</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>Renewal Probability</div>
        </div>

        {/* Indicators table */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            SIGNAL INDICATORS
          </div>
          {INDICATORS.map((row, i) => (
            <div key={row.label} style={{ display: 'flex', padding: '10px 16px', borderBottom: i < INDICATORS.length - 1 ? '1px solid var(--border)' : 'none', gap: 16, alignItems: 'flex-start', background: i % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-elevated)' }}>
              <div style={{ width: 180, fontSize: 12, fontWeight: 700, color: row.textColor, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: row.dotColor, flexShrink: 0 }} />
                {row.label}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(data[row.key] as string[]).map(item => (
                  <span key={item} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Strategy Selector */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
          STRATEGY OPTIONS
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', borderBottom: '1px solid var(--border)' }}>
          {STRATEGIES.map(s => (
            <div
              key={s.key}
              onClick={() => setActiveStrategy(s.key)}
              style={{
                padding: '12px 10px', cursor: 'pointer',
                borderRight: '1px solid var(--border)',
                borderTop: `3px solid ${activeStrategy === s.key ? s.color : 'transparent'}`,
                background: activeStrategy === s.key ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: activeStrategy === s.key && s.highlight ? s.color : 'var(--text-primary)', marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Fit:</span> {s.bestFit}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Conf:</span> {s.confidence}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}><span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Time:</span> {s.cycleTime}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: activeStrat.color, marginBottom: 14, textAlign: 'center' }}>
            {activeStrat.label} Strategy
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
            {[
              { title: 'Initial Assessment', items: RENEGOTIATE_STEPS.initial },
              { title: 'Negotiation Steps',  items: RENEGOTIATE_STEPS.negotiation },
              { title: 'Approval & Follow-Up', items: RENEGOTIATE_STEPS.approval },
            ].map(col => (
              <div key={col.title}>
                <div style={{ color: '#fff', background: 'var(--navy)', padding: '7px 12px', borderRadius: '4px 4px 0 0', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: '0.5px' }}>
                  {col.title}
                </div>
                {col.items.map(item => (
                  <div key={item} style={{ display: 'flex', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5, alignItems: 'flex-start' }}>
                    <span style={{ color: 'var(--green)', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 12, borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', alignItems: 'center' }}>
            <span>Cycle Time: <strong>{activeStrat.cycleTime}</strong></span>
            <span>Confidence: <strong>{activeStrat.confidence}</strong></span>
            <span>Evidence: <strong>{activeStrat.evidence}</strong></span>
            <span>Notes: <strong>{activeStrat.notes}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
