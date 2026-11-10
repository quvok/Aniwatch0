import { watchUrl } from "../core/router.js";

function personAvatar(person, escapeHtml) {
 const name = String(person?.username || "Пользователь").trim();
 const initial = escapeHtml(name.slice(0, 1).toUpperCase() || "?");
 const url = String(person?.avatar_url || "");
 return url.startsWith("https://")
  ? '<img src="' + escapeHtml(url) + '" alt="">'
  : '<span>' + initial + '</span>';
}

export function renderTogetherPage({ app, state, animeList, escapeHtml, user, social, error }) {
 const animeName = id => (animeList || []).find(item => Number(item.id) === Number(id))?.n || ("Аниме #" + id);
 const requests = social?.incomingRequests || [];
 const outgoing = social?.outgoingRequests || [];
 const friends = social?.friends || [];
 const invites = social?.incomingInvites || [];
 const sentInvites = social?.outgoingInvites || [];
 const pendingTotal = requests.length + invites.length;
 const friendRows = friends.length ? friends.map(friend =>
  '<article class="social-person"><div class="social-avatar">' + personAvatar(friend, escapeHtml) + '</div><div class="social-person-info"><b>' + escapeHtml(friend.username) + '</b><small>Уже в друзьях</small></div><button class="social-remove" type="button" data-a="friend-remove" data-id="' + escapeHtml(friend.request_id) + '">Удалить</button></article>'
 ).join("") : '<p class="social-empty">Пока нет друзей. Найди знакомых по нику выше.</p>';
 const requestRows = requests.length ? requests.map(row =>
  '<article class="social-person"><div class="social-avatar">' + personAvatar(row.person, escapeHtml) + '</div><div class="social-person-info"><b>' + escapeHtml(row.person.username) + '</b><small>Хочет добавить тебя в друзья</small></div><div class="social-actions"><button class="btn" type="button" data-a="friend-accept" data-id="' + escapeHtml(row.id) + '">Принять</button><button class="social-remove" type="button" data-a="friend-decline" data-id="' + escapeHtml(row.id) + '">Отклонить</button></div></article>'
 ).join("") : '<p class="social-empty">Новых заявок нет.</p>';
 const outgoingRows = outgoing.length ? '<div class="social-sublist"><b>Ожидают ответа</b>' + outgoing.map(row =>
  '<div class="social-outgoing"><span>' + escapeHtml(row.person.username) + '</span><small>Заявка отправлена</small><button type="button" data-a="friend-remove" data-id="' + escapeHtml(row.id) + '">Отменить</button></div>'
 ).join("") + '</div>' : "";
 const inviteRows = invites.length ? invites.map(invite =>
  '<article class="social-person social-invite"><div class="social-avatar">' + personAvatar(invite.person, escapeHtml) + '</div><div class="social-person-info"><b>' + escapeHtml(invite.person.username) + '</b><small>Приглашает смотреть «' + escapeHtml(animeName(invite.anime_id)) + '», серия ' + Number(invite.episode || 1) + '</small></div><div class="social-actions"><button class="btn" type="button" data-a="invite-accept" data-id="' + escapeHtml(invite.id) + '" data-room="' + escapeHtml(invite.room_code) + '" data-anime="' + Number(invite.anime_id) + '" data-episode="' + Number(invite.episode || 1) + '">Присоединиться</button><button class="social-remove" type="button" data-a="invite-decline" data-id="' + escapeHtml(invite.id) + '">Отклонить</button></div></article>'
 ).join("") : '<p class="social-empty">Пока никто не приглашал тебя смотреть вместе.</p>';
 const sentInviteRows = sentInvites.length ? '<div class="social-sublist"><b>Отправленные приглашения</b>' + sentInvites.map(invite =>
  '<div class="social-outgoing"><span>' + escapeHtml(invite.person.username) + '</span><small>Комната ' + escapeHtml(invite.room_code) + ' · ожидает ответа</small></div>'
 ).join("") + '</div>' : "";
 app.innerHTML =
  '<section class="together-hero"><div class="eyebrow"><span class="live-dot"></span> ANIWATCH COMMUNITY</div><h1>Твои <span>друзья</span></h1><p>Находи знакомых по нику, принимай заявки и собирай компанию для совместного просмотра. Все связи и приглашения хранятся в аккаунте.</p><div class="together-steps"><span>01 · Найди пользователя</span><span>02 · Добавь в друзья</span><span>03 · Смотри вместе</span></div></section>' +
  '<section class="social-hub"><div class="social-heading"><div><span class="eyebrow">ТВОЁ СООБЩЕСТВО</span><h2>Друзья</h2><p>Твои контакты на AniWatch.</p></div><button class="social-refresh" type="button" data-a="social-reload" aria-label="Обновить список друзей">↻ Обновить</button></div>' +
  (user ?
   '<section class="social-card social-friends"><div class="social-card-title"><h3>Мои друзья</h3><span>' + friends.length + '</span></div><div class="social-list">' + friendRows + '</div></section>' +
   '<section class="social-search panel"><form id="friend-search-form"><div><label for="friend-search">Найти пользователя</label><small>Введи часть его ника — почта не показывается.</small></div><div class="social-search-controls"><input id="friend-search" maxlength="32" placeholder="Например, animefan" autocomplete="off" required><button class="btn" type="submit">Найти</button></div></form><div id="friend-search-results" aria-live="polite"></div></section>' +
   '<div class="social-columns"><section class="social-card"><div class="social-card-title"><h3>Заявки в друзья</h3><span>' + requests.length + '</span></div><div class="social-list">' + requestRows + '</div>' + outgoingRows + '</section></div>' +
   '<section class="social-card social-invites"><div class="social-card-title"><h3>Совместный просмотр</h3><span>' + invites.length + '</span></div><div class="social-list">' + inviteRows + '</div>' + sentInviteRows + '</section>'
   : '<div class="social-login panel"><h3>Войди, чтобы завести друзей</h3><p>Друзья, заявки и приглашения будут синхронизироваться между устройствами.</p><button class="btn" type="button" data-a="profile-entry">Войти или зарегистрироваться</button></div>') +
  (error ? '<p class="social-error">' + escapeHtml(error) + '</p>' : '') +
  '</section>' +
  '<section class="together-grid"><div class="panel together-panel"><span class="eyebrow">НОВАЯ КОМНАТА</span><h2>Стань ведущим</h2><p>Создай комнату, затем выбери аниме на главной странице или в каталоге. Друзья смогут присоединиться по приглашению.</p><button class="btn" type="button" data-a="room">Создать комнату и выбрать аниме</button></div>' +
  '<div class="panel together-panel"><span class="eyebrow">УЖЕ ЕСТЬ КОД?</span><h2>Присоединиться</h2><p>Введи код активной комнаты. Ведущий должен уже находиться на странице просмотра — тогда AniWatch получит от него аниме и текущую серию.</p><form id="jf"><label for="jc">Код комнаты</label><input id="jc" placeholder="Например, 8K4M2P9Q" maxlength="12" autocomplete="off" required><button class="btn ghost" type="submit">Войти в комнату</button></form></div></section>';
}
