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

var $=s=>document.querySelector(s),app=$("#app"),S=ld(),F={g:"",s:"r",q:"",status:""},T=[],P=null,AP=false,V={};
function ld(){try{return JSON.parse(localStorage.getItem("aw"))||{}}catch(e){return{}}}
function sv(){try{localStorage.setItem("aw",JSON.stringify(S))}catch(e){}}
function df(){S.fav=S.fav||[];S.hist=S.hist||{};S.rate=S.rate||{};S.name=S.name||"Гость";S.acc=S.acc||"#8b5cf6"}
df();
var esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
var gr=d=>"linear-gradient(160deg,"+d.c[0]+","+d.c[1]+")";
var bg=d=>(d.img?"url('"+d.img+"') center/cover no-repeat,":"")+gr(d);
var bn=d=>"linear-gradient(0deg,#000 5%,transparent 70%),"+(d.ban?"url('"+d.ban+"') center/cover no-repeat,":"")+gr(d);
var fm=t=>{t=Math.floor(t);return(t/60|0)+":"+("0"+t%60).slice(-2)};
var srt=k=>D.slice().sort((a,b)=>k=="n"?a.n.localeCompare(b.n):b[k]-a[k]);
function card(d,pr,href){
 var score=Number(d.r||0),status=d.s||"Аниме";
 return '<a class="card" href="'+(href||"#title-"+d.id)+'"><div class="poster" style="background:'+bg(d)+'">'+(d.img?"":"<i>"+d.n[0]+"</i>")+'<span class="rating">★ '+(score?score.toFixed(1):"—")+'</span><em class="poster-status">'+status+'</em>'+(pr!=null?'<u style="width:'+pr+'%"></u>':"")+'</div><b>'+d.n+'</b><small>'+d.g.slice(0,2).join(" · ")+" · "+d.y+'</small></a>'
}
var row=(t,a,sub)=>'<section class="shelf"><div class="shelf-head"><div><h2>'+t+'</h2>'+(sub?'<p class="shelf-sub">'+sub+'</p>':"")+'</div></div><div class="row">'+a.join("")+'</div></section>';
var eps=(d,cur)=>Array.from({length:d.e},(_,k)=>'<a href="#watch-'+d.id+'-'+(k+1)+'" class="'+(k+1==cur?"on":"")+'">'+(k+1)+'</a>').join("");
function toast(m){var t=$("#toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),2000)}
function cleanDesc(v){return String(v||"").replace(/<[^>]*>/g," ").replace(/\[\/?[a-z][a-z0-9_]*(?:=[^\]]*)?\]/gi,"").replace(/\[\[|\]\]/g,"").replace(/\s+/g," ").trim()}

V.home=()=>{var hi=0;
 var featured=()=>{var d=H[hi%H.length]||D[0];ru(d);var rd=cleanDesc((S.ru&&S.ru[d.id]&&S.ru[d.id].d)||d.d);return '<section class="hero hero-editorial" style="background:'+bn(d)+'"><div class="hero-copy"><div class="eyebrow"><span class="live-dot"></span> В центре внимания</div><small>'+d.g.slice(0,3).join(" · ")+' <i>•</i> '+d.y+' <i>•</i> '+(d.s||"Аниме")+'</small><h1>'+d.n+'</h1><p id="featured-desc" data-id="'+d.id+'">'+rd+'</p><div class="hero-facts"><span>★ '+(d.r?Number(d.r).toFixed(1):"—")+'</span><span>'+d.e+' серий</span></div><div class="acts"><a class="btn" href="#watch-'+d.id+'-1">▶ Смотреть</a><a class="btn ghost" href="#title-'+d.id+'">Подробнее</a></div></div><div class="hero-poster" style="background:'+bg(d)+'">'+(d.img?"":"<b>"+d.n[0]+"</b>")+'<span>ANIWATCH PICK</span></div></section>'};
 var cont=Object.keys(S.hist).filter(k=>M[k]).sort((a,b)=>S.hist[b].at-S.hist[a].at).slice(0,6).map(k=>card(M[k],Math.round(S.hist[k].t/DUR*100),"#watch-"+k+"-"+S.hist[k].ep));
 var trending=srt("r").slice(0,8).map(d=>card(d));
 var ongoing=D.filter(d=>/Онгоинг|RELEASING/i.test(d.s||"")).sort((a,b)=>b.y-a.y).slice(0,8).map(d=>card(d));
 var recent=srt("y").slice(0,8).map(d=>card(d));
 var genres=GN.slice(0,6).map(g=>'<a class="genre-tile" href="#catalog" data-a="g" data-v="'+g+'"><span>'+g+'</span><b>Смотреть подборку <i>↗</i></b></a>').join("");
 app.innerHTML='<div id="hw">'+featured()+'</div><div class="quick-stats"><div><b>'+D.length+'</b><span>тайтлов в подборке</span></div><div><b>'+D.filter(d=>/Онгоинг/i.test(d.s||"")).length+'</b><span>выходят сейчас</span></div><div><b>24/7</b><span>аниме-настроение</span></div></div>'+(cont.length?row("Продолжить просмотр",cont,"Вернись к серии, на которой остановился"):"")+row("Сейчас в топе",trending,"Популярные тайтлы по оценкам")+(ongoing.length?row("Онгоинги",ongoing,"Истории, которые продолжаются прямо сейчас"):"")+row("Недавно добавлено",recent,"Свежие и актуальные тайтлы")+'<section class="genre-section"><div class="shelf-head"><div><h2>Найди своё настроение</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="#catalog" class="text-link">Весь каталог ↗</a></div><div class="genre-grid">'+genres+'</div></section>';
 T.push(setInterval(()=>{hi++;var el=$("#hw");if(el)el.innerHTML=featured()},7000))
};

function rc(){var a=srt(F.s).filter(d=>(!F.g||d.g.includes(F.g))&&(!F.status||d.s===F.status)&&(!F.q||(d.n+(d.o||"")+d.g.join()).toLowerCase().includes(F.q)));$("#cr").innerHTML=a.length?a.map(d=>card(d)).join(""):'<p class="empty">Ничего не найдено</p>';var count=$("#result-count");if(count)count.textContent="Найдено: "+a.length}
V.catalog=()=>{var statuses=[...new Set(D.map(d=>d.s).filter(Boolean))];app.innerHTML='<div class="catalog-heading"><div><div class="eyebrow">Открой следующую историю</div><h1>Каталог аниме</h1><p>Подборка тайтлов, которые хочется посмотреть дальше.</p></div><div class="catalog-count"><b>'+D.length+'</b><span>тайтлов</span></div></div><div class="catalog-tools"><div class="chips">'+["",...GN].map(g=>'<button class="'+(F.g==g?"on":"")+'" data-a="g" data-v="'+g+'">'+(g||"Все жанры")+'</button>').join("")+'</div><div class="catalog-selects"><label>Статус<select id="status-filter"><option value="">Любой статус</option>'+statuses.map(s=>'<option value="'+s+'"'+(F.status===s?" selected":"")+'>'+s+'</option>').join("")+'</select></label><label>Сортировка<select id="so">'+[["r","По рейтингу"],["y","По году"],["n","По названию"]].map(o=>'<option value="'+o[0]+'"'+(F.s==o[0]?" selected":"")+'>'+o[1]+'</option>').join("")+'</select></label></div></div><div class="results-line"><b id="result-count"></b><span>Данные каталога AniList</span></div><div class="row" id="cr"></div>';rc()};

V.title=p=>{var d=M[p[0]];if(!d)return V.home();var f=S.fav.includes(d.id),h=S.hist[d.id],r=S.rate[d.id]||0;
 app.innerHTML=(d.ban?'<div class="tb" style="background:'+bn(d)+'"></div>':"")+'<div class="tt"><div class="poster big" style="background:'+bg(d)+'">'+(d.img?"":"<i>"+d.n[0]+"</i>")+'</div><div><h1 id="tn">'+d.n+'</h1><p class="m">'+(d.o?d.o+" · ":"")+d.g.join(" · ")+' · '+d.y+' · ★ '+d.r+' · '+d.e+' эп. · '+d.s+'</p><p id="td">'+d.d+'</p><div class="acts"><a class="btn" href="#watch-'+d.id+'-'+(h?h.ep:1)+'">▶ '+(h?"Продолжить, серия "+h.ep:"Смотреть")+'</a><button class="btn ghost" data-a="fav" data-i="'+d.id+'">'+(f?"♥ В избранном":"♡ В избранное")+'</button></div><p class="m">Ваша оценка: '+[1,2,3,4,5].map(v=>'<button class="st'+(v<=r?" on":"")+'" data-a="rate" data-i="'+d.id+'" data-v="'+v+'">★</button>').join("")+'</p></div></div><h2>Серии</h2><div class="eps">'+eps(d,0)+'</div>'+row("Похожее",D.filter(x=>x.id!=d.id&&x.g.some(g=>d.g.includes(g))).slice(0,6).map(x=>card(x)));ru(d)};

function tick(s){if(!P)return;P.t=Math.min(DUR,P.t+s);if(P.t>=DUR){P.on=false;return nextEp()}
 $("#tc").textContent=fm(P.t);$("#pg").style.width=P.t/DUR*100+"%";$(".play").textContent=P.on?"❚❚":"▶";if(s){S.hist[P.d.id]={ep:P.n,t:P.t,at:Date.now()};sv()}}
function nextEp(){var d=P.d,n=P.n;if(n<d.e){S.hist[d.id]={ep:n+1,t:0,at:Date.now()};sv();AP=true;toast("Следующая серия");location.hash="watch-"+d.id+"-"+(n+1)}else{delete S.hist[d.id];sv();toast("Тайтл досмотрен 🎉");$(".play").textContent="▶"}}
V.watch=p=>{var d=M[p[0]];if(!d)return V.home();var n=Math.min(Math.max(p[1]||1,1),d.e),h=S.hist[d.id];P={d:d,n:n,t:h&&h.ep==n?h.t:0,on:AP,sp:1};AP=false;
 app.innerHTML='<div class="watch"><div><div class="player" style="background:'+bn(d)+'"><div class="shade"></div><button class="play" data-a="pp">▶</button><b class="cap">'+d.n+' · серия '+n+'</b><div class="ctl"><span id="tc"></span><div class="bar" data-a="seek"><i id="pg"></i></div><span>'+fm(DUR)+'</span><button data-a="sp" id="sp">1×</button></div></div><div class="nv">'+(n>1?'<a class="btn ghost" href="#watch-'+d.id+'-'+(n-1)+'">← Пред.</a>':"")+'<a class="btn ghost" href="#title-'+d.id+'">О тайтле</a>'+(n<d.e?'<a class="btn" href="#watch-'+d.id+'-'+(n+1)+'">След. →</a>':"")+'</div><p class="m" style="margin-top:8px">Пробел — пауза, ←/→ — перемотка на 10 с. Это демо-плеер: замените заглушку на свой видеоисточник.</p><div class="eps">'+eps(d,n)+'</div></div><div class="chat"><h3>Чат'+(S.room?" · комната "+S.room:"")+'</h3><div id="ms"><div><em>Аки</em>Всем привет!</div><div><em>Рэн</em>Погнали 🍿</div></div><form id="cf"><input id="ci" placeholder="Сообщение…" autocomplete="off"><button>➤</button></form></div></div>';
 tick(0);T.push(setInterval(()=>{if(P&&P.on)tick(P.sp)},1000))};

V.together=()=>{app.innerHTML='<h2>Смотреть вместе</h2><div class="panel"><p>Создайте комнату и отправьте код друзьям — чат откроется рядом с плеером. Синхронизация между устройствами требует сервера (см. README), сейчас комната работает локально.</p><div class="acts"><button class="btn" data-a="room">Создать комнату</button><form id="jf" class="inl"><input id="jc" placeholder="Код комнаты" maxlength="6"><button class="btn ghost">Войти</button></form></div>'+(S.room?'<p class="m">Текущая комната: <b>'+S.room+'</b></p>':"")+'</div>'+row("Что смотрим?",D.slice(0,6).map(d=>card(d)))};
V.favorites=()=>{var a=S.fav.filter(i=>M[i]).map(i=>card(M[i]));app.innerHTML='<h2>Избранное</h2>'+(a.length?'<div class="row">'+a.join("")+'</div>':'<p class="empty">Пока пусто. Нажмите «♡ В избранное» на странице тайтла.</p>')};
V.profile=()=>{app.innerHTML='<h2>Профиль</h2><div class="panel"><label class="m">Ник</label><input id="nm" value="'+esc(S.name)+'" maxlength="20"><label class="m">Цвет акцента</label><div class="sw">'+["#8b5cf6","#ec4899","#06b6d4","#f97316","#22c55e"].map(c=>'<button style="background:'+c+'" data-a="acc" data-v="'+c+'" aria-label="'+c+'"></button>').join("")+'</div><p class="m">В избранном: '+S.fav.length+' · В истории: '+Object.keys(S.hist).length+' · Оценок: '+Object.keys(S.rate).length+'</p><button class="btn ghost" data-a="reset" style="justify-self:start">Сбросить данные</button></div>'};

// ---- Реальные данные: AniList (постеры, баннеры, описания) + Shikimori (русские названия и описания) ----
var Q="query{Page(perPage:30){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){id idMal title{romaji english}genres seasonYear startDate{year}averageScore episodes status description(asHtml:false)coverImage{extraLarge color}bannerImage}}}";
var GR={Action:"Экшен",Adventure:"Приключения",Comedy:"Комедия",Drama:"Драма",Fantasy:"Фэнтези",Romance:"Романтика",Mystery:"Детектив","Slice of Life":"Повседневность",Supernatural:"Сверхъестественное",Sports:"Спорт",Horror:"Ужасы",Mecha:"Меха",Music:"Музыка",Psychological:"Психология",Thriller:"Триллер"};
var ST={RELEASING:"Онгоинг",FINISHED:"Завершён",NOT_YET_RELEASED:"Скоро",CANCELLED:"Отменён",HIATUS:"Пауза"};
function mp(m){return{id:m.id,mal:m.idMal,n:esc(m.title.english||m.title.romaji),g:(m.genres.length?m.genres:["Аниме"]).map(g=>GR[g]||g),y:m.seasonYear||(m.startDate&&m.startDate.year)||new Date().getFullYear(),r:m.averageScore?m.averageScore/10:0,e:m.episodes||12,s:ST[m.status]||"",d:esc((m.description||"Описание отсутствует.").replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()),c:[m.coverImage.color||"#7c3aed","#0f0f1a"],img:m.coverImage.extraLarge,ban:m.bannerImage}}
function idx(){M={};D.forEach(d=>M[d.id]=d);var c={};D.forEach(d=>d.g.forEach(g=>c[g]=(c[g]||0)+1));GN=Object.keys(c).sort((a,b)=>c[b]-c[a]).slice(0,10);H=D.filter(d=>d.ban).slice(0,3);if(H.length<3)H=D.slice(0,3)}
async function ru(d){if(!d.mal)return;var c=S.ru=S.ru||{},r=c[d.id];
  if(!r){try{var j=await(await fetch("https://shikimori.io/api/animes/"+d.mal)).json();r=c[d.id]={n:j.russian||"",d:j.description||""};sv()}catch(e){return}}
  r.d=cleanDesc(r.d);
  if(location.hash=="#title-"+d.id){var h=$("#tn"),p=$("#td");if(h&&r.n)h.textContent=r.n;if(p&&r.d)p.textContent=r.d}
  var fp=$("#featured-desc");if(fp&&fp.dataset.id==d.id&&r.d)fp.textContent=r.d}
// Русские названия одним запросом к Shikimori (id там совпадают с MAL), кэш в localStorage
async function rn(){var m=D.filter(d=>d.mal),c;try{c=JSON.parse(localStorage.getItem("awr")||"{}")}catch(e){c={}}
 var need=m.filter(d=>!(d.mal in c));
 if(need.length){try{var ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),5000),
  r=await fetch("https://shikimori.io/api/animes?limit=50&ids="+need.map(d=>d.mal).join(),{signal:ctl.signal});clearTimeout(tm);
  (await r.json()).forEach(x=>c[x.id]=x.russian||"");need.forEach(d=>{if(!(d.mal in c))c[d.mal]=""});
  try{localStorage.setItem("awr",JSON.stringify(c))}catch(e){}}catch(e){}}
 m.forEach(d=>{if(c[d.mal]){d.o=d.n;d.n=esc(c[d.mal])}})}
async function boot(){app.innerHTML='<p class="empty">Загрузка…</p>';var c;
 try{c=JSON.parse(localStorage.getItem("awc")||"null")}catch(e){}
 if(!c||Date.now()-c.t>216e5){try{var ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),6000),
  r=await fetch("https://graphql.anilist.co",{method:"POST",signal:ctl.signal,headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:Q})});
  clearTimeout(tm);var j=await r.json();c={t:Date.now(),a:j.data.Page.media.map(mp)};try{localStorage.setItem("awc",JSON.stringify(c))}catch(e){}}catch(e){}}
 if(c&&c.a&&c.a.length)D=c.a;await rn();idx();draw()}

function hd(){var b=location.hash.slice(1).split("-")[0]||"home",a=$(".av");a.textContent=(S.name||"Г")[0].toUpperCase();document.documentElement.style.setProperty("--ac",S.acc);document.querySelectorAll("nav a").forEach(x=>x.classList.toggle("on",x.getAttribute("href")=="#"+b))}
function draw(){T.forEach(clearInterval);T=[];P=null;var p=location.hash.slice(1).split("-");(V[p[0]]||V.home)(p.slice(1).map(Number));hd()}
function msg(a,t){var m=$("#ms");if(!m)return;var d=document.createElement("div"),e=document.createElement("em");e.textContent=a;d.append(e,t);m.append(d);m.scrollTop=1e5}

document.addEventListener("click",e=>{var t=e.target.closest("[data-a]");if(!t)return;var a=t.dataset.a,i=+t.dataset.i,v=t.dataset.v;
 if(a=="fav"){var k=S.fav.indexOf(i);k<0?S.fav.push(i):S.fav.splice(k,1);sv();toast(k<0?"Добавлено в избранное":"Убрано из избранного");draw()}
 else if(a=="rate"){S.rate[i]=+v;sv();draw()}
 else if(a=="g"){F.g=v;draw()}
 else if(a=="pp"&&P){P.on=!P.on;tick(0)}
 else if(a=="sp"&&P){var s=[1,1.25,1.5,2];P.sp=s[(s.indexOf(P.sp)+1)%4];t.textContent=P.sp+"×"}
 else if(a=="seek"&&P){var r=t.getBoundingClientRect();P.t=Math.round((e.clientX-r.left)/r.width*DUR);tick(0)}
 else if(a=="room"){S.room=Math.random().toString(36).slice(2,7).toUpperCase();sv();toast("Комната создана: "+S.room);draw()}
 else if(a=="acc"){S.acc=v;sv();hd()}
 else if(a=="reset"){S={};df();sv();toast("Данные сброшены");draw()}});
document.addEventListener("submit",e=>{e.preventDefault();var f=e.target.id;
 if(f=="cf"){var v=$("#ci").value.trim();if(!v)return;msg("Вы",v);$("#ci").value="";setTimeout(()=>msg(["Аки","Рэн","Юна"][Math.random()*3|0],BOT[Math.random()*BOT.length|0]),1200)}
 if(f=="jf"){var c=$("#jc").value.trim().toUpperCase();if(!c)return;S.room=c;sv();toast("Вы в комнате "+c);location.hash="watch-"+D[0].id+"-1"}});
document.addEventListener("input",e=>{var i=e.target.id;
 if(i=="q"){F.q=e.target.value.trim().toLowerCase();if(location.hash!="#catalog")location.hash="catalog";else rc()}
 if(i=="nm"){S.name=e.target.value.trim()||"Гость";sv();hd()}});
document.addEventListener("change",e=>{if(e.target.id=="so"){F.s=e.target.value;rc()}if(e.target.id=="status-filter"){F.status=e.target.value;rc()}});
addEventListener("keydown",e=>{if(!P||/INPUT|SELECT/.test(e.target.tagName))return;
 if(e.code=="Space"){e.preventDefault();P.on=!P.on;tick(0)}else if(e.code=="ArrowRight")tick(10);else if(e.code=="ArrowLeft"){P.t=Math.max(0,P.t-10);tick(0)}});
addEventListener("hashchange",()=>{draw();scrollTo(0,0)});
idx();boot();
})();