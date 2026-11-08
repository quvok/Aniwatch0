// Shared navigation: desktop sidebar and compact mobile bottom bar.
import {PAGES} from "../core/router.js";

const NAV=[
 ["home","Главная","⌂"],
 ["catalog","Каталог","▦"],
 ["mylist","Мои списки","♡"],
 ["collections","Коллекции","▤"],
 ["together","Вместе","⇄"]
];

function navLinks(){
 return NAV.map(([page,label,mark])=>'<a href="'+PAGES[page]+'" data-page="'+page+'"><span class="nav-mark" aria-hidden="true">'+mark+'</span><span>'+label+'</span></a>').join("");
}

export function renderSiteHeader(){
 const host=document.getElementById("site-header");
 if(!host)return;
 const links=navLinks();
 const profile='<a class="av profile-link" href="'+PAGES.profile+'" aria-label="Профиль" title="Профиль"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.6-3.4 3.1-5.2 7-5.2s6.4 1.8 7 5.2"></path></svg></a>';
 host.innerHTML='<aside class="desktop-sidebar"><a class="sidebar-logo logo" href="'+PAGES.home+'" data-page="home">AniWatch</a><span class="sidebar-caption">ТВОЁ АНИМЕ-ПРОСТРАНСТВО</span><nav class="desktop-sidebar-nav" aria-label="Основная навигация">'+links+'</nav><div class="sidebar-footer"><span class="sidebar-footer-mark">A</span><span><b>Смотри своё</b><small>Открывай новые истории</small></span></div></aside><div class="header-top"><a class="logo mobile-logo" href="'+PAGES.home+'" data-page="home">AniWatch</a><div class="header-tools">'+profile+'</div></div>';
 const old=document.getElementById("mobile-bottom-nav");
 if(old)old.remove();
 const bottom=document.createElement("nav");
 bottom.id="mobile-bottom-nav";
 bottom.className="bottom-nav";
 bottom.setAttribute("aria-label","Основная навигация");
 bottom.innerHTML=links;
 host.insertAdjacentElement("afterend",bottom);
}
