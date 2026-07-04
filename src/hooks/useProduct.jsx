import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, collection } from 'firebase/firestore';

export function useProduct(id) {
  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setNotFound(false);

    const unsubProduct = onSnapshot(doc(db, 'products', id), snap => {
      if (!snap.exists()) {
        setProduct(null);
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProduct({ id: snap.id, ...snap.data() });
      setLoading(false);
    });

    const unsubVariants = onSnapshot(collection(db, 'products', id, 'variants'), snap => {
      setVariants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubProduct(); unsubVariants(); };
  }, [id]);

  return { product, variants, loading, notFound };
}
