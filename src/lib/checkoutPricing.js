export const DELIVERY_FEE = 15;

export function getDeliveryFee(_subtotal, method = 'home') {
  return method === 'pickup' ? 0 : DELIVERY_FEE;
}

// Promo codes — not yet active in the storefront (UI shows "coming soon")
export const DISCOUNT_CODES = {};
