import { useState, useEffect, useRef } from 'react';

// Keeps the skeleton visible for at least `minMs` after loading starts, even
// if the real data resolves sooner, so fast Firestore reads don't flash.
export function useMinLoadingTime(loading, minMs = 700) {
  const [showSkeleton, setShowSkeleton] = useState(loading);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (loading) {
      startRef.current = Date.now();
      setShowSkeleton(true);
      return;
    }
    const remaining = Math.max(0, minMs - (Date.now() - startRef.current));
    const timer = setTimeout(() => setShowSkeleton(false), remaining);
    return () => clearTimeout(timer);
  }, [loading, minMs]);

  return showSkeleton;
}
