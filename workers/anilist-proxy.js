const UPSTREAM = "https://graphql.anilist.co";
const ALLOWED_ORIGIN = "https://quvok.github.io";
const CACHE_TTL = 300;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Vary": "Origin"
  };
}

function json(body, status, origin, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...cors(origin),
      ...extra
    }
  });
}

async function cacheKeyFor(body) {
  const bytes = new TextEncoder().encode(JSON.stringify(body));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
  return new Request("https://anilist-proxy-cache.invalid/" + hex, { method: "GET" });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, origin);
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > 100000) return json({ error: "Request too large" }, 413, origin);
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400, origin);
    }

    if (!body || typeof body.query !== "string" || body.query.length > 50000) {
      return json({ error: "Invalid GraphQL query" }, 400, origin);
    }
    if (/\bmutation\b/i.test(body.query)) {
      return json({ error: "Mutations are not allowed through this public proxy" }, 400, origin);
    }

    const cache = caches.default;
    const key = await cacheKeyFor(body);
    const cached = await cache.match(key);
    if (cached) {
      const headers = new Headers(cached.headers);
      for (const [k, v] of Object.entries(cors(origin))) headers.set(k, v);
      headers.set("X-AniWatch-Cache", "HIT");
      return new Response(cached.body, { status: cached.status, headers });
    }

    let upstream;
    try {
      upstream = await fetch(UPSTREAM, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      });
    } catch {
      return json({ error: "AniList upstream unavailable" }, 502, origin);
    }

    const headers = new Headers(upstream.headers);
    for (const [k, v] of Object.entries(cors(origin))) headers.set(k, v);
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.set("X-AniWatch-Cache", "MISS");

    const response = new Response(upstream.body, {
      status: upstream.status,
      headers
    });

    if (upstream.ok && upstream.status === 200) {
      const copy = response.clone();
      ctx.waitUntil(copy.json().then(payload => {
        if (payload && payload.data && !payload.errors) {
          const cachedResponse = new Response(JSON.stringify(payload), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": "public, max-age=" + CACHE_TTL,
              ...cors(origin)
            }
          });
          return cache.put(key, cachedResponse);
        }
      }).catch(() => {}));
    }
    return response;
  }
};
