import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
  getDocs, writeBatch
} from 'firebase/firestore';

export function useProducts() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time listener on products collection
    const q = query(collection(db, 'products'), orderBy('name'));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const prods = [];
      for (const docSnap of snapshot.docs) {
        const product = { id: docSnap.id, ...docSnap.data() };

        // Load variants subcollection
        const varSnap = await getDocs(collection(db, 'products', docSnap.id, 'variants'));
        product.variants = varSnap.docs.map(v => ({ id: v.id, ...v.data() }));

        prods.push(product);
      }
      setProducts(prods);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Build a flat searchable list: each item = product or product+variant
  const searchableItems = [];
  products.forEach(p => {
    if (p.hasVariants && p.variants.length > 0) {
      p.variants.forEach(v => {
        searchableItems.push({
          productId: p.id,
          variantId: v.id,
          name: p.name,
          variantLabel: v.label || Object.values(v.options || {}).join(' / '),
          barcode: v.barcode || p.barcode,
          sku: v.sku || p.sku,
          priceSell: v.priceSell ?? p.basePriceSell,
          priceCost: v.priceCost ?? p.basePriceCost,
          stock: v.stock ?? 0,
          minStock: v.minStock ?? p.lowStockThreshold ?? 3,
          image: v.image || p.mainImage,
          famille: p.categoryPath?.[0] || p.famille || '',
          product: p,
          variant: v,
        });
      });
    } else {
      searchableItems.push({
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
        product: p,
        variant: null,
      });
    }
  });

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

  // Deduct stock after sale (uses batch for atomicity)
  const deductStock = async (cartItems) => {
    const batch = writeBatch(db);
    for (const item of cartItems) {
      if (item.variantId) {
        const vRef = doc(db, 'products', item.productId, 'variants', item.variantId);
        batch.update(vRef, {
          stock: Math.max(0, (item.stock || 0) - item.qty),
          updatedAt: serverTimestamp(),
        });
      }
      // Update product totalStock
      const pRef = doc(db, 'products', item.productId);
      const newTotal = Math.max(0, (item.product?.totalStock || item.stock || 0) - item.qty);
      batch.update(pRef, {
        totalStock: newTotal,
        isOutOfStock: newTotal <= 0,
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();
  };

  return { products, searchableItems, loading, addProductSimple, updateProduct, deductStock };
}
