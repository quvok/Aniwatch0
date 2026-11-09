const normalize = value => String(value || "")
  .toLocaleLowerCase("ru")
  .replace(/[ё]/g, "е")
  .replace(/[\s\p{P}\p{S}]+/gu, " ")
  .trim();

export function buildTasteProfile(library) {
  const weights = new Map();
  let usefulSignals = 0;

  for (const anime of library || []) {
    const genres = Array.isArray(anime.genres) ? anime.genres : [];
    if (!genres.length) continue;

    const rating = Number(anime.rating) || 0;
    let strength = 0;
    if (rating >= 8) strength += 1 + (rating - 8) * 1.25;
    else if (rating > 0 && rating <= 5) strength -= 1.5 + (5 - rating) * 0.7;
    if (anime.favorite) strength += 0.8;
    if (anime.status === "completed") strength += 0.35;
    if (anime.status === "watching") strength += 0.2;
    if (Number(anime.watchedCount) > 0) strength += Math.min(0.5, Number(anime.watchedCount) * 0.04);

    if (strength === 0) continue;
    usefulSignals++;
    for (const genre of genres) {
      const key = normalize(genre);
      if (!key) continue;
      weights.set(key, (weights.get(key) || 0) + strength);
    }
  }

  const topGenres = [...weights.entries()]
    .filter(([, weight]) => weight > 0.15)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, weight]) => ({ name, weight }));

  return { topGenres, usefulSignals, hasTaste: topGenres.length > 0 };
}

export function rankRecommendations(candidates, profile, excludedIds, limit = 12) {
  const excluded = excludedIds instanceof Set ? excludedIds : new Set(excludedIds || []);
  const ranked = [];
  const seen = new Set();

  for (const anime of candidates || []) {
    const id = Number(anime && anime.id);
    if (!Number.isInteger(id) || id <= 0 || excluded.has(id) || seen.has(id)) continue;
    seen.add(id);

    const genres = (anime.genres || anime.g || []).filter(Boolean);
    const normalizedGenres = genres.map(normalize);
    if (normalizedGenres.some(g => g === "hentai" || g === "хентай")) continue;

    const matches = (profile?.topGenres || [])
      .filter(item => normalizedGenres.includes(item.name))
      .sort((a, b) => b.weight - a.weight);
    const genreScore = matches.reduce((sum, item) => sum + Math.min(4, item.weight) * 18, 0);
    const catalogScore = Math.max(0, Math.min(10, Number(anime.score ?? anime.r) || 0)) * 1.5;
    const recencyScore = Number(anime.aired_on || anime.y) >= new Date().getFullYear() - 1 ? 2 : 0;
    const score = genreScore + catalogScore + recencyScore;

    const reason = matches.length
      ? "Похоже на твой вкус: " + matches.slice(0, 2).map(item => item.name).join(", ")
      : profile?.hasTaste
        ? "Популярный тайтл с высоким рейтингом"
        : "Популярный выбор зрителей — пока собираем твои предпочтения";

    ranked.push({ anime, score, reason });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}
