import {pageUrl} from "../core/router.js";
// The home page reuses the existing data collections; the redesign changes composition, not data sources.
export function renderHomePage({app,featured,continueCards,trendingCards,popularCards=[],ongoingCards=[],recentCards,genreTiles,row}){
 const asideSection=(title,subtitle,cards,empty)=>'<section class="home-aside-section"><div class="home-aside-head"><div><h2>'+title+'</h2><p>'+subtitle+'</p></div></div><div class="home-aside-list">'+(cards.length?cards.slice(0,5).join(""):'<p class="home-aside-empty">'+empty+'</p>')+'</div></section>';
 app.innerHTML=
  '<div class="home-dashboard">'+
   '<div class="home-feed">'+
    '<div id="hw">'+featured+'</div>'+
    row("Продолжить просмотр",continueCards.length?continueCards:['<p class="m">Начни смотреть аниме — здесь появится твой прогресс.</p>'],"Вернись к серии, на которой остановился","continue-shelf")+
    row("В тренде",trendingCards,"Популярные тайтлы каталога")+
    (recentCards.length?row("Недавно вышло",recentCards,"Последние вышедшие и продолжающиеся тайтлы"):"")+
    '<section class="genre-section"><div class="shelf-head"><div><h2>Найди своё настроение</h2><p class="shelf-sub">Выбери жанр и погружайся</p></div><a href="'+pageUrl("catalog")+'" class="text-link">Весь каталог ↗</a></div><div class="genre-grid">'+genreTiles+'</div></section>'+
   '</div>'+
   '<aside class="home-aside" aria-label="Подборки каталога">'+
    asideSection("Популярное","Самые востребованные тайтлы",popularCards,"Пока нет данных о популярности.")+
    asideSection("Онгоинги","Аниме с продолжающимся выходом серий",ongoingCards,"Сейчас нет данных об онгоингах.")+
   '</aside>'+
  '</div>';
}
