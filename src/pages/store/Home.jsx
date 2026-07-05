import { Link } from 'react-router-dom';
import { ChevronRight, Search, Filter, ShieldCheck, Truck, BadgePercent, Headset, MessageCircle } from 'lucide-react';
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
      <section className="hidden lg:block relative rounded-2xl overflow-hidden" style={{ minHeight: '230px' }}>
        {/* Gradient background with dot pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-[#eff6ff] to-[#dbeafe]" />
          <div className="absolute inset-0 opacity-25" style={{ backgroundImage: 'radial-gradient(circle, #93c5fd 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        </div>

        {/* Left text content */}
        <div className="relative z-10 px-8 py-7" style={{ maxWidth: 'calc(100% - 290px)' }}>
          {/* Pill tag */}
          <span className="inline-block bg-yellow-100 text-yellow-700 text-[11px] font-bold px-3 py-1 rounded-full mb-3 tracking-wide">
            RENTRÉE SCOLAIRE 2026-2027
          </span>

          {/* Heading */}
          <h1 className="text-[27px] font-black text-navy leading-tight mb-3">
            Votre liste scolaire,<br />
            <span className="text-blue">on s'en occupe.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-navy/70 text-[13px] leading-relaxed mb-5 max-w-[320px]">
            Nous préparons les listes complètes pour plus de 20 écoles à Marrakech. Apportez votre liste en boutique ou commandez votre pack en ligne.
          </p>

          {/* CTA buttons */}
          <div className="flex items-center gap-3 mb-4">
            <Link
              to="/packs"
              className="inline-flex items-center gap-1.5 whitespace-nowrap bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              Voir nos packs →
            </Link>
            <a
              href="https://maps.app.goo.gl/SHTiuNtk8TmxqNtu5"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 whitespace-nowrap bg-white text-navy text-[13px] font-semibold px-5 py-2.5 rounded-xl border border-navy/20 hover:bg-navy/5 transition-colors"
            >
              📍 Nous rendre visite
            </a>
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-3">
            <a href="https://instagram.com/younasser.ma" target="_blank" rel="noopener noreferrer" className="text-txt-3 hover:text-navy transition-colors" aria-label="Instagram">
              <InstagramIcon size={20} />
            </a>
            <a href="https://tiktok.com/@younasser.ma" target="_blank" rel="noopener noreferrer" className="text-txt-3 hover:text-navy transition-colors" aria-label="TikTok">
              <TikTokIcon size={20} />
            </a>
            <a href="https://www.facebook.com/younasser.ma" target="_blank" rel="noopener noreferrer" className="text-txt-3 hover:text-navy transition-colors" aria-label="Facebook">
              <FacebookIcon size={20} />
            </a>
            <a href="https://wa.me/212706447525" target="_blank" rel="noopener noreferrer" className="text-txt-3 hover:text-navy transition-colors" aria-label="WhatsApp">
              <MessageCircle size={20} />
            </a>
          </div>
        </div>

        {/* Right side: backpack image — contained within banner bounds */}
        <div className="absolute right-0 bottom-0 w-[45%] h-full pointer-events-none z-10">
          <img
            src={import.meta.env.BASE_URL + 'images/hero-backpack.png'}
            alt=""
            className="w-full h-full object-contain drop-shadow-lg"
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

function InstagramIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.64.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.15-3.23 1.66-4.77 4.92-4.92 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07 2.7.27.27 2.7.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.2 4.35 2.63 6.78 6.98 6.98 1.28.06 1.69.07 4.95.07s3.67-.01 4.95-.07c4.35-.2 6.78-2.63 6.98-6.98.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.2-4.35-2.63-6.78-6.98-6.98C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zM12 16a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm6.4-11.84a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z" />
    </svg>
  );
}

function TikTokIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
    </svg>
  );
}

function FacebookIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 1 0-11.56 9.87v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.78-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.88h-2.34v6.99A10 10 0 0 0 22 12z" />
    </svg>
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
