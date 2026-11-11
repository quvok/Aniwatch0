// Import of a public anime list from Shikimori or AniList.
//
// Both services expose public lists without OAuth, so the import can stay a
// client-side fetch. The merge is deliberately conservative: an existing local
// status/rating wins unless the user explicitly opts into overwriting it.
const SHIKIMORI_API = "https://shikimori.io/api";
const ANILIST_API = "https://graphql.anilist.co";
const SHIKIMORI_ID_OFFSET = 1_000_000_000;
const MAX_ENTRIES = 5000;

const SHIKIMORI_STATUS = {
  planned: "planned",
  watching: "watching",
  rewatching: "watching",
  completed: "completed",
  dropped: "dropped",
  on_hold: "planned"
};

const ANILIST_STATUS = {
  CURRENT: "watching",
  REPEATING: "watching",
  PLANNING: "planned",
  COMPLETED: "completed",
  DROPPED: "dropped",
  PAUSED: "planned"
};

export const IMPORT_SOURCES = [
  { value: "shikimori", label: "Shikimori" },
  { value: "anilist", label: "AniList" }
];

export function shikimoriInternalId(shikimoriId) {
  const id = Number(shikimoriId);
  return Number.isSafeInteger(id) && id > 0 ? SHIKIMORI_ID_OFFSET + id : 0;
}

// Accepts a bare nickname or a pasted profile URL.
export function normalizeUsername(value) {
  let text = String(value || "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) {
    try {
      const url = new URL(text);
      const segments = url.pathname.split("/").filter(Boolean).map(segment => decodeURIComponent(segment));
      text = segments[segments.length - 1] || "";
      if (text.startsWith("@")) text = text.slice(1);
    } catch {
      return "";
    }
  }
  text = text.replace(/^@/, "").trim();
  if (!/^[\p{L}\p{N}_-]{1,32}$/u.test(text)) return "";
  return text;
}

export function scoreToStars(score, maxScale = 10) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const stars = Math.round((value / maxScale) * 5);
  return Math.max(1, Math.min(5, stars));
}

// AniList returns a score in the user's own format; its scale is not exposed in
// the list payload, so infer it and keep the approximation explicit in the UI.
export function anilistScoreToStars(score) {
  const value = Number(score);
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value <= 5) return Math.max(1, Math.min(5, Math.round(value)));
  if (value <= 10) return scoreToStars(value, 10);
  return scoreToStars(value, 100);
}

function watchedRange(count) {
  const total = Math.min(MAX_ENTRIES, Math.max(0, Math.floor(Number(count) || 0)));
  return Array.from({ length: total }, (_, index) => index + 1);
}

export function mapShikimoriRates(rates) {
  if (!Array.isArray(rates)) throw new Error("Shikimori вернул неожиданный ответ.");
  const seen = new Set();
  const entries = [];
  for (const rate of rates.slice(0, MAX_ENTRIES)) {
    const anime = rate && rate.anime;
    const shikimoriId = Number(anime && anime.id);
    const id = shikimoriInternalId(shikimoriId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const status = SHIKIMORI_STATUS[String(rate.status || "").toLowerCase()] || "planned";
    entries.push({
      id,
      source: "shikimori",
      status,
      stars: scoreToStars(rate.score, 10),
      watched: watchedRange(rate.episodes),
      anime
    });
  }
  return entries;
}

export function mapAniListCollection(collection) {
  const lists = Array.isArray(collection && collection.lists) ? collection.lists : [];
  const seen = new Set();
  const entries = [];
  for (const list of lists) {
    if (list && list.isCustomList) continue;
    for (const entry of (list && Array.isArray(list.entries) ? list.entries : [])) {
      const media = entry && entry.media;
      const id = Number(media && media.id);
      if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id)) continue;
      seen.add(id);
      const title = media.title || {};
      entries.push({
        id,
        source: "anilist",
        status: ANILIST_STATUS[String(entry.status || "").toUpperCase()] || "planned",
        stars: anilistScoreToStars(entry.score),
        watched: watchedRange(entry.progress),
        media,
        title: title.english || title.romaji || title.native || "Без названия"
      });
    }
  }
  return entries.slice(0, MAX_ENTRIES);
}

function normalizedWatchlist(state) {
  const raw = state && state.watchlist;
  const out = {};
  if (Array.isArray(raw)) {
    raw.forEach(item => {
      const id = Number(item && (item.id ?? item.anime_id));
      const status = SHIKIMORI_STATUS[String(item && item.status || "").toLowerCase()];
      if (Number.isSafeInteger(id) && id > 0 && status) out[id] = status;
    });
  } else if (raw && typeof raw === "object") {
    Object.entries(raw).forEach(([key, value]) => {
      const id = Number(key);
      const status = typeof value === "string" ? value : value && value.status;
      if (Number.isSafeInteger(id) && id > 0 && ["watching", "planned", "completed", "dropped"].includes(status)) {
        out[id] = status;
      }
    });
  }
  return out;
}

export function mergeImportedLibrary(state, entries, { updateExisting = false } = {}) {
  const target = state && typeof state === "object" ? state : {};
  target.watchlist = normalizedWatchlist(target);
  target.rate = target.rate && typeof target.rate === "object" && !Array.isArray(target.rate) ? target.rate : {};
  target.watchedEpisodes = target.watchedEpisodes && typeof target.watchedEpisodes === "object" && !Array.isArray(target.watchedEpisodes)
    ? target.watchedEpisodes
    : {};

  const result = { added: 0, updated: 0, skipped: 0, watchedMarked: 0 };
  for (const entry of entries || []) {
    const id = Number(entry && entry.id);
    if (!Number.isSafeInteger(id) || id <= 0) continue;
    const exists = Object.prototype.hasOwnProperty.call(target.watchlist, id);
    if (exists && !updateExisting) {
      result.skipped++;
    } else {
      if (exists) result.updated++;
      else result.added++;
      target.watchlist[id] = entry.status;
      if (entry.stars > 0) target.rate[id] = entry.stars;
    }

    if (Array.isArray(entry.watched) && entry.watched.length) {
      const current = Array.isArray(target.watchedEpisodes[id]) ? target.watchedEpisodes[id].map(Number) : [];
      const merged = new Set(current);
      entry.watched.forEach(number => merged.add(number));
      const list = [...merged].filter(number => Number.isInteger(number) && number > 0).sort((a, b) => a - b);
      if (list.length > current.length) result.watchedMarked += list.length - current.length;
      target.watchedEpisodes[id] = list;
    }
  }
  return { state: target, ...result };
}

async function responseError(response, service) {
  if (response.status === 404) throw new Error(service + ": пользователь не найден или список скрыт.");
  if (response.status === 429) throw new Error(service + ": слишком много запросов. Попробуй через минуту.");
  throw new Error(service + ": ошибка загрузки (HTTP " + response.status + ").");
}

export async function fetchShikimoriLibrary(username, { signal } = {}) {
  const nickname = normalizeUsername(username);
  if (!nickname) throw new Error("Введи ник Shikimori.");
  const response = await fetch(SHIKIMORI_API + "/users/" + encodeURIComponent(nickname) + "/anime_rates?limit=5000", {
    signal,
    headers: { Accept: "application/json" }
  });
  if (!response.ok) await responseError(response, "Shikimori");
  const rates = await response.json();
  return mapShikimoriRates(rates);
}

export async function fetchAniListLibrary(username, { signal } = {}) {
  const name = normalizeUsername(username);
  if (!name) throw new Error("Введи ник AniList.");
  const query = "query($name:String){MediaListCollection(userName:$name,type:ANIME){" +
    "lists{name isCustomList entries{status score progress media{id idMal episodes seasonYear " +
    "title{romaji english native} coverImage{extraLarge}}}}}}";
  const response = await fetch(ANILIST_API, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables: { name } })
  });
  if (!response.ok) await responseError(response, "AniList");
  const payload = await response.json();
  const errors = Array.isArray(payload && payload.errors) ? payload.errors : [];
  if (errors.length) {
    const message = errors.map(error => error.message).filter(Boolean).join("; ");
    throw new Error("AniList: " + (message || "не удалось получить список."));
  }
  const collection = payload && payload.data && payload.data.MediaListCollection;
  if (!collection) throw new Error("AniList: пользователь не найден или список скрыт.");
  return mapAniListCollection(collection);
}

export async function fetchLibrary(source, username, options = {}) {
  if (source === "shikimori") return fetchShikimoriLibrary(username, options);
  if (source === "anilist") return fetchAniListLibrary(username, options);
  throw new Error("Неизвестный источник импорта.");
}
