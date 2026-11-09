import assert from "node:assert/strict";
import { buildTasteProfile, rankRecommendations } from "../js/core/recommendations.js";

const profile = buildTasteProfile([
  { genres: ["Фэнтези", "Экшен"], rating: 10 },
  { genres: ["Романтика"], rating: 3 }
]);

assert.ok(profile.topGenres.some(item => item.name === "фэнтези"), "high ratings should strengthen favorite genres");
assert.ok(profile.avoidedGenres.some(item => item.name === "романтика"), "low ratings should lower disliked genres");

const candidates = [
  { id: 1000000001, mal: 101, g: ["Фэнтези"], r: 7.5 },
  { id: 1000000002, mal: 202, g: ["Романтика"], r: 10 },
  { id: 1000000003, mal: 303, g: ["Комедия"], r: 9 }
];
const ranked = rankRecommendations(candidates, profile, new Set(), 3);
assert.equal(ranked[0].anime.id, 1000000001, "genre match should rank above a generic popular title");
assert.match(ranked[0].reason, /фэнтези/i, "recommendations should explain the match");

const filtered = rankRecommendations(candidates, profile, new Set([1000000001, "mal:202"]), 3);
assert.deepEqual(filtered.map(item => item.anime.id), [1000000003], "seen IDs and matching MAL IDs should be excluded");

const coldProfile = buildTasteProfile([]);
const fallback = rankRecommendations([{ id: 42, g: ["Комедия"], r: 8 }], coldProfile, new Set(), 1);
assert.match(fallback[0].reason, /собираем твои предпочтения/i, "new users should receive a non-personalized starter recommendation");

console.log("✓ recommendation scoring, negative signals, duplicate filtering, and cold-start fallback");
