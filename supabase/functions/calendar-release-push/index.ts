import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = "BBjCp3UVKy507lmL8hUB7lVLhlj_A5cQUEeYIP2Bm2xX0p4qyrwqJwhwlIOGcRrwtkYPVcAQUNwYTjDVatblupA";
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

type Follow = {
  user_id: string;
  shikimori_id: number;
  notify_before: boolean;
  notify_release: boolean;
};
type Subscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
});

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { data: config, error: configError } = await supabase.rpc("get_calendar_push_config");
  if (configError || !config?.aniwatch_calendar_cron_token || !config?.aniwatch_calendar_vapid_private_key) {
    console.error("Calendar push configuration is unavailable", configError);
    return json({ error: "Push service is not configured" }, 503);
  }
  const suppliedToken = request.headers.get("x-calendar-cron-token") || "";
  if (suppliedToken !== config.aniwatch_calendar_cron_token) return json({ error: "Unauthorized" }, 401);
  webpush.setVapidDetails(
    "mailto:admin@aniwatch1.ru",
    VAPID_PUBLIC_KEY,
    config.aniwatch_calendar_vapid_private_key
  );


  const [followResult, subscriptionResult] = await Promise.all([
    supabase.from("calendar_follows")
      .select("user_id,shikimori_id,notify_before,notify_release")
      .limit(5000),
    supabase.from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .limit(5000)
  ]);
  if (followResult.error) return json({ error: "Could not load followed anime" }, 500);
  if (subscriptionResult.error) return json({ error: "Could not load push subscriptions" }, 500);

  const follows = (followResult.data || []) as Follow[];
  const subscriptions = (subscriptionResult.data || []) as Subscription[];
  if (!follows.length || !subscriptions.length) return json({ ok: true, checked: 0, sent: 0 });

  const response = await fetch("https://shikimori.io/api/calendar", {
    headers: { "Accept": "application/json", "User-Agent": "AniWatch/1.0 (release calendar notifications)" }
  });
  if (!response.ok) return json({ error: "Shikimori calendar request failed", status: response.status }, 502);
  const calendar = await response.json();
  if (!Array.isArray(calendar)) return json({ error: "Invalid Shikimori calendar response" }, 502);

  const byShikimoriId = new Map<number, any>();
  for (const entry of calendar) {
    const animeId = Number(entry?.anime?.id);
    const airingAt = new Date(entry?.next_episode_at || "");
    if (animeId > 0 && Number.isFinite(airingAt.getTime())) byShikimoriId.set(animeId, { entry, airingAt });
  }
  const subscriptionsByUser = new Map<string, Subscription[]>();
  for (const subscription of subscriptions) {
    const list = subscriptionsByUser.get(subscription.user_id) || [];
    list.push(subscription);
    subscriptionsByUser.set(subscription.user_id, list);
  }

  const now = Date.now();
  let checked = 0, sent = 0, stale = 0;
  for (const follow of follows) {
    const scheduled = byShikimoriId.get(Number(follow.shikimori_id));
    const userSubscriptions = subscriptionsByUser.get(follow.user_id) || [];
    if (!scheduled || !userSubscriptions.length) continue;

    const { entry, airingAt } = scheduled;
    const delta = airingAt.getTime() - now;
    const episode = Math.max(1, Number(entry.next_episode) || Number(entry.anime?.episodes_aired || 0) + 1);
    const title = String(entry.anime?.russian || entry.anime?.name || "Аниме");
    const events: Array<"before" | "release"> = [];
    if (follow.notify_before && delta <= 35 * 60 * 1000 && delta > 25 * 60 * 1000) events.push("before");
    if (follow.notify_release && delta <= 0 && delta >= -15 * 60 * 1000) events.push("release");
    if (!events.length) continue;
    checked++;

    for (const eventType of events) {
      const claim = await supabase.from("calendar_push_deliveries").insert({
        user_id: follow.user_id,
        shikimori_id: follow.shikimori_id,
        episode,
        event_type: eventType,
        scheduled_at: airingAt.toISOString()
      });
      if (claim.error) {
        if (claim.error.code !== "23505") console.error("Push delivery claim failed", claim.error);
        continue;
      }

      const payload = JSON.stringify(eventType === "before" ? {
        title: "Новая серия скоро",
        body: `${title}: серия ${episode} ожидается примерно через 30 минут.`,
        url: `/anime.html?id=${1000000000 + Number(follow.shikimori_id)}`,
        tag: `anime-${follow.shikimori_id}-${episode}-before`
      } : {
        title: "Время выхода новой серии",
        body: `${title}: по расписанию должна выйти серия ${episode}.`,
        url: `/anime.html?id=${1000000000 + Number(follow.shikimori_id)}`,
        tag: `anime-${follow.shikimori_id}-${episode}-release`
      });

      let delivered = 0;
      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth }
          }, payload, { TTL: 3600, urgency: "normal" });
          delivered++;
          sent++;
        } catch (error) {
          const statusCode = Number((error as any)?.statusCode);
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            stale++;
          } else {
            console.error("Web Push delivery failed", { statusCode, message: String(error) });
          }
        }
      }
      if (!delivered) {
        await supabase.from("calendar_push_deliveries").delete()
          .eq("user_id", follow.user_id)
          .eq("shikimori_id", follow.shikimori_id)
          .eq("episode", episode)
          .eq("event_type", eventType);
      }
    }
  }

  return json({ ok: true, checked, sent, staleSubscriptionsRemoved: stale });
});
