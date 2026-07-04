import { useState, useEffect } from 'react';
import { db } from '../firebase';
import {
  collection, query, orderBy, onSnapshot,
  doc, setDoc, deleteDoc, writeBatch, serverTimestamp, increment,
} from 'firebase/firestore';

export function usePurchaseOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'purchaseOrders'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  // Format: BC-YYYY-MM-DD-NNN, sequenced per day from already-loaded orders
  function generateOrderNumber() {
    const today = new Date();
    const prefix = `BC-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-`;
    const todayCount = orders.filter(o => o.orderNumber?.startsWith(prefix)).length;
    return prefix + String(todayCount + 1).padStart(3, '0');
  }

  const createPurchaseOrder = async (orderId, data) => {
    await setDoc(doc(db, 'purchaseOrders', orderId), data);
  };

  const updatePurchaseOrder = async (orderId, data) => {
    await setDoc(doc(db, 'purchaseOrders', orderId), data, { merge: true });
  };

  const deletePurchaseOrder = async (orderId) => {
    await deleteDoc(doc(db, 'purchaseOrders', orderId));
  };

  // Adds the received quantity to stock for each existing-product line, marks the
  // order "reçue". receivedQtyArray is parallel to order.items (same index order).
  const receivePurchaseOrder = async (order, receivedQtyArray) => {
    const batch = writeBatch(db);
    let updatedCount = 0;

    const items = order.items.map((item, i) => {
      const receivedQty = Number(receivedQtyArray[i]) || 0;
      if (item.productId && receivedQty > 0) {
        batch.update(doc(db, 'products', item.productId), {
          totalStock: increment(receivedQty),
          isOutOfStock: false,
          updatedAt: serverTimestamp(),
        });
        updatedCount++;
      }
      return { ...item, quantityReceived: receivedQty };
    });

    batch.update(doc(db, 'purchaseOrders', order.id), {
      status: 'reçue',
      receivedAt: serverTimestamp(),
      items,
    });

    await batch.commit();
    return updatedCount;
  };

  return {
    orders, loading, generateOrderNumber,
    createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, receivePurchaseOrder,
  };
}
