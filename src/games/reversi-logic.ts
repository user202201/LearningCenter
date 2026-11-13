/** Reversi / Othello: the pure rules and the computer player (no DOM). Squares are indexes y * n + x; 0 empty, 1 black (moves first), 2 white. n = 8 (standard) or 6 (easy). */
export const EMPTY = 0, BLACK = 1, WHITE = 2;
export type Board = Int8Array;
export type Level = "easy" | "normal" | "hard";
export const other = (c: number) => 3 - c;

const DIRS = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
const RAYS = new Map<number, number[][][]>();
const NEIGH = new Map<number, number[][]>();
const WEIGHTS = new Map<number, number[]>();
/** per square: the (up to 8) lines of squares leaving it, nearest first */
export function rays(n: number): number[][][] {
  let r = RAYS.get(n);
  if (!r) {
    r = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const lines: number[][] = [];
      for (const [dx, dy] of DIRS) { const line: number[] = []; let a = x + dx, b = y + dy; while (a >= 0 && b >= 0 && a < n && b < n) { line.push(b * n + a); a += dx; b += dy; } if (line.length > 1) lines.push(line); }
      r.push(lines);
    }
    RAYS.set(n, r);
  }
  return r;
}
function neigh(n: number): number[][] {
  let r = NEIGH.get(n);
  if (!r) { r = []; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const l: number[] = []; for (const [dx, dy] of DIRS) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < n && b < n) l.push(b * n + a); } r.push(l); } NEIGH.set(n, r); }
  return r;
}
/** the positional table: corners are gold, the squares next to a corner are poison, edges are good */
export function weights(n: number): number[] {
  let w = WEIGHTS.get(n);
  if (!w) {
    w = [];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const dx = Math.min(x, n - 1 - x), dy = Math.min(y, n - 1 - y), lo = Math.min(dx, dy), hi = Math.max(dx, dy);
      w.push(lo === 0 && hi === 0 ? 100 : lo === 0 && hi === 1 ? -20 : lo === 1 && hi === 1 ? -40 : lo === 0 ? 8 : lo === 1 ? -4 : 2);
    }
    WEIGHTS.set(n, w);
  }
  return w;
}
export const corners = (n: number) => [0, n - 1, n * (n - 1), n * n - 1];

export function newBoard(n: number): Board {
  const b = new Int8Array(n * n), m = n / 2;
  b[(m - 1) * n + m - 1] = WHITE; b[m * n + m] = WHITE; b[(m - 1) * n + m] = BLACK; b[m * n + m - 1] = BLACK;
  return b;
}
/** the squares that a disc of colour c put on i would flip (empty when the move is illegal) */
export function flipsAt(b: Board, n: number, i: number, c: number): number[] {
  if (b[i] !== EMPTY) return [];
  const o = other(c), out: number[] = [];
  for (const line of rays(n)[i]) {
    let k = 0;
    while (k < line.length && b[line[k]] === o) k++;
    if (k > 0 && k < line.length && b[line[k]] === c) for (let j = 0; j < k; j++) out.push(line[j]);
  }
  return out;
}
export function isLegal(b: Board, n: number, i: number, c: number): boolean {
  if (b[i] !== EMPTY) return false;
  const o = other(c);
  for (const line of rays(n)[i]) {
    let k = 0;
    while (k < line.length && b[line[k]] === o) k++;
    if (k > 0 && k < line.length && b[line[k]] === c) return true;
  }
  return false;
}
export function legalMoves(b: Board, n: number, c: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < b.length; i++) if (b[i] === EMPTY && isLegal(b, n, i, c)) out.push(i);
  return out;
}
export function hasMove(b: Board, n: number, c: number): boolean {
  for (let i = 0; i < b.length; i++) if (b[i] === EMPTY && isLegal(b, n, i, c)) return true;
  return false;
}
/** puts the disc and flips (mutates); returns the flipped squares (empty and nothing done when illegal) */
export function applyMove(b: Board, n: number, i: number, c: number): number[] {
  const f = flipsAt(b, n, i, c);
  if (!f.length) return f;
  b[i] = c; for (const j of f) b[j] = c;
  return f;
}
export function undoMove(b: Board, i: number, c: number, flips: number[]) { b[i] = EMPTY; const o = other(c); for (const j of flips) b[j] = o; }
export function counts(b: Board) { let black = 0, white = 0; for (let i = 0; i < b.length; i++) { if (b[i] === BLACK) black++; else if (b[i] === WHITE) white++; } return { black, white, empty: b.length - black - white }; }
export const isOver = (b: Board, n: number) => !hasMove(b, n, BLACK) && !hasMove(b, n, WHITE);
/** who moves after `c` has just moved: the other side, or c again when the other side must pass, or 0 when the game is over */
export function nextToMove(b: Board, n: number, c: number): number { const o = other(c); return hasMove(b, n, o) ? o : hasMove(b, n, c) ? c : 0; }
/** 1 black, 2 white, 0 draw (the final count) */
export function winner(b: Board): number { const k = counts(b); return k.black > k.white ? BLACK : k.white > k.black ? WHITE : 0; }
/** the number of move sequences of the given length (a side that cannot move passes without using a ply) */
export function perft(b: Board, n: number, c: number, depth: number): number {
  if (depth === 0) return 1;
  const ms = legalMoves(b, n, c);
  if (!ms.length) return hasMove(b, n, other(c)) ? perft(b, n, other(c), depth) : 1;
  let t = 0;
  for (const m of ms) { const f = applyMove(b, n, m, c); t += perft(b, n, other(c), depth - 1); undoMove(b, m, c, f); }
  return t;
}

/* ---------------- the computer ---------------- */
export interface AiOpts { rng?: () => number; timeMs?: number; now?: () => number; maxDepth?: number }
export interface AiInfo { depth: number; nodes: number; ms: number }
export let lastInfo: AiInfo = { depth: 0, nodes: 0, ms: 0 };

/** a static evaluation for colour c; `full` adds the frontier / parity / late-disc terms of the hard level */
function evaluate(b: Board, n: number, c: number, full: boolean): number {
  const w = weights(n), nb = neigh(n), o = other(c);
  let pos = 0, my = 0, op = 0, fm = 0, fo = 0;
  for (let i = 0; i < b.length; i++) {
    const v = b[i]; if (!v) continue;
    const s = v === c ? 1 : -1;
    pos += s * w[i]; if (s > 0) my++; else op++;
    if (full) { const nbs = nb[i]; for (let k = 0; k < nbs.length; k++) if (!b[nbs[k]]) { if (s > 0) fm++; else fo++; break; } }
  }
  const empties = b.length - my - op;
  if (empties === 0) return (my - op) * 1000;
  let mm = 0, mo = 0;
  for (let i = 0; i < b.length; i++) if (!b[i]) { if (isLegal(b, n, i, c)) mm++; if (isLegal(b, n, i, o)) mo++; }
  if (mm === 0 && mo === 0) return (my - op) * 1000;
  let sc = pos * 10 + 25 * (mm - mo) + (mm + mo ? (100 * (mm - mo)) / (mm + mo) : 0);
  if (full) {
    sc -= 10 * (fm - fo);
    if (empties & 1) sc += 12;
    if (empties <= 14) sc += (my - op) * (15 - empties) * 2;
  }
  return sc;
}

class Search {
  nodes = 0; aborted = false;
  b: Board; n: number; full: boolean; deadline: number; now: () => number;
  constructor(b: Board, n: number, full: boolean, deadline: number, now: () => number) { this.b = b; this.n = n; this.full = full; this.deadline = deadline; this.now = now; }
  ordered(c: number): number[] { const w = weights(this.n), ms = legalMoves(this.b, this.n, c); return ms.sort((a, d) => w[d] - w[a]); }
  rootMoves(c: number, first: number): number[] { const ms = this.ordered(c); if (first >= 0) { const k = ms.indexOf(first); if (k > 0) { ms.splice(k, 1); ms.unshift(first); } } return ms; }
  negamax(c: number, depth: number, alpha: number, beta: number): number {
    if ((++this.nodes & 255) === 0 && this.now() > this.deadline) this.aborted = true;
    if (this.aborted) return 0;
    if (depth <= 0) return evaluate(this.b, this.n, c, this.full);
    const ms = this.ordered(c);
    if (!ms.length) {
      if (!hasMove(this.b, this.n, other(c))) { const k = counts(this.b); return (c === BLACK ? k.black - k.white : k.white - k.black) * 1000; }
      return -this.negamax(other(c), depth, -beta, -alpha);
    }
    let best = -Infinity;
    for (const m of ms) {
      const f = applyMove(this.b, this.n, m, c);
      const v = -this.negamax(other(c), depth - 1, -beta, -alpha);
      undoMove(this.b, m, c, f);
      if (this.aborted) return 0;
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
}

/** the move of the computer for colour c (-1 when it has none). easy: random, corners preferred; normal: two plies with position + mobility; hard: iterative alpha-beta with a time cap */
export function chooseMove(b0: Board, n: number, c: number, level: Level, o: AiOpts = {}): number {
  const rng = o.rng ?? Math.random, now = o.now ?? (() => performance.now());
  const moves = legalMoves(b0, n, c);
  lastInfo = { depth: 0, nodes: 0, ms: 0 };
  if (!moves.length) return -1;
  if (moves.length === 1) return moves[0];
  if (level === "easy") {
    const cs = corners(n), cm = moves.filter((m) => cs.includes(m));
    if (cm.length && rng() < 0.6) return cm[Math.floor(rng() * cm.length)];
    return moves[Math.floor(rng() * moves.length)];
  }
  const b = Int8Array.from(b0), t0 = now();
  if (level === "normal") {
    const s = new Search(b, n, false, Infinity, now);
    let best = -Infinity, pick = moves[0], ties = 0;
    for (const m of moves) {
      const f = applyMove(b, n, m, c);
      const v = -s.negamax(other(c), 1, -Infinity, Infinity);
      undoMove(b, m, c, f);
      if (v > best + 1e-9) { best = v; pick = m; ties = 1; } else if (Math.abs(v - best) <= 1e-9 && rng() < 1 / ++ties) pick = m;
    }
    lastInfo = { depth: 2, nodes: s.nodes, ms: now() - t0 };
    return pick;
  }
  // hard: iterative deepening; the answer of the last COMPLETE depth is used
  const cap = o.timeMs ?? 600, empties = counts(b).empty;
  const maxD = Math.max(o.maxDepth ?? (n === 6 ? 8 : 7), empties <= (n === 6 ? 12 : 9) ? empties : 0);
  const s = new Search(b, n, true, t0 + cap, now);
  let best = moves[0], depthDone = 0;
  for (let d = 1; d <= maxD; d++) {
    let alpha = -Infinity, cur = -1, curV = -Infinity;
    for (const m of s.rootMoves(c, best)) {
      const f = applyMove(b, n, m, c);
      const v = -s.negamax(other(c), d - 1, -Infinity, -alpha);
      undoMove(b, m, c, f);
      if (s.aborted) break;
      if (v > curV) { curV = v; cur = m; }
      if (v > alpha) alpha = v;
    }
    if (s.aborted) break;
    best = cur; depthDone = d;
    if (Math.abs(curV) > 500000) break;
    if (now() > t0 + cap) break;
  }
  lastInfo = { depth: depthDone, nodes: s.nodes, ms: now() - t0 };
  return best;
}
