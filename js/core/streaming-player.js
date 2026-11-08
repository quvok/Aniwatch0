const LIBERTY_BASES=["https://api.anilibria.app/api/v1","https://aniliberty.top/api/v1"];
let hlsLoader=null,hlsInstance=null;
const textOf=v=>typeof v==="string"?v:v&&typeof v==="object"?(v.main||v.english||v.russian||""):"";
const releaseName=r=>textOf(r?.name)||r?.title||r?.name_english||r?.alias||"Без названия";
const clean=s=>String(s||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/gi," ").trim();
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function requestJson(url,timeout=9000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error("HTTP "+response.status);return await response.json()}finally{clearTimeout(timer)}}
async function libertyRequest(path){const tasks=LIBERTY_BASES.map(base=>requestJson(base+path,6500));let last;for(const task of tasks){try{return await task}catch(error){last=error}}throw last||new Error("AniLiberty недоступен")}
function loadHls(){if(window.Hls)return Promise.resolve(window.Hls);if(hlsLoader)return hlsLoader;hlsLoader=new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js";script.async=true;script.onload=()=>window.Hls?resolve(window.Hls):reject(new Error("HLS.js не загрузился"));script.onerror=()=>reject(new Error("Не удалось загрузить HLS-плеер"));document.head.appendChild(script)});return hlsLoader}
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
export function mountStreamPlayer({root,anime,episode,onPlayback=()=>{}}){
 if(!root)return {destroy(){},getPlaybackState(){return null},syncPlayback(){}};
 if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}
 root.innerHTML=`
 <div class="aw-player-shell">
  <div class="aw-player-heading"><div class="aw-player-brand"><span class="aw-player-logo">A</span><div><b>AniWatch <i>PLAYER</i></b><small>${esc(anime?.n||"Просмотр аниме")} <span>·</span> серия ${episode}</small></div></div><span class="aw-player-chip"><i></i> STREAMING</span></div>
  <div class="stream-stage" id="stream-stage"><div class="stream-placeholder"><span class="stream-placeholder-mark">AW</span><b>Выберите источник</b><small>Плеер загружается только после выбора источника</small></div></div>
  <div class="aw-player-controls"><div class="stream-provider-tabs"><button type="button" class="on" data-provider="liberty">AniLiberty <em>MAIN</em></button><button type="button" data-provider="animevost">AnimeVost <em>RU</em></button><button type="button" data-provider="anixo">AniXo</button><button type="button" data-provider="animedia">Анимедия <em>RU</em></button></div><div class="stream-options" id="stream-options"></div></div>
  <div class="aw-player-footer"><span class="stream-status" id="stream-status" role="status">AniLiberty · автоматический выбор потока</span><button type="button" class="aw-player-reload" id="player-reload" aria-label="Перезагрузить источник" title="Перезагрузить">↻</button></div>
 </div>`;
 const stage=root.querySelector("#stream-stage"),options=root.querySelector("#stream-options"),status=root.querySelector("#stream-status"),reload=root.querySelector("#player-reload");
 let releases=[],selectedRelease=null,releaseData=null,lastEmit=0,remoteApplying=false,emitTimer=null,remoteApplyTimer=null,lastSentState="";
 const setStatus=s=>{if(status)status.textContent=s};
 const destroyHls=()=>{if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}};
 const video=()=>stage.querySelector("video");
 const getPlaybackState=()=>{const v=video();return v?{time:Number(v.currentTime)||0,playing:!v.paused&&!v.ended,speed:Number(v.playbackRate)||1}:null};
 const emit=force=>{const state=getPlaybackState();if(!state||remoteApplying)return;const now=Date.now();if(!force&&now-lastEmit<2500)return;if(force){clearTimeout(emitTimer);emitTimer=setTimeout(()=>{if(remoteApplying)return;const latest=getPlaybackState();if(!latest)return;const key=[latest.time.toFixed(1),latest.playing,latest.speed].join("|");if(key===lastSentState)return;lastSentState=key;lastEmit=Date.now();onPlayback(latest)},100);return}const key=[state.time.toFixed(1),state.playing,state.speed].join("|");if(key===lastSentState)return;lastSentState=key;lastEmit=now;onPlayback(state)};
 const bindVideo=el=>{["play","pause","seeked","ratechange"].forEach(event=>el.addEventListener(event,()=>emit(true)));el.addEventListener("timeupdate",()=>emit(false));el.addEventListener("error",()=>setStatus("Ошибка видеопотока. Попробуй другой источник или релиз."))};
 const syncPlayback=async state=>{const v=video();if(!v||!state)return false;remoteApplying=true;clearTimeout(remoteApplyTimer);remoteApplyTimer=setTimeout(()=>{remoteApplying=false},900);const target=Math.max(0,Number(state.time)||0),baseSpeed=Number(state.speed)>0?Number(state.speed):1,drift=target-(Number(v.currentTime)||0),absDrift=Math.abs(drift);try{if(!state.playing){if(absDrift>0.25&&!v.seeking&&v.readyState>=1){try{v.currentTime=target}catch{}}if(Math.abs(v.playbackRate-baseSpeed)>0.01)v.playbackRate=baseSpeed;if(!v.paused)v.pause()}else{if(absDrift>0.65&&!v.seeking&&v.readyState>=1){try{v.currentTime=target}catch{}}const correctedSpeed=absDrift>0.12&&absDrift<=0.65?baseSpeed*(drift>0?1.06:0.94):baseSpeed;if(Math.abs(v.playbackRate-correctedSpeed)>0.01)v.playbackRate=correctedSpeed;if(v.paused&&!v.ended)await v.play().catch(()=>{})}}catch(error){console.warn("[AniWatch] Playback sync failed:",error)}return true};
 const addHlsControls=v=>{const quality=options.querySelector("#liberty-quality"),speed=options.querySelector("#liberty-speed");if(speed)speed.addEventListener("change",()=>{v.playbackRate=Number(speed.value)||1;emit(true)});if(quality)quality.addEventListener("change",()=>{if(hlsInstance)hlsInstance.currentLevel=quality.value==="auto"?-1:Number(quality.value)})};
 const playLiberty=async()=>{
  const eps=Array.isArray(releaseData?.episodes)?releaseData.episodes:[];
  const wanted=eps.find(e=>getLibertyEpisodeNumber(e)===Number(episode));
  if(!wanted)throw new Error("В релизе нет серии "+episode);
  setStatus("Получаем видеопоток…");
  let detail=wanted,streams=getLibertyStreams(detail);
  if(!streams.length&&wanted.id){detail=await getLibertyEpisode(wanted.id);streams=getLibertyStreams(detail)}
  if(!streams.length)throw new Error("AniLiberty не вернул HLS-ссылки для этой серии");
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
   if(nativeHls){v.src=current.url;setStatus("AniLiberty · Safari HLS · проверяем "+current.label+"…");return}
   try{
    const Hls=await loadHls();
    if(!Hls.isSupported()){fail("браузер не поддерживает Media Source Extensions (MSE), а нативный HLS недоступен");return}
    const instance=new Hls({enableWorker:true,lowLatencyMode:false,capLevelToPlayerSize:true,backBufferLength:45,maxBufferLength:30});
    hlsInstance=instance;instance.loadSource(current.url);instance.attachMedia(v);
    instance.on(Hls.Events.MANIFEST_PARSED,()=>{
     if(hlsInstance!==instance)return;settled=true;setStatus("AniLiberty · "+current.label+" · поток готов");
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
 const renderLibertyOptions=()=>{const id=selectedRelease?.id;options.innerHTML=(releases.length>1?'<label>Релиз<select id="liberty-release">'+releases.map(r=>'<option value="'+esc(r.id)+'" '+(String(r.id)===String(id)?"selected":"")+'>'+esc(releaseName(r))+'</option>').join("")+'</select></label>':"")+'<span class="stream-note">'+esc(releaseName(selectedRelease))+'</span><button type="button" class="stream-load" id="liberty-load">Загрузить серию '+episode+' <span>→</span></button>';const select=options.querySelector("#liberty-release");if(select)select.addEventListener("change",async()=>{selectedRelease=releases.find(r=>String(r.id)===select.value);releaseData=null;try{releaseData=await getLibertyRelease(selectedRelease.id);renderLibertyOptions();await playLiberty()}catch(e){setStatus(e.message||"Не удалось загрузить релиз")}});options.querySelector("#liberty-load").addEventListener("click",()=>playLiberty().catch(e=>setStatus(e.message||"Ошибка AniLiberty")))};
 const showLiberty=async()=>{if(releaseData){renderLibertyOptions();return}options.innerHTML='<span class="stream-note">Поиск релиза…</span>';stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><small>Резервный источник. Поиск запускается только по запросу.</small></div>';setStatus("Ищем релизы AniLiberty…");try{releases=await searchLibertyReleases(anime);if(!releases.length)throw new Error("Релизы не найдены");selectedRelease=releases[0];releaseData=await getLibertyRelease(selectedRelease.id);renderLibertyOptions();await playLiberty()}catch(error){releaseData=null;options.innerHTML='<button type="button" class="stream-load" id="liberty-retry">Повторить <span>↻</span></button>';options.querySelector("#liberty-retry").addEventListener("click",showLiberty);stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';setStatus("AniLiberty: "+(error.message||"ошибка поиска"))}};
 const animeVostRequest=async payload=>{
  const response=await fetch("https://oikuyhdgcobuuesbuygl.supabase.co/functions/v1/animevost-stream",{
   method:"POST",
   headers:{"Content-Type":"application/json","apikey":"sb_publishable_Ker59ui359qC1e9dsGsmsg_VW6azZfK","Authorization":"Bearer sb_publishable_Ker59ui359qC1e9dsGsmsg_VW6azZfK"},
   body:JSON.stringify(payload)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.error)throw new Error(data.error||("AnimeVost HTTP "+response.status));
  return data;
 };
 const playAnimeVostStream=async streams=>{
  if(!Array.isArray(streams)||!streams.length)throw new Error("AnimeVost не вернул видеопоток для этой серии");
  const preferred=[...streams].sort((a,b)=>Number((b.quality||"").match(/\d+/)?.[0]||0)-Number((a.quality||"").match(/\d+/)?.[0]||0));
  options.innerHTML='<label>Качество<select id="animevost-quality">'+preferred.map((x,i)=>'<option value="'+i+'">'+esc(x.quality||("Источник "+(i+1)))+'</option>').join("")+'</select></label><span class="stream-note">AnimeVost · русская озвучка</span>';
  const start=async index=>{
   const source=preferred[index];if(!source?.url)throw new Error("Ссылка на видео отсутствует");
   destroyHls();stage.innerHTML='<video class="stream-video" controls playsinline preload="metadata"></video>';
   const v=video();bindVideo(v);
   const nativeHls=v.canPlayType("application/vnd.apple.mpegurl")!=="";
   if(/\.m3u8(?:$|\?)/i.test(source.url)&&!nativeHls){
    const Hls=await loadHls();
    if(!Hls.isSupported())throw new Error("Браузер не поддерживает HLS");
    const instance=new Hls({enableWorker:true,lowLatencyMode:false,capLevelToPlayerSize:true,backBufferLength:45,maxBufferLength:30});
    hlsInstance=instance;instance.loadSource(source.url);instance.attachMedia(v);
    instance.on(Hls.Events.MANIFEST_PARSED,()=>{if(hlsInstance===instance)setStatus("AnimeVost · "+(source.quality||"HLS")+" · поток готов")});
    instance.on(Hls.Events.ERROR,(_,data)=>{if(hlsInstance===instance&&data?.fatal)setStatus("Ошибка потока AnimeVost: "+(data.details||data.type))});
   }else{
    v.src=source.url;setStatus("AnimeVost · "+(source.quality||"видео")+" · загружаем поток…");
    v.addEventListener("loadedmetadata",()=>setStatus("AnimeVost · "+(source.quality||"видео")+" · поток готов"),{once:true});
   }
  };
  options.querySelector("#animevost-quality").addEventListener("change",()=>start(Number(options.querySelector("#animevost-quality").value)).catch(e=>setStatus(e.message)));
  await start(0);
 };
 const loadAnimeVost=async animeUrl=>{
  options.innerHTML='<span class="stream-note">Получаем видеопотоки…</span>';
  stage.innerHTML='<div class="stream-placeholder"><b>AnimeVost</b><small>Загружаем серию '+episode+'…</small></div>';
  setStatus("AnimeVost · получаем видеопоток…");
  const data=await animeVostRequest({action:"streams",animeUrl,episode:Number(episode)});
  if(!data.streams?.length)throw new Error("На AnimeVost не найдена серия "+episode);
  await playAnimeVostStream(data.streams);
  setStatus("AnimeVost · "+(data.episode||("серия "+episode))+" · поток готов");
 };
 const showAnimeVost=async()=>{
  destroyHls();
  options.innerHTML='<span class="stream-note">Ищем на AnimeVost…</span>';
  stage.innerHTML='<div class="stream-placeholder"><b>AnimeVost</b><small>Поиск по названию</small></div>';
  setStatus("AnimeVost · ищем аниме…");
  try{
   const names=[...new Set([anime?.n,anime?.o].map(x=>String(x||"").trim()).filter(x=>x.length>=2))];
   let results=[];
   for(const name of names){const found=await animeVostRequest({action:"search",title:name});results.push(...(found.results||[]));if(results.length)break}
   results=[...new Map(results.map(x=>[x.url,x])).values()];
   if(!results.length)throw new Error("Аниме не найдено в каталоге AnimeVost");
   const selected=results[0];
   options.innerHTML=(results.length>1?'<label>Аниме<select id="animevost-title">'+results.map((x,i)=>'<option value="'+i+'">'+esc(x.title)+'</option>').join("")+'</select></label>':'<span class="stream-note">'+esc(selected.title)+'</span>')+'<button type="button" class="stream-load" id="animevost-open">Загрузить серию '+episode+' <span>→</span></button>';
   const open=()=>loadAnimeVost(results[Number(options.querySelector("#animevost-title")?.value||0)].url).catch(error=>{
    stage.innerHTML='<div class="stream-placeholder"><b>AnimeVost</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';setStatus("AnimeVost: "+(error.message||"ошибка"));
   });
   options.querySelector("#animevost-open").addEventListener("click",open);
   await open();
  }catch(error){
   options.innerHTML='<button type="button" class="stream-load" id="animevost-retry">Повторить поиск <span>↻</span></button>';
   options.querySelector("#animevost-retry").addEventListener("click",showAnimeVost);
   stage.innerHTML='<div class="stream-placeholder"><b>AnimeVost</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';
   setStatus("AnimeVost: "+(error.message||"ошибка поиска"));
  }
 };
 const showAniMedia=()=>{
  destroyHls();
  const title=String(anime?.n||anime?.o||"").trim();
  const searchUrl="https://ani-media.online/?do=search&subaction=search&story="+encodeURIComponent(title);
  options.innerHTML='<span class="stream-note">Русскоязычный каталог · поиск по названию</span><a class="stream-load" href="'+searchUrl+'" target="_blank" rel="noopener noreferrer">Найти на Анимедии <span>↗</span></a>';
  stage.innerHTML='<div class="stream-placeholder"><span class="stream-placeholder-mark">RU</span><b>Анимедия</b><small>Откроем результаты поиска по «'+esc(title)+'» на ani-media.online. Выбери нужное аниме и серию на сайте источника.</small><a class="stream-load" href="'+searchUrl+'" target="_blank" rel="noopener noreferrer">Открыть каталог <span>↗</span></a></div>';
  setStatus("Анимедия · внешний русскоязычный источник · синхронизация недоступна");
 };
 const showAnixo=()=>{
  const aniId=Number(anime?.aniId||anime?.id);
  const malId=Number(anime?.mal||anime?.malId);
  const identity=aniId>0?"ani/"+aniId:malId>0?"mal/"+malId:"";
  if(!identity){setStatus("Не найден AniList/MAL ID для этого тайтла");stage.innerHTML='<div class="stream-placeholder"><b>AniXo</b><small>Для этого аниме нет подходящего ID</small></div>';return}
  destroyHls();options.innerHTML='<span class="stream-note">AniXo · серия '+episode+' · субтитры</span>';
  stage.innerHTML='<iframe class="stream-video" src="https://anixo.buzz/embed/'+identity+'/'+encodeURIComponent(episode)+'?track=sub" title="AniXo player" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%;height:100%;border:0;aspect-ratio:16/9"></iframe>';
  setStatus("AniXo · внешний видеоплеер · управление совместным просмотром недоступно");
 };
 root.querySelectorAll("[data-provider]").forEach(button=>button.addEventListener("click",()=>{
  root.querySelectorAll("[data-provider]").forEach(item=>item.classList.toggle("on",item===button));
  if(button.dataset.provider==="anixo")showAnixo();else if(button.dataset.provider==="animevost")showAnimeVost();else if(button.dataset.provider==="animedia")showAniMedia();else showLiberty();
 }));
 reload.addEventListener("click",()=>{destroyHls();if(root.querySelector('[data-provider="anixo"]')?.classList.contains("on"))showAnixo();else if(root.querySelector('[data-provider="animevost"]')?.classList.contains("on"))showAnimeVost();else if(root.querySelector('[data-provider="animedia"]')?.classList.contains("on"))showAniMedia();else{releaseData=null;showLiberty()}});
 showLiberty()
 return {getPlaybackState,syncPlayback,destroy(){destroyHls();root.innerHTML=""}};
}
