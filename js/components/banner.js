// AniList banner loading and live banner updates.
export function createBannerManager(options){
 var cache=Object.create(null),pending=Object.create(null),negativeCacheTtl=5*60*1000;
 var getAnimeMap=options.getAnimeMap,getState=options.getState;
 var maxFeaturedLookups=30,batchSize=8;
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
   if(active&&Number(active.id)===Number(anime.id)){
    hero.style.background=background;
    var image=anime.ban;
    hero.style.setProperty("--hero-poster",typeof image==="string"&&image?"url("+JSON.stringify(image)+")":"none");
   }
  }
 }
 function saveBanner(anime,media){
  if(!anime||!media||typeof media.bannerImage!=="string"||!media.bannerImage||anime.ban)return false;
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
  return !!entry&&((entry.media&&typeof entry.media.bannerImage==="string"&&!!entry.media.bannerImage)||Date.now()-entry.at<negativeCacheTtl);
 }
 function lookupFor(anime){
  if(!anime)return null;
  if(anime.source==="shikimori"){
   // Shikimori IDs are MAL IDs. Never pass a Shikimori/app ID as AniList's id.
   var mal=Number(anime.mal)||Number(anime.shikiId);
   if(Number.isInteger(mal)&&mal>0)return {field:"idMal",value:mal,key:"mal:"+mal};
   var mappedId=Number(anime.aniId);
   if(Number.isInteger(mappedId)&&mappedId>0)return {field:"id",value:mappedId,key:"id:"+mappedId};
   return null;
  }
  var id=Number(anime.aniId||anime.id);
  if(!Number.isInteger(id)||id<=0)return null;
  return {field:"id",value:id,key:"id:"+id};
 }
 function queryFor(lookup){
  if(!lookup)return null;
  return {query:"query($id:Int){Media("+lookup.field+":$id,type:ANIME){id bannerImage}}",variables:{id:lookup.value}};
 }
 function load(anime){
  if(!anime)return Promise.resolve(null);
  var id=Number(anime.id),lookup=lookupFor(anime);
  if(!Number.isInteger(id)||id<=0||!lookup)return Promise.resolve(null);
  if(anime.ban){apply(anime);return Promise.resolve(null)}
  var cached=cache[lookup.key];
  if(cacheValid(cached)){
   var current=(getAnimeMap()||{})[id]||anime;
   if(cached.media&&saveBanner(current,cached.media))options.save();
   return Promise.resolve(cached.media);
  }
  if(pending[lookup.key])return pending[lookup.key];
  var request=queryFor(lookup);
  pending[lookup.key]=options.query(request.query,request.variables).then(function(response){
   var media=response&&response.Media||null;
   cache[lookup.key]={media:media,at:Date.now()};
   var current=(getAnimeMap()||{})[id]||anime;
   if(saveBanner(current,media))options.save();
   return media;
  }).finally(function(){delete pending[lookup.key]});
  return pending[lookup.key];
 }
 function warmBanner(url,priority){
  if(typeof url!=="string"||!url)return;
  var image=new Image();
  if("fetchPriority" in image)image.fetchPriority=priority?"high":"low";
  image.decoding="async";
  image.src=url;
 }
 async function loadFeatured(list){
  var seen=new Set(),items=[],changed=false,featured=list||[];
  var activeIndex=Number(options.getFeaturedIndex())||0;
  function isNearActive(index){
   if(!featured.length)return false;
   var distance=(index-activeIndex+featured.length)%featured.length;
   return distance<=2;
  }
  featured.forEach(function(anime,index){
   if(!anime)return;
   var id=Number(anime.id),lookup=lookupFor(anime);
   if(!Number.isInteger(id)||id<=0||!lookup||seen.has(lookup.key))return;
   seen.add(lookup.key);
   var cached=cache[lookup.key];
   if(anime.ban){
    if(isNearActive(index))warmBanner(anime.ban,index===activeIndex);
    return;
   }
   if(cacheValid(cached)){
    if(cached.media&&saveBanner(anime,cached.media))changed=true;
    if(cached.media&&cached.media.bannerImage&&isNearActive(index))warmBanner(cached.media.bannerImage,index===activeIndex);
    return;
   }
   if(items.length<maxFeaturedLookups)items.push({anime:anime,index:index,lookup:lookup});
  });
  var batches=[];
  for(var offset=0;offset<items.length;offset+=batchSize)batches.push(items.slice(offset,offset+batchSize));
  await Promise.all(batches.map(async function(batch){
   var aliases=[];
   batch.forEach(function(entry,index){
    aliases.push("b"+index+":Media("+entry.lookup.field+":"+Number(entry.lookup.value)+",type:ANIME){id bannerImage}");
   });
   try{
    var data=await options.query("query{"+aliases.join(" ")+"}");
    batch.forEach(function(entry,index){
     var media=data&&data["b"+index]||null;
     cache[entry.lookup.key]={media:media,at:Date.now()};
     if(saveBanner(entry.anime,media))changed=true;
     if(media&&media.bannerImage&&isNearActive(entry.index))warmBanner(media.bannerImage,entry.index===activeIndex);
    });
   }catch(error){
    console.warn("[AniWatch] Featured banner batch failed:",error);
   }
  }));
  if(changed)options.save();
 }
 return {load:load,loadFeatured:loadFeatured};
}
