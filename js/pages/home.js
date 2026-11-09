import {pageUrl} from "../core/router.js";

// Keep every discovery collection in the same full-width feed on desktop and mobile.
export function renderHomePage({app,featured,continueCards,trendingCards,popularCards=[],ongoingCards=[],recentCards,genreTiles,row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const trendingShelf=row("Лучшие всех времён",trendingCards,"Высокие оценки Shikimori");
 const ongoingShelf=ongoingCards.length?row("Сейчас выходит",ongoingCards,"Онгоинги Shikimori"):"";
 const popularShelf=popularCards.length?row("Популярное",popularCards,"Популярность по данным Shikimori"):"";
 const recentShelf=recentCards.length?row("Недавно вышло",recentCards,"Последние вышедшие и продолжающиеся тайтлы"):"";
 const recommendationShelf='<section class="shelf recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>Тебе может понравиться</h2><p class="shelf-sub">Подборка постепенно учится на твоих оценках и списках</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Подбираем аниме…</p></div></section>';
 const genres='<section class="genre-section"><div class="shelf-head"><div><h2>Найди своё настроение</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="'+pageUrl("catalog")+'" class="text-link">Весь каталог ↗</a></div><div class="genre-grid">'+genreTiles+'</div></section>';
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+trendingShelf+ongoingShelf+popularShelf+recommendationShelf+recentShelf+genres+'</div></div>';
}
