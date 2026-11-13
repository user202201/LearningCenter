/**
 * Chess brain: rules come from chess.js; the computer's search is our own (alpha-beta, iterative deepening, quiescence, material + piece-square tables).
 * The search runs in slices (`Searcher.step`) so the screen never freezes: between two root moves control goes back to the caller.
 */
import { Chess } from "chess.js";
import type { Move } from "chess.js";
export { Chess };

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

/**
 * Speed: chess.js builds the SAN text of every move (and tests for check to do it), which is far too slow for a search. So the search uses its raw
 * move generator and make / undo (`_moves`, `_makeMove`, `_undoMove`, `_board`: chess.js 1.x internals, pinned by the ^1.4.0 range and checked by the
 * tests); everything the screen sees (legal moves, results, FEN) still comes from chess.js's public API.
 */
interface Raw { color: "w" | "b"; from: number; to: number; piece: string; captured?: string; promotion?: string; flags: number }
interface Inner { _moves(o?: { legal?: boolean }): Raw[]; _makeMove(m: Raw): void; _undoMove(): void; _board: ({ type: string; color: "w" | "b" } | undefined)[]; _turn: "w" | "b"; _isKingAttacked(c: "w" | "b"): boolean }
const inner = (g: Chess) => g as unknown as Inner;
const CAPTURE = 2, PROMO = 16;
const sqName = (n: number) => `${"abcdefgh"[n & 15]}${8 - (n >> 4)}`;
const lanOf = (m: Raw) => sqName(m.from) + sqName(m.to) + (m.promotion ?? "");

/** score in centipawns from the side to move's point of view (not for finished games: the caller handles mate / draws) */
export function evaluate(game: Chess): number {
  const g = inner(game), bd = g._board;
  let score = 0, material = 0;
  for (let sq = 0; sq < 120; sq++) { if (sq & 0x88) continue; const p = bd[sq]; if (p && p.type !== "k" && p.type !== "p") material += VALUE[p.type]; }
  const endgame = material <= 2600;
  for (let sq = 0; sq < 120; sq++) {
    if (sq & 0x88) continue;
    const p = bd[sq]; if (!p) continue;
    const r = sq >> 4, f = sq & 7, idx = p.color === "w" ? r * 8 + f : (7 - r) * 8 + f;
    const table = p.type === "k" && endgame ? KING_END : PST[p.type];
    const v = VALUE[p.type] + table[idx];
    score += p.color === "w" ? v : -v;
  }
  return g._turn === "w" ? score : -score;
}

class Timeout extends Error {}

const orderScore = (m: Raw, pv?: string): number => {
  let s = 0;
  if (pv && lanOf(m) === pv) s += 100000;
  if (m.captured) s += 10 * VALUE[m.captured] - VALUE[m.piece] / 10 + 1000;
  if (m.promotion) s += VALUE[m.promotion] + 800;
  return s;
};

/** incremental search: call `step()` repeatedly (each call is short) until it returns true, then read `best` */
export class Searcher {
  best: Move | null = null;
  bestScore = 0;
  depthDone = 0;
  nodes = 0;
  finished = false;
  private game: Chess;
  private pub: Move[];
  private deadline: number;
  private maxDepth: number;
  private tolerance: number;
  private roots: Raw[];
  private depth = 0;
  private idx = 0;
  private scores: number[] = [];
  private alpha = -MATE * 2;
  private pv?: string;
  private depthStart = 0;
  private lastDepthMs = 0;

  constructor(fen: string, level: Level, opts: { ms?: number; depth?: number; tolerance?: number } = {}) {
    const L = LEVELS[level];
    this.game = new Chess(fen);
    this.deadline = Date.now() + (opts.ms ?? L.ms);
    this.maxDepth = opts.depth ?? L.depth;
    this.tolerance = opts.tolerance ?? L.tolerance;
    this.pub = this.game.moves({ verbose: true });
    this.roots = inner(this.game)._moves();
    if (this.roots.length === 0) this.finished = true;
    else if (level === 0) this.pickBeginner();
    else { this.best = this.publicOf(this.roots[0]); this.depth = 1; this.startDepth(); }
  }

  private publicOf(m: Raw): Move { const lan = lanOf(m); return this.pub.find((x) => x.lan === lan) ?? this.pub[0]; }

  /** 新手: random, but likes captures (and takes a mate in one when it sees it) */
  private pickBeginner() {
    const ws = this.pub.map((m) => (m.san.endsWith("#") ? 40 : 1 + (m.captured ? 3 + VALUE[m.captured] / 100 : 0) + (m.san.endsWith("+") ? 2 : 0) + (m.promotion ? 3 : 0)));
    let r = Math.random() * ws.reduce((a, b) => a + b, 0), i = 0;
    for (; i < ws.length - 1; i++) { r -= ws[i]; if (r <= 0) break; }
    this.best = this.pub[i];
    this.finished = true;
  }

  private startDepth() {
    this.roots.sort((a, b) => orderScore(b, this.pv) - orderScore(a, this.pv));
    this.idx = 0; this.scores = []; this.alpha = -MATE * 2; this.depthStart = Date.now();
  }

  step(sliceMs = 12): boolean {
    if (this.finished) return true;
    const g = inner(this.game), t0 = Date.now();
    try {
      while (Date.now() - t0 < sliceMs) {
        if (Date.now() > this.deadline && this.depthDone >= 1) throw new Timeout();
        const m = this.roots[this.idx];
        g._makeMove(m);
        // a tolerance > 0 needs an exact score for every root move (full window); otherwise the usual alpha-beta window
        const score = -this.negamax(this.depth - 1, -MATE * 2, this.tolerance > 0 ? MATE * 2 : -this.alpha, 1);
        g._undoMove();
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
    // do not walk into a repetition draw when clearly ahead
    if (this.scores[pick] > 150) {
      const order = this.scores.map((s, i) => i).sort((a, b) => this.scores[b] - this.scores[a]);
      for (const i of order) {
        if (this.scores[i] < this.scores[pick] - 30) break;
        const probe = new Chess(this.game.fen()); const pm = this.publicOf(this.roots[i]);
        probe.move(pm.san);
        if (!probe.isThreefoldRepetition()) { pick = i; break; }
      }
    }
    this.best = this.publicOf(this.roots[pick]); this.bestScore = this.scores[bi]; this.depthDone = this.depth; this.pv = lanOf(this.roots[bi]);
    this.lastDepthMs = Date.now() - this.depthStart;
    // another depth is only started when it has a fair chance to finish (a depth costs about 4 times the one before)
    if (this.depth >= this.maxDepth || this.bestScore > MATE / 2 || Date.now() + this.lastDepthMs * 3 > this.deadline) { this.finished = true; return; }
    this.depth++; this.startDepth();
  }

  private negamax(depth: number, alpha: number, beta: number, ply: number): number {
    if ((++this.nodes & 127) === 0 && Date.now() > this.deadline && this.depthDone >= 1) throw new Timeout();
    if (depth <= 0) return this.quiesce(alpha, beta, 0);
    const g = inner(this.game);
    const moves = g._moves();
    if (moves.length === 0) return g._isKingAttacked(g._turn) ? -MATE + ply : 0;
    moves.sort((a, b) => orderScore(b) - orderScore(a));
    let best = -MATE * 2;
    for (const m of moves) {
      g._makeMove(m);
      const s = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      g._undoMove();
      if (s > best) best = s;
      if (s > alpha) alpha = s;
      if (alpha >= beta) break;
    }
    return best;
  }

  private quiesce(alpha: number, beta: number, qd: number): number {
    if ((++this.nodes & 127) === 0 && Date.now() > this.deadline && this.depthDone >= 1) throw new Timeout();
    const stand = evaluate(this.game);
    if (stand >= beta) return stand;
    if (qd >= 6) return stand;
    if (stand > alpha) alpha = stand;
    const g = inner(this.game);
    const caps = g._moves().filter((m) => m.flags & (CAPTURE | PROMO));
    caps.sort((a, b) => orderScore(b) - orderScore(a));
    for (const m of caps) {
      if (!m.promotion && stand + VALUE[m.captured as string] + 200 < alpha) continue;   // delta pruning
      g._makeMove(m);
      const s = -this.quiesce(-beta, -alpha, qd + 1);
      g._undoMove();
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
