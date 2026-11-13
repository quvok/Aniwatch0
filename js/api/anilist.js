// AniList GraphQL transport: serialized requests, adaptive cooldown and bounded retries.
const ENDPOINT="https://graphql.anilist.co";
const MIN_REQUEST_GAP=2200;
const REQUEST_TIMEOUT=15000;
const MAX_ATTEMPTS=3;

let queue=Promise.resolve();
let lastRequestAt=0;
let cooldownUntil=0;

function wait(ms){
 return new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
}
function headerDelay(response){
 const retryAfter=response.headers.get("Retry-After");
 if(retryAfter){
  const seconds=Number(retryAfter);
  if(Number.isFinite(seconds)&&seconds>=0)return seconds*1000;
  const date=Date.parse(retryAfter);
  if(Number.isFinite(date))return Math.max(0,date-Date.now());
 }
 const resetAt=Number(response.headers.get("X-RateLimit-Reset"));
 if(Number.isFinite(resetAt)&&resetAt>0)return Math.max(0,resetAt*1000-Date.now());
 return 60000;
}
function errorMessage(json,status){
 const errors=Array.isArray(json&&json.errors)?json.errors:[];
 const detail=errors.map(item=>item&&item.message).filter(Boolean).join("; ");
 return detail||("HTTP "+status);
}
function makeError(message,status){
 const error=new Error(message);
 error.status=status||0;
 return error;
}

async function request(query,variables){
 let lastError=null;
 for(let attempt=0;attempt<MAX_ATTEMPTS;attempt++){
  const waitForSlot=Math.max(MIN_REQUEST_GAP-(Date.now()-lastRequestAt),cooldownUntil-Date.now());
  if(waitForSlot>0)await wait(waitForSlot);

  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timeout=controller?setTimeout(()=>controller.abort(),REQUEST_TIMEOUT):null;
  lastRequestAt=Date.now();
  let response;
  try{
   response=await fetch(ENDPOINT,{
    method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body:JSON.stringify({query,variables:variables||{}}),
    signal:controller?controller.signal:undefined
   });
  }catch(error){
   lastError=makeError(error&&error.name==="AbortError"?"AniList не ответил за 15 секунд.":("Не удалось подключиться к AniList: "+(error&&error.message||"сетевая ошибка")));
   if(attempt+1>=MAX_ATTEMPTS)throw lastError;
   await wait(Math.min(8000,1000*Math.pow(2,attempt)));
   continue;
  }finally{
   if(timeout)clearTimeout(timeout);
  }

  let json;
  try{
   json=await response.json();
  }catch(error){
   lastError=makeError("AniList вернул некорректный JSON (HTTP "+response.status+").",response.status);
   if(response.status>=500&&attempt+1<MAX_ATTEMPTS){
    await wait(Math.min(8000,1000*Math.pow(2,attempt)));
    continue;
   }
   throw lastError;
  }

  const errors=Array.isArray(json&&json.errors)?json.errors:[];
  const rateLimited=response.status===429||errors.some(item=>Number(item&&item.status)===429||/too many requests/i.test(item&&item.message||""));
  if(rateLimited){
   const delay=Math.max(1000,headerDelay(response));
   cooldownUntil=Math.max(cooldownUntil,Date.now()+delay);
   lastError=makeError("AniList ограничил частоту запросов. Повтор через "+Math.ceil(delay/1000)+" сек.",429);
   if(attempt+1>=MAX_ATTEMPTS)throw lastError;
   continue;
  }

  if(response.status>=500&&response.status<600){
   lastError=makeError("AniList временно недоступен (HTTP "+response.status+").",response.status);
   if(attempt+1>=MAX_ATTEMPTS)throw lastError;
   await wait(Math.min(8000,1000*Math.pow(2,attempt)));
   continue;
  }

  if(!response.ok)throw makeError("Ошибка AniList (HTTP "+response.status+"): "+errorMessage(json,response.status),response.status);

  // GraphQL may return useful partial data together with errors, even on HTTP 200.
  if(json&&json.data){
   if(errors.length)console.warn("[AniWatch] AniList returned partial GraphQL data:",errors);
   return json.data;
  }
  if(errors.length)throw makeError("Ошибка GraphQL AniList: "+errorMessage(json,response.status),response.status);
  throw makeError("AniList вернул пустой ответ.",response.status);
 }
 throw lastError||makeError("Не удалось загрузить данные AniList.");
}

export function query(queryText,variables){
 const task=queue.then(()=>request(queryText,variables),()=>request(queryText,variables));
 queue=task.catch(()=>{});
 return task;
}
