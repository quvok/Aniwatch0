import { readFile } from "node:fs/promises";
import { test, expect, installApiMocks, seedState, SHIKI_ITEM } from "./fixtures.js";
import { matchAnimeAV1Title, animeAV1Sources } from "../js/api/animeav1.js";
import { playbackCorrection, readRoomPlayback, roomPosition } from "../js/core/watch-sync.js";

const roomCode = "TESTABCD";
const animeId = 1000000000 + SHIKI_ITEM.id;
const watch = (guest = false) => "/watch.html?id="+animeId+"&ep=1&room="+roomCode+(guest?"&guest=1":"");
const media = await readFile(new URL("./fixtures/watch-test.mp4.base64", import.meta.url), "utf8").then(text=>Buffer.from(text,"base64"));

const realtime = `
export function createClient() {
  return {
    auth: {
      getSession: async () => ({data:{session:window.mockUseEdge ? {user:{id:"mobile-user"}} : null},error:null}),
      onAuthStateChange: () => ({data:{subscription:{unsubscribe(){}}}})
    },
    from:()=>({select(){return this},eq(){return this},maybeSingle:async()=>({data:null,error:null})}),
    rpc:async()=>({data:null,error:null}),
    functions:{invoke:async (name,options)=>{
      if(name!=="translate-room-chat")return {data:{ok:true}};
      window.mockEdgeCalls=(window.mockEdgeCalls||0)+1;
      return {data:{translation:"Hola desde el servidor "+(options.body.text.match(/AW[A-Z0-9]+EM0X/)?.[0]||"")}};
    }},
    channel(name) {
      let broadcast, presence, subscribed;
      const channel={
        on(type,options,callback){ if(type==="broadcast")broadcast=callback;else presence=callback;return this },
        subscribe(callback){
          subscribed=callback;
          if(broadcast){
            window.mockReceive=payload=>broadcast({payload});
            window.mockStatus=status=>subscribed(status);
            queueMicrotask(()=>subscribed("SUBSCRIBED"));
          }
          return this;
        },
        track:async()=>{presence?.();return "ok"},
        presenceState:()=>({host:[{host:true}],guest:[{host:false}]}),
        send:async message=>{await window.mockRoomSend(name,message.payload);return "ok"}
      };
      return channel;
    },
    removeChannel:async()=>{}
  };
}
`;

const kodik = `<!doctype html><script>
const send=(name,value)=>parent.postMessage({key:"kodik_player_"+name,value},"*");
let time=0, playing=false, speed=1;
window.kodikControl={
 play(){playing=true;send("play")},
 pause(){playing=false;send("pause")},
 seek(value){time=value;send("seek",{time});send("time_update",time)},
 speed(value){speed=value;send("speed_change",{speed})},
 ended(){playing=false;send("video_ended")}
};
addEventListener("message",event=>{
 const cmd=event.data?.value;
 if(event.data?.key!=="kodik_player_api")return;
 if(cmd.method==="get_time"){send("duration_update",75);send("time_update",time)}
 if(cmd.method==="seek")kodikControl.seek(cmd.seconds);
 if(cmd.method==="speed")kodikControl.speed(cmd.speed);
 if(cmd.method==="play"||cmd.method==="pause")kodikControl[cmd.method]();
});
setInterval(()=>{if(playing){time+=speed;send("time_update",time)}},1000);
</script>`;

const playerJs = `<!doctype html><script>
const names={};
let time=0, playing=false;
const send=(event,value,listener)=>parent.postMessage(JSON.stringify({context:"player.js",version:"0.0.11",event,value,listener}),"*");
const emit=(event,value)=>send(event,value,names[event]);
window.sampleTime=()=>time;
addEventListener("message",({data})=>{
 const {method,value,listener}=JSON.parse(data);
 if(method==="addEventListener")names[value]=listener;
 if(method==="getDuration")send(method,75,listener);
 if(method==="getCurrentTime")send(method,time,listener);
 if(method==="play"){playing=true;emit("play")}
 if(method==="pause"){playing=false;emit("pause")}
 if(method==="setCurrentTime"){time=value;emit("timeupdate",{seconds:time,duration:75})}
});
setInterval(()=>{if(playing){time++;emit("timeupdate",{seconds:time,duration:75})}},1000);
send("ready",{events:["play","pause","timeupdate","ended"],methods:["play","pause","setCurrentTime","getCurrentTime","getDuration"]});
</script>`;

function avTitle({ title = SHIKI_ITEM.name, mal = 20, episodes = 2 } = {}) {
  return { title, type:"TV Anime", year:2002, malId:mal, alternative_titles:[],
    episodes:Array.from({length:episodes},(_,i)=>({number:i+1,slug:"correct-"+(i+1)})) };
}
const mockEmbed = (type, ep) => ({name:"Video",type,url:"https://cdn.animeav1.com/test-"+type+"-"+ep+".mp4"});
const mockIframe = ep => ({name:"StreamTape",type:"DUB",url:"https://streamtape.com/e/fixture-"+ep});

async function setup(page, { pages = [], host = false, locale = "ru", avStatus = 200, dub = true, iframe = false, translator = true, manual = false }={}) {
  await installApiMocks(page);
  await seedState(page, { room:roomCode, roomHost:host });
  await page.exposeFunction("mockRoomSend", async (name,payload)=>{
    if(name!=="aw-room-"+roomCode)return;
    await Promise.all(pages.filter(peer=>peer!==page).map(peer=>
      peer.evaluate(value=>window.mockReceive?.(value),payload).catch(()=>{})
    ));
  });
  await page.addInitScript(({language,browserTranslator})=>{
    if (!sessionStorage.getItem("aw-locale-seeded")) {
      sessionStorage.setItem("aw-locale-seeded","1");
      localStorage.setItem("aw.ui.language",language);
      localStorage.setItem("aw.room.translate","1");
    }
    if(browserTranslator){
      window.Translator = class {
        static availability(){return "available"}
        static create({targetLanguage}){
          return {translate:text=>(targetLanguage==="ru"?"Привет ":"Hola ")+(text.match(/AW[A-Z0-9]+EM0X/)?.[0]||"")};
        }
      };
    }
  },{language:locale,browserTranslator:translator});
  await page.route("https://esm.sh/**",route=>route.fulfill({ contentType:"text/javascript",body:realtime }));
  await page.route("**/functions/v1/kodik-search",async route=>{
    const urls = {1:{episode:1,link:"https://example.test/kodik/1"},2:{episode:2,link:"https://example.test/kodik/2"}};
    await route.fulfill({json:{results:[1,2].map(id=>({
      id:"kodik-"+id,type:"anime-serial",title:SHIKI_ITEM.russian,shikimori_id:SHIKI_ITEM.id,
      link:urls[1].link,translation:{id,title:"Студия "+id},seasons:{1:{episodes:urls}}
    }))}});
  });
  await page.route("https://example.test/kodik/**",route=>route.fulfill({contentType:"text/html",body:kodik}));
  await page.route("https://streamtape.com/e/fixture-**",route=>route.fulfill({contentType:"text/html",body:playerJs}));
  await page.route("https://animeav1.ahmedrangel.com/**",route=>{
    if(avStatus!==200)return route.fulfill({status:avStatus});
    const path=new URL(route.request().url()).pathname;
    const result=(data)=>route.fulfill({json:{success:true,data}});
    if(path==="/api/search")return result({media:[{title:SHIKI_ITEM.name,slug:"wrong",type:"TV Anime"},{title:SHIKI_ITEM.name,slug:"correct",type:"TV Anime"}]});
    if(path==="/api/anime/wrong")return result(avTitle({mal:99}));
    if(path==="/api/anime/correct")return result(avTitle({mal:manual?44:20}));
    const episode=Number(path.split("/").at(-1));
    if(!path.startsWith("/api/anime/correct/")||![1,2].includes(episode))return route.fulfill({status:404});
    return result({number:episode,embeds:[...(dub?[iframe?mockIframe(episode):mockEmbed("DUB",episode)]:[]),mockEmbed("SUB",episode)]});
  });
  await page.route("https://cdn.animeav1.com/test-**",route=>{
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers().range||"");
    const start = range ? Number(range[1]) : 0;
    const end = range?.[2] ? Math.min(Number(range[2]),media.length-1) : media.length-1;
    return route.fulfill({
      status:range?206:200,contentType:"video/mp4",body:media.subarray(start,end+1),
      headers:{"Accept-Ranges":"bytes",...(range?{"Content-Range":`bytes ${start}-${end}/${media.length}`}:{})}
    });
  });
}

test("MAL ID disambiguates seasons and conflicting year/type are rejected",()=>{
  const first={...avTitle(),slug:"first"};
  const second={...avTitle({mal:800}),slug:"second",year:2005};
  const anime={n:SHIKI_ITEM.name,mal:800,y:2005,kind:"tv",e:2};
  expect(matchAnimeAV1Title(anime,[first,second])).toBe(second);
  expect(matchAnimeAV1Title({...anime,mal:null},[first,{...second,type:"Película"}])).toBeNull();
  expect(matchAnimeAV1Title({...anime,mal:null},[second,{...second,slug:"ambiguous"}])).toBeNull();
  expect(animeAV1Sources([{...mockEmbed("DUB",1),url:"https://evil.example/foo.mp4"},mockEmbed("SUB",1),mockEmbed("DUB",1)])
    .map(source=>source.type)).toEqual(["DUB","SUB"]);
});

test("drift bands, buffering and network compensation",()=>{
  const state={host:true,animeId,episode:1,position:20,playing:true,playbackRate:1.5,sentAt:1000,sequence:50,duration:75,buffering:false};
  const local={time:20,duration:45,speed:1.5,playing:true};
  expect(readRoomPlayback(state)).toMatchObject({position:20,sequence:50});
  expect(readRoomPlayback({...state,episode:"1"})).toBeNull();
  expect(roomPosition(state,1400,-1)).toBeCloseTo(19.6);
  expect(roomPosition({...state,buffering:true},1400)).toBe(20);
  expect(playbackCorrection(local,{time:20.2,speed:1.5,playing:true})).toMatchObject({seek:null,rate:null});
  expect(playbackCorrection(local,{time:20.6,speed:1.5,playing:true})).toMatchObject({seek:null,rate:1.62});
  expect(playbackCorrection(local,{time:21.2,speed:1.5,playing:true})).toMatchObject({seek:21.2});
  expect(playbackCorrection(local,{time:60,speed:1,playing:false})).toMatchObject({seek:44.75,playing:false});
  expect(playbackCorrection(local,{time:60,speed:1,playing:true})).toMatchObject({seek:44.75,playing:false});
  expect(playbackCorrection({...local,buffering:true},{time:27,speed:1.5,playing:true}).seek).toBeNull();
});

test("Kodik and AnimeAV1 in independent contexts, resubscribe, offsets, chat and next episode",async ({browser})=>{
  const hostContext=await browser.newContext();
  const guestContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  try{
    const host=await hostContext.newPage();
    const guest=await guestContext.newPage();
    const pages=[host,guest];
    await setup(host,{pages,host:true});
    await setup(guest,{pages,locale:"es-419"});
    await host.goto(watch());
    const hostFrame=host.frameLocator("iframe.stream-video");
    await expect(hostFrame.locator("body")).toBeAttached();
    await hostFrame.locator("body").evaluate(()=>{window.kodikControl.seek(7)});
    await guest.goto(watch(true));
    await guest.locator('[data-provider="animeav1"]').click();
    const video=guest.locator("#stream-stage video");
    await expect(guest.getByLabel("Versión del episodio")).toHaveValue("DUB");
    await expect(guest.locator("#stream-status")).toContainText("admite la sincronización");
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(6);
    await expect(guest.locator(".room-playback-status")).toContainText("30 s de duración");
    await guest.getByRole("button",{name:"+5",exact:true}).click();
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(11);
    await guest.getByRole("button",{name:"−5",exact:true}).click();
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeLessThan(8);
    await guest.getByLabel("Versión del episodio").selectOption("SUB");
    await expect(guest.locator("#stream-stage video")).toHaveAttribute("src",/test-SUB-1/);
    await host.locator('[data-kodik-voice="1"]').click();
    await expect(host.locator(".kodik-current")).toContainText("Студия 2");
    await expect(guest.locator('[data-provider="animeav1"]')).toHaveClass(/\bon\b/);
    await expect(guest.getByLabel("Versión del episodio")).toHaveValue("SUB");
    await guest.evaluate(()=>document.querySelector("video").muted=true);
    await hostFrame.locator("body").evaluate(()=>window.kodikControl.play());
    await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(false);
    await hostFrame.locator("body").evaluate(()=>{window.kodikControl.speed(1.5);window.kodikControl.seek(18)});
    await expect.poll(()=>video.evaluate(el=>el.playbackRate)).toBeCloseTo(1.5,0);
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(17);
    await hostFrame.locator("body").evaluate(()=>window.kodikControl.pause());
    await expect.poll(()=>video.evaluate(el=>el.paused)).toBe(true);
    await guest.evaluate(()=>window.mockStatus("TIMED_OUT"));
    await expect(guest.locator("#room-status")).toHaveText("Sin conexión");
    await hostFrame.locator("body").evaluate(()=>window.kodikControl.seek(25));
    await guest.evaluate(()=>window.mockStatus("SUBSCRIBED"));
    await expect.poll(()=>video.evaluate(el=>el.currentTime)).toBeGreaterThan(24);
    await guest.evaluate(({id})=>window.mockReceive({type:"episode-change",host:true,animeId:id,episode:2,position:0,duration:75,playing:false,playbackRate:1,sentAt:Date.now(),sequence:1,buffering:false}),{id:animeId});
    await expect(guest).toHaveURL(/ep=1/);
    await host.locator("#ci").fill("Привет 😊");
    await host.locator("#ci").press("Enter");
    await expect(guest.locator("#ms")).toContainText("Hola 😊");
    await guest.getByText("Mostrar original").click();
    await expect(guest.locator("#ms")).toContainText("Привет 😊");
    await guest.locator("#ci").fill("Hola 👋");
    await guest.locator("#ci").press("Enter");
    await expect(host.locator("#ms")).toContainText("Привет 👋");
    expect(await guest.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await hostFrame.locator("body").evaluate(()=>window.kodikControl.ended());
    await expect(host).toHaveURL(/ep=2/);
    await expect(guest).toHaveURL(/ep=2/);
    await expect(guest.locator("#stream-stage video")).toHaveAttribute("src",/test-SUB-2/);
  }finally{
    await guestContext.close();
    await hostContext.close();
  }
});

test("documented Player.js handshake is required for iframe control",async ({page})=>{
  await setup(page,{iframe:true});
  await page.goto(watch(true));
  await page.locator('[data-provider="animeav1"]').click();
  await expect(page.locator("#stream-status")).toContainText("поддерживает синхронизацию");
  await page.evaluate(({id})=>window.mockReceive({type:"state",host:true,animeId:id,episode:1,position:12,duration:75,playing:false,playbackRate:1,sentAt:Date.now(),sequence:100,buffering:false}),{id:animeId});
  await expect.poll(()=>page.frameLocator("iframe.stream-video").locator("body").evaluate(()=>window.sampleTime())).toBe(12);
});

test("shows a Spanish subtitle option and reports missing dub",async ({page})=>{
  await setup(page,{dub:false,locale:"es-419"});
  await page.goto(watch(true));
  await page.locator('[data-provider="animeav1"]').click();
  await expect(page.getByLabel("Versión del episodio")).toHaveValue("SUB");
  await expect(page.locator("#stream-options")).toContainText("No hay doblaje en español");
});

test("handles rate limits and leaves Kodik available",async ({page})=>{
  await setup(page,{avStatus:429});
  await page.goto(watch(true));
  await page.locator('[data-provider="animeav1"]').click();
  await expect(page.locator("#stream-status")).toContainText("ограничил частоту запросов");
  await page.locator('[data-provider="kodik"]').click();
  await expect(page.locator("iframe.stream-video")).toHaveAttribute("src",/example.test/);
});

test("translation failure preserves the original and treats markup as text",async ({page})=>{
  await setup(page,{translator:false,locale:"es-419"});
  await page.goto(watch(true));
  await expect(page.locator("#room-status")).toHaveText("Conectado");
  await page.evaluate(()=>window.mockReceive({type:"chat",sender:"remote",name:"<b>Guest</b>",text:"Привет <img src=x onerror=alert(1)>"}));
  await expect(page.locator("#ms")).toContainText("Traducción no disponible");
  await expect(page.locator("#ms")).toContainText("<img src=x onerror=alert(1)>");
  await expect(page.locator("#ms img")).toHaveCount(0);
});

test("header language selector persists across pages",async ({page})=>{
  await setup(page);
  await page.goto("/catalog.html");
  await page.locator(".site-language").selectOption("es-419");
  await expect(page.locator("html")).toHaveAttribute("lang","es-419");
  await expect(page.locator(".desktop-sidebar")).toContainText("Catálogo");
  await page.goto("/together.html");
  await expect(page.locator(".site-language")).toHaveValue("es-419");
});

test("requires manual confirmation for an ambiguous match and remembers its slug",async ({page})=>{
  await setup(page,{manual:true});
  await page.goto(watch(true));
  await page.locator('[data-provider="animeav1"]').click();
  await page.getByRole("combobox",{name:"Название на AnimeAV1"}).selectOption("correct");
  await page.getByRole("button",{name:"Подтвердить тайтл"}).click();
  await expect(page.locator("#stream-stage video")).toHaveAttribute("src",/test-DUB-1/);
  await page.reload();
  await expect(page.locator("#stream-stage video")).toHaveAttribute("src",/test-DUB-1/);
  await expect(page.getByRole("button",{name:"Подтвердить тайтл"})).toHaveCount(0);
});

test("authenticated Edge fallback receives protected emoji and keeps the original",async ({page})=>{
  await setup(page,{translator:false,locale:"es-419"});
  await page.goto(watch(true));
  await expect(page.locator("#room-status")).toHaveText("Conectado");
  await page.evaluate(()=>{
    window.mockUseEdge=true;
    window.mockReceive({type:"chat",sender:"remote",name:"Amigo",text:"Привет 👩‍🚀"});
  });
  await expect(page.locator("#ms")).toContainText("Hola desde el servidor 👩‍🚀");
  expect(await page.evaluate(()=>window.mockEdgeCalls)).toBe(1);
  await page.locator("#room-auto-translate").uncheck();
  await expect(page.locator("#ms")).toContainText("Привет 👩‍🚀");
  await expect(page.locator("#ms")).not.toContainText("Hola desde el servidor");
});

test("unsupported embed shows the host's position and offers Kodik",async ({page})=>{
  await setup(page);
  await page.route("https://animeav1.ahmedrangel.com/api/anime/correct/1", route=>route.fulfill({
    json:{success:true,data:{number:1,embeds:[{name:"Voe",type:"DUB",url:"https://voe.sx/e/fixture"}]}}
  }));
  await page.route("https://voe.sx/e/fixture", route=>route.fulfill({body:"<html></html>",contentType:"text/html"}));
  await page.goto(watch(true));
  await expect(page.locator("#room-status")).toHaveText("На связи");
  await page.locator('[data-provider="animeav1"]').click();
  await expect(page.locator("#stream-status")).toContainText("Синхронизация с выбранным источником недоступна");
  await page.evaluate(id=>window.mockReceive({
    type:"state",host:true,animeId:id,episode:1,position:65,duration:1000,playing:false,
    playbackRate:1,sentAt:Date.now(),sequence:100,buffering:false
  }),animeId);
  await expect(page.getByText("Поставь видео вручную на 1:05, позицию ведущего.")).toBeVisible();
  await page.getByRole("button",{name:"Перейти на Kodik · русский звук"}).click();
  await expect(page.locator('[data-provider="kodik"]')).toHaveClass(/\bon\b/);
  await expect(page.getByRole("button",{name:"Перейти на Kodik · русский звук"})).toBeHidden();
});
