// CI guard for the multi-page layout: every route has a real HTML file, the service worker knows it,
// and no source file goes back to hash routing (#title-12).
import {readFileSync,existsSync,readdirSync,statSync} from "node:fs";
import assert from "node:assert/strict";
import {join} from "node:path";
import {pathToFileURL} from "node:url";

const read=file=>readFileSync(file,"utf8");
const router=read("js/core/router.js");
const block=/export const PAGES=\{([\s\S]*?)\};/.exec(router);
if(!block)throw new Error("PAGES map not found in js/core/router.js");
const pages=[...block[1].matchAll(/(\w+):"([^"]+)"/g)].map(m=>({key:m[1],file:m[2]}));
if(!pages.length)throw new Error("PAGES map is empty");

const sw=read("sw.js");
const problems=[];
for(const {key,file} of pages){
 if(!existsSync(file)){problems.push("missing page file: "+file);continue}
 const html=read(file);
 if(!html.includes('data-page="'+key+'"'))problems.push(file+': <body data-page="'+key+'"> is missing');
 if(!html.includes('src="js/app.js"'))problems.push(file+": does not load js/app.js");
 if(!html.includes('id="site-header"'))problems.push(file+': <header id="site-header"> is missing');
 if(!sw.includes('"'+file+'"'))problems.push("sw.js SHELL does not list "+file);
}

function walk(dir,out=[]){
 for(const name of readdirSync(dir)){
  const path=join(dir,name);
  if(statSync(path).isDirectory())walk(path,out);else if(path.endsWith(".js"))out.push(path);
 }
 return out;
}
for(const file of walk("js")){
 const text=read(file);
 if(file!==join("js","core","router.js")&&/location\.hash/.test(text))problems.push(file+": uses location.hash (hash routing was removed; only core/router.js may read it for old links)");
 if(/["'`]#(home|catalog|schedule|favorites|mylist|together|profile|random|title|watch)(-?["'`]|-\d|-\$\{)/.test(text))problems.push(file+": contains a hash route link");
}

// Recommendation regression checks: rating scale, cold start, genre balance and exclusions.
const recommendationSource=read("js/core/recommendations.js");
const recommendationModule=await import(pathToFileURL(join(process.cwd(),"js/core/recommendations.js")).href);
const {buildTasteProfile,rankRecommendations}=recommendationModule;
const fourStar=buildTasteProfile([{genres:["Фэнтези"],rating:8}]);
assert.ok(fourStar.topGenres.some(item=>item.name==="фэнтези"),"4/5 stars must be a positive taste signal");
assert.equal(fourStar.avoidedGenres.length,0,"4/5 stars must not create an avoided genre");
const twoStar=buildTasteProfile([{genres:["Романтика"],rating:4}]);
assert.ok(twoStar.avoidedGenres.some(item=>item.name==="романтика"),"2/5 stars should lower the genre preference");
const coldStart=buildTasteProfile([],["Фэнтези","Драма"]);
assert.equal(coldStart.topGenres.length,2,"selected starter genres must create a usable profile");
const broadTags=buildTasteProfile([{genres:["Фэнтези"],rating:10}]);
const manyTags=buildTasteProfile([{genres:["Фэнтези","Драма","Комедия","Экшен","Романтика","Ужасы","Детектив","Спорт","Музыка"],rating:10}]);
assert.ok(broadTags.topGenres.find(item=>item.name==="фэнтези").weight>manyTags.topGenres.find(item=>item.name==="фэнтези").weight,"a long genre list must not inflate each genre's weight");
const ranked=rankRecommendations([{id:101,mal:9001,genres:["Фэнтези"],score:8,recommendationSourceType:"similar",recommendationSourceTitle:"Любимый тайтл"}],fourStar,new Set(),5);
assert.equal(ranked.length,1,"matching candidate should be ranked");
assert.match(ranked[0].reason,/Любимый тайтл/,"similarity explanation must retain its source title");
assert.equal(rankRecommendations([{id:102,mal:9002,genres:["Фэнтези"],score:9}],fourStar,new Set(["mal:9002"]),5).length,0,"MAL exclusions must be respected");
assert.equal(rankRecommendations([{id:103,genres:["Хентай","Фэнтези"],score:9}],fourStar,new Set(),5).length,0,"adult genre candidates must remain excluded");
const adultContentSource=read("js/core/adult-content.js");
const adultContentModule=await import("data:text/javascript;base64,"+Buffer.from(adultContentSource).toString("base64"));
const {isAdultGenre,filterAdultGenres,isAdultAnime}=adultContentModule;
for(const genre of ["Ecchi","Этти","Hentai","Хентай","Erotica","Эротика","539","540"])assert.equal(isAdultGenre(genre),true,"adult genre must be blocked: "+genre);
assert.equal(isAdultGenre("Yaoi"),false,"Yaoi must not be treated as an 18+ genre by itself");
assert.equal(isAdultGenre("Yuri"),false,"Yuri must not be treated as an 18+ genre by itself");
assert.deepEqual(filterAdultGenres([{id:51,name:"Ecchi"},{id:10,name:"Fantasy"}]),[{id:10,name:"Fantasy"}],"adult genres must be removed from genre chips");
assert.equal(isAdultAnime({rating:"rx"}),true,"RX-rated titles must be excluded from discovery");
const ecchiProfile=buildTasteProfile([],["Ecchi"]);
assert.equal(rankRecommendations([{id:104,genres:["Ecchi"],score:9}],ecchiProfile,new Set(),5).length,0,"adult genres must remain excluded even when selected as a preference");
const adultApi=read("js/api/shikimori.js"),adultGenreLoader=read("js/api/genders.js"),adultApp=read("js/app.js"),adultSw=read("sw.js");
assert.ok(adultApi.includes("isAdultAnime(item)")&&adultApi.includes("filterAdultGenres([g])"),"Shikimori catalog and genre list must filter adult content");
assert.ok(adultGenreLoader.includes("filterAdultGenres(data.genres)"),"anime detail genre loader must filter adult genres");
assert.ok(adultApp.includes("filterAdultGenres(a.genres)")&&adultApp.includes("!isAdultGenre(g)"),"all app anime mappings and catalog genre options must filter adult genres");
assert.ok(adultSw.includes('"js/core/adult-content.js"')&&adultSw.includes("aw-v223"),"service worker must cache the adult genre filter with a new version");
console.log("✓ adult genre exclusion checks passed");
console.log("✓ recommendation scoring checks passed");
const homeController=read("js/app.js");
assert.ok(!homeController.includes("homeSmartTagTiles"),"homepage must not call the removed standalone smart-tag shelf");
const homePage=read("js/pages/home.js");
assert.ok(!homePage.includes('class="genre-section"'),"homepage must not render the genre shelf");
assert.ok(read("js/pages/anime.js").includes('class="title-genres"><div class="title-genres-heading">Жанры</div>'),"anime detail page must render an explicit genre heading");
assert.ok(read("js/pages/anime.js").includes('class="title-tags" aria-label="Жанры"'),"anime detail page must render its genre chips");
assert.ok(read("css/style.css").includes(".title-genres-heading{"),"anime genre heading must have a dedicated visible style");
console.log("✓ genre placement and homepage smart-tag checks passed");
const animeCardSource=read("js/components/anime-card.js");
assert.ok(!animeCardSource.includes("plot-tags.js"),"anime cards must not import the removed plot-tag detector");
assert.ok(!animeCardSource.includes("card-plot-tag"),"anime cards must not render plot labels");
assert.ok(!read("css/style.css").includes(".card-plot-tags"),"plot-label styles must be removed");
console.log("✓ removed plot-tag UI checks passed");
const catalogPageSource=read("js/pages/catalog.js");
assert.ok(!catalogPageSource.includes("Сюжетная метка")&&!catalogPageSource.includes("cf-tag"),"catalog must not render a plot-tag filter");
assert.ok(!read("js/app.js").includes("hasPlotTag")&&!read("js/app.js").includes("cf-tag"),"catalog controller must not filter by plot tags");
assert.ok(!read("css/style.css").includes(".catalog-tag-note"),"catalog plot-tag explanatory note styles must be removed");
console.log("✓ catalog plot-tag removal checks passed");





if(problems.length){console.error(problems.map(p=>"✗ "+p).join("\n"));process.exit(1)}
console.log("✓ "+pages.length+" pages OK: "+pages.map(p=>p.file).join(", "));

const genreLoader=read("js/api/genders.js");
assert.ok(genreLoader.includes("fetchAnimeGenres"),"dedicated genders.js module must export the genre loader");
assert.ok(genreLoader.includes("?fields=genres"),"dedicated genre loader must request only genre data from Shikimori");
assert.ok(read("js/app.js").includes("loadAnimeGenres(d)"),"anime detail route must call the dedicated genre loader");
