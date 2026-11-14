// Merges the translation part files src/data/trans/parts/<name>.<lang>.json (flat { Chinese source -> translation }) into
//   src/data/trans/<lang>.json        formulas, summaries, drawing labels (everything except the card parts)
//   src/data/trans/cards.<lang>.json  the science quiz cards only (loaded when a card is shown, rule 35 / 65)
// Parts are read in file-name order; a later part never overwrites an earlier one (`cards-0` is the first card part: it holds the corrections).
// Usage: node scripts/make-trans.mjs [--verbose]       (exit 1 only when a part cannot be read or a card string has no translation)
import fs from "node:fs";
import path from "node:path";
import { sources } from "./check-trans.mjs";
import { buildTables, transDir } from "./trans-lib.mjs";
const verbose = process.argv.includes("--verbose");
const src = await sources();
const cardKeys = new Set([...src.cards, ...src.cardtopics]);
const otherKeys = new Set([...src.formulas, ...src.notes, ...src.figures]);
const write = (file, o) => fs.writeFileSync(path.join(transDir, file), "{\n" + Object.entries(o).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(",\n") + "\n}\n");
let bad = 0;
for (const lang of ["en", "fr"]) {
  const { main, cards, report } = buildTables(lang, cardKeys, otherKeys, (f, e) => { console.error(`cannot read ${f}: ${e.message}`); bad++; });
  for (const [g, r] of Object.entries(report)) {
    if (r.notString?.length) { bad++; console.error(`${lang} ${g}: values that are not strings: ${r.notString.slice(0, 5).join(", ")}`); }
    if (verbose) for (const c of r.list ?? []) console.error(`duplicate with a different value (${lang}, ${c.file}): ${JSON.stringify(c.key.slice(0, 40))}\n   kept:    ${c.kept.slice(0, 60)}\n   ignored: ${c.ignored.slice(0, 60)}`);
  }
  const noCard = [...cardKeys].filter((k) => !(k in cards));
  if (noCard.length) { bad++; console.error(`${lang}: ${noCard.length} card strings without a translation, e.g. ${JSON.stringify(noCard[0])} (run node scripts/check-trans.mjs --list)`); }
  write(`${lang}.json`, main);
  write(`cards.${lang}.json`, cards);
  const dup = (r) => `${r.dup ?? 0} duplicate(s), ${r.conflicts ?? 0} different`;
  console.log(`${lang}: ${Object.keys(main).length} texts (formulas / summaries / drawings; ${dup(report.other)}), ${Object.keys(cards).length} card texts (${dup(report.card)})` + (verbose ? "" : "  [--verbose lists the differing duplicates]"));
}
process.exit(bad ? 1 : 0);
