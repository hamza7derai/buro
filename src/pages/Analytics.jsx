import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { useClients } from '../hooks/useClients';
import { useToast } from '../components/Toast';
import { db } from '../firebase';
import { collection, query, where, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Wallet, TrendingUp, Receipt, ShoppingBasket, Lock, AlertTriangle, AlertCircle } from 'lucide-react';
import Thumb from '../components/Thumb';
import { formatPrice } from '../lib/pricing';

const RANGES = [
  { v: 'today', l: "Aujourd'hui" },
  { v: '7d', l: '7 jours' },
  { v: '30d', l: '30 jours' },
  { v: 'custom', l: 'Personnalisé' },
];

const PAYMENT_COLORS = { 'Espèce': '#2563eb', 'TPE': '#F5A623' };


function dayKey(d) { return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); }

function StatCard({ icon: Icon, label, value, iconWrapCls, iconCls, valueCls }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconWrapCls}`}>
        <Icon size={22} strokeWidth={1.75} className={iconCls} />
      </div>
      <div className="min-w-0">
        <div className={`text-xl font-bold font-mono truncate ${valueCls || 'text-[#1a1a2e]'}`}>{value}</div>
        <div className="text-[12px] text-gray-400">{label}</div>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="flex-1 bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">{title}</h2>
      </div>
      <div className="flex-1 p-5">{children}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <div className="flex items-center justify-center h-full text-gray-400 text-[13px]">{text}</div>;
}

export default function Analytics() {
  const { isAdmin } = useAuth();
  const { products, loading: productsLoading } = useProducts();
  const { clients } = useClients();
  const toast = useToast();
  const navigate = useNavigate();

  const [range, setRange] = useState('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [sales, setSales] = useState([]);
  const [dailyRevenue, setDailyRevenue] = useState([]);
  const [paymentBreakdown, setPaymentBreakdown] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [totalProfit, setTotalProfit] = useState(0);
  const [loadingItems, setLoadingItems] = useState(true);

  function getBounds() {
    const now = new Date();
    if (range === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    if (range === '7d') {
      const start = new Date(now); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    if (range === '30d') {
      const start = new Date(now); start.setDate(start.getDate() - 29); start.setHours(0, 0, 0, 0);
      return { start, end: now };
    }
    // custom
    if (!customStart || !customEnd) return null;
    const start = new Date(customStart); start.setHours(0, 0, 0, 0);
    const end = new Date(customEnd); end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  useEffect(() => {
    if (!isAdmin) return;
    const bounds = getBounds();
    if (!bounds) { setSales([]); setLoadingItems(false); return; }
    setLoadingItems(true);
    (async () => {
      try {
        const q = query(
          collection(db, 'sales'),
          where('createdAt', '>=', Timestamp.fromDate(bounds.start)),
          where('createdAt', '<=', Timestamp.fromDate(bounds.end)),
          orderBy('createdAt', 'asc')
        );
        const snap = await getDocs(q);
        setSales(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
        toast('Erreur lors du chargement des ventes', 'error');
        setSales([]);
      }
    })();
  }, [range, customStart, customEnd, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      const byDay = new Map();
      const byPayment = new Map();
      const byProduct = new Map();
      let profit = 0;

      for (const sale of sales) {
        const d = sale.createdAt?.seconds ? new Date(sale.createdAt.seconds * 1000) : new Date();
        const key = dayKey(d);
        byDay.set(key, (byDay.get(key) || 0) + (sale.total || 0));
        const pm = sale.paymentMethod || 'Espèce';
        byPayment.set(pm, (byPayment.get(pm) || 0) + (sale.total || 0));

        const itemsSnap = await getDocs(collection(db, 'sales', sale.id, 'saleItems'));
        itemsSnap.forEach(docSnap => {
          const it = docSnap.data();
          const qty = it.quantity || 0;
          const revenue = it.totalPrice ?? (it.unitPrice || 0) * qty;
          profit += ((it.unitPrice || 0) - (it.costPrice || 0)) * qty;
          const key2 = it.productId || it.name;
          const prev = byProduct.get(key2) || { productId: it.productId, name: it.name, qty: 0, revenue: 0 };
          prev.qty += qty;
          prev.revenue += revenue;
          byProduct.set(key2, prev);
        });
      }

      if (cancelled) return;
      setDailyRevenue(Array.from(byDay.entries()).map(([day, revenue]) => ({ day, revenue })));
      setPaymentBreakdown(Array.from(byPayment.entries()).map(([name, value]) => ({ name, value })));
      setTopProducts(Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10));
      setTotalProfit(profit);
      setLoadingItems(false);
    })();
    return () => { cancelled = true; };
  }, [sales, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="h-full flex items-center justify-center bg-[#f5f6fa]">
        <div className="text-center">
          <Lock size={36} strokeWidth={1.5} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Accès réservé à l'administrateur.</p>
        </div>
      </div>
    );
  }

  const revenue = sales.reduce((s, sale) => s + (sale.total || 0), 0);
  const salesCount = sales.length;
  const panierMoyen = salesCount > 0 ? revenue / salesCount : 0;

  const productImageById = new Map(products.map(p => [p.id, p.mainImage]));
  const topClients = [...clients].sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0)).slice(0, 5);
  const atRiskProducts = products.filter(p => (p.totalStock ?? 0) <= (p.lowStockThreshold ?? 3));

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5f6fa] p-5">
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e]">Analytics</h1>
            <p className="text-[13px] text-gray-400">Suivez les performances de votre boutique.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1">
              {RANGES.map(r => (
                <button
                  key={r.v}
                  onClick={() => setRange(r.v)}
                  className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-all ${
                    range === r.v ? 'bg-[#F5A623]/15 text-[#F5A623]' : 'text-gray-500 hover:text-[#1a1a2e]'
                  }`}
                >
                  {r.l}
                </button>
              ))}
            </div>
            {range === 'custom' && (
              <div className="flex items-center gap-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1a1a2e] outline-none focus:border-[#F5A623]" />
                <span className="text-gray-400 text-[12px]">→</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-[12px] text-[#1a1a2e] outline-none focus:border-[#F5A623]" />
              </div>
            )}
          </div>
        </div>

        {/* ROW 1 — Stat cards */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <StatCard icon={Wallet} label="Chiffre d'affaires" value={formatPrice(revenue)} iconWrapCls="bg-[#2563eb]/10" iconCls="text-[#2563eb]" />
          <StatCard icon={TrendingUp} label="Bénéfice net" value={formatPrice(totalProfit)} iconWrapCls="bg-[#22c55e]/10" iconCls="text-[#22c55e]" valueCls="text-[#22c55e]" />
          <StatCard icon={Receipt} label="Nombre de ventes" value={salesCount} iconWrapCls="bg-[#F5A623]/15" iconCls="text-[#F5A623]" />
          <StatCard icon={ShoppingBasket} label="Panier moyen" value={formatPrice(panierMoyen)} iconWrapCls="bg-[#1e2956]/10" iconCls="text-[#1e2956]" />
        </div>

        {/* ROW 2 — Charts */}
        <div className="flex gap-4 min-h-[300px]">
          <Panel title="Ventes par jour">
            {loadingItems ? (
              <EmptyState text="Chargement..." />
            ) : dailyRevenue.length === 0 ? (
              <EmptyState text="Aucune vente sur cette période." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={dailyRevenue}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={v => formatPrice(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <Panel title="Répartition paiements">
            {loadingItems ? (
              <EmptyState text="Chargement..." />
            ) : paymentBreakdown.length === 0 ? (
              <EmptyState text="Aucune vente sur cette période." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                    {paymentBreakdown.map((entry, i) => (
                      <Cell key={i} fill={PAYMENT_COLORS[entry.name] || '#9ca3af'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => formatPrice(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Panel>
        </div>

        {/* ROW 3 — Top produits / Top clients */}
        <div className="flex gap-4 min-h-[280px]">
          <Panel title="Top 10 produits">
            {loadingItems ? (
              <EmptyState text="Chargement..." />
            ) : topProducts.length === 0 ? (
              <EmptyState text="Aucune donnée sur cette période." />
            ) : (
              <table className="w-full -mt-2">
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-2.5 w-7 text-[12px] text-gray-400 font-mono">{i + 1}</td>
                      <td className="py-2.5 w-12"><Thumb src={productImageById.get(p.productId)} className="w-8 h-8" /></td>
                      <td className="py-2.5 text-[13px] text-[#1a1a2e] font-medium truncate">{p.name}</td>
                      <td className="py-2.5 text-right text-[12px] text-gray-400 font-mono whitespace-nowrap pr-3">{p.qty} vendus</td>
                      <td className="py-2.5 text-right text-[13px] font-mono font-semibold text-[#1a1a2e] whitespace-nowrap">{formatPrice(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel title="Top 5 clients">
            {topClients.length === 0 ? (
              <EmptyState text="Aucun client." />
            ) : (
              <table className="w-full -mt-2">
                <tbody>
                  {topClients.map((c, i) => (
                    <tr key={c.id} className="border-b border-gray-50 last:border-b-0">
                      <td className="py-2.5 w-7 text-[12px] text-gray-400 font-mono">{i + 1}</td>
                      <td className="py-2.5 text-[13px] text-[#1a1a2e] font-medium truncate">{c.name}</td>
                      <td className="py-2.5 text-right text-[12px] text-gray-400 font-mono whitespace-nowrap pr-3">{c.totalOrders || 0} achats</td>
                      <td className="py-2.5 text-right text-[13px] font-mono font-semibold text-[#1a1a2e] whitespace-nowrap">{formatPrice(c.totalSpent || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        {/* ROW 4 — Produits à risque */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Produits à risque</h2>
          </div>
          {productsLoading ? (
            <div className="p-10 text-center text-gray-400 text-[13px]">Chargement...</div>
          ) : atRiskProducts.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-[13px] flex flex-col items-center gap-2">
              <AlertCircle size={28} strokeWidth={1.5} className="text-gray-300" />
              Aucun produit à risque — tous les stocks sont suffisants.
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left p-4">Produit</th>
                  <th className="text-right p-4">Stock actuel</th>
                  <th className="text-right p-4">Seuil minimum</th>
                  <th className="text-center p-4">Statut</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {atRiskProducts.map(p => {
                  const s = p.totalStock ?? 0;
                  const epuise = s <= 0;
                  return (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-4 text-[13px] text-[#1a1a2e] font-medium">{p.name}</td>
                      <td className="p-4 text-right font-mono text-[13px] text-gray-500">{s}</td>
                      <td className="p-4 text-right font-mono text-[13px] text-gray-400">{p.lowStockThreshold ?? 3}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${epuise ? 'bg-[#ef4444]/15 text-[#ef4444]' : 'bg-[#F5A623]/15 text-[#F5A623]'}`}>
                          <AlertTriangle size={11} /> {epuise ? 'Épuisé' : 'Faible'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => navigate(`/produits/${p.id}`)} className="px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                          Modifier
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
