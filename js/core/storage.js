let localDB=null,localDBReady=null;

export function loadLocalState(){
 try{return JSON.parse(localStorage.getItem("aw"))||{}}catch(e){return{}}
}

function normalizeState(state){
 state.fav=state.fav||[];
 state.hist=state.hist||{};
 state.rate=state.rate||{};
 state.watchlist=state.watchlist||{};
 state.name=state.name||"Гость";
 state.acc=state.acc||"#8b5cf6";
 return state;
}

function openLocalDB(){
 if(localDBReady)return localDBReady;
 localDBReady=new Promise(resolve=>{
  if(!window.indexedDB){resolve(null);return}
  const req=indexedDB.open("AniWatchLocal",1);
  req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains("state"))db.createObjectStore("state")};
  req.onsuccess=()=>{localDB=req.result;resolve(localDB)};
  req.onerror=()=>resolve(null);
 });
 return localDBReady;
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
 try{snapshot=JSON.parse(JSON.stringify(state))}catch(e){return}
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
