import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name'));
    return onSnapshot(q, snap => {
      setSuppliers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const addSupplier = async ({ name, phone = '', email = '', address = '', notes = '' }) => {
    const ref = doc(collection(db, 'suppliers'));
    await setDoc(ref, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      address: address.trim(),
      notes: notes.trim(),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  return { suppliers, addSupplier, loading };
}
