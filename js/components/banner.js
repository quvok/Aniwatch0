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
   // Shikimori IDs and app IDs are not AniList/MAL IDs. Use only explicit cross-source IDs.
   var mal=Number(anime.mal);
   if(Number.isInteger(mal)&&mal>0)return {field:"idMal",value:mal,key:"mal:"+mal};
   var mappedId=Number(anime.aniId);
   if(Number.isInteger(mappedId)&&mappedId>0)return {field:"id",value:mappedId,key:"id:"+mappedId};
   // Last resort: search by the original title, then verify the returned title before saving.
   var search=String(anime.o||anime.n||"").trim();
   if(search)return {field:"search",value:search,key:"search:"+search.toLocaleLowerCase()};
   return null;
  }
  var id=Number(anime.aniId||anime.id);
  if(!Number.isInteger(id)||id<=0)return null;
  return {field:"id",value:id,key:"id:"+id};
 }
 function queryFor(lookup){
  if(!lookup)return null;
  if(lookup.field==="search")return {query:"query($search:String!){Media(search:$search,type:ANIME){id title{romaji english native} seasonYear bannerImage}}",variables:{search:lookup.value}};
  return {query:"query($id:Int){Media("+lookup.field+":$id,type:ANIME){id title{romaji english native} seasonYear bannerImage}}",variables:{id:lookup.value}};
 }
 function normalizeTitle(value){
  return String(value||"").toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]/gu,"");
 }
 function verifiedMedia(anime,media,lookup){
  if(!media)return null;
  if(!lookup||lookup.field!=="search")return media;
  var wanted=normalizeTitle(lookup.value),titles=media.title||{};
  var exact=[titles.romaji,titles.english,titles.native].some(title=>normalizeTitle(title)===wanted);
  if(!exact)return null;
  var animeYear=Number(anime&&anime.y)||0,mediaYear=Number(media.seasonYear)||0;
  if(animeYear&&mediaYear&&Math.abs(animeYear-mediaYear)>1)return null;
  return media;
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
   var responseMedia=response&&response.Media||null;
   var current=(getAnimeMap()||{})[id]||anime;
   var media=verifiedMedia(current,responseMedia,lookup);
   cache[lookup.key]={media:media,at:Date.now()};
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
    var argument=entry.lookup.field==="search"?"search:"+JSON.stringify(entry.lookup.value):entry.lookup.field+":"+Number(entry.lookup.value);
    aliases.push("b"+index+":Media("+argument+",type:ANIME){id title{romaji english native} seasonYear bannerImage}");
   });
   try{
    var data=await options.query("query{"+aliases.join(" ")+"}");
    batch.forEach(function(entry,index){
     var responseMedia=data&&data["b"+index]||null;
     var media=verifiedMedia(entry.anime,responseMedia,entry.lookup);
     cache[entry.lookup.key]={media:media,at:Date.now()};
     if(saveBanner(entry.anime,media))changed=true;
     if(media&&media.bannerImage&&isNearActive(entry.index))warmBanner(media.bannerImage,entry.index===activeIndex);
    });
   }catch(error){
    console.warn("[AniWatch] Featured banner batch failed:",error);
   }
  }));
  if(changed)options.save();
  // The hero was rendered before these asynchronous lookups completed. Re-render it
  // from the now-enriched H list instead of relying only on an in-place DOM update.
  if(typeof options.refreshFeatured==="function")options.refreshFeatured();
 }
 return {load:load,loadFeatured:loadFeatured};
}
