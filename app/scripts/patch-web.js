// Runs after `expo export --platform web` to inject the SVG favicon and update the page title.
// Expo SPA mode doesn't support +html.tsx, so we patch dist/index.html directly.
const fs = require("fs");
const path = require("path");

const distDir = path.join(__dirname, "..", "dist");
const assetsDir = path.join(__dirname, "..", "assets");

// ── 1. Copy favicon.svg ───────────────────────────────────────────────────────
fs.copyFileSync(
  path.join(assetsDir, "favicon.svg"),
  path.join(distDir, "favicon.svg")
);

// ── 2. Patch index.html ───────────────────────────────────────────────────────
const indexPath = path.join(distDir, "index.html");
let html = fs.readFileSync(indexPath, "utf8");

html = html.replace(/<title>.*?<\/title>/, "<title>Rrëy: JÏT</title>");

html = html.replace(
  '<link rel="icon" href="/favicon.ico" />',
  '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />\n  <link rel="alternate icon" href="/favicon.ico" />'
);

fs.writeFileSync(indexPath, html, "utf8");

console.log("✓ dist/favicon.svg copied");
console.log("✓ dist/index.html patched (title + SVG favicon)");
