import { fetchAnimeByIds, fetchAnimeTilesByIds, fetchCatalogPage } from "./shikimori.js";

const CATALOG = "https://anilibria.top/api/v1/anime/catalog/releases";

async function fetchReleases(sorting, publishStatus) {
  const url = new URL(CATALOG);
  url.searchParams.set("limit", "30");
  url.searchParams.set("f[sorting]", sorting);
  if (publishStatus) url.searchParams.set("f[publish_statuses]", publishStatus);
  const response = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`AniLibria HTTP ${response.status}`);
  const payload = await response.json();
  const releases = Array.isArray(payload) ? payload : payload.data;
  return (Array.isArray(releases) ? releases : []).filter(release => release && !release.age_rating?.is_adult);
}

function namesOf(release) {
  return [...new Set([release.name?.main, release.name?.english, ...String(release.name?.alternative || "").split(",")]
    .map(name => String(name || "").trim()).filter(Boolean))];
}

function normalizeName(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]/gu, "");
}

function matchTitle(names, year, candidates) {
  const wanted = new Set(names.map(normalizeName).filter(Boolean));
  const matches = candidates.filter(anime => {
    if (!Number(anime.id)) return false;
    const animeYear = Number(String(anime.aired_on || "").slice(0, 4));
    return (!year || year === animeYear) && [anime.name, anime.russian].some(name => wanted.has(normalizeName(name)));
  });
  return matches.length === 1 ? matches[0] : null;
}

export async function fetchAniLibriaHomeCollections() {
  const [popular, ongoing, recent] = await Promise.allSettled([
    fetchReleases("RATING_DESC"),
    fetchReleases("RATING_DESC", "IS_ONGOING"),
    fetchReleases("FRESH_AT_DESC")
  ]);
  const lists = { popular: popular.value || [], ongoing: ongoing.value || [], recent: recent.value || [] };
  const ids = [...new Set(Object.values(lists).flat().map(release => Number(release.shikimori?.id)).filter(id => Number.isInteger(id) && id > 0))];
  const byId = new Map();
  for (let offset = 0; offset < ids.length; offset += 50) {
    const batch = ids.slice(offset, offset + 50);
    let items;
    try {
      items = await fetchAnimeTilesByIds(batch);
    } catch (error) {
      items = await fetchAnimeByIds(batch, { signal: AbortSignal.timeout(6000) }).catch(() => []);
    }
    items.forEach(item => byId.set(Number(item.id), item));
  }

  const result = { popular: [], ongoing: [], recent: [] };
  const seen = new Set();
  const searched = new Map();
  for (const [key, releases] of Object.entries(lists)) {
    for (const release of releases) {
      let anime = byId.get(Number(release.shikimori?.id));
      if (!anime) {
        const names = namesOf(release);
        for (const query of names) {
          const normalized = normalizeName(query);
          if (normalized.length < 3) continue;
          if (!searched.has(normalized)) {
            if (searched.size >= 8) continue;
            const candidates = await fetchCatalogPage({ query, limit: 20, signal: AbortSignal.timeout(4000) }).catch(() => []);
            searched.set(normalized, candidates);
          }
          anime = matchTitle(names, Number(release.year) || 0, searched.get(normalized));
          if (anime) break;
        }
      }
      if (!anime || seen.has(Number(anime.id))) continue;
      seen.add(Number(anime.id));
      result[key].push(anime);
      if (result[key].length === 15) break;
    }
  }
  if (!seen.size) throw new Error("Не удалось сопоставить релизы AniLibria с Shikimori");
  return result;
}
