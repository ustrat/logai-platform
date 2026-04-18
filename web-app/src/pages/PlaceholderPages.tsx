import { AlertTriangle, TrendingUp, Activity, Settings } from 'lucide-react';

function PlaceholderPage({ eyebrow, title, sub, icon: Icon }: { eyebrow: string; title: string; sub: string; icon: React.ElementType }) {
  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh' }}>
      <div style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, letterSpacing: '3px', color: 'var(--amber)', marginBottom: 4 }}>{eyebrow}</p>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={28} color="var(--text-muted)" />
        </div>
        <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>{sub}</div>
        <div style={{ fontSize: 11, letterSpacing: '2px', color: 'var(--text-muted)' }}>COMING SOON</div>
      </div>
    </div>
  );
}

export function AnomaliesPage() {
  return <PlaceholderPage eyebrow="DETECTION ENGINE" title="Anomaly Explorer" sub="Deep-dive anomaly analysis across all accounts" icon={AlertTriangle} />;
}

export function PatternsPage() {
  return <PlaceholderPage eyebrow="BEHAVIOUR ANALYSIS" title="Pattern Recognition" sub="Account behaviour pattern clustering and analysis" icon={TrendingUp} />;
}

export function MonitorPage() {
  return <PlaceholderPage eyebrow="REAL-TIME" title="Live Monitor" sub="Real-time transaction stream and alerting" icon={Activity} />;
}

export function SettingsPage() {
  return <PlaceholderPage eyebrow="CONFIGURATION" title="Settings" sub="Model tuning, API configuration and preferences" icon={Settings} />;
}
