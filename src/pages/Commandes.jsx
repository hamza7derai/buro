import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot, doc, getDocs,
  updateDoc, deleteDoc, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { useProducts } from '../hooks/useProducts';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Thumb from '../components/Thumb';
import TicketReceipt from '../components/TicketReceipt';
import { ORDER_STATUS_META, ORDER_STATUS_OPTIONS, statusMeta } from '../lib/orderStatus';
import {
  ClipboardList, Clock, Truck, CheckCircle2, Eye, Pencil, Trash2,
  Wallet, CreditCard, Printer, FileText, RotateCcw, X, MapPin, ShoppingBag, Receipt,
  Store, MessageCircle,
} from 'lucide-react';
import { formatPrice } from '../lib/pricing';

const PAGE_SIZE = 10;


function fmtDate(ts) {
  if (!ts?.seconds) return '—';
  const d = new Date(ts.seconds * 1000);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function StatCard({ icon: Icon, label, value, iconWrapCls, iconCls }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
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

function VenteStatusBadge({ record }) {
  if (record.kind === 'draft') {
    return record.status === 'suspended'
      ? <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-600 border border-amber-200">Suspendue</span>
      : <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 border border-blue-200">Sauvegardée</span>;
  }
  if (record.status === 'refunded') {
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">Remboursée</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-50 text-green-600 border border-green-200">Terminée</span>;
}

function Paginator({ page, totalPages, onChange, count, noun }) {
  if (count <= PAGE_SIZE) return null;
  return (
    <div className="flex items-center justify-between shrink-0">
      <span className="text-[12px] text-gray-400">Page {page} sur {totalPages} — {count} {noun}</span>
      <div className="flex gap-2">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">Précédent</button>
        <button onClick={() => onChange(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">Suivant</button>
      </div>
    </div>
  );
}

export default function Commandes() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { products } = useProducts();
  const productImageById = new Map(products.map(p => [p.id, p.mainImage]));

  const [tab, setTab] = useState(searchParams.get('tab') === 'ventes' ? 'ventes' : 'commandes');

  const [orders, setOrders] = useState([]);
  const [sales, setSales] = useState([]);
  const [drafts, setDrafts] = useState([]);

  const [ordersPage, setOrdersPage] = useState(1);
  const [ventesPage, setVentesPage] = useState(1);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedVente, setSelectedVente] = useState(null);
  const [viewItems, setViewItems] = useState([]);
  const [viewLoading, setViewLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(null);
  const [ticketPreview, setTicketPreview] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setSales(snap.docs.map(d => ({ id: d.id, kind: 'sale', ...d.data() }))));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'drafts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => setDrafts(snap.docs.map(d => ({ id: d.id, kind: 'draft', ...d.data() }))));
  }, []);

  const ventes = [...sales, ...drafts].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  const totalCommandes = orders.length;
  const enAttente = orders.filter(o => o.status === 'pending').length;
  const enCours = orders.filter(o => o.status === 'confirmed' || o.status === 'preparing' || o.status === 'shipping').length;
  const livrees = orders.filter(o => o.status === 'delivered').length;

  const ordersTotalPages = Math.max(1, Math.ceil(orders.length / PAGE_SIZE));
  const ordersPaged = orders.slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE);

  const ventesTotalPages = Math.max(1, Math.ceil(ventes.length / PAGE_SIZE));
  const ventesPaged = ventes.slice((ventesPage - 1) * PAGE_SIZE, ventesPage * PAGE_SIZE);

  const STATUS_TS_FIELD = {
    confirmed: 'confirmedAt',
    preparing: 'preparingAt',
    shipping: 'shippedAt',
    delivered: 'deliveredAt',
    cancelled: 'cancelledAt',
  };

  async function changeOrderStatus(order, status) {
    const update = { status, updatedAt: serverTimestamp() };
    if (STATUS_TS_FIELD[status]) update[STATUS_TS_FIELD[status]] = serverTimestamp();
    await updateDoc(doc(db, 'orders', order.id), update);
    setSelectedOrder(o => o ? { ...o, status } : o);
    toast('Statut mis à jour');
  }

  async function handleDeleteOrder(order) {
    try {
      const batch = writeBatch(db);
      try {
        const sub = await getDocs(collection(db, 'orders', order.id, 'orderItems'));
        sub.forEach(d => batch.delete(d.ref));
      } catch (_) { /* no subcollection */ }
      batch.delete(doc(db, 'orders', order.id));
      await batch.commit();
      toast('Commande supprimée');
      setConfirmDeleteOrder(null);
      setSelectedOrder(null);
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la suppression', 'error');
    }
  }

  function sendToDriver(order) {
    const lines = (order.items || []).map(item => {
      const name = item.name + (item.variantLabel ? ` (${item.variantLabel})` : '');
      const price = ((item.totalPrice ?? (item.unitPrice * item.quantity)) || 0)
        .toFixed(2).replace('.', ',');
      return `${name} x${item.quantity} — ${price} DH`;
    }).join('\n');

    const gpsUrl = order.gpsCoords
      ? `https://www.google.com/maps?q=${order.gpsCoords.lat},${order.gpsCoords.lng}`
      : 'Non partagé';

    const adresse = order.addressNote || (order.gpsCoords ? 'Voir position GPS' : 'Non précisée');
    const total = ((order.total || 0).toFixed(2)).replace('.', ',');
    const livraison = ((order.deliveryFee || 0).toFixed(2)).replace('.', ',');

    const msg =
`🛵 Nouvelle livraison younasser
📦 Commande: ${order.orderNumber}

👤 Client: ${order.clientName}
📞 Tél: ${order.clientPhone}

📍 Adresse: ${adresse}
🗺️ GPS: ${gpsUrl}

📋 Articles:
${lines}

💰 Total: ${total} DH (dont livraison ${livraison} DH)

💳 Paiement: À la livraison
Merci! 🙏`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function openOrderTicket(order) {
    setTicketPreview({
      type: 'online',
      ticketNumber: order.orderNumber,
      date: order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(),
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      clientAddress: order.deliveryAddress,
      items: (order.items || []).map(i => ({
        name: i.name, variantLabel: i.variantLabel, qty: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice,
      })),
      subtotal: order.subtotal,
      discountAmount: order.discountAmount || 0,
      deliveryFee: order.deliveryFee || 0,
      total: order.total,
      paymentMethod: order.paymentMethod,
    });
  }

  function openSaleTicket(record, items) {
    setTicketPreview({
      type: 'pos',
      ticketNumber: record.saleNumber,
      date: record.createdAt?.seconds ? new Date(record.createdAt.seconds * 1000) : new Date(),
      cashierName: record.cashierName,
      clientName: record.clientName,
      items: items.map(i => ({ name: i.name, variantLabel: i.variantLabel, qty: i.qty, unitPrice: i.unitPrice, totalPrice: i.totalPrice })),
      subtotal: record.subtotal,
      discountAmount: Math.max(0, (record.subtotal || 0) - (record.total || 0)),
      total: record.total,
      paymentMethod: record.paymentMethod,
    });
  }

  function closeTicketPreview() {
    setTicketPreview(null);
  }

  async function openVenteDetail(record) {
    setSelectedVente(record);
    if (record.kind === 'draft') {
      setViewItems((record.cart || []).map(i => ({
        name: i.name, variantLabel: i.variantLabel, image: i.image,
        qty: i.qty, unitPrice: i.priceSell, totalPrice: i.priceSell * i.qty * (1 - (i.remise || 0) / 100),
      })));
      return;
    }
    setViewLoading(true);
    try {
      const snap = await getDocs(collection(db, 'sales', record.id, 'saleItems'));
      setViewItems(snap.docs.map(d => {
        const data = d.data();
        return {
          name: data.name, variantLabel: data.variantLabel, image: productImageById.get(data.productId),
          qty: data.quantity, unitPrice: data.unitPrice, totalPrice: data.totalPrice,
        };
      }));
    } finally {
      setViewLoading(false);
    }
  }

  function closeVenteDetail() {
    setSelectedVente(null);
    setViewItems([]);
  }

  function handleReprendre(record) {
    navigate('/pos', { state: { resumeDraft: { id: record.id, ...record } } });
  }

  function handleInvoice() {
    toast('Fonctionnalité bientôt disponible — La facture nécessite les informations fiscales de l\'entreprise.', 'info');
  }

  async function handleRefund(record) {
    await updateDoc(doc(db, 'sales', record.id), { status: 'refunded' });
    setSelectedVente(v => v ? { ...v, status: 'refunded' } : v);
    toast('Vente marquée comme remboursée');
  }

  async function handleDeleteVente(record) {
    try {
      if (record.kind === 'sale') {
        const batch = writeBatch(db);
        const itemsSnap = await getDocs(collection(db, 'sales', record.id, 'saleItems'));
        itemsSnap.forEach(d => batch.delete(d.ref));
        batch.delete(doc(db, 'sales', record.id));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, 'drafts', record.id));
      }
      toast('Vente supprimée');
      setConfirmDelete(null);
      if (selectedVente?.id === record.id) closeVenteDetail();
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la suppression', 'error');
    }
  }

  const ventesSubtotal = selectedVente?.subtotal || 0;
  const ventesRemise = selectedVente ? Math.max(0, ventesSubtotal - (selectedVente.total || 0)) : 0;

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5f6fa] p-5">
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="shrink-0">
          <h1 className="text-xl font-bold text-[#1a1a2e]">Commandes</h1>
          <p className="text-[13px] text-gray-400">Gérez les commandes de votre site web.</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <StatCard icon={ClipboardList} label="Total commandes" value={totalCommandes} iconWrapCls="bg-[#2563eb]/10" iconCls="text-[#2563eb]" />
          <StatCard icon={Clock} label="En attente" value={enAttente} iconWrapCls="bg-amber-50" iconCls="text-amber-500" />
          <StatCard icon={Truck} label="En cours" value={enCours} iconWrapCls="bg-purple-50" iconCls="text-purple-500" />
          <StatCard icon={CheckCircle2} label="Livrées" value={livrees} iconWrapCls="bg-[#22c55e]/10" iconCls="text-[#22c55e]" />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white border border-gray-200 rounded-lg p-1 w-fit shrink-0">
          {[{ v: 'commandes', l: 'Commandes en ligne' }, { v: 'ventes', l: 'Ventes POS' }].map(t => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all ${
                tab === t.v ? 'bg-[#F5A623]/15 text-[#F5A623]' : 'text-gray-500 hover:text-[#1a1a2e]'
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'commandes' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {orders.length === 0 ? (
                <div className="p-14 text-center text-gray-400 flex flex-col items-center gap-2">
                  <ShoppingBag size={36} strokeWidth={1.5} className="text-gray-300" />
                  Aucune commande en ligne pour le moment — la boutique en ligne arrive bientôt.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="text-left p-4 w-10">#</th>
                      <th className="text-left p-4">Date</th>
                      <th className="text-left p-4">Client</th>
                      <th className="text-center p-4">Articles</th>
                      <th className="text-right p-4">Montant</th>
                      <th className="text-center p-4">Statut</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersPaged.map((o, i) => {
                      const meta = statusMeta(o.status);
                      return (
                        <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                          <td className="p-4 text-[12px] text-gray-400 font-mono">{(ordersPage - 1) * PAGE_SIZE + i + 1}</td>
                          <td className="p-4 text-[12px] text-gray-400 font-mono whitespace-nowrap">{fmtDate(o.createdAt)}</td>
                          <td className="p-4 text-[13px] text-[#1a1a2e] font-medium">{o.clientName || 'Client'}</td>
                          <td className="p-4 text-center font-mono text-[13px] text-gray-500">{o.itemsCount ?? o.items?.length ?? 0}</td>
                          <td className="p-4 text-right font-mono text-[13px] font-semibold text-[#1a1a2e]">{formatPrice(o.total)}</td>
                          <td className="p-4 text-center"><span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span></td>
                          <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => setSelectedOrder(o)} className="text-gray-400 hover:text-[#2563eb] transition-colors"><Eye size={15} /></button>
                              <button onClick={() => setSelectedOrder(o)} className="text-gray-400 hover:text-[#1a1a2e] transition-colors"><Pencil size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <Paginator page={ordersPage} totalPages={ordersTotalPages} onChange={setOrdersPage} count={orders.length} noun="commandes" />
          </div>
        )}

        {tab === 'ventes' && (
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {ventes.length === 0 ? (
                <div className="p-14 text-center text-gray-400 flex flex-col items-center gap-2">
                  <Receipt size={36} strokeWidth={1.5} className="text-gray-300" />
                  Aucune vente enregistrée pour le moment.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                      <th className="text-left p-4 w-10">#</th>
                      <th className="text-left p-4">Date</th>
                      <th className="text-left p-4">Client</th>
                      <th className="text-center p-4">Articles</th>
                      <th className="text-right p-4">Montant</th>
                      <th className="text-center p-4">Paiement</th>
                      <th className="text-center p-4">Statut</th>
                      <th className="text-right p-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ventesPaged.map((v, i) => {
                      const itemsCount = v.kind === 'draft'
                        ? (v.cart || []).reduce((s, it) => s + it.qty, 0)
                        : (v.itemsCount ?? 0);
                      const payment = v.kind === 'draft' ? v.payType : v.paymentMethod;
                      return (
                        <tr key={v.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => openVenteDetail(v)}>
                          <td className="p-4 text-[12px] text-gray-400 font-mono">{(ventesPage - 1) * PAGE_SIZE + i + 1}</td>
                          <td className="p-4 text-[12px] text-gray-400 font-mono whitespace-nowrap">{fmtDate(v.createdAt)}</td>
                          <td className="p-4 text-[13px] text-[#1a1a2e] font-medium">{v.clientName || 'CLIENT COMPTOIR'}</td>
                          <td className="p-4 text-center font-mono text-[13px] text-gray-500">{itemsCount}</td>
                          <td className="p-4 text-right font-mono text-[13px] font-semibold text-[#1a1a2e]">{formatPrice(v.total)}</td>
                          <td className="p-4 text-center">
                            <span className="inline-flex items-center gap-1 text-[12px] text-gray-500">
                              {payment === 'TPE' ? <CreditCard size={13} /> : <Wallet size={13} />} {payment || '—'}
                            </span>
                          </td>
                          <td className="p-4 text-center"><VenteStatusBadge record={v} /></td>
                          <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openVenteDetail(v)} className="text-gray-400 hover:text-[#2563eb] transition-colors"><Eye size={15} /></button>
                              {v.kind === 'draft' ? (
                                <button onClick={() => handleReprendre(v)} className="text-gray-400 hover:text-[#1a1a2e] transition-colors" title="Reprendre"><Pencil size={14} /></button>
                              ) : (
                                <span className="text-gray-200" title="Vente finalisée"><Pencil size={14} /></span>
                              )}
                              <button onClick={() => setConfirmDelete(v)} className="text-gray-400 hover:text-[#ef4444] transition-colors"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <Paginator page={ventesPage} totalPages={ventesTotalPages} onChange={setVentesPage} count={ventes.length} noun="ventes" />
          </div>
        )}
      </div>

      {/* ═══ Order detail side panel ═══ */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelectedOrder(null)}>
          <div className="bg-white w-[460px] max-w-[95vw] h-full overflow-y-auto p-6 shadow-2xl flex flex-col gap-5" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-[12px] font-bold bg-[#1a1a2e] text-white px-2 py-0.5 rounded">{selectedOrder.orderNumber}</span>
                <span className={`ml-2 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusMeta(selectedOrder.status).cls}`}>
                  {statusMeta(selectedOrder.status).label}
                </span>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-[#1a1a2e]"><X size={18} /></button>
            </div>

            {/* Client info */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[14px] font-semibold text-[#1a1a2e]">{selectedOrder.clientName || 'Client'}</span>
              <span className="text-[12px] text-gray-400 font-mono">{fmtDate(selectedOrder.createdAt)}</span>
              {selectedOrder.clientPhone && (
                <a href={`tel:${selectedOrder.clientPhone}`} className="text-[12px] text-[#2563eb] hover:underline font-mono">
                  {selectedOrder.clientPhone}
                </a>
              )}
            </div>

            {/* Livraison section */}
            <div className="border border-gray-100 rounded-xl p-4 flex flex-col gap-2.5 bg-gray-50/50">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Livraison</div>

              <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full border w-fit ${
                selectedOrder.deliveryMethod === 'pickup'
                  ? 'bg-green-50 text-green-600 border-green-200'
                  : 'bg-blue-50 text-blue-600 border-blue-200'
              }`}>
                {selectedOrder.deliveryMethod === 'pickup'
                  ? <><Store size={12} /> Retrait en magasin</>
                  : <><Truck size={12} /> Livraison à domicile</>
                }
              </span>

              {/* Address complement */}
              {selectedOrder.addressNote && (
                <div className="text-[13px] text-gray-600 leading-snug">{selectedOrder.addressNote}</div>
              )}
              {/* Legacy deliveryAddress fallback */}
              {!selectedOrder.addressNote && selectedOrder.deliveryAddress && (
                <div className="text-[13px] text-gray-600 leading-snug">{selectedOrder.deliveryAddress}</div>
              )}

              {/* GPS link */}
              {selectedOrder.gpsCoords?.lat && (
                <a
                  href={`https://www.google.com/maps?q=${selectedOrder.gpsCoords.lat},${selectedOrder.gpsCoords.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] text-[#2563eb] hover:underline"
                >
                  <MapPin size={13} /> Voir sur la carte
                </a>
              )}

              {/* Delivery fee */}
              <div className="flex items-center justify-between text-[13px] pt-1 border-t border-gray-100">
                <span className="text-gray-500">Frais de livraison</span>
                <span className="font-mono font-semibold text-[#1a1a2e]">
                  {selectedOrder.deliveryFee === 0 ? 'Gratuit (retrait)' : formatPrice(selectedOrder.deliveryFee)}
                </span>
              </div>
            </div>

            {/* Items list */}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Articles</div>
              {(selectedOrder.items || []).length === 0 ? (
                <p className="text-[12px] text-gray-400">Aucun détail d'article disponible.</p>
              ) : (selectedOrder.items || []).map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Thumb src={item.image} className="w-9 h-9 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#1a1a2e] font-medium leading-snug">
                      {item.name}
                      {item.variantLabel && <span className="text-gray-400 font-normal"> — {item.variantLabel}</span>}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      × {item.quantity} · {formatPrice(item.unitPrice)} / unité
                    </div>
                  </div>
                  <span className="text-[13px] font-mono font-semibold text-[#1a1a2e] shrink-0">{formatPrice(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-gray-100 pt-3 flex flex-col gap-1.5">
              {selectedOrder.subtotal != null && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-500">Sous-total</span>
                  <span className="font-mono text-[#1a1a2e]">{formatPrice(selectedOrder.subtotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">Frais de livraison</span>
                <span className="font-mono text-[#1a1a2e]">
                  {selectedOrder.deliveryFee === 0 ? 'Gratuit' : formatPrice(selectedOrder.deliveryFee)}
                </span>
              </div>
              {(selectedOrder.discountAmount > 0) && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-gray-500">
                    Code promo{(selectedOrder.discountCode || selectedOrder.promoCode) && ` (${selectedOrder.discountCode || selectedOrder.promoCode})`}
                  </span>
                  <span className="font-mono text-[#ef4444]">-{formatPrice(selectedOrder.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[14px] font-bold mt-1 pt-2 border-t border-gray-100">
                <span className="text-[#1a1a2e]">Total TTC</span>
                <span className="font-mono text-[#1a1a2e]">{formatPrice(selectedOrder.total)}</span>
              </div>
            </div>

            {/* Status selector */}
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1.5">Mettre à jour le statut</label>
              <select
                value={selectedOrder.status || 'pending'}
                onChange={e => changeOrderStatus(selectedOrder, e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#F5A623]"
              >
                {ORDER_STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{ORDER_STATUS_META[s].label}</option>
                ))}
              </select>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              <button
                onClick={() => sendToDriver(selectedOrder)}
                className="w-full py-2.5 rounded-lg bg-[#25D366] hover:brightness-110 text-white font-semibold text-[13px] transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle size={15} /> Envoyer au livreur
              </button>
              <button
                onClick={() => openOrderTicket(selectedOrder)}
                className="w-full py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={14} /> Imprimer
              </button>
              {isAdmin && (
                <button
                  onClick={() => setConfirmDeleteOrder(selectedOrder)}
                  className="text-[12px] text-[#ef4444] hover:underline mt-1 text-center"
                >
                  Supprimer la commande
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Vente detail side panel ═══ */}
      {selectedVente && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={closeVenteDetail}>
          <div className="bg-white w-[420px] max-w-[95vw] h-full overflow-y-auto p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                {selectedVente.kind === 'sale' && (
                  <span className="font-mono text-[12px] font-bold bg-[#1a1a2e] text-white px-2 py-0.5 rounded">{selectedVente.saleNumber}</span>
                )}
                <VenteStatusBadge record={selectedVente} />
              </div>
              <button onClick={closeVenteDetail} className="text-gray-400 hover:text-[#1a1a2e]"><X size={18} /></button>
            </div>

            <div className="flex flex-col gap-1 mb-5">
              <span className="text-[14px] font-semibold text-[#1a1a2e]">{selectedVente.clientName || 'CLIENT COMPTOIR'}</span>
              <span className="text-[12px] text-gray-400">{fmtDate(selectedVente.createdAt)}</span>
            </div>

            <div className="flex flex-col gap-2 mb-5">
              {viewLoading ? (
                <p className="text-[12px] text-gray-400">Chargement des articles...</p>
              ) : viewItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Thumb src={item.image} className="w-9 h-9" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#1a1a2e] font-medium truncate">
                      {item.name}{item.variantLabel && <span className="text-gray-400"> — {item.variantLabel}</span>}
                    </div>
                    <div className="text-[11px] text-gray-400">× {item.qty}</div>
                  </div>
                  <span className="text-[13px] font-mono font-semibold text-[#1a1a2e]">{formatPrice(item.totalPrice)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-3 flex flex-col gap-1.5 mb-5">
              <div className="flex justify-between text-[13px]"><span className="text-gray-500">Sous-total</span><span className="font-mono text-[#1a1a2e]">{formatPrice(ventesSubtotal)}</span></div>
              {ventesRemise > 0 && (
                <div className="flex justify-between text-[13px]"><span className="text-gray-500">Remise</span><span className="font-mono text-[#ef4444]">-{formatPrice(ventesRemise)}</span></div>
              )}
              <div className="flex justify-between text-[13px]"><span className="text-gray-500">TVA (20%)</span><span className="font-mono text-gray-400">Inclus</span></div>
              <div className="flex justify-between text-[14px] font-bold mt-1"><span className="text-[#1a1a2e]">TOTAL TTC</span><span className="font-mono text-[#1a1a2e]">{formatPrice(selectedVente.total)}</span></div>
            </div>

            <div className="flex flex-col gap-1.5 mb-6 text-[13px]">
              <div className="flex justify-between"><span className="text-gray-500">Paiement</span><span className="text-[#1a1a2e] font-medium">{selectedVente.kind === 'draft' ? selectedVente.payType : selectedVente.paymentMethod}</span></div>
              {selectedVente.kind === 'sale' && (
                <div className="flex justify-between"><span className="text-gray-500">À rendre</span><span className="font-mono text-[#1a1a2e]">{formatPrice(selectedVente.change)}</span></div>
              )}
            </div>

            {selectedVente.kind === 'draft' ? (
              <button onClick={() => handleReprendre(selectedVente)} className="w-full py-3 rounded-xl text-[14px] font-bold bg-[#F5A623] hover:bg-[#d6890f] text-[#1a1a2e] transition-colors">
                Reprendre
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <button onClick={() => openSaleTicket(selectedVente, viewItems)} className="w-full py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <Printer size={14} /> Réimprimer ticket
                </button>
                <button onClick={handleInvoice} className="w-full py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <FileText size={14} /> Créer facture
                </button>
                <button
                  onClick={() => handleRefund(selectedVente)}
                  disabled={selectedVente.status === 'refunded'}
                  className="w-full py-2.5 rounded-lg border border-[#ef4444]/40 text-[#ef4444] font-medium text-[13px] hover:bg-[#ef4444]/5 transition-colors flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw size={14} /> Retour / Remboursement
                </button>
                <button onClick={() => setConfirmDelete(selectedVente)} className="text-[12px] text-[#ef4444] hover:underline mt-1">
                  Supprimer la vente
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ Ticket preview / print modal ═══ */}
      {ticketPreview && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={closeTicketPreview}>
          <div className="bg-white rounded-2xl p-6 w-[400px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-[#1a1a2e]">Aperçu du ticket</h3>
              <button onClick={closeTicketPreview} className="text-gray-400 hover:text-[#1a1a2e]"><X size={18} /></button>
            </div>

            <TicketReceipt {...ticketPreview} />

            <div className="flex flex-col gap-2 mt-5">
              <button onClick={() => window.print()} className="w-full py-3 rounded-xl text-[14px] font-bold bg-[#F5A623] hover:bg-[#dc9018] text-[#1a1a2e] transition-colors flex items-center justify-center gap-2">
                <Printer size={14} /> Imprimer
              </button>
              <button onClick={closeTicketPreview} className="text-[12px] text-gray-400 hover:text-gray-600 hover:underline mt-1 text-center">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete ORDER confirmation ═══ */}
      {confirmDeleteOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => setConfirmDeleteOrder(null)}>
          <div className="bg-white rounded-2xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-1">Supprimer cette commande ?</h3>
            <p className="text-[13px] text-gray-400 font-mono mb-1">{confirmDeleteOrder.orderNumber}</p>
            <p className="text-sm text-gray-500 mb-6">Cette action est irréversible. La commande et tous ses articles seront définitivement supprimés.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteOrder(null)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">Annuler</button>
              <button onClick={() => handleDeleteOrder(confirmDeleteOrder)} className="flex-1 py-2.5 rounded-lg bg-[#ef4444] hover:brightness-110 text-white font-medium text-[13px] transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete confirmation ═══ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3">Supprimer cette vente ?</h3>
            <p className="text-sm text-gray-500 mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">Annuler</button>
              <button onClick={() => handleDeleteVente(confirmDelete)} className="flex-1 py-2.5 rounded-lg bg-[#ef4444] hover:brightness-110 text-white font-medium text-[13px] transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
