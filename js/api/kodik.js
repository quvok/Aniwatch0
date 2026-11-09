const API_BASE="https://kodik-api.com";
const clean=value=>String(value||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/gi," ").trim();
export function getKodikToken(){try{return sessionStorage.getItem("aniwatch_kodik_token")||""}catch{return""}}
export function setKodikToken(value){try{if(value)sessionStorage.setItem("aniwatch_kodik_token",String(value).trim());else sessionStorage.removeItem("aniwatch_kodik_token")}catch{}}
async function request(params,token){
 if(!token)throw new Error("Введи API-токен Kodik");
 const url=new URL("/search",API_BASE);
 url.searchParams.set("token",token);
 Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=="")url.searchParams.set(key,String(value))});
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(url.toString(),{method:"POST",headers:{Accept:"application/json"},signal:controller.signal});
  if(!response.ok)throw new Error("Kodik API: HTTP "+response.status);
  const data=await response.json();
  if(!data||!Array.isArray(data.results))throw new Error(data?.error||"Kodik вернул неожиданный ответ");
  return data.results;
 }catch(error){
  if(error?.name==="AbortError")throw new Error("Kodik API не ответил за 12 секунд");
  if(error instanceof TypeError)throw new Error("Не удалось подключиться к Kodik API. Возможно, API блокирует запросы с этого домена (CORS).");
  throw error;
 }finally{clearTimeout(timer)}
}
const titlesOf=item=>[item?.title,item?.title_orig,item?.other_title].flatMap(x=>String(x||"").split(/[\/|;]/)).map(clean).filter(Boolean);
function rank(item,anime){
 const wanted=[anime?.n,anime?.o,anime?.title,anime?.originalTitle].map(clean).filter(Boolean);
 const candidates=titlesOf(item);
 if(!wanted.length||!candidates.length)return 99;
 if(wanted.some(x=>candidates.includes(x)))return 0;
 if(wanted.some(x=>candidates.some(y=>y.includes(x)||x.includes(y))))return 1;
 return 99;
}
export async function searchKodikAnime(anime,token=getKodikToken()){
 const shikiId=Number(anime?.shikiId||anime?.shiki_id||(anime?.source==="shikimori"&&Number(anime?.id)>1000000000?Number(anime.id)-1000000000:0));
 const common={types:"anime-serial,anime",limit:50,with_episodes_data:true};
 let results=[];
 if(shikiId>0)results=await request({...common,shikimori_id:shikiId},token);
 if(!results.length){
  const title=String(anime?.n||anime?.o||anime?.title||"").trim();
  if(title.length<2)throw new Error("Не удалось определить название аниме");
  results=await request({...common,title},token);
 }
 const exact=results.map(item=>({item,score:rank(item,anime)})).filter(x=>x.score<99);
 const selected=exact.length?exact:results.map(item=>({item,score:rank(item,anime)})).filter(x=>x.item?.type==="anime-serial"||x.item?.type==="anime");
 const list=selected.map(x=>x.item).filter(item=>item?.link&&item?.translation);
 const unique=new Map();
 for(const item of list){
  const key=[item.id,item.translation?.id,item.translation?.type].join(":");
  if(!unique.has(key))unique.set(key,item);
 }
 return [...unique.values()].sort((a,b)=>{
  const at=a.type==="anime-serial"?0:1,bt=b.type==="anime-serial"?0:1;
  return at-bt||String(a.translation?.title||"").localeCompare(String(b.translation?.title||""),"ru");
 });
}
export function getKodikEpisodeLink(item,episode){
 const seasons=item?.seasons||{};
 const seasonEntries=Object.entries(seasons);
 const preferred=seasonEntries.find(([key])=>Number(key)===1)||seasonEntries[0];
 const season=preferred?.[1];
 const episodes=season?.episodes||{};
 const episodeEntry=Object.entries(episodes).find(([key])=>Number(key)===Number(episode));
 const link=episodeEntry?.[1]?.link||episodeEntry?.[1]?.url||"";
 return normalizeKodikLink(link||season?.link||item?.link||"");
}
export function normalizeKodikLink(link){
 const value=String(link||"").trim();
 if(!value)return"";
 if(value.startsWith("//"))return"https:"+value;
 if(/^https?:\/\//i.test(value))return value;
 return "";
}
