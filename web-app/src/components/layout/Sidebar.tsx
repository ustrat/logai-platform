import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard, AlertTriangle, TrendingUp, Settings, LogOut,
  Activity, ChevronLeft, ChevronRight, RefreshCw, CreditCard,
  List, Briefcase, Eye, FileSearch, ClipboardCheck, BarChart2,
  Target, Repeat, Sparkles, Building2, DollarSign, Mail, Brain,
} from 'lucide-react';

const navItems = [
  // { to: '/',                      icon: LayoutDashboard, label: 'DASHBOARD' },
  // { to: '/anomalies',             icon: AlertTriangle,   label: 'ANOMALIES' },
  // { to: '/patterns',              icon: TrendingUp,      label: 'PATTERNS' },
  // { to: '/monitor',               icon: Activity,        label: 'MONITOR' },
  { to: '/renewals',              icon: RefreshCw,       label: 'RENEWALS' },
  { to: '/risk-queue',            icon: List,            label: 'RISK QUEUE' },
  { to: '/case-feed',             icon: Briefcase,       label: 'CASE FEED' },
  { to: '/watchlist',             icon: Eye,             label: 'WATCHLIST' },
  { to: '/event-normalization',   icon: FileSearch,      label: 'NORMALIZATION' },
  { to: '/eligibility-review',    icon: ClipboardCheck,  label: 'ELIGIBILITY' },
  { to: '/probability-workbench', icon: BarChart2,       label: 'PROBABILITY' },
  { to: '/strategy-selector',     icon: Target,          label: 'STRATEGY' },
  { to: '/subscriptions',         icon: Repeat,          label: 'SUBSCRIPTIONS' },
  { to: '/plaid',                 icon: CreditCard,      label: 'PLAID' },
  { to: '/ai-intelligence',         icon: Brain,           label: 'AI INTEL' },
  { to: '/enterprise',             icon: DollarSign,      label: 'ENTERPRISE' },
  { to: '/partner-portal',         icon: Building2,       label: 'PARTNER' },
  { to: '/pricing',               icon: Sparkles,        label: 'UPGRADE' },
  { to: '/settings',              icon: Settings,        label: 'SETTINGS' },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <aside style={{
      width: collapsed ? '56px' : '200px',
      minHeight: '100vh',
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      transition: 'width 0.2s ease', overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 12px 8px', display: 'flex', justifyContent: collapsed ? 'center' : 'flex-end' }}>
        <button onClick={onToggle} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-sidebar)', borderRadius: 'var(--radius)', cursor: 'pointer', flexShrink: 0 }}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>
      </div>
      {!collapsed ? (
        <div style={{ padding: '0 16px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, color: '#f59e0b' }}>⬡</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: '1px' }}>VALUEPILOT</div>
            <div style={{ fontSize: 9, color: 'var(--text-sidebar-muted)', letterSpacing: '2px' }}>v1.0.0</div>
          </div>
        </div>
      ) : (
        <div style={{ padding: '0 0 16px', display: 'flex', justifyContent: 'center' }}>
          <span style={{ fontSize: 20, color: '#f59e0b' }}>⬡</span>
        </div>
      )}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px 10px' }} />
      {!collapsed ? (
        <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
          <span style={{ fontSize: 10, letterSpacing: '1.5px', color: '#22c55e' }}>SYSTEM ONLINE</span>
        </div>
      ) : (
        <div style={{ padding: '0 0 10px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
        </div>
      )}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 12px 8px' }} />
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} title={collapsed ? label : undefined}
            style={({ isActive }) => ({
              display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 9,
              justifyContent: collapsed ? 'center' : 'flex-start',
              padding: collapsed ? '8px' : '7px 10px',
              borderRadius: 'var(--radius)',
              color: isActive ? '#ffffff' : 'var(--text-sidebar)',
              background: isActive ? 'var(--bg-sidebar-active)' : 'transparent',
              fontSize: '10px', letterSpacing: '1px', fontWeight: isActive ? 700 : 400,
              textDecoration: 'none', transition: 'all 0.15s',
              borderLeft: isActive ? '2px solid #f59e0b' : '2px solid transparent',
            })}>
            <Icon size={14} style={{ flexShrink: 0 }} />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>
      <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '8px 12px' }} />
      <div style={{ padding: collapsed ? '12px 0' : '12px 16px', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8 }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: '0.5px' }}>{user?.name || 'USER'}</div>
            <div style={{ fontSize: 9, color: '#f59e0b', letterSpacing: '1.5px', marginTop: 1 }}>{user?.role?.toUpperCase() || 'ADMIN'}</div>
          </div>
        )}
        <button onClick={handleLogout} title="Logout" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-sidebar)', padding: '5px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.08)' }}>
          <LogOut size={13} />
        </button>
      </div>
    </aside>
  );
}
