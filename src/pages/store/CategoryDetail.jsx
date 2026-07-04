import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import BrandDropdown from '../../components/BrandDropdown';
import ProductCard from '../../components/store/ProductCard';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { getPrice } from '../../lib/pricing';
import { getCategoryVisual, DEFAULT_CATEGORIES } from '../../lib/categoryIcons';
import { BOOK_LANGUAGES, isBookCategoryName, genreKey } from '../../lib/bookMeta';

const PAGE_SIZE = 12;

const selectCls = 'bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 shrink-0 outline-none';

function subcategoryRaw(p) {
  return p.categoryPath?.[1] || p.subcategory || '';
}

export default function CategoryDetail() {
  const { slug } = useParams();
  const { mainCategories, subCategoriesOf, loading: catLoading } = useCategories();
  const { products, loading } = useProducts();

  const [subcat, setSubcat] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  // standard filters
  const [brand, setBrand] = useState('');
  const [stock, setStock] = useState('');
  // shared filters
  const [priceRange, setPriceRange] = useState('');
  const [sort, setSort] = useState('pertinence');
  // book-specific filters
  const [bookAuthor, setBookAuthor] = useState('');
  const [bookPublisher, setBookPublisher] = useState('');
  const [bookGenre, setBookGenre] = useState('');
  const [bookLanguage, setBookLanguage] = useState('');

  const [page, setPage] = useState(1);

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
      if (brand && p.brand !== brand) return false;
      const inStock = !p.isOutOfStock && (p.totalStock ?? 0) > 0;
      if (stock === 'in' && !inStock) return false;
      if (stock === 'out' && inStock) return false;
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

  useEffect(() => {
    setBrand(''); setBookAuthor(''); setBookPublisher(''); setBookGenre(''); setBookLanguage('');
    setSelectedTags([]);
  }, [subcat]);

  useEffect(() => {
    setPage(1);
  }, [slug, subcat, selectedTags, brand, priceRange, stock, sort, bookAuthor, bookPublisher, bookGenre, bookLanguage]);

  // Reset all filters when slug changes
  useEffect(() => {
    setSubcat(''); setSelectedTags([]);
    setBrand(''); setStock(''); setPriceRange(''); setSort('pertinence');
    setBookAuthor(''); setBookPublisher(''); setBookGenre(''); setBookLanguage('');
  }, [slug]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const hasActiveFilters = isBookCategory
    ? Boolean(subcat || selectedTags.length || bookAuthor || bookPublisher || bookGenre || bookLanguage || priceRange)
    : Boolean(subcat || selectedTags.length || brand || priceRange || stock);

  function resetFilters() {
    setSubcat(''); setSelectedTags([]);
    setBrand(''); setPriceRange(''); setStock('');
    setBookAuthor(''); setBookPublisher(''); setBookGenre(''); setBookLanguage('');
  }

  return (
    <div className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      <div className="flex items-center gap-1.5 text-[12px] text-txt-2 overflow-x-auto whitespace-nowrap">
        <Link to="/store" className="hover:text-txt-1">Accueil</Link>
        <ChevronRight size={12} className="shrink-0" />
        <Link to="/store/categories" className="hover:text-txt-1">Catégories</Link>
        <ChevronRight size={12} className="shrink-0" />
        <span className="text-txt-1 font-medium">{category?.name || 'Catégorie'}</span>
      </div>

      {!catLoading && !category ? (
        <p className="text-[13px] text-txt-3">
          Catégorie introuvable. <Link to="/store/categories" className="text-blue">Retour aux catégories</Link>
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

          {/* Subcategory pills */}
          {(subcategoryDocs.length > 0 || fallbackSubNames.length > 0) && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSubcat('')}
                className={`shrink-0 whitespace-nowrap text-[12px] font-medium rounded-full px-3.5 py-1.5 transition-colors ${subcat === '' ? 'bg-blue text-white' : 'bg-surface-1 border border-bord text-txt-2'}`}
              >
                Tous
              </button>
              {subcategoryDocs.length > 0
                ? subcategoryDocs.map(sub => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSubcat(sub.id)}
                      className={`shrink-0 whitespace-nowrap text-[12px] font-medium rounded-full px-3.5 py-1.5 transition-colors ${subcat === sub.id ? 'bg-blue text-white' : 'bg-surface-1 border border-bord text-txt-2'}`}
                    >
                      {isBookCategory && sub.nameAr ? (
                        <span>{sub.name} <span className="opacity-60" dir="rtl">· {sub.nameAr}</span></span>
                      ) : sub.name}
                    </button>
                  ))
                : fallbackSubNames.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSubcat(name)}
                      className={`shrink-0 whitespace-nowrap text-[12px] font-medium rounded-full px-3.5 py-1.5 transition-colors ${subcat === name ? 'bg-blue text-white' : 'bg-surface-1 border border-bord text-txt-2'}`}
                    >
                      {name}
                    </button>
                  ))}
            </div>
          )}

          {/* Tag pills */}
          {availableTags.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-[11px] text-txt-3 shrink-0 font-semibold uppercase tracking-wide">Tags</span>
              {availableTags.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTags(prev =>
                      active ? prev.filter(t => t !== tag) : [...prev, tag]
                    )}
                    className={`shrink-0 whitespace-nowrap text-[11px] font-medium rounded-full px-3 py-1 transition-colors border ${
                      active
                        ? 'bg-blue text-white border-blue'
                        : 'bg-transparent border-bord text-txt-2 hover:border-blue hover:text-blue'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  className="text-[11px] text-txt-3 hover:text-txt-1 shrink-0 pl-1"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Filter bar — book-specific or standard */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-wrap">
            {isBookCategory ? (
              <>
                <select value={bookAuthor} onChange={e => setBookAuthor(e.target.value)} className={selectCls}>
                  <option value="">Auteur</option>
                  {uniqueAuthors.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={bookPublisher} onChange={e => setBookPublisher(e.target.value)} className={selectCls}>
                  <option value="">Éditeur</option>
                  {uniquePublishers.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                {uniqueGenres.length > 0 && (
                  <select value={bookGenre} onChange={e => setBookGenre(e.target.value)} className={selectCls}>
                    <option value="">Genre</option>
                    {uniqueGenres.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
                <select value={bookLanguage} onChange={e => setBookLanguage(e.target.value)} className={selectCls}>
                  <option value="">Langue</option>
                  {BOOK_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </>
            ) : (
              <>
                <BrandDropdown mode="select" value={brand} onChange={setBrand} className={selectCls} emptyOptionLabel="Marque" />
                <select value={stock} onChange={e => setStock(e.target.value)} className={selectCls}>
                  <option value="">Stock</option>
                  <option value="in">En stock</option>
                  <option value="out">Rupture</option>
                </select>
              </>
            )}
            <select value={priceRange} onChange={e => setPriceRange(e.target.value)} className={selectCls}>
              <option value="">Tous les prix</option>
              <option value="lt10">Moins de 10 DH</option>
              <option value="10-50">10-50 DH</option>
              <option value="50-100">50-100 DH</option>
              <option value="gt100">Plus de 100 DH</option>
            </select>
            <select value={sort} onChange={e => setSort(e.target.value)} className={selectCls}>
              <option value="pertinence">Pertinence</option>
              <option value="asc">Prix croissant</option>
              <option value="desc">Prix décroissant</option>
              <option value="new">Nouveautés</option>
            </select>
            {hasActiveFilters && (
              <button type="button" onClick={resetFilters} className="text-[12px] font-medium text-blue shrink-0 px-2">
                Réinitialiser
              </button>
            )}
          </div>

          {loading || catLoading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
              {Array.from({ length: PAGE_SIZE }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-[13px] text-txt-3">Aucun produit ne correspond à ces filtres.</p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
                {paged.map(p => <ProductCard key={p.id} product={p} />)}
              </div>

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
    </div>
  );
}
