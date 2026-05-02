import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from '../auth/oidcConfig';

export default function OidcCallback() {
  const navigate   = useNavigate();
  const processed  = useRef(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    // Safety timeout — if callback hangs for 15s, go to login
    const timeout = setTimeout(() => {
      navigate('/login', { replace: true });
    }, 15000);

    userManager.signinRedirectCallback()
      .then(() => {
        clearTimeout(timeout);
        const intended = sessionStorage.getItem('auth_redirect') || '/';
        sessionStorage.removeItem('auth_redirect');
        // Use window.location for a hard nav so the auth state is fully fresh
        window.location.replace(intended);
      })
      .catch(err => {
        clearTimeout(timeout);
        console.error('[oidc] callback error:', err);
        // Stale state — clear oidc storage and send to login
        sessionStorage.clear();
        setError(String(err?.message || err));
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      });
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f4f8',
    }}>
      <style>{`@keyframes spin { from { transform:rotate(0deg) } to { transform:rotate(360deg) } }`}</style>

      {error ? (
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '0 20px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 8 }}>Sign-in error</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, fontFamily: 'monospace', wordBreak: 'break-all' }}>{error}</p>
          <p style={{ fontSize: 12, color: '#6b7280' }}>Redirecting to login…</p>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44,
            border: '4px solid #d1dae4',
            borderTop: '4px solid #1e3a5f',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 16px',
          }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Completing sign-in…</p>
          <p style={{ fontSize: 12, color: '#6b7280' }}>You'll be redirected in a moment</p>
        </div>
      )}
    </div>
  );
}
