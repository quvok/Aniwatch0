export class PlayerAdapter extends EventTarget {
  on(event, callback) {
    const listener = value => callback(value.detail);
    this.addEventListener(event, listener);
    return () => this.removeEventListener(event, listener);
  }

  emit(event, detail) {
    this.dispatchEvent(new CustomEvent(event, { detail }));
  }
}

export class VideoAdapter extends PlayerAdapter {
  constructor(video, loadHls) {
    super();
    this.video = video;
    this.loadHls = loadHls;
    this.listeners = new AbortController();
    const events = {
      loadedmetadata: "ready", play: "play", pause: "pause", seeked: "seeked",
      timeupdate: "timeupdate", ratechange: "ratechange", ended: "ended",
      waiting: "buffering", stalled: "buffering", playing: "playing", error: "error"
    };
    for (const [name, event] of Object.entries(events)) {
      video.addEventListener(name, () => this.emit(event), { signal: this.listeners.signal });
    }
  }

  async load(source) {
    const video = this.video;
    if (source.kind === "mp4" || video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = source.url;
      return;
    }
    const Hls = await this.loadHls();
    if (this.listeners.signal.aborted) return;
    if (!Hls.isSupported()) throw new Error("HLS unavailable");
    this.hls = new Hls();
    this.hls.on(Hls.Events.ERROR, (_, data) => { if (data.fatal) this.emit("error"); });
    this.hls.attachMedia(video);
    this.hls.loadSource(source.url);
  }

  async play() { return this.video.play(); }
  async pause() { this.video.pause(); }
  async seek(seconds) { this.video.currentTime = seconds; }
  async getCurrentTime() { return this.video.currentTime; }
  async getDuration() { return this.video.duration; }
  async setPlaybackRate(rate) { this.video.playbackRate = rate; }
  async getPlaybackRate() { return this.video.playbackRate; }
  async isPlaying() { return !this.video.paused && !this.video.ended; }

  destroy() {
    this.listeners.abort();
    this.hls?.destroy();
    this.video.pause();
    this.video.removeAttribute("src");
    this.video.load();
    this.video.remove();
  }
}

const requiredMethods = ["play", "pause", "setCurrentTime"];
const requiredEvents = ["play", "pause", "timeupdate", "ended"];

export class PlayerJsAdapter extends PlayerAdapter {
  constructor(frame) {
    super();
    this.frame = frame;
    this.state = { time: 0, duration: 0, speed: 1, playing: false, buffering: false };
    this.listeners = new AbortController();
    window.addEventListener("message", event => this.receive(event), { signal: this.listeners.signal });
  }

  async load(source) {
    const url = new URL(source.url);
    this.origin = url.origin;
    this.frame.src = url.href;
    this.timer = setTimeout(() => this.emit("error"), 10000);
  }

  receive(event) {
    if (event.source !== this.frame.contentWindow || event.origin !== this.origin) return;
    let data = event.data;
    if (typeof data === "string") {
      if (data.length > 8192) return;
      try { data = JSON.parse(data); } catch { return; }
    }
    if (data?.context !== "player.js" || data.version !== "0.0.11") return;
    if (data.event === "ready" && !this.ready) {
      const methods = data.value?.methods;
      const events = data.value?.events;
      if (!Array.isArray(methods) || !Array.isArray(events) ||
        !requiredMethods.every(method => methods.includes(method)) ||
        !requiredEvents.every(name => events.includes(name))) return;
      clearTimeout(this.timer);
      this.ready = true;
      for (const name of [...requiredEvents, "seeked", "error"].filter(name => events.includes(name))) {
        this.send("addEventListener", name, "aw-event-" + name);
      }
      for (const method of ["getDuration", "getCurrentTime", "getPaused"]) {
        if (methods.includes(method)) this.send(method, undefined, "aw-initial-" + method);
      }
      this.emit("ready");
      return;
    }
    if (!this.ready) return;
    if (data.listener === "aw-initial-" + data.event) {
      if (data.event === "getDuration" && Number.isFinite(data.value) && data.value > 0) this.state.duration = data.value;
      if (data.event === "getCurrentTime" && Number.isFinite(data.value) && data.value >= 0) this.state.time = data.value;
      if (data.event === "getPaused" && typeof data.value === "boolean") this.state.playing = !data.value;
      return;
    }
    if (!["play", "pause", "timeupdate", "ended", "seeked", "error"].includes(data.event) ||
      (data.listener && data.listener !== "aw-event-" + data.event)) return;
    const seconds = data.value?.seconds;
    const duration = data.value?.duration;
    if (Number.isFinite(seconds) && seconds >= 0) this.state.time = seconds;
    if (Number.isFinite(duration) && duration > 0) this.state.duration = duration;
    if (data.event === "play") this.state.playing = true;
    if (data.event === "pause" || data.event === "ended") this.state.playing = false;
    this.emit(data.event);
  }

  send(method, value, listener) {
    if (!this.ready) return;
    this.frame.contentWindow?.postMessage(JSON.stringify({
      context: "player.js", version: "0.0.11", method, value, listener
    }), this.origin);
  }

  async play() { this.send("play"); }
  async pause() { this.send("pause"); }
  async seek(seconds) { this.send("setCurrentTime", seconds); }
  async getCurrentTime() { return this.state.time; }
  async getDuration() { return this.state.duration; }
  async setPlaybackRate() { return false; }
  async getPlaybackRate() { return 1; }
  async isPlaying() { return this.state.playing; }

  destroy() {
    clearTimeout(this.timer);
    this.ready = false;
    this.listeners.abort();
    this.frame.remove();
  }
}
