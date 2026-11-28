const positiveId = value => Number.isSafeInteger(value) && value > 0;
const seconds = value => Number.isFinite(value) && value >= 0 && value <= 86400;

export function readRoomPlayback(payload) {
  if (payload?.host !== true || !positiveId(payload.animeId) || !positiveId(payload.episode) ||
    payload.episode > 10000 || !positiveId(payload.sequence) || !positiveId(payload.sentAt) ||
    !seconds(payload.position) || !seconds(payload.duration) || typeof payload.playing !== "boolean" ||
    !Number.isFinite(payload.playbackRate) || payload.playbackRate < 0.25 || payload.playbackRate > 4 ||
    typeof payload.buffering !== "boolean") return null;
  return {
    animeId: payload.animeId, episode: payload.episode, position: payload.position,
    duration: payload.duration, playing: payload.playing, playbackRate: payload.playbackRate,
    sentAt: payload.sentAt, sequence: payload.sequence, buffering: payload.buffering
  };
}

export function roomPosition(state, hostTime, offset = 0) {
  const age = state.playing && !state.buffering ? Math.min(12, Math.max(0, hostTime - state.sentAt) / 1000) : 0;
  return Math.max(0, state.position + age * state.playbackRate + offset);
}

export function playbackCorrection({ time, duration, speed, playing, buffering, precise = true, rateControl = true }, state) {
  const target = duration > 0 ? Math.min(state.time, Math.max(0, duration - 0.25)) : state.time;
  const drift = target - time;
  const distance = Math.abs(drift);
  const desiredPlaying = state.playing && !state.buffering && !(duration > 0 && state.time >= duration);
  const seekThreshold = state.playing ? 1 : (precise ? 0.25 : 1);
  const baseRate = state.speed;
  const correctionRate = desiredPlaying && !buffering && distance > 0.25 && distance <= 1
    ? Math.min(4, Math.max(0.25, baseRate * (drift > 0 ? 1.08 : 0.92))) : baseRate;
  return {
    drift,
    seek: !buffering && distance > seekThreshold ? target : null,
    rate: rateControl && Math.abs(speed - correctionRate) > 0.015 ? correctionRate : null,
    playing: playing === desiredPlaying || (desiredPlaying && buffering) ? null : desiredPlaying
  };
}
