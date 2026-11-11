// Shikimori HTTP client. UI and anime-model normalization stay outside this module.
import { filterAdultGenres, isAdultAnime } from "../core/adult-content.js";
const API_ROOT="https://shikimori.io/api";
// Catalog requests are shared, cached in memory and serialized to respect Shikimori limits.
const catalogCache=new Map(),catalogPending=new Map();
let catalogQueue=Promise.resolve(),catalogNextAt=0;
function waitMs(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function fetchCatalogJSON(url,{signal,ttl=5*60*1000}={}){
 const key=String(url),cached=catalogCache.get(key);
 if(cached&&cached.expires>Date.now())return JSON.parse(JSON.stringify(cached.data));
 if(catalogPending.has(key))return JSON.parse(JSON.stringify(await catalogPending.get(key)));
 const task=catalogQueue.then(async()=>{
  const pause=Math.max(catalogNextAt-Date.now(),0);
  if(pause)await waitMs(pause);
  if(signal&&signal.aborted)throw new DOMException("The operation was aborted","AbortError");
  let response=await fetch(key,{signal,headers:{Accept:"application/json"}});
  catalogNextAt=Date.now()+650;
  if(response.status===429){
   const raw=response.headers.get("Retry-After"),seconds=Number(raw);
   const parsedDate=raw?Date.parse(raw):NaN;
   const retryMs=raw&&Number.isFinite(seconds)?seconds*1000:Number.isFinite(parsedDate)?Math.max(0,parsedDate-Date.now()):0;
   const cooldown=Math.max(2500,retryMs);
   catalogNextAt=Date.now()+cooldown;
   await waitMs(cooldown);
   if(signal&&signal.aborted)throw new DOMException("The operation was aborted","AbortError");
   response=await fetch(key,{signal,headers:{Accept:"application/json"}});
   catalogNextAt=Date.now()+650;
  }
  if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status+")");
  const data=await response.json();
  catalogCache.set(key,{data,expires:Date.now()+ttl});
  return data;
 });
 catalogPending.set(key,task);
 catalogQueue=task.catch(()=>{});
 try{return JSON.parse(JSON.stringify(await task))}
 finally{catalogPending.delete(key)}
}


export async function fetchRandomAnime(){
 for(let attempt=0;attempt<12;attempt++){
  const response=await fetch(API_ROOT+"/animes?limit=1&order=random",{headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status);
  let result=await response.json();
  if(Array.isArray(result))result=result[0];
  if(result&&result.anime)result=result.anime;
  if(!result||!Number(result.id))throw new Error("Получен пустой результат");
  if(!isAdultAnime(result))return result;
 }
 throw new Error("Не удалось найти случайное аниме без 18+ жанров");
}

export async function fetchAnimeGenres({signal}={}){
 const response=await fetch(API_ROOT+"/genres",{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Ошибка загрузки жанров (HTTP "+response.status);
 const result=await response.json();
 if(!Array.isArray(result))throw new Error("Некорректный список жанров");
 return result;
}

export async function fetchCatalogPage({query="",page=1,limit=50,order="popularity",format="",season="",status="",genre="",signal}={}){
 const url=new URL(API_ROOT+"/animes");
 url.searchParams.set("limit",String(Math.max(1,Math.min(50,Number(limit)||50))));
 url.searchParams.set("page",String(page));
 url.searchParams.set("order",order);
 if(query)url.searchParams.set("search",query);
 if(format)url.searchParams.set("kind",({TV:"tv",MOVIE:"movie",OVA:"ova",ONA:"ona",SPECIAL:"special"})[format]||format);
 if(season)url.searchParams.set("season",String(season));
 if(status)url.searchParams.set("status",({RELEASING:"ongoing",FINISHED:"released",NOT_YET_RELEASED:"anons"})[status]||status);
 if(genre)url.searchParams.set("genre_v2",String(genre));
 const result=await fetchCatalogJSON(url.toString(),{signal,ttl:5*60*1000});
 if(!Array.isArray(result))throw new Error("Некорректный ответ");
 return result;
}


export async function fetchAnimeByIds(ids,{signal}={}){
 const unique=[...new Set((ids||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];
 const result=[];
 for(let i=0;i<unique.length;i+=50){
  const url=new URL(API_ROOT+"/animes");
  url.searchParams.set("limit",String(Math.min(50,unique.length-i)));
  url.searchParams.set("ids",unique.slice(i,i+50).join(","));
  const batch=await fetchCatalogJSON(url.toString(),{signal,ttl:15*60*1000});
  if(!Array.isArray(batch))throw new Error("Некорректный ответ");
  result.push(...batch.filter(item=>!isAdultAnime(item)));
 }
 return result;
}

export async function fetchAnimePostersByIds(ids,{signal}={}) {
 const unique=[...new Set((ids||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];
 if(!unique.length)return [];
 const response=await fetch("https://shikimori.io/api/graphql",{method:"POST",signal,headers:{"Accept":"application/json","Content-Type":"application/json"},body:JSON.stringify({query:"query($ids: String) { animes(ids: $ids, limit: 50) { id poster { originalUrl mainUrl } } }",variables:{ids:unique.join(",")}})});
 if(!response.ok)throw new Error("Ошибка GraphQL Shikimori (HTTP "+response.status+")");
 const payload=await response.json();
 if(payload.errors&&payload.errors.length)throw new Error(payload.errors.map(e=>e.message).join("; "));
 const result=payload.data&&payload.data.animes;
 if(!Array.isArray(result))throw new Error("Некорректный ответ GraphQL Shikimori");
 return result;
}

export async function fetchAnimeById(id,{signal}={}){
 const numeric=Number(id);
 if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный идентификатор аниме");
 const response=await fetch(API_ROOT+"/animes/"+numeric,{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status);
 const result=await response.json();
 if(!result||!Number(result.id))throw new Error("Получен пустой результат");
 return result;
}
 
export async function fetchAnimeRelated(id,{signal}={}){
 const numeric=Number(id);if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный идентификатор аниме");
 const response=await fetch(API_ROOT+"/animes/"+numeric+"/related",{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Ошибка загрузки связанных тайтлов (HTTP "+response.status);
 const result=await response.json();if(!Array.isArray(result))throw new Error("Некорректный ответ related");return result.filter(item=>!isAdultAnime(item&&item.anime||item));
}
export async function fetchAnimeSimilar(id,{signal}={}){
 const numeric=Number(id);if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный идентификатор аниме");
 const url=API_ROOT+"/animes/"+numeric+"/similar";
 const result=await fetchCatalogJSON(url,{signal,ttl:5*60*1000});
 if(!Array.isArray(result))throw new Error("Некорректный ответ similar");
 return result;
}
