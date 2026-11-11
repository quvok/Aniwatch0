import { test as base, expect } from "@playwright/test";

export const test = base;
export { expect };

export const ANILIST_TITLES = [
  { id: 101, idMal: 1001, title: { romaji: "Smoke Hero", english: "Smoke Hero" }, genres: ["Action", "Fantasy"], seasonYear: 2025, averageScore: 85, episodes: 12, status: "RELEASING", coverImage: { extraLarge: "" }, bannerImage: "" },
  { id: 102, idMal: 1002, title: { romaji: "Smoke Second", english: "Smoke Second" }, genres: ["Drama"], seasonYear: 2024, averageScore: 78, episodes: 24, status: "FINISHED", coverImage: { extraLarge: "" }, bannerImage: "" },
  { id: 103, idMal: 1003, title: { romaji: "Smoke Third", english: "Smoke Third" }, genres: ["Comedy"], seasonYear: 2023, averageScore: 71, episodes: 13, status: "FINISHED", coverImage: { extraLarge: "" }, bannerImage: "" }
];

export const SHIKI_ITEM = {
  id: 4242,
  name: "Naruto Test",
  russian: "Наруто Тест",
  score: 8.5,
  episodes: 220,
  status: "released",
  kind: "tv",
  aired_on: "2002-10-03",
  myanimelist_id: 20,
  description: "Тестовое описание для смоук-проверки страницы тайтла.",
  genres: [{ id: "1", name: "Action", russian: "Экшен" }],
  image: { original: "https://shikimori.io/uploads/poster/test.jpg", preview: "https://shikimori.io/uploads/poster/test.jpg" }
};

const TINY_SUPABASE = `
export function createClient() {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: async () => ({ error: null })
    },
    from: () => ({
      select() { return this; }, eq() { return this; }, neq() { return this; },
      maybeSingle: async () => ({ data: null, error: null }),
      single: async () => ({ data: null, error: null }),
      insert: async () => ({ error: null }), update: async () => ({ error: null }),
      delete: async () => ({ error: null }), upsert: async () => ({ error: null })
    }),
    functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {}
  };
}
`;

function json(route, body, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

// All third-party services are answered locally. Tests must never depend on the
// live AniList, Shikimori or Supabase availability or rate limits.
export async function installApiMocks(page) {
  await page.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();

    if (url.hostname === "esm.sh") {
      return route.fulfill({ status: 200, contentType: "text/javascript", body: TINY_SUPABASE });
    }

    if (url.hostname === "graphql.anilist.co") {
      const body = request.postDataJSON?.() || {};
      const query = String(body.query || "");
      if (query.includes("Page(perPage:30)")) return json(route, { data: { Page: { media: ANILIST_TITLES } } });
      if (query.includes("Media(") || query.includes("Page(perPage:1)")) {
        const ids = body.variables?.i || [];
        const media = ANILIST_TITLES.filter(item => ids.includes(item.id));
        return json(route, { data: { Page: { media }, Media: media[0] || null } });
      }
      return json(route, { data: { Page: { media: [] }, Media: null } });
    }

    if (url.hostname === "shikimori.io") {
      const path = url.pathname;
      if (path === "/api/genres") {
        return json(route, [
          { id: "1", name: "Action", russian: "Экшен", kind: "genre", entry_type: "Anime" },
          { id: "2", name: "Drama", russian: "Драма", kind: "genre", entry_type: "Anime" }
        ]);
      }
      if (/^\/api\/animes\/\d+\/(related|similar)$/.test(path)) return json(route, []);
      if (path === "/api/calendar") return json(route, []);
      if (/^\/api\/animes\/\d+$/.test(path)) return json(route, SHIKI_ITEM);
      if (path === "/api/animes") {
        const ids = url.searchParams.get("ids");
        if (ids) {
          const wanted = ids.split(",").map(Number);
          return json(route, wanted.includes(SHIKI_ITEM.id) ? [SHIKI_ITEM] : []);
        }
        if (url.searchParams.get("search")) return json(route, [SHIKI_ITEM]);
        return json(route, [SHIKI_ITEM]);
      }
      if (path === "/api/graphql") return json(route, { data: { animes: [] } });
      if (/\/api\/users\/[^/]+\/anime_rates$/.test(path)) {
        return json(route, [
          { status: "watching", score: 8, episodes: 3, anime: SHIKI_ITEM },
          { status: "completed", score: 10, episodes: 12, anime: { ...SHIKI_ITEM, id: 5555, name: "Second Test", russian: "Второй Тест" } }
        ]);
      }
      if (/\/api\/users\//.test(path)) return json(route, []);
      return route.fulfill({ status: 204, body: "" });
    }

    if (url.hostname.endsWith("supabase.co")) return json(route, { ok: true, results: [] });
    if (url.hostname.includes("anilibria")) return json(route, { data: [] });
    if (url.hostname.includes("shikimori")) return json(route, []);
    return route.fulfill({ status: 204, body: "" });
  });
}

export async function seedState(page, state = {}) {
  const initial = {
    fav: [],
    hist: {},
    rate: {},
    watchlist: {},
    watchedEpisodes: {},
    name: "Смоук",
    acc: "#8b5cf6",
    ...state
  };
  await page.addInitScript(value => {
    // Navigation reloads must not reset the state the test just mutated.
    if (sessionStorage.getItem("aw-smoke-seeded")) return;
    sessionStorage.setItem("aw-smoke-seeded", "1");
    localStorage.setItem("aw", JSON.stringify(value));
    localStorage.removeItem("awc");
  }, initial);
}
