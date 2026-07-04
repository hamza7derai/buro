import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { usePacks } from '../hooks/usePacks';
import { useSchools } from '../hooks/useSchools';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../components/Toast';
import { uploadPackImage } from '../lib/uploadImage';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Search, GripVertical, X, Plus, Check } from 'lucide-react';
import { MANUEL_NIVEAUX, MANUEL_CLASSES } from '../lib/manuelLevels';
import { Section, Field, Pill, Dropzone, ProductPicker, inputCls } from '../components/FormUI';
import Thumb from '../components/Thumb';
import BarcodeIcon from '../components/BarcodeIcon';
import { formatPrice } from '../lib/pricing';

const PACK_DRAFT_KEY = 'younasser_pack_draft';

const PACK_BADGES = [
  { v: null, l: 'Aucun' },
  { v: 'populaire', l: 'Populaire' },
  { v: 'meilleur-choix', l: 'Meilleur choix' },
  { v: 'nouveau', l: 'Nouveau' },
  { v: 'economique', l: 'Économique' },
];


function emptyForm() {
  return {
    name: '', description: '', mainImage: '', badge: null,
    level: '', grade: '', schoolId: '', year: '',
    discountType: 'percent', discountValue: '',
    upsellProductIds: [],
  };
}

function itemFromProduct(p) {
  return {
    productId: p.id, variantId: null, name: p.name, variantLabel: '', image: p.mainImage || '',
    barcode: p.barcode || '', category: p.famille || p.categoryPath?.[0] || '',
    quantity: 1, unitPrice: p.basePriceSell || 0, isRequired: true, isRemovable: false,
  };
}

function itemFromVariant(p, v) {
  return {
    productId: p.id, variantId: v.id, name: p.name,
    variantLabel: v.label || Object.values(v.options || {}).join(' / '),
    image: v.image || p.mainImage || '',
    barcode: v.barcode || p.barcode || '', category: p.famille || p.categoryPath?.[0] || '',
    quantity: 1, unitPrice: v.priceSell ?? p.basePriceSell ?? 0, isRequired: true, isRemovable: false,
  };
}

export default function PackBuilder() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { products, fetchVariants } = useProducts();
  const { createPack, updatePack, savePackItems } = usePacks();
  const { schools, addSchool } = useSchools();
  const { getCategoryName } = useCategories();

  const packIdRef = useRef(id || doc(collection(db, 'packs')).id);
  const packId = packIdRef.current;

  const [form, setForm] = useState(emptyForm());
  const [items, setItems] = useState([]);
  const originalItemIds = useRef([]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [mainUploading, setMainUploading] = useState(false);
  const [mainProgress, setMainProgress] = useState(0);

  const [search, setSearch] = useState('');
  const [showManualAdd, setShowManualAdd] = useState(false);
  // Variant picker — opened when adding a hasVariants product, so the admin
  // can choose exactly which variant (e.g. "Bleu") goes into this pack item
  const [variantPicker, setVariantPicker] = useState(null);
  const [manualForm, setManualForm] = useState({ name: '', category: '', unitPrice: '', quantity: 1 });

  const [showNewSchool, setShowNewSchool] = useState(false);
  const [newSchoolName, setNewSchoolName] = useState('');

  const dragIndexRef = useRef(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // ─── Draft auto-save (new packs only — editing writes straight to Firebase) ───
  const [pendingDraft, setPendingDraft] = useState(null);
  const [draftSavedFlash, setDraftSavedFlash] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const pendingDraftRef = useRef(null);
  const formRef = useRef(form);
  const itemsRef = useRef(items);
  const flashTimeoutRef = useRef(null);

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { pendingDraftRef.current = pendingDraft; }, [pendingDraft]);

  useEffect(() => {
    if (isEditing) return;
    try {
      const raw = localStorage.getItem(PACK_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.form) setPendingDraft(parsed);
      }
    } catch { /* corrupt draft, ignore */ }
  }, []);

  function writeDraft() {
    if (isEditing || pendingDraftRef.current) return;
    try {
      localStorage.setItem(PACK_DRAFT_KEY, JSON.stringify({ form: formRef.current, items: itemsRef.current }));
      setDraftSavedFlash(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setDraftSavedFlash(false), 2000);
    } catch { /* storage full/unavailable, ignore */ }
  }

  useEffect(() => {
    if (isEditing || pendingDraft) return;
    const t = setTimeout(writeDraft, 2000);
    return () => clearTimeout(t);
  }, [form, items, isEditing, pendingDraft]);

  useEffect(() => {
    if (isEditing) return;
    const interval = setInterval(writeDraft, 5000);
    return () => clearInterval(interval);
  }, [isEditing]);

  function handleResumeDraft() {
    if (pendingDraft?.form) setForm(pendingDraft.form);
    if (pendingDraft?.items) setItems(pendingDraft.items);
    setPendingDraft(null);
  }

  function handleDiscardDraft() {
    localStorage.removeItem(PACK_DRAFT_KEY);
    setPendingDraft(null);
  }

  function handleCancelClick() {
    if (!isEditing && localStorage.getItem(PACK_DRAFT_KEY)) {
      setShowCancelConfirm(true);
    } else {
      navigate('/admin/packs');
    }
  }

  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const snap = await getDoc(doc(db, 'packs', id));
      if (!snap.exists()) { toast('Pack introuvable', 'error'); navigate('/admin/packs'); return; }
      const data = snap.data();
      setForm(f => ({
        ...f,
        name: data.name || '', description: data.description || '', mainImage: data.mainImage || '',
        badge: data.badge || null, level: data.level || '', grade: data.grade || '',
        schoolId: data.schoolId || '', year: data.year || '',
        discountType: data.discountType || 'percent', discountValue: data.discountValue ?? '',
        upsellProductIds: data.upsellProductIds || [],
      }));
      const itemsSnap = await getDocs(query(collection(db, 'packs', id, 'packItems'), orderBy('order')));
      const loaded = itemsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setItems(loaded);
      originalItemIds.current = loaded.map(it => it.id);
      setLoading(false);
    })();
  }, [id]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }

  async function handleMainImage(file) {
    setMainUploading(true);
    setMainProgress(0);
    try {
      const url = await uploadPackImage(packId, file, setMainProgress);
      set('mainImage', url);
    } catch (err) {
      console.error(err);
      toast("Erreur lors du téléchargement de l'image", 'error');
    } finally {
      setMainUploading(false);
    }
  }

  async function createSchool() {
    if (!newSchoolName.trim()) return;
    const schoolId = await addSchool(newSchoolName.trim());
    set('schoolId', schoolId);
    setNewSchoolName(''); setShowNewSchool(false);
  }

  // Simple (non-variant) products are excluded once added — but a hasVariants
  // product must stay searchable so a second/third variant (e.g. Rouge after
  // Bleu) can still be added as a separate pack item.
  const existingSimpleProductIds = new Set(items.filter(it => it.productId && !it.variantId).map(it => it.productId));
  const searchMatches = search.trim()
    ? products.filter(p => !existingSimpleProductIds.has(p.id) && p.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  async function addProductItem(p) {
    setSearch('');
    if (p.hasVariants) {
      setVariantPicker({ product: p, variants: [], loading: true, selectedId: '' });
      const variants = await fetchVariants(p.id);
      setVariantPicker(prev => (prev && prev.product.id === p.id) ? { ...prev, variants, loading: false, selectedId: variants[0]?.id || '' } : prev);
      return;
    }
    setItems(prev => [...prev, itemFromProduct(p)]);
  }

  function confirmVariantPick() {
    const variant = variantPicker.variants.find(v => v.id === variantPicker.selectedId);
    if (!variant) return;
    setItems(prev => [...prev, itemFromVariant(variantPicker.product, variant)]);
    setVariantPicker(null);
  }

  function addManualItem() {
    if (!manualForm.name.trim()) return;
    setItems(prev => [...prev, {
      productId: null, variantId: null, name: manualForm.name.trim(), image: '', barcode: '',
      category: manualForm.category.trim(), quantity: parseInt(manualForm.quantity) || 1,
      unitPrice: parseFloat(manualForm.unitPrice) || 0, isRequired: true, isRemovable: false,
    }]);
    setManualForm({ name: '', category: '', unitPrice: '', quantity: 1 });
    setShowManualAdd(false);
  }

  function updateItem(index, field, value) {
    setItems(prev => prev.map((it, i) => i === index ? { ...it, [field]: value } : it));
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  function handleDrop(targetIndex) {
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    setDragOverIndex(null);
    if (from === null || from === targetIndex) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
  }

  const totalItemsPrice = items.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);
  const discountValueNum = parseFloat(form.discountValue) || 0;
  const packPrice = form.discountType === 'percent'
    ? totalItemsPrice * (1 - discountValueNum / 100)
    : discountValueNum;
  const savings = Math.max(0, totalItemsPrice - packPrice);
  const remisePercent = totalItemsPrice > 0 ? Math.round((savings / totalItemsPrice) * 100) : 0;

  async function handleSave(status) {
    if (!form.name.trim()) { toast('Nom du pack requis', 'error'); return; }
    if (!items.length) { toast('Ajoutez au moins un article au pack', 'error'); return; }
    setSaving(true);
    try {
      const schoolName = schools.find(s => s.id === form.schoolId)?.name || '';
      const payload = {
        name: form.name.trim(),
        slug: form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        description: form.description.trim(),
        mainImage: form.mainImage,
        badge: form.badge,
        level: form.level, grade: form.grade,
        schoolId: form.schoolId || null, schoolName,
        year: form.year.trim(),
        itemsCount: items.length,
        totalItemsPrice,
        discountType: form.discountType,
        discountValue: discountValueNum,
        packPrice,
        upsellProductIds: form.upsellProductIds,
        status,
      };
      if (isEditing) await updatePack(packId, payload);
      else await createPack(packId, payload);

      const keptIds = items.filter(it => it.id).map(it => it.id);
      const idsToDelete = originalItemIds.current.filter(itemId => !keptIds.includes(itemId));
      await savePackItems(packId, items, idsToDelete);

      if (!isEditing) localStorage.removeItem(PACK_DRAFT_KEY);
      toast(`Pack ${status === 'draft' ? 'enregistré comme brouillon' : 'publié'}`);
      navigate('/admin/packs');
    } catch (err) {
      console.error(err);
      toast('Erreur lors de la sauvegarde', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center bg-[#f5f6fa] text-gray-400">Chargement...</div>;
  }

  // Group consecutive items sharing a category for display
  const groups = [];
  items.forEach((item, index) => {
    const cat = item.category || 'Sans catégorie';
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.category === cat) lastGroup.entries.push({ item, index });
    else groups.push({ category: cat, entries: [{ item, index }] });
  });

  return (
    <div className="h-full w-full flex flex-col bg-[#f5f6fa]">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-5 flex flex-col gap-4">
          <div className="shrink-0">
            <h1 className="text-xl font-bold text-[#1a1a2e]">{isEditing ? 'Modifier le pack' : 'Nouveau pack'}</h1>
          </div>

          {pendingDraft && (
            <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-[13px] text-[#1d4ed8]">
              <span>Vous avez un brouillon non sauvegardé</span>
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={handleDiscardDraft} className="px-3 py-1.5 rounded-lg border border-[#bfdbfe] text-[#1d4ed8] font-semibold text-[12px] hover:bg-white transition-colors">Ignorer</button>
                <button type="button" onClick={handleResumeDraft} className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white font-semibold text-[12px] hover:bg-[#1d4ed8] transition-colors">Reprendre</button>
              </div>
            </div>
          )}

          {/* TOP — Informations du pack */}
          <Section title="Informations du pack">
            <Field label="Nom du pack *">
              <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Ex: Pack CE1 — Rentrée 2025" autoFocus />
            </Field>
            <Field label="Description">
              <textarea value={form.description} onChange={e => set('description', e.target.value)} className={`${inputCls} resize-none h-20`} placeholder="Description du pack..." />
            </Field>
            <Field label="Image principale">
              <Dropzone src={form.mainImage} onFile={handleMainImage} uploading={mainUploading} progress={mainProgress} large onRemove={() => set('mainImage', '')} />
            </Field>
            <Field label="Badge">
              <div className="flex gap-2 flex-wrap">
                {PACK_BADGES.map(b => (
                  <Pill key={b.l} active={form.badge === b.v} onClick={() => set('badge', b.v)}>{b.l}</Pill>
                ))}
              </div>
            </Field>
            <div className="flex gap-4">
              <Field label="Niveau">
                <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value, grade: '' }))} className={inputCls}>
                  <option value="">Sélectionner...</option>
                  {MANUEL_NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Classe">
                {form.level === 'Supérieur' ? (
                  <input value={form.grade} onChange={e => set('grade', e.target.value)} className={inputCls} placeholder="Ex: Licence 2 Économie" />
                ) : (
                  <select value={form.grade} onChange={e => set('grade', e.target.value)} disabled={!form.level} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">Sélectionner...</option>
                    {(MANUEL_CLASSES[form.level] || []).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
              </Field>
              <Field label="École (optionnel)">
                <select value={form.schoolId} onChange={e => set('schoolId', e.target.value)} className={inputCls}>
                  <option value="">Pack générique (sans école)</option>
                  {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {showNewSchool ? (
                  <div className="flex gap-2 mt-2">
                    <input value={newSchoolName} onChange={e => setNewSchoolName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSchool()} className={`${inputCls} flex-1`} placeholder="Nom de l'école" autoFocus />
                    <button onClick={createSchool} className="px-3 rounded-lg bg-[#22c55e] text-white text-[12px] font-semibold">OK</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setShowNewSchool(true)} className="text-[12px] font-semibold text-[#2563eb] hover:underline mt-1.5">+ Ajouter une école</button>
                )}
              </Field>
            </div>
            <Field label="Année scolaire">
              <input value={form.year} onChange={e => set('year', e.target.value)} className={inputCls} placeholder="2025-2026" />
            </Field>
          </Section>

          {/* MIDDLE — Articles du pack */}
          <Section title="Articles du pack">
            <Field label="Rechercher un produit à ajouter">
              <div className="relative">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <Search size={15} className="text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un produit à ajouter..."
                    className="flex-1 bg-transparent text-[14px] text-[#1a1a2e] outline-none placeholder:text-gray-400"
                  />
                </div>
                {searchMatches.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-10 max-h-[260px] overflow-y-auto">
                    {searchMatches.map(p => {
                      const s = p.totalStock ?? 0;
                      return (
                        <div key={p.id} onClick={() => addProductItem(p)} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0">
                          <Thumb src={p.mainImage} className="w-8 h-8" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-[#1a1a2e] font-medium truncate">{p.name}</div>
                            {(p.famille || p.categoryPath?.[0]) && (
                              <span className="text-[10px] text-[#2563eb] bg-[#2563eb]/10 px-1.5 py-0.5 rounded-full">{getCategoryName(p.famille || p.categoryPath?.[0])}</span>
                            )}
                          </div>
                          <span className="text-[12px] font-mono text-[#1a1a2e] shrink-0">{formatPrice(p.basePriceSell)}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${s <= 0 ? 'bg-[#ef4444]/15 text-[#ef4444]' : 'bg-[#22c55e]/15 text-[#22c55e]'}`}>
                            {s <= 0 ? 'Épuisé' : `${s} en stock`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Field>

            {variantPicker && (
              <div className="flex items-center gap-2 bg-[#eff6ff] border border-[#bfdbfe] rounded-lg px-3 py-2.5">
                <span className="text-[13px] text-[#1d4ed8] font-medium shrink-0">
                  Choisir la variante pour « {variantPicker.product.name} » :
                </span>
                {variantPicker.loading ? (
                  <span className="text-[12px] text-gray-400">Chargement...</span>
                ) : variantPicker.variants.length === 0 ? (
                  <span className="text-[12px] text-gray-400">Aucune variante disponible.</span>
                ) : (
                  <select
                    value={variantPicker.selectedId}
                    onChange={e => setVariantPicker(prev => ({ ...prev, selectedId: e.target.value }))}
                    className={`${inputCls} flex-1 max-w-[220px]`}
                  >
                    {variantPicker.variants.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.label || Object.values(v.options || {}).join(' / ')} (stock: {v.stock ?? 0})
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={confirmVariantPick}
                  disabled={!variantPicker.selectedId}
                  className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white text-[12px] font-semibold shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ajouter
                </button>
                <button type="button" onClick={() => setVariantPicker(null)} className="text-gray-400 hover:text-[#1a1a2e] shrink-0"><X size={15} /></button>
              </div>
            )}

            {items.length === 0 ? (
              <p className="text-[13px] text-gray-400 text-center py-6">Aucun article. Recherchez un produit ci-dessus pour commencer.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {groups.map((group, gi) => (
                  <div key={gi}>
                    <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{getCategoryName(group.category)}</div>
                    <div className="flex flex-col gap-2">
                      {group.entries.map(({ item, index }) => (
                        <div
                          key={index}
                          draggable
                          onDragStart={() => { dragIndexRef.current = index; }}
                          onDragOver={e => { e.preventDefault(); setDragOverIndex(index); }}
                          onDrop={() => handleDrop(index)}
                          className={`flex items-center gap-3 bg-gray-50 border rounded-lg px-3 py-2.5 transition-colors ${dragOverIndex === index ? 'border-[#F5A623]' : 'border-gray-200'}`}
                        >
                          <GripVertical size={15} className="text-gray-300 cursor-grab shrink-0" />
                          <Thumb src={item.image} className="w-9 h-9" />
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] text-[#1a1a2e] font-medium truncate">
                              {item.name}{item.variantLabel && <span className="text-gray-400 font-normal"> — {item.variantLabel}</span>}
                            </div>
                            {item.barcode && (
                              <div className="flex items-center gap-1 text-[11px] text-gray-400 font-mono">
                                <BarcodeIcon className="w-3.5 h-3" /> {item.barcode}
                              </div>
                            )}
                          </div>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-14 bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-center text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                          />
                          {item.productId ? (
                            <span className="w-20 text-right font-mono text-[12px] text-gray-500 shrink-0">{formatPrice(item.unitPrice)}</span>
                          ) : (
                            <input
                              type="number"
                              value={item.unitPrice}
                              onChange={e => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-right text-[#1a1a2e] outline-none focus:border-[#F5A623]"
                            />
                          )}
                          <span className="w-20 text-right font-mono text-[13px] font-semibold text-[#1a1a2e] shrink-0">{formatPrice(item.quantity * item.unitPrice)}</span>
                          <div className="flex gap-1 shrink-0">
                            <Pill active={item.isRequired} onClick={() => { updateItem(index, 'isRequired', true); updateItem(index, 'isRemovable', false); }}>Obligatoire</Pill>
                            <Pill active={!item.isRequired} onClick={() => { updateItem(index, 'isRequired', false); updateItem(index, 'isRemovable', true); }}>Optionnel</Pill>
                          </div>
                          <button onClick={() => removeItem(index)} className="text-gray-400 hover:text-[#ef4444] shrink-0"><X size={15} /></button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showManualAdd ? (
              <div className="flex gap-2 items-end bg-gray-50 border border-gray-200 rounded-lg p-3">
                <input value={manualForm.name} onChange={e => setManualForm(f => ({ ...f, name: e.target.value }))} placeholder="Nom de l'article" className={`${inputCls} flex-1`} autoFocus />
                <input value={manualForm.category} onChange={e => setManualForm(f => ({ ...f, category: e.target.value }))} placeholder="Catégorie" className={`${inputCls} w-32`} />
                <input type="number" value={manualForm.unitPrice} onChange={e => setManualForm(f => ({ ...f, unitPrice: e.target.value }))} placeholder="Prix" className={`${inputCls} w-24`} />
                <input type="number" min={1} value={manualForm.quantity} onChange={e => setManualForm(f => ({ ...f, quantity: e.target.value }))} placeholder="Qté" className={`${inputCls} w-16`} />
                <button onClick={addManualItem} className="px-3 py-2.5 rounded-lg bg-[#22c55e] text-white text-[12px] font-semibold shrink-0">Ajouter</button>
                <button onClick={() => setShowManualAdd(false)} className="text-gray-400 hover:text-[#1a1a2e] shrink-0"><X size={16} /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setShowManualAdd(true)} className="flex items-center gap-1 text-[12px] font-semibold text-[#2563eb] hover:underline self-start">
                <Plus size={12} /> Ajouter un article manuellement
              </button>
            )}
          </Section>

          {/* Pricing summary */}
          <Section title="Tarification">
            <div className="flex justify-between text-[14px]">
              <span className="text-gray-500">Prix total articles</span>
              <span className="font-mono font-semibold text-[#1a1a2e]">{formatPrice(totalItemsPrice)}</span>
            </div>
            <Field label="Remise du pack">
              <div className="flex gap-2 items-center">
                <div className="flex gap-1 bg-gray-100 rounded-lg p-1 shrink-0">
                  <Pill active={form.discountType === 'percent'} onClick={() => set('discountType', 'percent')}>Pourcentage</Pill>
                  <Pill active={form.discountType === 'fixed'} onClick={() => set('discountType', 'fixed')}>Prix fixe</Pill>
                </div>
                <input
                  type="number"
                  value={form.discountValue}
                  onChange={e => set('discountValue', e.target.value)}
                  className={`${inputCls} font-mono`}
                  placeholder={form.discountType === 'percent' ? 'Remise %' : 'Prix du pack (DH)'}
                />
              </div>
            </Field>
            <div className="border-t border-gray-100 pt-3 flex flex-col gap-1.5">
              <div className="flex justify-between text-[15px] font-bold">
                <span className="text-[#1a1a2e]">Prix du pack</span>
                <span className="font-mono text-[#22c55e]">{formatPrice(packPrice)}</span>
              </div>
              <div className="flex justify-between text-[13px]">
                <span className="text-gray-500">Économie client</span>
                <span className="font-mono text-[#ef4444]">-{formatPrice(savings)} (-{remisePercent}%)</span>
              </div>
            </div>
          </Section>

          {/* Upsell */}
          <Section title="Suggestions et ventes additionnelles">
            <Field label="Complétez votre pack" hint="Ces produits seront suggérés en supplément sur le site (sacs, trousses...).">
              <ProductPicker
                allProducts={products}
                excludeId={packId}
                selectedIds={form.upsellProductIds}
                onAdd={pid => set('upsellProductIds', [...form.upsellProductIds, pid])}
                onRemove={pid => set('upsellProductIds', form.upsellProductIds.filter(x => x !== pid))}
                placeholder="Rechercher un produit..."
              />
            </Field>
          </Section>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
        <button onClick={handleCancelClick} className="px-5 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[14px] hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        {!isEditing && draftSavedFlash && (
          <span className="flex items-center gap-1 text-[12px] text-[#22c55e] font-medium">
            <Check size={13} /> Brouillon sauvegardé
          </span>
        )}
        <span className="text-[13px] text-gray-500 font-medium">
          {items.length} article{items.length > 1 ? 's' : ''} • {formatPrice(packPrice)} • -{remisePercent}%
        </span>
        <div className="flex gap-3">
          <button onClick={() => handleSave('draft')} disabled={saving} className="px-5 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[14px] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            Enregistrer comme brouillon
          </button>
          <button onClick={() => handleSave('active')} disabled={saving} className="px-6 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-[14px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
            {saving ? 'Enregistrement...' : 'Publier'}
          </button>
        </div>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-white rounded-2xl p-7 w-[380px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3">Voulez-vous sauvegarder ce brouillon ?</h3>
            <p className="text-sm text-gray-500 mb-6">Vous pourrez reprendre ce pack la prochaine fois que vous ouvrirez le formulaire de création.</p>
            <div className="flex gap-3">
              <button onClick={() => { localStorage.removeItem(PACK_DRAFT_KEY); setShowCancelConfirm(false); navigate('/admin/packs'); }} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">Non</button>
              <button onClick={() => { setShowCancelConfirm(false); navigate('/admin/packs'); }} className="flex-1 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-[13px] transition-colors">Oui</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
