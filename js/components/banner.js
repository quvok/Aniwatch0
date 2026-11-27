// Load Shikimori screenshots for the featured and title backdrops.
import { fetchAnimeScreenshots } from "../api/shikimori.js";
import { applyAnimeTheme } from "../core/anime-theme.js";
export function createBannerManager(options){
 var pending=new Map();
 function apply(anime){
  if(!anime)return;
  var background=options.background(anime),player=options.getPlayer();
  var backdrop=document.querySelector(".title-backdrop");
  if(backdrop&&options.isTitleRoute(anime.id)){backdrop.style.background=background;applyAnimeTheme(anime,anime.ban||anime.img)}
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
 async function loadBanners(list){
  var byId=new Map();
  for(var anime of list){
   var shikiId=Number(anime?.shikiId);
   if(!Number.isInteger(shikiId)||shikiId<=0)continue;
   if(anime.ban){apply(anime);continue}
   var items=byId.get(shikiId)||[];
   items.push(anime);
   byId.set(shikiId,items);
  }
  var ids=[...byId.keys()];
  if(!ids.length)return;
  var key=ids.join(",");
  if(!pending.has(key))pending.set(key,fetchAnimeScreenshots(ids).finally(()=>pending.delete(key)));
  try{
   var records=await pending.get(key);
   for(var record of records){
    var image=record.screenshots?.[0]?.originalUrl||"";
    if(!image.startsWith("https://shikimori.io/"))continue;
    for(var anime of byId.get(Number(record.id))||[]){
     anime.ban=image;
     apply(anime);
    }
   }
  }catch(error){console.warn("[AniWatch] Shikimori backdrop unavailable:",error)}
 }
 return {load:anime=>loadBanners([anime]),loadFeatured:loadBanners};
}
