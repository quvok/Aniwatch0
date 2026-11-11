import { fetchAnimeByIds } from "../api/shikimori.js";
import { getSupabaseClient } from "../core/supabase.js";
import { renderSiteHeader } from "../components/site-header.js";
renderSiteHeader();
const root=document.getElementById("analytics-app");
const number=value=>(Number(value)||0).toLocaleString("ru-RU");
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function shell(message,action=""){
 root.innerHTML='<section class="stats-message"><span class="eyebrow">ANALYTICS · ANIWATCH</span><h1>Статистика сайта</h1><p>'+esc(message)+'</p>'+action+'</section>';
}
function bars(items,labelKey,valueKey,emptyText,linkKey){
 if(!items?.length)return '<p class="stats-empty">'+emptyText+'</p>';
 const max=Math.max(1,...items.map(item=>Number(item[valueKey])||0));
 return '<div class="stats-bars">'+items.map(item=>{const value=Number(item[valueKey])||0;return '<div class="stats-bar-row"><div class="stats-bar-meta"><span>'+(linkKey&&item[linkKey]?'<a class="stats-page-link" href="'+esc(item[linkKey])+'">'+esc(item[labelKey])+'</a>':esc(item[labelKey]))+'</span><b>'+number(value)+'</b></div><i><b style="width:'+Math.round(value/max*100)+'%"></b></i></div>'}).join("")+'</div>';
}
function render(stats){
 const daily=Array.isArray(stats.daily)?stats.daily:[];
 const maxDaily=Math.max(1,...daily.map(item=>Number(item.views)||0));
 const chart=daily.map(item=>{
  const height=Math.max(3,Math.round((Number(item.views)||0)/maxDaily*100));
  const date=new Date(item.day+"T12:00:00"),label=new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"short"}).format(date);
  return '<div class="stats-day" title="'+esc(label+": "+number(item.views)+" просмотров")+'"><span>'+number(item.views)+'</span><i style="height:'+height+'%"></i><small>'+esc(label)+'</small></div>';
 }).join("");
 root.innerHTML='<div class="site-stats-page">'+
 '<div class="stats-heading"><div><span class="eyebrow">ANIWATCH · OWNER PANEL</span><h1>Статистика сайта</h1><p>Посещения, аудитория и источники трафика</p></div><button class="btn stats-refresh" id="stats-refresh" type="button">↻ Обновить</button></div>'+
 '<div class="stats-live"><i></i><span>Активность за последние 5 минут</span><b>'+number(stats.active_5m)+'</b></div>'+
 '<section class="stats-kpis">'+
 '<article class="stats-kpi"><small>Всего просмотров</small><b>'+number(stats.total_views)+'</b><span>С момента подключения аналитики</span></article>'+
 '<article class="stats-kpi"><small>Уникальные браузеры</small><b>'+number(stats.total_visitors)+'</b><span>Приблизительная аудитория за всё время</span></article>'+
 '<article class="stats-kpi"><small>Просмотры · 24 часа</small><b>'+number(stats.views_24h)+'</b><span>За последние сутки</span></article>'+
 '<article class="stats-kpi"><small>Посетители · 24 часа</small><b>'+number(stats.visitors_24h)+'</b><span>Уникальные браузеры за сутки</span></article>'+
 '<article class="stats-kpi"><small>Просмотры · 7 дней</small><b>'+number(stats.views_7d)+'</b><span>За последнюю неделю</span></article>'+
 '<article class="stats-kpi"><small>Посетители · 7 дней</small><b>'+number(stats.visitors_7d)+'</b><span>Уникальные браузеры за неделю</span></article>'+
 '<article class="stats-kpi"><small>Просмотры · 30 дней</small><b>'+number(stats.views_30d)+'</b><span>За последний месяц</span></article>'+
 '<article class="stats-kpi"><small>Посетители · 30 дней</small><b>'+number(stats.visitors_30d)+'</b><span>Уникальные браузеры за месяц</span></article></section>'+
 '<section class="stats-panel"><div class="stats-panel-heading"><div><h2>Посещаемость за 30 дней</h2><p>Количество просмотров страниц по дням</p></div></div><div class="stats-chart">'+(daily.length?chart:'<p class="stats-empty">Пока нет данных. График начнёт заполняться после первых посещений.</p>')+'</div></section>'+
 '<div class="stats-two-col">'+
 '<section class="stats-panel"><div class="stats-panel-heading"><div><h2>Популярные аниме</h2><p>За последние 30 дней</p></div></div>'+bars(stats.top_pages||[],"label","views","Пока нет данных о просмотрах аниме","href")+'</section>'+
 '<section class="stats-panel"><div class="stats-panel-heading"><div><h2>Устройства</h2><p>С каких устройств заходят</p></div></div>'+bars((stats.devices||[]).map(x=>({...x,device:({mobile:"Телефоны",tablet:"Планшеты",desktop:"Компьютеры",unknown:"Не определено"})[x.device]||x.device})),"device","views","Пока нет данных")+'</section>'+
 '<section class="stats-panel"><div class="stats-panel-heading"><div><h2>Источники переходов</h2><p>Внешние сайты и прямые заходы</p></div></div>'+bars(stats.referrers||[],"host","views","Источники появятся после переходов с других сайтов")+'</section>'+
 '<section class="stats-panel stats-note"><div class="stats-panel-heading"><div><h2>Как считаются данные</h2></div></div><p>Посещение записывается при открытии страницы. Повторное открытие той же страницы в течение одной минуты не добавляет новый просмотр.</p><p>«Уникальный посетитель» — отдельный браузер на устройстве, а не подтверждённый человек. Очистка localStorage или другой браузер создадут нового посетителя.</p><p>IP-адреса, имена, почта и точные URL с параметрами не сохраняются. Пользователи с включённым Do Not Track не учитываются.</p></section>'+
 '</div><p class="stats-updated">Обновлено: '+esc(new Date(stats.updated_at||Date.now()).toLocaleString("ru-RU"))+'</p></div>';
 document.getElementById("stats-refresh")?.addEventListener("click",loadStats);
}
async function loadStats(){
 const button=document.getElementById("stats-refresh");
 if(button){button.disabled=true;button.textContent="Загружаем…"}
 try{
  const client=await getSupabaseClient(),{data:sessionData,error:sessionError}=await client.auth.getSession();
  if(sessionError)throw sessionError;
  if(!sessionData.session){shell("Чтобы открыть панель, войди в свой аккаунт AniWatch.",'<a class="btn" href="profile.html">Перейти к профилю</a>');return}
  if(String(sessionData.session.user?.email||"").trim().toLowerCase()!=="demid.prim@gmail.com"){shell("Доступ к панели есть только у владельца сайта.");return}
  const {data,error}=await client.functions.invoke("site-analytics",{body:{action:"stats"}});
  if(error){const status=error.context?.status;if(status===403){shell("У этого аккаунта нет доступа к статистике сайта.");return}if(status===401){shell("Сессия закончилась. Войди в аккаунт ещё раз.",'<a class="btn" href="profile.html">Открыть профиль</a>');return}throw error}
  if(!data?.ok||!data.stats)throw new Error("Сервер не вернул статистику.");
  const stats=data.stats;
  const popular=Array.isArray(stats.top_pages)?stats.top_pages:[];
  // AniWatch Shikimori-backed IDs use a 1,000,000,000 offset.
  // Keep only anime detail/watch routes, merge both route types into one anime total.
  const animeViews=new Map();
  for(const item of popular){
    const match=String(item.path||"").match(/^\/(anime|watch)\.html\/(\d+)$/i);
    if(!match)continue;
    const internalId=Number(match[2]);
    const shikiId=internalId>=1000000000?internalId-1000000000:0;
    if(!shikiId)continue;
    const current=animeViews.get(internalId)||{id:internalId,shikiId,views:0};
    current.views+=Number(item.views)||0;
    animeViews.set(internalId,current);
  }
  const animeItems=[...animeViews.values()];
  const shikiIds=[...new Set(animeItems.map(item=>item.shikiId))];
  let animeNames=new Map();
  if(shikiIds.length){
    try{
      const animeItemsFromShiki=await fetchAnimeByIds(shikiIds);
      animeNames=new Map(animeItemsFromShiki.map(item=>[Number(item.id),item.russian||item.name||item.english||""]));
    }catch(error){console.warn("[AniWatch] Could not resolve popular anime titles:",error)}
  }
  stats.top_pages=animeItems
    .map(item=>({...item,label:animeNames.get(item.shikiId)||"",href:"anime.html?id="+item.id}))
    .filter(item=>item.label)
    .sort((a,b)=>b.views-a.views)
    .slice(0,20);
  render(stats);
 }catch(error){console.error("[AniWatch] Stats dashboard failed:",error);shell("Не удалось загрузить статистику. Проверь соединение и попробуй обновить страницу.",'<button class="btn" type="button" id="stats-retry">Повторить</button>');document.getElementById("stats-retry")?.addEventListener("click",loadStats)}
}
shell("Проверяем доступ и загружаем данные…");
loadStats();
