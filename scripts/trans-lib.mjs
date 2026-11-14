// Shared by make-trans.mjs and check-trans.mjs: reads the translation part files and builds the two tables of a language.
//   cards table (src/data/trans/cards.<lang>.json): ONLY the strings of src/data/science-cards.json (question, answer, "did you know" sentence, wrong choices, topic labels).
//     The card answers are context texts ("The ears", "Du ventricule droit"), so they must not leak into the notes / formulas / drawings: own table, loaded when a card is shown.
//     Source of a card string: the card part files (`cards-*.<lang>.json`, first wins), then every other part.
//   main table (src/data/trans/<lang>.json): the formulas, the summaries and the drawing labels (everything that is not a card part, first wins; a string that only a
//     card part translates and that these sources need is taken from there).
import fs from "node:fs";
import path from "node:path";
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const transDir = path.join(root, "src/data/trans");
const partsDir = path.join(transDir, "parts");
export const isCardPart = (f) => /^cards-/.test(f);

/** the parts of a language, in file-name order, with their file names; `onError` gets unreadable files */
export function readParts(lang, onError = () => {}) {
  const files = fs.existsSync(partsDir) ? fs.readdirSync(partsDir).filter((f) => f.endsWith(`.${lang}.json`)).sort() : [];
  const out = [];
  for (const f of files) {
    try { out.push({ file: f, table: JSON.parse(fs.readFileSync(path.join(partsDir, f), "utf8")) }); } catch (e) { onError(f, e); }
  }
  return out;
}

/** first-wins merge of some parts; counts the duplicates and the duplicates with a different value */
export function merge(parts, report = {}) {
  const out = {};
  for (const { file, table } of parts) {
    for (const [k, v] of Object.entries(table)) {
      if (typeof v !== "string") { (report.notString ??= []).push(`${file}: ${k.slice(0, 30)}`); continue; }
      if (k in out) { report.dup = (report.dup ?? 0) + 1; if (out[k] !== v) { report.conflicts = (report.conflicts ?? 0) + 1; (report.list ??= []).push({ file, key: k, kept: out[k], ignored: v }); } continue; }
      out[k] = v;
    }
  }
  return out;
}

/**
 * The two tables of a language. `cardKeys` = the card strings, `otherKeys` = the formulas / summaries / drawing strings (sets of Chinese strings).
 * Returns { main, cards, report }.
 */
export function buildTables(lang, cardKeys, otherKeys, onError) {
  const parts = readParts(lang, onError);
  const report = { card: {}, other: {} };
  const P_card = merge(parts.filter((p) => isCardPart(p.file)), report.card);
  const P_other = merge(parts.filter((p) => !isCardPart(p.file)), report.other);
  const cards = {};
  for (const k of cardKeys) { const v = P_card[k] ?? P_other[k]; if (v !== undefined) cards[k] = v; }
  const main = { ...P_other };
  for (const k of otherKeys) if (!(k in main) && k in P_card) main[k] = P_card[k];
  return { main, cards, report };
}
