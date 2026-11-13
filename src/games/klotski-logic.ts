/**
 * Klotski (华容道), pure rules: no DOM. Board 4 wide x 5 high, x = column 0..3, y = row 0..4 (row 4 is the bottom).
 * Pieces: C = 曹操 (2x2), G = 关羽 (2 wide, 1 high), Z / R / M / H = 张飞 / 赵云 / 马超 / 黄忠 (1 wide, 2 high), s = soldier (1x1).
 * COUNTING RULE (the usual one, with which 横刀立马 needs 81): ONE MOVE = ONE piece goes from where it is to any other place it can reach by sliding
 * through free cells, any number of cells, also around corners (a drag with turns). Consecutive slides of the same piece are one move.
 * The goal: 曹操 stands on the two bottom-middle cells (x 1..2, y 3..4), i.e. in front of the exit.
 */
export const W = 4, H = 5;
export type Kind = "C" | "G" | "Z" | "R" | "M" | "H" | "s";
export interface Piece { id: number; kind: Kind; x: number; y: number; w: number; h: number }
export interface Level { id: string; name: string; rows: string[] }

export const NAMES: Record<Kind, string> = { C: "曹操", G: "关羽", Z: "张飞", R: "赵云", M: "马超", H: "黄忠", s: "小兵" };
const SIZE: Record<Kind, [number, number]> = { C: [2, 2], G: [2, 1], Z: [1, 2], R: [1, 2], M: [1, 2], H: [1, 2], s: [1, 1] };
/** the shape class of a kind: pieces of one class are interchangeable (the four generals Z R M H are all "vertical", the soldiers all alike) */
const CLASS: Record<Kind, string> = { C: "C", G: "G", Z: "V", R: "V", M: "V", H: "V", s: "s" };

/** the levels: five lines of four letters, "." is empty. Easy first. The classic names are the usual openings; the layouts are checked by a BFS (tests/e2e/45-klotski.cjs). */
export const LEVELS: Level[] = [
  { id: "l01", name: "初出茅庐", rows: ["GG.Z", "RsMZ", "RHMs", "sHCC", "s.CC"] },
  { id: "l02", name: "小试牛刀", rows: ["ZRGG", "ZRsM", ".sHM", "CCH.", "CCss"] },
  { id: "l03", name: "渐入佳境", rows: [".ZGG", "RZsM", "RsHM", "CCH.", "CCss"] },
  { id: "l04", name: "左右布兵", rows: ["sCCs", "ZCCR", "Z..R", "MssH", "MGGH"] },
  { id: "l05", name: "雨声淅沥", rows: ["sCCs", "ZCCR", "ZssR", "M..H", "MGGH"] },
  { id: "l06", name: "桃花园中", rows: ["sCCs", "sCCs", ".GG.", "ZMHR", "ZMHR"] },
  { id: "l07", name: "近在咫尺", rows: ["sCCs", ".CC.", "sGGs", "ZMHR", "ZMHR"] },
  { id: "l08", name: "齐头并进", rows: ["sCCs", "sCCs", "ZGGR", "ZMHR", ".MH."] },
  { id: "l09", name: "水泄不通", rows: ["sCCs", "sCCs", "ZMHR", "ZMHR", ".GG."] },
  { id: "l10", name: "层层设防", rows: ["ZCCR", "ZCCR", "MssH", "MssH", ".GG."] },
  { id: "l11", name: "兵分三路", rows: ["ZCCR", "ZCCR", "ssss", "MGGH", "M..H"] },
  { id: "l12", name: "捷足先登", rows: ["ZCCR", "ZCCR", "MssH", "M..H", "sGGs"] },
  { id: "l13", name: "指挥若定", rows: ["ZCCR", "ZCCR", "MssH", "MGGH", "s..s"] },
  { id: "l14", name: "将拥曹营", rows: ["sCCs", "ZCCR", "ZGGR", "MssH", "M..H"] },
  { id: "l15", name: "围而不歼", rows: ["ZCCR", "ZCCR", ".GG.", "sMHs", "sMHs"] },
  { id: "l16", name: "插翅难飞", rows: ["ZCCR", "ZCCR", ".GG.", "MssH", "MssH"] },
  { id: "l17", name: "横刀立马", rows: ["ZCCR", "ZCCR", "MGGH", "MssH", "s..s"] },
];

export function parseLayout(rows: string[]): Piece[] {
  const seen = new Set<number>(), out: Piece[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = rows[y][x];
    if (ch === "." || seen.has(y * W + x)) continue;
    const kind = ch as Kind, [w, h] = SIZE[kind];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen.add((y + j) * W + x + i);
    out.push({ id: out.length, kind, x, y, w, h });
  }
  return out;
}
/** the board as 20 letters of shape classes; this is the state key of the search (interchangeable pieces give the same key) */
export function keyOf(ps: Piece[]): string {
  const g = new Array<string>(W * H).fill(".");
  for (const p of ps) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) g[(p.y + j) * W + p.x + i] = CLASS[p.kind];
  return g.join("");
}
/** a layout is valid when it has the ten standard pieces, nothing overlaps and exactly two cells are empty */
export function validLayout(rows: string[]): boolean {
  if (rows.length !== H || rows.some((r) => r.length !== W)) return false;
  const ps = parseLayout(rows), count: Record<string, number> = {};
  for (const p of ps) count[p.kind] = (count[p.kind] ?? 0) + 1;
  const g = new Set<number>();
  for (const p of ps) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) { if (g.has((p.y + j) * W + p.x + i)) return false; g.add((p.y + j) * W + p.x + i); }
  if (g.size !== 18) return false;
  const want: Record<string, number> = { C: 1, G: 1, Z: 1, R: 1, M: 1, H: 1, s: 4 };
  if (Object.keys(want).some((k) => count[k] !== want[k])) return false;
  // every letter of the rows must be exactly the cells of its pieces (a "G" must really be two cells side by side ...)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((rows[y][x] === ".") === g.has(y * W + x)) return false;
  return true;
}
export const solved = (ps: Piece[]): boolean => { const c = ps.find((p) => p.kind === "C")!; return c.x === 1 && c.y === 3; };

const occupancy = (ps: Piece[], skip = -1): boolean[] => {
  const g = new Array<boolean>(W * H).fill(false);
  for (const p of ps) if (p.id !== skip) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) g[(p.y + j) * W + p.x + i] = true;
  return g;
};
/** every place (top-left cell) the piece can reach by sliding through free cells, any path; the place it stands on is not in the list */
export function reachable(ps: Piece[], id: number): { x: number; y: number }[] {
  const p = ps.find((q) => q.id === id)!, g = occupancy(ps, id);
  const free = (x: number, y: number) => {
    if (x < 0 || y < 0 || x + p.w > W || y + p.h > H) return false;
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) if (g[(y + j) * W + x + i]) return false;
    return true;
  };
  const seen = new Set<number>([p.y * W + p.x]), q = [[p.x, p.y]], out: { x: number; y: number }[] = [];
  for (let k = 0; k < q.length; k++) {
    const [x, y] = q[k];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, c = ny * W + nx;
      if (!seen.has(c) && free(nx, ny)) { seen.add(c); q.push([nx, ny]); out.push({ x: nx, y: ny }); }
    }
  }
  return out;
}
export const moveTo = (ps: Piece[], id: number, x: number, y: number): Piece[] => ps.map((p) => (p.id === id ? { ...p, x, y } : p));
export const clone = (ps: Piece[]): Piece[] => ps.map((p) => ({ ...p }));
/** can this piece go straight (no corner) in this direction by this many cells? (the keyboard / swipe use it) */
export const slideTargets = (ps: Piece[], id: number) => reachable(ps, id);

/** the pieces of a key (ids = order of appearance), enough to make moves in the search */
function decode(key: string): Piece[] {
  const seen = new Set<number>(), out: Piece[] = [];
  for (let c = 0; c < W * H; c++) {
    const ch = key[c];
    if (ch === "." || seen.has(c)) continue;
    const x = c % W, y = (c / W) | 0;
    const [w, h] = ch === "C" ? [2, 2] : ch === "G" ? [2, 1] : ch === "V" ? [1, 2] : [1, 1];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen.add((y + j) * W + x + i);
    out.push({ id: out.length, kind: ch === "V" ? "Z" : (ch as Kind), x, y, w, h });
  }
  return out;
}
const keyGoal = (k: string) => k[17] === "C" && k[18] === "C";   // bottom row, middle two cells: 曹操 covers (1,3)-(2,4)
function neighbours(key: string): string[] {
  const ps = decode(key), res: string[] = [];
  for (const p of ps) for (const t of reachable(ps, p.id)) res.push(keyOf(moveTo(ps, p.id, t.x, t.y)));
  return res;
}
/** the minimal number of moves (rule above) and one best path (the keys of the boards), or null when it can not be solved. BFS over boards. */
export function solve(ps: Piece[]): { moves: number; path: string[] } | null {
  const start = keyOf(ps);
  if (keyGoal(start)) return { moves: 0, path: [start] };
  const prev = new Map<string, string>([[start, ""]]);
  let layer = [start];
  for (let d = 1; layer.length; d++) {
    const next: string[] = [];
    for (const k of layer) for (const n of neighbours(k)) {
      if (prev.has(n)) continue;
      prev.set(n, k);
      if (keyGoal(n)) { const path = [n]; for (let c = k; c; c = prev.get(c)!) path.push(c); return { moves: d, path: path.reverse() }; }
      next.push(n);
    }
    layer = next;
  }
  return null;
}
export const minMoves = (rows: string[]): number | null => solve(parseLayout(rows))?.moves ?? null;
/** the piece and the place of the first move of a best path from this board (a hint), or null when it is solved / unsolvable */
export function hint(ps: Piece[]): { id: number; x: number; y: number } | null {
  const s = solve(ps);
  if (!s || s.path.length < 2) return null;
  const nextKey = s.path[1];
  for (const p of ps) for (const t of reachable(ps, p.id)) if (keyOf(moveTo(ps, p.id, t.x, t.y)) === nextKey) return { id: p.id, ...t };
  return null;
}
/** stars from the moves: 3 = as few as possible, 2 = at most 30 % more (at least 2 more), 1 = solved */
export function starsFor(moves: number, min: number): number {
  if (moves <= min) return 3;
  return moves <= min + Math.max(2, Math.ceil(min * 0.3)) ? 2 : 1;
}
