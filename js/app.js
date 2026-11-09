import { query as xgq } from "./api/anilist.js";
import { fetchRandomAnime, fetchCatalogPage, fetchAnimeGenres, fetchAnimeByIds, fetchAnimeById, fetchAnimeRelated, fetchAnimeSimilar } from "./api/shikimori.js";
import { renderAnimeCard } from "./components/anime-card.js";
import { loadLocalState, initializeLocalState, saveLocalState } from "./core/storage.js";
import { initializeSupabaseAuth, signInWithEmail, signUpWithEmail, signOut, restoreCloudState, scheduleCloudSync, uploadProfileAvatar, loadRecommendationFeedback, saveRecommendationFeedback } from "./core/supabase.js";
import { buildTasteProfile, rankRecommendations } from "./core/recommendations.js";
import { activePage as getActivePage, updateNavigation, renderRoute, pageUrl, titleUrl, watchUrl, routeArgs, isRoute, legacyRedirect } from "./core/router.js";
import { renderSiteHeader } from "./components/site-header.js";
import { renderFavorites, renderMyList, renderProfile } from "./pages/collection.js";
import { renderCatalogPage } from "./pages/catalog.js";
import { renderHomePage } from "./pages/home.js";
import { renderAnimePage } from "./pages/anime.js";
import { renderWatchPage } from "./pages/watch.js";
import { renderRandomLoading, renderRandomError } from "./pages/discovery.js";
import { listen } from "./core/events.js";
import { renderTogetherPage } from "./pages/together.js";
import { listCollections, getCollection, createCollection, updateCollection, deleteCollection, addCollectionAnime, removeCollectionAnime, rateCollection } from "./core/collections.js";
import { renderCollectionsPage } from "./pages/collections.js";
import { createRoomCode, connectRoom, sendRoomEvent, disconnectRoom } from "./core/rooms.js";
import { mountStreamPlayer } from "./core/streaming-player.js";
import { fetchAniLibriaWeek, fetchAniLibriaCatalogPage, fetchAniLibriaSearchReleases, fetchAniLibriaGenres, fetchAniLibriaReleaseById } from "./api/anilibria.js";
import { renderCalendarPage } from "./pages/calendar.js";
(function(){
if(legacyRedirect())return;
renderSiteHeader();
var collectionSearchTimer=null,collectionSearchRequest=0;
var DUR=1420,GN=["Фэнтези","Экшен","Приключения","Романтика","Sci-Fi","Комедия","Детектив","Драма"];
// Тайтлы: [название, жанры, год, рейтинг, серий, статус, описание, цвет1, цвет2]
var D=[
["Тени Этерии","Фэнтези,Экшен",2026,8.9,12,"Онгоинг","Юный маг теряет память и попадает в мир, где магия — валюта.","#7c3aed","#db2777"],
["Хроники безмолвного моря","Приключения,Драма",2025,8.4,24,"Завершён","Команда исследователей ищет город, ушедший под воду.","#0891b2","#1e3a8a"],
["Последний маг","Экшен,Фэнтези",2026,8.7,12,"Онгоинг","Последний хранитель древней магии против империи.","#dc2626","#7c2d12"],
["Весна в Сакурагаве","Романтика,Драма",2024,8.1,13,"Завершён","Тихий городок, старая школа и одно неотправленное письмо.","#f472b6","#fb923c"],
["Кибер-ронин","Sci-Fi,Экшен",2026,8.6,12,"Онгоинг","Бывший самурай-киборг ищет создателя в неоновом мегаполисе.","#06b6d4","#6d28d9"],
["Школа звёздных ключей","Комедия,Sci-Fi",2025,7.8,12,"Завершён","Обычная школа оказывается порталом между галактиками.","#eab308","#ea580c"],
["Тихий детектив","Детектив,Драма",2023,8.8,24,"Завершён","Молчаливый сыщик раскрывает дела, которых не существует.","#475569","#0f172a"],
["Император пустоты","Фэнтези,Приключения",2025,9.0,25,"Завершён","Мальчик из трущоб наследует трон разрушенного мира.","#059669","#064e3b"],
["Девочка и дракон","Приключения,Комедия",2024,7.9,12,"Завершён","Дракон-пенсионер и юная путешественница меняют карту.","#f97316","#be123c"],
["Нулевой отряд","Экшен,Sci-Fi",2023,8.2,24,"Завершён","Отряд смертников защищает последнюю станцию.","#64748b","#7f1d1d"],
["Лунная кофейня","Романтика,Комедия",2026,8.0,12,"Онгоинг","Кофейня открывается только в полнолуние.","#a78bfa","#312e81"],
["Осколки миров","Фэнтези,Sci-Fi",2025,8.5,13,"Завершён","Разбитое зеркало открывает двери в соседние реальности.","#2dd4bf","#4c1d95"]
].map((a,i)=>({id:i,n:a[0],g:a[1].split(","),y:a[2],r:a[3],e:a[4],s:a[5],d:a[6],c:[a[7],a[8]]}));
var M={},H=[],AUTH_USER=null,AUTH_BUSY=false,anilibriaSchedule=null,anilibriaSchedulePending=null;
var $=s=>document.querySelector(s),app=$("#app"),S=loadLocalState(),F={g:"",s:"r",q:"",status:""},T=[],P=null,AP=false,V={};
function sv(){saveLocalState(S,M);scheduleCloudSync(S);if(activePage()==="home")refreshContinueShelf()}
function df(){S.fav=S.fav||[];S.hist=S.hist||{};S.watchedEpisodes=S.watchedEpisodes||{};S.rate=S.rate||{};S.watchlist=S.watchlist||{};S.name=S.name||"Гость";S.acc=S.acc||"#8b5cf6"}
df();
var LISTS=[["watching","Смотрю"],["planned","Запланировано"],["completed","Просмотрено"],["dropped","Брошено"]];
var esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
var un=s=>String(s||"").replace(/&quot;/g,'"').replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&amp;/g,"&");
var gr=d=>"linear-gradient(160deg,"+d.c[0]+","+d.c[1]+")";
function shikiImageUrl(path){
 if(!path)return "";
 var value=String(path).trim();if(!value)return "";
 var url=value.startsWith("//")?"https:"+value:value.startsWith("http")?value:"https://shikimori.io"+(value.startsWith("/")?value:"/"+value);
 try{var parsed=new URL(url);if(/\/missing_original(?:\.[a-z0-9]+)?$/i.test(parsed.pathname))return "";return url}catch(e){return ""}
}
var bg=d=>{var image=shikiImageUrl(d.img);return(image?"url('"+image+"') center/cover no-repeat,":"")+gr(d)};
var bn=d=>{var image=shikiImageUrl(d.ban)||shikiImageUrl(d.img);return "linear-gradient(0deg,#000 5%,rgba(0,0,0,.12) 65%,rgba(0,0,0,.08)), "+(image?"url('"+image+"') center/cover no-repeat,":"")+gr(d)};
var fm=t=>{t=Math.floor(t);return(t/60|0)+":"+("0"+t%60).slice(-2)};
var srt=k=>D.slice().sort((a,b)=>k=="n"?a.n.localeCompare(b.n):b[k]-a[k]);
function card(d,pr,href,badge){return renderAnimeCard(d,{state:S,background:bg,progress:pr,href:href||titleUrl(d.id),badge:badge})}
function scheduleEntryForAnime(d){if(!anilibriaSchedule||!d)return null;return anilibriaSchedule.find(item=>(Number(d.mal)>0&&Number(item.malId)===Number(d.mal))||(Number(d.shikiId)>0&&Number(item.shikimoriId)===Number(d.shikiId)))||null}
function newEpisodeBadge(d){var item=scheduleEntryForAnime(d);return item&&item.publishedEpisode!==null?"Новая серия · "+item.publishedEpisode:""}
async function loadAniLibriaSchedule(force){if(anilibriaSchedule&&!force)return anilibriaSchedule;if(anilibriaSchedulePending)return anilibriaSchedulePending;anilibriaSchedulePending=fetchAniLibriaWeek(!!force).then(items=>{anilibriaSchedule=items;return items}).finally(()=>{anilibriaSchedulePending=null});return anilibriaSchedulePending}
var row=(t,a,sub,id)=>'<section class="shelf"'+(id?' id="'+id+'"':"")+'><div class="shelf-head"><div><h2>'+t+'</h2>'+(sub?'<p class="shelf-sub">'+sub+'</p>':"")+'</div></div><div class="row">'+a.join("")+'</div></section>';
var epLabel=d=>d.e>0?d.e+" серий":d.ae>0?"Вышло "+d.ae+" серий":"Количество серий уточняется";
var epTotal=d=>d.e>0?d.e:(d.ae>0?d.ae:0);
var availableEpCount=d=>{var id=Number(d&&d.id),mal=Number(d&&d.mal),records=[S.aniEpisodes&&S.aniEpisodes[id],S.aniZipEpisodes&&S.aniZipEpisodes[id],S.kitsuEpisodes&&S.kitsuEpisodes[mal]].filter(x=>x&&Number.isFinite(Number(x.available))),counts=records.map(x=>Math.max(0,Number(x.available)));if(Number(d&&d.ae)>0)counts.push(Number(d.ae));if(counts.length)return Math.max(...counts);return ["Завершён","FINISHED"].includes(d&&d.s)?epTotal(d):null};
var watchedFor=id=>Array.isArray(S.watchedEpisodes&&S.watchedEpisodes[id])?S.watchedEpisodes[id].map(Number):[];
var eps=(d,cur,inline=false)=>{var total=epTotal(d);if(!total)return '<p class="m">Количество серий пока неизвестно.</p>';var watched=watchedFor(d.id),available=availableEpCount(d);return Array.from({length:total},(_,k)=>{var n=k+1,done=watched.includes(n),upcoming=available!==null&&n>available;return '<span class="episode-item'+(done?' is-watched':'')+(upcoming?' is-upcoming':'')+'">'+(upcoming?'<span class="episode-number" aria-label="Серия '+n+' ещё не вышла">'+n+'</span><small class="episode-upcoming-label">Скоро</small>':'<a href="'+watchUrl(d.id,n)+'" class="'+(n==cur?'on':'')+'" aria-label="Открыть отдельную страницу просмотра, серия '+n+'">'+n+'</a>')+(inline?'<button type="button" class="episode-inline-play" data-a="inline-watch" data-i="'+d.id+'" data-v="'+n+'" aria-label="'+(upcoming?'Серия ещё не вышла':'Смотреть серию '+n+' здесь')+'" '+(upcoming?'disabled title="Серия ещё не вышла"':'')+'>▶</button>':'')+'<button type="button" class="episode-watch-toggle'+(done?' is-watched':'')+'" data-a="episode-toggle" data-i="'+d.id+'" data-v="'+n+'" aria-label="'+(upcoming?'Серия ещё не вышла':done?'Убрать отметку о просмотре серии ':'Отметить серию как просмотренную ')+n+'" aria-pressed="'+done+'" '+(upcoming?'disabled title="Серия ещё не вышла"':'')+'>'+(upcoming?'–':done?'✓':'○')+'</button></span>'}).join('')};
function refreshEpisodeMarks(id){var watched=watchedFor(id),total=epTotal(M[id]||{}),count=watched.length;document.querySelectorAll('.episode-item').forEach(item=>{var b=item.querySelector('[data-a="episode-toggle"]');if(!b||Number(b.dataset.i)!==Number(id))return;var n=Number(b.dataset.v),done=watched.includes(n);item.classList.toggle('is-watched',done);b.classList.toggle('is-watched',done);b.setAttribute('aria-pressed',String(done));b.setAttribute('aria-label',(done?'Убрать отметку о просмотре серии ':'Отметить серию как просмотренную ')+n);b.textContent=done?'✓':'○'});document.querySelectorAll('[data-episode-progress="'+id+'"]').forEach(el=>{el.textContent=count+' / '+(total||'—')+' просмотрено'})}
function setEpisodeWatched(id,episode,done){var anime=M[Number(id)],available=anime?availableEpCount(anime):null;if(available!==null&&Number(episode)>available){toast("Эта серия ещё не вышла");return}S.watchedEpisodes=S.watchedEpisodes||{};var list=watchedFor(id).filter(n=>n!==Number(episode));if(done)list.push(Number(episode));list.sort((a,b)=>a-b);if(list.length)S.watchedEpisodes[id]=list;else delete S.watchedEpisodes[id];sv();refreshEpisodeMarks(id)}
function toast(m){var t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),2000)}
function exportBackup(){
 try{
  var payload={format:"AniWatchBackup",version:1,exportedAt:new Date().toISOString(),state:S};
  var blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  var url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="aniwatch-backup-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
  toast("Резервная копия сохранена");
 }catch(e){console.error("[AniWatch] Backup export failed",e);toast("Не удалось экспортировать данные")}
}
async function importBackup(file){
 if(!file)return;
 try{
  var payload=JSON.parse(await file.text()),state=payload&&payload.state;
  if(!payload||payload.format!=="AniWatchBackup"||payload.version!==1||!state||typeof state!=="object"||Array.isArray(state))throw new Error("Неподдерживаемый формат резервной копии");
  if(!Array.isArray(state.fav)||!state.hist||typeof state.hist!=="object"||!state.rate||typeof state.rate!=="object")throw new Error("Файл не похож на резервную копию AniWatch");
  if(!confirm("Импорт заменит текущие локальные данные. Продолжить?"))return;
  S=state;df();sv();draw();toast("Резервная копия восстановлена");
 }catch(e){console.error("[AniWatch] Backup import failed",e);toast(e.message||"Не удалось импортировать файл")}
}
function cleanDesc(v){return String(v||"").replace(/<[^>]*>/g," ").replace(/\[\/?[a-z][a-z0-9_]*(?:=[^\]]*)?\]/gi,"").replace(/\[\[|\]\]/g,"").replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff々〆ヵヶ]+/g," ").replace(/\s+/g," ").trim()}
function shortDesc(v,n){var s=cleanDesc(v);if(s.length<=n)return s;var cut=s.slice(0,n);return cut.slice(0,cut.lastIndexOf(" "))+"…"}

var featuredIndex=0;
function featured(){var d=H[featuredIndex%H.length]||D[0];loadBanner(d);ru(d);var rd=shortDesc((S.ru&&S.ru[d.id]&&S.ru[d.id].d)||d.d,190);return '<section class="hero hero-editorial" style="--hero-poster:url(\''+(shikiImageUrl(d.img)||"")+'\');background:'+bn(d)+'"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> В центре внимания</div><small>'+d.g.slice(0,3).join(" · ")+' <i>•</i> '+d.y+' <i>•</i> '+(d.s||"Аниме")+'</small><h1>'+d.n+'</h1><p id="featured-desc" data-id="'+d.id+'">'+rd+'</p><div class="hero-facts"><span>★ '+(d.r?Number(d.r).toFixed(1):"—")+'</span><span id="featured-count" data-id="'+d.id+'">'+epLabel(d)+'</span></div><div class="acts"><a class="btn" href="'+watchUrl(d.id,1)+'">▶ Смотреть</a><a class="btn ghost" href="'+titleUrl(d.id)+'">Подробнее</a></div></div><div class="hero-poster" style="background:'+bg(d)+'">'+(d.img?"":"<b>"+d.n[0]+"</b>")+'<span>ANIWATCH PICK</span></div>'+(H.length>1?'<button class="hero-arrow hero-prev" data-a="slide" data-v="-1" aria-label="Предыдущий баннер">‹</button><button class="hero-arrow hero-next" data-a="slide" data-v="1" aria-label="Следующий баннер">›</button><div class="hero-dots">'+H.map((x,i)=>'<button data-a="slide-to" data-v="'+i+'" class="'+(i===featuredIndex%H.length?"on":"") +'" aria-label="Баннер '+(i+1)+'"></button>').join("")+'</div>':"")+'</section>'}
function showFeatured(){var hw=$("#hw");if(hw)hw.innerHTML=featured()}
function animeProgress(d){
 var total=availableEpCount(d)||epTotal(d);
 if(!total)return 0;
 var watched=watchedFor(d.id).filter(n=>n>0&&n<=total).length;
 return Math.min(100,Math.round(watched/total*100));
}
function refreshContinueShelf(){var host=$("#continue-shelf");if(!host)return;var keys=Object.keys(S.hist||{}).filter(k=>M[k]&&S.hist[k]).sort((a,b)=>Number(S.hist[b].at||0)-Number(S.hist[a].at||0)).slice(0,6);var cards=keys.map(k=>card(M[k],Math.round((Number(S.hist[k].t)||0)/DUR*100),watchUrl(k,S.hist[k].ep||1)));host.outerHTML=row("Продолжить просмотр",cards.length?cards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf")}

var cloudRefreshPromise=null,cloudRefreshAt=0;
async function refreshCloudProgress(force=false){
 if(!AUTH_USER||cloudRefreshPromise||(!force&&Date.now()-cloudRefreshAt<20000))return cloudRefreshPromise;
 cloudRefreshAt=Date.now();
 cloudRefreshPromise=(async()=>{
  try{
   var merged=await restoreCloudState(S,AUTH_USER.id);
   if(!AUTH_USER)return;
   S=merged;
   saveLocalState(S,M);
   await xhyd();
   if(activePage()==="home")refreshContinueShelf();
  }catch(error){console.warn("[AniWatch] Cloud progress refresh failed:",error)}
  finally{cloudRefreshPromise=null}
 })();
 return cloudRefreshPromise;
}
window.addEventListener("focus",()=>refreshCloudProgress(true));
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshCloudProgress(true)});
setInterval(()=>{if(!document.hidden)refreshCloudProgress(false)},30000);

V.home=()=>{
 if(!homeCollections||!homeCollections.trending.length&&!homeCollections.popular.length&&!homeCollections.ongoing.length&&!homeCollections.recent.length){app.innerHTML='<section class="offline-state"><div class="eyebrow">SHIKIMORI</div><h1>Не удалось загрузить каталог</h1><p>Не получилось получить данные Shikimori. Проверь подключение и попробуй ещё раз.</p><button class="btn" type="button" data-a="reload">Повторить загрузку</button></section>';return}
 featuredIndex=0;
 var cont=Object.keys(S.hist).filter(k=>M[k]&&S.hist[k]).sort((x,y)=>Number(S.hist[y].at||0)-Number(S.hist[x].at||0)).slice(0,6).map(k=>card(M[k],Math.round((Number(S.hist[k].t)||0)/DUR*100),watchUrl(k,S.hist[k].ep||1)));
 var source=homeCollections,trending=source.trending.map(d=>card(d)),popular=source.popular.map(d=>card(d)),ongoing=source.ongoing.map(d=>card(d)),recent=source.recent.map(d=>card(d));
 var genres=(source.genres||[]).map(g=>'<div class="genre-tile"><span>'+esc(g)+'</span><b>Каталог Shikimori</b></div>').join("");
 renderHomePage({app,featured:featured(),continueCards:cont,trendingCards:trending,popularCards:popular,ongoingCards:ongoing,recentCards:recent,genreTiles:genres,row});
 loadHomeRecommendations();refreshContinueShelf();if(H.length>1)T.push(setInterval(()=>{featuredIndex=(featuredIndex+1)%H.length;showFeatured()},7000));
};


var recommendationRequest=0;var recommendationRequest=0;
function recommendationLibrary(){
 var ids=new Set([].concat(Object.keys(S.rate||{}),Object.keys(S.watchlist||{}),Object.keys(S.hist||{}),Object.keys(S.watchedEpisodes||{}),S.fav||[]).map(Number));
 return [...ids].map(id=>{
  var anime=M[id]||(S.shikiAnime&&S.shikiAnime[id])||(S.anilibriaAnime&&S.anilibriaAnime[id]);
  if(!anime)return null;
  return {id:id,mal:Number(anime.mal)||0,genres:anime.g||[],rating:S.rate&&S.rate[id],favorite:(S.fav||[]).map(Number).includes(id),status:S.watchlist&&S.watchlist[id],watchedCount:Array.isArray(S.watchedEpisodes&&S.watchedEpisodes[id])?S.watchedEpisodes[id].length:0};
 }).filter(Boolean);
}
function recommendationExcludedIds(){
 var excluded=new Set([].concat(Object.keys(S.rate||{}),Object.keys(S.watchlist||{}),Object.keys(S.hist||{}),Object.keys(S.watchedEpisodes||{}),Object.keys(S.recommendationDismissed||{}),S.fav||[]).map(Number).filter(id=>Number.isFinite(id)&&id>0));
 recommendationLibrary().forEach(item=>{if(item.mal>0)excluded.add("mal:"+item.mal)});
 return excluded;
}
function normalizeRecommendationGenre(value){
 return String(value||"").toLocaleLowerCase("ru").replace(/[ё]/g,"е").replace(/[\s\p{P}\p{S}]+/gu," ").trim();
}
async function loadHomeRecommendations(){
 var host=$("#recommendation-cards");
 if(!host)return;
 var request=++recommendationRequest;
 host.innerHTML='<p class="m">Подбираем аниме по твоей библиотеке…</p>';
 try{
  var profile=buildTasteProfile(recommendationLibrary()),raw=[];
  if(profile.hasTaste){
   try{
    var genreRows=await fetchAnimeGenres(),wanted=new Set(profile.topGenres.map(item=>item.name));
    var genreIds=genreRows.filter(g=>g&&g.kind==="genre"&&String(g.entry_type||"").toLowerCase()==="anime"&&[g.russian,g.name].some(name=>wanted.has(normalizeRecommendationGenre(name)))).map(g=>String(g.id||"")).filter(Boolean).slice(0,3);
    for(var genreId of genreIds){
     try{raw.push(...await fetchCatalogPage({page:1,limit:50,order:"popularity",genre:genreId}))}catch(error){console.warn("[AniWatch] Recommendation genre request failed:",error)}
    }
   }catch(error){console.warn("[AniWatch] Recommendation genres unavailable:",error)}
  }
  var usedRankedFallback=false;
  if(raw.length<15){
   try{raw.push(...await fetchCatalogPage({page:1,limit:50,order:"ranked"}));usedRankedFallback=true}catch(error){if(!raw.length)throw error}
  }
  if(request!==recommendationRequest||activePage()!=="home")return;
  var candidates=raw.map(shikiToItem),excluded=recommendationExcludedIds(),ranked=rankRecommendations(candidates,profile,excluded,12);
  if(ranked.length<8&&!usedRankedFallback){
   try{
    raw.push(...await fetchCatalogPage({page:1,limit:50,order:"ranked"}));
    candidates=raw.map(shikiToItem);
    ranked=rankRecommendations(candidates,profile,excluded,12);
   }catch(error){console.warn("[AniWatch] Recommendation fallback failed:",error)}
  }
  if(!ranked.length){
   host.innerHTML='<p class="m">Пока не удалось найти новые тайтлы. Попробуй позже — каталог Shikimori может быть временно недоступен.</p>';
   return;
  }
  ranked.forEach(item=>{M[item.anime.id]=item.anime;S.shikiAnime=S.shikiAnime||{};S.shikiAnime[item.anime.id]=item.anime});
  host.innerHTML=ranked.map(item=>'<div class="recommendation-item">'+card(item.anime)+'<p class="recommendation-reason">'+esc(item.reason)+'</p><button class="recommendation-dismiss" type="button" data-a="recommendation-dismiss" data-i="'+item.anime.id+'">Не интересно</button></div>').join("");
  xshikiPosters(ranked.map(item=>item.anime)).catch(error=>console.warn("[AniWatch] Recommendation poster lookup failed:",error));
  sv();
 }catch(error){
  console.warn("[AniWatch] Recommendations unavailable:",error);
  if(request===recommendationRequest&&activePage()==="home")host.innerHTML='<p class="m">Не удалось загрузить рекомендации. Попробуй обновить главную позже.</p>';
 }
}

var rc;

function startInlineWatch(anime,episode){
 var available=availableEpCount(anime);if(available!==null&&Number(episode)>available){toast("Эта серия ещё не вышла");return}
 var host=$("#inline-stream-player"),section=$("#inline-watch-section");if(!host||!section)return;
 if(INLINE_STREAM_PLAYER){INLINE_STREAM_PLAYER.destroy();INLINE_STREAM_PLAYER=null}
 section.hidden=false;
 var title=$("#inline-watch-title");if(title)title.textContent=anime.n+" · серия "+episode;var full=$("#inline-open-full");if(full)full.href=watchUrl(anime.id,episode);
 document.querySelectorAll(".episode-inline-play").forEach(b=>{b.classList.toggle("on",Number(b.dataset.v)===Number(episode));b.textContent=Number(b.dataset.v)===Number(episode)?"Ⅱ":"▶"});
 var inlineHistory=S.hist[anime.id],inlineResume=inlineHistory&&Number(inlineHistory.ep)===Number(episode)?inlineHistory:{};
 INLINE_STREAM_PLAYER=mountStreamPlayer({root:host,anime,episode,resumeAt:Number(inlineResume.t)||0,resumeSpeed:Number(inlineResume.speed)||1,onEpisodeEnded:()=>{
  setEpisodeWatched(anime.id,episode,true);
  var nextAvailable=availableEpCount(anime);
  var next=section.querySelector('.episode-inline-play[data-v="'+(episode+1)+'"]');
  if(nextAvailable!==null&&episode<nextAvailable){
   S.hist[anime.id]={ep:episode+1,t:0,at:Date.now()};sv();
   if(next){next.classList.add("next-ready");toast("Серия отмечена. Можно включить следующую.");}
  }else{
   delete S.hist[anime.id];sv();
   toast("Серия отмечена как просмотренная");
  }
 },onPlayback:media=>{
  var now=Date.now(),time=Math.max(0,Number(media.time)||0);
  if(time>0){S.hist[anime.id]={ep:episode,t:time,at:now,speed:Number(media.speed)||1};if(!startInlineWatch.lastSave||now-startInlineWatch.lastSave>=5000||!media.playing){startInlineWatch.lastSave=now;sv()}}
 }});
 section.scrollIntoView({behavior:"smooth",block:"start"});
}
var nextAiringRequest=0;
async function loadNextEpisode(d){
 var host=$("#next-episode-info");
 if(!host||!d||!(/Онгоинг|RELEASING/i.test(String(d.s||""))))return;
 var request=++nextAiringRequest;
 var id=d.source==="shikimori"||d.source==="anilibria"?0:Number(d.aniId||d.id)||0;
 var mal=d.source==="shikimori"||d.source==="anilibria"?Number(d.mal)||0:0;
 if(!id&&!mal)return;
 var key="aw-next-airing-"+(id||("mal-"+mal)),cached=null;
 try{cached=JSON.parse(localStorage.getItem(key)||"null")}catch(e){}
 var airing=cached&&Date.now()-Number(cached.at)<15*60*1000?cached.data:undefined;
 try{
  if(airing===undefined){
   var query,vars;
   if(mal){query="query($mal:Int){Media(idMal:$mal,type:ANIME){status nextAiringEpisode{airingAt episode}}}";vars={mal:mal}}
   else{query="query($id:Int){Media(id:$id,type:ANIME){status nextAiringEpisode{airingAt episode}}}";vars={id:id}}
   var result=await xgq(query,vars),media=result&&result.Media;
   airing=media&&media.status==="RELEASING"?media.nextAiringEpisode:null;
   try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data:airing||null}))}catch(e){}
  }
  if(request!==nextAiringRequest||!document.getElementById("next-episode-info"))return;
  if(!airing||!Number(airing.airingAt)||!Number(airing.episode))return;
  var date=new Date(Number(airing.airingAt)*1000);
  if(!Number.isFinite(date.getTime()))return;
  var dateText=new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long",year:date.getFullYear()!==new Date().getFullYear()?"numeric":undefined}).format(date);
  var timeText=new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(date);
  host.innerHTML='<span class="next-episode-icon" aria-hidden="true">◷</span><span class="next-episode-copy"><small>СЛЕДУЮЩАЯ СЕРИЯ · '+Math.floor(Number(airing.episode))+'-Я</small><strong>'+dateText+' · '+timeText+'</strong></span>';
  host.hidden=false;
 }catch(error){console.warn("[AniWatch] Next episode lookup failed:",error)}
}
V.title=p=>{
 var d=M[p[0]];if(!d)return renderMissing();
 document.title=htmlText(d.n)+" — AniWatch";
 renderAnimePage({app,anime:d,state:S,lists:LISTS,cleanDescription:cleanDesc,escapeHtml:esc,background:bg,backdrop:bn,episodes:(anime,cur)=>eps(anime,cur,true)});
 loadNextEpisode(d);ru(d);loadRelated(d)
};

var ROOM_CONNECTED=false,ROOM_LAST_SYNC=0,STREAM_PLAYER=null,INLINE_STREAM_PLAYER=null,ROOM_CLOCK_OFFSET=0,ROOM_CLOCK_READY=false,ROOM_CLOCK_TIMER=null,ROOM_CLOCK_ID=Math.random().toString(36).slice(2);
function broadcastPlayback(type){
 if(!ROOM_CONNECTED||!P)return;
 var media=STREAM_PLAYER&&STREAM_PLAYER.getPlaybackState?STREAM_PLAYER.getPlaybackState():null;
 var state=media||{time:P.t,playing:P.on,speed:P.sp||1};
 sendRoomEvent(type||"playback",{animeId:P.d.id,episode:P.n,time:state.time,playing:state.playing,speed:state.speed,host:true}).catch(e=>console.warn("[AniWatch] Playback broadcast failed:",e))
}
function connectWatchParty(){
 ROOM_CONNECTED=false;
 var status=$("#room-status"),online=$("#room-online");
 if(status)status.textContent="Подключение…";
 connectRoom(S.room,{name:S.name||"Гость",host:!!S.roomHost,
  onStatus:(state,error)=>{if(status)status.textContent=state==="connected"?"На связи":"Нет связи";if(state==="error")console.warn("[AniWatch] Room status:",error)},
  onPresence:presence=>{var users=Object.values(presence||{}).flat(),count=users.length,hostOnline=users.some(user=>user&&user.host);if(online)online.textContent=count+" "+(count===1?"участник":count<5?"участника":"участников");if(status)status.textContent=S.roomHost?"Вы ведущий":hostOnline?"Ведущий на связи":"Ожидание ведущего"},
  onEvent:payload=>{
   if(payload.type==="clock-ping"&&S.roomHost){sendRoomEvent("clock-pong",{echo:Number(payload.clientTime)||0,hostTime:Date.now(),pingId:payload.pingId,host:true}).catch(()=>{});return}
   if(payload.type==="clock-pong"&&!S.roomHost&&payload.pingId===ROOM_CLOCK_ID){var receivedAt=Date.now(),sentAt=Number(payload.echo)||receivedAt,hostAt=Number(payload.hostTime)||receivedAt;if(receivedAt>=sentAt&&receivedAt-sentAt<5000){ROOM_CLOCK_OFFSET=hostAt-((sentAt+receivedAt)/2);ROOM_CLOCK_READY=true}return}
   if(payload.type==="request-state"&&S.roomHost){broadcastPlayback("state");return}
   if(payload.type==="chat"){var empty=$("#ms .chat-empty");if(empty)empty.remove();msg(payload.name||"Гость",String(payload.text||"").slice(0,500));return}
   if(payload.type==="state"||payload.type==="playback"){
    if(S.roomHost||!payload.host||!P||!payload.animeId)return;
    if(Number(payload.animeId)!==Number(P.d.id)||Number(payload.episode)!==Number(P.n)){
     var target=watchUrl(Number(payload.animeId),Number(payload.episode)||1)+"&room="+encodeURIComponent(S.room);
     if(location.href.indexOf(target.split("#")[0])<0)location.href=target;
     return;
    }
    var hostNow=Date.now()+(ROOM_CLOCK_READY?ROOM_CLOCK_OFFSET:0),drift=Math.max(0,(hostNow-Number(payload.sentAt||hostNow))/1000);
    P.t=Math.max(0,Number(payload.time)||0)+(payload.playing?drift*(Number(payload.speed)||1):0);
    P.on=!!payload.playing;P.sp=Number(payload.speed)||1;
    if(STREAM_PLAYER&&STREAM_PLAYER.syncPlayback)STREAM_PLAYER.syncPlayback({time:P.t,playing:P.on,speed:P.sp});
    var speed=$("#sp");if(speed)speed.textContent=P.sp+"×";
   }
  }
 }).then(()=>{
  ROOM_CONNECTED=true;ROOM_LAST_SYNC=Date.now();
  if(ROOM_CLOCK_TIMER)clearInterval(ROOM_CLOCK_TIMER);
  if(!S.roomHost){var pingClock=()=>{if(ROOM_CONNECTED)sendRoomEvent("clock-ping",{clientTime:Date.now(),pingId:ROOM_CLOCK_ID}).catch(()=>{})};pingClock();ROOM_CLOCK_TIMER=setInterval(pingClock,5000)}else{ROOM_CLOCK_OFFSET=0;ROOM_CLOCK_READY=true}
  var empty=$("#ms .chat-empty");if(empty)empty.remove();
  msg("AniWatch","Вы подключились к комнате.");
  if(S.roomHost)broadcastPlayback("state");
  else sendRoomEvent("request-state",{name:S.name||"Гость"}).catch(()=>{});
 }).catch(error=>{ROOM_CONNECTED=false;if(status)status.textContent="Не удалось подключиться";console.error("[AniWatch] Room connect failed:",error);toast("Не удалось подключиться к комнате")});
}
function tick(s){if(!P)return;P.t=Math.min(DUR,P.t+s);if(P.t>=DUR){P.on=false;return nextEp()}
 var tc=$("#tc"),pg=$("#pg"),pl=$(".play");if(!tc||!pg||!pl)return;tc.textContent=fm(P.t);pg.style.width=P.t/DUR*100+"%";pl.textContent=P.on?"❚❚":"▶";if(s){S.hist[P.d.id]={ep:P.n,t:P.t,at:Date.now()};if(!tick.l||Date.now()-tick.l>5000){tick.l=Date.now();sv()}}
 if(P.on&&ROOM_CONNECTED&&Date.now()-ROOM_LAST_SYNC>8000){ROOM_LAST_SYNC=Date.now();broadcastPlayback("playback")}}
function pauseSave(){if(P&&!P.on&&P.t>0){S.hist[P.d.id]={ep:P.n,t:P.t,at:Date.now()};sv()}}
function nextEp(){var d=P.d,n=P.n,tot=epTotal(d);setEpisodeWatched(d.id,n,true);if(n<tot){S.hist[d.id]={ep:n+1,t:0,at:Date.now()};sv();try{sessionStorage.setItem("aw.ap","1")}catch(e){}location.href=watchUrl(d.id,n+1)}else if(!tot){S.hist[d.id]={ep:n,t:0,at:Date.now()};sv();toast("Серия закончилась");$(".play").textContent="▶"}else{delete S.hist[d.id];sv();toast("Тайтл досмотрен 🎉");$(".play").textContent="▶"}}
V.watch=p=>{
 var d=M[p[0]];if(!d)return renderMissing();
 var queryRoom=new URLSearchParams(location.search).get("room");
 if(queryRoom){var normalized=queryRoom.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12),guestInvite=new URLSearchParams(location.search).get("guest")==="1",roomChanged=S.room!==normalized;if(roomChanged||guestInvite){S.room=normalized;if(roomChanged||guestInvite)S.roomHost=false;S.roomAnime=d.id;sv()}}
 var n=Math.max(p[1]||1,1),h=S.hist[d.id],available=availableEpCount(d);if(epTotal(d)>0)n=Math.min(n,epTotal(d));if(available!==null&&n>available){document.title=htmlText(d.n)+" · серия ещё не вышла — AniWatch";app.innerHTML='<section class="offline-state"><div class="eyebrow">СКОРО</div><h1>Эта серия ещё не вышла</h1><p>Сейчас доступно '+available+' серий. Вернись позже, когда выйдет серия '+n+'.</p><a class="btn" href="'+titleUrl(d.id)+'">Вернуться к аниме</a></section>';return}document.title=htmlText(d.n)+" · серия "+n+" — AniWatch";
 var inRoom=!!S.room;
 P={d:d,n:n,t:h&&h.ep==n?h.t:0,on:readAutoplay(),sp:h&&h.ep==n&&Number(h.speed)>0?Number(h.speed):1};
 renderWatchPage({app,anime:d,episode:n,inRoom,state:S,escapeHtml:esc,backdrop:bn,episodes:eps,episodeTotal:epTotal});
 var historySaveAt=0;
 STREAM_PLAYER=mountStreamPlayer({root:$("#stream-player"),anime:d,episode:n,resumeAt:P.t,resumeSpeed:P.sp,onEpisodeEnded:()=>{setEpisodeWatched(d.id,n,true);var nextAvailable=availableEpCount(d);if(nextAvailable!==null&&n<nextAvailable){S.hist[d.id]={ep:n+1,t:0,at:Date.now(),speed:P.sp||1};sv();setTimeout(()=>{location.href=watchUrl(d.id,n+1)+(inRoom?"&room="+encodeURIComponent(S.room):"")},250)}else{delete S.hist[d.id];sv();toast("Серия завершена")}},onPlayback:media=>{
  // Save real HTML5 player progress; the legacy custom-player tick is not used here.
  var now=Date.now(),time=Math.max(0,Number(media.time)||0);
  if(time>0){
   S.hist[d.id]={ep:n,t:time,at:now,speed:Number(media.speed)||1};
   P.t=time;P.on=!!media.playing;P.sp=Number(media.speed)||1;
   if(now-historySaveAt>=5000||!media.playing){historySaveAt=now;sv()}
  }
  if(!ROOM_CONNECTED||!S.roomHost)return;
  if(now-ROOM_LAST_SYNC<650&&media.playing)return;ROOM_LAST_SYNC=now;
  sendRoomEvent("playback",{animeId:d.id,episode:n,time:media.time,playing:media.playing,speed:media.speed,host:true}).catch(e=>console.warn("[AniWatch] Player sync failed:",e));
 }});
 loadBanner(d);
 if(inRoom)connectWatchParty();
};

V.together=()=>renderTogetherPage({app,state:S,animeList:D,escapeHtml:esc});
async function searchCollectionAnime(query){
 var host=$("#collection-anime-search-results"),q=String(query||"").trim(),request=++collectionSearchRequest;if(!host)return;
 if(q.length<2){host.innerHTML='<p class="profile-hint">Введи минимум 2 символа для поиска.</p>';return}
 host.innerHTML='<p class="profile-hint">Ищем аниме…</p>';
 try{
  var raw=await fetchCatalogPage({query:q,page:1,limit:30,order:"popularity"});
  if(request!==collectionSearchRequest||!$("#collection-anime-search-results"))return;
  var list=(Array.isArray(raw)?raw:[]).map(shikiToItem).filter(x=>x&&Number(x.shikiId)>0);
  list.forEach(d=>{M[d.id]=d;S.shikiAnime=S.shikiAnime||{};S.shikiAnime[d.id]=d});
  await xshikiPosters(list);if(request!==collectionSearchRequest)return;host=$("#collection-anime-search-results");if(!host)return;
  host.innerHTML=list.length?list.map(d=>'<article class="collection-search-result"><div class="collection-search-poster">'+(shikiImageUrl(d.img)?'<img src="'+esc(d.img)+'" alt="" loading="lazy">':'<span>AW</span>')+'</div><div class="collection-search-info"><b>'+esc(un(d.n))+'</b><small>'+esc(d.y||"Год неизвестен")+' · '+esc((d.g||[]).slice(0,2).join(", "))+'</small></div><button type="button" class="btn collection-search-add" data-a="collection-add-search-item" data-id="'+d.id+'">Добавить</button></article>').join(""):'<p class="profile-hint">Ничего не найдено. Попробуй другое название.</p>';
 }catch(error){if(request!==collectionSearchRequest)return;console.warn("[AniWatch] Collection anime search failed:",error);host.innerHTML='<p class="profile-hint">Не удалось выполнить поиск. Попробуй ещё раз.</p>'}
}
async function loadCollectionsView(params){
 app.innerHTML='<p class="empty">Загружаем коллекции…</p>';
 try{
  var id=params&&params[0],currentUserId=AUTH_USER?.id||null;
  if(id){var detail=await getCollection(id);detail.items.forEach(item=>{if(item.anime_data&&!M[item.anime_id])M[item.anime_id]=item.anime_data});renderCollectionsPage({app,detail,user:AUTH_USER,animeList:Object.values(M),currentUserId});xshikiPosters(detail.items.map(item=>M[item.anime_id]).filter(Boolean));}
  else{var collections=await listCollections(currentUserId);renderCollectionsPage({app,collections,user:AUTH_USER,animeList:Object.values(M),currentUserId});}
 }catch(error){console.error("[AniWatch] Collections load failed:",error);app.innerHTML='<section class="offline-state"><h1>Не удалось загрузить коллекции</h1><p>Проверь подключение и попробуй ещё раз.</p><button class="btn" data-a="collections-reload">Повторить</button></section>'}
}
V.collections=loadCollectionsView;
V.favorites=()=>{renderFavorites({app,state:S,mediaMap:M,card:d=>card(d,animeProgress(d),undefined,newEpisodeBadge(d))});if(!anilibriaSchedule)loadAniLibriaSchedule(false).then(()=>{if(activePage()==="favorites")V.favorites()}).catch(error=>console.warn("[AniWatch] AniLibria schedule unavailable:",error))};
V.mylist=()=>{renderMyList({app,state:S,mediaMap:M,filters:F,lists:LISTS,card:d=>card(d,animeProgress(d),undefined,newEpisodeBadge(d))});if(!anilibriaSchedule)loadAniLibriaSchedule(false).then(()=>{if(activePage()==="mylist")V.mylist()}).catch(error=>console.warn("[AniWatch] AniLibria schedule unavailable:",error))};
V.calendar=async()=>{renderCalendarPage({app,loading:true});try{var items=await loadAniLibriaSchedule(false);if(activePage()==="calendar")renderCalendarPage({app,items})}catch(error){console.warn("[AniWatch] Calendar load failed:",error);if(activePage()==="calendar")renderCalendarPage({app,error:error.message||"Не удалось связаться с AniLibria"})}};
V.profile=()=>renderProfile({app,state:S,mediaMap:M,escapeHtml:esc,user:AUTH_USER});
function openAuthModal(){
 if(AUTH_USER){location.href=PAGES.profile;return}
 if(document.getElementById("auth-modal"))return;
 var modal=document.createElement("div");
 modal.id="auth-modal";modal.className="auth-modal";modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.setAttribute("aria-labelledby","auth-modal-title");
 modal.innerHTML='<div class="auth-modal-backdrop" data-a="auth-close"></div><section class="auth-modal-panel"><button class="auth-modal-close" type="button" data-a="auth-close" aria-label="Закрыть">×</button><div class="auth-box"><div class="auth-heading"><span class="eyebrow">ANIWATCH ACCOUNT</span><h2 id="auth-modal-title">Смотри на любом устройстве</h2><p>Войди или создай аккаунт, чтобы синхронизировать избранное, списки и историю просмотра.</p></div><div class="auth-tabs"><button type="button" class="on" data-a="auth-mode" data-v="login" data-auth-mode="login">Вход</button><button type="button" data-a="auth-mode" data-v="signup" data-auth-mode="signup">Регистрация</button></div><form id="auth-form" class="auth-form" novalidate><input type="hidden" name="auth-mode" value="login"><label id="auth-username-wrap" hidden>Ник<input id="auth-username" type="text" maxlength="20" autocomplete="nickname" placeholder="Придумай уникальный ник"></label><label id="auth-login-wrap">Логин или электронная почта<input id="auth-login" type="text" autocomplete="username" placeholder="Ник или name@example.com" required></label><label id="auth-email-wrap" hidden>Электронная почта<input id="auth-email" type="email" autocomplete="email" placeholder="name@example.com"></label><label>Пароль<input id="auth-password" type="password" autocomplete="current-password" minlength="6" placeholder="Минимум 6 символов" required></label><button class="btn auth-submit" id="auth-submit" type="submit">Войти</button><p id="auth-message" class="auth-message" role="status" aria-live="polite"></p></form></div></section>';
 document.body.appendChild(modal);
 var login=document.getElementById("auth-login");if(login)login.focus();
}
async function handleAuthSubmit(form){
 if(AUTH_BUSY)return;
 var mode=form.querySelector("[name=auth-mode]")?.value||"login";
 var login=String($("#auth-login")?.value||"").trim(),email=String($("#auth-email")?.value||"").trim(),password=$("#auth-password")?.value||"",username=String($("#auth-username")?.value||"").trim();
 var status=$("#auth-message"),button=$("#auth-submit");
 if((mode==="signup"?!email:!login)||!password){if(status)status.textContent=mode==="signup"?"Заполни почту и пароль.":"Заполни логин и пароль.";return}
 if(mode==="signup"&&!username){if(status)status.textContent="Придумай ник.";return}
 if(mode==="signup"&&password.length<6){if(status)status.textContent="Пароль должен содержать минимум 6 символов.";return}
 AUTH_BUSY=true;if(button){button.disabled=true;button.textContent="Подождите…"}if(status)status.textContent="";
 try{
  var result=mode==="signup"?await signUpWithEmail(email,password,username):await signInWithEmail(login,password);
  // A user object may exist before email confirmation, but without a session
  // there is no authenticated JWT and RLS must reject library writes.
  AUTH_USER=result.session?.user||result.data?.session?.user||null;
  if(AUTH_USER){
   S=await restoreCloudState(S,AUTH_USER.id);var cloudFeedback=await loadRecommendationFeedback(AUTH_USER.id);S.recommendationDismissed={...(S.recommendationDismissed||{}),...cloudFeedback};Object.keys(S.recommendationDismissed).forEach(id=>{if(!cloudFeedback[id])saveRecommendationFeedback(AUTH_USER.id,id).catch(error=>console.warn("[AniWatch] Guest recommendation feedback sync failed:",error))});if(mode==="signup"&&username)S.name=username.slice(0,20);saveLocalState(S,M);hd();if(activePage()==="home")loadHomeRecommendations();toast(mode==="signup"?"Аккаунт создан":"Вход выполнен");var authModal=document.getElementById("auth-modal");if(authModal)authModal.remove();if(activePage()==="profile")V.profile();
  }else if(status){status.textContent=mode==="signup"?"Регистрация завершена. Теперь войди в аккаунт.":"Не удалось получить активную сессию. Попробуй войти ещё раз."}
 }catch(error){console.error("[AniWatch] Auth error:",error);if(status)status.textContent=authErrorText(error)}
 finally{AUTH_BUSY=false;if(button){button.disabled=false;button.textContent=mode==="signup"?"Создать аккаунт":"Войти"}}
}
function authErrorText(error){
 var m=String(error?.message||"");
 if(/Invalid login credentials|Неверный логин или пароль/i.test(m))return "Неверный логин или пароль.";
 if(/User already registered/i.test(m))return "Аккаунт с такой почтой уже существует.";
 if(/Password should be at least/i.test(m))return "Пароль слишком короткий.";
 if(/Email not confirmed/i.test(m))return "Сначала подтверди почту по ссылке из письма.";
 if(/rate limit/i.test(m))return "Слишком много попыток. Попробуй позже.";
 return m||"Не удалось выполнить запрос. Попробуй ещё раз.";
}
async function handleAuthLogout(){
 try{
  await signOut();
  AUTH_USER=null;
  S.avatar="";
  saveLocalState(S,M);
  hd();
  toast("Вы вышли из аккаунта");
  V.profile();
 }catch(error){console.error("[AniWatch] Sign out failed:",error);toast("Не удалось выйти из аккаунта")}
}

// ---- Реальные данные: AniList (постеры, баннеры, описания) + Shikimori (русские названия и описания) ----
var Q="query{Page(perPage:30){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){id idMal title{romaji english}genres seasonYear startDate{year month}averageScore episodes status description(asHtml:false)coverImage{extraLarge color}bannerImage}}}";
var GR={Action:"Экшен",Adventure:"Приключения",Comedy:"Комедия",Drama:"Драма",Fantasy:"Фэнтези",Romance:"Романтика",Mystery:"Детектив","Slice of Life":"Повседневность",Supernatural:"Сверхъестественное",Sports:"Спорт",Horror:"Ужасы",Mecha:"Меха",Music:"Музыка",Psychological:"Психология",Thriller:"Триллер"};
var ST={RELEASING:"Онгоинг",FINISHED:"Завершён",NOT_YET_RELEASED:"Скоро",CANCELLED:"Отменён",HIATUS:"Пауза"};
function mp(m){
 var title=m.title||{},genres=Array.isArray(m.genres)&&m.genres.length?m.genres:["Аниме"];
 var primary=title.english||title.romaji||title.native||"Без названия";
 var alternate=title.romaji&&title.romaji!==primary?title.romaji:(title.native&&title.native!==primary?title.native:"");
 return{id:m.id,aniId:m.id,source:"anilist",mal:m.idMal||null,n:esc(primary),o:esc(alternate),g:genres.map(g=>GR[g]||g),y:m.seasonYear||(m.startDate&&m.startDate.year)||0,r:m.averageScore?m.averageScore/10:0,e:Number(m.episodes)||0,s:ST[m.status]||"",d:esc((m.description||"Описание отсутствует.").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()),c:["#7c3aed","#0f0f1a"],img:"",ban:"",kind:String(m.format||"").toLowerCase()}
}

// AniList is the source of truth for catalog metadata and navigation IDs.
// Do not treat AniList MAL IDs as Shikimori IDs. They are different ID namespaces.
// AniList remains the source of truth; episode counts are enriched through MAL-aware services.
async function enrichShikimori(list){return list||[];}

function idx(){M={};D.forEach(d=>M[d.id]=d);var c={};D.forEach(d=>d.g.forEach(g=>c[g]=(c[g]||0)+1));GN=Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,10);H=D.filter(d=>d.ban).slice(0,8);if(H.length<8){var featuredIds=new Set(H.map(d=>d.id));H=H.concat(D.filter(d=>!featuredIds.has(d.id)).slice(0,8-H.length))}}
var aniCountPending={};
async function anilibriaCount(d){
 var cache=S.aniEpisodes=S.aniEpisodes||{},saved=cache[d.id];
 if(saved&&Date.now()-saved.at<6*36e5){d.e=Number(saved.total)||d.e;d.ae=Number(saved.available)||0;refreshEpCount(d);return}
 if(aniCountPending[d.id])return aniCountPending[d.id];
 aniCountPending[d.id]=(async()=>{
  var names=[un(d.n),un(d.o)].filter(Boolean),match=null;
  for(var q of names){
   try{
    var sr=await fetch("https://api.anilibria.app/api/v1/app/search/releases?query="+encodeURIComponent(q));
    if(!sr.ok)continue;
    var list=await sr.json();if(!Array.isArray(list))list=list.list||list.data||[];
    var wanted=names.map(normTitle).filter(Boolean);
    match=list.find(x=>{var n=x.name||{};return [n.main,n.english,n.alternative,x.name_ru,x.name_en].some(v=>wanted.includes(normTitle(v)))});
    if(match)break;
   }catch(e){}
  }
  if(!match)return;
  try{
   var rr=await fetch("https://api.anilibria.app/api/v1/anime/releases/"+encodeURIComponent(match.id));
   if(!rr.ok)return;
   var data=await rr.json(),total=Number(data.episodes_count||data.episodes_total||(data.type&&data.type.episodes)||0);
   var available=Array.isArray(data.episodes)?data.episodes.length:0;
   if(!total&&data.episodes&&typeof data.episodes==="object")available=Object.keys(data.episodes).length;
   if(!total&&!available)return;
   cache[d.id]={total:total,available:available,at:Date.now()};sv();
   if(total)d.e=total;d.ae=available;refreshEpCount(d);
  }catch(e){}
 })();
 await aniCountPending[d.id];delete aniCountPending[d.id];
}
var aniZipPending={};
async function aniZipCount(d){
 if(!Number(d.id))return 0;
 var cache=S.aniZipEpisodes=S.aniZipEpisodes||{},saved=cache[d.id];
 if(saved&&Date.now()-saved.at<6*36e5){if(!d.e&&saved.total>0)d.e=saved.total;if(!d.ae&&saved.available>0)d.ae=saved.available;refreshEpCount(d);return saved.total||saved.available}
 if(aniZipPending[d.id])return aniZipPending[d.id];
 aniZipPending[d.id]=(async()=>{
  try{
   var res=await fetch("https://api.ani.zip/v1/episodes?anilist_id="+encodeURIComponent(d.id));
   if(!res.ok)return 0;
   var data=await res.json(),total=Number(data.episodeCount)||0,episodes=data.episodes||{},available=Object.keys(episodes).filter(k=>/^\d+$/.test(k)).length;
   if(!total&&!available)return 0;
   cache[d.id]={total:total,available:available,at:Date.now()};sv();
   if(total&&!d.e)d.e=total;
   if(!total&&available&&!d.ae)d.ae=available;
   refreshEpCount(d);return total||available;
  }catch(e){return 0}
 })();
 var result=await aniZipPending[d.id];delete aniZipPending[d.id];return result;
}
var kitsuPending={};
async function kitsuCount(d){
 if(!d.mal)return 0;
 var cache=S.kitsuEpisodes=S.kitsuEpisodes||{},saved=cache[d.mal];
 if(saved&&Date.now()-saved.at<6*36e5){if(!d.e&&saved.total>0)d.e=saved.total;if(!d.ae&&saved.available>0)d.ae=saved.available;refreshEpCount(d);return saved.total||saved.available}
 if(kitsuPending[d.mal])return kitsuPending[d.mal];
 kitsuPending[d.mal]=(async()=>{
  try{
   var map=await fetch("https://api.ani.zip/mappings?mal_id="+encodeURIComponent(d.mal));
   if(!map.ok)return 0;
   var mj=await map.json(),kid=mj.kitsu_id||(mj.mappings&&mj.mappings.kitsu_id);
   if(!kid)return 0;
   var [animeRes,epRes]=await Promise.all([
    fetch("https://kitsu.io/api/edge/anime/"+encodeURIComponent(kid)),
    fetch("https://kitsu.io/api/edge/episodes?filter%5BmediaType%5D=Anime&filter%5BmediaId%5D="+encodeURIComponent(kid)+"&page%5Blimit%5D=1")
   ]);
   var total=0,available=0;
   if(animeRes.ok){var ad=await animeRes.json();total=Number(ad.data&&ad.data.attributes&&ad.data.attributes.episodeCount)||0}
   if(epRes.ok){var ed=await epRes.json();available=Number(ed.meta&&ed.meta.count)||0}
   if(!total&&!available)return 0;
   cache[d.mal]={total:total,available:available,at:Date.now()};sv();
   if(total&&!d.e)d.e=total;
   if(!total&&available&&!d.ae)d.ae=available;
   refreshEpCount(d);return total||available;
  }catch(e){return 0}
 })();
 var result=await kitsuPending[d.mal];delete kitsuPending[d.mal];return result;
}
var jikanPending={};
async function jikanCount(d,force){
 if(!d.mal)return;
 var cache=S.jikanEpisodes=S.jikanEpisodes||{},saved=cache[d.mal];
 if(saved&&Date.now()-saved.at<30*864e5){
  if(!d.e&&saved.total>0)d.e=saved.total;
  if(force&&d.mal===21)console.info("[AniWatch] One Piece: AniList/Shikimori =",d.e||0,"; Jikan =",saved.total);
  refreshEpCount(d);return saved.total;
 }
 if(jikanPending[d.mal])return jikanPending[d.mal];
 jikanPending[d.mal]=(async()=>{
  try{
   var res=await fetch("https://api.jikan.moe/v4/anime/"+encodeURIComponent(d.mal));
   if(!res.ok)return 0;
   var json=await res.json(),total=Number(json.data&&json.data.episodes)||0;
   if(!total)return 0;
   cache[d.mal]={total:total,at:Date.now()};sv();
   if(!d.e)d.e=total;
   if(force&&d.mal===21)console.info("[AniWatch] One Piece: AniList/Shikimori =",d.e||0,"; Jikan =",total);
   refreshEpCount(d);return total;
  }catch(e){return 0}
 })();
 var result=await jikanPending[d.mal];delete jikanPending[d.mal];return result;
}
var relatedPending={};
var relationNames={SEQUEL:"Продолжение",PREQUEL:"Приквел",SIDE_STORY:"Побочная история",PARENT_STORY:"Основная история",ALTERNATIVE:"Альтернативная версия",ALTERNATIVE_SETTING:"Альтернативный сюжет",SPIN_OFF:"Спин-офф",SUMMARY:"Пересказ",FULL_STORY:"Полная версия",CHARACTER:"Связанные персонажи",OTHER:"Связанный тайтл",SOURCE:"Первоисточник",COMPILATION:"Сборник"};
var relatedFields="id idMal type format title{romaji english}genres seasonYear startDate{year}averageScore episodes status description(asHtml:false)coverImage{extraLarge color} bannerImage";
function relatedCards(list){return list.map(x=>card(x)).join("")}
async function enrichRelatedFromShikimori(list){
 var items=(list||[]).filter(x=>x&&Number(x.mal)>0&&!Number(x.shikiId));
 var cursor=0;
 async function worker(){
  while(cursor<items.length){
   var item=items[cursor++],titles=[un(item.n),un(item.o)].filter(Boolean),match=null;
   for(var title of titles){
    try{
     var found=await fetchCatalogPage({query:title,page:1,limit:10,order:"popularity"});
     match=(Array.isArray(found)?found:[]).find(a=>Number(a.myanimelist_id)===Number(item.mal));
     if(match)break;
    }catch(error){console.warn("[AniWatch] Related Shikimori lookup failed:",error)}
   }
   if(match){
    var normalized=shikiToItem(match);
    item.shikiId=normalized.shikiId;
    item.n=normalized.n;
    item.o=normalized.o;
    item.g=normalized.g;
    item.y=normalized.y;
    item.r=normalized.r;
    item.e=normalized.e;
    item.s=normalized.s;
    item.img=normalized.img||item.img;
   }
  }
 }
 await Promise.all(Array.from({length:Math.min(3,items.length)},()=>worker()));

 // AniLibria IDs are a separate namespace. Match only by the explicit
 // Shikimori cross-reference supplied by AniLibria, never by numeric ID equality.
 var candidates=(list||[]).filter(x=>x&&Number(x.shikiId)>0);
 cursor=0;
 async function anilibriaWorker(){
  while(cursor<candidates.length){
   var item=candidates[cursor++],queries=[un(item.n),un(item.o)].filter(Boolean),matched=null;
   for(var query of queries){
    try{
     var searchResults=await fetchAniLibriaSearchReleases(query);
     matched=searchResults.find(raw=>{
      var release=raw&&raw.release?raw.release:raw;
      return Number(release&&release.shikimori&&release.shikimori.id)===Number(item.shikiId);
     });
     if(!matched){
      var page=await fetchAniLibriaCatalogPage({page:1,limit:50,search:query});
      matched=(page.items||[]).find(raw=>{
       var release=raw&&raw.release?raw.release:raw;
       return Number(release&&release.shikimori&&release.shikimori.id)===Number(item.shikiId);
      });
     }
     if(matched)break;
    }catch(error){console.warn("[AniWatch] Related AniLibria lookup failed:",error)}
   }
   if(!matched)continue;
   var normalizedRelease=anilibriaToItem(matched);
   if(!normalizedRelease)continue;
   Object.assign(item,normalizedRelease);
   M[item.id]=item;
  }
 }
 await Promise.all(Array.from({length:Math.min(2,candidates.length)},()=>anilibriaWorker()));
 return list||[];
}
async function translateRelated(list){return enrichShikimori(list)}
async function loadRelated(d){
 var root=$("#related-anime");if(!root)return;
 var cached=S.relatedAnime=S.relatedAnime||{},saved=cached[d.id];
 if(saved&&saved.v===13&&Date.now()-saved.at<7*864e5){renderRelated(d,saved);return}
 if(relatedPending[d.id])return relatedPending[d.id];
 relatedPending[d.id]=(async()=>{
  try{
   var relations=[],creatorName="",creatorWorks=[],studioNames=[],staffPeople=[];
   try{
    var query,vars;
    if(d.source==="shikimori"){
     if(!(Number(d.mal)>0))throw new Error("Не удалось найти данные для этого аниме");
     query="query($mal:Int){Media(idMal:$mal,type:ANIME){relations{edges{relationType node{"+relatedFields+"}}} studios(isMain:true){nodes{name}}}}";
     vars={mal:Number(d.mal)};
    }else if(d.source==="anilibria"&&Number(d.mal)>0){
     query="query($mal:Int){Media(idMal:$mal,type:ANIME){relations{edges{relationType node{"+relatedFields+"}}} studios(isMain:true){nodes{name}}}}";
     vars={mal:Number(d.mal)};
    }else{
     query="query($id:Int){Media(id:$id,type:ANIME){relations{edges{relationType node{"+relatedFields+"}}} studios(isMain:true){nodes{name}}}}";
     vars={id:Number(d.aniId||d.id)};
    }
    var payload=await xgq(query,vars),media=payload&&payload.Media;
    if(!media)throw new Error("Не удалось получить данные об этом аниме");
    studioNames=(media.studios&&media.studios.nodes||[]).map(studio=>studio&&studio.name).filter(Boolean);
    var relSeen={};
    relations=(media.relations&&media.relations.edges||[]).filter(e=>e.node&&e.node.type==="ANIME"&&e.node.format!=="MUSIC"&&e.relationType!=="CHARACTER"&&e.node.id!==(d.aniId||d.id)).map(e=>({type:e.relationType,anime:mp(e.node)})).filter(e=>{if(relSeen[e.anime.id])return false;relSeen[e.anime.id]=true;return true});
    try{
     var staffQuery,staffVars;
     if(d.source==="shikimori"){staffQuery="query($mal:Int){Media(idMal:$mal,type:ANIME){staff(sort:RELEVANCE,perPage:10){edges{role node{id name{full} image{large} staffMedia(type:ANIME,sort:POPULARITY_DESC,perPage:25){nodes{"+relatedFields+"}}}}}}}";staffVars={mal:Number(d.mal)}}
     else if(d.source==="anilibria"&&Number(d.mal)>0){staffQuery="query($mal:Int){Media(idMal:$mal,type:ANIME){staff(sort:RELEVANCE,perPage:10){edges{role node{id name{full} image{large} staffMedia(type:ANIME,sort:POPULARITY_DESC,perPage:25){nodes{"+relatedFields+"}}}}}}}";staffVars={mal:Number(d.mal)}}
     else{staffQuery="query($id:Int){Media(id:$id,type:ANIME){staff(sort:RELEVANCE,perPage:10){edges{role node{id name{full} image{large} staffMedia(type:ANIME,sort:POPULARITY_DESC,perPage:25){nodes{"+relatedFields+"}}}}}}}";staffVars={id:Number(d.aniId||d.id)}}
     var staffPayload=await xgq(staffQuery,staffVars),staffMedia=staffPayload&&staffPayload.Media;
     var staffEdges=(staffMedia&&staffMedia.staff&&staffMedia.staff.edges||[]).filter(e=>e.node&&e.node.name&&e.node.name.full);
     staffPeople=staffEdges.slice(0,8).map(e=>({name:e.node.name.full,role:e.role||"Участник команды",image:e.node.image&&e.node.image.large||""}));
     var creatorEdges=staffEdges.filter(e=>/original creator|原作|原案/i.test(e.role||""));
     creatorName=creatorEdges.length&&creatorEdges[0].node.name?creatorEdges[0].node.name.full:"";
     var creatorSeen={};
     creatorEdges.forEach(e=>(e.node.staffMedia&&e.node.staffMedia.nodes||[]).forEach(m=>{if(m&&m.type==="ANIME"&&m.format!=="MUSIC"&&m.id!==(d.aniId||d.id)&&!relSeen[m.id]&&!creatorSeen[m.id]){creatorSeen[m.id]=true;creatorWorks.push(mp(m))}}));
     creatorWorks=creatorWorks.slice(0,12);
    }catch(staffError){console.warn("[AniWatch] Creator works unavailable:",staffError)}
   }catch(anilistError){
    console.warn("[AniWatch] AniList relations unavailable; using Shikimori:",anilistError);
    // Relations fallback must work for AniList-origin titles too.
    // MAL IDs and Shikimori IDs are different namespaces: resolve MAL -> Shikimori first.
    var shikiId=Number(d.shikiId)||0;
    if(!(shikiId>0)&&d.source!=="anilibria")shikiId=Number(d.id)-1000000000;
    if(!(shikiId>0)&&Number(d.mal)>0){
     var shikiMatches=await fetchAnimeByIds([Number(d.mal)]);
     shikiId=Number(shikiMatches&&shikiMatches[0]&&shikiMatches[0].id)||0;
    }
    if(!(shikiId>0))throw new Error("Не удалось найти связанные данные об этом аниме");
    var rawRelated=await fetchAnimeRelated(shikiId);
    var convert=function(a){
     if(!a||!Number(a.id))return null;
     var id=1000000000+Number(a.id),genres=Array.isArray(a.genres)?a.genres.map(g=>esc(g.russian||g.name||"")).filter(Boolean):[];
     var status=a.status==="released"?"Завершён":a.status==="ongoing"?"Онгоинг":a.status==="anons"?"Скоро":"";
     return {id:id,shikiId:Number(a.id),source:"shikimori",mal:Number(a.myanimelist_id)||null,n:esc(a.russian||a.name||"Без названия"),o:esc(a.russian&&a.name&&a.russian!==a.name?a.name:""),g:genres.length?genres:["Аниме"],y:Number(String(a.aired_on||"").slice(0,4))||0,r:Number(a.score)||0,e:Number(a.episodes)||0,s:status,d:cleanDesc(a.description||""),c:["#7c3aed","#0f0f1a"],img:"",ban:"",kind:String(a.kind||"")};
    };
    var seen={};
    relations=rawRelated.map(x=>{var anime=convert(x&&x.anime);if(!anime)return null;return {type:String(x.relation||"OTHER").toUpperCase().replace(/-/g,"_"),anime:anime}}).filter(x=>x&&!seen[x.anime.id]&&(seen[x.anime.id]=true));
    var fallbackList=relations.map(x=>x.anime);
    fallbackList.forEach(x=>{M[x.id]=x});
    await xshikiPosters(fallbackList);
   }
   var all=relations.map(x=>x.anime).concat(creatorWorks);
   await enrichRelatedFromShikimori(all);
   await xshikiPosters(all);
   var data={v:13,relations:relations,creatorName:creatorName,creatorWorks:creatorWorks,studioNames:studioNames,staffPeople:staffPeople,at:Date.now()};
   cached[d.id]=data;sv();renderRelated(d,data);
  }catch(e){
   console.warn("[AniWatch] Related anime:",e);
   var el=$("#related-anime");if(el&&isRoute("title",d.id))el.innerHTML='<section class="shelf"><h2>Связанные аниме</h2><p class="related-state">Не удалось загрузить связи. Попробуйте обновить страницу.</p><p class="related-state"><small>Причина: '+esc(String(e&&e.message||e).slice(0,160))+'</small></p></section>';
  }finally{delete relatedPending[d.id]}
 })();
 return relatedPending[d.id];
}
function renderRelated(d,data){
 var root=$("#related-anime");if(!root||!isRoute("title",d.id))return;
 var rel=(data.relations||[]).filter(x=>x&&x.anime),creatorWorks=(data.creatorWorks||[]).filter(Boolean);
 rel.forEach(x=>{M[x.anime.id]=x.anime});creatorWorks.forEach(x=>{M[x.id]=x});
 var groups={};
 rel.forEach(x=>(groups[x.type]=groups[x.type]||[]).push(x.anime));
 var relationHtml=Object.keys(groups).map(type=>'<div class="relation-group"><div class="relation-group-head"><h3>'+esc(relationNames[type]||"Связанный тайтл")+'</h3><span>'+groups[type].length+' '+(groups[type].length===1?'тайтл':'тайтла')+'</span></div><div class="row relation-track" aria-label="'+esc(relationNames[type]||"Связанные аниме")+'">'+relatedCards(groups[type].slice(0,8))+'</div></div>').join("");
 if(!relationHtml)relationHtml='<p class="related-state">Для этого аниме пока нет связанных тайтлов.</p>';
 var creatorHtml=creatorWorks.length?'<section class="shelf related-shelf"><div class="shelf-head"><div><h2>Другие работы автора</h2><p class="shelf-sub">'+(data.creatorName?'Ещё аниме '+esc(data.creatorName):'Другие аниме того же автора')+'. Не связаны сюжетом — их объединяет автор.</p></div></div><div class="row">'+relatedCards(creatorWorks)+'</div></section>':"";
 const extra=$("#anime-extra-meta");
 if(extra){
  const studios=(data.studioNames||[]).filter(Boolean),staff=(data.staffPeople||[]).filter(person=>person&&person.name);
  const staffHtml=staff.length?'<div class="anime-staff-list">'+staff.slice(0,8).map(person=>'<div class="anime-staff-person">'+(person.image?'<img src="'+esc(person.image)+'" alt="" loading="lazy">':'<span class="anime-staff-avatar">'+esc(person.name.slice(0,1))+'</span>')+'<span><b>'+esc(person.name)+'</b><small>'+esc(person.role)+'</small></span></div>').join("")+'</div>':'';
  extra.innerHTML=(studios.length?'<div class="anime-meta-line"><span>Студия</span><b>'+studios.map(esc).join(", ")+'</b></div>':'')+(staffHtml?'<div class="anime-meta-staff"><span class="anime-meta-label">Создатели и команда</span>'+staffHtml+'</div>':'');
  extra.hidden=!studios.length&&!staffHtml;
 }
 root.innerHTML='<section class="shelf related-shelf"><div class="shelf-head"><div><h2>Связанные аниме</h2><p class="shelf-sub">Продолжения, приквелы и дополнительные истории</p></div></div>'+relationHtml+'</section>'+creatorHtml;
 xshikiPosters(rel.map(x=>x.anime).concat(creatorWorks));
}
function refreshEpCount(d){
 var ef=$("#featured-count"),et=$("#title-count");
 if(ef&&ef.dataset.id==d.id)ef.textContent=epLabel(d);
 if(et&&et.dataset.id==d.id){et.textContent=epLabel(d);var el=$(".title-episodes .eps"),ec=$(".title-episodes .episode-count");if(el)el.innerHTML=eps(d,0,true);if(ec)ec.textContent=epTotal(d)>0?epTotal(d)+" серий":"Серии"}
}
async function ru(d){
 if(d&&d.source==="anilibria"){refreshEpCount(d);return}
 anilibriaCount(d);if(!d.mal)return;
 // Never request /animes/{MAL_ID} from Shikimori: that endpoint expects a Shikimori ID.
 // Keep AniList's title/description intact and enrich only episode counts using MAL-aware APIs.
 if(!d.e)await jikanCount(d,false);
 if(!d.e||!d.ae)await aniZipCount(d);
 if(!d.e||!d.ae||Number(d.mal)===21)await kitsuCount(d,false);
 refreshEpCount(d);
}

// Русские названия одним запросом к Shikimori (id там совпадают с MAL), кэш в localStorage
async function rn(){await enrichShikimori(D)}
async function boot(){
 S=await initializeLocalState(S,value=>{S=value});
 // Облачная сессия восстанавливается в фоне: она не должна блокировать первый экран.
 (async()=>{try{var auth=await initializeSupabaseAuth();AUTH_USER=auth.user;if(AUTH_USER){S=await restoreCloudState(S,AUTH_USER.id);var feedback=await loadRecommendationFeedback(AUTH_USER.id);S.recommendationDismissed={...(S.recommendationDismissed||{}),...feedback};saveLocalState(S,M);if(activePage()==="home"){refreshContinueShelf();loadHomeRecommendations()}}}catch(e){console.warn("[AniWatch] Supabase session restore failed:",e)}})();
 app.innerHTML='<p class="empty">Загрузка каталога…</p>';
 var c=null;
 if(activePage()!=="home"){
  try{c=JSON.parse(localStorage.getItem("awc")||"null")}catch(e){}
  if(!c||!c.a||c.a.length>30||Date.now()-c.t>216e5){
   try{var ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),6000),r=await fetch("https://graphql.anilist.co",{method:"POST",signal:ctl.signal,headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:Q})});clearTimeout(tm);var j=await r.json();c={t:Date.now(),a:j.data.Page.media.map(mp)};try{localStorage.setItem("awc",JSON.stringify(c))}catch(e){}}catch(e){}
  }
  if(c&&c.a&&c.a.length)D=c.a;else D=[];
 }else D=[];
 idx();hydrateStash();initRouteFilters();
 var enrichment=rn(),hydration=xhyd();
 await ensureRouteItem();
 if(activePage()==="home"){
  try{await loadHomeCollections()}catch(e){console.warn("[AniWatch] Home collections unavailable:",e)}
  draw();
  Promise.allSettled([enrichment,hydration]).then(()=>{if(activePage()==="home")refreshContinueShelf()});
 }else{await Promise.allSettled([enrichment,hydration]);draw()}
}

// ---- v2: каталог по всей базе AniList и трейлеры ----
var xMF="id idMal format title{romaji english}genres seasonYear startDate{year month}averageScore episodes status description(asHtml:false)coverImage{extraLarge color}bannerImage",
HOME_QUERY="query{trending:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,sort:TRENDING_DESC){"+xMF+"}}popular:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,sort:POPULARITY_DESC){"+xMF+"}}ongoing:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,status:RELEASING,sort:POPULARITY_DESC){"+xMF+"}}recent:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,status_in:[RELEASING,FINISHED],sort:START_DATE_DESC){"+xMF+"}}}",
homeCollections=null;
async function loadHomeCollections(){
 var cacheKey="aw-shikimori-home-v1",cache=null;try{cache=JSON.parse(localStorage.getItem(cacheKey)||"null")}catch(e){}
 var data=cache&&Date.now()-cache.at<20*60*1000?cache.data:null;
 if(!data){
  var used=new Set();
  async function collect(options){
   var result=[],page=1;
   while(result.length<15&&page<=8){
    var batch=await fetchCatalogPage(Object.assign({page:page,limit:50},options));
    if(!Array.isArray(batch)||!batch.length)break;
    batch.forEach(item=>{var id=Number(item&&item.id);if(id>0&&!used.has(id)&&result.length<15){used.add(id);result.push(item)}});
    if(batch.length<50)break;
    page++;
   }
   return result;
  }
  var trending=await collect({order:"ranked"});
  var popular=await collect({order:"popularity"});
  var ongoing=await collect({order:"popularity",status:"ongoing"});
  var recent=await collect({order:"aired_on",status:"released"});
  data={trending:trending,popular:popular,ongoing:ongoing,recent:recent};
  try{localStorage.setItem(cacheKey,JSON.stringify({at:Date.now(),data:data}))}catch(e){}
 }
 var map=list=>(Array.isArray(list)?list:[]).map(shikiToItem);
 homeCollections={trending:map(data.trending),popular:map(data.popular),ongoing:map(data.ongoing),recent:map(data.recent)};
 var allHome=homeCollections.trending.concat(homeCollections.popular,homeCollections.ongoing,homeCollections.recent);
 var genreCounts={};allHome.forEach(d=>(d.g||[]).forEach(g=>{genreCounts[g]=(genreCounts[g]||0)+1}));
 GN=Object.keys(genreCounts).sort((a,b)=>genreCounts[b]-genreCounts[a]).slice(0,10);
 homeCollections.genres=GN.slice(0,6);
 allHome.forEach(d=>{M[d.id]=d;S.shikiAnime=S.shikiAnime||{};S.shikiAnime[d.id]=d});
 xshikiPosters(allHome).catch(error=>console.warn("[AniWatch] Shikimori homepage poster lookup failed:",error));
 if(homeCollections.trending.length)H=homeCollections.trending;
 sv();return homeCollections;
}
var xCQ="query($p:Int,$s:String,$g:[String],$y:String,$season:MediaSeason,$st:MediaStatus,$f:[MediaFormat],$o:[MediaSort]){Page(page:$p,perPage:24){pageInfo{hasNextPage total}media(type:ANIME,isAdult:false,search:$s,genre_in:$g,startDate_like:$y,season:$season,status:$st,format_in:$f,sort:$o){"+xMF+"}}}",
xCQ_SAFE="query($p:Int,$s:String,$g:[String],$y:String,$season:MediaSeason,$st:MediaStatus,$f:[MediaFormat],$o:[MediaSort]){Page(page:$p,perPage:24){pageInfo{hasNextPage total}media(type:ANIME,isAdult:false,search:$s,genre_in:$g,startDate_like:$y,season:$season,status:$st,format_in:$f,sort:$o){id idMal format title{romaji english}genres seasonYear startDate{year month}averageScore episodes status coverImage{extraLarge color}}}}",
xCF={g:"",y:"",season:"",st:"",f:"",o:"POPULARITY_DESC",q:"",minScore:"",p:1,more:true,busy:false,k:0},xSearchRequest=0,xXC={},xIO=null,xGenrePromise=null,xGenreOptions=null;
var xGL=["Action","Adventure","Comedy","Drama","Fantasy","Horror","Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"],
xSO=[["POPULARITY_DESC","Популярные"],["SCORE_DESC","По рейтингу"],["START_DATE_DESC","Сначала новые"],["TITLE_ROMAJI","По названию"]],
xST=[["RELEASING","Онгоинг"],["FINISHED","Завершён"],["NOT_YET_RELEASED","Скоро"]],
xFM=[["TV","Сериал"],["MOVIE","Фильм"],["OVA","OVA"],["ONA","ONA"],["SPECIAL","Спешл"]];
GR["Mahou Shoujo"]=GR["Mahou Shoujo"]||"Махо-сёдзё";
// русские названия для произвольного списка (пачками по 50, кэш awr2)
async function xrn(L){return enrichShikimori(L)}
// избранное/история/списки, найденные через каталог, подгружаем по id после перезагрузки
async function xhyd(){
 var ids=new Set([].concat(S.fav||[],Object.keys(S.hist||{}),Object.keys(S.rate||{}),Object.keys(S.watchedEpisodes||{})).map(Number)),w=S.watchlist;
 if(w&&!Array.isArray(w))Object.keys(w).forEach(k=>ids.add(+k));
 var saved=S.shikiAnime||{},savedAni=S.anilibriaAnime||{};ids.forEach(i=>{if(!M[i]&&saved[i])M[i]=saved[i];if(!M[i]&&savedAni[i])M[i]=savedAni[i]});
 var needAni=[...ids].filter(i=>i>=2000000000&&!M[i]).slice(0,30);
 if(needAni.length)await Promise.allSettled(needAni.map(async id=>{var d=anilibriaToItem(await fetchAniLibriaReleaseById(id-2000000000));if(d){M[id]=d;S.anilibriaAnime=S.anilibriaAnime||{};S.anilibriaAnime[id]=d}}));
 var need=[...ids].filter(i=>i>0&&i<1000000000&&!M[i]).slice(0,50);if(!need.length){sv();return}
 try{var L=(await xgq("query($i:[Int]){Page(perPage:50){media(id_in:$i,type:ANIME){"+xMF+"}}}",{i:need})).Page.media.map(x=>M[x.id]=mp(x));await xrn(L)}catch(e){}
}
// Shikimori is the single source for poster artwork. Keep image URLs transient.
async function xshikiPosters(L){
 L=(L||[]).filter(Boolean);
 var needsLookup=L.filter(d=>Number(d.mal)>0&&!d.shikiId&&!shikiImageUrl(d.img));
 if(needsLookup.length)await enrichShikimori(needsLookup);
 var ids=[...new Set((L||[]).map(d=>Number(d.shikiId||((Number(d.id)||0)>=1000000000?Number(d.id)-1000000000:0))).filter(id=>Number.isInteger(id)&&id>0&&!dHasImage(L,id)))];
 var findItem=id=>(L||[]).find(x=>Number(x.shikiId||((Number(x.id)||0)>=1000000000?Number(x.id)-1000000000:0))===Number(id));
 try{
  for(var i=0;i<ids.length;i+=50){
   var batchIds=ids.slice(i,i+50),posters=await fetchAnimePostersByIds(batchIds);
   posters.forEach(a=>{
    var d=findItem(a.id);if(!d)return;
    var poster=a.poster||{},path=shikiImageUrl(poster.originalUrl||poster.mainUrl);
    if(path)d.img=path;
    M[d.id]=d;if(d.source==="shikimori"){S.shikiAnime=S.shikiAnime||{};S.shikiAnime[d.id]=d}
   });
  }
 }catch(e){console.warn("[AniWatch] Shikimori GraphQL poster lookup failed:",e)}
 // REST is a fallback only; never treat Shikimori's missing_original image as artwork.
 var restIds=ids.filter(id=>{var d=findItem(id);return d&&!shikiImageUrl(d.img)});
 for(var j=0;j<restIds.length;j+=50){
  try{
   var batch=await fetchAnimeByIds(restIds.slice(j,j+50));
   batch.forEach(a=>{
    var d=findItem(a.id);if(!d)return;
    var image=a.image||{},path=shikiImageUrl(image.original||image.preview||image.x96);
    if(path)d.img=path;
    M[d.id]=d;if(d.source==="shikimori"){S.shikiAnime=S.shikiAnime||{};S.shikiAnime[d.id]=d}
   });
  }catch(e){console.warn("[AniWatch] Shikimori REST poster fallback failed:",e);break}
 }
 document.querySelectorAll("[data-anime-id]").forEach(el=>{
  var d=M[Number(el.dataset.animeId)];if(!d||!shikiImageUrl(d.img))return;
  var poster=el.classList.contains("card")?el.querySelector(".poster"):el.classList.contains("collection-anime-poster")?el:el.classList.contains("poster")?el:null;
  if(!poster)return;
  if(el.classList.contains("collection-anime-poster")){var img=document.createElement("img");img.src=d.img;img.alt="";img.loading="eager";img.fetchPriority="low";poster.replaceChildren(img)}
  else{poster.style.background=bg(d);var img=poster.querySelector(".poster-image");if(!img){img=document.createElement("img");img.className="poster-image";img.alt="";img.loading="eager";img.fetchPriority="low";img.decoding="async";poster.prepend(img)}if(img.src!==d.img)img.src=d.img;img.onerror=function(){this.removeAttribute("src");this.style.display="none"};var letter=poster.querySelector("i");if(letter)letter.remove()}
 });
 var current=M[routeArgs()[0]],player=$(".player");if(current&&player&&shikiImageUrl(current.img))player.style.background=bn(current);
 var hero=$("#hw .hero-editorial"),featuredItem=H[featuredIndex%H.length];if(hero&&featuredItem&&shikiImageUrl(featuredItem.img)){hero.style.setProperty("--hero-poster","url("+JSON.stringify(featuredItem.img)+")");var hp=hero.querySelector(".hero-poster");if(hp)hp.style.background=bg(featuredItem)}
 sv();
}
function dHasImage(list,id){
 return (list||[]).some(d=>Number(d.shikiId||((Number(d.id)||0)>=1000000000?Number(d.id)-1000000000:0))===id&&!!shikiImageUrl(d.img));
}
V.catalog=()=>{
 clearTimeout(xCF.h);xSearchRequest++;xCF.p=1;xCF.more=true;xCF.busy=false;xCF.k++;
 renderCatalogPage({
  app,filters:xCF,escapeHtml:esc,genreOptions:xGenreOptions||[],genreLabels:{},
  yearOptions:Array.from({length:new Date().getFullYear()-1970+1},(_,i)=>[String(new Date().getFullYear()-i),String(new Date().getFullYear()-i)]),
  seasonOptions:[["winter","Зима"],["spring","Весна"],["summer","Лето"],["fall","Осень"]],
  statusOptions:[["RELEASING","Онгоинг"],["FINISHED","Завершён"],["NOT_YET_RELEASED","Скоро"]],
  formatOptions:[["TV","Сериал"],["MOVIE","Фильм"],["OVA","OVA"],["ONA","ONA"],["SPECIAL","Спешл"]],
  sortOptions:[["POPULARITY_DESC","Популярные"],["SCORE_DESC","По рейтингу"],["START_DATE_DESC","Сначала новые"],["TITLE_ROMAJI","По названию"]],
  ratingOptions:[["6","6.0+"],["7","7.0+"],["8","8.0+"],["9","9.0+"]]
 });
 xCF.q=F.q||xCF.q||"";xCF.g=F.g||xCF.g||"";F.q=xCF.q;F.g=xCF.g;
 var csInput=$("#cs"),genreSelect=$("#cf-g");if(csInput)csInput.value=xCF.q;
 var hqi=$("#q");if(hqi)hqi.value=xCF.q;if(genreSelect)genreSelect.value=xCF.g;
 if(!xGenrePromise)xGenrePromise=fetchAnimeGenres().then(list=>{var seenIds=new Set(),seenNames=new Set();xGenreOptions=list.filter(g=>g&&g.kind==="genre"&&String(g.entry_type||"").toLowerCase()==="anime").map(g=>({id:String(g.id||"").trim(),ru:String(g.russian||"").trim(),name:String(g.name||"").trim()})).filter(g=>{var id=g.id,keys=[g.ru,g.name].filter(Boolean).map(v=>v.normalize("NFKC").toLocaleLowerCase("ru").replace(/[ё]/g,"е").replace(/[\s\p{P}\p{S}]+/gu,""));if(!id||seenIds.has(id)||!keys.length||keys.some(k=>seenNames.has(k)))return false;seenIds.add(id);keys.forEach(k=>seenNames.add(k));return true}).map(g=>[g.id,g.ru||g.name]).sort((a,b)=>a[1].localeCompare(b[1],"ru"));return xGenreOptions}).catch(e=>{console.warn("[AniWatch] Genre list unavailable:",e);return null});
 var routeKey=xCF.k;
 xGenrePromise.then(options=>{if(routeKey!==xCF.k||activePage()!=="catalog")return;if(options&&options.length){var select=$("#cf-g"),value=xCF.g;if(value&&!/^[0-9]+$/.test(value)){var legacy=options.find(g=>String(g[1]).toLowerCase()===String(value).toLowerCase());value=legacy?legacy[0]:"";xCF.g=value}select.innerHTML="<option value=\"\">Все жанры</option>"+options.map(g=>"<option value=\""+esc(g[0])+"\">"+esc(g[1])+"</option>").join("");select.value=value}xcq(true)});
};
rc=()=>{var s=$("#cs");xCF.q=s?s.value.trim():(F.q||"");F.q=xCF.q;if(s&&s!==document.activeElement)s.value=xCF.q;clearTimeout(xCF.h);xCF.h=setTimeout(()=>xcq(true),450)};
async function xcq(reset){
 if(reset){xSearchRequest++;xCF.p=1;xCF.more=true;xCF.busy=false;var c0=$("#cr");if(c0)c0.innerHTML="";syncCatalogUrl()}
 if(!xCF.more||xCF.busy||!$("#cr"))return;
 var requestId=++xSearchRequest;xCF.busy=true;var k=++xCF.k,box=$("#more");if(box)box.textContent="Загрузка…";
 try{
  var q=xCF.q.trim(),sourcePage=xCF.p;
  var key="aw-shikimori-catalog-v3:"+JSON.stringify([q,sourcePage,xCF.g,xCF.y,xCF.season,xCF.st,xCF.f,xCF.o,xCF.minScore]);
  var cached=null,raw=null;
  try{cached=JSON.parse(localStorage.getItem(key)||"null")}catch(e){}
  if(cached&&Date.now()-cached.at<10*60*1000)raw=cached.data;
  if(!raw){
   var order=xCF.o==="SCORE_DESC"?"ranked":xCF.o==="START_DATE_DESC"?"aired_on":xCF.o==="TITLE_ROMAJI"?"name":"popularity";
   raw=await fetchCatalogPage({query:q,page:sourcePage,order,format:xCF.f,status:xCF.st,genre:xCF.g});
   try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data:raw}))}catch(e){}
  }
  if(requestId!==xSearchRequest||k!==xCF.k||activePage()!=="catalog")return;
  var L=(Array.isArray(raw)?raw:[]).map(shikiToItem);

  if(xCF.y)L=L.filter(d=>String(d.y)===String(xCF.y));
  if(xCF.season){
   var months={winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],fall:[9,10,11]}[xCF.season]||[];
   L=L.filter(d=>months.includes(d.mth));
  }
  if(xCF.minScore)L=L.filter(d=>Number(d.r||0)>=Number(xCF.minScore));
  L.forEach(d=>{M[d.id]=d;S.shikiAnime=S.shikiAnime||{};S.shikiAnime[d.id]=d});
  var cr=$("#cr");if(!cr)return;
  cr.insertAdjacentHTML("beforeend",L.map(d=>card(d)).join(""));
  xshikiPosters(L);
  xCF.p=sourcePage+1;xCF.more=Array.isArray(raw)&&raw.length===50;xCF.busy=false;
  $("#cc").textContent=q?"Результаты поиска":"Каталог";
  if(box)box.textContent=xCF.more?"Загрузить ещё":"Это все результаты";
  if(!cr.children.length)$("#cc").textContent=q?"Ничего не найдено":"В каталоге пока нет результатов";
  sv();
 }catch(e){
  console.error("[AniWatch] Shikimori catalog:",e);
  if(requestId===xSearchRequest&&k===xCF.k){xCF.busy=false;if(box)box.textContent="Ошибка загрузки. Нажмите, чтобы повторить";toast("Не удалось загрузить каталог. Попробуй позже.")}
 }
}
async function xrandom(){
 renderRandomLoading(app);
 try{
  var a=await fetchRandomAnime();
  var id=1000000000+Number(a.id),kind=String(a.kind||"").toLowerCase(),status=a.status==="released"?"Завершён":a.status==="ongoing"?"Онгоинг":a.status==="anons"?"Скоро":"";
  var genres=Array.isArray(a.genres)?a.genres.map(g=>esc(g.russian||g.name||"")).filter(Boolean):[];
  var d={id:id,shikiId:Number(a.id),source:"shikimori",mal:Number(a.myanimelist_id)||null,n:esc(a.russian||a.name||"Без названия"),o:esc(a.russian&&a.name&&a.russian!==a.name?a.name:""),g:genres.length?genres:["Аниме"],y:Number(String(a.aired_on||"").slice(0,4))||0,r:Number(a.score)||0,e:Number(a.episodes)||0,s:status,d:cleanDesc(a.description||""),c:["#7c3aed","#0f0f1a"],img:"",ban:"",kind:kind};
  M[id]=d;S.shikiAnime=S.shikiAnime||{};S.shikiAnime[id]=d;sv();
  xshikiPosters([d]);
  if(activePage()==="random"){stashItems([id]);location.replace(titleUrl(id))}
 }catch(e){
  console.error("[AniWatch] Random anime:",e);
  renderRandomError(app);
  toast("Не удалось выбрать случайное аниме");
 }
}
V.random=()=>{xrandom()};
listen(document,"scroll",()=>{if($("#more")&&xCF.more&&!xCF.busy&&window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-900)xcq()},{passive:true});
listen(document,"click",e=>{if(e.target.closest("[data-cf-reset]")){F.q="";F.g="";xCF.g="";xCF.y="";xCF.st="";xCF.f="";xCF.o="POPULARITY_DESC";xCF.q="";xCF.minScore="";V.catalog();return}if(e.target.closest("[data-xr]"))xcq();});
// страница тайтла: таймер следующей серии и трейлер
// Баннер из AniList: один общий запрос на тайтл (баннер, следующая серия, трейлер), без дублей
var xXP={};
function applyBanner(d){
 var tb=$(".title-backdrop");if(tb&&isRoute("title",d.id))tb.style.background=bn(d);
 var pl=$(".player");if(pl&&P&&P.d.id===d.id)pl.style.background=bn(d);
 var hero=$("#hw .hero-editorial");if(hero&&H[featuredIndex%H.length]&&H[featuredIndex%H.length].id===d.id){hero.style.background=bn(d);hero.style.setProperty("--hero-poster","url('"+(shikiImageUrl(d.img)||"")+"')");}
}
function aniMedia(d){
 var id=d.id;if(xXC[id])return Promise.resolve(xXC[id]);
 if(d.source&&!(Number(d.mal)>0))return Promise.resolve(null);
 if(xXP[id])return xXP[id];
 var query,vars;
 if(d.source){query="query($mal:Int){Media(idMal:$mal,type:ANIME){id bannerImage}}";vars={mal:Number(d.mal)}}
 else{query="query($id:Int){Media(id:$id,type:ANIME){id bannerImage}}";vars={id:Number(d.aniId||d.id)}}
 xXP[id]=xgq(query,vars).then(function(r){
  var m=r&&r.Media||null;xXC[id]=m;
  var t=M[id]||d;if(m&&m.bannerImage&&!t.ban){t.ban=m.bannerImage;if(t.source){S.shikiAnime=S.shikiAnime||{};S.shikiAnime[id]=t}applyBanner(t);sv()}
  return m;
 }).finally(function(){delete xXP[id]});
 return xXP[id];
}
function loadBanner(d){if(d&&d.source!=="anilibria"&&!d.ban)aniMedia(d).catch(function(){})}
function activePage(){return getActivePage()}
function hd(){updateNavigation(S)}
// ---- страницы: данные между переходами, адреса, фильтры ----
function htmlText(s){var t=document.createElement("textarea");t.innerHTML=String(s||"");return t.value}
function readAutoplay(){try{var v=sessionStorage.getItem("aw.ap")==="1";sessionStorage.removeItem("aw.ap");return v}catch(e){return false}}
// Каждая страница загружается заново, поэтому карточки, которые видел пользователь, передаём следующей странице через sessionStorage.
function stashItems(extra){
 try{
  var ids={};
  (extra||[]).forEach(i=>{ids[i]=1});
  var cur=routeArgs()[0];if(cur)ids[cur]=1;
  document.querySelectorAll("[data-anime-id]").forEach(c=>{ids[c.dataset.animeId]=1});
  document.querySelectorAll('a[href*="id="]').forEach(a=>{var m=/[?&]id=(\d+)/.exec(a.getAttribute("href")||"");if(m)ids[m[1]]=1});
  var out={},n=0;
  Object.keys(ids).forEach(i=>{if(n<500&&M[i]&&M[i].n){out[i]=M[i];n++}});
  sessionStorage.setItem("aw.items",JSON.stringify(out));
 }catch(e){try{sessionStorage.removeItem("aw.items")}catch(e2){}}
}
function hydrateStash(){
 try{var o=JSON.parse(sessionStorage.getItem("aw.items")||"{}");Object.keys(o).forEach(i=>{if(!M[i])M[i]=o[i]})}catch(e){}
}
function shikiToItem(a){
 var st=a.status==="released"?"Завершён":a.status==="ongoing"?"Онгоинг":a.status==="anons"?"Скоро":"";
 var genres=Array.isArray(a.genres)?a.genres.map(g=>esc(g.russian||g.name||"")).filter(Boolean):[];
 var image=a.image||{},path=image.preview||image.original||image.x96||"";
 return{id:1000000000+Number(a.id),shikiId:Number(a.id),source:"shikimori",mal:Number(a.myanimelist_id)||null,n:esc(a.russian||a.name||"Без названия"),o:esc(a.russian&&a.name&&a.russian!==a.name?a.name:""),g:genres.length?genres:["Аниме"],y:Number(String(a.aired_on||"").slice(0,4))||0,mth:Number(String(a.aired_on||"").slice(5,7))||0,r:Number(a.score)||0,e:Number(a.episodes)||0,s:st,d:cleanDesc(a.description||""),c:["#7c3aed","#0f0f1a"],img:shikiImageUrl(path),ban:"",kind:String(a.kind||"").toLowerCase()}
}
function anilibriaToItem(raw){
 var a=raw&&raw.release?raw.release:(raw||{}),name=a.name||{},poster=a.poster||{},optimized=poster.optimized||{};
 var posterPath=optimized.preview||optimized.src||optimized.thumbnail||poster.preview||poster.src||poster.thumbnail||"",image="";
 if(posterPath){try{image=new URL(posterPath,"https://anilibria.top").href}catch(e){}}
 var genres=Array.isArray(a.genres)?a.genres.map(g=>String(g&&((g.name)||(g.description)||g)||"").trim()).filter(Boolean):[];
 var releaseId=Number(a.id)||0;if(!releaseId)return null;
 var covers=Array.isArray(a.background_covers)?a.background_covers:[],cover=covers[0]||{},coverOptimized=cover.optimized||{},bannerPath=coverOptimized.src||coverOptimized.preview||cover.src||cover.preview||"",banner="";
 if(bannerPath){try{banner=new URL(bannerPath,"https://anilibria.top").href}catch(e){}}
 return{id:2000000000+releaseId,anilibriaId:releaseId,source:"anilibria",shikimoriId:Number(a.shikimori&&a.shikimori.id)||null,mal:Number(a.mal&&a.mal.id)||null,n:esc(name.main||name.english||name.alias||"Без названия"),o:esc(name.english&&name.english!==name.main?name.english:(name.alternative||"")),g:genres.length?genres:["Аниме"],y:Number(a.year)||0,mth:0,r:Number(a.rating&&a.rating.average)||0,e:Number(a.episodes_total)||0,ae:0,s:a.is_ongoing?"Онгоинг":"Завершён",d:cleanDesc(a.description||""),c:["#7c3aed","#0f0f1a"],img:image,ban:banner,kind:String(a.type&&a.type.value||"").toLowerCase(),ratingVotes:Number(a.rating&&a.rating.votes)||0,popularity:Number(a.added_in_users_favorites)||0};
}
// Страница тайтла/плеера открыта по прямой ссылке — подгружаем тайтл по id, если его нет в памяти.
async function ensureRouteItem(){
 var page=activePage();if(page!=="title"&&page!=="watch")return;var id=routeArgs()[0];if(!id)return;
 if(!M[id]&&S.anilibriaAnime&&S.anilibriaAnime[id])M[id]=S.anilibriaAnime[id];if(M[id])return;
 try{
  if(id>=2000000000){var d=anilibriaToItem(await fetchAniLibriaReleaseById(id-2000000000));if(!d)throw new Error("AniLibria не вернула тайтл");M[id]=d;S.anilibriaAnime=S.anilibriaAnime||{};S.anilibriaAnime[id]=d}
  else if(id>=1000000000){var d=shikiToItem(await fetchAnimeById(id-1000000000));M[d.id]=d;S.shikiAnime=S.shikiAnime||{};await xshikiPosters([d])}
  else{var L=(await xgq("query($i:[Int]){Page(perPage:1){media(id_in:$i,type:ANIME){"+xMF+"}}}",{i:[id]})).Page.media.map(x=>M[x.id]=mp(x));await xrn(L)}
 }catch(e){console.warn("[AniWatch] Title lookup:",e)}
}
function renderMissing(){
 document.title="Тайтл не найден — AniWatch";
 app.innerHTML='<section class="offline-state"><div class="eyebrow">404</div><h1>Тайтл не найден</h1><p>Не удалось загрузить это аниме. Ссылка могла устареть или возникла ошибка соединения.</p><a class="btn" href="'+pageUrl("catalog")+'">Открыть каталог</a> <button class="btn ghost" type="button" data-a="reload">Повторить</button></section>'
}
var URL_FILTERS={y:"y",season:"season",status:"st",format:"f",sort:"o",score:"minScore"};
function initRouteFilters(){
 if(activePage()!=="catalog")return;
 var p=new URLSearchParams(location.search);
 F.q=(p.get("q")||"").trim();F.g=p.get("g")||"";
 Object.keys(URL_FILTERS).forEach(k=>{var v=p.get(k);if(v)xCF[URL_FILTERS[k]]=v});
}
function syncCatalogUrl(){
 if(activePage()!=="catalog"||!window.history||!history.replaceState)return;
 var o={q:xCF.q,g:xCF.g,y:xCF.y,season:xCF.season,status:xCF.st,format:xCF.f,sort:xCF.o==="POPULARITY_DESC"?"":xCF.o,score:xCF.minScore};
 try{history.replaceState(null,"",pageUrl("catalog",o))}catch(e){}
}
function draw(){renderRoute(V,T,()=>{P=null;if(INLINE_STREAM_PLAYER){INLINE_STREAM_PLAYER.destroy();INLINE_STREAM_PLAYER=null}},S);var visible=[];document.querySelectorAll("[data-anime-id]").forEach(el=>{var d=M[Number(el.dataset.animeId)];if(d)visible.push(d)});if(activePage()==="title"||activePage()==="watch"){var current=M[routeArgs()[0]];if(current)visible.push(current)}if(visible.length)xshikiPosters([...new Map(visible.map(d=>[d.id,d])).values()])}
function msg(a,t){var m=$("#ms");if(!m)return;var d=document.createElement("div"),e=document.createElement("em");e.textContent=a;d.append(e,document.createTextNode(String(t||"")));m.append(d);m.scrollTop=1e5}

var heroTouch=null;listen(document,"touchstart",e=>{var h=e.target.closest("#hw .hero-editorial");if(!h||e.touches.length!==1)return;heroTouch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});listen(document,"touchend",e=>{if(!heroTouch)return;var p=heroTouch;heroTouch=null;if(!e.changedTouches.length||H.length<2)return;var dx=e.changedTouches[0].clientX-p.x,dy=e.changedTouches[0].clientY-p.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.25){featuredIndex=(featuredIndex+(dx<0?1:-1)+H.length)%H.length;showFeatured()}},{passive:true});
listen(document,"click",e=>{var t=e.target.closest("[data-a]");if(!t)return;var a=t.dataset.a,i=+t.dataset.i,v=t.dataset.v;
 if(a==="profile-entry"){e.preventDefault();if(AUTH_USER)location.href=PAGES.profile;else openAuthModal()}
 else if(a==="auth-close"){var authModal=document.getElementById("auth-modal");if(authModal)authModal.remove()}
 else if(a==="recommendation-dismiss"){e.preventDefault();e.stopPropagation();S.recommendationDismissed=S.recommendationDismissed||{};S.recommendationDismissed[i]="not_interested";sv();if(AUTH_USER)saveRecommendationFeedback(AUTH_USER.id,i).catch(error=>console.warn("[AniWatch] Recommendation feedback sync failed:",error));var item=t.closest(".recommendation-item");if(item)item.remove();if(!$("#recommendation-cards")?.children.length)$("#recommendation-cards").innerHTML='<p class="m">На сегодня подборка закончилась. Новые варианты появятся после обновления каталога.</p>';toast("Убрали тайтл из рекомендаций")}
 else if(a=="fav"){e.preventDefault();e.stopPropagation();var k=S.fav.indexOf(i),active=k<0;if(active)S.fav.push(i);else S.fav.splice(k,1);sv();document.querySelectorAll('[data-a="fav"][data-i="'+i+'"]').forEach(b=>{b.classList.toggle("active",active);b.classList.toggle("is-favorite",active);b.setAttribute("aria-pressed",String(active));b.setAttribute("aria-label",active?"Убрать из избранного":"Добавить в избранное");if(b.classList.contains("title-fav-btn"))b.innerHTML=active?"♥ В избранном":"♡ В избранное";else b.textContent=active?"♥":"♡"});toast(active?"Добавлено в избранное":"Убрано из избранного")}
 else if(a==="episode-toggle"){e.preventDefault();e.stopPropagation();var watched=watchedFor(i),already=watched.includes(Number(v));setEpisodeWatched(i,v,!already);toast(!already?"Серия отмечена как просмотренная":"Отметка о просмотре снята")}
 else if(a==="inline-watch"){e.preventDefault();e.stopPropagation();var inlineAnime=M[i];if(inlineAnime)startInlineWatch(inlineAnime,Number(v)||1)}
 else if(a=="desc"){var p=$("#td"),open=t.getAttribute("aria-expanded")==="true";if(p){p.classList.toggle("collapsed",open);t.setAttribute("aria-expanded",String(!open));t.textContent=open?"Читать полностью":"Свернуть"}}
 else if(a=="rate"){S.rate[i]=+v;sv();draw()}
 else if(a=="random"){if(activePage()==="random")xrandom();else location.href=pageUrl("random")}
 else if(a=="g"){location.href=pageUrl("catalog",{g:v})}
 else if(a=="list-filter"){F.listStatus=v;V.mylist()}
 else if(a==="collections-reload"){loadCollectionsView(routeArgs())}
  else if(a==="calendar-reload"){loadAniLibriaSchedule(true).then(items=>{if(activePage()==="calendar")renderCalendarPage({app,items})}).catch(error=>renderCalendarPage({app,error:error.message||"Ошибка загрузки"}))}
 else if(a==="add-to-collection"){
  if(!AUTH_USER){toast("Войди в аккаунт, чтобы создавать коллекции");return}
  listCollections(AUTH_USER.id).then(rows=>{
   var own=rows.filter(row=>row.owner_id===AUTH_USER.id),host=$("#collection-picker");
   if(!host){host=document.createElement("div");host.id="collection-picker";host.className="collection-picker";var actions=$(".title-actions");if(actions)actions.insertAdjacentElement("afterend",host)}
   if(!host)return;
   host.innerHTML=own.length?'<label>Добавить в мою коллекцию<select id="collection-picker-select">'+own.map(row=>'<option value="'+row.id+'">'+esc(row.title)+'</option>').join("")+'</select></label><button class="btn" type="button" data-a="collection-add-current">Добавить</button>':'<span>Сначала создай коллекцию.</span> <a href="collections.html">Открыть коллекции</a>';
  }).catch(error=>toast(error.message||"Не удалось загрузить коллекции"));
 }
 else if(a==="collection-add-current"){
  var targetId=$("#collection-picker-select")?.value,animeId=routeArgs()[0],anime=M[animeId];
  if(!targetId||!anime){toast("Не удалось определить коллекцию или аниме");return}
  addCollectionAnime(targetId,anime).then(()=>toast("Аниме добавлено в коллекцию")).catch(error=>toast(error.message||"Не удалось добавить аниме"));
 }
 else if(a==="collection-rate"){if(!AUTH_USER){toast("Войди в аккаунт, чтобы оценить коллекцию");return}var collectionId=new URLSearchParams(location.search).get("id");rateCollection(collectionId,AUTH_USER.id,+v).then(()=>loadCollectionsView([collectionId])).then(()=>toast("Оценка сохранена")).catch(error=>toast(error.message||"Не удалось сохранить оценку"))}
 else if(a==="collection-add-search-item"){
  if(!AUTH_USER){toast("Войди в аккаунт, чтобы управлять коллекциями");return}
  var selectedAnime=M[Number(t.dataset.id)],selectedCollection=routeArgs()[0];
  if(!selectedAnime||!selectedCollection){toast("Не удалось определить аниме или коллекцию");return}
  t.disabled=true;t.textContent="Добавляем…";
  addCollectionAnime(selectedCollection,selectedAnime).then(()=>{toast("Аниме добавлено в коллекцию");loadCollectionsView(routeArgs())}).catch(error=>{console.error("[AniWatch] Collection add failed:",error);toast(error.message||"Не удалось добавить аниме");t.disabled=false;t.textContent="Добавить"});
 }
 else if(a==="collection-remove-item"){removeCollectionAnime(t.dataset.id).then(()=>loadCollectionsView(routeArgs())).then(()=>toast("Аниме удалено из коллекции")).catch(error=>toast(error.message||"Не удалось удалить"))}
 else if(a==="collection-delete"){if(!confirm("Удалить коллекцию вместе со всеми её аниме и оценками?"))return;var collectionId=new URLSearchParams(location.search).get("id");deleteCollection(collectionId).then(()=>{toast("Коллекция удалена");location.href="collections.html"}).catch(error=>toast(error.message||"Не удалось удалить коллекцию"))}
 else if(a=="slide"&&H.length>1){featuredIndex=(featuredIndex+(+v)+H.length)%H.length;showFeatured()}
 else if(a=="slide-to"&&H.length>1){featuredIndex=(+v)%H.length;showFeatured()}
 else if(a=="pp"&&P){P.on=!P.on;tick(0);pauseSave();broadcastPlayback("playback")}
 else if(a=="sp"&&P){var s=[1,1.25,1.5,2];P.sp=s[(s.indexOf(P.sp)+1)%4];t.textContent=P.sp+"×";broadcastPlayback("playback")}
 else if(a=="seek"&&P){var r=t.getBoundingClientRect();P.t=Math.round((e.clientX-r.left)/r.width*DUR);tick(0);broadcastPlayback("playback")}
 else if(a=="room"){var roomAnime=Number($("#room-anime")&&$("#room-anime").value)||Number(D[0]&&D[0].id);if(!roomAnime){toast("Сначала дождись загрузки каталога");return}S.room=createRoomCode();S.roomHost=true;S.roomAnime=roomAnime;sv();location.href=watchUrl(roomAnime,1)+"&room="+encodeURIComponent(S.room)}
 else if(a=="room-copy"&&S.room){var invite=new URL(location.href);invite.searchParams.set("room",S.room);invite.searchParams.set("guest","1");var inviteText=invite.toString();if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(inviteText).then(()=>toast("Ссылка-приглашение скопирована")).catch(()=>prompt("Скопируй ссылку на комнату:",inviteText));else prompt("Скопируй ссылку на комнату:",inviteText)}
 else if(a=="room-leave"){disconnectRoom();ROOM_CONNECTED=false;S.room="";S.roomHost=false;S.roomAnime=0;sv();toast("Вы вышли из комнаты");location.href=watchUrl(P.d.id,P.n)}
 else if(a==="auth-mode"){var mode=v==="signup"?"signup":"login";document.querySelectorAll("[data-auth-mode]").forEach(b=>b.classList.toggle("on",b.dataset.authMode===mode));var modeInput=document.querySelector("#auth-form [name=auth-mode]");if(modeInput)modeInput.value=mode;var pass=$("#auth-password");if(pass)pass.autocomplete=mode==="signup"?"new-password":"current-password";var n=$("#auth-username-wrap");if(n)n.hidden=mode!=="signup";var ew=$("#auth-email-wrap");if(ew)ew.hidden=mode!=="signup";var emailInput=$("#auth-email");if(emailInput)emailInput.required=mode==="signup";var lw=$("#auth-login-wrap");if(lw)lw.hidden=mode==="signup";var loginInput=$("#auth-login");if(loginInput)loginInput.required=mode!=="signup";var submit=$("#auth-submit");if(submit)submit.textContent=mode==="signup"?"Создать аккаунт":"Войти";var status=$("#auth-message");if(status)status.textContent=""}
 else if(a==="profile-avatar"){var avatarInput=$("#profile-avatar-file");if(avatarInput)avatarInput.click()}else if(a==="auth-logout"){handleAuthLogout()}
 else if(a=="acc"){S.acc=v;sv();hd()}
 else if(a=="export"){exportBackup()}else if(a=="import"){var fileInput=$("#backup-file");if(fileInput)fileInput.click()}else if(a=="reset"){S={};df();sv();toast("Данные сброшены");draw()}else if(a=="reload"){location.reload()}});
listen(document,"submit",async e=>{e.preventDefault();var f=e.target.id;
 if(f=="site-search"){var sq=($("#q").value||"").trim();if(activePage()==="catalog"){F.q=sq;rc()}else location.href=pageUrl("catalog",{q:sq});return}
 if(f=="profile-form"){var name=$("#nm").value.trim();if(name){S.name=name;sv();hd();toast("Ник сохранён");V.profile()}}
 if(f==="collection-create-form"||f==="collection-edit-form"){
  if(!AUTH_USER){toast("Войди в аккаунт, чтобы управлять коллекциями");return}
  var fd=new FormData(e.target),collectionId=new URLSearchParams(location.search).get("id");
  try{
   if(f==="collection-create-form"){var created=await createCollection(AUTH_USER.id,{title:fd.get("title"),description:fd.get("description"),cover_url:fd.get("cover_url"),is_public:fd.has("is_public")});toast("Коллекция создана");location.href="collections.html?id="+encodeURIComponent(created.id);}
   else if(f==="collection-edit-form"){await updateCollection(collectionId,{title:fd.get("title"),description:fd.get("description"),cover_url:fd.get("cover_url"),is_public:fd.has("is_public")});toast("Изменения сохранены");await loadCollectionsView([collectionId]);}
   else{var anime=M[Number(fd.get("anime_id"))];if(!anime)throw new Error("Сначала выбери аниме");await addCollectionAnime(collectionId,anime);toast("Аниме добавлено");await loadCollectionsView([collectionId]);}
  }catch(error){console.error("[AniWatch] Collection action failed:",error);toast(error.message||"Не удалось выполнить действие")}
  return;
 }
 if(f==="auth-form"){handleAuthSubmit(e.target);return}
 if(f=="cf"){var v=$("#ci").value.trim();if(!v)return;if(!ROOM_CONNECTED){toast("Нет соединения с комнатой");return}msg(S.name||"Вы",v);sendRoomEvent("chat",{name:S.name||"Гость",text:v.slice(0,500)}).catch(()=>toast("Не удалось отправить сообщение"));$("#ci").value=""}
 if(f=="jf"){var code=$("#jc").value.trim().toUpperCase().replace(/[^A-Z0-9]/g,"");if(!code)return;var targetAnime=Number(D[0]&&D[0].id);if(!targetAnime){toast("Каталог ещё загружается");return}S.room=code;S.roomHost=false;S.roomAnime=targetAnime;sv();location.href=watchUrl(targetAnime,1)+"&room="+encodeURIComponent(code)}});
listen(document,"input",e=>{if(e.target.id==="collection-anime-search"){clearTimeout(collectionSearchTimer);var value=e.target.value;collectionSearchTimer=setTimeout(()=>searchCollectionAnime(value),350)}});
listen(document,"input",e=>{var i=e.target.id;
 if(i=="q"&&activePage()==="catalog"){F.q=e.target.value.trim();rc()}
 if(i=="nm"){S.name=e.target.value.trim()||"Гость";sv();hd()}});
listen(document,"change",async e=>{if(e.target.id==="profile-avatar-file"){var file=e.target.files&&e.target.files[0];e.target.value="";if(!file)return;try{if(AUTH_USER){S.avatar=await uploadProfileAvatar(file,AUTH_USER.id)}else{if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>1024*1024)throw new Error("Выбери JPG, PNG или WebP до 1 МБ.");S.avatar=await new Promise((resolve,reject)=>{var reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file)})}sv();hd();toast("Фото профиля обновлено");V.profile()}catch(error){toast(error.message||"Не удалось загрузить фото")};return}if(e.target.id==="backup-file"){var selected=e.target.files&&e.target.files[0];importBackup(selected);e.target.value="";return}if(e.target.id=="so"){F.s=e.target.value;rc()}if(e.target.id=="status-filter"){F.status=e.target.value;rc()}if(e.target.id=="anime-list-status"){var id=+e.target.dataset.id,value=e.target.value;if(value)S.watchlist[id]=value;else delete S.watchlist[id];sv();toast(value?"Статус сохранён":"Удалено из списка")}});
listen(window,"keydown",e=>{if(e.key==="Escape"){var authModal=document.getElementById("auth-modal");if(authModal){authModal.remove();return}}if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;var video=$("#stream-player video");if(!video)return;
 if(e.code==="Space"){e.preventDefault();if(video.paused)video.play().catch(()=>{});else video.pause()}else if(e.code==="ArrowRight"){video.currentTime=Math.min(video.duration||video.currentTime+10,video.currentTime+10)}else if(e.code==="ArrowLeft"){video.currentTime=Math.max(0,video.currentTime-10)}});
listen(document,"input",e=>{if(e.target.id!=="cs")return;xCF.q=e.target.value;F.q=xCF.q;var hq=$("#q");if(hq)hq.value=xCF.q;clearTimeout(xCF.h);xCF.h=setTimeout(()=>xcq(true),450)});
 listen(document,"change",e=>{var map={"cf-g":"g","cf-y":"y","cf-season":"season","cf-st":"st","cf-f":"f","cf-r":"minScore","cf-o":"o"};if(map[e.target.id]){xCF[map[e.target.id]]=e.target.value;xcq(true)}});
 listen(document,"click",e=>{if(e.target.closest("[data-xr]")){xcq(false);return}if(e.target.closest("[data-cf-reset]")){xCF.g="";xCF.y="";xCF.season="";xCF.st="";xCF.f="";xCF.o="POPULARITY_DESC";xCF.minScore="";xCF.q="";F.q="";F.g="";["cs","cf-g","cf-y","cf-season","cf-st","cf-f","cf-r","cf-o"].forEach(id=>{var el=$("#"+id);if(el)el.value=id==="cf-o"?"POPULARITY_DESC":""});var hq=$("#q");if(hq)hq.value="";xcq(true)}});
 addEventListener("pagehide",()=>{stashItems();disconnectRoom()});
idx();boot();
})();