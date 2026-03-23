import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { LayoutDashboard, AlertTriangle, TrendingUp, Settings, LogOut, Activity, ChevronLeft, ChevronRight, RefreshCw, CreditCard } from 'lucide-react';
import { List, Briefcase, Eye } from 'lucide-react';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'DASHBOARD' },
  { to: '/anomalies', icon: AlertTriangle, label: 'ANOMALIES' },
  { to: '/patterns', icon: TrendingUp, label: 'PATTERNS' },
  { to: '/monitor', icon: Activity, label: 'MONITOR' },
  { to: '/settings', icon: Settings, label: 'SETTINGS' },
  { to: '/renewals', icon: RefreshCw, label: 'RENEWALS' },
  { to: '/risk-queue', icon: List,      label: 'RISK QUEUE' },
  { to: '/case-feed',  icon: Briefcase, label: 'CASE FEED' },
  { to: '/watchlist',  icon: Eye,       label: 'WATCHLIST' },
  { to: '/plaid',  icon: CreditCard,       label: 'PLAID' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside style={{ ...styles.sidebar, width: collapsed ? '60px' : '200px' }}>
      {/* Toggle button */}
      <button onClick={onToggle} style={styles.toggleBtn} title={collapsed ? 'Expand' : 'Collapse'}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Logo */}
      {!collapsed && (
        <div style={styles.logo}>
          <span style={styles.logoMark}>⬡</span>
          <div>
            <div style={styles.logoText}>VALUEPOINT</div>
            <div style={styles.logoSub}>v1.0.0</div>
          </div>
        </div>
      )}
      {collapsed && (
        <div style={styles.logoCollapsed}>
          <span style={styles.logoMark}>⬡</span>
        </div>
      )}

      <div style={styles.divider} />

      {/* Status indicator */}
      {!collapsed && (
        <div style={styles.status}>
          <div style={styles.statusDot} />
          <span style={styles.statusText}>SYSTEM ONLINE</span>
        </div>
      )}
      {collapsed && (
        <div style={styles.statusCollapsed}>
          <div style={styles.statusDot} />
        </div>
      )}

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
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '9px' : '9px 12px',
            })}
            title={collapsed ? label : undefined}
          >
            <Icon size={14} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      {/* User */}
      <div style={styles.divider} />
      <div style={{ ...styles.user, justifyContent: collapsed ? 'center' : 'space-between' }}>
        {!collapsed && (
          <div style={styles.userInfo}>
            <div style={styles.userName}>{user?.name || 'USER'}</div>
            <div style={styles.userRole}>{user?.role?.toUpperCase() || 'ADMIN'}</div>
          </div>
        )}
        <button onClick={handleLogout} style={styles.logoutBtn} title="Logout">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    minHeight: '100vh',
    background: 'var(--bg-surface)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    flexShrink: 0,
    transition: 'width 0.2s ease',
    overflow: 'hidden',
  },
  toggleBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-muted)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    padding: '4px',
    margin: '0 auto 16px',
    width: '28px',
    height: '28px',
    transition: 'color 0.15s',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 20px 20px',
  },
  logoCollapsed: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0 20px',
  },
  logoMark: {
    fontSize: '20px',
    color: 'var(--amber)',
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontSize: '12px',
    fontWeight: 800,
    letterSpacing: '1px',
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
  statusCollapsed: {
    display: 'flex',
    justifyContent: 'center',
    padding: '0 0 16px',
  },
  statusDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: 'var(--green)',
    animation: 'pulse-amber 2s infinite',
    flexShrink: 0,
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
    cursor: 'pointer',
  },
};
