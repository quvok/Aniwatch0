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

export function renderProfile({app,state,escapeHtml,user}){
 const watchlist=state.watchlist||{},counts={watching:0,planned:0,completed:0,dropped:0};
 Object.values(watchlist).forEach(status=>{if(Object.prototype.hasOwnProperty.call(counts,status))counts[status]++});
 const rated=Object.values(state.rate||{}).map(Number).filter(value=>Number.isFinite(value)&&value>0);
 const average=rated.length?(rated.reduce((sum,value)=>sum+value,0)/rated.length).toFixed(1):"—";
 const total=Object.keys(watchlist).length,started=Object.keys(state.hist||{}).length,fav=(state.fav||[]).length;
 const progress=total?Math.round(counts.completed/total*100):0;
 const initial=String(state.name||user?.email||"A").trim().slice(0,1).toUpperCase();
 const avatar=typeof state.avatar==="string"&&(/^(https:\/\/|data:image\/)/i).test(state.avatar)
  ?'<img class="profile-avatar-image" src="'+escapeHtml(state.avatar)+'" alt="">':escapeHtml(initial);
 const account=user
  ?'<div class="profile-account-inline"><span class="profile-online-dot"></span><span>Аккаунт синхронизирован</span><button type="button" class="profile-logout" data-a="auth-logout">Выйти</button></div>'
  :'<div class="profile-account-inline is-guest"><span class="profile-online-dot"></span><span>Гостевой профиль · данные на этом устройстве</span><button type="button" class="profile-login" data-a="profile-entry">Войти в аккаунт</button></div>';
 app.innerHTML=
 '<section class="profile-page">'+
  '<header class="profile-top-card"><div class="profile-top-main">'+
   '<button class="profile-avatar profile-avatar-edit" type="button" data-a="profile-avatar" aria-label="Изменить фото">'+avatar+'<span class="profile-avatar-camera">✎</span></button>'+
   '<input id="profile-avatar-file" type="file" accept="image/jpeg,image/png,image/webp" hidden>'+
   '<div class="profile-top-identity"><span class="eyebrow">ЛИЧНЫЙ КАБИНЕТ</span><h1>'+escapeHtml(state.name||"Гость")+'</h1><p>'+(user?escapeHtml(user.email||"Аккаунт AniWatch"):"Твоя история, оценки и коллекция аниме")+'</p></div>'+
  '</div>'+account+'</header>'+
  '<section class="profile-overview"><div class="profile-block-title"><div><span class="eyebrow">ТВОЯ АКТИВНОСТЬ</span><h2>Статистика</h2></div><span>'+total+' в списках</span></div>'+
   '<div class="profile-metric-grid">'+
    '<article><b>'+total+'</b><span>В коллекции</span></article>'+
    '<article><b>'+counts.watching+'</b><span>Смотрю</span></article>'+
    '<article><b>'+counts.completed+'</b><span>Завершено</span></article>'+
    '<article><b>'+fav+'</b><span>Избранное</span></article>'+
   '</div>'+
   '<div class="profile-progress"><div><div><b>Завершение коллекции</b><small>'+counts.completed+' из '+total+' тайтлов</small></div><strong>'+progress+'%</strong></div><div class="profile-progress-track"><i style="width:'+progress+'%"></i></div></div>'+
  '</section>'+
  '<section class="profile-status-block"><div class="profile-block-title"><div><span class="eyebrow">РАСПРЕДЕЛЕНИЕ</span><h2>Мои списки</h2></div><a href="lists.html">Открыть списки ↗</a></div>'+
   '<div class="profile-status-list">'+
    '<div><span class="status-mark watching"></span><span>Смотрю</span><b>'+counts.watching+'</b></div>'+
    '<div><span class="status-mark planned"></span><span>В планах</span><b>'+counts.planned+'</b></div>'+
    '<div><span class="status-mark completed"></span><span>Просмотрено</span><b>'+counts.completed+'</b></div>'+
    '<div><span class="status-mark dropped"></span><span>Брошено</span><b>'+counts.dropped+'</b></div>'+
   '</div>'+
  '</section>'+
  '<section class="profile-bottom-grid">'+
   '<div class="profile-clean-panel"><div class="profile-block-title"><div><span class="eyebrow">ПЕРСОНАЛИЗАЦИЯ</span><h2>Профиль</h2></div></div>'+
    '<form id="profile-form" class="profile-clean-form"><label for="nm">Отображаемое имя</label><input id="nm" value="'+escapeHtml(state.name||"Гость")+'" maxlength="20" required><button class="btn" type="submit">Сохранить имя</button></form>'+
    '<p class="profile-clean-hint">Фото профиля: JPG, PNG или WebP, до 1 МБ.</p>'+
   '</div>'+
   '<div class="profile-clean-panel"><div class="profile-block-title"><div><span class="eyebrow">УПРАВЛЕНИЕ</span><h2>Мои данные</h2></div></div>'+
    '<p class="profile-clean-description">Создай резервную копию коллекции или восстанови данные из файла.</p>'+
    '<div class="profile-clean-actions"><button class="btn" type="button" data-a="export">Экспорт</button><button class="btn ghost" type="button" data-a="import">Импорт</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div>'+
    '<button class="profile-reset" type="button" data-a="reset">Сбросить локальные данные</button>'+
   '</div>'+
  '</section>'+
 '</section>';
}
