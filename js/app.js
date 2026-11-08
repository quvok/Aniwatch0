import { query as xgq } from "./api/anilist.js";
import { fetchRandomAnime, fetchCatalogPage, fetchAnimeByIds, fetchAnimeById, fetchAnimeRelated, fetchAnimeSimilar } from "./api/shikimori.js";
import { renderAnimeCard } from "./components/anime-card.js";
import { loadLocalState, initializeLocalState, saveLocalState } from "./core/storage.js";
import { activePage as getActivePage, updateNavigation, renderRoute } from "./core/router.js";
import { renderFavorites, renderMyList, renderProfile } from "./pages/collection.js";
import { renderCatalogPage } from "./pages/catalog.js";
import { renderHomePage } from "./pages/home.js";
import { renderAnimePage } from "./pages/anime.js";
import { renderWatchPage } from "./pages/watch.js";
import { renderSchedulePage, renderRandomLoading, renderRandomError } from "./pages/discovery.js";
import { listen } from "./core/events.js";
import { renderTogetherPage } from "./pages/together.js";
(function(){
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
var M={},H=[];
var $=s=>document.querySelector(s),app=$("#app"),S=loadLocalState(),F={g:"",s:"r",q:"",status:""},T=[],P=null,AP=false,V={};
function sv(){saveLocalState(S,M)}
function df(){S.fav=S.fav||[];S.hist=S.hist||{};S.rate=S.rate||{};S.watchlist=S.watchlist||{};S.name=S.name||"Гость";S.acc=S.acc||"#8b5cf6"}
df();
var LISTS=[["watching","Смотрю"],["planned","Запланировано"],["completed","Просмотрено"],["dropped","Брошено"]];
var esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
var un=s=>String(s||"").replace(/&quot;/g,'"').replace(/&gt;/g,">").replace(/&lt;/g,"<").replace(/&amp;/g,"&");
var gr=d=>"linear-gradient(160deg,"+d.c[0]+","+d.c[1]+")";
var bg=d=>(d.img?"url('"+d.img+"') center/cover no-repeat,":"")+gr(d);
var bn=d=>"linear-gradient(0deg,#000 5%,transparent 70%),"+(d.ban?"url('"+d.ban+"') center/cover no-repeat,":"")+gr(d);
var fm=t=>{t=Math.floor(t);return(t/60|0)+":"+("0"+t%60).slice(-2)};
var srt=k=>D.slice().sort((a,b)=>k=="n"?a.n.localeCompare(b.n):b[k]-a[k]);
function card(d,pr,href){return renderAnimeCard(d,{state:S,background:bg,progress:pr,href:href||("#title-"+d.id)})}
var row=(t,a,sub)=>'<section class="shelf"><div class="shelf-head"><div><h2>'+t+'</h2>'+(sub?'<p class="shelf-sub">'+sub+'</p>':"")+'</div></div><div class="row">'+a.join("")+'</div></section>';
var epLabel=d=>d.e>0?d.e+" серий":d.ae>0?"Вышло "+d.ae+" серий":"Количество серий уточняется";
var epTotal=d=>d.e>0?d.e:(d.ae>0?d.ae:0);
var eps=(d,cur)=>epTotal(d)>0?Array.from({length:epTotal(d)},(_,k)=>'<a href="#watch-'+d.id+'-'+(k+1)+'" class="'+(k+1==cur?"on":"")+'">'+(k+1)+'</a>').join(""):'<p class="m">Количество серий пока не указано источниками.</p>';
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
function featured(){var d=H[featuredIndex%H.length]||D[0];ru(d);var rd=shortDesc((S.ru&&S.ru[d.id]&&S.ru[d.id].d)||d.d,190);return '<section class="hero hero-editorial" style="background:'+bn(d)+'"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> В центре внимания</div><small>'+d.g.slice(0,3).join(" · ")+' <i>•</i> '+d.y+' <i>•</i> '+(d.s||"Аниме")+'</small><h1>'+d.n+'</h1><p id="featured-desc" data-id="'+d.id+'">'+rd+'</p><div class="hero-facts"><span>★ '+(d.r?Number(d.r).toFixed(1):"—")+'</span><span id="featured-count" data-id="'+d.id+'">'+epLabel(d)+'</span></div><div class="acts"><a class="btn" href="#watch-'+d.id+'-1">▶ Смотреть</a><a class="btn ghost" href="#title-'+d.id+'">Подробнее</a></div></div><div class="hero-poster" style="background:'+bg(d)+'">'+(d.img?"":"<b>"+d.n[0]+"</b>")+'<span>ANIWATCH PICK</span></div>'+(H.length>1?'<button class="hero-arrow hero-prev" data-a="slide" data-v="-1" aria-label="Предыдущий баннер">‹</button><button class="hero-arrow hero-next" data-a="slide" data-v="1" aria-label="Следующий баннер">›</button><div class="hero-dots">'+H.map((x,i)=>'<button data-a="slide-to" data-v="'+i+'" class="'+(i===featuredIndex%H.length?"on":"") +'" aria-label="Баннер '+(i+1)+'"></button>').join("")+'</div>':"")+'</section>'}
function showFeatured(){var hw=$("#hw");if(hw)hw.innerHTML=featured()}
V.home=()=>{
 if(!D.length){app.innerHTML='<section class="offline-state"><div class="eyebrow">ANILIST API</div><h1>Не удалось загрузить каталог</h1><p>Проверь подключение к интернету и попробуй ещё раз. Мы не будем показывать выдуманные карточки вместо реальных данных.</p><button class="btn" type="button" data-a="reload">Повторить загрузку</button></section>';return}
 featuredIndex=0;
 var cont=Object.keys(S.hist).filter(k=>M[k]).sort((a,b)=>S.hist[b].at-S.hist[a].at).slice(0,6).map(k=>card(M[k],Math.round(S.hist[k].t/DUR*100),"#watch-"+k+"-"+S.hist[k].ep));
 var source=homeCollections||{trending:D,popular:[],ongoing:D.filter(d=>/Онгоинг|RELEASING/i.test(d.s||"")),recent:[]};
 var trending=source.trending.map(d=>{M[d.id]=d;return card(d)});
 var popular=source.popular.map(d=>{M[d.id]=d;return card(d)});
 var ongoing=source.ongoing.map(d=>{M[d.id]=d;return card(d)});
 var recent=source.recent.map(d=>{M[d.id]=d;return card(d)});
 var genres=GN.slice(0,6).map(g=>'<a class="genre-tile" href="#catalog" data-a="g" data-v="'+g+'"><span>'+g+'</span><b>Смотреть подборку <i>↗</i></b></a>').join("");
 renderHomePage({app,featured:featured(),continueCards:cont,trendingCards:trending,popularCards:popular,ongoingCards:ongoing,recentCards:recent,genreTiles:genres,row});
 if(H.length>1)T.push(setInterval(()=>{featuredIndex=(featuredIndex+1)%H.length;showFeatured()},7000));
 loadHomeAiring();
};

var rc;

V.title=p=>{
 var d=M[p[0]];if(!d)return V.home();
 renderAnimePage({app,anime:d,state:S,lists:LISTS,cleanDescription:cleanDesc,escapeHtml:esc,background:bg,backdrop:bn,episodes:eps});
 ru(d);loadRelated(d)
};

function tick(s){if(!P)return;P.t=Math.min(DUR,P.t+s);if(P.t>=DUR){P.on=false;return nextEp()}
 var tc=$("#tc"),pg=$("#pg"),pl=$(".play");if(!tc||!pg||!pl)return;tc.textContent=fm(P.t);pg.style.width=P.t/DUR*100+"%";pl.textContent=P.on?"❚❚":"▶";if(s){S.hist[P.d.id]={ep:P.n,t:P.t,at:Date.now()};if(!tick.l||Date.now()-tick.l>5000){tick.l=Date.now();sv()}}}
function pauseSave(){if(P&&!P.on&&P.t>0){S.hist[P.d.id]={ep:P.n,t:P.t,at:Date.now()};sv()}}
function nextEp(){var d=P.d,n=P.n,tot=epTotal(d);if(n<tot){S.hist[d.id]={ep:n+1,t:0,at:Date.now()};sv();AP=true;toast("Следующая серия");location.hash="watch-"+d.id+"-"+(n+1)}else if(!tot){S.hist[d.id]={ep:n,t:0,at:Date.now()};sv();toast("Серия закончилась");$(".play").textContent="▶"}else{delete S.hist[d.id];sv();toast("Тайтл досмотрен 🎉");$(".play").textContent="▶"}}
V.watch=p=>{
 var d=M[p[0]];if(!d)return V.home();
 var n=Math.max(p[1]||1,1),h=S.hist[d.id];if(epTotal(d)>0)n=Math.min(n,epTotal(d));
 var inRoom=!!S.room;
 P={d:d,n:n,t:h&&h.ep==n?h.t:0,on:AP,sp:1};AP=false;
 renderWatchPage({app,anime:d,episode:n,inRoom,state:S,escapeHtml:esc,backdrop:bn,episodes:eps,episodeTotal:epTotal,durationLabel:fm});
 tick(0);T.push(setInterval(()=>{if(P&&P.on)tick(P.sp)},1000));loadBanner(d)
};

V.together=()=>renderTogetherPage({app,state:S,animeList:D,escapeHtml:esc,card,row});
V.favorites=()=>renderFavorites({app,state:S,mediaMap:M,card});
V.mylist=()=>renderMyList({app,state:S,mediaMap:M,filters:F,lists:LISTS,card});
V.profile=()=>renderProfile({app,state:S,escapeHtml:esc});
// ---- Реальные данные: AniList (постеры, баннеры, описания) + Shikimori (русские названия и описания) ----
var Q="query{Page(perPage:30){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){id idMal title{romaji english}genres seasonYear startDate{year month}averageScore episodes status description(asHtml:false)coverImage{extraLarge color}bannerImage}}}";
var GR={Action:"Экшен",Adventure:"Приключения",Comedy:"Комедия",Drama:"Драма",Fantasy:"Фэнтези",Romance:"Романтика",Mystery:"Детектив","Slice of Life":"Повседневность",Supernatural:"Сверхъестественное",Sports:"Спорт",Horror:"Ужасы",Mecha:"Меха",Music:"Музыка",Psychological:"Психология",Thriller:"Триллер"};
var ST={RELEASING:"Онгоинг",FINISHED:"Завершён",NOT_YET_RELEASED:"Скоро",CANCELLED:"Отменён",HIATUS:"Пауза"};
function mp(m){return{id:m.id,mal:m.idMal,n:esc(m.title.english||m.title.romaji),g:(m.genres.length?m.genres:["Аниме"]).map(g=>GR[g]||g),y:m.seasonYear||(m.startDate&&m.startDate.year)||new Date().getFullYear(),r:m.averageScore?m.averageScore/10:0,e:Number(m.episodes)||0,s:ST[m.status]||"",d:esc((m.description||"Описание отсутствует.").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()),c:[m.coverImage.color||"#7c3aed","#0f0f1a"],img:m.coverImage.extraLarge,ban:m.bannerImage}}

// Shikimori owns titles and descriptions; AniList IDs/artwork remain the app's navigation keys.
async function enrichShikimori(list){
 var items=(list||[]).filter(d=>d&&Number(d.mal)>0),cache={};
 try{cache=JSON.parse(localStorage.getItem("aw-shiki-meta-v1")||"{}")}catch(e){}
 var now=Date.now(),need=[...new Set(items.filter(d=>!cache[d.mal]||now-cache[d.mal].at>7*864e5).map(d=>Number(d.mal)))];
 for(var i=0;i<need.length;i+=50){
  try{
   var batch=await fetchAnimeByIds(need.slice(i,i+50));
   batch.forEach(a=>{cache[a.id]={russian:a.russian||"",name:a.name||"",description:a.description||"",at:now}});
   need.slice(i,i+50).forEach(id=>{if(!cache[id])cache[id]={russian:"",name:"",description:"",at:now}});
  }catch(e){console.warn("[AniWatch] Shikimori metadata lookup failed:",e);break}
 }
 var keys=Object.keys(cache);if(keys.length>500){keys.sort((a,b)=>(cache[b].at||0)-(cache[a].at||0)).slice(500).forEach(id=>delete cache[id])}
 try{localStorage.setItem("aw-shiki-meta-v1",JSON.stringify(cache))}catch(e){}
 items.forEach(d=>{
  var a=cache[d.mal];if(!a)return;
  var russian=a.russian||a.name;
  if(russian){if(d.n&&d.n!==russian)d.o=esc(a.name||un(d.n));d.n=esc(russian)}
  if(a.description)d.d=esc(cleanDesc(a.description));
 });
 return list;
}
function idx(){M={};D.forEach(d=>M[d.id]=d);var c={};D.forEach(d=>d.g.forEach(g=>c[g]=(c[g]||0)+1));GN=Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,10);H=D.filter(d=>d.ban).slice(0,8);if(H.length<8){var featuredIds=new Set(H.map(d=>d.id));H=H.concat(D.filter(d=>!featuredIds.has(d.id)).slice(0,8-H.length))}}
var aniCountPending={};
function normTitle(v){return String(v||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ё/g,"е").replace(/[^a-zа-я0-9]/gi,"")}
async function anilibriaCount(d){
 var cache=S.aniEpisodes=S.aniEpisodes||{},saved=cache[d.id];
 if(saved&&Date.now()-saved.at<30*864e5){d.e=Number(saved.total)||d.e;d.ae=Number(saved.available)||0;refreshEpCount(d);return}
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
 if(saved&&Date.now()-saved.at<30*864e5){if(!d.e&&saved.total>0)d.e=saved.total;if(!d.ae&&saved.available>0)d.ae=saved.available;refreshEpCount(d);return saved.total||saved.available}
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
 if(saved&&Date.now()-saved.at<30*864e5){if(!d.e&&saved.total>0)d.e=saved.total;if(!d.ae&&saved.available>0)d.ae=saved.available;refreshEpCount(d);return saved.total||saved.available}
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
async function translateRelated(list){return enrichShikimori(list)}
async function loadRelated(d){
 var root=$("#related-anime");if(!root)return;
 var cached=S.relatedAnime=S.relatedAnime||{},saved=cached[d.id];
 if(saved&&saved.v===8&&Date.now()-saved.at<7*864e5){renderRelated(d,saved);return}
 if(relatedPending[d.id])return relatedPending[d.id];
 relatedPending[d.id]=(async()=>{
  try{
   var relations=[],recommendations=[],creatorName="",creatorWorks=[];
   try{
    var query,vars;
    if(d.source==="shikimori"){
     if(!(Number(d.mal)>0))throw new Error("У тайтла нет MAL ID для поиска в AniList");
     query="query($mal:Int){Media(idMal:$mal,type:ANIME){relations{edges{relationType node{"+relatedFields+"}}} recommendations(perPage:12,sort:RATING_DESC){nodes{mediaRecommendation{"+relatedFields+"}}}}}";
     vars={mal:Number(d.mal)};
    }else{
     query="query($id:Int){Media(id:$id,type:ANIME){relations{edges{relationType node{"+relatedFields+"}}} recommendations(perPage:12,sort:RATING_DESC){nodes{mediaRecommendation{"+relatedFields+"}}}}}";
     vars={id:Number(d.aniId||d.id)};
    }
    var payload=await xgq(query,vars),media=payload&&payload.Media;
    if(!media)throw new Error("AniList не вернул данные об этом аниме");
    var relSeen={};
    relations=(media.relations&&media.relations.edges||[]).filter(e=>e.node&&e.node.type==="ANIME"&&e.node.format!=="MUSIC"&&e.relationType!=="CHARACTER"&&e.node.id!==(d.aniId||d.id)).map(e=>({type:e.relationType,anime:mp(e.node)})).filter(e=>{if(relSeen[e.anime.id])return false;relSeen[e.anime.id]=true;return true});
    var recSeen={};
    recommendations=(media.recommendations&&media.recommendations.nodes||[]).map(x=>x.mediaRecommendation).filter(x=>x&&x.type==="ANIME"&&x.format!=="MUSIC").filter(x=>x.id!==(d.aniId||d.id)&&!relSeen[x.id]&&!recSeen[x.id]&&(recSeen[x.id]=true)).map(mp).slice(0,8);
    try{
     var staffQuery,staffVars;
     if(d.source==="shikimori"){staffQuery="query($mal:Int){Media(idMal:$mal,type:ANIME){staff(sort:RELEVANCE,perPage:10){edges{role node{id name{full} staffMedia(type:ANIME,sort:POPULARITY_DESC,perPage:25){nodes{"+relatedFields+"}}}}}}}";staffVars={mal:Number(d.mal)}}
     else{staffQuery="query($id:Int){Media(id:$id,type:ANIME){staff(sort:RELEVANCE,perPage:10){edges{role node{id name{full} staffMedia(type:ANIME,sort:POPULARITY_DESC,perPage:25){nodes{"+relatedFields+"}}}}}}}";staffVars={id:Number(d.aniId||d.id)}}
     var staffPayload=await xgq(staffQuery,staffVars),staffMedia=staffPayload&&staffPayload.Media;
     var creatorEdges=(staffMedia&&staffMedia.staff&&staffMedia.staff.edges||[]).filter(e=>e.node&&/original creator|原作|原案/i.test(e.role||""));
     creatorName=creatorEdges.length&&creatorEdges[0].node.name?creatorEdges[0].node.name.full:"";
     var creatorSeen={};
     creatorEdges.forEach(e=>(e.node.staffMedia&&e.node.staffMedia.nodes||[]).forEach(m=>{if(m&&m.type==="ANIME"&&m.format!=="MUSIC"&&m.id!==(d.aniId||d.id)&&!relSeen[m.id]&&!recSeen[m.id]&&!creatorSeen[m.id]){creatorSeen[m.id]=true;creatorWorks.push(mp(m))}}));
     creatorWorks=creatorWorks.slice(0,12);
    }catch(staffError){console.warn("[AniWatch] Creator works unavailable:",staffError)}
   }catch(anilistError){
    console.warn("[AniWatch] AniList relations unavailable; using Shikimori:",anilistError);
    // Relations fallback must work for AniList-origin titles too.
    // MAL IDs and Shikimori IDs are different namespaces: resolve MAL -> Shikimori first.
    var shikiId=Number(d.shikiId)||Number(d.id)-1000000000;
    if(!(shikiId>0)&&Number(d.mal)>0){
     var shikiMatches=await fetchAnimeByIds([Number(d.mal)]);
     shikiId=Number(shikiMatches&&shikiMatches[0]&&shikiMatches[0].id)||0;
    }
    if(!(shikiId>0))throw new Error("Не удалось найти соответствующий тайтл в Shikimori (нет корректного MAL ID)");
    var rawRelated=await fetchAnimeRelated(shikiId),rawSimilar=await fetchAnimeSimilar(shikiId);
    var convert=function(a){
     if(!a||!Number(a.id))return null;
     var id=1000000000+Number(a.id),genres=Array.isArray(a.genres)?a.genres.map(g=>esc(g.russian||g.name||"")).filter(Boolean):[];
     var status=a.status==="released"?"Завершён":a.status==="ongoing"?"Онгоинг":a.status==="anons"?"Скоро":"";
     return {id:id,shikiId:Number(a.id),source:"shikimori",mal:Number(a.myanimelist_id)||null,n:esc(a.russian||a.name||"Без названия"),o:esc(a.russian&&a.name&&a.russian!==a.name?a.name:""),g:genres.length?genres:["Аниме"],y:Number(String(a.aired_on||"").slice(0,4))||0,r:Number(a.score)||0,e:Number(a.episodes)||0,s:status,d:cleanDesc(a.description||""),c:["#7c3aed","#0f0f1a"],img:"",ban:"",kind:String(a.kind||"")};
    };
    var seen={};
    relations=rawRelated.map(x=>{var anime=convert(x&&x.anime);if(!anime)return null;return {type:String(x.relation||"OTHER").toUpperCase().replace(/-/g,"_"),anime:anime}}).filter(x=>x&&!seen[x.anime.id]&&(seen[x.anime.id]=true));
    recommendations=rawSimilar.map(convert).filter(x=>x&&!seen[x.id]&&(seen[x.id]=true)).slice(0,8);
    var fallbackList=relations.map(x=>x.anime).concat(recommendations);
    fallbackList.forEach(x=>{M[x.id]=x});
    await xaniPosters(fallbackList);
   }
   var all=relations.map(x=>x.anime).concat(recommendations,creatorWorks);
   await translateRelated(all);
   var data={v:8,relations:relations,recommendations:recommendations,creatorName:creatorName,creatorWorks:creatorWorks,at:Date.now()};
   cached[d.id]=data;sv();renderRelated(d,data);
  }catch(e){
   console.warn("[AniWatch] Related anime:",e);
   var el=$("#related-anime");if(el&&location.hash==="#title-"+d.id)el.innerHTML='<section class="shelf"><h2>Связанные аниме</h2><p class="related-state">Не удалось загрузить связи. Попробуйте обновить страницу.</p><p class="related-state"><small>Причина: '+esc(String(e&&e.message||e).slice(0,160))+'</small></p></section>';
  }finally{delete relatedPending[d.id]}
 })();
 return relatedPending[d.id];
}
function renderRelated(d,data){
 var root=$("#related-anime");if(!root||location.hash!=="#title-"+d.id)return;
 var rel=(data.relations||[]).filter(x=>x&&x.anime),rec=(data.recommendations||[]).filter(Boolean),creatorWorks=(data.creatorWorks||[]).filter(Boolean);
 rel.forEach(x=>{M[x.anime.id]=x.anime});rec.forEach(x=>{M[x.id]=x});creatorWorks.forEach(x=>{M[x.id]=x});
 var groups={};
 rel.forEach(x=>(groups[x.type]=groups[x.type]||[]).push(x.anime));
 var relationHtml=Object.keys(groups).map(type=>'<div class="relation-group"><h3>'+esc(relationNames[type]||"Связанный тайтл")+'</h3><div class="row">'+relatedCards(groups[type].slice(0,8))+'</div></div>').join("");
 if(!relationHtml)relationHtml='<p class="related-state">Для этого аниме пока нет связанных тайтлов.</p>';
 var recHtml=rec.length?'<div class="row">'+relatedCards(rec)+'</div>':'<p class="related-state">Рекомендации пока не найдены.</p>';
 var creatorHtml=creatorWorks.length?'<section class="shelf related-shelf"><div class="shelf-head"><div><h2>Другие работы автора</h2><p class="shelf-sub">'+(data.creatorName?'Ещё аниме '+esc(data.creatorName):'Другие аниме того же автора')+'. Не связаны сюжетом — их объединяет автор.</p></div></div><div class="row">'+relatedCards(creatorWorks)+'</div></section>':"";
 root.innerHTML='<section class="shelf related-shelf"><div class="shelf-head"><div><h2>Связанные аниме</h2><p class="shelf-sub">Продолжения, приквелы и дополнительные истории</p></div></div>'+relationHtml+'</section>'+creatorHtml+'<section class="shelf related-shelf"><div class="shelf-head"><div><h2>Похожие аниме</h2><p class="shelf-sub">Рекомендации AniList для этого тайтла</p></div></div>'+recHtml+'</section>';
}
function refreshEpCount(d){
 var ef=$("#featured-count"),et=$("#title-count");
 if(ef&&ef.dataset.id==d.id)ef.textContent=epLabel(d);
 if(et&&et.dataset.id==d.id){et.textContent=epLabel(d);var el=$(".title-episodes .eps"),ec=$(".title-episodes .episode-count");if(el)el.innerHTML=eps(d,0);if(ec)ec.textContent=epTotal(d)>0?epTotal(d)+" серий":"Серии"}
}
async function ru(d){
 anilibriaCount(d);if(!d.mal)return;
 var c=S.ru=S.ru||{},r=c[d.id];
 if(!r||Date.now()-(r.at||0)>7*864e5){
  try{var j=await fetchAnimeById(d.mal);r=c[d.id]={n:j.russian||j.name||"",o:j.name||"",d:j.description||"",e:Number(j.episodes)||0,at:Date.now()};sv()}
  catch(e){if(!r)return}
 }
 if(r.n){d.o=esc(r.o||un(d.n));d.n=esc(r.n)}
 if(r.d)d.d=esc(cleanDesc(r.d));
 if(!d.e&&r.e>0)d.e=r.e;
 if(!d.e)await jikanCount(d,false);
 if(!d.e||!d.ae)await aniZipCount(d);
 if(!d.e||!d.ae||Number(d.mal)===21)await kitsuCount(d,false);
 refreshEpCount(d);
 if(location.hash==="#title-"+d.id){var h=$("#tn"),p=$("#td");if(h&&r.n)h.textContent=r.n;if(p&&r.d)p.textContent=cleanDesc(r.d)}
 var fp=$("#featured-desc");if(fp&&fp.dataset.id==d.id&&r.d)fp.textContent=shortDesc(r.d,190);
}
// Русские названия одним запросом к Shikimori (id там совпадают с MAL), кэш в localStorage
async function rn(){await enrichShikimori(D)}
async function boot(){S=await initializeLocalState(S,value=>{S=value});app.innerHTML='<p class="empty">Загрузка…</p>';var c;
 try{c=JSON.parse(localStorage.getItem("awc")||"null")}catch(e){}
 if(!c||!c.a||c.a.length>30||Date.now()-c.t>216e5){try{var ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),6000),
  r=await fetch("https://graphql.anilist.co",{method:"POST",signal:ctl.signal,headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:Q})});
  clearTimeout(tm);var j=await r.json();c={t:Date.now(),a:j.data.Page.media.map(mp)};try{localStorage.setItem("awc",JSON.stringify(c))}catch(e){}}catch(e){}}
 if(c&&c.a&&c.a.length)D=c.a;else D=[];await rn();idx();await xhyd();draw();loadHomeCollections().then(()=>{if(activePage()==="home")draw()}).catch(e=>console.warn("[AniWatch] Home collections unavailable:",e))}

// ---- v2: каталог по всей базе AniList, расписание серий, трейлеры ----
var xMF="id idMal format title{romaji english}genres seasonYear startDate{year month}averageScore episodes status description(asHtml:false)coverImage{extraLarge color}bannerImage",
HOME_QUERY="query{trending:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,sort:TRENDING_DESC){"+xMF+"}}popular:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,sort:POPULARITY_DESC){"+xMF+"}}ongoing:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,status:RELEASING,sort:POPULARITY_DESC){"+xMF+"}}recent:Page(page:1,perPage:8){pageInfo{total}media(type:ANIME,isAdult:false,status_in:[RELEASING,FINISHED],sort:START_DATE_DESC){"+xMF+"}}}",
homeCollections=null;
async function loadHomeCollections(){
 var cache=null;try{cache=JSON.parse(localStorage.getItem("aw-home-v1")||"null")}catch(e){}
 var data=cache&&Date.now()-cache.at<20*60*1000?cache.data:null;
 if(!data){data=await xgq(HOME_QUERY,{});try{localStorage.setItem("aw-home-v1",JSON.stringify({at:Date.now(),data:data}))}catch(e){}}
 var page=data||{},map=list=>(list&&list.media||[]).map(mp);
 homeCollections={
  trending:map(page.trending),popular:map(page.popular),ongoing:map(page.ongoing),recent:map(page.recent)
 };
 var allHome=homeCollections.trending.concat(homeCollections.popular,homeCollections.ongoing,homeCollections.recent);
 await enrichShikimori(allHome);
 allHome.forEach(d=>M[d.id]=d);
 if(homeCollections.trending.length)H=homeCollections.trending;
 return homeCollections;
}
var xCQ="query($p:Int,$s:String,$g:[String],$y:String,$st:MediaStatus,$f:[MediaFormat],$o:[MediaSort]){Page(page:$p,perPage:24){pageInfo{hasNextPage total}media(type:ANIME,isAdult:false,search:$s,genre_in:$g,startDate_like:$y,status:$st,format_in:$f,sort:$o){"+xMF+"}}}",
xSQ="query($a:Int,$b:Int,$p:Int){Page(page:$p,perPage:50){pageInfo{hasNextPage}airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME){airingAt episode media{"+xMF+" isAdult}}}}",
xXQ="query($id:Int,$mal:Int){Media(id:$id,idMal:$mal,type:ANIME){id bannerImage nextAiringEpisode{airingAt episode}trailer{id site}}}",
xCF={g:"",y:"",season:"",st:"",f:"",o:"POPULARITY_DESC",q:"",minScore:"",p:1,more:true,busy:false,k:0},xXC={},xSD=0,xSC=null,xIO=null;
var xGL=["Action","Adventure","Comedy","Drama","Fantasy","Horror","Mahou Shoujo","Mecha","Music","Mystery","Psychological","Romance","Sci-Fi","Slice of Life","Sports","Supernatural","Thriller"],
xSO=[["POPULARITY_DESC","Популярные"],["SCORE_DESC","По рейтингу"],["START_DATE_DESC","Сначала новые"],["TITLE_ROMAJI","По названию"]],
xST=[["RELEASING","Онгоинг"],["FINISHED","Завершён"],["NOT_YET_RELEASED","Скоро"]],
xFM=[["TV","Сериал"],["MOVIE","Фильм"],["OVA","OVA"],["ONA","ONA"],["SPECIAL","Спешл"]];
GR["Mahou Shoujo"]=GR["Mahou Shoujo"]||"Махо-сёдзё";
// русские названия для произвольного списка (пачками по 50, кэш awr2)
async function xrn(L){return enrichShikimori(L)}
// избранное/история/списки, найденные через каталог, подгружаем по id после перезагрузки
async function xhyd(){var ids=new Set([].concat(S.fav||[],Object.keys(S.hist||{})).map(Number)),w=S.watchlist;if(w&&!Array.isArray(w))Object.keys(w).forEach(k=>ids.add(+k));
 var saved=S.shikiAnime||{};ids.forEach(i=>{if(!M[i]&&saved[i])M[i]=saved[i]});
 var need=[...ids].filter(i=>i>0&&!M[i]&&i<1000000000).slice(0,50);if(!need.length)return;
 try{var L=(await xgq("query($i:[Int]){Page(perPage:50){media(id_in:$i,type:ANIME){"+xMF+"}}}",{i:need})).Page.media.map(x=>M[x.id]=mp(x));await xrn(L)}catch(e){}}
// Shikimori supplies MAL IDs; use them only as a bridge to AniList artwork.
async function xaniPosters(L){
 var ids=[...new Set(L.map(d=>Number(d.mal)).filter(id=>Number.isInteger(id)&&id>0))];if(!ids.length)return;
 try{
  var map={};
  for(var i=0;i<ids.length;i+=40){
   var chunk=ids.slice(i,i+40),res=await xgq("query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:ANIME){idMal coverImage{extraLarge large} bannerImage}}}",{ids:chunk});
   (res.Page.media||[]).forEach(a=>{map[a.idMal]=a});
  }
  L.forEach(d=>{var a=map[d.mal];if(!a)return;d.aniId=a.id;d.img=a.coverImage&&(a.coverImage.extraLarge||a.coverImage.large)||d.img;d.ban=a.bannerImage||d.ban;M[d.id]=d;S.shikiAnime[d.id]=d});
  var cards=Array.from(document.querySelectorAll("#cr .card[data-anime-id]"));
  cards.forEach(c=>{var d=M[+c.dataset.animeId];if(!d||!d.img)return;var p=c.querySelector(".poster");if(p){p.style.background=bg(d);var letter=p.querySelector("i");if(letter)letter.remove()}});
  sv();
 }catch(e){console.warn("[AniWatch] AniList poster lookup failed:",e)}
}
V.catalog=()=>{
 xCF.p=1;xCF.more=true;xCF.busy=false;xCF.k++;
 renderCatalogPage({
  app,filters:xCF,escapeHtml:esc,genreOptions:xGL,genreLabels:GR,
  yearOptions:Array.from({length:new Date().getFullYear()-1970+1},(_,i)=>[String(new Date().getFullYear()-i),String(new Date().getFullYear()-i)]),
  seasonOptions:[["winter","Зима"],["spring","Весна"],["summer","Лето"],["fall","Осень"]],
  statusOptions:xST,formatOptions:xFM,sortOptions:xSO,ratingOptions:[["6","6.0+"],["7","7.0+"],["8","8.0+"],["9","9.0+"]]
 });
 xCF.q=F.q||xCF.q||"";xCF.g=(F.g?(Object.keys(GR).find(k=>GR[k]===F.g)||F.g):xCF.g)||"";F.q=xCF.q;F.g=xCF.g;var csInput=$("#cs"),genreSelect=$("#cf-g");if(csInput)csInput.value=xCF.q;if(genreSelect)genreSelect.value=xCF.g;
 xcq(true);
};
rc=()=>{xCF.q=F.q||"";var s=$("#cs");if(s&&s!==document.activeElement)s.value=xCF.q;clearTimeout(xCF.h);xCF.h=setTimeout(()=>xcq(true),450)};
async function xcq(reset){
 if(reset){xCF.p=1;xCF.more=true;xCF.busy=false;xCF.aniFallback=false;var c0=$("#cr");if(c0)c0.innerHTML=""}
 if(!xCF.more||xCF.busy||!$("#cr"))return;
 xCF.busy=true;var k=++xCF.k,box=$("#more");box.textContent="Загрузка…";
 try{
  var q=xCF.q.trim(),needLocalFilter=!!xCF.g||!!xCF.minScore||!!xCF.y||!!xCF.season,all=[],lastPageLength=0,sourcePage=xCF.p,pagesFetched=0;
  // Status is filtered by Shikimori itself; genre remains a local filter.
  // Scan more pages when genre or minimum-score filtering is applied locally.
  var maxPages=needLocalFilter?6:1;
  if(!xCF.aniFallback)for(var step=0;step<maxPages;step++){
   var page=sourcePage+step,key="awshiki2:"+JSON.stringify([q,page,xCF.o,xCF.g,xCF.y,xCF.season,xCF.f,xCF.st,xCF.minScore]),cached=null;
   try{cached=JSON.parse(localStorage.getItem(key)||"null")}catch(e){}
   var data=cached&&Date.now()-cached.at<1800000?cached.data:null;
   if(!data){
    var ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),12000);
    try{
     data=await fetchCatalogPage({
      query:q,page:page,
      order:xCF.o==="SCORE_DESC"?"ranked":xCF.o==="START_DATE_DESC"?"aired_on":xCF.o==="TITLE_ROMAJI"?"name":"popularity",
      format:xCF.f,season:(xCF.y&&xCF.season?xCF.season+"_"+xCF.y:""),status:xCF.st,signal:ctl.signal
     });
    }finally{clearTimeout(timer)}
    try{localStorage.setItem(key,JSON.stringify({at:Date.now(),data:data}))}catch(e){}
   }
   if(k!==xCF.k)return;
   lastPageLength=data.length;pagesFetched++;all=all.concat(data);
   var matched=all.filter(a=>{
    var gs=Array.isArray(a.genres)?a.genres.map(g=>g.russian||g.name||""):[];
    var st=a.status==="released"?"Завершён":a.status==="ongoing"?"Онгоинг":a.status==="anons"?"Скоро":"";
    var month=Number(String(a.aired_on||"").slice(5,7)),season=month>=3&&month<=5?"spring":month>=6&&month<=8?"summer":month>=9&&month<=11?"fall":month>0?"winter":"";
     return (!xCF.st||st===({RELEASING:"Онгоинг",FINISHED:"Завершён",NOT_YET_RELEASED:"Скоро"})[xCF.st])&&(!xCF.g||gs.includes(GR[xCF.g]||xCF.g))&&(!xCF.y||String(a.aired_on||"").slice(0,4)===String(xCF.y))&&(!xCF.season||season===xCF.season)&&(!xCF.minScore||Number(a.score)>=Number(xCF.minScore));
   });
   if(!needLocalFilter||matched.length>=50||data.length<50)break;
  }
  if(k!==xCF.k)return;
  // Если Shikimori не нашёл ничего по запросу, пробуем AniList Search.
  // Это помогает с английскими/ромадзи-названиями и не ломает обычный каталог.
  if((!all.length||xCF.aniFallback)&&q){
   xCF.aniFallback=true;
   var fallback=await xgq("query($s:String,$p:Int){Page(page:$p,perPage:50){pageInfo{hasNextPage}media(search:$s,type:ANIME,isAdult:false,sort:SEARCH_MATCH){"+xMF+"}}}",{s:q,p:sourcePage});
   if(k!==xCF.k)return;
   var fp=fallback.Page;
   var fallbackList=(fp.media||[]).map(mp).filter(d=>
    (!xCF.st||d.s===({RELEASING:"Онгоинг",FINISHED:"Завершён",NOT_YET_RELEASED:"Скоро"})[xCF.st])&&
    (!xCF.g||d.g.includes(GR[xCF.g]||xCF.g))&&
    (!xCF.minScore||d.r>=Number(xCF.minScore))&&
    (!xCF.y||String(d.y)===String(xCF.y))&&
    (!xCF.f||({TV:["TV"],MOVIE:["MOVIE"],OVA:["OVA"],ONA:["ONA"],SPECIAL:["SPECIAL"]}[xCF.f]||[]).includes((fp.media||[]).find(m=>m.id===d.id)?.format))
   );
   await enrichShikimori(fallbackList);
   fallbackList.forEach(d=>M[d.id]=d);
   var fb=$("#cr");if(!fb)return;
   fb.insertAdjacentHTML("beforeend",fallbackList.map(d=>card(d)).join(""));
   xCF.p=sourcePage+1;xCF.more=!!fp.pageInfo.hasNextPage;xCF.busy=false;
   $("#cc").textContent="Результаты AniList · поиск по английскому названию";
   box.textContent=xCF.more?"Загрузить ещё":"Это все результаты";
   if(!fallbackList.length&&!xCF.more)box.textContent="Ничего не найдено";
   return;
  }
  var L=all.map(a=>{
   var id=1000000000+Number(a.id),kind=String(a.kind||"").toLowerCase(),status=a.status==="released"?"Завершён":a.status==="ongoing"?"Онгоинг":a.status==="anons"?"Скоро":"";
   var genres=Array.isArray(a.genres)?a.genres.map(g=>esc(g.russian||g.name||"")).filter(Boolean):[];
   // Постеры каталога берём только из AniList; Shikimori используется для метаданных и MAL ID.
   return {id:id,shikiId:Number(a.id),source:"shikimori",mal:Number(a.myanimelist_id)||null,n:esc(a.russian||a.name||"Без названия"),o:esc(a.russian&&a.name&&a.russian!==a.name?a.name:""),g:genres.length?genres:["Аниме"],y:Number(String(a.aired_on||"").slice(0,4))||0,r:Number(a.score)||0,e:Number(a.episodes)||0,s:status,d:cleanDesc(a.description||""),c:["#7c3aed","#0f0f1a"],img:"",ban:"",kind:kind};
  }).filter(d=>(!xCF.st||d.s===({RELEASING:"Онгоинг",FINISHED:"Завершён",NOT_YET_RELEASED:"Скоро"})[xCF.st])&&(!xCF.g||d.g.includes(GR[xCF.g]||xCF.g))&&(!xCF.y||String(d.y)===String(xCF.y))&&(!xCF.season||({winter:[12,1,2],spring:[3,4,5],summer:[6,7,8],fall:[9,10,11]}[xCF.season]||[]).includes(Number(String(all.find(a=>Number(a.id)===d.shikiId)?.aired_on||"").slice(5,7))))&&(!xCF.minScore||d.r>=Number(xCF.minScore)));
  L.forEach(d=>M[d.id]=d);S.shikiAnime=S.shikiAnime||{};L.forEach(d=>S.shikiAnime[d.id]=d);sv();
  var cr=$("#cr");if(!cr)return;
  cr.insertAdjacentHTML("beforeend",L.map(d=>card(d)).join(""));
  xCF.p=sourcePage+pagesFetched;
  // If we reached the end of the source, there is nothing more to request.
  xCF.more=lastPageLength===50;
  xCF.busy=false;
  $("#cc").textContent=q?"Результаты поиска":xCF.st==="RELEASING"?"Онгоинги · постеры AniList":"Каталог · постеры AniList";
  box.textContent=xCF.more?"Загрузить ещё":"Это все результаты";
  if(!L.length&&!xCF.more)box.textContent="Ничего не найдено";
  xaniPosters(L);
 }catch(e){
  console.error("[AniWatch] Shikimori catalog:",e);
  if(k===xCF.k){xCF.busy=false;var b=$("#more");if(b)b.textContent="Ошибка загрузки. Нажмите, чтобы повторить";toast("Не удалось загрузить каталог Shikimori")}
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
  xaniPosters([d]);
  if(location.hash==="#random")location.hash="title-"+id;
 }catch(e){
  console.error("[AniWatch] Random anime:",e);
  renderRandomError(app);
  toast("Не удалось выбрать случайное аниме");
 }
}
V.random=()=>{xrandom()};
listen(document,"change",e=>{var m={"cf-g":"g","cf-y":"y","cf-st":"st","cf-f":"f","cf-o":"o","cf-r":"minScore"}[e.target.id];if(m){xCF[m]=e.target.value;if(m==="g")F.g=e.target.value;xcq(true)}});
listen(document,"input",e=>{if(e.target.id=="cs"){xCF.q=e.target.value.trim();F.q=xCF.q;clearTimeout(xCF.h);xCF.h=setTimeout(()=>xcq(true),450)}});
listen(document,"scroll",()=>{if($("#more")&&xCF.more&&!xCF.busy&&window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-900)xcq()},{passive:true});
listen(document,"click",e=>{if(e.target.closest("[data-cf-reset]")){F.q="";F.g="";xCF.g="";xCF.y="";xCF.st="";xCF.f="";xCF.o="POPULARITY_DESC";xCF.q="";xCF.minScore="";V.catalog();return}if(e.target.closest("[data-xr]"))xcq();var s=e.target.closest("[data-sd]");if(s&&xSC){xSD=+s.dataset.sd;xsch()}});
// расписание
function xcd(s){var m=Math.round(s/60);if(m<1)return"меньше минуты";var d=m/1440|0,h=(m%1440)/60|0;m%=60;return d?d+" д "+h+" ч":h?h+" ч "+m+" мин":m+" мин"}
async function xloadSch(){var now=Date.now()/1000;if(xSC&&now-xSC.t<1800)return xSC;var st=new Date();st.setHours(0,0,0,0);var a=Math.floor(st/1000),out=[];
 for(var p=1;p<=6;p++){var pg=(await xgq(xSQ,{a:a,b:a+7*86400,p:p})).Page;out=out.concat(pg.airingSchedules);if(!pg.pageInfo.hasNextPage)break}
 out=out.filter(x=>x.media&&!x.media.isAdult);out.forEach(x=>x.m=M[x.media.id]||(M[x.media.id]=mp(x.media)));
 await xrn([...new Set(out.map(x=>x.m))]);return xSC={t:now,a:out}}
function renderHomeAiring(){
 if(!(location.hash===""||location.hash==="#home")||!xSC)return;
 var now=Date.now()/1000,upcoming={};
 xSC.a.filter(x=>x.airingAt>now).sort((a,b)=>a.airingAt-b.airingAt).forEach(x=>{var id=x.media&&x.media.id;if(id&&!upcoming[id])upcoming[id]=x});
 Array.from(document.querySelectorAll(".card[data-anime-id]")).forEach(c=>{
  var x=upcoming[c.dataset.animeId],poster=c.querySelector(".poster");if(!poster)return;
  var old=poster.querySelector(".poster-airing");if(old)old.remove();if(!x)return;
  var dt=new Date(x.airingAt*1000),day=dt.toLocaleDateString("ru-RU",{day:"numeric",month:"short"}),time=dt.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
  var tag=document.createElement("span");tag.className="poster-airing";tag.textContent="Серия "+x.episode+" · "+day+", "+time;poster.appendChild(tag);
 });
}
function loadHomeAiring(){xloadSch().then(()=>renderHomeAiring()).catch(e=>console.warn("[AniWatch] Home episode labels unavailable",e))}
function xsch(){if(!xSC||!$("#slist"))return;var st=new Date();st.setHours(0,0,0,0);var b=st/1000+xSD*86400,now=Date.now()/1000,L=xSC.a.filter(x=>x.airingAt>=b&&x.airingAt<b+86400);
 $("#sdays").innerHTML=[0,1,2,3,4,5,6].map(i=>'<button class="'+(i==xSD?"on":"")+'" data-sd="'+i+'">'+(i==0?"Сегодня":i==1?"Завтра":new Date((st/1000+i*86400)*1000).toLocaleDateString("ru-RU",{weekday:"short",day:"numeric"}))+'</button>').join("");
 $("#slist").innerHTML=L.length?L.map(x=>{var d=x.m;return'<a class="sch-row" href="#title-'+d.id+'"><b class="sch-t">'+new Date(x.airingAt*1000).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})+'</b><div class="sch-p" style="background:'+bg(d)+'"></div><div class="sch-i"><span>'+d.n+'</span><small>Серия '+x.episode+' · '+(x.airingAt>now?"через "+xcd(x.airingAt-now):"вышла")+'</small></div></a>'}).join(""):'<p class="empty">В этот день серий нет</p>'}
V.schedule=()=>{xSD=0;renderSchedulePage(app);
 xloadSch().then(()=>{if(location.hash=="#schedule"){xsch();T.push(setInterval(xsch,6e4))}}).catch(()=>{var s=$("#slist");if(s)s.innerHTML='<p class="empty">Не удалось загрузить расписание. Попробуйте позже.</p>'})};
// страница тайтла: таймер следующей серии и трейлер
// Баннер из AniList: один общий запрос на тайтл (баннер, следующая серия, трейлер), без дублей
var xXP={};
function applyBanner(d){
 var tb=$(".title-backdrop");if(tb&&location.hash==="#title-"+d.id)tb.style.background=bn(d);
 var pl=$(".player");if(pl&&P&&P.d.id===d.id)pl.style.background=bn(d);
}
function aniMedia(d){
 var id=d.id;if(xXC[id])return Promise.resolve(xXC[id]);
 if(d.source&&!(Number(d.mal)>0))return Promise.resolve(null);
 if(xXP[id])return xXP[id];
 var query,vars;
 if(d.source){query="query($mal:Int){Media(idMal:$mal,type:ANIME){id bannerImage nextAiringEpisode{airingAt episode}trailer{id site}}}";vars={mal:Number(d.mal)}}
 else{query="query($id:Int){Media(id:$id,type:ANIME){id bannerImage nextAiringEpisode{airingAt episode}trailer{id site}}}";vars={id:Number(d.aniId||d.id)}}
 xXP[id]=xgq(query,vars).then(function(r){
  var m=r&&r.Media||null;xXC[id]=m;
  var t=M[id]||d;if(m&&m.bannerImage&&!t.ban){t.ban=m.bannerImage;if(t.source){S.shikiAnime=S.shikiAnime||{};S.shikiAnime[id]=t}applyBanner(t);sv()}
  return m;
 }).finally(function(){delete xXP[id]});
 return xXP[id];
}
function loadBanner(d){if(d&&!d.ban)aniMedia(d).catch(function(){})}
var xvt=V.title;V.title=p=>{xvt(p);xex(+p[0])};
async function xex(id){var d=M[id];if(!d)return;var x=xXC[id];if(!x){try{x=await aniMedia(d)}catch(e){return}}
 if(!x||location.hash!="#title-"+id||!$(".title-info"))return;var n=x.nextAiringEpisode,tr=x.trailer;
 if(n&&!$("#nx")){var ds=$(".title-description"),el=document.createElement("div");el.id="nx";el.className="next-ep";if(ds)ds.parentNode.insertBefore(el,ds);
  var up=()=>{var s=n.airingAt-Date.now()/1000;el.textContent="Серия "+n.episode+(s>0?" выйдет через "+xcd(s):" уже вышла")+" · "+new Date(n.airingAt*1000).toLocaleString("ru-RU",{weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})};up();T.push(setInterval(up,3e4))}
 if(tr&&tr.id&&!$("#trl")){var u=tr.site=="youtube"?"https://www.youtube-nocookie.com/embed/"+encodeURIComponent(tr.id):tr.site=="dailymotion"?"https://www.dailymotion.com/embed/video/"+encodeURIComponent(tr.id):"";
  if(u){var s=document.createElement("section");s.id="trl";s.className="trailer";s.innerHTML='<h2>Трейлер</h2><div class="tr-frame"><iframe src="'+u+'" title="Трейлер" loading="lazy" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';var epsSection=$(".title-episodes");if(epsSection)app.insertBefore(s,epsSection);else app.appendChild(s)}}}

function activePage(){return getActivePage()}
function hd(){updateNavigation(S)}
function draw(){renderRoute(V,T,()=>{P=null},S)}
function msg(a,t){var m=$("#ms");if(!m)return;var d=document.createElement("div"),e=document.createElement("em");e.textContent=a;d.append(e,t);m.append(d);m.scrollTop=1e5}

var heroTouch=null;listen(document,"touchstart",e=>{var h=e.target.closest("#hw .hero-editorial");if(!h||e.touches.length!==1)return;heroTouch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});listen(document,"touchend",e=>{if(!heroTouch)return;var p=heroTouch;heroTouch=null;if(!e.changedTouches.length||H.length<2)return;var dx=e.changedTouches[0].clientX-p.x,dy=e.changedTouches[0].clientY-p.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.25){featuredIndex=(featuredIndex+(dx<0?1:-1)+H.length)%H.length;showFeatured()}},{passive:true});
listen(document,"click",e=>{var t=e.target.closest("[data-a]");if(!t)return;var a=t.dataset.a,i=+t.dataset.i,v=t.dataset.v;
 if(a=="fav"){e.preventDefault();e.stopPropagation();var k=S.fav.indexOf(i),active=k<0;if(active)S.fav.push(i);else S.fav.splice(k,1);sv();document.querySelectorAll('[data-a="fav"][data-i="'+i+'"]').forEach(b=>{b.classList.toggle("active",active);b.classList.toggle("is-favorite",active);b.setAttribute("aria-pressed",String(active));b.setAttribute("aria-label",active?"Убрать из избранного":"Добавить в избранное");if(b.classList.contains("title-fav-btn"))b.innerHTML=active?"♥ В избранном":"♡ В избранное";else b.textContent=active?"♥":"♡"});toast(active?"Добавлено в избранное":"Убрано из избранного")}
 else if(a=="desc"){var p=$("#td"),open=t.getAttribute("aria-expanded")==="true";if(p){p.classList.toggle("collapsed",open);t.setAttribute("aria-expanded",String(!open));t.textContent=open?"Читать полностью":"Свернуть"}}
 else if(a=="rate"){S.rate[i]=+v;sv();draw()}
 else if(a=="random"){if(location.hash!=="#random")location.hash="random";else xrandom()}
 else if(a=="g"){F.g=v;if(location.hash!=="#catalog")location.hash="catalog";else draw()}
 else if(a=="list-filter"){F.listStatus=v;V.mylist()}
 else if(a=="slide"&&H.length>1){featuredIndex=(featuredIndex+(+v)+H.length)%H.length;showFeatured()}
 else if(a=="slide-to"&&H.length>1){featuredIndex=(+v)%H.length;showFeatured()}
 else if(a=="pp"&&P){P.on=!P.on;tick(0);pauseSave()}
 else if(a=="sp"&&P){var s=[1,1.25,1.5,2];P.sp=s[(s.indexOf(P.sp)+1)%4];t.textContent=P.sp+"×"}
 else if(a=="seek"&&P){var r=t.getBoundingClientRect();P.t=Math.round((e.clientX-r.left)/r.width*DUR);tick(0)}
 else if(a=="room"){S.room=Math.random().toString(36).slice(2,7).toUpperCase();sv();toast("Комната создана: "+S.room);draw()}
 else if(a=="room-leave"){S.room="";sv();toast("Вы вышли из комнаты");draw()}
 else if(a=="acc"){S.acc=v;sv();hd()}
 else if(a=="export"){exportBackup()}else if(a=="import"){var fileInput=$("#backup-file");if(fileInput)fileInput.click()}else if(a=="reset"){S={};df();sv();toast("Данные сброшены");draw()}else if(a=="reload"){location.reload()}});
listen(document,"submit",e=>{e.preventDefault();var f=e.target.id;
 if(f=="profile-form"){var name=$("#nm").value.trim();if(name){S.name=name;sv();hd();toast("Ник сохранён");V.profile()}}
 if(f=="cf"){var v=$("#ci").value.trim();if(!v)return;msg(S.name||"Вы",v);$("#ci").value=""}
 if(f=="jf"){var c=$("#jc").value.trim().toUpperCase();if(!c)return;S.room=c;sv();toast("Вы в комнате "+c);location.hash="watch-"+D[0].id+"-1"}});
listen(document,"input",e=>{var i=e.target.id;
 if(i=="q"){F.q=e.target.value.trim().toLowerCase();if(location.hash!=="#catalog")location.hash="catalog";else rc()}
 if(i=="nm"){S.name=e.target.value.trim()||"Гость";sv();hd()}});
listen(document,"change",e=>{if(e.target.id==="backup-file"){var selected=e.target.files&&e.target.files[0];importBackup(selected);e.target.value="";return}if(e.target.id=="so"){F.s=e.target.value;rc()}if(e.target.id=="status-filter"){F.status=e.target.value;rc()}if(e.target.id=="anime-list-status"){var id=+e.target.dataset.id,value=e.target.value;if(value)S.watchlist[id]=value;else delete S.watchlist[id];sv();toast(value?"Статус сохранён":"Удалено из списка")}});
listen(window,"keydown",e=>{if(!P||/INPUT|SELECT/.test(e.target.tagName))return;
 if(e.code=="Space"){e.preventDefault();P.on=!P.on;tick(0);pauseSave()}else if(e.code=="ArrowRight")tick(10);else if(e.code=="ArrowLeft"){P.t=Math.max(0,P.t-10);tick(0)}});
listen(document,"input",e=>{if(e.target.id!=="cs")return;xCF.q=e.target.value;F.q=xCF.q;var hq=$("#q");if(hq)hq.value=xCF.q;clearTimeout(xCF.h);xCF.h=setTimeout(()=>xcq(true),450)});
 listen(document,"change",e=>{var map={"cf-g":"g","cf-y":"y","cf-season":"season","cf-st":"st","cf-f":"f","cf-r":"minScore","cf-o":"o"};if(map[e.target.id]){xCF[map[e.target.id]]=e.target.value;xcq(true)}});
 listen(document,"click",e=>{if(e.target.closest("[data-xr]")){xcq(false);return}if(e.target.closest("[data-cf-reset]")){xCF.g="";xCF.y="";xCF.season="";xCF.st="";xCF.f="";xCF.o="POPULARITY_DESC";xCF.minScore="";xCF.q="";F.q="";F.g="";["cs","cf-g","cf-y","cf-season","cf-st","cf-f","cf-r","cf-o"].forEach(id=>{var el=$("#"+id);if(el)el.value=id==="cf-o"?"POPULARITY_DESC":""});var hq=$("#q");if(hq)hq.value="";xcq(true)}});
 addEventListener("hashchange",()=>{draw();scrollTo(0,0)});
idx();boot();
})();