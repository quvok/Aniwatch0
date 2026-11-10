import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED_ORIGINS = new Set([
  "https://aniwatch1.ru",
  "https://www.aniwatch1.ru",
  "https://quvok.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
]);
const API_BASE = "https://kodik-api.com";
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const MAX_BATCH_SIZE = 20;
const requests = new Map<string, { count: number; resetAt: number }>();

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://aniwatch1.ru",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}
function checkRateLimit(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("cf-connecting-ip") || "unknown";
  const now = Date.now();
  const entry = requests.get(ip);
  if (!entry || entry.resetAt <= now) {
    requests.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_REQUESTS;
}
function normalizeParams(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Некорректные параметры поиска");
  const raw = input as Record<string, unknown>;
  const params = new URLSearchParams();
  params.set("types", "anime-serial,anime");
  const requestedLimit = Number(raw.limit);
  params.set("limit", String(Number.isInteger(requestedLimit) ? Math.max(1, Math.min(50, requestedLimit)) : 50));
  if (raw.with_material_data !== false) params.set("with_material_data", "true");
  if (raw.with_episodes_data !== false) params.set("with_episodes_data", "true");

  if (raw.shikimori_id !== undefined && raw.shikimori_id !== null && raw.shikimori_id !== "") {
    const id = Number(raw.shikimori_id);
    if (!Number.isSafeInteger(id) || id < 1) throw new Error("Некорректный Shikimori ID");
    params.set("shikimori_id", String(id));
  }
  if (raw.title !== undefined && raw.title !== null && raw.title !== "") {
    const title = String(raw.title).trim().slice(0, 120);
    if (title.length < 2) throw new Error("Название слишком короткое");
    params.set("title", title);
  }
  if (!params.has("shikimori_id") && !params.has("title")) throw new Error("Не указано название или Shikimori ID");
  return params;
}
async function fetchKodikResults(params: URLSearchParams, token: string) {
  params.set("token", token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  let response: Response;
  try {
    response = await fetch(API_BASE + "/search?" + params.toString(), {
      method: "POST",
      headers: { "Accept": "application/json" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) throw new Error("Kodik API ответил HTTP " + response.status);
  const data = await response.json();
  if (!data || !Array.isArray(data.results)) throw new Error(String(data?.error || "Kodik вернул неожиданный ответ"));
  return data.results;
}
function normalizeTitle(value: unknown) {
  return String(value || "").toLocaleLowerCase("ru").replace(/ё/g, "е").replace(/[^a-zа-я0-9]+/gi, "");
}
function hasTitleMatch(results: unknown[], title: string) {
  const wanted = normalizeTitle(title);
  if (!wanted) return false;
  return results.some(value => {
    if (!value || typeof value !== "object") return false;
    const item = value as Record<string, unknown>;
    const material = (item.material_data && typeof item.material_data === "object" ? item.material_data : {}) as Record<string, unknown>;
    const candidates = [
      item.title, item.title_orig, item.other_title,
      material.title, material.anime_title, material.title_en,
      ...(Array.isArray(material.other_titles) ? material.other_titles : []),
      ...(Array.isArray(material.other_titles_en) ? material.other_titles_en : []),
      ...(Array.isArray(material.other_titles_jp) ? material.other_titles_jp : []),
    ];
    return candidates.some(candidate => {
      const actual = normalizeTitle(candidate);
      return actual === wanted;
    });
  });
}
async function lookupBatchItem(input: unknown, token: string) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Некорректный элемент пакета");
  const raw = input as Record<string, unknown>;
  const key = String(raw.key || "").slice(0, 80);
  const limit = 12;
  let results: unknown[] = [];
  if (raw.shikimori_id !== undefined && raw.shikimori_id !== null && raw.shikimori_id !== "") {
    results = await fetchKodikResults(normalizeParams({ shikimori_id: raw.shikimori_id, limit, with_episodes_data: false }), token);
  }
  if (!results.length) {
    const titles = Array.isArray(raw.titles) ? raw.titles : [raw.title];
    for (const value of titles.slice(0, 3)) {
      const title = String(value || "").trim().slice(0, 120);
      if (title.length < 2) continue;
      const found = await fetchKodikResults(normalizeParams({ title, limit, with_episodes_data: false }), token);
      if (!results.length) results = found;
      if (hasTitleMatch(found, title)) {
        results = found;
        break;
      }
    }
  }
  return { key, results };
}
async function lookupBatch(inputs: unknown[], token: string) {
  if (inputs.length > MAX_BATCH_SIZE) throw new Error("В одном пакете допускается не более " + MAX_BATCH_SIZE + " тайтлов");
  const output: Array<{ key: string; results: unknown[] }> = new Array(inputs.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < inputs.length) {
      const index = cursor++;
      try {
        output[index] = await lookupBatchItem(inputs[index], token);
      } catch (error) {
        const raw = inputs[index] as Record<string, unknown>;
        output[index] = { key: String(raw?.key || "").slice(0, 80), results: [] };
        console.warn("[kodik-search] Batch item lookup failed:", error);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, inputs.length) }, () => worker()));
  return output;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Используй POST" }, 405);
  if (!checkRateLimit(req)) return json(req, { error: "Слишком много запросов. Попробуй через минуту." }, 429);

  try {
    const token = Deno.env.get("KODIK_API_TOKEN");
    if (!token) return json(req, { error: "На сервере не настроен токен Kodik" }, 503);

    const body = await req.json();
    if (Array.isArray(body?.lookups)) {
      if (!body.lookups.length) return json(req, { results: [] });
      const results = await lookupBatch(body.lookups, token);
      return json(req, { results });
    }
    const params = normalizeParams(body?.params);
    const results = await fetchKodikResults(params, token);
    return json(req, { results });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return json(req, { error: "Kodik API не ответил за 12 секунд" }, 504);
    }
    const message = error instanceof Error ? error.message : "Не удалось выполнить поиск Kodik";
    return json(req, { error: message }, 400);
  }
});
