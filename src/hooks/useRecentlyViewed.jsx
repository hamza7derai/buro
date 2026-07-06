import { useState, useCallback } from 'react';

const STORAGE_KEY = 'younasser_recently_viewed';
const MAX_ITEMS = 10;

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useRecentlyViewed() {
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(load);

  const addRecentlyViewed = useCallback((id) => {
    setRecentlyViewedIds(prev => {
      const next = [id, ...prev.filter(x => x !== id)].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { recentlyViewedIds, addRecentlyViewed };
}
