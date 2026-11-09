import { getSupabaseClient } from "./supabase.js";

function messageFor(error) {
  if (error?.code === "23505") return "Заявка или приглашение уже существует.";
  if (error?.code === "42501" || error?.code === "PGRST301") return "Недостаточно прав. Обнови страницу и войди в аккаунт.";
  return error?.message || "Не удалось выполнить запрос.";
}

async function checked(query) {
  const { data, error } = await query;
  if (error) throw new Error(messageFor(error));
  return data;
}

export async function searchProfiles(query, userId) {
  const q = String(query || "").trim().replace(/[%,()]/g, " ").replace(/\s+/g, " ").slice(0, 32);
  if (!userId) throw new Error("Войди в аккаунт, чтобы искать друзей.");
  if (q.length < 2) throw new Error("Введи минимум 2 символа ника.");
  const client = await getSupabaseClient();
  return (await checked(client.from("profiles")
    .select("id,username,avatar_url")
    .ilike("username", "%" + q + "%")
    .neq("id", userId)
    .order("username", { ascending: true })
    .limit(12))) || [];
}

export async function loadSocialHub(userId) {
  if (!userId) throw new Error("Войди в аккаунт, чтобы открыть друзей.");
  const client = await getSupabaseClient();
  const [friendRows, inviteRows] = await Promise.all([
    checked(client.from("friend_requests")
      .select("id,sender_id,recipient_id,status,created_at")
      .or("sender_id.eq." + userId + ",recipient_id.eq." + userId)
      .order("created_at", { ascending: false }).limit(100)),
    checked(client.from("watch_party_invites")
      .select("id,inviter_id,invitee_id,room_code,anime_id,episode,status,created_at,expires_at")
      .or("inviter_id.eq." + userId + ",invitee_id.eq." + userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }).limit(50))
  ]);
  const ids = [...new Set([
    ...(friendRows || []).flatMap(row => [row.sender_id, row.recipient_id]),
    ...(inviteRows || []).flatMap(row => [row.inviter_id, row.invitee_id])
  ])].filter(id => id && id !== userId);
  const profiles = ids.length
    ? await checked(client.from("profiles").select("id,username,avatar_url").in("id", ids))
    : [];
  const profileMap = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]));
  const person = id => ({ id, username: profileMap[id]?.username || "Пользователь AniWatch", avatar_url: profileMap[id]?.avatar_url || "" });
  const rows = friendRows || [];
  const invites = inviteRows || [];
  const friends = rows.filter(row => row.status === "accepted").map(row => ({
    request_id: row.id,
    ...person(row.sender_id === userId ? row.recipient_id : row.sender_id)
  }));
  const incomingRequests = rows.filter(row => row.status === "pending" && row.recipient_id === userId).map(row => ({ ...row, person: person(row.sender_id) }));
  const outgoingRequests = rows.filter(row => row.status === "pending" && row.sender_id === userId).map(row => ({ ...row, person: person(row.recipient_id) }));
  const now = Date.now();
  const incomingInvites = invites.filter(row => row.invitee_id === userId && Date.parse(row.expires_at) > now).map(row => ({ ...row, person: person(row.inviter_id) }));
  const outgoingInvites = invites.filter(row => row.inviter_id === userId && Date.parse(row.expires_at) > now).map(row => ({ ...row, person: person(row.invitee_id) }));
  return { friends, incomingRequests, outgoingRequests, incomingInvites, outgoingInvites };
}

export async function sendFriendRequest(userId, recipientId) {
  if (!userId || !recipientId || userId === recipientId) throw new Error("Нельзя добавить этот аккаунт.");
  const client = await getSupabaseClient();
  const existing = await checked(client.from("friend_requests")
    .select("id,sender_id,recipient_id,status")
    .or("and(sender_id.eq." + userId + ",recipient_id.eq." + recipientId + "),and(sender_id.eq." + recipientId + ",recipient_id.eq." + userId + ")")
    .limit(1));
  const row = existing?.[0];
  if (row?.status === "accepted") throw new Error("Вы уже друзья.");
  if (row?.status === "pending" && row.sender_id === userId) throw new Error("Заявка уже отправлена.");
  if (row?.status === "pending" && row.recipient_id === userId) {
    await checked(client.from("friend_requests").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", row.id).select("id").single());
    return "accepted";
  }
  if (row?.status === "declined") await checked(client.from("friend_requests").delete().eq("id", row.id));
  await checked(client.from("friend_requests").insert({ sender_id: userId, recipient_id: recipientId, status: "pending" }).select("id").single());
  return "sent";
}

export async function respondFriendRequest(requestId, userId, accept) {
  const client = await getSupabaseClient();
  return checked(client.from("friend_requests")
    .update({ status: accept ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", requestId).eq("recipient_id", userId).eq("status", "pending")
    .select("id").single());
}

export async function removeFriend(requestId) {
  const client = await getSupabaseClient();
  return checked(client.from("friend_requests").delete().eq("id", requestId));
}

export async function sendWatchInvite(userId, friendId, roomCode, animeId, episode) {
  if (!userId || !friendId || !roomCode || !Number(animeId)) throw new Error("Сначала создай комнату и выбери друга.");
  const client = await getSupabaseClient();
  return checked(client.from("watch_party_invites").insert({
    inviter_id: userId,
    invitee_id: friendId,
    room_code: String(roomCode).toUpperCase(),
    anime_id: Number(animeId),
    episode: Math.max(1, Number(episode) || 1),
    status: "pending"
  }).select("id").single());
}

export async function respondWatchInvite(inviteId, userId, accept) {
  const client = await getSupabaseClient();
  return checked(client.from("watch_party_invites")
    .update({ status: accept ? "accepted" : "declined", updated_at: new Date().toISOString() })
    .eq("id", inviteId).eq("invitee_id", userId).eq("status", "pending")
    .select("id,room_code,anime_id,episode").single());
}

export async function subscribeSocialUpdates(userId, onChange) {
  const client = await getSupabaseClient();
  const channel = client.channel("aw-social-" + userId)
    .on("postgres_changes", { event: "*", schema: "public", table: "friend_requests" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "watch_party_invites" }, onChange);
  channel.subscribe();
  return () => client.removeChannel(channel);
}
