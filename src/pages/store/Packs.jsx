import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, Check, ChevronDown, MessageCircle, Box, Package } from 'lucide-react';
import { usePacks } from '../../hooks/usePacks';
import { useSchools } from '../../hooks/useSchools';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { SkeletonRow, FadeIn } from '../../components/SkeletonCard';
import { useMinLoadingTime } from '../../hooks/useMinLoadingTime';
import PageTransition from '../../components/PageTransition';
import { formatPrice } from '../../lib/pricing';
import { buildWhatsAppLink } from '../../lib/contact';
import { MANUEL_NIVEAUX, MANUEL_CLASSES } from '../../lib/manuelLevels';
import { schoolInitials, schoolAvatarColor } from '../../lib/schoolAvatar';
import CachedImage from '../../components/CachedImage';

const PAGE_SIZE = 8;

const PACKS_FILTERS_KEY = 'younasser_packs_filters';

function readSavedPacksFilters() {
  try {
    const raw = sessionStorage.getItem(PACKS_FILTERS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function discountPct(pack) {
  const total = pack.totalItemsPrice || 0;
  const price = pack.packPrice || 0;
  return total > 0 ? Math.round((1 - price / total) * 100) : 0;
}

function CheckLine({ label }) {
  return (
    <div className="flex items-center gap-1.5">
      <Check size={12} className="text-success shrink-0" />
      <span className="text-[11px] text-txt-2">{label}</span>
    </div>
  );
}

function SchoolCard({ school, levelsCount }) {
  return (
    <Link to={`/packs/ecole/${school.id}`} className="bg-white rounded-xl shadow-sm p-3.5 flex items-center gap-3 hover:shadow-md transition-shadow">
      <div
        className="w-12 h-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center text-white font-bold text-[13px]"
        style={{ backgroundColor: schoolAvatarColor(school.name) }}
      >
        {school.image || school.logo ? (
          <CachedImage src={school.image || school.logo} alt={school.name} className="w-full h-full object-cover" />
        ) : (
          schoolInitials(school.name)
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-txt-1 truncate">{school.name}</div>
        {school.district && <div className="text-[11px] text-txt-3 truncate">{school.district}</div>}
        <span className="inline-block mt-1 text-[10px] font-semibold text-blue bg-blue-light rounded-full px-2 py-0.5">
          {levelsCount} niveau{levelsCount !== 1 ? 'x' : ''}
        </span>
      </div>
    </Link>
  );
}

function PackCard({ pack }) {
  const { addToCart } = useCart();
  const toast = useToast();
  const [fav, setFav] = useState(false);
  const pct = discountPct(pack);
  const classBadge = pack.grade || pack.level;

  function handleAdd(e) {
    e.preventDefault();
    addToCart(
      { id: pack.id, slug: pack.slug, name: pack.name, mainImage: pack.mainImage },
      null, 1, pack.packPrice
    );
    toast('Pack ajouté au panier', 'success');
  }

  return (
    <Link to={`/packs/${pack.slug || pack.id}`} className="relative bg-white rounded-xl shadow-sm overflow-hidden flex flex-col items-center gap-2.5 p-4 hover:shadow-md transition-shadow">
      {pct > 0 && (
        <span className="absolute top-3 left-3 bg-danger text-white text-[11px] font-bold px-2 py-0.5 rounded-full">-{pct}%</span>
      )}
      <button
        type="button"
        onClick={e => { e.preventDefault(); setFav(f => !f); }}
        className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow"
      >
        <Heart size={14} className={fav ? 'fill-danger text-danger' : 'text-txt-3'} />
      </button>

      <div className="w-full aspect-[4/5] rounded-xl bg-white overflow-hidden mt-2 flex items-center justify-center p-4">
        {pack.mainImage ? (
          <CachedImage src={pack.mainImage} alt={pack.name} className="w-full h-full object-contain" />
        ) : (
          <Package size={32} className="text-gray-400" />
        )}
      </div>

      <h3 className="text-[14px] font-bold text-txt-1 text-center leading-snug line-clamp-2">{pack.name}</h3>

      <div className="flex items-center gap-2">
        {classBadge && (
          <span className="text-[11px] font-semibold text-blue bg-blue-light rounded-full px-2 py-0.5">{classBadge}</span>
        )}
        <span className="flex items-center gap-1 text-[11px] text-txt-3">
          <Box size={12} className="shrink-0" /> {pack.itemsCount || 0} article{pack.itemsCount !== 1 ? 's' : ''}
        </span>
        {pack.soldCount > 0 && (
          <span className="text-[11px] font-semibold text-danger bg-danger/10 rounded-full px-2 py-0.5">🔥 {pack.soldCount} vendus</span>
        )}
      </div>

      <div className="flex flex-col gap-1 self-start w-full pl-1">
        <CheckLine label="Conforme aux listes scolaires" />
        <CheckLine label="Produits de qualité" />
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="font-mono font-bold text-navy text-[17px]">{formatPrice(pack.packPrice)}</span>
        {pack.totalItemsPrice > pack.packPrice && (
          <span className="font-mono text-[12px] text-txt-3 line-through">{formatPrice(pack.totalItemsPrice)}</span>
        )}
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="mt-1 w-full bg-blue text-white text-[13px] font-semibold py-2.5 rounded-xl hover:opacity-90 active:scale-95 transition-all"
      >
        Ajouter au panier
      </button>
    </Link>
  );
}

export default function Packs() {
  const { packs, loading } = usePacks();
  const { schools, loading: schoolsLoading } = useSchools();
  const showSkeleton = useMinLoadingTime(loading);
  const savedFilters = readSavedPacksFilters();

  const [schoolSearch, setSchoolSearch] = useState('');
  const [search, setSearch] = useState(() => savedFilters?.search || '');
  const [level, setLevel] = useState(() => savedFilters?.level || '');
  const [classe, setClasse] = useState(() => savedFilters?.classe || '');
  const [sort, setSort] = useState(() => savedFilters?.sort || 'pertinence');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    sessionStorage.setItem(PACKS_FILTERS_KEY, JSON.stringify({ search, level, classe, sort }));
  }, [search, level, classe, sort]);

  const activePacks = packs.filter(p => p.status !== 'draft');

  const filteredSchools = schools.filter(s =>
    !schoolSearch.trim() || s.name.toLowerCase().includes(schoolSearch.trim().toLowerCase())
  );

  const genericPacks = activePacks.filter(p => !p.schoolId);
  const filtered = genericPacks.filter(p => {
    if (level && p.level !== level) return false;
    if (classe && p.grade !== classe) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!p.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  if (sort === 'asc') sorted.sort((a, b) => (a.packPrice || 0) - (b.packPrice || 0));
  else if (sort === 'desc') sorted.sort((a, b) => (b.packPrice || 0) - (a.packPrice || 0));

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, level, classe, sort]);

  const visible = sorted.slice(0, visibleCount);
  const whatsappHelpHref = buildWhatsAppLink('Bonjour, je ne trouve pas la liste de mon école, pouvez-vous m\'aider?');

  return (
    <PageTransition className="flex flex-col gap-8 px-4 lg:px-0 py-4">
      {/* School Finder */}
      <section className="flex flex-col gap-4">
        <div className="text-center lg:text-left">
          <h1 className="text-xl font-bold text-txt-1">Trouvez la liste de votre école</h1>
          <p className="text-[13px] text-txt-2 mt-0.5">Sélectionnez l'école de votre enfant pour voir la liste complète des fournitures.</p>
        </div>

        <div className="flex items-center gap-2 bg-surface-1 border border-bord rounded-full px-4 py-2.5">
          <Search size={16} className="text-txt-3 shrink-0" />
          <input
            value={schoolSearch}
            onChange={e => setSchoolSearch(e.target.value)}
            placeholder="Rechercher une école..."
            className="flex-1 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3"
          />
        </div>

        {schoolsLoading ? (
          <SkeletonRow />
        ) : schools.length === 0 ? (
          <div className="flex flex-col items-center gap-3 bg-surface-1 border border-bord rounded-2xl px-4 py-8 text-center">
            <p className="text-[13px] text-txt-2">Nous ajoutons les écoles bientôt. Envoyez-nous votre liste!</p>
            <a
              href={whatsappHelpHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-[#25D366] rounded-full px-4 py-2"
            >
              <MessageCircle size={14} /> Contactez-nous sur WhatsApp
            </a>
          </div>
        ) : filteredSchools.length === 0 ? (
          <p className="text-[13px] text-txt-3">Aucune école trouvée pour "{schoolSearch}".</p>
        ) : (
          <FadeIn className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredSchools.map(school => (
              <SchoolCard
                key={school.id}
                school={school}
                levelsCount={activePacks.filter(p => p.schoolId === school.id).length}
              />
            ))}
          </FadeIn>
        )}
      </section>

      {/* Divider */}
      <div className="flex flex-col gap-1 border-t border-bord pt-6 text-center lg:text-left">
        <h2 className="text-lg font-bold text-txt-1">Packs prêts à commander</h2>
        <p className="text-[13px] text-txt-2">Pas encore votre école? Découvrez nos packs par niveau.</p>
      </div>

      <div className="flex items-center gap-2 bg-surface-1 border border-bord rounded-full px-4 py-2.5">
        <Search size={16} className="text-txt-3 shrink-0" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un pack..."
          className="flex-1 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <select
          value={level}
          onChange={e => { setLevel(e.target.value); setClasse(''); }}
          className="bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 outline-none"
        >
          <option value="">Niveau</option>
          {MANUEL_NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={classe}
          onChange={e => setClasse(e.target.value)}
          disabled={!level}
          className="bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 outline-none disabled:opacity-50"
        >
          <option value="">Classe</option>
          {(MANUEL_CLASSES[level] || []).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-txt-1">Résultats ({sorted.length} pack{sorted.length !== 1 ? 's' : ''})</span>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="bg-surface-1 border border-bord rounded-lg px-2.5 py-1.5 text-[12px] text-txt-1 outline-none"
        >
          <option value="pertinence">Trier par : Pertinence</option>
          <option value="asc">Prix croissant</option>
          <option value="desc">Prix décroissant</option>
        </select>
      </div>

      {showSkeleton ? (
        <SkeletonRow />
      ) : sorted.length === 0 ? (
        <p className="text-[13px] text-txt-3">Aucun pack trouvé pour ces critères.</p>
      ) : (
        <>
          <FadeIn className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(pack => <PackCard key={pack.id} pack={pack} />)}
          </FadeIn>
          {visibleCount < sorted.length && (
            <button
              type="button"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="mx-auto flex items-center gap-1.5 text-[13px] font-semibold text-blue border border-bord bg-surface-1 rounded-full px-5 py-2.5 hover:bg-surface-2 transition-colors"
            >
              Voir plus de packs <ChevronDown size={15} />
            </button>
          )}
        </>
      )}
    </PageTransition>
  );
}
