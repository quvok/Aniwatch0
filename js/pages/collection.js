// Presentational pages for the user's saved collection and local profile.
export function renderFavorites({app,state,mediaMap,card}){
 const items=state.fav.filter(id=>mediaMap[id]).map(id=>card(mediaMap[id]));
 app.innerHTML='<h2>Избранное</h2>'+(items.length?'<div class="row">'+items.join("")+'</div>':'<p class="empty">Пока пусто. Нажмите «♡ В избранное» на странице тайтла.</p>');
}

export function renderMyList({app,state,mediaMap,filters,lists,card}){
 const key=filters.listStatus||"all",items=state.watchlist||{};
 const ids=Object.keys(items)
  .filter(id=>key==="all"||items[id]===key)
  .map(Number)
  .filter(id=>mediaMap[id])
  .sort((a,b)=>mediaMap[a].n.localeCompare(mediaMap[b].n));
 app.innerHTML='<div class="list-heading"><div><div class="eyebrow">ТВОЯ КОЛЛЕКЦИЯ</div><h1>Мои списки</h1><p>Отмечай просмотренное и планируй, что посмотреть дальше.</p></div><b>'+ids.length+'</b></div><div class="list-chips">'+[["all","Все"],...lists].map(item=>'<button type="button" data-a="list-filter" data-v="'+item[0]+'" class="'+(key===item[0]?"on":"")+'">'+item[1]+'</button>').join("")+'</div><div class="list-results">'+(ids.length?'<div class="row">'+ids.map(id=>card(mediaMap[id])).join("")+'</div>':'<p class="empty">В этом списке пока пусто. Открой страницу любого аниме и выбери статус.</p>')+'</div>';
}

export function renderProfile({app,state,escapeHtml}){
 app.innerHTML='<h2>Локальный профиль</h2><div class="panel account-panel"><div class="account-head"><div class="account-avatar">'+escapeHtml((state.name||"Гость").slice(0,1).toUpperCase())+'</div><div><b>'+escapeHtml(state.name||"Гость")+'</b><p class="m">Данные хранятся в этом браузере</p></div></div><form id="profile-form" class="auth-form"><label>Ник<input id="nm" value="'+escapeHtml(state.name||"Гость")+'" maxlength="20" required></label><button class="btn" type="submit">Сохранить ник</button></form><p class="m">Избранное: '+state.fav.length+' · История: '+Object.keys(state.hist).length+' · Оценки: '+Object.keys(state.rate).length+'</p><p class="m">Пока данные доступны только на этом устройстве. При переносе на сервер добавим регистрацию и синхронизацию.</p><button class="btn ghost" data-a="reset" style="justify-self:start">Сбросить локальные данные</button></div>';
}
