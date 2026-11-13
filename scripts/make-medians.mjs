// Builds public/medians/<xx>.json: the centre line ("median", a few points) of every stroke, in writing order, of the same characters as public/strokes
// (Make Me a Hanzi via the npm package hanzi-writer-data, Arphic Public License, see public/strokes/ARPHICPL.TXT). They are what the finger-writing practice
// (src/writeui.ts, rule 51) compares a drawn stroke with. One file per 256 code points, same keys as public/strokes; points are whole numbers (1024 x 1024, y upwards).
// Run: node scripts/make-medians.mjs   (needs hanzi-writer-data; the output is committed)
import fs from "node:fs";
import path from "node:path";
const root = new URL("../", import.meta.url).pathname;
const src = path.join(root, "node_modules/hanzi-writer-data");
const out = path.join(root, "public/medians");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
let n = 0;
for (const f of fs.readdirSync(path.join(root, "public/strokes")).filter((x) => x.endsWith(".json"))) {
  const have = JSON.parse(fs.readFileSync(path.join(root, "public/strokes", f), "utf8"));
  const o = {};
  for (const c of Object.keys(have)) {
    const d = JSON.parse(fs.readFileSync(path.join(src, `${c}.json`), "utf8"));
    if (d.medians.length !== have[c].length) throw new Error(`${c}: ${d.medians.length} medians, ${have[c].length} strokes`);
    o[c] = d.medians.map((m) => m.map((p) => [Math.round(p[0]), Math.round(p[1])]));
    n++;
  }
  fs.writeFileSync(path.join(out, f), JSON.stringify(o));
}
fs.copyFileSync(path.join(root, "public/strokes/ARPHICPL.TXT"), path.join(out, "ARPHICPL.TXT"));
fs.writeFileSync(path.join(out, "README.txt"), "Stroke centre lines (medians) from Make Me a Hanzi (https://github.com/skishore/makemeahanzi), via the npm package hanzi-writer-data.\nLicense: Arphic Public License (ARPHICPL.TXT). Made by scripts/make-medians.mjs.\n");
console.log(`${n} characters`);
