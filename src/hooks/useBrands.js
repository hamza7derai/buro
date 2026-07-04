import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export function useBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const seedingRef = useRef(false);

  useEffect(() => {
    const ref = doc(db, 'settings', 'brands');
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        if (!seedingRef.current) {
          seedingRef.current = true;
          await setDoc(ref, { brands: [] });
        }
      } else {
        setBrands(snap.data().brands || []);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function addBrand(name) {
    const trimmed = name?.trim();
    if (!trimmed) return;
    await updateDoc(doc(db, 'settings', 'brands'), { brands: arrayUnion(trimmed) });
  }

  return { brands, loading, addBrand };
}
