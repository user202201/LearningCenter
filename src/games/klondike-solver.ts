/** A Klondike solver (perfect information: every face-down card is known). Used by the tests and by scripts/make-klondike-seeds.mjs, never by the game itself.
 * Depth-first search with a memory of the positions seen; a "macro" move is a number of stock draws followed by one waste move, so the stock is never a branch of its own.
 * The result is a list of ordinary engine moves: replaying them with `apply` ends in a win. */
import * as L from "./klondike-logic.ts";

export interface SolveResult { moves: L.Move[] | null; nodes: number; exhausted: boolean }

function keyOf(s: L.State): string {
  let k = "";
  for (let i = 0; i < L.NPILES; i++) k += s.down[i] + ":" + s.tab[i].join(",") + "/";
  k += s.found.join(",") + "|";
  if (s.draw === 1) {
    // draw one: every ring card can be reached, so only the ring order matters, not where the pointer stands
    const ring = s.waste.concat(s.stock.slice().reverse());
    if (ring.length) { let mi = 0; for (let i = 1; i < ring.length; i++) if (ring[i] < ring[mi]) mi = i; k += ring.slice(mi).concat(ring.slice(0, mi)).join(","); }
  } else k += s.stock.join(",") + "|" + s.waste.join(",");
  return k;
}

/** a foundation move that can never hurt (the card is not needed to build on) */
function safe(s: L.State, c: L.Card): boolean {
  const r = L.rankOf(c);
  if (r <= 1) return true;
  const red = L.isRed(c);
  const o1 = s.found[red ? 0 : 1], o2 = s.found[red ? 3 : 2];
  return Math.min(o1, o2) >= r;
}

export function solve(start: L.State, nodeLimit = 30000): SolveResult {
  const seen = new Set<string>();
  let nodes = 0, cut = false;
  const path: L.Move[] = [];

  const autoSafe = (s: L.State, out: L.Move[]): void => {
    for (let again = true; again;) {
      again = false;
      const cands: { from: L.Loc; c: L.Card }[] = [];
      if (s.waste.length) cands.push({ from: { t: "waste" }, c: s.waste[s.waste.length - 1] });
      for (let i = 0; i < L.NPILES; i++) if (s.tab[i].length && L.upCount(s, i) > 0) cands.push({ from: { t: "tab", i }, c: s.tab[i][s.tab[i].length - 1] });
      for (const { from, c } of cands) {
        if (L.canFound(s, c) && safe(s, c)) {
          const m: L.Move = { k: "move", from, to: { t: "found", i: L.suitOf(c) }, n: 1 };
          L.applyIn(s, m); out.push(m); again = true; break;
        }
      }
    }
  };

  const dfs = (s0: L.State): boolean => {
    const s = L.clone(s0);
    const forced: L.Move[] = [];
    autoSafe(s, forced);
    if (L.isWon(s)) { path.push(...forced); return true; }
    const key = keyOf(s);
    if (seen.has(key)) return false;
    seen.add(key);
    if (++nodes > nodeLimit) { cut = true; return false; }

    // the candidate moves, best first: each is the list of engine moves it takes
    const cands: L.Move[][] = [];
    const tops = (i: number): L.Card => s.tab[i][s.tab[i].length - 1];
    let firstEmpty = -1;
    for (let j = 0; j < L.NPILES; j++) if (s.tab[j].length === 0) { firstEmpty = j; break; }
    const tabTo = (c: L.Card, skip: number): number[] => {
      const res: number[] = [];
      for (let j = 0; j < L.NPILES; j++) {
        if (j === skip) continue;
        if (s.tab[j].length === 0) { if (j === firstEmpty && L.rankOf(c) === 12) res.push(j); } else if (L.canPlace(c, tops(j))) res.push(j);
      }
      return res;
    };
    // 1. whole face-up runs that turn a card over or empty a pile
    for (let i = 0; i < L.NPILES; i++) {
      const up = L.upCount(s, i);
      if (!up) continue;
      const first = s.tab[i][s.tab[i].length - up];
      for (const j of tabTo(first, i)) {
        if (s.down[i] === 0 && s.tab[j].length === 0) continue;   // a King that already sits at the bottom
        cands.push([{ k: "move", from: { t: "tab", i }, to: { t: "tab", i: j }, n: up }]);
      }
    }
    // 2. foundation moves from the piles
    for (let i = 0; i < L.NPILES; i++) {
      if (!L.upCount(s, i)) continue;
      const c = tops(i);
      if (L.canFound(s, c)) cands.push([{ k: "move", from: { t: "tab", i }, to: { t: "found", i: L.suitOf(c) }, n: 1 }]);
    }
    // 3. waste cards reachable by drawing (each distinct top card once)
    {
      const t = L.clone(s);
      const tryTop = (draws: number): void => {
        if (!t.waste.length) return;
        const c = t.waste[t.waste.length - 1];
        const mv: L.Move[] = [];
        for (let d = 0; d < draws; d++) mv.push({ k: "draw" });
        if (L.canFound(t, c)) cands.push([...mv, { k: "move", from: { t: "waste" }, to: { t: "found", i: L.suitOf(c) }, n: 1 }]);
        for (const j of tabTo(c, -1)) cands.push([...mv, { k: "move", from: { t: "waste" }, to: { t: "tab", i: j }, n: 1 }]);
      };
      tryTop(0);
      const seenTop = new Set<string>();
      for (let d = 1; d <= 120; d++) {
        if (!t.stock.length && !t.waste.length) break;
        L.applyIn(t, { k: "draw" });
        const sk = t.stock.join(",") + "|" + t.waste.join(",");
        if (seenTop.has(sk)) break;
        seenTop.add(sk);
        tryTop(d);
      }
    }
    // 4. a partial run that frees the card under it for the foundation
    for (let i = 0; i < L.NPILES; i++) {
      const up = L.upCount(s, i);
      for (let n = 1; n < up; n++) {
        const under = s.tab[i][s.tab[i].length - n - 1];
        if (!L.canFound(s, under)) continue;
        const first = s.tab[i][s.tab[i].length - n];
        for (const j of tabTo(first, i)) cands.push([{ k: "move", from: { t: "tab", i }, to: { t: "tab", i: j }, n }]);
      }
    }
    // 5. a foundation card back onto a pile that then lets a face-down card turn (rare, last)
    for (let su = 0; su < 4; su++) {
      const fc = L.foundCard(s, su);
      if (fc < 0 || L.rankOf(fc) < 2) continue;
      for (const j of tabTo(fc, -1)) if (s.tab[j].length) cands.push([{ k: "move", from: { t: "found", i: su }, to: { t: "tab", i: j }, n: 1 }]);
    }

    const base = path.length;
    path.push(...forced);
    for (const seq of cands) {
      const t = L.clone(s);
      let okAll = true;
      for (const m of seq) if (!L.applyIn(t, m)) { okAll = false; break; }
      if (!okAll) continue;
      path.push(...seq);
      if (dfs(t)) return true;
      path.length -= seq.length;
      if (cut) break;
    }
    path.length = base;
    return false;
  };

  const ok = dfs(start);
  return { moves: ok ? path.slice() : null, nodes, exhausted: !ok && !cut };
}

/** replays moves on a copy of the start; the final state (null when a move was illegal) */
export function replay(start: L.State, moves: L.Move[]): L.State | null {
  let s = L.clone(start);
  for (const m of moves) { const n = L.apply(s, m); if (!n) return null; s = n; }
  return s;
}
