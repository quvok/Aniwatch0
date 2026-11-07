var V="aw-v6",IMG="aw-img",SHELL=["./","index.html","css/style.css","js/app.js","manifest.webmanifest","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!=V&&x!=IMG).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
// своё: stale-while-revalidate; картинки AniList: кэш с лимитом; API не трогаем
self.addEventListener("fetch",e=>{var r=e.request;if(r.method!="GET")return;var u=new URL(r.url);
 if(u.origin==location.origin){e.respondWith(caches.open(V).then(c=>c.match(r).then(h=>{var n=fetch(r).then(x=>{if(x.ok)c.put(r,x.clone());return x}).catch(()=>h);return h||n})));return}
 if(r.destination=="image"){e.respondWith(caches.open(IMG).then(c=>c.match(r).then(h=>{var n=fetch(r).then(x=>{c.put(r,x.clone());c.keys().then(k=>{if(k.length>150)c.delete(k[0])});return x}).catch(()=>h);return h||n})))}});
