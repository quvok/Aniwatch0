// Minimal dependency-free static server for Playwright smoke tests.
// Serves the repository root, never reaches outside it, and disables caching so
// every test starts from the current files.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";

const root = resolve(process.env.SERVE_ROOT || process.cwd());
const port = Number(process.env.PORT) || 4173;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(new URL(urlPath, "http://local").pathname);
  const full = resolve(join(root, normalize(decoded)));
  if (full !== root && !full.startsWith(root + sep)) return null;
  return full;
}

const server = createServer(async (request, response) => {
  try {
    let file = safePath(request.url || "/");
    if (!file) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, "index.html");
    } catch {
      // fall through to the read error below
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": types[extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`AniWatch test server: http://127.0.0.1:${port}`);
});
