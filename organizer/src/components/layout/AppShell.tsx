import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import './AppShell.css';

export function AppShell() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="mobile-topbar">
        <button
          className="mobile-menu-button"
          onClick={() => setIsSidebarOpen(true)}
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <span className="mobile-topbar-logo">F48</span>
      </header>

      {isSidebarOpen && (
        <button
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <Sidebar isOpen={isSidebarOpen} onNavigate={() => setIsSidebarOpen(false)} />
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
