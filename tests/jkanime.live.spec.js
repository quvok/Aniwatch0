import { test, expect } from "@playwright/test";
import { parseEpisode, searchResults, titleDetails } from "../supabase/functions/jkanime-catalog/catalog.mjs";

test.skip(process.env.JKANIME_LIVE !== "1", "Set JKANIME_LIVE=1 to check public catalog pages");

async function page(path) {
  const response = await fetch("https://jkanime.net" + path, {
    headers: {Accept:"text/html"}, redirect:"error", signal:AbortSignal.timeout(8000)
  });
  expect(response.status).toBe(200);
  return response.text();
}

test("live JKAnime metadata labels Latino and Spanish-subtitled variants separately", async () => {
  const search = searchResults(await page("/buscar/dragon%20ball/"));
  expect(search).toContainEqual({slug:"dragon-ball",title:"Dragon Ball"});
  expect(titleDetails(await page("/dragon-ball/"))).toEqual({kind:"serie",year:1986,episodes:153});
  const laterEpisode = parseEpisode(await page("/dragon-ball/50/"),"dragon-ball",50);
  expect(laterEpisode.available).toContain("latino");
  const deathNote = parseEpisode(await page("/death-note/15/"),"death-note",15);
  expect(new Set(deathNote.available)).toEqual(new Set(["latino","sub"]));
});
