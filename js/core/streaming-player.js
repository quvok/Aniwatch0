import {searchKodikAnime,getKodikEpisodeLink} from "../api/kodik.js";
const LIBERTY_BASES=["https://api.anilibria.app/api/v1","https://aniliberty.top/api/v1"];
let hlsLoader=null,hlsInstance=null;
const textOf=v=>typeof v==="string"?v:v&&typeof v==="object"?(v.main||v.english||v.russian||""):"";
const releaseName=r=>textOf(r?.name)||r?.title||r?.name_english||r?.alias||"Без названия";
const clean=s=>String(s||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/gi," ").trim();
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function requestJson(url,timeout=9000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error("HTTP "+response.status);return await response.json()}finally{clearTimeout(timer)}}
async function libertyRequest(path){const tasks=LIBERTY_BASES.map(base=>requestJson(base+path,6500));let last;for(const task of tasks){try{return await task}catch(error){last=error}}throw last||new Error("Резервный плеер недоступен")}
function loadHls(){if(window.Hls)return Promise.resolve(window.Hls);if(hlsLoader)return hlsLoader;hlsLoader=new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js";script.async=true;script.onload=()=>window.Hls?resolve(window.Hls):reject(new Error("HLS.js не загрузился"));script.onerror=()=>{script.remove();reject(new Error("Не удалось загрузить HLS-плеер"))};document.head.appendChild(script)});return hlsLoader.catch(error=>{hlsLoader=null;throw error})}
const releaseNames=r=>{const n=r?.name||{};return [...new Set([n.main,n.english,n.alternative,n.russian,r?.title,r?.name_english,r?.name_ru,r?.alias,...(Array.isArray(r?.names)?r.names:[])].map(textOf).map(x=>String(x||"").trim()).filter(Boolean))]};
const animeNames=anime=>[anime?.n,anime?.o,anime?.title,anime?.originalTitle].map(x=>String(x||"").trim()).filter(Boolean);
const scoreRelease=(r,anime)=>{const candidates=releaseNames(r).map(clean).filter(Boolean),wanted=animeNames(anime).map(clean).filter(Boolean);if(!candidates.length||!wanted.length)return 99;let best=99;for(const a of candidates)for(const b of wanted){if(a===b)best=0}return best};
async function searchLibertyReleases(anime){const names=[...new Set(animeNames(anime))];let all=[];for(const query of names){try{const result=await libertyRequest("/app/search/releases?query="+encodeURIComponent(query));const list=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:Array.isArray(result?.list)?result.list:[];all.push(...list)}catch(error){console.warn("[AniWatch] AniLiberty search failed:",error)}}const unique=[...new Map(all.filter(x=>x&&x.id).map(x=>[String(x.id),x])).values()];return unique.map(release=>({release,score:scoreRelease(release,anime)})).filter(x=>x.score===0).sort((a,b)=>a.score-b.score).map(x=>x.release)}
async function getLibertyRelease(id){return libertyRequest("/anime/releases/"+encodeURIComponent(id))}
async function getLibertyEpisode(id){return libertyRequest("/anime/releases/episodes/"+encodeURIComponent(id))}
function getLibertyEpisodeNumber(ep){return Number(ep?.ordinal??ep?.sort_order??0)}
function getLibertyStreams(ep){
 const h=ep?.hls||{};
 const urls=[ep?.hls_1080,h.hls_1080,ep?.hls_720,h.hls_720,ep?.hls_480,h.hls_480];
 return [...new Set(urls.filter(v=>typeof v==="string"&&v.indexOf("http")===0))];
}

const ANIMELIB_EPISODE_APIS=["https://api.cdnlibs.org/api/episodes","https://api.lib.social/api/episodes"];
async function requestAnimeLibEpisodes(shikiId){
 const errors=[];
 for(const base of ANIMELIB_EPISODE_APIS){
  for(let attempt=0;attempt<3;attempt++){
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),11000);
    let response;
    try{
     response=await fetch(base+"?shiki_id="+encodeURIComponent(shikiId),{
      headers:{Accept:"application/json","Site-Id":"5"},
      referrer:"https://v5.animelib.org/",
      referrerPolicy:"strict-origin-when-cross-origin",
      signal:controller.signal
     });
    }finally{clearTimeout(timer)}
    if(!response.ok){
     const error=new Error("HTTP "+response.status+" ("+new URL(base).host+")");
     if(response.status>=500&&attempt<2){await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));continue}
     throw error;
    }
    const payload=await response.json();
    if(!payload||(!Array.isArray(payload.data)&&!Array.isArray(payload)))throw new Error("Список серий вернул неожиданный формат ответа");
    return payload;
   }catch(error){
    errors.push(error?.message||"ошибка запроса");
    const retryable=/HTTP 5\d\d|Failed to fetch|NetworkError|AbortError/i.test((error?.message||"")+" "+(error?.name||""));
    if(attempt<2&&retryable){await new Promise(resolve=>setTimeout(resolve,500*(attempt+1)));continue}
    break;
   }
  }
 }
 throw new Error("Список серий недоступен: "+[...new Set(errors)].join("; "));
}
export function mountStreamPlayer({root,anime,episode,onPlayback=()=>{},onEpisodeEnded=()=>{},resumeAt=0,resumeSpeed=1}){
 if(!root)return {destroy(){},getPlaybackState(){return null},syncPlayback(){}};
 if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}
 root.innerHTML=`
 <div class="aw-player-shell">
  <div class="aw-player-heading"><div class="aw-player-brand"><span class="aw-player-logo">N</span><div><b>AniWatch <i>PLAYER</i></b><small>${esc(anime?.n||"Просмотр аниме")} <span>·</span> серия ${episode}</small></div></div><span class="aw-player-chip"><i></i> ОСНОВНОЙ ПЛЕЕР</span></div>
  <div class="aw-player-controls"><div class="stream-provider-tabs"><button type="button" class="on" data-provider="kodik">Основной <em>Рекомендуем</em></button><button type="button" data-provider="liberty">Резервный 1</button><button type="button" data-provider="animevost">Резервный 2 <em>RU</em></button><button type="button" data-provider="animelib">Дополнительный</button></div><div class="stream-options" id="stream-options"></div></div>
  <div class="stream-stage" id="stream-stage"><div class="stream-placeholder"><span class="stream-placeholder-mark">AW</span><b>Выберите плеер</b><small>Плеер загружается только после выбора источника</small></div></div>
  <div class="aw-player-footer"><span class="stream-status" id="stream-status" role="status">Основной плеер</span><button type="button" class="aw-player-reload" id="player-reload" aria-label="Перезагрузить источник" title="Перезагрузить">↻</button></div>
 </div>`;
 const stage=root.querySelector("#stream-stage"),options=root.querySelector("#stream-options"),status=root.querySelector("#stream-status"),reload=root.querySelector("#player-reload");
 let releases=[],selectedRelease=null,releaseData=null,lastEmit=0,remoteApplying=false,emitTimer=null,remoteApplyTimer=null,lastSentState="",kodikFrame=null,kodikMedia={time:0,duration:0,playing:false,speed:1};
 const setStatus=s=>{if(status)status.textContent=s};
 const destroyHls=()=>{if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}};
 const video=()=>stage.querySelector("video");
 const savedTime=Math.max(0,Number(resumeAt)||0),savedSpeed=Number(resumeSpeed)>0?Number(resumeSpeed):1;
 let savedProgressApplied=false;
 const restoreSavedProgress=el=>{
  if(savedProgressApplied||!el||savedTime<5)return;
  savedProgressApplied=true;
  const target=Number.isFinite(el.duration)&&el.duration>0?Math.min(savedTime,Math.max(0,el.duration-3)):savedTime;
  try{el.currentTime=target;el.playbackRate=savedSpeed;setStatus("Продолжение с "+Math.floor(target/60)+":"+String(Math.floor(target%60)).padStart(2,"0"))}catch(error){console.warn("[AniWatch] Resume position could not be restored:",error)}
 };
 const kodikCommand=value=>{if(!kodikFrame?.contentWindow)return false;try{kodikFrame.contentWindow.postMessage({key:"kodik_player_api",value},"*");return true}catch(error){console.warn("[AniWatch] Kodik command failed:",error);return false}};
 const onKodikMessage=event=>{
  if(!kodikFrame||event.source!==kodikFrame.contentWindow)return;
  let message=event.data;
  if(typeof message==="string"){try{message=JSON.parse(message)}catch{return}}
  if(!message||typeof message!=="object"||typeof message.key!=="string"||!message.key.startsWith("kodik_player_"))return;
  const value=message.value;
  switch(message.key){
   case "kodik_player_play":case "kodik_player_video_started":kodikMedia.playing=true;break;
   case "kodik_player_pause":kodikMedia.playing=false;break;
   case "kodik_player_seek":if(value&&Number.isFinite(Number(value.time)))kodikMedia.time=Number(value.time);break;
   case "kodik_player_time_update":if(Number.isFinite(Number(value)))kodikMedia.time=Number(value);break;
   case "kodik_player_duration_update":if(Number.isFinite(Number(value)))kodikMedia.duration=Number(value);break;
   case "kodik_player_video_ended":kodikMedia.playing=false;try{onEpisodeEnded()}catch(error){console.warn("[AniWatch] Kodik episode-end callback failed:",error)}break;
   case "kodik_player_speed_change":if(value&&Number(value.speed)>0)kodikMedia.speed=Number(value.speed);break;
   case "kodik_player_current_episode":if(value&&Number(value.episode)>0)kodikMedia.episode=Number(value.episode);break;
  }
  if(!remoteApplying)emit(true);
 };
 window.addEventListener("message",onKodikMessage);
 const getPlaybackState=()=>{const v=video();if(v)return {time:Number(v.currentTime)||0,duration:Number.isFinite(v.duration)?Math.max(0,v.duration):0,playing:!v.paused&&!v.ended,speed:Number(v.playbackRate)||1};return kodikFrame?{time:kodikMedia.time,duration:kodikMedia.duration,playing:kodikMedia.playing,speed:kodikMedia.speed}:null};
 const emit=force=>{const state=getPlaybackState();if(!state||remoteApplying)return;const now=Date.now();if(!force&&now-lastEmit<2500)return;if(force){clearTimeout(emitTimer);emitTimer=setTimeout(()=>{if(remoteApplying)return;const latest=getPlaybackState();if(!latest)return;const key=[latest.time.toFixed(1),latest.playing,latest.speed].join("|");if(key===lastSentState)return;lastSentState=key;lastEmit=Date.now();onPlayback(latest)},100);return}const key=[state.time.toFixed(1),state.playing,state.speed].join("|");if(key===lastSentState)return;lastSentState=key;lastEmit=now;onPlayback(state)};
 const bindVideo=el=>{
  el.playbackRate=savedSpeed;
  el.addEventListener("loadedmetadata",()=>restoreSavedProgress(el),{once:true});
  ["play","pause","seeked","ratechange"].forEach(event=>el.addEventListener(event,()=>emit(true)));
  el.addEventListener("timeupdate",()=>emit(false));
  el.addEventListener("ended",()=>{try{onEpisodeEnded()}catch(error){console.warn("[AniWatch] Episode completion callback failed:",error)}});
  el.addEventListener("waiting",()=>setStatus("Буферизация видео…"));
  el.addEventListener("stalled",()=>setStatus("Поток задерживается. Ждём данные…"));
  el.addEventListener("playing",()=>setStatus("Воспроизведение"));
  el.addEventListener("error",()=>setStatus("Ошибка видеопотока. Попробуй другой источник или релиз."));
 };
 const handlePlayerKeys=event=>{
  const v=video();if(!v||event.altKey||event.ctrlKey||event.metaKey)return;
  if(/^(INPUT|SELECT|TEXTAREA|BUTTON|A)$/.test(event.target?.tagName||""))return;
  const key=event.key.toLowerCase();let handled=true;
  if(key===" "||key==="k"){if(v.paused)v.play().catch(()=>{});else v.pause()}
  else if(key==="arrowleft"||key==="j")v.currentTime=Math.max(0,v.currentTime-10);
  else if(key==="arrowright"||key==="l")v.currentTime=Math.min(Number.isFinite(v.duration)?v.duration:Infinity,v.currentTime+10);
  else if(key==="arrowup")v.volume=Math.min(1,v.volume+0.05);
  else if(key==="arrowdown")v.volume=Math.max(0,v.volume-0.05);
  else if(key==="m")v.muted=!v.muted;
  else if(key==="f"){if(!document.fullscreenElement)stage.requestFullscreen?.().catch?.(()=>{});else document.exitFullscreen?.()}
  else handled=false;
  if(handled){event.preventDefault();emit(true)}
 };
 root.addEventListener("keydown",handlePlayerKeys);
 const syncPlayback=async state=>{if(!state)return false;if(kodikFrame){remoteApplying=true;clearTimeout(remoteApplyTimer);remoteApplyTimer=setTimeout(()=>{remoteApplying=false},1200);const target=Math.max(0,Number(state.time)||0),drift=target-kodikMedia.time,speed=Number(state.speed)>0?Number(state.speed):1;if(Math.abs(drift)>1.25)kodikCommand({method:"seek",seconds:target});if(Math.abs(kodikMedia.speed-speed)>0.02)kodikCommand({method:"speed",speed});if(state.playing&&!kodikMedia.playing)kodikCommand({method:"play"});else if(!state.playing&&kodikMedia.playing)kodikCommand({method:"pause"});return true}const v=video();if(!v)return false;remoteApplying=true;clearTimeout(remoteApplyTimer);remoteApplyTimer=setTimeout(()=>{remoteApplying=false},900);const target=Math.max(0,Number(state.time)||0),baseSpeed=Number(state.speed)>0?Number(state.speed):1,drift=target-(Number(v.currentTime)||0),absDrift=Math.abs(drift);try{if(!state.playing){if(absDrift>0.25&&!v.seeking&&v.readyState>=1){try{v.currentTime=target}catch{}}if(Math.abs(v.playbackRate-baseSpeed)>0.01)v.playbackRate=baseSpeed;if(!v.paused)v.pause()}else{if(absDrift>0.65&&!v.seeking&&v.readyState>=1){try{v.currentTime=target}catch{}}const correctedSpeed=absDrift>0.12&&absDrift<=0.65?baseSpeed*(drift>0?1.06:0.94):baseSpeed;if(Math.abs(v.playbackRate-correctedSpeed)>0.01)v.playbackRate=correctedSpeed;if(v.paused&&!v.ended)await v.play().catch(()=>{})}}catch(error){console.warn("[AniWatch] Playback sync failed:",error)}return true};
 const addHlsControls=v=>{const quality=options.querySelector("#liberty-quality"),speed=options.querySelector("#liberty-speed");if(speed)speed.addEventListener("change",()=>{v.playbackRate=Number(speed.value)||1;emit(true)});if(quality)quality.addEventListener("change",()=>{if(hlsInstance)hlsInstance.currentLevel=quality.value==="auto"?-1:Number(quality.value)})};
 const playLiberty=async()=>{
  const eps=Array.isArray(releaseData?.episodes)?releaseData.episodes:[];
  const wanted=eps.find(e=>getLibertyEpisodeNumber(e)===Number(episode));
  if(!wanted)throw new Error("В релизе нет серии "+episode);
  setStatus("Получаем видеопоток…");
  let detail=wanted,streams=getLibertyStreams(detail);
  if(!streams.length&&wanted.id){detail=await getLibertyEpisode(wanted.id);streams=getLibertyStreams(detail)}
  if(!streams.length)throw new Error("Не удалось получить видеопоток для этой серии");
  options.querySelector(".liberty-extra")?.remove();
  const extra=document.createElement("div");
  extra.className="liberty-extra";
  extra.innerHTML='<label>Качество<select id="liberty-quality"><option value="auto">Авто</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label><label>Скорость<select id="liberty-speed"><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="0.75">0.75×</option></select></label>';
  options.appendChild(extra);
  stage.innerHTML='<video class="stream-video" controls playsinline preload="metadata"></video>';
  const v=video();bindVideo(v);
  const labels=["1080p","720p","480p"],qualities=[detail?.hls_1080||detail?.hls?.hls_1080,detail?.hls_720||detail?.hls?.hls_720,detail?.hls_480||detail?.hls?.hls_480];
  const candidates=streams.map(url=>({url,label:labels[qualities.indexOf(url)]||"резерв"}));
  let attempt=0,settled=false;
  const quality=options.querySelector("#liberty-quality");
  const speed=options.querySelector("#liberty-speed");
  if(speed)speed.addEventListener("change",()=>{v.playbackRate=Number(speed.value)||1;emit(true)});
  const fail=reason=>{
   if(attempt+1<candidates.length){attempt++;setStatus("Не загрузилось "+candidates[attempt-1].label+". Переключаемся на "+candidates[attempt].label+"…");startCandidate();return}
   settled=true;setStatus("Ошибка видеопотока: "+reason+". Попробуй другой релиз.");
  };
  const startCandidate=async()=>{
   const current=candidates[attempt];if(!current)return;
   destroyHls();v.pause();v.removeAttribute("src");v.load();
   const nativeHls=/^(?!.*(?:Chrome|Chromium|CriOS|Edg|OPR)).*Safari/i.test(navigator.userAgent)&&v.canPlayType("application/vnd.apple.mpegurl")!=="";
   if(nativeHls){v.src=current.url;setStatus("Резервный плеер · Safari HLS · проверяем "+current.label+"…");return}
   try{
    const Hls=await loadHls();
    if(!Hls.isSupported()){fail("браузер не поддерживает Media Source Extensions (MSE), а нативный HLS недоступен");return}
    const instance=new Hls({enableWorker:true,lowLatencyMode:false,capLevelToPlayerSize:true,backBufferLength:45,maxBufferLength:30});
    hlsInstance=instance;instance.loadSource(current.url);instance.attachMedia(v);
    instance.on(Hls.Events.MANIFEST_PARSED,()=>{
     if(hlsInstance!==instance)return;settled=true;setStatus("Резервный плеер · "+current.label+" · поток готов");
     const q=options.querySelector("#liberty-quality");
     if(q&&instance.levels?.length){q.innerHTML='<option value="auto">Авто</option>'+instance.levels.map((l,i)=>'<option value="'+i+'">'+(l.height?l.height+"p":Math.round(l.bitrate/1000)+" kbps")+'</option>').join("");q.onchange=()=>{if(hlsInstance===instance)instance.currentLevel=q.value==="auto"?-1:Number(q.value)}}
    });
    instance.on(Hls.Events.ERROR,(_,data)=>{
     if(hlsInstance!==instance||!data?.fatal)return;
     if(data.type===Hls.ErrorTypes.MEDIA_ERROR){try{instance.recoverMediaError();setStatus("Восстанавливаем видеопоток…");return}catch{}}
     fail(data.details||data.type||"ошибка HLS");
    });
   }catch(error){fail(error.message||"не удалось запустить HLS.js")}
  };
  v.addEventListener("error",()=>fail("ошибка видео, код "+(v.error?.code||"неизвестно")));
  if(quality)quality.addEventListener("change",()=>{if(quality.value==="auto")return;const i=qualities.findIndex((url,n)=>url&&labels[n]===quality.value+"p");if(i>=0){attempt=Math.max(0,candidates.findIndex(x=>x.url===qualities[i]));startCandidate()}});
  startCandidate();
 };
 const renderLibertyOptions=()=>{const id=selectedRelease?.id;options.innerHTML=(releases.length>1?'<label>Релиз<select id="liberty-release">'+releases.map(r=>'<option value="'+esc(r.id)+'" '+(String(r.id)===String(id)?"selected":"")+'>'+esc(releaseName(r))+'</option>').join("")+'</select></label>':"")+'<span class="stream-note">'+esc(releaseName(selectedRelease))+'</span><button type="button" class="stream-load" id="liberty-load">Загрузить серию '+episode+' <span>→</span></button>';const select=options.querySelector("#liberty-release");if(select)select.addEventListener("change",async()=>{selectedRelease=releases.find(r=>String(r.id)===select.value);releaseData=null;try{releaseData=await getLibertyRelease(selectedRelease.id);renderLibertyOptions();await playLiberty()}catch(e){setStatus(e.message||"Не удалось загрузить релиз")}});options.querySelector("#liberty-load").addEventListener("click",()=>playLiberty().catch(e=>setStatus(e.message||"Ошибка плеера")))};
 const showLiberty=async()=>{if(releaseData){renderLibertyOptions();return}options.innerHTML='<span class="stream-note">Поиск релиза…</span>';stage.innerHTML='<div class="stream-placeholder"><b>Резервный плеер</b><small>Резервный источник. Поиск запускается только по запросу.</small></div>';setStatus("Ищем релизы…");try{releases=await searchLibertyReleases(anime);if(!releases.length)throw new Error("Релизы не найдены");selectedRelease=releases[0];releaseData=await getLibertyRelease(selectedRelease.id);renderLibertyOptions();await playLiberty()}catch(error){releaseData=null;options.innerHTML='<button type="button" class="stream-load" id="liberty-retry">Повторить <span>↻</span></button>';options.querySelector("#liberty-retry").addEventListener("click",showLiberty);stage.innerHTML='<div class="stream-placeholder"><b>Резервный плеер</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';setStatus("Резервный плеер: "+(error.message||"ошибка поиска"))}};

 const showKodik=async()=>{
  destroyHls();
  options.innerHTML='<span class="stream-note">Ищем озвучки и серии…</span>';
  stage.innerHTML='<div class="stream-placeholder"><b>Основной плеер</b><small>Загружаем доступные варианты озвучки…</small></div>';
  setStatus("Основной плеер · поиск озвучек…");
  try{
   const releases=await searchKodikAnime(anime);
   if(!releases.length)throw new Error("Не найдены подходящие релизы для этого аниме");
   const available=releases.filter(item=>item?.link&&item?.translation);
   if(!available.length)throw new Error("Не найдены доступные варианты озвучки");
   let selected=available[0];
   const episodesOf=item=>{
    const all=[];
    for(const [seasonKey,season] of Object.entries(item?.seasons||{})){
     for(const [number,data] of Object.entries(season?.episodes||{})){
      const episodeNumber=Number(data?.episode??data?.number??number);
      if(Number.isFinite(episodeNumber))all.push({number:episodeNumber,season:Number(seasonKey)||1});
     }
    }
    return [...new Map(all.map(x=>[x.number,x])).values()].sort((a,b)=>a.number-b.number);
   };
   const playSelected=()=>{
    const link=getKodikEpisodeLink(selected,episode);
    if(!link){setStatus("У этой озвучки нет серии "+episode+". Выбери другую озвучку.");return}
    destroyHls();
    kodikFrame=null;kodikMedia={time:0,duration:0,playing:false,speed:1};
    stage.innerHTML='<iframe class="stream-video" src="'+esc(link)+'" title="Видеоплеер" allow="autoplay *; fullscreen *; picture-in-picture; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
    kodikFrame=stage.querySelector("iframe");
    if(kodikFrame)kodikFrame.addEventListener("load",()=>{if(kodikFrame)kodikCommand({method:"get_time"})},{once:true});
    setStatus("Основной плеер · "+esc(selected.translation?.title||"озвучка")+" · серия "+episode);
   };
   const render=()=>{
    const eps=episodesOf(selected);
    const voiceButtons=available.map((item,index)=>'<button type="button" class="kodik-voice'+(item===selected?' on':'')+'" data-kodik-voice="'+index+'" aria-pressed="'+(item===selected?'true':'false')+'"><span>'+esc(item.translation?.title||"Озвучка "+(index+1))+'</span></button>').join("");
    const episodeInfo=eps.length?'<span class="kodik-episode-info">Доступно серий: '+eps.length+'</span>':'<span class="kodik-episode-info">Серия '+episode+'</span>';
    options.innerHTML='<div class="kodik-picker"><div class="kodik-picker-head"><div><b>Озвучка</b><small>Выбери студию — видео загрузится автоматически</small></div>'+episodeInfo+'</div><div class="kodik-voices">'+voiceButtons+'</div><div class="kodik-picker-bottom"><span class="kodik-current">Выбрана: '+esc(selected.translation?.title||"Основной плеер")+'</span><button type="button" class="stream-load" id="kodik-play">Обновить плеер <span>↻</span></button></div></div>';
    options.querySelectorAll("[data-kodik-voice]").forEach(button=>button.addEventListener("click",()=>{
     selected=available[Number(button.dataset.kodikVoice)]||available[0];
     render();
     playSelected();
    }));
    options.querySelector("#kodik-play").addEventListener("click",playSelected);
   };
   render();
   playSelected();
  }catch(error){
   options.innerHTML='<button type="button" class="stream-load" id="kodik-retry">Повторить поиск <span>↻</span></button>';
   options.querySelector("#kodik-retry").addEventListener("click",showKodik);
   stage.innerHTML='<div class="stream-placeholder"><b>Основной плеер</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';
   setStatus("Основной плеер: "+(error.message||"ошибка поиска"));
  }
 };
 const animeVostRequest=async payload=>{
  const response=await fetch("https://oikuyhdgcobuuesbuygl.supabase.co/functions/v1/animevost-stream",{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":"sb_publishable_Ker59ui359qC1e9dsGsmsg_VW6azZfK","Authorization":"Bearer sb_publishable_Ker59ui359qC1e9dsGsmsg_VW6azZfK"},
   body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error)throw new Error(data.error||("HTTP "+response.status));
  return data;
 };
 const playAnimeVostStream=async streams=>{
  if(!Array.isArray(streams)||!streams.length)throw new Error("Не удалось получить видеопоток для этой серии");
  const preferred=[...streams].sort((a,b)=>Number((b.quality||"").match(/\d+/)?.[0]||0)-Number((a.quality||"").match(/\d+/)?.[0]||0));
  options.innerHTML='<label>Качество<select id="animevost-quality">'+preferred.map((x,i)=>'<option value="'+i+'">'+esc(x.quality||("Источник "+(i+1)))+'</option>').join("")+'</select></label><label>Скорость<select id="animevost-speed"><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="1.75">1.75×</option><option value="2">2×</option><option value="0.75">0.75×</option></select></label><span class="stream-note">Резервный плеер · русская озвучка</span>';
  let resume={time:savedTime,playing:false,speed:savedSpeed};
  const start=async index=>{
   const previous=video();
   if(previous)resume={time:Number(previous.currentTime)||0,playing:!previous.paused&&!previous.ended,speed:Number(previous.playbackRate)||1};
   const source=preferred[index];if(!source?.url)throw new Error("Ссылка на видео отсутствует");
   destroyHls();stage.innerHTML='<video class="stream-video" controls playsinline preload="metadata"></video>';
   const v=video();bindVideo(v);v.playbackRate=resume.speed;
   let restored=false;
   const restore=()=>{if(restored)return;restored=true;if(resume.time>0&&Number.isFinite(resume.time))try{v.currentTime=resume.time}catch{}if(resume.playing)v.play().catch(()=>{})};
   const nativeHls=v.canPlayType("application/vnd.apple.mpegurl")!=="";
   if(/\.m3u8(?:$|\?)/i.test(source.url)&&!nativeHls){
    const Hls=await loadHls();
    if(!Hls.isSupported())throw new Error("Браузер не поддерживает HLS");
    const instance=new Hls({enableWorker:true,lowLatencyMode:false,capLevelToPlayerSize:true,backBufferLength:45,maxBufferLength:30});
    hlsInstance=instance;instance.loadSource(source.url);instance.attachMedia(v);
    v.addEventListener("loadedmetadata",restore,{once:true});
    instance.on(Hls.Events.MANIFEST_PARSED,()=>{if(hlsInstance===instance)setStatus("Резервный плеер · "+(source.quality||"HLS")+" · поток готов")});
    instance.on(Hls.Events.ERROR,(_,data)=>{if(hlsInstance===instance&&data?.fatal)setStatus("Ошибка видеопотока: "+(data.details||data.type))});
   }else{
    v.src=source.url;setStatus("Резервный плеер · "+(source.quality||"видео")+" · загружаем поток…");
    v.addEventListener("loadedmetadata",()=>{restore();setStatus("Резервный плеер · "+(source.quality||"видео")+" · поток готов")},{once:true});
   }
  };
  options.querySelector("#animevost-quality").addEventListener("change",()=>start(Number(options.querySelector("#animevost-quality").value)).catch(e=>setStatus(e.message)));
  options.querySelector("#animevost-speed").addEventListener("change",()=>{const v=video();if(v)v.playbackRate=Number(options.querySelector("#animevost-speed").value)||1;emit(true)});
  await start(0);
 };
 const loadAnimeVost=async animeUrl=>{
  options.innerHTML='<span class="stream-note">Получаем видеопотоки…</span>';
  stage.innerHTML='<div class="stream-placeholder"><b>Резервный плеер</b><small>Загружаем серию '+episode+'…</small></div>';
  setStatus("Получаем видеопоток…");
  const data=await animeVostRequest({action:"streams",animeUrl,episode:Number(episode)});
  if(!data.streams?.length)throw new Error("Не найдена серия "+episode);
  await playAnimeVostStream(data.streams);
  setStatus("Резервный плеер · "+(data.episode||("серия "+episode))+" · поток готов");
 };
 const showAnimeVost=async()=>{
  destroyHls();
  options.innerHTML='<span class="stream-note">Ищем доступные релизы…</span>';
  stage.innerHTML='<div class="stream-placeholder"><b>Резервный плеер</b><small>Поиск по названию</small></div>';
  setStatus("Ищем аниме…");
  try{
   const names=[...new Set([anime?.n,anime?.o].map(x=>String(x||"").trim()).filter(x=>x.length>=2))];
   let results=[];
   for(const name of names){const found=await animeVostRequest({action:"search",title:name});results.push(...(found.results||[]));if(results.length)break}
   results=[...new Map(results.map(x=>[x.url,x])).values()];
   if(!results.length)throw new Error("Аниме не найдено");
   const selected=results[0];
   options.innerHTML=(results.length>1?'<label>Аниме<select id="animevost-title">'+results.map((x,i)=>'<option value="'+i+'">'+esc(x.title)+'</option>').join("")+'</select></label>':'<span class="stream-note">'+esc(selected.title)+'</span>')+'<button type="button" class="stream-load" id="animevost-open">Загрузить серию '+episode+' <span>→</span></button>';
   const open=()=>loadAnimeVost(results[Number(options.querySelector("#animevost-title")?.value||0)].url).catch(error=>{
    stage.innerHTML='<div class="stream-placeholder"><b>Резервный плеер</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';setStatus("Резервный плеер: "+(error.message||"ошибка"));
   });
   options.querySelector("#animevost-open").addEventListener("click",open);
   await open();
  }catch(error){
   options.innerHTML='<button type="button" class="stream-load" id="animevost-retry">Повторить поиск <span>↻</span></button>';
   options.querySelector("#animevost-retry").addEventListener("click",showAnimeVost);
   stage.innerHTML='<div class="stream-placeholder"><b>Резервный плеер</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';
   setStatus("Резервный плеер: "+(error.message||"ошибка поиска"));
  }
 };

 const showAnimeLib=async()=>{
  destroyHls();
  const title=String(anime?.n||anime?.o||anime?.name||"").trim();
  const openAnimeLibPage=async(reason)=>{
   if(!title)throw new Error(reason||"Не удалось определить название аниме");
   const search=await requestJson("https://api.cdnlibs.org/api/anime?q="+encodeURIComponent(title),12000);
   const results=Array.isArray(search?.data)?search.data:[];
   const normalized=clean(title);
   const match=results.find(item=>clean(item?.rus_name||item?.name)===normalized)
    ||results.find(item=>{const candidate=clean(item?.rus_name||item?.name||"");return candidate&&(candidate.includes(normalized)||normalized.includes(candidate))})
    ||results[0];
   if(!match?.slug_url)throw new Error("Не найдена страница для «"+title+"»");
   const pageUrl="https://v5.animelib.org/ru/anime/"+encodeURIComponent(match.slug_url);
   options.innerHTML='<span class="stream-note">Список серий через API недоступен ('+esc(reason||"ошибка сервера")+'). Открыта страница дополнительный плеер — выбери серию на странице.</span><a class="stream-load" href="'+pageUrl+'" target="_blank" rel="noopener noreferrer">Открыть страницу отдельно <span>↗</span></a>';
   stage.innerHTML='<iframe class="stream-video" src="'+esc(pageUrl)+'" title="Дополнительный плеер" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;min-height:300px;border:0;aspect-ratio:16/9"></iframe>';
   setStatus("Дополнительный плеер · выбери серию на странице");
  };
  const shikiId=Number(anime?.shikiId||(anime?.source==="shikimori"&&Number(anime?.id)>1000000000?Number(anime.id)-1000000000:0));
  options.innerHTML='<span class="stream-note">Загружаем список серий…</span>';
  stage.innerHTML='<div class="stream-placeholder"><b>Дополнительный плеер</b><small>Ищем серию '+episode+'…</small></div>';
  setStatus("Дополнительный плеер · получаем список серий…");
  if(!Number.isInteger(shikiId)||shikiId<=0){
   try{await openAnimeLibPage("не найден внутренний идентификатор тайтла")}
   catch(error){
    options.innerHTML='<button type="button" class="stream-load" id="animelib-retry">Повторить <span>↻</span></button><span class="stream-note">'+esc(error.message||"Источник недоступен")+'</span>';
    options.querySelector("#animelib-retry").addEventListener("click",showAnimeLib);
    stage.innerHTML='<div class="stream-placeholder"><b>Дополнительный плеер</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';
    setStatus("Дополнительный плеер: "+(error.message||"ошибка загрузки"));
   }
   return;
  }
  try{
   const payload=await requestAnimeLibEpisodes(shikiId);
   const list=Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[];
   const matches=list.filter(item=>Number(item?.number)===Number(episode)&&item?.id);
   if(!matches.length)throw new Error("Не найдена серия "+episode);
   const selected=matches[0],animeId=Number(selected.anime_id||selected.animeId);
   if(!animeId)throw new Error("Не найден идентификатор тайтла для серии");
   const watchUrl="https://v5.animelib.org/ru/anime/"+animeId+"/watch?episode="+encodeURIComponent(selected.id);
   options.innerHTML='<span class="stream-note">Дополнительный плеер · серия '+episode+' · '+esc(selected.name||"")+'</span><a class="stream-load" href="'+watchUrl+'" target="_blank" rel="noopener noreferrer">Открыть страницу <span>↗</span></a>';
   stage.innerHTML='<iframe class="stream-video" src="'+esc(watchUrl)+'" title="Видеоплеер" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;min-height:300px;border:0;aspect-ratio:16/9"></iframe>';
   setStatus("Дополнительный плеер · синхронизация недоступна");
  }catch(error){
   try{await openAnimeLibPage(error.message||"API списка серий недоступен")}
   catch(fallbackError){
    options.innerHTML='<button type="button" class="stream-load" id="animelib-retry">Повторить <span>↻</span></button><span class="stream-note">Список серий и поиск сейчас недоступны: '+esc(fallbackError.message||error.message||"ошибка сервера")+'</span>';
    options.querySelector("#animelib-retry").addEventListener("click",showAnimeLib);
    stage.innerHTML='<div class="stream-placeholder"><b>Дополнительный плеер</b><small>'+esc(fallbackError.message||error.message||"Источник недоступен")+'</small></div>';
    setStatus("Дополнительный плеер: "+(fallbackError.message||error.message||"ошибка загрузки"));
   }
  }
 };
 root.querySelectorAll("[data-provider]").forEach(button=>button.addEventListener("click",()=>{
  if(button.dataset.provider!=="kodik")kodikFrame=null;
  root.querySelectorAll("[data-provider]").forEach(item=>item.classList.toggle("on",item===button));
  if(button.dataset.provider==="animevost")showAnimeVost();else if(button.dataset.provider==="animelib")showAnimeLib();else if(button.dataset.provider==="kodik")showKodik();else showLiberty();
 }));
 reload.addEventListener("click",()=>{destroyHls();if(root.querySelector('[data-provider="animevost"]')?.classList.contains("on"))showAnimeVost();else if(root.querySelector('[data-provider="animelib"]')?.classList.contains("on"))showAnimeLib();else if(root.querySelector('[data-provider="kodik"]')?.classList.contains("on"))showKodik();else{releaseData=null;showLiberty()}});;
 showKodik()
 return {getPlaybackState,syncPlayback,destroy(){destroyHls();kodikFrame=null;window.removeEventListener("message",onKodikMessage);clearTimeout(emitTimer);clearTimeout(remoteApplyTimer);root.removeEventListener("keydown",handlePlayerKeys);root.innerHTML=""}};
}
