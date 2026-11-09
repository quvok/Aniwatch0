import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const service = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const allowedOrigins = new Set([
  "https://aniwatch1.ru",
  "https://www.aniwatch1.ru",
  "https://quvok.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

function cors(origin: string | null) {
  const allow = origin && allowedOrigins.has(origin) ? origin : "https://aniwatch1.ru";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400, origin);
  }

  if (payload.action === "track") {
    const visitorId = String(payload.visitor_id || "");
    const pagePath = String(payload.page_path || "");
    const referrerHost = String(payload.referrer_host || "").slice(0, 120);
    const deviceType = String(payload.device_type || "unknown");
    if (!uuidPattern.test(visitorId) || !pagePath.startsWith("/") || pagePath.length > 180 ||
        /[?#]/.test(pagePath) || !["mobile", "tablet", "desktop", "unknown"].includes(deviceType)) {
      return json({ error: "Invalid event" }, 400, origin);
    }

    const { error } = await service.rpc("record_site_pageview", {
      p_visitor_id: visitorId,
      p_page_path: pagePath,
      p_referrer_host: referrerHost,
      p_device_type: deviceType,
    });
    if (error) return json({ error: "Analytics storage unavailable" }, 503, origin);
    return json({ ok: true }, 200, origin);
  }

  if (payload.action === "stats") {
    const authorization = req.headers.get("authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token || !PUBLIC_KEY) return json({ error: "Unauthorized" }, 401, origin);

    const authClient = createClient(SUPABASE_URL, PUBLIC_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401, origin);

    const { data: isAdmin, error: adminError } = await authClient.rpc("is_site_admin");
    if (adminError || isAdmin !== true) return json({ error: "Forbidden" }, 403, origin);

    const { data, error } = await service.rpc("site_analytics_summary");
    if (error) return json({ error: "Could not load analytics" }, 500, origin);
    return json({ ok: true, stats: data }, 200, origin);
  }

  return json({ error: "Unknown action" }, 400, origin);
});
