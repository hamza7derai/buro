import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, getDocs, writeBatch, serverTimestamp,
} from 'firebase/firestore';

export function usePacks() {
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'packs'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setPacks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const createPack = async (packId, data) => {
    await setDoc(doc(db, 'packs', packId), {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const updatePack = async (packId, data) => {
    await setDoc(doc(db, 'packs', packId), {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  };

  const savePackItems = async (packId, items, idsToDelete = []) => {
    const batch = writeBatch(db);
    idsToDelete.forEach(id => batch.delete(doc(db, 'packs', packId, 'packItems', id)));
    items.forEach((item, index) => {
      const ref = item.id
        ? doc(db, 'packs', packId, 'packItems', item.id)
        : doc(collection(db, 'packs', packId, 'packItems'));
      batch.set(ref, {
        productId: item.productId || null,
        variantId: item.variantId || null,
        name: item.name || '',
        variantLabel: item.variantLabel || '',
        image: item.image || '',
        barcode: item.barcode || '',
        category: item.category || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        isRequired: item.isRequired !== false,
        isRemovable: item.isRemovable === true,
        order: index,
      });
    });
    await batch.commit();
  };

  const deletePack = async (packId) => {
    const itemsSnap = await getDocs(collection(db, 'packs', packId, 'packItems'));
    const batch = writeBatch(db);
    itemsSnap.forEach(d => batch.delete(d.ref));
    batch.delete(doc(db, 'packs', packId));
    await batch.commit();
  };

  const duplicatePack = async (pack) => {
    const itemsSnap = await getDocs(collection(db, 'packs', pack.id, 'packItems'));
    const newRef = doc(collection(db, 'packs'));
    const { id, createdAt, updatedAt, ...rest } = pack;
    await setDoc(newRef, {
      ...rest,
      name: pack.name + ' (copie)',
      status: 'draft',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    const batch = writeBatch(db);
    itemsSnap.forEach(d => {
      batch.set(doc(collection(db, 'packs', newRef.id, 'packItems')), d.data());
    });
    await batch.commit();
    return newRef.id;
  };

  return { packs, loading, createPack, updatePack, savePackItems, deletePack, duplicatePack };
}
