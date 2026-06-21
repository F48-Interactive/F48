import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { LayoutDashboard, Trophy, Settings, LogOut } from 'lucide-react';
import './Sidebar.css';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tournaments', icon: Trophy, label: 'Tournaments' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

interface SidebarProps {
  isOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ isOpen = false, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const organizer = user?.organizer;

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <aside className={`sidebar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <span className="sidebar-logo-text">F48</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
            }
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom: user info + logout */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          {organizer?.youtubeChannels?.[0]?.imageUrl ? (
            <img
              src={organizer.youtubeChannels[0].imageUrl}
              alt=""
              className="avatar avatar-sm"
            />
          ) : (
            <div className="avatar avatar-sm" style={{ background: 'var(--bg-surface-3)' }} />
          )}
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">
              {organizer?.displayName || user?.email || 'Organizer'}
            </span>
            <span className="sidebar-user-role">Organizer</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={handleLogout} title="Sign out">
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}
