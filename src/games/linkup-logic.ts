/**
 * Link-up (连连看): the pure rules. A board is (rows + 2) x (cols + 2) cells: the playing field plus an empty ring round it, so a path may go
 * round the outside. 0 = empty, 1.. = a picture kind. Two identical tiles are linked by a path of horizontal / vertical segments through empty
 * cells with at most two turns. No DOM in this file.
 */
export interface Pt { r: number; c: number }
export interface Board { rows: number; cols: number; g: number[][] }
export interface Move { a: Pt; b: Pt; path: Pt[] }
export interface Diff { id: "easy" | "normal" | "hard"; cols: number; rows: number; kinds: number }

/** portrait sizes (columns x rows); a landscape game swaps them */
export const DIFFS: Diff[] = [
  { id: "easy", cols: 6, rows: 8, kinds: 12 },
  { id: "normal", cols: 8, rows: 10, kinds: 20 },
  { id: "hard", cols: 10, rows: 12, kinds: 28 },
];
export const MAX_TURNS = 2;
export const MS_PER_TILE = 1600;
export const MAX_HINTS = 5;
export const MAX_SHUFFLES = 3;
export const COMBO_WINDOW_MS = 4000;

export type Rng = () => number;
export const mulberry = (seed: number): Rng => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export const inField = (b: Board, p: Pt) => p.r >= 1 && p.r <= b.rows && p.c >= 1 && p.c <= b.cols;
export const kindAt = (b: Board, p: Pt) => b.g[p.r]?.[p.c] ?? 0;
export function remaining(b: Board): number { let n = 0; for (let r = 1; r <= b.rows; r++) for (let c = 1; c <= b.cols; c++) if (b.g[r][c]) n++; return n; }
export function tiles(b: Board): Pt[] { const o: Pt[] = []; for (let r = 1; r <= b.rows; r++) for (let c = 1; c <= b.cols; c++) if (b.g[r][c]) o.push({ r, c }); return o; }
export const cloneBoard = (b: Board): Board => ({ rows: b.rows, cols: b.cols, g: b.g.map((row) => row.slice()) });
export const totalMs = (rows: number, cols: number) => rows * cols * MS_PER_TILE;

function shuffleArray<T>(a: T[], rng: Rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

/** the tiles of a new board: pairs, spread over the kinds as evenly as possible */
export function kindList(rows: number, cols: number, kinds: number, rng: Rng): number[] {
  const pairs = (rows * cols) / 2;
  const list: number[] = [];
  const order = shuffleArray(Array.from({ length: kinds }, (_, i) => i + 1), rng);
  for (let i = 0; i < pairs; i++) { const k = order[i % kinds]; list.push(k, k); }
  return list;
}

const empty = (rows: number, cols: number): Board => ({ rows, cols, g: Array.from({ length: rows + 2 }, () => new Array(cols + 2).fill(0)) });

/** a new board that has at least one move at the start (reshuffled until it has) */
export function makeBoard(rows: number, cols: number, kinds: number, rng: Rng = Math.random): Board {
  if ((rows * cols) % 2) throw new Error("odd number of cells");
  const list = kindList(rows, cols, kinds, rng);
  const b = empty(rows, cols);
  for (let attempt = 0; attempt < 200; attempt++) {
    shuffleArray(list, rng);
    let i = 0;
    for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) b.g[r][c] = list[i++];
    if (hasMove(b)) return b;
  }
  forceMove(b);
  return b;
}

const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];

/**
 * A path from a to c with at most 2 turns through empty cells (the ring included): the list of corner points, a first and c last.
 * Search over (cell, direction) states by number of turns (0, then 1, then 2).
 */
export function findPath(b: Board, a: Pt, c: Pt): Pt[] | null {
  if (a.r === c.r && a.c === c.c) return null;
  const H = b.rows + 2, W = b.cols + 2;
  const S = (r: number, cc: number, d: number) => (r * W + cc) * 4 + d;
  const best = new Int8Array(H * W * 4).fill(127);
  const par = new Int32Array(H * W * 4).fill(-1);
  const levels: number[][] = [[], [], []];
  for (let d = 0; d < 4; d++) { const s = S(a.r, a.c, d); best[s] = 0; levels[0].push(s); }
  let endPrev = -1, endT = 99;
  for (let t = 0; t <= MAX_TURNS; t++) {
    const q = levels[t];
    for (let qi = 0; qi < q.length; qi++) {
      const s = q[qi];
      if (best[s] !== t) continue;
      const d = s & 3, cell = s >> 2, r = (cell / W) | 0, cc = cell % W;
      for (let nd = 0; nd < 4; nd++) {
        const nt = t + (nd !== d ? 1 : 0);
        if (nt > MAX_TURNS) continue;
        if (nd === ((d + 2) & 3)) continue; // never straight back
        const nr = r + DR[nd], nc = cc + DC[nd];
        if (nr < 0 || nc < 0 || nr >= H || nc >= W) continue;
        if (nr === c.r && nc === c.c) { if (nt < endT) { endT = nt; endPrev = s; } continue; }
        if (b.g[nr][nc] !== 0) continue;
        const ns = S(nr, nc, nd);
        if (best[ns] <= nt) continue;
        best[ns] = nt; par[ns] = s; levels[nt].push(ns);
      }
    }
    if (endPrev >= 0 && endT <= t + 1) break;   // nothing with fewer turns can still turn up
  }
  if (endPrev < 0) return null;
  const cells: Pt[] = [{ r: c.r, c: c.c }];
  for (let s = endPrev; s >= 0; s = par[s]) { const cell = s >> 2; cells.push({ r: (cell / W) | 0, c: cell % W }); }
  cells.reverse();
  const out: Pt[] = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const p = cells[i - 1], q = cells[i], n = cells[i + 1];
    if ((q.r - p.r) !== (n.r - q.r) || (q.c - p.c) !== (n.c - q.c)) out.push(q);
  }
  out.push(cells[cells.length - 1]);
  return out;
}

export const turnsOf = (path: Pt[]) => Math.max(0, path.length - 2);

/** two different tiles of the same kind that a path joins */
export function canLink(b: Board, a: Pt, c: Pt): Pt[] | null {
  const k = kindAt(b, a);
  if (!k || k !== kindAt(b, c) || !inField(b, a) || !inField(b, c)) return null;
  return findPath(b, a, c);
}

/** every pair that can be removed now (or only the first one) */
export function allMoves(b: Board, firstOnly = false): Move[] {
  const byKind = new Map<number, Pt[]>();
  for (const p of tiles(b)) { const k = kindAt(b, p); (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(p); }
  const out: Move[] = [];
  for (const list of byKind.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const path = findPath(b, list[i], list[j]);
      if (path) { out.push({ a: list[i], b: list[j], path }); if (firstOnly) return out; }
    }
  }
  return out;
}
export const hasMove = (b: Board) => allMoves(b, true).length > 0;
/** a random move, for the hint */
export function pickMove(b: Board, rng: Rng = Math.random): Move | null { const m = allMoves(b); return m.length ? m[Math.floor(rng() * m.length)] : null; }

/** take two tiles away; false when they cannot be linked */
export function removePair(b: Board, a: Pt, c: Pt): boolean {
  if (!canLink(b, a, c)) return false;
  b.g[a.r][a.c] = 0; b.g[c.r][c.c] = 0;
  return true;
}

/** put the kinds of two tiles side by side so that there is a move (last resort of the shuffle) */
function forceMove(b: Board): boolean {
  const ts = tiles(b);
  const byKind = new Map<number, Pt[]>();
  for (const p of ts) { const k = kindAt(b, p); (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(p); }
  for (const list of byKind.values()) {
    if (list.length < 2) continue;
    const [p, q] = list;
    // the neighbour cell of p that holds a tile: swap q's kind into it
    for (let d = 0; d < 4; d++) {
      const n = { r: p.r + DR[d], c: p.c + DC[d] };
      if (!inField(b, n) || !b.g[n.r][n.c] || (n.r === q.r && n.c === q.c)) continue;
      [b.g[n.r][n.c], b.g[q.r][q.c]] = [b.g[q.r][q.c], b.g[n.r][n.c]];
      return true;
    }
  }
  return hasMove(b);
}

/** mix the tiles that are left; the result always has a move (when the tiles allow one); returns false when it could not be done */
export function shuffle(b: Board, rng: Rng = Math.random): boolean {
  const ts = tiles(b);
  if (ts.length < 2) return true;
  const kinds = ts.map((p) => kindAt(b, p));
  for (let attempt = 0; attempt < 300; attempt++) {
    shuffleArray(kinds, rng);
    ts.forEach((p, i) => { b.g[p.r][p.c] = kinds[i]; });
    if (hasMove(b)) return true;
  }
  return forceMove(b);
}

export type Status = "won" | "stuck" | "playing";
export function status(b: Board): Status { const n = remaining(b); return n === 0 ? "won" : hasMove(b) ? "playing" : "stuck"; }

/** combo: a match within COMBO_WINDOW_MS of the one before continues the chain */
export function nextCombo(prev: number, sinceLastMs: number | null): number { return prev > 0 && sinceLastMs !== null && sinceLastMs <= COMBO_WINDOW_MS ? prev + 1 : 1; }
export const pairScore = (combo: number) => 10 + 5 * Math.min(Math.max(combo, 1) - 1, 10);
/** seconds added to the clock for a quick chain */
export const timeBonusSec = (combo: number) => (combo >= 2 ? Math.min(3, combo - 1) : 0);
export const finishBonus = (remMs: number) => Math.floor(remMs / 1000) * 2;
