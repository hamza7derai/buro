import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, MessageCircle, Bell, Plus, List, LayoutGrid, Heart, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { Skeleton } from '../../components/Skeleton';
import { SkeletonRow, FadeIn } from '../../components/SkeletonCard';
import { useMinLoadingTime } from '../../hooks/useMinLoadingTime';
import PageTransition from '../../components/PageTransition';
import FilterPanel, { FilterSection, FilterTriggerButton, FilterChip } from '../../components/store/FilterPanel';
import { getPrice, formatPrice } from '../../lib/pricing';
import { MANUEL_NIVEAUX, MANUEL_CLASSES, MANUEL_MATIERES } from '../../lib/manuelLevels';
import { buildWhatsAppLink } from '../../lib/contact';
import { getStockState, STOCK_LABELS } from '../../lib/stock';
import CachedImage from '../../components/CachedImage';

const PAGE_SIZE = 12;

const MANUELS_FILTERS_KEY = 'younasser_manuels_filters';

function readSavedManuelsFilters() {
  try {
    const raw = sessionStorage.getItem(MANUELS_FILTERS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function stockInfo(product) {
  const stock = product.totalStock ?? 0;
  const state = getStockState(stock, product.lowStockThreshold ?? 3);
  const cls = state === 'ok' ? 'bg-success/10 text-success' : state === 'low' ? 'bg-warn/15 text-warn' : 'bg-danger/10 text-danger';
  return { label: STOCK_LABELS[state], cls, isRupture: state === 'out' };
}

function ManuelCard({ product, layout, onAdd, onNotify }) {
  const { price, oldPrice } = getPrice(product);
  const stock = stockInfo(product);
  const [fav, setFav] = useState(false);
  const meta = [product.manuelInfo?.subject, product.manuelInfo?.grade, product.manuelInfo?.edition]
    .filter(Boolean).join(' · ');

  const cover = (
    <div className={`relative ${layout === 'row' ? 'w-16 h-20 rounded-lg bg-white overflow-hidden shrink-0 p-1' : 'aspect-square bg-white rounded-t-xl overflow-hidden'}`}>
      {product.mainImage
        ? <CachedImage src={product.mainImage} className="w-full h-full object-contain" />
        : <div className="w-full h-full flex items-center justify-center"><Package size={22} className="text-gray-400" /></div>}
      {layout !== 'row' && (
        <button
          type="button"
          onClick={e => { e.preventDefault(); setFav(f => !f); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow"
        >
          <Heart size={14} className={fav ? 'fill-danger text-danger' : 'text-txt-3'} />
        </button>
      )}
    </div>
  );

  const info = (
    <>
      <span className="text-[13px] font-medium text-txt-1 line-clamp-2 leading-snug">{product.name}</span>
      {meta && <span className="text-[11px] text-txt-2">{meta}</span>}
      <span className={`self-start text-[10px] font-medium px-2 py-0.5 rounded-full ${stock.cls}`}>{stock.label}</span>
    </>
  );

  const action = stock.isRupture ? (
    <button
      type="button"
      onClick={e => { e.preventDefault(); onNotify(product); }}
      className="w-8 h-8 rounded-full bg-surface-2 border border-bord text-txt-2 flex items-center justify-center shrink-0"
    >
      <Bell size={14} />
    </button>
  ) : (
    <button
      type="button"
      onClick={e => { e.preventDefault(); onAdd(product); }}
      className="w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center shrink-0 hover:opacity-90 active:scale-95 transition-all"
    >
      <Plus size={16} />
    </button>
  );

  const price_ = (
    <div>
      <div className="font-mono font-bold text-blue text-[14px]">{formatPrice(price)}</div>
      {oldPrice && <div className="font-mono text-[10px] text-txt-3 line-through">{formatPrice(oldPrice)}</div>}
    </div>
  );

  if (layout === 'row') {
    return (
      <Link to={`/produit/${product.slug || product.id}`} className="flex gap-3 bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-shadow">
        {cover}
        <div className="flex-1 min-w-0 flex flex-col gap-1">{info}</div>
        <div className="flex flex-col items-end justify-between shrink-0 text-right">
          {price_}
          {action}
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/produit/${product.slug || product.id}`} className="bg-white rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {cover}
      <div className="p-3 flex flex-col gap-1 flex-1">
        {info}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          {price_}
          {action}
        </div>
      </div>
    </Link>
  );
}

export default function Manuels() {
  const { products, loading } = useProducts();
  const { addToCart } = useCart();
  const toast = useToast();
  const showSkeleton = useMinLoadingTime(loading);

  const savedFilters = readSavedManuelsFilters();

  const [search, setSearch] = useState(() => savedFilters?.search || '');
  const [niveau, setNiveau] = useState(() => savedFilters?.niveau || '');
  const [classe, setClasse] = useState(() => savedFilters?.classe || '');
  const [matiere, setMatiere] = useState(() => savedFilters?.matiere || '');
  const [sort, setSort] = useState(() => savedFilters?.sort || 'pertinence');
  const [viewMode, setViewMode] = useState('grid');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem(MANUELS_FILTERS_KEY, JSON.stringify({ search, niveau, classe, matiere, sort }));
  }, [search, niveau, classe, matiere, sort]);

  const manuels = products.filter(p => p.isManuel && p.isVisible !== false);

  const filtered = manuels.filter(p => {
    if (niveau && p.manuelInfo?.level !== niveau) return false;
    if (classe) {
      if (niveau === 'Supérieur') {
        if (!p.manuelInfo?.grade?.toLowerCase().includes(classe.trim().toLowerCase())) return false;
      } else if (p.manuelInfo?.grade !== classe) return false;
    }
    if (matiere && p.manuelInfo?.subject !== matiere) return false;
    if (search.trim() && !p.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const sorted = [...filtered];
  if (sort === 'asc') sorted.sort((a, b) => getPrice(a).price - getPrice(b).price);
  else if (sort === 'desc') sorted.sort((a, b) => getPrice(b).price - getPrice(a).price);

  useEffect(() => { setPage(1); }, [search, niveau, classe, matiere, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const panelFilterCount = (classe ? 1 : 0) + (matiere ? 1 : 0);
  function resetFilters() {
    setSearch(''); setNiveau(''); setClasse(''); setMatiere(''); setSort('pertinence');
  }

  const filterChips = [];
  if (classe) filterChips.push({ id: 'classe', label: classe, onRemove: () => setClasse('') });
  if (matiere) filterChips.push({ id: 'matiere', label: matiere, onRemove: () => setMatiere('') });

  function handleAdd(product) {
    addToCart(product, null, 1);
    toast('Manuel ajouté au panier', 'success');
  }
  function handleNotify() {
    toast('Vous serez notifié(e) lorsque ce manuel sera disponible', 'info');
  }

  const whatsappHref = buildWhatsAppLink('Bonjour, je recherche le manuel : ');

  return (
    <PageTransition className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      <div>
        <h1 className="text-xl font-bold text-txt-1">Manuels scolaires</h1>
        <p className="text-[13px] text-txt-2 mt-0.5">Trouvez rapidement votre manuel.</p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-surface-1 border border-bord rounded-full px-4 py-2.5">
          <Search size={16} className="text-txt-3 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un manuel (ex: Transmath, Physique...)"
            className="flex-1 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3"
          />
        </div>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-blue bg-blue-light border border-blue/20 rounded-full px-3.5 py-2 shrink-0 whitespace-nowrap"
        >
          <MessageCircle size={14} /> Vous cherchez un manuel spécifique?
        </a>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <select
          value={niveau}
          onChange={e => { setNiveau(e.target.value); setClasse(''); }}
          className="bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 shrink-0 outline-none"
        >
          <option value="">Niveau</option>
          {MANUEL_NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <FilterTriggerButton count={panelFilterCount} onClick={() => setPanelOpen(true)} />
      </div>

      {filterChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filterChips.map(chip => (
            <FilterChip key={chip.id} label={chip.label} onRemove={chip.onRemove} />
          ))}
        </div>
      )}

      <FilterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onReset={resetFilters}
        resultCount={sorted.length}
        resultLabel={`résultat${sorted.length !== 1 ? 's' : ''}`}
      >
        <FilterSection title="Classe">
          {niveau === 'Supérieur' ? (
            <input
              value={classe}
              onChange={e => setClasse(e.target.value)}
              placeholder="Classe (ex: Licence 2)"
              className="bg-surface-2 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 outline-none"
            />
          ) : !niveau ? (
            <p className="text-[12px] text-txt-3">Sélectionnez d'abord un niveau.</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                <input type="radio" name="classe" checked={classe === ''} onChange={() => setClasse('')} className="accent-blue" />
                Toutes les classes
              </label>
              {(MANUEL_CLASSES[niveau] || []).map(c => (
                <label key={c} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                  <input type="radio" name="classe" checked={classe === c} onChange={() => setClasse(c)} className="accent-blue" />
                  {c}
                </label>
              ))}
            </>
          )}
        </FilterSection>
        <FilterSection title="Matière">
          <label className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
            <input type="radio" name="matiere" checked={matiere === ''} onChange={() => setMatiere('')} className="accent-blue" />
            Toutes les matières
          </label>
          {MANUEL_MATIERES.map(m => (
            <label key={m} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
              <input type="radio" name="matiere" checked={matiere === m} onChange={() => setMatiere(m)} className="accent-blue" />
              {m}
            </label>
          ))}
        </FilterSection>
      </FilterPanel>

      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-txt-1">Résultats ({sorted.length})</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-surface-1 border border-bord rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-blue text-white' : 'text-txt-2'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-blue text-white' : 'text-txt-2'}`}
            >
              <List size={14} />
            </button>
          </div>
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="bg-surface-1 border border-bord rounded-lg px-2.5 py-1.5 text-[12px] text-txt-1 outline-none"
          >
            <option value="pertinence">Pertinence</option>
            <option value="asc">Prix croissant</option>
            <option value="desc">Prix décroissant</option>
          </select>
        </div>
      </div>

      {showSkeleton ? (
        viewMode === 'list' ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-3 bg-white rounded-xl shadow-sm p-3">
                <Skeleton className="w-16 h-20 rounded-lg shrink-0" />
                <div className="flex-1 flex flex-col gap-2 py-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <SkeletonRow />
        )
      ) : sorted.length === 0 ? (
        <p className="text-[13px] text-txt-3">Aucun manuel trouvé pour ces critères.</p>
      ) : (
        <>
          <FadeIn className={viewMode === 'grid' ? 'grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5' : 'flex flex-col gap-3'}>
            {paged.map(p => (
              <ManuelCard key={p.id} product={p} layout={viewMode === 'grid' ? 'grid' : 'row'} onAdd={handleAdd} onNotify={handleNotify} />
            ))}
          </FadeIn>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 rounded-full border border-bord bg-surface-1 flex items-center justify-center text-txt-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[12px] text-txt-2 font-medium">Page {page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-8 h-8 rounded-full border border-bord bg-surface-1 flex items-center justify-center text-txt-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </PageTransition>
  );
}
