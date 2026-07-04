import { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const CategoriesContext = createContext(null);

export function CategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'categories'), orderBy('order'));
    return onSnapshot(q, snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const mainCategories = categories.filter(c => !c.parentId);
  const subCategoriesOf = (parentId) => categories.filter(c => c.parentId === parentId);

  // categoryPath entries and pack item `category` fields are sometimes a Firestore
  // category doc id and sometimes free text (POS quick-add) — resolve to a readable
  // name either way, never let a raw doc id leak into the UI
  const getCategoryName = (idOrName) => {
    if (!idOrName) return '';
    return categories.find(c => c.id === idOrName)?.name || idOrName;
  };

  const addCategory = async (name, parentId = null, nameAr = '') => {
    const ref = doc(collection(db, 'categories'));
    await setDoc(ref, {
      name,
      nameAr: nameAr || '',
      slug: name.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      icon: '',
      image: '',
      parentId: parentId || null,
      order: categories.length,
      isVisible: true,
      productCount: 0,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  };

  const getCategory = (idOrName) => {
    if (!idOrName) return null;
    return categories.find(c => c.id === idOrName || c.name === idOrName) || null;
  };

  return (
    <CategoriesContext.Provider value={{ categories, mainCategories, subCategoriesOf, getCategoryName, getCategory, addCategory, loading }}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  return useContext(CategoriesContext);
}
