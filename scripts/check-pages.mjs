// CI guard for the multi-page layout: every route has a real HTML file, the service worker knows it,
// and no source file goes back to hash routing (#title-12).
import {readFileSync,existsSync,readdirSync,statSync} from "node:fs";
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

if(problems.length){console.error(problems.map(p=>"✗ "+p).join("\n"));process.exit(1)}
console.log("✓ "+pages.length+" pages OK: "+pages.map(p=>p.file).join(", "));
