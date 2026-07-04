import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../components/Toast';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { Package, PackageCheck, AlertTriangle, PackageX, Eye, EyeOff } from 'lucide-react';
import BarcodeIcon from '../components/BarcodeIcon';
import BrandDropdown from '../components/BrandDropdown';
import Thumb from '../components/Thumb';
import { Pill } from '../components/FormUI';
import { TableRowSkeleton } from '../components/Skeleton';
import { formatPrice } from '../lib/pricing';

const STOCK_FILTERS = [
  { v: 'all', l: 'Tous' },
  { v: 'ok', l: 'En stock' },
  { v: 'low', l: 'Stock faible' },
  { v: 'out', l: 'Épuisé' },
];

const PAGE_SIZE = 10;


function stockStatus(p) {
  const s = p.totalStock ?? 0;
  const min = p.lowStockThreshold ?? 3;
  if (s <= 0) return 'out';
  if (s <= min) return 'low';
  return 'ok';
}

// categoryPath[0]/categoryId is sometimes a Firestore category doc id and sometimes
// a free-text name (POS quick-add, manuels) — resolve to a readable label either way,
// never show a raw document id to the user
function familleLabel(p, categories) {
  const raw = p.categoryPath?.[0] || p.famille || p.categoryId;
  if (!raw) return '';
  return categories.find(c => c.id === raw)?.name || raw;
}

function StockBadge({ p }) {
  const status = stockStatus(p);
  const s = p.totalStock ?? 0;
  if (status === 'out') return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ef4444]/15 text-[#ef4444]">Épuisé</span>;
  if (status === 'low') return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#F5A623]/15 text-[#F5A623]">Faible ({s})</span>;
  return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#22c55e]/15 text-[#22c55e]">En stock ({s})</span>;
}

function StatCard({ icon: Icon, label, value, iconWrapCls, iconCls }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconWrapCls}`}>
        <Icon size={22} strokeWidth={1.75} className={iconCls} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-[#1a1a2e] font-mono truncate">{value}</div>
        <div className="text-[12px] text-gray-400">{label}</div>
      </div>
    </div>
  );
}

export default function Products() {
  const { isAdmin } = useAuth();
  const { products, loading } = useProducts();
  const { categories, mainCategories } = useCategories();
  const toast = useToast();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [confirmDelete, setConfirmDelete] = useState(null);

  function handleDuplicate(product) {
    navigate('/produits/nouveau', { state: { duplicateFrom: product } });
  }

  async function handleDelete(product) {
    try {
      await deleteDoc(doc(db, 'products', product.id));
      toast(`${product.name} supprimé`);
      setConfirmDelete(null);
    } catch (err) {
      toast('Erreur lors de la suppression', 'error');
    }
  }

  async function toggleVisibility(product) {
    await updateDoc(doc(db, 'products', product.id), {
      isVisible: !product.isVisible,
      updatedAt: serverTimestamp(),
    });
    toast(product.isVisible ? `${product.name} masqué` : `${product.name} visible`);
  }

  const filtered = products.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchesSearch =
        p.name?.toLowerCase().includes(q) ||
        p.barcode?.toLowerCase().includes(q) ||
        familleLabel(p, categories).toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }
    if (categoryFilter) {
      const matchesCategory = p.categoryId === categoryFilter || p.categoryPath?.[0] === categoryFilter;
      if (!matchesCategory) return false;
    }
    if (brandFilter && p.brand !== brandFilter) return false;
    if (stockFilter !== 'all' && stockStatus(p) !== stockFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const enStock = products.filter(p => stockStatus(p) === 'ok').length;
  const stockFaible = products.filter(p => stockStatus(p) === 'low').length;
  const horsStock = products.filter(p => stockStatus(p) === 'out').length;

  return (
    <div className="h-full w-full overflow-y-auto bg-[#f5f6fa] p-5">
      <div className="flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-center gap-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a2e]">Produits</h1>
            <p className="text-[13px] text-gray-400">{products.length} article{products.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="ml-auto">
            <button onClick={() => navigate('/produits/nouveau')} className="px-4 py-2 rounded-lg bg-[#F5A623] hover:bg-[#d6890f] text-[#1a1a2e] font-semibold text-sm transition-colors">
              + Ajouter
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 shrink-0">
          <StatCard icon={Package} label="Total produits" value={products.length} iconWrapCls="bg-[#2563eb]/10" iconCls="text-[#2563eb]" />
          <StatCard icon={PackageCheck} label="En stock" value={enStock} iconWrapCls="bg-[#22c55e]/10" iconCls="text-[#22c55e]" />
          <StatCard icon={AlertTriangle} label="Stock faible" value={stockFaible} iconWrapCls="bg-[#F5A623]/15" iconCls="text-[#F5A623]" />
          <StatCard icon={PackageX} label="Hors stock" value={horsStock} iconWrapCls="bg-[#ef4444]/10" iconCls="text-[#ef4444]" />
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <span className="text-gray-400">⌕</span>
            <input
              type="text"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher..."
              className="bg-transparent text-sm text-[#1a1a2e] outline-none w-48 placeholder:text-gray-400"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={e => { setCategoryFilter(e.target.value); setPage(1); }}
            className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-[#1a1a2e] outline-none focus:border-[#F5A623]"
          >
            <option value="">Toutes les catégories</option>
            {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <BrandDropdown
            mode="select"
            value={brandFilter}
            onChange={v => { setBrandFilter(v); setPage(1); }}
            emptyOptionLabel="Toutes les marques"
          />
          <div className="flex items-center gap-2">
            {STOCK_FILTERS.map(f => (
              <Pill key={f.v} active={stockFilter === f.v} onClick={() => { setStockFilter(f.v); setPage(1); }}>{f.l}</Pill>
            ))}
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left p-4 w-10">#</th>
                  <th className="text-left p-4">Code Barre</th>
                  <th className="text-left p-4">Article</th>
                  <th className="text-left p-4">Famille</th>
                  <th className="text-right p-4">Prix Vente</th>
                  {isAdmin && <th className="text-right p-4">Prix Achat</th>}
                  {isAdmin && <th className="text-right p-4">Marge</th>}
                  <th className="text-center p-4">Stock</th>
                  <th className="text-center p-4">Visible</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={isAdmin ? 9 : 7} />
                ))}
              </tbody>
            </table>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400 flex flex-col items-center gap-2">
              <Package size={36} strokeWidth={1.5} className="text-gray-300" />
              {products.length === 0 ? 'Aucun produit. Cliquez "Ajouter" pour commencer.' : 'Aucun résultat.'}
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="text-left p-4 w-10">#</th>
                  <th className="text-left p-4">Code Barre</th>
                  <th className="text-left p-4">Article</th>
                  <th className="text-left p-4">Famille</th>
                  <th className="text-right p-4">Prix Vente</th>
                  {isAdmin && <th className="text-right p-4">Prix Achat</th>}
                  {isAdmin && <th className="text-right p-4">Marge</th>}
                  <th className="text-center p-4">Stock</th>
                  <th className="text-center p-4">Visible</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((p, i) => {
                  const margin = (p.basePriceSell || 0) - (p.basePriceCost || 0);
                  return (
                    <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="p-4 text-[12px] text-gray-400 font-mono">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="p-4">
                        <div className="flex items-center gap-2 text-gray-400">
                          <BarcodeIcon className="w-5 h-4 shrink-0" />
                          <span className="font-mono text-[12px]">{p.barcode || '—'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Thumb src={p.mainImage} className="w-9 h-9" />
                          <div className="min-w-0">
                            <span className="font-medium text-[13px] text-[#1a1a2e]">{p.name}</span>
                            {p.isManuel && (
                              <span className="ml-2 text-[10px] text-[#a855f7] bg-[#a855f7]/10 px-1.5 py-0.5 rounded">
                                Manuel
                              </span>
                            )}
                            {p.hasVariants && (
                              <span className="ml-2 text-[10px] text-[#F5A623] bg-[#F5A623]/10 px-1.5 py-0.5 rounded">
                                Variantes
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {familleLabel(p, categories) ? (
                          <span className="text-[11px] font-medium text-[#2563eb] bg-[#2563eb]/10 px-2 py-0.5 rounded-full">
                            {familleLabel(p, categories)}
                          </span>
                        ) : <span className="text-[12px] text-gray-400">—</span>}
                      </td>
                      <td className="p-4 text-right font-mono text-[13px] text-[#22c55e]">{formatPrice(p.basePriceSell || 0)}</td>
                      {isAdmin && <td className="p-4 text-right font-mono text-[13px] text-gray-500">{formatPrice(p.basePriceCost || 0)}</td>}
                      {isAdmin && (
                        <td className={`p-4 text-right font-mono text-[13px] ${margin > 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
                          {formatPrice(margin)}
                        </td>
                      )}
                      <td className="p-4 text-center"><StockBadge p={p} /></td>
                      <td className="p-4 text-center">
                        <button onClick={() => toggleVisibility(p)} className="text-gray-400 hover:text-[#1a1a2e] transition-colors">
                          {p.isVisible !== false ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={() => navigate(`/produits/${p.id}`)} className="px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Modifier</button>
                          <button onClick={() => handleDuplicate(p)} className="px-2.5 py-1 rounded-md border border-gray-200 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Copier</button>
                          {isAdmin && (
                            <button onClick={() => setConfirmDelete(p)} className="px-2.5 py-1 rounded-md text-[11px] font-semibold text-[#ef4444] bg-[#ef4444]/10 hover:bg-[#ef4444]/20 transition-colors">Suppr.</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between shrink-0">
            <span className="text-[12px] text-gray-400">
              Page {currentPage} sur {totalPages} — {filtered.length} produit{filtered.length > 1 ? 's' : ''}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ Delete Confirmation ═══ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3">Supprimer ce produit ?</h3>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{confirmDelete.name}</strong> sera supprimé définitivement. Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex-1 py-2.5 rounded-lg bg-[#ef4444] hover:brightness-110 text-white font-medium text-[13px] transition-all">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
