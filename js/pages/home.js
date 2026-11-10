import {pageUrl} from "../core/router.js";

// Home composition: full-width shelves with clear, non-overlapping editorial roles.
export function renderHomePage({app,featured,continueCards,popularCards=[],recommendedCards=[],ongoingCards=[],recentCards,genreTiles,smartTagTiles="",row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const popularShelf=popularCards.length?row("Популярное",popularCards,"Тайтлы, которые чаще добавляют в избранное"):"";
 const ongoingShelf=ongoingCards.length?row("Сейчас выходит",ongoingCards,"Сериалы, у которых продолжается выход серий"):"";
 const recentShelf=recentCards.length?row("Свежие релизы",recentCards,"Недавно опубликованные тайтлы и обновления"):"";
 const recommendationShelf='<section class="shelf recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>По твоему вкусу</h2><p class="shelf-sub">На основе твоих оценок, списков и истории просмотра</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Подбираем аниме…</p></div></section>';
 const smartTags='<section class="smart-tags-section"><div class="shelf-head"><div><h2>Умные метки</h2><p class="shelf-sub">Быстрые подборки по параметрам каталога</p></div></div><div class="smart-tag-grid">'+smartTagTiles+'</div></section>';
 const genres='<section class="genre-section"><div class="shelf-head"><div><h2>Жанры</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="'+pageUrl("catalog")+'" class="text-link">Весь каталог ↗</a></div><div class="genre-grid" id="home-genre-grid">'+genreTiles+'</div></section>';
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+popularShelf+ongoingShelf+recentShelf+recommendationShelf+smartTags+genres+'</div></div>';
}
