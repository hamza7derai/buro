import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Heart, Check, ChevronDown, MessageCircle, Box, Package } from 'lucide-react';
import { usePacks } from '../../hooks/usePacks';
import { useSchools } from '../../hooks/useSchools';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { Skeleton } from '../../components/Skeleton';
import { formatPrice } from '../../lib/pricing';
import { buildWhatsAppLink } from '../../lib/contact';
import { MANUEL_NIVEAUX, MANUEL_CLASSES } from '../../lib/manuelLevels';
import CachedImage from '../../components/CachedImage';

const PAGE_SIZE = 8;

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
        className="mt-1 w-full bg-blue text-white text-[13px] font-semibold py-2.5 rounded-xl hover:opacity-90 transition-opacity"
      >
        Ajouter au panier
      </button>
    </Link>
  );
}

export default function Packs() {
  const { packs, loading } = usePacks();
  const { schools } = useSchools();
  const [search, setSearch] = useState('');
  const [ecole, setEcole] = useState('');
  const [level, setLevel] = useState('');
  const [classe, setClasse] = useState('');
  const [sort, setSort] = useState('pertinence');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const classeOptions = MANUEL_CLASSES[level] || [];

  const activePacks = packs.filter(p => p.status !== 'draft');
  const filtered = activePacks.filter(p => {
    if (level && p.level !== level) return false;
    if (classe && p.grade !== classe) return false;
    if (ecole && p.schoolId !== ecole) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.schoolName?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered];
  if (sort === 'asc') sorted.sort((a, b) => (a.packPrice || 0) - (b.packPrice || 0));
  else if (sort === 'desc') sorted.sort((a, b) => (b.packPrice || 0) - (a.packPrice || 0));

  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [search, ecole, level, classe, sort]);

  const visible = sorted.slice(0, visibleCount);
  const whatsappHelpHref = buildWhatsAppLink('Bonjour, je ne trouve pas le pack pour mon école, pouvez-vous m\'aider?');

  const hasActiveFilters = Boolean(search || ecole || level || classe);
  function resetFilters() {
    setSearch(''); setEcole(''); setLevel(''); setClasse(''); setSort('pertinence');
  }

  return (
    <div className="flex flex-col gap-5 px-4 lg:px-0 py-4">
      <div className="text-center lg:text-left">
        <h1 className="text-xl font-bold text-txt-1">Packs scolaires</h1>
        <p className="text-[13px] text-txt-2 mt-0.5">Tout le nécessaire pour une rentrée réussie</p>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-surface-1 border border-bord rounded-full px-4 py-2.5">
          <Search size={16} className="text-txt-3 shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un pack ou une école..."
            className="flex-1 bg-transparent outline-none text-[13px] text-txt-1 placeholder:text-txt-3"
          />
        </div>
        <a
          href={whatsappHelpHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 text-[12px] font-medium text-blue bg-blue-light border border-blue/20 rounded-full px-3.5 py-2 shrink-0 whitespace-nowrap"
        >
          <MessageCircle size={14} /> Vous ne trouvez pas votre école?
        </a>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <select
          value={ecole}
          onChange={e => setEcole(e.target.value)}
          className="bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 shrink-0 outline-none"
        >
          <option value="">École</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={level}
          onChange={e => { setLevel(e.target.value); setClasse(''); }}
          className="bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 shrink-0 outline-none"
        >
          <option value="">Niveau</option>
          {MANUEL_NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={classe}
          onChange={e => setClasse(e.target.value)}
          disabled={!level}
          className="bg-surface-1 border border-bord rounded-xl px-3 py-2 text-[12px] text-txt-1 shrink-0 outline-none disabled:opacity-50"
        >
          <option value="">Classe</option>
          {classeOptions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {hasActiveFilters && (
          <button type="button" onClick={resetFilters} className="text-[12px] font-medium text-blue shrink-0 px-2">
            Réinitialiser
          </button>
        )}
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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm p-4 flex flex-col items-center gap-2.5">
              <Skeleton className="w-full aspect-[4/5] rounded-xl mt-2" />
              <Skeleton className="h-4 w-3/4 mt-1" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-9 w-full rounded-xl mt-1" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-[13px] text-txt-3">Aucun pack trouvé pour ces critères.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map(pack => <PackCard key={pack.id} pack={pack} />)}
          </div>
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
    </div>
  );
}
