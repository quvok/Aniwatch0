import {titleUrl} from "../core/router.js";
const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const DAYS=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
function releaseCard(item){
 const id=item.shikimoriId?1000000000+item.shikimoriId:0;
 const title=id?'<a class="calendar-title" href="'+titleUrl(id)+'">'+esc(item.title)+'</a>':'<b class="calendar-title">'+esc(item.title)+'</b>';
 const date=item.airingAt?new Date(item.airingAt):null;
 const time=date&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(date):"";
 const episode='<span class="calendar-new-episode">Серия '+esc(item.nextEpisode??"—")+(time?' · '+esc(time):"")+'</span>';
 const poster=item.poster?'<img src="'+esc(item.poster)+'" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement("span"),{className:"calendar-poster-placeholder",textContent:"AW"}))">':'<span class="calendar-poster-placeholder">AW</span>';
 return '<article class="calendar-release">'+(id?'<a class="calendar-poster" href="'+titleUrl(id)+'">'+poster+'</a>':'<div class="calendar-poster">'+poster+'</div>')+'<div class="calendar-release-info">'+title+'<div class="calendar-release-meta">'+(item.year?item.year+" · ":"")+esc(item.type||"Аниме")+'</div><div class="calendar-episode-state">'+episode+'</div></div></article>';
}
export function renderCalendarPage({app,items=[],loading=false,error=""}){
 const now=new Date(),today=(now.getDay()+6)%7+1;
 const count=new Set(items.map(item=>item.day)).size;
 const head='<section class="calendar-page-head"><div><span class="eyebrow">РАСПИСАНИЕ РЕЛИЗОВ</span><h1>Календарь релизов</h1><p>Ближайшие выходы серий по расписанию Shikimori. Время показано по твоему часовому поясу.</p></div><div class="calendar-summary"><b>'+items.length+'</b><span>тайтлов на неделе</span><b>'+count+'</b><span>дней с релизами</span></div></section>';
 if(loading){app.innerHTML=head+'<p class="empty">Загружаем расписание…</p>';return}
 if(error&&!items.length){app.innerHTML=head+'<section class="offline-state"><h2>Не удалось загрузить календарь</h2><p>'+esc(error)+'</p><button class="btn" type="button" data-a="calendar-reload">Повторить</button></section>';return}
 const days=DAYS.map((name,index)=>{
  const day=index+1,list=items.filter(item=>item.day===day).sort((a,b)=>new Date(a.airingAt)-new Date(b.airingAt));
  return '<section class="calendar-day'+(day===today?' is-today':'')+'"><div class="calendar-day-heading"><h2>'+name+'</h2><span>'+list.length+' релизов'+(day===today?' · Сегодня':'')+'</span></div><div class="calendar-release-list">'+(list.length?list.map(releaseCard).join(""):'<p class="calendar-empty-day">На этот день релизов нет.</p>')+'</div></section>';
 }).join("");
 app.innerHTML=head+'<div class="calendar-toolbar"><span>Ближайшие премьеры</span><button type="button" class="text-link" data-a="calendar-reload">Обновить расписание ↻</button></div><div class="calendar-week">'+days+'</div>';
}
