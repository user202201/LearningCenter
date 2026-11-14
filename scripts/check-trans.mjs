// Lists every Chinese string of the translated CONTENT (formulas, summaries, drawing labels) that has no English / French translation.
// Reads every part file src/data/trans/parts/*.<lang>.json (so it works before make-trans has run) and checks that the generated flat files are up to date.
// Usage: node scripts/check-trans.mjs [--list] [--json]     exit 1 when something is missing or a translation is wrong.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildTables, transDir } from "./trans-lib.mjs";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CJK = /[一-鿿]/;
const args = new Set(process.argv.slice(2));

/** the source strings, by group: formulas / notes / figures */
export async function sources() {
  const groups = { formulas: new Set(), notes: new Set(), figures: new Set(), cards: new Set(), cardtopics: new Set() };
  // the science quiz cards: question, answer, "did you know" sentence, every wrong choice, and the topic labels
  const C = JSON.parse(fs.readFileSync(path.join(root, "src/data/science-cards.json"), "utf8"));
  const addCard = (g, v) => { if (typeof v === "string" && CJK.test(v)) groups[g].add(v); };
  for (const c of C.cards) { for (const k of ["q", "a", "e"]) addCard("cards", c[k]); for (const w of c.w ?? []) addCard("cards", w); }
  for (const v of Object.values(C.topics ?? {})) addCard("cardtopics", v);
  for (const v of Object.values(C.domains ?? {})) if (!Array.isArray(v)) addCard("cardtopics", v);
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
  for (const svg of Object.values(FIGS)) for (const m of svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)) {
    if (/\bdata-drop=/.test(m[1])) continue;   // the second line of a label whose first line holds the whole name
    const k = m[1].match(/\bdata-k="([^"]*)"/);
    const key = k ? k[1] : m[2];
    if (CJK.test(key)) groups.figures.add(key);
  }
  return groups;
}

/** the two tables of a language, built from the part files (so it works before make-trans has run): main = formulas / summaries / drawings, cards = the science cards */
export function tablesOf(lang, src) {
  return buildTables(lang, new Set([...src.cards, ...src.cardtopics]), new Set([...src.formulas, ...src.notes, ...src.figures]));
}
/** the flat files make-trans writes must be the ones the parts give (a part edited without running make-trans is a mistake) */
function staleFiles(lang, t) {
  const bad = [];
  for (const [file, want] of [[`${lang}.json`, t.main], [`cards.${lang}.json`, t.cards]]) {
    let got = null;
    try { got = JSON.parse(fs.readFileSync(path.join(transDir, file), "utf8")); } catch { /* missing */ }
    const same = got && Object.keys(got).length === Object.keys(want).length && Object.entries(want).every(([k, v]) => got[k] === v);
    if (!same) bad.push(file);
  }
  return bad;
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
    const t = tablesOf(lang, src);
    const r = { total: 0, missing: [], badTex: [], leftover: [], empty: [], byGroup: {}, stale: staleFiles(lang, t) };
    for (const [g, set] of Object.entries(src)) {
      const table = g === "cards" || g === "cardtopics" ? t.cards : t.main;
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
  let bad = 0;
  if (args.has("--json")) process.stdout.write(JSON.stringify(res) + "\n");
  else {
  for (const [lang, r] of Object.entries(res)) {
    console.log(`${lang}: ${r.total} source strings; ` + Object.entries(r.byGroup).map(([g, v]) => `${g} ${v.total - v.missing}/${v.total}`).join(", "));
    if (r.missing.length) { bad++; console.log(`  ${r.missing.length} MISSING`); if (args.has("--list")) for (const m of r.missing) console.log(`   [${m.group}] ${JSON.stringify(m.text)}`); }
    if (r.badTex.length) { bad++; console.log(`  ${r.badTex.length} with changed TeX ($...$ must stay as it is)`); for (const m of r.badTex.slice(0, 20)) console.log(`   ${JSON.stringify(m.src.slice(0, 70))}\n     -> ${JSON.stringify(m.got.slice(0, 70))}`); }
    if (r.leftover.length) { bad++; console.log(`  ${r.leftover.length} translations still hold Chinese outside brackets`); for (const m of r.leftover.slice(0, 20)) console.log(`   ${JSON.stringify(m.src.slice(0, 40))} -> ${JSON.stringify(m.got.slice(0, 60))}`); }
    if (r.empty.length) { bad++; console.log(`  ${r.empty.length} empty translations`); }
    if (r.stale.length) { bad++; console.log(`  out of date (run node scripts/make-trans.mjs): ${r.stale.join(", ")}`); }
  }
  if (bad) { if (!args.has("--list")) console.log("(run with --list to see every missing string)"); process.exitCode = 1; }
  else console.log("trans ok: everything is translated");
  }
}
