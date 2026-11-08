// Shared site header. One source of truth for every HTML page.
import {PAGES} from "../core/router.js";

const NAV=[
 ["home","Главная","⌂"],
 ["catalog","Каталог","▦"],
 ["schedule","Расписание","◷"],
 ["mylist","Мои списки","♡"],
 ["collections","Коллекции","▤"],
 ["together","Вместе","⇄"]
];

export function renderSiteHeader(){
 const host=document.getElementById("site-header");
 if(!host)return;
 const links=NAV.map(([page,label,mark])=>'<a href="'+PAGES[page]+'" data-page="'+page+'"><span class="nav-mark" aria-hidden="true">'+mark+'</span><span>'+label+'</span></a>').join("");
 host.innerHTML='<div class="header-top"><a class="logo" href="'+PAGES.home+'">AniWatch</a><div class="header-tools"><a class="av" href="'+PAGES.profile+'" aria-label="Профиль" title="Профиль"></a></div></div>'+
  '<nav class="bottom-nav" aria-label="Основная навигация">'+links+'</nav>';
}
