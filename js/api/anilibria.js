const API_BASE="https://anilibria.top/api/v1";
const CACHE_KEY="aw-anilibria-schedule-week-v1";
const CACHE_TTL=10*60*1000;
let memoryCache=null,memoryAt=0,pending=null;

function normalizePayload(payload){
 const raw=Array.isArray(payload)?payload:Array.isArray(payload?.data)?payload.data:Array.isArray(payload?.data?.items)?payload.data.items:[];
 return raw.filter(item=>item&&item.release).map(item=>{
  const release=item.release||{},episode=item.published_release_episode||null;
  const poster=release.poster||{},optimized=poster.optimized||{};
  const posterPath=optimized.preview||optimized.src||optimized.thumbnail||poster.preview||poster.src||poster.thumbnail||"";
  let posterUrl="";
  if(posterPath){try{posterUrl=new URL(posterPath, "https://anilibria.top").href}catch{}}
  return {
   day:Number(release.publish_day?.value)||Number(item.day)||0,
   dayName:String(release.publish_day?.description||""),
   releaseId:Number(release.id)||0,
   alias:String(release.name?.alias||""),
   title:String(release.name?.main||release.name?.english||"Без названия"),
   english:String(release.name?.english||""),
   shikimoriId:Number(release.shikimori?.id)||0,
   malId:Number(release.mal?.id)||0,
   poster:posterUrl,
   year:Number(release.year)||0,
   ongoing:!!release.is_ongoing,
   publishedEpisode:episode&&Number.isFinite(Number(episode.ordinal))?Number(episode.ordinal):null,
   publishedAt:episode?.updated_at||null,
   nextEpisode:Number(item.next_release_episode_number)||null,
   fullSeason:!!item.full_season_is_released,
   notification:String(release.notification||""),
   type:String(release.type?.description||"")
  };
 }).filter(item=>item.day>=1&&item.day<=7);
}

export async function fetchAniLibriaWeek(force=false){
 if(!force&&memoryCache&&Date.now()-memoryAt<CACHE_TTL)return memoryCache;
 if(pending)return pending;
 if(!force){
  try{
   const saved=JSON.parse(sessionStorage.getItem(CACHE_KEY)||"null");
   if(saved&&Array.isArray(saved.items)&&Date.now()-saved.at<CACHE_TTL){memoryCache=saved.items;memoryAt=saved.at;return memoryCache}
  }catch{}
 }
 pending=(async()=>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   const response=await fetch(API_BASE+"/anime/schedule/week",{signal:controller.signal,headers:{Accept:"application/json"}});
   if(!response.ok)throw new Error("AniLibria API: HTTP "+response.status);
   const payload=await response.json(),items=normalizePayload(payload);
   if(!items.length)throw new Error("AniLibria не вернула расписание");
   memoryCache=items;memoryAt=Date.now();
   try{sessionStorage.setItem(CACHE_KEY,JSON.stringify({at:memoryAt,items}))}catch{}
   return items;
  }finally{clearTimeout(timer);pending=null}
 })();
 return pending;
}
