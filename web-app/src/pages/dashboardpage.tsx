import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { inferenceApi } from '../services/api';
import { AlertTriangle, TrendingUp, CheckCircle, RefreshCw, Zap, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const ACCOUNTS = ['ACC-0001', 'ACC-0002', 'ACC-0003', 'ACC-0004', 'ACC-0005'];

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#f59e0b',
  low: '#10b981',
};

export default function DashboardPage() {
  const [accountId, setAccountId] = useState('ACC-0001');
  const [limit, setLimit] = useState(200);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['analyze', accountId, limit],
    queryFn: async () => {
      const res = await inferenceApi.analyze({ account_id: accountId, limit });
      return res.data.data;
    },
  });

  const trainMutation = useMutation({
    mutationFn: () => inferenceApi.train(),
  });

  const anomalies = data?.anomalies || [];
  const recommendations = data?.recommendations || [];
  const patterns = data?.patterns;
  const flagged = anomalies.filter((a: any) => a.is_anomaly);

  // Chart data — anomaly score distribution
  const scoreDistribution = [
    { range: '0.0-0.2', count: anomalies.filter((a: any) => a.anomaly_score < 0.2).length },
    { range: '0.2-0.4', count: anomalies.filter((a: any) => a.anomaly_score >= 0.2 && a.anomaly_score < 0.4).length },
    { range: '0.4-0.6', count: anomalies.filter((a: any) => a.anomaly_score >= 0.4 && a.anomaly_score < 0.6).length },
    { range: '0.6-0.8', count: anomalies.filter((a: any) => a.anomaly_score >= 0.6 && a.anomaly_score < 0.8).length },
    { range: '0.8-1.0', count: anomalies.filter((a: any) => a.anomaly_score >= 0.8).length },
  ];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerLabel}>TRANSACTION INTELLIGENCE</div>
          <h1 style={styles.headerTitle}>Analysis Dashboard</h1>
        </div>
        <div style={styles.headerControls}>
          <select
            value={accountId}
            onChange={e => setAccountId(e.target.value)}
            style={styles.select}
          >
            {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            style={styles.select}
          >
            <option value={100}>100 TXN</option>
            <option value={200}>200 TXN</option>
            <option value={500}>500 TXN</option>
            <option value={1000}>1000 TXN</option>
          </select>
          <button onClick={() => refetch()} style={styles.btnSecondary}>
            <RefreshCw size={13} /> REFRESH
          </button>
          <button
            onClick={() => trainMutation.mutate()}
            style={styles.btnPrimary}
            disabled={trainMutation.isPending}
          >
            <Zap size={13} />
            {trainMutation.isPending ? 'TRAINING...' : 'RETRAIN MODEL'}
          </button>
        </div>
      </div>

      {isLoading && <div style={styles.loading}>RUNNING INFERENCE ENGINE...</div>}
      {isError && <div style={styles.error}>⚠ Failed to fetch inference results. Is the API running?</div>}

      {data && (
        <>
          {/* Stat cards */}
          <div style={styles.statsGrid}>
            <StatCard
              label="TRANSACTIONS ANALYZED"
              value={data.transactions_analyzed}
              icon={<Activity size={16} />}
              color="var(--blue)"
            />
            <StatCard
              label="ANOMALIES DETECTED"
              value={flagged.length}
              icon={<AlertTriangle size={16} />}
              color="var(--red)"
              highlight={flagged.length > 0}
            />
            <StatCard
              label="PATTERNS FOUND"
              value={patterns?.patterns?.length || 0}
              icon={<TrendingUp size={16} />}
              color="var(--amber)"
            />
            <StatCard
              label="RECOMMENDATIONS"
              value={recommendations.length}
              icon={<CheckCircle size={16} />}
              color="var(--green)"
            />
          </div>

          <div style={styles.grid2col}>
            {/* Anomaly score distribution */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>ANOMALY SCORE DISTRIBUTION</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={scoreDistribution} barSize={28}>
                  <XAxis dataKey="range" tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10, fontFamily: 'Space Mono' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontFamily: 'Space Mono', fontSize: 11 }}
                    cursor={{ fill: 'var(--amber-glow)' }}
                  />
                  <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                    {scoreDistribution.map((entry, i) => (
                      <Cell key={i} fill={i >= 3 ? 'var(--red)' : i === 2 ? 'var(--amber)' : 'var(--blue)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Recommendations */}
            <div style={styles.card}>
              <div style={styles.cardHeader}>RECOMMENDATIONS</div>
              <div style={styles.recList}>
                {recommendations.length === 0 && (
                  <div style={styles.empty}>No recommendations — account looks clean</div>
                )}
                {recommendations.map((rec: any, i: number) => (
                  <div key={i} style={{ ...styles.recItem, borderLeftColor: SEVERITY_COLORS[rec.severity] || 'var(--border)' }}>
                    <div style={styles.recTop}>
                      <span style={{ ...styles.badge, background: SEVERITY_COLORS[rec.severity] + '22', color: SEVERITY_COLORS[rec.severity] }}>
                        {rec.severity.toUpperCase()}
                      </span>
                      <span style={styles.recCategory}>{rec.category}</span>
                      <span style={styles.recConfidence}>{Math.round(rec.confidence * 100)}% conf</span>
                    </div>
                    <div style={styles.recMessage}>{rec.message}</div>
                    <div style={styles.recAction}>→ {rec.recommended_action}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Flagged transactions */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              FLAGGED TRANSACTIONS
              <span style={styles.cardCount}>{flagged.length} / {anomalies.length}</span>
            </div>
            <div style={styles.tableWrapper}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    {['TRANSACTION ID', 'ANOMALY SCORE', 'STATUS', 'REASONS'].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flagged.length === 0 && (
                    <tr><td colSpan={4} style={{ ...styles.td, color: 'var(--text-muted)', textAlign: 'center' }}>No anomalies detected</td></tr>
                  )}
                  {flagged.slice(0, 20).map((a: any) => (
                    <tr key={a.transaction_id} style={styles.tr}>
                      <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                        {a.transaction_id.substring(0, 16)}...
                      </td>
                      <td style={styles.td}>
                        <ScoreBar score={a.anomaly_score} />
                      </td>
                      <td style={styles.td}>
                        <span style={{ color: a.anomaly_score >= 0.85 ? 'var(--red)' : a.anomaly_score >= 0.7 ? 'var(--amber)' : 'var(--text-secondary)' }}>
                          {a.anomaly_score >= 0.85 ? '● CRITICAL' : a.anomaly_score >= 0.7 ? '● HIGH' : '● MEDIUM'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        {a.reasons.slice(0, 2).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Patterns */}
          {patterns && patterns.patterns.length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardHeader}>
                DETECTED PATTERNS
                <span style={styles.cardCount}>{patterns.analysis_window_days}d window · {patterns.total_transactions} txn</span>
              </div>
              <div style={styles.patternGrid}>
                {patterns.patterns.map((p: any, i: number) => (
                  <div key={i} style={styles.patternCard}>
                    <div style={styles.patternType}>{p.type.replace(/_/g, ' ').toUpperCase()}</div>
                    {Object.entries(p)
                      .filter(([k]) => k !== 'type')
                      .slice(0, 4)
                      .map(([k, v]) => (
                        <div key={k} style={styles.patternRow}>
                          <span style={styles.patternKey}>{k.replace(/_/g, ' ')}</span>
                          <span style={styles.patternVal}>{typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : String(v).substring(0, 30)}</span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, highlight }: any) {
  return (
    <div style={{ ...styles.statCard, ...(highlight ? { borderColor: color, boxShadow: `0 0 20px ${color}22` } : {}) }}>
      <div style={{ ...styles.statIcon, color }}>{icon}</div>
      <div style={{ ...styles.statValue, color: highlight ? color : 'var(--text-primary)' }}>{value}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 0.85 ? 'var(--red)' : score >= 0.7 ? 'var(--amber)' : 'var(--blue)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '80px', height: '4px', background: 'var(--border)', borderRadius: '2px' }}>
        <div style={{ width: `${score * 100}%`, height: '100%', background: color, borderRadius: '2px' }} />
      </div>
      <span style={{ color, fontSize: '11px' }}>{(score * 100).toFixed(0)}%</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' },
  headerLabel: { fontSize: '10px', letterSpacing: '3px', color: 'var(--amber)', marginBottom: '4px' },
  headerTitle: { fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, letterSpacing: '1px' },
  headerControls: { display: 'flex', gap: '8px', alignItems: 'center' },
  select: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '7px 10px', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: '11px', cursor: 'pointer' },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--amber)', color: '#000', padding: '7px 14px', borderRadius: 'var(--radius)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', transition: 'opacity 0.2s' },
  btnSecondary: { display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '7px 12px', borderRadius: 'var(--radius)', fontSize: '11px', letterSpacing: '1px' },
  loading: { color: 'var(--amber)', letterSpacing: '2px', padding: '40px', textAlign: 'center', animation: 'fadeIn 0.5s ease' },
  error: { color: 'var(--red)', background: 'var(--red-dim)', padding: '12px 16px', borderRadius: 'var(--radius)', border: '1px solid var(--red)' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' },
  statCard: { background: 'var(--bg-surface)', border: '1px solid var(--border)', padding: '20px', borderRadius: 'var(--radius-lg)', transition: 'all 0.2s' },
  statIcon: { marginBottom: '12px' },
  statValue: { fontFamily: 'var(--font-display)', fontSize: '32px', fontWeight: 700, lineHeight: 1 },
  statLabel: { fontSize: '10px', letterSpacing: '2px', color: 'var(--text-muted)', marginTop: '6px' },
  grid2col: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '20px' },
  cardHeader: { fontSize: '10px', letterSpacing: '3px', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardCount: { color: 'var(--amber)', fontFamily: 'var(--font-mono)' },
  recList: { display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '280px', overflowY: 'auto' },
  recItem: { borderLeft: '3px solid var(--border)', paddingLeft: '12px', paddingTop: '4px', paddingBottom: '4px' },
  recTop: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  badge: { fontSize: '9px', letterSpacing: '1.5px', padding: '2px 6px', borderRadius: '2px', fontWeight: 700 },
  recCategory: { fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '1px' },
  recConfidence: { fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto' },
  recMessage: { fontSize: '12px', color: 'var(--text-primary)', marginBottom: '4px' },
  recAction: { fontSize: '11px', color: 'var(--amber)' },
  empty: { color: 'var(--text-muted)', fontSize: '12px', padding: '20px', textAlign: 'center' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { textAlign: 'left', fontSize: '10px', letterSpacing: '2px', color: 'var(--text-muted)', padding: '8px 12px', borderBottom: '1px solid var(--border)' },
  td: { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-primary)' },
  tr: { transition: 'background 0.15s' },
  patternGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' },
  patternCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '14px', borderRadius: 'var(--radius)' },
  patternType: { fontSize: '9px', letterSpacing: '2px', color: 'var(--amber)', marginBottom: '10px' },
  patternRow: { display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' },
  patternKey: { fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' },
  patternVal: { fontSize: '11px', color: 'var(--text-primary)', fontWeight: 700 },
};
