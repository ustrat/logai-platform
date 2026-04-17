import { useState, useEffect } from 'react';
import api from '../services/api';

interface PolicyRule {
  label: string;
  met: boolean;
  detail: string;
}

interface CaseData {
  caseId: string;
  provider: string;
  riskType: string;
  projectedCharge: number;
  eventDate: string;
  policyWindow: string;
  plan: string;
  memberSince: string;
  age: number;
  diagnosis: string;
  payments: string;
  lastRenewal: string;
  claims: number;
  doctorVisits: string;
  eligibilityStatus: 'ELIGIBLE' | 'NOT ELIGIBLE' | 'PENDING REVIEW';
  missingEvidence: string[];
  confidenceRationale: string;
  rules: PolicyRule[];
}

function buildCase(txn: any, index: number): CaseData {
  const amount = Math.abs(txn.amount || 8000);
  const age = 40 + (index % 30);
  const rules: PolicyRule[] = [
    { label: 'Continuous Coverage ≥ 3 Years', met: true, detail: '6 Years of Coverage' },
    { label: 'No Lapse in Payment', met: true, detail: 'All Payments On-Time' },
    { label: 'Current Diagnosis Covered?', met: true, detail: 'Treatment Eligible' },
    { label: 'Age Under 60', met: age < 60, detail: age < 60 ? `Age is ${age}` : `Failed: Age is ${age}` },
    { label: 'Recent High-Cost Claim', met: amount < 10000, detail: amount < 10000 ? 'No Claims Over $10k' : `High claim: $${amount.toLocaleString()}` },
    { label: 'Specialist Consultation Requirement', met: index % 3 !== 0, detail: index % 3 !== 0 ? 'Specialist Visit Confirmed' : 'No specialist on record' },
  ];
  const allMet = rules.every(r => r.met);
  return {
    caseId: txn.transaction_id?.substring(0, 12) || `ABC${123456780 + index}`,
    provider: txn.merchant_name || txn.name || 'HealthSecure',
    riskType: txn.category?.replace(/_/g, ' ') || 'Cancer',
    projectedCharge: amount,
    eventDate: txn.date || '08/15/2024',
    policyWindow: 'Within Eligibility Period',
    plan: 'Premium Health',
    memberSince: '05/12/2018',
    age,
    diagnosis: 'Lung Cancer (Stage II)',
    payments: 'On-Time',
    lastRenewal: '08/01/2023',
    claims: 3,
    doctorVisits: 'Frequent Specialist Visits',
    eligibilityStatus: allMet ? 'ELIGIBLE' : age >= 60 ? 'NOT ELIGIBLE' : 'PENDING REVIEW',
    missingEvidence: [`Member Age: ${age}`],
    confidenceRationale: allMet
      ? 'All criteria met. Eligible for renewal.'
      : `Age exceeds policy limit for renewal approval. Other criteria met.`,
    rules,
  };
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  'ELIGIBLE':       { bg: 'rgba(22,163,74,0.1)',  color: 'var(--green)', border: 'var(--green)' },
  'NOT ELIGIBLE':   { bg: 'var(--red-dim)',        color: 'var(--red)',   border: 'var(--red)' },
  'PENDING REVIEW': { bg: 'var(--amber-dim)',      color: '#92400e',      border: 'var(--amber)' },
};

export default function RenewalEligibilityReview() {
  const [cases, setCases] = useState<CaseData[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/plaid/transactions?count=20');
      const txns = res.data.data.transactions || [];
      setCases(txns.map(buildCase));
    } catch {
      setCases([buildCase({ transaction_id: 'ABC123456789', merchant_name: 'HealthSecure', category: 'MEDICAL', amount: -8000, date: '08/15/2024' }, 0)]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80, color: 'var(--text-muted)', fontSize: 13 }}>
        Loading eligibility data...
      </div>
    );
  }

  const c = cases[activeIdx];
  if (!c) return null;
  const statusStyle = STATUS_STYLE[c.eligibilityStatus];
  const metCount = c.rules.filter(r => r.met).length;

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 10, letterSpacing: '3px', color: 'var(--amber)', marginBottom: 4 }}>
            POLICY COMPLIANCE
          </p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Renewal Eligibility Review
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
            Case {c.caseId} · {c.provider} · {c.riskType}
          </p>
        </div>
        {cases.length > 1 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', maxWidth: 280 }}>
            {cases.slice(0, 8).map((cs, i) => (
              <button
                key={i}
                onClick={() => setActiveIdx(i)}
                style={{
                  width: 30, height: 30, border: 'none', borderRadius: 'var(--radius)',
                  fontSize: 11, cursor: 'pointer', fontWeight: 700,
                  background: i === activeIdx ? 'var(--navy)' : 'var(--bg-elevated)',
                  color: i === activeIdx ? '#fff' : 'var(--text-secondary)',
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Case summary strip */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 24, boxShadow: 'var(--shadow-sm)' }}>
        {[
          { label: 'Projected Charge', value: `$${c.projectedCharge.toLocaleString()}` },
          { label: 'Event Date', value: c.eventDate },
          { label: 'Policy Window', value: c.policyWindow },
          { label: 'Rules Met', value: `${metCount} / ${c.rules.length}` },
        ].map(item => (
          <div key={item.label}>
            <div style={{ fontSize: 10, letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 3-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 220px', gap: 14 }}>

        {/* Case Facts */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            CASE FACTS
          </div>
          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <FactGroup title="Subscription Details">
              <FactItem label="Plan" value={c.plan} />
              <FactItem label="Member Since" value={c.memberSince} />
              <FactItem label="Age" value={String(c.age)} />
            </FactGroup>
            <FactGroup title="Risk Classification">
              <FactItem label="Diagnosis" value={c.diagnosis} />
            </FactGroup>
            <FactGroup title="Billing History">
              <FactItem label="Payments" value={c.payments} />
              <FactItem label="Last Renewal" value={c.lastRenewal} />
            </FactGroup>
            <FactGroup title="Usage Context">
              <FactItem label="Claims" value={`${c.claims} in last 12 months`} />
              <FactItem label="Doctor Visits" value={c.doctorVisits} />
            </FactGroup>
          </div>
        </div>

        {/* Policy Rules */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            POLICY RULES EVALUATION
          </div>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.rules.map((rule, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 12px', borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${rule.met ? 'var(--green)' : 'var(--red)'}`,
                  background: 'var(--bg-elevated)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>{rule.met ? '✅' : '❌'}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{rule.label}</span>
                </div>
                <div style={{ fontSize: 11, color: rule.met ? 'var(--green)' : 'var(--red)', marginTop: 3, marginLeft: 22 }}>
                  {rule.met ? 'Met' : 'Failed'}: {rule.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Decision Summary */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ background: 'var(--navy)', color: '#fff', padding: '10px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            DECISION SUMMARY
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>ELIGIBILITY STATUS</div>
              <div style={{ ...statusStyle, padding: '10px 14px', borderRadius: 'var(--radius)', fontWeight: 800, fontSize: 13, textAlign: 'center', border: `1px solid ${statusStyle.border}` }}>
                {c.eligibilityStatus}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>MISSING EVIDENCE</div>
              {c.missingEvidence.map(e => (
                <div key={e} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                  <span style={{ color: 'var(--amber)', fontSize: 10 }}>◆</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{e}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 10, letterSpacing: '1.5px', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>CONFIDENCE RATIONALE</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{c.confidenceRationale}</p>
            </div>
            <button style={{ padding: '10px 16px', background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', fontSize: 12, fontWeight: 600, cursor: 'pointer', width: '100%', marginTop: 4 }}>
              Approve for Strategy Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FactGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '1px' }}>{title}</div>
      {children}
    </div>
  );
}

function FactItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 4 }}>
      <span style={{ color: 'var(--blue)', fontSize: 10, marginTop: 1 }}>◆</span>
      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
        <span style={{ fontWeight: 600 }}>{label}:</span> {value}
      </span>
    </div>
  );
}
