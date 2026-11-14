// Merges the translation part files src/data/trans/parts/<name>.<lang>.json (flat { Chinese source -> translation }) into src/data/trans/<lang>.json.
// Parts are read in file-name order; a later part never overwrites an earlier one: a key with a DIFFERENT value is reported (the first value stays).
// Usage: node scripts/make-trans.mjs        (exit 1 only when a part cannot be read)
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dir = path.join(root, "src/data/trans");
const parts = path.join(dir, "parts");
let bad = 0;
for (const lang of ["en", "fr"]) {
  const files = fs.existsSync(parts) ? fs.readdirSync(parts).filter((f) => f.endsWith(`.${lang}.json`)).sort() : [];
  const out = {};
  let dup = 0, conflicts = 0;
  for (const f of files) {
    let j;
    try { j = JSON.parse(fs.readFileSync(path.join(parts, f), "utf8")); } catch (e) { console.error(`cannot read ${f}: ${e.message}`); bad++; continue; }
    for (const [k, v] of Object.entries(j)) {
      if (typeof v !== "string") { console.error(`${f}: value of ${JSON.stringify(k.slice(0, 30))} is not a string`); bad++; continue; }
      if (k in out) { dup++; if (out[k] !== v) { conflicts++; console.error(`duplicate with a different value (${lang}, ${f}): ${JSON.stringify(k.slice(0, 40))}\n   kept:    ${out[k].slice(0, 60)}\n   ignored: ${v.slice(0, 60)}`); } continue; }
      out[k] = v;
    }
  }
  fs.writeFileSync(path.join(dir, `${lang}.json`), "{\n" + Object.entries(out).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n");
  console.log(`${lang}: ${Object.keys(out).length} texts from ${files.length} part file(s), ${dup} duplicate(s), ${conflicts} conflict(s)`);
}
process.exit(bad ? 1 : 0);
