// Shared site header. Desktop: centered navigation; mobile: compact bottom bar.
import {PAGES} from "../core/router.js";

const NAV=[
 ["home","Главная","⌂"],
 ["catalog","Каталог","▦"],
 ["schedule","Расписание","◷"],
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
 const profile='<a class="av profile-link" href="'+PAGES.profile+'" data-page="profile" aria-label="Профиль" title="Профиль"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.6-3.4 3.1-5.2 7-5.2s6.4 1.8 7 5.2"></path></svg></a>';
 host.innerHTML='<div class="header-top"><a class="logo" href="'+PAGES.home+'" data-page="home">AniWatch</a><nav class="desktop-nav" aria-label="Основная навигация">'+links+'</nav><div class="header-tools">'+profile+'</div></div>';\n const old=document.getElementById("mobile-bottom-nav");\n if(old)old.remove();\n const bottom=document.createElement("nav");\n bottom.id="mobile-bottom-nav";\n bottom.className="bottom-nav";\n bottom.setAttribute("aria-label","Основная навигация");\n bottom.innerHTML=links;\n host.insertAdjacentElement("afterend",bottom);
}
