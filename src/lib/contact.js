export const WHATSAPP_NUMBER = '212706447525';

// TODO: replace with the real younasser store address
export const STORE_ADDRESS = 'Avenue Mohammed V, Marrakech';

export function buildWhatsAppLink(message = '') {
  const text = message ? `?text=${encodeURIComponent(message)}` : '';
  return `https://wa.me/${WHATSAPP_NUMBER}${text}`;
}
