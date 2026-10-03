// Builds the standalone distributable from index.html.
// index.html is authored as artifact page content (no <html>/<head>/<body>), so this wraps it
// in a complete document, stamps the version, and writes dist/ with a zip and SHA-256 sums.
//
//   node scripts/build.mjs [--version v1.2.3]
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const vi = argv.indexOf("--version");
const version = (vi >= 0 && argv[vi + 1]) || process.env.APP_VERSION || "dev";
const name = "suburb-address-count";

const page = readFileSync(join(root, "index.html"), "utf8");
const split = page.indexOf('<div class="wrap">');
if (split < 0) throw new Error('index.html: could not find <div class="wrap"> to split head from body');
const head = page.slice(0, split).trim();
let body = page.slice(split).trim();

const slot = '<span id="app-version"></span>';
if (!body.includes(slot)) throw new Error("index.html: version slot not found");
body = body.replace(slot, `<span id="app-version">Version ${escapeHtml(version)}.</span>`);

const html = `<!doctype html>
<html lang="en-NZ">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="version" content="${escapeHtml(version)}">
<style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style>
${head}
</head>
<body>
${body}
</body>
</html>
`;

const dist = join(root, "dist");
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const htmlName = `${name}.html`;
writeFileSync(join(dist, htmlName), html);

const stage = join(dist, ".stage", `${name}-${version}`);
mkdirSync(stage, { recursive: true });
writeFileSync(join(stage, "index.html"), html);
writeFileSync(join(stage, "README.md"), readFileSync(join(root, "README.md")));
const zipName = `${name}-${version}.zip`;
execFileSync("zip", ["-qr", join("..", zipName), `${name}-${version}`], { cwd: join(dist, ".stage") });
rmSync(join(dist, ".stage"), { recursive: true, force: true });

const sums = readdirSync(dist)
  .filter((f) => !f.startsWith("."))
  .sort()
  .map((f) => `${createHash("sha256").update(readFileSync(join(dist, f))).digest("hex")}  ${f}`);
writeFileSync(join(dist, "SHA256SUMS"), sums.join("\n") + "\n");

console.log(`Built ${name} ${version}`);
for (const s of sums) console.log("  " + s);

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}
