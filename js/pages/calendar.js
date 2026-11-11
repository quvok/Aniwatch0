import {titleUrl} from "../core/router.js";

const esc=value=>String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const DAY_NAMES=["Пн","Вт","Ср","Чт","Пт","Сб","Вс"];
const FULL_DAYS=["Понедельник","Вторник","Среда","Четверг","Пятница","Суббота","Воскресенье"];
const dateKey=date=>[date.getFullYear(),String(date.getMonth()+1).padStart(2,"0"),String(date.getDate()).padStart(2,"0")].join("-");
const localDate=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d:null};
const mondayOf=date=>{const d=new Date(date.getFullYear(),date.getMonth(),date.getDate());d.setDate(d.getDate()-((d.getDay()+6)%7));return d};
const dateLabel=date=>new Intl.DateTimeFormat("ru-RU",{day:"numeric",month:"long"}).format(date);
const timeLabel=value=>{const date=localDate(value);return date?new Intl.DateTimeFormat("ru-RU",{hour:"2-digit",minute:"2-digit"}).format(date):""};

function releaseCard(item,{followed=false,inLibrary=false}={}){
 const id=item.shikimoriId?1000000000+item.shikimoriId:0;
 const title=id?'<a class="calendar-title" href="'+titleUrl(id)+'">'+esc(item.title)+'</a>':'<b class="calendar-title">'+esc(item.title)+'</b>';
 const time=timeLabel(item.airingAt);
 const episode='<span class="calendar-new-episode">Серия '+esc(item.nextEpisode??"—")+(time?' · '+esc(time):"")+'</span>';
 const poster=item.poster?'<img src="'+esc(item.poster)+'" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement("span"),{className:"calendar-poster-placeholder",textContent:"AW"}))">':'<span class="calendar-poster-placeholder">AW</span>';
 const followButton=item.shikimoriId?'<button class="calendar-follow'+(followed?' is-following':'')+'" type="button" data-a="calendar-follow" data-v="'+item.shikimoriId+'" aria-pressed="'+followed+'">'+(followed?'Отслеживается':'Следить')+'</button>':"";
 return '<article class="calendar-release">'+(id?'<a class="calendar-poster" href="'+titleUrl(id)+'">'+poster+'</a>':'<div class="calendar-poster">'+poster+'</div>')+'<div class="calendar-release-info">'+title+'<div class="calendar-release-meta">'+(item.year?item.year+" · ":"")+esc(item.type||"Аниме")+'</div><div class="calendar-episode-state">'+episode+'</div><div class="calendar-release-tags">'+(inLibrary?'<span class="calendar-library-tag">В моей библиотеке</span>':"")+'</div>'+followButton+'</div></article>';
}

export function renderCalendarPage({app,items=[],loading=false,error="",filter="all",selectedDate="",libraryShikiIds=[],libraryMalIds=[],follows={},loggedIn=false,pushState={}}){
 const now=new Date(),todayKey=dateKey(now);
 const days=Array.from({length:7},(_,offset)=>{const date=new Date(now.getFullYear(),now.getMonth(),now.getDate()+offset);return {date,key:dateKey(date),offset,weekdayIndex:(date.getDay()+6)%7}});
 const count=new Set(items.map(item=>item.day)).size;
 const inLibrary=item=>libraryShikiIds.includes(Number(item.shikimoriId))||(Number(item.malId)>0&&libraryMalIds.includes(Number(item.malId)));
 const visible=filter==="mine"?items.filter(inLibrary):items;
 const availableDates=new Set(visible.map(item=>{const date=localDate(item.airingAt);return date?dateKey(date):""}));
 const activeDate=selectedDate&&days.some(day=>day.key===selectedDate)?selectedDate:(availableDates.has(todayKey)?todayKey:(days.find(day=>availableDates.has(day.key))?.key||todayKey));
 const activeDay=days.find(day=>day.key===activeDate)||days[0];
 const activeItems=visible.filter(item=>{const date=localDate(item.airingAt);return date&&dateKey(date)===activeDate}).sort((a,b)=>new Date(a.airingAt)-new Date(b.airingAt));
 const head='<section class="calendar-page-head"><div><span class="eyebrow">РАСПИСАНИЕ РЕЛИЗОВ</span><h1>Календарь релизов</h1><p>Расписание Shikimori. Время автоматически показано по твоему часовому поясу.</p></div><div class="calendar-summary"><b>'+visible.length+'</b><span>тайтлов</span><b>'+count+'</b><span>дней с релизами</span></div></section>';
 if(loading){app.innerHTML=head+'<p class="empty">Загружаем расписание…</p>';return}
 if(error&&!items.length){app.innerHTML=head+'<section class="offline-state"><h2>Не удалось загрузить календарь</h2><p>'+esc(error)+'</p><button class="btn" type="button" data-a="calendar-reload">Повторить</button></section>';return}
 const filters='<div class="calendar-controls"><div class="calendar-filter" role="group" aria-label="Фильтр календаря"><button type="button" data-a="calendar-filter" data-v="all" class="'+(filter==="all"?"is-active":"")+'">Все аниме</button><button type="button" data-a="calendar-filter" data-v="mine" class="'+(filter==="mine"?"is-active":"")+'">Только мои</button></div><button type="button" class="calendar-push-toggle'+(pushState.enabled?" is-enabled":"")+'" data-a="calendar-push-toggle" '+(pushState.supported?"":"disabled")+'>'+(pushState.enabled?"Push включены":pushState.supported?"Включить уведомления":"Push недоступен")+'</button></div>';
 const week='<div class="calendar-week-strip">'+days.map(day=>{const dayItems=visible.filter(item=>{const date=localDate(item.airingAt);return date&&dateKey(date)===day.key});return '<button type="button" class="calendar-week-day'+(day.key===activeDate?" is-selected":"")+(day.key===todayKey?" is-today":"")+'" data-a="calendar-day" data-v="'+day.key+'"><span>'+DAY_NAMES[day.weekdayIndex]+'</span><b>'+day.date.getDate()+'</b><small>'+dayItems.length+' рел.</small></button>'}).join("")+'</div>';
 const active='<section class="calendar-selected-day"><div class="calendar-day-heading"><div><span class="eyebrow">'+(activeDate===todayKey?"СЕГОДНЯ":FULL_DAYS[activeDay.weekdayIndex].toUpperCase())+'</span><h2>'+dateLabel(activeDay.date)+'</h2></div><span>'+activeItems.length+' релизов</span></div><div class="calendar-release-list">'+(activeItems.length?activeItems.map(item=>releaseCard(item,{followed:!!follows[item.shikimoriId],inLibrary:inLibrary(item)})).join(""):'<p class="calendar-empty-day">'+(filter==="mine"?"В этот день нет релизов из твоей библиотеки.":"На этот день релизов нет.")+'</p>')+'</div></section>';
 const pushNote=loggedIn?(pushState.supported?"Уведомления приходят, даже когда AniWatch закрыт. Следи за отдельными тайтлами кнопкой «Следить».":"Этот браузер не поддерживает Web Push."):"Для push-уведомлений войди в аккаунт. Отслеживание тайтлов в этом браузере доступно и без входа.";
 app.innerHTML=head+filters+week+active+'<p class="calendar-push-note">'+esc(pushNote)+'</p><div class="calendar-toolbar"><span>Источник расписания: Shikimori</span><button type="button" class="text-link" data-a="calendar-reload">Обновить расписание ↻</button></div>';
}
