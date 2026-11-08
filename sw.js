var V="aw-v49",IMG="aw-img",IMETA="aw-img-meta",IMG_TTL=24*60*60*1000,SHELL=["./","index.html","css/style.css","js/app.js","js/api/anilist.js","js/api/shikimori.js","js/components/anime-card.js","js/core/storage.js","js/core/router.js","js/pages/collection.js","js/pages/catalog.js","js/core/events.js","js/pages/discovery.js","js/pages/together.js","js/pages/watch.js","js/pages/anime.js","js/pages/home.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
function imageMetaKey(request){return new Request(new URL("__aw_img_cache__?url="+encodeURIComponent(request.url),self.registration.scope).toString())}
async function trimImageCache(cache,meta){var keys=await cache.keys();while(keys.length>100){var old=keys.shift();await cache.delete(old);await meta.delete(imageMetaKey(old))}}
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V&&x!==IMG&&x!==IMETA).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// Изображения: Cache First на 24 часа. По истечении срока обновляем из источника;
// если сеть недоступна, показываем сохранённую копию, чтобы карточки не пропадали.
self.addEventListener("fetch",e=>{
 var r=e.request;if(r.method!=="GET")return;var u=new URL(r.url);
 if(u.origin===location.origin){
  if(r.mode==="navigate"){e.respondWith(fetch(r).then(x=>{if(x.ok)caches.open(V).then(c=>c.put(r,x.clone()));return x}).catch(()=>caches.open(V).then(c=>c.match(r)).then(h=>h||Response.error())));return}
  e.respondWith(caches.open(V).then(c=>c.match(r).then(h=>{var n=fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x}).catch(()=>h);return h||n})));return
 }
 if(r.destination==="image"){
  e.respondWith((async()=>{
   var cache=await caches.open(IMG),meta=await caches.open(IMETA),cached=await cache.match(r),stamp=0;
   if(cached){var saved=await meta.match(imageMetaKey(r));if(saved)stamp=Number(await saved.text())||0}
   if(cached&&stamp&&Date.now()-stamp<IMG_TTL)return cached;
   try{
    var fresh=await fetch(r);
    if(fresh.ok||fresh.type==="opaque"){
     await cache.put(r,fresh.clone());
     await meta.put(imageMetaKey(r),new Response(String(Date.now())));
     await trimImageCache(cache,meta);
     return fresh;
    }
    return cached||fresh;
   }catch(error){return cached||Response.error()}
  })())
 }
});
