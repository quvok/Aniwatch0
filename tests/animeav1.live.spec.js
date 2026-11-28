import { test, expect } from "@playwright/test";
import { findAnimeAV1Title, getAnimeAV1Episode, getAnimeAV1Title } from "../js/api/animeav1.js";

test.skip(process.env.ANIMEAV1_LIVE !== "1", "Run against the live third-party API with ANIMEAV1_LIVE=1");

test("live AnimeAV1 catalog and Latin American dub metadata", async () => {
  test.setTimeout(45_000);
  const { match, candidates } = await findAnimeAV1Title({ n:"Naruto", mal:20, y:2002, kind:"tv", e:220 });
  expect(match).toMatchObject({ slug:"naruto", malId:20, year:2002 });
  expect(candidates.some(item=>item.slug==="naruto-shippuuden")).toBe(true);
  expect((await getAnimeAV1Title("naruto-shippuuden")).malId).toBe(1735);
  const episode=await getAnimeAV1Episode(match.slug,1);
  expect(episode.number).toBe(1);
  expect(new Set(episode.sources.map(source=>source.type))).toEqual(new Set(["SUB","DUB"]));
  console.log("Live source kinds", [...new Set(episode.sources.map(source=>source.kind))].join(", "));
});
