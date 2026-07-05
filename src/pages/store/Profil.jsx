import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Phone, Heart, MapPin, User, Info, ShoppingBag, MessageCircle,
  ChevronDown, ChevronUp, Package, CheckCircle2, Circle,
} from 'lucide-react';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useProducts } from '../../hooks/useProducts';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/pricing';
import { ORDER_STATUS_META, ORDER_STATUS_FLOW } from '../../lib/orderStatus';
import { buildWhatsAppLink } from '../../lib/contact';
import CachedImage from '../../components/CachedImage';
import ProductCard from '../../components/store/ProductCard';

const PHONE_KEY = 'younasser_profile_phone';
const profileKey = phone => `younasser_profile_${phone}`;

function loadSavedProfile(phone) {
  try {
    return JSON.parse(localStorage.getItem(profileKey(phone)) || 'null') || { name: '', addressNote: '', gpsCoords: null };
  } catch {
    return { name: '', addressNote: '', gpsCoords: null };
  }
}

function formatDate(ts) {
  if (!ts) return '';
  try {
    const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function Profil() {
  const [phone, setPhone] = useState(() => localStorage.getItem(PHONE_KEY) || '');
  const [phoneInput, setPhoneInput] = useState('');
  const [activeTab, setActiveTab] = useState('commandes');

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState(null);

  const [profile, setProfile] = useState(() => phone ? loadSavedProfile(phone) : { name: '', addressNote: '', gpsCoords: null });
  const [gpsLoading, setGpsLoading] = useState(false);

  const { favorites } = useFavorites();
  const { products } = useProducts();
  const { addToCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (phone) fetchOrders(phone);
  }, [phone]);

  async function fetchOrders(ph) {
    setOrdersLoading(true);
    try {
      const q = query(collection(db, 'orders'), where('clientPhone', '==', ph));
      const snap = await getDocs(q);
      const all = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      setOrders(all);
      // Auto-fill name/address from most recent order if profile is empty
      if (all.length > 0) {
        setProfile(prev => ({
          ...prev,
          name: prev.name || all[0].clientName || '',
          addressNote: prev.addressNote || all[0].addressNote || '',
        }));
      }
    } catch (err) {
      console.error('Profil orders fetch error:', err);
    } finally {
      setOrdersLoading(false);
    }
  }

  function handleContinue() {
    const ph = phoneInput.trim();
    if (ph.length < 9) return;
    localStorage.setItem(PHONE_KEY, ph);
    setPhone(ph);
    setProfile(loadSavedProfile(ph));
    window.dispatchEvent(new Event('younasser-profile-updated'));
  }

  function handleChangePhone() {
    localStorage.removeItem(PHONE_KEY);
    setPhone('');
    setPhoneInput('');
    setOrders([]);
    setProfile({ name: '', addressNote: '', gpsCoords: null });
    window.dispatchEvent(new Event('younasser-profile-updated'));
  }

  function saveAddress() {
    const data = { name: profile.name, addressNote: profile.addressNote, gpsCoords: profile.gpsCoords };
    localStorage.setItem(profileKey(phone), JSON.stringify(data));
    toast('Adresse enregistrée !', 'success');
  }

  function shareGPS() {
    if (!navigator.geolocation) { toast('Géolocalisation non supportée', 'error'); return; }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setProfile(prev => ({ ...prev, gpsCoords: { lat: pos.coords.latitude, lng: pos.coords.longitude } }));
        setGpsLoading(false);
      },
      () => { toast("Impossible d'accéder à votre position", 'error'); setGpsLoading(false); },
      { timeout: 10000 }
    );
  }

  async function reorder(order) {
    let skipped = 0;
    for (const item of (order.items || [])) {
      const product = products.find(p => p.id === item.productId);
      if (!product || product.isOutOfStock || (product.totalStock ?? 0) === 0) {
        skipped++;
        continue;
      }
      addToCart(product, null, item.quantity);
    }
    if (skipped > 0) toast('Certains articles ne sont plus disponibles', 'info');
    navigate('/panier');
  }

  // ── Landing state ────────────────────────────────────────────────────────
  if (!phone) {
    return (
      <div className="flex flex-col items-center gap-6 px-4 py-10">
        <div className="text-center">
          <h1 className="text-xl font-bold text-navy">Mon espace</h1>
          <p className="text-[13px] text-txt-2 mt-1">Suivez vos commandes et gérez vos informations.</p>
        </div>

        <div className="w-full max-w-sm bg-white border border-bord rounded-2xl p-6 flex flex-col gap-4">
          <div className="flex justify-center mb-1">
            <div className="w-16 h-16 rounded-2xl bg-blue-light flex items-center justify-center">
              <Phone size={28} className="text-blue" />
            </div>
          </div>
          <div className="text-center">
            <div className="text-[15px] font-bold text-txt-1">Entrez votre numéro de téléphone</div>
            <div className="text-[12px] text-txt-2 mt-1 leading-relaxed">
              Retrouvez vos commandes et vos informations en un instant.
            </div>
          </div>

          <div className="flex items-center border border-bord rounded-xl overflow-hidden bg-surface-1 focus-within:border-blue transition-colors">
            <span className="px-3 py-[13px] border-r border-bord text-[18px] shrink-0 leading-none">🇲🇦</span>
            <input
              value={phoneInput}
              onChange={e => setPhoneInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleContinue()}
              placeholder="06 12 34 56 78"
              type="tel"
              className="flex-1 px-3 py-3 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3"
            />
          </div>

          <button
            type="button"
            onClick={handleContinue}
            disabled={phoneInput.trim().length < 9}
            className="bg-blue text-white text-[13px] font-semibold py-3 rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            Continuer
          </button>

          <p className="text-[11px] text-txt-3 text-center leading-relaxed">
            Nous utilisons votre numéro pour retrouver vos commandes. Aucun compte à créer.
          </p>
        </div>
      </div>
    );
  }

  // ── Logged state ─────────────────────────────────────────────────────────
  const greeting = profile.name || orders[0]?.clientName || '';
  const favProducts = products.filter(p => favorites.includes(p.id) && p.isVisible !== false);

  return (
    <div className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-navy">
            {greeting ? `Bonjour, ${greeting.split(' ')[0]} 👋` : 'Mon espace'}
          </h1>
          <p className="text-[13px] text-txt-3 mt-0.5 font-mono">{phone}</p>
        </div>
        <button
          type="button"
          onClick={handleChangePhone}
          className="text-[12px] text-blue hover:underline font-medium mt-1 shrink-0"
        >
          Changer de numéro
        </button>
      </div>

      {/* Tab pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'commandes', label: 'Mes commandes' },
          { key: 'favoris', label: favorites.length > 0 ? `Mes favoris (${favorites.length})` : 'Mes favoris' },
          { key: 'adresse', label: 'Mon adresse' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-full text-[13px] font-medium transition-colors whitespace-nowrap ${
              activeTab === key
                ? 'bg-blue text-white shadow-sm'
                : 'bg-surface-1 border border-bord text-txt-2 hover:bg-surface-2'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: Mes commandes ── */}
      {activeTab === 'commandes' && (
        ordersLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <ShoppingBag size={40} className="text-txt-3" />
            <h3 className="text-[14px] font-bold text-txt-1">Aucune commande trouvée</h3>
            <p className="text-[13px] text-txt-2">Ce numéro n'a pas encore de commandes.</p>
            <Link
              to="/"
              className="mt-1 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              Découvrir nos produits
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map(order => {
              const meta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.pending;
              const expanded = expandedOrder === order.id;
              return (
                <div key={order.id} className="bg-white border border-bord rounded-2xl overflow-hidden">
                  {/* Header row */}
                  <button
                    type="button"
                    onClick={() => setExpandedOrder(expanded ? null : order.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-1 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[13px] font-bold text-navy">{order.orderNumber}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[12px] text-txt-3 flex-wrap">
                        <span>{formatDate(order.createdAt)}</span>
                        <span>·</span>
                        <span>{order.itemsCount || order.items?.length || 0} articles</span>
                        <span>·</span>
                        <span className="font-mono font-semibold text-txt-2">{formatPrice(order.total)}</span>
                      </div>
                    </div>
                    {expanded
                      ? <ChevronUp size={16} className="text-txt-3 shrink-0" />
                      : <ChevronDown size={16} className="text-txt-3 shrink-0" />
                    }
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t border-bord p-4 flex flex-col gap-4">
                      {/* Status timeline */}
                      <StatusTimeline status={order.status} createdAt={order.createdAt} />

                      {/* Delivery type */}
                      <div className="flex items-center gap-2 bg-surface-1 rounded-lg px-3 py-2.5">
                        <MapPin size={14} className="text-blue shrink-0" />
                        <span className="text-[13px] text-txt-2">
                          {order.deliveryMethod === 'pickup' ? 'Retrait en magasin' : 'Livraison à domicile'}
                        </span>
                      </div>

                      {/* Items */}
                      {(order.items?.length ?? 0) > 0 && (
                        <div className="flex flex-col gap-2.5">
                          <div className="text-[11px] font-bold text-txt-3 uppercase tracking-wider">Articles</div>
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-surface-1 border border-bord overflow-hidden shrink-0 flex items-center justify-center">
                                {item.image
                                  ? <CachedImage src={item.image} className="w-full h-full object-contain" />
                                  : <Package size={14} className="text-txt-3" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] text-txt-1 truncate">{item.name}</div>
                                {item.variantLabel && <div className="text-[11px] text-txt-3">{item.variantLabel}</div>}
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[11px] text-txt-3">× {item.quantity}</div>
                                <div className="text-[13px] font-mono font-semibold text-navy">{formatPrice(item.totalPrice)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Totals */}
                      <div className="flex flex-col gap-1.5 border-t border-bord pt-3">
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-txt-2">Sous-total</span>
                          <span className="font-mono text-txt-1">{formatPrice(order.subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[12px]">
                          <span className="text-txt-2">Livraison</span>
                          <span className="font-mono text-txt-1">{order.deliveryFee === 0 ? 'Gratuit' : formatPrice(order.deliveryFee)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[14px] font-bold mt-1">
                          <span className="text-txt-1">Total</span>
                          <span className="font-mono text-navy">{formatPrice(order.total)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => reorder(order)}
                          className="flex-1 bg-blue text-white text-[13px] font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                        >
                          Commander à nouveau
                        </button>
                        <a
                          href={buildWhatsAppLink(`Bonjour, j'ai une question sur ma commande ${order.orderNumber}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-4 py-2.5 bg-surface-1 border border-bord rounded-xl text-[13px] text-txt-2 font-medium hover:bg-surface-2 transition-colors shrink-0"
                        >
                          <MessageCircle size={14} className="text-success" />
                          Support
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── TAB: Mes favoris ── */}
      {activeTab === 'favoris' && (
        favProducts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Heart size={40} className="text-txt-3" />
            <h3 className="text-[14px] font-bold text-txt-1">Aucun favori pour le moment</h3>
            <p className="text-[13px] text-txt-2 max-w-xs">
              Parcourez nos produits et ajoutez vos articles préférés.
            </p>
            <Link to="/" className="text-[13px] text-blue hover:underline font-medium">
              Parcourir les produits
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {favProducts.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )
      )}

      {/* ── TAB: Mon adresse ── */}
      {activeTab === 'adresse' && (
        <div className="bg-white border border-bord rounded-2xl p-5 flex flex-col gap-4 max-w-lg">
          <h2 className="text-[15px] font-bold text-navy">Mon adresse</h2>

          {/* Name */}
          <div className="relative">
            <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none" />
            <input
              value={profile.name}
              onChange={e => setProfile(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nom complet"
              className="w-full pl-9 pr-3 py-3 bg-surface-1 border border-bord rounded-xl text-[13px] text-txt-1 outline-none focus:border-blue placeholder:text-txt-3"
            />
          </div>

          {/* Phone (read-only) */}
          <div className="relative">
            <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-3 pointer-events-none" />
            <input
              value={phone}
              readOnly
              className="w-full pl-9 pr-3 py-3 bg-surface-2 border border-bord rounded-xl text-[13px] text-txt-3 cursor-not-allowed font-mono"
            />
          </div>

          {/* GPS */}
          {profile.gpsCoords ? (
            <div className="flex items-center gap-2 bg-blue/10 border border-blue/20 text-blue rounded-xl px-3 py-3">
              <MapPin size={15} className="shrink-0" />
              <span className="text-[13px] font-medium flex-1">Position enregistrée</span>
              <button
                type="button"
                onClick={() => setProfile(prev => ({ ...prev, gpsCoords: null }))}
                className="text-[11px] text-txt-3 hover:text-txt-1 transition-colors"
              >
                Effacer
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={shareGPS}
              disabled={gpsLoading}
              className="flex items-center justify-center gap-2 bg-surface-1 border border-bord text-txt-1 text-[13px] font-medium py-3 rounded-xl hover:bg-surface-2 disabled:opacity-60 transition-colors"
            >
              <MapPin size={15} className="text-blue" />
              {gpsLoading ? 'Localisation en cours...' : 'Partager ma position GPS'}
            </button>
          )}

          {/* Address note */}
          <div className="relative">
            <Info size={15} className="absolute left-3 top-3 text-txt-3 pointer-events-none" />
            <textarea
              value={profile.addressNote}
              onChange={e => setProfile(prev => ({ ...prev, addressNote: e.target.value }))}
              placeholder="Complément d'adresse (optionnel) — Ex: Immeuble Atlas, 3ème étage..."
              rows={3}
              className="w-full pl-9 pr-3 py-3 bg-surface-1 border border-bord rounded-xl text-[13px] text-txt-1 outline-none focus:border-blue placeholder:text-txt-3 resize-none"
            />
          </div>

          <button
            type="button"
            onClick={saveAddress}
            className="bg-blue text-white text-[13px] font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Enregistrer
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusTimeline({ status, createdAt }) {
  const isCancelled = status === 'cancelled';
  const currentIndex = isCancelled ? -1 : Math.max(0, ORDER_STATUS_FLOW.indexOf(status || 'pending'));

  return (
    <div className="flex flex-col">
      <div className="text-[11px] font-bold text-txt-3 uppercase tracking-wider mb-3">Suivi de commande</div>
      {ORDER_STATUS_FLOW.map((s, i) => {
        const done = !isCancelled && i <= currentIndex;
        const isCurrent = !isCancelled && i === currentIndex;
        const isLast = i === ORDER_STATUS_FLOW.length - 1;
        return (
          <div key={s} className="flex gap-3">
            <div className="flex flex-col items-center">
              {done
                ? <CheckCircle2 size={18} className={`shrink-0 ${isCurrent ? 'text-blue' : 'text-blue/50'}`} />
                : <Circle size={18} className="text-bord shrink-0" />
              }
              {!isLast && (
                <div
                  className={`w-px flex-1 my-1 ${i < currentIndex && !isCancelled ? 'bg-blue/30' : 'bg-bord'}`}
                  style={{ minHeight: 20 }}
                />
              )}
            </div>
            <div className={`pb-3 ${isLast ? 'pb-0' : ''}`}>
              <div className={`text-[13px] font-medium ${done ? 'text-txt-1' : 'text-txt-3'}`}>
                {ORDER_STATUS_META[s].label}
              </div>
              {isCurrent && createdAt && (
                <div className="text-[11px] text-txt-3 mt-0.5">{formatDate(createdAt)}</div>
              )}
            </div>
          </div>
        );
      })}
      {isCancelled && (
        <div className="flex items-center gap-2 mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <span className="text-[12px] font-semibold text-red-600">{ORDER_STATUS_META.cancelled.label}</span>
        </div>
      )}
    </div>
  );
}
