import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://oikuyhdgcobuuesbuygl.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ker59ui359qC1e9dsGsmsg_VW6azZfK";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

let activeUserId = null;
let syncTimer = null;
let syncChain = Promise.resolve();

export async function initializeSupabaseAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  activeUserId = data.session?.user?.id || null;
  return { user: data.session?.user || null };
}

async function ensureProfile(user, username = "Аноним") {
  if (!user?.id) return;
  const { data, error } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      username: String(username || "Аноним").slice(0, 20)
    });
    if (insertError) throw insertError;
  }
}

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  activeUserId = data.user?.id || null;
  if (data.user) await ensureProfile(data.user);
  return data;
}

export async function signUpWithEmail(email, password, username) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username: String(username || "Аноним").slice(0, 20) } }
  });
  if (error) throw error;
  if (data.session && data.user) {
    activeUserId = data.user.id;
    await ensureProfile(data.user, username);
  }
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  activeUserId = null;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
}

function mergeCloudState(local, rows, username) {
  const state = { ...local };
  state.fav = [...new Set([...(local.fav || []).map(Number), ...rows.filter(r => r.is_favorite).map(r => Number(r.anime_id))])];
  state.hist = { ...(local.hist || {}) };
  state.rate = { ...(local.rate || {}) };
  state.watchlist = { ...(local.watchlist || {}) };
  for (const row of rows) {
    const id = String(row.anime_id);
    if (row.history && typeof row.history === "object" && Object.keys(row.history).length) {
      const old = state.hist[id];
      if (!old || Number(row.history.at || 0) > Number(old.at || 0)) state.hist[id] = row.history;
    }
    if (row.rating !== null && row.rating !== undefined && !(Number(id) in (local.rate || {}))) {
      state.rate[id] = Number(row.rating);
    }
    if (row.status && !(id in (local.watchlist || {}))) state.watchlist[id] = row.status;
  }
  if ((!state.name || state.name === "Гость" || state.name === "Аноним") && username) state.name = username;
  state.fav = state.fav.filter(Number.isFinite);
  return state;
}

export async function restoreCloudState(localState, userId) {
  activeUserId = userId;
  const { data: rows, error } = await supabase
    .from("user_library")
    .select("anime_id,is_favorite,status,rating,history")
    .eq("user_id", userId);
  if (error) throw error;

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("id,username").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    const { data: authData } = await supabase.auth.getUser();
    await ensureProfile(authData.user, localState.name || "Аноним");
  }

  const merged = mergeCloudState(localState, rows || [], profile?.username || "");
  await syncCloudState(merged, userId);
  return merged;
}

export async function syncCloudState(state, userId = activeUserId) {
  if (!userId) return;
  const ids = new Set([
    ...(state.fav || []).map(Number),
    ...Object.keys(state.hist || {}).map(Number),
    ...Object.keys(state.rate || {}).map(Number),
    ...Object.keys(state.watchlist || {}).map(Number)
  ].filter(id => Number.isFinite(id) && id > 0));

  const rows = [...ids].map(id => ({
    user_id: userId,
    anime_id: id,
    is_favorite: (state.fav || []).map(Number).includes(id),
    status: (state.watchlist || {})[id] || null,
    rating: (state.rate || {})[id] == null ? null : Number((state.rate || {})[id]),
    history: (state.hist || {})[id] || {},
    updated_at: new Date().toISOString()
  })).filter(row => row.is_favorite || row.status || row.rating !== null || Object.keys(row.history).length);

  syncChain = syncChain.catch(() => {}).then(async () => {
    if (activeUserId !== userId) return;
    const { data: existing, error: readError } = await supabase
      .from("user_library").select("anime_id").eq("user_id", userId);
    if (readError) throw readError;
    // Never delete cloud rows just because this browser has an incomplete local snapshot.\n    if (rows.length) {
      const { error: upsertError } = await supabase.from("user_library")
        .upsert(rows, { onConflict: "user_id,anime_id" });
      if (upsertError) throw upsertError;
    }
    if (state.name && state.name !== "Гость") {
      const { error: profileUpdateError } = await supabase.from("profiles")
        .update({ username: String(state.name).slice(0, 20) }).eq("id", userId);
      if (profileUpdateError) throw profileUpdateError;
    }
  });
  return syncChain;
}

export function scheduleCloudSync(state) {
  if (!activeUserId) return;
  const userId = activeUserId;
  const snapshot = JSON.parse(JSON.stringify(state || {}));
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncCloudState(snapshot, userId).catch(error => {
      console.error("[AniWatch] Cloud sync failed:", error);
      window.dispatchEvent(new CustomEvent("aw-cloud-sync-error", { detail: error }));
    });
  }, 500);
}
