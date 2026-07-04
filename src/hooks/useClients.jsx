import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, updateDoc, serverTimestamp, increment
} from 'firebase/firestore';

export function useClients() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'clients'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const addClient = async ({ name, phone, ice, type, address, notes, email }) => {
    const ref = doc(collection(db, 'clients'));
    await setDoc(ref, {
      name: name || '',
      phone: phone || '',
      ice: ice || '',
      type: type || 'retail',
      email: email || '',
      firstName: '',
      lastName: '',
      address: address || '',
      totalSpent: 0,
      totalOrders: 0,
      averageBasket: 0,
      lastPurchaseAt: null,
      creditBalance: 0,
      debtBalance: 0,
      notes: notes || '',
      tags: [],
      currentYearPurchases: new Date().getFullYear() + '',
      invoicePreference: 'per_sale',
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const updateClient = async (id, data) => {
    await updateDoc(doc(db, 'clients', id), { ...data });
  };

  // Update client stats after a sale
  const recordClientSale = async (clientId, total) => {
    if (!clientId) return;
    const ref = doc(db, 'clients', clientId);
    await updateDoc(ref, {
      totalSpent: increment(total),
      totalOrders: increment(1),
      lastPurchaseAt: serverTimestamp(),
    });
  };

  return { clients, loading, addClient, updateClient, recordClientSale };
}
