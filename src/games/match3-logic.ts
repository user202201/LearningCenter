/** Pure rules of the candy game (糖果消消乐, match-3): an 8x8 board, matches, special candies, gravity, refill with a seeded random, no-move detection. No DOM. */
export const N = 8;
export const KINDS = 6;
/** the colour bomb is a candy of this kind (it matches nothing; it is used by swapping it) */
export const BOMB = 6;
/** s: 0 plain, 1 striped (clears its ROW), 2 striped (clears its COLUMN) */
export interface Candy { k: number; s: number; id: number }
export type Board = (Candy | null)[][];
export type Pos = [number, number];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
let uid = 1;
export const newId = () => uid++;
export const mk = (k: number, s = 0): Candy => ({ k, s, id: newId() });
export const cloneBoard = (b: Board): Board => b.map((r) => r.map((c) => (c ? { ...c } : null)));
/** a board from rows of digits (tests): '.' = empty, 0-5 colours, 6 bomb */
export const fromRows = (rows: string[]): Board => rows.map((r) => [...r].map((ch) => (ch === "." ? null : mk(+ch))));
const key = (r: number, c: number) => r * N + c;

export interface Match { cells: Pos[]; dir: "h" | "v"; len: number }

/** every run of 3+ equal candies in a row or a column (a candy can be in a horizontal and a vertical run) */
export function findMatches(b: Board): Match[] {
  const out: Match[] = [];
  const kindAt = (r: number, c: number) => { const x = b[r]?.[c]; return x && x.k !== BOMB ? x.k : -1; };
  for (let r = 0; r < N; r++) {
    let c = 0;
    while (c < N) {
      const k = kindAt(r, c); let e = c;
      while (k >= 0 && e + 1 < N && kindAt(r, e + 1) === k) e++;
      if (k >= 0 && e - c >= 2) out.push({ cells: Array.from({ length: e - c + 1 }, (_, i) => [r, c + i] as Pos), dir: "h", len: e - c + 1 });
      c = e + 1;
    }
  }
  for (let c = 0; c < N; c++) {
    let r = 0;
    while (r < N) {
      const k = kindAt(r, c); let e = r;
      while (k >= 0 && e + 1 < N && kindAt(e + 1, c) === k) e++;
      if (k >= 0 && e - r >= 2) out.push({ cells: Array.from({ length: e - r + 1 }, (_, i) => [r + i, c] as Pos), dir: "v", len: e - r + 1 });
      r = e + 1;
    }
  }
  return out;
}

/** a random board with no match at the start and at least one possible move */
export function randomBoard(rng: () => number, kinds = KINDS): Board {
  for (;;) {
    const b: Board = Array.from({ length: N }, () => new Array(N).fill(null));
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      let k: number;
      do { k = Math.floor(rng() * kinds); }
      while ((c >= 2 && b[r][c - 1]!.k === k && b[r][c - 2]!.k === k) || (r >= 2 && b[r - 1][c]!.k === k && b[r - 2][c]!.k === k));
      b[r][c] = mk(k);
    }
    if (hasMoves(b)) return b;
  }
}

export const adjacent = (a: Pos, b: Pos): boolean => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;
const swapIn = (b: Board, a: Pos, c: Pos) => { const t = b[a[0]][a[1]]; b[a[0]][a[1]] = b[c[0]][c[1]]; b[c[0]][c[1]] = t; };

/** would swapping a and b be allowed (they touch, and it makes a match or uses a colour bomb)? */
export function isValidSwap(b: Board, a: Pos, c: Pos): boolean {
  if (!adjacent(a, c) || !b[a[0]][a[1]] || !b[c[0]][c[1]]) return false;
  if (b[a[0]][a[1]]!.k === BOMB || b[c[0]][c[1]]!.k === BOMB) return true;
  const t = cloneBoard(b);
  swapIn(t, a, c);
  return findMatches(t).some((m) => m.cells.some(([r, q]) => (r === a[0] && q === a[1]) || (r === c[0] && q === c[1])));
}

/** the first swap that is possible (rows, then columns), or null: used for the hint */
export function findMove(b: Board): [Pos, Pos] | null {
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (c + 1 < N && isValidSwap(b, [r, c], [r, c + 1])) return [[r, c], [r, c + 1]];
    if (r + 1 < N && isValidSwap(b, [r, c], [r + 1, c])) return [[r, c], [r + 1, c]];
  }
  return null;
}
export const hasMoves = (b: Board): boolean => findMove(b) !== null;

/** the same candies in another order: no match, at least one move */
export function shuffle(b: Board, rng: () => number): Board {
  const all = b.flat().filter(Boolean) as Candy[];
  for (let tries = 0; tries < 500; tries++) {
    const a = all.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    const nb: Board = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => a[r * N + c] ?? null));
    if (findMatches(nb).length === 0 && hasMoves(nb)) return nb;
  }
  // very unlikely: make a fresh board of the same kinds
  return randomBoard(rng);
}

export interface Cleared { r: number; c: number; k: number; s: number; id: number }
export interface Fall { id: number; fr: number; fc: number; tr: number; tc: number }
export interface Spawn { id: number; k: number; s: number; c: number; tr: number; fromRow: number }
export interface Round {
  /** candies removed in this step (before the specials of it are created) */
  cleared: Cleared[];
  /** special candies made in this step: they stay on the board (same id as the candy they grew from) */
  created: { r: number; c: number; k: number; s: number; id: number }[];
  /** cells hit by a striped candy / the bomb (for the beam drawing) */
  beams: { r: number; c: number; kind: "row" | "col" | "bomb" }[];
  fall: Fall[]; spawn: Spawn[];
  score: number; combo: number;
}
export interface Resolved { rounds: Round[]; board: Board; score: number; maxCombo: number }

/** expands a set of cells to clear: a striped candy in it also clears its row / column, a bomb hit by a blast goes too; repeats until nothing new */
function expand(b: Board, set: Set<number>, beams: Round["beams"]) {
  const q = [...set];
  for (let i = 0; i < q.length; i++) {
    const r = Math.floor(q[i] / N), c = q[i] % N, cd = b[r][c];
    if (!cd || !cd.s) continue;
    beams.push({ r, c, kind: cd.s === 1 ? "row" : "col" });
    for (let j = 0; j < N; j++) {
      const rr = cd.s === 1 ? r : j, cc = cd.s === 1 ? j : c, kk = key(rr, cc);
      if (b[rr][cc] && !set.has(kk)) { set.add(kk); q.push(kk); }
    }
  }
}

/** drops candies down and fills the top with new ones; returns what moved */
export function gravityRefill(b: Board, rng: () => number, kinds: number): { fall: Fall[]; spawn: Spawn[] } {
  const fall: Fall[] = [], spawn: Spawn[] = [];
  for (let c = 0; c < N; c++) {
    let w = N - 1;
    for (let r = N - 1; r >= 0; r--) {
      const cd = b[r][c];
      if (!cd) continue;
      if (r !== w) { b[w][c] = cd; b[r][c] = null; fall.push({ id: cd.id, fr: r, fc: c, tr: w, tc: c }); }
      w--;
    }
    const holes = w + 1;
    for (let r = w; r >= 0; r--) {
      const cd = mk(Math.floor(rng() * kinds));
      b[r][c] = cd;
      spawn.push({ id: cd.id, k: cd.k, s: 0, c, tr: r, fromRow: r - holes });
    }
  }
  return { fall, spawn };
}

/**
 * Plays a swap to the end (the board is changed in place). Returns what happened step by step so the screen can animate it: the swap must be valid.
 * Matches of 4 make a striped candy, of 5 a colour bomb; a bomb swapped with a candy clears every candy of that colour; two bombs clear everything.
 * Every step after the first one is a chain reaction: its points are multiplied by the combo number.
 */
export function resolveSwap(b: Board, a: Pos, c: Pos, rng: () => number, kinds = KINDS): Resolved {
  const A = b[a[0]][a[1]]!, C = b[c[0]][c[1]]!;
  swapIn(b, a, c);
  const rounds: Round[] = [];
  let total = 0, combo = 0;
  const run = (set: Set<number>, created: Round["created"], beams: Round["beams"], keep: Set<number>) => {
    combo++;
    expand(b, set, beams);
    const cleared: Cleared[] = [];
    for (const k of set) {
      if (keep.has(k)) continue;
      const r = Math.floor(k / N), cc = k % N, cd = b[r][cc]!;
      cleared.push({ r, c: cc, k: cd.k, s: cd.s, id: cd.id }); b[r][cc] = null;
    }
    for (const cr of created) b[cr.r][cr.c] = { k: cr.k, s: cr.s, id: cr.id };
    const sc = cleared.length * 10 * combo + (beams.length ? 20 * combo : 0);
    total += sc;
    const { fall, spawn } = gravityRefill(b, rng, kinds);
    rounds.push({ cleared, created, beams, fall, spawn, score: sc, combo });
  };
  if (A.k === BOMB || C.k === BOMB) {
    const set = new Set<number>(), beams: Round["beams"] = [];
    const bombPos = A.k === BOMB ? c : a;       // after the swap the bomb stands where the other candy was
    if (A.k === BOMB && C.k === BOMB) { for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) set.add(key(r, q)); }
    else {
      const other = A.k === BOMB ? C : A;
      set.add(key(bombPos[0], bombPos[1]));
      for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) if (b[r][q]!.k === other.k) set.add(key(r, q));
    }
    beams.push({ r: bombPos[0], c: bombPos[1], kind: "bomb" });
    run(set, [], beams, new Set());
  }
  for (let guard = 0; guard < 60; guard++) {
    const ms = findMatches(b);
    if (!ms.length) break;
    const set = new Set<number>(), created: Round["created"] = [], keep = new Set<number>();
    for (const m of ms) for (const [r, q] of m.cells) set.add(key(r, q));
    for (const m of ms) {
      if (m.len < 4) continue;
      // the new special stands where the player swapped (if it is in the run), else in the middle of the run
      const own = m.cells.find(([r, q]) => (r === a[0] && q === a[1]) || (r === c[0] && q === c[1]));
      const [r, q] = own && guard === 0 ? own : m.cells[Math.floor((m.len - 1) / 2)];
      if (keep.has(key(r, q))) continue;
      const base = b[r][q]!;
      keep.add(key(r, q));
      created.push(m.len >= 5 ? { r, c: q, k: BOMB, s: 0, id: base.id } : { r, c: q, k: base.k, s: m.dir === "h" ? 2 : 1, id: base.id });
    }
    run(set, created, [], keep);
  }
  return { rounds, board: b, score: total, maxCombo: combo };
}

/** the swapping of the two candies the screen shows first (also when it is not valid: it swaps back) */
export const MAX_FILL = N * N;

// ---------------------------------------------------------------- levels
export interface LevelSpec { moves: number; target: number; kinds: number }
export const LEVELS: LevelSpec[] = [
  { moves: 20, target: 1200, kinds: 4 },
  { moves: 20, target: 1800, kinds: 4 },
  { moves: 22, target: 2500, kinds: 5 },
  { moves: 22, target: 3200, kinds: 5 },
  { moves: 24, target: 4000, kinds: 5 },
  { moves: 24, target: 5000, kinds: 5 },
  { moves: 25, target: 6000, kinds: 6 },
  { moves: 25, target: 7200, kinds: 6 },
  { moves: 26, target: 8500, kinds: 6 },
  { moves: 26, target: 10000, kinds: 6 },
  { moves: 28, target: 12000, kinds: 6 },
  { moves: 28, target: 14500, kinds: 6 },
];
/** 1 star at the target, 2 at 1.5 times, 3 at 2 times */
export const starsFor = (score: number, target: number): number => (score >= target * 2 ? 3 : score >= target * 1.5 ? 2 : score >= target ? 1 : 0);
