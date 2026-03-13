export function AnomaliesPage() {
  return <PlaceholderPage title="ANOMALIES" sub="Deep-dive anomaly explorer coming soon" />;
}

export function PatternsPage() {
  return <PlaceholderPage title="PATTERNS" sub="Account behaviour pattern analysis coming soon" />;
}

export function MonitorPage() {
  return <PlaceholderPage title="LIVE MONITOR" sub="Real-time transaction stream coming soon" />;
}

export function SettingsPage() {
  return <PlaceholderPage title="SETTINGS" sub="Configuration and model tuning coming soon" />;
}

function PlaceholderPage({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px' }}>
      <div style={{ fontSize: '10px', letterSpacing: '4px', color: 'var(--amber)' }}>{title}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--text-secondary)' }}>{sub}</div>
    </div>
  );
}