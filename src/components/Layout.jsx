import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';

export default function Layout() {
  const { userData, logout } = useAuth();
  const [clock, setClock] = useState('');

  useEffect(() => {
    const tick = () => {
      setClock(new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { to: '/', label: 'Vente', icon: '🛒', end: true },
    { to: '/produits', label: 'Produits', icon: '📦' },
    { to: '/clients', label: 'Clients', icon: '👥' },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Nav */}
      <nav className="flex items-center h-[52px] bg-surface-1 border-b border-bord px-6 shrink-0">
        {/* Brand */}
        <div className="text-[15px] font-bold tracking-wider mr-8">
          buro<span className="text-brand-500">.</span>
        </div>

        {/* Nav Tabs */}
        <div className="flex gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-1.5 rounded-md text-[13px] font-medium transition-all ${
                  isActive
                    ? 'text-brand-500 bg-brand-500/10'
                    : 'text-txt-2 hover:text-txt-1 hover:bg-surface-3'
                }`
              }
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-4">
          <span className="text-xs text-txt-3">
            {userData?.displayName || 'Staff'}
            <span className="ml-2 px-1.5 py-0.5 rounded bg-surface-3 text-txt-3 text-[10px] uppercase tracking-wider">
              {userData?.role}
            </span>
          </span>
          <span className="font-mono text-[13px] text-txt-2">{clock}</span>
          <button
            onClick={logout}
            className="text-xs text-txt-3 hover:text-danger transition-colors"
          >
            Déconnexion
          </button>
        </div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
