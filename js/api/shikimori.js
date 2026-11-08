// Shikimori HTTP client. UI and anime-model normalization stay outside this module.
const API_ROOT="https://shikimori.io/api";

export async function fetchRandomAnime(){
 const response=await fetch(API_ROOT+"/animes?limit=1&order=random",{headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Shikimori API: HTTP "+response.status);
 let result=await response.json();
 if(Array.isArray(result))result=result[0];
 if(result&&result.anime)result=result.anime;
 if(!result||!Number(result.id))throw new Error("Shikimori вернул пустой результат");
 return result;
}

export async function fetchCatalogPage({query="",page=1,order="popularity",format="",season="",status="",signal}={}){
 const url=new URL(API_ROOT+"/animes");
 url.searchParams.set("limit","50");
 url.searchParams.set("page",String(page));
 url.searchParams.set("order",order);
 if(query)url.searchParams.set("search",query);
 if(format)url.searchParams.set("kind",({TV:"tv",MOVIE:"movie",OVA:"ova",ONA:"ona",SPECIAL:"special"})[format]||format);
 if(season)url.searchParams.set("season",String(season));
 if(status)url.searchParams.set("status",({RELEASING:"ongoing",FINISHED:"released",NOT_YET_RELEASED:"anons"})[status]||status);
 const response=await fetch(url.toString(),{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Shikimori API: HTTP "+response.status);
 const result=await response.json();
 if(!Array.isArray(result))throw new Error("Некорректный ответ Shikimori");
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
  if(!response.ok)throw new Error("Shikimori API: HTTP "+response.status);
  const batch=await response.json();
  if(!Array.isArray(batch))throw new Error("Некорректный ответ Shikimori");
  result.push(...batch);
 }
 return result;
}

export async function fetchAnimeById(id,{signal}={}){
 const numeric=Number(id);
 if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный Shikimori ID");
 const response=await fetch(API_ROOT+"/animes/"+numeric,{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Shikimori API: HTTP "+response.status);
 const result=await response.json();
 if(!result||!Number(result.id))throw new Error("Shikimori вернул пустой результат");
 return result;
}
 
export async function fetchAnimeRelated(id,{signal}={}){
 const numeric=Number(id);if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный Shikimori ID");
 const response=await fetch(API_ROOT+"/animes/"+numeric+"/related",{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Shikimori related API: HTTP "+response.status);
 const result=await response.json();if(!Array.isArray(result))throw new Error("Некорректный ответ Shikimori related");return result;
}
export async function fetchAnimeSimilar(id,{signal}={}){
 const numeric=Number(id);if(!Number.isInteger(numeric)||numeric<=0)throw new Error("Некорректный Shikimori ID");
 const response=await fetch(API_ROOT+"/animes/"+numeric+"/similar",{signal,headers:{Accept:"application/json"}});
 if(!response.ok)throw new Error("Shikimori similar API: HTTP "+response.status);
 const result=await response.json();if(!Array.isArray(result))throw new Error("Некорректный ответ Shikimori similar");return result;
}
