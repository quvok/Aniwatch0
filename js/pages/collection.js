// Presentational pages for the user's saved collection and local profile.
export function renderFavorites({app,state,mediaMap,card}){
 const items=state.fav.filter(id=>mediaMap[id]).map(id=>card(mediaMap[id]));
 app.innerHTML='<h2>Избранное</h2>'+(items.length?'<div class="row">'+items.join("")+'</div>':'<p class="empty">Пока пусто. Нажмите «♡ В избранное» на странице тайтла.</p>');
}

export function renderMyList({app,state,mediaMap,filters,lists,card}){
 const key=filters.listStatus||"all",items=state.watchlist||{};
 const favorites=key==="favorites";
 const ids=favorites
  ?(state.fav||[]).map(Number).filter(id=>mediaMap[id]).sort((a,b)=>mediaMap[a].n.localeCompare(mediaMap[b].n))
  :Object.keys(items).filter(id=>key==="all"||items[id]===key).map(Number).filter(id=>mediaMap[id]).sort((a,b)=>mediaMap[a].n.localeCompare(mediaMap[b].n));
 const tabs=[["all","Все"],...lists];
 app.innerHTML='<div class="list-heading"><div><div class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div><h1>Мои списки</h1><p>Все сохранённые тайтлы в одном месте.</p></div><b>'+ids.length+'</b></div>'+
 '<div class="collection-switch" role="group" aria-label="Раздел коллекции"><button type="button" data-a="list-filter" data-v="all" class="'+(!favorites?"on":"")+'">Мои списки</button><button type="button" data-a="list-filter" data-v="favorites" class="'+(favorites?"on":"")+'">♥ Избранное <span>'+(state.fav||[]).length+'</span></button></div>'+
 (favorites?'':'<div class="list-chips">'+tabs.map(item=>'<button type="button" data-a="list-filter" data-v="'+item[0]+'" class="'+(key===item[0]?"on":"")+'">'+item[1]+'</button>').join("")+'</div>')+
 '<div class="list-results">'+(ids.length?'<div class="row">'+ids.map(id=>card(mediaMap[id])).join("")+'</div>':'<p class="empty">'+(favorites?'В избранном пока пусто. Нажми «♡ В избранное» на странице аниме.':'В этом списке пока пусто. Открой страницу любого аниме и выбери статус.')+'</p>')+'</div>';
}

export function renderProfile({app,state,escapeHtml,user,mediaMap={}}){
 const watchlist=state.watchlist||{},counts={watching:0,planned:0,completed:0,dropped:0};
 Object.values(watchlist).forEach(status=>{if(Object.prototype.hasOwnProperty.call(counts,status))counts[status]++});
 const rated=Object.values(state.rate||{}).map(Number).filter(value=>Number.isFinite(value)&&value>0);
 const average=rated.length?(rated.reduce((sum,value)=>sum+value,0)/rated.length).toFixed(1):"—";
 const total=Object.keys(watchlist).length,started=Object.keys(state.hist||{}).length,fav=(state.fav||[]).length;
 const watchedEpisodes=Object.values(state.watchedEpisodes||{}).reduce((sum,list)=>sum+(Array.isArray(list)?new Set(list.map(Number).filter(n=>n>0)).size:0),0);
 const progress=total?Math.round(counts.completed/total*100):0;
 const initial=String(state.name||user?.email||"A").trim().slice(0,1).toUpperCase();
 const avatar=typeof state.avatar==="string"&&(/^(https:\/\/|data:image\/)/i).test(state.avatar)
  ?'<img class="profile-avatar-image" src="'+escapeHtml(state.avatar)+'" alt="">':escapeHtml(initial);
 const account=user
  ?'<div class="profile-account-inline"><span class="profile-online-dot"></span><span>Аккаунт синхронизирован</span><button type="button" class="profile-logout" data-a="auth-logout">Выйти</button></div>'
  :'<div class="profile-account-inline is-guest"><span class="profile-online-dot"></span><span>Гостевой профиль · данные на этом устройстве</span><button type="button" class="profile-login" data-a="profile-entry">Войти в аккаунт</button></div>';
 const ids=[...new Set([...(state.fav||[]).map(Number),...Object.keys(watchlist).map(Number),...Object.keys(state.hist||{}).map(Number)])];
 const genreCounts={};
 ids.forEach(id=>{const anime=mediaMap[id]||state.shikiAnime?.[id];(anime?.g||[]).forEach(genre=>{genreCounts[genre]=(genreCounts[genre]||0)+1})});
 const topGenres=Object.entries(genreCounts).sort((a,b)=>b[1]-a[1]).slice(0,4);
 const recent=Object.entries(state.hist||{}).filter(([id,item])=>item&&Number(item.at)>0).sort((a,b)=>Number(b[1].at)-Number(a[1].at)).slice(0,5);
 const recentHtml=recent.length?recent.map(([id,item])=>{const anime=mediaMap[id]||state.shikiAnime?.[id];return '<div class="profile-recent-item"><span><b>'+escapeHtml(anime?.n||("Аниме #"+id))+'</b><small>Серия '+Math.max(1,Number(item.ep)||1)+'</small></span><time>'+new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short"}).format(new Date(Number(item.at)))+'</time></div>'}).join(""):'<p class="profile-hint">История просмотра пока пуста.</p>';
 app.innerHTML=
 '<section class="profile-page">'+
  '<header class="profile-top-card"><div class="profile-top-main">'+
   '<button class="profile-avatar profile-avatar-edit" type="button" data-a="profile-avatar" aria-label="Изменить фото">'+avatar+'<span class="profile-avatar-camera">✎</span></button>'+
   '<input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
   '<div class="profile-top-identity"><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>'+escapeHtml(state.name||"Гость")+'</h1><p>'+(user?escapeHtml(user.email||"Аккаунт AniWatch"):"Твоя история, оценки и коллекция аниме")+'</p></div>'+
  '</div>'+account+'</header>'+
  '<section class="profile-overview"><div class="profile-block-title"><div><span class="eyebrow">ТВОЯ АКТИВНОСТЬ</span><h2>Статистика</h2></div><span>'+total+' в списках</span></div>'+
   '<div class="profile-metric-grid profile-metric-grid-expanded">'+
    '<article><b>'+total+'</b><span>В коллекции</span></article>'+
    '<article><b>'+counts.watching+'</b><span>Смотрю</span></article>'+
    '<article><b>'+counts.completed+'</b><span>Завершено</span></article>'+
    '<article><b>'+fav+'</b><span>Избранное</span></article>'+
    '<article><b>'+started+'</b><span>Начато</span></article>'+
    '<article><b>'+watchedEpisodes+'</b><span>Отмечено серий</span></article>'+
   '</div>'+
   '<div class="profile-stat-secondary"><div><span>Средняя оценка</span><b>★ '+average+'</b><small>'+rated.length+' оценок</small></div><div><span>Завершение списков</span><b>'+progress+'%</b><small>'+counts.completed+' из '+total+' тайтлов</small></div></div>'+
   '<div class="profile-progress"><div><div><b>Завершение коллекции</b><small>'+counts.completed+' из '+total+' тайтлов</small></div><strong>'+progress+'%</strong></div><div class="profile-progress-track"><i style="width:'+progress+'%"></i></div></div>'+
  '</section>'+
  '<div class="profile-insights-grid"><section class="profile-status-block"><div class="profile-block-title"><div><span class="eyebrow">РАСПРЕДЕЛЕНИЕ</span><h2>Мои списки</h2></div><a href="lists.html">Открыть списки ↗</a></div>'+
   '<div class="profile-status-list">'+
    '<div><span class="status-mark watching"></span><span>Смотрю</span><b>'+counts.watching+'</b></div>'+
    '<div><span class="status-mark planned"></span><span>В планах</span><b>'+counts.planned+'</b></div>'+
    '<div><span class="status-mark completed"></span><span>Просмотрено</span><b>'+counts.completed+'</b></div>'+
    '<div><span class="status-mark dropped"></span><span>Брошено</span><b>'+counts.dropped+'</b></div>'+
   '</div></section>'+
   '<section class="profile-status-block"><div class="profile-block-title"><div><span class="eyebrow">ТВОИ ПРЕДПОЧТЕНИЯ</span><h2>Любимые жанры</h2></div></div>'+
    (topGenres.length?'<div class="profile-genre-list">'+topGenres.map(([name,count])=>'<div><span>'+escapeHtml(name)+'</span><b>'+count+'</b></div>').join("")+'</div>':'<p class="profile-hint">Добавляй аниме в списки, чтобы здесь появились жанры.</p>')+
   '</section></div>'+
   '<section class="profile-status-block profile-recent-block"><div class="profile-block-title"><div><span class="eyebrow">ПОСЛЕДНИЕ ДЕЙСТВИЯ</span><h2>Недавно смотрел</h2></div></div><div class="profile-recent-list">'+recentHtml+'</div></section>'+
 '</section>';
}
