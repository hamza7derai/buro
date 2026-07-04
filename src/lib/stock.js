// Status-only stock display for the storefront — never expose exact counts to customers.
export function getStockState(stock, lowStockThreshold = 3) {
  if (stock <= 0) return 'out';
  if (stock <= lowStockThreshold) return 'low';
  return 'ok';
}

export const STOCK_LABELS = {
  ok: 'En stock',
  low: 'Stock faible',
  out: 'Rupture de stock',
};

export const STOCK_DOT_CLASS = {
  ok: 'bg-success',
  low: 'bg-warn',
  out: 'bg-danger',
};

export const STOCK_TEXT_CLASS = {
  ok: 'text-success',
  low: 'text-warn',
  out: 'text-danger',
};
