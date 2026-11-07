export function activePage(){
 return location.hash.slice(1).split("-")[0]||"home";
}

export function updateNavigation(state){
 const page=activePage();
 const avatar=document.querySelector(".av");
 if(avatar)avatar.textContent=(state.name||"Г")[0].toUpperCase();
 document.documentElement.style.setProperty("--ac",state.acc);
 document.querySelectorAll("nav a").forEach(link=>{
  link.classList.toggle("on",link.getAttribute("href")==="#"+page);
 });
}

export function renderRoute(pages,timers,beforeRender,state){
 timers.forEach(clearInterval);
 timers.length=0;
 if(beforeRender)beforeRender();
 const parts=location.hash.slice(1).split("-");
 const render=Object.prototype.hasOwnProperty.call(pages,parts[0])?pages[parts[0]]:pages.home;
 render(parts.slice(1).map(Number));
 updateNavigation(state||{});
}
