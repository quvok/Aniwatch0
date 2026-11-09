const SUPABASE_URL = "https://oikuyhdgcobuuesbuygl.supabase.co";
const SUPABASE_KEY = "sb_publishable_Ker59ui359qC1e9dsGsmsg_VW6azZfK";
let supabaseClient = null;
let supabaseClientPromise = null;

// Load the SDK only when auth, cloud sync, or watch rooms are actually used.
// A remote SDK import must not delay the first render of the site.
export function getSupabaseClient() {
  if (supabaseClient) return Promise.resolve(supabaseClient);
  if (!supabaseClientPromise) {
    supabaseClientPromise = import("https://esm.sh/@supabase/supabase-js@2")
      .then(({ createClient }) => {
        supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
        return supabaseClient;
      })
      .catch(error => {
        supabaseClientPromise = null;
        throw error;
      });
  }
  return supabaseClientPromise;
}

let activeUserId = null;
let syncTimer = null;
let syncChain = Promise.resolve();

export async function initializeSupabaseAuth() {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  activeUserId = data.session?.user?.id || null;
  return { user: data.session?.user || null };
}

async function ensureProfile(user, username, client) {
  if (!user?.id) return;
  client = client || await getSupabaseClient();
  const desiredName = String(username || user.user_metadata?.username || "Аноним").trim().slice(0, 20) || "Аноним";
  const { data, error } = await client.from("profiles").select("id,username").eq("id", user.id).maybeSingle();
  if (error) throw error;
  if (!data) {
    const { error: insertError } = await client.from("profiles").insert({ id: user.id, username: desiredName });
    if (insertError) throw insertError;
  } else if ((!data.username || ["аноним", "гость"].includes(String(data.username).toLowerCase())) && desiredName !== "Аноним") {
    const { error: updateError } = await client.from("profiles").update({ username: desiredName }).eq("id", user.id);
    if (updateError) throw updateError;
  }
}

export async function signInWithEmail(login, password) {
  const client = await getSupabaseClient();
  let data;
  if (String(login).includes("@")) {
    const result = await client.auth.signInWithPassword({ email: String(login).trim(), password });
    if (result.error) throw result.error;
    data = result.data;
  } else {
    const { data: result, error } = await client.functions.invoke("login-with-username", {
      body: { username: String(login).trim(), password }
    });
    if (error) {
      // Supabase wraps non-2xx responses in FunctionsHttpError.
      // Convert expected authentication failures into the same message as email sign-in.
      const status = error.context?.status;
      if (status === 401 || status === 400) throw new Error("Неверный логин или пароль.");
      if (status === 429) throw new Error("Слишком много попыток. Попробуй позже.");
      let serverMessage = "";
      try {
        const payload = await error.context?.clone?.().json();
        serverMessage = payload?.error || payload?.message || "";
      } catch (_) {}
      throw new Error(serverMessage || "Не удалось выполнить вход. Попробуй ещё раз.");
    }
    if (result?.error) throw new Error(result.error);
    if (!result?.access_token || !result?.refresh_token) throw new Error("Не удалось получить сессию.");
    const sessionResult = await client.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
    if (sessionResult.error) throw sessionResult.error;
    data = sessionResult.data;
  }
  activeUserId = data.user?.id || data.session?.user?.id || null;
  if (data.user || data.session?.user) await ensureProfile(data.user || data.session.user, undefined, client);
  return { ...data, user: data.user || data.session?.user || null, session: data.session || null };
}

export async function signUpWithEmail(email, password, username) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { data: { username: String(username || "Аноним").slice(0, 20) } }
  });
  if (error) throw error;
  if (data.session && data.user) {
    activeUserId = data.user.id;
    await ensureProfile(data.user, username, client);
  }
  return data;
}

export async function signOut() {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut();
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
  state.watchedEpisodes = { ...(local.watchedEpisodes || {}) };
  for (const row of rows) {
    const id = String(row.anime_id);
    if (row.history && typeof row.history === "object" && Object.keys(row.history).length) {
      if (Array.isArray(row.history.watchedEpisodes)) {
        const mergedEpisodes = new Set([...(state.watchedEpisodes[id] || []).map(Number), ...row.history.watchedEpisodes.map(Number)]);
        state.watchedEpisodes[id] = [...mergedEpisodes].filter(n => Number.isInteger(n) && n > 0).sort((a,b) => a-b);
      }
      const history = { ...row.history };
      delete history.watchedEpisodes;
      if (Object.keys(history).length) {
        const old = state.hist[id];
        if (!old || Number(history.at || 0) > Number(old.at || 0)) state.hist[id] = history;
      }
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
  const client = await getSupabaseClient();
  activeUserId = userId;
  const { data: rows, error } = await client
    .from("user_library")
    .select("anime_id,is_favorite,status,rating,history")
    .eq("user_id", userId);
  if (error) throw error;

  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const { data: profile, error: profileError } = await client
    .from("profiles").select("id,username,avatar_url").eq("id", userId).maybeSingle();
  if (profileError) throw profileError;

  const metadataName = authData.user?.user_metadata?.username;
  await ensureProfile(authData.user, metadataName || profile?.username || localState.name || "Аноним", client);

  const { data: savedProfile, error: savedProfileError } = await client
    .from("profiles").select("username,avatar_url").eq("id", userId).maybeSingle();
  if (savedProfileError) throw savedProfileError;

  const merged = mergeCloudState(localState, rows || [], savedProfile?.username || metadataName || "");
  if (savedProfile?.avatar_url) merged.avatar = savedProfile.avatar_url;
  await syncCloudState(merged, userId);
  return merged;
}

export async function syncCloudState(state, userId = activeUserId) {
  if (!userId) return;
  const client = await getSupabaseClient();
  const ids = new Set([
    ...(state.fav || []).map(Number),
    ...Object.keys(state.hist || {}).map(Number),
    ...Object.keys(state.rate || {}).map(Number),
    ...Object.keys(state.watchlist || {}).map(Number),
    ...Object.keys(state.watchedEpisodes || {}).map(Number)
  ].filter(id => Number.isFinite(id) && id > 0));

  const rows = [...ids].map(id => ({
    user_id: userId,
    anime_id: id,
    is_favorite: (state.fav || []).map(Number).includes(id),
    status: (state.watchlist || {})[id] || null,
    rating: (state.rate || {})[id] == null ? null : Number((state.rate || {})[id]),
    history: { ...((state.hist || {})[id] || {}), ...((state.watchedEpisodes || {})[id] ? { watchedEpisodes: (state.watchedEpisodes || {})[id] } : {}) },
    updated_at: new Date().toISOString()
  })).filter(row => row.is_favorite || row.status || row.rating !== null || Object.keys(row.history).length);

  syncChain = syncChain.catch(() => {}).then(async () => {
    if (activeUserId !== userId) return;
    // Keep existing cloud rows when the local snapshot is incomplete.
    if (rows.length) {
      const { error: upsertError } = await client.from("user_library")
        .upsert(rows, { onConflict: "user_id,anime_id" });
      if (upsertError) throw upsertError;
    }
    if (state.name && state.name !== "Гость") {
      const { error: profileUpdateError } = await client.from("profiles")
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


export async function loadRecommendationFeedback(userId) {
  if (!userId) return {};
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from("anime_recommendation_feedback")
    .select("anime_id,action")
    .eq("user_id", userId);
  if (error) throw error;
  return Object.fromEntries((data || []).map(row => [String(row.anime_id), row.action]));
}

export async function saveRecommendationFeedback(userId, animeId) {
  const id = Number(animeId);
  if (!userId || !Number.isInteger(id) || id <= 0) return;
  const client = await getSupabaseClient();
  const { error } = await client
    .from("anime_recommendation_feedback")
    .upsert({ user_id: userId, anime_id: id, action: "not_interested" }, { onConflict: "user_id,anime_id" });
  if (error) throw error;
}

export async function uploadProfileAvatar(file, userId) {
  const client = await getSupabaseClient();
  if (!userId) throw new Error("Сначала войди в аккаунт.");
  if (!file || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Выбери JPG, PNG или WebP.");
  if (file.size > 1024 * 1024) throw new Error("Размер изображения не должен превышать 1 МБ.");
  const extension = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" })[file.type];
  const path = userId + "/avatar." + extension;
  const { error: uploadError } = await client.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
  if (uploadError) throw uploadError;
  const { data } = client.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = data.publicUrl + "?v=" + Date.now();
  const { error: profileError } = await client.from("profiles").update({avatar_url:avatarUrl}).eq("id",userId);
  if (profileError) throw profileError;
  return avatarUrl;
}
