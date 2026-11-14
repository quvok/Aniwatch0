// Home composition: clear editorial shelves without promotional filler.
export function renderHomePage({app,featured,continueCards,popularCards=[],recommendedCards=[],ongoingCards=[],recentCards,row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const popularShelf=popularCards.length?row("Популярное",popularCards,"Популярные тайтлы"): "";
 const ongoingShelf=ongoingCards.length?row("Сейчас выходит",ongoingCards,"Аниме с продолжающимся выходом серий"): "";
 const recentShelf=recentCards.length?row("Свежие релизы",recentCards,"Недавно вышедшие тайтлы"): "";
 const recommendationShelf='<section class="shelf recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>Может понравиться</h2><p class="shelf-sub">На основе оценок и истории просмотра</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Загружаем подборку…</p></div></section>';
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+popularShelf+ongoingShelf+recentShelf+recommendationShelf+'</div></div>';
}
