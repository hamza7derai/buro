// Legacy list — genres are now stored in Firebase /settings/bookGenres
export const BOOK_GENRES = [
  'Roman', 'Développement personnel', 'Religion', 'Histoire',
  'Science', 'Poésie', 'Enfants', 'Éducatif', 'Cuisine', 'Autre',
];

export const BOOK_LANGUAGES = ['Arabe', 'Français', 'Anglais', 'Bilingue'];

export const LIVRES_CATEGORY_SLUG = 'livres';

export function isBookCategoryName(name) {
  return (name || '').toLowerCase().includes('livre');
}

// Returns the filter key for a genre (works for both legacy string and new {fr,ar} object)
export function genreKey(genre) {
  if (!genre) return '';
  if (typeof genre === 'string') return genre;
  return genre.fr || '';
}

// Returns display label for a genre
// showBilingual=true → "Roman · رواية", false → "Roman"
export function genreLabel(genre, showBilingual = false) {
  if (!genre) return '';
  if (typeof genre === 'string') return genre;
  if (showBilingual && genre.ar) return `${genre.fr} · ${genre.ar}`;
  return genre.fr || genre.ar || '';
}
