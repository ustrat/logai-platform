import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { cognitoConfirm, cognitoResendCode } from '../services/cognitoAuth';

export default function ConfirmAccountPage() {
  const [params] = useSearchParams();
  const email    = params.get('email') || '';
  const [code, setCode]       = useState('');
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) { setError('Enter the 6-digit code from your email.'); return; }
    setLoading(true); setError('');
    try {
      await cognitoConfirm(email, code.trim());
      navigate('/login?confirmed=1');
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError(''); setSuccess('');
    try {
      await cognitoResendCode(email);
      setSuccess('A new code has been sent to your email.');
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>
          <span style={{ fontSize: 28, color: '#f59e0b' }}>⬡</span>
          <span style={{ fontSize: 18, fontWeight: 800, color: '#1e3a5f', letterSpacing: '2px' }}>VALUEPILOT</span>
        </div>

        <h1 style={s.title}>Verify Your Email</h1>
        <p style={s.sub}>
          We sent a 6-digit verification code to{' '}
          <strong style={{ color: '#111827' }}>{email || 'your email'}</strong>.
        </p>

        <form onSubmit={handleConfirm} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Verification Code</label>
            <input
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...s.input, letterSpacing: '0.3em', fontSize: 20, textAlign: 'center' }}
              placeholder="000000" maxLength={6} autoFocus required
            />
          </div>

          {error   && <div style={s.error}>{error}</div>}
          {success && <div style={s.success}>{success}</div>}

          <button type="submit" style={s.button} disabled={loading || code.length !== 6}>
            {loading ? 'Verifying...' : 'Verify Account →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={handleResend} style={s.linkBtn}>
            Didn't receive a code? Resend
          </button>
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
  input:   { background: '#f8fafc', border: '1px solid #d1dae4', color: '#111827', padding: '12px 14px', borderRadius: 6, fontSize: 13 },
  error:   { color: '#dc2626', fontSize: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.08)', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)' },
  success: { color: '#16a34a', fontSize: 12, padding: '10px 14px', background: 'rgba(22,163,74,0.08)', borderRadius: 6, border: '1px solid rgba(22,163,74,0.2)' },
  button:  { background: '#1e3a5f', color: '#ffffff', padding: 12, fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: '#1d4ed8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 },
};
