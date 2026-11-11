import {pageUrl} from "../core/router.js";
export function renderRandomLoading(app){
 app.innerHTML='<section class="random-page"><div class="eyebrow">НЕ ЗНАЕШЬ, ЧТО ПОСМОТРЕТЬ?</div><h1>Случайное аниме</h1><p>Подберём для тебя случайное аниме.</p><div class="random-loader"><span class="live-dot"></span> Ищем аниме…</div></section>';
}

export function renderRandomError(app){
 const box=app.querySelector(".random-page");
 if(box)box.innerHTML='<div class="eyebrow">НЕ ЗНАЕШЬ, ЧТО ПОСМОТРЕТЬ?</div><h1>Случайное аниме</h1><p>Не удалось подобрать аниме. Попробуй ещё раз.</p><button class="btn" type="button" data-a="random">Попробовать ещё раз</button><a class="btn ghost" href="'+pageUrl("catalog")+'">Открыть каталог</a>';
}
