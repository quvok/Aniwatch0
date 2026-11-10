import {titleUrl} from "../core/router.js";
import {findPlotTags} from "../core/plot-tags.js";
// Shared anime-card renderer. Dependencies are injected to keep it independent from app state.
export function renderAnimeCard(d,options={}){
 const state=options.state||{};
 const score=Number(d.r||0),status=d.s||"Аниме",fav=(state.fav||[]).includes(d.id);
 const background=options.background(d);
 const href=options.href||titleUrl(d.id);
 const progress=options.progress;
 const plotTags=findPlotTags(d).slice(0,2).map(tag=>'<span class="card-plot-tag">'+tag.label.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))+'</span>').join("");
 const badge=options.badge?String(options.badge).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])):"";
 return '<a class="card" data-anime-id="'+d.id+'" href="'+href+'"><div class="poster" style="background:'+background+'">'+(d.img?'<img class="poster-image" src="'+String(d.img).replace(/&/g,"&amp;").replace(/"/g,"&quot;")+'" alt="" loading="eager" fetchpriority="low" decoding="async">':"<i>"+d.n[0]+"</i>")+'<span class="rating">★ '+(score?score.toFixed(1):"—")+'</span><em class="poster-status">'+status+'</em>'+(plotTags?'<div class="card-plot-tags" aria-label="Умные метки сюжета">'+plotTags+'</div>':"")+(badge?'<span class="poster-new-episode">'+badge+'</span>':"")+'<button type="button" class="poster-fav'+(fav?" active":"")+'" data-a="fav" data-i="'+d.id+'" aria-label="'+(fav?"Убрать из избранного":"Добавить в избранное")+'" aria-pressed="'+fav+'">'+(fav?"♥":"♡")+'</button>'+(progress!=null?'<u style="width:'+progress+'%"></u>':"")+'<div class="card-preview"><strong>'+d.n+'</strong><span>'+(d.g||[]).slice(0,3).join(" · ")+'</span><small>'+(d.y||"")+" · "+status+'</small><i>Подробнее об аниме <b>→</b></i></div></div><b>'+d.n+'</b><small>'+d.g.slice(0,2).join(" · ")+" · "+d.y+'</small></a>';
}
