// Home composition: clear editorial shelves without promotional filler.
export function renderHomePage({app,featured,continueCards,popularCards=[],ongoingCards=[],recentCards,row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const popularShelf=popularCards.length?row("Популярное",popularCards,"Популярные тайтлы"): "";
 const ongoingShelf=ongoingCards.length?row("Сейчас выходит",ongoingCards,"Аниме с продолжающимся выходом серий"): "";
 const recentShelf=recentCards.length?row("Свежие релизы",recentCards,"Недавно вышедшие тайтлы"): "";
 const recommendationShelf='<section class="shelf recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>Может понравиться</h2><p class="shelf-sub">На основе оценок и истории просмотра</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Загружаем подборку…</p></div></section>';
 const tonight='<section class="shelf tonight-picker"><div class="shelf-head"><div><h2>Что посмотреть сегодня?</h2><p class="shelf-sub">Подборка из каталога Shikimori.</p></div></div><div class="tonight-controls"><label>Жанр <select id="tonight-genre"><option value="">Любой</option></select></label><label>Формат <select id="tonight-format"><option value="any">Любой</option><option value="movie">Фильм</option><option value="short">Короткий сериал · до 13 серий</option></select></label><button class="btn" type="button" data-a="tonight-pick">Подобрать</button></div><div id="tonight-result" aria-live="polite"></div></section>';
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+tonight+continueShelf+popularShelf+ongoingShelf+recentShelf+recommendationShelf+'</div></div>';
}
