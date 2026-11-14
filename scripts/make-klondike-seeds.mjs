// Makes src/games/klondike-seeds.json: deal numbers that the solver (src/games/klondike-solver.ts) has WON, 100 for "draw 1" and 100 for "draw 3".
// Run: node --experimental-strip-types --no-warnings scripts/make-klondike-seeds.mjs   (the test 94-klondike solves them again and replays every solution)
import { writeFileSync } from "node:fs";
import * as L from "../src/games/klondike-logic.ts";
import * as S from "../src/games/klondike-solver.ts";

const WANT = 100, LIMIT = 30000;
const out = {};
for (const draw of [1, 3]) {
  const seeds = [];
  for (let i = 1; seeds.length < WANT; i++) {
    const seed = (i * 7919 + 13 * draw) % 2147483647 + 1;
    const s = L.deal(seed, draw);
    const r = S.solve(s, LIMIT);
    if (!r.moves) continue;
    const end = S.replay(s, r.moves);
    if (!end || !L.isWon(end)) throw new Error("replay failed for " + seed);
    seeds.push(seed);
  }
  out[draw] = seeds;
  console.log("draw", draw, ":", seeds.length, "solvable deals");
}
writeFileSync(new URL("../src/games/klondike-seeds.json", import.meta.url), JSON.stringify(out) + "\n");
