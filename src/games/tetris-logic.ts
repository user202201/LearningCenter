/** Tetris: the pure rules (no screen, no timer). Board 10 x 20, 0 = empty, 1..7 = the kind of the block that was locked there. */
export type Kind = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const KINDS: Kind[] = ["I", "O", "T", "S", "Z", "J", "L"];
export const COLS = 10, ROWS = 20;
export type Rng = () => number;
export interface Piece { t: Kind; r: number; x: number; y: number }
export interface TetrisState {
  board: number[][]; cur: Piece | null; queue: Kind[]; hold: Kind | null; canHold: boolean;
  score: number; lines: number; level: number; over: boolean; rng: Rng;
  /** statistics for the screen: how many of each pieces fell */
  pieces: number; startLevel: number;
}

/** the spawn shape of each piece in its box (1 = block); rotations are made by turning the box clockwise */
const BASE: Record<Kind, string[]> = {
  I: ["....", "####", "....", "...."],
  O: [".##.", ".##.", "....", "...."],
  T: [".#.", "###", "..."],
  S: [".##", "##.", "..."],
  Z: ["##.", ".##", "..."],
  J: ["#..", "###", "..."],
  L: ["..#", "###", "..."],
};
const rotCW = (m: number[][]): number[][] => m.map((_, y) => m.map((__, x) => m[m.length - 1 - x][y]));
const SHAPES: Record<Kind, [number, number][][]> = {} as never;
for (const k of KINDS) {
  let m: number[][] = BASE[k].map((row) => [...row].map((c) => (c === "#" ? 1 : 0)));
  const rots: [number, number][][] = [];
  for (let r = 0; r < 4; r++) {
    const cells: [number, number][] = [];
    m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
    rots.push(cells);
    if (k !== "O") m = rotCW(m);
  }
  SHAPES[k] = rots;
}
export const shape = (k: Kind, r: number): [number, number][] => SHAPES[k][((r % 4) + 4) % 4];
export const kindIndex = (k: Kind) => KINDS.indexOf(k) + 1;

/** SRS wall kicks (x right, y UP in the tables; applied with y flipped), key "from>to" */
const K_JLSTZ: Record<string, [number, number][]> = {
  "0>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]], "1>0": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  "1>2": [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]], "2>1": [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  "2>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]], "3>2": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  "3>0": [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]], "0>3": [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
};
const K_I: Record<string, [number, number][]> = {
  "0>1": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]], "1>0": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
  "1>2": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]], "2>1": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
  "2>3": [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]], "3>2": [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
  "3>0": [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]], "0>3": [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
};
export const kicks = (k: Kind, from: number, to: number): [number, number][] =>
  k === "O" ? [[0, 0]] : (k === "I" ? K_I : K_JLSTZ)[`${from}>${to}`].map(([x, y]) => [x, -y] as [number, number]);

export const emptyBoard = (): number[][] => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
export const cellsOf = (p: Piece): [number, number][] => shape(p.t, p.r).map(([x, y]) => [p.x + x, p.y + y]);
export function collides(board: number[][], p: Piece): boolean {
  return cellsOf(p).some(([x, y]) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x] !== 0));
}

/** 7-bag: every seven pieces are the seven kinds in a random order */
export function refill(s: { queue: Kind[]; rng: Rng }) {
  while (s.queue.length < 7) {
    const bag = [...KINDS];
    for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(s.rng() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    s.queue.push(...bag);
  }
}
const spawnPiece = (t: Kind): Piece => ({ t, r: 0, x: 3, y: 0 });
function spawn(s: TetrisState, t?: Kind) {
  refill(s);
  const k = t ?? s.queue.shift()!;
  refill(s);
  const p = spawnPiece(k);
  s.pieces++;
  if (collides(s.board, p)) { s.cur = p; s.over = true; return; }
  s.cur = p;
}
export function newTetris(rng: Rng = Math.random, startLevel = 1): TetrisState {
  const s: TetrisState = { board: emptyBoard(), cur: null, queue: [], hold: null, canHold: true, score: 0, lines: 0, level: startLevel, over: false, rng, pieces: 0, startLevel };
  spawn(s);
  return s;
}
export const nextKinds = (s: TetrisState, n = 3): Kind[] => s.queue.slice(0, n);

export function move(s: TetrisState, dx: number, dy = 0): boolean {
  if (s.over || !s.cur) return false;
  const q = { ...s.cur, x: s.cur.x + dx, y: s.cur.y + dy };
  if (collides(s.board, q)) return false;
  s.cur = q; return true;
}
/** dir +1 clockwise, -1 counter-clockwise; tries the SRS kicks in order */
export function rotate(s: TetrisState, dir: 1 | -1): boolean {
  if (s.over || !s.cur) return false;
  const from = s.cur.r, to = (from + dir + 4) % 4;
  for (const [kx, ky] of kicks(s.cur.t, from, to)) {
    const q = { ...s.cur, r: to, x: s.cur.x + kx, y: s.cur.y + ky };
    if (!collides(s.board, q)) { s.cur = q; return true; }
  }
  return false;
}
export const grounded = (s: TetrisState): boolean => !!s.cur && collides(s.board, { ...s.cur, y: s.cur.y + 1 });
export function ghostY(s: TetrisState): number {
  if (!s.cur) return 0;
  let y = s.cur.y;
  while (!collides(s.board, { ...s.cur, y: y + 1 })) y++;
  return y;
}
export const LINE_POINTS = [0, 100, 300, 500, 800];
export const levelFor = (lines: number, start = 1) => start + Math.floor(lines / 10);
/** gravity: milliseconds for one row at a level */
export const dropMs = (level: number) => Math.max(50, Math.round(800 * Math.pow(0.82, level - 1)));

export interface LockResult { cleared: number[]; points: number; levelUp: boolean; over: boolean }
/** locks the falling piece into the board, clears full rows, scores, brings the next piece */
export function lock(s: TetrisState): LockResult {
  if (!s.cur || s.over) return { cleared: [], points: 0, levelUp: false, over: s.over };
  const idx = kindIndex(s.cur.t);
  let lockOut = false;
  for (const [x, y] of cellsOf(s.cur)) { if (y >= 0) s.board[y][x] = idx; else lockOut = true; }
  const cleared: number[] = [];
  s.board.forEach((row, y) => { if (row.every((c) => c)) cleared.push(y); });
  if (cleared.length) {
    s.board = [...Array.from({ length: cleared.length }, () => new Array(COLS).fill(0)), ...s.board.filter((_, y) => !cleared.includes(y))];
  }
  const points = LINE_POINTS[cleared.length] * s.level;
  s.score += points; s.lines += cleared.length;
  const before = s.level;
  s.level = Math.max(s.level, levelFor(s.lines, s.startLevel));
  s.canHold = true;
  if (lockOut) s.over = true; else spawn(s);
  return { cleared, points, levelUp: s.level > before, over: s.over };
}
/** one gravity step: down one row, or lock when it cannot go down */
export function gravity(s: TetrisState): LockResult | null {
  if (move(s, 0, 1)) return null;
  return lock(s);
}
export function softDrop(s: TetrisState): boolean {
  if (!move(s, 0, 1)) return false;
  s.score += 1; return true;
}
export function hardDrop(s: TetrisState): LockResult {
  if (!s.cur || s.over) return { cleared: [], points: 0, levelUp: false, over: s.over };
  const gy = ghostY(s);
  s.score += 2 * (gy - s.cur.y);
  s.cur = { ...s.cur, y: gy };
  return lock(s);
}
export function holdPiece(s: TetrisState): boolean {
  if (s.over || !s.cur || !s.canHold) return false;
  const k = s.cur.t, prev = s.hold;
  s.hold = k; s.canHold = false;
  if (prev) { s.pieces--; spawn(s, prev); } else spawn(s);
  s.canHold = false;
  return true;
}
