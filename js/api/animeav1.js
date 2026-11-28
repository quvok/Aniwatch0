const BASE = "https://animeav1.ahmedrangel.com/api";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cache = new Map();
const pending = new Map();
let queue = Promise.resolve();
let nextRequest = 0;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

class ApiError extends Error {
  constructor(status, message = "AnimeAV1") {
    super(message);
    this.status = status;
  }
}

async function fetchData(path) {
  for (let attempt = 0; attempt < 2; attempt++) {
    await delay(Math.max(0, nextRequest - Date.now()));
    nextRequest = Date.now() + 450;
    let response;
    try {
      response = await fetch(BASE + path, {
        headers: { Accept: "application/json" },
        credentials: "omit",
        signal: AbortSignal.timeout(6500)
      });
    } catch (error) {
      if (attempt) throw error;
      nextRequest = Date.now() + 900;
      continue;
    }
    if (response.status === 429) {
      const header = response.headers.get("Retry-After");
      const seconds = header && /^\d+$/.test(header) ? Number(header) : NaN;
      const retry = Number.isFinite(seconds) ? seconds * 1000 : (Date.parse(header) - Date.now() || 5000);
      nextRequest = Date.now() + Math.max(1000, retry);
      throw new ApiError(429);
    }
    if (response.status >= 500 && !attempt) {
      nextRequest = Date.now() + 900;
      continue;
    }
    if (!response.ok) throw new ApiError(response.status);
    const payload = await response.json();
    if (payload?.success !== true || !payload.data) throw new ApiError(0, "Invalid AnimeAV1 response");
    return payload.data;
  }
}

function request(path, ttl) {
  const hit = cache.get(path);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.data);
  if (pending.has(path)) return pending.get(path);
  if (pending.size >= 12 || nextRequest - Date.now() > 10000) return Promise.reject(new ApiError(429));
  const task = queue.then(() => {
    if (nextRequest - Date.now() > 10000) throw new ApiError(429);
    return fetchData(path);
  }).then(data => {
    if (cache.size >= 100) cache.delete(cache.keys().next().value);
    cache.set(path, { data, expires: Date.now() + ttl });
    return data;
  }).finally(() => pending.delete(path));
  queue = task.catch(() => {});
  pending.set(path, task);
  return task;
}

function titlePath(slug) {
  if (typeof slug !== "string" || slug.length > 160 || !slugPattern.test(slug)) throw new TypeError("Invalid AnimeAV1 slug");
  return "/anime/" + slug;
}

export async function searchAnimeAV1(query) {
  const value = String(query ?? "").trim().slice(0, 180);
  if (value.length < 2) return [];
  try {
    const result = await request("/search?" + new URLSearchParams({ query: value }), 300000);
    if (!Array.isArray(result.media)) throw new ApiError(0, "Invalid AnimeAV1 search response");
    return result.media.filter(item => typeof item?.title === "string" &&
      typeof item.slug === "string" && item.slug.length <= 160 && slugPattern.test(item.slug));
  } catch (error) {
    if (error.status === 404) return [];
    throw error;
  }
}

export async function getAnimeAV1Title(slug) {
  const data = await request(titlePath(slug), 120000);
  if (typeof data.title !== "string" || !Array.isArray(data.episodes)) throw new ApiError(0, "Invalid AnimeAV1 title response");
  return { ...data, slug, episodes: data.episodes.filter(item => Number.isInteger(item?.number) && item.number > 0) };
}

export async function getAnimeAV1Episode(slug, episode) {
  if (!Number.isSafeInteger(episode) || episode < 1) throw new TypeError("Invalid episode");
  const data = await request(titlePath(slug) + "/" + episode, 45000);
  if (data.number !== episode || !Array.isArray(data.embeds)) throw new ApiError(0, "Invalid AnimeAV1 episode response");
  return { ...data, sources: animeAV1Sources(data.embeds) };
}

const embedServers = new Map([
  ["player.zilla-networks.com", /^\/play\/[\w-]+\/?$/],
  ["animeav1.uns.bio", /^\/$/],
  ["voe.sx", /^\/e\/[\w-]+\/?$/],
  ["byselapuix.com", /^\/e\/[\w-]+\/?$/],
  ["www.yourupload.com", /^\/embed\/[\w-]+\/?$/],
  ["www.mp4upload.com", /^\/embed-[\w-]+\.html$/],
  ["streamtape.com", /^\/e\/[\w-]+\/?$/]
]);
const directHosts = new Set(["cdn.animeav1.com"]);

export function animeAV1Sources(embeds) {
  const seen = new Set();
  const sources = [];
  for (const item of embeds) {
    if (!["SUB", "DUB"].includes(item?.type) || typeof item.name !== "string" || typeof item.url !== "string") continue;
    let url;
    try { url = new URL(item.url); } catch { continue; }
    if (url.protocol !== "https:" || url.port || url.username || url.password) continue;
    const media = directHosts.has(url.hostname) && /\.(mp4|m3u8)$/i.exec(url.pathname);
    const kind = media ? (media[1].toLowerCase() === "mp4" ? "mp4" : "hls")
      : embedServers.get(url.hostname)?.test(url.pathname) ? (url.hostname === "streamtape.com" ? "playerjs" : "iframe") : "";
    if (!kind) continue;
    const id = item.type + ":" + url.hostname + ":" + kind;
    if (seen.has(id)) continue;
    seen.add(id);
    sources.push({ id, name: item.name.slice(0, 32), type: item.type, kind, url: url.href });
  }
  const rank = source => (source.type === "DUB" ? 0 : 10) + ({ mp4: 0, hls: 1, playerjs: 2, iframe: 3 })[source.kind];
  return sources.sort((a, b) => rank(a) - rank(b));
}

function normalized(value) {
  return String(value ?? "").normalize("NFKD").toLowerCase().replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function titles(anime) {
  return [...new Set([anime.o, anime.originalTitle, anime.title?.romaji, anime.title?.native,
    anime.title?.english, typeof anime.title === "string" ? anime.title : "", anime.romaji,
    anime.japanese, anime.english, ...(Array.isArray(anime.synonyms) ? anime.synonyms : []), anime.n]
    .filter(value => typeof value === "string" && value.trim()))];
}

function seasonOf(title) {
  const match = /(?:\b(?:season|temporada|parte|part|cour)\s*(\d+)\b|\b(\d+)(?:st|nd|rd|th)?\s*(?:season|temporada)\b|第\s*(\d+)\s*期)/iu.exec(title);
  return Number(match?.[1] || match?.[2] || match?.[3]) || 0;
}

const formats = { tv: "tv", "tv anime": "tv", "tv short": "tv", movie: "movie", pelicula: "movie",
  special: "special", especial: "special", ova: "ova", ona: "ona", music: "music" };

export function matchAnimeAV1Title(anime, candidates) {
  const mal = Number(anime.mal || anime.idMal);
  const animeTitles = titles(anime);
  const wanted = new Set(animeTitles.map(normalized));
  const format = formats[normalized(anime.kind || anime.format)];
  const season = Number(anime.season) || animeTitles.map(seasonOf).find(Boolean) || 0;
  const matches = candidates.filter(candidate => {
    const providerMal = Number(candidate.malId);
    if (mal && providerMal) return mal === providerMal;
    const names = [candidate.title, ...(Array.isArray(candidate.alternative_titles) ? candidate.alternative_titles : [])];
    const otherSeason = names.map(seasonOf).find(Boolean) || 0;
    if (season && otherSeason && season !== otherSeason) return false;
    return names.some(name => wanted.has(normalized(name))) &&
      Number(anime.y || anime.startDate?.year) > 0 &&
      Number(anime.y || anime.startDate?.year) === Number(candidate.year) &&
      format && format === formats[normalized(candidate.type)] &&
      Number(anime.e || anime.episodes) > 0 &&
      Number(anime.e || anime.episodes) === candidate.episodes?.length;
  });
  const byMal = matches.filter(candidate => mal > 0 && Number(candidate.malId) === mal);
  const exact = byMal.length ? byMal : matches;
  return exact.length === 1 ? exact[0] : null;
}

export async function findAnimeAV1Title(anime) {
  const matches = new Map();
  const names = titles(anime);
  for (const name of names.slice(0, 3)) {
    for (const result of await searchAnimeAV1(name)) matches.set(result.slug, result);
    const exact = [...matches.values()].filter(item => names.some(title => normalized(title) === normalized(item.title)));
    const details = [];
    for (const item of exact.slice(0, 5)) {
      try { details.push(await getAnimeAV1Title(item.slug)); }
      catch (error) { if (error.status !== 404) throw error; }
    }
    const match = matchAnimeAV1Title(anime, details);
    if (match && (exact.length <= 5 || Number(match.malId) === Number(anime.mal || anime.idMal))) {
      return { match, candidates: [...matches.values()] };
    }
  }
  return { match: null, candidates: [...matches.values()] };
}

export const animeAV1MappingKey = animeId => "aw.animeav1.slug." + animeId;
