// Runs after `expo export --platform web` to inject the SVG favicon and update the page title.
// Expo SPA mode doesn't support +html.tsx, so we patch dist/index.html directly.
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "app", "dist");
const assetsDir = path.join(__dirname, "..", "app", "assets");

// ── 1. Copy favicon.svg ───────────────────────────────────────────────────────
fs.copyFileSync(
  path.join(assetsDir, "favicon.svg"),
  path.join(distDir, "favicon.svg")
);

// ── 2. Patch index.html ───────────────────────────────────────────────────────
const indexPath = path.join(distDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

// Embed SVG as base64 data URI so the favicon travels with the HTML —
// no separate file to cache, bypasses Chrome/Edge per-domain favicon cache.
const svgContent = fs.readFileSync(path.join(assetsDir, "favicon.svg"), "utf8");
const svgDataUri = `data:image/svg+xml;base64,${Buffer.from(svgContent).toString("base64")}`;

html = html.replace(/<title>.*?<\/title>/, "<title>Rrëy: JÏT</title>");

// Remove any existing favicon links (handles both first-run and re-patch)
html = html.replace(/\s*<link rel="(icon|alternate icon)"[^>]*\/>/g, "");

// Inject inline data-URI favicon — immune to browser favicon caching
html = html.replace(
  "</head>",
  `  <link rel="icon" type="image/svg+xml" href="${svgDataUri}" />\n</head>`
);

fs.writeFileSync(indexPath, html, "utf8");

console.log("✓ dist/favicon.svg copied");
console.log("✓ dist/index.html patched (title + SVG favicon)");
