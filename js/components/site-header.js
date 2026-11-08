// Shared navigation: desktop uses a fixed sidebar; mobile keeps a compact bottom bar.
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

function profileLink(){
 return '<a class="av profile-link" href="'+PAGES.profile+'" data-page="profile" aria-label="Профиль" title="Профиль"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.6-3.4 3.1-5.2 7-5.2s6.4 1.8 7 5.2"></path></svg><span>Профиль</span></a>';
}

export function renderSiteHeader(){
 const host=document.getElementById("site-header");
 if(!host)return;
 const links=navLinks(),profile=profileLink();
 host.innerHTML=
  '<aside class="aw-sidebar" aria-label="Основная панель">'+
   '<a class="logo" href="'+PAGES.home+'" data-page="home">AniWatch<span class="logo-dot">.</span></a>'+
   '<div class="sidebar-label">НАВИГАЦИЯ</div>'+
   '<nav class="desktop-nav" aria-label="Основная навигация">'+links+'</nav>'+
   '<div class="sidebar-spacer"></div>'+
   '<div class="sidebar-footer">'+profile+'<span class="sidebar-version">ТВОЁ АНИМЕ-ПРОСТРАНСТВО</span></div>'+
  '</aside>'+
  '<div class="mobile-top"><a class="logo" href="'+PAGES.home+'" data-page="home">AniWatch<span class="logo-dot">.</span></a>'+profile+'</div>';
 const old=document.getElementById("mobile-bottom-nav");
 if(old)old.remove();
 const bottom=document.createElement("nav");
 bottom.id="mobile-bottom-nav";
 bottom.className="bottom-nav";
 bottom.setAttribute("aria-label","Основная навигация");
 bottom.innerHTML=links;
 host.insertAdjacentElement("afterend",bottom);
}
