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
let cloudLibraryReadyUserId = null;
let syncTimer = null;
let syncChain = Promise.resolve();
let episodeProgressChannel = null;
let episodeProgressChannelUserId = null;
let episodeProgressWrites = new Map();

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
  // Existing accounts already have a profile (created during registration).
  // Do not add a network round-trip to every successful login.
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
  cloudLibraryReadyUserId = null;
  if (episodeProgressChannel) await client.removeChannel(episodeProgressChannel).catch(() => {});
  episodeProgressChannel = null;
  episodeProgressChannelUserId = null;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
}

function normalizeCloudWatchlist(raw) {
  const aliases = { watching: "watching", planned: "planned", planning: "planned", completed: "completed", complete: "completed", dropped: "dropped" };
  const result = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const id = Number(item.id ?? item.anime_id ?? item.animeId);
      const status = aliases[String(item.status ?? item.listStatus ?? "").toLowerCase()];
      if (Number.isSafeInteger(id) && id > 0 && status) result[id] = status;
    }
    return result;
  }
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      const id = Number(key);
      const status = aliases[String(typeof value === "string" ? value : (value?.status ?? value?.listStatus ?? "")).toLowerCase()];
      if (Number.isSafeInteger(id) && id > 0 && status) result[id] = status;
    }
  }
  return result;
}

function mergeCloudState(local, rows, username) {
  const state = { ...local };
  // A truly empty cloud library is the legacy migration case: seed it from
  // this device once. Once cloud rows exist, the database is authoritative
  // for library fields so stale local snapshots cannot resurrect removed items.
  if (!rows.length) {
    state.fav = [...new Set((local.fav || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
    state.hist = { ...(local.hist || {}) };
    state.rate = { ...(local.rate || {}) };
    state.watchlist = normalizeCloudWatchlist(local.watchlist);
    state.watchedEpisodes = { ...(local.watchedEpisodes || {}) };
  } else {
    state.fav = [];
    state.hist = {};
    state.rate = {};
    state.watchlist = {};
    state.watchedEpisodes = {};
    for (const row of rows) {
      const id = String(row.anime_id);
      if (row.is_favorite) state.fav.push(Number(row.anime_id));
      if (row.status) state.watchlist[id] = row.status;
      if (row.rating !== null && row.rating !== undefined) state.rate[id] = Number(row.rating);
      if (row.history && typeof row.history === "object") {
        if (Array.isArray(row.history.watchedEpisodes)) {
          state.watchedEpisodes[id] = [...new Set(row.history.watchedEpisodes.map(Number))]
            .filter(n => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
        }
        const history = { ...row.history };
        delete history.watchedEpisodes;
        if (Object.keys(history).length) state.hist[id] = history;
      }
    }
  }
  if ((!state.name || state.name === "Гость" || state.name === "Аноним") && username) state.name = username;
  return state;
}

export async function restoreCloudState(localState, userId) {
  const client = await getSupabaseClient();
  activeUserId = userId;

  // The library and profile are independent reads. Fetch them together instead
  // of serializing several round-trips (getUser -> profiles -> RPC).
  const [libraryResult, profileResult, progressResult] = await Promise.all([
    client.from("user_library")
      .select("anime_id,is_favorite,status,rating,history")
      .eq("user_id", userId),
    client.rpc("get_public_profile", { target_user: userId }),
    fetchEpisodeProgressRows(client, userId)
  ]);
  if (libraryResult.error) throw libraryResult.error;
  if (profileResult.error) throw profileResult.error;
  const savedProfile = profileResult.data;
  if (!savedProfile) throw new Error("Не удалось восстановить настройки профиля.");

  const progressRows = progressResult;
  const merged = mergeCloudState(localState, libraryResult.data || [], savedProfile.username || "");
  const watched = {};
  const addMark = (animeId, episode, value) => {
    const id = String(Number(animeId));
    const number = Number(episode);
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0 || !Number.isInteger(number) || number <= 0) return;
    watched[id] = watched[id] || [];
    watched[id] = watched[id].filter(item => item !== number);
    if (value) watched[id].push(number);
    if (!watched[id].length) delete watched[id];
  };
  const localProgressBelongsToUser = !localState?.episodeProgressOwner || localState.episodeProgressOwner === userId;
  if (progressRows.length) {
    progressRows.forEach(row => addMark(row.anime_id, row.episode, row.is_watched));
    merged.watchedEpisodes = watched;
  } else {
    // First-time migration fallback: retain local and legacy marks only while the
    // dedicated table has no rows, and never carry a prior account's local marks into another account.
    if (libraryResult.data?.length || localProgressBelongsToUser) {
      Object.entries(merged.watchedEpisodes || {}).forEach(([id, episodes]) =>
        (Array.isArray(episodes) ? episodes : []).forEach(ep => addMark(id, ep, true))
      );
    }
    if (localProgressBelongsToUser) {
      Object.entries(localState?.watchedEpisodes || {}).forEach(([id, episodes]) =>
        (Array.isArray(episodes) ? episodes : []).forEach(ep => addMark(id, ep, true))
      );
    }
    merged.watchedEpisodes = watched;
  }

  const allPending = merged.episodeProgressPending && typeof merged.episodeProgressPending === "object"
    ? merged.episodeProgressPending : {};
  const pendingEntries = [];
  Object.entries(allPending).forEach(([key, isWatched]) => {
    const match = /^(?:(guest|[0-9a-f-]+)\|)?(\d+):(\d+)$/i.exec(key);
    if (!match) return;
    const owner = match[1] || "guest";
    if (owner !== "guest" && owner !== userId) return;
    const animeId = Number(match[2]), episode = Number(match[3]);
    if (!Number.isSafeInteger(animeId) || animeId <= 0 || !Number.isInteger(episode) || episode <= 0) return;
    addMark(animeId, episode, !!isWatched);
    pendingEntries.push({
      key,
      row: { user_id: userId, anime_id: animeId, episode, is_watched: !!isWatched }
    });
  });
  const pendingRows = pendingEntries.map(entry => entry.row);
  const seedRows = !progressRows.length
    ? Object.entries(watched).flatMap(([animeId, episodes]) => episodes.map(episode => ({
        user_id: userId, anime_id: Number(animeId), episode, is_watched: true
      })))
    : [];
  const initialRows = new Map();
  seedRows.forEach(row => initialRows.set(row.anime_id + ":" + row.episode, row));
  pendingRows.forEach(row => initialRows.set(row.anime_id + ":" + row.episode, row));
  if (initialRows.size) {
    const { error: initialError } = await client.from("user_episode_progress")
      .upsert([...initialRows.values()], { onConflict: "user_id,anime_id,episode" });
    if (initialError) console.warn("[AniWatch] Legacy or pending episode progress migration will retry:", initialError);
    else if (pendingRows.length) {
      pendingEntries.forEach(entry => delete merged.episodeProgressPending[entry.key]);
      if (!Object.keys(merged.episodeProgressPending || {}).length) delete merged.episodeProgressPending;
    }
  }
  if (savedProfile.avatar_url) merged.avatar = savedProfile.avatar_url;
  merged.bio = savedProfile.bio || "";
  merged.banner = savedProfile.banner_url || "";
  merged.profileVisibility = savedProfile.profile_visibility || "friends";
  merged.showStats = savedProfile.show_stats !== false;
  merged.showFavorites = savedProfile.show_favorites !== false;
  merged.episodeProgressOwner = userId;
  cloudLibraryReadyUserId = userId;
  ensureEpisodeProgressRealtime(client, userId);

  // The snapshot is ready for the UI now. Reconciliation/migration writes must
  // not keep the user waiting after a successful sign-in.
  syncCloudState(merged, userId).catch(error =>
    console.warn("[AniWatch] Background cloud reconciliation failed:", error)
  );
  return merged;
}

async function fetchEpisodeProgressRows(client, userId) {
  const rows = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from("user_episode_progress")
      .select("anime_id,episode,is_watched,updated_at")
      .eq("user_id", userId)
      .order("anime_id", { ascending: true })
      .order("episode", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

function ensureEpisodeProgressRealtime(client, userId) {
  if (episodeProgressChannel && episodeProgressChannelUserId === userId) return;
  if (episodeProgressChannel) client.removeChannel(episodeProgressChannel).catch(() => {});
  episodeProgressChannelUserId = userId;
  episodeProgressChannel = client
    .channel("episode-progress-" + userId)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "user_episode_progress",
      filter: "user_id=eq." + userId
    }, payload => {
      if (activeUserId !== userId || !payload?.new) return;
      window.dispatchEvent(new CustomEvent("aw-episode-progress-changed", {
        detail: { userId, row: payload.new }
      }));
    })
    .subscribe(status => {
      if (status !== "SUBSCRIBED") return;
      fetchEpisodeProgressRows(client, userId).then(rows => {
        if (activeUserId !== userId) return;
        window.dispatchEvent(new CustomEvent("aw-episode-progress-changed", {
          detail: { userId, rows }
        }));
      }).catch(error => console.warn("[AniWatch] Episode progress reconnect refresh failed:", error));
    });
}

export async function saveEpisodeProgress(animeId, episode, isWatched, userId = activeUserId) {
  const anime = Number(animeId), number = Number(episode);
  if (!userId || !Number.isSafeInteger(anime) || anime <= 0 || !Number.isInteger(number) || number <= 0) return false;
  if (activeUserId !== userId || cloudLibraryReadyUserId !== userId) return false;
  const client = await getSupabaseClient();
  const key = userId + ":" + anime + ":" + number;
  const previous = episodeProgressWrites.get(key) || Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    if (activeUserId !== userId || cloudLibraryReadyUserId !== userId) return false;
    const { error } = await client.from("user_episode_progress").upsert({
      user_id: userId,
      anime_id: anime,
      episode: number,
      is_watched: !!isWatched
    }, { onConflict: "user_id,anime_id,episode" });
    if (error) throw error;
    return true;
  });
  episodeProgressWrites.set(key, write);
  try {
    return await write;
  } finally {
    if (episodeProgressWrites.get(key) === write) episodeProgressWrites.delete(key);
  }
}

export async function syncCloudState(state, userId = activeUserId) {
  if (!userId) return;
  const client = await getSupabaseClient();
  const watchlist = normalizeCloudWatchlist(state.watchlist);
  const favorites = new Set((state.fav || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0));
  const ids = new Set([
    ...favorites,
    ...Object.keys(state.hist || {}).map(Number),
    ...Object.keys(state.rate || {}).map(Number),
    ...Object.keys(watchlist).map(Number),
    ...Object.keys(state.watchedEpisodes || {}).map(Number)
  ].filter(id => Number.isSafeInteger(id) && id > 0));

  const rows = [...ids].map(id => ({
    user_id: userId,
    anime_id: id,
    is_favorite: favorites.has(id),
    status: watchlist[id] || null,
    rating: (state.rate || {})[id] == null ? null : Number((state.rate || {})[id]),
    history: (() => {
      const value = { ...((state.hist || {})[id] || {}) };
      delete value.watchedEpisodes;
      return value;
    })(),
    updated_at: new Date().toISOString()
  })).filter(row => row.is_favorite || row.status || row.rating !== null || Object.keys(row.history).length);

  syncChain = syncChain.catch(() => {}).then(async () => {
    if (activeUserId !== userId || cloudLibraryReadyUserId !== userId) return;
    // Reconcile deletions only after a complete cloud snapshot has been read.
    // This prevents an early local snapshot during app startup from overwriting or wiping cloud data.
    const { data: existingRows, error: readError } = await client.from("user_library")
      .select("anime_id").eq("user_id", userId);
    if (readError) throw readError;
    const staleIds = (existingRows || []).map(row => Number(row.anime_id)).filter(id => !ids.has(id));
    for (let offset = 0; offset < staleIds.length; offset += 100) {
      const { error: deleteError } = await client.from("user_library").delete()
        .eq("user_id", userId).in("anime_id", staleIds.slice(offset, offset + 100));
      if (deleteError) throw deleteError;
    }
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


export async function saveProfileDetails({ bio }, userId = activeUserId) {
  if (!userId) throw new Error("Сначала войди в аккаунт.");
  const cleanBio = String(bio || "").trim();
  if (cleanBio.length > 280) throw new Error("Описание не должно превышать 280 символов.");
  const client = await getSupabaseClient();
  const { error } = await client.from("profiles")
    .update({ bio: cleanBio })
    .eq("id", userId);
  if (error) throw error;
  return { bio: cleanBio };
}

export async function saveProfilePrivacy({ profile_visibility, show_stats, show_favorites }, userId = activeUserId) {
  if (!userId) throw new Error("Сначала войди в аккаунт.");
  if (!["public","friends","private"].includes(profile_visibility)) throw new Error("Некорректная настройка видимости.");
  const client = await getSupabaseClient();
  const { error } = await client.from("profiles")
    .update({ profile_visibility, show_stats: !!show_stats, show_favorites: !!show_favorites })
    .eq("id", userId);
  if (error) throw error;
  const { data, error: readError } = await client.rpc("get_public_profile", { target_user: userId });
  if (readError) throw readError;
  if (!data) throw new Error("Не удалось проверить сохранённые настройки приватности.");
  return { profile_visibility: data.profile_visibility, show_stats: data.show_stats, show_favorites: data.show_favorites };
}

export async function fetchPublicProfile(userId) {
  if (!userId) throw new Error("Не указан профиль.");
  const client = await getSupabaseClient();
  const { data, error } = await client.rpc("get_public_profile", { target_user: userId });
  if (error) throw error;
  return data || null;
}

export async function uploadProfileBanner(file, userId) {
  const client = await getSupabaseClient();
  if (!userId) throw new Error("Сначала войди в аккаунт.");
  if (!file || !["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Выбери JPG, PNG или WebP.");
  if (file.size > 1024 * 1024) throw new Error("Размер обложки не должен превышать 1 МБ.");
  const extension = ({ "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" })[file.type];
  const path = userId + "/banner." + extension;
  const { error: uploadError } = await client.storage.from("avatars").upload(path,file,{upsert:true,contentType:file.type,cacheControl:"3600"});
  if (uploadError) throw uploadError;
  const { data } = client.storage.from("avatars").getPublicUrl(path);
  const bannerUrl = data.publicUrl + "?v=" + Date.now();
  const { error: profileError } = await client.from("profiles").update({banner_url:bannerUrl}).eq("id",userId);
  if (profileError) throw profileError;
  const { data: saved, error: verifyError } = await client.rpc("get_public_profile", { target_user: userId });
  if (verifyError) throw verifyError;
  if (!saved || saved.banner_url !== bannerUrl) throw new Error("Обложка загружена, но профиль не обновился.");
  return bannerUrl;
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
