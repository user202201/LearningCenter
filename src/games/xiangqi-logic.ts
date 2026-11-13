/**
 * Xiangqi (Chinese chess): the rules, written from scratch. Pure code, no screen.
 * Board: 9 columns (0..8) x 10 rows (0..9), index = row * 9 + col. Row 0 is the top = the black side, row 9 the bottom = red.
 * A piece is a signed number: red > 0, black < 0; the kind is |p|: 1 general, 2 advisor, 3 elephant, 4 horse, 5 chariot, 6 cannon, 7 soldier.
 * A move is a number: from | (to << 7).
 */
export type Side = 1 | -1;
export const RED: Side = 1;
export const BLACK: Side = -1;
export const K = 1, A = 2, E = 3, H = 4, R = 5, C = 6, P = 7;
export const W = 9, HT = 10;
export const NOCAPTURE_LIMIT = 120; // plies without a capture -> draw
export const MATE = 30000;

export interface Pos {
  b: Int8Array;
  turn: Side;
  ks: [number, number]; // general squares [red, black]
  /** plies since the last capture */
  quiet: number;
  /** moves made (for undo): [move, captured, quietBefore] */
  stack: number[];
}
export const mv = (from: number, to: number) => from | (to << 7);
export const fromOf = (m: number) => m & 127;
export const toOf = (m: number) => m >> 7;
export const rowOf = (s: number) => (s / 9) | 0;
export const colOf = (s: number) => s % 9;
export const sq = (r: number, c: number) => r * 9 + c;
export const sideIdx = (s: Side) => (s === RED ? 0 : 1);
export const sideOf = (p: number): Side => (p > 0 ? RED : BLACK);

const FEN_CH: Record<string, number> = { k: K, a: A, b: E, n: H, r: R, c: C, p: P };
const CH_FEN = "?kabnrcp";
export const START_FEN = "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w";

/** Standard xiangqi FEN (rank 0 = black's back row at the top; upper case = red; w = red to move). */
export function parseFen(fen: string): Pos {
  const [rows, t] = fen.trim().split(/\s+/);
  const b = new Int8Array(90);
  const ks: [number, number] = [-1, -1];
  rows.split("/").forEach((line, r) => {
    let c = 0;
    for (const ch of line) {
      if (/\d/.test(ch)) { c += Number(ch); continue; }
      const kind = FEN_CH[ch.toLowerCase()];
      if (!kind) throw new Error("bad fen char " + ch);
      const p = ch === ch.toLowerCase() ? -kind : kind;
      b[sq(r, c)] = p;
      if (kind === K) ks[p > 0 ? 0 : 1] = sq(r, c);
      c++;
    }
  });
  return { b, turn: t === "b" ? BLACK : RED, ks, quiet: 0, stack: [] };
}
export function toFen(pos: Pos): string {
  const rows: string[] = [];
  for (let r = 0; r < HT; r++) {
    let s = "", gap = 0;
    for (let c = 0; c < W; c++) {
      const p = pos.b[sq(r, c)];
      if (!p) { gap++; continue; }
      if (gap) { s += gap; gap = 0; }
      const ch = CH_FEN[Math.abs(p)];
      s += p > 0 ? ch.toUpperCase() : ch;
    }
    if (gap) s += gap;
    rows.push(s);
  }
  return rows.join("/") + " " + (pos.turn === RED ? "w" : "b");
}
export const startPosition = () => parseFen(START_FEN);
export function clonePos(p: Pos): Pos { return { b: Int8Array.from(p.b), turn: p.turn, ks: [p.ks[0], p.ks[1]], quiet: p.quiet, stack: [] }; }

// ---------- geometry ----------
const inPalace = (r: number, c: number, side: Side) => c >= 3 && c <= 5 && (side === RED ? r >= 7 && r <= 9 : r >= 0 && r <= 2);
/** has a soldier of this side crossed the river? */
export const crossed = (r: number, side: Side) => (side === RED ? r <= 4 : r >= 5);
const ownHalf = (r: number, side: Side) => (side === RED ? r >= 5 : r <= 4);
const ORTH: readonly (readonly [number, number])[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG: readonly (readonly [number, number])[] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const HORSE: readonly (readonly [number, number])[] = [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [1, -2], [-1, 2], [1, 2]];
/** the leg square of a horse move (dr, dc) from (r, c) */
const legOf = (r: number, c: number, dr: number, dc: number) => (Math.abs(dr) === 2 ? sq(r + dr / 2, c) : sq(r, c + dc / 2));

/** pseudo-legal moves of the side to move (they may leave its own general in check; a general may "capture" the other one on an open file). */
export function pseudoMoves(pos: Pos, capsOnly = false): number[] {
  const out: number[] = [];
  const b = pos.b, side = pos.turn;
  for (let s = 0; s < 90; s++) {
    const p = b[s];
    if (!p || (p > 0 ? RED : BLACK) !== side) continue;
    const r = rowOf(s), c = colOf(s), kind = Math.abs(p);
    const add = (to: number) => {
      const q = b[to];
      if (q && sideOf(q) === side) return;
      if (capsOnly && !q) return;
      out.push(mv(s, to));
    };
    switch (kind) {
      case K:
        for (const [dr, dc] of ORTH) { const nr = r + dr, nc = c + dc; if (inPalace(nr, nc, side)) add(sq(nr, nc)); }
        { // flying general: the other general on an open file can be taken
          const enemy = pos.ks[side === RED ? 1 : 0];
          if (enemy >= 0 && colOf(enemy) === c) {
            let open = true;
            for (let x = Math.min(r, rowOf(enemy)) + 1; x < Math.max(r, rowOf(enemy)); x++) if (b[sq(x, c)]) { open = false; break; }
            if (open) out.push(mv(s, enemy));
          }
        }
        break;
      case A:
        for (const [dr, dc] of DIAG) { const nr = r + dr, nc = c + dc; if (inPalace(nr, nc, side)) add(sq(nr, nc)); }
        break;
      case E:
        for (const [dr, dc] of DIAG) {
          const nr = r + 2 * dr, nc = c + 2 * dc;
          if (nr < 0 || nr >= HT || nc < 0 || nc >= W || !ownHalf(nr, side)) continue;
          if (b[sq(r + dr, c + dc)]) continue; // the elephant eye is blocked
          add(sq(nr, nc));
        }
        break;
      case H:
        for (const [dr, dc] of HORSE) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= HT || nc < 0 || nc >= W) continue;
          if (b[legOf(r, c, dr, dc)]) continue; // hobbled horse
          add(sq(nr, nc));
        }
        break;
      case R:
        for (const [dr, dc] of ORTH) {
          let nr = r + dr, nc = c + dc;
          while (nr >= 0 && nr < HT && nc >= 0 && nc < W) {
            const t = sq(nr, nc);
            if (b[t]) { add(t); break; }
            add(t);
            nr += dr; nc += dc;
          }
        }
        break;
      case C:
        for (const [dr, dc] of ORTH) {
          let nr = r + dr, nc = c + dc, screen = false;
          while (nr >= 0 && nr < HT && nc >= 0 && nc < W) {
            const t = sq(nr, nc);
            if (!screen) {
              if (b[t]) screen = true; else add(t);
            } else if (b[t]) { add(t); break; }
            nr += dr; nc += dc;
          }
        }
        break;
      case P: {
        const fw = side === RED ? -1 : 1;
        if (r + fw >= 0 && r + fw < HT) add(sq(r + fw, c));
        if (crossed(r, side)) { if (c > 0) add(sq(r, c - 1)); if (c < W - 1) add(sq(r, c + 1)); }
        break;
      }
    }
  }
  return out;
}

/** is `target` attacked by `by`? (general facing general counts) */
export function attacked(pos: Pos, target: number, by: Side): boolean {
  const b = pos.b;
  const r = rowOf(target), c = colOf(target);
  const enemyK = by * K;
  // chariots, the facing general, cannons
  for (const [dr, dc] of ORTH) {
    let nr = r + dr, nc = c + dc, n = 0;
    while (nr >= 0 && nr < HT && nc >= 0 && nc < W) {
      const p = b[sq(nr, nc)];
      if (p) {
        if (n === 0) {
          if (p === by * R) return true;
          if (p === enemyK && dc === 0) return true; // flying general (also catches the general itself)
        } else if (n === 1 && p === by * C) return true;
        n++;
        if (n > 1) break;
      }
      nr += dr; nc += dc;
    }
  }
  // horses: a horse at target - (dr, dc) jumping by (dr, dc), its leg must be free
  for (const [dr, dc] of HORSE) {
    const hr = r - dr, hc = c - dc;
    if (hr < 0 || hr >= HT || hc < 0 || hc >= W) continue;
    if (b[sq(hr, hc)] === by * H && !b[legOf(hr, hc, dr, dc)]) return true;
  }
  // soldiers: a soldier of `by` moves forward (red = up = -1)
  const fw = by === RED ? -1 : 1;
  { const pr = r - fw; if (pr >= 0 && pr < HT && b[sq(pr, c)] === by * P) return true; }
  for (const dc of [-1, 1]) {
    const pc = c + dc;
    if (pc >= 0 && pc < W && b[sq(r, pc)] === by * P && crossed(r, by)) return true;
  }
  // an advisor / elephant can never reach a general of the other side
  return false;
}

export const inCheck = (pos: Pos, side: Side): boolean => {
  const k = pos.ks[sideIdx(side)];
  return k >= 0 && attacked(pos, k, -side as Side);
};

/** plays a move (no legality check). Returns the captured piece. */
export function make(pos: Pos, m: number): number {
  const f = fromOf(m), t = toOf(m);
  const cap = pos.b[t];
  pos.stack.push(m, cap, pos.quiet);
  pos.b[t] = pos.b[f]; pos.b[f] = 0;
  if (Math.abs(pos.b[t]) === K) pos.ks[pos.b[t] > 0 ? 0 : 1] = t;
  if (cap && Math.abs(cap) === K) pos.ks[cap > 0 ? 0 : 1] = -1;
  pos.quiet = cap ? 0 : pos.quiet + 1;
  pos.turn = -pos.turn as Side;
  return cap;
}
export function unmake(pos: Pos): void {
  const quiet = pos.stack.pop()!, cap = pos.stack.pop()!, m = pos.stack.pop()!;
  const f = fromOf(m), t = toOf(m);
  pos.b[f] = pos.b[t]; pos.b[t] = cap;
  if (Math.abs(pos.b[f]) === K) pos.ks[pos.b[f] > 0 ? 0 : 1] = f;
  if (cap && Math.abs(cap) === K) pos.ks[cap > 0 ? 0 : 1] = t;
  pos.quiet = quiet;
  pos.turn = -pos.turn as Side;
}

/** all legal moves of the side to move: the general may not be left in check, nor face the other general. */
export function legalMoves(pos: Pos): number[] {
  const side = pos.turn, res: number[] = [];
  for (const m of pseudoMoves(pos)) {
    if (Math.abs(pos.b[toOf(m)]) === K) continue; // (a flying "capture" is never legal: the position was already illegal)
    make(pos, m);
    if (!inCheck(pos, side)) res.push(m);
    unmake(pos);
  }
  return res;
}
export const legalFrom = (pos: Pos, from: number) => legalMoves(pos).filter((m) => fromOf(m) === from);
export const isLegal = (pos: Pos, m: number) => legalMoves(pos).includes(m);

export type Status = "play" | "checkmate" | "stalemate" | "draw";
/** In xiangqi a player with no legal move has LOST (checkmate or stalemate alike). `loser` is the side that lost. */
export function status(pos: Pos): { state: Status; check: boolean; loser?: Side; moves: number } {
  const moves = legalMoves(pos).length;
  const check = inCheck(pos, pos.turn);
  if (moves === 0) return { state: check ? "checkmate" : "stalemate", check, loser: pos.turn, moves };
  if (pos.quiet >= NOCAPTURE_LIMIT) return { state: "draw", check, moves };
  return { state: "play", check, moves };
}

// ---------- evaluation ----------
const VAL = [0, 0, 200, 200, 420, 900, 460, 100];
// position tables seen from red (row 0 = far end); black reads them mirrored (row 9 - r)
const PT_P = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [90, 90, 110, 120, 120, 120, 110, 90, 90],
  [90, 90, 110, 120, 120, 120, 110, 90, 90],
  [70, 90, 110, 110, 110, 110, 110, 90, 70],
  [70, 70, 70, 70, 70, 70, 70, 70, 70],
  [0, 0, 20, 0, 40, 0, 20, 0, 0],
  [0, 0, 0, 0, 20, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];
const PT_H = [
  [0, -8, 4, 4, 0, 4, 4, -8, 0],
  [4, 8, 16, 12, 4, 12, 16, 8, 4],
  [4, 10, 28, 16, 8, 16, 28, 10, 4],
  [4, 16, 20, 24, 26, 24, 20, 16, 4],
  [8, 14, 22, 30, 30, 30, 22, 14, 8],
  [8, 14, 22, 28, 28, 28, 22, 14, 8],
  [4, 10, 18, 22, 22, 22, 18, 10, 4],
  [4, 8, 12, 14, 14, 14, 12, 8, 4],
  [0, 0, 6, 8, 4, 8, 6, 0, 0],
  [-6, -4, 0, 0, 0, 0, 0, -4, -6],
];
const PT_R = [
  [14, 14, 12, 18, 16, 18, 12, 14, 14],
  [16, 20, 18, 24, 26, 24, 18, 20, 16],
  [12, 12, 12, 18, 18, 18, 12, 12, 12],
  [12, 18, 16, 22, 22, 22, 16, 18, 12],
  [12, 14, 12, 18, 18, 18, 12, 14, 12],
  [12, 16, 14, 20, 20, 20, 14, 16, 12],
  [6, 10, 8, 14, 14, 14, 8, 10, 6],
  [4, 8, 6, 14, 12, 14, 6, 8, 4],
  [8, 4, 8, 16, 8, 16, 8, 4, 8],
  [-2, 10, 6, 14, 12, 14, 6, 10, -2],
];
const PT_C = [
  [6, 4, 0, -10, -12, -10, 0, 4, 6],
  [2, 2, 0, -4, -14, -4, 0, 2, 2],
  [2, 2, 0, -10, -8, -10, 0, 2, 2],
  [0, 0, -2, 4, 10, 4, -2, 0, 0],
  [0, 0, 0, 2, 8, 2, 0, 0, 0],
  [-2, 0, 4, 2, 6, 2, 4, 0, -2],
  [0, 0, 0, 2, 4, 2, 0, 0, 0],
  [4, 0, 8, 6, 10, 6, 8, 0, 4],
  [0, 2, 4, 6, 6, 6, 4, 2, 0],
  [0, 0, 2, 6, 6, 6, 2, 0, 0],
];
const PT: Record<number, number[][]> = { [P]: PT_P, [H]: PT_H, [R]: PT_R, [C]: PT_C };
/** static value for the side to move (positive = good for it) */
export function evaluate(pos: Pos): number {
  let sc = 0;
  const b = pos.b;
  for (let s = 0; s < 90; s++) {
    const p = b[s];
    if (!p) continue;
    const kind = Math.abs(p), red = p > 0;
    const r = rowOf(s), c = colOf(s);
    let v = VAL[kind];
    const t = PT[kind];
    if (t) v += t[red ? r : 9 - r][c];
    else if (kind === A || kind === E) v += (c === 4 ? 6 : 0);
    sc += red ? v : -v;
  }
  return pos.turn === RED ? sc : -sc;
}
const TYPE_ORDER = [0, 1000, 20, 20, 40, 90, 45, 10];
export const pieceValue = (p: number) => VAL[Math.abs(p)] + (Math.abs(p) === K ? 10000 : 0);

// ---------- search ----------
export interface SearchOpts {
  /** maximum depth */
  depth: number;
  /** time budget in ms (a generator-based search checks the clock) */
  ms: number;
  /** search every root move with a full window (needed to pick among several moves) */
  all?: boolean;
  now?: () => number;
}
export interface SearchResult { move: number; score: number; depth: number; scores: [number, number][]; nodes: number }

const killers: number[][] = [];
function orderMoves(pos: Pos, moves: number[], first: number, ply: number): number[] {
  const b = pos.b;
  const sc = new Map<number, number>();
  for (const m of moves) {
    let s = 0;
    const cap = b[toOf(m)];
    if (m === first) s = 1e6;
    else if (cap) s = 10000 + pieceValue(cap) * 10 - TYPE_ORDER[Math.abs(b[fromOf(m)])];
    else if (killers[ply] && (killers[ply][0] === m || killers[ply][1] === m)) s = 5000;
    sc.set(m, s);
  }
  return moves.sort((x, y) => sc.get(y)! - sc.get(x)!);
}

class Stop extends Error {}
interface Ctl { deadline: number; now: () => number; nodes: number; stopped: boolean }

function quiesce(pos: Pos, alpha: number, beta: number, ply: number, ctl: Ctl, qd: number): number {
  if ((++ctl.nodes & 1023) === 0 && ctl.now() > ctl.deadline) { ctl.stopped = true; throw new Stop(); }
  let stand = evaluate(pos);
  if (stand >= beta) return stand;
  if (qd <= 0) return stand;
  if (stand > alpha) alpha = stand;
  const moves = orderMoves(pos, pseudoMoves(pos, true), 0, 63);
  for (const m of moves) {
    if (Math.abs(pos.b[toOf(m)]) === K) return MATE - ply;
    make(pos, m);
    const v = -quiesce(pos, -beta, -alpha, ply + 1, ctl, qd - 1);
    unmake(pos);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

function negamax(pos: Pos, depth: number, alpha: number, beta: number, ply: number, ctl: Ctl): number {
  if ((++ctl.nodes & 1023) === 0 && ctl.now() > ctl.deadline) { ctl.stopped = true; throw new Stop(); }
  if (depth <= 0) return quiesce(pos, alpha, beta, ply, ctl, 6);
  const moves = orderMoves(pos, pseudoMoves(pos), 0, ply);
  let best = -MATE;
  for (const m of moves) {
    if (Math.abs(pos.b[toOf(m)]) === K) return MATE - ply; // the general can be taken: the side before lost
    make(pos, m);
    const v = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, ctl);
    unmake(pos);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) {
      const cap = pos.b[toOf(m)];
      if (!cap) { const k = (killers[ply] ??= [0, 0]); if (k[0] !== m) { k[1] = k[0]; k[0] = m; } }
      break;
    }
  }
  return best === -MATE ? -MATE + ply : best;
}

/**
 * Iterative deepening alpha-beta. A generator: it yields after each root move (and each second-ply move) so a caller can hand
 * control back to the browser; `searchSync` just drains it. Returns the best move of the last completed depth.
 */
export function* searchGen(pos0: Pos, o: SearchOpts): Generator<void, SearchResult, void> {
  const now = o.now ?? (() => performance.now());
  const pos = clonePos(pos0);
  const root = legalMoves(pos);
  killers.length = 0;
  if (root.length === 0) return { move: 0, score: -MATE, depth: 0, scores: [], nodes: 0 };
  const ctl: Ctl = { deadline: now() + o.ms, now, nodes: 0, stopped: false };
  let best = root[0], bestScore = -MATE, doneDepth = 0;
  let scores: [number, number][] = root.map((m) => [m, 0]);
  let ordered = orderMoves(pos, root.slice(), 0, 0);
  for (let d = 1; d <= o.depth; d++) {
    let alpha = -MATE, iterBest = ordered[0], iterScore = -MATE;
    const iterScores: [number, number][] = [];
    try {
      for (const m of ordered) {
        make(pos, m);
        let v: number;
        v = -(yield* gnode(pos, d - 1, -MATE, o.all ? MATE : -alpha, 1, ctl));
        unmake(pos);
        iterScores.push([m, v]);
        if (v > iterScore) { iterScore = v; iterBest = m; }
        if (v > alpha) alpha = v;
        yield;
      }
    } catch (e) {
      if (!(e instanceof Stop)) throw e;
      while (pos.stack.length) unmake(pos);
      break;
    }
    best = iterBest; bestScore = iterScore; doneDepth = d;
    scores = iterScores;
    ordered = orderMoves(pos, root.slice(), best, 0);
    if (Math.abs(bestScore) > MATE - 100) break; // a forced mate was found
    if (now() > ctl.deadline) break;
  }
  return { move: best, score: bestScore, depth: doneDepth, scores, nodes: ctl.nodes };
}
/** an upper-ply node as a generator (yields after each move, so the screen can breathe); deeper plies are plain recursion */
function* gnode(pos: Pos, depth: number, alpha: number, beta: number, ply: number, ctl: Ctl): Generator<void, number, void> {
  if (depth <= 2 || ply > 2) return negamax(pos, depth, alpha, beta, ply, ctl);
  const moves = orderMoves(pos, pseudoMoves(pos), 0, ply);
  let best = -MATE;
  for (const m of moves) {
    if (Math.abs(pos.b[toOf(m)]) === K) return MATE - ply;
    make(pos, m);
    const v = -(yield* gnode(pos, depth - 1, -beta, -alpha, ply + 1, ctl));
    unmake(pos);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
    if (ctl.now() > ctl.deadline) { ctl.stopped = true; throw new Stop(); }
    yield;
  }
  return best === -MATE ? -MATE + ply : best;
}

export function searchSync(pos: Pos, o: SearchOpts): SearchResult {
  const g = searchGen(pos, o);
  for (;;) { const r = g.next(); if (r.done) return r.value; }
}

export type LevelId = 0 | 1 | 2 | 3;
export interface Level { id: LevelId; name: string; depth: number; ms: number; noise: number; blunder: number }
/** the four levels (names are literal Chinese texts for the translation lookup) */
export const LEVELS: Level[] = [
  { id: 0, name: "新手", depth: 1, ms: 300, noise: 260, blunder: 0.25 },
  { id: 1, name: "简单", depth: 2, ms: 300, noise: 90, blunder: 0.05 },
  { id: 2, name: "普通", depth: 4, ms: 500, noise: 0, blunder: 0 },
  { id: 3, name: "困难", depth: 7, ms: 800, noise: 0, blunder: 0 },
];

/** picks the computer's move: for the weak levels among the root moves with some randomness (never a mate in one that is available) */
export function pickMove(res: SearchResult, level: Level, rnd: () => number = Math.random): number {
  if (!res.scores.length) return res.move;
  const top = res.scores.reduce((a, b) => (b[1] > a[1] ? b : a));
  if (top[1] > MATE - 100) return top[0];
  if (level.noise === 0 && level.blunder === 0) return res.move;
  if (rnd() < level.blunder) {
    const sorted = res.scores.slice().sort((a, b) => b[1] - a[1]);
    return sorted[Math.floor(rnd() * Math.min(sorted.length, 8))][0];
  }
  const near = res.scores.filter((s) => s[1] >= top[1] - level.noise);
  return near[Math.floor(rnd() * near.length)][0];
}

/** synchronous convenience (tests, hint): best move for the side to move */
export function chooseMoveSync(pos: Pos, level: Level, rnd?: () => number): number {
  const res = searchSync(pos, { depth: level.depth, ms: level.ms, all: level.noise > 0 || level.blunder > 0 });
  return pickMove(res, level, rnd);
}

// ---------- notation helpers for the screen ----------
export const CHAR_RED = ["", "\u5e05", "\u4ed5", "\u76f8", "\u9a6c", "\u8f66", "\u70ae", "\u5175"];
export const CHAR_BLACK = ["", "\u5c06", "\u58eb", "\u8c61", "\u9a6c", "\u8f66", "\u70ae", "\u5352"];
export const pieceChar = (p: number) => (p > 0 ? CHAR_RED : CHAR_BLACK)[Math.abs(p)];
