import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { parseHTML } from "npm:linkedom@0.18.12";

const ALLOWED_ORIGINS = new Set([
  "https://aniwatch1.ru",
  "https://www.aniwatch1.ru",
  "https://quvok.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5500",
]);
const BASES = ["https://animevost.org/", "https://v14.vost.pw/"];
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

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
async function fetchText(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        ...(init.headers || {}),
      },
    });
    if (!response.ok) throw new Error("AnimeVost ответил HTTP " + response.status);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}
async function searchAnime(title: string) {
  let lastError: unknown = null;
  for (const base of BASES) {
    try {
      const form = new URLSearchParams({ subaction: "search", story: title });
      const html = await fetchText(base + "index.php?do=search", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "Referer": base },
        body: form.toString(),
      });
      const { document } = parseHTML(html);
      const results = [...document.querySelectorAll("div.shortstory")].map((block) => {
        const link = block.querySelector(".shortstoryHead h2 a[href], .shortstoryHead h1 a[href]");
        if (!link) return null;
        const href = new URL(link.getAttribute("href") || "", base).toString();
        const name = (link.textContent || "").replace(/\s+/g, " ").trim();
        if (!name || !/^https?:$/.test(new URL(href).protocol)) return null;
        return { title: name, url: href };
      }).filter(Boolean);
      if (results.length) return results.slice(0, 12);
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return [];
}
function safeAnimeUrl(raw: string) {
  const url = new URL(raw);
  if (url.protocol !== "https:" || !["animevost.org", "www.animevost.org", "v14.vost.pw"].includes(url.hostname)) {
    throw new Error("Недопустимый адрес AnimeVost");
  }
  return url.toString();
}
async function getStreams(rawUrl: string, episode: number) {
  const animeUrl = safeAnimeUrl(rawUrl);
  const base = new URL(animeUrl).origin + "/";
  const html = await fetchText(animeUrl, { headers: { "Referer": base } });
  const { document } = parseHTML(html);
  const title = (document.querySelector(".shortstoryHead h1, h1")?.textContent || "AnimeVost").replace(/\s+/g, " ").trim();
  const dataBlock = html.match(/var\s+data\s*=\s*\{([\s\S]*?)\}\s*;/i)?.[1] || "";
  const entries = [...dataBlock.matchAll(/["']([^"']+)["']\s*:\s*["'](\d+)["']/g)].map((m) => ({
    name: m[1].trim(), videoId: m[2], number: Number(m[1].match(/\d+/)?.[0] || 0),
  }));
  const chosen = entries.find((x) => x.number === episode) || entries.find((x) => x.number === 0 && episode === 1);
  if (!chosen) {
    return { title, episodes: entries.map((x) => ({ number: x.number, name: x.name })), streams: [] };
  }
  const frameUrl = new URL("frame5.php?play=" + encodeURIComponent(chosen.videoId) + "&old=1", base).toString();
  const frameHtml = await fetchText(frameUrl, { headers: { "Referer": animeUrl } });
  const { document: frameDoc } = parseHTML(frameHtml);
  const rawFiles = [...frameHtml.matchAll(/["']file["']\s*:\s*["']([^"']+)["']/gi)].map((m) =>
    m[1].replace(/\\\//g, "/").replace(/\\u0026/g, "&").replace(/&amp;/g, "&")
  );
  const streams: { quality: string; url: string }[] = [];
  for (const file of rawFiles) {
    const segments = [...file.matchAll(/\[([^\]]+)\]([^[]+)/g)];
    if (segments.length) {
      for (const segment of segments) {
        const url = segment[2].match(/https?:\/\/[^\s,]+/)?.[0]?.trim();
        if (url) streams.push({ quality: segment[1].trim(), url });
      }
    } else {
      const url = file.match(/https?:\/\/[^\s,]+/)?.[0]?.trim();
      if (url) streams.push({ quality: "Авто", url });
    }
  }
  for (const link of [...frameDoc.querySelectorAll("a.butt[download][href]")]) {
    const href = link.getAttribute("href") || "";
    const quality = (link.textContent || "").trim();
    if (href && quality) {
      const url = new URL(href, frameUrl).toString().replace(/([?&])d=1(&|$)/, "$1").replace(/[?&]$/, "");
      if (/^https?:/.test(url)) streams.push({ quality: quality + " · файл", url });
    }
  }
  const unique = [...new Map(streams.map((x) => [x.url, x])).values()];
  return {
    title,
    episode: chosen.name,
    episodes: entries.map((x) => ({ number: x.number, name: x.name })),
    streams: unique,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Используй POST" }, 405);
  try {
    const body = await req.json();
    const action = String(body?.action || "");
    if (action === "search") {
      const title = String(body?.title || "").trim().slice(0, 120);
      if (title.length < 2) return json(req, { error: "Введи название длиннее двух символов" }, 400);
      return json(req, { results: await searchAnime(title) });
    }
    if (action === "streams") {
      const episode = Number(body?.episode);
      if (!Number.isInteger(episode) || episode < 1 || episode > 9999) return json(req, { error: "Некорректный номер серии" }, 400);
      return json(req, await getStreams(String(body?.animeUrl || ""), episode));
    }
    return json(req, { error: "Неизвестное действие" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось получить источник AnimeVost";
    return json(req, { error: message }, 502);
  }
});
