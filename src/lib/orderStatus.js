export const ORDER_STATUS_META = {
  pending: { label: 'En attente', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  confirmed: { label: 'Confirmée', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  preparing: { label: 'En préparation', cls: 'bg-purple-50 text-purple-600 border-purple-200' },
  shipping: { label: 'En livraison', cls: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  delivered: { label: 'Livrée', cls: 'bg-green-50 text-green-600 border-green-200' },
  cancelled: { label: 'Annulée', cls: 'bg-red-50 text-red-600 border-red-200' },
};

export const ORDER_STATUS_OPTIONS = Object.keys(ORDER_STATUS_META);

// Ordered pipeline (excludes cancelled) — used to render progress timelines
export const ORDER_STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered'];

export function statusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status || 'En attente', cls: 'bg-gray-50 text-gray-500 border-gray-200' };
}
