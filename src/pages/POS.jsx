import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { useClients } from '../hooks/useClients';
import { useToast } from '../components/Toast';
import { db } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function POS() {
  const { isAdmin } = useAuth();
  const { searchableItems, loading: prodLoading, deductStock } = useProducts();
  const { clients, recordClientSale } = useClients();
  const toast = useToast();
  const searchRef = useRef(null);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [cart, setCart] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearch, setClientSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [remiseGlobal, setRemiseGlobal] = useState(0);
  const [payType, setPayType] = useState('Espèce');
  const [montantRecu, setMontantRecu] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptType, setReceiptType] = useState('ticket');
  const [lastSale, setLastSale] = useState(null);
  const [saleLoading, setSaleLoading] = useState(false);

  // Focus search on load
  useEffect(() => { searchRef.current?.focus(); }, []);

  // Search logic
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) { setSearchResults([]); setShowResults(false); return; }

    // Exact barcode match → add directly
    const exact = searchableItems.find(i =>
      i.barcode && i.barcode.toLowerCase() === q
    );
    if (exact) {
      addToCart(exact);
      setSearchQuery('');
      setShowResults(false);
      return;
    }

    // Fuzzy search
    const results = searchableItems.filter(i =>
      (i.barcode && i.barcode.toLowerCase().includes(q)) ||
      i.name.toLowerCase().includes(q) ||
      (i.variantLabel && i.variantLabel.toLowerCase().includes(q)) ||
      (i.sku && i.sku.toLowerCase().includes(q)) ||
      (i.famille && i.famille.toLowerCase().includes(q))
    ).slice(0, 8);

    setSearchResults(results);
    setShowResults(results.length > 0);
  }, [searchQuery, searchableItems]);

  // Cart functions
  function addToCart(item) {
    setCart(prev => {
      const key = item.productId + (item.variantId || '');
      const existing = prev.find(c => (c.productId + (c.variantId || '')) === key);
      if (existing) {
        return prev.map(c =>
          (c.productId + (c.variantId || '')) === key
            ? { ...c, qty: c.qty + 1 }
            : c
        );
      }
      return [...prev, { ...item, qty: 1, remise: 0 }];
    });
    const label = item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name;
    toast(label.substring(0, 35) + ' ajouté');
  }

  function changeQty(index, delta) {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], qty: updated[index].qty + delta };
      if (updated[index].qty <= 0) updated.splice(index, 1);
      return updated;
    });
  }

  function setItemRemise(index, val) {
    setCart(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], remise: Math.min(100, Math.max(0, parseFloat(val) || 0)) };
      return updated;
    });
  }

  function removeItem(index) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  function clearCart() {
    setCart([]);
    setSelectedClient(null);
    setClientSearch('');
    setRemiseGlobal(0);
    setMontantRecu('');
  }

  // Calculations
  function getItemTotal(item) {
    return item.priceSell * item.qty * (1 - item.remise / 100);
  }

  const subtotal = cart.reduce((s, i) => s + i.priceSell * i.qty, 0);
  const afterItemRemise = cart.reduce((s, i) => s + getItemTotal(i), 0);
  const globalDiscount = afterItemRemise * (remiseGlobal / 100);
  const grandTotal = afterItemRemise - globalDiscount;
  const totalDiscount = subtotal - grandTotal;
  const monnaie = Math.max(0, (parseFloat(montantRecu) || 0) - grandTotal);
  const totalItems = cart.reduce((s, i) => s + i.qty, 0);

  // Format
  function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' DH'; }

  // Client selection
  const filteredClients = clientSearch.trim()
    ? clients.filter(c =>
        c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
        (c.phone && c.phone.includes(clientSearch)) ||
        (c.ice && c.ice.includes(clientSearch))
      ).slice(0, 5)
    : clients.slice(0, 5);

  // Record sale
  async function enregistrerVente() {
    if (!cart.length) { toast('Le panier est vide', 'error'); return; }
    setSaleLoading(true);
    try {
      const saleRef = doc(collection(db, 'sales'));
      const saleNum = 'FAC-' + Date.now().toString().slice(-6);
      const saleData = {
        saleNumber: saleNum,
        clientId: selectedClient?.id || null,
        clientName: selectedClient?.name || 'CLIENT COMPTOIRE',
        clientPhone: selectedClient?.phone || '',
        clientICE: selectedClient?.ice || '',
        clientType: selectedClient?.type || 'retail',
        subtotal,
        discountAmount: totalDiscount,
        discountPercent: remiseGlobal,
        total: grandTotal,
        paymentMethod: payType,
        amountReceived: parseFloat(montantRecu) || grandTotal,
        change: monnaie,
        status: 'completed',
        source: 'pos',
        createdAt: serverTimestamp(),
      };
      await setDoc(saleRef, saleData);

      // Save sale items
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

      // Deduct stock
      await deductStock(cart);

      // Update client stats
      if (selectedClient?.id) {
        await recordClientSale(selectedClient.id, grandTotal);
      }

      setLastSale({ ...saleData, num: saleNum, items: [...cart], date: new Date() });
      toast(`Vente ${saleNum} enregistrée — ${fmt(grandTotal)}`);
      clearCart();
    } catch (err) {
      console.error(err);
      toast('Erreur lors de l\'enregistrement', 'error');
    }
    setSaleLoading(false);
  }

  // Receipt
  function openReceipt(type) {
    if (!cart.length && !lastSale) { toast('Rien à imprimer', 'error'); return; }
    setReceiptType(type);
    setShowReceipt(true);
  }

  const receiptData = lastSale || {
    num: 'BROUILLON',
    clientName: selectedClient?.name || 'CLIENT COMPTOIRE',
    clientICE: selectedClient?.ice || '',
    items: cart,
    total: grandTotal,
    subtotal,
    discountAmount: totalDiscount,
    discountPercent: remiseGlobal,
    paymentMethod: payType,
    date: new Date(),
  };

  // Stock status helper
  function stockBadge(item) {
    if (item.stock <= 0) return <span className="text-[10px] text-danger font-semibold">Épuisé</span>;
    if (item.stock <= item.minStock) return <span className="text-[10px] text-warn font-semibold">{item.stock} restant{item.stock > 1 ? 's' : ''}</span>;
    return <span className="text-[10px] text-success">{item.stock} en stock</span>;
  }

  return (
    <div className="h-full flex">
      {/* ═══ LEFT — Search + Cart ═══ */}
      <div className="flex-1 flex flex-col p-5 gap-4 overflow-hidden border-r border-bord">

        {/* Search Bar */}
        <div className="relative">
          <div className="flex items-center gap-3 bg-surface-2 border border-bord rounded-xl px-4 py-3 focus-within:border-brand-500 transition-colors">
            <span className="text-txt-3 text-lg">⌕</span>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery && setShowResults(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchResults.length) {
                  addToCart(searchResults[0]);
                  setSearchQuery('');
                  setShowResults(false);
                }
                if (e.key === 'Escape') setShowResults(false);
              }}
              placeholder="Scanner code barre ou saisir nom article..."
              className="flex-1 bg-transparent text-txt-1 text-[15px] font-medium outline-none placeholder:text-txt-3"
              autoComplete="off"
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setShowResults(false); }} className="text-txt-3 hover:text-txt-1">✕</button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-bord rounded-xl overflow-hidden z-20 max-h-[240px] overflow-y-auto shadow-2xl">
              {searchResults.map((item, i) => (
                <div
                  key={item.productId + (item.variantId || '') + i}
                  onClick={() => {
                    addToCart(item);
                    setSearchQuery('');
                    setShowResults(false);
                    searchRef.current?.focus();
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-surface-3 transition-colors border-b border-bord last:border-b-0"
                >
                  <span className="font-mono text-[11px] text-txt-3 w-[110px] shrink-0 truncate">{item.barcode}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium truncate block">{item.name}</span>
                    {item.variantLabel && <span className="text-[11px] text-txt-3">{item.variantLabel}</span>}
                  </div>
                  {stockBadge(item)}
                  <span className="text-[13px] font-semibold text-success whitespace-nowrap">{fmt(item.priceSell)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cart Header */}
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold text-txt-2 uppercase tracking-wider">
            Panier {cart.length > 0 && <span className="text-brand-500 ml-1">({totalItems})</span>}
          </span>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-[12px] text-danger hover:underline">Vider</button>
          )}
        </div>

        {/* Cart Table */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="text-center py-16 text-txt-3 text-sm">
              <div className="text-4xl mb-3 opacity-30">🛒</div>
              Scannez ou cherchez un article pour commencer
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider">
                  <th className="text-left pb-2 pl-2">Article</th>
                  <th className="text-center pb-2 w-24">Qté</th>
                  <th className="text-right pb-2 w-20">Prix</th>
                  <th className="text-center pb-2 w-16">Rem%</th>
                  <th className="text-right pb-2 w-24">Total</th>
                  <th className="pb-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, i) => (
                  <tr key={i} className="border-t border-bord hover:bg-surface-2/50 group">
                    <td className="py-2.5 pl-2 max-w-[200px]">
                      <div className="font-medium text-[13px] truncate">
                        {item.name}
                        {item.variantLabel && <span className="text-txt-3 font-normal"> — {item.variantLabel}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-txt-3">{item.barcode}</span>
                        {stockBadge(item)}
                      </div>
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => changeQty(i, -1)} className="w-6 h-6 rounded-md border border-bord bg-surface-3 text-txt-1 flex items-center justify-center text-sm hover:bg-brand-500 hover:border-brand-500 transition-colors">−</button>
                        <span className="font-mono text-[13px] w-6 text-center">{item.qty}</span>
                        <button
                          onClick={() => changeQty(i, 1)}
                          disabled={item.stock > 0 && item.qty >= item.stock}
                          className="w-6 h-6 rounded-md border border-bord bg-surface-3 text-txt-1 flex items-center justify-center text-sm hover:bg-brand-500 hover:border-brand-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >+</button>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-mono text-[13px]">{fmt(item.priceSell)}</td>
                    <td className="py-2.5 text-center">
                      <input
                        type="number"
                        value={item.remise || ''}
                        onChange={e => setItemRemise(i, e.target.value)}
                        placeholder="0"
                        className="w-12 bg-surface-3 border border-bord rounded-md text-center font-mono text-[12px] text-txt-1 py-1 outline-none focus:border-warn"
                        min="0" max="100"
                      />
                    </td>
                    <td className="py-2.5 text-right font-mono text-[13px] font-medium text-success">{fmt(getItemTotal(item))}</td>
                    <td className="py-2.5 text-center">
                      <button onClick={() => removeItem(i)} className="text-txt-3 hover:text-danger transition-colors text-sm opacity-0 group-hover:opacity-100">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ═══ RIGHT — Totals & Actions ═══ */}
      <div className="w-[370px] bg-surface-1 flex flex-col p-5 gap-4 overflow-y-auto shrink-0">

        {/* Client Selector */}
        <div className="relative">
          <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-2">Client</label>
          {selectedClient ? (
            <div className="flex items-center gap-3 bg-surface-2 border border-bord rounded-lg px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{selectedClient.name}</div>
                {selectedClient.ice && <div className="text-[11px] text-txt-3">ICE: {selectedClient.ice}</div>}
              </div>
              <button onClick={() => { setSelectedClient(null); setClientSearch(''); }} className="text-txt-3 hover:text-danger text-sm">✕</button>
            </div>
          ) : (
            <div>
              <input
                type="text"
                value={clientSearch}
                onChange={e => { setClientSearch(e.target.value); setShowClientDropdown(true); }}
                onFocus={() => setShowClientDropdown(true)}
                placeholder="Rechercher client..."
                className="input-field"
              />
              {showClientDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-bord rounded-lg overflow-hidden z-10 max-h-[180px] overflow-y-auto">
                  <div
                    onClick={() => { setSelectedClient(null); setShowClientDropdown(false); setClientSearch(''); }}
                    className="px-3 py-2 text-[13px] text-txt-2 cursor-pointer hover:bg-surface-3 border-b border-bord"
                  >
                    CLIENT COMPTOIRE (sans client)
                  </div>
                  {filteredClients.map(c => (
                    <div
                      key={c.id}
                      onClick={() => { setSelectedClient(c); setShowClientDropdown(false); setClientSearch(c.name); }}
                      className="px-3 py-2 cursor-pointer hover:bg-surface-3 border-b border-bord last:border-b-0"
                    >
                      <div className="text-[13px] font-medium">{c.name}</div>
                      <div className="text-[11px] text-txt-3">
                        {c.phone && c.phone + ' · '}
                        {c.ice && 'ICE: ' + c.ice}
                        {!c.phone && !c.ice && c.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="h-px bg-bord" />

        {/* Global Discount */}
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-txt-2 flex-1">Remise globale</span>
          <input
            type="number"
            value={remiseGlobal || ''}
            onChange={e => setRemiseGlobal(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
            placeholder="0"
            className="w-16 bg-surface-2 border border-bord rounded-lg font-mono text-sm text-center py-2 outline-none focus:border-warn text-txt-1"
            min="0" max="100"
          />
          <span className="text-txt-3 text-sm">%</span>
        </div>

        {/* Totals */}
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[13px]">
            <span className="text-txt-2">Sous-total</span>
            <span className="font-mono font-medium">{fmt(subtotal)}</span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-[13px]">
              <span className="text-txt-2">Remise</span>
              <span className="font-mono font-medium text-warn">-{fmt(totalDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-3 mt-1 border-t border-bord">
            <span className="text-[15px] font-bold">TOTAL TTC</span>
            <span className="text-xl font-bold font-mono text-success">{fmt(grandTotal)}</span>
          </div>
        </div>

        <div className="h-px bg-bord" />

        {/* Payment Type */}
        <div>
          <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-2">Paiement</label>
          <div className="flex gap-2">
            {['Espèce', 'Chèque', 'Virement'].map(type => (
              <button
                key={type}
                onClick={() => setPayType(type)}
                className={`flex-1 py-2 rounded-lg text-[13px] font-medium border transition-all ${
                  payType === type
                    ? 'bg-brand-500/15 border-brand-500 text-brand-500'
                    : 'bg-surface-2 border-bord text-txt-2 hover:text-txt-1'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Amount Received */}
        {payType === 'Espèce' && (
          <div>
            <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-2">Montant reçu</label>
            <input
              type="number"
              value={montantRecu}
              onChange={e => setMontantRecu(e.target.value)}
              placeholder="0,00"
              className="input-field font-mono"
            />
            <div className="flex justify-between mt-2 text-[13px]">
              <span className="text-txt-2">Monnaie à rendre</span>
              <span className="font-mono font-medium text-warn">{fmt(monnaie)}</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-2">
            <button onClick={() => openReceipt('ticket')} disabled={!cart.length && !lastSale} className="btn-secondary flex-1 text-[13px]">
              🖨 Ticket
            </button>
            <button onClick={() => openReceipt('facture')} disabled={!cart.length && !lastSale} className="btn-primary flex-1 text-[13px]">
              📄 Facture
            </button>
          </div>
          <button
            onClick={enregistrerVente}
            disabled={!cart.length || saleLoading}
            className="btn-success w-full py-3 text-[15px]"
          >
            {saleLoading ? '⏳ Enregistrement...' : '✓ Enregistrer la Vente'}
          </button>
        </div>
      </div>

      {/* ═══ Receipt Modal ═══ */}
      {showReceipt && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowReceipt(false)}>
          <div className="bg-surface-1 border border-bord rounded-2xl p-7 w-[520px] max-w-[95vw] max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">{receiptType === 'facture' ? '📄 Facture' : '🖨 Ticket de Caisse'}</h3>
              <button onClick={() => setShowReceipt(false)} className="text-txt-3 hover:text-txt-1 text-xl">✕</button>
            </div>

            <div className="print-area font-mono text-[13px] leading-relaxed">
              {/* Header */}
              <div className="text-center mb-4 pb-4 border-b border-dashed border-bord">
                <h2 className="text-base font-bold tracking-wider">YOUNASSER SARL</h2>
                <p className="text-[11px] text-txt-2">Librairie & Fournitures Scolaires</p>
                {receiptType === 'facture' && <p className="text-[12px] font-semibold mt-2">FACTURE N° {receiptData.num}</p>}
                <p className="text-[11px] text-txt-3">
                  {receiptData.date.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  {' — '}
                  {receiptData.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              {/* Client info (facture only) */}
              {receiptType === 'facture' && (
                <div className="mb-4 p-3 bg-surface-2 rounded-lg text-[12px]">
                  <strong>Client:</strong> {receiptData.clientName}
                  {receiptData.clientICE && <><br /><strong>ICE:</strong> {receiptData.clientICE}</>}
                </div>
              )}

              {/* Items */}
              <table className="w-full mb-4">
                <thead>
                  <tr className="text-[10px] uppercase text-txt-3 border-b border-bord">
                    <th className="text-left pb-1">Article</th>
                    <th className="text-center pb-1">Qté</th>
                    <th className="text-right pb-1">PU</th>
                    <th className="text-right pb-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.items.map((item, i) => (
                    <tr key={i} className="text-[12px]">
                      <td className="py-1 max-w-[200px] truncate">
                        {item.name}
                        {item.variantLabel && ` (${item.variantLabel})`}
                        {item.remise > 0 && <span className="text-warn ml-1">-{item.remise}%</span>}
                      </td>
                      <td className="text-center py-1">{item.qty}</td>
                      <td className="text-right py-1">{fmt(item.priceSell)}</td>
                      <td className="text-right py-1 font-semibold">{fmt(getItemTotal(item))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="border-t border-dashed border-bord pt-3">
                <div className="flex justify-between text-[12px] text-txt-2">
                  <span>Sous-total</span>
                  <span>{fmt(receiptData.subtotal)}</span>
                </div>
                {receiptData.discountAmount > 0 && (
                  <div className="flex justify-between text-[12px] text-warn">
                    <span>Remise {receiptData.discountPercent > 0 ? `(${receiptData.discountPercent}%)` : ''}</span>
                    <span>-{fmt(receiptData.discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-[14px] font-bold mt-2">
                  <span>TOTAL TTC</span>
                  <span>{fmt(receiptData.total)}</span>
                </div>
                <div className="flex justify-between text-[12px] text-txt-2 mt-1">
                  <span>Paiement</span>
                  <span>{receiptData.paymentMethod}</span>
                </div>
              </div>

              {receiptType === 'ticket' && (
                <div className="text-center mt-5 text-[11px] text-txt-3">
                  Merci de votre visite !<br />YOUNASSER — Votre partenaire scolaire
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => window.print()} className="btn-secondary flex-1">🖨 Imprimer</button>
              <button onClick={() => setShowReceipt(false)} className="btn-primary flex-1">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
