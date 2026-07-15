import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LayoutDashboard, Vote, Users, UserCheck, Activity, BarChart3, ScrollText, Settings, LogOut, Bell, Shield } from 'lucide-react';

const NAV = [
  { section: 'Main' },
  { to: '/',              label: 'Dashboard',     icon: LayoutDashboard, exact: true },
  { section: 'Elections' },
  { to: '/elections',     label: 'Elections',     icon: Vote },
  { to: '/candidates',   label: 'Candidates',    icon: UserCheck },
  { section: 'Voters' },
  { to: '/students',     label: 'Students',      icon: Users },
  { section: 'Communication' },
  { to: '/notifications',label: 'Notifications', icon: Bell },
  { section: 'System' },
  { to: '/audit-logs',   label: 'Audit Logs',    icon: ScrollText },
  { to: '/settings',     label: 'Settings',      icon: Settings },
];

export default function Layout() {
  const { admin, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>🗳 QueueFree</h1>
          <p>E-Voting Admin Portal</p>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item, i) => {
            if (item.section) return <div key={i} className="nav-section">{item.section}</div>;
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.exact}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                <Icon size={18} />{item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div className="admin-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
              {admin?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{admin?.name}</div>
              <div style={{ color: 'var(--gray-400)', fontSize: 11 }}>{admin?.role?.replace(/_/g, ' ')}</div>
            </div>
          </div>
          <button className="nav-item" onClick={handleLogout} style={{ color: '#f87171' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </aside>
      <div className="main-content">
        <header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Shield size={20} color="var(--primary)" />
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--gray-800)' }}>Electoral Commission Portal</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{admin?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{admin?.role?.replace(/_/g, ' ')}</div>
            </div>
            <div className="admin-avatar">{admin?.name?.charAt(0).toUpperCase()}</div>
          </div>
        </header>
        <div className="page-body"><Outlet /></div>
      </div>
    </div>
  );
}
