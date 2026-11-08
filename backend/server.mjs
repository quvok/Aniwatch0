import {
  HttpClient,
  startServer,
  AnilistMeta,
  AllmangaProvider,
  GogoanimeProvider,
  AnikotoProvider,
  AnimeParadiseProvider,
  MegaPlayProvider,
} from "anime-sdk";

const port = Number(process.env.PORT || 3000);
const http = new HttpClient({ timeoutMs: 30_000 });

// Small in-memory cache: it resets when the free hosting instance restarts.
const store = new Map();
const cache = {
  get(key) {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      store.delete(key);
      return undefined;
    }
    return entry.value;
  },
  set(key, value) {
    // Metadata and episode lists are stable enough for a short prototype cache.
    store.set(key, { value, expiresAt: Date.now() + 5 * 60 * 1000 });
    if (store.size > 500) {
      const oldest = store.keys().next().value;
      if (oldest) store.delete(oldest);
    }
  },
};

const providers = [
  new AllmangaProvider(http),
  new GogoanimeProvider(http),
  new AnikotoProvider(http),
  new AnimeParadiseProvider(http),
  new MegaPlayProvider(http),
];

const metaProviders = [new AnilistMeta(http)];

console.log("[AniWatch API] Providers:", providers.map((p) => p.id).join(", "));

startServer({
  providers,
  metaProviders,
  port,
  cache,
  // Keep proxy disabled for the first test. Enabling an unrestricted proxy
  // on a public free host would create an open proxy / SSRF risk.
  proxy: false,
});
