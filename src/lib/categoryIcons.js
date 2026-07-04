import { PencilRuler, Printer, BookOpen, Backpack, Gamepad2, Package } from 'lucide-react';

const ICONS_BY_KEYWORD = [
  { match: /fourniture/i, icon: PencilRuler, image: 'images/icons/fournitures.png', color: '#2563eb', description: 'Stylos, cahiers et tout pour la classe' },
  { match: /bureau|impression/i, icon: Printer, image: 'images/icons/bureau.png', color: '#F5A623', description: 'Papier, encre et matériel de bureau' },
  { match: /livre|culture|manuel/i, icon: BookOpen, image: 'images/icons/livres.png', color: '#22c55e', description: 'Romans, BD et lecture pour tous les âges' },
  { match: /sac|accessoire/i, icon: Backpack, image: 'images/icons/sacs.png', color: '#a855f7', description: 'Sacs à dos, trousses et accessoires' },
  { match: /jeu|electronique|électronique/i, icon: Gamepad2, image: 'images/icons/jeux.png', color: '#ef4444', description: 'Jouets, jeux et gadgets électroniques' },
];

export function getCategoryIcon(name = '') {
  const found = ICONS_BY_KEYWORD.find(({ match }) => match.test(name));
  return found || { icon: Package, image: null, color: '#6b7280', description: 'Découvrez notre sélection' };
}

export function getCategoryDescription(name = '') {
  return getCategoryIcon(name).description;
}

// Emoji (fallback) + 3D icon image + subtle background tint used on the Categories grid and detail header
const CARD_VISUALS = [
  { match: /fourniture/i, emoji: '🎒', image: 'images/icons/fournitures.png', bg: '#EFF6FF', circle: '#DBEAFE' },
  { match: /bureau|impression/i, emoji: '🖨️', image: 'images/icons/bureau.png', bg: '#FFF7ED', circle: '#FFEDD5' },
  { match: /livre|culture|manuel/i, emoji: '📚', image: 'images/icons/livres.png', bg: '#F0FDF4', circle: '#DCFCE7' },
  { match: /sac|accessoire/i, emoji: '👜', image: 'images/icons/sacs.png', bg: '#FDF2F8', circle: '#FCE7F3' },
  { match: /jeu|electronique|électronique/i, emoji: '🎮', image: 'images/icons/jeux.png', bg: '#FAF5FF', circle: '#F3E8FF' },
];

export function getCategoryVisual(name = '') {
  const found = CARD_VISUALS.find(({ match }) => match.test(name));
  return found || { emoji: '📦', image: null, bg: '#F8F9FC', circle: '#EEF0F5' };
}

// categoryPath[0] is sometimes a category doc id (full admin form) and
// sometimes a free-text name (POS quick-add) — resolve to a readable label either way
export function resolveCategoryLabel(categories, rawValue) {
  if (!rawValue) return '';
  return categories.find(c => c.id === rawValue)?.name || rawValue;
}

// Shown on Home/Categories when no categories exist yet in Firestore
export const DEFAULT_CATEGORIES = [
  { name: 'Fournitures scolaires', slug: 'fournitures-scolaires' },
  { name: 'Bureau & Impression', slug: 'bureau-impression' },
  { name: 'Livres & Culture', slug: 'livres-culture' },
  { name: 'Sacs & Accessoires', slug: 'sacs-accessoires' },
  { name: 'Jeux & Électronique', slug: 'jeux-electronique' },
];
