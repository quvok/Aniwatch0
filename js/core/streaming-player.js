const LIBERTY_BASES=["https://api.anilibria.app/api/v1","https://aniliberty.top/api/v1"];
const FLOW_BASE="https://api.aniflow.cc";
let hlsLoader=null,hlsInstance=null;
const textOf=value=>typeof value==="string"?value:value&&typeof value==="object"?(value.main||value.english||value.russian||""):"";
const releaseName=r=>textOf(r?.name)||r?.title||r?.name_english||r?.alias||"Без названия";
const clean=s=>String(s||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/gi," ").trim();
async function requestJson(url){
 const response=await fetch(url,{headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("HTTP "+response.status);
 return response.json();
}
async function libertyRequest(path){
 let last;
 for(const base of LIBERTY_BASES){
  try{return await requestJson(base+path)}catch(error){last=error}
 }
 throw last||new Error("AniLiberty недоступен");
}
export function flowEmbedUrl(anime,episode,{audio="sub",server="flow"}={}){
 if(!anime?.mal)return "";
 const url=new URL("/embed/mal/"+encodeURIComponent(anime.mal)+"/"+Math.max(1,Number(episode)||1)+"/"+audio,FLOW_BASE);
 url.searchParams.set("server",server);
 url.searchParams.set("autoskipIntro","1");
 url.searchParams.set("autoskipOutro","1");
 return url.toString();
}
export async function searchLibertyReleases(anime){
 const query=anime?.n||anime?.o;
 if(!query)throw new Error("Нет названия для поиска в AniLiberty");
 const results=await libertyRequest("/app/search/releases?query="+encodeURIComponent(query));
 return Array.isArray(results)?results:Array.isArray(results?.data)?results.data:[];
}
export async function getLibertyRelease(id){
 return libertyRequest("/anime/releases/"+encodeURIComponent(id));
}
export async function getLibertyEpisode(id){
 return libertyRequest("/anime/releases/episodes/"+encodeURIComponent(id));
}
export function getLibertyEpisodeNumber(ep){return Number(ep?.ordinal??ep?.sort_order??0)}
export function getLibertyStream(ep){
 return ep?.hls_1080||ep?.hls_720||ep?.hls_480||ep?.hls?.hls_1080||ep?.hls?.hls_720||ep?.hls?.hls_480||"";
}
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
  const script=document.createElement("script");
  script.src="https://cdn.jsdelivr.net/npm/hls.js@1.5.18/dist/hls.min.js";
  script.async=true;
  script.onload=()=>window.Hls?resolve(window.Hls):reject(new Error("HLS.js не загрузился"));
  script.onerror=()=>reject(new Error("Не удалось загрузить HLS-плеер"));
  document.head.appendChild(script);
 });
 return hlsLoader;
}
export function mountStreamPlayer({root,anime,episode}){
 if(!root)return {destroy(){}};
 if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}
 root.innerHTML=`
 <div class="stream-stage" id="stream-stage"><div class="stream-placeholder"><b>ANIWATCH</b><span>Выбери источник воспроизведения</span></div></div>
 <div class="stream-tools">
  <div class="stream-provider-tabs">
   <button type="button" class="on" data-provider="flow">AniFlow</button>
   <button type="button" data-provider="liberty">AniLiberty</button>
  </div>
  <div class="stream-options" id="stream-options"></div>
 </div>
 <p class="stream-status" id="stream-status" role="status">Выбери источник. Доступность зависит от конкретного тайтла и региона.</p>`;
 const stage=root.querySelector("#stream-stage"),options=root.querySelector("#stream-options"),status=root.querySelector("#stream-status");
 let active="flow",releases=[],selectedRelease=null,releaseData=null;
 const setStatus=s=>{if(status)status.textContent=s};
 const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const buttons=root.querySelectorAll("[data-provider]");
 const setActive=name=>{active=name;buttons.forEach(b=>b.classList.toggle("on",b.dataset.provider===name));name==="flow"?showFlow():showLiberty()};
 const showFlow=()=>{
  if(!anime?.mal){
   stage.innerHTML='<div class="stream-placeholder"><b>AniFlow</b><span>Для этого тайтла нет MAL ID — источник не может определить аниме.</span></div>';
   options.innerHTML='<span class="stream-note">AniFlow требует MyAnimeList ID.</span>';setStatus("AniFlow недоступен: у тайтла отсутствует MAL ID.");return;
  }
  options.innerHTML='<label>Озвучка<select id="flow-audio"><option value="sub">Субтитры</option><option value="dub">Дубляж</option></select></label><label>Сервер<select id="flow-server"><option value="flow">Flow</option><option value="kitty">Kitty</option><option value="yuri">Yuri</option><option value="zuri">Zuri</option><option value="buzz">Buzz</option></select></label><button type="button" class="stream-load" id="flow-load">Загрузить</button>';
  const load=()=>{
   const src=flowEmbedUrl(anime,episode,{audio:options.querySelector("#flow-audio").value,server:options.querySelector("#flow-server").value});
   stage.innerHTML='<iframe class="stream-frame" src="'+src+'" title="AniFlow — '+esc(anime.n)+'" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>';
   setStatus("Открыт AniFlow. Управление воспроизведением находится внутри плеера.");
  };
  options.querySelector("#flow-load").addEventListener("click",load);load();
 };
 const playLiberty=async()=>{
  const epList=releaseData?.episodes||[];
  const wanted=epList.find(e=>getLibertyEpisodeNumber(e)===Number(episode))||epList.find(e=>Number(e.sort_order)===Number(episode));
  if(!wanted){stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>У выбранного релиза нет этой серии.</span></div>';setStatus("В AniLiberty не найдена серия "+episode+".");return}
  setStatus("Получаем ссылку на серию…");
  let detail=wanted,stream=getLibertyStream(detail);
  if(!stream&&wanted.id){try{detail=await getLibertyEpisode(wanted.id);stream=getLibertyStream(detail)}catch(error){console.warn("[AniWatch] AniLiberty episode:",error)}}
  if(!stream){stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>Для этой серии нет доступного HLS-потока.</span></div>';setStatus("AniLiberty не вернул ссылку на видео для этой серии.");return}
  stage.innerHTML='<video class="stream-video" controls playsinline preload="metadata" crossorigin="anonymous"></video>';
  const video=stage.querySelector("video");
  if(video.canPlayType("application/vnd.apple.mpegurl")){video.src=stream;video.play().catch(()=>{});setStatus("AniLiberty · серия "+episode+". Если видео не запускается, попробуй другой источник.");return}
  try{
   const Hls=await loadHls();
   if(Hls.isSupported()){
    hlsInstance=new Hls({enableWorker:true,lowLatencyMode:false});hlsInstance.loadSource(stream);hlsInstance.attachMedia(video);
    hlsInstance.on(Hls.Events.ERROR,(_,data)=>{if(data?.fatal)setStatus("Ошибка потока AniLiberty. Попробуй другой источник или качество.")});
    setStatus("AniLiberty · серия "+episode+". Поток загружен.");
   }else{video.src=stream;setStatus("Браузер может не поддерживать HLS. Попробуй другой источник.")}
  }catch(error){video.src=stream;setStatus(error.message||"Не удалось запустить HLS-плеер.")}
 };
 const showLiberty=async()=>{
  if(!releaseData){
   options.innerHTML='<span class="stream-note">Ищем релизы AniLiberty…</span>';stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>Поиск русской версии и доступных серий…</span></div>';
   try{
    releases=sortLibertyMatches(await searchLibertyReleases(anime),anime);
    if(!releases.length)throw new Error("Подходящих релизов не найдено");
    selectedRelease=releases[0];
    await loadRelease(selectedRelease.id);
   }catch(error){options.innerHTML='<button type="button" class="stream-load" id="liberty-retry">Повторить поиск</button>';options.querySelector("#liberty-retry").addEventListener("click",()=>{releaseData=null;showLiberty()});stage.innerHTML='<div class="stream-placeholder"><b>AniLiberty</b><span>'+esc(error.message||"Источник временно недоступен")+'</span></div>';setStatus("AniLiberty: "+(error.message||"ошибка поиска"));return}
  }else renderLibertyOptions();
 };
 const loadRelease=async id=>{
  setStatus("Загружаем список серий AniLiberty…");
  releaseData=await getLibertyRelease(id);
  renderLibertyOptions();
  await playLiberty();
 };
 const renderLibertyOptions=()=>{
  const currentId=selectedRelease?.id;
  options.innerHTML=(releases.length>1?'<label class="stream-release-label">Релиз<select id="liberty-release">'+releases.map(r=>'<option value="'+esc(r.id)+'" '+(String(r.id)===String(currentId)?"selected":"")+'>'+esc(releaseName(r))+'</option>').join("")+'</select></label>':"")+'<span class="stream-note">'+esc(releaseName(selectedRelease))+'</span><button type="button" class="stream-load" id="liberty-refresh">Загрузить серию '+episode+'</button>';
  const select=options.querySelector("#liberty-release");
  if(select)select.addEventListener("change",async()=>{selectedRelease=releases.find(r=>String(r.id)===select.value);releaseData=null;try{await loadRelease(selectedRelease.id)}catch(error){setStatus("Не удалось загрузить выбранный релиз: "+error.message)}});
  options.querySelector("#liberty-refresh").addEventListener("click",playLiberty);
 };
 buttons.forEach(b=>b.addEventListener("click",()=>setActive(b.dataset.provider)));
 showFlow();
 return {destroy(){if(hlsInstance){try{hlsInstance.destroy()}catch{}hlsInstance=null}root.innerHTML=""}};
}
