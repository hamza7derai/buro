import { useState, useEffect, useMemo } from 'react';
import { isImageCached, preloadImage } from '../lib/imageCache';

// Drop-in replacement for <img> that remembers which product image URLs
// have already loaded this session, so navigating away and back to the
// same image renders it eagerly instead of waiting on lazy-load again.
export default function CachedImage({ src, alt = '', loading = 'lazy', ...props }) {
  const [, bump] = useState(0);
  const cached = useMemo(() => isImageCached(src), [src]);

  useEffect(() => {
    if (!src || isImageCached(src)) return;
    let cancelled = false;
    preloadImage(src).then(() => {
      if (!cancelled) bump(n => n + 1);
    });
    return () => { cancelled = true; };
  }, [src]);

  if (!src) return null;
  return <img src={src} alt={alt} loading={cached ? 'eager' : loading} {...props} />;
}
