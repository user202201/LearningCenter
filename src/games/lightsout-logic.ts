/**
 * Lights Out: the pure rules. A board is an array of n*n numbers (1 = lamp lit, 0 = off). Pressing a lamp flips it and its four neighbours (edges have fewer).
 * The solver works over GF(2): the press matrix A (A[i][j] = 1 when pressing j flips i) is solved with Gaussian elimination; the solutions of A x = s are one
 * particular solution plus any vector of the null space, so the MINIMAL solution is found by trying every vector of the null space (2^d, d is 0 .. 4 for 3x3 .. 7x7).
 * Every puzzle is made by pressing random lamps from the all-off board, so it is always solvable.
 */
export const SIZES = [3, 4, 5, 6, 7];
export type Level = 0 | 1 | 2;   // easy, normal, hard
export type Board = number[];

export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const emptyBoard = (n: number): Board => new Array(n * n).fill(0);
export const isSolved = (b: Board): boolean => b.every((v) => v === 0);
export const countLit = (b: Board): number => b.reduce((a, v) => a + v, 0);
export const key = (b: Board): string => b.join("");

/** the cells that a press on i flips: i itself and the neighbours up / down / left / right */
export function affected(n: number, i: number): number[] {
  const r = Math.floor(i / n), c = i % n, out = [i];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
}
export function press(n: number, b: Board, i: number): Board {
  const out = b.slice();
  for (const j of affected(n, i)) out[j] ^= 1;
  return out;
}
export function pressAll(n: number, b: Board, cells: number[]): Board {
  let out = b;
  for (const i of cells) out = press(n, out, i);
  return out;
}

// ---------- GF(2) ----------
const colMask = (n: number, i: number): bigint => { let m = 0n; for (const j of affected(n, i)) m |= 1n << BigInt(j); return m; };   // symmetric: also the row of the matrix
interface Reduced { rows: bigint[]; pivots: number[]; rank: number }
function reduce(n: number, aug: Board | null): Reduced {
  const N = n * n, rows: bigint[] = [];
  for (let i = 0; i < N; i++) rows.push(colMask(n, i) | (aug && aug[i] ? 1n << BigInt(N) : 0n));
  const pivots: number[] = []; let rank = 0;
  for (let c = 0; c < N && rank < N; c++) {
    let p = -1;
    for (let r = rank; r < N; r++) if ((rows[r] >> BigInt(c)) & 1n) { p = r; break; }
    if (p < 0) continue;
    [rows[p], rows[rank]] = [rows[rank], rows[p]];
    for (let r = 0; r < N; r++) if (r !== rank && ((rows[r] >> BigInt(c)) & 1n)) rows[r] ^= rows[rank];
    pivots.push(c); rank++;
  }
  return { rows, pivots, rank };
}
const nullCache = new Map<number, bigint[]>();
/** a basis of the null space: the press sets that change nothing */
export function nullBasis(n: number): bigint[] {
  const hit = nullCache.get(n); if (hit) return hit;
  const N = n * n, red = reduce(n, null), isPivot = new Set(red.pivots), basis: bigint[] = [];
  for (let f = 0; f < N; f++) {
    if (isPivot.has(f)) continue;
    let v = 1n << BigInt(f);
    red.pivots.forEach((pc, k) => { if ((red.rows[k] >> BigInt(f)) & 1n) v |= 1n << BigInt(pc); });
    basis.push(v);
  }
  nullCache.set(n, basis); return basis;
}
export const rankOf = (n: number): number => reduce(n, null).rank;
export const nullity = (n: number): number => n * n - rankOf(n);

function pop(x: bigint): number {
  let c = 0, lo = Number(x & 0xffffffffn), hi = Number(x >> 32n);
  while (lo) { lo &= lo - 1; c++; }
  while (hi) { hi &= hi - 1; c++; }
  return c;
}
const ctz = (g: number): number => { let k = 0; while (!(g & 1)) { g >>>= 1; k++; } return k; };

/** one particular solution as a bit mask, or null when the board cannot be solved */
function particular(n: number, b: Board): bigint | null {
  const N = n * n, red = reduce(n, b), top = 1n << BigInt(N);
  for (let r = red.rank; r < N; r++) if (red.rows[r] & top) return null;
  let x = 0n;
  red.pivots.forEach((pc, k) => { if (red.rows[k] & top) x |= 1n << BigInt(pc); });
  return x;
}
export const isSolvable = (n: number, b: Board): boolean => particular(n, b) !== null;

/** the minimal solution (the fewest presses, in reading order) or null when unsolvable; every solution is a particular one plus a null-space vector */
export function solve(n: number, b: Board): number[] | null {
  const x0 = particular(n, b);
  if (x0 === null) return null;
  const basis = nullBasis(n), d = basis.length;
  if (d > 16) throw new Error("null space too large");
  let cur = x0, best = x0, bestN = pop(x0);
  for (let g = 1; g < 1 << d; g++) {
    cur ^= basis[ctz(g)];
    const c = pop(cur);
    if (c < bestN) { bestN = c; best = cur; }
  }
  const out: number[] = [];
  for (let i = 0; i < n * n; i++) if ((best >> BigInt(i)) & 1n) out.push(i);
  return out;
}
export const minPresses = (n: number, b: Board): number => { const s = solve(n, b); return s ? s.length : -1; };
/** a lamp that belongs to a minimal solution of the CURRENT board (-1 when solved or unsolvable); pressing it lowers the minimum by exactly one */
export function hint(n: number, b: Board): number {
  const s = solve(n, b);
  return s && s.length ? s[0] : -1;
}

// ---------- puzzles ----------
const LEVEL_EASY: Level = 0, LEVEL_NORMAL: Level = 1;
/** the minimum number of presses a puzzle of this size and level must need */
export function rangeFor(n: number, level: Level): [number, number] {
  const N = n * n;
  if (level === LEVEL_EASY) return [3, 6];
  const t = N <= 9 ? 5 : Math.round(N / 3);
  if (level === LEVEL_NORMAL) return [Math.max(3, t - 2), t + 2];
  return [HARD_MIN[n] ?? 6, N];
}
/** the hard puzzles need at least this many presses (measured: the hardest of 40 random boards always reaches it; the largest minimum that exists is 9, 8, 15, about 30, about 38) */
export const HARD_MIN: Record<number, number> = { 3: 6, 4: 6, 5: 11, 6: 19, 7: 26 };

function scramble(n: number, level: Level, rng: () => number): Board {
  const N = n * n, cells = Array.from({ length: N }, (_, i) => i);
  if (level === 2) {   // a uniformly random reachable board: each lamp pressed with probability 1/2
    let b = emptyBoard(n);
    for (let i = 0; i < N; i++) if (rng() < 0.5) b = press(n, b, i);
    return b;
  }
  const t = N <= 9 ? 5 : Math.round(N / 3);
  const k = level === 0 ? 3 + Math.floor(rng() * 4) : Math.max(3, t - 2 + Math.floor(rng() * 5));
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cells[i], cells[j]] = [cells[j], cells[i]]; }
  return pressAll(n, emptyBoard(n), cells.slice(0, Math.min(k, N)));
}
export interface Puzzle { n: number; level: Level; cells: Board; min: number }
/** a new puzzle, never already solved, solvable, with a minimal solution inside `rangeFor`; never `avoid` (the one before) */
export function generate(n: number, level: Level, rng: () => number, avoid?: string): Puzzle {
  const [lo, hi] = rangeFor(n, level);
  let bestP: Puzzle | null = null;
  for (let attempt = 0; attempt < 600; attempt++) {
    let cand: Puzzle | null = null;
    const tries = level === 2 ? 40 : 1;   // hard: the hardest of 40 random boards
    for (let q = 0; q < tries; q++) {
      const cells = scramble(n, level, rng);
      if (isSolved(cells) || key(cells) === avoid) continue;
      const m = minPresses(n, cells);
      if (m < 0) continue;
      if (!cand || m > cand.min) cand = { n, level, cells, min: m };
    }
    if (!cand) continue;
    if (!bestP || Math.abs(cand.min - (lo + hi) / 2) < Math.abs(bestP.min - (lo + hi) / 2)) bestP = cand;
    if (cand.min >= lo && cand.min <= hi) return cand;
  }
  if (bestP) return bestP;
  throw new Error("no puzzle");
}

export const stars = (presses: number, min: number): 1 | 2 | 3 => (presses <= min ? 3 : presses <= min * 1.5 ? 2 : 1);
