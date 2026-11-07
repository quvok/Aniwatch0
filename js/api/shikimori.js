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
