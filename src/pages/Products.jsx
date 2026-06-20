import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { useToast } from '../components/Toast';
import { db } from '../firebase';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

export default function Products() {
  const { isAdmin } = useAuth();
  const { products, addProductSimple, loading } = useProducts();
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: '', barcode: '', priceSell: '', priceCost: '', stock: '', famille: '',
  });

  function resetForm() {
    setForm({ name: '', barcode: '', priceSell: '', priceCost: '', stock: '', famille: '' });
    setEditingProduct(null);
    setShowForm(false);
  }

  function openAdd() {
    resetForm();
    setShowForm(true);
  }

  function openEdit(product) {
    setEditingProduct(product);
    setForm({
      name: product.name || '',
      barcode: product.barcode || '',
      priceSell: product.basePriceSell || '',
      priceCost: product.basePriceCost || '',
      stock: product.totalStock || '',
      famille: product.famille || product.categoryPath?.[0] || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { toast('Nom du produit requis', 'error'); return; }
    try {
      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), {
          name: form.name.trim(),
          barcode: form.barcode.trim(),
          basePriceSell: parseFloat(form.priceSell) || 0,
          basePriceCost: parseFloat(form.priceCost) || 0,
          totalStock: parseInt(form.stock) || 0,
          isOutOfStock: (parseInt(form.stock) || 0) <= 0,
          famille: form.famille.trim(),
          categoryPath: form.famille.trim() ? [form.famille.trim()] : [],
          updatedAt: serverTimestamp(),
        });
        toast(`${form.name} mis à jour`);
      } else {
        await addProductSimple({
          name: form.name.trim(),
          barcode: form.barcode.trim(),
          priceSell: parseFloat(form.priceSell) || 0,
          priceCost: parseFloat(form.priceCost) || 0,
          stock: parseInt(form.stock) || 0,
          famille: form.famille.trim(),
        });
        toast(`${form.name} ajouté`);
      }
      resetForm();
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la sauvegarde', 'error');
    }
  }

  async function handleDuplicate(product) {
    try {
      await addProductSimple({
        name: product.name + ' (copie)',
        barcode: '',
        priceSell: product.basePriceSell || 0,
        priceCost: product.basePriceCost || 0,
        stock: 0,
        famille: product.famille || product.categoryPath?.[0] || '',
      });
      toast(`${product.name} dupliqué`);
    } catch (err) {
      toast('Erreur', 'error');
    }
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

  // Filter
  const filtered = search.trim()
    ? products.filter(p =>
        p.name?.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(search.toLowerCase()) ||
        p.famille?.toLowerCase().includes(search.toLowerCase())
      )
    : products;

  // Format
  function fmt(n) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', ',') + ' DH'; }

  function stockBadge(p) {
    const s = p.totalStock ?? 0;
    const min = p.lowStockThreshold ?? 3;
    if (s <= 0) return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-danger/15 text-danger">Épuisé</span>;
    if (s <= min) return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-warn/15 text-warn">Faible ({s})</span>;
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-success/15 text-success">En stock ({s})</span>;
  }

  return (
    <div className="h-full flex flex-col p-6 gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 shrink-0">
        <div>
          <h1 className="text-xl font-bold">Produits</h1>
          <p className="text-[13px] text-txt-3">{products.length} articles</p>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-2 bg-surface-2 border border-bord rounded-lg px-3 py-2">
            <span className="text-txt-3">⌕</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher..."
              className="bg-transparent text-sm text-txt-1 outline-none w-48"
            />
          </div>
          <button onClick={openAdd} className="btn-primary">+ Ajouter</button>
        </div>
      </div>

      {/* Products Table */}
      <div className="flex-1 overflow-y-auto bg-surface-1 border border-bord rounded-2xl">
        {loading ? (
          <div className="p-12 text-center text-txt-3">Chargement...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-txt-3">
            <div className="text-4xl mb-3 opacity-30">📦</div>
            {products.length === 0 ? 'Aucun produit. Cliquez "Ajouter" pour commencer.' : 'Aucun résultat.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider sticky top-0 bg-surface-1 z-10">
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
              {filtered.map(p => {
                const margin = (p.basePriceSell || 0) - (p.basePriceCost || 0);
                return (
                  <tr key={p.id} className="border-t border-bord hover:bg-surface-2/50">
                    <td className="p-4 font-mono text-[12px] text-txt-3">{p.barcode || '—'}</td>
                    <td className="p-4">
                      <span className="font-medium text-[13px]">{p.name}</span>
                      {p.hasVariants && p.variants?.length > 0 && (
                        <span className="ml-2 text-[10px] text-brand-500 bg-brand-500/10 px-1.5 py-0.5 rounded">
                          {p.variants.length} variante{p.variants.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-[12px] text-txt-3">{p.famille || p.categoryPath?.[0] || '—'}</td>
                    <td className="p-4 text-right font-mono text-[13px] text-success">{fmt(p.basePriceSell || 0)}</td>
                    {isAdmin && <td className="p-4 text-right font-mono text-[13px] text-txt-2">{fmt(p.basePriceCost || 0)}</td>}
                    {isAdmin && (
                      <td className={`p-4 text-right font-mono text-[13px] ${margin > 0 ? 'text-success' : 'text-danger'}`}>
                        {fmt(margin)}
                      </td>
                    )}
                    <td className="p-4 text-center">{stockBadge(p)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => toggleVisibility(p)} className="text-lg">
                        {p.isVisible !== false ? '👁' : '🚫'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="btn-secondary !py-1 !px-2 !text-[11px]">Modifier</button>
                        <button onClick={() => handleDuplicate(p)} className="btn-secondary !py-1 !px-2 !text-[11px]">Copier</button>
                        {isAdmin && (
                          <button onClick={() => setConfirmDelete(p)} className="btn-danger !py-1 !px-2 !text-[11px]">Suppr.</button>
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

      {/* ═══ Add/Edit Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={resetForm}>
          <div className="bg-surface-1 border border-bord rounded-2xl p-7 w-[480px] max-w-[95vw]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">{editingProduct ? '✏️ Modifier' : '➕ Nouveau Produit'}</h3>
              <button onClick={resetForm} className="text-txt-3 hover:text-txt-1 text-xl">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Nom de l'article *</label>
                <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input-field" placeholder="Ex: Cahier 96 pages" autoFocus />
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Code Barre</label>
                  <input value={form.barcode} onChange={e => setForm(f => ({...f, barcode: e.target.value}))} className="input-field font-mono" placeholder="Scanner ou saisir" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Famille</label>
                  <input value={form.famille} onChange={e => setForm(f => ({...f, famille: e.target.value}))} className="input-field" placeholder="Ex: Fournitures" />
                </div>
              </div>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Prix Vente (DH)</label>
                  <input type="number" value={form.priceSell} onChange={e => setForm(f => ({...f, priceSell: e.target.value}))} className="input-field font-mono" placeholder="0.00" />
                </div>
                {isAdmin && (
                  <div className="flex-1">
                    <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Prix Achat (DH)</label>
                    <input type="number" value={form.priceCost} onChange={e => setForm(f => ({...f, priceCost: e.target.value}))} className="input-field font-mono" placeholder="0.00" />
                  </div>
                )}
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-txt-3 uppercase tracking-wider block mb-1">Stock</label>
                  <input type="number" value={form.stock} onChange={e => setForm(f => ({...f, stock: e.target.value}))} className="input-field font-mono" placeholder="0" />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={resetForm} className="btn-secondary flex-1">Annuler</button>
              <button onClick={handleSave} className="btn-success flex-1">
                {editingProduct ? '✓ Sauvegarder' : '✓ Ajouter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation ═══ */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setConfirmDelete(null)}>
          <div className="bg-surface-1 border border-bord rounded-2xl p-7 w-[400px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-3">Supprimer ce produit ?</h3>
            <p className="text-sm text-txt-2 mb-6">
              <strong>{confirmDelete.name}</strong> sera supprimé définitivement.
              Cette action est irréversible.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="btn-secondary flex-1">Annuler</button>
              <button onClick={() => handleDelete(confirmDelete)} className="btn-danger flex-1">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
