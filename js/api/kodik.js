import {warmKodikDomainRules} from "./kodik-replacer.js";
const API_BASE="https://kodik-api.com";
const clean=value=>String(value||"").toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/[^a-zа-я0-9]+/gi," ").trim();
const FUNCTION_URL="https://oikuyhdgcobuuesbuygl.supabase.co/functions/v1/kodik-search";
const SUPABASE_KEY="sb_publishable_Ker59ui359qC1e9dsGsmsg_VW6azZfK";
async function request(params){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  const response=await fetch(FUNCTION_URL,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json","apikey":SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY},body:JSON.stringify({params}),signal:controller.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.error)throw new Error(data?.error||("Kodik API: HTTP "+response.status));
  if(!Array.isArray(data?.results))throw new Error("Kodik вернул неожиданный ответ");
  return data.results;
 }catch(error){
  if(error?.name==="AbortError")throw new Error("Kodik API не ответил за 15 секунд");
  if(error instanceof TypeError)throw new Error("Не удалось подключиться к серверу Kodik");
  throw error;
 }finally{clearTimeout(timer)}
}
const titlesOf=item=>{const m=item?.material_data||{};return [item?.title,item?.title_orig,item?.other_title,m.title,m.anime_title,m.title_en,...(m.other_titles||[]),...(m.other_titles_en||[]),...(m.other_titles_jp||[])].flatMap(x=>String(x||"").split(/[\\/|;]/)).map(clean).filter(Boolean)};
function rank(item,anime){
 const wanted=[anime?.n,anime?.o,anime?.title,anime?.originalTitle].map(clean).filter(Boolean);
 const candidates=titlesOf(item);
 if(!wanted.length||!candidates.length)return 99;
 if(wanted.some(x=>candidates.includes(x)))return 0;
 if(wanted.some(x=>candidates.some(y=>y.includes(x)||x.includes(y))))return 1;
 return 99;
}
const searchCache=new Map();
export async function searchKodikAnime(anime,{includeEpisodes=true}={}){
 warmKodikDomainRules();
 const cacheKey=String(anime?.shikiId||anime?.shiki_id||anime?.id||anime?.n||anime?.o||"unknown")+(includeEpisodes?":episodes":":material");
 if(searchCache.has(cacheKey))return searchCache.get(cacheKey);
 const pending=(async()=>{
  const shikiId=Number(anime?.shikiId||anime?.shiki_id||(anime?.source==="shikimori"&&Number(anime?.id)>1000000000?Number(anime.id)-1000000000:0));
  const common={types:"anime-serial,anime",limit:50,with_material_data:true};
  if(includeEpisodes)common.with_episodes_data=true;
  let results=[];
  if(shikiId>0)results=await request({...common,shikimori_id:shikiId});
  if(!results.length||!results.some(item=>rank(item,anime)<99)){
   const titles=[...new Set([anime?.n,anime?.o,anime?.title,anime?.originalTitle].map(x=>String(x||"").trim()).filter(x=>x.length>=2))].slice(0,3);
   for(const title of titles){
    const found=await request({...common,title});
    if(found.some(item=>rank(item,anime)<99)){results=found;break}
    if(!results.length)results=found;
   }
  }
  const exact=results.map(item=>({item,score:rank(item,anime)})).filter(x=>x.score<99);
  const idMatches=shikiId>0?results.filter(item=>Number(item?.shikimori_id)===shikiId):[];
  const selected=exact.length?exact:idMatches.map(item=>({item,score:0}));
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
 })();
 searchCache.set(cacheKey,pending);
 try{return await pending}catch(error){searchCache.delete(cacheKey);throw error}
}
function normalizeKodikPosterUrl(raw){
 const value=String(raw||"").trim();if(!value)return "";
 try{
  const url=new URL(value.startsWith("//")?"https:"+value:value);
  if(!/^https?:$/.test(url.protocol)||/(^|\.)shikimori\./i.test(url.hostname)||/(no[-_]?poster|placeholder|missing_original)/i.test(url.pathname))return "";
  return url.href;
 }catch(error){return ""}
}
async function requestBatch(lookups){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);
 try{
  const response=await fetch(FUNCTION_URL,{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json",apikey:SUPABASE_KEY,"Authorization":"Bearer "+SUPABASE_KEY},body:JSON.stringify({lookups}),signal:controller.signal});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data?.error)throw new Error(data?.error||("Kodik API: HTTP "+response.status));
  if(!Array.isArray(data?.results))throw new Error("Kodik вернул неожиданный пакетный ответ");
  return data.results;
 }catch(error){
  if(error?.name==="AbortError")throw new Error("Пакетный запрос Kodik не ответил за 30 секунд");
  if(error instanceof TypeError)throw new Error("Не удалось подключиться к серверу Kodik");
  throw error;
 }finally{clearTimeout(timer)}
}
export async function fetchKodikPostersBatch(animes){
 const list=[...new Map((animes||[]).filter(Boolean).map(item=>[String(item.id),item])).values()];
 const byKey=new Map(list.map(item=>[String(item.id),item]));
 const lookups=list.map(item=>{
  const shikiId=Number(item?.shikiId||item?.shiki_id||(item?.source==="shikimori"&&Number(item?.id)>1000000000?Number(item.id)-1000000000:0));
  const titles=[...new Set([item?.n,item?.o,item?.title,item?.originalTitle].map(value=>String(value||"").trim()).filter(value=>value.length>=2))].slice(0,3);
  return {key:String(item.id),shikimori_id:shikiId>0?shikiId:undefined,titles};
 });
 const result={};
 for(let offset=0;offset<lookups.length;offset+=20){
  const groups=await requestBatch(lookups.slice(offset,offset+20));
  for(const group of groups){
   const key=String(group?.key||""),anime=byKey.get(key);if(!anime)continue;
   const records=Array.isArray(group?.results)?group.results:[];
   const exact=records.filter(item=>rank(item,anime)<99);
   const shikiId=Number(anime?.shikiId||anime?.shiki_id||(anime?.source==="shikimori"&&Number(anime?.id)>1000000000?Number(anime.id)-1000000000:0));
   const idMatches=shikiId>0?records.filter(item=>Number(item?.shikimori_id)===shikiId):[];
   const selected=exact.length?exact:idMatches;
   for(const item of selected){
    const material=item?.material_data||{};
    // anime_poster_url is intentionally excluded because it points to Shikimori artwork.
    const url=normalizeKodikPosterUrl(material.poster_url||item?.poster_url);
    if(url){result[key]=url;break}
   }
  }
 }
 return result;
}

export function getKodikEpisodeLink(item,episode,seasonNumber){
 const seasons=item?.seasons||{};
 const entries=Object.entries(seasons);
 const wantedSeason=Number(seasonNumber);
 const ordered=Number.isFinite(wantedSeason)&&wantedSeason>0
  ?[...entries.filter(([key])=>Number(key)===wantedSeason),...entries.filter(([key])=>Number(key)!==wantedSeason)]
  :entries;
 for(const [seasonKey,season] of ordered){
  const episodes=season?.episodes||{};
  const entry=Object.entries(episodes).find(([key,value])=>Number(key)===Number(episode)||Number(value?.episode)===Number(episode)||Number(value?.number)===Number(episode));
  const link=entry?.[1]?.link||entry?.[1]?.url;
  if(link)return normalizeKodikLink(link);
 }
 return normalizeKodikLink(item?.link||"");
}
export function normalizeKodikLink(link){
 const value=String(link||"").trim();
 if(!value)return"";
 if(value.startsWith("//"))return"https:"+value;
 if(/^https?:\/\//i.test(value))return value;
 return "";
}
