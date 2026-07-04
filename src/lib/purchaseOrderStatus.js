export const PO_STATUS_META = {
  brouillon: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
  'envoyée': { label: 'Envoyée', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  'reçue': { label: 'Reçue', cls: 'bg-green-50 text-green-600 border-green-200' },
  'annulée': { label: 'Annulée', cls: 'bg-red-50 text-red-600 border-red-200' },
};

export function poStatusMeta(status) {
  return PO_STATUS_META[status] || PO_STATUS_META.brouillon;
}
