import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { LayoutDashboard, ShoppingCart, Package, Gift, ClipboardList, Truck, Users, BarChart3 } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Tableau de bord', end: true },
  { to: '/pos', icon: ShoppingCart, label: 'Vente' },
  { to: '/produits', icon: Package, label: 'Produits' },
  { to: '/packs', icon: Gift, label: 'Packs' },
  { to: '/commandes', icon: ClipboardList, label: 'Commandes' },
  { to: '/achats', icon: Truck, label: 'Achats' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
];

export default function Layout() {
  const { userData, logout } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(new Date());
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [suspendedCount, setSuspendedCount] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'drafts'), where('status', '==', 'suspended'));
    return onSnapshot(q, snap => setSuspendedCount(snap.size));
  }, []);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* ═══ Sidebar — collapsible icon nav ═══ */}
      <aside className={`${expanded ? 'w-[220px]' : 'w-[60px]'} transition-all duration-200 bg-[#1e2956] flex flex-col shrink-0 overflow-hidden`}>
        <div className="h-14 flex items-center gap-3 px-4 border-b border-white/10 shrink-0">
          <button onClick={() => setExpanded(e => !e)} className="text-white/70 hover:text-white text-xl shrink-0" title="Menu">☰</button>
          {expanded && (
            <span className="text-white font-extrabold text-lg tracking-wide whitespace-nowrap">
              younasser<span style={{ color: '#FFC107' }}>.</span>
            </span>
          )}
        </div>

        <nav className="flex-1 flex flex-col gap-1 px-2.5 py-3">
          {NAV_ITEMS.map((item, i) => {
            const badge = item.label === 'Commandes' ? suspendedCount : 0;
            const iconBlock = (
              <span className="relative inline-flex shrink-0">
                <item.icon size={20} strokeWidth={1.75} />
                {badge > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ef4444] text-white text-[9px] font-bold flex items-center justify-center">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
            );
            return (
              <NavLink
                key={i}
                to={item.to}
                end={item.end}
                title={item.label}
                className={({ isActive }) =>
                  `h-10 rounded-lg flex items-center gap-3 px-2.5 transition-all ${
                    isActive
                      ? 'bg-[#F5A623] text-white font-semibold'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`
                }
              >
                {iconBlock}
                {expanded && <span className="text-[13px] whitespace-nowrap">{item.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom — clock, date, user avatar */}
        <div className="px-2.5 py-3 border-t border-white/10 flex flex-col gap-3 relative">
          {expanded ? (
            <div className="flex items-center justify-between text-white/60 text-[11px] font-mono px-1">
              <span>{now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
              <span>{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-white/60 text-[9px] font-mono leading-tight">
              <span>{now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
              <span>{now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}</span>
            </div>
          )}

          {showUserMenu && (
            <div className="absolute bottom-full mb-2 left-2.5 w-44 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 z-30">
              <div className="text-[13px] font-medium text-[#1a1a2e] truncate">{userData?.displayName || 'Staff'}</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-3">{userData?.role}</div>
              <button onClick={logout} className="w-full text-left text-[12px] text-[#ef4444] hover:underline">
                Déconnexion
              </button>
            </div>
          )}

          <button
            onClick={() => setShowUserMenu(s => !s)}
            title={userData?.displayName || 'Staff'}
            className={`flex items-center gap-2 ${expanded ? 'px-1' : 'justify-center'}`}
          >
            <span className="w-9 h-9 shrink-0 rounded-full bg-[#F5A623] text-[#1e2956] font-bold text-[12px] flex items-center justify-center">
              {getInitials(userData?.displayName || userData?.email)}
            </span>
            {expanded && <span className="text-white text-[13px] truncate">{userData?.displayName || 'Staff'}</span>}
          </button>
        </div>
      </aside>

      {/* Page Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
