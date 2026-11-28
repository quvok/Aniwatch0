// Only episodes published by the rights holder are listed here.
const catalog = new Map([
  // Beyblade X (2023), BEYBLADE Español – Canal Oficial, Latin American dub.
  [56566, { channel: "BEYBLADE Español – Canal Oficial", episodes: ["MeBl-euZkYQ", "Z3Wrw18sVh0"] }]
]);

export function getOfficialYouTubeEpisode(anime, episode) {
  if (!Number.isSafeInteger(episode) || episode < 1) return null;
  const shikiId = Number(anime?.shikiId) || (anime?.source === "shikimori" ? Number(anime.id) - 1000000000 : 0);
  const series = catalog.get(shikiId || Number(anime?.mal));
  const videoId = series?.episodes[episode - 1];
  return videoId ? { videoId, channel: series.channel } : null;
}
