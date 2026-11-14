// Documents and checks every Chinese text that has more than one meaning in the app (scripts/i18n-contexts.json).
// The translation tables are keyed by the Chinese text, so one text with two meanings gets ONE translation unless the minority use is marked
// with cx("text", "ctx") (src/i18n.ts) and has its own table entry "text@ctx". For every key in the json this check asserts that
//   - each variant (the plain key and every ctx) has the English and French translation recorded here, in src/i18n-data.ts,
//   - two variants of one key do not share the English text (otherwise there was nothing to split),
//   - every use named in the json still exists in its file (the text is there; the line number is only a hint),
//   - every cx("text", "ctx") call in src/ is documented here (a new split must be written down).
// Run: node scripts/check-i18n-contexts.mjs   (part of `npm run check:i18n`)
import fs from "node:fs";
import path from "node:path";

const root = new URL("../", import.meta.url).pathname;
const doc = JSON.parse(fs.readFileSync(path.join(root, "scripts/i18n-contexts.json"), "utf8"));
const data = fs.readFileSync(path.join(root, "src/i18n-data.ts"), "utf8");
const table = (name) => {
  const m = data.match(new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\};`));
  const o = new Map();
  for (const line of (m?.[1] ?? "").split("\n")) {
    const k = line.match(/^\s*("(?:[^"\\]|\\.)*"):\s*("(?:[^"\\]|\\.)*"),?\s*$/);
    if (k) o.set(JSON.parse(k[1]).trim(), JSON.parse(k[2]).trim());
  }
  return o;
};
const T = { en: table("EN"), fr: table("FR") };
let bad = 0;
const fail = (m) => { bad++; console.error("i18n-contexts: " + m); };
const keyOf = (key, ctx) => (ctx ? `${key}@${ctx}` : key);

for (const [key, e] of Object.entries(doc)) {
  const names = Object.keys(e.variants);
  for (const v of names) {
    for (const l of ["en", "fr"]) {
      const got = T[l].get(keyOf(key, v));
      if (got === undefined) fail(`${JSON.stringify(keyOf(key, v))} has no ${l.toUpperCase()} entry`);
      else if (got !== e.variants[v][l]) fail(`${JSON.stringify(keyOf(key, v))} ${l.toUpperCase()} is ${JSON.stringify(got)}, documented as ${JSON.stringify(e.variants[v][l])}`);
    }
  }
  if (names.length > 1) {
    const ens = names.map((v) => e.variants[v].en);
    if (new Set(ens).size !== ens.length) fail(`${JSON.stringify(key)}: two variants have the same English text (nothing to split)`);
  }
  for (const u of e.uses) {
    if (!(u.variant in e.variants)) { fail(`${JSON.stringify(key)}: use ${u.where} names an unknown variant`); continue; }
    const file = path.join(root, u.where.replace(/:\d+$/, ""));
    if (!fs.existsSync(file)) { fail(`${u.where}: file is gone`); continue; }
    if (!fs.readFileSync(file, "utf8").includes(u.find)) fail(`${u.where}: the documented use ${JSON.stringify(u.find)} is no longer there`);
  }
}

// every cx() call in the sources is documented
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]));
for (const f of walk(path.join(root, "src")).filter((x) => x.endsWith(".ts") && !x.endsWith("i18n.ts"))) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bcx\(\s*(["`])((?:\\.|(?!\1)[^\\])*)\1\s*,\s*"([A-Za-z0-9_-]+)"\s*\)/g)) {
    const text = m[1] === "`" ? m[2].replace(/\$\{[^}]*\}/g, (s, i) => s) : m[2];
    // a template literal "第 ${a} / ${b} 题" is documented as "第 {0} / {1} 题"
    let n = 0;
    const key = m[1] === "`" ? m[2].replace(/\$\{[^}]*\}/g, () => `{${n++}}`) : text;
    if (!doc[key]?.variants[m[3]]) fail(`${path.relative(root, f)}: cx(${JSON.stringify(key)}, ${JSON.stringify(m[3])}) is not documented in scripts/i18n-contexts.json`);
  }
}
if (bad) { console.error(`\n${bad} problem(s) with the contexts of translation keys.`); process.exit(1); }
console.log(`i18n contexts ok: ${Object.keys(doc).length} keys with more than one meaning documented`);
