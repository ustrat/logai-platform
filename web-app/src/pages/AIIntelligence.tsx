import { useState, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Brain, Mail, AlertTriangle, Repeat, MessageSquare,
  Loader2, ChevronRight, Zap, TrendingDown, Shield,
  DollarSign, Sparkles, CheckCircle, AlertCircle, Info,
} from 'lucide-react';
import { bedrockApi, type AssistantTask, type EmailSignalResult, type AnomalyExplanation, type SubscriptionAnalysis, type AssistantResponse } from '../services/bedrockApi';
import api from '../services/api';

// ── Helpers ───────────────────────────────────────────────────────────────────
const PRODUCT_COLORS: Record<string, string> = {
  renewalguard:    '#6366f1',
  refundpilot:     '#f59e0b',
  followup:        '#10b981',
  leakageindex:    '#ef4444',
  enterprisepilot: '#3b82f6',
  drivepilot:      '#8b5cf6',
  boarderpilot:    '#14b8a6',
};

const URGENCY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#10b981',
  none:   '#6b7280',
};

const PRIORITY_COLOR: Record<string, string> = {
  high:   '#ef4444',
  medium: '#f59e0b',
  low:    '#10b981',
};

const RISK_COLOR: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#f59e0b',
  low:      '#10b981',
};

const TABS = [
  { id: 'email',        label: 'Email Signals',    icon: Mail },
  { id: 'anomaly',      label: 'Anomaly Explainer', icon: AlertTriangle },
  { id: 'subscription', label: 'Subscription AI',   icon: Repeat },
  { id: 'assistant',    label: 'Sales Assistant',   icon: MessageSquare },
];

const ASSISTANT_TASKS: { value: AssistantTask; label: string }[] = [
  { value: 'summarize_order',          label: 'Summarize Order' },
  { value: 'pricing_guidance',         label: 'Pricing Guidance' },
  { value: 'draft_proposal_email',     label: 'Draft Proposal Email' },
  { value: 'draft_follow_up_email',    label: 'Draft Follow-Up Email' },
  { value: 'draft_invoice_cover_email',label: 'Draft Invoice Cover Email' },
  { value: 'renewal_risk',             label: 'Renewal Risk Assessment' },
  { value: 'pipeline_summary',         label: 'Pipeline Summary' },
  { value: 'freeform',                 label: 'Freeform Assistant' },
];

// ── Token badge ───────────────────────────────────────────────────────────────
function TokenBadge({ input, output, cacheRead }: { input: number; output: number; cacheRead?: number }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4 }}>
        {input.toLocaleString()} in
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: 4 }}>
        {output.toLocaleString()} out
      </span>
      {cacheRead != null && cacheRead > 0 && (
        <span style={{ fontSize: 11, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 4 }}>
          {cacheRead.toLocaleString()} cached
        </span>
      )}
    </div>
  );
}

// ── Tab 1: Email Signal Analyzer ──────────────────────────────────────────────
function EmailSignalsTab() {
  const [subject, setSubject] = useState('');
  const [from, setFrom]       = useState('');
  const [body, setBody]       = useState('');

  const mutation = useMutation({
    mutationFn: () => bedrockApi.analyzeEmailSignals({ subject, from, body }),
  });

  const result: EmailSignalResult | null = mutation.data?.data ?? null;

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Input */}
      <div style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Input</div>
          {[
            { label: 'From', value: from, setter: setFrom, placeholder: 'no-reply@vendor.com' },
            { label: 'Subject', value: subject, setter: setSubject, placeholder: 'Your subscription renews in 3 days' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <input
                value={value}
                onChange={e => setter(e.target.value)}
                placeholder={placeholder}
                style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Body</div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Paste email body text here..."
              rows={8}
              style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !subject || !from || !body}
            style={{ width: '100%', marginTop: 8, padding: '9px 0', background: mutation.isPending ? 'var(--bg-elevated)' : '#1d4ed8', color: mutation.isPending ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            {mutation.isPending ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : <><Brain size={14} /> Analyze Email</>}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {mutation.isError && (
          <div style={{ padding: 16, background: 'var(--red-dim)', border: '1px solid var(--red)', borderRadius: 8, color: 'var(--red)', fontSize: 13 }}>
            Analysis failed. Check your API connection and try again.
          </div>
        )}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.3s ease' }}>
            {/* Summary card */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: `${URGENCY_COLOR[result.overallUrgency]}20`, color: URGENCY_COLOR[result.overallUrgency] }}>
                  {result.overallUrgency} urgency
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{result.signals.length} signal{result.signals.length !== 1 ? 's' : ''} detected</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.emailSummary}</p>
              <TokenBadge input={result.inputTokens} output={result.outputTokens} cacheRead={result.cacheRead} />
            </div>

            {/* Signal cards */}
            {result.signals.map((sig, i) => (
              <div key={i} style={{ background: 'var(--bg-surface)', border: `1px solid ${PRODUCT_COLORS[sig.productKey] ?? '#6b7280'}40`, borderLeft: `3px solid ${PRODUCT_COLORS[sig.productKey] ?? '#6b7280'}`, borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PRODUCT_COLORS[sig.productKey] ?? '#6b7280' }}>{sig.productName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: 4 }}>{sig.signalType.replace(/_/g, ' ')}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: URGENCY_COLOR[sig.urgency], fontWeight: 600 }}>{sig.urgency}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: sig.confidence >= 0.9 ? '#10b981' : sig.confidence >= 0.7 ? '#f59e0b' : '#6b7280' }}>
                      {Math.round(sig.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{sig.summary}</p>
                {/* Entities */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {sig.entities.amounts?.map((a, j) => (
                    <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{a.currency} {a.value.toFixed(2)}</span>
                  ))}
                  {sig.entities.dates?.map((d, j) => (
                    <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{d.raw}</span>
                  ))}
                  {sig.entities.vendors?.map((v, j) => (
                    <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{v}</span>
                  ))}
                  {sig.entities.deadlines?.map((d, j) => (
                    <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{d}</span>
                  ))}
                </div>
              </div>
            ))}

            {result.signals.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Info size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
                <div>No signals detected in this email.</div>
              </div>
            )}
          </div>
        )}

        {!result && !mutation.isPending && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Mail size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
            <div>Paste an email and click Analyze to detect product signals.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 2: Anomaly Explainer ───────────────────────────────────────────────────
function AnomalyExplainerTab() {
  const [accountId, setAccountId]           = useState('');
  const [anomaliesJson, setAnomaliesJson]   = useState('');
  const [recsJson, setRecsJson]             = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      let anomalies: any[], recommendations: any[];
      try { anomalies = JSON.parse(anomaliesJson); } catch { throw new Error('Invalid anomalies JSON'); }
      try { recommendations = JSON.parse(recsJson); } catch { throw new Error('Invalid recommendations JSON'); }
      return bedrockApi.explainAnomalies({ accountId, anomalies, recommendations });
    },
  });

  const result: AnomalyExplanation | null = mutation.data?.data ?? null;

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Input */}
      <div style={{ flex: '0 0 380px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>ML Output</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Account ID</div>
            <input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="acc_123" style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          {[
            { label: 'Anomalies JSON', value: anomaliesJson, setter: setAnomaliesJson, placeholder: '[{"transaction_id":"txn_1","is_anomaly":true,"anomaly_score":0.95,"reasons":["high value"]}]' },
            { label: 'Recommendations JSON', value: recsJson, setter: setRecsJson, placeholder: '[{"severity":"high","category":"fraud","message":"...","transaction_ids":[],"recommended_action":"...","confidence":0.9}]' },
          ].map(({ label, value, setter, placeholder }) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
              <textarea value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} rows={5} style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} />
            </div>
          ))}
          {mutation.isError && <div style={{ marginBottom: 8, fontSize: 12, color: '#ef4444' }}>{String((mutation.error as any)?.message ?? 'Error')}</div>}
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !accountId || !anomaliesJson || !recsJson} style={{ width: '100%', padding: '9px 0', background: mutation.isPending ? 'var(--bg-elevated)' : '#1d4ed8', color: mutation.isPending ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {mutation.isPending ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Explaining...</> : <><Brain size={14} /> Explain Anomalies</>}
          </button>
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.3s ease' }}>
            <div style={{ background: 'var(--bg-surface)', border: `1px solid ${RISK_COLOR[result.riskLevel]}40`, borderLeft: `3px solid ${RISK_COLOR[result.riskLevel]}`, borderRadius: 8, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: `${RISK_COLOR[result.riskLevel]}20`, color: RISK_COLOR[result.riskLevel] }}>{result.riskLevel} risk</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{result.headline}</div>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{result.explanation}</p>
              {result.patternSummary && <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>{result.patternSummary}</p>}
              <TokenBadge input={result.inputTokens} output={result.outputTokens} />
            </div>

            {result.recommendedActions.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recommended Actions</div>
                {result.recommendedActions.map((a, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <ChevronRight size={14} style={{ marginTop: 1, flexShrink: 0, color: '#1d4ed8' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{a}</span>
                  </div>
                ))}
              </div>
            )}

            {result.anomalyBreakdown.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transaction Breakdown</div>
                {result.anomalyBreakdown.map((b, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < result.anomalyBreakdown.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{b.merchant}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{b.currency} {b.amount?.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, background: 'var(--bg-elevated)', padding: '2px 7px', borderRadius: 4, color: 'var(--text-muted)' }}>{b.category}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{b.finding}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!result && !mutation.isPending && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <AlertTriangle size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
            <div>Paste ML anomaly output to get a plain-English explanation.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 3: Subscription Analyzer ─────────────────────────────────────────────
function SubscriptionAnalyzerTab() {
  const { data: subData, isLoading: subLoading } = useQuery({
    queryKey: ['subscriptions-for-ai'],
    queryFn: async () => {
      const res = await api.get('/subscriptions?days=365&min_confidence=0.4');
      return res.data?.data?.subscriptions ?? [];
    },
  });

  const mutation = useMutation({
    mutationFn: () => bedrockApi.analyzeSubscriptions('current-user', subData ?? []),
  });

  const result: SubscriptionAnalysis | null = mutation.data?.data ?? null;

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      <div style={{ flex: '0 0 300px' }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Portfolio</div>
          {subLoading ? (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading subscriptions...</div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
              <strong>{(subData ?? []).length}</strong> subscriptions detected from your connected accounts.
            </div>
          )}
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || !subData?.length} style={{ width: '100%', padding: '9px 0', background: mutation.isPending ? 'var(--bg-elevated)' : '#1d4ed8', color: mutation.isPending ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {mutation.isPending ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing...</> : <><Sparkles size={14} /> Analyze with AI</>}
          </button>
          {!subData?.length && !subLoading && (
            <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Connect a bank account via Plaid to detect subscriptions first.
            </p>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.3s ease' }}>
            {/* Headline */}
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 12 }}>{result.headline}</div>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: 'Monthly', value: `$${result.totalMonthlySpend?.toFixed(2)}` },
                  { label: 'Annual', value: `$${result.totalAnnualSpend?.toFixed(2)}` },
                  { label: 'Active', value: result.activeCount },
                  { label: 'At Risk', value: result.atRiskCount, color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '10px 0', background: 'var(--bg-base)', borderRadius: 6 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: (s as any).color ?? 'var(--text-primary)' }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <TokenBadge input={result.inputTokens} output={result.outputTokens} />
            </div>

            {/* Insights */}
            {result.insights?.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Key Insights</div>
                {result.insights.map((ins, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Zap size={13} style={{ marginTop: 1, flexShrink: 0, color: '#f59e0b' }} />
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ins}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Optimizations */}
            {result.optimizations?.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optimization Opportunities</div>
                {result.optimizations.map((opt, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 0', borderBottom: i < result.optimizations.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <TrendingDown size={14} style={{ marginTop: 2, flexShrink: 0, color: '#10b981' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{opt.merchant}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Save ${opt.estimatedSaving?.toFixed(2)}/mo</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{opt.type?.replace(/_/g, ' ')}</span>
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 4, background: `${PRIORITY_COLOR[opt.priority]}20`, color: PRIORITY_COLOR[opt.priority], fontWeight: 600 }}>{opt.priority}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{opt.rationale}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Duplicates */}
            {result.duplicates?.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Possible Duplicates</div>
                {result.duplicates.map((d, i) => (
                  <div key={i} style={{ padding: '10px 0', borderBottom: i < result.duplicates.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.groupName}</span>
                      <span style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>Save ${d.potentialMonthlySaving?.toFixed(2)}/mo</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                      {d.subscriptions.map((s, j) => <span key={j} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{s}</span>)}
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>{d.recommendation}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Shadow IT */}
            {result.shadowIT?.length > 0 && (
              <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Shadow IT Detected</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {result.shadowIT.map((s, i) => <span key={i} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 4, background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 500 }}>{s}</span>)}
                </div>
              </div>
            )}
          </div>
        )}
        {!result && !mutation.isPending && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <Repeat size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
            <div>Click "Analyze with AI" to get spend optimization insights.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab 4: Enterprise Sales Assistant ────────────────────────────────────────
function EnterpriseAssistantTab() {
  const [task, setTask]           = useState<AssistantTask>('summarize_order');
  const [contextJson, setCtxJson] = useState('{}');
  const [instruction, setInst]    = useState('');
  const [streaming, setStreaming] = useState(true);
  const [streamText, setStreamText] = useState('');
  const streamingRef = useRef(false);

  const mutation = useMutation({
    mutationFn: async () => {
      let context: Record<string, any>;
      try { context = JSON.parse(contextJson); } catch { throw new Error('Invalid context JSON'); }

      if (!streaming) {
        const res = await bedrockApi.assist({ task, context, instruction: instruction || undefined });
        return res.data;
      }

      // Streaming path
      setStreamText('');
      streamingRef.current = true;
      const stream = await bedrockApi.assistStream({ task, context, instruction: instruction || undefined });
      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (streamingRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') { streamingRef.current = false; break; }
          try {
            const parsed = JSON.parse(payload);
            if (parsed.text) setStreamText(prev => prev + parsed.text);
          } catch {}
        }
      }
      return null; // streaming result lives in streamText state
    },
  });

  const staticResult = !streaming ? (mutation.data as AssistantResponse | null) : null;
  const displayText = streaming ? streamText : (staticResult?.content ?? '');

  return (
    <div style={{ display: 'flex', gap: 20 }}>
      {/* Controls */}
      <div style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assistant</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Task</div>
            <select value={task} onChange={e => setTask(e.target.value as AssistantTask)} style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', outline: 'none' }}>
              {ASSISTANT_TASKS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Context (JSON)</div>
            <textarea value={contextJson} onChange={e => setCtxJson(e.target.value)} rows={8} style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text-primary)', outline: 'none', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'var(--font-mono)' }} />
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Additional instruction (optional)</div>
            <input value={instruction} onChange={e => setInst(e.target.value)} placeholder="e.g. Keep it under 150 words" style={{ width: '100%', padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <button onClick={() => setStreaming(!streaming)} style={{ width: 36, height: 20, borderRadius: 10, background: streaming ? '#1d4ed8' : 'var(--bg-elevated)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 2, left: streaming ? 18 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left 0.2s' }} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Streaming {streaming ? 'on' : 'off'}</span>
          </div>

          {mutation.isError && <div style={{ marginBottom: 8, fontSize: 12, color: '#ef4444' }}>{String((mutation.error as any)?.message ?? 'Error')}</div>}

          <button onClick={() => { setStreamText(''); mutation.mutate(); }} disabled={mutation.isPending} style={{ width: '100%', padding: '9px 0', background: mutation.isPending ? 'var(--bg-elevated)' : '#1d4ed8', color: mutation.isPending ? 'var(--text-muted)' : '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: mutation.isPending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {mutation.isPending ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating...</> : <><Sparkles size={14} /> Run Assistant</>}
          </button>
        </div>

        {/* Quick context templates */}
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Templates</div>
          {[
            { label: 'Sample Order', ctx: { orderId: 'ORD-001', customer: 'Acme Federal Agency', products: ['RenewalGuard™', 'EnterprisePilot™'], seats: 2000, totalValue: 580000, status: 'pending_finance' } },
            { label: 'Pricing Query', ctx: { products: ['RenewalGuard™'], seats: 5000, customerType: 'federal', requestedDiscount: 30 } },
            { label: 'Pipeline', ctx: { deals: [{ name: 'Acme Corp', value: 240000, status: 'submitted' }, { name: 'DoD Agency', value: 1200000, status: 'pending_finance' }] } },
          ].map(t => (
            <button key={t.label} onClick={() => { setTask(t.label === 'Pricing Query' ? 'pricing_guidance' : t.label === 'Pipeline' ? 'pipeline_summary' : 'summarize_order'); setCtxJson(JSON.stringify(t.ctx, null, 2)); }} style={{ width: '100%', marginBottom: 6, padding: '7px 10px', background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'left' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Output */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {(displayText || mutation.isPending) ? (
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 8, padding: 20, minHeight: 400, animation: 'fadeIn 0.3s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <Brain size={14} color="#1d4ed8" />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Claude Sonnet 4.6</span>
              {mutation.isPending && streaming && <span style={{ fontSize: 11, color: 'var(--text-muted)', animation: 'pulse-amber 1s infinite' }}>● streaming</span>}
            </div>
            <pre style={{ margin: 0, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>
              {displayText}
              {mutation.isPending && streaming && <span style={{ animation: 'pulse-amber 0.8s infinite', color: '#1d4ed8' }}>▌</span>}
            </pre>
            {staticResult && <TokenBadge input={staticResult.inputTokens} output={staticResult.outputTokens} cacheRead={staticResult.cacheRead} />}
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            <MessageSquare size={32} style={{ marginBottom: 12, opacity: 0.2 }} />
            <div>Select a task, provide context, and run the assistant.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AIIntelligence() {
  const [activeTab, setActiveTab] = useState('email');

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #1d4ed8, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Brain size={16} color="#fff" />
          </div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>AI Intelligence</h1>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.12)', color: '#6366f1', fontWeight: 600 }}>Bedrock · Claude Sonnet 4.6</span>
        </div>
        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
          AI-powered insights across email signals, anomaly explanations, subscription optimization, and enterprise sales assistance.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', padding: 4, borderRadius: 8, border: '1px solid var(--border)', width: 'fit-content' }}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: active ? 700 : 500, background: active ? '#1d4ed8' : 'transparent', color: active ? '#fff' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="animate-in">
        {activeTab === 'email'        && <EmailSignalsTab />}
        {activeTab === 'anomaly'      && <AnomalyExplainerTab />}
        {activeTab === 'subscription' && <SubscriptionAnalyzerTab />}
        {activeTab === 'assistant'    && <EnterpriseAssistantTab />}
      </div>
    </div>
  );
}
