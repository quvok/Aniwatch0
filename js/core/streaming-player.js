const LIBERTY_BASES=["https://api.anilibria.app/api/v1","https://aniliberty.top/api/v1"];
const FLOW_BASE="https://api.aniflow.cc";
let hlsLoader=null,hlsInstance=null;
const textOf=v=>typeof v==="string"?v:v&&typeof v==="object"?(v.main||v.english||v.russian||""):"";
const releaseName=r=>textOf(r?.name)||r?.title||r?.name_english||r?.alias||"Без названия";
const clean=s=>String(s||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/gi," ").trim();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function requestJson(url){
 const response=await fetch(url,{headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("HTTP "+response.status);
 return response.json();
}
async function libertyRequest(path){
 let last;
 for(const base of LIBERTY_BASES){try{return await requestJson(base+path)}catch(error){last=error}}
 throw last||new Error("AniLiberty недоступен");
}
export function flowEmbedUrl(anime,episode,{audio="sub",server="flow"}={}){
 const id=Number(anime?.aniId)||0,mal=Number(anime?.mal)||0;
 const route=id?"/embed/ani/"+id:"/embed/mal/"+mal;
 if(!id&&!mal)return "";
 const url=new URL(route+"/"+Math.max(1,Number(episode)||1)+"/"+(audio==="dub"?"dub":"sub"),FLOW_BASE);
 url.searchParams.set("server",server);
 url.searchParams.set("autoskipIntro","1");
 url.searchParams.set("autoskipOutro","1");
 url.searchParams.set("parentHost",location.hostname||"aniwatch1.ru");
 return url.toString();
}
export async function searchLibertyReleases(anime){
 const names=[...new Set([anime?.n,anime?.o].map(x=>String(x||"").trim()).filter(Boolean))];
 if(!names.length)throw new Error("Нет названия для поиска в AniLiberty");
 for(const query of names){
  const result=await libertyRequest("/app/search/releases?query="+encodeURIComponent(query));
  const list=Array.isArray(result)?result:Array.isArray(result?.data)?result.data:[];
  if(list.length)return list;
 }
 return [];
}
export async function getLibertyRelease(id){return libertyRequest("/anime/releases/"+encodeURIComponent(id))}
export async function getLibertyEpisode(id){return libertyRequest("/anime/releases/episodes/"+encodeURIComponent(id))}
export function getLibertyEpisodeNumber(ep){return Number(ep?.ordinal??ep?.sort_order??0)}
export function getLibertyStream(ep){return ep?.hls_1080||ep?.hls_720||ep?.hls_480||ep?.hls?.hls_1080||ep?.hls?.hls_720||ep?.hls?.hls_480||""}
export function sortLibertyMatches(releases,anime){
 const target=clean(anime?.n||anime?.o);
 return releases.slice().sort((a,b)=>{
  const an=clean(releaseName(a)),bn=clean(releaseName(b));
  const score=n=>n===target?0:n.startsWith(target)||target.startsWith(n)?1:n.includes(target)||target.includes(n)?2:3;
  return score(an)-score(bn);
 });
}
function loadHls(){
 if(window.Hls)return Promise.resolve(window.Hls);
 if(hlsLoader)return hlsLoader;
 hlsLoader=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js";script.async=true;
  script.onload=()=>window.Hls?resolve(window.Hls):reject(new Error("HLS.js не загрузился"));
  script.onerror=()=>reject(new Error("Не удалось загрузить HLS-плеер"));document.head.appendChild(script);
 });
 return hlsLoader;
}
export function mountStreamPlayer({root,anime,episode}){
 if(!root)return {destroy(){}};
 if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}
 root.innerHTML=`
 <div class="aw-player-top"><div class="aw-player-brand"><span class="aw-player-mark">A</span><div><b>AniWatch <i>PLAYER</i></b><small>${esc(anime?.n||"Просмотр аниме")} · серия ${episode}</small></div></div><span class="aw-player-live"><i></i> ВИДЕОИСТОЧНИКИ</span></div>
 <div class="stream-stage" id="stream-stage"><div class="stream-placeholder"><b>ANIWATCH</b><span>Выбери источник воспроизведения</span></div></div>
 <div class="aw-player-panel"><div class="stream-provider-tabs">
  <button type="button" class="on" data-provider="flow"><span class="provider-dot flow-dot"></span>AniFlow</button>
  <button type="button" data-provider="liberty"><span class="provider-dot liberty-dot"></span>AniLiberty</button>
 </div><div class="stream-options" id="stream-options"></div></div>
 <div class="aw-player-bottom"><p class="stream-status" id="stream-status" role="status">Выбери источник. Если видео не запускается, попробуй другой сервер.</p><button type="button" class="aw-player-reload" id="player-reload" title="Перезагрузить источник" aria-label="Перезагрузить источник">↻</button></div>`;
 const stage=root.querySelector("#stream-stage"),options=root.querySelector("#stream-options"),status=root.querySelector("#stream-status"),reload=root.querySelector("#player-reload");
 let active="flow",releases=[],selectedRelease=null,releaseData=null,disposed=false;
 const setStatus=s=>{if(status)status.textContent=s};
 const buttons=root.querySelectorAll("[data-provider]");
 const destroyHls=()=>{if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}};
 const setActive=name=>{active=name;destroyHls();buttons.forEach(b=>b.classList.toggle("on",b.dataset.provider===name));name==="flow"?showFlow():showLiberty()};
 const showFlow=()=>{
  const hasAni=Number(anime?.aniId)>0,hasMal=Number(anime?.mal)>0;
  if(!hasAni&&!hasMal){stage.innerHTML='<div class="stream-placeholder"><b>AniFlow</b><span>У этого тайтла нет AniList ID или MAL ID. Источник не может сопоставить аниме.</span></div>';options.innerHTML='<span class="stream-note">Нет идентификатора для поиска</span>';setStatus("AniFlow недоступен: отсутствует AniList/MAL ID.");return}
  options.innerHTML='<label>Аудио<select id="flow-audio"><option value="sub">Японская дорожка · SUB</option><option value="dub">Дубляж · DUB</option></select></label><label>Сервер<select id="flow-server"><option value="flow">Flow · основной</option><option value="kitty">Kitty · зеркало</option><option value="yuri">Yuri</option><option value="zuri">Zuri</option><option value="buzz">Buzz</option></select></label><button type="button" class="stream-load" id="flow-load">Запустить <span>→</span></button>';
  const load=()=>{
   const src=flowEmbedUrl(anime,episode,{audio:options.querySelector("#flow-audio").value,server:options.querySelector("#flow-server").value});
   if(!src){setStatus("Не удалось сформировать ссылку AniFlow.");return}
   stage.innerHTML='<iframe id="aniflow-player" class="stream-frame" src="'+src+'" title="AniFlow — '+esc(anime.n)+'" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
   const frame=stage.querySelector("iframe");let loaded=false;
   frame.addEventListener("load",()=>{loaded=true;setStatus("Плеер AniFlow открылся. Если внутри пустой экран — переключи сервер Flow/Kitty/Yuri.")});
   setStatus("Подключаем AniFlow · "+options.querySelector("#flow-server").value+"…");
   window.setTimeout(()=>{if(!disposed&&active==="flow"&&!loaded)setStatus("AniFlow долго не отвечает. Попробуй другой сервер или AniLiberty.")},12000);
  };
  options.querySelector("#flow-load").addEventListener("click",load);load();
 };
 const applyHlsControls=video=>{
  const quality=options.querySelector("#liberty-quality"),speed=options.querySelector("#liberty-speed");
  if(speed)speed.addEventListener("change",()=>video.playbackRate=Number(speed.value)||1);
  if(quality)quality.addEventListener("change",()=>{
   if(!hlsInstance)return;const val=quality.value;
   hlsInstance.currentLevel=val==="auto"?-1:Number(val);
  });
 };
 const playLiberty=async()=>{
  const epList=releaseData?.episodes||[];
  const wanted=epList.find(e=>getLibertyEpisodeNumber(e)===Number(episode))||epList.find(e=>Number(e.sort_order)===Number(episode));
  if(!wanted){stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>У выбранного релиза нет этой серии.</span></div>';setStatus("В AniLiberty не найдена серия "+episode+".");return}
  setStatus("Получаем ссылку на серию…");
  let detail=wanted,stream=getLibertyStream(detail);
  if(!stream&&wanted.id){try{detail=await getLibertyEpisode(wanted.id);stream=getLibertyStream(detail)}catch(error){console.warn("[AniWatch] AniLiberty episode:",error)}}
  if(!stream){stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>Для этой серии не найден HLS-поток. Попробуй другой релиз.</span></div>';setStatus("AniLiberty не вернул ссылку на видео.");return}
  options.innerHTML+='<label>Качество<select id="liberty-quality"><option value="auto">Авто</option></select></label><label>Скорость<select id="liberty-speed"><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="1.75">1.75×</option><option value="2">2×</option><option value="0.75">0.75×</option></select></label>';
  stage.innerHTML='<video class="stream-video" controls playsinline preload="metadata"></video>';
  const video=stage.querySelector("video");
  video.addEventListener("error",()=>setStatus("Ошибка видео. Поток может быть недоступен в регионе или заблокирован источником."));
  if(video.canPlayType("application/vnd.apple.mpegurl")){video.src=stream;applyHlsControls(video);setStatus("AniLiberty · серия "+episode+". Нажми ▶ для воспроизведения.");return}
  try{
   const Hls=await loadHls();
   if(Hls.isSupported()){
    destroyHls();hlsInstance=new Hls({enableWorker:true,lowLatencyMode:false,capLevelToPlayerSize:true,backBufferLength:90});
    hlsInstance.loadSource(stream);hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.MANIFEST_PARSED,()=>{
     const q=options.querySelector("#liberty-quality");if(q){q.innerHTML='<option value="auto">Авто</option>'+hlsInstance.levels.map((l,i)=>'<option value="'+i+'">'+(l.height?l.height+"p":Math.round(l.bitrate/1000)+" kbps")+'</option>').reverse().join("")}
     setStatus("AniLiberty · поток готов. Можно выбрать качество и скорость.");
    });
    hlsInstance.on(Hls.Events.ERROR,(_,data)=>{if(data?.fatal){setStatus("Поток AniLiberty оборвался: "+(data.details||data.type||"ошибка"));}});
    applyHlsControls(video);
   }else{video.src=stream;applyHlsControls(video);setStatus("Браузер не поддерживает HLS.js. Пробуем открыть поток напрямую.")}
  }catch(error){video.src=stream;applyHlsControls(video);setStatus(error.message||"Не удалось запустить HLS-плеер.")}
 };
 const showLiberty=async()=>{
  if(!releaseData){
   options.innerHTML='<span class="stream-note">Ищем релизы AniLiberty…</span>';stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>Поиск релиза и доступных серий…</span></div>';
   try{
    releases=sortLibertyMatches(await searchLibertyReleases(anime),anime);
    if(!releases.length)throw new Error("Подходящих релизов не найдено");
    selectedRelease=releases[0];await loadRelease(selectedRelease.id);
   }catch(error){options.innerHTML='<button type="button" class="stream-load" id="liberty-retry">Повторить поиск</button>';options.querySelector("#liberty-retry").addEventListener("click",()=>{releaseData=null;showLiberty()});stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>'+esc(error.message||"Источник временно недоступен")+'</span></div>';setStatus("AniLiberty: "+(error.message||"ошибка поиска"));return}
  }else renderLibertyOptions();
 };
 const loadRelease=async id=>{
  setStatus("Загружаем список серий AniLiberty…");releaseData=await getLibertyRelease(id);renderLibertyOptions();await playLiberty();
 };
 const renderLibertyOptions=()=>{
  const currentId=selectedRelease?.id;
  options.innerHTML=(releases.length>1?'<label>Релиз<select id="liberty-release">'+releases.map(r=>'<option value="'+esc(r.id)+'" '+(String(r.id)===String(currentId)?"selected":"")+'>'+esc(releaseName(r))+'</option>').join("")+'</select></label>':"")+'<span class="stream-note">'+esc(releaseName(selectedRelease))+'</span><button type="button" class="stream-load" id="liberty-refresh">Загрузить серию '+episode+' <span>→</span></button>';
  const select=options.querySelector("#liberty-release");
  if(select)select.addEventListener("change",async()=>{selectedRelease=releases.find(r=>String(r.id)===select.value);releaseData=null;try{await loadRelease(selectedRelease.id)}catch(error){setStatus("Не удалось загрузить релиз: "+error.message)}});
  options.querySelector("#liberty-refresh").addEventListener("click",playLiberty);
 };
 buttons.forEach(b=>b.addEventListener("click",()=>setActive(b.dataset.provider)));
 reload.addEventListener("click",()=>{destroyHls();if(active==="flow")showFlow();else{releaseData=null;showLiberty()}});
 showFlow();
 return {destroy(){disposed=true;destroyHls();root.innerHTML=""}};
}
