import {pageUrl} from "../core/router.js";

// Home composition: real catalog collections are split between the main feed and a compact side rail.
export function renderHomePage({app,featured,continueCards,trendingCards,popularCards=[],ongoingCards=[],recentCards,genreTiles,row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const trendingShelf=row("Рекомендуем",trendingCards,"Популярные тайтлы для тебя");
 const popularShelf=popularCards.length?row("Выбор зрителей",popularCards,"Тайтлы, которые выбирают и смотрят чаще всего"):"";
 const ongoingShelf=ongoingCards.length?row("Онгоинг",ongoingCards,"Аниме, новые серии которого выходят сейчас"):"";
 const recentShelf=recentCards.length?row("Недавно вышло",recentCards,"Новые серии и премьеры"):"";
 const recommendationShelf='<section class="shelf recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>Тебе может понравиться</h2><p class="shelf-sub">Подборка постепенно учится на твоих оценках и списках</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Подбираем аниме…</p></div></section>';
 const genres='<section class="genre-section"><div class="shelf-head"><div><h2>Найди своё настроение</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="'+pageUrl("catalog")+'" class="text-link">Весь каталог ↗</a></div><div class="genre-grid">'+genreTiles+'</div></section>';
 const railSection=(title,kicker,cards,kind)=>cards.length?'<section class="rail-panel rail-'+kind+'"><div class="rail-heading"><span>'+kicker+'</span><h2>'+title+'</h2></div><div class="rail-list">'+cards.slice(0,5).join("")+'</div></section>':"";
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+trendingShelf+popularShelf+ongoingShelf+recommendationShelf+recentShelf+genres+'</div></div>';
}
