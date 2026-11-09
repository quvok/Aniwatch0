import { getSupabaseClient } from "./supabase.js";
const VISITOR_KEY="aw.analytics.visitor.v1";
let trackingStarted=false;
function visitorId(){
  try{let id=localStorage.getItem(VISITOR_KEY);if(id&&/^[0-9a-f-]{36}$/i.test(id))return id;id=crypto.randomUUID();localStorage.setItem(VISITOR_KEY,id);return id}
  catch(_){return crypto.randomUUID()}
}
function deviceType(){
  const width=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0),ua=navigator.userAgent||"";
  if(/iPad|Tablet|PlayBook|Silk/i.test(ua)||(width>=700&&width<1024&&/Android/i.test(ua)))return "tablet";
  if(width<700||/Android|iPhone|iPod|Mobile/i.test(ua))return "mobile";
  if(width<1024)return "tablet";
  return "desktop";
}
export function trackPageView(){
  if(trackingStarted||!window.location||/(^|\/)stats\.html$/i.test(location.pathname))return;
  if(navigator.doNotTrack==="1"||window.doNotTrack==="1")return;
  trackingStarted=true;
  const path=location.pathname||"/";
  let referrerHost="";
  try{if(document.referrer){const referrer=new URL(document.referrer);if(referrer.origin!==location.origin)referrerHost=referrer.hostname}}catch(_){}
  const event={action:"track",visitor_id:visitorId(),page_path:path.slice(0,180),referrer_host:referrerHost,device_type:deviceType()};
  getSupabaseClient().then(client=>client.functions.invoke("site-analytics",{body:event}))
    .then(({error})=>{if(error)console.warn("[AniWatch] Analytics event was not recorded:",error.message)})
    .catch(error=>console.warn("[AniWatch] Analytics is temporarily unavailable:",error));
}
