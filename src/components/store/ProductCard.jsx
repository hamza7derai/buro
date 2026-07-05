import { Link } from 'react-router-dom';
import { Heart, Plus, Package } from 'lucide-react';
import CachedImage from '../CachedImage';
import { useCart } from '../../context/CartContext';
import { useFavorites } from '../../context/FavoritesContext';
import { useCategories } from '../../hooks/useCategories';
import { useToast } from '../Toast';
import { getPrice, formatPrice, isPromoActive } from '../../lib/pricing';
import { getStockState, STOCK_LABELS, STOCK_DOT_CLASS } from '../../lib/stock';

export default function ProductCard({ product, className = '' }) {
  const { addToCart } = useCart();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { getCategoryName } = useCategories();
  const toast = useToast();
  const fav = isFavorite(product.id);
  const { price, oldPrice } = getPrice(product);
  const stock = product.totalStock ?? 0;
  const lowStockThreshold = product.lowStockThreshold ?? 3;
  const stockState = product.isOutOfStock ? 'out' : getStockState(stock, lowStockThreshold);
  const inStock = stockState !== 'out';
  const subcategoryRaw = product.categoryPath?.[1] || product.subcategory || '';
  const categoryLabel = getCategoryName(subcategoryRaw) || getCategoryName(product.categoryPath?.[0]) || '';
  const href = `/produit/${product.slug || product.id}`;

  const hasSizeVariants = product.variantTypes?.some(t => t === 'taille' || t === 'size');
  const showStartingFrom = !!product.variantPricesVary && !!hasSizeVariants;
  const displayPrice = showStartingFrom ? (product.variantMinPrice ?? price) : price;

  const promoActive = isPromoActive(product.promo);
  const discountPct = promoActive && product.promo?.promoPrice && product.basePriceSell
    ? Math.round((1 - product.promo.promoPrice / product.basePriceSell) * 100)
    : 0;

  function handleFavorite(e) {
    e.preventDefault();
    const nowFav = toggleFavorite(product.id);
    toast(nowFav ? 'Ajouté aux favoris' : 'Retiré des favoris', 'info');
  }

  return (
    <div className={`relative bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col ${className}`}>
      <Link to={href} className="relative block aspect-square bg-white rounded-t-xl overflow-hidden">
        {product.mainImage ? (
          <CachedImage src={product.mainImage} alt={product.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package size={32} className="text-gray-400" />
          </div>
        )}
        {promoActive && discountPct > 0 && (
          <span className="absolute top-2 left-2 bg-red-50 text-red-500 text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none">
            -{discountPct}%
          </span>
        )}
        <button
          type="button"
          onClick={handleFavorite}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow"
        >
          <Heart size={14} className={fav ? 'fill-danger text-danger' : 'text-txt-3'} />
        </button>
      </Link>
      <div className="px-3 pt-2 pb-3 flex flex-col gap-1 flex-1">
        {product.brand && (
          <span className="text-[11px] text-[#2563eb] font-medium leading-none">{product.brand}</span>
        )}
        <Link to={href} className="text-[13px] font-medium text-txt-1 line-clamp-2 leading-snug" dir="auto">
          {product.name}
        </Link>
        {product.isBook && product.bookInfo?.author && (
          <span className="text-[11px] text-txt-3 leading-tight line-clamp-1" dir="auto">
            {[product.bookInfo.author, product.bookInfo.publisher].filter(Boolean).join(' · ')}
          </span>
        )}
        <div className="flex items-center justify-between mt-auto pt-1.5">
          <div className="flex flex-col">
            {showStartingFrom && <span className="text-[10px] text-txt-2 leading-none mb-0.5">À partir de</span>}
            {oldPrice && !showStartingFrom && (
              <span className="font-mono text-[11px] text-txt-3 line-through leading-none mb-0.5">{formatPrice(oldPrice)}</span>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-navy text-[14px]">{formatPrice(displayPrice)}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${STOCK_DOT_CLASS[stockState]}`} />
              <span className="text-[10px] text-txt-2">{STOCK_LABELS[stockState]}</span>
            </div>
          </div>
          <button
            type="button"
            disabled={!inStock}
            onClick={() => addToCart(product, null, 1)}
            className="w-8 h-8 rounded-full bg-blue text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
