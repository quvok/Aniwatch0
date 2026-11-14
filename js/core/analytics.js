import { getSupabaseClient } from "./supabase.js";
const VISITOR_KEY="aw.analytics.visitor.v2";
const QUALIFIED_AFTER_MS=10000;
let trackingStarted=false;
function createVisitorId(){
  if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();
  const bytes=new Uint8Array(16);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const h=Array.from(bytes,value=>value.toString(16).padStart(2,"0")).join("");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-"+h.slice(12,16)+"-"+h.slice(16,20)+"-"+h.slice(20);
}
function validId(id){return typeof id==="string"&&/^[0-9a-f-]{36}$/i.test(id)}
function visitorId(){
  try{
    const stored=localStorage.getItem(VISITOR_KEY);
    if(validId(stored))return stored;
    const id=createVisitorId();localStorage.setItem(VISITOR_KEY,id);return id;
  }catch(_){}
  try{
    const stored=sessionStorage.getItem(VISITOR_KEY);
    if(validId(stored))return stored;
    const id=createVisitorId();sessionStorage.setItem(VISITOR_KEY,id);return id;
  }catch(_){}
  return createVisitorId();
}
function deviceType(){
  const width=Math.max(document.documentElement.clientWidth||0,window.innerWidth||0),ua=navigator.userAgent||"";
  if(/iPad|Tablet|PlayBook|Silk/i.test(ua)||(width>=700&&width<1024&&/Android/i.test(ua)))return "tablet";
  if(width<700||/Android|iPhone|iPod|Mobile/i.test(ua))return "mobile";
  if(width<1024)return "tablet";
  return "desktop";
}
export function trackPageView(){
  if(trackingStarted||!window.location||/(^|\\/)stats\\.html$/i.test(location.pathname))return;
  if(navigator.doNotTrack==="1"||window.doNotTrack==="1"||navigator.webdriver)return;
  if(/bot|crawler|spider|headless/i.test(navigator.userAgent||""))return;
  trackingStarted=true;
  const pathname=location.pathname||"/";
  const routeId=Number(new URLSearchParams(location.search).get("id"))||0;
  const routeMatch=pathname.match(/\\/(anime|watch)\\.html$/i);
  const path=routeMatch&&routeId>0?pathname.replace(/\\/$/,"")+"/"+routeId:pathname;
  let referrerHost="";
  try{if(document.referrer){const referrer=new URL(document.referrer);if(referrer.origin!==location.origin)referrerHost=referrer.hostname}}catch(_){}
  const event={action:"track",visitor_id:visitorId(),page_path:path.slice(0,180),referrer_host:referrerHost,device_type:deviceType()};
  let timer=null,sent=false;
  const stop=()=>{if(timer!==null){clearTimeout(timer);timer=null}};
  const send=()=>{
    if(sent||document.visibilityState!=="visible")return;
    sent=true;stop();
    document.removeEventListener("visibilitychange",schedule);
    window.removeEventListener("pagehide",stop);
    getSupabaseClient().then(client=>client.functions.invoke("site-analytics",{body:event}))
      .then(({error})=>{if(error)console.warn("[AniWatch] Analytics event was not recorded:",error.message)})
      .catch(error=>console.warn("[AniWatch] Analytics is temporarily unavailable:",error));
  };
  function schedule(){
    stop();
    if(!sent&&document.visibilityState==="visible")timer=window.setTimeout(send,QUALIFIED_AFTER_MS);
  }
  document.addEventListener("visibilitychange",schedule);
  window.addEventListener("pagehide",stop,{once:true});
  schedule();
}
