// Home composition: full-width shelves with clear, non-overlapping editorial roles.
export function renderHomePage({app,featured,continueCards,popularCards=[],ongoingCards=[],recentCards,row}){
 const continueShelf=row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf");
 const popularShelf=popularCards.length?row("Популярное",popularCards,"Тайтлы, которые чаще добавляют в избранное"):"";
 const ongoingShelf=ongoingCards.length?row("Сейчас выходит",ongoingCards,"Сериалы, у которых продолжается выход серий"):"";
 const recentShelf=recentCards.length?row("Свежие релизы",recentCards,"Недавно опубликованные тайтлы и обновления"):"";
 app.innerHTML='<div class="home-layout"><div class="home-primary"><div id="hw">'+featured+'</div>'+continueShelf+popularShelf+ongoingShelf+recentShelf+recommendationShelf+'</div></div>';
}
