import {pageUrl} from "../core/router.js";

// Home composition: real catalog collections are split between the main feed and a compact side rail.
export function renderHomePage({app,featured,continueCards,trendingCards,popularCards=[],ongoingCards=[],recentCards,genreTiles,row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const trendingShelf=row("В тренде",trendingCards,"Тайтлы, которые сейчас набирают интерес");
 const recentShelf=recentCards.length?row("Недавно вышло",recentCards,"Последние вышедшие и продолжающиеся тайтлы"):"";
 const genres='<section class="genre-section"><div class="shelf-head"><div><h2>Найди своё настроение</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="'+pageUrl("catalog")+'" class="text-link">Весь каталог ↗</a></div><div class="genre-grid">'+genreTiles+'</div></section>';
 const railSection=(title,kicker,cards,kind)=>cards.length?'<section class="rail-panel rail-'+kind+'"><div class="rail-heading"><span>'+kicker+'</span><h2>'+title+'</h2></div><div class="rail-list">'+cards.slice(0,5).join("")+'</div></section>':"";
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+trendingShelf+recentShelf+genres+'</div><aside class="home-rail" aria-label="Подборки каталога">'+railSection("Сейчас выходит","ОНГОИНГИ",ongoingCards,"ongoing")+railSection("Популярное","ВЫБОР ЗРИТЕЛЕЙ",popularCards,"popular")+'</aside></div>';
}
