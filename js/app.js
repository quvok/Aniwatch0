(function(){
var DUR=1420,GN=["Фэнтези","Экшен","Приключения","Романтика","Sci-Fi","Комедия","Детектив","Драма"],
BOT=["Ха, согласен!","Отличная серия","Сейчас будет самое интересное","🔥🔥🔥","Кто-нибудь догадался, кто предатель?"];
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
var localDB=null,localDBReady=null;
function openLocalDB(){
 if(localDBReady)return localDBReady;
 localDBReady=new Promise((resolve)=>{
  if(!window.indexedDB){resolve(null);return}
  var req=indexedDB.open("AniWatchLocal",1);
  req.onupgradeneeded=()=>{var db=req.result;if(!db.objectStoreNames.contains("state"))db.createObjectStore("state")};
  req.onsuccess=()=>{localDB=req.result;resolve(localDB)};
  req.onerror=()=>resolve(null);
 });
 return localDBReady;
}
async function initLocalDB(){
 var db=await openLocalDB();if(!db)return;
 try{
  var saved=await new Promise((resolve,reject)=>{var tx=db.transaction("state","readonly"),r=tx.objectStore("state").get("app");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  if(saved&&typeof saved==="object"){S=saved;df()}
  else{df();await new Promise((resolve,reject)=>{var tx=db.transaction("state","readwrite");tx.objectStore("state").put(S,"app");tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
 }catch(e){console.warn("[AniWatch] Local database read failed",e)}
}

var $=s=>document.querySelector(s),app=$("#app"),S=ld(),F={g:"",s:"r",q:"",status:""},T=[],P=null,AP=false,V={};
function ld(){try{return JSON.parse(localStorage.getItem("aw"))||{}}catch(e){return{}}}
function sv(){
 try{localStorage.setItem("aw",JSON.stringify(S))}catch(e){}
 openLocalDB().then(db=>{if(!db)return;try{var tx=db.transaction("state","readwrite");tx.objectStore("state").put(S,"app")}catch(e){console.warn("[AniWatch] Local database write failed",e)}});
}
function df(){S.fav=S.fav||[];S.hist=S.hist||{};S.rate=S.rate||{};S.watchlist=S.watchlist||{};S.name=S.name||"Гость";S.acc=S.acc||"#8b5cf6"}
df();
var LISTS=[["watching","Смотрю"],["planned","Запланировано"],["completed","Просмотрено"],["dropped","Брошено"]];
var esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
var gr=d=>"linear-gradient(160deg,"+d.c[0]+","+d.c[1]+")";
var bg=d=>(d.img?"url('"+d.img+"') center/cover no-repeat,":"")+gr(d);
var bn=d=>"linear-gradient(0deg,#000 5%,transparent 70%),"+(d.ban?"url('"+d.ban+"') center/cover no-repeat,":"")+gr(d);
var fm=t=>{t=Math.floor(t);return(t/60|0)+":"+("0"+t%60).slice(-2)};
var srt=k=>D.slice().sort((a,b)=>k=="n"?a.n.localeCompare(b.n):b[k]-a[k]);
function card(d,pr,href){
 var score=Number(d.r||0),status=d.s||"Аниме",fav=S.fav.includes(d.id);
 return '<a class="card" href="'+(href||"#title-"+d.id)+'"><div class="poster" style="background:'+bg(d)+'">'+(d.img?"":"<i>"+d.n[0]+"</i>")+'<span class="rating">★ '+(score?score.toFixed(1):"—")+'</span><em class="poster-status">'+status+'</em><button type="button" class="poster-fav'+(fav?" active":"")+'" data-a="fav" data-i="'+d.id+'" aria-label="'+(fav?"Убрать из избранного":"Добавить в избранное")+'" aria-pressed="'+fav+'">'+(fav?"♥":"♡")+'</button>'+(pr!=null?'<u style="width:'+pr+'%"></u>':"")+'</div><b>'+d.n+'</b><small>'+d.g.slice(0,2).join(" · ")+" · "+d.y+'</small></a>'
}
var row=(t,a,sub)=>'<section class="shelf"><div class="shelf-head"><div><h2>'+t+'</h2>'+(sub?'<p class="shelf-sub">'+sub+'</p>':"")+'</div></div><div class="row">'+a.join("")+'</div></section>';
var epLabel=d=>d.e>0?d.e+" серий":d.ae>0?"Вышло "+d.ae+" серий":"Количество серий уточняется";
var epTotal=d=>d.e>0?d.e:(d.ae>0?d.ae:0);
var eps=(d,cur)=>epTotal(d)>0?Array.from({length:epTotal(d)},(_,k)=>'<a href="#watch-'+d.id+'-'+(k+1)+'" class="'+(k+1==cur?"on":"")+'">'+(k+1)+'</a>').join(""):'<p class="m">Количество серий пока не указано источниками.</p>';
function toast(m){var t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),2000)}
function cleanDesc(v){return String(v||"").replace(/<[^>]*>/g," ").replace(/\[\/?[a-z][a-z0-9_]*(?:=[^\]]*)?\]/gi,"").replace(/\[\[|\]\]/g,"").replace(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff々〆ヵヶ]+/g," ").replace(/\s+/g," ").trim()}
function shortDesc(v,n){var s=cleanDesc(v);if(s.length<=n)return s;var cut=s.slice(0,n);return cut.slice(0,cut.lastIndexOf(" "))+"…"}

var featuredIndex=0;
function featured(){var d=H[featuredIndex%H.length]||D[0];ru(d);var rd=shortDesc((S.ru&&S.ru[d.id]&&S.ru[d.id].d)||d.d,190);return '<section class="hero hero-editorial" style="background:'+bn(d)+'"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> В центре внимания</div><small>'+d.g.slice(0,3).join(" · ")+' <i>•</i> '+d.y+' <i>•</i> '+(d.s||"Аниме")+'</small><h1>'+d.n+'</h1><p id="featured-desc" data-id="'+d.id+'">'+rd+'</p><div class="hero-facts"><span>★ '+(d.r?Number(d.r).toFixed(1):"—")+'</span><span id="featured-count" data-id="'+d.id+'">'+epLabel(d)+'</span></div><div class="acts"><a class="btn" href="#watch-'+d.id+'-1">▶ Смотреть</a><a class="btn ghost" href="#title-'+d.id+'">Подробнее</a></div></div><div class="hero-poster" style="background:'+bg(d)+'">'+(d.img?"":"<b>"+d.n[0]+"</b>")+'<span>ANIWATCH PICK</span></div>'+(H.length>1?'<button class="hero-arrow hero-prev" data-a="slide" data-v="-1" aria-label="Предыдущий баннер">‹</button><button class="hero-arrow hero-next" data-a="slide" data-v="1" aria-label="Следующий баннер">›</button><div class="hero-dots">'+H.map((x,i)=>'<button data-a="slide-to" data-v="'+i+'" class="'+(i===featuredIndex%H.length?"on":"") +'" aria-label="Баннер '+(i+1)+'"></button>').join("")+'</div>':"")+'</section>'}
function showFeatured(){var hw=$("#hw");if(hw)hw.innerHTML=featured()}
V.home=()=>{featuredIndex=0;
 var cont=Object.keys(S.hist).filter(k=>M[k]).sort((a,b)=>S.hist[b].at-S.hist[a].at).slice(0,6).map(k=>card(M[k],Math.round(S.hist[k].t/DUR*100),"#watch-"+k+"-"+S.hist[k].ep));
 var trending=srt("r").slice(0,8).map(d=>card(d));
 var ongoing=D.filter(d=>/Онгоинг|RELEASING/i.test(d.s||"")).sort((a,b)=>b.y-a.y).slice(0,8).map(d=>card(d));
 var recent=srt("y").slice(0,8).map(d=>card(d));
 var genres=GN.slice(0,6).map(g=>'<a class="genre-tile" href="#catalog" data-a="g" data-v="'+g+'"><span>'+g+'</span><b>Смотреть подборку <i>↗</i></b></a>').join("");
 app.innerHTML='<div id="hw">'+featured()+'</div><div class="quick-stats"><div><b>'+D.length+'</b><span>тайтлов в подборке</span></div><div><b>'+D.filter(d=>/Онгоинг/i.test(d.s||"")).length+'</b><span>выходят сейчас</span></div><div><b>24/7</b><span>аниме-настроение</span></div></div>'+(cont.length?row("Продолжить просмотр",cont,"Вернись к серии, на которой остановился"):"")+row("Сейчас в топе",trending,"Популярные тайтлы по оценкам")+(ongoing.length?row("Онгоинги",ongoing,"Истории, которые продолжаются прямо сейчас"):"")+row("Недавно добавлено",recent,"Свежие и актуальные тайтлы")+'<section class="genre-section"><div class="shelf-head"><div><h2>Найди своё настроение</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="#catalog" class="text-link">Весь каталог ↗</a></div><div class="genre-grid">'+genres+'</div></section>';
 if(H.length>1)T.push(setInterval(()=>{featuredIndex=(featuredIndex+1)%H.length;showFeatured()},7000))
};

function rc(){var a=srt(F.s).filter(d=>(!F.g||d.g.includes(F.g))&&(!F.status||d.s===F.status)&&(!F.q||(d.n+(d.o||"")+d.g.join()).toLowerCase().includes(F.q)));$("#cr").innerHTML=a.length?a.map(d=>card(d)).join(""):'<p class="empty">Ничего не найдено</p>';var count=$("#result-count");if(count)count.textContent="Найдено: "+a.length}
V.catalog=()=>{var statuses=[...new Set(D.map(d=>d.s).filter(Boolean))];app.innerHTML='<div class="catalog-heading"><div><div class="eyebrow">Открой следующую историю</div><h1>Каталог аниме</h1><p>Подборка тайтлов, которые хочется посмотреть дальше.</p></div><div class="catalog-count"><b>'+D.length+'</b><span>тайтлов</span></div></div><div class="catalog-tools"><div class="chips">'+["",...GN].map(g=>'<button class="'+(F.g==g?"on":"")+'" data-a="g" data-v="'+g+'">'+(g||"Все жанры")+'</button>').join("")+'</div><div class="catalog-selects"><label>Статус<select id="status-filter"><option value="">Любой статус</option>'+statuses.map(s=>'<option value="'+s+'"'+(F.status===s?" selected":"")+'>'+s+'</option>').join("")+'</select></label><label>Сортировка<select id="so">'+[["r","По рейтингу"],["y","По году"],["n","По названию"]].map(o=>'<option value="'+o[0]+'"'+(F.s==o[0]?" selected":"")+'>'+o[1]+'</option>').join("")+'</select></label></div></div><div class="results-line"><b id="result-count"></b><span>Данные каталога AniList</span></div><div class="row" id="cr"></div>';rc()};

V.title=p=>{var d=M[p[0]];if(!d)return V.home();var f=S.fav.includes(d.id),h=S.hist[d.id],r=S.rate[d.id]||0,desc=cleanDesc(d.d),count=d.e>0?d.e+" эпизодов":"Количество серий уточняется";
 app.innerHTML='<section class="title-page"><div class="title-backdrop" style="background:'+bn(d)+'"></div><div class="title-layout"><div class="title-cover"><div class="poster big" style="background:'+bg(d)+'">'+(d.img?"":"<i>"+d.n[0]+"</i>")+'</div><span class="cover-caption">ANIME DETAILS</span></div><div class="title-info"><div class="title-kicker"><span class="live-dot"></span> ИНФОРМАЦИЯ ОБ АНИМЕ</div><h1 id="tn">'+d.n+'</h1><p class="title-original">'+(d.o||"")+'</p><div class="title-tags">'+d.g.map(g=>'<span>'+g+'</span>').join("")+'</div><div class="title-metrics"><div><b>★ '+(d.r?Number(d.r).toFixed(1):"—")+'</b><small>РЕЙТИНГ</small></div><div><b>'+d.y+'</b><small>ГОД</small></div><div><b>'+count+'</b><small>ЭПИЗОДЫ</small></div><div><b>'+(d.s||"Аниме")+'</b><small>СТАТУС</small></div></div><div class="title-description"><p id="td" class="desc-text'+(desc.length>260?" collapsed":"")+'">'+esc(desc)+'</p>'+(desc.length>260?'<button class="desc-toggle" type="button" data-a="desc" aria-expanded="false">Читать полностью <span>⌄</span></button>':"")+'</div><div class="title-list-status"><label for="anime-list-status">Мой статус</label><select id="anime-list-status" data-id="'+d.id+'"><option value="">Не добавлено</option>'+LISTS.map(x=>'<option value="'+x[0]+'"'+(S.watchlist[d.id]===x[0]?" selected":"")+'>'+x[1]+'</option>').join("")+'</select></div><div class="title-actions"><a class="btn" href="#watch-'+d.id+'-'+(h?h.ep:1)+'">▶ '+(h?"Продолжить, серия "+h.ep:"Начать просмотр")+'</a><button class="btn ghost title-fav-btn'+(f?" is-favorite":"")+'" data-a="fav" data-i="'+d.id+'" aria-pressed="'+f+'">'+(f?"♥ В избранном":"♡ В избранное")+'</button></div><div class="title-rating"><span>Ваша оценка</span>'+[1,2,3,4,5].map(v=>'<button class="st'+(v<=r?" on":"")+'" data-a="rate" data-i="'+d.id+'" data-v="'+v+'">★</button>').join("")+'</div></div></div></section><section class="title-episodes"><div class="title-section-head"><div><span class="title-kicker">ПРОСМОТР</span><h2>Список серий</h2></div><span class="episode-count">'+(d.e>0?d.e+" серий":"Серии")+'</span></div><div class="eps">'+eps(d,0)+'</div></section><div id="related-anime" class="related-loading"><section class="shelf"><div class="shelf-head"><div><h2>Связанные аниме</h2><p class="shelf-sub">Продолжения, приквелы и дополнительные истории</p></div></div><p class="related-state">Загружаем связи…</p></section><section class="shelf"><div class="shelf-head"><div><h2>Похожие аниме</h2><p class="shelf-sub">Рекомендации по этому тайтлу</p></div></div><p class="related-state">Подбираем похожие тайтлы…</p></section></div>';ru(d);loadRelated(d)};

function tick(s){if(!P)return;P.t=Math.min(DUR,P.t+s);if(P.t>=DUR){P.on=false;return nextEp()}
 $("#tc").textContent=fm(P.t);$("#pg").style.width=P.t/DUR*100+"%";$(".play").textContent=P.on?"❚❚":"▶";if(s){S.hist[P.d.id]={ep:P.n,t:P.t,at:Date.now()};sv()}}
function nextEp(){var d=P.d,n=P.n;if(n<d.e){S.hist[d.id]={ep:n+1,t:0,at:Date.now()};sv();AP=true;toast("Следующая серия");location.hash="watch-"+d.id+"-"+(n+1)}else{delete S.hist[d.id];sv();toast("Тайтл досмотрен 🎉");$(".play").textContent="▶"}}
V.watch=p=>{var d=M[p[0]];if(!d)return V.home();var n=Math.max(p[1]||1,1),h=S.hist[d.id];if(d.e>0)n=Math.min(n,d.e);P={d:d,n:n,t:h&&h.ep==n?h.t:0,on:AP,sp:1};AP=false;
 app.innerHTML='<div class="watch"><div><div class="player" style="background:'+bn(d)+'"><div class="shade"></div><button class="play" data-a="pp">▶</button><b class="cap">'+d.n+' · серия '+n+'</b><div class="ctl"><span id="tc"></span><div class="bar" data-a="seek"><i id="pg"></i></div><span>'+fm(DUR)+'</span><button data-a="sp" id="sp">1×</button></div></div><div class="nv">'+(n>1?'<a class="btn ghost" href="#watch-'+d.id+'-'+(n-1)+'">← Пред.</a>':"")+'<a class="btn ghost" href="#title-'+d.id+'">О тайтле</a>'+(n<d.e?'<a class="btn" href="#watch-'+d.id+'-'+(n+1)+'">След. →</a>':"")+'</div><p class="m" style="margin-top:8px">Пробел — пауза, ←/→ — перемотка на 10 с. Это демо-плеер: замените заглушку на свой видеоисточник.</p><div class="eps">'+eps(d,n)+'</div></div><div class="chat"><h3>Чат'+(S.room?" · комната "+S.room:"")+'</h3><div id="ms"><div><em>Аки</em>Всем привет!</div><div><em>Рэн</em>Погнали 🍿</div></div><form id="cf"><input id="ci" placeholder="Сообщение…" autocomplete="off"><button>➤</button></form></div></div>';
 tick(0);T.push(setInterval(()=>{if(P&&P.on)tick(P.sp)},1000))};

V.together=()=>{app.innerHTML='<h2>Смотреть вместе</h2><div class="panel"><p>Создайте комнату и отправьте код друзьям — чат откроется рядом с плеером. Синхронизация между устройствами требует сервера (см. README), сейчас комната работает локально.</p><div class="acts"><button class="btn" data-a="room">Создать комнату</button><form id="jf" class="inl"><input id="jc" placeholder="Код комнаты" maxlength="6"><button class="btn ghost">Войти</button></form></div>'+(S.room?'<p class="m">Текущая комната: <b>'+S.room+'</b></p>':"")+'</div>'+row("Что смотрим?",D.slice(0,6).map(d=>card(d)))};
V.favorites=()=>{var a=S.fav.filter(i=>M[i]).map(i=>card(M[i]));app.innerHTML='<h2>Избранное</h2>'+(a.length?'<div class="row">'+a.join("")+'</div>':'<p class="empty">Пока пусто. Нажмите «♡ В избранное» на странице тайтла.</p>')};
V.mylist=()=>{var key=F.listStatus||"all",items=S.watchlist||{},ids=Object.keys(items).filter(id=>key==="all"||items[id]===key).map(Number).filter(id=>M[id]).sort((a,b)=>M[a].n.localeCompare(M[b].n));app.innerHTML='<div class="list-heading"><div><div class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div><h1>Мои списки</h1><p>Отмечай просмотренное и планируй, что посмотреть дальше.</p></div><b>'+ids.length+'</b></div><div class="list-chips">'+[["all","Все"],...LISTS].map(x=>'<button type="button" data-a="list-filter" data-v="'+x[0]+'" class="'+(key===x[0]?"on":"")+'">'+x[1]+'</button>').join("")+'</div><div class="list-results">'+(ids.length?'<div class="row">'+ids.map(id=>card(M[id])).join("")+'</div>':'<p class="empty">В этом списке пока пусто. Открой страницу любого аниме и выбери статус.</p>')+'</div>'};
V.profile=()=>{app.innerHTML='<h2>Локальный профиль</h2><div class="panel account-panel"><div class="account-head"><div class="account-avatar">'+esc((S.name||"Гость").slice(0,1).toUpperCase())+'</div><div><b>'+esc(S.name||"Гость")+'</b><p class="m">Данные хранятся в этом браузере</p></div></div><form id="profile-form" class="auth-form"><label>Ник<input id="nm" value="'+esc(S.name||"Гость")+'" maxlength="20" required></label><button class="btn" type="submit">Сохранить ник</button></form><p class="m">Избранное: '+S.fav.length+' · История: '+Object.keys(S.hist).length+' · Оценки: '+Object.keys(S.rate).length+'</p><p class="m">Пока данные доступны только на этом устройстве. При переносе на сервер добавим регистрацию и синхронизацию.</p><button class="btn ghost" data-a="reset" style="justify-self:start">Сбросить локальные данные</button></div>'};
// ---- Реальные данные: AniList (постеры, баннеры, описания) + Shikimori (русские названия и описания) ----
var Q="query{Page(perPage:30){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){id idMal title{romaji english}genres seasonYear startDate{year}averageScore episodes status description(asHtml:false)coverImage{extraLarge color}bannerImage}}}";
var GR={Action:"Экшен",Adventure:"Приключения",Comedy:"Комедия",Drama:"Драма",Fantasy:"Фэнтези",Romance:"Романтика",Mystery:"Детектив","Slice of Life":"Повседневность",Supernatural:"Сверхъестественное",Sports:"Спорт",Horror:"Ужасы",Mecha:"Меха",Music:"Музыка",Psychological:"Психология",Thriller:"Триллер"};
var ST={RELEASING:"Онгоинг",FINISHED:"Завершён",NOT_YET_RELEASED:"Скоро",CANCELLED:"Отменён",HIATUS:"Пауза"};
function mp(m){return{id:m.id,mal:m.idMal,n:esc(m.title.english||m.title.romaji),g:(m.genres.length?m.genres:["Аниме"]).map(g=>GR[g]||g),y:m.seasonYear||(m.startDate&&m.startDate.year)||new Date().getFullYear(),r:m.averageScore?m.averageScore/10:0,e:Number(m.episodes)||0,s:ST[m.status]||"",d:esc((m.description||"Описание отсутствует.").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()),c:[m.coverImage.color||"#7c3aed","#0f0f1a"],img:m.coverImage.extraLarge,ban:m.bannerImage}}
function idx(){M={};D.forEach(d=>M[d.id]=d);var c={};D.forEach(d=>d.g.forEach(g=>c[g]=(c[g]||0)+1));GN=Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,10);H=D.filter(d=>d.ban).slice(0,3);if(H.length<3)H=D.slice(0,3)}
var aniCountPending={};
function normTitle(v){return String(v||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/ё/g,"е").replace(/[^a-zа-я0-9]/gi,"")}
async function anilibriaCount(d){
 var cache=S.aniEpisodes=S.aniEpisodes||{},saved=cache[d.id];
 if(saved&&Date.now()-saved.at<30*864e5){d.e=Number(saved.total)||d.e;d.ae=Number(saved.available)||0;refreshEpCount(d);return}
 if(aniCountPending[d.id])return aniCountPending[d.id];
 aniCountPending[d.id]=(async()=>{
  var names=[d.n,d.o].filter(Boolean),match=null;
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
   var data=await res.json(),total=Number(data.episodeCount)||0,episodes=data.episodes||{},available=Object.keys(episodes).filter(k=>/^\\d+$/.test(k)).length;
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
async function verifyOnePiece(){
 var d=D.find(x=>Number(x.mal)===21);
 try{
  var q=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:"query{Media(idMal:21,type:ANIME){id idMal title{romaji english}episodes status genres seasonYear averageScore description coverImage{extraLarge color} bannerImage}}"})});
  if(q.ok){var j=await q.json(),m=j.data&&j.data.Media;if(m&&!d){d=mp(m);D.unshift(d);M[d.id]=d;idx();}else if(m&&d&&!d.e&&Number(m.episodes)>0)d.e=Number(m.episodes);}
 }catch(e){}
 if(!d)d={id:"one-piece-check",mal:21,n:"One Piece",e:0};
 var a=await jikanCount(d,true),z=await aniZipCount(d),k=await kitsuCount(d);
 console.info("[AniWatch] One Piece check:",{foundInCatalog:!!M[d.id],episodesAniList:d.e||0,jikan:a||0,aniZip:z||0,kitsu:k||0});
 if(M[d.id]){refreshEpCount(d);if(location.hash==="#home")draw()}
}

var relatedPending={};
var relationNames={SEQUEL:"Продолжение",PREQUEL:"Приквел",SIDE_STORY:"Побочная история",PARENT_STORY:"Основная история",ALTERNATIVE:"Альтернативная версия",ALTERNATIVE_SETTING:"Альтернативный сюжет",SPIN_OFF:"Спин-офф",SUMMARY:"Пересказ",FULL_STORY:"Полная версия",CHARACTER:"Связанные персонажи",OTHER:"Связанный тайтл",SOURCE:"Первоисточник",COMPILATION:"Сборник"};
var relatedFields="id idMal type format title{romaji english}genres seasonYear startDate{year}averageScore episodes status description(asHtml:false)coverImage{extraLarge color} bannerImage";
function relatedCards(list){return list.map(x=>card(x)).join("")}
async function translateRelated(list){
 var ids=list.map(x=>x.mal).filter(Boolean);
 if(!ids.length)return;
 try{
  var r=await fetch("https://shikimori.io/api/animes?limit=50&ids="+ids.join(","));
  if(!r.ok)return;
  var a=await r.json(),by={};a.forEach(x=>by[x.id]=x.russian||"");
  list.forEach(x=>{if(by[x.mal]){x.o=x.n;x.n=esc(by[x.mal])}});
 }catch(e){}
}
async function loadRelated(d){
 var root=$("#related-anime");if(!root)return;
 var cached=S.relatedAnime=S.relatedAnime||{},saved=cached[d.id];
 if(saved&&saved.v===4&&Date.now()-saved.at<7*864e5){renderRelated(d,saved);return}
 if(relatedPending[d.id])return relatedPending[d.id];
 relatedPending[d.id]=(async()=>{
  try{
   var query="query($id:Int){Media(id:$id,type:ANIME){relations{edges{relationType node{"+relatedFields+"}}} recommendations(perPage:12,sort:RATING_DESC){nodes{mediaRecommendation{"+relatedFields+"}}} staff(sort:RELEVANCE,perPage:10){edges{role node{id name{full} staffMedia(type:ANIME,sort:POPULARITY_DESC,perPage:30){nodes{"+relatedFields+"}}}}}}}";
   var res=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:query,variables:{id:Number(d.id)}})});
   if(!res.ok)throw new Error("AniList response");
   var payload=await res.json(),media=payload.data&&payload.data.Media;
   if(!media)throw new Error("No related data");
   var relSeen={},relations=(media.relations&&media.relations.edges||[]).filter(e=>e.node&&e.node.type==="ANIME"&&e.node.format!=="MUSIC"&&e.relationType!=="CHARACTER"&&e.node.id!==d.id).map(e=>({type:e.relationType,anime:mp(e.node)})).filter(e=>{if(relSeen[e.anime.id])return false;relSeen[e.anime.id]=true;return true;});
   var recSeen={},recommendations=(media.recommendations&&media.recommendations.nodes||[]).map(x=>x.mediaRecommendation).filter(x=>x&&x.type==="ANIME"&&x.format!=="MUSIC").filter(x=>x.id!==d.id&&!relSeen[x.id]&&!recSeen[x.id]&&(recSeen[x.id]=true)).map(mp).slice(0,8);
   var creatorEdges=(media.staff&&media.staff.edges||[]).filter(e=>e.node&&/original creator|原作|原案/i.test(e.role||""));
   var creatorName=creatorEdges.length&&creatorEdges[0].node.name?creatorEdges[0].node.name.full:"";
   var creatorSeen={},creatorWorks=[];
   creatorEdges.forEach(e=>(e.node.staffMedia&&e.node.staffMedia.nodes||[]).forEach(m=>{if(m&&m.type==="ANIME"&&m.format!=="MUSIC"&&m.id!==d.id&&!relSeen[m.id]&&!recSeen[m.id]&&!creatorSeen[m.id]){creatorSeen[m.id]=true;creatorWorks.push(mp(m))}}));
   creatorWorks=creatorWorks.slice(0,12);
   var all=relations.map(x=>x.anime).concat(recommendations,creatorWorks);
   await translateRelated(all);
   var data={v:4,relations:relations,recommendations:recommendations,creatorName:creatorName,creatorWorks:creatorWorks,at:Date.now()};
   cached[d.id]=data;sv();renderRelated(d,data);
  }catch(e){
   var el=$("#related-anime");if(el&&location.hash==="#title-"+d.id)el.innerHTML='<section class="shelf"><h2>Связанные аниме</h2><p class="related-state">Не удалось загрузить связи. Попробуйте обновить страницу.</p></section>';
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
 if(et&&et.dataset.id==d.id)et.textContent=epLabel(d);
}
async function ru(d){anilibriaCount(d);if(!d.mal)return;var c=S.ru=S.ru||{},r=c[d.id];
  if(!r||(!d.e&&!r.e)){try{var j=await(await fetch("https://shikimori.io/api/animes/"+d.mal)).json();r=c[d.id]=Object.assign(r||{},{n:j.russian||((r&&r.n)||""),d:j.description||((r&&r.d)||""),e:Number(j.episodes)||0});sv()}catch(e){if(!r)return}}
  if(!d.e&&r.e>0)d.e=r.e;
  if(!d.e)await jikanCount(d,false);
  if(!d.e||!d.ae)await aniZipCount(d);
  if(!d.e||!d.ae||Number(d.mal)===21)await kitsuCount(d);
  refreshEpCount(d)
  r.d=cleanDesc(r.d);
  if(location.hash=="#title-"+d.id){var h=$("#tn"),p=$("#td");if(h&&r.n)h.textContent=r.n;if(p&&r.d)p.textContent=r.d}
  var fp=$("#featured-desc");if(fp&&fp.dataset.id==d.id&&r.d)fp.textContent=shortDesc(r.d,190)}
// Русские названия одним запросом к Shikimori (id там совпадают с MAL), кэш в localStorage
async function rn(){var m=D.filter(d=>d.mal),c;try{c=JSON.parse(localStorage.getItem("awr")||"{}")}catch(e){c={}}
 var need=m.filter(d=>!(d.mal in c));
 if(need.length){try{var ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),5000),
  r=await fetch("https://shikimori.io/api/animes?limit=50&ids="+need.map(d=>d.mal).join(),{signal:ctl.signal});clearTimeout(tm);
  (await r.json()).forEach(x=>c[x.id]=x.russian||"");need.forEach(d=>{if(!(d.mal in c))c[d.mal]=""});
  try{localStorage.setItem("awr",JSON.stringify(c))}catch(e){}}catch(e){}}
 m.forEach(d=>{if(c[d.mal]){d.o=d.n;d.n=esc(c[d.mal])}})}
async function boot(){await initLocalDB();app.innerHTML='<p class="empty">Загрузка…</p>';var c;
 try{c=JSON.parse(localStorage.getItem("awc")||"null")}catch(e){}
 if(!c||!c.a||c.a.length>30||Date.now()-c.t>216e5){try{var ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),6000),
  r=await fetch("https://graphql.anilist.co",{method:"POST",signal:ctl.signal,headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:Q})});
  clearTimeout(tm);var j=await r.json();c={t:Date.now(),a:j.data.Page.media.map(mp)};try{localStorage.setItem("awc",JSON.stringify(c))}catch(e){}}catch(e){}}
 if(c&&c.a&&c.a.length)D=c.a;await rn();idx();draw();verifyOnePiece()}

function hd(){var b=location.hash.slice(1).split("-")[0]||"home",a=$(".av");a.textContent=(S.name||"Г")[0].toUpperCase();document.documentElement.style.setProperty("--ac",S.acc);document.querySelectorAll("nav a").forEach(x=>x.classList.toggle("on",x.getAttribute("href")=="#"+b))}
function draw(){T.forEach(clearInterval);T=[];P=null;var p=location.hash.slice(1).split("-");(V[p[0]]||V.home)(p.slice(1).map(Number));hd()}
function msg(a,t){var m=$("#ms");if(!m)return;var d=document.createElement("div"),e=document.createElement("em");e.textContent=a;d.append(e,t);m.append(d);m.scrollTop=1e5}

var heroTouch=null;document.addEventListener("touchstart",e=>{var h=e.target.closest("#hw .hero-editorial");if(!h||e.touches.length!==1)return;heroTouch={x:e.touches[0].clientX,y:e.touches[0].clientY}},{passive:true});document.addEventListener("touchend",e=>{if(!heroTouch)return;var p=heroTouch;heroTouch=null;if(!e.changedTouches.length||H.length<2)return;var dx=e.changedTouches[0].clientX-p.x,dy=e.changedTouches[0].clientY-p.y;if(Math.abs(dx)>48&&Math.abs(dx)>Math.abs(dy)*1.25){featuredIndex=(featuredIndex+(dx<0?1:-1)+H.length)%H.length;showFeatured()}},{passive:true});
document.addEventListener("click",e=>{var t=e.target.closest("[data-a]");if(!t)return;var a=t.dataset.a,i=+t.dataset.i,v=t.dataset.v;
 if(a=="fav"){e.preventDefault();e.stopPropagation();var k=S.fav.indexOf(i),active=k<0;if(active)S.fav.push(i);else S.fav.splice(k,1);sv();document.querySelectorAll('[data-a="fav"][data-i="'+i+'"]').forEach(b=>{b.classList.toggle("active",active);b.classList.toggle("is-favorite",active);b.setAttribute("aria-pressed",String(active));b.setAttribute("aria-label",active?"Убрать из избранного":"Добавить в избранное");if(b.classList.contains("title-fav-btn"))b.innerHTML=active?"♥ В избранном":"♡ В избранное";else b.textContent=active?"♥":"♡"});toast(active?"Добавлено в избранное":"Убрано из избранного")}
 else if(a=="desc"){var p=$("#td"),open=t.getAttribute("aria-expanded")==="true";if(p){p.classList.toggle("collapsed",open);t.setAttribute("aria-expanded",String(!open));t.textContent=open?"Читать полностью":"Свернуть"}}
 else if(a=="rate"){S.rate[i]=+v;sv();draw()}
 else if(a=="g"){F.g=v;draw()}
 else if(a=="list-filter"){F.listStatus=v;V.mylist()}
 else if(a=="slide"&&H.length>1){featuredIndex=(featuredIndex+(+v)+H.length)%H.length;showFeatured()}
 else if(a=="slide-to"&&H.length>1){featuredIndex=(+v)%H.length;showFeatured()}
 else if(a=="pp"&&P){P.on=!P.on;tick(0)}
 else if(a=="sp"&&P){var s=[1,1.25,1.5,2];P.sp=s[(s.indexOf(P.sp)+1)%4];t.textContent=P.sp+"×"}
 else if(a=="seek"&&P){var r=t.getBoundingClientRect();P.t=Math.round((e.clientX-r.left)/r.width*DUR);tick(0)}
 else if(a=="room"){S.room=Math.random().toString(36).slice(2,7).toUpperCase();sv();toast("Комната создана: "+S.room);draw()}
 else if(a=="acc"){S.acc=v;sv();hd()}
 else if(a=="reset"){S={};df();sv();toast("Данные сброшены");draw()}});
document.addEventListener("submit",e=>{e.preventDefault();var f=e.target.id;
 if(f=="profile-form"){var name=$("#nm").value.trim();if(name){S.name=name;sv();hd();toast("Ник сохранён");V.profile()}}
 if(f=="cf"){var v=$("#ci").value.trim();if(!v)return;msg("Вы",v);$("#ci").value="";setTimeout(()=>msg(["Аки","Рэн","Юна"][Math.random()*3|0],BOT[Math.random()*BOT.length|0]),1200)}
 if(f=="jf"){var c=$("#jc").value.trim().toUpperCase();if(!c)return;S.room=c;sv();toast("Вы в комнате "+c);location.hash="watch-"+D[0].id+"-1"}});
document.addEventListener("input",e=>{var i=e.target.id;
 if(i=="q"){F.q=e.target.value.trim().toLowerCase();if(location.hash!="#catalog")location.hash="catalog";else rc()}
 if(i=="nm"){S.name=e.target.value.trim()||"Гость";sv();hd()}});
document.addEventListener("change",e=>{if(e.target.id=="so"){F.s=e.target.value;rc()}if(e.target.id=="status-filter"){F.status=e.target.value;rc()}if(e.target.id=="anime-list-status"){var id=+e.target.dataset.id,value=e.target.value;if(value)S.watchlist[id]=value;else delete S.watchlist[id];sv();toast(value?"Статус сохранён":"Удалено из списка")}});
addEventListener("keydown",e=>{if(!P||/INPUT|SELECT/.test(e.target.tagName))return;
 if(e.code=="Space"){e.preventDefault();P.on=!P.on;tick(0)}else if(e.code=="ArrowRight")tick(10);else if(e.code=="ArrowLeft"){P.t=Math.max(0,P.t-10);tick(0)}});
addEventListener("hashchange",()=>{draw();scrollTo(0,0)});
idx();boot();
})();