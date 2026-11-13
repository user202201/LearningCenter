/**
 * Maze: the pure rules. A maze is a PERFECT maze (a spanning tree of the cell grid: every cell reachable, exactly one route between two cells), made at random by one of
 * three algorithms from a seed; the player's route is a list of cells (`path`) that starts at the start cell and only ever follows open passages. No DOM in here.
 * Coordinates of a finger are in cell units (x = 0 .. w, y = 0 .. h), so the screen only has to divide by the size of a cell.
 */
export const N = 1, E = 2, S = 4, W = 8;
export const DIRS = [
  { bit: N, opp: S, dx: 0, dy: -1 },
  { bit: E, opp: W, dx: 1, dy: 0 },
  { bit: S, opp: N, dx: 0, dy: 1 },
  { bit: W, opp: E, dx: -1, dy: 0 },
] as const;
export type Algo = "backtracker" | "prim" | "kruskal";
export const ALGOS: Algo[] = ["backtracker", "prim", "kruskal"];
export type SizeKey = "easy" | "normal" | "hard" | "expert";
export const SIZES: { key: SizeKey; n: number }[] = [{ key: "easy", n: 8 }, { key: "normal", n: 14 }, { key: "hard", n: 22 }, { key: "expert", n: 30 }];
export const MIN_CELL = 11;
export const MAX_HINTS = 3, HINT_LEN = 6, UNDO_CELLS = 10;

export interface Maze {
  w: number; h: number;
  /** per cell the passages that are open (bits N E S W) */
  open: Uint8Array;
  start: number; exit: number;
  /** the side of the board (0 N, 1 E, 2 S, 3 W) the start / exit are on */
  startSide: number; exitSide: number;
  algo: Algo; seed: number;
}

export type Rng = () => number;
/** a small seeded random generator (mulberry32) */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = <T>(a: T[], rng: Rng) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const cellX = (m: { w: number }, c: number) => c % m.w;
export const cellY = (m: { w: number }, c: number) => Math.floor(c / m.w);
/** the neighbour of a cell in a direction (0..3), or -1 outside the board */
export function neighbour(w: number, h: number, c: number, d: number): number {
  const x = (c % w) + DIRS[d].dx, y = Math.floor(c / w) + DIRS[d].dy;
  return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x;
}
const carve = (open: Uint8Array, w: number, a: number, d: number, b: number) => { open[a] |= DIRS[d].bit; open[b] |= DIRS[d].opp; };

function backtracker(w: number, h: number, rng: Rng): Uint8Array {
  const open = new Uint8Array(w * h), seen = new Uint8Array(w * h), stack = [Math.floor(rng() * w * h)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const opts: number[] = [];
    for (let d = 0; d < 4; d++) { const n = neighbour(w, h, c, d); if (n >= 0 && !seen[n]) opts.push(d); }
    if (!opts.length) { stack.pop(); continue; }
    const d = opts[Math.floor(rng() * opts.length)], n = neighbour(w, h, c, d);
    carve(open, w, c, d, n); seen[n] = 1; stack.push(n);
  }
  return open;
}
function prim(w: number, h: number, rng: Rng): Uint8Array {
  const open = new Uint8Array(w * h), seen = new Uint8Array(w * h);
  const front: [number, number][] = [];   // (cell inside, direction to a cell outside)
  const add = (c: number) => { seen[c] = 1; for (let d = 0; d < 4; d++) { const n = neighbour(w, h, c, d); if (n >= 0 && !seen[n]) front.push([c, d]); } };
  add(Math.floor(rng() * w * h));
  while (front.length) {
    const i = Math.floor(rng() * front.length), [c, d] = front[i];
    front[i] = front[front.length - 1]; front.pop();
    const n = neighbour(w, h, c, d);
    if (n < 0 || seen[n]) continue;
    carve(open, w, c, d, n); add(n);
  }
  return open;
}
function kruskal(w: number, h: number, rng: Rng): Uint8Array {
  const open = new Uint8Array(w * h), parent = Array.from({ length: w * h }, (_, i) => i);
  const find = (a: number): number => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const edges: [number, number][] = [];
  for (let c = 0; c < w * h; c++) { if (neighbour(w, h, c, 1) >= 0) edges.push([c, 1]); if (neighbour(w, h, c, 2) >= 0) edges.push([c, 2]); }
  shuffle(edges, rng);
  for (const [c, d] of edges) {
    const n = neighbour(w, h, c, d), a = find(c), b = find(n);
    if (a === b) continue;
    parent[a] = b; carve(open, w, c, d, n);
  }
  return open;
}
const GENERATORS: Record<Algo, (w: number, h: number, rng: Rng) => Uint8Array> = { backtracker, prim, kruskal };

/** BFS from a cell: the distance of every cell (-1 = not reached) and the cell it was reached from */
export function bfs(m: Pick<Maze, "w" | "h" | "open">, from: number): { dist: Int32Array; prev: Int32Array } {
  const dist = new Int32Array(m.w * m.h).fill(-1), prev = new Int32Array(m.w * m.h).fill(-1), q = [from];
  dist[from] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (let d = 0; d < 4; d++) {
      if (!(m.open[c] & DIRS[d].bit)) continue;
      const n = neighbour(m.w, m.h, c, d);
      if (n >= 0 && dist[n] < 0) { dist[n] = dist[c] + 1; prev[n] = c; q.push(n); }
    }
  }
  return { dist, prev };
}
/** the route (cells, both ends included) from one cell to another; [] when there is none */
export function solve(m: Pick<Maze, "w" | "h" | "open">, from: number, to: number): number[] {
  const { dist, prev } = bfs(m, from);
  if (dist[to] < 0) return [];
  const out = [to];
  while (out[out.length - 1] !== from) out.push(prev[out[out.length - 1]]);
  return out.reverse();
}

/** the cells of one side of the board (0 N, 1 E, 2 S, 3 W) */
export function sideCells(w: number, h: number, side: number): number[] {
  const out: number[] = [];
  if (side === 0) for (let x = 0; x < w; x++) out.push(x);
  else if (side === 2) for (let x = 0; x < w; x++) out.push((h - 1) * w + x);
  else if (side === 1) for (let y = 0; y < h; y++) out.push(y * w + w - 1);
  else for (let y = 0; y < h; y++) out.push(y * w);
  return out;
}

/** start and exit on opposite sides of the board, at random places, and far apart: the best of a few random starts */
function pickEnds(w: number, h: number, open: Uint8Array, rng: Rng): { start: number; exit: number; startSide: number; exitSide: number } {
  const startSide = Math.floor(rng() * 4), exitSide = (startSide + 2) % 4;
  const starts = sideCells(w, h, startSide), exits = sideCells(w, h, exitSide);
  let best = { start: starts[0], exit: exits[0], len: -1 };
  for (let k = 0; k < 20; k++) {
    const s = starts[Math.floor(rng() * starts.length)], { dist } = bfs({ w, h, open }, s);
    // among the cells of the far side take one of the farthest few (not always the very farthest, so that the exit is not always in a corner)
    const ranked = exits.slice().sort((a, b) => dist[b] - dist[a]).slice(0, Math.max(1, Math.ceil(exits.length / 4)));
    const e = ranked[Math.floor(rng() * ranked.length)];
    if (dist[e] > best.len) best = { start: s, exit: e, len: dist[e] };
  }
  return { start: best.start, exit: best.exit, startSide, exitSide };
}

/** a new maze; the algorithm is chosen at random from the seed unless given */
export function generateMaze(w: number, h: number, seed: number, algo?: Algo): Maze {
  const rng = mulberry32(seed);
  const a = algo ?? ALGOS[Math.floor(rng() * ALGOS.length)];
  const open = GENERATORS[a](w, h, rng);
  return { w, h, open, ...pickEnds(w, h, open, rng), algo: a, seed };
}

/** the dimension a size gets on a screen whose board has `availPx` pixels at most: cells are never smaller than `minCell` */
export const fitDim = (nominal: number, availPx: number, minCell = MIN_CELL) => Math.max(6, Math.min(nominal, Math.floor(availPx / minCell)));

/** checks of a maze (used by the tests and as a guard): a spanning tree, open passages in pairs, connected */
export function verify(m: Maze): string[] {
  const bad: string[] = [], n = m.w * m.h;
  let passages = 0;
  for (let c = 0; c < n; c++) {
    if (!m.open[c]) bad.push("isolated cell " + c);
    for (let d = 0; d < 4; d++) {
      if (!(m.open[c] & DIRS[d].bit)) continue;
      const o = neighbour(m.w, m.h, c, d);
      if (o < 0) { bad.push("passage out of the board at " + c); continue; }
      if (!(m.open[o] & DIRS[d].opp)) bad.push("one-way passage " + c);
      passages++;
    }
  }
  if (passages / 2 !== n - 1) bad.push(`passages ${passages / 2} != cells - 1 (${n - 1})`);
  if (bfs(m, 0).dist.some((x) => x < 0)) bad.push("not connected");
  return bad;
}

// ---------------------------------------------------------------- drawing

export const cellAt = (m: Pick<Maze, "w" | "h">, x: number, y: number): number => {
  const cx = Math.floor(x), cy = Math.floor(y);
  return cx < 0 || cy < 0 || cx >= m.w || cy >= m.h || !Number.isFinite(x + y) ? -1 : cy * m.w + cx;
};
const dirTo = (m: Pick<Maze, "w">, a: number, b: number): number => {
  const dx = (b % m.w) - (a % m.w), dy = Math.floor(b / m.w) - Math.floor(a / m.w);
  if (dx === 0 && dy === -1) return 0;
  if (dx === 1 && dy === 0) return 1;
  if (dx === 0 && dy === 1) return 2;
  if (dx === -1 && dy === 0) return 3;
  return -1;
};
export const canGo = (m: Pick<Maze, "w" | "open">, a: number, b: number) => { const d = dirTo(m, a, b); return d >= 0 && (m.open[a] & DIRS[d].bit) !== 0; };

export interface DrawResult { path: number[]; moved: boolean; blocked: boolean; won: boolean; retracted: boolean }
type Step = "same" | "moved" | "blocked" | "ignored";

/** the head of the line goes to the cell `c` (which the finger is in): one cell forward, one back, or a diagonal cut across a corner when both ways round it are open */
function advance(m: Maze, path: number[], c: number): Step {
  const head = path[path.length - 1];
  if (c === head) return "same";
  if (head === m.exit) {   // the line ends at the exit; only going back is allowed
    const i = path.lastIndexOf(c);
    if (i >= 0 && i < path.length - 1) { path.length = i + 1; return "moved"; }
    return "ignored";
  }
  const d = dirTo(m, head, c);
  if (d >= 0) {
    if (!(m.open[head] & DIRS[d].bit)) return "blocked";
    if (path.length >= 2 && path[path.length - 2] === c) { path.pop(); return "moved"; }
    if (path.includes(c)) { path.length = path.lastIndexOf(c) + 1; return "moved"; }   // (cannot happen in a tree, kept as a guard)
    path.push(c); return "moved";
  }
  const hx = head % m.w, hy = Math.floor(head / m.w), cx = c % m.w, cy = Math.floor(c / m.w);
  if (Math.abs(hx - cx) === 1 && Math.abs(hy - cy) === 1) {   // diagonal: through one of the two cells between, if both of its passages are open
    for (const mid of [hy * m.w + cx, cy * m.w + hx]) {
      if (canGo(m, head, mid) && canGo(m, mid, c)) {
        if (path.length >= 2 && path[path.length - 2] === mid) { path.pop(); return "moved"; }   // (going back: the finger skipped the cell in between)
        if (path.includes(c) && c !== mid) { path.length = path.lastIndexOf(c) + 1; return "moved"; }
        path.push(mid, c); return "moved";
      }
    }
    return "blocked";
  }
  const i = path.lastIndexOf(c);   // the finger is further back on the line (a fast move backwards): cut the line there
  if (i >= 0) { path.length = i + 1; return "moved"; }
  return "ignored";
}

/**
 * The finger moves from (ax, ay) to (bx, by) (cell units). The movement is cut into steps of a fifth of a cell so that no wall can be jumped, however fast the finger is:
 * the line follows cell by cell and stops at the first wall of the straight segment. Returns a NEW path.
 */
export function drawSegment(m: Maze, pathIn: readonly number[], ax: number, ay: number, bx: number, by: number): DrawResult {
  const path = pathIn.slice();
  const res: DrawResult = { path, moved: false, blocked: false, won: path[path.length - 1] === m.exit, retracted: false };
  const dist = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.ceil(dist / 0.2));
  for (let i = 1; i <= n; i++) {
    const c = cellAt(m, ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n);
    if (c < 0) continue;
    const before = path.length, r = advance(m, path, c);
    if (r === "moved") { res.moved = true; if (path.length < before) res.retracted = true; }
    if (r === "blocked") { res.blocked = true; break; }
  }
  res.won = path[path.length - 1] === m.exit;
  return res;
}
/** one cell with the keyboard: forward when the passage is open, back when it is the cell the line came from */
export function stepDir(m: Maze, pathIn: readonly number[], dir: number): DrawResult {
  const path = pathIn.slice(), head = path[path.length - 1], n = neighbour(m.w, m.h, head, dir);
  const res: DrawResult = { path, moved: false, blocked: false, won: head === m.exit, retracted: false };
  if (n < 0 || !(m.open[head] & DIRS[dir].bit)) { res.blocked = true; return res; }
  if (path.length >= 2 && path[path.length - 2] === n) { path.pop(); res.moved = true; res.retracted = true; }
  else if (head !== m.exit) { path.push(n); res.moved = true; }
  res.won = path[path.length - 1] === m.exit;
  return res;
}
/** where a touch may take up the line: on the end of the line (or close to it) = continue, on the start cell = begin again */
export function touchTarget(m: Maze, path: readonly number[], x: number, y: number): "head" | "start" | null {
  const head = path[path.length - 1], hx = (head % m.w) + 0.5, hy = Math.floor(head / m.w) + 0.5;
  if (Math.hypot(x - hx, y - hy) <= 0.9) return "head";
  if (cellAt(m, x, y) === m.start) return "start";
  return null;
}
/** the last `n` cells of the line are taken back (the start stays) */
export const undoCells = (path: readonly number[], n = UNDO_CELLS): number[] => path.slice(0, Math.max(1, path.length - n));
/** the next cells of the right route from the end of the line (at most `len`, the cell the line is on not counted) */
export const hintCells = (m: Maze, path: readonly number[], len = HINT_LEN): number[] => solve(m, path[path.length - 1], m.exit).slice(1, 1 + len);
/** stars of a finished maze: 3, one less for each hint, none when the answer was shown */
export const starsFor = (hints: number, answerShown: boolean): number => (answerShown ? 0 : Math.max(1, 3 - hints));
export const isRoute = (m: Maze, path: readonly number[]): boolean => path.length > 0 && path[0] === m.start && path.every((c, i) => i === 0 || canGo(m, path[i - 1], c)) && new Set(path).size === path.length;
export const fmtTime = (ms: number): string => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
