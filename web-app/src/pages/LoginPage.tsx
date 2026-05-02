import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function LoginPage() {
  const { isAuthenticated, isLoading, signIn } = useAuth();
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const [signingIn, setSigningIn] = useState(false);
  const error = params.get('error');

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate('/', { replace: true });
  }, [isLoading, isAuthenticated, navigate]);

  const handleSignIn = async () => {
    setSigningIn(true);
    try {
      await signIn();  // redirects to Cognito Hosted UI
    } catch {
      setSigningIn(false);
    }
  };

  if (isLoading) return null;

  return (
    <div style={s.container}>
      <div style={s.bgPattern} />

      {/* Branding panel */}
      <div style={s.brandPanel}>
        <div style={s.brandInner}>
          <div style={s.brandLogo}>
            <span style={s.brandIcon}>⬡</span>
            <span style={s.brandName}>VALUEPILOT</span>
          </div>
          <p style={s.brandTagline}>Transaction Intelligence Platform</p>
          <div style={s.brandDivider} />
          <div style={s.brandFeatures}>
            {[
              { icon: '🔒', text: 'Enterprise-grade security' },
              { icon: '📊', text: 'ML-powered analytics' },
              { icon: '🔄', text: 'Real-time renewal tracking' },
              { icon: '🏦', text: 'Plaid bank integration' },
            ].map(f => (
              <div key={f.text} style={s.brandFeature}>
                <span style={{ fontSize: 18, width: 32, textAlign: 'center' }}>{f.icon}</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Login panel */}
      <div style={s.loginPanel}>
        <div style={s.card}>
          <h1 style={s.cardTitle}>Sign In</h1>
          <p style={s.cardSubtitle}>Access your ValuePilot dashboard</p>

          {error && (
            <div style={s.error}>
              {error === 'auth_failed'
                ? 'Authentication failed. Please try again.'
                : 'An error occurred during sign-in.'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 24 }}>
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              style={{ ...s.button, opacity: signingIn ? 0.7 : 1, cursor: signingIn ? 'wait' : 'pointer' }}
            >
              {signingIn ? 'Redirecting…' : 'Sign In →'}
            </button>

            <p style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
              You will be redirected to a secure sign-in page.
            </p>
          </div>

          <div style={s.footer}>
            <div style={{ height: 1, background: '#e5e7eb', marginBottom: 12 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>Secured by</span>
              <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>AWS Cognito</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>·</span>
              <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>PKCE</span>
              <span style={{ fontSize: 11, color: '#9ca3af' }}>·</span>
              <span style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>OpenID Connect</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container:    { minHeight: '100vh', display: 'flex', background: '#f0f4f8', position: 'relative', overflow: 'hidden' },
  bgPattern:    { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: `radial-gradient(circle at 20% 50%, rgba(29,78,216,0.05) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(30,58,95,0.05) 0%, transparent 50%)` },
  brandPanel:   { width: 420, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandInner:   { padding: 48 },
  brandLogo:    { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  brandIcon:    { fontSize: 36, color: '#f59e0b' },
  brandName:    { fontSize: 26, fontWeight: 800, color: '#ffffff', letterSpacing: '3px' },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 32 },
  brandDivider: { height: 1, background: 'rgba(255,255,255,0.15)', marginBottom: 32 },
  brandFeatures:{ display: 'flex', flexDirection: 'column', gap: 16 },
  brandFeature: { display: 'flex', alignItems: 'center', gap: 12 },
  loginPanel:   { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 },
  card:         { background: '#ffffff', border: '1px solid #d1dae4', borderRadius: 10, padding: 40, width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.08)' },
  cardTitle:    { fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 6 },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginBottom: 0 },
  error:        { color: '#dc2626', fontSize: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.08)', borderRadius: 6, border: '1px solid rgba(220,38,38,0.2)', marginTop: 16 },
  button:       { background: '#1e3a5f', color: '#ffffff', padding: 14, fontSize: 13, fontWeight: 700, letterSpacing: '0.5px', borderRadius: 6, border: 'none' },
  footer:       { marginTop: 28 },
};
