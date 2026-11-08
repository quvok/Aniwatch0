import {pageUrl} from "../core/router.js";
export function renderSchedulePage(app){
 app.innerHTML='<section class="schedule-intro"><div class="eyebrow">КАЛЕНДАРЬ РЕЛИЗОВ</div><h1>Расписание серий</h1><p>Новые эпизоды аниме на ближайшие семь дней.</p><div class="schedule-intro-note"><span class="live-dot"></span> Время указано по часовому поясу устройства</div></section><div class="schedule-days-wrap"><div class="schedule-days-label">ВЫБЕРИ ДЕНЬ</div><div class="schedule-days" id="sdays"></div></div><section class="schedule-results"><div class="schedule-results-head"><h2>Выход серий</h2><span>Ближайшие релизы</span></div><div id="slist"><p class="empty">Загрузка расписания…</p></div></section>';
}

export function renderRandomLoading(app){
 app.innerHTML='<section class="random-page"><div class="eyebrow">НЕ ЗНАЕШЬ, ЧТО ПОСМОТРЕТЬ?</div><h1>Случайное аниме</h1><p>Подберём для тебя случайное аниме.</p><div class="random-loader"><span class="live-dot"></span> Ищем аниме…</div></section>';
}

export function renderRandomError(app){
 const box=app.querySelector(".random-page");
 if(box)box.innerHTML='<div class="eyebrow">НЕ ЗНАЕШЬ, ЧТО ПОСМОТРЕТЬ?</div><h1>Случайное аниме</h1><p>Не удалось подобрать аниме. Попробуй ещё раз.</p><button class="btn" type="button" data-a="random">Попробовать ещё раз</button><a class="btn ghost" href="'+pageUrl("catalog")+'">Открыть каталог</a>';
}
