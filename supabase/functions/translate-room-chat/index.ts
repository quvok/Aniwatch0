import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const allowed = new Set(["https://aniwatch1.ru", "https://www.aniwatch1.ru", "https://quvok.github.io"]);
for (const origin of (Deno.env.get("CHAT_TRANSLATOR_ALLOWED_ORIGINS") || "").split(",")) {
  if (origin.trim()) allowed.add(origin.trim());
}

const provider = Deno.env.get("CHAT_TRANSLATOR_PROVIDER");
const key = Deno.env.get("CHAT_TRANSLATOR_API_KEY");

async function readPayload(req: Request) {
  const reader = req.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 8192) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    text += decoder.decode(value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

function endpointForProvider() {
  if (provider === "deepl") return Deno.env.get("CHAT_TRANSLATOR_DEEPL_PAID") === "true"
    ? "https://api.deepl.com/v2/translate" : "https://api-free.deepl.com/v2/translate";
  if (provider === "google") return "https://translation.googleapis.com/language/translate/v2";
  return null;
}

Deno.serve(async req => {
  const origin = req.headers.get("Origin");
  if (origin && !allowed.has(origin)) return new Response(null, { status: 403 });
  const headers = {
    "Access-Control-Allow-Origin": origin || "https://aniwatch1.ru",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin"
  };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return json(405, { error: "method" });
  const token = /^Bearer (\S+)$/i.exec(req.headers.get("Authorization") || "")?.[1];
  if (!token) return json(401, { error: "auth" });
  const auth = createClient(url, publicKey, { auth: { persistSession: false } });
  const { data, error: authError } = await auth.auth.getUser(token);
  if (authError || !data.user) return json(401, { error: "auth" });
  if (!key || !endpointForProvider()) return json(503, { error: "configuration" });

  let payload;
  try { payload = await readPayload(req); } catch { return json(400, { error: "body" }); }
  const text = payload?.text;
  const source = payload?.source;
  const target = payload?.target;
  if (typeof text !== "string" || !text.trim() || text.length > 4500 ||
    !["ru","es"].includes(source) || !["ru","es"].includes(target) || source === target) {
    return json(400, { error: "validation" });
  }
  const { data: allowedRequest, error } = await service.rpc("take_chat_translation_slot", { p_user: data.user.id });
  if (error) return json(503, { error: "quota" });
  if (!allowedRequest) return json(429, { error: "quota" });
  try {
    const endpoint = endpointForProvider()!;
    const deepL = provider === "deepl";
    const response = await fetch(endpoint, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(4500),
      headers: { "Content-Type": "application/json",
        ...(deepL ? { Authorization: "DeepL-Auth-Key " + key } : { "X-Goog-Api-Key": key }) },
      body: JSON.stringify(deepL ? {
        text: [text], source_lang: source.toUpperCase(), target_lang: target.toUpperCase()
      } : { q: text, source, target, format: "text" })
    });
    if (!response.ok) return json(response.status === 429 ? 429 : 502, { error: "provider" });
    const body = await response.json();
    const translation = deepL ? body?.translations?.[0]?.text : body?.data?.translations?.[0]?.translatedText;
    if (typeof translation !== "string" || !translation.trim() || translation.length > 6000) {
      return json(502, { error: "provider" });
    }
    return json(200, { translation });
  } catch {
    return json(502, { error: "provider" });
  }
});
