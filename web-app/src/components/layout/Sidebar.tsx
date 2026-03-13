import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LayoutDashboard, AlertTriangle, TrendingUp, Settings, LogOut, Activity } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'DASHBOARD' },
  { to: '/anomalies', icon: AlertTriangle, label: 'ANOMALIES' },
  { to: '/patterns', icon: TrendingUp, label: 'PATTERNS' },
  { to: '/monitor', icon: Activity, label: 'MONITOR' },
  { to: '/settings', icon: Settings, label: 'SETTINGS' },
];

export default function Sidebar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={styles.sidebar}>
      {/* Logo */}
      <div style={styles.logo}>
        <span style={styles.logoMark}>⬡</span>
        <div>
          <div style={styles.logoText}>LOGAI</div>
          <div style={styles.logoSub}>v1.0.0</div>
        </div>
      </div>

      <div style={styles.divider} />

      {/* Status indicator */}
      <div style={styles.status}>
        <div style={styles.statusDot} />
        <span style={styles.statusText}>SYSTEM ONLINE</span>
      </div>

      <div style={styles.divider} />

      {/* Nav */}
      <nav style={styles.nav}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <Icon size={14} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* User */}
      <div style={styles.divider} />
      <div style={styles.user}>
        <div style={styles.userInfo}>
          <div style={styles.userName}>{user?.name || 'USER'}</div>
          <div style={styles.userRole}>{user?.role?.toUpperCase() || 'ADMIN'}</div>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn} title="Logout">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: '200px',
    minHeight: '100vh',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    flexShrink: 0,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 20px 20px',
  },
  logoMark: {
    fontSize: '20px',
    color: 'var(--amber)',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: '18px',
    fontWeight: 800,
    letterSpacing: '3px',
  },
  logoSub: {
    fontSize: '9px',
    color: 'var(--text-muted)',
    letterSpacing: '2px',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '0 20px 16px',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 20px 16px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--green)',
    animation: 'pulse-amber 2s infinite',
  },
  statusText: {
    fontSize: '10px',
    letterSpacing: '2px',
    color: 'var(--green)',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '0 12px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: 'var(--radius)',
    color: 'var(--text-muted)',
    fontSize: '11px',
    letterSpacing: '1.5px',
    transition: 'all 0.15s',
    textDecoration: 'none',
  },
  navItemActive: {
    color: 'var(--amber)',
    background: 'var(--amber-glow)',
  },
  user: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 0',
  },
  userInfo: {},
  userName: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '1px',
  },
  userRole: {
    fontSize: '9px',
    color: 'var(--amber)',
    letterSpacing: '2px',
    marginTop: '2px',
  },
  logoutBtn: {
    background: 'none',
    color: 'var(--text-muted)',
    padding: '4px',
    borderRadius: 'var(--radius)',
    transition: 'color 0.15s',
    display: 'flex',
    alignItems: 'center',
  },
};
