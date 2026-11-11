// Unit checks for the public-list importer. Network fetching is covered by the
// browser smoke suite; this file verifies mapping and merge semantics.
import assert from "node:assert/strict";
import {
  normalizeUsername,
  shikimoriInternalId,
  scoreToStars,
  anilistScoreToStars,
  mapShikimoriRates,
  mapAniListCollection,
  mergeImportedLibrary
} from "../js/core/library-import.js";

assert.equal(normalizeUsername("  animefan "), "animefan");
assert.equal(normalizeUsername("@animefan"), "animefan");
assert.equal(normalizeUsername("https://shikimori.io/@animefan"), "animefan");
assert.equal(normalizeUsername("https://anilist.co/user/animefan/"), "animefan");
assert.equal(normalizeUsername("bad nick!"), "");
assert.equal(normalizeUsername(""), "");

assert.equal(shikimoriInternalId(42), 1000000042);
assert.equal(shikimoriInternalId("0"), 0);

assert.equal(scoreToStars(0, 10), 0);
assert.equal(scoreToStars(8, 10), 4);
assert.equal(scoreToStars(10, 10), 5);
assert.equal(scoreToStars(1, 10), 1);
assert.equal(anilistScoreToStars(0), 0);
assert.equal(anilistScoreToStars(3), 3);
assert.equal(anilistScoreToStars(7), 4);
assert.equal(anilistScoreToStars(85), 4);

const shikimori = mapShikimoriRates([
  { status: "watching", score: 8, episodes: 3, anime: { id: 10, name: "A" } },
  { status: "rewatching", score: 0, episodes: 5, anime: { id: 11, name: "B" } },
  { status: "completed", score: 10, episodes: 12, anime: { id: 12, name: "C" } },
  { status: "on_hold", score: 0, episodes: 0, anime: { id: 13, name: "D" } },
  { status: "dropped", score: 4, episodes: 1, anime: { id: 14, name: "E" } },
  { status: "watching", score: 9, episodes: 1, anime: { id: 10, name: "duplicate" } }
]);
assert.equal(shikimori.length, 5, "duplicate Shikimori IDs must collapse");
assert.deepEqual(shikimori.map(item => item.status), ["watching", "watching", "completed", "planned", "dropped"]);
assert.equal(shikimori[0].stars, 4);
assert.deepEqual(shikimori[0].watched, [1, 2, 3]);
assert.equal(shikimori[1].stars, 0);
assert.equal(shikimori[3].watched.length, 0);

const anilist = mapAniListCollection({
  lists: [
    { isCustomList: false, entries: [
      { status: "CURRENT", score: 9, progress: 2, media: { id: 7, title: { english: "Seven" } } },
      { status: "COMPLETED", score: 90, progress: 24, media: { id: 8, title: { romaji: "Eight" } } }
    ] },
    { isCustomList: true, entries: [
      { status: "COMPLETED", score: 10, progress: 1, media: { id: 7, title: { english: "Seven" } } }
    ] }
  ]
});
assert.equal(anilist.length, 2, "custom lists must not duplicate status entries");
assert.equal(anilist[0].status, "watching");
assert.equal(anilist[0].stars, 5);
assert.equal(anilist[1].status, "completed");
assert.equal(anilist[1].stars, 5);
assert.deepEqual(anilist[0].watched, [1, 2]);

const id10 = shikimoriInternalId(10), id11 = shikimoriInternalId(11);
const existing = {
  watchlist: { [id10]: "completed", [id11]: "planned" },
  rate: { [id10]: 2 },
  watchedEpisodes: { [id10]: [1, 2, 3, 4] }
};
const keepLocal = mergeImportedLibrary(JSON.parse(JSON.stringify(existing)), shikimori, { updateExisting: false });
assert.equal(keepLocal.skipped, 2, "existing titles are skipped without overwrite");
assert.equal(keepLocal.added, 3);
assert.equal(keepLocal.state.watchlist[id10], "completed");
assert.equal(keepLocal.state.rate[id10], 2);

const overwrite = mergeImportedLibrary(JSON.parse(JSON.stringify(existing)), shikimori, { updateExisting: true });
assert.equal(overwrite.updated, 2);
assert.equal(overwrite.state.watchlist[id10], "watching");
assert.equal(overwrite.state.rate[id10], 4);
assert.deepEqual(overwrite.state.watchedEpisodes[id10], [1, 2, 3, 4], "imported progress is unioned with local marks");

assert.deepEqual(mergeImportedLibrary({}, []).state.watchlist, {});
assert.throws(() => mapShikimoriRates(null), /неожиданный ответ/);

console.log("✓ library import mapping and merge checks passed");
