import { PlayerJsAdapter } from "./player-adapter.js";
import { getSupabaseClient } from "./supabase.js";
import { t } from "../i18n/index.js";
import { readPreference, writePreference } from "./room-settings.js";

const origin = "https://jkanime.net";
const slugPattern = /^[a-z0-9][a-z0-9-]{0,119}$/;
const normalize = value => String(value ?? "").normalize("NFKD").toLowerCase()
  .replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const formats = {tv:"serie", movie:"pelicula", ova:"ova", ona:"ona", special:"especial"};
const languages = {latino:"jkLatino",sub:"jkSub"};

async function lookup(params) {
  const client = await getSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session) throw new Error("jkAuth");
  const { data, error } = await client.functions.invoke("jkanime-catalog?" + new URLSearchParams(params), {
    method:"GET", signal:AbortSignal.timeout(12000)
  });
  if (error) {
    const status = error.context?.status;
    throw new Error(status === 401 ? "jkAuth" : status === 429 ? "avRateLimit" : status === 404 ? "jkNoEpisode" : "jkUnavailable");
  }
  return data;
}

function control(tag, text, props) {
  const element = document.createElement(tag);
  element.textContent = text;
  Object.assign(element,props);
  return element;
}

export function matchJKAnime(anime, candidates) {
  const known = [anime.o, anime.romaji, anime.japanese, anime.english, ...(anime.synonyms || []), anime.n]
    .map(normalize).filter(Boolean);
  const kind = formats[normalize(anime.kind)];
  const year = Number(anime.y);
  const episodes = Number(anime.e || anime.episodes);
  const matches = candidates.filter(item => known.includes(normalize(item.title)) && kind === item.kind &&
    year > 0 && year === item.year && episodes > 0 && episodes === item.episodes);
  return matches.length === 1 ? matches[0] : null;
}

export function mountJKAnime({options, stage, anime, episode, setStatus, changed, onReady, onEvent, resumeAt}) {
  const titleKey = "aw.jkanime.title." + anime.id;
  const audioKey = "aw.jkanime.audio." + anime.id;
  const defaultQuery = anime.romaji || anime.o || anime.english || anime.n || "";
  let revision = 0;
  let adapter;
  let slug;
  let selectedLanguage;
  let compatibility = "loading";
  const placeholder = key => stage.replaceChildren(control("div",t(key),{className:"stream-placeholder"}));
  const report = (key, state) => {
    compatibility = state;
    setStatus(t(key));
    changed();
  };
  const clearPlayer = () => { adapter?.destroy(); adapter = null; };
  const fallbackLink = () => {
    const link = control("a",t("jkOpen"),{href:origin+"/"+slug+"/"+episode+"/",target:"_blank",rel:"noopener noreferrer"});
    return link;
  };

  function showSearch(auto = true) {
    revision++;
    slug = selectedLanguage = null;
    clearPlayer();
    let candidates = [];
    const box = control("form","",{className:"av-search"});
    const input = control("input","",{type:"search",value:defaultQuery,maxLength:120,required:true});
    input.setAttribute("aria-label",t("avTitle"));
    const search = control("button",t("avSearch"),{type:"submit"});
    const select = control("select","",{hidden:true});
    select.setAttribute("aria-label",t("avTitle"));
    const choose = control("button",t("avConfirm"),{type:"button",hidden:true});
    const row = control("div","",{className:"av-search"});
    box.append(input,search);
    row.append(select,choose);
    options.replaceChildren(box,row);
    choose.onclick = () => { if (candidates.some(item => item.slug === select.value)) void open(select.value,true); };
    box.onsubmit = event => { event.preventDefault(); void find(false); };
    async function find(auto) {
      const query = input.value.trim();
      if (!query) return;
      const current = ++revision;
      placeholder("jkLoading");
      report("jkLoading","loading");
      select.hidden = choose.hidden = true;
      search.disabled = true;
      try {
        const result = await lookup({q:query});
        if (revision !== current) return;
        candidates = (Array.isArray(result?.results) ? result.results : [])
          .filter(item => typeof item.title === "string" && slugPattern.test(item.slug));
        const match = auto ? matchJKAnime(anime,candidates) : null;
        if (match) { void open(match.slug,true); return; }
        select.replaceChildren(...candidates.map(item => new Option(item.title+" · "+item.slug,item.slug)));
        select.hidden = choose.hidden = !candidates.length;
        const key = candidates.length ? "avConfirm" : "avNoResults";
        placeholder(key);
        report(key,"unsupported");
      } catch (error) {
        if (revision === current) { placeholder(error.message); report(error.message,"unsupported"); }
      } finally { search.disabled = false; }
    }
    void find(auto);
  }

  async function open(candidate, remember) {
    if (!slugPattern.test(candidate)) return;
    const current = ++revision;
    slug = candidate;
    if (remember) writePreference(titleKey,slug);
    selectedLanguage = null;
    clearPlayer();
    const change = control("button",t("avChange"),{type:"button"});
    change.onclick = () => showSearch(false);
    const row = control("div","",{className:"av-search"});
    row.append(change);
    options.replaceChildren(row);
    placeholder("jkLoading");
    report("jkLoading","loading");
    try {
      const result = await lookup({slug,episode});
      if (revision !== current) return;
      const available = Object.keys(languages).filter(language => Array.isArray(result?.available) && result.available.includes(language));
      if (!available.length) { placeholder("jkNoEpisode"); report("jkNoEpisode","unsupported"); return; }
      const select = control("select","");
      select.setAttribute("aria-label",t("avAudio"));
      for (const language of available) select.add(new Option(t(languages[language]),language));
      const previous = readPreference(audioKey);
      select.value = available.includes(previous) ? previous : available[0];
      select.onchange = () => {
        writePreference(audioKey,select.value);
        mount(select.value,result.streams?.[select.value]);
      };
      row.prepend(select);
      row.append(fallbackLink());
      mount(select.value,result.streams?.[select.value]);
    } catch (error) {
      if (revision === current) { placeholder(error.message); report(error.message,"unsupported"); }
    }
  }

  function mount(language, embed) {
    clearPlayer();
    selectedLanguage = language;
    let url;
    try { url = new URL(embed); } catch {}
    if (!url || url.origin !== "https://streamtape.com" || url.username || url.password || url.search || url.hash ||
      !/^\/e\/[\w-]{5,64}(?:\/[\w.-]{1,120})?\/?$/.test(url.pathname)) {
      placeholder("jkNoEmbed");
      report("jkNoEmbed","unsupported");
      return;
    }
    const frame = control("iframe","",{className:"stream-video",title:"JKAnime · "+t(languages[language]),
      allow:"autoplay; fullscreen; picture-in-picture",allowFullscreen:true,referrerPolicy:"strict-origin-when-cross-origin"});
    frame.setAttribute("sandbox","allow-scripts allow-same-origin allow-presentation");
    stage.replaceChildren(frame);
    const mounted = new PlayerJsAdapter(frame,{verifyPlayback:true});
    adapter = mounted;
    mounted.on("ready",()=>{
      if (adapter !== mounted) return;
      report("syncReady","ready");
      if (resumeAt >= 5) void mounted.seek(Math.min(resumeAt,Math.max(0,mounted.state.duration-3)));
      onReady();
    });
    mounted.on("error",()=>{
      if (adapter === mounted) report("jkNoSync","unsupported");
    });
    for (const event of ["play","pause","seeked","timeupdate","ended"]) {
      mounted.on(event,()=>{ if (adapter === mounted && compatibility === "ready") onEvent(event); });
    }
    report("syncTesting","loading");
    void mounted.load({url:url.href});
  }

  const saved = readPreference(titleKey);
  if (saved && slugPattern.test(saved)) void open(saved,false);
  else showSearch();
  return {
    get adapter() { return compatibility === "ready" ? adapter : null; },
    get compatibility() { return compatibility; },
    get sourceId() { return slug && selectedLanguage ? slug+":"+selectedLanguage : null; },
    destroy() { revision++; clearPlayer(); }
  };
}
