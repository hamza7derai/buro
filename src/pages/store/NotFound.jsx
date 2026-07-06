import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, X, Package } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { getPrice, formatPrice } from '../../lib/pricing';
import CachedImage from '../../components/CachedImage';
import PageTransition from '../../components/PageTransition';

const CATEGORY_PILLS = [
  { label: 'Fournitures', slug: 'fournitures-scolaires' },
  { label: 'Bureau', slug: 'bureau-impression' },
  { label: 'Livres', slug: 'livres-culture' },
  { label: 'Sacs', slug: 'sacs-accessoires' },
  { label: 'Jeux', slug: 'jeux-electronique' },
];

export default function NotFound() {
  const { products } = useProducts();
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
        p.barcode?.toLowerCase().includes(lower)
      )
      .slice(0, 6);
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
    } else {
      navigate(`/categories?q=${encodeURIComponent(search.trim())}`);
    }
  }

  return (
    <PageTransition className="flex flex-col items-center text-center px-4 py-12 lg:py-20">
      <div className="text-[100px] lg:text-[120px] font-bold text-gray-200 leading-none">404</div>
      <div className="text-5xl lg:text-6xl -mt-4 mb-2">📦❓</div>
      <h1 className="text-xl font-bold text-txt-1 mt-2">Page introuvable</h1>
      <p className="text-[13px] text-txt-2 mt-1.5 max-w-xs">
        Oups ! Cette page n'existe pas ou a été déplacée.
      </p>

      <div ref={searchContainerRef} className="relative w-full max-w-sm mt-6">
        <form onSubmit={submitSearch}>
          <div className="flex items-center gap-2 bg-surface-1 border border-bord rounded-full px-4 py-2.5">
            <Search size={16} className="text-txt-3 shrink-0" />
            <input
              value={search}
              onChange={handleSearchChange}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Rechercher un produit..."
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
          <div className="absolute top-full left-0 right-0 mt-2 bg-surface-1 border border-bord rounded-2xl shadow-xl z-50 overflow-hidden text-left">
            {searchResults.length === 0 ? (
              <div className="px-4 py-4">
                <p className="text-[13px] text-txt-2">Aucun résultat pour <span className="font-semibold text-txt-1">"{search}"</span></p>
              </div>
            ) : (
              searchResults.map(p => {
                const { price } = getPrice(p);
                return (
                  <Link
                    key={p.id}
                    to={`/produit/${p.slug || p.id}`}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors border-b border-bord last:border-b-0"
                    onClick={() => setShowDropdown(false)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-surface-2 border border-bord overflow-hidden shrink-0 flex items-center justify-center">
                      {p.mainImage
                        ? <CachedImage src={p.mainImage} className="w-full h-full object-contain" />
                        : <Package size={16} className="text-txt-3" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-txt-1 truncate" dir="auto">{p.name}</div>
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

      <p className="text-[12px] text-txt-2 mt-7 mb-2.5">Ou explorez nos catégories :</p>
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-sm">
        {CATEGORY_PILLS.map(({ label, slug }) => (
          <Link
            key={slug}
            to={`/categories/${slug}`}
            className="px-3.5 py-1.5 rounded-full bg-blue-light text-blue text-[12px] font-medium hover:bg-blue hover:text-white transition-colors"
          >
            {label}
          </Link>
        ))}
      </div>

      <Link
        to="/"
        className="mt-9 inline-flex items-center gap-1.5 bg-blue text-white text-[13px] font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
      >
        Retour à l'accueil →
      </Link>
    </PageTransition>
  );
}
