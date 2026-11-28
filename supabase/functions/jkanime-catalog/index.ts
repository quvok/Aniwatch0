import { jkOrigin, normalize, parseEpisode, searchResults, titleDetails, validSlug } from "./catalog.mjs";

const origins = new Set(["https://aniwatch1.ru","https://www.aniwatch1.ru","https://quvok.github.io"]);
const cache = new Map<string, {html:string, until:number}>();
const pending = new Map<string, Promise<string>>();
const quotas = new Map<string, number>();
let minute = 0;
let requests = 0;
let retryAt = 0;

async function getPage(path: string) {
  const found = cache.get(path);
  if (found && found.until > Date.now()) return found.html;
  const inflight = pending.get(path);
  if (inflight) return inflight;
  if (requests >= 80 || Date.now() < retryAt) throw 429;
  requests++;
  const task = (async () => {
    const response = await fetch(jkOrigin + path, {
      signal: AbortSignal.timeout(5500), redirect: "error", headers: {Accept:"text/html"}
    });
    if (response.status === 429) {
      const retry = response.headers.get("Retry-After");
      const wait = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry || "") - Date.now();
      retryAt = Date.now() + Math.min(300000, Math.max(30000, wait || 30000));
      throw 429;
    }
    if (response.status === 404) throw 404;
    if (!response.ok || !response.headers.get("Content-Type")?.includes("text/html")) throw 502;
    const reader = response.body?.getReader();
    if (!reader) throw 502;
    const decoder = new TextDecoder();
    let bytes = 0;
    let html = "";
    while (true) {
      const {value,done} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 512000) {
        await reader.cancel();
        throw 502;
      }
      html += decoder.decode(value,{stream:true});
    }
    html += decoder.decode();
    if (cache.size >= 40) cache.delete(cache.keys().next().value!);
    cache.set(path, {html, until:Date.now()+300000});
    return html;
  })();
  pending.set(path,task);
  try { return await task; } finally { pending.delete(path); }
}

Deno.serve(async req => {
  const origin = req.headers.get("Origin");
  if (origin && !origins.has(origin)) return new Response(null,{status:403});
  const headers = {
    "Access-Control-Allow-Origin": origin || "https://aniwatch1.ru",
    "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type":"application/json", "Cache-Control":"no-store", "Vary":"Origin"
  };
  const json = (status:number, value:unknown) => new Response(JSON.stringify(value), {status, headers});
  if (req.method === "OPTIONS") return new Response(null,{status:204,headers});
  if (req.method !== "GET") return json(405,{error:"method"});
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401,{error:"auth"});
  const base = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  let user;
  try {
    const response = await fetch(base+"/auth/v1/user", {
      headers:{Authorization:authorization, apikey:key}, redirect:"error", signal:AbortSignal.timeout(4000)
    });
    if (!response.ok) return json(response.status >= 500 ? 503 : 401,{error:"auth"});
    user = await response.json();
  } catch { return json(503,{error:"auth"}); }
  if (!user?.id) return json(401,{error:"auth"});
  const now = Math.floor(Date.now()/60000);
  if (now !== minute) { minute=now; requests=0; quotas.clear(); }
  const used = quotas.get(user.id) || 0;
  if (used >= 20 || (quotas.size >= 2048 && !used)) return json(429,{error:"quota"});
  quotas.set(user.id,used+1);

  const query = new URL(req.url).searchParams;
  try {
    if (query.has("q")) {
      const name = query.get("q")?.trim();
      if (!name || name.length > 120 || !/^[\p{L}\p{N}][\p{L}\p{N}\p{P}\p{Zs}]*$/u.test(name) ||
          /[\/\\%]/.test(name)) return json(400,{error:"query"});
      const results = searchResults(await getPage("/buscar/"+encodeURIComponent(name)+"/"));
      const exact = results.filter(item => normalize(item.title) === normalize(name));
      if (exact.length === 1) {
        const item = exact[0];
        try { Object.assign(item,titleDetails(await getPage("/"+item.slug+"/"))); }
        catch (error) { if (error !== 404) throw error; }
      }
      return json(200,{results});
    }
    const slug = query.get("slug");
    const rawEpisode = query.get("episode") || "";
    if (!validSlug(slug) || !/^[1-9]\d{0,3}$/.test(rawEpisode)) return json(400,{error:"episode"});
    const episode = Number(rawEpisode);
    const data = parseEpisode(await getPage("/"+slug+"/"+episode+"/"),slug,episode);
    return data ? json(200,data) : json(404,{error:"episode"});
  } catch (error) {
    return json(error === 404 || error === 429 ? error : 502,{error:"provider"});
  }
});
