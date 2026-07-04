import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, collection, query, where, limit } from 'firebase/firestore';

export function useProduct(slugOrId) {
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slugOrId) return;
    setLoading(true);
    setNotFound(false);
    setProduct(null);
    setVariants([]);

    let cancelled = false;
    let unsubVariants = null;

    function subscribeToVariants(productId) {
      if (unsubVariants) unsubVariants();
      unsubVariants = onSnapshot(collection(db, 'products', productId, 'variants'), snap => {
        setVariants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    const slugQuery = query(collection(db, 'products'), where('slug', '==', slugOrId), limit(1));
    const unsubProduct = onSnapshot(slugQuery, async snap => {
      if (cancelled) return;

      if (!snap.empty) {
        const found = snap.docs[0];
        setProduct({ id: found.id, ...found.data() });
        setLoading(false);
        subscribeToVariants(found.id);
        return;
      }

      // Fallback for legacy links built from the document id rather than the slug
      try {
        const idSnap = await getDoc(doc(db, 'products', slugOrId));
        if (cancelled) return;
        if (idSnap.exists()) {
          setProduct({ id: idSnap.id, ...idSnap.data() });
          setLoading(false);
          subscribeToVariants(idSnap.id);
        } else {
          setProduct(null);
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
      unsubProduct();
      if (unsubVariants) unsubVariants();
    };
  }, [slugOrId]);

  return { product, variants, loading, notFound };
}
