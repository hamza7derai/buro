import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, orderBy, limit, where, onSnapshot, getDocs, Timestamp } from 'firebase/firestore';
import { useProducts } from '../hooks/useProducts';
import { useAuth } from '../context/AuthContext';
import { useOrderNotifications } from '../context/OrderNotificationsContext';
import { Receipt, Wallet, Package, ShoppingBag, AlertTriangle, AlertCircle, CheckCircle2, Search, Bell, User } from 'lucide-react';
import { statusMeta } from '../lib/orderStatus';
import Thumb from '../components/Thumb';
import { formatPrice } from '../lib/pricing';


function fmtDate(ts) {
  if (!ts?.seconds) return '—';
  return new Date(ts.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) +
    ' ' + new Date(ts.seconds * 1000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function StatCard({ icon: Icon, label, value, iconWrapCls, iconCls, pulse }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4 ${pulse ? 'stat-card-pulse' : ''}`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconWrapCls}`}>
        <Icon size={22} strokeWidth={1.75} className={iconCls} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-[#1a1a2e] font-mono truncate">{value}</div>
        <div className="text-[12px] text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function Panel({ title, action, children }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 shrink-0 flex items-center justify-between">
        <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{title}</h2>
        {action}
      </div>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

function ClientAvatar() {
  return (
    <span className="w-7 h-7 rounded-full bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center shrink-0">
      <User size={13} strokeWidth={2} />
    </span>
  );
}

function EmptyState({ text }) {
  return <div className="text-center py-10 text-gray-400 text-[13px]">{text}</div>;
}

export default function Dashboard() {
  const { products, loading: productsLoading } = useProducts();
  const { userData } = useAuth();
  const { pulseKey } = useOrderNotifications();
  const [now] = useState(new Date());

  const [recentSales, setRecentSales] = useState([]);
  const [todaySales, setTodaySales] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [todayOrders, setTodayOrders] = useState([]);
  const [articlesVendus, setArticlesVendus] = useState(0);
  const [topProducts, setTopProducts] = useState([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Recent sales (any day) — for "Dernières ventes"
  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(5));
    return onSnapshot(q, snap => setRecentSales(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Today's sales — for stat cards + top products
  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, 'sales'),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, snap => setTodaySales(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Recent online orders (any day) — for "Commandes site web"
  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(5));
    return onSnapshot(q, snap => setRecentOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Today's online orders — for stat card count
  useEffect(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', Timestamp.fromDate(start))
    );
    return onSnapshot(q, snap => setTodayOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Aggregate today's sale items → articles vendus + top produits
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const productMap = new Map();
      let totalQty = 0;
      for (const sale of todaySales) {
        const itemsSnap = await getDocs(collection(db, 'sales', sale.id, 'saleItems'));
        itemsSnap.forEach(docSnap => {
          const data = docSnap.data();
          const qty = data.quantity || 0;
          totalQty += qty;
          const key = data.productId || data.name;
          const prev = productMap.get(key) || { name: data.name, productId: data.productId, qty: 0 };
          prev.qty += qty;
          productMap.set(key, prev);
        });
      }
      if (!cancelled) {
        setArticlesVendus(totalQty);
        setTopProducts(Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5));
        setLoadingItems(false);
      }
    })();
    return () => { cancelled = true; };
  }, [todaySales]);

  const caAujourdHui = todaySales.reduce((s, sale) => s + (sale.total || 0), 0);
  const productImageById = new Map(products.map(p => [p.id, p.mainImage]));

  const stockEpuise = products.filter(p => (p.totalStock ?? 0) <= 0);
  const stockFaible = products.filter(p => {
    const s = p.totalStock ?? 0;
    const min = p.lowStockThreshold ?? 3;
    return s > 0 && s <= min;
  });

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5f6fa] p-5">
      <div className="flex flex-col gap-4 min-h-full">

        {/* ═══ Top bar ═══ */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e]">
              Bonjour, {userData?.displayName || 'Staff'} 👋
            </h1>
            <p className="text-[13px] text-gray-400">Voici ce qui se passe dans votre boutique aujourd'hui.</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2">
              <Search size={15} className="text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="bg-transparent text-sm text-[#1a1a2e] outline-none w-44 placeholder:text-gray-400"
              />
            </div>
            <button className="relative w-9 h-9 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#1a1a2e] transition-colors">
              <Bell size={16} />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
            </button>
            <div className="text-[13px] text-gray-500 font-mono whitespace-nowrap">
              {now.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
            </div>
          </div>
        </div>

        {/* ═══ Stat cards ═══ */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <StatCard icon={Receipt} label="Ventes aujourd'hui" value={todaySales.length} iconWrapCls="bg-[#2563eb]/10" iconCls="text-[#2563eb]" />
          <StatCard icon={Wallet} label="CA aujourd'hui" value={formatPrice(caAujourdHui)} iconWrapCls="bg-[#F5A623]/15" iconCls="text-[#F5A623]" />
          <StatCard icon={Package} label="Articles vendus" value={loadingItems ? '…' : articlesVendus} iconWrapCls="bg-[#22c55e]/10" iconCls="text-[#22c55e]" />
          <StatCard key={pulseKey} icon={ShoppingBag} label="Commandes en ligne" value={todayOrders.length} iconWrapCls="bg-[#1e2956]/10" iconCls="text-[#1e2956]" pulse={pulseKey > 0} />
        </div>

        {/* ═══ Row 2: Dernières ventes / Commandes site web ═══ */}
        <div className="flex gap-4 min-h-[260px]">
          <Panel
            title="Dernières ventes"
            action={<Link to="/admin/commandes?tab=ventes" className="text-[11px] font-semibold text-[#2563eb] hover:underline">Voir toutes les ventes →</Link>}
          >
            {recentSales.length === 0 ? (
              <EmptyState text="Aucune vente enregistrée pour le moment." />
            ) : (
              <table className="w-full">
                <tbody>
                  {recentSales.map(sale => (
                    <tr key={sale.id} className="border-b border-gray-50 last:border-b-0">
                      <td className="px-5 py-3 text-[12px] text-gray-400 font-mono whitespace-nowrap">{fmtDate(sale.createdAt)}</td>
                      <td className="py-3 w-7"><ClientAvatar /></td>
                      <td className="px-3 py-3 text-[13px] text-[#1a1a2e] font-medium truncate">{sale.clientName || 'CLIENT COMPTOIR'}</td>
                      <td className="px-3 py-3 text-[12px] text-gray-400 whitespace-nowrap">{sale.paymentMethod}</td>
                      <td className="px-5 py-3 text-right text-[13px] font-mono font-semibold text-[#1a1a2e] whitespace-nowrap">{formatPrice(sale.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Commandes site web">
            {recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-[13px] gap-2">
                <ShoppingBag size={28} strokeWidth={1.5} className="text-gray-300" />
                Aucune commande en ligne
              </div>
            ) : (
              <table className="w-full">
                <tbody>
                  {recentOrders.map(order => {
                    const meta = statusMeta(order.status);
                    return (
                      <tr key={order.id} className="border-b border-gray-50 last:border-b-0">
                        <td className="px-5 py-3 text-[12px] text-gray-400 font-mono whitespace-nowrap">{fmtDate(order.createdAt)}</td>
                        <td className="px-3 py-3 text-[13px] text-[#1a1a2e] font-medium truncate">{order.clientName || 'Client'}</td>
                        <td className="px-3 py-3 text-right text-[13px] font-mono font-semibold text-[#1a1a2e] whitespace-nowrap">{formatPrice(order.total)}</td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* ═══ Row 3: Top produits / Alertes stock ═══ */}
        <div className="flex gap-4 min-h-[240px]">
          <Panel title="Top produits">
            {loadingItems ? (
              <EmptyState text="Chargement..." />
            ) : topProducts.length === 0 ? (
              <EmptyState text="Aucune donnée de vente aujourd'hui." />
            ) : (
              <div className="flex flex-col px-5 py-2">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-b-0">
                    <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-[11px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <Thumb src={productImageById.get(p.productId)} className="w-8 h-8" />
                    <span className="flex-1 text-[13px] text-[#1a1a2e] font-medium truncate">{p.name}</span>
                    <span className="text-[12px] font-mono font-semibold text-[#2563eb] shrink-0">{p.qty} vendus</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Alertes stock">
            {productsLoading ? (
              <EmptyState text="Chargement..." />
            ) : (
              <div className="flex flex-col gap-4 px-5 py-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle size={14} strokeWidth={2} className="text-[#ef4444]" />
                    <span className="text-[11px] font-bold text-[#ef4444] uppercase tracking-wider">Stock épuisé</span>
                  </div>
                  {stockEpuise.length === 0 ? (
                    <p className="text-[12px] text-gray-400">Aucun produit en rupture.</p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {stockEpuise.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-[#1a1a2e] truncate">{p.name}</span>
                          <span className="text-[11px] font-semibold text-[#ef4444] shrink-0">0 en stock</span>
                        </div>
                      ))}
                      {stockEpuise.length > 5 && <p className="text-[11px] text-gray-400">+{stockEpuise.length - 5} autres produits</p>}
                    </div>
                  )}
                </div>

                <div className="h-px bg-gray-100" />

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} strokeWidth={2} className="text-[#F5A623]" />
                    <span className="text-[11px] font-bold text-[#F5A623] uppercase tracking-wider">Stock faible</span>
                  </div>
                  {stockFaible.length === 0 ? (
                    <p className="text-[12px] text-gray-400 flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-[#22c55e]" /> Tous les stocks sont suffisants.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {stockFaible.slice(0, 5).map(p => (
                        <div key={p.id} className="flex items-center justify-between text-[13px]">
                          <span className="text-[#1a1a2e] truncate">{p.name}</span>
                          <span className="text-[11px] font-semibold text-[#F5A623] shrink-0">{p.totalStock} restant{p.totalStock > 1 ? 's' : ''}</span>
                        </div>
                      ))}
                      {stockFaible.length > 5 && <p className="text-[11px] text-gray-400">+{stockFaible.length - 5} autres produits</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
