var V="aw-v164",SHELL=["./","index.html","catalog.html","favorites.html","lists.html","together.html","profile.html","random.html","anime.html","watch.html","collections.html","js/components/site-header.js","css/style.css","js/app.js","js/api/anilist.js","js/api/shikimori.js","js/api/kodik.js","js/api/anilibria.js","js/pages/calendar.js","calendar.html","js/components/anime-card.js","js/core/storage.js","js/core/recommendations.js","js/core/router.js","js/core/supabase.js","js/core/collections.js","js/pages/collections.js","js/core/rooms.js","js/core/streaming-player.js","js/pages/collection.js","js/pages/catalog.js","js/core/events.js","js/pages/discovery.js","js/pages/together.js","js/pages/watch.js","js/pages/anime.js","js/pages/home.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Same-origin app files use stale-while-revalidate. Remote images/posters are never cached.
self.addEventListener("fetch",e=>{
 var r=e.request;
 if(r.method!=="GET")return;
 var u=new URL(r.url);
 if(u.origin!==location.origin){if(r.destination==="image")e.respondWith(fetch(new Request(r,{cache:"no-store"})));return;}
 if(r.mode==="navigate"){
  var key=u.origin+u.pathname;
  e.respondWith(fetch(r).then(x=>{
   if(x.ok){var cp=x.clone();caches.open(V).then(c=>c.put(key,cp))}
   return x;
  }).catch(()=>caches.open(V).then(c=>c.match(key).then(h=>h||c.match(u.origin+u.pathname.replace(/[^/]*$/,"index.html")))).then(h=>h||Response.error())));
  return;
 }
 e.respondWith(caches.open(V).then(c=>c.match(r).then(h=>{
  var n=fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x}).catch(()=>h);
  return h||n;
 })));
});
