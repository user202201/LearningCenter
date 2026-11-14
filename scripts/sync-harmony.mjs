// Copies the packaged-app build (MOBILE=1, folder dist-app) into the HarmonyOS project: harmony/entry/src/main/resources/rawfile.
// Usage: node scripts/sync-harmony.mjs [--build]     (--build runs `npm run build:mobile` first)
import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "dist-app");
const dest = join(root, "harmony/entry/src/main/resources/rawfile");

if (process.argv.includes("--build")) execSync("npm run build:mobile", { cwd: root, stdio: "inherit" });
if (!existsSync(join(src, "index.html"))) { console.error("dist-app/index.html not found. Run: npm run build:mobile  (or: node scripts/sync-harmony.mjs --build)"); process.exit(1); }

mkdirSync(dest, { recursive: true });
for (const f of readdirSync(dest)) if (f !== ".gitkeep") rmSync(join(dest, f), { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
writeFileSync(join(dest, ".gitkeep"), "");   // (the build output itself is not committed: .gitignore)

let files = 0, bytes = 0;
(function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else { files++; bytes += statSync(p).size; } } })(dest);
console.log(`copied ${files} files (${(bytes / 1048576).toFixed(1)} MB) to harmony/entry/src/main/resources/rawfile`);
console.log("Next: open the folder harmony/ in DevEco Studio, then Build > Build Hap(s) (harmony/README.md).");
