const RULES_URL="https://domain.get-video-domain.com/domain/replace_v2.json";
const CACHE_TTL=10*60*1000;
const REQUEST_TIMEOUT=1200;
let cachedRules=[];
let expiresAt=0;
let pending=null;
let retryAfter=0;

function safeHost(value){
 const raw=String(value||"").trim();
 if(!raw||raw.length>255||/[\s<>"'\\]/.test(raw))return "";
 try{
  const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:"https://"+raw);
  if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return "";
  return url.hostname.toLowerCase();
 }catch{return ""}
}
function parseRules(payload){
 const source=payload?.replace;
 const from=source?.from,to=source?.to;
 if(!Array.isArray(from)||!Array.isArray(to)||from.length!==to.length)return [];
 const rules=[];
 for(let i=0;i<Math.min(from.length,50);i++){
  const oldHost=safeHost(from[i]),newHost=safeHost(to[i]);
  if(oldHost&&newHost&&oldHost!==newHost)rules.push({from:oldHost,to:newHost});
 }
 return rules;
}
async function loadRules(){
 if(cachedRules.length&&Date.now()<expiresAt)return cachedRules;
 if(pending)return pending;
 if(Date.now()<retryAfter)return cachedRules;
 pending=(async()=>{
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT);
  try{
   const domain=typeof location!=="undefined"?location.hostname:"";
   if(!domain)return cachedRules;
   const response=await fetch(RULES_URL+"?domain="+encodeURIComponent(domain),{
    method:"GET",mode:"cors",credentials:"omit",cache:"no-store",
    headers:{Accept:"application/json"},signal:controller.signal
   });
   if(!response.ok)throw new Error("HTTP "+response.status);
   const payload=await response.json();
   const rules=parseRules(payload);
   if(!rules.length)throw new Error("Kodik вернул пустой или неподдерживаемый список доменов");
   cachedRules=rules;
   expiresAt=Date.now()+CACHE_TTL;
   retryAfter=0;
   return cachedRules;
  }catch(error){
   retryAfter=Date.now()+60*1000;
   console.warn("[AniWatch] Kodik Replacer недоступен, используем исходный адрес:",error?.message||error);
   return cachedRules;
  }finally{
   clearTimeout(timer);
   pending=null;
  }
 })();
 return pending;
}
export function warmKodikDomainRules(){
 void loadRules();
}
export async function resolveKodikDomain(link){
 const original=String(link||"").trim();
 if(!original)return "";
 let url;
 try{url=new URL(original)}catch{return original}
 if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return original;
 const rules=await loadRules();
 const host=url.hostname.toLowerCase();
 const rule=rules.find(item=>host===item.from||host.endsWith("."+item.from));
 if(!rule)return original;
 try{
  url.hostname=rule.to;
  return url.toString();
 }catch{return original}
}
