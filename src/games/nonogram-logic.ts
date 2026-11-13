/**
 * Nonogram (数织): pure rules, no DOM. A puzzle is an n x n picture (1 = filled) with the run lengths of every row and column as clues.
 * Every puzzle is GENERATED: a structured random picture is accepted only when a line solver (constraint propagation over single lines,
 * no guessing) fills the whole grid, so the solution is unique and never needs a guess. Cells are numbered row by row.
 * Player cell states: 0 = empty, 1 = filled, 2 = cross.
 */
export type Size = 5 | 10 | 15;
export const SIZES: Size[] = [5, 10, 15];
export const MAX_HINTS = 3;
export type Rng = () => number;

/** small seeded generator (mulberry32) so that tests are reproducible */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** the run lengths of a line of 0 / 1 (only 1s count; a line without any filled cell has the clue []) */
export function lineClue(line: ArrayLike<number>): number[] {
  const out: number[] = []; let run = 0;
  for (let i = 0; i < line.length; i++) { if (line[i] === 1) run++; else if (run) { out.push(run); run = 0; } }
  if (run) out.push(run);
  return out;
}
export const sameClue = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

export interface Clues { rows: number[][]; cols: number[][] }
export function cluesOf(pic: ArrayLike<number>, n: number): Clues {
  const rows: number[][] = [], cols: number[][] = [];
  for (let r = 0; r < n; r++) rows.push(lineClue(Array.from({ length: n }, (_, c) => pic[r * n + c])));
  for (let c = 0; c < n; c++) cols.push(lineClue(Array.from({ length: n }, (_, r) => pic[r * n + c])));
  return { rows, cols };
}

/**
 * What a single line allows: `known` holds -1 (unknown), 0 (white) or 1 (black). Returns for every cell the value it must have in
 * EVERY arrangement of the clue that fits what is known (-1 when both are still possible), or null when no arrangement fits.
 */
export function solveLine(clue: number[], known: ArrayLike<number>): number[] | null {
  const n = known.length, k = clue.length;
  // memo[i * (k + 1) + j] = undefined (not computed) | null (impossible) | [blackMask, whiteMask] for the cells i..n-1 with blocks j..k-1 still to place
  const memo: (null | [number, number] | undefined)[] = new Array((n + 2) * (k + 1));
  const full = (from: number, to: number) => ((1 << to) - 1) & ~((1 << from) - 1);   // bits from..to-1
  const rec = (i: number, j: number): null | [number, number] => {
    const key = i * (k + 1) + j, got = memo[key];
    if (got !== undefined) return got;
    let res: null | [number, number];
    if (j === k) {
      let okRest = true;
      for (let x = i; x < n; x++) if (known[x] === 1) { okRest = false; break; }
      res = okRest ? [0, full(i, n)] : null;
    } else {
      let black = 0, white = 0, any = false;
      // enough room left for the blocks that remain?
      let need = -1; for (let q = j; q < k; q++) need += clue[q] + 1;
      if (i + need <= n) {
        // cell i is white
        if (known[i] !== 1) { const sub = rec(i + 1, j); if (sub) { any = true; black |= sub[0]; white |= sub[1] | (1 << i); } }
        // block j starts at i
        const len = clue[j]; let fits = i + len <= n;
        for (let x = i; fits && x < i + len; x++) if (known[x] === 0) fits = false;
        if (fits && i + len < n && known[i + len] === 1) fits = false;
        if (fits) {
          const sub = i + len < n ? rec(i + len + 1, j + 1) : (j + 1 === k ? [0, 0] as [number, number] : null);
          if (sub) { any = true; black |= sub[0] | full(i, i + len); white |= sub[1] | (i + len < n ? 1 << (i + len) : 0); }
        }
      }
      res = any ? [black, white] : null;
    }
    memo[key] = res; return res;
  };
  const top = rec(0, 0);
  if (!top) return null;
  const out: number[] = [];
  for (let x = 0; x < n; x++) { const b = (top[0] >> x) & 1, w = (top[1] >> x) & 1; out.push(b && w ? -1 : b ? 1 : 0); }
  return out;
}

export interface SolveResult { grid: number[]; solved: boolean; contradiction: boolean; passes: number }
/** solve with lines only (no guessing); grid values -1 / 0 / 1 */
export function lineSolve(clues: Clues, n: number): SolveResult {
  const g = new Array(n * n).fill(-1);
  const rowDirty = new Array(n).fill(true), colDirty = new Array(n).fill(true);
  let passes = 0, changed = true;
  while (changed) {
    changed = false; passes++;
    for (let r = 0; r < n; r++) {
      if (!rowDirty[r]) continue; rowDirty[r] = false;
      const known = Array.from({ length: n }, (_, c) => g[r * n + c]);
      const out = solveLine(clues.rows[r], known);
      if (!out) return { grid: g, solved: false, contradiction: true, passes };
      for (let c = 0; c < n; c++) if (known[c] === -1 && out[c] !== -1) { g[r * n + c] = out[c]; colDirty[c] = true; changed = true; }
    }
    for (let c = 0; c < n; c++) {
      if (!colDirty[c]) continue; colDirty[c] = false;
      const known = Array.from({ length: n }, (_, r) => g[r * n + c]);
      const out = solveLine(clues.cols[c], known);
      if (!out) return { grid: g, solved: false, contradiction: true, passes };
      for (let r = 0; r < n; r++) if (known[r] === -1 && out[r] !== -1) { g[r * n + c] = out[r]; rowDirty[r] = true; changed = true; }
    }
  }
  return { grid: g, solved: g.every((v) => v !== -1), contradiction: false, passes };
}

/** a structured random picture with a fill ratio of 45-65 % (mirror blobs, blocks, shapes) */
export function randomPicture(n: number, rng: Rng): number[] {
  const g = new Array(n * n).fill(0);
  const set = (r: number, c: number, v = 1) => { if (r >= 0 && c >= 0 && r < n && c < n) g[r * n + c] = v; };
  const mode = Math.floor(rng() * 4);
  const mirror = rng() < 0.55;
  if (mode === 0) {
    // a coarse random picture scaled up (blocks), a few cells flipped
    const k = n === 5 ? 5 : n === 10 ? (rng() < 0.5 ? 5 : 10) : (rng() < 0.5 ? 5 : 15);
    const s = n / k;
    const coarse = Array.from({ length: k * k }, () => (rng() < 0.55 ? 1 : 0));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g[r * n + c] = coarse[Math.floor(r / s) * k + Math.floor(c / s)];
    const flips = Math.floor(rng() * (n / 2));
    for (let i = 0; i < flips; i++) { const r = Math.floor(rng() * n), c = Math.floor(rng() * n); g[r * n + c] ^= 1; }
  } else if (mode === 1) {
    // a union of rectangles and ellipses
    const shapes = n === 5 ? 2 + Math.floor(rng() * 2) : 3 + Math.floor(rng() * 4);
    for (let s = 0; s < shapes; s++) {
      const w = 1 + Math.floor(rng() * (n * 0.55)), hh = 1 + Math.floor(rng() * (n * 0.55));
      const r0 = Math.floor(rng() * (n - hh + 1)), c0 = Math.floor(rng() * (n - w + 1));
      const ell = rng() < 0.45, val = rng() < 0.78 ? 1 : 0;
      for (let r = 0; r < hh; r++) for (let c = 0; c < w; c++) {
        if (ell) { const dx = (c + 0.5) / w * 2 - 1, dy = (r + 0.5) / hh * 2 - 1; if (dx * dx + dy * dy > 1.05) continue; }
        set(r0 + r, c0 + c, val);
      }
    }
  } else if (mode === 2) {
    // a random walk blob grown from the middle
    let r = Math.floor(n / 2), c = Math.floor(n / 2);
    const target = Math.round(n * n * (0.5 + rng() * 0.12));
    let have = 0, guard = 0;
    while (have < target && guard++ < n * n * 30) {
      if (!g[r * n + c]) { g[r * n + c] = 1; have++; }
      const d = Math.floor(rng() * 4);
      r = Math.max(0, Math.min(n - 1, r + (d === 0 ? 1 : d === 1 ? -1 : 0)));
      c = Math.max(0, Math.min(n - 1, c + (d === 2 ? 1 : d === 3 ? -1 : 0)));
      if (rng() < 0.04) { r = Math.floor(rng() * n); c = Math.floor(rng() * n); }
    }
  } else {
    // thick strokes: a few horizontal / vertical bars
    const bars = n === 5 ? 2 : 3 + Math.floor(rng() * 3);
    for (let b = 0; b < bars; b++) {
      const t = 1 + Math.floor(rng() * Math.max(1, n / 5)), pos = Math.floor(rng() * (n - t + 1)), a = Math.floor(rng() * n * 0.5), len = Math.floor(n * (0.4 + rng() * 0.6));
      const horiz = rng() < 0.5;
      for (let u = 0; u < t; u++) for (let v = a; v < Math.min(n, a + len); v++) horiz ? set(pos + u, v) : set(v, pos + u);
    }
  }
  if (mirror) for (let r = 0; r < n; r++) for (let c = 0; c < Math.floor(n / 2); c++) g[r * n + (n - 1 - c)] = g[r * n + c];
  return g;
}

export const fillOf = (pic: ArrayLike<number>) => { let k = 0; for (let i = 0; i < pic.length; i++) if (pic[i] === 1) k++; return k / pic.length; };

export interface Puzzle { n: number; pic: number[]; rows: number[][]; cols: number[][]; tries: number }
/** make a puzzle: random picture, accepted only when the line solver alone solves it completely (so the solution is unique) */
export function generate(n: number, seed: number): Puzzle {
  const rng = makeRng(seed);
  for (let tries = 1; ; tries++) {
    const pic = randomPicture(n, rng);
    const f = fillOf(pic);
    if (f < 0.45 || f > 0.65) continue;
    const cl = cluesOf(pic, n);
    if (cl.rows.some((x) => !x.length) || cl.cols.some((x) => !x.length)) continue;
    const res = lineSolve(cl, n);
    if (!res.solved) continue;
    return { n, pic, rows: cl.rows, cols: cl.cols, tries };
  }
}

/** cells of a line (rows then columns) in the current state: do the filled runs equal the clue? (crosses count as empty) */
export function lineRight(cells: ArrayLike<number>, n: number, kind: "row" | "col", idx: number, clue: number[]): boolean {
  const line = Array.from({ length: n }, (_, i) => (cells[kind === "row" ? idx * n + i : i * n + idx] === 1 ? 1 : 0));
  return sameClue(lineClue(line), clue);
}
/** the puzzle is solved when the filled cells are exactly the picture (crosses do not matter) */
export function isSolved(cells: ArrayLike<number>, pic: ArrayLike<number>): boolean {
  for (let i = 0; i < pic.length; i++) if ((cells[i] === 1 ? 1 : 0) !== pic[i]) return false;
  return true;
}
/** the cells that are wrong: filled where the picture is blank, or crossed where it is filled */
export function wrongCells(cells: ArrayLike<number>, pic: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < pic.length; i++) if ((cells[i] === 1 && pic[i] === 0) || (cells[i] === 2 && pic[i] === 1)) out.push(i);
  return out;
}

/** the next state of a cell when tapped: in fill mode empty -> fill -> cross -> empty; in cross mode empty -> cross, anything else -> empty */
export function nextState(cur: number, mode: "fill" | "cross"): number {
  if (mode === "fill") return cur === 0 ? 1 : cur === 1 ? 2 : 0;
  return cur === 2 ? 0 : 2;
}

/** a hint: the index of a cell that is not right yet (chosen at random) and the state it must have; null when nothing is wrong */
export function hintCell(cells: ArrayLike<number>, pic: ArrayLike<number>, locked: ArrayLike<number>, rng: Rng): { i: number; v: number } | null {
  const pool: number[] = [];
  for (let i = 0; i < pic.length; i++) if (!locked[i] && ((pic[i] === 1 && cells[i] !== 1) || (pic[i] === 0 && cells[i] === 1))) pool.push(i);
  if (!pool.length) return null;
  const i = pool[Math.floor(rng() * pool.length)];
  return { i, v: pic[i] === 1 ? 1 : 2 };
}

/** stars: 3 when neither a hint nor a check was used, 2 for one or two, else 1 */
export function stars(hints: number, checks: number): number { const u = hints + checks; return u === 0 ? 3 : u <= 2 ? 2 : 1; }
export function fmtTime(s: number): string { const m = Math.floor(s / 60), r = s % 60; return `${m}:${r < 10 ? "0" : ""}${r}`; }

/** the cells a stroke touches when the finger goes from one cell to another, kept on one row or column */
export function strokeCells(n: number, from: number, to: number, axis: "h" | "v" | null): number[] {
  const r0 = Math.floor(from / n), c0 = from % n, r1 = Math.floor(to / n), c1 = to % n;
  if (axis === "h") return span(c0, c1).map((c) => r0 * n + c);
  if (axis === "v") return span(r0, r1).map((r) => r * n + c0);
  return [to];
}
const span = (a: number, b: number) => { const out: number[] = []; const d = a <= b ? 1 : -1; for (let x = a; x !== b + d; x += d) out.push(x); return out; };
