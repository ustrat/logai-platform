import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@logai.dev');
  const [password, setPassword] = useState('admin1234');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await authApi.login(email, password);
      setAuth(res.data.data.user, res.data.data.token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.bgPattern} />

      {/* Left branding panel */}
      <div style={styles.brandPanel}>
        <div style={styles.brandInner}>
          <div style={styles.brandLogo}>
            <span style={styles.brandIcon}>⬡</span>
            <span style={styles.brandName}>VALUEPILOT</span>
          </div>
          <p style={styles.brandTagline}>Transaction Intelligence Platform</p>
          <div style={styles.brandDivider} />
          <div style={styles.brandFeatures}>
            {[
              { icon: '🔒', text: 'Enterprise-grade security' },
              { icon: '📊', text: 'ML-powered analytics' },
              { icon: '🔄', text: 'Real-time renewal tracking' },
              { icon: '🏦', text: 'Plaid bank integration' },
            ].map(f => (
              <div key={f.text} style={styles.brandFeature}>
                <span style={styles.featureIcon}>{f.icon}</span>
                <span style={styles.featureText}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right login panel */}
      <div style={styles.loginPanel}>
        <div style={styles.card} className="animate-in">
          <div style={styles.cardHeader}>
            <h1 style={styles.cardTitle}>Sign In</h1>
            <p style={styles.cardSubtitle}>Access your ValuePilot dashboard</p>
          </div>

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.fieldLabel}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                style={styles.input}
                placeholder="you@company.com"
                required
              />
            </div>

            <div style={styles.field}>
              <label style={styles.fieldLabel}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.input}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={styles.error}>⚠ {error}</div>
            )}

            <button type="submit" style={styles.button} disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In →'}
            </button>
          </form>

          <div style={styles.footer}>
            <div style={styles.footerDivider} />
            <p style={styles.footerText}>ValuePilot Platform v1.0 · Secure Connection</p>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh', display: 'flex', background: '#f0f4f8',
    position: 'relative', overflow: 'hidden',
  },
  bgPattern: {
    position: 'absolute', inset: 0, pointerEvents: 'none',
    backgroundImage: `radial-gradient(circle at 20% 50%, rgba(29,78,216,0.05) 0%, transparent 50%),
                      radial-gradient(circle at 80% 20%, rgba(30,58,95,0.05) 0%, transparent 50%)`,
  },
  brandPanel: {
    width: '420px', background: '#1e3a5f',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, position: 'relative', overflow: 'hidden',
  },
  brandInner: { padding: '48px', position: 'relative', zIndex: 1 },
  brandLogo: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' },
  brandIcon: { fontSize: '36px', color: '#f59e0b' },
  brandName: { fontSize: '26px', fontWeight: 800, color: '#ffffff', letterSpacing: '3px' },
  brandTagline: { fontSize: '14px', color: 'rgba(255,255,255,0.6)', marginBottom: '32px' },
  brandDivider: { height: '1px', background: 'rgba(255,255,255,0.15)', marginBottom: '32px' },
  brandFeatures: { display: 'flex', flexDirection: 'column', gap: '16px' },
  brandFeature: { display: 'flex', alignItems: 'center', gap: '12px' },
  featureIcon: { fontSize: '18px', width: '32px', textAlign: 'center' },
  featureText: { fontSize: '13px', color: 'rgba(255,255,255,0.75)' },
  loginPanel: {
    flex: 1, display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: '40px',
  },
  card: {
    background: '#ffffff', border: '1px solid #d1dae4', borderRadius: '10px',
    padding: '40px', width: '100%', maxWidth: '420px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  },
  cardHeader: { marginBottom: '28px' },
  cardTitle: { fontSize: '24px', fontWeight: 800, color: '#111827', marginBottom: '6px' },
  cardSubtitle: { fontSize: '13px', color: '#6b7280' },
  form: { display: 'flex', flexDirection: 'column', gap: '18px' },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldLabel: { fontSize: '12px', fontWeight: 600, color: '#374151', letterSpacing: '0.3px' },
  input: {
    background: '#f8fafc', border: '1px solid #d1dae4', color: '#111827',
    padding: '10px 14px', borderRadius: '6px', outline: 'none',
    fontSize: '13px', transition: 'border-color 0.2s',
  },
  error: {
    color: '#dc2626', fontSize: '12px', padding: '10px 14px',
    background: 'rgba(220,38,38,0.08)', borderRadius: '6px',
    border: '1px solid rgba(220,38,38,0.2)',
  },
  button: {
    background: '#1e3a5f', color: '#ffffff', padding: '12px',
    fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px',
    borderRadius: '6px', marginTop: '4px',
    transition: 'background 0.2s', cursor: 'pointer',
  },
  footer: { marginTop: '28px' },
  footerDivider: { height: '1px', background: '#e5e7eb', marginBottom: '16px' },
  footerText: { fontSize: '11px', color: '#9ca3af', textAlign: 'center' },
};
