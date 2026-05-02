import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cognitoSignUp } from '../services/cognitoAuth';

const PASSWORD_RULES = [
  { test: (p: string) => p.length >= 12,            label: 'At least 12 characters' },
  { test: (p: string) => /[A-Z]/.test(p),           label: 'One uppercase letter' },
  { test: (p: string) => /[a-z]/.test(p),           label: 'One lowercase letter' },
  { test: (p: string) => /[0-9]/.test(p),           label: 'One number' },
  { test: (p: string) => /[^A-Za-z0-9]/.test(p),   label: 'One special character' },
];

export default function SignUpPage() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const passwordOk = PASSWORD_RULES.every(r => r.test(password));
  const confirmOk  = password === confirm && confirm.length > 0;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOk)  { setError('Password does not meet the requirements.'); return; }
    if (!confirmOk)   { setError('Passwords do not match.'); return; }
    setLoading(true); setError('');
    try {
      await cognitoSignUp(name.trim(), email.trim(), password);
      navigate(`/confirm?email=${encodeURIComponent(email.trim())}`);
    } catch (err: any) {
      setError(err.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={{ fontSize: 28, color: '#f59e0b' }}>⬡</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', letterSpacing: '2px' }}>VALUEPILOT</span>
        </div>

        <h1 style={s.title}>Create Account</h1>
        <p style={s.sub}>Get started with ValuePilot — free for 14 days</p>

        <form onSubmit={handleSignUp} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              style={s.input} placeholder="Jane Smith" required autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label}>Work Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              style={s.input} placeholder="you@company.com" required />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              style={s.input} placeholder="Min. 12 characters" required />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 6 }}>
              {PASSWORD_RULES.map(r => (
                <span key={r.label} style={{ fontSize: 11, color: r.test(password) ? '#16a34a' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {r.test(password) ? '✓' : '○'} {r.label}
                </span>
              ))}
            </div>
          </div>
          <div style={s.field}>
            <label style={s.label}>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              style={{ ...s.input, borderColor: confirm.length > 0 ? (confirmOk ? '#16a34a' : '#dc2626') : '#d1dae4' }}
              placeholder="Re-enter password" required />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" style={s.button} disabled={loading || !passwordOk || !confirmOk}>
            {loading ? 'Creating account...' : 'Create Account →'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', marginTop: 20 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#1d4ed8', fontWeight: 600 }}>Sign in</Link>
        </p>

        <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', marginTop: 16 }}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:   { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', padding: 24 },
  card:   { background: '#ffffff', border: '1px solid #d1dae4', borderRadius: 10, padding: 40, width: '100%', maxWidth: 460, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  logo:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  title:  { fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6 },
  sub:    { fontSize: 13, color: '#6b7280', marginBottom: 24 },
  form:   { display: 'flex', flexDirection: 'column', gap: 16 },
  field:  { display: 'flex', flexDirection: 'column', gap: 6 },
  label:  { fontSize: 12, fontWeight: 600, color: '#374151' },
  input:  { background: '#f8fafc', border: '1px solid #d1dae4', color: '#111827', padding: '10px 14px', borderRadius: 6, fontSize: 13 },
  error:  { color: '#dc2626', fontSize: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.08)', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)' },
  button: { background: '#1e3a5f', color: '#ffffff', padding: 12, fontSize: 13, fontWeight: 700, borderRadius: 6, marginTop: 4, cursor: 'pointer' },
};
