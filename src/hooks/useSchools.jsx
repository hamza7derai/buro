import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function useSchools() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'schools'), orderBy('name'));
    return onSnapshot(q, snap => {
      setSchools(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const addSchool = async (name) => {
    const ref = doc(collection(db, 'schools'));
    await setDoc(ref, {
      name,
      slug: name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  return { schools, addSchool, loading };
}
