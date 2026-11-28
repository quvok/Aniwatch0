import { getLanguage, t } from "../i18n/index.js";

export const readPreference = key => {
  try { return localStorage.getItem(key); } catch { return null; }
};
export const writePreference = (key, value) => {
  try { localStorage.setItem(key, value); } catch {}
};

function selectSetting(key, options, value, onChange) {
  const label = document.createElement("label");
  label.textContent = t(key);
  const select = document.createElement("select");
  for (const [id, name] of options) select.add(new Option(name, id));
  select.value = value;
  select.onchange = () => onChange(select.value);
  label.append(select);
  return label;
}

export function languageSetting(changeLanguage) {
  return selectSetting("language", [["ru", "Русский"], ["es-419", "Español latino"]], getLanguage(), changeLanguage);
}

export function mountRoomSettings(root, { onLanguage, onOffset, onAlign, warmTranslator, onTranslationDisabled, host }) {
  const panel = document.createElement("div");
  panel.className = "room-playback-settings";
  const languages = languageSetting(onLanguage);
  const audio = selectSetting("preferredAudio", [["ru", "Русский"], ["es-419", "Español latino"]],
    readPreference("aw.player.audio") || "ru", value => {
      writePreference("aw.player.audio", value);
      const preferred = value === "es-419" ? '[data-provider="youtube"], [data-provider="animeav1"]' : '[data-provider="kodik"]';
      root.querySelector(preferred)?.click();
    });
  const auto = document.createElement("label");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = "room-auto-translate";
  checkbox.checked = readPreference("aw.room.translate") === "1";
  checkbox.onchange = () => {
    writePreference("aw.room.translate", checkbox.checked ? "1" : "0");
    if (checkbox.checked) warmTranslator();
    else onTranslationDisabled();
  };
  auto.append(checkbox, " " + t("translateChat"));
  const info = document.createElement("p");
  info.className = "room-playback-status";
  const offsets = document.createElement("div");
  offsets.className = "room-offset-controls";
  offsets.hidden = host;
  const offsetLabel = document.createElement("span");
  offsets.append(offsetLabel);
  for (const delta of [-5, -1, 1, 5]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = delta > 0 ? "+" + delta : "−" + Math.abs(delta);
    button.onclick = () => onOffset(delta);
    offsets.append(button);
  }
  const align = document.createElement("button");
  align.type = "button";
  align.textContent = t("align");
  align.onclick = onAlign;
  offsets.append(align);
  const note = document.createElement("small");
  note.textContent = t("independentAudio");
  const fallback = document.createElement("div");
  fallback.className = "room-offset-controls";
  fallback.hidden = true;
  const guide = document.createElement("span");
  const switchToKodik = document.createElement("button");
  switchToKodik.type = "button";
  switchToKodik.textContent = t("roomSwitchKodik");
  switchToKodik.onclick = () => root.querySelector('[data-provider="kodik"]')?.click();
  fallback.append(guide, switchToKodik);
  panel.append(languages, audio, auto, note, offsets, info, fallback);
  root.parentElement.after(panel);
  return ({ source, local, state, offset, target, drift }) => {
    const messages = [];
    if (source?.compatibility === "ready") messages.push(t("syncReady"));
    else if (source?.compatibility === "unsupported") messages.push(t("syncUnsupported"));
    else messages.push(t("syncTesting"));
    if (local) messages.push(t(local.buffering ? "buffering" : local.playing ? "localPlaying" : "localPaused"));
    if (state) messages.push(t(state.buffering ? "hostBuffering" : state.playing ? "hostPlaying" : "hostPaused"));
    if (Number.isFinite(drift)) messages.push(t("drift") + " " + drift.toFixed(2) + " s");
    if (local?.duration && state?.duration && Math.abs(local.duration - state.duration) >= 10) {
      messages.push(t("durationMismatch", { seconds: Math.round(Math.abs(local.duration - state.duration)) }));
    }
    info.textContent = messages.join(" · ");
    const unsupported = ["animeav1", "youtube"].includes(source?.provider) && source.compatibility === "unsupported";
    fallback.hidden = !unsupported;
    offsets.hidden = host || source?.compatibility !== "ready";
    if (unsupported) {
      if (Number.isFinite(target)) {
        const seconds = Math.floor(target);
        const time = Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
        guide.textContent = t("roomManualPosition", { time });
      } else {
        guide.textContent = t(host ? "roomUnsupportedHost" : "roomWaitForPosition");
      }
    }
    offsetLabel.textContent = t("offset") + " " + offset.toFixed(1);
    align.disabled = !local || !state;
    offsets.querySelectorAll("button").forEach(button => { if (button !== align) button.disabled = !local; });
  };
}
