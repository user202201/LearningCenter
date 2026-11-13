/** Sudoku rules: pure functions, no DOM. Sizes 4x4 (2x2 boxes), 6x6 (2 rows x 3 columns boxes), 9x9 (3x3 boxes). Cells are numbered row by row; 0 = empty. */
export type Size = 4 | 6 | 9;
export type Diff = "easy" | "normal" | "hard";
export interface Spec { n: Size; br: number; bc: number }
export const SPECS: Record<Size, Spec> = { 4: { n: 4, br: 2, bc: 2 }, 6: { n: 6, br: 2, bc: 3 }, 9: { n: 9, br: 3, bc: 3 } };
export const SIZES: Size[] = [4, 6, 9];
export const DIFFS: Diff[] = ["easy", "normal", "hard"];
/** the number of given cells aimed at (generation removes cells until it is reached or no more can go without a second solution) */
export const GIVENS: Record<Size, Record<Diff, number>> = {
  4: { easy: 11, normal: 9, hard: 7 },
  6: { easy: 24, normal: 19, hard: 15 },
  9: { easy: 38, normal: 32, hard: 27 },
};
export const MAX_HINTS = 3;
export type Rng = () => number;

/** small seeded generator (mulberry32) so that tests are reproducible */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const shuffle = <T,>(a: T[], rng: Rng): T[] => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const rowOf = (s: Spec, i: number) => Math.floor(i / s.n);
export const colOf = (s: Spec, i: number) => i % s.n;
export const boxOf = (s: Spec, i: number) => Math.floor(rowOf(s, i) / s.br) * (s.n / s.bc) + Math.floor(colOf(s, i) / s.bc);
export function peers(s: Spec, i: number): number[] {
  const out: number[] = [];
  for (let j = 0; j < s.n * s.n; j++) if (j !== i && (rowOf(s, j) === rowOf(s, i) || colOf(s, j) === colOf(s, i) || boxOf(s, j) === boxOf(s, i))) out.push(j);
  return out;
}

/** counts solutions of a (partial) grid up to `limit`; with `rng` the digits are tried in random order (used to make a full grid). first = the first solution found. */
export function search(s: Spec, grid: number[], limit: number, rng?: Rng): { count: number; first: number[] | null } {
  const n = s.n, g = grid.slice();
  const rows = new Array(n).fill(0), cols = new Array(n).fill(0), boxes = new Array(n).fill(0);
  for (let i = 0; i < g.length; i++) {
    const v = g[i]; if (!v) continue;
    const bit = 1 << v, r = rowOf(s, i), c = colOf(s, i), b = boxOf(s, i);
    if ((rows[r] | cols[c] | boxes[b]) & bit) return { count: 0, first: null };
    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
  }
  let count = 0, first: number[] | null = null;
  const full = ((1 << n) - 1) << 1;
  const rec = () => {
    let best = -1, bestMask = 0, bestN = 99;
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue;
      const m = full & ~(rows[rowOf(s, i)] | cols[colOf(s, i)] | boxes[boxOf(s, i)]);
      let k = 0; for (let x = m; x; x &= x - 1) k++;
      if (k < bestN) { best = i; bestMask = m; bestN = k; if (k <= 1) break; }
    }
    if (best < 0) { count++; if (!first) first = g.slice(); return; }
    if (bestN === 0) return;
    const ds: number[] = []; for (let d = 1; d <= n; d++) if (bestMask & (1 << d)) ds.push(d);
    if (rng) shuffle(ds, rng);
    const r = rowOf(s, best), c = colOf(s, best), b = boxOf(s, best);
    for (const d of ds) {
      const bit = 1 << d;
      g[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
      rec();
      g[best] = 0; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit;
      if (count >= limit) return;
    }
  };
  rec();
  return { count, first };
}
export const countSolutions = (s: Spec, grid: number[], limit = 2) => search(s, grid, limit).count;
export function solve(s: Spec, grid: number[]): number[] | null { return search(s, grid, 1).first; }
export function fullGrid(s: Spec, rng: Rng): number[] { return search(s, new Array(s.n * s.n).fill(0), 1, rng).first as number[]; }

export interface Puzzle { n: Size; diff: Diff; puzzle: number[]; solution: number[]; givens: number }
/** a new puzzle with exactly ONE solution: a random full grid, then cells are removed one by one, each removal checked by the solver */
export function generate(n: Size, diff: Diff, rng: Rng = Math.random): Puzzle {
  const s = SPECS[n], target = GIVENS[n][diff], total = n * n;
  let best: Puzzle | null = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    const solution = fullGrid(s, rng), puzzle = solution.slice();
    let givens = total;
    for (const i of shuffle(Array.from({ length: total }, (_, k) => k), rng)) {
      if (givens <= target) break;
      const v = puzzle[i]; puzzle[i] = 0;
      if (countSolutions(s, puzzle, 2) !== 1) puzzle[i] = v; else givens--;
    }
    if (!best || givens < best.givens) best = { n, diff, puzzle, solution, givens };
    if (givens <= target) break;
  }
  return best as Puzzle;
}

/** the cells that hold a digit which another cell of its row / column / box holds too */
export function conflicts(s: Spec, cells: number[]): Set<number> {
  const out = new Set<number>();
  for (let i = 0; i < cells.length; i++) {
    if (!cells[i]) continue;
    for (const j of peers(s, i)) if (cells[j] === cells[i]) { out.add(i); break; }
  }
  return out;
}
export const isSolved = (cells: number[], solution: number[]) => cells.every((v, i) => v === solution[i]);
/** how many of a digit are placed right (the digit is "done" on the pad when this is n) */
export const digitCount = (cells: number[], solution: number[], d: number) => cells.reduce((k, v, i) => k + (v === d && solution[i] === d ? 1 : 0), 0);

/** puts digit d into cell i (a given cell is never changed); notes of that digit in the peers go away. mistake = the digit is not the solution's. */
export function setDigit(s: Spec, cells: number[], notes: number[], solution: number[], given: number[], i: number, d: number): { cells: number[]; notes: number[]; mistake: boolean; changed: boolean } {
  if (given[i] || d < 1 || d > s.n) return { cells, notes, mistake: false, changed: false };
  const c = cells.slice(), nt = notes.slice();
  if (c[i] === d) { c[i] = 0; return { cells: c, notes: nt, mistake: false, changed: true };}   // the same digit again takes it out
  c[i] = d; nt[i] = 0;
  for (const j of peers(s, i)) nt[j] &= ~(1 << d);
  return { cells: c, notes: nt, mistake: solution[i] !== d, changed: true };
}
export function eraseCell(cells: number[], notes: number[], given: number[], i: number): { cells: number[]; notes: number[]; changed: boolean } {
  if (given[i] || (!cells[i] && !notes[i])) return { cells, notes, changed: false };
  const c = cells.slice(), nt = notes.slice(); c[i] = 0; nt[i] = 0; return { cells: c, notes: nt, changed: true };
}
/** pencil mark d in an empty cell (toggles) */
export function toggleNote(s: Spec, cells: number[], notes: number[], given: number[], i: number, d: number): { notes: number[]; changed: boolean } {
  if (given[i] || cells[i] || d < 1 || d > s.n) return { notes, changed: false };
  const nt = notes.slice(); nt[i] ^= 1 << d; return { notes: nt, changed: true };
}
export const noteList = (mask: number, n: number) => { const out: number[] = []; for (let d = 1; d <= n; d++) if (mask & (1 << d)) out.push(d); return out; };

/** the cell a hint fills: the selected one if it is not right yet, else a random cell that is empty or wrong; -1 when the grid is solved */
export function hintCell(cells: number[], solution: number[], sel: number, rng: Rng = Math.random): number {
  if (sel >= 0 && cells[sel] !== solution[sel]) return sel;
  const open = cells.map((v, i) => (v !== solution[i] ? i : -1)).filter((i) => i >= 0);
  return open.length ? open[Math.floor(rng() * open.length)] : -1;
}
/** 3 stars for a clean game, 2 for at most two helps / mistakes together, else 1 */
export function stars(hints: number, mistakes: number): number { const p = hints + mistakes; return p === 0 ? 3 : p <= 2 ? 2 : 1; }
export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
