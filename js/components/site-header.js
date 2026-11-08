// Shared site header. One source of truth for every HTML page.
import {PAGES} from "../core/router.js";

const NAV=[
 ["home","Главная",""],
 ["catalog","Каталог",""],
 ["schedule","Эфир","Расписание выхода серий"],
 ["favorites","Избранное",""],
 ["mylist","Мои списки",""],
 ["together","Вместе","Совместный просмотр"]
];

export function renderSiteHeader(){
 const host=document.getElementById("site-header");
 if(!host)return;
 const links=NAV.map(([page,label,hint])=>'<a href="'+PAGES[page]+'" data-page="'+page+'"'+(hint?' title="'+hint+'"':"")+'>'+label+'</a>').join("");
 host.innerHTML='<a class="logo" href="'+PAGES.home+'">AniWatch</a>'+
  '<nav aria-label="Основная навигация">'+links+'</nav>'+
  '<form id="site-search" class="site-search" action="'+PAGES.catalog+'" method="get" role="search">'+
  '<input id="q" name="q" placeholder="Поиск…" autocomplete="off" aria-label="Поиск по каталогу"></form>'+
  '<a class="av" href="'+PAGES.profile+'" aria-label="Профиль"></a>';
}
