import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Search, ChevronRight, Package } from 'lucide-react';
import { useCategories } from '../../hooks/useCategories';
import { useProducts } from '../../hooks/useProducts';
import { Skeleton } from '../../components/Skeleton';
import PageTransition from '../../components/PageTransition';
import { getCategoryVisual, getCategoryDescription, DEFAULT_CATEGORIES } from '../../lib/categoryIcons';

export default function Categories() {
  const { mainCategories, loading } = useCategories();
  const { products } = useProducts();
  const [search, setSearch] = useState('');

  const categories = mainCategories.length > 0 ? mainCategories : DEFAULT_CATEGORIES;

  function matchesCategory(p, cat) {
    const value = p.categoryPath?.[0];
    return value === cat.id || value === cat.name;
  }

  function countFor(cat) {
    return products.filter(p => p.isVisible !== false && !p.isManuel && matchesCategory(p, cat)).length;
  }

  const filtered = categories
    .filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    .map(cat => ({ cat, count: countFor(cat) }))
    .filter(({ count }) => count > 0);

  return (
    <PageTransition className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      <div>
        <h1 className="text-xl font-bold text-txt-1">Catégories</h1>
        <p className="text-[13px] text-txt-2 mt-0.5">Trouvez tout ce dont vous avez besoin.</p>
      </div>

      <div className="flex items-center gap-2 bg-surface-1 border border-bord rounded-full px-4 py-2.5">
        <Search size={16} className="text-txt-3 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une catégorie..."
          className="flex-1 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2 rounded-xl p-6 h-[230px] shadow-sm bg-white">
              <Skeleton className="w-16 h-16 rounded-2xl mt-1" />
              <Skeleton className="h-4 w-2/3 mt-3" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-5 w-20 mt-auto rounded-full" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-txt-3">Aucune catégorie trouvée.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(({ cat, count }, i) => {
            const { image } = getCategoryVisual(cat.name);
            const description = cat.description || getCategoryDescription(cat.name);
            return (
              <Link
                key={cat.slug || i}
                to={`/categories/${cat.slug}`}
                className="relative flex flex-col items-center text-center gap-1 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 h-[230px]"
              >
                <ChevronRight size={18} className="absolute top-4 right-4 text-txt-3" />

                <span className="w-16 h-16 flex items-center justify-center overflow-hidden mt-1">
                  {image ? <img src={import.meta.env.BASE_URL + image} alt="" className="w-16 h-16 object-contain" /> : <Package size={28} className="text-gray-400" />}
                </span>
                <h3 className="text-[15px] font-bold text-txt-1 leading-snug mt-3">{cat.name}</h3>
                <p className="text-[12px] text-txt-2 line-clamp-2 leading-snug px-2">{description}</p>
                <span className="mt-auto text-[11px] font-semibold text-txt-1 bg-surface-2 rounded-full px-3 py-1">
                  {count} produit{count !== 1 ? 's' : ''}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </PageTransition>
  );
}
