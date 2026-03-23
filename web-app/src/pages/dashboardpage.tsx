import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inferenceApi } from '../services/api';

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [accountId, setAccountId] = useState<string>('ALL');

  // Fetch available accounts from real CSV data
  const { data: accountsData } = useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      const res = await inferenceApi.accounts();
      return res.data;
    },
  });

  // Fetch summary stats
  const { data: summaryData } = useQuery({
    queryKey: ['summary'],
    queryFn: async () => {
      const res = await inferenceApi.summary();
      return res.data;
    },
  });

  // Fetch analysis for selected account
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analyze', accountId],
    queryFn: async () => {
      const res = await inferenceApi.analyze({
        account_id: accountId === 'ALL' ? undefined : accountId,
        limit: 300,
      });
      return res.data.data;
    },
  });

  const trainMutation = useMutation({
    mutationFn: () => inferenceApi.train(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['analyze'] }),
  });

  const reloadMutation = useMutation({
    mutationFn: () => inferenceApi.reload(),
  });

  const anomalies = data?.anomalies || [];
  const recommendations = data?.recommendations || [];
  const patterns = data?.patterns?.patterns || [];
  const flagged = anomalies.filter((a: any) => a.is_anomaly);
  const accounts = accountsData?.accounts || [];

  return (
    <div style={{ padding: '28px 32px' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--amber)', marginBottom: 4 }}>
            TRANSACTION INTELLIGENCE
          </p>
          <h1 style={{ fontSize: '24px', fontFamily: 'var(--font-display)', color: 'var(--text-primary)', fontWeight: 700 }}>
            Analysis Dashboard
          </h1>
          {summaryData && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>
              {summaryData.total_records?.toLocaleString()} records · {summaryData.unique_accounts?.toLocaleString()} accounts · ${summaryData.total_exposure_usd?.toLocaleString(undefined, { maximumFractionDigits: 0 })} total exposure
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => reloadMutation.mutate()}
            disabled={reloadMutation.isPending}
            style={{ padding: '8px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: 'var(--radius)', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer' }}
          >
            {reloadMutation.isPending ? 'RELOADING...' : '↺ RELOAD DATA'}
          </button>
          <button
            onClick={() => trainMutation.mutate()}
            disabled={trainMutation.isPending}
            style={{ padding: '8px 14px', background: 'var(--amber-glow)', border: '1px solid var(--amber)', color: 'var(--amber)', borderRadius: 'var(--radius)', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer' }}
          >
            {trainMutation.isPending ? 'TRAINING...' : '⚡ TRAIN MODEL'}
          </button>
        </div>
      </div>

      {/* Account Selector */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: '10px', letterSpacing: '2px', color: 'var(--text-muted)', marginBottom: 8 }}>SELECT ACCOUNT</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setAccountId('ALL')}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer',
              border: `1px solid ${accountId === 'ALL' ? 'var(--amber)' : 'var(--border)'}`,
              background: accountId === 'ALL' ? 'var(--amber-glow)' : 'var(--bg-surface)',
              color: accountId === 'ALL' ? 'var(--amber)' : 'var(--text-muted)',
            }}
          >ALL</button>
          {accounts.slice(0, 20).map((acc: string) => (
            <button
              key={acc}
              onClick={() => setAccountId(acc)}
              style={{
                padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: '11px', letterSpacing: '1px', cursor: 'pointer',
                border: `1px solid ${accountId === acc ? 'var(--amber)' : 'var(--border)'}`,
                background: accountId === acc ? 'var(--amber-glow)' : 'var(--bg-surface)',
                color: accountId === acc ? 'var(--amber)' : 'var(--text-muted)',
              }}
            >{acc}</button>
          ))}
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'ANALYZED', value: data?.transactions_analyzed ?? '—', color: 'var(--blue)' },
          { label: 'FLAGGED', value: flagged.length, color: flagged.length > 0 ? 'var(--red)' : 'var(--text-primary)', highlight: flagged.length > 0 },
          { label: 'RECOMMENDATIONS', value: recommendations.length, color: 'var(--amber)' },
          { label: 'PATTERNS', value: patterns.length, color: 'var(--green)' },
        ].map(card => (
          <div key={card.label} style={{
            background: 'var(--bg-surface)', border: `1px solid ${card.highlight ? card.color : 'var(--border)'}`,
            borderRadius: 'var(--radius)', padding: '20px 24px',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--text-muted)', marginTop: 4 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--amber)', letterSpacing: '3px', fontSize: '11px' }}>
          RUNNING INFERENCE ENGINE...
        </div>
      )}

      {isError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius)', padding: 16, color: 'var(--red)', fontSize: '12px', marginBottom: 16 }}>
          ⚠ Cannot reach ML service. Make sure it is running and trained.
        </div>
      )}

      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          {/* Recommendations */}
          <div style={{ gridColumn: '1 / -1' }}>
            <SectionHeader title="RECOMMENDATIONS" count={recommendations.length} />
            {recommendations.length === 0 && <EmptyBox text="No recommendations — data looks clean ✓" />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recommendations.map((rec: any, i: number) => (
                <div key={i} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderLeft: `3px solid ${SEVERITY_COLORS[rec.severity] || 'var(--border)'}`,
                  borderRadius: 'var(--radius)', padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 3, fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
                      background: (SEVERITY_COLORS[rec.severity] || '#666') + '22',
                      color: SEVERITY_COLORS[rec.severity] || '#666',
                    }}>{rec.severity?.toUpperCase()}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{rec.category}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                      {Math.round((rec.confidence || 0) * 100)}% confidence
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: 4 }}>{rec.message}</p>
                  <p style={{ fontSize: '11px', color: 'var(--amber)' }}>→ {rec.recommended_action}</p>
                  {rec.affected_accounts?.length > 0 && (
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
                      Affected: {rec.affected_accounts.slice(0, 3).join(', ')}{rec.affected_accounts.length > 3 ? ` +${rec.affected_accounts.length - 3} more` : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Flagged Transactions */}
          <div>
            <SectionHeader title="FLAGGED TRANSACTIONS" count={flagged.length} />
            {flagged.length === 0 && <EmptyBox text="No anomalies detected ✓" />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {flagged.slice(0, 10).map((a: any) => (
                <div key={a.transaction_id} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: '11px', color: 'var(--amber)', fontFamily: 'monospace' }}>
                      {String(a.transaction_id).substring(0, 14)}
                    </span>
                    <ScorePill score={a.anomaly_score} />
                  </div>
                  <div style={{ display: 'flex', gap: 12, fontSize: '11px', color: 'var(--text-muted)', marginBottom: 6 }}>
                    <span>{a.provider}</span>
                    <span>{a.segment}</span>
                    <span>${(a.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    <span>{a.days_to_renewal}d to renewal</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${(a.anomaly_score || 0) * 100}%`,
                      background: a.anomaly_score >= 0.85 ? 'var(--red)' : a.anomaly_score >= 0.7 ? 'var(--amber)' : 'var(--blue)',
                    }} />
                  </div>
                  {a.reasons?.length > 0 && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 6 }}>{a.reasons[0]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Patterns */}
          <div>
            <SectionHeader title="DETECTED PATTERNS" count={patterns.length} />
            {patterns.length === 0 && <EmptyBox text="No patterns detected" />}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {patterns.map((p: any, i: number) => (
                <div key={i} style={{
                  background: 'var(--bg-surface)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', padding: '14px 16px',
                }}>
                  <p style={{ fontSize: '9px', letterSpacing: '2px', color: 'var(--amber)', marginBottom: 10 }}>
                    {p.type?.replace(/_/g, ' ').toUpperCase()}
                  </p>
                  {Object.entries(p)
                    .filter(([k]) => k !== 'type')
                    .slice(0, 4)
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                          {k.replace(/_/g, ' ')}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {typeof v === 'number'
                            ? Number.isInteger(v) ? v.toLocaleString() : (v as number).toFixed(2)
                            : String(v).substring(0, 30)}
                        </span>
                      </div>
                    ))}
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <span style={{ fontSize: '10px', letterSpacing: '3px', color: 'var(--text-muted)' }}>{title}</span>
      <span style={{ fontSize: '11px', color: 'var(--amber)' }}>{count}</span>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 8 }}>
      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{text}</span>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 0.85 ? 'var(--red)' : score >= 0.7 ? 'var(--amber)' : 'var(--blue)';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: '10px', fontWeight: 700, background: color + '22', color }}>
      {((score || 0) * 100).toFixed(0)}%
    </span>
  );
}
