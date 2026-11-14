// Statistics of the computer players of Dou Dizhu and Paodekuai (AI against AI, no screen).
// usage: node scripts/dz-ai-stats.mjs [games per row = 600]
// The two logic files have no imports: they are transpiled with the TypeScript compiler into the OS temp folder and imported from there.
import ts from "typescript";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = mkdtempSync(join(tmpdir(), "dz-stats-"));
const load = async (name) => {
  const out = join(dir, name + ".mjs");
  const src = readFileSync(join(root, "src/games", name + ".ts"), "utf8");
  writeFileSync(out, ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  return import(pathToFileURL(out).href);
};
const N = +process.argv[2] || 600;
const pct = (x) => (100 * x).toFixed(1) + "%";

try {
  const D = await load("doudizhu-logic");
  /** one game; levels = [seat 0, 1, 2]; the first bidder is `g % 3`; returns the state or null when everybody passed (redeal) */
  const dzGame = (g, levels) => {
    const rng = D.mulberry(g * 7 + 3), s = D.newDeal(rng, g % 3);
    for (let n = 0; s.phase === "bid" && n < 20; n++) {
      const v = D.aiBid(s.hands[s.turn], s.high, levels[s.turn], rng);
      if (D.bid(s, s.turn, D.canBid(s, s.turn, v) ? v : 0) === "redeal") return null;
    }
    for (let m = 0; s.phase === "play" && m < 800; m++) {
      const seat = s.turn, lv = levels[seat], cs = D.aiPlay(s, seat, lv, rng);
      if (cs) { if (!D.play(s, seat, cs).ok) throw new Error("illegal play"); } else if (!D.pass(s, seat)) throw new Error("pass on a free lead");
    }
    if (s.phase !== "over") throw new Error("game did not end");
    return s;
  };
  console.log("== Dou Dizhu: the same level at all three seats (role: landlord / first peasant after him / second peasant before him)");
  for (const lv of [1, 2, 3]) {
    const zero = [0, 0, 0], plays = [0, 0, 0]; let n = 0, lw = 0;
    for (let g = 0; n < N && g < N * 2; g++) {
      const s = dzGame(g, [lv, lv, lv]); if (!s) continue;
      n++; if (s.winner === s.landlord) lw++;
      [0, 1, 2].forEach((k) => { const seat = (s.landlord + k) % 3; plays[k] += s.plays[seat]; if (!s.plays[seat]) zero[k]++; });
    }
    console.log(`level ${lv}: ${n} games, landlord wins ${pct(lw / n)}; plays per game L ${(plays[0] / n).toFixed(1)} P1 ${(plays[1] / n).toFixed(1)} P2 ${(plays[2] / n).toFixed(1)}; zero plays L ${pct(zero[0] / n)} P1 ${pct(zero[1] / n)} P2 ${pct(zero[2] / n)}`);
  }
  console.log("== Dou Dizhu: mixed levels (landlord level vs both peasants' level)");
  for (const [a, b] of [[3, 2], [2, 3], [2, 1], [1, 2], [3, 1], [1, 3]]) {
    let n = 0, lw = 0;
    for (let g = 0; n < N && g < N * 2; g++) {
      // bidding with the higher of the two levels so that the landlord comes from the same distribution
      const rng0 = D.mulberry(g * 7 + 3), s0 = D.newDeal(rng0, g % 3);
      const lv = Math.max(a, b);
      for (let k = 0; s0.phase === "bid" && k < 20; k++) { const v = D.aiBid(s0.hands[s0.turn], s0.high, lv, rng0); if (D.bid(s0, s0.turn, D.canBid(s0, s0.turn, v) ? v : 0) === "redeal") break; }
      if (s0.phase !== "play") continue;
      for (let m = 0; s0.phase === "play" && m < 800; m++) {
        const seat = s0.turn, cs = D.aiPlay(s0, seat, seat === s0.landlord ? a : b, rng0);
        if (cs) D.play(s0, seat, cs); else D.pass(s0, seat);
      }
      n++; if (s0.winner === s0.landlord) lw++;
    }
    console.log(`landlord level ${a} vs peasants level ${b}: landlord wins ${pct(lw / n)} (${n} games)`);
  }

  const P = await load("paodekuai-logic");
  console.log("== Paodekuai: the same level at all three seats (seat = turn order from the player with the 3 of diamonds)");
  for (const lv of [0, 1, 2]) {
    const zero = [0, 0, 0], plays = [0, 0, 0], wins = [0, 0, 0]; let n = 0;
    for (let g = 0; g < N; g++) {
      const rng = P.mulberry(g * 11 + 5), game = P.newGame(rng); const start = game.started;
      for (let m = 0; game.winner < 0 && m < 800; m++) {
        const p = game.turn, cs = P.aiChoose(game, p, lv, rng);
        if (cs) { if (!P.play(game, p, cs).ok) throw new Error("illegal play"); } else if (!P.pass(game, p)) throw new Error("illegal pass");
      }
      if (game.winner < 0) throw new Error("game did not end");
      n++; for (let k = 0; k < 3; k++) { const p = (start + k) % 3; plays[k] += game.plays[p]; if (!game.plays[p]) zero[k]++; if (game.winner === p) wins[k]++; }
    }
    console.log(`level ${lv}: ${n} games; plays per game ${plays.map((x) => (x / n).toFixed(1)).join(" / ")}; zero plays ${zero.map((x) => pct(x / n)).join(" / ")}; wins ${wins.map((x) => pct(x / n)).join(" / ")}`);
  }
  console.log("== Paodekuai: one seat of level B against two of level A (win share of that seat; fair = 33%)");
  for (const [a, b] of [[0, 1], [1, 2], [0, 2], [1, 0], [2, 1]]) {
    let w = 0, n = 0;
    for (let g = 0; g < N; g++) {
      const rng = P.mulberry(g * 13 + 1), game = P.newGame(rng), mine = g % 3;
      for (let m = 0; game.winner < 0 && m < 800; m++) {
        const p = game.turn, cs = P.aiChoose(game, p, p === mine ? b : a, rng);
        if (cs) P.play(game, p, cs); else P.pass(game, p);
      }
      n++; if (game.winner === mine) w++;
    }
    console.log(`one level ${b} vs two level ${a}: the single player wins ${pct(w / n)}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
