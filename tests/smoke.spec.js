import { test, expect, installApiMocks, seedState, SHIKI_ITEM, SHIKI_SCREENSHOT, SHIKI_NAME_MATCH, SHIKI_OTHER } from "./fixtures.js";

const SHIKI_INTERNAL_ID = 1_000_000_000 + SHIKI_ITEM.id;

test.beforeEach(async ({ page }) => {
  await seedState(page);
  await installApiMocks(page);
});

test("home renders the catalog, hero and primary navigation", async ({ page }) => {
  const metadataHosts = [];
  page.on("request", request => {
    const host = new URL(request.url()).hostname;
    if (/anilist\.co|ani\.zip|kitsu\.io|jikan\.moe/.test(host)) metadataHosts.push(host);
  });
  await page.goto("/");

  await expect(page.locator(".hero-editorial h1")).toBeVisible();
  await expect(page.locator(".hero-editorial h1")).toHaveText(SHIKI_ITEM.russian);
  await expect(page.locator(".hero-editorial")).toHaveAttribute("style", new RegExp(SHIKI_SCREENSHOT.replaceAll(".", "\\.")));
  await expect(page.locator('#site-header a[data-page="catalog"]').first()).toBeVisible();
  await expect(page.locator("#app .card").first()).toBeVisible();
  const popular = page.locator("section.shelf").filter({ has: page.getByRole("heading", { name: "Популярное", exact: true }) });
  await expect(popular.locator(".card > b")).toHaveText([SHIKI_ITEM.russian, SHIKI_NAME_MATCH.russian, SHIKI_OTHER.russian]);
  // The offline placeholder must never replace real catalog data.
  await expect(page.locator(".offline-state")).toHaveCount(0);
  expect(metadataHosts).toEqual([]);
});

test("catalog loads cards and sends the search query to Shikimori", async ({ page }) => {
  await page.goto("/catalog.html");

  await expect(page.locator("#cr .card")).toHaveCount(1);
  await expect(page.locator("#cr .card")).toContainText("Наруто Тест");

  const request = page.waitForRequest(url =>
    url.url().includes("shikimori.io/api/animes") && url.url().includes("search=%D0%BD%D0%B0%D1%80%D1%83%D1%82%D0%BE")
  );
  await page.locator("#cs").fill("наруто");
  await request;
});

test("title page resolves a Shikimori ID and opens the episode list", async ({ page }) => {
  await page.goto(`/anime.html?id=${SHIKI_INTERNAL_ID}`);

  await expect(page.locator(".title-info h1")).toHaveText("Наруто Тест");
  await expect(page.locator(".title-watch-primary")).toBeVisible();
  await expect(page.locator(".episode-item").first()).toBeVisible();
  await expect(page.locator('[data-episode-progress]').first()).toHaveText("0 / 220 просмотрено");
  await expect(page.locator("#anime-extra-meta")).toContainText("Студия из Shikimori");
});

test("a saved AniList link resolves using its cached MAL mapping", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("awc", JSON.stringify({ a: [{ id: 101, mal: 20, n: "Naruto Test", y: 2002 }] }));
  });
  await page.goto("/anime.html?id=101");

  await expect(page.locator(".title-info h1")).toHaveText(SHIKI_ITEM.russian);
  await expect(page.locator(".title-watch-primary")).toHaveAttribute("href", /watch\.html\?id=101&ep=1/);
});

test("watch page still loads Kodik by Shikimori ID", async ({ page }) => {
  const episodeUrl = "https://example.test/kodik/episode-1";
  await page.route("**/functions/v1/kodik-search", async route => {
    expect(route.request().postDataJSON().params.shikimori_id).toBe(SHIKI_ITEM.id);
    await route.fulfill({ json: { results: [{
      id: "episode-fixture", type: "anime-serial", title: SHIKI_ITEM.russian, shikimori_id: SHIKI_ITEM.id,
      link: episodeUrl, translation: { id: 1, title: "Тестовая озвучка" },
      seasons: { 1: { episodes: { 1: { episode: 1, link: episodeUrl } } } }
    }] } });
  });
  await page.goto(`/watch.html?id=${SHIKI_INTERNAL_ID}&ep=1`);

  await expect(page.locator('[data-provider="kodik"]')).toHaveClass(/\bon\b/);
  await expect(page.locator(".kodik-current")).toContainText("Тестовая озвучка");
  await expect(page.locator("iframe.stream-video")).toHaveAttribute("src", `${episodeUrl}?hide_selectors=true`);
});

test("favorite action persists in local storage across reload", async ({ page }) => {
  await page.goto("/catalog.html");
  const favorite = page.locator("#cr .card .poster-fav").first();
  await expect(favorite).toBeVisible();
  await favorite.click();

  const fav = await page.evaluate(() => JSON.parse(localStorage.getItem("aw") || "{}").fav || []);
  expect(fav).toContain(SHIKI_INTERNAL_ID);

  await page.reload();
  await expect(page.locator('#cr .card .poster-fav[aria-pressed="true"]').first()).toBeVisible();
});

test("sign-in modal is a dialog, focuses the login field and closes on Escape", async ({ page }) => {
  await page.goto("/profile.html");
  await page.locator(".profile-login").click();

  const modal = page.locator("#auth-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toHaveAttribute("role", "dialog");
  await expect(modal).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#auth-login")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
});

test("imports a public Shikimori library from the profile page", async ({ page }) => {
  await page.goto("/profile.html");

  const form = page.locator("#library-import-form");
  await expect(form).toBeVisible();
  await form.locator('select[name="source"]').selectOption("shikimori");
  await form.locator('input[name="username"]').fill("tester");
  await form.locator('button[type="submit"]').click();

  await expect(page.locator("#library-import-status")).toContainText("Импорт завершён");
  await expect(page.locator("#library-import-status")).toContainText("Добавлено: 2");

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("aw") || "{}"));
  expect(state.watchlist[String(SHIKI_INTERNAL_ID)]).toBe("watching");
  expect(state.rate[String(SHIKI_INTERNAL_ID)]).toBe(4);
  expect(state.watchedEpisodes[String(SHIKI_INTERNAL_ID)]).toEqual([1, 2, 3]);
  expect(state.watchlist["1000005555"]).toBe("completed");
});
