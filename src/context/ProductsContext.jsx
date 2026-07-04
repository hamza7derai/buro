import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, collectionGroup, query, orderBy, onSnapshot,
  doc, setDoc, updateDoc, serverTimestamp,
  getDocs, writeBatch, increment
} from 'firebase/firestore';

const ProductsContext = createContext(null);

export function ProductsProvider({ children }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Variants are never loaded with the product list (that's the N+1 query this
  // context exists to avoid) — they're fetched on demand and cached here so a
  // product's variants are only ever fetched once per session.
  const [variantsByProduct, setVariantsByProduct] = useState({});
  const pendingVariantFetches = useRef({});

  // Flat index of every variant's barcode, kept live via a single collectionGroup
  // listener — needed so POS barcode scanning can match variant barcodes (exact
  // and partial/suffix) without a per-scan round trip.
  const [variantBarcodeIndex, setVariantBarcodeIndex] = useState([]);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setProducts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = collectionGroup(db, 'variants');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVariantBarcodeIndex(snapshot.docs.map(d => ({
        id: d.id,
        productId: d.ref.parent.parent.id,
        ...d.data(),
      })));
    });
    return unsubscribe;
  }, []);

  // Fetch (and cache) the variants subcollection for one product. Safe to call
  // repeatedly — concurrent/duplicate calls share the same in-flight request.
  const fetchVariants = useCallback(async (productId) => {
    if (variantsByProduct[productId]) return variantsByProduct[productId];
    if (pendingVariantFetches.current[productId]) return pendingVariantFetches.current[productId];

    const promise = getDocs(collection(db, 'products', productId, 'variants')).then(snap => {
      const variants = snap.docs.map(v => ({ id: v.id, ...v.data() }));
      setVariantsByProduct(prev => ({ ...prev, [productId]: variants }));
      delete pendingVariantFetches.current[productId];
      return variants;
    });
    pendingVariantFetches.current[productId] = promise;
    return promise;
  }, [variantsByProduct]);

  // Flat searchable list for POS: one row per simple product, one row per
  // hasVariants product (variant choice happens on demand when adding to cart).
  const searchableItems = useMemo(() => {
    const items = [];
    products.forEach(p => {
      if (p.isVisible === false) return;
      items.push({
        productId: p.id,
        variantId: null,
        name: p.name,
        variantLabel: '',
        barcode: p.barcode || '',
        sku: p.sku || '',
        priceSell: p.basePriceSell || 0,
        priceCost: p.basePriceCost || 0,
        stock: p.totalStock ?? 0,
        minStock: p.lowStockThreshold ?? 3,
        image: p.mainImage || '',
        famille: p.categoryPath?.[0] || p.famille || '',
        brand: p.brand || '',
        tags: p.tags || [],
        isManuel: p.isManuel || false,
        hasVariants: p.hasVariants || false,
        product: p,
        variant: null,
      });
    });
    return items;
  }, [products]);

  // Add a product (simple, no variants) — used from POS quick-add
  const addProductSimple = async ({ name, barcode, priceSell, priceCost, stock, famille }) => {
    const prodRef = doc(collection(db, 'products'));
    const productData = {
      name,
      barcode: barcode || '',
      sku: '',
      slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      description: '',
      shortDescription: '',
      mainImage: '',
      gallery: [],
      categoryPath: famille ? [famille] : [],
      famille: famille || '',
      tags: [],
      brand: '',
      type: 'standard',
      isManuel: false,
      isPack: false,
      manuelInfo: null,
      basePriceSell: priceSell || 0,
      basePriceCost: priceCost || 0,
      basePriceWholesale: 0,
      variantPricingEnabled: false,
      hasVariants: false,
      variantTypes: [],
      variantOptions: {},
      totalStock: stock || 0,
      lowStockThreshold: 3,
      status: 'active',
      isVisible: true,
      isOutOfStock: (stock || 0) <= 0,
      isFeatured: false,
      badge: null,
      relatedProductIds: [],
      frequentlyBoughtWith: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(prodRef, productData);
    return prodRef.id;
  };

  // Update a product
  const updateProduct = async (productId, data) => {
    const ref = doc(db, 'products', productId);
    await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
  };

  // Create a product with a pre-generated id (used by the full ProductForm,
  // since Storage uploads need the id before the doc exists)
  const createProductFull = async (productId, data) => {
    await setDoc(doc(db, 'products', productId), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  // Full overwrite-merge update (used by the full ProductForm)
  const updateProductFull = async (productId, data) => {
    await setDoc(doc(db, 'products', productId), {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  // Save variant rows for a product, deleting any whose option combination was removed
  const saveVariants = async (productId, variants, idsToDelete = []) => {
    const batch = writeBatch(db);
    idsToDelete.forEach(id => batch.delete(doc(db, 'products', productId, 'variants', id)));
    const activePrices = [];
    for (const v of variants) {
      const ref = v.id
        ? doc(db, 'products', productId, 'variants', v.id)
        : doc(collection(db, 'products', productId, 'variants'));
      const priceSell = Number(v.priceSell) || 0;
      activePrices.push(priceSell);
      batch.set(ref, {
        options: v.options,
        label: v.label,
        image: v.image || '',
        priceSell,
        priceCost: v.priceCost || 0,
        stock: v.stock || 0,
        minStock: v.minStock ?? 3,
        barcode: v.barcode || '',
        sku: v.sku || '',
        isActive: true,
        updatedAt: serverTimestamp(),
      });
    }
    if (activePrices.length > 0) {
      const minPrice = Math.min(...activePrices);
      const maxPrice = Math.max(...activePrices);
      batch.update(doc(db, 'products', productId), {
        variantMinPrice: minPrice,
        variantPricesVary: minPrice !== maxPrice,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
    setVariantsByProduct(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  // Deduct stock after sale (uses batch for atomicity)
  const deductStock = async (cartItems) => {
    const batch = writeBatch(db);

    // Aggregate quantity sold per product/variant — a cart can hold multiple
    // lines for the same product (e.g. two variants), so each ref must only
    // be batch.update()'d once with the combined deduction.
    const productDeductions = new Map();
    const variantDeductions = new Map();

    for (const item of cartItems) {
      const pEntry = productDeductions.get(item.productId) || {
        totalStock: item.product?.totalStock ?? item.stock ?? 0,
        qty: 0,
      };
      pEntry.qty += item.qty;
      productDeductions.set(item.productId, pEntry);

      if (item.variantId) {
        const vKey = `${item.productId}/${item.variantId}`;
        const vEntry = variantDeductions.get(vKey) || {
          productId: item.productId,
          variantId: item.variantId,
          stock: item.stock ?? 0,
          qty: 0,
        };
        vEntry.qty += item.qty;
        variantDeductions.set(vKey, vEntry);
      }
    }

    for (const [productId, { totalStock, qty }] of productDeductions) {
      const newTotal = Math.max(0, totalStock - qty);
      batch.update(doc(db, 'products', productId), {
        totalStock: newTotal,
        isOutOfStock: newTotal <= 0,
        totalSold: increment(qty),
        updatedAt: serverTimestamp(),
      });
    }

    for (const { productId, variantId, stock, qty } of variantDeductions.values()) {
      batch.update(doc(db, 'products', productId, 'variants', variantId), {
        stock: Math.max(0, stock - qty),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();
  };

  const value = {
    products, searchableItems, loading, addProductSimple, updateProduct, deductStock,
    createProductFull, updateProductFull, saveVariants,
    fetchVariants, variantBarcodeIndex, variantsByProduct,
  };

  return (
    <ProductsContext.Provider value={value}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  return useContext(ProductsContext);
}
