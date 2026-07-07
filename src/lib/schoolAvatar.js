const AVATAR_COLORS = ['#2563eb', '#1e3a5f', '#F5A623', '#22c55e', '#ef4444', '#7c3aed'];

export function schoolInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');
}

export function schoolAvatarColor(name) {
  const str = name || '';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function schoolImage(school, packs = []) {
  if (school.image || school.logo) return school.image || school.logo;
  const packWithImage = packs.find(p => p.schoolId === school.id && p.mainImage);
  return packWithImage?.mainImage || null;
}
