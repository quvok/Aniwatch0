import {pageUrl} from "../core/router.js";

// Home composition: real catalog collections are split between the main feed and a compact side rail.
export function renderHomePage({app,featured,continueCards,trendingCards,popularCards=[],ongoingCards=[],recentCards,genreTiles,row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const trendingShelf=row("Лучшие всех времён",trendingCards,"Высокие оценки AniLibria среди популярных релизов");
 const recentShelf=recentCards.length?row("Недавно вышло",recentCards,"Последние вышедшие и продолжающиеся тайтлы"):"";
 const recommendationShelf='<section class="shelf recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>Тебе может понравиться</h2><p class="shelf-sub">Подборка по твоим оценкам и жанрам из каталога AniLibria</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Подбираем аниме…</p></div></section>';
 const genres='<section class="genre-section"><div class="shelf-head"><div><h2>Найди своё настроение</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="'+pageUrl("catalog")+'" class="text-link">Весь каталог ↗</a></div><div class="genre-grid">'+genreTiles+'</div></section>';
 const railSection=(title,kicker,cards,kind)=>cards.length?'<section class="rail-panel rail-'+kind+'"><div class="rail-heading"><span>'+kicker+'</span><h2>'+title+'</h2></div><div class="rail-list">'+cards.slice(0,15).join("")+'</div></section>':"";
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+trendingShelf+recommendationShelf+recentShelf+genres+'</div><aside class="home-rail" aria-label="Подборки каталога">'+railSection("Сейчас выходит","ОНГОИНГИ",ongoingCards,"ongoing")+railSection("Популярное","ПОПУЛЯРНОСТЬ ANILIBRIA",popularCards,"popular")+'</aside></div>';
}
