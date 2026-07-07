// Simple cutoff-based delivery estimate — no courier/route calculation.
const CUTOFF_HOUR = 15;

function isBeforeCutoff() {
  return new Date().getHours() < CUTOFF_HOUR;
}

export function getDeliveryCardLabel() {
  return isBeforeCutoff() ? "🛵 Livré aujourd'hui" : '🛵 Livré demain';
}

export function getDeliveryDetailMessage() {
  return isBeforeCutoff()
    ? "🛵 Commandez avant 15h, livré aujourd'hui à Marrakech"
    : '🛵 Commandez maintenant, livré demain';
}

export function getDeliveryEstimateWord() {
  return isBeforeCutoff() ? "aujourd'hui" : 'demain';
}
