// Central filter for explicitly adult Shikimori genres.
// Keep same-sex romance genres separate: Yaoi/Yuri are not inherently 18+.
const ADULT_GENRE_IDS = new Set(["9","12","51","59","539","540"]);
const ADULT_GENRE_NAMES = new Set([
  "ecchi","этти","хентай","hentai","erotica","эротика",
  "adult","18","для взрослых","порнография","pornography"
]);
const normalize = value => String(value || "")
  .toLocaleLowerCase("ru")
  .normalize("NFKC")
  .replace(/[ё]/g,"е")
  .replace(/[\s\p{P}\p{S}]+/gu,"")
  .trim();

export function isAdultGenre(genre) {
  if (genre && typeof genre === "object") {
    const id = String(genre.id || "").trim();
    if (ADULT_GENRE_IDS.has(id)) return true;
    return [genre.russian, genre.name].some(value => ADULT_GENRE_NAMES.has(normalize(value)));
  }
  const value = String(genre || "").trim();
  return ADULT_GENRE_IDS.has(value) || ADULT_GENRE_NAMES.has(normalize(value));
}

export function filterAdultGenres(genres) {
  return (Array.isArray(genres) ? genres : []).filter(genre => !isAdultGenre(genre));
}

export function isAdultAnime(anime) {
  if (!anime || typeof anime !== "object") return false;
  if (String(anime.rating || "").toLowerCase() === "rx") return true;
  return (Array.isArray(anime.genres) ? anime.genres : Array.isArray(anime.g) ? anime.g : []).some(isAdultGenre);
}
