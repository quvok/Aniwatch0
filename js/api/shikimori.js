// Shikimori HTTP client. UI and anime-model normalization stay outside this module.
const API_ROOT="https://shikimori.io/api";

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
 const response=await fetch(url.toString(),{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status);
 const result=await response.json();
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
  const response=await fetch(url.toString(),{signal,headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status);
  const batch=await response.json();
  if(!Array.isArray(batch))throw new Error("Некорректный ответ");
  result.push(...batch);
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
 const result=await response.json();if(!Array.isArray(result))throw new Error("Некорректный ответ related");return result;
}
export async function fetchAnimeSimilar(id,{signal}={}){
 const numeric=Number(id);if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный идентификатор аниме");
 const response=await fetch(API_ROOT+"/animes/"+numeric+"/similar",{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Ошибка загрузки похожих тайтлов (HTTP "+response.status);
 const result=await response.json();if(!Array.isArray(result))throw new Error("Некорректный ответ similar");return result;
}

/** Resolve a Shikimori record by an exact normalized title when no external ID exists. */
export async function fetchAnimeByTitle(titles=[], {signal}={}) {
 const candidates=[...new Set((titles||[]).map(value=>String(value||"").trim()).filter(value=>value.length>=2))];
 const normalize=value=>String(value||"").normalize("NFKC").toLocaleLowerCase("ru").replace(/[ё]/g,"е").replace(/[^\p{L}\p{N}]+/gu,"");
 for(const title of candidates){
  const url=new URL(API_ROOT+"/animes");
  url.searchParams.set("search",title);
  url.searchParams.set("limit","50");
  const response=await fetch(url.toString(),{signal,headers:{Accept:"application/json"}});
  if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status);
  const rows=await response.json();
  if(!Array.isArray(rows))continue;
  const wanted=normalize(title);
  const match=rows.find(item=>[item&&item.russian,item&&item.name].some(value=>normalize(value)===wanted));
  if(match)return match;
 }
 throw new Error("Тайтл не найден в Shikimori");
}

/** Resolve Shikimori metadata by MAL ID without mixing ID namespaces. */
export async function fetchAnimeByMalId(malId, titles=[], {signal}={}) {
 const numeric=Number(malId);
 if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный MAL ID");
 const candidates=[...new Set((titles||[]).map(value=>String(value||"").trim()).filter(value=>value.length>=2))];
 for(const title of candidates){
  const url=new URL(API_ROOT+"/animes");
  url.searchParams.set("search",title);
  url.searchParams.set("limit","50");
  const response=await fetch(url.toString(),{signal,headers:{Accept:"application/json"}});
  if(!response.ok)continue;
  const rows=await response.json();
  if(!Array.isArray(rows))continue;
  const match=rows.find(item=>Number(item&&item.myanimelist_id)===numeric);
  if(match)return match;
 }
 throw new Error("Аниме с таким MAL ID не найдено в Shikimori");
}
