// Homepage composition: editorial hero, asymmetric discovery and compact viewing history.
function editorialShelf(markup, kind){
 return markup.replace('<section class="shelf"', '<section class="shelf shelf-'+kind+'"');
}
export function renderHomePage({app,featured,continueCards,popularCards=[],recommendedCards=[],ongoingCards=[],recentCards,row}){
 const continueShelf=editorialShelf(row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf"),"continue");
 const popularShelf=popularCards.length?editorialShelf(row("Выбор зрителей",popularCards,"Истории, к которым возвращаются чаще всего"),"popular"):"";
 const ongoingShelf=ongoingCards.length?editorialShelf(row("Сейчас выходит",ongoingCards,"Новые серии появляются здесь"),"ongoing"):"";
 const recentShelf=recentCards.length?editorialShelf(row("Недавние релизы",recentCards,"Последние добавления в каталог"),"recent"):"";
 const recommendationShelf='<section class="shelf shelf-recommendation recommendation-shelf" id="recommendation-shelf"><div class="shelf-head"><div><h2>Твоя следующая история</h2><p class="shelf-sub">Подборка на основе оценок, списков и истории просмотра</p></div></div><div class="recommendation-list row" id="recommendation-cards"><p class="m">Подбираем аниме…</p></div></section>';
 app.innerHTML='<div class="home-layout home-neo-v2"><div class="home-primary">'+
  '<div class="home-masthead"><div><span class="home-kicker">ANIWATCH <i></i> КОЛЛЕКЦИЯ ИСТОРИЙ</span><h1>Найди свою <em>следующую</em> историю.</h1><p>Аниме, к которому хочется возвращаться.</p></div><div class="home-edition"><span>РЕДАКЦИЯ</span><b>01 <i>/</i> 04</b><small>СЕЗОН 2026</small></div></div>'+
  '<div class="home-hero-frame"><div class="home-hero-label"><span>01</span> ВЫБОР ANIWATCH</div><div id="hw">'+featured+'</div></div>'+
  '<div class="home-section-rule"><span>ПЕРСОНАЛЬНАЯ ЛЕНТА</span><i></i><span>ОБНОВЛЯЕТСЯ ПО ТВОЕЙ ИСТОРИИ</span></div>'+
  continueShelf+popularShelf+ongoingShelf+recentShelf+recommendationShelf+
 '</div></div>';
}
