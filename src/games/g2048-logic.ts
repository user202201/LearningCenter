/** 2048: the rules, pure (no DOM). A grid is rows of numbers, 0 = empty. */
export type Dir = "U" | "D" | "L" | "R";
export type Grid = number[][];
export interface G48State { n: number; grid: Grid; score: number; target: number; won: boolean; over: boolean }
/** where a tile went in one move: from / to are [row, col]; `merged` = it joined another tile there (the pair becomes one tile of double value) */
export interface Trace { from: [number, number]; to: [number, number]; merged: boolean }
export interface MoveResult { moved: boolean; gained: number; trace: Trace[]; merges: [number, number][]; spawned: { r: number; c: number; v: number } | null; reached: boolean }

/** the tile to make: 2048 on 4 x 4 and 5 x 5, 256 on the easy 3 x 3 board (it can not hold more than 1024) */
export const targetFor = (n: number) => (n === 3 ? 256 : 2048);
export const emptyGrid = (n: number): Grid => Array.from({ length: n }, () => Array(n).fill(0));
export const cloneGrid = (g: Grid): Grid => g.map((r) => r.slice());

/** slide one line towards index 0: every tile moves as far as it can and merges with an equal neighbour AT MOST ONCE per move ([2,2,2,2] -> [4,4,0,0]) */
export function slideLine(line: number[]): { out: number[]; gained: number; src: number[][] } {
  const n = line.length, out = Array(n).fill(0), src: number[][] = Array.from({ length: n }, () => []);
  let gained = 0, w = 0, lastMerged = false;
  for (let i = 0; i < n; i++) {
    const v = line[i];
    if (!v) continue;
    if (w > 0 && !lastMerged && out[w - 1] === v) { out[w - 1] = v * 2; gained += v * 2; src[w - 1].push(i); lastMerged = true; }
    else { out[w] = v; src[w] = [i]; w++; lastMerged = false; }
  }
  return { out, gained, src };
}

/** the move without the new tile (pure: the grid is not changed) */
export function slide(grid: Grid, dir: Dir): { grid: Grid; gained: number; moved: boolean; trace: Trace[]; merges: [number, number][] } {
  const n = grid.length, res = emptyGrid(n), trace: Trace[] = [], merges: [number, number][] = [];
  let gained = 0, moved = false;
  for (let k = 0; k < n; k++) {
    // the k-th line, read from the side the tiles move to
    const pos = (i: number): [number, number] => (dir === "L" ? [k, i] : dir === "R" ? [k, n - 1 - i] : dir === "U" ? [i, k] : [n - 1 - i, k]);
    const line = Array.from({ length: n }, (_, i) => { const [r, c] = pos(i); return grid[r][c]; });
    const s = slideLine(line);
    gained += s.gained;
    for (let i = 0; i < n; i++) {
      const [r, c] = pos(i); res[r][c] = s.out[i];
      s.src[i].forEach((j) => { trace.push({ from: pos(j), to: [r, c], merged: s.src[i].length > 1 }); if (j !== i) moved = true; });
      if (s.src[i].length > 1) merges.push([r, c]);
    }
  }
  return { grid: res, gained, moved, trace, merges };
}

export const emptyCells = (g: Grid): [number, number][] => { const o: [number, number][] = []; g.forEach((row, r) => row.forEach((v, c) => { if (!v) o.push([r, c]); })); return o; };
/** a new 2 (90 %) or 4 (10 %) on a random empty cell; null when the board is full */
export function spawn(g: Grid, rng: () => number = Math.random): { r: number; c: number; v: number } | null {
  const e = emptyCells(g); if (!e.length) return null;
  const [r, c] = e[Math.min(e.length - 1, Math.floor(rng() * e.length))], v = rng() < 0.9 ? 2 : 4;
  g[r][c] = v; return { r, c, v };
}
export function canMove(g: Grid): boolean {
  const n = g.length;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!g[r][c]) return true;
    if (c + 1 < n && g[r][c] === g[r][c + 1]) return true;
    if (r + 1 < n && g[r][c] === g[r + 1][c]) return true;
  }
  return false;
}
export const maxTile = (g: Grid) => Math.max(0, ...g.flat());

export function newGame(n = 4, rng: () => number = Math.random): G48State {
  const s: G48State = { n, grid: emptyGrid(n), score: 0, target: targetFor(n), won: false, over: false };
  spawn(s.grid, rng); spawn(s.grid, rng);
  return s;
}

/** one move: slide, merge, and only when something changed a new tile; updates the state (score, won when the target tile appears for the first time, over when nothing can move) */
export function play(s: G48State, dir: Dir, rng: () => number = Math.random): MoveResult {
  const none: MoveResult = { moved: false, gained: 0, trace: [], merges: [], spawned: null, reached: false };
  if (s.over) return none;
  const r = slide(s.grid, dir);
  if (!r.moved) return none;
  s.grid = r.grid; s.score += r.gained;
  const spawned = spawn(s.grid, rng);
  let reached = false;
  if (!s.won && maxTile(s.grid) >= s.target) { s.won = true; reached = true; }
  if (!canMove(s.grid)) s.over = true;
  return { moved: true, gained: r.gained, trace: r.trace, merges: r.merges, spawned, reached };
}
