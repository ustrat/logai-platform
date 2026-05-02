import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cognitoForgotPassword, cognitoConfirmPassword } from '../services/cognitoAuth';

type Step = 'request' | 'reset';

export default function ForgotPasswordPage() {
  const [step, setStep]           = useState<Step>('request');
  const [email, setEmail]         = useState('');
  const [code, setCode]           = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const navigate = useNavigate();

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await cognitoForgotPassword(email.trim());
      setStep('reset');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 12) { setError('Password must be at least 12 characters.'); return; }
    setLoading(true); setError('');
    try {
      await cognitoConfirmPassword(email.trim(), code.trim(), password);
      navigate('/login?reset=1');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Check the code and try again.');
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

        {step === 'request' ? (
          <>
            <h1 style={s.title}>Forgot Password</h1>
            <p style={s.sub}>Enter your email and we'll send a reset code.</p>
            <form onSubmit={handleRequest} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  style={s.input} placeholder="you@company.com" required autoFocus />
              </div>
              {error && <div style={s.error}>{error}</div>}
              <button type="submit" style={s.button} disabled={loading}>
                {loading ? 'Sending...' : 'Send Reset Code →'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 style={s.title}>Reset Password</h1>
            <p style={s.sub}>
              Enter the code sent to <strong style={{ color: '#111827' }}>{email}</strong> and choose a new password.
            </p>
            <form onSubmit={handleReset} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Reset Code</label>
                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ ...s.input, letterSpacing: '0.3em', textAlign: 'center', fontSize: 18 }}
                  placeholder="000000" maxLength={6} required autoFocus />
              </div>
              <div style={s.field}>
                <label style={s.label}>New Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  style={s.input} placeholder="Min. 12 characters" required />
              </div>
              <div style={s.field}>
                <label style={s.label}>Confirm Password</label>
                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                  style={{ ...s.input, borderColor: confirm.length > 0 ? (password === confirm ? '#16a34a' : '#dc2626') : '#d1dae4' }}
                  placeholder="Re-enter new password" required />
              </div>
              {error && <div style={s.error}>{error}</div>}
              <button type="submit" style={s.button} disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password →'}
              </button>
            </form>
            <button onClick={() => setStep('request')} style={{ ...s.linkBtn, marginTop: 12 }}>
              ← Use a different email
            </button>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/login" style={{ fontSize: 12, color: '#6b7280' }}>← Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f8', padding: 24 },
  card:    { background: '#ffffff', border: '1px solid #d1dae4', borderRadius: 10, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  logo:    { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  title:   { fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 6 },
  sub:     { fontSize: 13, color: '#6b7280', marginBottom: 24, lineHeight: 1.6 },
  form:    { display: 'flex', flexDirection: 'column', gap: 16 },
  field:   { display: 'flex', flexDirection: 'column', gap: 6 },
  label:   { fontSize: 12, fontWeight: 600, color: '#374151' },
  input:   { background: '#f8fafc', border: '1px solid #d1dae4', color: '#111827', padding: '10px 14px', borderRadius: 6, fontSize: 13 },
  error:   { color: '#dc2626', fontSize: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.08)', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)' },
  button:  { background: '#1e3a5f', color: '#ffffff', padding: 12, fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, cursor: 'pointer', display: 'block', margin: '0 auto', textDecoration: 'underline', padding: 0 },
};
