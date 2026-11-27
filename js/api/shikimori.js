// Shikimori HTTP client. UI and anime-model normalization stay outside this module.
const API_ROOT="https://shikimori.io/api";
const ANIME_FIELDS="id malId name russian kind status score episodes episodesAired airedOn{date} poster{mainUrl originalUrl} genres{name russian}";
// Catalog requests are shared, cached in memory and serialized to respect Shikimori limits.
const catalogCache=new Map(),catalogPending=new Map();
let catalogQueue=Promise.resolve(),catalogNextAt=0;
function waitMs(ms){return new Promise(resolve=>setTimeout(resolve,ms))}
async function fetchCatalogJSON(url,{signal,ttl=5*60*1000,force=false}={}){
 const key=String(url),cached=catalogCache.get(key);
 if(!force&&cached&&cached.expires>Date.now())return JSON.parse(JSON.stringify(cached.data));
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
 const response=await fetch(API_ROOT+"/animes?limit=1&order=random",{headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status);
 let result=await response.json();
 if(Array.isArray(result))result=result[0];
 if(result&&result.anime)result=result.anime;
 if(!result||!Number(result.id))throw new Error("Получен пустой результат");
 return result;
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
  result.push(...batch);
 }
 return result;
}

export async function fetchAnimePostersByIds(ids,{signal}={}) {
 const unique=[...new Set((ids||[]).map(Number).filter(id=>Number.isInteger(id)&&id>0))];
 if(!unique.length)return [];
 const data=await fetchGraphQL("query($ids: String) { animes(ids: $ids, limit: 50) { id malId poster { originalUrl mainUrl } } }",{ids:unique.join(",")},signal);
 return data.animes||[];
}

async function fetchGraphQL(query,variables,signal){
 const response=await fetch(API_ROOT+"/graphql",{method:"POST",signal:signal||AbortSignal.timeout(8000),headers:{Accept:"application/json","Content-Type":"application/json"},body:JSON.stringify({query,variables})});
 if(!response.ok)throw new Error("Ошибка GraphQL Shikimori (HTTP "+response.status+")");
 const payload=await response.json();
 if(!payload.data)throw new Error(payload.errors?.map(e=>e.message).join("; ")||"Некорректный ответ GraphQL Shikimori");
 return payload.data;
}

export function fetchHomeAnime(){
 return fetchGraphQL(`query {
  popular: animes(limit: 15, order: popularity, censored: true) { ...Tile }
  ongoing: animes(limit: 24, order: popularity, status: "ongoing", censored: true) { ...Tile }
  recent: animes(limit: 30, order: aired_on, status: "released", censored: true) { ...Tile }
 }
 fragment Tile on Anime { ${ANIME_FIELDS} description }`);
}

export async function fetchAnimeTilesByIds(ids){
 const data=await fetchGraphQL(`query($ids: String) {
  animes(ids: $ids, limit: 50) { ${ANIME_FIELDS} description }
 }`,{ids:ids.join(",")});
 if(!Array.isArray(data.animes))throw new Error("Shikimori не вернул карточки");
 return data.animes;
}

export async function fetchAnimeGenresByIds(ids){
 const genres=new Map();
 const unique=[...new Set(ids.filter(id=>Number.isInteger(id)&&id>0))];
 for(let offset=0;offset<unique.length;offset+=50){
  try{
   const data=await fetchGraphQL("query($ids: String) { animes(ids: $ids, limit: 50) { id genres { name russian } } }",{ids:unique.slice(offset,offset+50).join(",")});
   for(const anime of data.animes||[])genres.set(Number(anime.id),anime.genres||[]);
  }catch(error){console.warn("[AniWatch] Shikimori recommendation genres unavailable:",error)}
 }
 return genres;
}

export async function fetchAnimeScreenshots(ids){
 if(!ids.length)return [];
 const data=await fetchGraphQL("query($ids: String) { animes(ids: $ids, limit: 8) { id screenshots { originalUrl x332Url } } }",{ids:ids.join(",")});
 return data.animes||[];
}

export async function fetchAnimeCredits(id){
 const data=await fetchGraphQL(`query($ids: String) {
  animes(ids: $ids, limit: 1) {
   malId studios { name }
   personRoles { rolesRu rolesEn person { id name russian poster { mainUrl } } }
   chronology { ${ANIME_FIELDS} }
  }
 }`,{ids:String(id)});
 return data.animes?.[0]||null;
}

export async function fetchPersonAnime(id){
 const numeric=Number(id);
 if(!Number.isInteger(numeric)||numeric<=0)return [];
 const person=await fetchCatalogJSON(API_ROOT+"/people/"+numeric,{signal:AbortSignal.timeout(8000)});
 return (person.works||[]).map(work=>work.anime).filter(Boolean);
}

export async function fetchAnimeById(id,{signal,force=false}={}){
 const numeric=Number(id);
 if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный идентификатор аниме");
 const result=await fetchCatalogJSON(API_ROOT+"/animes/"+numeric,{signal,ttl:15*60*1000,force});
 if(!result||!Number(result.id))throw new Error("Получен пустой результат");
 return result;
}

export async function fetchShikimoriCalendar({signal,force=false}={}){
 const result=await fetchCatalogJSON(API_ROOT+"/calendar",{signal,ttl:10*60*1000,force});
 if(!Array.isArray(result))throw new Error("Некорректный ответ календаря Shikimori");
 return result.map(entry=>{
  const anime=entry&&entry.anime||{},at=String(entry&&entry.next_episode_at||""),date=new Date(at);
  if(!Number(anime.id)||!Number.isFinite(date.getTime()))return null;
  const image=anime.image||{},path=String(image.original||image.preview||"");
  let poster="";
  if(path&&!/missing_(?:original|preview)/i.test(path)){try{poster=new URL(path,"https://shikimori.io").href}catch{}}
  return {day:(date.getDay()+6)%7+1,airingAt:at,nextEpisode:Number(entry.next_episode)||((Number(anime.episodes_aired)||0)+1),shikimoriId:Number(anime.id),malId:Number(anime.myanimelist_id)||0,title:String(anime.russian||anime.name||"Без названия"),poster,year:Number(String(anime.aired_on||"").slice(0,4))||0,type:String(anime.kind||"").toUpperCase()};
 }).filter(Boolean);
}
 
export async function fetchAnimeRelated(id,{signal}={}){
 const numeric=Number(id);if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный идентификатор аниме");
 const response=await fetch(API_ROOT+"/animes/"+numeric+"/related",{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Ошибка загрузки связанных тайтлов (HTTP "+response.status);
 const result=await response.json();if(!Array.isArray(result))throw new Error("Некорректный ответ related");return result;
}
export async function fetchAnimeSimilar(id,{signal}={}){
 const numeric=Number(id);if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный идентификатор аниме");
 const url=API_ROOT+"/animes/"+numeric+"/similar";
 const result=await fetchCatalogJSON(url,{signal,ttl:5*60*1000});
 if(!Array.isArray(result))throw new Error("Некорректный ответ similar");
 return result;
}
