var V="aw-v228",SHELL=["./","index.html","stats.html","catalog.html","favorites.html","lists.html","together.html","profile.html","random.html","anime.html","watch.html","collections.html","js/components/site-header.js","css/style.css","js/app.js","js/api/anilist.js","js/api/shikimori.js","js/api/genders.js","js/api/kodik.js","js/api/kodik-replacer.js","js/api/anilibria.js","js/pages/calendar.js","calendar.html","js/components/anime-card.js","js/core/storage.js","js/core/library-import.js","js/core/recommendations.js","js/core/router.js","js/core/supabase.js","js/core/calendar-push.js","js/core/analytics.js","js/pages/stats.js","js/core/collections.js","js/pages/collections.js","js/core/rooms.js","js/core/friends.js","js/core/streaming-player.js","js/pages/collection.js","js/pages/catalog.js","js/core/events.js","js/pages/discovery.js","js/pages/together.js","js/pages/watch.js","js/pages/anime.js","js/pages/home.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// App modules are network-first: after a deploy the page must not mix fresh HTML
// with stale JS/CSS from the previous cache version. Offline still falls back to
// the precached shell. Everything else uses stale-while-revalidate.
// Remote images/posters are never cached.
// Cache writes are best-effort: cloning a response can fail if another consumer
// has already used its body. Never let that prevent the original response from
// reaching the page or create an unhandled rejection.
function cacheResponse(cache,request,response){
 try{
  var copy=response.clone();
  return cache.put(request,copy).catch(()=>{});
 }catch(error){
  return Promise.resolve();
 }
}
function offlineResponse(){
 return new Response('<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Нет сети — AniWatch</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090f;color:#f5f4fb;font:15px/1.6 system-ui,sans-serif}main{max-width:420px;padding:32px;text-align:center}h1{font-size:22px;margin:0 0 10px}p{color:#a09fb3;margin:0 0 18px}a{display:inline-block;padding:10px 16px;border-radius:10px;background:#8b5cf6;color:#fff;text-decoration:none}</style></head><body><main><h1>Нет подключения</h1><p>Эта страница ещё не сохранена для офлайн-просмотра. Проверь соединение и попробуй снова.</p><a href="./">Открыть главную</a></main></body></html>',{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}});
}
self.addEventListener("fetch",e=>{
 var r=e.request;
 if(r.method!=="GET")return;
 var u=new URL(r.url);
 if(u.origin!==location.origin){if(r.destination==="image")e.respondWith(fetch(new Request(r,{cache:"no-store"})));return;}
 if(r.mode==="navigate"){
  var key=u.origin+u.pathname;
  e.respondWith(fetch(r).then(x=>{
   if(x.ok)caches.open(V).then(c=>cacheResponse(c,key,x));
   return x;
  }).catch(()=>caches.open(V).then(c=>c.match(key).then(h=>h||c.match(u.origin+u.pathname.replace(/[^/]*$/,"index.html")))).then(h=>h||offlineResponse())));
  return;
 }
 if(/\.(?:js|css)$/i.test(u.pathname)){
  e.respondWith(fetch(r).then(x=>{
   if(x.ok)caches.open(V).then(c=>cacheResponse(c,r,x));
   return x;
  }).catch(()=>caches.open(V).then(c=>c.match(r))).then(h=>h||Response.error()));
  return;
 }
 e.respondWith(caches.open(V).then(c=>c.match(r).then(h=>{
  var n=fetch(r).then(x=>{if(x.ok)cacheResponse(c,r,x);return x}).catch(()=>h);
  return h||n;
 })));
});

self.addEventListener("push",event=>{
 let payload={};
 try{payload=event.data?event.data.json():{}}catch(error){payload={body:event.data?event.data.text():""}}
 const title=String(payload.title||"Новая серия скоро");
 const options={
  body:String(payload.body||"Проверь календарь AniWatch."),
  icon:"/icons/icon-192.png",
  badge:"/icons/icon-192.png",
  tag:String(payload.tag||"aniwatch-calendar"),
  renotify:false,
  data:{url:String(payload.url||"/calendar.html")}
 };
 event.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener("notificationclick",event=>{
 event.notification.close();
 const target=new URL(String(event.notification.data&&event.notification.data.url||"/calendar.html"),self.location.origin).href;
 event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then(windows=>{
  for(const client of windows){
   if(client.url.startsWith(self.location.origin)){
    if("navigate" in client)return client.navigate(target).then(()=>client.focus());
    return client.focus();
   }
  }
  return self.clients.openWindow(target);
 }));
});
