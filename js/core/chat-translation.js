import { getSupabaseClient } from "./supabase.js";

const cache = new Map();
const pending = new Map();
const translators = new Map();
const emoji = /(?:\p{Regional_Indicator}{2}|[#*\d]\uFE0F?\u20E3|\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?(?:\u200D\p{Extended_Pictographic}\uFE0F?\p{Emoji_Modifier}?)*(?:[\u{E0020}-\u{E007E}]+\u{E007F})?)/gu;
let detector;
let lastRemote = 0;

function nativeTranslator(source, target, allowDownload = false) {
  const pair = source + ":" + target;
  if (translators.has(pair)) return translators.get(pair);
  if (!globalThis.Translator) return Promise.resolve(null);
  const options = { sourceLanguage: source, targetLanguage: target };
  const task = (async () => {
    const available = await globalThis.Translator.availability(options);
    if (available === "available" || (allowDownload && ["downloadable", "downloading"].includes(available))) {
      return globalThis.Translator.create(options);
    }
    return null;
  })().catch(() => null);
  translators.set(pair, task);
  task.then(value => { if (!value && translators.get(pair) === task) translators.delete(pair); });
  return task;
}

async function detectLanguage(text) {
  if (!/\p{L}/u.test(text)) return null;
  if (globalThis.LanguageDetector) {
    try {
      if (!detector && await globalThis.LanguageDetector.availability() === "available") {
        detector = globalThis.LanguageDetector.create({ expectedInputLanguages: ["ru", "es"] });
      }
      if (detector) {
        const [match] = await (await detector).detect(text);
        const language = match?.detectedLanguage?.split("-")[0];
        if (match?.confidence >= 0.75 && ["ru", "es"].includes(language)) return language;
      }
    } catch { detector = null; }
  }
  if (/[а-яё]/iu.test(text)) return "ru";
  if (/\p{Script=Latin}/u.test(text)) return "es";
  return null;
}

export function warmTranslator(language) {
  const target = language === "es-419" ? "es" : "ru";
  return nativeTranslator(target === "es" ? "ru" : "es", target, true);
}

async function remoteTranslation(text, source, target) {
  const now = Date.now();
  if (now-lastRemote<1000) return null;
  lastRemote=now;
  const client = await getSupabaseClient();
  const { data: auth } = await client.auth.getSession();
  if (!auth?.session) return null;
  const { data, error } = await client.functions.invoke("translate-room-chat", {
    body: { text, source, target },
    signal: AbortSignal.timeout(6500)
  });
  return !error && typeof data?.translation === "string" ? data.translation : null;
}

async function translate(text, target) {
  const source = await detectLanguage(text);
  if (!source || source === target) return "";
  const emojis = [];
  const prefix = "AW" + Math.random().toString(36).slice(2, 9).toUpperCase() + "EM";
  const protectedText = text.replace(emoji, symbol => {
    const index = emojis.push(symbol)-1;
    return prefix+index+"X";
  });
  const translator = await nativeTranslator(source,target);
  let value;
  if (translator) {
    try { value = await translator.translate(protectedText, { signal: AbortSignal.timeout(5500) }); } catch {}
  }
  if (!value) value = await remoteTranslation(protectedText,source,target);
  if (!value) return null;
  for (const [index,symbol] of emojis.entries()) {
    const token = new RegExp(prefix+index+"X","gi");
    if ([...value.matchAll(token)].length!==1) return null;
    value=value.replace(token,()=>symbol);
  }
  return value;
}

export function translateRoomMessage(text, language) {
  const target = language === "es-419" ? "es" : "ru";
  const key = target+"\n"+text;
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);
  if (pending.size>=4) return Promise.resolve(null);
  const task = translate(text,target).then(value=>{
    if (value!==null) {
      if (cache.size>=200) cache.delete(cache.keys().next().value);
      cache.set(key,value);
    }
    return value;
  }).catch(()=>null).finally(()=>pending.delete(key));
  pending.set(key,task);
  return task;
}
