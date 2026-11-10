// Dedicated Shikimori genre loader for anime detail pages.
const API_ROOT="https://shikimori.io/api";
const cache=new Map();
const pending=new Map();
const malIdCache=new Map();
const malIdPending=new Map();

async function resolveShikimoriId(malId,searchTitles,signal){
 const mal=Number(malId);
 if(!Number.isInteger(mal)||mal<=0)throw new Error("Для поиска Shikimori нужен корректный MAL ID");
 if(malIdCache.has(mal))return malIdCache.get(mal);
 if(malIdPending.has(mal))return malIdPending.get(mal);
 const task=(async()=>{
  const titles=[...new Set((Array.isArray(searchTitles)?searchTitles:[searchTitles]).map(value=>String(value||"").trim()).filter(Boolean))];
  for(const title of titles){
   const url=API_ROOT+"/animes?search="+encodeURIComponent(title)+"&limit=10";
   const response=await fetch(url,{signal,headers:{Accept:"application/json"}});
   if(!response.ok)throw new Error("Не удалось сопоставить MAL ID с Shikimori (HTTP "+response.status+")");
   const results=await response.json();
   if(!Array.isArray(results))continue;
   const matches=results.filter(item=>Number(item&&item.myanimelist_id)===mal&&Number(item&&item.id)>0);
   if(matches.length===1){const id=Number(matches[0].id);malIdCache.set(mal,id);return id}
   if(matches.length>1){
    const exact=matches.filter(item=>[item.russian,item.name].some(name=>String(name||"").trim().toLocaleLowerCase()===title.toLocaleLowerCase()));
    if(exact.length===1){const id=Number(exact[0].id);malIdCache.set(mal,id);return id}
   }
  }
  throw new Error("Shikimori не нашёл точное соответствие для MAL ID "+mal);
 })();
 malIdPending.set(mal,task);
 try{return await task}finally{malIdPending.delete(mal)}
}

export async function fetchAnimeGenres(shikimoriId,{malId,searchTitles=[],signal}={}){
 let id=Number(shikimoriId);
 if(!Number.isInteger(id)||id<=0)id=await resolveShikimoriId(malId,searchTitles,signal);
 const cached=cache.get(id);
 if(cached&&cached.expires>Date.now())return cached.genres.slice();
 if(pending.has(id))return (await pending.get(id)).slice();
 const task=(async()=>{
  const url=API_ROOT+"/animes/"+id+"?fields=genres";
  const response=await fetch(url,{signal,headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Ошибка загрузки жанров Shikimori (HTTP "+response.status+")");
  const data=await response.json();
  if(!data||Number(data.id)!==id||!Array.isArray(data.genres))throw new Error("Shikimori вернул некорректные жанры");
  const genres=[...new Set(data.genres.map(item=>String(item&&((item.russian||item.name)||"")).trim()).filter(Boolean))];
  cache.set(id,{genres,expires:Date.now()+30*60*1000});
  return genres;
 })();
 pending.set(id,task);
 try{return (await task).slice()}
 finally{pending.delete(id)}
}
