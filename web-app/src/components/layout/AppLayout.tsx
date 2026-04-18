import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';

export default function AppLayout() {
  const { token } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Detect mobile
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-connect Plaid sandbox after login
  useEffect(() => {
    const autoConnect = async () => {
      try {
        const status = await api.get('/plaid/status');
        if (!status.data.data.connected) {
          await api.post('/plaid/sandbox/connect');
        }
      } catch { /* silent fail */ }
    };
    if (token) autoConnect();
  }, [token]);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 40, backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* Sidebar */}
      <div style={{
        position: isMobile ? 'fixed' : 'relative',
        top: 0, left: 0, height: '100%',
        zIndex: isMobile ? 50 : 'auto',
        transform: isMobile && !mobileOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
      }}>
        <Sidebar
          collapsed={isMobile ? false : collapsed}
          onToggle={() => isMobile ? setMobileOpen(false) : setCollapsed(!collapsed)}
        />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg-base)' }}>

        {/* Mobile top bar */}
        {isMobile && (
          <div style={{
            height: 52, background: '#1e3a5f', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', padding: '0 16px', flexShrink: 0,
            position: 'sticky', top: 0, zIndex: 30,
          }}>
            <button
              onClick={() => setMobileOpen(true)}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 4 }}
            >
              ☰
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, color: '#f59e0b' }}>⬡</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '2px' }}>VALUEPILOT</span>
            </div>
            <div style={{ width: 32 }} />
          </div>
        )}

        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
