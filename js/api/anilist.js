// AniList GraphQL transport: serialized requests, rate-limit handling and retries.
let queue=Promise.resolve();
let lastRequestAt=0;
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}

export async function query(q,v){
 const run=async()=>{
  let last;
  for(let attempt=0;attempt<4;attempt++){
   const gap=2100-(Date.now()-lastRequestAt);if(gap>0)await wait(gap);
   try{
    const response=await fetch("https://graphql.anilist.co",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({query:q,variables:v})});
    lastRequestAt=Date.now();
    let json;try{json=await response.json()}catch(error){throw new Error("Получен некорректный ответ (HTTP "+response.status+")")}
    const errors=Array.isArray(json.errors)?json.errors:[];
    const message=errors.map(item=>item.message).filter(Boolean).join("; ");
    const limited=response.status===429||errors.some(item=>Number(item.status)===429||/too many requests/i.test(item.message||""));
    const temporary=response.status>=500&&response.status<600;
    if(limited||temporary){
     if(attempt>=3)throw new Error(limited?"Слишком много запросов. Повторите позже.":"Сервис временно недоступен (HTTP "+response.status+")");
     const retryAfter=Number(response.headers.get("Retry-After"));
     const resetAt=Number(response.headers.get("X-RateLimit-Reset"));
     const delay=retryAfter>0?retryAfter*1000:resetAt>0?Math.max(1000,resetAt*1000-Date.now()+1000):limited?60000:Math.min(15000,2000*Math.pow(2,attempt));
     await wait(delay);continue;
    }
    if(!response.ok)throw new Error("Ошибка загрузки (HTTP "+response.status+(message?": "+message:""));
    if(errors.length)throw new Error("Ошибка обработки данных: "+message);
    if(!json.data)throw new Error("Получен пустой ответ");
    return json.data;
   }catch(error){
    last=error;if(attempt>=3)break;
    if(error&&/^Ошибка загрузки \(HTTP 4/.test(error.message))throw error;
    if(error&&/^Ошибка загрузки \(HTTP 4/.test(error.message))throw error;
    if(error&&/превышен лимит запросов|временно недоступен/.test(error.message))throw error;
    await wait(Math.min(8000,1000*Math.pow(2,attempt)));
   }
  }
  throw last||new Error("Не удалось загрузить данные");
 };
 const task=queue.then(run,run);queue=task.catch(()=>{});return task;
}
