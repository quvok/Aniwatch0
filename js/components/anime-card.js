// Shared anime-card renderer. Dependencies are injected to keep it independent from app state.
export function renderAnimeCard(d,options={}){
 const state=options.state||{};
 const score=Number(d.r||0),status=d.s||"Аниме",fav=(state.fav||[]).includes(d.id);
 const background=options.background(d);
 const href=options.href||("#title-"+d.id);
 const progress=options.progress;
 return '<a class="card" data-anime-id="'+d.id+'" href="'+href+'"><div class="poster" style="background:'+background+'">'+(d.img?"":"<i>"+d.n[0]+"</i>")+'<span class="rating">★ '+(score?score.toFixed(1):"—")+'</span><em class="poster-status">'+status+'</em><button type="button" class="poster-fav'+(fav?" active":"")+'" data-a="fav" data-i="'+d.id+'" aria-label="'+(fav?"Убрать из избранного":"Добавить в избранное")+'" aria-pressed="'+fav+'">'+(fav?"♥":"♡")+'</button>'+(progress!=null?'<u style="width:'+progress+'%"></u>':"")+'</div><b>'+d.n+'</b><small>'+d.g.slice(0,2).join(" · ")+" · "+d.y+'</small></a>';
}
