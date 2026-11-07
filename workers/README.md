# AniList proxy for AniWatch

This is an optional Cloudflare Worker proxy with a 5-minute edge cache for successful GraphQL queries.

## Deploy

1. Open https://dash.cloudflare.com/ and sign in.
2. Go to **Workers & Pages** → **Create** → **Create Worker**.
3. Name it `aniwatch-anilist-proxy`.
4. Replace the starter code with the contents of `anilist-proxy.js`.
5. Deploy. Cloudflare will show a URL similar to `https://aniwatch-anilist-proxy.<your-subdomain>.workers.dev`.

## Connect it to AniWatch

Open `js/config.js` and set `anilistProxyUrl` to the Worker URL, for example:

```js
window.ANIWATCH_CONFIG=Object.assign({
  websocketUrl:"",
  anilistProxyUrl:"https://aniwatch-anilist-proxy.YOUR-SUBDOMAIN.workers.dev"
},window.ANIWATCH_CONFIG||{});
```

Commit the change and wait for GitHub Pages to publish.

The Worker only accepts requests from https://quvok.github.io, allows GraphQL queries (not mutations), and caches successful responses for five minutes. Cache is edge-local, so a cache miss still reaches AniList. A proxy does not guarantee bypassing AniList rate limits or upstream outages.
