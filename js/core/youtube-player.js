import { PlayerAdapter } from "./player-adapter.js";
import { t } from "../i18n/index.js";

let apiPromise;

function loadApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const previous = window.onYouTubeIframeAPIReady;
    const finish = error => {
      clearTimeout(timer);
      if (window.onYouTubeIframeAPIReady === ready) window.onYouTubeIframeAPIReady = previous;
      if (error) {
        script.remove();
        reject(error);
      } else {
        resolve(window.YT);
      }
    };
    const ready = () => {
      finish(window.YT?.Player ? null : new Error("YouTube API unavailable"));
      if (typeof previous === "function") previous();
    };
    const timer = setTimeout(() => finish(new Error("YouTube API timeout")), 12000);
    window.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => finish(new Error("YouTube API unavailable"));
    document.head.append(script);
  });
  return apiPromise.catch(error => {
    apiPromise = null;
    throw error;
  });
}

class YouTubeAdapter extends PlayerAdapter {
  constructor(stage) {
    super();
    const iframe = document.createElement("iframe");
    iframe.className = "stream-video";
    iframe.title = "YouTube · Español latino";
    iframe.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    stage.style.setProperty("min-height", "200px", "important");
    this.stage = stage;
    stage.replaceChildren(iframe);
    this.iframe = iframe;
    this.state = { time: 0, duration: 0, speed: 1, playing: false, buffering: false };
  }

  async load(source) {
    const YT = await loadApi();
    if (this.destroyed) return;
    const url = new URL("https://www.youtube.com/embed/" + source.videoId);
    url.search = new URLSearchParams({ enablejsapi: "1", origin: location.origin, playsinline: "1" }).toString();
    this.iframe.src = url.href;
    this.timer = setTimeout(() => this.fail(), 12000);
    this.player = new YT.Player(this.iframe, {
      events: {
        onReady: ({ target }) => {
          if (this.destroyed || this.failed) return;
          this.player = target;
          clearTimeout(this.timer);
          this.refresh();
          this.poll = setInterval(() => {
            this.refresh();
            this.emit("timeupdate");
          }, 500);
          this.emit("ready");
        },
        onStateChange: ({ data }) => this.changeState(data),
        onPlaybackRateChange: () => {
          if (this.destroyed || this.failed) return;
          this.refresh();
          this.emit("ratechange");
        },
        onAutoplayBlocked: () => {
          if (!this.destroyed && !this.failed) this.emit("autoplayblocked");
        },
        onError: () => this.fail()
      }
    });
  }

  refresh() {
    const player = this.player;
    if (!player) return;
    this.state.time = Number(player.getCurrentTime()) || 0;
    this.state.duration = Number(player.getDuration()) || 0;
    this.state.speed = Number(player.getPlaybackRate()) || 1;
  }

  changeState(code) {
    if (this.destroyed || this.failed) return;
    const { state } = this;
    state.buffering = code === 3;
    // Buffering preserves the playback intent until YouTube reports pause or end.
    if (code === 1) state.playing = true;
    if ([0, 2, 5, -1].includes(code)) state.playing = false;
    this.refresh();
    const event = { 0: "ended", 1: "play", 2: "pause", 3: "buffering" }[code];
    if (event) this.emit(event);
  }

  fail() {
    if (this.destroyed || this.failed) return;
    this.failed = true;
    clearTimeout(this.timer);
    clearInterval(this.poll);
    this.emit("error");
  }

  async play() { this.player.playVideo(); }
  async pause() { this.player.pauseVideo(); }
  async seek(seconds) {
    // seekTo() starts an unstarted YouTube video. Keep a paused room paused.
    const paused = !this.state.playing;
    this.player.seekTo(seconds, true);
    if (paused) this.player.pauseVideo();
  }
  async setPlaybackRate(rate) {
    if (this.player.getAvailablePlaybackRates().includes(rate)) this.player.setPlaybackRate(rate);
  }

  destroy() {
    this.destroyed = true;
    clearTimeout(this.timer);
    clearInterval(this.poll);
    this.player?.destroy();
    this.iframe.remove();
    this.stage.style.removeProperty("min-height");
  }
}

export function mountOfficialYouTube({ stage, options, source, setStatus, onReady, onEvent, changed }) {
  const link = document.createElement("a");
  link.href = "https://www.youtube.com/watch?v=" + source.videoId;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = t("youtubeOpen");
  const publisher = document.createElement("span");
  publisher.textContent = source.channel;
  options.replaceChildren(publisher, link);

  const player = new YouTubeAdapter(stage);
  let compatibility = "loading";
  setStatus(t("syncTesting"));
  player.on("ready", () => {
    compatibility = "ready";
    setStatus(t("syncReady"));
    changed();
    onReady();
  });
  player.on("error", () => {
    compatibility = "unsupported";
    setStatus(t("youtubeUnavailable"));
    changed();
  });
  player.on("autoplayblocked", () => setStatus(t("alignHint")));
  for (const event of ["play", "pause", "buffering", "ended", "timeupdate", "ratechange"]) {
    player.on(event, () => onEvent(event));
  }
  player.load(source).catch(() => player.fail());

  return {
    sourceId: source.videoId,
    get compatibility() { return compatibility; },
    get adapter() { return compatibility === "ready" ? player : null; },
    destroy() { player.destroy(); }
  };
}
