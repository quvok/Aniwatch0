const normalize = value => String(value || "")
  .toLocaleLowerCase("ru")
  .normalize("NFKC")
  .replace(/[ё]/g, "е")
  .replace(/[\s\p{P}\p{S}]+/gu, " ")
  .trim();

const GENRE_ALIASES = new Map([
  ["action", "экшен"], ["боевик", "экшен"], ["боевые искусства", "экшен"],
  ["adventure", "приключения"],
  ["comedy", "комедия"],
  ["drama", "драма"],
  ["fantasy", "фэнтези"], ["магия", "фэнтези"],
  ["romance", "романтика"], ["любовь", "романтика"],
  ["sci fi", "фантастика"], ["science fiction", "фантастика"], ["научная фантастика", "фантастика"], ["sci-fi", "фантастика"],
  ["mystery", "детектив"], ["мистика", "детектив"],
  ["thriller", "триллер"],
  ["psychological", "психология"], ["психологическое", "психология"],
  ["supernatural", "сверхъестественное"],
  ["slice of life", "повседневность"], ["повседневная жизнь", "повседневность"],
  ["horror", "ужасы"],
  ["sports", "спорт"],
  ["music", "музыка"],
  ["historical", "история"], ["исторический", "история"],
  ["military", "военное"], ["военный", "военное"],
  ["space", "космос"],
  ["demons", "демоны"], ["vampire", "вампиры"],
  ["game", "игры"], ["school", "школа"],
  ["isekai", "исэкай"], ["иcэкай", "исэкай"]
]);

export function normalizeRecommendationGenre(value) {
  const key = normalize(value);
  return GENRE_ALIASES.get(key) || key;
}

export function buildTasteProfile(library) {
  const weights = new Map();
  let usefulSignals = 0;

  for (const anime of library || []) {
    const genres = [...new Set((Array.isArray(anime.genres) ? anime.genres : [])
      .map(normalizeRecommendationGenre).filter(Boolean))];
    if (!genres.length) continue;

    const rating = Math.max(0, Math.min(10, Number(anime.rating) || 0));
    let strength = 0;

    if (rating >= 9) strength += 2.5 + (rating - 9) * 1.5;
    else if (rating >= 7) strength += 0.8 + (rating - 7) * 0.65;
    else if (rating > 0 && rating <= 4) strength -= 2 + (4 - rating) * 0.65;
    else if (rating > 4 && rating <= 5.5) strength -= 0.8;

    if (anime.favorite) strength += 1.8;
    if (anime.status === "completed") strength += 0.45;
    if (anime.status === "watching") strength += 0.3;
    if (anime.status === "planned") strength += 0.05;
    if (Number(anime.watchedCount) > 0) strength += Math.min(0.8, Number(anime.watchedCount) * 0.08);

    if (strength === 0) continue;
    usefulSignals++;
    for (const genre of genres) weights.set(genre, (weights.get(genre) || 0) + strength);
  }

  const topGenres = [...weights.entries()]
    .filter(([, weight]) => weight > 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, weight]) => ({ name, weight }));
  const avoidedGenres = [...weights.entries()]
    .filter(([, weight]) => weight < -0.65)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 6)
    .map(([name, weight]) => ({ name, weight }));

  return {
    topGenres,
    avoidedGenres,
    usefulSignals,
    hasTaste: topGenres.length > 0 || avoidedGenres.length > 0
  };
}

export function rankRecommendations(candidates, profile, excludedIds, limit = 12) {
  const excluded = excludedIds instanceof Set ? excludedIds : new Set(excludedIds || []);
  const ranked = [];
  const seenIds = new Set();
  const seenMal = new Set();

  for (const anime of candidates || []) {
    const id = Number(anime && anime.id);
    const mal = Number(anime && (anime.mal || anime.myanimelist_id)) || 0;
    if (!Number.isInteger(id) || id <= 0 || excluded.has(id) ||
        (mal > 0 && (excluded.has("mal:" + mal) || seenMal.has(mal))) || seenIds.has(id)) continue;

    const genres = [...new Set((anime.genres || anime.g || [])
      .filter(Boolean).map(normalizeRecommendationGenre))];
    if (genres.some(g => ["hentai", "хентай"].includes(g))) continue;

    seenIds.add(id);
    if (mal > 0) seenMal.add(mal);

    const matches = (profile?.topGenres || [])
      .filter(item => genres.includes(normalizeRecommendationGenre(item.name)))
      .sort((a, b) => b.weight - a.weight);
    const avoidedMatches = (profile?.avoidedGenres || [])
      .filter(item => genres.includes(normalizeRecommendationGenre(item.name)));

    const genreScore = matches.reduce((sum, item) => sum + Math.min(5, item.weight) * 22, 0);
    const avoidedPenalty = avoidedMatches.reduce((sum, item) => sum + Math.min(4, Math.abs(item.weight)) * 24, 0);
    const catalogScore = Math.max(0, Math.min(10, Number(anime.score ?? anime.r) || 0)) * 1.2;
    const year = Number(anime.aired_on || anime.y) || 0;
    const recencyScore = year >= new Date().getFullYear() - 1 ? 2 : 0;
    const score = genreScore - avoidedPenalty + catalogScore + recencyScore;

    if (!matches.length || (avoidedMatches.length && avoidedPenalty >= genreScore)) continue;

    ranked.push({
      anime,
      score,
      reason: "Похоже на твой вкус: " + matches.slice(0, 3).map(item => item.name).join(", ") +
        (avoidedMatches.length ? " · учтены низкие оценки жанров" : "")
    });
  }

  return ranked.sort((a, b) => b.score - a.score).slice(0, limit);
}
