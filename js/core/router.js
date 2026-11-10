// Multi-page routing. Every screen is a real HTML file; the active screen is named by <body data-page>.
// Parameters travel in the query string (anime.html?id=5, watch.html?id=5&ep=2), never in the hash.
export const PAGES={
 home:"index.html",
 calendar:"calendar.html",
 catalog:"catalog.html",
 favorites:"favorites.html",
 mylist:"lists.html",
 together:"together.html",
 profile:"profile.html",
 random:"random.html",
 title:"anime.html",
 watch:"watch.html",
 collections:"collections.html"
};

const has=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);

export function pageUrl(page,params){
 const base=has(PAGES,page)?PAGES[page]:PAGES.home;
 const query=new URLSearchParams();
 Object.keys(params||{}).forEach(key=>{
  const value=params[key];
  if(value!==undefined&&value!==null&&value!=="")query.set(key,String(value));
 });
 const text=query.toString();
 return base+(text?"?"+text:"");
}

export const titleUrl=id=>pageUrl("title",{id});
export const watchUrl=(id,episode)=>pageUrl("watch",{id,ep:episode||1});

export function activePage(){
 const page=document.body&&document.body.dataset.page;
 return has(PAGES,page)?page:"home";
}

// Numeric route arguments for the views: title → [id], watch → [id, episode].
export function routeArgs(){
 const query=new URLSearchParams(location.search);
 const page=activePage();
 if(page==="title")return[Number(query.get("id"))||0];
 if(page==="watch")return[Number(query.get("id"))||0,Math.max(Number(query.get("ep"))||1,1)];
 if(page==="collections")return[query.get("id")||""];
 if(page==="profile")return[query.get("user")||""];
 return[];
}

export function isRoute(page,id){
 return activePage()===page&&routeArgs()[0]===Number(id);
}

// Old single-page links (index.html#title-12) keep working: they are sent to the new page.
export function legacyRedirect(){
 const raw=String(location.hash||"").replace(/^#/,"");
 if(!raw)return false;
 const parts=raw.split("-"),aliases={home:"home",catalog:"catalog",favorites:"favorites",fav:"favorites",mylist:"mylist",together:"together",profile:"profile",random:"random",title:"title",watch:"watch",collections:"collections"};
 if(!has(aliases,parts[0]))return false;
 const page=aliases[parts[0]];
 let params={};
 if(page==="title")params={id:Number(parts[1])||""};
 if(page==="watch")params={id:Number(parts[1])||"",ep:Number(parts[2])||1};
 const target=pageUrl(page,params);
 const current=(location.pathname.split("/").pop()||PAGES.home)+location.search;
 if(target===current)return false;
 location.replace(target);
 return true;
}

export function updateNavigation(state){
 const page=activePage();
 const avatar=document.querySelector("#site-header .profile-link");
 if(avatar){
  const photo=typeof state.avatar==="string"&&(state.avatar.startsWith("data:image/")||/^https:\/\//i.test(state.avatar))?state.avatar:"";
  if(photo){
   let image=avatar.querySelector("img");
   if(!image){avatar.textContent="";image=document.createElement("img");image.alt="";image.loading="lazy";avatar.appendChild(image)}
   image.src=photo;
   image.style.cssText="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block";
   avatar.setAttribute("data-has-avatar","true");
  }else{
   avatar.removeAttribute("data-has-avatar");
   avatar.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.6-3.4 3.1-5.2 7-5.2s6.4 1.8 7 5.2"></path></svg>';
  }
 }
 document.documentElement.style.setProperty("--ac",state.acc);
 document.querySelectorAll("nav a").forEach(link=>{
  const on=link.dataset.page===page;
  link.classList.toggle("on",on);
  if(on)link.setAttribute("aria-current","page");else link.removeAttribute("aria-current");
 });
}

export function renderRoute(pages,timers,beforeRender,state){
 timers.forEach(clearInterval);
 timers.length=0;
 if(beforeRender)beforeRender();
 const page=activePage();
 const render=has(pages,page)?pages[page]:pages.home;
 render(routeArgs());
 updateNavigation(state||{});
}
