import ru from "./ru.js";
import es from "./es-419.js";
import { translateLabels } from "./site-labels.js";

const key = "aw.ui.language";
const normalize = value => value === "es-419" || value === "es" ? "es-419" : "ru";
export function getLanguage() {
  try { return normalize(localStorage.getItem(key) || localStorage.getItem("aw.room.language")); }
  catch { return "ru"; }
}
export function setLanguage(value) {
  const language = normalize(value);
  try { localStorage.setItem(key, language); } catch {}
  if (typeof document !== "undefined") document.documentElement.lang = language;
  return language;
}
export function t(key, values = {}) {
  const dictionary = getLanguage() === "es-419" ? es : ru;
  return (dictionary[key] || ru[key] || key).replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
export function startLocalization() {
  const language = getLanguage();
  document.documentElement.lang = language;
  if (language !== "es-419") return;
  const apply = node => { if (node.isConnected) translateLabels(node); };
  apply(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type !== "childList") apply(record.target);
      else for (const node of record.addedNodes) apply(node);
    }
  }).observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ["title", "placeholder", "aria-label"]
  });
}
