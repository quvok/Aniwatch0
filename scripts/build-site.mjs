// Builds the published GitHub Pages artifact.
//
// The repository also keeps design references, plugin archives and screenshots
// next to the site. Publishing the raw directory (path: ".") leaks those files
// and slows every deploy, so the deploy step copies an explicit allowlist here.
//
// The script also stamps sw.js with a content hash: the Service Worker cache is
// invalidated automatically whenever any shipped file changes, instead of
// relying on a manually bumped version string.
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative, sep } from "node:path";

const root = process.cwd();
const out = join(root, "_site");
const siteUrl = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");

const rootFiles = ["manifest.webmanifest", "sw.js"];
const rootDirs = ["css", "js", "icons"];

async function copyRootPages() {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".html")) continue;
    await cp(join(root, entry.name), join(out, entry.name));
  }
}

async function listPublishedFiles(dir, out = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await listPublishedFiles(path, out);
    else out.push(path);
  }
  return out;
}

async function readRouterPages() {
  const source = await readFile(join(root, "js/core/router.js"), "utf8");
  const block = /export const PAGES=\{([\s\S]*?)\};/.exec(source);
  if (!block) throw new Error("PAGES map not found in js/core/router.js");
  return [...block[1].matchAll(/(\w+):"([^"]+)"/g)].map(match => match[2]);
}

function assertServiceWorkerShell(swSource) {
  // Every shipped module must be precached; a forgotten entry only shows up as
  // a broken offline page, which is hard to notice during manual testing.
  const shell = /SHELL=\[([\s\S]*?)\];/.exec(swSource);
  if (!shell) throw new Error("SHELL list not found in sw.js");
  const listed = new Set([...shell[1].matchAll(/"([^"]+)"/g)].map(match => match[1]));
  const required = [];
  const walkJs = dir => readdir(join(root, dir), { withFileTypes: true }).then(async entries => {
    for (const entry of entries) {
      const rel = join(dir, entry.name).split(sep).join("/");
      if (entry.isDirectory()) await walkJs(rel);
      else if (entry.name.endsWith(".js")) required.push(rel);
    }
  });
  return walkJs("js").then(() => {
    required.push("css/style.css", "manifest.webmanifest");
    const missing = required.filter(file => !listed.has(file));
    if (missing.length) throw new Error("sw.js SHELL is missing: " + missing.join(", "));
  });
}

async function contentHash(files) {
  const hash = createHash("sha256");
  for (const file of files.map(file => relative(out, file)).sort()) {
    hash.update(file);
    hash.update(await readFile(join(out, file)));
  }
  return hash.digest("hex").slice(0, 12);
}

const NO_CANONICAL = new Set(["anime.html", "watch.html", "profile.html", "stats.html"]);

function attr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

// Adds Open Graph, canonical and (when SITE_URL is configured) JSON-LD tags.
// Without SITE_URL the site still ships valid title/description metadata, but
// URL-based tags are skipped instead of pointing at a made-up domain.
async function injectSeo() {
  const files = (await readdir(out)).filter(file => file.endsWith(".html"));
  for (const file of files) {
    let html = await readFile(join(out, file), "utf8");
    if (!html.includes("<!--seo-->")) continue;
    const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || "AniWatch";
    const description = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || "";
    const tags = [
      `<meta property="og:type" content="website">`,
      `<meta property="og:site_name" content="AniWatch">`,
      `<meta property="og:title" content="${attr(title)}">`,
      `<meta property="og:description" content="${attr(description)}">`,
      `<meta name="twitter:card" content="summary">`,
      `<meta name="twitter:title" content="${attr(title)}">`,
      `<meta name="twitter:description" content="${attr(description)}">`
    ];
    if (siteUrl) {
      const image = siteUrl + "/icons/icon-512.png";
      if (!NO_CANONICAL.has(file)) {
        const pageUrl = siteUrl + "/" + (file === "index.html" ? "" : file);
        tags.unshift(`<link rel="canonical" href="${attr(pageUrl)}">`);
        tags.push(`<meta property="og:url" content="${attr(pageUrl)}">`);
      }
      tags.push(`<meta property="og:image" content="${attr(image)}">`);
      tags.push(`<meta name="twitter:image" content="${attr(image)}">`);
    }
    if (file === "index.html" && siteUrl) {
      const data = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "AniWatch",
        url: siteUrl + "/",
        inLanguage: "ru",
        potentialAction: {
          "@type": "SearchAction",
          target: siteUrl + "/catalog.html?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      };
      tags.push(`<script type="application/ld+json">${JSON.stringify(data)}</script>`);
    }
    html = html.replace("<!--seo-->", tags.join("\n"));
    await writeFile(join(out, file), html);
  }
}

async function writeSeoFiles(pages) {
  const sitemap = siteUrl
    ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      pages.map(page => `  <url><loc>${siteUrl}/${page === "index.html" ? "" : page}</loc></url>`).join("\n") +
      `\n</urlset>\n`
    : null;
  const robots = ["User-agent: *", "Allow: /", sitemap ? `Sitemap: ${siteUrl}/sitemap.xml` : "", ""].join("\n");
  await writeFile(join(out, "robots.txt"), robots);
  if (sitemap) await writeFile(join(out, "sitemap.xml"), sitemap);
  return Boolean(sitemap);
}

async function main() {
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });

  await copyRootPages();
  for (const dir of rootDirs) await cp(join(root, dir), join(out, dir), { recursive: true });
  for (const file of rootFiles) {
    if (!existsSync(join(root, file))) throw new Error("Missing build input: " + file);
    await cp(join(root, file), join(out, file));
  }

  const swPath = join(out, "sw.js");
  const originalSw = await readFile(swPath, "utf8");
  await assertServiceWorkerShell(originalSw);

  const pages = await readRouterPages();
  await injectSeo();
  const withSitemap = await writeSeoFiles(pages);

  // Hash every published file except sw.js itself, which is about to be stamped.
  const published = (await listPublishedFiles(out)).filter(file => file !== swPath);
  const version = await contentHash(published);
  const stamped = originalSw.replace(/var V="[^"]*"/, `var V="aw-${version}"`);
  if (stamped === originalSw) throw new Error("Service Worker version placeholder not found");
  await writeFile(swPath, stamped);

  const publishedFiles = (await listPublishedFiles(out)).map(file => relative(out, file)).sort();
  console.log(`Built _site: ${publishedFiles.length} files, cache version aw-${version}`);
  console.log(withSitemap ? "Generated robots.txt and sitemap.xml" : "Generated robots.txt (set SITE_URL for sitemap.xml)");
  for (const file of publishedFiles) {
    if (!/\.(js|css|html|webmanifest)$/.test(file)) continue;
    const info = await stat(join(out, file));
    if (info.size > 400 * 1024) console.log(`  large asset: ${file} (${Math.round(info.size / 1024)} KB)`);
  }
}

main().catch(error => {
  console.error("Build failed:", error.message);
  process.exit(1);
});
