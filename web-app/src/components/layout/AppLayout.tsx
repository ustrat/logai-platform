import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../store/authStore';

export default function AppLayout() {
  const { token } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <main style={{ flex: 1, background: 'var(--bg-base)', overflowY: 'auto' }}>
        <Outlet />
      </main>
    </div>
  );
}
