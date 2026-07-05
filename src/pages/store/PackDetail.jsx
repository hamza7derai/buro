import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Gift, Lock, Check } from 'lucide-react';
import { db } from '../../firebase';
import { doc, getDoc, onSnapshot, collection, query, orderBy, where, limit } from 'firebase/firestore';
import { useProducts } from '../../hooks/useProducts';
import { useCategories } from '../../hooks/useCategories';
import { useCart } from '../../context/CartContext';
import { useToast } from '../../components/Toast';
import { formatPrice } from '../../lib/pricing';
import ProductCard from '../../components/store/ProductCard';
import CachedImage from '../../components/CachedImage';

function usePackDetail(slugOrId) {
  const [pack, setPack] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slugOrId) return;
    setLoading(true);
    setNotFound(false);
    setPack(null);
    setItems([]);

    let cancelled = false;
    let unsubItems = null;

    function subscribeToItems(packId) {
      if (unsubItems) unsubItems();
      const itemsQuery = query(collection(db, 'packs', packId, 'packItems'), orderBy('order'));
      unsubItems = onSnapshot(itemsQuery, snap => {
        setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    const slugQuery = query(collection(db, 'packs'), where('slug', '==', slugOrId), limit(1));
    const unsubPack = onSnapshot(slugQuery, async snap => {
      if (cancelled) return;

      if (!snap.empty) {
        const found = snap.docs[0];
        setPack({ id: found.id, ...found.data() });
        setLoading(false);
        subscribeToItems(found.id);
        return;
      }

      // Fallback for legacy links built from the document id rather than the slug
      try {
        const idSnap = await getDoc(doc(db, 'packs', slugOrId));
        if (cancelled) return;
        if (idSnap.exists()) {
          setPack({ id: idSnap.id, ...idSnap.data() });
          setLoading(false);
          subscribeToItems(idSnap.id);
        } else {
          setPack(null);
          setNotFound(true);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubPack();
      if (unsubItems) unsubItems();
    };
  }, [slugOrId]);

  return { pack, items, loading, notFound };
}

export default function PackDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { pack, items, loading, notFound } = usePackDetail(slug);
  const { products: allProducts } = useProducts();
  const { getCategoryName } = useCategories();
  const { addToCart } = useCart();

  const [checked, setChecked] = useState({});

  useEffect(() => {
    const initial = {};
    items.forEach(item => { initial[item.id] = true; });
    setChecked(initial);
  }, [items]);

  const groups = useMemo(() => {
    const order = [];
    const byCategory = new Map();
    items.forEach(item => {
      const cat = item.category || 'Autres';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
        order.push(cat);
      }
      byCategory.get(cat).push(item);
    });
    return order.map(cat => ({ category: cat, entries: byCategory.get(cat) }));
  }, [items]);

  const selectedCount = items.reduce((sum, item) => sum + (checked[item.id] !== false ? (item.quantity || 1) : 0), 0);
  const selectedTotal = items.reduce((sum, item) => sum + (checked[item.id] !== false ? (item.quantity || 1) * (item.unitPrice || 0) : 0), 0);

  function toggleItem(item) {
    if (item.isRemovable !== true) return;
    setChecked(prev => ({ ...prev, [item.id]: !(prev[item.id] !== false) }));
  }

  function handleAddToCart() {
    if (selectedCount === 0) {
      toast('Sélectionnez au moins un article', 'error');
      return;
    }
    addToCart(
      { id: pack.id, slug: pack.slug, name: pack.name, mainImage: pack.mainImage },
      null, 1, selectedTotal
    );
    toast('Pack ajouté au panier', 'success');
  }

  if (loading) {
    return <div className="px-4 py-20 text-center text-[13px] text-txt-3">Chargement...</div>;
  }

  if (notFound || !pack) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-20 text-center">
        <Gift size={40} className="text-txt-3" />
        <h1 className="text-lg font-bold text-txt-1">Pack introuvable</h1>
        <Link to="/packs" className="mt-2 bg-blue text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:opacity-90 transition-opacity">
          Retour aux packs
        </Link>
      </div>
    );
  }

  const upsellProducts = (pack.upsellProductIds || [])
    .map(pid => allProducts.find(p => p.id === pid))
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-6 pb-28 lg:pb-6">
      {/* Mobile sub-header */}
      <div className="lg:hidden flex items-center justify-between px-4 pt-2">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-surface-1 border border-bord flex items-center justify-center text-txt-1">
          <ArrowLeft size={18} />
        </button>
        <Link to="/panier" className="relative w-9 h-9 rounded-full bg-surface-1 border border-bord flex items-center justify-center text-navy">
          <ShoppingCart size={18} />
        </Link>
      </div>

      <div className="px-4 lg:px-0 lg:grid lg:grid-cols-2 lg:gap-10">
        <div className="aspect-[4/3] lg:aspect-square rounded-2xl bg-surface-2 border border-bord overflow-hidden flex items-center justify-center">
          {pack.mainImage ? (
            <CachedImage src={pack.mainImage} alt={pack.name} className="w-full h-full object-cover" />
          ) : <span className="text-6xl">🎁</span>}
        </div>

        <div className="flex flex-col gap-3 mt-4 lg:mt-0">
          <h1 className="text-xl lg:text-2xl font-bold text-txt-1">{pack.name}</h1>
          {pack.description && <p className="text-[13px] text-txt-2 leading-relaxed">{pack.description}</p>}

          <div className="flex items-center gap-3 mt-1">
            <span className="font-mono font-bold text-navy text-2xl">{formatPrice(pack.packPrice)}</span>
            {pack.totalItemsPrice > pack.packPrice && (
              <span className="font-mono text-txt-3 line-through text-[14px]">{formatPrice(pack.totalItemsPrice)}</span>
            )}
          </div>
          <span className="text-[12px] text-txt-3">{pack.itemsCount || items.length} article{(pack.itemsCount || items.length) !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Items list */}
      <div className="px-4 lg:px-0 flex flex-col gap-5">
        <h2 className="text-[14px] font-bold text-txt-1">Contenu du pack</h2>
        {groups.map(group => (
          <div key={group.category}>
            <div className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider mb-2">{getCategoryName(group.category)}</div>
            <div className="flex flex-col gap-2">
              {group.entries.map(item => {
                const isChecked = checked[item.id] !== false;
                const required = item.isRequired === true;
                const removable = item.isRemovable === true;
                return (
                  <div
                    key={item.id}
                    onClick={() => toggleItem(item)}
                    className={`flex items-center gap-3 bg-surface-1 border border-bord rounded-2xl p-3 transition-opacity ${
                      !isChecked ? 'opacity-50' : ''
                    } ${removable ? 'cursor-pointer' : ''}`}
                  >
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                      isChecked ? 'bg-blue border-blue' : 'border-bord'
                    }`}>
                      {required ? (
                        <Lock size={10} className="text-white" />
                      ) : removable && isChecked ? (
                        <Check size={12} className="text-white" />
                      ) : null}
                    </span>
                    <div className="w-12 h-12 rounded-xl bg-surface-2 border border-bord overflow-hidden shrink-0">
                      {item.image && <CachedImage src={item.image} className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-txt-1 truncate">{item.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {item.variantLabel && <span className="text-[11px] text-txt-2">{item.variantLabel}</span>}
                        <span className="text-[11px] text-txt-3">Qté {item.quantity || 1}</span>
                        {required ? (
                          <span className="text-[10px] font-medium text-blue bg-blue-light px-1.5 py-0.5 rounded-full">Obligatoire</span>
                        ) : (
                          <span className="text-[10px] font-medium text-txt-2 bg-surface-2 px-1.5 py-0.5 rounded-full">Optionnel</span>
                        )}
                      </div>
                    </div>
                    <span className="font-mono text-[13px] font-semibold text-navy shrink-0">{formatPrice((item.quantity || 1) * (item.unitPrice || 0))}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Suggested upsell */}
      {upsellProducts.length > 0 && (
        <div className="px-4 lg:px-0 flex flex-col gap-3">
          <h2 className="text-[14px] font-bold text-txt-1">Articles suggérés</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:gap-4 lg:overflow-visible">
            {upsellProducts.map(p => <ProductCard key={p.id} product={p} className="w-[180px] shrink-0 lg:w-full" />)}
          </div>
        </div>
      )}

      {/* Sticky bottom bar (mobile) / summary card (desktop) */}
      <div className="fixed lg:static bottom-0 left-0 right-0 bg-surface-1 border-t border-bord lg:border lg:rounded-2xl lg:mx-0 px-4 py-3 flex items-center justify-between gap-4 z-20">
        <div>
          <div className="text-[11px] text-txt-2">{selectedCount} article{selectedCount !== 1 ? 's' : ''} sélectionné{selectedCount !== 1 ? 's' : ''}</div>
          <div className="font-mono font-bold text-navy text-[16px]">{formatPrice(selectedTotal)}</div>
        </div>
        <button
          type="button"
          onClick={handleAddToCart}
          disabled={selectedCount === 0}
          className="flex items-center gap-2 bg-blue text-white font-semibold text-[14px] px-5 py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <ShoppingCart size={16} /> Ajouter au panier
        </button>
      </div>
    </div>
  );
}
