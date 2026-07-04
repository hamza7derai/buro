import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useProducts } from '../hooks/useProducts';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../components/Toast';
import { uploadProductImage } from '../lib/uploadImage';
import BarcodeIcon from '../components/BarcodeIcon';
import BrandDropdown from '../components/BrandDropdown';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Plus, X, Check } from 'lucide-react';
import { MANUEL_NIVEAUX, MANUEL_CLASSES, MANUEL_MATIERES } from '../lib/manuelLevels';
import { BOOK_LANGUAGES, isBookCategoryName, genreKey } from '../lib/bookMeta';
import { useBookGenres } from '../hooks/useBookGenres';
import { Section, Field, Toggle, Pill, ChipInput, Dropzone, ProductPicker, inputCls } from '../components/FormUI';

const PRODUCT_DRAFT_KEY = 'younasser_product_draft';

const PRODUCT_TYPES = [
  { v: 'standard', l: 'Standard' },
  { v: 'manuel', l: 'Manuel scolaire' },
  { v: 'pack', l: 'Pack' },
];

const BADGES = [
  { v: null, l: 'Aucun' },
  { v: 'vedette', l: 'Vedette' },
  { v: 'nouveau', l: 'Nouveau' },
  { v: 'promo', l: 'Promo' },
];

const VARIANT_TYPE_PRESETS = ['Couleur', 'Taille'];

function emptyForm() {
  return {
    name: '', shortDescription: '', barcode: '', sku: '',
    type: 'standard',
    mainImage: '', gallery: [],
    categoryId: '', subcategoryId: '', tags: [], brand: '',
    basePriceSell: '', basePriceCost: '', basePriceWholesale: '',
    promo: { enabled: false, promoPrice: '', startDate: '', endDate: '' },
    totalStock: '', lowStockThreshold: 3,
    bulkOffersEnabled: false, bulkOffers: [],
    hasVariants: false, variantTypes: [], variantOptions: {}, variantOptionColors: {},
    manuelInfo: { level: '', grade: '', subject: '', edition: '', year: '' },
    bookInfo: { author: '', publisher: '', genres: [], language: '', pages: '', isbn: '' },
    badge: null, isFeatured: false, isVisible: true,
    relatedProductIds: [], frequentlyBoughtWith: [],
  };
}

function buildCombos(variantTypes, variantOptions) {
  if (!variantTypes.length) return [];
  const optionArrays = variantTypes.map(t => variantOptions[t] || []);
  if (optionArrays.some(arr => arr.length === 0)) return [];
  let combos = [{}];
  variantTypes.forEach((type, idx) => {
    const next = [];
    combos.forEach(combo => {
      optionArrays[idx].forEach(val => next.push({ ...combo, [type]: val }));
    });
    combos = next;
  });
  return combos.map(options => ({ options, key: variantTypes.map(t => options[t]).join(' / ') }));
}

function stockStatus(stock, threshold) {
  const s = parseInt(stock) || 0;
  const min = parseInt(threshold) || 3;
  if (s <= 0) return { label: 'Épuisé', cls: 'bg-[#ef4444]/15 text-[#ef4444]' };
  if (s <= min) return { label: `Faible (${s})`, cls: 'bg-[#F5A623]/15 text-[#F5A623]' };
  return { label: `En stock (${s})`, cls: 'bg-[#22c55e]/15 text-[#22c55e]' };
}

export default function ProductForm() {
  const { id } = useParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { isAdmin } = useAuth();
  const { products, createProductFull, updateProductFull, saveVariants } = useProducts();
  const { mainCategories, subCategoriesOf, addCategory } = useCategories();

  const productIdRef = useRef(id || doc(collection(db, 'products')).id);
  const productId = productIdRef.current;

  const duplicateFrom = !isEditing ? location.state?.duplicateFrom : null;
  const isDuplicating = !!duplicateFrom;
  const nameInputRef = useRef(null);

  const [form, setForm] = useState(() => {
    const f = emptyForm();
    if (!isEditing && location.state?.prefillBarcode) f.barcode = location.state.prefillBarcode;
    if (duplicateFrom) {
      const d = duplicateFrom;
      f.name = d.name + ' (copie)';
      f.barcode = '';
      f.sku = '';
      f.shortDescription = d.shortDescription || d.description || '';
      f.type = d.type || 'standard';
      f.mainImage = d.mainImage || '';
      f.gallery = d.gallery || [];
      f.categoryId = d.categoryPath?.[0] || '';
      f.subcategoryId = d.categoryPath?.[1] || '';
      f.tags = d.tags || [];
      f.brand = d.brand || '';
      f.basePriceSell = d.basePriceSell ?? '';
      f.basePriceCost = d.basePriceCost ?? '';
      f.basePriceWholesale = d.basePriceWholesale ?? '';
      f.promo = d.promo ? { ...d.promo } : { enabled: false, promoPrice: '', startDate: '', endDate: '' };
      f.totalStock = 0;
      f.lowStockThreshold = d.lowStockThreshold ?? 3;
      f.bulkOffersEnabled = d.bulkOffersEnabled || false;
      f.bulkOffers = (d.bulkOffers || []).map(l => ({ name: l.name || '', quantity: l.quantity ?? '', price: l.price ?? '', image: l.image || '' }));
      f.hasVariants = d.hasVariants || false;
      f.variantTypes = d.variantTypes || [];
      f.variantOptions = d.variantOptions ? { ...d.variantOptions } : {};
      f.variantOptionColors = d.variantOptionColors ? { ...d.variantOptionColors } : {};
      f.manuelInfo = d.manuelInfo ? { ...d.manuelInfo } : { level: '', grade: '', subject: '', edition: '', year: '' };
      const dupGenres = Array.isArray(d.bookInfo?.genres) && d.bookInfo.genres.length
        ? d.bookInfo.genres
        : d.bookInfo?.genre ? [genreKey(d.bookInfo.genre)].filter(Boolean) : [];
      f.bookInfo = d.bookInfo
        ? { author: d.bookInfo.author || '', publisher: d.bookInfo.publisher || '', genres: dupGenres, language: d.bookInfo.language || '', pages: d.bookInfo.pages ?? '', isbn: d.bookInfo.isbn || '' }
        : { author: '', publisher: '', genres: [], language: '', pages: '', isbn: '' };
      f.badge = d.badge || null;
      f.isFeatured = d.isFeatured || false;
      f.isVisible = d.isVisible !== false;
      f.relatedProductIds = d.relatedProductIds || [];
      f.frequentlyBoughtWith = d.frequentlyBoughtWith || [];
    }
    return f;
  });
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [variantRows, setVariantRows] = useState({});
  const originalVariantIds = useRef({}); // key -> firestore doc id, for diffing on save

  const [mainUploading, setMainUploading] = useState(false);
  const [mainProgress, setMainProgress] = useState(0);
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryProgress, setGalleryProgress] = useState(0);

  const [showNewMainCat, setShowNewMainCat] = useState(false);
  const [newMainCatName, setNewMainCatName] = useState('');
  const [newMainCatNameAr, setNewMainCatNameAr] = useState('');
  const [showNewSubCat, setShowNewSubCat] = useState(false);
  const [newSubCatName, setNewSubCatName] = useState('');
  const [newSubCatNameAr, setNewSubCatNameAr] = useState('');

  const { genres: bookGenres, addGenre: addBookGenre } = useBookGenres();
  const [genreSearch, setGenreSearch] = useState('');
  const [showGenreDropdown, setShowGenreDropdown] = useState(false);
  const genreDropdownRef = useRef(null);

  const [newVariantTypeName, setNewVariantTypeName] = useState('');
  const [showCustomVariantType, setShowCustomVariantType] = useState(false);

  // ─── Draft auto-save (new products only — editing writes straight to Firebase) ───
  const [pendingDraft, setPendingDraft] = useState(null);
  const [draftSavedFlash, setDraftSavedFlash] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const pendingDraftRef = useRef(null);
  const formRef = useRef(form);
  const variantRowsRef = useRef(variantRows);
  const flashTimeoutRef = useRef(null);

  useEffect(() => { formRef.current = form; }, [form]);
  useEffect(() => { variantRowsRef.current = variantRows; }, [variantRows]);
  useEffect(() => { pendingDraftRef.current = pendingDraft; }, [pendingDraft]);

  // Check for an unsaved draft once, when first opening a brand-new (non-duplicate) form
  useEffect(() => {
    if (isEditing || isDuplicating) return;
    try {
      const raw = localStorage.getItem(PRODUCT_DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.form) setPendingDraft(parsed);
      }
    } catch { /* corrupt draft, ignore */ }
  }, []);

  function writeDraft() {
    if (isEditing || pendingDraftRef.current) return;
    try {
      localStorage.setItem(PRODUCT_DRAFT_KEY, JSON.stringify({ form: formRef.current, variantRows: variantRowsRef.current }));
      setDraftSavedFlash(true);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
      flashTimeoutRef.current = setTimeout(() => setDraftSavedFlash(false), 2000);
    } catch { /* storage full/unavailable, ignore */ }
  }

  // Debounced save on every field change
  useEffect(() => {
    if (isEditing || pendingDraft) return;
    const t = setTimeout(writeDraft, 2000);
    return () => clearTimeout(t);
  }, [form, variantRows, isEditing, pendingDraft]);

  // Backup save every 5s regardless of change frequency
  useEffect(() => {
    if (isEditing) return;
    const interval = setInterval(writeDraft, 5000);
    return () => clearInterval(interval);
  }, [isEditing]);

  function handleResumeDraft() {
    if (pendingDraft?.form) setForm(pendingDraft.form);
    if (pendingDraft?.variantRows) setVariantRows(pendingDraft.variantRows);
    setPendingDraft(null);
  }

  function handleDiscardDraft() {
    localStorage.removeItem(PRODUCT_DRAFT_KEY);
    setPendingDraft(null);
  }

  function handleCancelClick() {
    if (!isEditing && localStorage.getItem(PRODUCT_DRAFT_KEY)) {
      setShowCancelConfirm(true);
    } else {
      navigate('/produits');
    }
  }

  // Load existing product + variants when editing
  useEffect(() => {
    if (!isEditing) return;
    (async () => {
      const snap = await getDoc(doc(db, 'products', id));
      if (!snap.exists()) { toast('Produit introuvable', 'error'); navigate('/produits'); return; }
      const data = snap.data();
      setForm(f => ({
        ...f,
        name: data.name || '', shortDescription: data.shortDescription || '',
        barcode: data.barcode || '', sku: data.sku || '',
        type: data.type || 'standard',
        mainImage: data.mainImage || '', gallery: data.gallery || [],
        categoryId: data.categoryPath?.[0] || '', subcategoryId: data.categoryPath?.[1] || '',
        tags: data.tags || [], brand: data.brand || '',
        basePriceSell: data.basePriceSell ?? '', basePriceCost: data.basePriceCost ?? '', basePriceWholesale: data.basePriceWholesale ?? '',
        promo: data.promo || { enabled: false, promoPrice: '', startDate: '', endDate: '' },
        totalStock: data.totalStock ?? '', lowStockThreshold: data.lowStockThreshold ?? 3,
        bulkOffersEnabled: data.bulkOffersEnabled || false,
        bulkOffers: (data.bulkOffers || []).map(l => ({
          name: l.name || '', quantity: l.quantity ?? '', price: l.price ?? '', image: l.image || '',
        })),
        hasVariants: data.hasVariants || false, variantTypes: data.variantTypes || [],
        variantOptions: data.variantOptions || {}, variantOptionColors: data.variantOptionColors || {},
        manuelInfo: data.manuelInfo || { level: '', grade: '', subject: '', edition: '', year: '' },
        bookInfo: (() => {
          const bi = data.bookInfo || {};
          const genres = Array.isArray(bi.genres) && bi.genres.length
            ? bi.genres
            : bi.genre ? [genreKey(bi.genre)].filter(Boolean) : [];
          return { author: bi.author || '', publisher: bi.publisher || '', genres, language: bi.language || '', pages: bi.pages ?? '', isbn: bi.isbn || '' };
        })(),
        badge: data.badge || null, isFeatured: data.isFeatured || false, isVisible: data.isVisible !== false,
        relatedProductIds: data.relatedProductIds || [], frequentlyBoughtWith: data.frequentlyBoughtWith || [],
      }));

      const varSnap = await getDocs(collection(db, 'products', id, 'variants'));
      const rows = {};
      const idsByKey = {};
      varSnap.docs.forEach(d => {
        const v = d.data();
        const types = data.variantTypes || [];
        const key = types.map(t => v.options?.[t]).join(' / ');
        rows[key] = {
          id: d.id, options: v.options || {}, label: v.label || key,
          image: v.image || '', priceSell: v.priceSell ?? '', priceCost: v.priceCost ?? '',
          stock: v.stock ?? '', barcode: v.barcode || '',
        };
        idsByKey[key] = d.id;
      });
      setVariantRows(rows);
      originalVariantIds.current = idsByKey;
      setLoading(false);
    })();
  }, [id]);

  // Auto-select "(copie)" in the name field when duplicating so the user can type immediately
  useEffect(() => {
    if (!isDuplicating || !nameInputRef.current) return;
    const input = nameInputRef.current;
    const copieStart = input.value.lastIndexOf(' (copie)');
    if (copieStart !== -1) {
      input.focus();
      input.setSelectionRange(copieStart, input.value.length);
    }
  }, []);

  // When duplicating a product that has variants, load original variant rows but clear barcodes/stock
  useEffect(() => {
    if (!isDuplicating || !duplicateFrom?.hasVariants) return;
    (async () => {
      const varSnap = await getDocs(collection(db, 'products', duplicateFrom.id, 'variants'));
      const rows = {};
      varSnap.docs.forEach(d => {
        const v = d.data();
        const types = duplicateFrom.variantTypes || [];
        const key = types.map(t => v.options?.[t]).join(' / ');
        rows[key] = {
          options: v.options || {},
          label: v.label || key,
          image: v.image || '',
          priceSell: v.priceSell ?? '',
          priceCost: v.priceCost ?? '',
          stock: 0,
          barcode: '',
        };
      });
      setVariantRows(rows);
    })();
  }, []);

  const combos = useMemo(() => buildCombos(form.variantTypes, form.variantOptions), [form.variantTypes, form.variantOptions]);

  useEffect(() => {
    if (!form.hasVariants) return;
    setVariantRows(prev => {
      const next = {};
      combos.forEach(c => {
        next[c.key] = prev[c.key] || {
          options: c.options, label: c.key,
          image: '', priceSell: form.basePriceSell || '', priceCost: form.basePriceCost || '',
          stock: '', barcode: '',
        };
      });
      return next;
    });
  }, [combos, form.hasVariants]);

  useEffect(() => {
    if (!showGenreDropdown) return;
    function handleClickOutside(e) {
      if (genreDropdownRef.current && !genreDropdownRef.current.contains(e.target)) {
        setShowGenreDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGenreDropdown]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); }
  function setNested(field, sub, value) { setForm(f => ({ ...f, [field]: { ...f[field], [sub]: value } })); }

  // ─── Images ───
  async function handleMainImage(file) {
    setMainUploading(true);
    setMainProgress(0);
    try {
      const url = await uploadProductImage(productId, file, setMainProgress);
      set('mainImage', url);
    } catch (err) {
      console.error(err);
      toast('Erreur lors du téléchargement de l\'image', 'error');
    } finally {
      setMainUploading(false);
    }
  }

  async function handleGalleryImage(file) {
    if (form.gallery.length >= 6) return;
    setGalleryUploading(true);
    setGalleryProgress(0);
    try {
      const url = await uploadProductImage(productId, file, setGalleryProgress);
      setForm(f => ({ ...f, gallery: [...f.gallery, url] }));
    } catch (err) {
      console.error(err);
      toast('Erreur lors du téléchargement de l\'image', 'error');
    } finally {
      setGalleryUploading(false);
    }
  }

  function removeGalleryImage(idx) {
    setForm(f => ({ ...f, gallery: f.gallery.filter((_, i) => i !== idx) }));
  }

  // ─── Category ───
  async function createMainCategory() {
    if (!newMainCatName.trim()) return;
    const catId = await addCategory(newMainCatName.trim(), null, newMainCatNameAr.trim());
    set('categoryId', catId);
    setNewMainCatName(''); setNewMainCatNameAr(''); setShowNewMainCat(false);
  }

  async function createSubCategory() {
    if (!newSubCatName.trim() || !form.categoryId) return;
    const catId = await addCategory(newSubCatName.trim(), form.categoryId, newSubCatNameAr.trim());
    set('subcategoryId', catId);
    setNewSubCatName(''); setNewSubCatNameAr(''); setShowNewSubCat(false);
  }

  // ─── Genre multi-select ───
  function addGenreChip(frName) {
    if (!form.bookInfo.genres.includes(frName)) {
      setNested('bookInfo', 'genres', [...form.bookInfo.genres, frName]);
    }
    setGenreSearch('');
    setShowGenreDropdown(false);
  }

  async function handleCreateAndAddGenre() {
    const name = genreSearch.trim();
    if (!name) return;
    await addBookGenre({ fr: name, ar: '' });
    addGenreChip(name);
  }

  // ─── Variant types/options ───
  function toggleVariantType(type) {
    setForm(f => {
      const active = f.variantTypes.includes(type);
      return {
        ...f,
        variantTypes: active ? f.variantTypes.filter(t => t !== type) : [...f.variantTypes, type],
      };
    });
  }

  function addCustomVariantType() {
    const name = newVariantTypeName.trim();
    if (!name || form.variantTypes.includes(name)) return;
    setForm(f => ({ ...f, variantTypes: [...f.variantTypes, name] }));
    setNewVariantTypeName(''); setShowCustomVariantType(false);
  }

  function addVariantOption(type, value) {
    setForm(f => ({
      ...f,
      variantOptions: { ...f.variantOptions, [type]: [...(f.variantOptions[type] || []), value] },
    }));
  }

  function removeVariantOption(type, idx) {
    setForm(f => ({
      ...f,
      variantOptions: { ...f.variantOptions, [type]: f.variantOptions[type].filter((_, i) => i !== idx) },
    }));
  }

  function setVariantOptionColor(value, color) {
    setForm(f => ({ ...f, variantOptionColors: { ...f.variantOptionColors, [value]: color } }));
  }

  function updateVariantRow(key, field, value) {
    setVariantRows(prev => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  async function handleVariantImage(key, file) {
    try {
      const url = await uploadProductImage(productId, file, () => {});
      updateVariantRow(key, 'image', url);
    } catch (err) {
      console.error(err);
      toast('Erreur lors du téléchargement', 'error');
    }
  }

  // ─── Vente en gros (lots) ───
  function addBulkOffer() {
    setForm(f => ({ ...f, bulkOffers: [...f.bulkOffers, { name: '', quantity: '', price: '', image: '' }] }));
  }

  function updateBulkOffer(idx, field, value) {
    setForm(f => ({ ...f, bulkOffers: f.bulkOffers.map((l, i) => i === idx ? { ...l, [field]: value } : l) }));
  }

  function removeBulkOffer(idx) {
    setForm(f => ({ ...f, bulkOffers: f.bulkOffers.filter((_, i) => i !== idx) }));
  }

  async function handleBulkOfferImage(idx, file) {
    try {
      const url = await uploadProductImage(productId, file, () => {});
      updateBulkOffer(idx, 'image', url);
    } catch (err) {
      console.error(err);
      toast('Erreur lors du téléchargement', 'error');
    }
  }

  // ─── Save ───
  async function handleSave() {
    if (!form.name.trim()) { toast('Nom du produit requis', 'error'); return; }
    if (!form.basePriceSell) { toast('Prix de vente requis', 'error'); return; }
    setSaving(true);
    try {
      const variantStockTotal = form.hasVariants
        ? Object.values(variantRows).reduce((s, v) => s + (parseInt(v.stock) || 0), 0)
        : null;

      const isManuelType = form.type === 'manuel';
      const selectedCatName = mainCategories.find(c => c.id === form.categoryId)?.name || '';
      const isBookCat = isBookCategoryName(selectedCatName);

      const payload = {
        name: form.name.trim(),
        slug: form.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
        barcode: form.barcode.trim(),
        sku: form.sku.trim(),
        description: form.shortDescription.trim(),
        shortDescription: form.shortDescription.trim(),
        mainImage: form.mainImage,
        gallery: form.gallery,
        categoryId: isManuelType ? null : (form.categoryId || null),
        categoryPath: isManuelType ? ['Manuels scolaires'] : [form.categoryId, form.subcategoryId].filter(Boolean),
        subcategory: isManuelType ? '' : (form.subcategoryId || ''),
        famille: isManuelType ? 'Manuels scolaires' : '',
        tags: form.tags,
        brand: form.brand.trim(),
        type: form.type,
        isManuel: isManuelType,
        isPack: form.type === 'pack',
        manuelInfo: isManuelType ? form.manuelInfo : null,
        isBook: isBookCat && !!(form.bookInfo.author || form.bookInfo.publisher || form.bookInfo.genres?.length),
        bookInfo: isBookCat ? {
          author: form.bookInfo.author.trim(),
          publisher: form.bookInfo.publisher.trim(),
          genres: form.bookInfo.genres || [],
          language: form.bookInfo.language || '',
          pages: parseInt(form.bookInfo.pages) || null,
          isbn: form.bookInfo.isbn.trim(),
        } : null,
        basePriceSell: parseFloat(form.basePriceSell) || 0,
        basePriceCost: parseFloat(form.basePriceCost) || 0,
        basePriceWholesale: parseFloat(form.basePriceWholesale) || 0,
        promo: {
          enabled: form.promo.enabled,
          promoPrice: parseFloat(form.promo.promoPrice) || 0,
          startDate: form.promo.startDate || null,
          endDate: form.promo.endDate || null,
        },
        variantPricingEnabled: form.hasVariants,
        hasVariants: form.hasVariants,
        variantTypes: form.hasVariants ? form.variantTypes : [],
        variantOptions: form.hasVariants ? form.variantOptions : {},
        variantOptionColors: form.hasVariants ? form.variantOptionColors : {},
        totalStock: variantStockTotal !== null ? variantStockTotal : (parseInt(form.totalStock) || 0),
        lowStockThreshold: parseInt(form.lowStockThreshold) || 3,
        bulkOffersEnabled: form.bulkOffersEnabled,
        bulkOffers: form.bulkOffersEnabled
          ? form.bulkOffers
              .filter(l => l.name.trim() && l.quantity && l.price)
              .map(l => {
                const quantity = parseInt(l.quantity) || 0;
                const price = parseFloat(l.price) || 0;
                const unitPrice = quantity > 0 ? Math.round((price / quantity) * 100) / 100 : 0;
                const baseSell = parseFloat(form.basePriceSell) || 0;
                const savingsPercent = baseSell > 0 ? Math.max(0, Math.round((1 - unitPrice / baseSell) * 100)) : 0;
                return { name: l.name.trim(), quantity, price, unitPrice, savingsPercent, image: l.image || '' };
              })
          : [],
        status: 'active',
        isVisible: form.isVisible,
        isOutOfStock: (variantStockTotal !== null ? variantStockTotal : (parseInt(form.totalStock) || 0)) <= 0,
        isFeatured: form.isFeatured,
        badge: form.badge,
        relatedProductIds: form.relatedProductIds,
        frequentlyBoughtWith: form.frequentlyBoughtWith,
      };

      if (isEditing) {
        await updateProductFull(productId, payload);
      } else {
        await createProductFull(productId, payload);
      }

      if (form.hasVariants) {
        const rowsToSave = combos.map(c => ({ ...variantRows[c.key], options: c.options, label: c.key }));
        const keptKeys = new Set(combos.map(c => c.key));
        const idsToDelete = Object.entries(originalVariantIds.current)
          .filter(([key]) => !keptKeys.has(key))
          .map(([, vid]) => vid);
        await saveVariants(productId, rowsToSave.map(r => ({
          ...r,
          priceSell: parseFloat(r.priceSell) || 0,
          priceCost: parseFloat(r.priceCost) || 0,
          stock: parseInt(r.stock) || 0,
          minStock: parseInt(form.lowStockThreshold) || 3,
        })), idsToDelete);
      } else if (isEditing) {
        const idsToDelete = Object.values(originalVariantIds.current);
        if (idsToDelete.length) await saveVariants(productId, [], idsToDelete);
      }

      if (!isEditing) localStorage.removeItem(PRODUCT_DRAFT_KEY);
      toast(`${form.name} ${isEditing ? 'mis à jour' : 'ajouté'}`);
      navigate('/produits');
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

  const status = stockStatus(form.totalStock, form.lowStockThreshold);
  const subCats = form.categoryId ? subCategoriesOf(form.categoryId) : [];
  const isBookCategory = isBookCategoryName(mainCategories.find(c => c.id === form.categoryId)?.name);
  const filteredBookGenres = bookGenres.filter(g =>
    !form.bookInfo.genres.includes(g.fr) &&
    (!genreSearch.trim() || g.fr.toLowerCase().includes(genreSearch.toLowerCase()))
  );

  return (
    <div className="h-full w-full flex flex-col bg-[#f5f6fa]">
      <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-5 flex flex-col gap-4">
        <div className="shrink-0">
          <h1 className="text-xl font-bold text-[#1a1a2e]">
            {isEditing ? 'Modifier le produit' : isDuplicating ? 'Dupliquer le produit' : 'Nouveau produit'}
          </h1>
        </div>

        {isDuplicating && (
          <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl px-4 py-3 flex items-start gap-3 text-[13px] text-[#1d4ed8]">
            <span className="shrink-0 mt-0.5">ℹ</span>
            <span>Vous créez un produit à partir de <strong>{duplicateFrom.name}</strong>. Modifiez les champs nécessaires puis sauvegardez.</span>
          </div>
        )}

        {pendingDraft && (
          <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-[13px] text-[#1d4ed8]">
            <span>Vous avez un brouillon non sauvegardé</span>
            <div className="flex gap-2 shrink-0">
              <button type="button" onClick={handleDiscardDraft} className="px-3 py-1.5 rounded-lg border border-[#bfdbfe] text-[#1d4ed8] font-semibold text-[12px] hover:bg-white transition-colors">Ignorer</button>
              <button type="button" onClick={handleResumeDraft} className="px-3 py-1.5 rounded-lg bg-[#2563eb] text-white font-semibold text-[12px] hover:bg-[#1d4ed8] transition-colors">Reprendre</button>
            </div>
          </div>
        )}

        {/* SECTION 1 — Informations générales */}
        <Section title="Informations générales">
          <Field label="Nom du produit *">
            <input ref={nameInputRef} value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Ex: Cahier 96 pages grands carreaux" autoFocus />
          </Field>
          <Field label="Description courte">
            <textarea value={form.shortDescription} onChange={e => set('shortDescription', e.target.value)} className={`${inputCls} resize-none h-20`} placeholder="Description courte du produit..." />
          </Field>
          <div className="flex gap-4">
            <Field label="Code-barres">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 focus-within:border-[#F5A623]">
                <BarcodeIcon className="w-5 h-4 text-gray-400 shrink-0" />
                <input value={form.barcode} onChange={e => set('barcode', e.target.value)} className="flex-1 bg-transparent py-2.5 text-[14px] text-[#1a1a2e] outline-none font-mono" placeholder="Scanner ou saisir" />
              </div>
            </Field>
            <Field label="SKU">
              <input value={form.sku} onChange={e => set('sku', e.target.value)} className={`${inputCls} font-mono`} placeholder="Référence interne" />
            </Field>
          </div>
          <Field label="Type de produit">
            <div className="flex gap-2">
              {PRODUCT_TYPES.map(t => (
                <Pill key={t.v} active={form.type === t.v} onClick={() => set('type', t.v)}>{t.l}</Pill>
              ))}
            </div>
          </Field>
        </Section>

        {/* SECTION 2 — Images */}
        <Section title="Images">
          <Field label="Image principale">
            <Dropzone
              src={form.mainImage}
              onFile={handleMainImage}
              uploading={mainUploading}
              progress={mainProgress}
              large
              onRemove={() => set('mainImage', '')}
            />
          </Field>
          <Field label={`Galerie (${form.gallery.length}/6)`}>
            <div className="grid grid-cols-6 gap-2">
              {form.gallery.map((src, i) => (
                <Dropzone key={i} src={src} onRemove={() => removeGalleryImage(i)} />
              ))}
              {form.gallery.length < 6 && (
                <Dropzone src="" onFile={handleGalleryImage} uploading={galleryUploading} progress={galleryProgress} />
              )}
            </div>
          </Field>
        </Section>

        {/* SECTION 3 — Catégorie (hidden for manuels: their category is determined by niveau/matière) */}
        {form.type !== 'manuel' && (
        <Section title="Catégorie">
          <div className="flex gap-4">
            <Field label="Catégorie principale">
              <select value={form.categoryId} onChange={e => { set('categoryId', e.target.value); set('subcategoryId', ''); }} className={inputCls}>
                <option value="">Sélectionner...</option>
                {mainCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {showNewMainCat ? (
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex gap-2">
                    <input value={newMainCatName} onChange={e => setNewMainCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMainCategory()} className={`${inputCls} flex-1`} placeholder="Nom (FR)" autoFocus />
                    <input value={newMainCatNameAr} onChange={e => setNewMainCatNameAr(e.target.value)} onKeyDown={e => e.key === 'Enter' && createMainCategory()} className={`${inputCls} flex-1`} placeholder="الاسم (AR)" dir="rtl" />
                    <button onClick={createMainCategory} className="px-3 rounded-lg bg-[#22c55e] text-white text-[12px] font-semibold">OK</button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setShowNewMainCat(true)} className="text-[12px] font-semibold text-[#2563eb] hover:underline mt-1.5">+ Créer</button>
              )}
            </Field>
            <Field label="Sous-catégorie">
              <select value={form.subcategoryId} onChange={e => set('subcategoryId', e.target.value)} disabled={!form.categoryId} className={`${inputCls} disabled:opacity-50`}>
                <option value="">Sélectionner...</option>
                {subCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {showNewSubCat ? (
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex gap-2">
                    <input value={newSubCatName} onChange={e => setNewSubCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSubCategory()} className={`${inputCls} flex-1`} placeholder="Sous-cat. (FR)" autoFocus />
                    <input value={newSubCatNameAr} onChange={e => setNewSubCatNameAr(e.target.value)} onKeyDown={e => e.key === 'Enter' && createSubCategory()} className={`${inputCls} flex-1`} placeholder="الاسم (AR)" dir="rtl" />
                    <button onClick={createSubCategory} className="px-3 rounded-lg bg-[#22c55e] text-white text-[12px] font-semibold">OK</button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={!form.categoryId} onClick={() => setShowNewSubCat(true)} className="text-[12px] font-semibold text-[#2563eb] hover:underline mt-1.5 disabled:opacity-40 disabled:no-underline">+ Créer</button>
              )}
            </Field>
          </div>
          <Field label="Tags">
            <ChipInput
              values={form.tags}
              onAdd={v => set('tags', [...form.tags, v])}
              onRemove={i => set('tags', form.tags.filter((_, idx) => idx !== i))}
              placeholder="Tapez un tag et appuyez sur Entrée..."
            />
          </Field>
          <Field label="Marque">
            <BrandDropdown value={form.brand} onChange={v => set('brand', v)} />
          </Field>
        </Section>
        )}

        {/* SECTION 4 — Tarification */}
        <Section title="Tarification">
          <div className="flex gap-4">
            <Field label="Prix de vente (DH) *">
              <input type="number" value={form.basePriceSell} onChange={e => set('basePriceSell', e.target.value)} className={`${inputCls} font-mono`} placeholder="0.00" />
            </Field>
            {isAdmin && (
              <Field label="Prix d'achat (DH)">
                <input type="number" value={form.basePriceCost} onChange={e => set('basePriceCost', e.target.value)} className={`${inputCls} font-mono`} placeholder="0.00" />
              </Field>
            )}
            <Field label="Prix de gros (DH)">
              <input type="number" value={form.basePriceWholesale} onChange={e => set('basePriceWholesale', e.target.value)} className={`${inputCls} font-mono`} placeholder="0.00" />
            </Field>
          </div>
          <Toggle checked={form.promo.enabled} onChange={v => setNested('promo', 'enabled', v)} label="Activer une promotion" />
          {form.promo.enabled && (
            <div className="flex gap-4">
              <Field label="Prix promotionnel (DH)">
                <input type="number" value={form.promo.promoPrice} onChange={e => setNested('promo', 'promoPrice', e.target.value)} className={`${inputCls} font-mono`} placeholder="0.00" />
              </Field>
              <Field label="Date début">
                <input type="date" value={form.promo.startDate || ''} onChange={e => setNested('promo', 'startDate', e.target.value)} className={inputCls} />
              </Field>
              <Field label="Date fin">
                <input type="date" value={form.promo.endDate || ''} onChange={e => setNested('promo', 'endDate', e.target.value)} className={inputCls} />
              </Field>
            </div>
          )}
        </Section>

        {/* SECTION 5 — Stock */}
        {!form.hasVariants && (
          <Section title="Stock">
            <div className="flex gap-4 items-end">
              <Field label="Stock actuel">
                <input type="number" value={form.totalStock} onChange={e => set('totalStock', e.target.value)} className={`${inputCls} font-mono`} placeholder="0" />
              </Field>
              <Field label="Seuil minimum">
                <input type="number" value={form.lowStockThreshold} onChange={e => set('lowStockThreshold', e.target.value)} className={`${inputCls} font-mono`} placeholder="3" />
              </Field>
              <span className={`px-3 py-2 rounded-full text-[12px] font-semibold shrink-0 ${status.cls}`}>{status.label}</span>
            </div>
          </Section>
        )}

        {/* SECTION 5b — Vente en gros */}
        <Section title="Vente en gros">
          <Toggle checked={form.bulkOffersEnabled} onChange={v => set('bulkOffersEnabled', v)} label="Proposer la vente en gros" />
          {form.bulkOffersEnabled && (
            <div className="flex flex-col gap-3">
              {form.bulkOffers.map((lot, idx) => {
                const quantity = parseInt(lot.quantity) || 0;
                const price = parseFloat(lot.price) || 0;
                const unitPrice = quantity > 0 ? price / quantity : 0;
                const baseSell = parseFloat(form.basePriceSell) || 0;
                const savingsPercent = baseSell > 0 && unitPrice > 0 ? Math.max(0, Math.round((1 - unitPrice / baseSell) * 100)) : 0;
                return (
                  <div key={idx} className="flex items-end gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <Dropzone src={lot.image} onFile={f => handleBulkOfferImage(idx, f)} onRemove={() => updateBulkOffer(idx, 'image', '')} />
                    <Field label="Nom du lot">
                      <input value={lot.name} onChange={e => updateBulkOffer(idx, 'name', e.target.value)} className={inputCls} placeholder="Ex: Boîte de 50" />
                    </Field>
                    <Field label="Quantité">
                      <input type="number" value={lot.quantity} onChange={e => updateBulkOffer(idx, 'quantity', e.target.value)} className={`${inputCls} font-mono w-20`} placeholder="50" />
                    </Field>
                    <Field label="Prix du lot (DH)">
                      <input type="number" value={lot.price} onChange={e => updateBulkOffer(idx, 'price', e.target.value)} className={`${inputCls} font-mono w-24`} placeholder="75.00" />
                    </Field>
                    <Field label="Prix unitaire">
                      <div className={`${inputCls} font-mono bg-gray-100 text-gray-500`}>{unitPrice ? `${unitPrice.toFixed(2)} DH` : '—'}</div>
                    </Field>
                    <Field label="Économie">
                      <div className={`${inputCls} font-mono bg-gray-100 text-gray-500`}>{savingsPercent > 0 ? `-${savingsPercent}%` : '—'}</div>
                    </Field>
                    <button type="button" onClick={() => removeBulkOffer(idx)} className="w-9 h-9 rounded-lg border border-gray-200 text-gray-400 hover:text-[#ef4444] hover:border-[#ef4444] flex items-center justify-center shrink-0">
                      <X size={15} />
                    </button>
                  </div>
                );
              })}
              <button type="button" onClick={addBulkOffer} className="self-start flex items-center gap-1 text-[12px] font-semibold text-[#2563eb] hover:underline">
                <Plus size={12} /> Ajouter un lot
              </button>
            </div>
          )}
        </Section>

        {/* SECTION 6 — Variantes */}
        <Section title="Variantes">
          <Toggle checked={form.hasVariants} onChange={v => set('hasVariants', v)} label="Ce produit a des variantes" />
          {form.hasVariants && (
            <>
              <Field label="Types de variante">
                <div className="flex flex-wrap gap-2 items-center">
                  {VARIANT_TYPE_PRESETS.map(t => (
                    <Pill key={t} active={form.variantTypes.includes(t)} onClick={() => toggleVariantType(t)}>{t}</Pill>
                  ))}
                  {form.variantTypes.filter(t => !VARIANT_TYPE_PRESETS.includes(t)).map(t => (
                    <Pill key={t} active onClick={() => toggleVariantType(t)}>{t}</Pill>
                  ))}
                  {showCustomVariantType ? (
                    <div className="flex gap-1.5">
                      <input value={newVariantTypeName} onChange={e => setNewVariantTypeName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustomVariantType()} className="bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-[13px] text-[#1a1a2e] outline-none w-32" placeholder="Nom du type" autoFocus />
                      <button onClick={addCustomVariantType} className="px-2.5 rounded-lg bg-[#22c55e] text-white text-[12px] font-semibold">OK</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setShowCustomVariantType(true)} className="flex items-center gap-1 text-[12px] font-semibold text-[#2563eb] hover:underline"><Plus size={12} /> Type personnalisé</button>
                  )}
                </div>
              </Field>

              {form.variantTypes.map(type => (
                <Field key={type} label={`Options — ${type}`}>
                  <ChipInput
                    values={form.variantOptions[type] || []}
                    onAdd={v => addVariantOption(type, v)}
                    onRemove={i => removeVariantOption(type, i)}
                    placeholder={`Ajouter une option ${type.toLowerCase()}...`}
                  />
                  {type.toLowerCase() === 'couleur' && (form.variantOptions[type] || []).length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      {form.variantOptions[type].map((opt, i) => (
                        <label key={i} className="flex items-center gap-1.5 text-[12px] text-gray-500">
                          {opt}
                          <input type="color" value={form.variantOptionColors[opt] || '#cccccc'} onChange={e => setVariantOptionColor(opt, e.target.value)} className="w-6 h-6 rounded border border-gray-200 cursor-pointer" />
                        </label>
                      ))}
                    </div>
                  )}
                </Field>
              ))}

              {combos.length > 0 && (
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full">
                    <thead>
                      <tr className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        <th className="text-left p-2">Variante</th>
                        <th className="text-left p-2 w-16">Image</th>
                        <th className="text-right p-2">Prix vente</th>
                        {isAdmin && <th className="text-right p-2">Prix achat</th>}
                        <th className="text-right p-2">Stock</th>
                        <th className="text-left p-2">Code-barre</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combos.map(c => {
                        const row = variantRows[c.key] || {};
                        return (
                          <tr key={c.key} className="border-t border-gray-100">
                            <td className="p-2 text-[13px] text-[#1a1a2e] font-medium">{c.key}</td>
                            <td className="p-2">
                              <Dropzone src={row.image} onFile={f => handleVariantImage(c.key, f)} onRemove={() => updateVariantRow(c.key, 'image', '')} />
                            </td>
                            <td className="p-2">
                              <input type="number" value={row.priceSell ?? ''} onChange={e => updateVariantRow(c.key, 'priceSell', e.target.value)} className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-right text-[#1a1a2e] outline-none focus:border-[#F5A623]" placeholder="0.00" />
                            </td>
                            {isAdmin && (
                              <td className="p-2">
                                <input type="number" value={row.priceCost ?? ''} onChange={e => updateVariantRow(c.key, 'priceCost', e.target.value)} className="w-20 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-right text-[#1a1a2e] outline-none focus:border-[#F5A623]" placeholder="0.00" />
                              </td>
                            )}
                            <td className="p-2">
                              <input type="number" value={row.stock ?? ''} onChange={e => updateVariantRow(c.key, 'stock', e.target.value)} className="w-16 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-right text-[#1a1a2e] outline-none focus:border-[#F5A623]" placeholder="0" />
                            </td>
                            <td className="p-2">
                              <input value={row.barcode ?? ''} onChange={e => updateVariantRow(c.key, 'barcode', e.target.value)} className="w-28 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 font-mono text-[12px] text-[#1a1a2e] outline-none focus:border-[#F5A623]" placeholder="Code-barre" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Section>

        {/* SECTION 7 — Manuel scolaire */}
        {form.type === 'manuel' && (
          <Section title="Manuel scolaire">
            <div className="flex gap-4">
              <Field label="Niveau">
                <select
                  value={form.manuelInfo.level}
                  onChange={e => setForm(f => ({ ...f, manuelInfo: { ...f.manuelInfo, level: e.target.value, grade: '' } }))}
                  className={inputCls}
                >
                  <option value="">Sélectionner...</option>
                  {MANUEL_NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
              <Field label="Classe">
                {form.manuelInfo.level === 'Supérieur' ? (
                  <input value={form.manuelInfo.grade} onChange={e => setNested('manuelInfo', 'grade', e.target.value)} className={inputCls} placeholder="Ex: Licence 2 Économie" />
                ) : (
                  <select value={form.manuelInfo.grade} onChange={e => setNested('manuelInfo', 'grade', e.target.value)} disabled={!form.manuelInfo.level} className={`${inputCls} disabled:opacity-50`}>
                    <option value="">Sélectionner...</option>
                    {(MANUEL_CLASSES[form.manuelInfo.level] || []).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                )}
              </Field>
            </div>
            <div className="flex gap-4">
              <Field label="Matière">
                <select value={form.manuelInfo.subject} onChange={e => setNested('manuelInfo', 'subject', e.target.value)} className={inputCls}>
                  <option value="">Sélectionner...</option>
                  {MANUEL_MATIERES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Éditeur">
                <input value={form.manuelInfo.edition} onChange={e => setNested('manuelInfo', 'edition', e.target.value)} className={inputCls} placeholder="Ex: Nadia Edition" />
              </Field>
              <Field label="Année scolaire">
                <input value={form.manuelInfo.year} onChange={e => setNested('manuelInfo', 'year', e.target.value)} className={inputCls} placeholder="2025-2026" />
              </Field>
            </div>
          </Section>
        )}

        {/* SECTION 7b — Livre */}
        {isBookCategory && (
          <Section title="Livre">
            <div className="flex gap-4">
              <Field label="Auteur">
                <input
                  value={form.bookInfo.author}
                  onChange={e => setNested('bookInfo', 'author', e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Paulo Coelho, محمد المخطاري"
                  dir="auto"
                />
              </Field>
              <Field label="Éditeur / Maison d'édition">
                <input
                  value={form.bookInfo.publisher}
                  onChange={e => setNested('bookInfo', 'publisher', e.target.value)}
                  className={inputCls}
                  placeholder="Ex: Dar Al Maarif, Hachette"
                />
              </Field>
            </div>
            <div className="flex gap-4">
              <Field label="Genre(s)">
                <div className="flex flex-col gap-2">
                  {form.bookInfo.genres.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.bookInfo.genres.map(g => (
                        <span key={g} className="inline-flex items-center gap-1 bg-[#eff6ff] text-[#2563eb] text-[12px] font-medium px-2.5 py-1 rounded-full">
                          {g}
                          <button
                            type="button"
                            onClick={() => setNested('bookInfo', 'genres', form.bookInfo.genres.filter(x => x !== g))}
                            className="ml-0.5 hover:text-[#1d4ed8] flex items-center"
                          >
                            <X size={10} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="relative" ref={genreDropdownRef}>
                    <input
                      value={genreSearch}
                      onChange={e => { setGenreSearch(e.target.value); setShowGenreDropdown(true); }}
                      onFocus={() => setShowGenreDropdown(true)}
                      placeholder={bookGenres.length === 0 ? 'Tapez pour créer votre premier genre...' : 'Ajouter ou rechercher un genre...'}
                      className={inputCls}
                    />
                    {showGenreDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-52 overflow-y-auto">
                        {filteredBookGenres.map(g => (
                          <button
                            key={g.fr}
                            type="button"
                            onMouseDown={e => { e.preventDefault(); addGenreChip(g.fr); }}
                            className="w-full text-left px-3 py-2 text-[13px] text-[#1a1a2e] hover:bg-gray-50"
                          >
                            {g.fr}
                          </button>
                        ))}
                        {genreSearch.trim() && !bookGenres.some(g => g.fr.toLowerCase() === genreSearch.trim().toLowerCase()) && (
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); handleCreateAndAddGenre(); }}
                            className="w-full text-left px-3 py-2 text-[13px] text-[#2563eb] font-semibold hover:bg-[#eff6ff] flex items-center gap-1.5 border-t border-gray-100"
                          >
                            <Plus size={12} /> Créer "{genreSearch.trim()}"
                          </button>
                        )}
                        {filteredBookGenres.length === 0 && !genreSearch.trim() && (
                          <div className="px-3 py-2.5 text-[12px] text-gray-400">Tous les genres sont sélectionnés</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Field>
              <Field label="Langue">
                <select value={form.bookInfo.language} onChange={e => setNested('bookInfo', 'language', e.target.value)} className={inputCls}>
                  <option value="">Sélectionner...</option>
                  {BOOK_LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </Field>
              <Field label="Nombre de pages">
                <input
                  type="number"
                  value={form.bookInfo.pages}
                  onChange={e => setNested('bookInfo', 'pages', e.target.value)}
                  className={`${inputCls} font-mono`}
                  placeholder="320"
                />
              </Field>
            </div>
            <Field label="ISBN (optionnel)">
              <input
                value={form.bookInfo.isbn}
                onChange={e => setNested('bookInfo', 'isbn', e.target.value)}
                className={`${inputCls} font-mono`}
                placeholder="978-..."
              />
            </Field>
          </Section>
        )}

        {/* SECTION 8 — Visibilité et mise en avant */}
        <Section title="Visibilité et mise en avant">
          <Field label="Badge">
            <div className="flex gap-2">
              {BADGES.map(b => (
                <Pill key={b.l} active={form.badge === b.v} onClick={() => set('badge', b.v)}>{b.l}</Pill>
              ))}
            </div>
          </Field>
          <Toggle checked={form.isFeatured} onChange={v => set('isFeatured', v)} label="Produit en vedette" />
          <Toggle checked={form.isVisible} onChange={v => set('isVisible', v)} label="Visible sur le site" />
        </Section>

        {/* SECTION 9 — Produits associés */}
        <Section title="Produits associés">
          <Field label="Produits liés">
            <ProductPicker
              allProducts={products}
              excludeId={productId}
              selectedIds={form.relatedProductIds}
              onAdd={pid => set('relatedProductIds', [...form.relatedProductIds, pid])}
              onRemove={pid => set('relatedProductIds', form.relatedProductIds.filter(x => x !== pid))}
              placeholder="Rechercher un produit..."
            />
          </Field>
          <Field label="Souvent achetés ensemble">
            <ProductPicker
              allProducts={products}
              excludeId={productId}
              selectedIds={form.frequentlyBoughtWith}
              onAdd={pid => set('frequentlyBoughtWith', [...form.frequentlyBoughtWith, pid])}
              onRemove={pid => set('frequentlyBoughtWith', form.frequentlyBoughtWith.filter(x => x !== pid))}
              placeholder="Rechercher un produit..."
            />
          </Field>
        </Section>
      </div>
      </div>

      {/* ═══ Bottom bar ═══ */}
      <div className="shrink-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
        {!isEditing && draftSavedFlash && (
          <span className="flex items-center gap-1 text-[12px] text-[#22c55e] font-medium mr-auto">
            <Check size={13} /> Brouillon sauvegardé
          </span>
        )}
        <button onClick={handleCancelClick} className="px-5 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[14px] hover:bg-gray-50 transition-colors">
          Annuler
        </button>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-[14px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? 'Enregistrement...' : 'Sauvegarder'}
        </button>
      </div>

      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCancelConfirm(false)}>
          <div className="bg-white rounded-2xl p-7 w-[380px]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1a1a2e] mb-3">Voulez-vous sauvegarder ce brouillon ?</h3>
            <p className="text-sm text-gray-500 mb-6">Vous pourrez reprendre ce produit la prochaine fois que vous ouvrirez le formulaire d'ajout.</p>
            <div className="flex gap-3">
              <button onClick={() => { localStorage.removeItem(PRODUCT_DRAFT_KEY); setShowCancelConfirm(false); navigate('/produits'); }} className="flex-1 py-2.5 rounded-lg border border-gray-300 text-[#1a1a2e] font-medium text-[13px] hover:bg-gray-50 transition-colors">Non</button>
              <button onClick={() => { setShowCancelConfirm(false); navigate('/produits'); }} className="flex-1 py-2.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-[13px] transition-colors">Oui</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
