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
      {/* Background grid */}
      <div style={styles.grid} />

      <div style={styles.card} className="animate-in">
        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoMark}>⬡</div>
          <div>
            <div style={styles.logoText}>VALUEPOINT</div>
            <div style={styles.logoSub}>TRANSACTION INTELLIGENCE</div>
          </div>
        </div>

        <div style={styles.divider} />

        <div style={styles.label}>SYSTEM ACCESS</div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.fieldLabel}>EMAIL_ADDRESS</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.fieldLabel}>PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </div>

          {error && <div style={styles.error}>⚠ {error}</div>}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'AUTHENTICATING...' : 'AUTHENTICATE →'}
          </button>
        </form>

        <div style={styles.footer}>
          LOGAI PLATFORM v1.0 · SECURE CONNECTION
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-base)',
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
  },
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-bright)',
    padding: '40px',
    width: '400px',
    position: 'relative',
    boxShadow: '0 0 60px rgba(245,158,11,0.05)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '32px',
  },
  logoMark: {
    fontSize: '32px',
    color: 'var(--amber)',
    lineHeight: 1,
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: '28px',
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '4px',
  },
  logoSub: {
    fontSize: '9px',
    letterSpacing: '3px',
    color: 'var(--text-muted)',
    marginTop: '2px',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    marginBottom: '24px',
  },
  label: {
    fontSize: '10px',
    letterSpacing: '3px',
    color: 'var(--amber)',
    marginBottom: '20px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  fieldLabel: {
    fontSize: '10px',
    letterSpacing: '2px',
    color: 'var(--text-muted)',
  },
  input: {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    padding: '10px 12px',
    borderRadius: 'var(--radius)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  error: {
    color: 'var(--red)',
    fontSize: '12px',
    padding: '8px 12px',
    background: 'var(--red-dim)',
    borderRadius: 'var(--radius)',
  },
  button: {
    background: 'var(--amber)',
    color: '#000',
    padding: '12px',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 700,
    letterSpacing: '2px',
    borderRadius: 'var(--radius)',
    marginTop: '8px',
    transition: 'opacity 0.2s',
  },
  footer: {
    marginTop: '24px',
    fontSize: '10px',
    letterSpacing: '2px',
    color: 'var(--text-muted)',
    textAlign: 'center',
  },
};
