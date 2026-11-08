import {pageUrl} from "../core/router.js";
export function renderSchedulePage(app){
 app.innerHTML='<div class="catalog-heading"><div><div class="eyebrow">Время вашего устройства</div><h1>Расписание серий</h1><p>Что выходит ближайшие 7 дней и сколько осталось до новой серии.</p></div></div><div class="chips" id="sdays"></div><div id="slist"><p class="empty">Загрузка…</p></div>';
}

export function renderRandomLoading(app){
 app.innerHTML='<section class="random-page"><div class="eyebrow">НЕ ЗНАЕШЬ, ЧТО ПОСМОТРЕТЬ?</div><h1>Случайное аниме</h1><p>Подберём случайный тайтл из каталога Shikimori.</p><div class="random-loader"><span class="live-dot"></span> Ищем аниме…</div></section>';
}

export function renderRandomError(app){
 const box=app.querySelector(".random-page");
 if(box)box.innerHTML='<div class="eyebrow">НЕ ЗНАЕШЬ, ЧТО ПОСМОТРЕТЬ?</div><h1>Случайное аниме</h1><p>Не получилось получить случайный тайтл из Shikimori.</p><button class="btn" type="button" data-a="random">Попробовать ещё раз</button><a class="btn ghost" href="'+pageUrl("catalog")+'">Открыть каталог</a>';
}
