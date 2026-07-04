import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useClients } from '../hooks/useClients';
import { useCategories } from '../hooks/useCategories';
import { useAuth } from '../context/AuthContext';
import { usePOSCart } from '../context/POSCartContext';
import { useToast } from '../components/Toast';
import BarcodeIcon from '../components/BarcodeIcon';
import Thumb from '../components/Thumb';
import TicketReceipt from '../components/TicketReceipt';
import { getNextTicketNumber } from '../lib/ticketNumber';
import { formatPrice } from '../lib/pricing';
import { db } from '../firebase';
import { collection, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

function TrashIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function StockBadge({ stock, minStock = 3 }) {
  const s = stock ?? 0;
  const cls = s <= 0 ? 'bg-[#ef4444]' : s <= (minStock ?? 3) ? 'bg-[#F5A623]' : 'bg-[#22c55e]';
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${cls} text-white text-[11px] font-bold`}>
      {s}
    </span>
  );
}

function playErrorBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 440;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
    osc.onended = () => ctx.close();
  } catch (err) {
    console.error(err);
  }
}

export default function POS() {
  const { searchableItems, deductStock, fetchVariants, variantBarcodeIndex, products } = useProducts();
  const { clients, addClient, recordClientSale } = useClients();
  const { getCategoryName } = useCategories();
  const { userData } = useAuth();
  const cashierName = userData?.displayName || userData?.email || 'Staff';
  const toast = useToast();
  const barcodeRef = useRef(null);
  const cartBodyRef = useRef(null);
  const enregistrerRef = useRef(() => {});
  const flashTimerRef = useRef(null);

  const {
    cart, selectedClient, payType, remiseGlobalDH, montantRecu,
    setSelectedClient, setPayType, setRemiseGlobalDH, setMontantRecu,
    addToCart: ctxAddToCart, removeItem, changeQty, clearCart, loadDraft,
  } = usePOSCart();

  // UI-only state (not persisted)
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [saleLoading, setSaleLoading] = useState(false);

  // Last-added cart row — drives auto-scroll + the brief flash highlight
  const [flashState, setFlashState] = useState(null);

  // Checkout confirmation modal
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [confirmSnapshot, setConfirmSnapshot] = useState(null);

  // Client modal state
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientType, setClientType] = useState('retail');
  const [clientForm, setClientForm] = useState({ name: '', ice: '', phone: '', address: '', email: '', notes: '' });
  const [showMoreInfo, setShowMoreInfo] = useState(false);

  // Product search modal state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [pmName, setPmName] = useState('');
  const [pmNameDebounced, setPmNameDebounced] = useState('');
  const [pmPriceMin, setPmPriceMin] = useState('');
  const [pmPriceMax, setPmPriceMax] = useState('');
  const [pmSelected, setPmSelected] = useState(new Set());
  const [pmPreFilterKeys, setPmPreFilterKeys] = useState(null);

  // Variant picker (fetched on demand when a hasVariants product is chosen)
  const [variantPicker, setVariantPicker] = useState(null);

  // Barcode-not-found modal state
  const [notFoundOpen, setNotFoundOpen] = useState(false);
  const [notFoundBarcode, setNotFoundBarcode] = useState('');

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => { barcodeRef.current?.focus(); }, []);

  // Debounce the product-search name filter — avoids re-filtering on every
  // keystroke, and only takes effect once the query is meaningful (2+ chars).
  useEffect(() => {
    const t = setTimeout(() => setPmNameDebounced(pmName), 500);
    return () => clearTimeout(t);
  }, [pmName]);

  // Resume a suspended/saved draft handed off from Commandes ("Reprendre")
  useEffect(() => {
    const resumeDraft = location.state?.resumeDraft;
    if (!resumeDraft) return;
    loadDraft(resumeDraft);
    deleteDoc(doc(db, 'drafts', resumeDraft.id)).catch(console.error);
    navigate('.', { replace: true, state: {} });
    toast('Vente reprise');
  }, [location.state]);

  // Cart functions — state is in POSCartContext, this wrapper adds the toast
  // plus the auto-scroll/flash-highlight feedback so a fast-scanning cashier
  // can visually confirm each item landed in the cart.
  function addToCart(item) {
    ctxAddToCart(item);
    const label = item.variantLabel ? `${item.name} — ${item.variantLabel}` : item.name;
    toast(label.substring(0, 35) + ' ajouté');
    const key = item.productId + (item.variantId || '');
    setFlashState({ key, id: Date.now() });
  }

  // Scroll the cart to the newly added row and flash it, on every addToCart —
  // keyed off flashState.id (not the row key) so repeated scans of the same
  // item still re-trigger the scroll + flash each time.
  useEffect(() => {
    if (!flashState) return;
    if (cartBodyRef.current) {
      cartBodyRef.current.scrollTo({ top: cartBodyRef.current.scrollHeight, behavior: 'smooth' });
    }
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashState(null), 1000);
    return () => clearTimeout(flashTimerRef.current);
  }, [flashState?.id]);

  // Build a cart line from a product + a specific variant — used wherever a
  // hasVariants product is resolved to one exact variant (barcode scan or picker)
  function addVariantToCart(product, variant) {
    addToCart({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantLabel: variant.label || Object.values(variant.options || {}).join(' / '),
      barcode: variant.barcode || product.barcode || '',
      sku: variant.sku || product.sku || '',
      priceSell: variant.priceSell ?? product.basePriceSell ?? 0,
      priceCost: variant.priceCost ?? product.basePriceCost ?? 0,
      stock: variant.stock ?? 0,
      minStock: variant.minStock ?? product.lowStockThreshold ?? 3,
      image: variant.image || product.mainImage || '',
      famille: product.categoryPath?.[0] || product.famille || '',
      isManuel: product.isManuel || false,
    });
  }

  // Fetch variants on demand — only happens when staff actually picks a
  // hasVariants product to add to the cart, never during search/listing.
  async function openVariantPicker(item) {
    setVariantPicker({ item, variants: [], loading: true });
    const variants = await fetchVariants(item.productId);
    setVariantPicker({ item, variants, loading: false });
  }

  function pickVariant(variant) {
    if ((variant.stock ?? 0) <= 0) return;
    addVariantToCart(variantPicker.item.product, variant);
    setVariantPicker(null);
  }

  function closeVariantPicker() {
    setVariantPicker(null);
  }

  function clearAndRefocusBarcode() {
    setBarcodeQuery('');
    barcodeRef.current?.focus();
  }

  function variantsForProduct(productId) {
    return variantBarcodeIndex.filter(v => v.productId === productId);
  }

  // A hasVariants product scanned by its own (product-level) barcode: at the
  // POS counter variant choice doesn't matter unless it changes the price — so
  // only pop the picker when variants actually disagree on price. Otherwise
  // just add the base product and bump quantity, exactly like a simple item.
  function handleExactProductBarcodeMatch(item) {
    if (!item.hasVariants) { addToCart(item); return; }
    const variants = variantsForProduct(item.productId);
    if (variants.length === 0) { addToCart(item); return; }
    const prices = variants.map(v => v.priceSell ?? item.priceSell ?? 0);
    const samePrice = prices.every(p => p === prices[0]);
    if (samePrice) { addToCart(item); return; }
    setVariantPicker({ item, variants, loading: false });
  }

  // Barcode scan / entry — search order: exact product barcode, exact variant
  // barcode, partial (last 6 then last 3 digits) match across both, else the
  // unmissable not-found alert.
  function handleBarcodeKeyDown(e) {
    if (e.key !== 'Enter') return;
    const q = barcodeQuery.trim();
    if (!q) return;

    const exact = searchableItems.find(i => i.barcode && i.barcode === q);
    if (exact) {
      handleExactProductBarcodeMatch(exact);
      clearAndRefocusBarcode();
      return;
    }

    const exactVariant = variantBarcodeIndex.find(v => v.barcode && v.barcode === q);
    if (exactVariant) {
      const product = products.find(p => p.id === exactVariant.productId);
      if (product) {
        addVariantToCart(product, exactVariant);
        clearAndRefocusBarcode();
        return;
      }
    }

    let matches = [];
    for (const len of [6, 3]) {
      const suffix = q.slice(-len);
      if (suffix.length !== len) continue;
      const productMatches = searchableItems.filter(i => i.barcode && i.barcode.slice(-len) === suffix);
      const variantMatches = variantBarcodeIndex
        .filter(v => v.barcode && v.barcode.slice(-len) === suffix)
        .map(v => ({ ...v, isVariantMatch: true }));
      matches = [...productMatches, ...variantMatches];
      if (matches.length > 0) break;
    }

    if (matches.length === 1) {
      const m = matches[0];
      if (m.isVariantMatch) {
        const product = products.find(p => p.id === m.productId);
        if (product) { addVariantToCart(product, m); clearAndRefocusBarcode(); return; }
      } else {
        handleExactProductBarcodeMatch(m);
        clearAndRefocusBarcode();
        return;
      }
    } else if (matches.length > 1) {
      setPmPreFilterKeys(new Set(matches.map(m => m.productId)));
      setPmName(''); setPmNameDebounced(''); setPmPriceMin(''); setPmPriceMax(''); setPmSelected(new Set());
      setProductModalOpen(true);
      setBarcodeQuery('');
      return;
    }

    // No match anywhere — staff must be alerted loudly, scanning the next item silently is not allowed
    playErrorBeep();
    setNotFoundBarcode(q);
    setNotFoundOpen(true);
    setBarcodeQuery('');
  }

  function closeNotFoundModal() {
    setNotFoundOpen(false);
    setTimeout(() => barcodeRef.current?.focus(), 0);
  }

  // Auto-close the not-found alert after 5s so a distracted cashier isn't stuck
  useEffect(() => {
    if (!notFoundOpen) return;
    const t = setTimeout(() => closeNotFoundModal(), 5000);
    return () => clearTimeout(t);
  }, [notFoundOpen]);

  function addNotFoundAsNewProduct() {
    const barcode = notFoundBarcode;
    setNotFoundOpen(false);
    navigate('/admin/produits/nouveau', { state: { prefillBarcode: barcode } });
  }

  // Calculations
  function getItemTotal(item) {
    return item.priceSell * item.qty * (1 - item.remise / 100);
  }

  const subtotal = cart.reduce((s, i) => s + i.priceSell * i.qty, 0);
  const afterItemRemise = cart.reduce((s, i) => s + getItemTotal(i), 0);
  const remiseGlobalApplied = Math.min(Math.max(0, remiseGlobalDH || 0), afterItemRemise);
  const grandTotal = afterItemRemise - remiseGlobalApplied;
  const totalDiscount = subtotal - grandTotal;
  const discountPercentEquivalent = subtotal > 0 ? Math.round((totalDiscount / subtotal) * 10000) / 100 : 0;
  const resteAPayer = Math.max(0, grandTotal - (parseFloat(montantRecu) || 0));
  const aRendre = Math.max(0, (parseFloat(montantRecu) || 0) - grandTotal);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  // Client modal
  function openClientModal() {
    setClientType('retail');
    setClientForm({ name: '', ice: '', phone: '', address: '', email: '', notes: '' });
    setShowMoreInfo(false);
    setClientModalOpen(true);
    setShowClientDropdown(false);
  }

  async function saveNewClient() {
    if (!clientForm.name.trim()) { toast('Nom requis', 'error'); return; }
    if (!clientForm.phone.trim()) { toast('Téléphone requis', 'error'); return; }
    if (clientType === 'business' && !clientForm.ice.trim()) { toast('ICE requis', 'error'); return; }
    try {
      const id = await addClient({
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        ice: clientForm.ice.trim(),
        type: clientType,
        address: clientForm.address.trim(),
        email: clientForm.email.trim(),
        notes: clientForm.notes.trim(),
      });
      setSelectedClient({ id, name: clientForm.name.trim(), phone: clientForm.phone.trim(), ice: clientForm.ice.trim(), type: clientType });
      setClientModalOpen(false);
      toast(`${clientForm.name} ajouté`);
    } catch (err) {
      console.error(err);
      toast('Erreur lors de l\'ajout du client', 'error');
    }
  }

  // Product search modal
  function openProductModal() {
    setPmName(''); setPmNameDebounced(''); setPmPriceMin(''); setPmPriceMax(''); setPmSelected(new Set());
    setPmPreFilterKeys(null);
    setProductModalOpen(true);
  }

  function closeProductModal() {
    setProductModalOpen(false);
    setPmPreFilterKeys(null);
    setTimeout(() => barcodeRef.current?.focus(), 0);
  }

  const pmFiltered = searchableItems.filter(i => {
    if (pmPreFilterKeys && !pmPreFilterKeys.has(i.productId + (i.variantId || ''))) return false;
    const nameQuery = pmNameDebounced.trim();
    if (nameQuery.length >= 2) {
      const words = nameQuery.toLowerCase().split(/\s+/).filter(Boolean);
      const haystack = [i.name, i.barcode, i.brand, ...(i.tags || [])].filter(Boolean).join(' ').toLowerCase();
      if (!words.every(w => haystack.includes(w))) return false;
    }
    const min = parseFloat(pmPriceMin);
    const max = parseFloat(pmPriceMax);
    if (!isNaN(min) && i.priceSell < min) return false;
    if (!isNaN(max) && i.priceSell > max) return false;
    return true;
  });

  function toggleSelect(key) {
    setPmSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function addSelectedToCart() {
    const items = searchableItems.filter(i => pmSelected.has(i.productId + (i.variantId || '')));
    items.forEach(addToCart);
    closeProductModal();
  }

  // Record sale — returns true on success, false on failure
  async function enregistrerVente(ticketNumber) {
    if (!cart.length) { toast('Le panier est vide', 'error'); return false; }
    setSaleLoading(true);
    try {
      const saleRef = doc(collection(db, 'sales'));
      const saleData = {
        saleNumber: ticketNumber,
        cashierName,
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || 'CLIENT COMPTOIR',
        clientPhone: selectedClient?.phone || '',
        clientICE: selectedClient?.ice || '',
        clientType: selectedClient?.type || 'retail',
        subtotal,
        discountAmount: totalDiscount,
        discountPercent: discountPercentEquivalent,
        total: grandTotal,
        paymentMethod: payType,
        amountReceived: parseFloat(montantRecu) || grandTotal,
        change: aRendre,
        itemsCount: totalItems,
        status: 'completed',
        source: 'pos',
        createdAt: serverTimestamp(),
      };
      await setDoc(saleRef, saleData);

      for (const item of cart) {
        const itemRef = doc(collection(db, 'sales', saleRef.id, 'saleItems'));
        await setDoc(itemRef, {
          saleId: saleRef.id,
          productId: item.productId,
          variantId: item.variantId || null,
          name: item.name,
          variantLabel: item.variantLabel || '',
          barcode: item.barcode || '',
          quantity: item.qty,
          unitPrice: item.priceSell,
          discountPercent: item.remise,
          totalPrice: getItemTotal(item),
          costPrice: item.priceCost || 0,
        });
      }

      await deductStock(cart);

      if (selectedClient?.id) {
        await recordClientSale(selectedClient.id, grandTotal);
      }

      toast(`Vente ${ticketNumber} enregistrée — ${formatPrice(grandTotal)}`);
      clearCart();
      setSaleLoading(false);
      return true;
    } catch (err) {
      console.error(err);
      toast('Erreur lors de l\'enregistrement', 'error');
      setSaleLoading(false);
      return false;
    }
  }

  // Checkout confirmation
  async function openConfirmModal() {
    if (!cart.length) { toast('Le panier est vide', 'error'); return; }
    const ticketNumber = await getNextTicketNumber();
    setConfirmSnapshot({
      ticketNumber,
      date: new Date(),
      clientName: selectedClient?.name || 'CLIENT COMPTOIR',
      items: cart.map(i => ({ ...i })),
      subtotal,
      discountAmount: totalDiscount,
      total: grandTotal,
      paymentMethod: payType,
      amountReceived: parseFloat(montantRecu) || grandTotal,
      change: aRendre,
    });
    setConfirmModalOpen(true);
  }

  function closeConfirmModal() {
    setConfirmModalOpen(false);
    setConfirmSnapshot(null);
  }

  async function handleConfirmAndPrint() {
    const ok = await enregistrerVente(confirmSnapshot.ticketNumber);
    if (ok) {
      window.print();
      closeConfirmModal();
    }
  }

  async function handleConfirmNoPrint() {
    const ok = await enregistrerVente(confirmSnapshot.ticketNumber);
    if (ok) closeConfirmModal();
  }

  useEffect(() => { enregistrerRef.current = openConfirmModal; });

  // F5 keyboard shortcut → open checkout confirmation
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'F5') {
        e.preventDefault();
        enregistrerRef.current();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function draftPayload(status) {
    return {
      cart: cart.map(item => ({
        productId: item.productId,
        variantId: item.variantId || null,
        name: item.name,
        variantLabel: item.variantLabel || '',
        barcode: item.barcode || '',
        sku: item.sku || '',
        priceSell: item.priceSell,
        priceCost: item.priceCost || 0,
        qty: item.qty,
        remise: item.remise || 0,
        stock: item.stock ?? 0,
        minStock: item.minStock ?? 3,
        image: item.image || '',
        famille: item.famille || '',
      })),
      clientId: selectedClient?.id || null,
      clientName: selectedClient?.name || 'CLIENT COMPTOIR',
      clientPhone: selectedClient?.phone || '',
      clientICE: selectedClient?.ice || '',
      clientType: selectedClient?.type || 'retail',
      remiseGlobalDH,
      payType,
      montantRecu,
      subtotal,
      total: grandTotal,
      status,
      createdAt: serverTimestamp(),
    };
  }

  async function sauvegarderVente() {
    if (!cart.length) { toast('Le panier est vide', 'error'); return; }
    try {
      await setDoc(doc(collection(db, 'drafts')), draftPayload('saved'));
      toast('Vente sauvegardée');
      clearCart();
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la sauvegarde', 'error');
    }
  }

  async function suspendSale() {
    if (!cart.length) { toast('Le panier est vide', 'error'); return; }
    try {
      await setDoc(doc(collection(db, 'drafts')), draftPayload('suspended'));
      toast('Vente suspendue');
      clearCart();
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la mise en suspens', 'error');
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-[#f5f6fa]">

      {/* ═══ TOP BAR ═══ */}
      <div className="h-20 shrink-0 flex items-center gap-6 px-6 bg-white border-b border-gray-200">

        {/* Client section */}
        <div className="relative w-72 shrink-0">
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Client</label>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClientDropdown(s => !s)}
              className="flex-1 flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-left hover:border-gray-300 transition-colors"
            >
              <span className="text-[13px] font-medium text-[#1a1a2e] truncate">
                {selectedClient ? selectedClient.name : 'CLIENT COMPTOIR'}
              </span>
              <span className="text-gray-400 text-xs shrink-0">▾</span>
            </button>
            <button
              onClick={openClientModal}
              title="Nouveau client"
              className="w-10 h-10 shrink-0 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center text-lg font-bold transition-colors"
            >
              +
            </button>
          </div>

          {showClientDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg overflow-hidden z-30 max-h-[220px] overflow-y-auto shadow-2xl">
              <div
                onClick={() => { setSelectedClient(null); setShowClientDropdown(false); }}
                className="px-3 py-2 text-[13px] text-gray-500 cursor-pointer hover:bg-gray-50 border-b border-gray-100"
              >
                CLIENT COMPTOIR (sans client)
              </div>
              {clients.map(c => (
                <div
                  key={c.id}
                  onClick={() => { setSelectedClient(c); setShowClientDropdown(false); }}
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-[13px] font-medium text-[#1a1a2e]">{c.name}</div>
                  <div className="text-[11px] text-gray-400">
                    {c.phone && c.phone + ' · '}
                    {c.ice && 'ICE: ' + c.ice}
                    {!c.phone && !c.ice && c.type}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Barcode section */}
        <div className="flex-1 flex items-end gap-2">
          <div className="flex-1">
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Code-barres</label>
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus-within:border-[#2563eb] transition-colors">
              <BarcodeIcon className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                ref={barcodeRef}
                type="text"
                value={barcodeQuery}
                onChange={e => setBarcodeQuery(e.target.value)}
                onKeyDown={handleBarcodeKeyDown}
                placeholder="Scanner le code-barres complet ou 6 chiffres..."
                className="flex-1 bg-transparent text-[#1a1a2e] text-[14px] font-medium outline-none placeholder:text-gray-400"
                autoComplete="off"
              />
            </div>
          </div>
          <button
            onClick={openProductModal}
            title="Rechercher un article"
            className="w-11 h-11 shrink-0 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white flex items-center justify-center text-xl font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* ═══ CONTENT ROW ═══ */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">

        {/* ─── CENTER — Cart ─── */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 shrink-0">
            <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Produits de la vente</h2>
          </div>

          <div ref={cartBodyRef} className="flex-1 overflow-y-auto px-5">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                <div className="text-4xl mb-3 opacity-30">🛒</div>
                Scannez ou cherchez un article pour commencer
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="text-left pb-2 w-8">#</th>
                    <th className="text-left pb-2 w-28">Code-barre</th>
                    <th className="text-left pb-2">Article</th>
                    <th className="text-center pb-2 w-14">Stock</th>
                    <th className="text-center pb-2 w-24">Qté</th>
                    <th className="text-right pb-2 w-20">Prix Unit.</th>
                    <th className="text-right pb-2 w-24">Total</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {cart.map((item, i) => {
                    const rowKey = item.productId + (item.variantId || '');
                    const isFlashing = flashState?.key === rowKey;
                    return (
                    <tr key={i} className={`border-t border-gray-100 hover:bg-gray-50 group ${isFlashing ? 'cart-row-flash' : ''}`}>
                      <td className="py-2.5 text-[12px] text-gray-400 font-mono">{i + 1}</td>
                      <td className="py-2.5 font-mono text-[11px] text-gray-400">{item.barcode}</td>
                      <td className="py-2.5 max-w-[220px]">
                        <div className="flex items-center gap-2">
                          <Thumb src={item.image} />
                          <div className="min-w-0">
                            <div className="font-medium text-[13px] text-[#1a1a2e] truncate">
                              {item.name}{item.variantLabel && <span className="text-gray-400 font-normal"> — {item.variantLabel}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <StockBadge stock={item.stock} minStock={item.minStock} />
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => changeQty(i, -1)} className="w-6 h-6 rounded-md border border-gray-200 bg-gray-50 text-gray-700 flex items-center justify-center text-sm hover:bg-[#2563eb] hover:border-[#2563eb] hover:text-white transition-colors">−</button>
                          <span className="font-mono text-[13px] w-6 text-center text-[#1a1a2e]">{item.qty}</span>
                          <button
                            onClick={() => changeQty(i, 1)}
                            disabled={item.stock > 0 && item.qty >= item.stock}
                            className="w-6 h-6 rounded-md border border-gray-200 bg-gray-50 text-gray-700 flex items-center justify-center text-sm hover:bg-[#2563eb] hover:border-[#2563eb] hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >+</button>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-[13px] text-gray-700">{formatPrice(item.priceSell)}</td>
                      <td className="py-2.5 text-right font-mono text-[13px] font-semibold text-[#1a1a2e]">{formatPrice(getItemTotal(item))}</td>
                      <td className="py-2.5 text-center">
                        <button onClick={() => removeItem(i)} className="text-[#ef4444] opacity-0 group-hover:opacity-100 transition-opacity">
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="shrink-0 flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-[13px] text-gray-500 font-medium">
              {totalItems} article{totalItems > 1 ? 's' : ''}
            </span>
            <button
              onClick={clearCart}
              disabled={!cart.length}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[#ef4444] border border-[#ef4444]/30 rounded-lg px-3 py-1.5 hover:bg-[#ef4444]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <TrashIcon className="w-3.5 h-3.5" /> Vider la liste
            </button>
          </div>
        </div>

        {/* ─── RIGHT — Sale Summary ─── */}
        <div className="w-[300px] bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-4 overflow-y-auto shrink-0">
          <h2 className="text-[12px] font-bold text-gray-400 uppercase tracking-wider">Résumé de la vente</h2>

          {/* Global Discount (DH) */}
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-gray-600 flex-1">Remise (DH)</span>
            <input
              type="number"
              value={remiseGlobalDH || ''}
              onChange={e => setRemiseGlobalDH(Math.max(0, parseFloat(e.target.value) || 0))}
              placeholder="0"
              className="w-20 bg-gray-50 border border-gray-200 rounded-lg font-mono text-sm text-center py-2 outline-none focus:border-[#2563eb] text-[#1a1a2e]"
              min="0"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-500">Sous-total</span>
              <span className="font-mono font-medium text-[#1a1a2e]">{formatPrice(subtotal)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">Remise</span>
                <span className="font-mono font-medium text-[#ef4444]">-{formatPrice(totalDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-[13px]">
              <span className="text-gray-500">TVA (20%)</span>
              <span className="font-mono font-medium text-gray-400">Inclus</span>
            </div>
          </div>

          <div className="bg-[#1e2956] rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-[14px] font-bold text-white">TOTAL TTC</span>
            <span className="text-xl font-bold font-mono text-white">{formatPrice(grandTotal)}</span>
          </div>

          <div className="h-px bg-gray-100" />

          {/* Payment Type */}
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Paiement</label>
            <div className="flex gap-2">
              {['Espèce', 'TPE'].map(type => (
                <button
                  key={type}
                  onClick={() => setPayType(type)}
                  className={`flex-1 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                    payType === type
                      ? 'bg-[#2563eb]/10 border-[#2563eb] text-[#2563eb]'
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:text-[#1a1a2e]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {payType === 'Espèce' && (
            <div>
              <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">Montant reçu</label>
              <input
                type="number"
                value={montantRecu}
                onChange={e => setMontantRecu(e.target.value)}
                placeholder="0,00"
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-[14px] text-[#1a1a2e] outline-none focus:border-[#2563eb] transition-colors"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5 text-[13px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Reste à payer</span>
              <span className="font-mono font-medium text-[#22c55e]">{formatPrice(resteAPayer)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">À rendre</span>
              <span className="font-mono font-medium text-[#22c55e]">{formatPrice(aRendre)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-auto flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={sauvegarderVente} disabled={!cart.length} className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">💾 Sauvegarder</button>
              <button onClick={suspendSale} disabled={!cart.length} className="flex items-center justify-center gap-1.5 border border-gray-200 rounded-lg py-2 text-[12px] font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">⏸ Suspendre</button>
            </div>
            <button
              onClick={openConfirmModal}
              disabled={!cart.length || saleLoading}
              className="w-full py-3.5 rounded-xl text-[15px] font-bold bg-[#F5A623] hover:bg-[#dc9018] text-[#1a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saleLoading ? '⏳ Encaissement...' : '✓ Encaisser (F5)'}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ Client Modal ═══ */}
      {clientModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setClientModalOpen(false)}>
          <div className="bg-white rounded-2xl p-6 w-[420px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">Ajouter un client</h3>

            <div className="flex gap-2 mb-4 bg-gray-100 rounded-lg p-1">
              {[{ v: 'retail', l: 'Particulier' }, { v: 'business', l: 'Société' }].map(opt => (
                <button
                  key={opt.v}
                  onClick={() => setClientType(opt.v)}
                  className={`flex-1 py-2 rounded-md text-[13px] font-medium transition-all ${
                    clientType === opt.v ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {opt.l}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">
                  {clientType === 'business' ? 'Nom / Raison sociale *' : 'Nom *'}
                </label>
                <input
                  value={clientForm.name}
                  onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#2563eb]"
                  placeholder={clientType === 'business' ? 'Raison sociale' : 'Nom du client'}
                  autoFocus
                />
              </div>

              {clientType === 'business' && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">ICE *</label>
                  <input
                    value={clientForm.ice}
                    onChange={e => setClientForm(f => ({ ...f, ice: e.target.value }))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 font-mono text-[14px] text-[#1a1a2e] outline-none focus:border-[#2563eb]"
                    placeholder="Identifiant Commun de l'Entreprise"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Téléphone *</label>
                <input
                  value={clientForm.phone}
                  onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#2563eb]"
                  placeholder="+212 6XX-XXXXXX"
                />
              </div>

              <button
                onClick={() => setShowMoreInfo(s => !s)}
                className="text-left text-[12px] font-semibold text-[#2563eb] hover:underline"
              >
                {showMoreInfo ? '− Moins d\'informations' : '+ Plus d\'informations'}
              </button>

              {showMoreInfo && (
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Adresse</label>
                    <input
                      value={clientForm.address}
                      onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#2563eb]"
                      placeholder="Adresse (pour facture)"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Email</label>
                    <input
                      type="email"
                      value={clientForm.email}
                      onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#2563eb]"
                      placeholder="email@exemple.com"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Notes</label>
                    <textarea
                      value={clientForm.notes}
                      onChange={e => setClientForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-[14px] text-[#1a1a2e] outline-none focus:border-[#2563eb] resize-none h-20"
                      placeholder="Notes internes..."
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setClientModalOpen(false)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">
                Annuler
              </button>
              <button onClick={saveNewClient} className="flex-1 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-[13px] transition-colors">
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Product Search Modal ═══ */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={closeProductModal}>
          <div className="bg-white rounded-2xl p-6 w-[680px] max-w-[95vw] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-4 shrink-0">Rechercher un article</h3>

            <div className="flex gap-3 mb-4 shrink-0">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Nom de l'article</label>
                <input
                  value={pmName}
                  onChange={e => setPmName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-[13px] text-[#1a1a2e] outline-none focus:border-[#2563eb]"
                  placeholder="Rechercher par nom..."
                />
              </div>
              <div className="w-48">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Prix</label>
                <div className="flex gap-2">
                  <input type="number" value={pmPriceMin} onChange={e => setPmPriceMin(e.target.value)} placeholder="Min" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-[13px] text-[#1a1a2e] outline-none focus:border-[#2563eb]" />
                  <input type="number" value={pmPriceMax} onChange={e => setPmPriceMax(e.target.value)} placeholder="Max" className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-[13px] text-[#1a1a2e] outline-none focus:border-[#2563eb]" />
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto border border-gray-100 rounded-xl">
              <table className="w-full">
                <thead>
                  <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider sticky top-0 bg-white border-b border-gray-100">
                    <th className="p-3 w-8"></th>
                    <th className="text-left p-3">Article</th>
                    <th className="text-left p-3 w-44">Catégorie / Code</th>
                    <th className="text-center p-3 w-16">Stock</th>
                    <th className="text-right p-3 w-24">Prix</th>
                  </tr>
                </thead>
                <tbody>
                  {pmFiltered.map(item => {
                    const key = item.productId + (item.variantId || '');
                    const catName = getCategoryName(item.famille);
                    const optionArrays = Object.values(item.product?.variantOptions || {});
                    const variantCount = item.hasVariants && optionArrays.length > 0
                      ? optionArrays.reduce((a, arr) => a * arr.length, 1) : 0;

                    if (item.hasVariants) {
                      return (
                        <tr key={key} onClick={() => { openVariantPicker(item); closeProductModal(); }} className="border-t border-gray-100 cursor-pointer hover:bg-gray-50">
                          <td className="p-3"><ChevronRight className="w-4 h-4 text-gray-400" /></td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <Thumb src={item.image} className="w-9 h-9 shrink-0" />
                              <div className="min-w-0">
                                <div className="text-[13px] font-medium text-[#1a1a2e] leading-snug">{item.name}</div>
                                {item.brand && <div className="text-[11px] text-gray-400 mt-0.5">{item.brand}</div>}
                                <div className="flex items-center gap-1 mt-1 flex-wrap">
                                  <span className="text-[10px] text-[#F5A623] bg-[#F5A623]/10 px-1.5 py-0.5 rounded">
                                    {variantCount > 0 ? `${variantCount} variantes` : 'Variantes'}
                                  </span>
                                  {item.isManuel && <span className="text-[10px] text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.5 rounded">Manuel</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-1">
                              {catName && <span className="text-[10px] font-medium text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded-full w-fit">{catName}</span>}
                              <span className="font-mono text-[11px] text-gray-400">{item.barcode || '—'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center"><StockBadge stock={item.stock} minStock={item.minStock} /></td>
                          <td className="p-3 text-right font-mono text-[13px] text-[#1a1a2e]">{formatPrice(item.priceSell)}</td>
                        </tr>
                      );
                    }
                    const checked = pmSelected.has(key);
                    return (
                      <tr key={key} onClick={() => toggleSelect(key)} className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${checked ? 'bg-[#2563eb]/5' : ''}`}>
                        <td className="p-3">
                          <input type="checkbox" checked={checked} onChange={() => toggleSelect(key)} onClick={e => e.stopPropagation()} className="w-4 h-4 accent-[#2563eb]" />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <Thumb src={item.image} className="w-9 h-9 shrink-0" />
                            <div className="min-w-0">
                              <div className="text-[13px] font-medium text-[#1a1a2e] leading-snug">
                                {item.name}{item.variantLabel && <span className="text-gray-400 font-normal"> — {item.variantLabel}</span>}
                              </div>
                              {item.brand && <div className="text-[11px] text-gray-400 mt-0.5">{item.brand}</div>}
                              {item.isManuel && <div className="mt-1"><span className="text-[10px] text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.5 rounded">Manuel</span></div>}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            {catName && <span className="text-[10px] font-medium text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded-full w-fit">{catName}</span>}
                            <span className="font-mono text-[11px] text-gray-400">{item.barcode || '—'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center"><StockBadge stock={item.stock} minStock={item.minStock} /></td>
                        <td className="p-3 text-right font-mono text-[13px] text-[#1a1a2e]">{formatPrice(item.priceSell)}</td>
                      </tr>
                    );
                  })}
                  {pmFiltered.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-400 text-sm">Aucun article trouvé.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4 shrink-0">
              <span className="text-[13px] text-gray-500">{pmSelected.size} article{pmSelected.size > 1 ? 's' : ''} sélectionné{pmSelected.size > 1 ? 's' : ''}</span>
              <div className="flex gap-3">
                <button onClick={closeProductModal} className="px-5 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">
                  Fermer
                </button>
                <button onClick={addSelectedToCart} disabled={!pmSelected.size} className="px-5 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  Ajouter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Variant Picker Modal (variants fetched on demand) ═══ */}
      {variantPicker && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={closeVariantPicker}>
          <div className="bg-white rounded-2xl p-6 w-[420px] max-w-[95vw] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-1">{variantPicker.item.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Choisissez une variante</p>
            <div className="flex-1 overflow-y-auto flex flex-col gap-2">
              {variantPicker.loading ? (
                <p className="text-sm text-gray-400 text-center py-6">Chargement des variantes...</p>
              ) : variantPicker.variants.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucune variante disponible.</p>
              ) : variantPicker.variants.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => pickVariant(v)}
                  disabled={(v.stock ?? 0) <= 0}
                  className="flex items-center justify-between gap-3 border border-gray-200 rounded-lg px-3 py-2.5 text-left hover:border-[#2563eb] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-[#1a1a2e] truncate">{v.label || Object.values(v.options || {}).join(' / ')}</div>
                    <div className="text-[11px] text-gray-400">Stock: {v.stock ?? 0}</div>
                  </div>
                  <span className="font-mono text-[13px] font-semibold text-[#1a1a2e] shrink-0">{formatPrice(v.priceSell ?? variantPicker.item.priceSell)}</span>
                </button>
              ))}
            </div>
            <button onClick={closeVariantPicker} className="mt-4 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* ═══ Barcode Not Found Modal — unmissable, blocks the screen ═══ */}
      {notFoundOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[80]" onClick={closeNotFoundModal}>
          <div className="bg-white rounded-2xl p-6 w-[420px] max-w-[95vw] border-4 border-[#ef4444] shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center mb-4">
              <span className="w-16 h-16 rounded-full bg-[#ef4444]/10 text-[#ef4444] flex items-center justify-center text-4xl mb-3 shrink-0">⚠</span>
              <h3 className="text-xl font-bold text-[#1a1a2e]">Code barre introuvable</h3>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 mb-3 text-center">
              <span className="font-mono text-[16px] text-[#1a1a2e]">{notFoundBarcode}</span>
            </div>
            <p className="text-sm text-gray-600 text-center mb-6">Cet article n'existe pas dans le système.</p>
            <div className="flex gap-3">
              <button onClick={closeNotFoundModal} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">
                Réessayer
              </button>
              <button onClick={addNotFoundAsNewProduct} className="flex-1 py-2.5 rounded-lg bg-[#F5A623] hover:bg-[#dc9018] text-[#1a1a2e] font-semibold text-[13px] transition-colors">
                Ajouter ce produit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Checkout Confirmation Modal ═══ */}
      {confirmModalOpen && confirmSnapshot && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={closeConfirmModal}>
          <div className="bg-white rounded-2xl p-6 w-[400px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-4">Confirmer la vente</h3>

            <TicketReceipt
              type="pos"
              ticketNumber={confirmSnapshot.ticketNumber}
              date={confirmSnapshot.date}
              cashierName={cashierName}
              clientName={confirmSnapshot.clientName}
              items={confirmSnapshot.items.map(item => ({
                name: item.name,
                variantLabel: item.variantLabel,
                qty: item.qty,
                unitPrice: item.priceSell,
                totalPrice: getItemTotal(item),
              }))}
              subtotal={confirmSnapshot.subtotal}
              discountAmount={confirmSnapshot.discountAmount}
              total={confirmSnapshot.total}
              paymentMethod={confirmSnapshot.paymentMethod}
              amountReceived={confirmSnapshot.amountReceived}
              change={confirmSnapshot.change}
            />

            <div className="flex flex-col gap-2 mt-5">
              <button
                onClick={handleConfirmAndPrint}
                disabled={saleLoading}
                className="w-full py-3 rounded-xl text-[14px] font-bold bg-[#F5A623] hover:bg-[#dc9018] text-[#1a1a2e] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saleLoading ? '⏳ Enregistrement...' : '🖨 Confirmer & Imprimer'}
              </button>
              <button
                onClick={handleConfirmNoPrint}
                disabled={saleLoading}
                className="w-full py-2.5 rounded-xl text-[13px] font-semibold border border-gray-300 text-[#1a1a2e] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirmer
              </button>
              <button
                onClick={closeConfirmModal}
                disabled={saleLoading}
                className="text-[12px] text-gray-400 hover:text-gray-600 hover:underline mt-1"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
