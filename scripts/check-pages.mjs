// CI guard for the multi-page layout: every route has a real HTML file, the service worker knows it,
// and no source file goes back to hash routing (#title-12).
import {readFileSync,existsSync,readdirSync,statSync} from "node:fs";
import assert from "node:assert/strict";
import {join} from "node:path";

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
const recommendationModule=await import("data:text/javascript;base64,"+Buffer.from(recommendationSource).toString("base64"));
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
console.log("✓ recommendation scoring checks passed");
const homeController=read("js/app.js");
const homePage=read("js/pages/home.js");
assert.ok(homeController.includes("function homeSmartTagTiles()"),"homepage smart-tag builder must exist");
assert.ok(homeController.includes("return PLOT_TAGS.map(tag=>"),"homepage smart tags must be rendered from the curated plot-tag definitions");
assert.ok(!homePage.includes('class="genre-section"'),"homepage must not render the genre shelf");
assert.ok(homePage.includes('class="smart-tag-grid"'),"homepage must render the smart-tag section");
assert.ok(read("js/pages/anime.js").includes('class="title-genres"><div class="title-genres-heading">Жанры</div>'),"anime detail page must render an explicit genre heading");
assert.ok(read("js/pages/anime.js").includes('class="title-tags" aria-label="Жанры"'),"anime detail page must render its genre chips");
assert.ok(read("css/style.css").includes(".title-genres-heading{"),"anime genre heading must have a dedicated visible style");
console.log("✓ genre placement and homepage smart-tag checks passed");
const plotTagSource=read("js/core/plot-tags.js");
const plotTagModule=await import("data:text/javascript;base64,"+Buffer.from(plotTagSource).toString("base64"));
const reincarnation=plotTagModule.findPlotTags({d:"После смерти герой перерождается в другом мире и начинает новую жизнь."});
assert.ok(reincarnation.some(tag=>tag.id==="reincarnation"&&tag.confidence==="high"&&tag.source==="Shikimori synopsis"),"explicit synopsis evidence must produce a high-confidence plot tag with provenance");
assert.equal(plotTagModule.hasPlotTag({d:"Молодой герой отправляется в путешествие."},"hidden-power"),false,"unsupported plot traits must not be inferred");
assert.ok(homeController.includes('pageUrl("catalog",{tag:tag.id})'),"homepage plot tags must link to the matching catalog filter");
assert.ok(homeController.includes('if(xCF.tag)L=L.filter(d=>hasPlotTag(d,xCF.tag));'),"catalog must filter by evidence-based plot tags");
assert.ok(read("js/pages/catalog.js").includes('selectHtml("cf-tag","Сюжетная метка"'),"catalog must expose the plot-tag filter");
console.log("✓ evidence-based plot-tag checks passed");





if(problems.length){console.error(problems.map(p=>"✗ "+p).join("\n"));process.exit(1)}
console.log("✓ "+pages.length+" pages OK: "+pages.map(p=>p.file).join(", "));

const genreLoader=read("js/api/genders.js");
assert.ok(genreLoader.includes("fetchAnimeGenres"),"dedicated genders.js module must export the genre loader");
assert.ok(genreLoader.includes("?fields=genres"),"dedicated genre loader must request only genre data from Shikimori");
assert.ok(genreLoader.includes("resolveShikimoriId"),"genre loader must resolve Shikimori IDs when the anime only has a MAL ID");
assert.ok(genreLoader.includes("myanimelist_id"),"genre lookup must match the exact MAL ID rather than assuming IDs share a namespace");
assert.ok(read("js/app.js").includes("loadAnimeGenres(d)"),"anime detail route must call the dedicated genre loader");
assert.ok(read("js/app.js").includes("fetchDedicatedAnimeGenres(shikiId,{malId,searchTitles})"),"anime detail route must pass the MAL ID and titles when no Shikimori ID is present");
