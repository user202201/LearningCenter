/** Pure rules of the bubble shooter (泡泡龙): a hex grid, flood fill, floating bubbles, the flight of a shot, the 12 levels. No DOM. */
export const COLS = 10;
export const ROWS = 15;
/** a bubble resting in this row (or lower) loses the game */
export const LOSE_ROW = 11;
export const ROWH = Math.sqrt(3) / 2;
/** 0 = empty, 1..6 = colour */
export type Grid = number[][];
export type Cell = [number, number];

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** an empty field: even rows hold COLS cells, odd rows COLS-1 (shifted by half a cell) */
export const emptyGrid = (): Grid => Array.from({ length: ROWS }, (_, r) => new Array(r % 2 === 0 ? COLS : COLS - 1).fill(0));
export const cloneGrid = (g: Grid): Grid => g.map((r) => r.slice());
/** 0 = a long row, 1 = a short row (shifted half a cell to the right) */
export const rowOff = (g: Grid, r: number): number => (g[r].length === COLS ? 0 : 1);
export const cellPos = (g: Grid, r: number, c: number) => ({ x: c + 0.5 + rowOff(g, r) * 0.5, y: 0.5 + r * ROWH });

export function neighbors(g: Grid, r: number, c: number): Cell[] {
  const out: Cell[] = [];
  if (c > 0) out.push([r, c - 1]);
  if (c < g[r].length - 1) out.push([r, c + 1]);
  const x = c + rowOff(g, r) / 2;
  for (const dr of [-1, 1]) {
    const rr = r + dr;
    if (rr < 0 || rr >= g.length) continue;
    const o = rowOff(g, rr);
    for (const cx of [x - 0.5, x + 0.5]) {
      const cc = cx - o / 2;
      if (Number.isInteger(cc) && cc >= 0 && cc < g[rr].length) out.push([rr, cc]);
    }
  }
  return out;
}

/** the connected cells of the same colour as (r, c), in the order of a flood fill (nearest first) */
export function cluster(g: Grid, r: number, c: number): Cell[] {
  const col = g[r][c];
  if (!col) return [];
  const seen = new Set<number>([r * 100 + c]);
  const out: Cell[] = [[r, c]];
  for (let i = 0; i < out.length; i++) {
    for (const [rr, cc] of neighbors(g, out[i][0], out[i][1])) {
      const k = rr * 100 + cc;
      if (!seen.has(k) && g[rr][cc] === col) { seen.add(k); out.push([rr, cc]); }
    }
  }
  return out;
}

/** bubbles that no longer hang (by any path) from the ceiling */
export function floating(g: Grid): Cell[] {
  const seen = new Set<number>();
  const q: Cell[] = [];
  g[0].forEach((v, c) => { if (v) { seen.add(c); q.push([0, c]); } });
  for (let i = 0; i < q.length; i++) {
    for (const [rr, cc] of neighbors(g, q[i][0], q[i][1])) {
      const k = rr * 100 + cc;
      if (!seen.has(k) && g[rr][cc]) { seen.add(k); q.push([rr, cc]); }
    }
  }
  const out: Cell[] = [];
  g.forEach((row, r) => row.forEach((v, c) => { if (v && !seen.has(r * 100 + c)) out.push([r, c]); }));
  return out;
}

export const count = (g: Grid): number => g.reduce((n, row) => n + row.filter(Boolean).length, 0);
export const colorsPresent = (g: Grid): number[] => [...new Set(g.flat().filter(Boolean))].sort();
export const lowestRow = (g: Grid): number => { let m = -1; g.forEach((row, r) => { if (row.some(Boolean)) m = r; }); return m; };

/** a bubble of a colour that is still on the board (so the shooter can never hold a colour nobody can use) */
export function nextColor(rng: () => number, g: Grid, fallback: number): number {
  const p = colorsPresent(g);
  return p.length ? p[Math.floor(rng() * p.length)] : fallback;
}

/** after a shot: the next bubble moves to the shooter, a new next one is drawn; both are always colours that are still on the board */
export function advanceQueue(rng: () => number, g: Grid, nxt: number, fallback = 1): { cur: number; nxt: number } {
  const present = colorsPresent(g);
  const cur = present.length === 0 || present.includes(nxt) ? nxt : nextColor(rng, g, fallback);
  return { cur, nxt: nextColor(rng, g, fallback) };
}

/** the empty cell where a bubble that stopped at (x, y) comes to rest */
export function snap(g: Grid, x: number, y: number): Cell | null {
  const mid = Math.round((y - 0.5) / ROWH);
  let best: Cell | null = null, bd = 1e9;
  for (let r = Math.max(0, mid - 1); r <= Math.min(g.length - 1, mid + 1); r++) {
    for (let c = 0; c < g[r].length; c++) {
      if (g[r][c]) continue;
      if (r > 0 && !neighbors(g, r, c).some(([a, b]) => g[a][b])) continue;
      const p = cellPos(g, r, c);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = [r, c]; }
    }
  }
  return best;
}

export interface Trace { points: { x: number; y: number }[]; end: { x: number; y: number }; cell: Cell | null; bounces: number }

/**
 * The flight of a bubble shot from (x, y) at `angle` (radians, 0 = right, PI/2 = straight up): it bounces off the side walls and stops at the ceiling
 * or when it touches a bubble. Units: one bubble = 1. Returns the corner points (for drawing and moving) and the cell it ends in.
 */
export function trace(g: Grid, x0: number, y0: number, angle: number): Trace {
  let x = x0, y = y0, dx = Math.cos(angle), dy = -Math.sin(angle), bounces = 0;
  const pts = [{ x, y }];
  const STEP = 0.04, HIT = 0.9 * 0.9;
  for (let i = 0; i < 6000; i++) {
    x += dx * STEP; y += dy * STEP;
    if (x < 0.5) { x = 1 - x; dx = -dx; bounces++; pts.push({ x: 0.5, y }); }
    else if (x > COLS - 0.5) { x = 2 * (COLS - 0.5) - x; dx = -dx; bounces++; pts.push({ x: COLS - 0.5, y }); }
    let stop = y <= 0.5;
    if (!stop) {
      const r0 = Math.max(0, Math.round((y - 0.5) / ROWH) - 2), r1 = Math.min(g.length - 1, Math.round((y - 0.5) / ROWH) + 2);
      for (let r = r0; r <= r1 && !stop; r++) for (let c = 0; c < g[r].length; c++) {
        if (!g[r][c]) continue;
        const p = cellPos(g, r, c);
        if ((p.x - x) ** 2 + (p.y - y) ** 2 < HIT) { stop = true; break; }
      }
    }
    if (stop) {
      const cell = snap(g, x, Math.max(0.5, y));
      const end = cell ? cellPos(g, cell[0], cell[1]) : { x, y };
      pts.push(end);
      return { points: pts, end, cell, bounces };
    }
  }
  const end = { x, y };
  pts.push(end);
  return { points: pts, end, cell: null, bounces };
}

export interface ShotResult { grid: Grid; popped: Cell[]; fell: Cell[]; score: number; placed: Cell }
export const popScore = (n: number): number => 10 * n + 10 * Math.max(0, n - 3);
export const fallScore = (n: number): number => (n ? 20 * n + 10 * n * (n - 1) / 2 : 0);

/** puts a bubble of `color` into `cell` and resolves it: 3+ of a colour pop, whatever then hangs in the air falls */
export function place(g: Grid, cell: Cell, color: number): ShotResult {
  const grid = cloneGrid(g);
  grid[cell[0]][cell[1]] = color;
  let popped: Cell[] = [], fell: Cell[] = [], score = 0;
  const cl = cluster(grid, cell[0], cell[1]);
  if (cl.length >= 3) {
    popped = cl;
    for (const [r, c] of cl) grid[r][c] = 0;
    fell = floating(grid);
    for (const [r, c] of fell) grid[r][c] = 0;
    score = popScore(popped.length) + fallScore(fell.length);
  }
  return { grid, popped, fell, score, placed: cell };
}

/** the ceiling comes down: a new row appears on top (of the other length), everything moves one row down */
export function dropCeiling(g: Grid, rng: () => number, colors: number[]): Grid {
  const top = g[0].length === COLS ? COLS - 1 : COLS;
  const row = Array.from({ length: top }, () => colors[Math.floor(rng() * colors.length)] || 1);
  const ng = [row, ...cloneGrid(g).slice(0, ROWS - 1)];
  return ng;
}

// ---------------------------------------------------------------- levels
export type Shape = "full" | "pyramid" | "diamond" | "stripes" | "checker" | "hourglass" | "zigzag" | "frame" | "columns" | "heart" | "waves" | "crown";
export interface LevelSpec { rows: number; colors: number; shape: Shape; misses: number; clump: number }
const half = (c: number, n: number) => Math.abs(c - (n - 1) / 2);
const SHAPES: Record<Shape, (r: number, c: number, n: number, w: number) => boolean> = {
  full: () => true,
  pyramid: (r, c, n, w) => half(c, w) <= (w / 2) * (1 - r / (n + 1)) + 0.3,
  diamond: (r, c, n, w) => half(c, w) <= (w / 2) * (1 - Math.abs(r - (n - 1) / 2) / ((n + 1) / 2)) + 0.4,
  stripes: (r, c) => r % 3 !== 2 || c % 4 === 0,
  checker: (r, c) => (r + c) % 2 === 0 || r === 0,
  hourglass: (r, c, n, w) => half(c, w) >= (w / 2) * (1 - Math.abs(r - (n - 1) / 2) / ((n + 1) / 2)) * 0.9 - 0.5 || r === 0 || r === n - 1,
  zigzag: (r, c) => ((c + (Math.floor(r / 2) % 2 ? 3 : 0)) % 6) < 4 || r === 0,
  frame: (r, c, n, w) => r === 0 || r === n - 1 || c < 2 || c >= w - 2,
  columns: (r, c) => r === 0 || c % 3 !== 1,
  heart: (r, c, n, w) => { const x = (c - (w - 1) / 2) / (w / 2), y = 1 - (r / Math.max(1, n - 1)) * 1.7; return (x * x + (y * 1.0 - Math.sqrt(Math.abs(x))) ** 2) <= 1.1 || r === 0; },
  waves: (r, c) => r === 0 || ((c + r * 2) % 5) < 3,
  crown: (r, c, n, w) => r < 2 || (c % 2 === 0 && r < n),
};
export const LEVELS: LevelSpec[] = [
  { rows: 4, colors: 3, shape: "full", misses: 7, clump: 0.45 },
  { rows: 5, colors: 3, shape: "pyramid", misses: 7, clump: 0.4 },
  { rows: 6, colors: 4, shape: "stripes", misses: 6, clump: 0.4 },
  { rows: 6, colors: 4, shape: "diamond", misses: 6, clump: 0.35 },
  { rows: 6, colors: 4, shape: "checker", misses: 6, clump: 0.3 },
  { rows: 7, colors: 5, shape: "columns", misses: 5, clump: 0.35 },
  { rows: 7, colors: 5, shape: "zigzag", misses: 5, clump: 0.3 },
  { rows: 7, colors: 5, shape: "hourglass", misses: 5, clump: 0.3 },
  { rows: 8, colors: 5, shape: "frame", misses: 5, clump: 0.3 },
  { rows: 8, colors: 6, shape: "waves", misses: 4, clump: 0.3 },
  { rows: 8, colors: 6, shape: "heart", misses: 4, clump: 0.25 },
  { rows: 9, colors: 6, shape: "crown", misses: 4, clump: 0.25 },
];

/** the starting layout of a level (every bubble hangs from the ceiling; deterministic for a seed) */
export function buildLevel(spec: LevelSpec, seed: number): Grid {
  const rng = mulberry32(seed);
  const g = emptyGrid();
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < g[r].length; c++) {
      if (!SHAPES[spec.shape](r, c, spec.rows, g[r].length)) continue;
      let col = 1 + Math.floor(rng() * spec.colors);
      if (rng() < spec.clump) {
        const left = c > 0 ? g[r][c - 1] : 0, up = r > 0 ? g[r - 1][Math.min(c, g[r - 1].length - 1)] : 0;
        const pick = rng() < 0.5 ? left : up;
        if (pick) col = pick;
      }
      g[r][c] = col;
    }
  }
  for (const [r, c] of floating(g)) g[r][c] = 0;
  return g;
}
/** the number of shots a good player needs; 3 stars up to it, 2 up to 1.5 times, otherwise 1 */
export const par = (g: Grid): number => Math.ceil(count(g) * 0.55);
export function starsFor(shots: number, parShots: number): number { return shots <= parShots ? 3 : shots <= Math.ceil(parShots * 1.5) ? 2 : 1; }
