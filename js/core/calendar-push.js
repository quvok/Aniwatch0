import {saveCalendarPushSubscription,removeCalendarPushSubscription} from "./supabase.js";

export const CALENDAR_VAPID_PUBLIC_KEY="BBjCp3UVKy507lmL8hUB7lVLhlj_A5cQUEeYIP2Bm2xX0p4qyrwqJwhwlIOGcRrwtkYPVcAQUNwYTjDVatblupA";

function decodeBase64Url(value){
 const padded=value+"=".repeat((4-value.length%4)%4);
 const raw=atob(padded.replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(raw,char=>char.charCodeAt(0));
}
function encodeBase64Url(value){
 return btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
export function isCalendarPushSupported(){
 return typeof window!=="undefined"&&"serviceWorker" in navigator&&"PushManager" in window&&"Notification" in window;
}
export async function getCalendarPushState(){
 const supported=isCalendarPushSupported();
 if(!supported)return {supported:false,enabled:false,permission:"unsupported"};
 try{
  const registration=await navigator.serviceWorker.ready;
  const subscription=await registration.pushManager.getSubscription();
  return {supported:true,enabled:!!subscription,permission:Notification.permission};
 }catch(error){return {supported:true,enabled:false,permission:Notification.permission,error}}
}
export async function enableCalendarPush(userId){
 if(!userId)throw new Error("Войди в аккаунт, чтобы включить push-уведомления.");
 if(!isCalendarPushSupported())throw new Error("Этот браузер не поддерживает push-уведомления.");
 if(Notification.permission!=="granted"){
  const permission=await Notification.requestPermission();
  if(permission!=="granted")throw new Error("Разрешение на уведомления не выдано.");
 }
 const registration=await navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodeBase64Url(CALENDAR_VAPID_PUBLIC_KEY)});
 const json=subscription.toJSON(),keys=json.keys||{};
 if(!json.endpoint||!keys.p256dh||!keys.auth)throw new Error("Браузер вернул неполную push-подписку.");
 await saveCalendarPushSubscription(userId,{endpoint:json.endpoint,p256dh:keys.p256dh,auth:keys.auth,expiration_time:json.expirationTime?new Date(json.expirationTime).toISOString():null});
 return subscription;
}
export async function disableCalendarPush(userId){
 const registration=await navigator.serviceWorker.ready;
 const subscription=await registration.pushManager.getSubscription();
 if(subscription){
  await removeCalendarPushSubscription(userId,subscription.endpoint);
  await subscription.unsubscribe();
 }
 return true;
}
