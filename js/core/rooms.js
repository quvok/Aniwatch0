import { supabase } from "./supabase.js";
let activeChannel = null;
let activeCode = "";
const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export function createRoomCode(length = 8) {
 const bytes = new Uint8Array(length);
 if (globalThis.crypto?.getRandomValues) crypto.getRandomValues(bytes);
 else for (let i=0;i<length;i++) bytes[i]=Math.floor(Math.random()*256);
 return Array.from(bytes,value=>alphabet[value%alphabet.length]).join("");
}
export async function connectRoom(code,handlers={}) {
 await disconnectRoom();
 const roomCode=String(code||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,12);
 if(!roomCode)throw new Error("Не указан код комнаты.");
 const presenceKey=globalThis.crypto?.randomUUID?.()||("guest-"+Math.random().toString(36).slice(2));
 const channel=supabase.channel("aw-room-"+roomCode,{config:{broadcast:{self:false,ack:true},presence:{key:presenceKey}}});
 channel.on("broadcast",{event:"room-event"},message=>{if(typeof handlers.onEvent==="function")handlers.onEvent(message.payload||{})})
  .on("presence",{event:"sync"},()=>{if(typeof handlers.onPresence==="function")handlers.onPresence(channel.presenceState())});
 activeChannel=channel;activeCode=roomCode;
 return new Promise((resolve,reject)=>{
  let settled=false;
  channel.subscribe(async status=>{
   if(status==="SUBSCRIBED"){
    try{await channel.track({name:String(handlers.name||"Гость").slice(0,24),host:!!handlers.host,joinedAt:Date.now()});if(typeof handlers.onStatus==="function")handlers.onStatus("connected");settled=true;resolve(channel)}
    catch(error){if(typeof handlers.onStatus==="function")handlers.onStatus("error",error);if(!settled){settled=true;reject(error)}}
   }else if(status==="CHANNEL_ERROR"||status==="TIMED_OUT"||status==="CLOSED"){
    if(typeof handlers.onStatus==="function")handlers.onStatus("error",new Error("Не удалось подключиться к комнате."));
    if(!settled){settled=true;reject(new Error("Не удалось подключиться к комнате."))}
   }
  });
 });
}
export async function sendRoomEvent(type,payload={}) {
 if(!activeChannel||!activeCode)return false;
 const result=await activeChannel.send({type:"broadcast",event:"room-event",payload:{type,...payload,sentAt:Date.now()}});
 return result==="ok";
}
export async function disconnectRoom(){
 const channel=activeChannel;activeChannel=null;activeCode="";
 if(channel){try{await supabase.removeChannel(channel)}catch(error){console.warn("[AniWatch] Room disconnect failed:",error)}}
}
