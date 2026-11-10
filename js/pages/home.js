// Home composition: full-width shelves with clear, non-overlapping editorial roles.
export function renderHomePage({app,featured,continueCards,popularCards=[],recommendedCards=[],ongoingCards=[],recentCards,smartTagTiles="",row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const popularShelf=popularCards.length?row("Популярное",popularCards,"Тайтлы, которые чаще добавляют в избранное"):"";
 const ongoingShelf=ongoingCards.length?row("Сейчас выходит",ongoingCards,"Сериалы, у которых продолжается выход серий"):"";
 const recentShelf=recentCards.length?row("Свежие релизы",recentCards,"Недавно опубликованные тайтлы и обновления"):"";
 const recommendationShelf='<section class="shelf recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>По твоему вкусу</h2><p class="shelf-sub">На основе твоих оценок, списков и истории просмотра</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Подбираем аниме…</p></div></section>';
 const smartTags='<section class="smart-tags-section"><div class="shelf-head"><div><h2>Умные метки</h2><p class="shelf-sub">Сюжетные особенности, найденные в описаниях аниме</p></div></div><div class="smart-tag-grid">'+smartTagTiles+'</div></section>';
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+popularShelf+ongoingShelf+recentShelf+recommendationShelf+smartTags+'</div></div>';
}
