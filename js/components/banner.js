// AniList banner loading and live banner updates.
export function createBannerManager(options){
 var cache=Object.create(null),pending=Object.create(null),negativeCacheTtl=5*60*1000;
 var getAnimeMap=options.getAnimeMap,getState=options.getState;
 function apply(anime){
  if(!anime)return;
  var background=options.background(anime),player=options.getPlayer();
  var backdrop=document.querySelector(".title-backdrop");
  if(backdrop&&options.isTitleRoute(anime.id))backdrop.style.background=background;
  var playerElement=document.querySelector(".player");
  if(playerElement&&player&&player.d&&Number(player.d.id)===Number(anime.id))playerElement.style.background=background;
  var featured=options.getFeatured()||[],index=Number(options.getFeaturedIndex())||0;
  var hero=document.querySelector("#hw .hero-editorial");
  if(hero&&featured.length){
   var active=featured[((index%featured.length)+featured.length)%featured.length];
   if(active&&Number(active.id)===Number(anime.id))hero.style.background=background;
  }
 }
 function saveBanner(anime,media){
  if(!anime||!media||typeof media.bannerImage!=="string"||!media.bannerImage)return false;
  if(anime.ban)return false;
  anime.ban=media.bannerImage;
  if(anime.source){
   var state=getState();
   state.shikiAnime=state.shikiAnime||{};
   state.shikiAnime[Number(anime.id)]=anime;
  }
  apply(anime);
  return true;
 }
 function cacheValid(entry){
  return !!entry&&(!!entry.media||Date.now()-entry.at<negativeCacheTtl);
 }
 function queryFor(anime){
  if(anime.source){
   var mal=Number(anime.mal);
   if(!Number.isInteger(mal)||mal<=0)return null;
   return {query:"query($mal:Int){Media(idMal:$mal,type:ANIME){id bannerImage}}",variables:{mal:mal}};
  }
  var id=Number(anime.aniId||anime.id);
  if(!Number.isInteger(id)||id<=0)return null;
  return {query:"query($id:Int){Media(id:$id,type:ANIME){id bannerImage}}",variables:{id:id}};
 }
 function load(anime){
  if(!anime)return Promise.resolve(null);
  var id=Number(anime.id);
  if(!Number.isInteger(id)||id<=0)return Promise.resolve(null);
  if(anime.ban){apply(anime);return Promise.resolve(null)}
  var cached=cache[id];
  if(cacheValid(cached)){
   var current=(getAnimeMap()||{})[id]||anime;
   if(cached.media)saveBanner(current,cached.media);
   return Promise.resolve(cached.media);
  }
  if(pending[id])return pending[id];
  var request=queryFor(anime);
  if(!request)return Promise.resolve(null);
  pending[id]=options.query(request.query,request.variables).then(function(response){
   var media=response&&response.Media||null;
   cache[id]={media:media,at:Date.now()};
   var current=(getAnimeMap()||{})[id]||anime;
   if(saveBanner(current,media))options.save();
   return media;
  }).finally(function(){delete pending[id]});
  return pending[id];
 }
 async function loadFeatured(list){
  var seen=new Set(),items=[],changed=false;
  (list||[]).forEach(function(anime){
   if(!anime||anime.ban)return;
   var mal=Number(anime.mal),id=Number(anime.id);
   if(!Number.isInteger(mal)||mal<=0||!Number.isInteger(id)||id<=0||seen.has(mal))return;
   seen.add(mal);
   var cached=cache[id];
   if(cacheValid(cached)){
    if(cached.media&&saveBanner(anime,cached.media))changed=true;
    return;
   }
   items.push(anime);
  });
  for(var offset=0;offset<items.length;offset+=8){
   var batch=items.slice(offset,offset+8),aliases=[];
   batch.forEach(function(anime,index){
    aliases.push("b"+index+":Media(idMal:"+Number(anime.mal)+",type:ANIME){id bannerImage}");
   });
   try{
    var data=await options.query("query{"+aliases.join(" ")+"}");
    batch.forEach(function(anime,index){
     var media=data&&data["b"+index]||null;
     cache[Number(anime.id)]={media:media,at:Date.now()};
     if(saveBanner(anime,media))changed=true;
    });
   }catch(error){
    console.warn("[AniWatch] Featured banner batch failed:",error);
   }
  }
  if(changed)options.save();
 }
 return {load:load,loadFeatured:loadFeatured};
}
