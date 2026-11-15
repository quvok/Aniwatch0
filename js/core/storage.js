let localDB=null,localDBReady=null;

export function loadLocalState(){
 try{return normalizeState(JSON.parse(localStorage.getItem("aw")))}catch(e){return normalizeState({})}
}

function isRecord(value){return Boolean(value)&&typeof value==="object"&&!Array.isArray(value)}

function normalizeState(state){
 state=isRecord(state)?state:{};
 state.fav=Array.isArray(state.fav)?state.fav:[];
 state.hist=isRecord(state.hist)?state.hist:{};
 state.rate=isRecord(state.rate)?state.rate:{};
 state.watchlist=isRecord(state.watchlist)||Array.isArray(state.watchlist)?state.watchlist:{};
 state.watchedEpisodes=isRecord(state.watchedEpisodes)?state.watchedEpisodes:{};
 state.recommendationGenres=Array.isArray(state.recommendationGenres)?state.recommendationGenres:[];
 state.recommendationDismissed=isRecord(state.recommendationDismissed)?state.recommendationDismissed:{};
 state.calendarFollows=isRecord(state.calendarFollows)?state.calendarFollows:{};
 state.name=typeof state.name==="string"&&state.name.trim()?state.name:"Гость";
 state.acc=typeof state.acc==="string"&&state.acc.trim()?state.acc:"#8b5cf6";
 state.autoNextEpisode=state.autoNextEpisode!==false;
 return state;
}

export {normalizeState};

function openLocalDB(){
 if(localDBReady)return localDBReady;
 let resolveReady;
 const ready=new Promise(resolve=>{resolveReady=resolve});
 localDBReady=ready;
 let settled=false;
 const settle=db=>{if(settled)return;settled=true;resolveReady(db)};
 if(!window.indexedDB){settle(null);return ready}
 let req;
 try{req=window.indexedDB.open("AniWatchLocal",1)}catch(error){localDBReady=null;settle(null);return ready}
 req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("state"))db.createObjectStore("state")};
 req.onsuccess=()=>{
  localDB=req.result;
  localDB.onversionchange=()=>{localDB.close();localDB=null;localDBReady=null};
  if(settled)localDBReady=Promise.resolve(localDB);else settle(localDB);
 };
 req.onerror=()=>{settle(null);if(!localDB)localDBReady=null};
 req.onblocked=()=>{console.warn("[AniWatch] Local database is blocked; using browser storage for now");settle(null)};
 return ready;
}

export async function initializeLocalState(state,setState){
 const db=await openLocalDB();
 if(!db){state=normalizeState(state);stripCachedArtwork(state.shikiAnime);stripCachedArtwork(state.relatedAnime);try{localStorage.setItem("aw",JSON.stringify(state))}catch(e){}return state;}
 try{
  const saved=await new Promise((resolve,reject)=>{
   const tx=db.transaction("state","readonly"),req=tx.objectStore("state").get("app");
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  if(saved&&typeof saved==="object")state=saved;
  state=normalizeState(state);
  stripCachedArtwork(state.shikiAnime);
  stripCachedArtwork(state.relatedAnime);
  try{localStorage.setItem("aw",JSON.stringify(state))}catch(e){}
  setState(state);
  await new Promise((resolve,reject)=>{
   const tx=db.transaction("state","readwrite");
   tx.objectStore("state").put(state,"app");
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
 }catch(e){console.warn("[AniWatch] Local database read failed",e)}
 return state;
}

function pruneState(state,mediaMap){
 try{
  const k=state.shikiAnime;
  if(k){
   const keep=new Set([].concat(state.fav||[],Object.keys(state.hist||{}),Object.keys(state.rate||{}),Object.keys(state.watchedEpisodes||{}),Array.isArray(state.watchlist)?[]:Object.keys(state.watchlist||{})).map(Number));
   Object.keys(k).forEach(i=>{if(!keep.has(+i))delete k[i]});
   keep.forEach(i=>{if(!k[i]&&mediaMap[i]&&mediaMap[i].source)k[i]=JSON.parse(JSON.stringify(mediaMap[i]))});
  }
  const rel=state.relatedAnime;
  if(rel){const keys=Object.keys(rel);if(keys.length>25)keys.sort((a,b)=>(rel[b].at||0)-(rel[a].at||0)).slice(25).forEach(i=>delete rel[i])}
 }catch(e){}
}

function stripCachedArtwork(value){
 if(!value||typeof value!=="object")return;
 if(Array.isArray(value)){value.forEach(stripCachedArtwork);return}
 ["img","ban","poster","coverImage","bannerImage"].forEach(key=>{if(key in value)delete value[key]});
 Object.keys(value).forEach(key=>stripCachedArtwork(value[key]));
}

export function saveLocalState(state,mediaMap){
 let snapshot;
 try{snapshot=normalizeState(JSON.parse(JSON.stringify(state)))}catch(e){return}
 pruneState(snapshot,mediaMap||{});
 // Poster URLs are transient display data, not persistent application state.
 stripCachedArtwork(snapshot.shikiAnime);
 stripCachedArtwork(snapshot.relatedAnime);
 try{localStorage.setItem("aw",JSON.stringify(snapshot))}catch(e){}
 openLocalDB().then(db=>{
  if(!db)return;
  try{const tx=db.transaction("state","readwrite");tx.objectStore("state").put(snapshot,"app")}
  catch(e){console.warn("[AniWatch] Local database write failed",e)}
 });
}
