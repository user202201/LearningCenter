/**
 * Gomoku (五子棋), pure rules and the computer player: no DOM.
 * 15 x 15, black = 1, white = 2. Free-style rules: five OR MORE in a row (also six, seven ...) wins.
 * The computer scores every empty cell near stones by the line patterns it would make (its own attack, and the opponent's attack it takes away) in the four directions.
 * easy: sometimes misses a win / a block, plays from the best few cells, now and then a plain random one. normal: always wins in one, always stops a five,
 * best pattern score. hard: also looks for a win by a chain of fours (VCF), keeps the opponent from getting two five-threats at once (open four, double four),
 * and picks among the best cells by a 2-ply look at the opponent's best answer.
 */
export const N = 15;
export type Stone = 0 | 1 | 2;
export type Board = Int8Array;
export type Level = "easy" | "normal" | "hard";
export const newBoard = (): Board => new Int8Array(N * N);
export const idx = (x: number, y: number) => y * N + x;
export const xy = (i: number): [number, number] => [i % N, (i / N) | 0];
export const other = (p: Stone): Stone => (p === 1 ? 2 : 1);
const DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [1, -1]];
const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N;

/** the run of 5 or more stones that contains the stone at i (cells in line order), or null */
export function winLine(b: Board, i: number): number[] | null {
  const p = b[i];
  if (!p) return null;
  const [x, y] = xy(i);
  for (const [dx, dy] of DIRS) {
    const cells = [i];
    for (let k = 1; ; k++) { const nx = x + dx * k, ny = y + dy * k; if (!inside(nx, ny) || b[idx(nx, ny)] !== p) break; cells.push(idx(nx, ny)); }
    for (let k = 1; ; k++) { const nx = x - dx * k, ny = y - dy * k; if (!inside(nx, ny) || b[idx(nx, ny)] !== p) break; cells.unshift(idx(nx, ny)); }
    if (cells.length >= 5) return cells;
  }
  return null;
}
export const isFull = (b: Board) => { for (let i = 0; i < N * N; i++) if (!b[i]) return false; return true; };
export const stones = (b: Board) => { let n = 0; for (let i = 0; i < N * N; i++) if (b[i]) n++; return n; };
/** the empty cells within `d` cells of a stone (the middle one when the board is empty) */
export function candidates(b: Board, d = 2): number[] {
  const near = new Uint8Array(N * N);
  let any = false;
  for (let i = 0; i < N * N; i++) if (b[i]) {
    any = true; const [x, y] = xy(i);
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) { const nx = x + dx, ny = y + dy; if (inside(nx, ny)) near[idx(nx, ny)] = 1; }
  }
  if (!any) return [idx(7, 7)];
  const out: number[] = [];
  for (let i = 0; i < N * N; i++) if (near[i] && !b[i]) out.push(i);
  return out;
}

/* ---------- patterns ---------- */
const T_FIVE = 100000, T_OPEN4 = 12000, T_FOUR = 2600, T_OPEN3 = 2200, T_THREE = 500, T_OPEN2 = 400, T_TWO = 60, T_ONE = 4;
/** what the line through (x, y) is worth for p if p stood there (the cell itself is treated as p's) */
function lineTier(b: Board, x: number, y: number, dx: number, dy: number, p: Stone): number {
  const s: string[] = [];
  for (let k = -4; k <= 4; k++) {
    const nx = x + dx * k, ny = y + dy * k;
    s.push(!inside(nx, ny) ? "O" : k === 0 ? "X" : b[idx(nx, ny)] === p ? "X" : b[idx(nx, ny)] === 0 ? "." : "O");
  }
  const str = s.join("");
  let run = 1;
  for (let k = 5; k < 9 && s[k] === "X"; k++) run++;
  for (let k = 3; k >= 0 && s[k] === "X"; k--) run++;
  if (run >= 5) return T_FIVE;
  let best = T_ONE, four = false;
  for (let a = 0; a <= 4; a++) {                       // the windows of five that contain the middle cell (index 4)
    const w = str.substr(a, 5);
    if (w.includes("O")) continue;
    const c = (w.match(/X/g) ?? []).length;
    if (c === 4) four = true; else if (c === 3) best = Math.max(best, T_THREE); else if (c === 2) best = Math.max(best, T_TWO);
  }
  for (let a = 0; a <= 3; a++) {                       // the windows of six (all contain index 4)
    const w = str.substr(a, 6);
    if (w === ".XXXX.") return T_OPEN4;
    if (w === "..XXX." || w === ".XXX.." || w === ".XX.X." || w === ".X.XX.") best = Math.max(best, T_OPEN3);
    if (w === "..XX.." || w === ".X.X.." || w === "..X.X.") best = Math.max(best, T_OPEN2);
  }
  return four ? Math.max(best, T_FOUR) : best;
}
/** the value of putting p on empty cell i: the sum of the four lines plus a bonus for double threats */
function cellValue(b: Board, i: number, p: Stone): number {
  const [x, y] = xy(i);
  let sum = 0, fours = 0, threes = 0;
  for (const [dx, dy] of DIRS) {
    const t = lineTier(b, x, y, dx, dy, p);
    if (t >= T_FIVE) return T_FIVE * 2;
    sum += t;
    if (t === T_OPEN4 || t === T_FOUR) fours++; else if (t === T_OPEN3) threes++;
  }
  if (fours >= 2) sum += 9000; else if (fours >= 1 && threes >= 1) sum += 7000; else if (threes >= 2) sum += 4000;
  return sum;
}
/** does p win by playing on empty cell i? */
export function makesFive(b: Board, i: number, p: Stone): boolean {
  const [x, y] = xy(i);
  for (const [dx, dy] of DIRS) {
    let run = 1;
    for (let k = 1; k < 5; k++) { const nx = x + dx * k, ny = y + dy * k; if (!inside(nx, ny) || b[idx(nx, ny)] !== p) break; run++; }
    for (let k = 1; k < 5; k++) { const nx = x - dx * k, ny = y - dy * k; if (!inside(nx, ny) || b[idx(nx, ny)] !== p) break; run++; }
    if (run >= 5) return true;
  }
  return false;
}
/** every empty cell where p would complete five (a "four" of p has one, an open four has two) */
export function winningCells(b: Board, p: Stone, cells = candidates(b)): number[] { return cells.filter((c) => !b[c] && makesFive(b, c, p)); }
/** the winning cells that the stone p, just put on i, has made, looking along its four lines only */
function newWinCells(b: Board, i: number, p: Stone): number[] {
  const [x, y] = xy(i), out = new Set<number>();
  for (const [dx, dy] of DIRS) for (let k = -4; k <= 4; k++) {
    if (!k) continue;
    const nx = x + dx * k, ny = y + dy * k;
    if (inside(nx, ny) && !b[idx(nx, ny)] && makesFive(b, idx(nx, ny), p)) out.add(idx(nx, ny));
  }
  return [...out];
}
/** can p (to move) win by a chain of fours, each of which has only one answer? returns the first move of such a chain, or -1 */
export function vcf(b: Board, p: Stone, depth = 8, budget = { n: 30000 }): number {
  if (depth <= 0 || budget.n-- <= 0) return -1;
  const o = other(p), cells = candidates(b);
  if (winningCells(b, o, cells).length) return -1;
  const now = winningCells(b, p, cells);
  if (now.length) return now[0];
  for (const c of cells) {
    b[c] = p;
    const w = newWinCells(b, c, p);
    let res = -1;
    if (w.length >= 2) res = c;
    else if (w.length === 1) {
      b[w[0]] = o;
      if (!winLine(b, w[0]) && vcf(b, p, depth - 1, budget) >= 0) res = c;
      b[w[0]] = 0;
    }
    b[c] = 0;
    if (res >= 0) return res;
  }
  return -1;
}
/** the cells where p would get two five-threats at once (an open four, a double four) */
const doubleThreatCells = (b: Board, p: Stone, cells = candidates(b)): number[] => {
  const out: number[] = [];
  for (const c of cells) { if (b[c]) continue; b[c] = p; if (newWinCells(b, c, p).length >= 2) out.push(c); b[c] = 0; }
  return out;
};

export type Rnd = () => number;
/** the move of the computer: an empty cell. `rnd` can be injected so that tests are repeatable. */
export function chooseMove(b: Board, me: Stone, level: Level, rnd: Rnd = Math.random): number {
  if (stones(b) === 0) return idx(7, 7);
  const cells = candidates(b);
  if (stones(b) === 1) {                                              // the first answer: next to the stone, a little at random
    const c = cells.filter((i) => { const [x, y] = xy(i); return Math.abs(x - 7) <= 1 && Math.abs(y - 7) <= 1; });
    const near = c.length ? c : cells;
    return near[Math.floor(rnd() * near.length)];
  }
  const opp = other(me);
  const mine = winningCells(b, me, cells), theirs = winningCells(b, opp, cells);
  const pWin = level === "easy" ? 0.85 : 1, pBlock = level === "easy" ? 0.75 : 1;
  if (mine.length && rnd() < pWin) return mine[0];
  if (theirs.length && rnd() < pBlock) return theirs[0];
  const wAtt = level === "easy" ? 0.8 : level === "hard" ? 1.1 : 1, wDef = level === "easy" ? 0.5 : level === "normal" ? 0.9 : 0.85;
  const scored = cells.map((c) => ({ c, v: cellValue(b, c, me) * wAtt + cellValue(b, c, opp) * wDef })).sort((a, d) => d.v - a.v);
  if (level === "easy") {
    if (rnd() < 0.12) return cells[Math.floor(rnd() * cells.length)];
    const top = scored.slice(0, 4);
    return top[Math.min(top.length - 1, Math.floor(rnd() * top.length))].c;
  }
  if (level === "normal") {
    const best = scored[0].v, near = scored.filter((s) => s.v >= best * 0.97);
    return near[Math.min(near.length - 1, Math.floor(rnd() * near.length))].c;
  }
  // hard
  const v = vcf(b, me, 8);
  if (v >= 0 && !b[v]) return v;
  const danger = doubleThreatCells(b, opp, cells).length > 0;
  const top = scored.slice(0, 12);
  let bestC = top[0].c, bestV = -Infinity;
  for (const s of top) {
    b[s.c] = me;
    let val = s.v;
    if (winLine(b, s.c)) val = 1e9;
    else {
      const oc = candidates(b);
      if (winningCells(b, opp, oc).length) val -= 1e7;                                       // that would leave a five for the opponent
      else {
        let oBest = 0;
        for (const c of oc) { const ov = cellValue(b, c, opp) * 0.9 + cellValue(b, c, me) * 0.6; if (ov > oBest) oBest = ov; }
        val -= oBest * 0.55;
        const dt = doubleThreatCells(b, opp, oc).length;
        if (dt) val -= 5e5 * Math.min(2, dt);                                                 // the opponent would get an open four / double four
        else if (danger) val += 1e5;                                                          // ... and this move has taken that away
        if (vcf(b, opp, 6, { n: 4000 }) >= 0) val -= 5e6;                                     // the opponent would win by a chain of fours
      }
    }
    b[s.c] = 0;
    if (val > bestV) { bestV = val; bestC = s.c; }
  }
  return bestC;
}
