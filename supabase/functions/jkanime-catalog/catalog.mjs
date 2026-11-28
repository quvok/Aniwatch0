export const jkOrigin = "https://jkanime.net";
export const validSlug = value => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
export const normalize = value => String(value ?? "").normalize("NFKD").toLowerCase()
  .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function clean(value) {
  return value.replace(/<[^>]*>/g, "").replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d{1,6}|#x[\da-f]{1,5});/gi, entity => {
    const named = {amp:"&",quot:'"',apos:"'",lt:"<",gt:">",nbsp:" "};
    const key = entity.slice(1,-1).toLowerCase();
    if (key in named) return named[key];
    const code = key.startsWith("#x") ? parseInt(key.slice(2),16) : Number(key.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  }).trim();
}

export function searchResults(html) {
  const candidates = new Map();
  for (const match of html.matchAll(/<h5>\s*<a\s+href="https:\/\/jkanime\.net\/([a-z0-9-]+)\/"[^>]*>([^<]{1,240})<\/a>\s*<\/h5>/gi)) {
    const [, slug, raw] = match;
    if (validSlug(slug)) candidates.set(slug, {slug,title:clean(raw)});
    if (candidates.size === 20) break;
  }
  return [...candidates.values()];
}

export function titleDetails(html) {
  const kind = clean(html.match(/<span>\s*Tipo:\s*<\/span>([^<]{1,80})/i)?.[1] || "");
  const year = Number(html.match(/<span>\s*Emitido:\s*<\/span>[^<]{0,140}?\b((?:19|20)\d{2})\b/i)?.[1]) || 0;
  const episodes = Number(html.match(/<span>\s*Episodios:\s*<\/span>\s*(\d+)/i)?.[1]) || 0;
  return {kind: normalize(kind), year, episodes};
}

export function parseEpisode(html, slug, episode) {
  const page = html.match(/<meta\s+property="og:url"\s+content="([^"]+)"/i)?.[1];
  if (page !== jkOrigin + "/" + slug + "/" + episode + "/") return null;

  const selector = html.match(/<select\b[^>]*\bid="deflang"[^>]*>([\s\S]*?)<\/select>/i)?.[1] || "";
  const languages = new Map();
  for (const [, id, label] of selector.matchAll(/<option\s+value="(\d+)"[^>]*>([^<]+)<\/option>/gi)) {
    const name = normalize(clean(label));
    if (name === "espanol latino") languages.set(Number(id), "latino");
    if (name === "japones sub espanol") languages.set(Number(id), "sub");
  }

  let rows;
  try { rows = JSON.parse(html.match(/\bvar servers\s*=\s*(\[[\s\S]*?\]);/)?.[1] || "[]"); }
  catch { rows = []; }
  const available = new Set();
  const streams = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const language = languages.get(row?.lang);
    if (!language) continue;
    available.add(language);
    if (row.server !== "Streamtape" || typeof row.remote !== "string" || row.remote.length > 512) continue;
    try {
      const url = new URL(atob(row.remote).trim());
      if (url.origin === "https://streamtape.com" && !url.username && !url.password &&
          !url.search && !url.hash && /^\/e\/[\w-]{5,64}(?:\/[\w.-]{1,120})?\/?$/.test(url.pathname)) {
        streams[language] ??= url.href;
      }
    } catch {}
  }
  return {available:[...available], streams};
}
