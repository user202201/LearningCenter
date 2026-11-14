// Lists every Chinese string of the translated CONTENT (formulas, summaries, drawing labels) that has no English / French translation.
// Reads src/data/trans/<lang>.json AND every part file src/data/trans/parts/*.<lang>.json (so it works before make-trans has run).
// Usage: node scripts/check-trans.mjs [--list] [--json]     exit 1 when something is missing or a translation is wrong.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CJK = /[一-鿿]/;
const args = new Set(process.argv.slice(2));

/** the source strings, by group: formulas / notes / figures */
export async function sources() {
  const groups = { formulas: new Set(), notes: new Set(), figures: new Set() };
  const F = JSON.parse(fs.readFileSync(path.join(root, "src/data/formulas.json"), "utf8"));
  for (const f of F.formulas) for (const k of ["k", "s", "n", "t", "x", "ex"]) if (typeof f[k] === "string" && CJK.test(f[k])) groups.formulas.add(f[k]);
  const N = JSON.parse(fs.readFileSync(path.join(root, "src/data/notes.json"), "utf8"));
  const SKIP = new Set(["fig", "note"]);
  (function walk(o, key) {
    if (typeof o === "string") { if (!SKIP.has(key) && CJK.test(o)) groups.notes.add(o); } else if (Array.isArray(o)) o.forEach((v) => walk(v, key)); else if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, k);
  })(N, "");
  // the drawings: transpile figures.ts and safetyfig.ts (plain strings made by code) and read the <text> labels of every drawing
  const ts = (await import("typescript")).default;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trans-"));
  for (const f of ["figures", "safetyfig"]) {
    const js = ts.transpileModule(fs.readFileSync(path.join(root, `src/${f}.ts`), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from "\.\/safetyfig"/, 'from "./safetyfig.mjs"').replace(/import \{ translateFigure \} from "\.\/contenttr";/, "");
    fs.writeFileSync(path.join(tmp, `${f}.mjs`), js);
  }
  const { FIGS } = await import(pathToFileURL(path.join(tmp, "figures.mjs")).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  for (const svg of Object.values(FIGS)) for (const m of svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)) if (CJK.test(m[1])) groups.figures.add(m[1]);
  return groups;
}

/** the translations of a language: the flat file plus every part (parts first-wins, like make-trans) */
export function tableOf(lang) {
  const t = {};
  const dir = path.join(root, "src/data/trans");
  const parts = path.join(dir, "parts");
  const files = fs.existsSync(parts) ? fs.readdirSync(parts).filter((f) => f.endsWith(`.${lang}.json`)).sort() : [];
  for (const f of files) { try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(parts, f), "utf8")))) if (!(k in t)) t[k] = v; } catch { /* reported by make-trans */ } }
  try { for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, `${lang}.json`), "utf8")))) if (!(k in t)) t[k] = v; } catch { /* none yet */ }
  return t;
}
const segs = (s) => s.match(/\$[^$]*\$/g) ?? [];
/** the TeX pieces ($...$) must stay as they are; a piece with Chinese in it (a \text{...}) is translated, so only its place has to stay */
const sameTex = (a, b) => {
  const x = segs(a), rest = [...segs(b)];
  if (rest.length !== x.length) return false;
  for (const p of x.filter((q) => !CJK.test(q))) { const i = rest.indexOf(p); if (i < 0) return false; rest.splice(i, 1); }   // (the order may change in a translation)
  return true;
};
/** Chinese outside brackets: the original name may be kept in brackets, nothing else */
export const cjkOutsideBrackets = (s) => CJK.test(s.replace(/\([^()]*\)|（[^（）]*）/g, ""));

export async function check() {
  const src = await sources();
  const res = {};
  for (const lang of ["en", "fr"]) {
    const table = tableOf(lang);
    const r = { total: 0, missing: [], badTex: [], leftover: [], empty: [], byGroup: {} };
    for (const [g, set] of Object.entries(src)) {
      let miss = 0;
      for (const s of set) {
        r.total++;
        const v = table[s];
        if (v === undefined) { r.missing.push({ group: g, text: s }); miss++; continue; }
        if (!v.trim()) r.empty.push(s);
        if (s.includes("$") && !sameTex(s, v)) r.badTex.push({ src: s, got: v });
        if (cjkOutsideBrackets(v) && !g.startsWith("formulas-tex")) r.leftover.push({ src: s, got: v });
      }
      r.byGroup[g] = { total: set.size, missing: miss };
    }
    res[lang] = r;
  }
  return res;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const res = await check();
  if (args.has("--json")) { console.log(JSON.stringify(res)); process.exit(0); }
  let bad = 0;
  for (const [lang, r] of Object.entries(res)) {
    console.log(`${lang}: ${r.total} source strings; ` + Object.entries(r.byGroup).map(([g, v]) => `${g} ${v.total - v.missing}/${v.total}`).join(", "));
    if (r.missing.length) { bad++; console.log(`  ${r.missing.length} MISSING`); if (args.has("--list")) for (const m of r.missing) console.log(`   [${m.group}] ${JSON.stringify(m.text)}`); }
    if (r.badTex.length) { bad++; console.log(`  ${r.badTex.length} with changed TeX ($...$ must stay as it is)`); for (const m of r.badTex.slice(0, 20)) console.log(`   ${JSON.stringify(m.src.slice(0, 70))}\n     -> ${JSON.stringify(m.got.slice(0, 70))}`); }
    if (r.leftover.length) { bad++; console.log(`  ${r.leftover.length} translations still hold Chinese outside brackets`); for (const m of r.leftover.slice(0, 20)) console.log(`   ${JSON.stringify(m.src.slice(0, 40))} -> ${JSON.stringify(m.got.slice(0, 60))}`); }
    if (r.empty.length) { bad++; console.log(`  ${r.empty.length} empty translations`); }
  }
  if (bad) { if (!args.has("--list")) console.log("(run with --list to see every missing string)"); process.exit(1); }
  console.log("trans ok: everything is translated");
}
