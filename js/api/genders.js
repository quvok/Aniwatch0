// Dedicated Shikimori genre loader for anime detail pages.
const API_ROOT="https://shikimori.io/api";
const cache=new Map();
const pending=new Map();
const resolvedIds=new Map();
const resolvingIds=new Map();

function normalizeTitle(value){return String(value||"").toLocaleLowerCase("ru").normalize("NFKC").replace(/[ё]/g,"е").replace(/[\\s\\p{P}\\p{S}]+/gu,"").trim()}

async function resolveShikimoriId(malId,searchTitles,signal){
 const mal=Number(malId)||0;
 const titles=[...new Set((Array.isArray(searchTitles)?searchTitles:[searchTitles]).map(value=>String(value||"").trim()).filter(Boolean))];
 if(mal<=0&&!titles.length)throw new Error("Для поиска жанров нет MAL ID и названия аниме");
 const key=mal>0?"mal:"+mal:"title:"+normalizeTitle(titles[0]);
 if(resolvedIds.has(key))return resolvedIds.get(key);
 if(resolvingIds.has(key))return resolvingIds.get(key);
 const task=(async()=>{
  for(const title of titles){
   const url=API_ROOT+"/animes?search="+encodeURIComponent(title)+"&limit=20";
   const response=await fetch(url,{signal,headers:{Accept:"application/json"}});
   if(!response.ok)throw new Error("Не удалось найти аниме на Shikimori (HTTP "+response.status+")");
   const results=await response.json();
   if(!Array.isArray(results))continue;
   const matches=results.filter(item=>{
    if(!item||!Number(item.id))return false;
    if(mal>0)return Number(item.myanimelist_id)===mal;
    const wanted=normalizeTitle(title);
    return [item.russian,item.name].some(name=>normalizeTitle(name)===wanted);
   });
   if(matches.length===1){const id=Number(matches[0].id);resolvedIds.set(key,id);return id}
   if(matches.length>1){
    const exact=matches.filter(item=>[item.russian,item.name].some(name=>normalizeTitle(name)===normalizeTitle(title)));
    if(exact.length===1){const id=Number(exact[0].id);resolvedIds.set(key,id);return id}
   }
  }
  throw new Error(mal>0?"Shikimori не нашёл точное соответствие для MAL ID "+mal:"Shikimori не нашёл точное совпадение по названию: "+titles.join(" / "));
 })();
 resolvingIds.set(key,task);
 try{return await task}finally{resolvingIds.delete(key)}
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
