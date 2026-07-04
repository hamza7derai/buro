function toMillis(value) {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toMillis === 'function') return value.toMillis();
  return new Date(value).getTime();
}

export function isPromoActive(promo) {
  if (!promo?.enabled || !promo.promoPrice) return false;
  const now = Date.now();
  const start = toMillis(promo.startDate);
  const end = toMillis(promo.endDate);
  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

// Returns the price to charge/display and the crossed-out old price (or null)
export function getPrice(product, variant = null) {
  const basePrice = variant?.priceSell ?? product?.basePriceSell ?? 0;
  if (!variant && isPromoActive(product?.promo) && product.promo.promoPrice < basePrice) {
    return { price: product.promo.promoPrice, oldPrice: basePrice };
  }
  return { price: basePrice, oldPrice: null };
}

// Always shows 2 decimal places with a comma separator, e.g. formatPrice(986.8) -> "986,80 DH"
export function formatPrice(amount) {
  return `${(Math.round((Number(amount) || 0) * 100) / 100).toFixed(2).replace('.', ',')} DH`;
}
