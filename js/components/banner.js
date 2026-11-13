// AniList banner loading and live banner updates.
export function createBannerManager(options){
 var cache={},pending={};
 var getAnimeMap=options.getAnimeMap,getState=options.getState;
 function apply(anime){
  if(!anime)return;
  var background=options.background(anime),player=options.getPlayer();
  var backdrop=document.querySelector(".title-backdrop");
  if(backdrop&&options.isTitleRoute(anime.id))backdrop.style.background=background;
  var playerElement=document.querySelector(".player");
  if(playerElement&&player&&player.d&&Number(player.d.id)===Number(anime.id))playerElement.style.background=background;
  var featured=options.getFeatured()||[],index=options.getFeaturedIndex(),hero=document.querySelector("#hw .hero-editorial");
  if(hero&&featured[index%featured.length]&&Number(featured[index%featured.length].id)===Number(anime.id))hero.style.background=background;
 }
 function load(anime){
  if(!anime||anime.ban)return Promise.resolve(null);
  var id=Number(anime.id);
  if(cache[id])return Promise.resolve(cache[id]);
  if(anime.source&&!(Number(anime.mal)>0))return Promise.resolve(null);
  if(pending[id])return pending[id];
  var query,variables;
  if(anime.source){
   query="query($mal:Int){Media(idMal:$mal,type:ANIME){id bannerImage}}";
   variables={mal:Number(anime.mal)};
  }else{
   query="query($id:Int){Media(id:$id,type:ANIME){id bannerImage}}";
   variables={id:Number(anime.aniId||anime.id)};
  }
  pending[id]=options.query(query,variables).then(function(response){
   var media=response&&response.Media||null;
   cache[id]=media;
   var current=getAnimeMap()[id]||anime;
   if(media&&media.bannerImage&&!current.ban){
    current.ban=media.bannerImage;
    if(current.source){
     var state=getState();state.shikiAnime=state.shikiAnime||{};state.shikiAnime[id]=current;
    }
    apply(current);options.save();
   }
   return media;
  }).finally(function(){delete pending[id]});
  return pending[id];
 }
 async function loadFeatured(list){
  var pendingItems=(list||[]).filter(function(anime){return anime&&Number(anime.mal)>0&&!anime.ban});
  for(var offset=0;offset<pendingItems.length;offset+=8){
   var batch=pendingItems.slice(offset,offset+8),aliases=[];
   batch.forEach(function(anime,index){aliases.push("b"+index+":Media(idMal:"+Number(anime.mal)+",type:ANIME){id bannerImage}")});
   try{
    var data=await options.query("query{"+aliases.join(" ")+"}");
    batch.forEach(function(anime,index){
     var media=data&&data["b"+index];cache[Number(anime.id)]=media||null;
     if(!media||typeof media.bannerImage!=="string"||!media.bannerImage)return;
     anime.ban=media.bannerImage;
     if(anime.source){
      var state=getState();state.shikiAnime=state.shikiAnime||{};state.shikiAnime[anime.id]=anime;
     }
     apply(anime);
    });
   }catch(error){console.warn("[AniWatch] Featured banner batch failed:",error)}
  }
  options.save();
 }
 return {load:load,loadFeatured:loadFeatured};
}
