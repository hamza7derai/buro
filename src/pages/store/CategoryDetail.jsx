import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import ProductCard from '../../components/store/ProductCard';
import { SkeletonRow, StaggeredFadeIn } from '../../components/SkeletonCard';
import { useMinLoadingTime } from '../../hooks/useMinLoadingTime';
import PageTransition from '../../components/PageTransition';
import FilterPanel, { FilterSection, FilterTriggerButton, FilterChip } from '../../components/store/FilterPanel';
import { getPrice, isPromoActive } from '../../lib/pricing';
import { getStockState, STOCK_LABELS } from '../../lib/stock';
import { getCategoryVisual, DEFAULT_CATEGORIES } from '../../lib/categoryIcons';
import { BOOK_LANGUAGES, isBookCategoryName, genreKey } from '../../lib/bookMeta';

const PAGE_SIZE = 12;

const selectCls = 'bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 shrink-0 outline-none';

const PRICE_RANGE_LABELS = {
  lt10: 'Moins de 10 DH',
  '10-50': '10-50 DH',
  '50-100': '50-100 DH',
  gt100: 'Plus de 100 DH',
};

const AVAILABILITY_ORDER = ['ok', 'low', 'out'];

const pillBase = 'shrink-0 whitespace-nowrap text-[12px] font-medium rounded-full transition-colors';
function pillCls(active) {
  return active
    ? `${pillBase} bg-blue text-white shadow-sm px-4 py-2`
    : `${pillBase} bg-[#f1f5f9] text-txt-1 hover:bg-[#e2e8f0] px-3.5 py-1.5`;
}

function subcategoryRaw(p) {
  return p.categoryPath?.[1] || p.subcategory || '';
}

function catFiltersKey(slug) {
  return `younasser_cat_filters_${slug}`;
}

function readSavedCatFilters(slug) {
  try {
    const raw = sessionStorage.getItem(catFiltersKey(slug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CategoryDetail() {
  const { slug } = useParams();
  const { mainCategories, subCategoriesOf, loading: catLoading } = useCategories();
  const { products, loading } = useProducts();
  const [searchParams] = useSearchParams();
  const showSkeleton = useMinLoadingTime(loading || catLoading);

  const savedFilters = readSavedCatFilters(slug);

  const [subcat, setSubcat] = useState(() => savedFilters?.subcategory || '');
  const [selectedTags, setSelectedTags] = useState(() => savedFilters?.tags || []);
  // standard filters
  const [brands, setBrands] = useState(() => savedFilters?.brands || []);
  const [availability, setAvailability] = useState(() => savedFilters?.availability || []);
  const [promoOnly, setPromoOnly] = useState(() => savedFilters?.promoOnly || false);
  // shared filters
  const [priceRange, setPriceRange] = useState(() => savedFilters?.priceRange || '');
  const [sort, setSort] = useState(() => savedFilters?.sort || 'pertinence');
  // book-specific filters
  const [bookAuthor, setBookAuthor] = useState(() => savedFilters?.bookAuthor || '');
  const [bookPublisher, setBookPublisher] = useState(() => savedFilters?.bookPublisher || '');
  const [bookGenre, setBookGenre] = useState(() => savedFilters?.bookGenre || '');
  const [bookLanguage, setBookLanguage] = useState(() => savedFilters?.bookLanguage || '');

  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  // Subcategory pills scroll-fade indicators
  const pillsRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  function updatePillsFade() {
    const el = pillsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }
  useEffect(() => {
    updatePillsFade();
    const el = pillsRef.current;
    if (!el) return;
    const onResize = () => updatePillsFade();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  });

  const categories = mainCategories.length > 0 ? mainCategories : DEFAULT_CATEGORIES;
  const category = categories.find(c => c.slug === slug);
  const { emoji } = getCategoryVisual(category?.name || '');
  const isBookCategory = isBookCategoryName(category?.name);

  const baseItems = products.filter(p => {
    if (p.isVisible === false || p.isManuel || !category) return false;
    const value = p.categoryPath?.[0];
    return value === category.id || value === category.name;
  });

  const subcategoryDocs = category?.id ? subCategoriesOf(category.id) : [];
  const fallbackSubNames = subcategoryDocs.length === 0
    ? [...new Set(baseItems.map(subcategoryRaw).filter(Boolean))].sort()
    : [];

  function matchesSubcat(p) {
    if (!subcat) return true;
    const raw = subcategoryRaw(p);
    if (subcategoryDocs.length > 0) {
      const subDoc = subcategoryDocs.find(s => s.id === subcat);
      return raw === subDoc?.id || raw === subDoc?.name;
    }
    return raw === subcat;
  }

  // Items after subcategory filter — used to compute available refinements
  const subcatItems = baseItems.filter(matchesSubcat);

  // Brands available within the current subcategory only (re-populates when subcat changes)
  const uniqueBrands = [...new Set(subcatItems.map(p => p.brand).filter(Boolean))].sort();

  // Book option lists — unique values from subcategory-filtered items
  const uniqueAuthors = [...new Set(subcatItems.map(p => p.bookInfo?.author).filter(Boolean))].sort();
  const uniquePublishers = [...new Set(subcatItems.map(p => p.bookInfo?.publisher).filter(Boolean))].sort();

  // Unique genres from products in the current subcategory (new array format + legacy single-genre)
  const uniqueGenres = [...new Set(
    subcatItems.flatMap(p => {
      if (Array.isArray(p.bookInfo?.genres) && p.bookInfo.genres.length) return p.bookInfo.genres;
      const legacy = genreKey(p.bookInfo?.genre);
      return legacy ? [legacy] : [];
    })
  )].sort();

  // Available tags sorted by frequency (top 20)
  const tagCounts = {};
  subcatItems.forEach(p => {
    (p.tags || []).forEach(tag => { tagCounts[tag] = (tagCounts[tag] || 0) + 1; });
  });
  const availableTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([tag]) => tag);

  const filtered = baseItems.filter(p => {
    if (!matchesSubcat(p)) return false;
    // Tag filter — AND logic: product must have ALL selected tags
    if (selectedTags.length > 0 && !selectedTags.every(t => (p.tags || []).includes(t))) return false;
    if (isBookCategory) {
      if (bookAuthor && p.bookInfo?.author !== bookAuthor) return false;
      if (bookPublisher && p.bookInfo?.publisher !== bookPublisher) return false;
      if (bookGenre) {
        const hasGenreNew = Array.isArray(p.bookInfo?.genres) && p.bookInfo.genres.includes(bookGenre);
        const hasGenreLegacy = genreKey(p.bookInfo?.genre) === bookGenre;
        if (!hasGenreNew && !hasGenreLegacy) return false;
      }
      if (bookLanguage && p.bookInfo?.language !== bookLanguage) return false;
    } else {
      if (brands.length > 0 && !brands.includes(p.brand)) return false;
      if (availability.length > 0) {
        const state = getStockState(p.totalStock ?? 0, p.lowStockThreshold ?? 3);
        if (!availability.includes(state)) return false;
      }
      if (promoOnly && !isPromoActive(p.promo)) return false;
    }
    if (priceRange) {
      const { price } = getPrice(p);
      if (priceRange === 'lt10' && !(price < 10)) return false;
      if (priceRange === '10-50' && !(price >= 10 && price < 50)) return false;
      if (priceRange === '50-100' && !(price >= 50 && price < 100)) return false;
      if (priceRange === 'gt100' && !(price >= 100)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  if (sort === 'asc') sorted.sort((a, b) => getPrice(a).price - getPrice(b).price);
  else if (sort === 'desc') sorted.sort((a, b) => getPrice(b).price - getPrice(a).price);
  else if (sort === 'new') sorted.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

  // Compares against the previous subcat value (rather than a "did mount" boolean
  // flag) so this stays correct under React StrictMode's dev-only double-invoking
  // of mount effects — a flag-based guard would wrongly fire on the replay.
  const prevSubcatRef = useRef(subcat);
  useEffect(() => {
    if (prevSubcatRef.current === subcat) return;
    prevSubcatRef.current = subcat;
    setBrands([]); setAvailability([]); setPromoOnly(false);
    setBookAuthor(''); setBookPublisher(''); setBookGenre(''); setBookLanguage('');
    setSelectedTags([]);
  }, [subcat]);

  useEffect(() => {
    setPage(1);
  }, [slug, subcat, selectedTags, brands, priceRange, availability, promoOnly, sort, bookAuthor, bookPublisher, bookGenre, bookLanguage]);

  // Persist the current filters (and scroll position) to sessionStorage on every
  // change, keyed per category, so a later mount of this page (e.g. via the
  // browser back button from a product page) can restore the same view.
  function snapshotFilters(scrollPosition) {
    return {
      subcategory: subcat,
      tags: selectedTags,
      brands,
      availability,
      promoOnly,
      priceRange,
      sort,
      bookAuthor,
      bookPublisher,
      bookGenre,
      bookLanguage,
      scrollPosition: scrollPosition ?? window.scrollY,
    };
  }

  useEffect(() => {
    sessionStorage.setItem(catFiltersKey(slug), JSON.stringify(snapshotFilters()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, subcat, selectedTags, brands, availability, promoOnly, priceRange, sort, bookAuthor, bookPublisher, bookGenre, bookLanguage]);

  // Navigating to a different category (not just a different subcategory pill)
  // clears that previous category's saved filters and loads whatever was saved
  // for the newly-entered category, if any.
  const prevSlugRef = useRef(slug);
  useEffect(() => {
    if (prevSlugRef.current === slug) return;
    sessionStorage.removeItem(catFiltersKey(prevSlugRef.current));
    prevSlugRef.current = slug;
    const saved = readSavedCatFilters(slug);
    setSubcat(saved?.subcategory || '');
    setSelectedTags(saved?.tags || []);
    setBrands(saved?.brands || []);
    setAvailability(saved?.availability || []);
    setPromoOnly(saved?.promoOnly || false);
    setPriceRange(saved?.priceRange || '');
    setSort(saved?.sort || 'pertinence');
    setBookAuthor(saved?.bookAuthor || '');
    setBookPublisher(saved?.bookPublisher || '');
    setBookGenre(saved?.bookGenre || '');
    setBookLanguage(saved?.bookLanguage || '');
  }, [slug]);

  // A breadcrumb link from the product page (e.g. /categories/fournitures-scolaires?sub=Cahiers)
  // carries the subcategory name in the URL — resolve it to the internal subcat
  // value once categories have loaded, overriding whatever was restored above.
  const appliedSubParamRef = useRef(false);
  useEffect(() => {
    if (appliedSubParamRef.current || catLoading) return;
    appliedSubParamRef.current = true;
    const subParam = searchParams.get('sub');
    if (!subParam) return;
    if (subcategoryDocs.length > 0) {
      const match = subcategoryDocs.find(s => s.id === subParam || s.name === subParam);
      if (match) setSubcat(match.id);
    } else if (fallbackSubNames.includes(subParam)) {
      setSubcat(subParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catLoading]);

  // Restore scroll position once the product grid has actually rendered.
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current || loading || catLoading) return;
    scrollRestoredRef.current = true;
    const saved = readSavedCatFilters(slug);
    if (saved?.scrollPosition) {
      requestAnimationFrame(() => window.scrollTo(0, saved.scrollPosition));
    }
  }, [loading, catLoading, slug]);

  // Capture the exact scroll position right before the user leaves for a
  // product page, so the back button lands in the same spot.
  function handleProductGridClick() {
    sessionStorage.setItem(catFiltersKey(slug), JSON.stringify(snapshotFilters(window.scrollY)));
  }

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const activeFilterCount = isBookCategory
    ? [bookAuthor, bookPublisher, bookGenre, bookLanguage, priceRange].filter(Boolean).length + (selectedTags.length > 0 ? 1 : 0)
    : (brands.length > 0 ? 1 : 0) + (priceRange ? 1 : 0) + (availability.length > 0 ? 1 : 0) + (promoOnly ? 1 : 0) + (selectedTags.length > 0 ? 1 : 0);

  function toggleTag(tag) {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }

  function toggleBrand(b) {
    setBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  }

  function toggleAvailability(state) {
    setAvailability(prev => prev.includes(state) ? prev.filter(x => x !== state) : [...prev, state]);
  }

  function resetFilters() {
    setSubcat(''); setSelectedTags([]);
    setBrands([]); setPriceRange(''); setAvailability([]); setPromoOnly(false);
    setBookAuthor(''); setBookPublisher(''); setBookGenre(''); setBookLanguage('');
  }

  // Removable chips shown below the pills row for filters applied via the panel
  const filterChips = [];
  if (isBookCategory) {
    if (bookAuthor) filterChips.push({ id: 'author', label: bookAuthor, onRemove: () => setBookAuthor('') });
    if (bookPublisher) filterChips.push({ id: 'publisher', label: bookPublisher, onRemove: () => setBookPublisher('') });
    if (bookGenre) filterChips.push({ id: 'genre', label: bookGenre, onRemove: () => setBookGenre('') });
    if (bookLanguage) filterChips.push({ id: 'language', label: bookLanguage, onRemove: () => setBookLanguage('') });
  } else {
    brands.forEach(b => filterChips.push({ id: `brand-${b}`, label: b, onRemove: () => toggleBrand(b) }));
    availability.forEach(a => filterChips.push({ id: `avail-${a}`, label: STOCK_LABELS[a], onRemove: () => toggleAvailability(a) }));
    if (promoOnly) filterChips.push({ id: 'promo', label: 'Promotions', onRemove: () => setPromoOnly(false) });
  }
  if (priceRange) filterChips.push({ id: 'price', label: PRICE_RANGE_LABELS[priceRange], onRemove: () => setPriceRange('') });
  selectedTags.forEach(t => filterChips.push({ id: `tag-${t}`, label: t, onRemove: () => toggleTag(t) }));

  return (
    <PageTransition className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      <div className="flex items-center gap-1.5 text-[12px] text-txt-2 overflow-x-auto whitespace-nowrap">
        <Link to="/" className="hover:text-txt-1">Accueil</Link>
        <ChevronRight size={12} className="shrink-0" />
        <Link to="/categories" className="hover:text-txt-1">Catégories</Link>
        <ChevronRight size={12} className="shrink-0" />
        <span className="text-txt-1 font-medium">{category?.name || 'Catégorie'}</span>
      </div>

      {!catLoading && !category ? (
        <p className="text-[13px] text-txt-3">
          Catégorie introuvable. <Link to="/categories" className="text-blue">Retour aux catégories</Link>
        </p>
      ) : (
        <>
          <div>
            <h1 className="text-xl font-bold text-txt-1 flex items-center gap-2">
              <span>{emoji}</span>{category?.name || 'Catégorie'}
            </h1>
            <p className="text-[13px] text-txt-2 mt-0.5">
              {baseItems.length} produit{baseItems.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Subcategory pills — horizontally scrollable, no visible scrollbar, edge fades */}
          {(subcategoryDocs.length > 0 || fallbackSubNames.length > 0) && (
            <div className="relative">
              <div
                ref={pillsRef}
                onScroll={updatePillsFade}
                className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide"
              >
                <button type="button" onClick={() => setSubcat('')} className={pillCls(subcat === '')}>
                  Tous
                </button>
                {subcategoryDocs.length > 0
                  ? subcategoryDocs.map(sub => (
                      <button key={sub.id} type="button" onClick={() => setSubcat(sub.id)} className={pillCls(subcat === sub.id)}>
                        {isBookCategory && sub.nameAr ? (
                          <span>{sub.name} <span className="opacity-60" dir="rtl">· {sub.nameAr}</span></span>
                        ) : sub.name}
                      </button>
                    ))
                  : fallbackSubNames.map(name => (
                      <button key={name} type="button" onClick={() => setSubcat(name)} className={pillCls(subcat === name)}>
                        {name}
                      </button>
                    ))}
              </div>
              {canScrollLeft && (
                <div className="pointer-events-none absolute left-0 inset-y-0 w-8 bg-gradient-to-r from-surface-0 to-transparent" />
              )}
              {canScrollRight && (
                <div className="pointer-events-none absolute right-0 inset-y-0 w-8 bg-gradient-to-l from-surface-0 to-transparent" />
              )}
            </div>
          )}

          {/* Filtres button + Trier par */}
          <div className="flex items-center justify-end gap-2">
            <FilterTriggerButton count={activeFilterCount} onClick={() => setPanelOpen(true)} />
            <select value={sort} onChange={e => setSort(e.target.value)} className={selectCls}>
              <option value="pertinence">Pertinence</option>
              <option value="asc">Prix croissant</option>
              <option value="desc">Prix décroissant</option>
              <option value="new">Nouveautés</option>
            </select>
          </div>

          {/* Applied filters — removable chips */}
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
            resultLabel={`produit${sorted.length !== 1 ? 's' : ''}`}
          >
            {isBookCategory ? (
              <>
                <FilterSection title="Auteur">
                  <label className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                    <input type="radio" name="bookAuthor" checked={bookAuthor === ''} onChange={() => setBookAuthor('')} className="accent-blue" />
                    Tous les auteurs
                  </label>
                  {uniqueAuthors.map(a => (
                    <label key={a} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                      <input type="radio" name="bookAuthor" checked={bookAuthor === a} onChange={() => setBookAuthor(a)} className="accent-blue" />
                      {a}
                    </label>
                  ))}
                </FilterSection>
                <FilterSection title="Éditeur">
                  <label className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                    <input type="radio" name="bookPublisher" checked={bookPublisher === ''} onChange={() => setBookPublisher('')} className="accent-blue" />
                    Tous les éditeurs
                  </label>
                  {uniquePublishers.map(p => (
                    <label key={p} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                      <input type="radio" name="bookPublisher" checked={bookPublisher === p} onChange={() => setBookPublisher(p)} className="accent-blue" />
                      {p}
                    </label>
                  ))}
                </FilterSection>
                {uniqueGenres.length > 0 && (
                  <FilterSection title="Genre">
                    <label className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                      <input type="radio" name="bookGenre" checked={bookGenre === ''} onChange={() => setBookGenre('')} className="accent-blue" />
                      Tous les genres
                    </label>
                    {uniqueGenres.map(g => (
                      <label key={g} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                        <input type="radio" name="bookGenre" checked={bookGenre === g} onChange={() => setBookGenre(g)} className="accent-blue" />
                        {g}
                      </label>
                    ))}
                  </FilterSection>
                )}
                <FilterSection title="Langue">
                  <label className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                    <input type="radio" name="bookLanguage" checked={bookLanguage === ''} onChange={() => setBookLanguage('')} className="accent-blue" />
                    Toutes les langues
                  </label>
                  {BOOK_LANGUAGES.map(l => (
                    <label key={l} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                      <input type="radio" name="bookLanguage" checked={bookLanguage === l} onChange={() => setBookLanguage(l)} className="accent-blue" />
                      {l}
                    </label>
                  ))}
                </FilterSection>
              </>
            ) : (
              <>
                {uniqueBrands.length > 0 && (
                  <FilterSection title="Marque">
                    {uniqueBrands.map(b => (
                      <label key={b} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                        <input type="checkbox" checked={brands.includes(b)} onChange={() => toggleBrand(b)} className="accent-blue" />
                        {b}
                      </label>
                    ))}
                  </FilterSection>
                )}
                <FilterSection title="Disponibilité">
                  {AVAILABILITY_ORDER.map(state => (
                    <label key={state} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                      <input type="checkbox" checked={availability.includes(state)} onChange={() => toggleAvailability(state)} className="accent-blue" />
                      {STOCK_LABELS[state]}
                    </label>
                  ))}
                </FilterSection>
                <FilterSection title="Promotions">
                  <label className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                    <input type="checkbox" checked={promoOnly} onChange={e => setPromoOnly(e.target.checked)} className="accent-blue" />
                    Uniquement les promos
                  </label>
                </FilterSection>
              </>
            )}

            <FilterSection title="Prix">
              {[
                ['', 'Tous les prix'],
                ['lt10', 'Moins de 10 DH'],
                ['10-50', '10-50 DH'],
                ['50-100', '50-100 DH'],
                ['gt100', 'Plus de 100 DH'],
              ].map(([value, label]) => (
                <label key={value || 'all'} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                  <input type="radio" name="priceRange" checked={priceRange === value} onChange={() => setPriceRange(value)} className="accent-blue" />
                  {label}
                </label>
              ))}
            </FilterSection>

            {availableTags.length > 0 && (
              <FilterSection title="Tags">
                {availableTags.map(tag => (
                  <label key={tag} className="flex items-center gap-2 text-[12px] text-txt-1 cursor-pointer">
                    <input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => toggleTag(tag)} className="accent-blue" />
                    {tag}
                  </label>
                ))}
              </FilterSection>
            )}
          </FilterPanel>

          {showSkeleton ? (
            <SkeletonRow />
          ) : sorted.length === 0 ? (
            <p className="text-[13px] text-txt-3">Aucun produit ne correspond à ces filtres.</p>
          ) : (
            <>
              <StaggeredFadeIn className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5" onClick={handleProductGridClick}>
                {paged.map(p => <ProductCard key={p.id} product={p} />)}
              </StaggeredFadeIn>

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
        </>
      )}
    </PageTransition>
  );
}
