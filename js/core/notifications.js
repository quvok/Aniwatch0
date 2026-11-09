import { getSupabaseClient } from "./supabase.js";

async function checked(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message || "Не удалось загрузить уведомления.");
  return data;
}

export async function loadNotifications(userId, limit = 30) {
  if (!userId) return { items: [], unread: 0 };
  const client = await getSupabaseClient();
  const rows = await checked(client.from("notifications")
    .select("id,actor_id,type,entity_id,title,body,href,read_at,created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(50, limit))));
  const ids = [...new Set((rows || []).map(row => row.actor_id).filter(Boolean))];
  const profiles = ids.length
    ? await checked(client.from("profiles").select("id,username,avatar_url").in("id", ids))
    : [];
  const people = Object.fromEntries((profiles || []).map(person => [person.id, person]));
  const items = (rows || []).map(row => ({
    ...row,
    actor: people[row.actor_id] || null
  }));
  return { items, unread: items.filter(item => !item.read_at).length };
}

export async function markNotificationRead(userId, notificationId) {
  if (!userId || !notificationId) return false;
  const client = await getSupabaseClient();
  const data = await checked(client.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("recipient_id", userId)
    .is("read_at", null)
    .select("id"));
  return !!data?.length;
}

export async function markAllNotificationsRead(userId) {
  if (!userId) return 0;
  const client = await getSupabaseClient();
  const data = await checked(client.from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", userId)
    .is("read_at", null)
    .select("id"));
  return data?.length || 0;
}

export async function subscribeNotifications(userId, onChange) {
  if (!userId) return () => {};
  const client = await getSupabaseClient();
  const channel = client.channel("aw-notifications-" + userId)
    .on("postgres_changes", {
      event: "*", schema: "public", table: "notifications",
      filter: "recipient_id=eq." + userId
    }, onChange);
  channel.subscribe();
  return () => client.removeChannel(channel);
}
