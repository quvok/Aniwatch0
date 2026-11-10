// Presentational pages for the user's saved collection and local profile.
function savedAnime(state,mediaMap,id){
 return mediaMap?.[id]||state?.shikiAnime?.[id]||null;
}
function normalizedWatchlist(state){
 const raw=state?.watchlist||{},out={};
 const aliases={watching:"watching",planned:"planned",planning:"planned",completed:"completed",complete:"completed",dropped:"dropped"};
 if(Array.isArray(raw)){
  raw.forEach(item=>{
   if(!item||typeof item!=="object")return;
   const id=Number(item.id??item.anime_id??item.animeId);
   const status=aliases[String(item.status??item.listStatus??"").toLowerCase()];
   if(Number.isSafeInteger(id)&&id>0&&status)out[id]=status;
  });
  return out;
 }
 if(!raw||typeof raw!=="object")return out;
 Object.entries(raw).forEach(([key,value])=>{
  const id=Number(key),status=aliases[String(typeof value==="string"?value:(value?.status??value?.listStatus??"")).toLowerCase()];
  if(Number.isSafeInteger(id)&&id>0&&status)out[id]=status;
 });
 return out;
}
function animeCards(ids,state,mediaMap,card){
 return ids.map(id=>savedAnime(state,mediaMap,id)).filter(Boolean).map(card).join("");
}
export function renderFavorites({app,state,mediaMap,card}){
 const ids=[...new Set((state.fav||[]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))]
  .filter(id=>savedAnime(state,mediaMap,id))
  .sort((a,b)=>savedAnime(state,mediaMap,a).n.localeCompare(savedAnime(state,mediaMap,b).n,"ru"));
 const content=animeCards(ids,state,mediaMap,card);
 app.innerHTML='<section class="personal-list-page"><div class="list-heading"><div><div class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div><h1>Избранное</h1><p>Аниме, к которым хочется вернуться.</p></div><b>'+ids.length+'</b></div><div class="list-results">'+(content?'<div class="list-card-grid">'+content+'</div>':'<p class="empty">В избранном пока пусто. Добавь аниме с помощью кнопки ♡ на странице тайтла.</p>')+'</div></section>';
}
export function renderMyList({app,state,mediaMap,filters,lists,card}){
 const key=filters.listStatus||"all",watchlist=normalizedWatchlist(state),favorites=[...new Set((state.fav||[]).map(Number).filter(id=>Number.isSafeInteger(id)&&id>0))];
 const isFavorites=key==="favorites";
 const ids=(isFavorites?favorites:Object.keys(watchlist).filter(id=>key==="all"||watchlist[id]===key).map(Number))
  .sort((a,b)=>String(savedAnime(state,mediaMap,a)?.n||("Аниме #"+a)).localeCompare(String(savedAnime(state,mediaMap,b)?.n||("Аниме #"+b)),"ru"));
 const animeForId=id=>savedAnime(state,mediaMap,id)||{id,n:"Аниме #"+id,o:"",g:["Аниме"],y:0,r:0,e:0,s:"",d:"Метаданные тайтла временно недоступны. Запись сохранена в аккаунте.",c:["#334155","#0f172a"],img:""};
 const tabs=[["all","Все"],...lists],counts={all:Object.keys(watchlist).length};
 lists.forEach(([status])=>{counts[status]=Object.values(watchlist).filter(value=>value===status).length});
 const content=ids.map(id=>card(animeForId(id))).join("");
 const tabButton=(value,label,count,active)=>'<button type="button" data-a="list-filter" data-v="'+value+'" class="'+(active?"on":"")+'" aria-pressed="'+active+'">'+label+(count!==undefined?'<span>'+count+'</span>':"")+'</button>';
 app.innerHTML='<section class="personal-list-page"><div class="list-heading"><div><div class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div><h1>Мои списки</h1><p>Управляй просмотренным и тем, что собираешься посмотреть.</p></div><b>'+ids.length+'</b></div>'+
 '<div class="collection-switch" role="group" aria-label="Раздел коллекции">'+tabButton("all","Мои списки",counts.all,!isFavorites)+tabButton("favorites","♥ Избранное",favorites.length,isFavorites)+'</div>'+
 (isFavorites?"":'<div class="list-chips" role="group" aria-label="Фильтр по статусу">'+tabs.map(([value,label])=>tabButton(value,label,value==="all"?counts.all:counts[value],key===value)).join("")+'</div>')+
 '<div class="list-results">'+(content?'<div class="list-card-grid">'+content+'</div>':'<div class="list-empty-state"><span class="list-empty-icon">'+(isFavorites?"♡":"▤")+'</span><b>'+(isFavorites?"Пока нет избранного":"Здесь пока пусто")+'</b><p>'+(isFavorites?"Добавляй понравившиеся тайтлы в избранное — они появятся здесь.":"Открой страницу аниме и выбери статус, чтобы добавить его в этот список.")+'</p><a class="btn ghost" href="catalog.html">Перейти в каталог</a></div>')+'</div></section>';
}

export function renderProfile({app,state,escapeHtml,user,mediaMap={}}){
 const watchlist=normalizedWatchlist(state),counts={watching:0,planned:0,completed:0,dropped:0};
 Object.values(watchlist).forEach(status=>{if(Object.prototype.hasOwnProperty.call(counts,status))counts[status]++});
 const rated=Object.values(state.rate||{}).map(Number).filter(value=>Number.isFinite(value)&&value>0);
 const average=rated.length?(rated.reduce((sum,value)=>sum+value,0)/rated.length).toFixed(1):"—";
 const total=Object.keys(watchlist).length,started=Object.keys(state.hist||{}).length,fav=(state.fav||[]).length;
 const watchedEpisodes=Object.values(state.watchedEpisodes||{}).reduce((sum,list)=>sum+(Array.isArray(list)?new Set(list.map(Number).filter(n=>n>0)).size:0),0);
 const progress=total?Math.round(counts.completed/total*100):0;
 const name=String(state.name||"Гость").trim().slice(0,20)||"Гость";
 const bio=String(state.bio||"").slice(0,280);
 const avatar=typeof state.avatar==="string"&&(/^(https:\/\/|data:image\/)/i).test(state.avatar)
  ?'<img class="profile-avatar-image" src="'+escapeHtml(state.avatar)+'" alt="">':escapeHtml(name.slice(0,1).toUpperCase()||"A");
 const banner=typeof state.banner==="string"&&(/^(https:\/\/|data:image\/)/i).test(state.banner)?' style="background-image:linear-gradient(90deg,rgba(10,11,20,.82),rgba(10,11,20,.25)),url(&quot;'+escapeHtml(state.banner)+'&quot;)"':"";
 const account=user
  ?'<div class="profile-account-inline"><span class="profile-online-dot"></span><span>Аккаунт синхронизирован</span><button type="button" class="profile-logout" data-a="auth-logout">Выйти</button></div>'
  :'<div class="profile-account-inline is-guest"><span class="profile-online-dot"></span><span>Гостевой профиль · данные на этом устройстве</span><button type="button" class="profile-login" data-a="profile-entry">Войти в аккаунт</button></div>';
 const ids=[...new Set([...(state.fav||[]).map(Number),...Object.keys(watchlist).map(Number),...Object.keys(state.hist||{}).map(Number)])];
 const genreCounts={};
 ids.forEach(id=>{const anime=mediaMap[id]||state.shikiAnime?.[id];(anime?.g||[]).forEach(genre=>{genreCounts[genre]=(genreCounts[genre]||0)+1})});
 const topGenres=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,4);
 const recent=Object.entries(state.hist||{}).filter(([id,item])=>item&&Number(item.at)>0).sort((a,b)=>Number(b[1].at)-Number(a[1].at)).slice(0,5);
 const recentHtml=recent.length?recent.map(([id,item])=>{const anime=mediaMap[id]||state.shikiAnime?.[id];return '<div class="profile-recent-item"><span><b>'+escapeHtml(anime?.n||("Аниме #"+id))+'</b><small>Серия '+Math.max(1,Number(item.ep)||1)+'</small></span><time>'+new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short"}).format(new Date(Number(item.at)))+'</time></div>'}).join(""):'<p class="profile-hint">История просмотра пока пуста.</p>';
 const favoriteIds=(state.fav||[]).map(Number).slice(0,5);
 const favoriteHtml=favoriteIds.length?favoriteIds.map(id=>{const anime=mediaMap[id]||state.shikiAnime?.[id];return anime?'<a class="profile-favorite-card" href="anime.html?id='+encodeURIComponent(id)+'">'+(anime.img?'<img src="'+escapeHtml(anime.img)+'" alt="" loading="lazy">':'<span class="profile-favorite-placeholder">AW</span>')+'<b>'+escapeHtml(anime.n||("Аниме #"+id))+'</b></a>':''}).join(""):'<p class="profile-hint">Добавь тайтлы в избранное — они появятся здесь.</p>';
 app.innerHTML=
 '<section class="profile-page">'+
  '<header class="profile-top-card">'+
   '<div class="profile-banner'+(state.banner?' has-image':'')+'"'+banner+'><span class="profile-banner-label">ANIWATCH PROFILE</span><button class="profile-banner-edit" type="button" data-a="profile-banner" aria-label="Изменить баннер">Изменить обложку</button></div>'+
   '<input id="profile-banner-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
   '<div class="profile-top-main">'+
    '<button class="profile-avatar profile-avatar-edit" type="button" data-a="profile-avatar" aria-label="Изменить фото">'+avatar+'<span class="profile-avatar-camera">✎</span></button>'+
    '<input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
    '<div class="profile-top-identity"><span class="eyebrow">ЛИЧНЫЙ ПРОФИЛЬ</span><h1>'+escapeHtml(name)+'</h1><p>'+(bio?escapeHtml(bio):'Расскажи немного о себе и своём аниме-вкусе')+'</p></div>'+
   '</div>'+account+
  '</header>'+
  '<section class="profile-edit-card"><div class="profile-block-title"><div><span class="eyebrow">НАСТРОЙКИ</span><h2>Оформление профиля</h2></div><span>Изменения сохраняются в аккаунте</span></div>'+
   '<form id="profile-form" class="profile-edit-form"><label>Ник<input id="nm" name="username" maxlength="20" minlength="2" value="'+escapeHtml(name)+'" required></label><label>О себе <small>До 280 символов</small><textarea name="bio" maxlength="280" rows="3" placeholder="Какие жанры любишь? Что сейчас смотришь?">'+escapeHtml(bio)+'</textarea></label><button class="btn" type="submit">Сохранить профиль</button></form>'+
   (!user?'<p class="profile-hint">Гостевой профиль хранится только на этом устройстве. Войди, чтобы синхронизировать оформление.</p>':'')+
  '</section>'+
  '<section class="profile-overview"><div class="profile-block-title"><div><span class="eyebrow">ТВОЯ АКТИВНОСТЬ</span><h2>Статистика</h2></div><span>'+total+' в списках</span></div>'+
   '<div class="profile-metric-grid profile-metric-grid-expanded">'+
    '<article><b>'+total+'</b><span>В коллекции</span></article><article><b>'+counts.watching+'</b><span>Смотрю</span></article><article><b>'+counts.completed+'</b><span>Завершено</span></article><article><b>'+fav+'</b><span>Избранное</span></article><article><b>'+started+'</b><span>Начато</span></article><article><b>'+watchedEpisodes+'</b><span>Отмечено серий</span></article>'+
   '</div>'+
   '<div class="profile-stat-secondary"><div><span>Средняя оценка</span><b>★ '+average+'</b><small>'+rated.length+' оценок</small></div><div><span>Завершение списков</span><b>'+progress+'%</b><small>'+counts.completed+' из '+total+' тайтлов</small></div></div>'+
   '<div class="profile-progress"><div><div><b>Завершение коллекции</b><small>'+counts.completed+' из '+total+' тайтлов</small></div><strong>'+progress+'%</strong></div><div class="profile-progress-track"><i style="width:'+progress+'%"></i></div></div>'+
  '</section>'+
  '<section class="profile-status-block profile-favorites-block"><div class="profile-block-title"><div><span class="eyebrow">ТВОЙ ВКУС</span><h2>Любимые аниме</h2></div><a href="favorites.html">Все избранное ↗</a></div><div class="profile-favorite-grid">'+favoriteHtml+'</div></section>'+
  '<div class="profile-insights-grid"><section class="profile-status-block"><div class="profile-block-title"><div><span class="eyebrow">РАСПРЕДЕЛЕНИЕ</span><h2>Мои списки</h2></div><a href="lists.html">Открыть списки ↗</a></div><div class="profile-status-list"><div><span class="status-mark watching"></span><span>Смотрю</span><b>'+counts.watching+'</b></div><div><span class="status-mark planned"></span><span>В планах</span><b>'+counts.planned+'</b></div><div><span class="status-mark completed"></span><span>Просмотрено</span><b>'+counts.completed+'</b></div><div><span class="status-mark dropped"></span><span>Брошено</span><b>'+counts.dropped+'</b></div></div></section>'+
   '<section class="profile-status-block"><div class="profile-block-title"><div><span class="eyebrow">ТВОИ ПРЕДПОЧТЕНИЯ</span><h2>Любимые жанры</h2></div></div>'+(topGenres.length?'<div class="profile-genre-list">'+topGenres.map(([name,count])=>'<div><span>'+escapeHtml(name)+'</span><b>'+count+'</b></div>').join("")+'</div>':'<p class="profile-hint">Добавляй аниме в списки, чтобы здесь появились жанры.</p>')+'</section></div>'+
   '<section class="profile-status-block profile-recent-block"><div class="profile-block-title"><div><span class="eyebrow">ПОСЛЕДНИЕ ДЕЙСТВИЯ</span><h2>Недавно смотрел</h2></div></div><div class="profile-recent-list">'+recentHtml+'</div></section>'+
 '</section>';
}
