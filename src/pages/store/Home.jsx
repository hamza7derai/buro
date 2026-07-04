import { Link } from 'react-router-dom';
import { ChevronRight, Search, Filter, ShieldCheck, Truck, BadgePercent, Headset } from 'lucide-react';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import ProductCard from '../../components/store/ProductCard';
import { ProductCardSkeleton } from '../../components/Skeleton';
import { getCategoryIcon, DEFAULT_CATEGORIES } from '../../lib/categoryIcons';

export default function Home() {
  const { products, loading } = useProducts();
  const { mainCategories } = useCategories();

  const visibleProducts = products.filter(p => p.isVisible !== false && !p.isManuel);
  const featured = visibleProducts.filter(p => p.isFeatured);
  const bestSellers = (
    featured.length > 0 ? featured : [...visibleProducts].sort((a, b) => (b.totalSold || 0) - (a.totalSold || 0))
  ).slice(0, 8);
  const promoProducts = visibleProducts.filter(p => p.promo?.enabled).slice(0, 6);
  const categories = mainCategories.length > 0 ? mainCategories : DEFAULT_CATEGORIES;

  return (
    <div className="flex flex-col gap-7 px-4 lg:px-0 py-4">
      {/* Mobile search */}
      <div className="lg:hidden flex items-center gap-2 bg-surface-1 border border-bord rounded-full px-4 py-2.5">
        <Search size={16} className="text-txt-3 shrink-0" />
        <input placeholder="Rechercher un produit..." className="flex-1 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3" />
        <Filter size={16} className="text-txt-3 shrink-0" />
      </div>

      {/* Desktop hero banner */}
      <section className="hidden lg:block relative" style={{ minHeight: '230px' }}>
        {/* Gradient background with dot pattern — clipped to rounded bounds */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe]" />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle, #93c5fd 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        </div>

        {/* Left text content */}
        <div className="relative z-10 px-8 py-7" style={{ maxWidth: 'calc(100% - 290px)' }}>
          {/* Pill tag */}
          <span className="inline-block bg-blue/10 text-blue text-[11px] font-bold px-3 py-1 rounded-full mb-3 tracking-wide">
            LA RENTRÉE EST LÀ !
          </span>

          {/* Heading */}
          <h1 className="text-[27px] font-black text-navy leading-tight mb-3">
            Tout pour le bureau<br />
            <span className="text-blue relative inline-block">
              et l'école
              <span className="absolute left-0 -bottom-0.5 w-full h-[3px] bg-[#F5A623] rounded-full opacity-70" />
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-navy/70 text-[13px] leading-relaxed mb-5 max-w-[260px]">
            Fournitures, manuels, packs scolaires et accessoires livrés rapidement à Marrakech.
          </p>

          {/* CTA button */}
          <Link
            to="/categories"
            className="inline-flex items-center gap-1.5 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
          >
            Découvrir les catégories →
          </Link>

          {/* Trust line */}
          <div className="flex items-center gap-5 mt-4">
            <span className="flex items-center gap-1.5 text-[11px] text-navy/60 font-medium">
              <span className="text-[14px]">👥</span> +10 000 clients satisfaits
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-navy/60 font-medium">
              <span className="text-[14px]">🔒</span> Paiement sécurisé
            </span>
          </div>
        </div>

        {/* Right side: backpack image + floating decorations — overlaps bottom edge */}
        <div className="absolute right-0 bottom-[-14px] w-[300px] h-[290px] pointer-events-none z-10">
          <span className="absolute top-6 left-9 text-2xl select-none" style={{ transform: 'rotate(-20deg)' }}>✏️</span>
          <span className="absolute top-1 right-[105px] text-lg select-none" style={{ transform: 'rotate(15deg)' }}>⭐</span>
          <span className="absolute bottom-[85px] left-3 text-lg select-none" style={{ transform: 'rotate(10deg)' }}>📏</span>
          <img
            src={import.meta.env.BASE_URL + 'images/hero-backpack.png'}
            alt=""
            className="absolute right-3 bottom-0 h-[280px] object-contain drop-shadow-lg"
          />
        </div>
      </section>

      {/* Mobile delivery banner */}
      <section className="lg:hidden bg-gradient-to-r from-blue to-navy rounded-2xl p-4 text-white flex items-center gap-3">
        <span className="text-3xl">🛵</span>
        <div>
          <div className="text-[13px] font-semibold">Livraison rapide à Marrakech</div>
          <div className="text-[11px] text-white/80">Recevez vos articles en moins de 24h</div>
        </div>
      </section>

      {/* Category cards */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-navy">Catégories populaires</h2>
          <Link to="/categories" className="text-[12px] text-blue flex items-center gap-0.5">
            Voir toutes <ChevronRight size={14} />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-5 lg:gap-4">
          {categories.map((cat, i) => {
            const { icon: Icon, image, color } = getCategoryIcon(cat.name);
            return (
              <Link
                key={cat.slug || i}
                to={`/categories/${cat.slug}`}
                className="flex flex-col items-center justify-center gap-1.5 shrink-0 w-[120px] lg:w-auto bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-2.5"
              >
                {image ? <img src={import.meta.env.BASE_URL + image} alt="" className="w-16 h-16 object-contain" /> : <Icon size={32} style={{ color }} />}
                <span className="text-[11px] font-bold text-txt-1 text-center leading-tight">{cat.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Best sellers */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-bold text-txt-1">Nos meilleures ventes</h2>
          <Link to="/categories" className="text-[12px] text-blue flex items-center gap-0.5">
            Voir tout <ChevronRight size={14} />
          </Link>
        </div>
        {loading ? (
          <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible">
            {Array.from({ length: 4 }).map((_, i) => <ProductCardSkeleton key={i} className="w-[180px] shrink-0 lg:w-full" />)}
          </div>
        ) : bestSellers.length === 0 ? (
          <p className="text-[13px] text-txt-3">Aucun produit pour le moment.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible">
            {bestSellers.map(p => <ProductCard key={p.id} product={p} className="w-[180px] shrink-0 lg:w-full" />)}
          </div>
        )}
      </section>

      {/* Trust badges */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TrustItem icon={ShieldCheck} label="Produits de qualité" />
        <TrustItem icon={Truck} label="Livraison ultra rapide" />
        <TrustItem icon={BadgePercent} label="Meilleurs prix" />
        <TrustItem icon={Headset} label="Support réactif" />
      </section>

      {/* Offres spéciales */}
      {promoProducts.length > 0 && (
        <section>
          <h2 className="text-[15px] font-bold text-txt-1 mb-3">Offres spéciales</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible">
            {promoProducts.map(p => <ProductCard key={p.id} product={p} className="w-[180px] shrink-0 lg:w-full" />)}
          </div>
        </section>
      )}
    </div>
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
