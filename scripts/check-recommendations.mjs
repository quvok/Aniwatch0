import assert from "node:assert/strict";
import { buildTasteProfile, rankRecommendations, normalizeRecommendationGenre } from "../js/core/recommendations.js";

assert.equal(normalizeRecommendationGenre("Sci-Fi"), "фантастика");
assert.equal(normalizeRecommendationGenre("Научная фантастика"), "фантастика");
assert.equal(normalizeRecommendationGenre("Action"), "экшен");
assert.equal(normalizeRecommendationGenre("Боевик"), "экшен");

const profile = buildTasteProfile([
  { genres: ["Fantasy", "Action"], rating: 10, status: "completed" },
  { genres: ["Фэнтези", "Приключения"], favorite: true },
  { genres: ["Романтика"], rating: 3 }
]);

assert.ok(profile.topGenres.some(item => item.name === "фэнтези"), "English and Russian genre labels should merge");
assert.ok(profile.topGenres.some(item => item.name === "экшен"), "English Action should map to Russian Экшен");
assert.ok(profile.avoidedGenres.some(item => item.name === "романтика"), "low ratings should lower disliked genres");

const candidates = [
  { id: 1000000001, mal: 101, g: ["Фэнтези"], r: 7.5 },
  { id: 1000000002, mal: 202, g: ["Романтика"], r: 10 },
  { id: 1000000003, mal: 303, g: ["Комедия"], r: 9 },
  { id: 1000000004, mal: 404, g: ["Фантастика", "Приключения"], r: 8.1 },
  { id: 1000000005, mal: 101, g: ["Фэнтези"], r: 9 }
];
const ranked = rankRecommendations(candidates, profile, new Set(), 5);
assert.equal(ranked[0].anime.id, 1000000001, "the strongest preferred genre should rank first");
assert.ok(ranked.some(item => item.anime.id === 1000000004), "cross-language genre aliases should still match candidates");
assert.match(ranked[0].reason, /фэнтези/i, "recommendations should explain matching genres");
assert.ok(!ranked.some(item => item.anime.id === 1000000002), "strongly disliked genres should be excluded");

const filtered = rankRecommendations(candidates, profile, new Set([1000000001, "mal:404"]), 5);
assert.ok(!filtered.some(item => item.anime.id === 1000000001 || item.anime.id === 1000000004), "seen IDs and MAL IDs should be excluded");

const singleSignal = buildTasteProfile([{ genres: ["Фэнтези"], rating: 9 }]);
assert.equal(singleSignal.usefulSignals, 1, "one meaningful rating should be enough to build a taste profile");
assert.ok(rankRecommendations([{ id: 42, g: ["Fantasy"], r: 8 }], singleSignal, new Set(), 1).length,
  "a single meaningful taste signal should produce a personal recommendation");

const coldProfile = buildTasteProfile([]);
assert.equal(rankRecommendations([{ id: 43, g: ["Комедия"], r: 8 }], coldProfile, new Set(), 1).length, 0,
  "cold-start users should not receive generic titles mislabeled as personal recommendations");

console.log("✓ cross-language genre matching, one-signal profiles, negative preferences, duplicate filtering");
