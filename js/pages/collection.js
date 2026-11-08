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

export function renderProfile({app,state,escapeHtml,user}){
 const watchlist=state.watchlist||{},counts={watching:0,planned:0,completed:0,dropped:0};
 Object.values(watchlist).forEach(status=>{if(Object.prototype.hasOwnProperty.call(counts,status))counts[status]++});
 const rated=Object.values(state.rate||{}).map(Number).filter(value=>Number.isFinite(value)&&value>0),average=rated.length?(rated.reduce((sum,value)=>sum+value,0)/rated.length).toFixed(1):"—";
 const total=Object.keys(watchlist).length,history=Object.values(state.hist||{}),started=history.length;
 const progress=total?Math.round(counts.completed/total*100):0;
 const fav=(state.fav||[]).length,initial=String(state.name||user?.email||"A").trim().slice(0,1).toUpperCase();
 const account=user
  ? '<div class="profile-account-state"><span class="profile-state-dot"></span><span>Аккаунт подключён</span><small>Данные синхронизируются с облаком</small></div>'
  : '<div class="profile-account-state is-local"><span class="profile-state-dot"></span><span>Локальный профиль</span><small>Войди, чтобы сохранять коллекцию между устройствами</small></div>';
 const accountCard=user
  ? '<div class="profile-account-card"><div class="account-avatar profile-avatar">'+escapeHtml(initial)+'</div><div class="profile-account-copy"><b>'+escapeHtml(state.name||"Пользователь")+'</b><span>'+escapeHtml(user.email||"")+'</span><small>Управление аккаунтом</small></div><button class="btn ghost" type="button" data-a="auth-logout">Выйти</button></div>'
  : '<div class="auth-box profile-auth-box"><div class="auth-heading"><span class="eyebrow">ANIWATCH ACCOUNT</span><h2>Смотри на любом устройстве</h2><p>Войди или создай аккаунт, чтобы синхронизировать избранное, списки и историю просмотра.</p></div><div class="auth-tabs"><button type="button" class="on" data-a="auth-mode" data-v="login" data-auth-mode="login">Вход</button><button type="button" data-a="auth-mode" data-v="signup" data-auth-mode="signup">Регистрация</button></div><form id="auth-form" class="auth-form" novalidate><input type="hidden" name="auth-mode" value="login"><label id="auth-username-wrap" hidden>Ник<input id="auth-username" type="text" maxlength="20" autocomplete="nickname" placeholder="Придумай уникальный ник"></label><label id="auth-login-wrap">Логин или электронная почта<input id="auth-login" type="text" autocomplete="username" placeholder="Ник или name@example.com" required></label><label id="auth-email-wrap" hidden>Электронная почта<input id="auth-email" type="email" autocomplete="email" placeholder="name@example.com"></label><label>Пароль<input id="auth-password" type="password" autocomplete="current-password" minlength="6" placeholder="Минимум 6 символов" required></label><button class="btn auth-submit" id="auth-submit" type="submit">Войти</button><p id="auth-message" class="auth-message" role="status" aria-live="polite"></p></form></div>';
 app.innerHTML='<section class="profile-hero"><div class="profile-hero-glow"></div><div class="profile-hero-main"><div class="profile-avatar profile-avatar-large">'+escapeHtml(initial)+'</div><div class="profile-identity"><span class="eyebrow">ТВОЁ ПРОСТРАНСТВО В ANIWATCH</span><h1>'+escapeHtml(state.name||"Гость")+'</h1><p>'+(user?'Персональная коллекция и история просмотра':'Локальный профиль · твоя коллекция на этом устройстве')+'</p>'+account+'</div></div><div class="profile-hero-side"><span>ТВОЙ РЕЙТИНГ</span><b>★ '+average+'</b><small>'+(rated.length? rated.length+" оценок":"Пока нет оценок")+'</small></div></section>'+
 '<section class="profile-dashboard"><div class="profile-section-heading"><div><span class="eyebrow">СТАТИСТИКА</span><h2>Твоя активность</h2></div><span class="profile-section-note">'+total+' тайтлов в списках</span></div>'+
 '<div class="profile-stats profile-stats-modern"><div><b>'+total+'</b><span>В коллекции</span><i>Все списки</i></div><div><b>'+counts.watching+'</b><span>Смотрю сейчас</span><i>В процессе</i></div><div><b>'+counts.completed+'</b><span>Просмотрено</span><i>Завершено</i></div><div><b>'+fav+'</b><span>Избранное</span><i>Сохранённые тайтлы</i></div><div><b>'+started+'</b><span>Начато</span><i>История просмотра</i></div><div><b>'+average+'</b><span>Средняя оценка</span><i>'+rated.length+' оценок</i></div></div>'+
 '<div class="profile-progress-card"><div class="profile-progress-copy"><div><b>Прогресс коллекции</b><span>Завершённые тайтлы от всех добавленных</span></div><strong>'+progress+'%</strong></div><div class="profile-progress-track"><i style="width:'+progress+'%"></i></div><div class="profile-progress-foot"><span>'+counts.completed+' завершено</span><span>'+(total-counts.completed)+' осталось</span></div></div></section>'+
 '<section class="profile-lower"><div class="panel profile-settings"><div class="profile-section-heading"><div><span class="eyebrow">ПЕРСОНАЛИЗАЦИЯ</span><h2>Настройки профиля</h2></div></div><form id="profile-form" class="auth-form profile-nick"><label>Отображаемый ник<input id="nm" value="'+escapeHtml(state.name||"Гость")+'" maxlength="20" required placeholder="Твой ник"></label><button class="btn" type="submit">Сохранить изменения</button></form><p class="profile-hint">Этот ник будут видеть другие участники совместного просмотра.</p></div>'+
 '<div class="panel profile-data-panel"><div class="profile-section-heading"><div><span class="eyebrow">ТВОИ ДАННЫЕ</span><h2>Резервная копия</h2></div></div><p>Сохрани свою коллекцию в файл или восстанови её из ранее созданной копии.</p><div class="backup-actions"><button class="btn" type="button" data-a="export">Экспортировать</button><button class="btn ghost" type="button" data-a="import">Импортировать</button><input id="backup-file" type="file" accept="application/json,.json" hidden></div><button class="profile-reset" type="button" data-a="reset">Сбросить локальные данные</button></div></section>'+
 (user?'':'<section class="profile-login-section">'+accountCard+'</section>');
}
