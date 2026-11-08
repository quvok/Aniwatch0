import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const { username, password } = await req.json();
    const login = String(username || "").trim();
    if (!login || !password || login.length > 40 || String(password).length > 256) {
      return Response.json({ error: "Введите логин и пароль." }, { status: 400, headers: cors });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: email, error: lookupError } = await admin.rpc("lookup_auth_email_by_username", {
      p_username: login
    });
    if (lookupError || !email) {
      return Response.json({ error: "Неверный логин или пароль." }, { status: 401, headers: cors });
    }

    const { data, error } = await publicClient.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return Response.json({ error: "Неверный логин или пароль." }, { status: 401, headers: cors });
    }

    return Response.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    }, { headers: cors });
  } catch (_error) {
    return Response.json({ error: "Не удалось выполнить вход. Попробуйте ещё раз." }, { status: 400, headers: cors });
  }
});
