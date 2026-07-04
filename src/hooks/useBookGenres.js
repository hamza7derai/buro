import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

export function useBookGenres() {
  const [genres, setGenres] = useState([]);
  const [loading, setLoading] = useState(true);
  const seedingRef = useRef(false);

  useEffect(() => {
    const ref = doc(db, 'settings', 'bookGenres');
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) {
        if (!seedingRef.current) {
          seedingRef.current = true;
          await setDoc(ref, { genres: [] });
        }
      } else {
        setGenres(snap.data().genres || []);
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  async function addGenre({ fr, ar }) {
    if (!fr?.trim()) return;
    const genre = { fr: fr.trim(), ar: (ar || '').trim() };
    await updateDoc(doc(db, 'settings', 'bookGenres'), { genres: arrayUnion(genre) });
  }

  return { genres, loading, addGenre };
}
