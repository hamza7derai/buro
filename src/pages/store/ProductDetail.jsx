import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Minus, Plus, Package, Check, ChevronRight, Truck, Wallet, RotateCcw, ShieldCheck } from 'lucide-react';
import { useProduct } from '../../hooks/useProduct';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { useRecentlyViewed } from '../../hooks/useRecentlyViewed';
import { useMinLoadingTime } from '../../hooks/useMinLoadingTime';
import { getPrice, formatPrice } from '../../lib/pricing';
import { getStockState, STOCK_LABELS, STOCK_DOT_CLASS, STOCK_TEXT_CLASS } from '../../lib/stock';
import { getDeliveryDetailMessage } from '../../lib/delivery';
import { resolveCategoryLabel } from '../../lib/categoryIcons';
import { genreLabel } from '../../lib/bookMeta';
import ProductCard from '../../components/store/ProductCard';
import CachedImage from '../../components/CachedImage';
import { SkeletonProductDetail } from '../../components/SkeletonProductDetail';
import { FadeIn } from '../../components/SkeletonCard';
import PageTransition from '../../components/PageTransition';

export default function ProductDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { product, variants, loading, notFound } = useProduct(slug);
  const { products: allProducts, fetchVariants } = useProducts();
  const { categories, subCategoriesOf } = useCategories();
  const { addToCart, cartCount } = useCart();
  const { recentlyViewedIds, addRecentlyViewed } = useRecentlyViewed();
  const showSkeleton = useMinLoadingTime(loading);

  const [selectedOptions, setSelectedOptions] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedLot, setSelectedLot] = useState(null);
  const scrollRef = useRef(null);

  const variantTypes = product?.variantTypes || [];
  const selectedVariant = product?.hasVariants
    ? variants.find(v => variantTypes.every(t => v.options?.[t] === selectedOptions[t]))
    : null;

  useEffect(() => {
    setSelectedOptions({});
    setQuantity(1);
    setActiveImage(0);
    setSelectedLot(null);
  }, [slug]);

  useEffect(() => {
    setActiveImage(0);
  }, [selectedVariant?.id]);

  useEffect(() => {
    if (product?.id) addRecentlyViewed(product.id);
  }, [product?.id, addRecentlyViewed]);

  if (showSkeleton) {
    return (
      <PageTransition>
        <SkeletonProductDetail />
      </PageTransition>
    );
  }

  if (notFound || !product) {
    return (
      <PageTransition className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <Package size={40} className="text-txt-3" />
        <h1 className="text-lg font-bold text-txt-1">Produit introuvable</h1>
        <Link to="/" className="mt-2 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          Retour à l'accueil
        </Link>
      </PageTransition>
    );
  }

  const categoryLabel = resolveCategoryLabel(categories, product.categoryPath?.[0]);
  const categoryObj = categories.find(c => c.id === product.categoryPath?.[0] || c.name === product.categoryPath?.[0]);
  const subcategoryRaw = product.categoryPath?.[1] || product.subcategory || '';
  const subDoc = categoryObj && subcategoryRaw
    ? subCategoriesOf(categoryObj.id).find(s => s.id === subcategoryRaw || s.name === subcategoryRaw)
    : null;
  const subcategoryLabel = subDoc?.name || subcategoryRaw;
  const { price, oldPrice } = getPrice(product, selectedVariant);
  const discountPct = oldPrice ? Math.round((1 - price / oldPrice) * 100) : null;

  const anyVariantInStock = variants.some(v => (v.stock ?? 0) > 0);
  const inStock = product.hasVariants
    ? (selectedVariant ? selectedVariant.stock > 0 : anyVariantInStock)
    : (!product.isOutOfStock && (product.totalStock ?? 0) > 0);
  const stockValue = product.hasVariants ? (selectedVariant?.stock ?? null) : (product.totalStock ?? 0);
  const stockState = product.isOutOfStock ? 'out' : (stockValue != null ? getStockState(stockValue, product.lowStockThreshold ?? 3) : (inStock ? 'ok' : 'out'));

  const baseImages = [product.mainImage, ...(product.gallery || [])].filter(Boolean);
  const displayImages = selectedVariant?.image
    ? [selectedVariant.image, ...baseImages.filter(src => src !== selectedVariant.image)]
    : baseImages;

  const bulkOffers = product.bulkOffers || [];

  const relatedProducts = (product.relatedProductIds || [])
    .map(rid => allProducts.find(p => p.id === rid))
    .filter(Boolean);
  const boughtTogether = (product.frequentlyBoughtWith || [])
    .map(rid => allProducts.find(p => p.id === rid))
    .filter(Boolean);
  const bundleItems = [product, ...boughtTogether];
  function bundleItemPrice(p) {
    return getPrice(p, p.id === product.id ? selectedVariant : null).price;
  }
  const bundleTotal = bundleItems.reduce((sum, p) => sum + bundleItemPrice(p), 0);

  const alsoViewed = recentlyViewedIds
    .filter(id => id !== product.id)
    .map(id => allProducts.find(p => p.id === id))
    .filter(p => p && p.isVisible !== false);

  function decQty() { setQuantity(q => Math.max(1, q - 1)); }
  function incQty() { setQuantity(q => (stockValue != null ? Math.min(Math.max(stockValue, 1), q + 1) : q + 1)); }

  function handleAddToCart(qty = quantity, priceOverride = null) {
    if (product.hasVariants && !selectedVariant) {
      toast('Sélectionnez une variante', 'error');
      return;
    }
    if (!inStock) {
      toast('Produit épuisé', 'error');
      return;
    }
    addToCart(product, selectedVariant, qty, priceOverride);
    toast('Produit ajouté au panier', 'success');
  }

  function handleAddLot() {
    if (selectedLot == null) return;
    if (product.hasVariants && !selectedVariant) {
      toast('Sélectionnez une variante', 'error');
      return;
    }
    const lot = bulkOffers[selectedLot];
    addToCart(product, selectedVariant, lot.quantity, lot.unitPrice);
    toast(`${lot.name} ajouté au panier`, 'success');
  }

  async function handleAddBundle() {
    if (product.hasVariants && !selectedVariant) {
      toast('Sélectionnez une variante avant d\'ajouter le pack', 'error');
      return;
    }
    for (const p of bundleItems) {
      let variant = p.id === product.id ? selectedVariant : null;
      if (p.id !== product.id && p.hasVariants) {
        const pVariants = await fetchVariants(p.id);
        variant = pVariants.find(v => v.isActive !== false) || pVariants[0] || null;
      }
      addToCart(p, variant, 1);
    }
    toast('Pack ajouté au panier', 'success');
  }

  return (
    <PageTransition>
    <FadeIn className="flex flex-col gap-6 pb-6">
      {/* Breadcrumb */}
      <div className="px-4 lg:px-0 flex items-center gap-1.5 text-[12px] text-txt-2 overflow-x-auto whitespace-nowrap pt-2">
        <Link to="/" className="hover:text-txt-1">Accueil</Link>
        <ChevronRight size={12} className="shrink-0" />
        {categoryObj && (
          <>
            <Link to={`/categories/${categoryObj.slug}`} className="hover:text-txt-1">{categoryLabel}</Link>
            <ChevronRight size={12} className="shrink-0" />
            {subcategoryLabel && (
              <>
                <Link to={`/categories/${categoryObj.slug}?sub=${encodeURIComponent(subcategoryLabel)}`} className="hover:text-txt-1">{subcategoryLabel}</Link>
                <ChevronRight size={12} className="shrink-0" />
              </>
            )}
          </>
        )}
        <span className="text-txt-1 font-medium truncate max-w-[240px]">{product.name}</span>
      </div>

      {/* Mobile sub-header */}
      <div className="lg:hidden flex items-center justify-between px-4 -mt-2">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-surface-1 border border-bord flex items-center justify-center text-txt-1">
          <ArrowLeft size={18} />
        </button>
        <Link to="/panier" className="relative w-9 h-9 rounded-full bg-surface-1 border border-bord flex items-center justify-center text-navy">
          <ShoppingCart size={18} />
          {cartCount > 0 && (
            <span key={cartCount} className="cart-badge-pulse absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-brand-500 text-[9px] font-bold text-white flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </Link>
      </div>

      <div className="px-4 lg:px-0 lg:grid lg:grid-cols-2 lg:gap-10">
        {/* ===== Gallery ===== */}
        <div>
          {/* Mobile swipe carousel */}
          <div className="lg:hidden">
            <div
              ref={scrollRef}
              onScroll={e => {
                const w = e.currentTarget.clientWidth || 1;
                setActiveImage(Math.round(e.currentTarget.scrollLeft / w));
              }}
              className="flex overflow-x-auto snap-x snap-mandatory rounded-2xl bg-white aspect-square"
            >
              {displayImages.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center shrink-0 snap-center"><Package size={48} className="text-gray-400" /></div>
              ) : displayImages.map((src, i) => (
                <CachedImage key={i} src={src} className="w-full h-full object-contain shrink-0 snap-center" />
              ))}
            </div>
            {displayImages.length > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-2.5">
                {displayImages.map((_, i) => (
                  <span key={i} className={`h-1.5 rounded-full transition-all ${i === activeImage ? 'w-4 bg-blue' : 'w-1.5 bg-bord'}`} />
                ))}
              </div>
            )}
          </div>

          {/* Desktop main image + thumbnails */}
          <div className="hidden lg:flex lg:flex-col lg:gap-3">
            <div className="aspect-square rounded-2xl bg-white border border-bord overflow-hidden flex items-center justify-center">
              {displayImages.length > 0 ? (
                <CachedImage src={displayImages[activeImage] || displayImages[0]} className="w-full h-full object-contain" />
              ) : <Package size={64} className="text-gray-400" />}
            </div>
            {displayImages.length > 1 && (
              <div className="flex gap-2">
                {displayImages.map((src, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors shrink-0 bg-[#f0f0f0] ${i === activeImage ? 'border-blue' : 'border-bord'}`}
                  >
                    <CachedImage src={src} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ===== Info ===== */}
        <div className="flex flex-col gap-4 mt-5 lg:mt-0">
          <div>
            {categoryLabel && (
              <span className="text-[11px] text-blue bg-blue-light rounded-full px-2.5 py-1">{categoryLabel}</span>
            )}
            <h1 className="text-xl lg:text-2xl font-bold text-txt-1 mt-2" dir="auto">{product.name}</h1>
          </div>

          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${STOCK_DOT_CLASS[stockState]}`} />
            <span className={`text-[12px] font-medium ${STOCK_TEXT_CLASS[stockState]}`}>
              {STOCK_LABELS[stockState]}
            </span>
            {product.totalSold > 0 && (
              <span className="text-[11px] text-txt-3">· ✓ Acheté {product.totalSold} fois</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-navy text-2xl">{formatPrice(price)}</span>
            {oldPrice && (
              <>
                <span className="font-mono text-txt-3 line-through text-[14px]">{formatPrice(oldPrice)}</span>
                <span className="bg-danger/10 text-danger text-[11px] font-bold px-2 py-0.5 rounded-full">-{discountPct}%</span>
              </>
            )}
          </div>

          {inStock && (
            <p className="text-[13px] font-semibold text-success -mt-2">{getDeliveryDetailMessage()}</p>
          )}

          {/* Variant selectors */}
          {variantTypes.map(type => {
            const options = product.variantOptions?.[type] || [];
            const isColor = /coul/i.test(type);
            return (
              <div key={type}>
                <div className="text-[12px] font-semibold text-txt-2 mb-2">{type}</div>
                <div className="flex flex-wrap gap-2">
                  {options.map(opt => {
                    const active = selectedOptions[type] === opt;
                    if (isColor) {
                      const hex = product.variantOptionColors?.[opt] || '#d1d5db';
                      return (
                        <button
                          key={opt}
                          type="button"
                          title={opt}
                          onClick={() => setSelectedOptions(s => ({ ...s, [type]: opt }))}
                          className={`w-9 h-9 rounded-full border-2 p-0.5 ${active ? 'border-blue' : 'border-transparent'}`}
                        >
                          <span className="w-full h-full rounded-full block border border-bord" style={{ backgroundColor: hex }} />
                        </button>
                      );
                    }
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSelectedOptions(s => ({ ...s, [type]: opt }))}
                        className={`px-4 py-2 rounded-xl text-[13px] font-medium border transition-colors ${
                          active ? 'bg-blue text-white border-blue' : 'bg-surface-1 text-txt-1 border-bord hover:border-blue'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Quantity */}
          <div>
            <div className="text-[12px] font-semibold text-txt-2 mb-2">Quantité</div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={decQty} className="w-9 h-9 rounded-xl bg-surface-1 border border-bord flex items-center justify-center text-txt-1">
                <Minus size={14} />
              </button>
              <span className="w-8 text-center font-mono text-[15px]">{quantity}</span>
              <button type="button" onClick={incQty} className="w-9 h-9 rounded-xl bg-surface-1 border border-bord flex items-center justify-center text-txt-1">
                <Plus size={14} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleAddToCart()}
            disabled={!inStock || (product.hasVariants && !selectedVariant)}
            className="w-full flex items-center justify-center gap-2 bg-blue text-white font-semibold text-[14px] py-3.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-95 transition-all"
          >
            <ShoppingCart size={18} /> Ajouter au panier
          </button>
          {product.hasVariants && !selectedVariant && (
            <p className="text-[11px] text-txt-3 -mt-2">Sélectionnez une variante avant d'ajouter au panier.</p>
          )}
        </div>
      </div>

      {/* ===== Sections (single scrollable page) ===== */}
      <div className="px-4 lg:px-0 flex flex-col gap-7 mt-2">
        {/* Acheter en lot et économiser */}
        {bulkOffers.length > 0 && (
          <section>
            <h2 className="text-[14px] font-bold text-txt-1">Acheter en lot et économiser</h2>
            <p className="text-[12px] text-txt-2 mb-3">Idéal pour les écoles, associations et parents</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {bulkOffers.map((lot, i) => {
                const active = selectedLot === i;
                const lotImage = lot.image || product.mainImage;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelectedLot(active ? null : i)}
                    className={`relative flex flex-col gap-2 bg-white rounded-xl p-3 text-left shadow-sm transition-all ${
                      active ? 'border-2 border-blue shadow-md' : 'border-2 border-transparent hover:shadow-md'
                    }`}
                  >
                    {lot.savingsPercent > 0 && (
                      <span className="absolute top-2 right-2 bg-danger/10 text-danger text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                        Économisez {lot.savingsPercent}%
                      </span>
                    )}
                    {active && (
                      <span className="absolute top-2 left-2 w-5 h-5 rounded-full bg-blue text-white flex items-center justify-center">
                        <Check size={12} />
                      </span>
                    )}
                    <div className="aspect-square rounded-lg bg-[#f8f9fa] overflow-hidden flex items-center justify-center">
                      {lotImage ? <CachedImage src={lotImage} className="w-full h-full object-contain" /> : <Package size={28} className="text-gray-400" />}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[12px] font-semibold text-txt-1 line-clamp-2 leading-snug">{lot.name}</span>
                      <span className="text-[11px] text-txt-2">Qté {lot.quantity}</span>
                      <span className="font-mono font-bold text-navy text-[13px]">{formatPrice(lot.price)}</span>
                      <span className="text-[10px] text-txt-3">{formatPrice(lot.unitPrice)} / unité</span>
                    </div>
                  </button>
                );
              })}
            </div>
            {selectedLot != null && (
              <div className="flex items-center justify-between mt-3 bg-surface-1 border border-bord rounded-xl p-3">
                <div>
                  <div className="text-[11px] text-txt-2">{bulkOffers[selectedLot].name} · {bulkOffers[selectedLot].quantity} unités</div>
                  <div className="font-mono font-bold text-navy text-[15px]">{formatPrice(bulkOffers[selectedLot].price)}</div>
                </div>
                <button
                  type="button"
                  onClick={handleAddLot}
                  className="bg-blue text-white text-[12px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 active:scale-95 transition-all"
                >
                  Ajouter au panier
                </button>
              </div>
            )}
          </section>
        )}

        {/* Description */}
        <section>
          <h2 className="text-[14px] font-bold text-txt-1 mb-2">Description</h2>
          <div className="text-[13px] text-txt-2 leading-relaxed" dir="auto">
            {product.description || product.shortDescription || 'Aucune description disponible pour ce produit.'}
          </div>
        </section>

        {/* Détails du livre */}
        {product.isBook && product.bookInfo && (
          <section>
            <h2 className="text-[14px] font-bold text-txt-1 mb-3">Détails du livre</h2>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 bg-surface-1 border border-bord rounded-2xl p-4">
              {product.bookInfo.author && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider">Auteur</span>
                  <span className="text-[13px] text-txt-1 font-medium" dir="auto">{product.bookInfo.author}</span>
                </div>
              )}
              {product.bookInfo.publisher && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider">Éditeur</span>
                  <span className="text-[13px] text-txt-1 font-medium">{product.bookInfo.publisher}</span>
                </div>
              )}
              {product.bookInfo.genre && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider">Genre</span>
                  <span className="inline-block bg-blue-light text-blue text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit" dir="auto">{genreLabel(product.bookInfo.genre, true)}</span>
                </div>
              )}
              {product.bookInfo.language && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider">Langue</span>
                  <span className="inline-block bg-surface-2 border border-bord text-txt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full w-fit">{product.bookInfo.language}</span>
                </div>
              )}
              {product.bookInfo.pages && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider">Pages</span>
                  <span className="text-[13px] text-txt-1 font-mono">{product.bookInfo.pages}</span>
                </div>
              )}
              {product.bookInfo.isbn && (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-semibold text-txt-3 uppercase tracking-wider">ISBN</span>
                  <span className="text-[12px] text-txt-3 font-mono">{product.bookInfo.isbn}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Souvent achetés ensemble */}
        {boughtTogether.length > 0 && (
          <section>
            <h2 className="text-[14px] font-bold text-txt-1 mb-3">Souvent achetés ensemble</h2>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {bundleItems.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 shrink-0">
                  {i > 0 && <Plus size={16} className="text-txt-3 shrink-0" />}
                  <div className="w-20 flex flex-col items-center gap-1.5 text-center">
                    <div className="w-16 h-16 rounded-xl bg-[#f0f0f0] border border-bord overflow-hidden flex items-center justify-center">
                      {p.mainImage ? <CachedImage src={p.mainImage} className="w-full h-full object-cover" /> : <Package size={20} className="text-gray-400" />}
                    </div>
                    <span className="text-[11px] text-txt-1 line-clamp-2 leading-tight">{p.name}</span>
                    <span className="text-[11px] font-mono font-semibold text-navy">{formatPrice(bundleItemPrice(p))}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 bg-surface-1 border border-bord rounded-xl p-3">
              <div>
                <div className="text-[11px] text-txt-2">Prix total du pack</div>
                <div className="font-mono font-bold text-navy text-[15px]">{formatPrice(bundleTotal)}</div>
              </div>
              <button
                type="button"
                onClick={handleAddBundle}
                className="bg-blue text-white text-[12px] font-semibold px-4 py-2 rounded-xl hover:opacity-90 active:scale-95 transition-all"
              >
                Ajouter le pack
              </button>
            </div>
          </section>
        )}

        {/* Produits liés */}
        {relatedProducts.length > 0 && (
          <section>
            <h2 className="text-[14px] font-bold text-txt-1 mb-3">Produits liés</h2>
            <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible">
              {relatedProducts.map(p => <ProductCard key={p.id} product={p} className="w-[180px] shrink-0 lg:w-full" />)}
            </div>
          </section>
        )}

        {/* Vous avez aussi consulté */}
        {alsoViewed.length > 0 && (
          <section>
            <h2 className="text-[14px] font-bold text-txt-1 mb-3">Vous avez aussi consulté</h2>
            <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-4 lg:overflow-visible">
              {alsoViewed.map(p => <ProductCard key={p.id} product={p} className="w-[180px] shrink-0 lg:w-full" />)}
            </div>
          </section>
        )}
      </div>

      {/* Trust badges */}
      <div className="px-4 lg:px-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TrustItem icon={Wallet} label="Paiement à la livraison" />
        <TrustItem icon={RotateCcw} label="Retour sous 7 jours" />
        <TrustItem icon={Truck} label="Livraison rapide" />
        <TrustItem icon={ShieldCheck} label="Produits garantis" />
      </div>
    </FadeIn>
    </PageTransition>
  );
}

function TrustItem({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 bg-surface-1 border border-bord rounded-xl p-3">
      <span className="w-8 h-8 rounded-full bg-blue-light text-blue flex items-center justify-center shrink-0">
        <Icon size={15} />
      </span>
      <span className="text-[11px] text-txt-2 leading-tight">{label}</span>
    </div>
  );
}
