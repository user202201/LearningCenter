// Fails when a Chinese UI text in src/ has no translation (English, French) in src/i18n-data.ts.
// Run: npm run check:i18n   (also part of `npm run build`, so a missing translation cannot be deployed)
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const dir = new URL("../src/", import.meta.url).pathname;
const cjk = /[一-鿿　-〿＀-￯]/;
// not UI texts: translation tables themselves, and keywords used to recognise "primo / secondo" file names
// mathcn.ts: Chinese numerals and times-table rhymes (content a Chinese child reads, single characters). musicfig.ts: the course drawings (labels like 五度圈 are Chinese course content). figures.ts: the labels of the drawings of the summaries (Chinese content like the science cards, shown in a `user` box: never translated)
const SKIP_FILES = new Set(["coding-infomodel.ts", "coding-textlevels.ts", "coding-textlessons.ts", "coding-textlang.ts", "coding-textrun.ts", "coding-textbridge.ts", "i18n-data.ts", "mathcn.ts", "figures.ts", "safetyfig.ts", "musicfig.ts", "games/xiangqi-logic.ts", "games/xiangqi-art.ts"])   // (xiangqi: the characters ON the pieces and the river, shown in `user` boxes: board content, never translated);

const texts = new Map();
// the games (src/games/*.ts, one module each) are checked too
// the physics lab (src/phys) and the biology lab (src/bio) too: their UI texts (labels, tasks, readouts, canvas labels) are translated; their CONTENT (lessons, quiz questions and the tables only the quizzes use) is not, it is shown in `user` boxes
const files = [...fs.readdirSync(dir), ...["games", "phys", "bio"].flatMap((d) => (fs.existsSync(path.join(dir, d)) ? fs.readdirSync(path.join(dir, d)).map((x) => `${d}/${x}`) : []))];
const CONTENT_TABLES = new Set(["ROLES", "DEV", "GLANDS", "LACK", "EXAMPLES", "PRODUCTS", "LINKS", "GENO", "defs", "VALVE_TEXT_QUIZ"]);
const isContent = (n, f) => {
  if (!/^(phys|bio)\//.test(f)) return false;
  for (let p = n.parent; p; p = p.parent) {
    if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && /^(makeQ|numQ)$/.test(p.expression.text)) return true;
    if (ts.isPropertyAssignment(p) && /^(lesson|formulas|why)$/.test(p.name.getText())) return true;
    if (ts.isFunctionDeclaration(p) && p.name?.text === "quiz") return true;
    if (ts.isVariableDeclaration(p) && p.name.getText && CONTENT_TABLES.has(p.name.getText()) && /^(phys|bio)\//.test(f)) return true;
  }
  return false;
};
for (const f of files.filter((x) => x.endsWith(".ts") && !x.endsWith(".d.ts") && !SKIP_FILES.has(x))) {
  const sf = ts.createSourceFile(f, fs.readFileSync(path.join(dir, f), "utf8"), ts.ScriptTarget.Latest, true);
  const add = (t) => {
    if (!cjk.test(t)) return;
    // an HTML fragment (innerHTML): check the texts between the tags
    if (/^\s*</.test(t)) for (const m of t.matchAll(/>([^<>]*[\u4e00-\u9fff][^<>]*)</g)) texts.set(m[1].trim(), f);
    else texts.set(t.trim(), f);
  };
  (function walk(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) { if (!isContent(n, f)) add(n.text); }
    else if (ts.isTemplateExpression(n)) { if (!isContent(n, f)) add(n.templateSpans.reduce((s, sp, i) => s + `{${i}}` + sp.literal.text, n.head.text)); }
    ts.forEachChild(n, walk);
  })(sf);
}

const data = fs.readFileSync(path.join(dir, "i18n-data.ts"), "utf8");
const table = (name) => {
  const m = data.match(new RegExp(`export const ${name}[^=]*= \\{([\\s\\S]*?)\\n\\};`));
  const keys = new Set();
  for (const line of (m?.[1] ?? "").split("\n")) {
    const k = line.match(/^\s*("(?:[^"\\]|\\.)*"):/);
    if (k) keys.add(JSON.parse(k[1]).trim());
  }
  return keys;
};
const LANGS = ["EN", "FR"];
const tables = Object.fromEntries(LANGS.map((l) => [l, table(l)]));
// texts that are only used as a language's own name, or are part of an HTML fragment / not shown as such
const ALLOW = new Set(["中文", "语言 / Language"]);
let bad = 0;
for (const [t, f] of texts) {
  if (ALLOW.has(t)) continue;
  const missing = LANGS.filter((l) => !tables[l].has(t));
  if (missing.length) {
    bad++;
    console.error(`missing ${missing.join("+")} translation (${f}): ${JSON.stringify(t)}`);
  }
}
if (bad) {
  console.error(`\n${bad} text(s) without translation. Add them to src/i18n-data.ts (EN, FR) and run again.`);
  process.exit(1);
}
console.log(`i18n ok: ${texts.size} texts, all translated to English and French`);
