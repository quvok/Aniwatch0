// Dedicated Shikimori genre loader for anime detail pages.
const API_ROOT="https://shikimori.io/api";
const cache=new Map();
const pending=new Map();

export async function fetchAnimeGenres(shikimoriId,{signal}={}){
 const id=Number(shikimoriId);
 if(!Number.isInteger(id)||id<=0)throw new Error("Некорректный Shikimori ID для загрузки жанров");
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
