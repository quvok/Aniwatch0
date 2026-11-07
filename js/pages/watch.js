// Watch page template. Playback clock and progress persistence are controlled by the app.
export function renderWatchPage({app,anime,episode,inRoom,state,escapeHtml,backdrop,episodes,episodeTotal,durationLabel}){
 const d=anime,n=episode,total=episodeTotal(d);
 app.innerHTML='<section class="watch-page">'+
 '<div class="watch-head"><div><a class="watch-back" href="#title-'+d.id+'">← К странице аниме</a><h1>'+d.n+'</h1><p>'+d.g.slice(0,3).join(" · ")+' <span>•</span> '+(d.y||"")+' <span>•</span> '+(d.s||"Аниме")+'</p></div>'+
 (inRoom?'<div class="watch-room"><span class="live-dot"></span><div><b>Совместный просмотр</b><small>Комната '+escapeHtml(state.room)+'</small></div><button type="button" class="room-leave" data-a="room-leave">Выйти</button></div>':'<span class="watch-mode">Личный просмотр</span>')+
 '</div><div class="watch-layout'+(inRoom?' has-chat':'')+'"><div class="watch-main">'+
 '<div class="player-wrap"><div class="player" style="background:'+backdrop(d)+'"><div class="shade"></div><span class="player-label">ANIWATCH <i>•</i> '+(inRoom?'WATCH PARTY':'PLAYER')+'</span><button class="play" data-a="pp" aria-label="Воспроизвести или поставить на паузу">▶</button><b class="cap">'+d.n+' · серия '+n+'</b><div class="ctl"><span id="tc"></span><div class="bar" data-a="seek"><i id="pg"></i></div><span>'+durationLabel(1420)+'</span><button data-a="sp" id="sp">1×</button></div></div></div>'+
 '<div class="watch-toolbar"><div><b>Серия '+n+'</b><span>из '+(total||'?')+'</span></div><div class="nv">'+(n>1?'<a class="btn ghost" href="#watch-'+d.id+'-'+(n-1)+'">← Предыдущая</a>':"")+'<a class="btn ghost" href="#title-'+d.id+'">Об аниме</a>'+(n<total?'<a class="btn" href="#watch-'+d.id+'-'+(n+1)+'">Следующая серия →</a>':"")+'</div></div>'+
 '<div class="watch-hint"><span>ⓘ</span><p>Это демонстрационный плеер AniWatch. Пробел — пауза, ←/→ — перемотка на 10 секунд. Видеоисточник пока не подключён.</p></div>'+
 '<section class="watch-episodes"><div class="watch-section-title"><div><span class="eyebrow">ПРОСМОТР</span><h2>Все серии</h2></div><span>'+(total||"—")+' серий</span></div><div class="eps">'+episodes(d,n)+'</div></section>'+
 '</div>'+
 (inRoom?'<aside class="chat"><div class="chat-head"><div><span class="live-dot"></span><div><h3>Чат комнаты</h3><small>Совместный просмотр · '+escapeHtml(state.room)+'</small></div></div><span class="chat-online">● В комнате</span></div><div id="ms"><p class="chat-empty">Начните общение — сообщения появятся здесь.</p></div><form id="cf"><input id="ci" placeholder="Написать сообщение…" autocomplete="off"><button aria-label="Отправить">➤</button></form></aside>':"")+
 '</div></section>';
}
