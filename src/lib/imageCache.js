// Module-level cache so product images (Firebase Storage URLs) aren't
// re-fetched every time a component using them remounts on navigation.
// Uses plain Image() preloading (not fetch/blob) since the Storage bucket
// has no CORS policy for this origin — fetch() would be blocked.
const cache = new Map(); // url -> true once loaded
const inflight = new Map(); // url -> in-flight Promise<void>

export function isImageCached(url) {
  return !!url && cache.has(url);
}

export function preloadImage(url) {
  if (!url) return Promise.resolve();
  if (cache.has(url)) return Promise.resolve();
  if (inflight.has(url)) return inflight.get(url);

  const promise = new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      cache.set(url, true);
      inflight.delete(url);
      resolve();
    };
    img.onerror = () => {
      inflight.delete(url);
      resolve();
    };
    img.src = url;
  });
  inflight.set(url, promise);
  return promise;
}
