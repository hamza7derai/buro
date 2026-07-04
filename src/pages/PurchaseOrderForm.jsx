import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, collection, Timestamp, serverTimestamp } from 'firebase/firestore';
import { useProducts } from '../hooks/useProducts';
import { useSuppliers } from '../hooks/useSuppliers';
import { usePurchaseOrders } from '../hooks/usePurchaseOrders';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { printPurchaseOrder } from '../lib/purchaseOrderPdf';
import { poStatusMeta } from '../lib/purchaseOrderStatus';
import { Section, Field, inputCls } from '../components/FormUI';
import Thumb from '../components/Thumb';
import BarcodeIcon from '../components/BarcodeIcon';
import { Search, X, Plus, PackageCheck } from 'lucide-react';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function PurchaseOrderForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { userData } = useAuth();
  const { products } = useProducts();
  const { suppliers, addSupplier } = useSuppliers();
  const { orders, loading: ordersLoading, generateOrderNumber, createPurchaseOrder, updatePurchaseOrder, receivePurchaseOrder } = usePurchaseOrders();

  const orderIdRef = useRef(id || doc(collection(db, 'purchaseOrders')).id);
  const orderId = orderIdRef.current;
  const order = isEditing ? orders.find(o => o.id === id) : null;
  const initializedRef = useRef(false);

  const [orderNumber, setOrderNumber] = useState('');
  const [date, setDate] = useState(todayStr());
  const [supplierId, setSupplierId] = useState('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '' });

  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [showReceive, setShowReceive] = useState(false);
  const [receivedQty, setReceivedQty] = useState({});

  // Generate the order number once for a brand-new order
  useEffect(() => {
    if (isEditing || ordersLoading) return;
    setOrderNumber(prev => prev || generateOrderNumber());
  }, [isEditing, ordersLoading]);

  // Load an existing order's fields once it arrives from the real-time list
  useEffect(() => {
    if (!isEditing || initializedRef.current || !order) return;
    initializedRef.current = true;
    setOrderNumber(order.orderNumber || '');
    setSupplierId(order.supplierId || '');
    setItems((order.items || []).map(it => ({ ...it })));
    setNotes(order.notes || '');
    if (order.createdAt?.seconds) setDate(new Date(order.createdAt.seconds * 1000).toISOString().slice(0, 10));
  }, [order, isEditing]);

  useEffect(() => {
    if (isEditing && !ordersLoading && !order) {
      toast('Bon de commande introuvable', 'error');
      navigate('/admin/achats');
    }
  }, [isEditing, ordersLoading, order]);

  if (isEditing && ordersLoading) {
    return <div className="h-full flex items-center justify-center bg-[#f5f6fa] text-gray-400">Chargement...</div>;
  }

  const existingProductIds = new Set(items.filter(it => it.productId).map(it => it.productId));
  const searchMatches = search.trim()
    ? products.filter(p =>
        !existingProductIds.has(p.id) &&
        (p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.toLowerCase().includes(search.toLowerCase()))
      ).slice(0, 6)
    : [];

  function addProductItem(p) {
    setItems(prev => [...prev, {
      productId: p.id,
      name: p.name,
      barcode: p.barcode || '',
      currentStock: p.totalStock ?? 0,
      quantityOrdered: 1,
      isNewProduct: false,
    }]);
    setSearch('');
  }

  function addManualItem() {
    setItems(prev => [...prev, {
      productId: null,
      name: '',
      barcode: '',
      currentStock: null,
      quantityOrdered: 1,
      isNewProduct: true,
    }]);
  }

  function updateItem(index, field, value) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  async function createSupplierInline() {
    if (!newSupplier.name.trim()) { toast('Nom du fournisseur requis', 'error'); return; }
    try {
      const supId = await addSupplier(newSupplier);
      setSupplierId(supId);
      setShowNewSupplier(false);
      setNewSupplier({ name: '', phone: '', email: '' });
      toast('Fournisseur ajouté');
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la création du fournisseur', 'error');
    }
  }

  function validate() {
    if (!items.length) { toast('Ajoutez au moins un article', 'error'); return false; }
    if (items.some(it => !it.name?.trim())) { toast('Renseignez le nom de chaque article', 'error'); return false; }
    return true;
  }

  function buildItemsPayload() {
    return items.map(it => ({
      productId: it.productId || null,
      name: it.name.trim(),
      barcode: it.barcode?.trim() || '',
      currentStock: it.productId ? (it.currentStock ?? 0) : null,
      quantityOrdered: Number(it.quantityOrdered) || 0,
      isNewProduct: !it.productId,
    }));
  }

  function buildPayload(status) {
    const supplier = suppliers.find(s => s.id === supplierId);
    const itemsPayload = buildItemsPayload();
    return {
      orderNumber,
      supplierId: supplierId || null,
      supplierName: supplier?.name || '',
      status,
      items: itemsPayload,
      notes: notes.trim(),
      createdAt: Timestamp.fromDate(new Date(`${date}T00:00:00`)),
      createdBy: userData?.email || userData?.displayName || '',
    };
  }

  async function handleSaveDraft() {
    if (!validate()) return;
    setSaving(true);
    try {
      const status = isEditing ? (order?.status || 'brouillon') : 'brouillon';
      const payload = buildPayload(status);
      if (isEditing) await updatePurchaseOrder(orderId, payload);
      else await createPurchaseOrder(orderId, payload);
      toast('Brouillon enregistré');
      navigate('/admin/achats');
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'enregistrement", 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleGeneratePdf() {
    if (!validate()) return;
    setSaving(true);
    try {
      const isFirstSend = !isEditing || order?.status === 'brouillon';
      const status = isFirstSend ? 'envoyée' : (order?.status || 'envoyée');
      const payload = buildPayload(status);
      if (isFirstSend) payload.sentAt = serverTimestamp();

      if (isEditing) await updatePurchaseOrder(orderId, payload);
      else await createPurchaseOrder(orderId, payload);

      const supplier = suppliers.find(s => s.id === supplierId);
      printPurchaseOrder({ ...payload, orderNumber, id: orderId }, supplier);

      toast('Bon de commande généré');
      if (!isEditing) navigate(`/admin/achats/${orderId}`);
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la génération du PDF', 'error');
    } finally {
      setSaving(false);
    }
  }

  function openReceiveModal() {
    const initial = {};
    items.forEach((it, i) => { initial[i] = it.quantityOrdered; });
    setReceivedQty(initial);
    setShowReceive(true);
  }

  async function confirmReceive() {
    setSaving(true);
    try {
      const qtyArray = items.map((it, i) => Number(receivedQty[i]) || 0);
      const updatedCount = await receivePurchaseOrder({ id: orderId, items }, qtyArray);
      setShowReceive(false);
      toast(`Stock mis à jour pour ${updatedCount} article${updatedCount !== 1 ? 's' : ''}`);
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la réception', 'error');
    } finally {
      setSaving(false);
    }
  }

  const meta = order ? poStatusMeta(order.status) : null;

  return (
    <div className="h-full w-full flex flex-col bg-[#f5f6fa]">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-5 flex flex-col gap-4">
          <div className="shrink-0 flex items-center gap-3">
            <h1 className="text-xl font-bold text-[#1a1a2e]">{isEditing ? 'Bon de commande' : 'Nouveau bon de commande'}</h1>
            {meta && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>}
            {order?.status === 'envoyée' && (
              <button
                onClick={openReceiveModal}
                className="ml-auto px-4 py-2 rounded-lg bg-[#22c55e] hover:brightness-110 text-white font-semibold text-[13px] transition-all flex items-center gap-2 shrink-0"
              >
                <PackageCheck size={15} /> Réceptionner la commande
              </button>
            )}
          </div>

          {/* TOP — Informations de la commande */}
          <Section title="Informations de la commande">
            <div className="flex gap-4">
              <Field label="N° de commande">
                <input value={orderNumber} readOnly className={`${inputCls} font-mono bg-gray-100 cursor-not-allowed`} />
              </Field>
              <Field label="Date">
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Fournisseur">
              <select
                value={supplierId}
                onChange={e => {
                  if (e.target.value === '__new__') { setShowNewSupplier(true); return; }
                  setSupplierId(e.target.value);
                }}
                className={inputCls}
              >
                <option value="">Sélectionner un fournisseur...</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                <option value="__new__">+ Nouveau fournisseur</option>
              </select>
              {showNewSupplier && (
                <div className="mt-2 flex flex-col gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <input value={newSupplier.name} onChange={e => setNewSupplier(s => ({ ...s, name: e.target.value }))} placeholder="Nom du fournisseur" className={inputCls} autoFocus />
                  <div className="flex gap-2">
                    <input value={newSupplier.phone} onChange={e => setNewSupplier(s => ({ ...s, phone: e.target.value }))} placeholder="Téléphone" className={`${inputCls} flex-1`} />
                    <input value={newSupplier.email} onChange={e => setNewSupplier(s => ({ ...s, email: e.target.value }))} placeholder="Email" className={`${inputCls} flex-1`} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => { setShowNewSupplier(false); setNewSupplier({ name: '', phone: '', email: '' }); }} className="px-3 py-2 text-[12px] font-medium text-gray-500 hover:text-[#1a1a2e]">Annuler</button>
                    <button type="button" onClick={createSupplierInline} className="px-3 py-2 rounded-lg bg-[#22c55e] text-white text-[12px] font-semibold">Enregistrer</button>
                  </div>
                </div>
              )}
            </Field>
          </Section>

          {/* MIDDLE — Articles à commander */}
          <Section title="Articles à commander">
            <Field label="Rechercher un produit existant">
              <div className="relative">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <Search size={15} className="text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un produit existant..."
                    className="flex-1 bg-transparent text-[14px] text-[#1a1a2e] outline-none placeholder:text-gray-400"
                  />
                </div>
                {searchMatches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-[260px] overflow-y-auto">
                    {searchMatches.map(p => {
                      const stock = p.totalStock ?? 0;
                      const min = p.lowStockThreshold ?? 3;
                      const stockCls = stock <= 0 ? 'bg-[#ef4444]/15 text-[#ef4444]' : stock <= min ? 'bg-[#F5A623]/15 text-[#F5A623]' : 'bg-[#22c55e]/15 text-[#22c55e]';
                      return (
                        <div key={p.id} onClick={() => addProductItem(p)} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                          <Thumb src={p.mainImage} className="w-9 h-9" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-[#1a1a2e] font-medium truncate">{p.name}</div>
                            <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                              <BarcodeIcon className="w-3.5 h-3" /> {p.barcode || '—'}
                            </div>
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${stockCls}`}>{stock} en stock</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Field>

            {items.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center py-6">Aucun article. Recherchez un produit ci-dessus pour commencer.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((it, index) => {
                  const product = it.productId ? products.find(p => p.id === it.productId) : null;
                  return (
                    <div key={index} className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                      <Thumb src={product?.mainImage} className="w-10 h-10" />
                      <div className="flex-1 min-w-0 flex flex-col gap-1">
                        {it.isNewProduct ? (
                          <input value={it.name} onChange={e => updateItem(index, 'name', e.target.value)} placeholder="Nom de l'article" className={`${inputCls} py-1.5 text-[13px]`} />
                        ) : (
                          <span className="text-[13px] font-medium text-[#1a1a2e] truncate">{it.name}</span>
                        )}
                        {it.isNewProduct ? (
                          <input value={it.barcode} onChange={e => updateItem(index, 'barcode', e.target.value)} placeholder="Code barre (optionnel)" className={`${inputCls} py-1 text-[12px] font-mono`} />
                        ) : it.barcode ? (
                          <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                            <BarcodeIcon className="w-3.5 h-3" /> {it.barcode}
                          </div>
                        ) : null}
                      </div>

                      {!it.isNewProduct && (
                        <div className="text-center shrink-0 w-16">
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Stock</div>
                          <div className={`text-[13px] font-mono font-semibold ${(it.currentStock ?? 0) <= 0 ? 'text-[#ef4444]' : 'text-[#1a1a2e]'}`}>{it.currentStock ?? 0}</div>
                        </div>
                      )}

                      <div className="shrink-0 w-20">
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Quantité</div>
                        <input
                          type="number"
                          min={1}
                          value={it.quantityOrdered}
                          onChange={e => updateItem(index, 'quantityOrdered', parseInt(e.target.value) || 0)}
                          className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-center text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                        />
                      </div>

                      <button onClick={() => removeItem(index)} className="text-gray-400 hover:text-[#ef4444] shrink-0"><X size={15} /></button>
                    </div>
                  );
                })}
              </div>
            )}

            <button type="button" onClick={addManualItem} className="flex items-center gap-1 text-[12px] font-semibold text-[#2563eb] hover:underline self-start">
              <Plus size={12} /> Ajouter un article manuellement
            </button>
          </Section>

          {/* Notes */}
          <Section title="Notes">
            <Field label="Notes ou instructions pour le fournisseur">
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className={`${inputCls} resize-none h-24`}
                placeholder="Instructions particulières, conditions de livraison..."
              />
            </Field>
          </Section>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <button onClick={() => navigate('/admin/achats')} className="px-5 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[14px] hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        <span className="text-[13px] text-gray-500 font-medium">
          {items.length} article{items.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-3">
          <button onClick={handleSaveDraft} disabled={saving} className="px-5 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[14px] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Enregistrer brouillon
          </button>
          <button onClick={handleGeneratePdf} disabled={saving} className="px-6 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-[14px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Génération...' : 'Générer PDF'}
          </button>
        </div>
      </div>

      {/* ═══ Receive modal ═══ */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowReceive(false)}>
          <div className="bg-white rounded-2xl p-6 w-[480px] max-w-[95vw] max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-1">Réceptionner la commande</h3>
            <p className="text-[13px] text-gray-400 mb-5">Indiquez la quantité réellement reçue pour chaque article.</p>
            <div className="flex flex-col gap-3 mb-6">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[#1a1a2e] truncate">{it.name}</div>
                    <div className="text-[11px] text-gray-400">Commandé : {it.quantityOrdered}</div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={receivedQty[i] ?? 0}
                    onChange={e => setReceivedQty(q => ({ ...q, [i]: e.target.value }))}
                    className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-center text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReceive(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">Annuler</button>
              <button onClick={confirmReceive} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#22c55e] hover:brightness-110 text-white font-medium text-[13px] transition-all disabled:opacity-40 disabled:cursor-not-allowed">Confirmer la réception</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
