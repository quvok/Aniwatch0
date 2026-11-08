const LIBERTY_BASES=["https://api.anilibria.app/api/v1","https://aniliberty.top/api/v1"];
const ANIWEEB_BASE="https://api.aniweeb.net";
let hlsLoader=null,hlsInstance=null;
const textOf=v=>typeof v==="string"?v:v&&typeof v==="object"?(v.main||v.english||v.russian||""):"";
const releaseName=r=>textOf(r?.name)||r?.title||r?.name_english||r?.alias||"Без названия";
const clean=s=>String(s||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/gi," ").trim();
const esc=s=>String(s??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function requestJson(url,timeout=9000){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);try{const response=await fetch(url,{headers:{Accept:"application/json"},signal:controller.signal});if(!response.ok)throw new Error("HTTP "+response.status);return await response.json()}finally{clearTimeout(timer)}}
async function libertyRequest(path){const tasks=LIBERTY_BASES.map(base=>requestJson(base+path,6500));let last;for(const task of tasks){try{return await task}catch(error){last=error}}throw last||new Error("AniLiberty недоступен")}
function loadHls(){if(window.Hls)return Promise.resolve(window.Hls);if(hlsLoader)return hlsLoader;hlsLoader=new Promise((resolve,reject)=>{const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js";script.async=true;script.onload=()=>window.Hls?resolve(window.Hls):reject(new Error("HLS.js не загрузился"));script.onerror=()=>reject(new Error("Не удалось загрузить HLS-плеер"));document.head.appendChild(script)});return hlsLoader}
const scoreRelease=(r,anime)=>{const a=clean(releaseName(r)),b=clean(anime?.n||anime?.o);return a===b?0:a.startsWith(b)||b.startsWith(a)?1:a.includes(b)||b.includes(a)?2:3};
async function searchLibertyReleases(anime){const names=[...new Set([anime?.n,anime?.o].map(x=>String(x||"").trim()).filter(Boolean))];for(const query of names){const result=await libertyRequest("/app/search/releases?query="+encodeURIComponent(query));const list=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:[];if(list.length)return list.sort((a,b)=>scoreRelease(a,anime)-scoreRelease(b,anime))}return []}
async function getLibertyRelease(id){return libertyRequest("/anime/releases/"+encodeURIComponent(id))}
async function getLibertyEpisode(id){return libertyRequest("/anime/releases/episodes/"+encodeURIComponent(id))}
function getLibertyEpisodeNumber(ep){return Number(ep?.ordinal??ep?.sort_order??0)}
function getLibertyStreams(ep){
 const h=ep?.hls||{};
 return [...new Set([ep?.hls_1080,h.hls_1080,ep?.hls_720,h.hls_720,ep?.hls_480,h.hls_480].filter(v=>typeof v==="string"&&/^https?:\\/\\//i.test(v)))];
}
export function mountStreamPlayer({root,anime,episode,onPlayback=()=>{}}){
 if(!root)return {destroy(){},getPlaybackState(){return null},syncPlayback(){}};
 if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}
 root.innerHTML=`
 <div class="aw-player-shell">
  <div class="aw-player-heading"><div class="aw-player-brand"><span class="aw-player-logo">A</span><div><b>AniWatch <i>PLAYER</i></b><small>${esc(anime?.n||"Просмотр аниме")} <span>·</span> серия ${episode}</small></div></div><span class="aw-player-chip"><i></i> STREAMING</span></div>
  <div class="stream-stage" id="stream-stage"><div class="stream-placeholder"><span class="stream-placeholder-mark">AW</span><b>Выберите источник</b><small>Плеер загружается только после выбора источника</small></div></div>
  <div class="aw-player-controls"><div class="stream-provider-tabs"><button type="button" class="on" data-provider="liberty">AniLiberty <em>MAIN</em></button><button type="button" data-provider="aniweeb">Aniweeb <small>резерв</small></button></div><div class="stream-options" id="stream-options"></div></div>
  <div class="aw-player-footer"><span class="stream-status" id="stream-status" role="status">Aniweeb · автоматический выбор потока</span><button type="button" class="aw-player-reload" id="player-reload" aria-label="Перезагрузить источник" title="Перезагрузить">↻</button></div>
 </div>`;
 const stage=root.querySelector("#stream-stage"),options=root.querySelector("#stream-options"),status=root.querySelector("#stream-status"),reload=root.querySelector("#player-reload"),tabs=root.querySelectorAll("[data-provider]");
 let active="liberty",releases=[],selectedRelease=null,releaseData=null,lastEmit=0,remoteApplying=false;
 const setStatus=s=>{if(status)status.textContent=s};
 const destroyHls=()=>{if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}};
 const video=()=>stage.querySelector("video");
 const getPlaybackState=()=>{const v=video();return v?{time:Number(v.currentTime)||0,playing:!v.paused&&!v.ended,speed:Number(v.playbackRate)||1}:null};
 const emit=force=>{const state=getPlaybackState();if(!state||remoteApplying)return;const now=Date.now();if(!force&&now-lastEmit<2200)return;lastEmit=now;onPlayback(state)};
 const bindVideo=el=>{["play","pause","seeked","ratechange"].forEach(event=>el.addEventListener(event,()=>emit(true)));el.addEventListener("timeupdate",()=>emit(false));el.addEventListener("error",()=>setStatus("Ошибка видеопотока. Попробуй другой источник или релиз."))};
 const syncPlayback=async state=>{const v=video();if(!v||!state)return false;remoteApplying=true;try{const target=Math.max(0,Number(state.time)||0);if(Math.abs(v.currentTime-target)>2.5&&!v.seeking){try{v.currentTime=target}catch{}}if(Number(state.speed)>0)v.playbackRate=Number(state.speed);if(state.playing&&!v.ended)await v.play().catch(()=>{});else v.pause()}finally{setTimeout(()=>{remoteApplying=false},350)}return true};
 const setActive=name=>{active=name;destroyHls();tabs.forEach(b=>b.classList.toggle("on",b.dataset.provider===name));if(name==="aniweeb")showAniweeb();else showLiberty()};
 const showAniweeb=()=>{const id=Number(anime?.aniId)||0,mal=Number(anime?.mal)||0;if(!id&&!mal){stage.innerHTML='<div class="stream-placeholder"><b>Aniweeb</b><small>Для этого тайтла нет AniList/MAL ID.</small></div>';options.innerHTML="";setStatus("Нет ID для сопоставления тайтла.");return}options.innerHTML='<label>Дорожка<select id="aniweeb-track"><option value="sub">SUB · субтитры</option><option value="dub">DUB · дубляж</option></select></label><button type="button" class="stream-load" id="aniweeb-load">Запустить плеер <span>→</span></button>';const load=()=>{const track=options.querySelector("#aniweeb-track").value,route=id?"/embed/ani/"+id:"/embed/mal/"+mal,url=ANIWEEB_BASE+route+"/"+Math.max(1,Number(episode)||1)+"?track="+track;stage.innerHTML='<iframe class="stream-frame" src="'+url+'" title="Aniweeb player" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>';setStatus("Подключаем Aniweeb · "+track.toUpperCase()+". Если сервер не запустится, выбери AniLiberty.")};options.querySelector("#aniweeb-load").addEventListener("click",load);load()};
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
   settled=true;setStatus("Ошибка видеопотока: "+reason+". Попробуй другой релиз или Aniweeb.");
  };
  const startCandidate=async()=>{
   const current=candidates[attempt];if(!current)return;
   destroyHls();v.pause();v.removeAttribute("src");v.load();
   if(v.canPlayType("application/vnd.apple.mpegurl")){v.src=current.url;setStatus("AniLiberty · проверяем "+current.label+"…");return}
   try{
    const Hls=await loadHls();
    if(!Hls.isSupported()){v.src=current.url;setStatus("Проверяем прямой поток "+current.label+"…");return}
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
  v.addEventListener("error",()=>{if(!settled||attempt<candidates.length-1)fail("ошибка видео, код "+(v.error?.code||"неизвестно"))});
  if(quality)quality.addEventListener("change",()=>{if(quality.value==="auto")return;const i=qualities.findIndex((url,n)=>url&&labels[n]===quality.value+"p");if(i>=0){attempt=Math.max(0,candidates.findIndex(x=>x.url===qualities[i]));startCandidate()}});
  startCandidate();
 };
 const renderLibertyOptions=()=>{const id=selectedRelease?.id;options.innerHTML=(releases.length>1?'<label>Релиз<select id="liberty-release">'+releases.map(r=>'<option value="'+esc(r.id)+'" '+(String(r.id)===String(id)?"selected":"")+'>'+esc(releaseName(r))+'</option>').join("")+'</select></label>':"")+'<span class="stream-note">'+esc(releaseName(selectedRelease))+'</span><button type="button" class="stream-load" id="liberty-load">Загрузить серию '+episode+' <span>→</span></button>';const select=options.querySelector("#liberty-release");if(select)select.addEventListener("change",async()=>{selectedRelease=releases.find(r=>String(r.id)===select.value);releaseData=null;try{releaseData=await getLibertyRelease(selectedRelease.id);renderLibertyOptions();await playLiberty()}catch(e){setStatus(e.message||"Не удалось загрузить релиз")}});options.querySelector("#liberty-load").addEventListener("click",()=>playLiberty().catch(e=>setStatus(e.message||"Ошибка AniLiberty")))};
 const showLiberty=async()=>{if(releaseData){renderLibertyOptions();return}options.innerHTML='<span class="stream-note">Поиск релиза…</span>';stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><small>Резервный источник. Поиск запускается только по запросу.</small></div>';setStatus("Ищем релизы AniLiberty…");try{releases=await searchLibertyReleases(anime);if(!releases.length)throw new Error("Релизы не найдены");selectedRelease=releases[0];releaseData=await getLibertyRelease(selectedRelease.id);renderLibertyOptions();await playLiberty()}catch(error){releaseData=null;options.innerHTML='<button type="button" class="stream-load" id="liberty-retry">Повторить <span>↻</span></button>';options.querySelector("#liberty-retry").addEventListener("click",showLiberty);stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><small>'+esc(error.message||"Источник недоступен")+'</small></div>';setStatus("AniLiberty: "+(error.message||"ошибка поиска"))}};
 tabs.forEach(b=>b.addEventListener("click",()=>setActive(b.dataset.provider)));reload.addEventListener("click",()=>{destroyHls();if(active==="aniweeb")showAniweeb();else{releaseData=null;showLiberty()}});showLiberty()
 return {getPlaybackState,syncPlayback,destroy(){destroyHls();root.innerHTML=""}};
}
