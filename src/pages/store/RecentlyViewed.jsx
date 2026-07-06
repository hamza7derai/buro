import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';
import { useMinLoadingTime } from '../../hooks/useMinLoadingTime';
import ProductCard from '../../components/store/ProductCard';
import { SkeletonGrid, StaggeredFadeIn } from '../../components/SkeletonCard';
import PageTransition from '../../components/PageTransition';

export default function RecentlyViewed() {
  const { products, loading } = useProducts();
  const { recentlyViewedIds } = useRecentlyViewed();
  const showSkeleton = useMinLoadingTime(loading);

  const recentlyViewed = recentlyViewedIds
    .map(id => products.find(p => p.id === id))
    .filter(p => p && p.isVisible !== false);

  return (
    <PageTransition className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      <div className="flex items-center gap-1.5 text-[12px] text-txt-2">
        <Link to="/" className="hover:text-txt-1">Accueil</Link>
        <ChevronRight size={12} className="shrink-0" />
        <span className="text-txt-1 font-medium">Récemment consultés</span>
      </div>

      <div>
        <h1 className="text-xl font-bold text-txt-1">Récemment consultés</h1>
        <p className="text-[13px] text-txt-2 mt-0.5">Les produits que vous avez récemment ouverts.</p>
      </div>

      {showSkeleton ? (
        <SkeletonGrid />
      ) : recentlyViewed.length === 0 ? (
        <p className="text-[13px] text-txt-3">Vous n'avez consulté aucun produit pour le moment.</p>
      ) : (
        <StaggeredFadeIn className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
          {recentlyViewed.map(p => <ProductCard key={p.id} product={p} />)}
        </StaggeredFadeIn>
      )}
    </PageTransition>
  );
}
