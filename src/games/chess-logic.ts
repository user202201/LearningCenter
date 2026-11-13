/**
 * Chess brain: rules come from chess.js; the computer's search is our own (alpha-beta, iterative deepening, quiescence, material + piece-square tables).
 * The search runs in slices (`Searcher.step`) so the screen never freezes: between two root moves control goes back to the caller.
 */
import { Chess } from "chess.js";
import type { Move } from "chess.js";

export type Level = 0 | 1 | 2 | 3;
export interface LevelInfo { name: string; depth: number; ms: number; tolerance: number }
export const LEVELS: LevelInfo[] = [
  { name: "新手", depth: 1, ms: 100, tolerance: 0 },
  { name: "简单", depth: 2, ms: 300, tolerance: 35 },
  { name: "普通", depth: 4, ms: 500, tolerance: 8 },
  { name: "困难", depth: 6, ms: 800, tolerance: 0 },
];

export const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;

// piece-square tables, from White's point of view, index 0 = a8 ... 63 = h1 (the usual "simplified evaluation function" tables)
const PST: Record<string, number[]> = {
  p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
};
const KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];

/** score in centipawns from the side to move's point of view (not for finished games: the caller handles mate / draws) */
export function evaluate(game: Chess): number {
  const board = game.board();
  let score = 0, material = 0;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) { const p = board[r][f]; if (p && p.type !== "k" && p.type !== "p") material += VALUE[p.type]; }
  const endgame = material <= 2600;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = board[r][f]; if (!p) continue;
    const i = r * 8 + f, idx = p.color === "w" ? i : (7 - r) * 8 + f;
    const table = p.type === "k" && endgame ? KING_END : PST[p.type];
    const v = VALUE[p.type] + table[idx];
    score += p.color === "w" ? v : -v;
  }
  return game.turn() === "w" ? score : -score;
}

class Timeout extends Error {}

const orderScore = (m: Move, pv?: string): number => {
  let s = 0;
  if (pv && m.lan === pv) s += 100000;
  if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece] / 10 + 1000;
  if (m.promotion) s += VALUE[m.promotion] + 800;
  if (m.san.endsWith("+") || m.san.endsWith("#")) s += 60;
  if (m.flags.includes("k") || m.flags.includes("q")) s += 30;
  return s;
};

/** incremental search: call `step()` repeatedly (each call is short) until it returns true, then read `best` */
export class Searcher {
  best: Move | null = null;
  bestScore = 0;
  depthDone = 0;
  nodes = 0;
  private game: Chess;
  private deadline: number;
  private maxDepth: number;
  private tolerance: number;
  private roots: Move[];
  private depth = 0;
  private idx = 0;
  private scores: number[] = [];
  private alpha = -MATE * 2;
  private pv?: string;
  finished = false;

  constructor(fen: string, level: Level, opts: { ms?: number; depth?: number; tolerance?: number } = {}) {
    const L = LEVELS[level];
    this.game = new Chess(fen);
    this.deadline = Date.now() + (opts.ms ?? L.ms);
    this.maxDepth = opts.depth ?? L.depth;
    this.tolerance = opts.tolerance ?? L.tolerance;
    this.roots = this.game.moves({ verbose: true });
    if (this.roots.length === 0) this.finished = true;
    else if (level === 0) this.pickBeginner();
    else { this.best = this.roots[0]; this.depth = 1; this.startDepth(); }
  }

  /** 新手: random, but likes captures (and takes a mate in one when it sees it) */
  private pickBeginner() {
    const ws = this.roots.map((m) => {
      if (m.san.endsWith("#")) return 40;
      let w = 1;
      if (m.captured) w += 3 + VALUE[m.captured] / 100;
      if (m.san.endsWith("+")) w += 2;
      if (m.promotion) w += 3;
      return w;
    });
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), i = 0;
    for (; i < ws.length - 1; i++) { r -= ws[i]; if (r <= 0) break; }
    this.best = this.roots[i];
    this.finished = true;
  }

  private startDepth() {
    this.roots.sort((a, b) => orderScore(b, this.pv) - orderScore(a, this.pv));
    this.idx = 0; this.scores = []; this.alpha = -MATE * 2;
  }

  step(sliceMs = 12): boolean {
    if (this.finished) return true;
    const t0 = Date.now();
    try {
      while (Date.now() - t0 < sliceMs) {
        if (Date.now() > this.deadline && this.depthDone >= 1) throw new Timeout();
        const m = this.roots[this.idx];
        this.game.move(m.san);
        // a tolerance > 0 needs an exact score for every root move (full window); otherwise the usual alpha-beta window
        let score = -this.negamax(this.depth - 1, -MATE * 2, this.tolerance > 0 ? MATE * 2 : -this.alpha, 1);
        this.game.undo();
        // do not walk into a repetition draw when ahead
        if (score > 150) { this.game.move(m.san); if (this.game.isThreefoldRepetition()) score = 0; this.game.undo(); }
        this.scores[this.idx] = score;
        if (score > this.alpha) this.alpha = score;
        this.idx++;
        if (this.idx >= this.roots.length) { this.finishDepth(); if (this.finished) return true; break; }
      }
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      this.finished = true;   // the half-searched depth is dropped; `best` is the last complete one
      return true;
    }
    return false;
  }

  private finishDepth() {
    let bi = 0;
    for (let i = 1; i < this.scores.length; i++) if (this.scores[i] > this.scores[bi]) bi = i;
    let pick = bi;
    if (this.tolerance > 0 && this.scores[bi] < MATE / 2) {
      const near = this.scores.map((s, i) => (s >= this.scores[bi] - this.tolerance ? i : -1)).filter((i) => i >= 0);
      pick = near[Math.floor(Math.random() * near.length)];
    }
    this.best = this.roots[pick]; this.bestScore = this.scores[bi]; this.depthDone = this.depth; this.pv = this.roots[bi].lan;
    if (this.depth >= this.maxDepth || Date.now() > this.deadline || this.bestScore > MATE / 2) { this.finished = true; return; }
    this.depth++; this.startDepth();
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    if ((++this.nodes & 255) === 0 && Date.now() > this.deadline && this.depthDone >= 1) throw new Timeout();
    const g = this.game;
    if (depth <= 0) return this.quiesce(alpha, beta, 0);
    const moves = g.moves({ verbose: true });
    if (moves.length === 0) return g.inCheck() ? -MATE + ply : 0;
    if (g.isInsufficientMaterial()) return 0;
    moves.sort((a, b) => orderScore(b) - orderScore(a));
    let best = -MATE * 2;
    for (const m of moves) {
      g.move(m.san);
      const s = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      g.undo();
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  private quiesce(alpha: number, beta: number, qd: number): number {
    const g = this.game;
    const stand = evaluate(g);
    if (stand >= beta) return stand;
    if (qd >= 6) return stand;
    if (stand > alpha) alpha = stand;
    const caps = g.moves({ verbose: true }).filter((m) => m.captured || m.promotion);
    caps.sort((a, b) => orderScore(b) - orderScore(a));
    for (const m of caps) {
      if (!m.promotion && stand + VALUE[m.captured as string] + 200 < alpha) continue;   // delta pruning
      g.move(m.san);
      const s = -this.quiesce(-beta, -alpha, qd + 1);
      g.undo();
      if (s >= beta) return s;
      if (s > alpha) alpha = s;
    }
    return alpha;
  }
}

/** synchronous convenience (tests, hints): runs the slices back to back */
export function bestMove(fen: string, level: Level, opts: { ms?: number; depth?: number; tolerance?: number } = {}): Move | null {
  const s = new Searcher(fen, level, opts);
  while (!s.step(50)) { /* keep going */ }
  return s.best;
}

/** how a finished game ended (null = still running) */
export type Outcome = { kind: "mate"; winner: "w" | "b" } | { kind: "stalemate" } | { kind: "threefold" } | { kind: "fifty" } | { kind: "material" } | null;
export function outcomeOf(g: Chess): Outcome {
  if (g.isCheckmate()) return { kind: "mate", winner: g.turn() === "w" ? "b" : "w" };
  if (g.isStalemate()) return { kind: "stalemate" };
  if (g.isInsufficientMaterial()) return { kind: "material" };
  if (g.isThreefoldRepetition()) return { kind: "threefold" };
  if (g.isDrawByFiftyMoves()) return { kind: "fifty" };
  return null;
}

/** the legal targets of the piece on `sq`: [{to, promotion?}] */
export function targetsFrom(g: Chess, sq: string): Move[] {
  return g.moves({ square: sq as never, verbose: true });
}
