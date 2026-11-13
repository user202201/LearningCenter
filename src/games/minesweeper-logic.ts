/** Minesweeper: the pure rules (no screen, no timer). Cells are numbered row by row: i = y * cols + x. */
export type Rng = () => number;
export type Status = "ready" | "play" | "won" | "lost";
export const HIDDEN = 0, OPEN = 1, FLAG = 2;
export interface MineState {
  cols: number; rows: number; mines: number;
  mine: Uint8Array;   // 1 = a mine is here (empty until the first open)
  count: Uint8Array;  // number of mines among the neighbours
  st: Uint8Array;     // HIDDEN / OPEN / FLAG
  status: Status;
  opened: number;     // cells opened so far
  boom: number;       // index of the mine that was stepped on (-1 none)
}
export interface OpenResult { opened: number[]; boom: boolean; won: boolean; first: boolean }

export function newBoard(cols: number, rows: number, mines: number): MineState {
  const n = cols * rows;
  if (cols < 2 || rows < 2 || mines < 1 || mines > n - 1) throw new Error("bad board");
  return { cols, rows, mines, mine: new Uint8Array(n), count: new Uint8Array(n), st: new Uint8Array(n), status: "ready", opened: 0, boom: -1 };
}
export function neighbours(s: { cols: number; rows: number }, i: number): number[] {
  const x = i % s.cols, y = (i - x) / s.cols, r: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < s.cols && ny < s.rows) r.push(ny * s.cols + nx);
  }
  return r;
}
/** recompute every number from the mines (also used by tests that set mines by hand) */
export function recount(s: MineState): void {
  for (let i = 0; i < s.mine.length; i++) { let c = 0; for (const j of neighbours(s, i)) c += s.mine[j]; s.count[i] = c; }
}
/** put the mines after the first open: never on the cell and, when there is room, never on its neighbours */
export function placeMines(s: MineState, safe: number, rng: Rng = Math.random): void {
  const n = s.cols * s.rows;
  let banned = new Set<number>([safe, ...neighbours(s, safe)]);
  if (n - banned.size < s.mines) banned = new Set([safe]);
  const pool: number[] = [];
  for (let i = 0; i < n; i++) if (!banned.has(i)) pool.push(i);
  for (let k = 0; k < s.mines; k++) { const j = k + Math.floor(rng() * (pool.length - k)); [pool[k], pool[j]] = [pool[j], pool[k]]; s.mine[pool[k]] = 1; }
  recount(s);
}
export const flagsUsed = (s: MineState): number => { let c = 0; for (const v of s.st) if (v === FLAG) c++; return c; };
export const minesLeft = (s: MineState): number => s.mines - flagsUsed(s);

/** open a hidden cell (flood fill over zeros); the first open of a game places the mines */
export function open(s: MineState, i: number, rng: Rng = Math.random): OpenResult {
  const res: OpenResult = { opened: [], boom: false, won: false, first: false };
  if (s.status === "won" || s.status === "lost" || s.st[i] !== HIDDEN) return res;
  if (s.status === "ready") { placeMines(s, i, rng); s.status = "play"; res.first = true; }
  if (s.mine[i]) { s.st[i] = OPEN; s.boom = i; s.status = "lost"; res.boom = true; return res; }
  const stack = [i];
  s.st[i] = OPEN; s.opened++; res.opened.push(i);
  while (stack.length) {
    const c = stack.pop()!;
    if (s.count[c] !== 0) continue;
    for (const j of neighbours(s, c)) if (s.st[j] === HIDDEN) { s.st[j] = OPEN; s.opened++; res.opened.push(j); stack.push(j); }
  }
  return finish(s, res);
}
function finish(s: MineState, res: OpenResult): OpenResult {
  if (s.status === "play" && s.opened === s.cols * s.rows - s.mines) {
    s.status = "won"; res.won = true;
    for (let i = 0; i < s.mine.length; i++) if (s.mine[i]) s.st[i] = FLAG;
  }
  return res;
}
/** flag / unflag a hidden cell; false when nothing changed */
export function toggleFlag(s: MineState, i: number): boolean {
  if (s.status === "won" || s.status === "lost" || s.st[i] === OPEN) return false;
  s.st[i] = s.st[i] === FLAG ? HIDDEN : FLAG;
  return true;
}
/** tap on an opened number whose flags match it: open every hidden neighbour that is not flagged (a wrong flag can blow up) */
export function chord(s: MineState, i: number, rng: Rng = Math.random): OpenResult {
  const res: OpenResult = { opened: [], boom: false, won: false, first: false };
  if (s.status !== "play" || s.st[i] !== OPEN || s.count[i] === 0) return res;
  const nb = neighbours(s, i);
  if (nb.filter((j) => s.st[j] === FLAG).length !== s.count[i]) return res;
  for (const j of nb) {
    if (s.st[j] !== HIDDEN) continue;
    const r = open(s, j, rng);
    res.opened.push(...r.opened);
    if (r.boom) { res.boom = true; res.won = false; return res; }
    if (r.won) res.won = true;
  }
  return res;
}
/** a flag that sits on a cell without a mine (shown after a loss) */
export const wrongFlag = (s: MineState, i: number): boolean => s.st[i] === FLAG && !s.mine[i];

export interface Level { cols: number; rows: number; mines: number }
/** the three sizes; the big one is turned on its side on a wide board area */
export function levelDims(level: number, landscape: boolean): Level {
  if (level <= 0) return { cols: 8, rows: 8, mines: 10 };
  if (level === 1) return { cols: 10, rows: 10, mines: 15 };
  return landscape ? { cols: 16, rows: 12, mines: 35 } : { cols: 12, rows: 16, mines: 35 };
}
