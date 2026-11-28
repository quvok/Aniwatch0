import { animeAV1MappingKey, findAnimeAV1Title, getAnimeAV1Episode, getAnimeAV1Title, searchAnimeAV1 } from "../api/animeav1.js";
import { t } from "../i18n/index.js";
import { PlayerJsAdapter, VideoAdapter } from "./player-adapter.js";

function read(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function node(tag, text, attributes = {}) {
  const element = document.createElement(tag);
  element.textContent = text;
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
}

export function mountAnimeAV1({ options, stage, anime, episode, setStatus, loadHls, bindVideo, changed, onReady, onEvent }) {
  const mappingKey = animeAV1MappingKey(anime.id);
  const audioKey = "aw.animeav1.audio." + anime.id;
  const serverKey = "aw.animeav1.server." + anime.id;
  let title;
  let sources = [];
  let adapter;
  let generation = 0;
  let dead = false;
  let selection;
  let compatibility = "loading";
  const live = ticket => !dead && generation === ticket;
  const placeholder = message => stage.replaceChildren(node("div", message, { class: "stream-placeholder" }));
  const update = () => changed({ id: selection?.id, compatibility });
  const report = (message, state) => {
    compatibility = state;
    setStatus(t(message));
    update();
  };

  function showSearch(candidates = []) {
    generation++;
    adapter?.destroy();
    adapter = null;
    selection = null;
    placeholder(t("avTitle"));
    const input = node("input", "", { type: "search", "aria-label": t("avTitle"), maxlength: "180" });
    input.value = anime.o || anime.n || "";
    const search = node("button", t("avSearch"), { type: "submit" });
    const searchForm = node("form", "", { class: "av-search" });
    const list = node("select", "", { "aria-label": t("avTitle") });
    const confirm = node("button", t("avConfirm"), { type: "button" });
    const controls = node("div", "", { class: "av-search" });
    searchForm.append(input, search);
    controls.append(list, confirm);
    options.replaceChildren(searchForm, controls);
    function render(results) {
      list.replaceChildren(...results.slice(0, 25).map(item => node("option", item.title + " · " + (item.type || "") + " · " + item.slug, { value: item.slug })));
      controls.hidden = !results.length;
    }
    render(candidates);
    report(candidates.length ? "avConfirm" : "avNoResults", "unsupported");
    searchForm.addEventListener("submit", async event => {
      event.preventDefault();
      const ticket = ++generation;
      search.disabled = true;
      confirm.disabled = true;
      try {
        const results = await searchAnimeAV1(input.value);
        if (!live(ticket)) return;
        render(results);
        report(results.length ? "avConfirm" : "avNoResults", "unsupported");
      } catch (error) {
        if (live(ticket)) report(error.status === 429 ? "avRateLimit" : "avUnavailable", "unsupported");
      } finally {
        search.disabled = false;
        confirm.disabled = false;
      }
    });
    confirm.onclick = () => open(list.value, true);
  }

  function showSources() {
    const audio = node("select", "", { "aria-label": t("avAudio") });
    const server = node("select", "", { "aria-label": t("avServer") });
    const manual = node("button", t("avChange"), { type: "button" });
    const link = node("a", t("avOpen"), { target: "_blank", rel: "noopener noreferrer" });
    const hasDub = sources.some(source => source.type === "DUB");
    const hasSub = sources.some(source => source.type === "SUB");
    if (hasDub) audio.add(node("option", t("avDub"), { value: "DUB" }));
    if (hasSub) audio.add(node("option", t("avSub"), { value: "SUB" }));
    audio.value = read(audioKey) === "SUB" && hasSub ? "SUB" : hasDub ? "DUB" : "SUB";
    const note = node("small", hasDub ? "" : t("avNoDub"));
    const audioLabel = node("label", t("avAudio"));
    const serverLabel = node("label", t("avServer"));
    audioLabel.append(audio);
    serverLabel.append(server);
    options.replaceChildren(node("span", title.title, { "data-user-text": "" }), audioLabel, serverLabel, manual, link, note);
    manual.onclick = () => showSearch([{ slug: title.slug, title: title.title, type: title.type }]);
    const selectSource = () => {
      selection = sources.find(source => source.id === server.value);
      if (!selection) return;
      link.href = selection.url;
      mountSource(selection);
    };
    function refreshServers() {
      const filtered = sources.filter(source => source.type === audio.value);
      server.replaceChildren(...filtered.map(source => node("option",
        source.name + (source.kind === "iframe" ? " · " + t("syncUnsupported") : ""),
        { value: source.id })));
      const saved = read(serverKey);
      if (filtered.some(source => source.id === saved)) server.value = saved;
      selectSource();
    }
    audio.onchange = () => { write(audioKey, audio.value); refreshServers(); };
    server.onchange = () => { write(serverKey, server.value); selectSource(); };
    refreshServers();
  }

  function mountSource(source) {
    adapter?.destroy();
    adapter = null;
    if (source.kind === "mp4" || source.kind === "hls") {
      const el = node("video", "", { class: "stream-video", controls: "", playsinline: "", preload: "metadata" });
      stage.replaceChildren(el);
      bindVideo(el);
      adapter = new VideoAdapter(el, loadHls);
    } else {
      const frame = node("iframe", "", {
        class: "stream-video", title: "AnimeAV1 · " + source.name,
        allow: "autoplay; fullscreen; picture-in-picture", allowfullscreen: "",
        sandbox: "allow-scripts allow-same-origin allow-presentation",
        referrerpolicy: "strict-origin-when-cross-origin"
      });
      stage.replaceChildren(frame);
      if (source.kind === "iframe") {
        frame.src = source.url;
        report("syncUnsupported", "unsupported");
        return;
      }
      adapter = new PlayerJsAdapter(frame);
      for (const name of ["play", "pause", "timeupdate", "seeked", "ended"]) adapter.on(name, () => onEvent(name));
    }
    const mounted = adapter;
    report("syncTesting", "loading");
    const fail = () => {
      if (adapter !== mounted) return;
      report("avFailed", "unsupported");
    };
    mounted.on("ready", () => {
      if (adapter !== mounted) return;
      report("syncReady", "ready");
      onReady();
    });
    mounted.on("error", fail);
    mounted.load(source).catch(fail);
  }

  async function open(slug, confirm = false) {
    const ticket = ++generation;
    report("avLoading", "loading");
    placeholder(t("avLoading"));
    options.replaceChildren();
    try {
      let nextTitle = slug ? await getAnimeAV1Title(slug) : null;
      if (!nextTitle) {
        const { match, candidates } = await findAnimeAV1Title(anime);
        if (!live(ticket)) return;
        if (!match) { showSearch(candidates); return; }
        nextTitle = match;
      }
      if (!live(ticket)) return;
      title = nextTitle;
      if (confirm) write(mappingKey, title.slug);
      if (!title.episodes.some(item => item.number === episode)) throw Object.assign(new Error(), { status: 404 });
      const data = await getAnimeAV1Episode(title.slug, episode);
      if (!live(ticket)) return;
      sources = data.sources;
      if (!sources.length) throw Object.assign(new Error(), { noSources: true });
      showSources();
    } catch (error) {
      if (!live(ticket)) return;
      const message = error.status === 404 ? "avNoEpisode" : error.noSources ? "avNoSources" :
        error.status === 429 ? "avRateLimit" : "avUnavailable";
      report(message, "unsupported");
      placeholder(t(message));
      const retry = node("button", t("avRetry"), { type: "button" });
      const manual = node("button", t("avChange"), { type: "button" });
      retry.onclick = () => open(slug, confirm);
      manual.onclick = () => showSearch();
      options.replaceChildren(retry, manual);
    }
  }

  open(read(mappingKey));
  return {
    get adapter() { return compatibility === "ready" ? adapter : null; },
    get sourceId() { return selection?.id; },
    get compatibility() { return compatibility; },
    destroy() { dead = true; adapter?.destroy(); adapter = null; }
  };
}
