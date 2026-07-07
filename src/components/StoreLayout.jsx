import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Home, Grid3x3, BookOpen, Gift, User, ShoppingCart, Search, Package,
  Truck, HelpCircle, ShieldCheck, BadgePercent, Headset, Minus, Plus, X, ChevronRight,
  MessageCircle,
} from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useProducts } from '../context/ProductsContext';
import { useFavorites } from '../context/FavoritesContext';
import { useCategories } from '../hooks/useCategories';
import { formatPrice, getPrice } from '../lib/pricing';
import { buildWhatsAppLink } from '../lib/contact';
import CachedImage from './CachedImage';
import StoreFooter from './StoreFooter';

const NAV_LINKS = [
  { to: '/', icon: Home, label: 'Accueil', desktopLabel: 'Accueil', end: true },
  { to: '/categories', icon: Grid3x3, label: 'Catégories', desktopLabel: 'Catégories' },
  { to: '/manuels', icon: BookOpen, label: 'Manuels', desktopLabel: 'Manuels scolaires' },
  { to: '/packs', icon: Gift, label: 'Pack', desktopLabel: 'Écoles & Packs' },
  { to: '/profil', icon: User, label: 'Profil', desktopLabel: 'Profil' },
];

export default function StoreLayout() {
  const { cartCount, cartTotal, cartItems, removeFromCart, updateQuantity } = useCart();
  const { products } = useProducts();
  const { favCount } = useFavorites();
  const { getCategoryName } = useCategories();
  const location = useLocation();
  const isCheckout = location.pathname === '/checkout';
  const [hasProfile, setHasProfile] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const debounceRef = useRef(null);
  const searchContainerRef = useRef(null);

  const visibleProducts = useMemo(() => products.filter(p => p.isVisible !== false), [products]);

  const filterProducts = useCallback((q) => {
    const lower = q.toLowerCase().trim();
    if (lower.length < 2) return [];
    return visibleProducts
      .filter(p =>
        p.name?.toLowerCase().includes(lower) ||
        p.brand?.toLowerCase().includes(lower) ||
        p.sku?.toLowerCase().includes(lower) ||
        p.barcode?.toLowerCase().includes(lower) ||
        p.famille?.toLowerCase().includes(lower) ||
        p.tags?.some(t => t.toLowerCase().includes(lower)) ||
        p.categoryPath?.some(c => c.toLowerCase().includes(lower))
      )
      .slice(0, 8);
  }, [visibleProducts]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const sync = () => setHasProfile(!!localStorage.getItem('younasser_profile_phone'));
    sync();
    window.addEventListener('younasser-profile-updated', sync);
    return () => window.removeEventListener('younasser-profile-updated', sync);
  }, []);

  function handleSearchChange(e) {
    const val = e.target.value;
    setSearch(val);
    clearTimeout(debounceRef.current);
    if (val.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      const results = filterProducts(val);
      setSearchResults(results);
      setShowDropdown(true);
    }, 300);
  }

  function submitSearch(e) {
    e.preventDefault();
    if (!search.trim()) return;
    setShowDropdown(false);
    if (searchResults.length > 0) {
      navigate(`/produit/${searchResults[0].slug || searchResults[0].id}`);
      setSearch('');
    } else {
      navigate(`/categories?q=${encodeURIComponent(search.trim())}`);
    }
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <header className="sticky top-0 z-30 bg-surface-1 border-b border-bord">
        {/* Mobile top bar */}
        <div className="lg:hidden h-14 flex items-center justify-between px-4">
          <Link to="/" className="font-extrabold text-lg text-navy tracking-wide">
            younasser<span style={{ color: '#FFC107' }}>.</span>
          </Link>
          <Link to="/panier" className="relative w-9 h-9 rounded-lg bg-blue flex items-center justify-center">
            <ShoppingCart size={18} className="text-white" />
            {cartCount > 0 && (
              <span key={cartCount} className="cart-badge-pulse absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-[10px] font-bold text-white flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </Link>
        </div>

        {/* Desktop top bar */}
        <div className="hidden lg:flex items-center gap-6 h-16 px-8">
          <Link to="/" className="shrink-0">
            <div className="font-extrabold text-xl text-navy tracking-wide leading-none">
              younasser<span style={{ color: '#FFC107' }}>.</span>
            </div>
            <div className="text-[11px] text-txt-2">Tout pour l'école et le bureau</div>
          </Link>
          <div ref={searchContainerRef} className="flex-1 max-w-xl mx-auto relative">
            <form onSubmit={submitSearch}>
              <div className="flex items-center gap-2 bg-surface-2 border border-bord rounded-full px-4 py-2.5">
                <Search size={16} className="text-txt-3 shrink-0" />
                <input
                  value={search}
                  onChange={handleSearchChange}
                  onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                  placeholder="Rechercher un produit, une catégorie ou une marque..."
                  className="flex-1 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3"
                />
                {search && (
                  <button type="button" onClick={() => { setSearch(''); setSearchResults([]); setShowDropdown(false); }}>
                    <X size={14} className="text-txt-3 hover:text-txt-1" />
                  </button>
                )}
              </div>
            </form>

            {showDropdown && search.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-surface-1 border border-bord rounded-2xl shadow-xl z-50 overflow-hidden">
                {searchResults.length === 0 ? (
                  <div className="px-4 py-4">
                    <p className="text-[13px] text-txt-2">Aucun résultat pour <span className="font-semibold text-txt-1">"{search}"</span></p>
                    <Link
                      to="/categories"
                      className="text-[12px] text-blue mt-1 inline-block hover:underline"
                      onClick={() => setShowDropdown(false)}
                    >
                      Parcourir les catégories →
                    </Link>
                  </div>
                ) : (
                  searchResults.map(p => {
                    const { price } = getPrice(p);
                    const categoryRaw = p.categoryPath?.[0] || p.famille || '';
                    const category = getCategoryName(categoryRaw) || categoryRaw;
                    return (
                      <Link
                        key={p.id}
                        to={`/produit/${p.slug || p.id}`}
                        className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors border-b border-bord last:border-b-0"
                        onClick={() => { setShowDropdown(false); setSearch(''); }}
                      >
                        <div className="w-10 h-10 rounded-lg bg-surface-2 border border-bord overflow-hidden shrink-0 flex items-center justify-center">
                          {p.mainImage
                            ? <CachedImage src={p.mainImage} className="w-full h-full object-contain" />
                            : <Package size={16} className="text-txt-3" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold text-txt-1 truncate" dir="auto">{p.name}</div>
                          {p.brand && <div className="text-[11px] text-txt-3 leading-none mt-0.5">{p.brand}</div>}
                          {category && (
                            <span className="inline-block mt-1 text-[10px] bg-blue-light text-blue px-1.5 py-0.5 rounded-full leading-none">
                              {category}
                            </span>
                          )}
                        </div>
                        <span className="text-[13px] font-mono font-semibold text-navy shrink-0">
                          {formatPrice(price)}
                        </span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden xl:flex items-center gap-1.5 text-[12px] text-success font-medium bg-success/10 px-3 py-1.5 rounded-full">
              <Truck size={14} /> Livraison rapide
            </span>
            <a
              href={buildWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden xl:flex items-center gap-1 text-[12px] text-txt-2 hover:text-navy"
            >
              <HelpCircle size={14} /> Besoin d'aide?
            </a>
            <Link to="/panier" className="relative flex items-center gap-2 text-navy">
              <span className="relative w-9 h-9 rounded-lg bg-blue flex items-center justify-center">
                <ShoppingCart size={18} className="text-white" />
                {cartCount > 0 && (
                  <span key={cartCount} className="cart-badge-pulse absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {cartCount}
                  </span>
                )}
              </span>
              {cartCount > 0 && <span className="text-[12px] font-mono font-semibold">{formatPrice(cartTotal)}</span>}
            </Link>
            <Link to="/profil" className="text-navy">
              <User size={20} />
            </Link>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full lg:max-w-[1280px] lg:mx-auto lg:flex lg:gap-6 lg:px-8 lg:py-6">
        {/* Left sidebar — desktop only */}
        <aside className="hidden lg:flex lg:flex-col lg:w-[220px] shrink-0 gap-6">
          <nav className="bg-surface-1 border border-bord rounded-2xl p-3 flex flex-col gap-1">
            {NAV_LINKS.map(({ to, icon: Icon, desktopLabel, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-colors ${
                    isActive ? 'bg-blue-light text-blue' : 'text-txt-2 hover:bg-surface-2 hover:text-txt-1'
                  }`
                }
              >
                <Icon size={17} />
                {desktopLabel}
                {to === '/manuels' && (
                  <span className="w-2 h-2 rounded-full bg-green-500 ml-1 flex-shrink-0" />
                )}
                {to === '/packs' && (
                  <span className="w-2 h-2 rounded-full bg-red-500 ml-1 flex-shrink-0" />
                )}
                {to === '/profil' && favCount > 0 && (
                  <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-blue/15 text-blue text-[10px] font-bold flex items-center justify-center">
                    {favCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="bg-surface-1 border border-bord rounded-2xl p-4 flex flex-col gap-3">
            <TrustBadge icon={ShieldCheck} label="Produits de qualité" />
            <TrustBadge icon={Truck} label="Livraison ultra rapide" />
            <TrustBadge icon={BadgePercent} label="Meilleurs prix" />
            <TrustBadge icon={Headset} label="Support réactif" />
          </div>

          <div className="bg-gradient-to-br from-blue to-navy rounded-2xl p-4 text-white">
            <img src={import.meta.env.BASE_URL + 'images/delivery-scooter.png'} alt="" className="w-16 h-16 object-contain mb-1" />
            <div className="text-[13px] font-semibold leading-snug">Livraison rapide à Marrakech</div>
            <div className="text-[11px] text-white/80 mt-1">Recevez vos articles en moins de 24h</div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-20 lg:pb-0">
          <Outlet />
        </main>

        {/* Right sidebar — desktop only, hidden on checkout */}
        {!isCheckout && <aside className="hidden lg:flex lg:flex-col lg:w-[280px] shrink-0 gap-6">
          <div className="bg-surface-1 border border-bord rounded-2xl p-4">
            <h3 className="text-[13px] font-bold text-txt-1 mb-3">Votre panier</h3>
            {cartItems.length === 0 ? (
              <p className="text-[12px] text-txt-3">Votre panier est vide.</p>
            ) : (
              <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto">
                {cartItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-lg bg-surface-2 border border-bord overflow-hidden shrink-0">
                      {item.image && <CachedImage src={item.image} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] text-txt-1 truncate">{item.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <button onClick={() => updateQuantity(i, item.qty - 1)} className="w-5 h-5 rounded bg-surface-2 flex items-center justify-center text-txt-2"><Minus size={10} /></button>
                        <span className="text-[11px] font-mono w-4 text-center">{item.qty}</span>
                        <button onClick={() => updateQuantity(i, item.qty + 1)} className="w-5 h-5 rounded bg-surface-2 flex items-center justify-center text-txt-2"><Plus size={10} /></button>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[12px] font-mono font-semibold text-navy">{formatPrice(item.price * item.qty)}</span>
                      <button onClick={() => removeFromCart(i)} className="text-txt-3 hover:text-danger"><X size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {cartItems.length > 0 && (
              <>
                <div className="h-px bg-bord my-3" />
                <div className="flex items-center justify-between text-[13px] font-semibold mb-3">
                  <span className="text-txt-2">Total</span>
                  <span className="font-mono text-navy">{formatPrice(cartTotal)}</span>
                </div>
                <Link to="/checkout" className="block text-center bg-blue text-white text-[13px] font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity">
                  Commander
                </Link>
              </>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-[13px] font-bold text-txt-1">Offres spéciales</h3>

            {/* Card 1 — Pack rentrée scolaire */}
            <Link to="/packs" className="block bg-[#F5A623] rounded-2xl p-4">
              <div className="text-[12px] font-bold text-[#1e2956]">Pack rentrée scolaire</div>
              <div className="text-[11px] text-[#1e2956]/75 mt-1">Jusqu'à -20% sur une sélection</div>
              <span className="inline-block mt-3 bg-white text-[#1e2956] text-[11px] font-semibold rounded-full px-3 py-1">Découvrir</span>
            </Link>

            {/* Card 2 — Manuel français */}
            <div className="bg-surface-1 border border-bord rounded-2xl p-4">
              <BookOpen size={20} className="text-blue mb-2" />
              <div className="text-[12px] font-semibold text-txt-1">Vous cherchez un manuel en français&nbsp;?</div>
              <div className="text-[11px] text-txt-3 mt-1">Plus de 500 références disponibles</div>
              <Link to="/manuels" className="inline-block mt-3 bg-blue text-white text-[11px] font-semibold rounded-xl px-3 py-1.5 hover:opacity-90 transition-opacity">
                Voir les manuels
              </Link>
            </div>

            {/* Card 3 — Boutique location */}
            <a
              href="https://maps.app.goo.gl/SHTiuNtk8TmxqNtu5"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-[#eaf1fe] rounded-2xl p-4 hover:bg-[#dbeafe] transition-colors"
            >
              <div className="text-[12px] font-semibold text-navy">Découvrez notre boutique à Marrakech</div>
              <div className="text-[11px] text-navy/70 mt-2 leading-relaxed">
                Magaz N°1, N°40<br />
                Quartier Industriel Syba, Marrakech
              </div>
              <span className="inline-flex items-center gap-0.5 mt-3 text-[11px] text-blue font-semibold">
                Itinéraire →
              </span>
            </a>
          </div>
        </aside>}
      </div>

      <StoreFooter />

      {/* Floating WhatsApp button — mobile/tablet only, desktop has the header button */}
      <a
        href={buildWhatsAppLink('Bonjour, je voudrais des informations sur vos produits.')}
        target="_blank"
        rel="noopener noreferrer"
        className="lg:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[#25D366] shadow-lg flex items-center justify-center hover:brightness-110 transition-all"
        aria-label="Contacter younasser sur WhatsApp"
      >
        <MessageCircle size={26} className="text-white" fill="white" strokeWidth={0} />
      </a>

      {/* Mobile bottom nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-1 border-t border-bord flex items-center justify-around z-30">
        {NAV_LINKS.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 text-[10px] ${isActive ? 'text-blue' : 'text-txt-3'}`
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  <Icon size={20} fill={isActive ? 'currentColor' : 'none'} strokeWidth={isActive ? 2 : 1.75} />
                  {to === '/profil' && hasProfile && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success border border-surface-1" />
                  )}
                  {to === '/profil' && favCount > 0 && !hasProfile && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-blue text-white text-[8px] font-bold flex items-center justify-center leading-none">
                      {favCount}
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center">
                  {label}
                  {to === '/manuels' && (
                    <span className="w-2 h-2 rounded-full bg-green-500 ml-1 flex-shrink-0" />
                  )}
                  {to === '/packs' && (
                    <span className="w-2 h-2 rounded-full bg-red-500 ml-1 flex-shrink-0" />
                  )}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function TrustBadge({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-8 h-8 rounded-full bg-blue-light text-blue flex items-center justify-center shrink-0">
        <Icon size={15} />
      </span>
      <span className="text-[12px] text-txt-2">{label}</span>
    </div>
  );
}
