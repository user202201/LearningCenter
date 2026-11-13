/**
 * 编程 (coding): ALL levels as data (docs/coding-curriculum.md), the map families (one program must work on every map of a family) and the random
 * practice generators. Pure: no screens, no storage. Written by a model from memory; a teacher must proofread.
 *
 * A level = the allowed blocks, a size limit, the goal and a REFERENCE SOLUTION written in the pseudo-code syntax (`parse` of coding-ast.ts).
 * The map of most levels is made FROM the solution (`route: true`: the robot walks the solution on an empty plane, the cells it visits become floor, the cells
 * where it takes / lights become stars / lamps, the last cell the flag, everything else wall), so map and solution can never disagree. Families make a new map
 * from a seed; the child's program is judged on the shown map and on five hidden ones (the level teaches generality).
 */
import { Expr, PaletteKind, Program, countBlocks, parse, exprText } from "./coding-ast";
import { Goal, Machine, State, World, makeGrid, makeTurtle, cloneState, judgeGoal, DIRS, dirOf } from "./coding-interp";
import { Seg } from "./coding-interp";
import { sameDrawing } from "./coding-turtle";

export interface LevelSpec {
  id: string; world: number; no: number;
  /** the short name of the level (UI text) */
  title: string;
  /** "grid" (default) / "turtle"; other files register their own kinds ("stage", "data", ... see `KINDS`) */
  kind?: string;
  /** extra data of a kind that another file defines (worlds 7-10: coding-levels2.ts) */
  ext?: unknown;
  map?: string[]; start?: { x: number; y: number; dir: number };
  /** make the map from the solution */
  route?: boolean; dir?: number; open?: boolean;
  family?: string; seed?: number;
  goal?: Goal;
  palette: PaletteKind[];
  funcs?: { name: string; param?: string; params?: string[] }[];
  /** the variables the blocks can use */
  vars?: string[];
  /** variables with a value at the start */
  init?: Record<string, number>;
  /** the conditions the condition slots offer (pseudo-code expressions) */
  conds?: string[];
  solution: string;
  /** debugging level: a program with a mistake is given */
  given?: string;
  max: number;
  /** the first level that uses a concept shows its mini-lesson */
  lesson?: string;
  /** an extra line (turtle levels give the lengths) */
  note?: string;
  colors?: boolean; boss?: boolean; debug?: boolean;
}
export interface Level extends LevelSpec {
  sol: Program; givenProg?: Program; par: number;
  /** random practice levels carry their own instance */
  fixed?: Instance;
}
export interface Instance { world: World; state: State; goal: Goal; target?: Seg[]; origin?: { x: number; y: number } }

// ---------- random numbers ----------
export function mulberry32(a: number): () => number {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rint = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));

// ---------- maps from cells ----------
type Cell = { x: number; y: number };
const key = (c: Cell) => `${c.x},${c.y}`;
/** rows of a map: the given cells are floor, everything else (one cell of margin) is wall; marks put a character on a cell */
export function rowsFromCells(cells: Cell[], marks: Record<string, string>, start: Cell, dir: number, open = false): { rows: string[]; start: { x: number; y: number; dir: number } } {
  const xs = cells.map((c) => c.x), ys = cells.map((c) => c.y);
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1, minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
  const floor = new Set(cells.map(key));
  const rows: string[] = [];
  for (let y = minY; y <= maxY; y++) {
    let s = "";
    for (let x = minX; x <= maxX; x++) {
      const k = `${x},${y}`;
      const inside = x > minX && x < maxX && y > minY && y < maxY;
      s += marks[k] ?? (floor.has(k) || (open && inside) ? "." : "#");
    }
    rows.push(s);
  }
  return { rows, start: { x: start.x - minX, y: start.y - minY, dir } };
}

/** walks `prog` on an empty plane: the visited cells, where it took / lit, where it ended */
export function traceRoute(prog: Program, dir: number, init?: Record<string, number>): { cells: Cell[]; takes: Set<string>; lights: Set<string>; end: Cell; start: Cell } {
  const N = 121, rows = Array.from({ length: N }, () => ".".repeat(N));
  const { world, state } = makeGrid(rows, { x: 60, y: 60, dir });
  state.vars = { ...(init ?? {}) };
  const m = new Machine(prog, world, state, { budget: 50000, lenient: true });
  const cells: Cell[] = [{ x: 60, y: 60 }], takes = new Set<string>(), lights = new Set<string>();
  const seen = new Set([key(cells[0])]);
  for (;;) {
    const info = m.step();
    if (!info) break;
    const c = { x: m.state.x, y: m.state.y };
    if (!seen.has(key(c))) { seen.add(key(c)); cells.push(c); }
    if (info.t === "take") takes.add(key(c));
    if (info.t === "light") lights.add(key(c));
  }
  return { cells, takes, lights, end: { x: m.state.x, y: m.state.y }, start: { x: 60, y: 60 } };
}
export function mapFromRoute(prog: Program, dir: number, goal: Goal, open = false, init?: Record<string, number>): { rows: string[]; start: { x: number; y: number; dir: number } } {
  const t = traceRoute(prog, dir, init);
  const marks: Record<string, string> = {};
  for (const k of t.takes) marks[k] = "*";
  for (const k of t.lights) if (!marks[k]) marks[k] = "L";
  if (goal.flag && !marks[key(t.end)]) marks[key(t.end)] = "F";
  return rowsFromCells(t.cells, marks, t.start, dir, open);
}

// ---------- families: a new map from a seed ----------
export interface FamilyOut { rows: string[]; start: { x: number; y: number; dir: number }; vars?: Record<string, number>; goal?: Goal }
const P = (src: string) => parse(src);

/** a straight corridor: len cells (with marks), then the flag, walls round it */
function corridor(len: number, marks: Record<number, string> = {}): FamilyOut {
  const top = "#".repeat(len + 3);
  let mid = "#";
  for (let i = 0; i < len; i++) mid += marks[i] ?? ".";
  mid += "F#";
  return { rows: [top, mid, top], start: { x: 1, y: 1, dir: 1 } };
}
const pickSet = (r: () => number, n: number, min: number): number[] => {
  for (;;) { const s = Array.from({ length: n }, (_, i) => i).filter(() => r() < 0.5); if (s.length >= min) return s; }
};

/** a winding corridor without branches: no two cells that are not neighbours on the path touch each other (so the sensors never mislead) */
function winding(r: () => number, opts: { right?: boolean; segs?: [number, number]; len?: [number, number] }): { cells: Cell[]; corners: { cell: Cell; turn: "left" | "right" }[] } {
  for (let attempt = 0; attempt < 500; attempt++) {
    const nseg = rint(r, ...(opts.segs ?? [4, 6]));
    let pos = { x: 0, y: 0 }, d = 1;
    const cells: Cell[] = [pos];
    const corners: { cell: Cell; turn: "left" | "right" }[] = [];
    let ok = true;
    for (let s = 0; s < nseg && ok; s++) {
      const len = rint(r, ...(opts.len ?? [2, 4]));
      for (let i = 0; i < len; i++) {
        const nx = { x: pos.x + DIRS[d][0], y: pos.y + DIRS[d][1] };
        if (cells.some((c) => c.x === nx.x && c.y === nx.y)) { ok = false; break; }
        // not next to any earlier cell except the one we come from
        if (cells.some((c) => c !== pos && Math.abs(c.x - nx.x) + Math.abs(c.y - nx.y) === 1)) { ok = false; break; }
        cells.push(nx); pos = nx;
      }
      if (s < nseg - 1) { const turn = opts.right || r() < 0.5 ? "right" : "left"; corners.push({ cell: pos, turn }); d = (d + (turn === "right" ? 1 : 3)) % 4; }
    }
    if (ok && cells.length >= 8) return { cells, corners };
  }
  throw new Error("no winding corridor");
}
function windingFamily(r: () => number, o: { right?: boolean; stars?: boolean; lamps?: boolean; colors?: boolean }): FamilyOut {
  const w = winding(r, { right: o.right });
  const marks: Record<string, string> = {};
  const last = w.cells[w.cells.length - 1];
  if (o.colors) for (const c of w.corners) marks[key(c.cell)] = c.turn === "right" ? "r" : "g";
  const free = w.cells.slice(0, -1).filter((c) => !marks[key(c)]);
  if (o.stars) for (const c of free) if (r() < 0.35) marks[key(c)] = "*";
  if (o.lamps) for (const c of free) if (!marks[key(c)] && r() < 0.25) marks[key(c)] = "L";
  if (o.stars && !Object.values(marks).includes("*")) marks[key(free[1])] = "*";
  if (o.lamps && !Object.values(marks).includes("L")) marks[key(free[free.length - 2])] = "L";
  marks[key(last)] = "F";
  return rowsFromCells(w.cells, marks, w.cells[0], 1);
}

/** a perfect maze of n x n rooms (no loops: the right-hand rule always finds the exit); optional stars on the way from the start to the exit */
export function maze(r: () => number, n: number, stars = 0): FamilyOut {
  const S = 2 * n + 1;
  const g = Array.from({ length: S }, () => Array<string>(S).fill("#"));
  const seen = new Set<string>(["0,0"]);
  const stack: [number, number][] = [[0, 0]];
  g[1][1] = ".";
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const nb = DIRS.map(([dx, dy]) => [cx + dx, cy + dy, dx, dy] as const).filter(([x, y]) => x >= 0 && y >= 0 && x < n && y < n && !seen.has(`${x},${y}`));
    if (!nb.length) { stack.pop(); continue; }
    const [nx, ny, dx, dy] = nb[Math.floor(r() * nb.length)];
    g[2 * cy + 1 + dy][2 * cx + 1 + dx] = "."; g[2 * ny + 1][2 * nx + 1] = ".";
    seen.add(`${nx},${ny}`); stack.push([nx, ny]);
  }
  // the exit: the farthest room from the start (breadth first); the path to it
  const dist = new Map<string, number>([["1,1", 0]]), from = new Map<string, string>();
  const q: [number, number][] = [[1, 1]];
  for (let i = 0; i < q.length; i++) {
    const [x, y] = q[i];
    for (const [dx, dy] of DIRS) { const nx = x + dx, ny = y + dy, k = `${nx},${ny}`; if (g[ny]?.[nx] === "." && !dist.has(k)) { dist.set(k, dist.get(`${x},${y}`)! + 1); from.set(k, `${x},${y}`); q.push([nx, ny]); } }
  }
  const rooms = q.filter(([x, y]) => x % 2 === 1 && y % 2 === 1);
  let best = rooms[0];
  for (const c of rooms) if (dist.get(`${c[0]},${c[1]}`)! > dist.get(`${best[0]},${best[1]}`)!) best = c;
  const path: string[] = [];
  for (let k: string | undefined = `${best[0]},${best[1]}`; k; k = from.get(k)) path.unshift(k);
  const grid = g.map((row) => row.slice());
  grid[best[1]][best[0]] = "F";
  const inner = path.slice(1, -1);
  for (let i = 0; i < stars && inner.length; i++) { const j = Math.floor(r() * inner.length); const [x, y] = inner.splice(j, 1)[0].split(",").map(Number); grid[y][x] = "*"; }
  return { rows: grid.map((row) => row.join("")), start: { x: 1, y: 1, dir: 1 } };
}

type FamilyFn = (seed: number) => FamilyOut;
const rngFor = (name: string, seed: number) => mulberry32(seed * 7919 + name.length * 131 + name.charCodeAt(0));
export const FAMILIES: Record<string, FamilyFn> = {
  line: (s) => corridor(rint(rngFor("line", s), 3, 9)),
  line3: (s) => corridor(rint(rngFor("line3", s), 3, 7)),
  stairs: (s) => { const k = rint(rngFor("stairs", s), 2, 6); const m = mapFromRoute(P(`repeat ${k} { move left move right }`), 1, { flag: true }); return m; },
  starsline: (s) => { const n = rint(rngFor("starsline", s), 3, 7); const marks: Record<number, string> = {}; for (let i = 0; i < n; i++) marks[i] = "*"; return corridor(n, marks); },
  starrand: (s) => { const r = rngFor("starrand", s); const marks: Record<number, string> = {}; for (const i of pickSet(r, 7, 2)) marks[i] = "*"; return corridor(7, marks); },
  lamprand: (s) => { const r = rngFor("lamprand", s); const marks: Record<number, string> = {}; for (const i of pickSet(r, 7, 2)) marks[i] = "L"; return corridor(7, marks); },
  starrun: (s) => { const n = rint(rngFor("starrun", s), 2, 6); const marks: Record<number, string> = {}; for (let i = 0; i < n; i++) marks[i] = "*"; return corridor(n, marks); },
  lshape2: (s) => { const r = rngFor("lshape2", s); return mapFromRoute(P(`repeat ${rint(r, 2, 5)} { move } right repeat ${rint(r, 2, 5)} { move }`), 1, { flag: true }); },
  lshape2lr: (s) => { const r = rngFor("lshape2lr", s); const a = rint(r, 2, 5), t = r() < 0.5 ? "right" : "left"; return mapFromRoute(P(`repeat ${a} { move } ${t} repeat ${rint(r, 2, 5)} { move }`), 1, { flag: true }); },
  spiralR: (s) => windingFamily(rngFor("spiralR", s), { right: true }),
  winding: (s) => windingFamily(rngFor("winding", s), {}),
  colorpath: (s) => windingFamily(rngFor("colorpath", s), { colors: true }),
  windstars: (s) => windingFamily(rngFor("windstars", s), { stars: true }),
  windboth: (s) => windingFamily(rngFor("windboth", s), { stars: true, lamps: true }),
  maze3: (s) => maze(rngFor("maze3", s), 3),
  maze4: (s) => maze(rngFor("maze4", s), 4),
  mazestars: (s) => maze(rngFor("mazestars", s), 4, 3),
  // world 5: numbers given at the start
  sumwalk: (s) => { const r = rngFor("sumwalk", s); const a = rint(r, 2, 5), b = rint(r, 2, 5); return { ...corridor(a + b), vars: { a, b } }; },
  mulwalk: (s) => { const r = rngFor("mulwalk", s); const a = rint(r, 2, 3), b = rint(r, 2, 4); return { ...corridor(a * b), vars: { a, b } }; },
  countdown: (s) => { const n = rint(rngFor("countdown", s), 3, 7); return { ...corridor(n), vars: { n }, goal: { flag: true, vars: { n: 0 } } }; },
  starcount: (s) => { const r = rngFor("starcount", s); const marks: Record<number, string> = {}; for (const i of pickSet(r, 7, 4)) marks[i] = "*"; return { ...corridor(9, marks), goal: { stars: 3, vars: { count: 3 } } }; },
  lampcount: (s) => {
    const r = rngFor("lampcount", s); const n = rint(r, 3, 6);
    const marks: Record<number, string> = { 6: "L" }; for (let i = 0; i < n; i++) marks[i] = "*";
    return { ...corridor(7, marks), goal: { flag: false, stars: "all", lights: n >= 5 ? 1 : 0 } };
  },
};
/** the seeds of the hidden maps a program must also solve (generality) */
export const VARIANT_SEEDS = [101, 102, 103, 104, 105];

// ---------- the levels ----------
const G1 = ["move", "left", "right", "take", "light"] as PaletteKind[];
const F = { flag: true } as Goal;
const FS = { flag: true, stars: "all" } as Goal;
const S = (id: string, world: number, no: number, title: string, o: Omit<LevelSpec, "id" | "world" | "no" | "title">): LevelSpec => ({ id, world, no, title, ...o });
const R1 = { route: true as const };
const W1: LevelSpec[] = [
  S("w1-01", 1, 1, "出发", { ...R1, goal: F, palette: ["move", "left", "right"], solution: "move move move", max: 6, lesson: "seq" }),
  S("w1-02", 1, 2, "转弯", { ...R1, dir: 0, goal: F, palette: ["move", "left", "right"], solution: "move move right move move", max: 8 }),
  S("w1-03", 1, 3, "向左转", { ...R1, dir: 0, goal: F, palette: ["move", "left", "right"], solution: "move move left move move", max: 8 }),
  S("w1-04", 1, 4, "楼梯", { ...R1, goal: F, palette: ["move", "left", "right"], solution: "move left move right move left move right move", max: 12 }),
  S("w1-05", 1, 5, "拿星星", { ...R1, goal: FS, palette: ["move", "left", "right", "take"], solution: "move move take move move", max: 8 }),
  S("w1-06", 1, 6, "两颗星", { ...R1, dir: 0, goal: FS, palette: ["move", "left", "right", "take"], solution: "move take move take right move move", max: 10 }),
  S("w1-07", 1, 7, "开灯", { ...R1, goal: { flag: true, lights: "all" }, palette: ["move", "left", "right", "light"], solution: "move move light move", max: 7 }),
  S("w1-08", 1, 8, "星星和灯", { ...R1, goal: { flag: true, stars: "all", lights: "all" }, palette: G1, solution: "move move take move move right move move right move move light move move", max: 18 }),
  S("w1-09", 1, 9, "找错误", { ...R1, dir: 0, debug: true, goal: F, palette: ["move", "left", "right"], solution: "move move right move move", given: "move move left move move", max: 8 }),
  S("w1-10", 1, 10, "少了一步", { ...R1, dir: 0, debug: true, goal: FS, palette: ["move", "left", "right", "take"], solution: "move take move take right move move", given: "move move right move move", max: 10 }),
  S("w1-11", 1, 11, "顺序错了", { ...R1, debug: true, goal: { flag: true, lights: "all" }, palette: ["move", "left", "right", "light"], solution: "move move light move", given: "move light move move", max: 7 }),
  S("w1-12", 1, 12, "总复习", { ...R1, boss: true, goal: { flag: true, stars: "all", lights: "all" }, palette: G1, solution: "move take move take right move move take right move move left move move light move move", max: 24 }),
];
const G2 = [...G1, "repeat"] as PaletteKind[];
const W2: LevelSpec[] = [
  S("w2-01", 2, 1, "重复走", { ...R1, goal: F, palette: ["move", "repeat"], solution: "repeat 6 { move }", max: 3, lesson: "loop" }),
  S("w2-02", 2, 2, "绕一圈", { ...R1, goal: { stars: "all" }, palette: G2, solution: "repeat 4 { move move take right }", max: 8 }),
  S("w2-03", 2, 3, "楼梯", { ...R1, goal: F, palette: ["move", "left", "right", "repeat"], solution: "repeat 4 { move left move right }", max: 6 }),
  S("w2-04", 2, 4, "收集一排", { ...R1, goal: FS, palette: ["move", "take", "repeat"], solution: "repeat 5 { move take } move", max: 6 }),
  S("w2-05", 2, 5, "隔一格拿星星", { ...R1, goal: FS, palette: ["move", "take", "repeat"], solution: "repeat 3 { move move take } move", max: 6 }),
  S("w2-06", 2, 6, "两个循环", { ...R1, goal: F, palette: ["move", "right", "repeat"], solution: "repeat 3 { move } right repeat 2 { move }", max: 6 }),
  S("w2-07", 2, 7, "方形一圈", { ...R1, goal: { stars: "all" }, palette: ["move", "right", "take", "repeat"], solution: "repeat 4 { repeat 3 { move } take right }", max: 6, lesson: "nest" }),
  S("w2-08", 2, 8, "直到终点", { family: "line", goal: F, palette: ["move", "repeat", "until"], conds: ["onFlag"], solution: "until onFlag { move }", max: 3, lesson: "until" }),
  S("w2-09", 2, 9, "不知道几级台阶", { family: "stairs", goal: F, palette: ["move", "left", "right", "repeat", "until"], conds: ["onFlag"], solution: "until onFlag { move left move right }", max: 6 }),
  S("w2-10", 2, 10, "一路拿星星", { family: "starsline", goal: FS, palette: ["move", "take", "repeat", "until"], conds: ["onFlag"], solution: "until onFlag { take move }", max: 4 }),
  S("w2-11", 2, 11, "两行星星", { ...R1, goal: { stars: "all" }, palette: ["move", "right", "take", "repeat"], solution: "repeat 2 { repeat 3 { take move } take right move right }", max: 9 }),
  S("w2-12", 2, 12, "星星楼梯", { ...R1, goal: FS, palette: ["move", "left", "right", "take", "repeat"], solution: "repeat 4 { move take left move right }", max: 7 }),
  S("w2-13", 2, 13, "绕圈拿星", { ...R1, goal: { stars: "all" }, palette: ["move", "right", "take", "repeat"], solution: "repeat 4 { repeat 2 { move take } right }", max: 7 }),
  S("w2-14", 2, 14, "循环大挑战", { ...R1, boss: true, goal: { flag: true, lights: "all" }, palette: G2, solution: "repeat 3 { move left move right } light repeat 3 { move }", max: 9 }),
];
const WIND = "if pathAhead { move } else { if pathLeft { left } else { right } }";
const MAZE = "if pathRight { right move } else { if pathAhead { move } else { left } }";
const W3: LevelSpec[] = [
  S("w3-01", 3, 1, "有路就走", { family: "line3", goal: F, palette: ["move", "repeat", "if"], conds: ["pathAhead"], solution: "repeat 8 { if pathAhead { move } }", max: 4, lesson: "if" }),
  S("w3-02", 3, 2, "有星星就拿", { family: "starrand", goal: FS, palette: ["move", "take", "repeat", "if"], conds: ["starHere"], solution: "repeat 7 { if starHere { take } move }", max: 5 }),
  S("w3-03", 3, 3, "只右转", { family: "spiralR", goal: F, palette: ["move", "right", "until", "ifelse"], conds: ["onFlag", "pathAhead"], solution: "until onFlag { if pathAhead { move } else { right } }", max: 5, lesson: "ifelse" }),
  S("w3-04", 3, 4, "左右都行", { family: "winding", goal: F, palette: ["move", "left", "right", "until", "ifelse"], conds: ["onFlag", "pathAhead", "pathLeft"], solution: `until onFlag { ${WIND} }`, max: 7 }),
  S("w3-05", 3, 5, "颜色路标", { family: "colorpath", goal: F, palette: ["move", "left", "right", "until", "if"], conds: ["onFlag", "colorIs(r)", "colorIs(g)"], solution: "until onFlag { move if colorIs(r) { right } if colorIs(g) { left } }", max: 7 }),
  S("w3-06", 3, 6, "拐弯收集", { family: "windstars", goal: FS, palette: ["move", "left", "right", "take", "until", "if", "ifelse"], conds: ["onFlag", "starHere", "pathAhead", "pathLeft"], solution: `until onFlag { if starHere { take } ${WIND} }`, max: 9 }),
  S("w3-07", 3, 7, "迷宫", { family: "maze3", goal: F, palette: ["move", "left", "right", "until", "ifelse"], conds: ["onFlag", "pathRight", "pathAhead"], solution: `until onFlag { ${MAZE} }`, max: 8 }),
  S("w3-08", 3, 8, "走到尽头", { family: "lshape2", goal: F, palette: ["move", "right", "while"], conds: ["pathAhead"], solution: "while pathAhead { move } right while pathAhead { move }", max: 6, lesson: "while" }),
  S("w3-09", 3, 9, "星星串", { family: "starrun", goal: FS, palette: ["move", "take", "while"], conds: ["starHere"], solution: "while starHere { take move }", max: 4 }),
  S("w3-10", 3, 10, "路灯", { family: "lamprand", goal: { flag: true, lights: "all" }, palette: ["move", "light", "repeat", "if"], conds: ["lightHere"], solution: "repeat 7 { if lightHere { light } move }", max: 5 }),
  S("w3-11", 3, 11, "两段路", { family: "lshape2lr", goal: F, palette: ["move", "left", "right", "while", "ifelse"], conds: ["pathAhead", "pathRight"], solution: "while pathAhead { move } if pathRight { right } else { left } while pathAhead { move }", max: 8 }),
  S("w3-12", 3, 12, "更大的迷宫", { family: "maze4", seed: 3, goal: F, palette: ["move", "left", "right", "while", "ifelse"], conds: ["!onFlag", "pathRight", "pathAhead"], solution: `while !onFlag { ${MAZE} }`, max: 8 }),
  S("w3-13", 3, 13, "星星和灯", { family: "windboth", goal: { flag: true, stars: "all", lights: "all" }, palette: ["move", "left", "right", "take", "light", "until", "if", "ifelse"], conds: ["onFlag", "starHere", "lightHere", "pathAhead", "pathLeft"], solution: `until onFlag { if starHere { take } if lightHere { light } ${WIND} }`, max: 11 }),
  S("w3-14", 3, 14, "终极迷宫", { family: "mazestars", goal: FS, boss: true, palette: ["move", "left", "right", "take", "until", "if", "ifelse"], conds: ["onFlag", "starHere", "pathRight", "pathAhead"], solution: `until onFlag { if starHere { take } ${MAZE} }`, max: 10 }),
];
const W4: LevelSpec[] = [
  S("w4-01", 4, 1, "第一个积木", { ...R1, goal: { stars: "all" }, palette: ["move", "take", "call"], funcs: [{ name: "step" }], solution: "def step { move take } step step step", max: 5, lesson: "func" }),
  S("w4-02", 4, 2, "调用多次", { ...R1, goal: { stars: "all" }, palette: ["move", "right", "take", "call"], funcs: [{ name: "corner" }], solution: "def corner { move move take right } corner corner corner corner", max: 10 }),
  S("w4-03", 4, 3, "积木里的循环", { ...R1, goal: F, palette: ["move", "left", "right", "repeat", "call"], funcs: [{ name: "side" }], solution: "def side { repeat 3 { move } } side right side left side", max: 7 }),
  S("w4-04", 4, 4, "拐角收集", { ...R1, goal: { stars: "all" }, palette: ["move", "take", "left", "right", "call"], funcs: [{ name: "pair" }], solution: "def pair { take move take move } pair right pair left pair", max: 10 }),
  S("w4-05", 4, 5, "带数字的积木", { ...R1, goal: F, palette: ["move", "left", "right", "repeat", "call"], funcs: [{ name: "walk", param: "n" }], solution: "def walk(n) { repeat n { move } } walk(2) right walk(3) left walk(4)", max: 7, lesson: "param" }),
  S("w4-06", 4, 6, "数字参数二", { ...R1, goal: { stars: "all" }, palette: ["move", "take", "left", "right", "repeat", "call"], funcs: [{ name: "line", param: "n" }], solution: "def line(n) { repeat n { move take } } line(2) right line(3) right line(1)", max: 8 }),
  S("w4-07", 4, 7, "不同的长度", { ...R1, goal: F, palette: ["move", "right", "repeat", "call"], funcs: [{ name: "walk", param: "n" }], solution: "def walk(n) { repeat n { move } } walk(1) right walk(2) right walk(3) right walk(4)", max: 9 }),
  S("w4-08", 4, 8, "螺旋", { ...R1, goal: F, palette: ["move", "right", "repeat", "call"], funcs: [{ name: "walk", param: "n" }, { name: "turn", param: "n" }], solution: "def walk(n) { repeat n { move } } def turn(n) { walk(n) right } turn(1) turn(2) turn(3) turn(4)", max: 8 }),
  S("w4-09", 4, 9, "函数调用函数", { ...R1, goal: { stars: "all" }, palette: ["move", "take", "right", "repeat", "call"], funcs: [{ name: "lap" }], solution: "def lap { repeat 4 { move take right } } lap move move lap", max: 8 }),
  S("w4-10", 4, 10, "把一段做成积木", { ...R1, goal: F, palette: ["move", "left", "right", "repeat", "call"], funcs: [{ name: "hop" }], solution: "def hop { move left move right } hop hop move hop", max: 8 }),
  S("w4-11", 4, 11, "积木复用", { ...R1, goal: { stars: "all" }, palette: ["move", "take", "right", "repeat", "call"], funcs: [{ name: "room", param: "n" }], solution: "def room(n) { repeat n { move take } right } room(2) room(1) room(3)", max: 7 }),
  S("w4-12", 4, 12, "函数大挑战", { ...R1, boss: true, goal: { stars: "all" }, palette: ["move", "take", "right", "repeat", "call"], funcs: [{ name: "side", param: "n" }, { name: "corner", param: "n" }], solution: "def side(n) { repeat n { move take } } def corner(n) { side(n) right } corner(3) corner(2) corner(3) corner(2)", max: 9 }),
];
const VAR = ["move", "take", "light", "repeat", "while", "if", "set", "change"] as PaletteKind[];
const W5: LevelSpec[] = [
  S("w5-01", 5, 1, "计数", { ...R1, goal: { flag: true, vars: { count: 5 } }, palette: ["move", "repeat", "set", "change"], vars: ["count"], solution: "repeat 5 { move change count by 1 }", max: 4, lesson: "var" }),
  S("w5-02", 5, 2, "数星星", { map: ["########", "#******#", "########"], start: { x: 1, y: 1, dir: 1 }, goal: { stars: 4, vars: { count: 4 } }, palette: ["move", "take", "while", "set", "change"], vars: ["count"], conds: ["count < 4", "count < 6"], solution: "while count < 4 { take change count by 1 move }", max: 6 }),
  S("w5-03", 5, 3, "分数", { map: ["########", "#*****.#", "########"], start: { x: 1, y: 1, dir: 1 }, goal: { stars: "all", vars: { score: 10 } }, palette: ["move", "take", "repeat", "set", "change"], vars: ["score"], solution: "repeat 5 { take change score by 2 move }", max: 5 }),
  S("w5-04", 5, 4, "加法", { family: "sumwalk", goal: F, palette: ["move", "repeat", "set"], vars: ["a", "b", "s"], solution: "set s = a + b repeat s { move }", max: 3, lesson: "arith" }),
  S("w5-05", 5, 5, "乘法", { family: "mulwalk", goal: F, palette: ["move", "repeat", "set"], vars: ["a", "b", "s"], solution: "set s = a * b repeat s { move }", max: 3 }),
  S("w5-06", 5, 6, "倒数", { family: "countdown", goal: { flag: true, vars: { n: 0 } }, palette: ["move", "while", "change", "set"], vars: ["n"], conds: ["n > 0", "n < 5"], solution: "while n > 0 { move change n by -1 }", max: 4 }),
  S("w5-07", 5, 7, "拿够就停", { family: "starcount", goal: { stars: 3, vars: { count: 3 } }, palette: ["move", "take", "while", "if", "set", "change"], vars: ["count"], conds: ["count < 3", "starHere", "count < 4"], solution: "while count < 3 { if starHere { take change count by 1 } move }", max: 7 }),
  S("w5-08", 5, 8, "够了才点灯", { family: "lampcount", goal: { stars: "all", lights: 1 }, palette: ["move", "take", "light", "repeat", "if", "change"], vars: ["count"], conds: ["starHere", "count >= 5", "count >= 3"], solution: "repeat 6 { if starHere { take change count by 1 } move } if count >= 5 { light }", max: 8 }),
  S("w5-09", 5, 9, "加倍", { ...R1, goal: F, palette: ["move", "right", "repeat", "set"], vars: ["n"], solution: "set n = 1 repeat 3 { repeat n { move } right set n = n * 2 }", max: 7 }),
  S("w5-10", 5, 10, "综合", { ...R1, boss: true, goal: { flag: true, stars: "all", lights: "all", vars: { score: 8 } }, palette: VAR, vars: ["score"], conds: ["score >= 8", "score >= 4"], solution: "repeat 4 { move take change score by 2 } move if score >= 8 { light } move", max: 10 }),
];
const T = ["fd", "tl", "tr"] as PaletteKind[];
const W6: LevelSpec[] = [
  S("w6-01", 6, 1, "画一条线", { kind: "turtle", palette: ["fd"], solution: "fd 80", max: 2, note: "线长 80。", lesson: "turtle" }),
  S("w6-02", 6, 2, "画直角", { kind: "turtle", palette: T, solution: "fd 60 tr 90 fd 60", max: 4, note: "每条线长 60，转 90 度。" }),
  S("w6-03", 6, 3, "正方形", { kind: "turtle", palette: T, solution: "fd 60 tr 90 fd 60 tr 90 fd 60 tr 90 fd 60 tr 90", max: 8, note: "边长 60。" }),
  S("w6-04", 6, 4, "用循环画正方形", { kind: "turtle", palette: [...T, "repeat"], solution: "repeat 4 { fd 60 tr 90 }", max: 4, note: "边长 60。" }),
  S("w6-05", 6, 5, "三角形", { kind: "turtle", palette: [...T, "repeat"], solution: "repeat 3 { fd 60 tr 120 }", max: 4, note: "边长 60。" }),
  S("w6-06", 6, 6, "正五边形", { kind: "turtle", palette: [...T, "repeat"], solution: "repeat 5 { fd 50 tr 72 }", max: 4, note: "边长 50。" }),
  S("w6-07", 6, 7, "正六边形", { kind: "turtle", palette: [...T, "repeat"], solution: "repeat 6 { fd 50 tr 60 }", max: 4, note: "边长 50。" }),
  S("w6-08", 6, 8, "圆形", { kind: "turtle", palette: [...T, "repeat"], solution: "repeat 36 { fd 6 tr 10 }", max: 4, note: "每一小段长 6。转一圈一共转 360 度。" }),
  S("w6-09", 6, 9, "两个正方形", { kind: "turtle", palette: [...T, "repeat", "penup", "pendown"], solution: "repeat 4 { fd 30 tr 90 } penup tr 90 fd 50 pendown repeat 4 { fd 30 tr 90 }", max: 11, note: "边长 30。两个正方形之间相隔 50。", lesson: "pen" }),
  S("w6-10", 6, 10, "彩色图形", { kind: "turtle", colors: true, palette: [...T, "repeat", "penup", "pendown", "color"], solution: "color red repeat 4 { fd 40 tr 90 } penup tr 90 fd 60 pendown color blue repeat 3 { fd 40 tr 120 }", max: 13, note: "红色正方形和蓝色三角形，边长都是 40。" }),
  S("w6-11", 6, 11, "五角星", { kind: "turtle", palette: [...T, "repeat"], solution: "repeat 5 { fd 80 tr 144 }", max: 4, note: "每条线长 80。" }),
  S("w6-12", 6, 12, "螺旋", { kind: "turtle", palette: [...T, "repeat", "set", "change"], vars: ["n"], solution: "set n = 5 repeat 16 { fd n tl 90 change n by 5 }", max: 6, note: "线长从 5 开始，每次增加 5。" }),
  S("w6-13", 6, 13, "花朵", { kind: "turtle", palette: [...T, "repeat"], solution: "repeat 12 { repeat 4 { fd 40 tr 90 } tr 30 }", max: 6, note: "正方形边长 40。" }),
  S("w6-14", 6, 14, "旋转的三角形", { kind: "turtle", boss: true, colors: true, palette: [...T, "repeat", "color"], solution: "repeat 6 { color red repeat 3 { fd 45 tr 120 } tr 30 color blue repeat 3 { fd 45 tr 120 } tr 30 }", max: 12, note: "三角形边长 45，红色和蓝色轮流出现。" }),
];

export const WORLDS: { id: number; name: string }[] = [
  { id: 1, name: "顺序" }, { id: 2, name: "循环" }, { id: 3, name: "条件" }, { id: 4, name: "函数" }, { id: 5, name: "变量和计数" }, { id: 6, name: "画图" },
];
/** worlds that other files add (coding-levels2.ts: worlds 7-10, ...): call `registerWorlds` once, kept sorted by number */
export function registerWorlds(ws: { id: number; name: string }[]): void {
  for (const w of ws) if (!WORLDS.some((x) => x.id === w.id)) WORLDS.push(w);
  WORLDS.sort((a, b) => a.id - b.id);
}
/** kinds of level that another file defines: how to make the world of a level and how to judge a program on it */
export interface KindHandler { instance(l: Level, seed?: number): Instance; evaluate(l: Level, prog: Program, budget?: number): Evaluation }
export const KINDS: Record<string, KindHandler> = {};

export function build(sp: LevelSpec): Level {
  const sol = parse(sp.solution);
  const par = countBlocks(sol);
  // `max` is a size limit that keeps programs sane; the stars (not the limit) reward the short solution
  return { ...sp, max: Math.max(sp.max, Math.floor(par * 1.5) + 1), sol, givenProg: sp.given ? parse(sp.given) : undefined, par };
}
export const LEVELS: Level[] = [...W1, ...W2, ...W3, ...W4, ...W5, ...W6].map(build);
/** levels that other files add (worlds 7+): they are put after the levels of the worlds before */
export function registerLevels(ls: Level[]): void { for (const l of ls) if (!LEVELS.some((x) => x.id === l.id)) LEVELS.push(l); }
export const levelById = (id: string): Level | undefined => LEVELS.find((l) => l.id === id);
export const levelsOf = (world: number): Level[] => LEVELS.filter((l) => l.world === world);
export const isFamily = (l: Level) => !!l.family;

// ---------- instances: the world a level runs in ----------
const memo = new Map<string, Instance>();
const centered = (segs: Seg[]): { x: number; y: number } => {
  const xs = segs.flatMap((s) => [s.x1, s.x2]), ys = segs.flatMap((s) => [s.y1, s.y2]);
  return { x: -Math.round((Math.min(...xs) + Math.max(...xs)) / 2), y: -Math.round((Math.min(...ys) + Math.max(...ys)) / 2) };
};
/** the world of a level; `seed` picks another map of a family (the hidden variants) */
export function instanceOf(l: Level, seed?: number): Instance {
  if (l.fixed) return l.fixed;
  if (l.kind && KINDS[l.kind]) return KINDS[l.kind].instance(l, seed);
  const k = `${l.id}#${seed ?? ""}`;
  const hit = memo.get(k);
  if (hit) return { ...hit, state: cloneState(hit.state) };
  let inst: Instance;
  if (l.kind === "turtle") {
    const probe = makeTurtle();
    const bare = new Machine(l.sol, probe.world, probe.state, { budget: 100000 }).run();
    const o = centered(bare.state.segs);
    const t = makeTurtle(); t.state.x = o.x; t.state.y = o.y;
    for (const v of l.vars ?? []) t.state.vars[v] = 0;
    const ref = new Machine(l.sol, t.world, t.state, { budget: 100000 }).run();
    inst = { world: t.world, state: t.state, goal: {}, target: ref.state.segs, origin: o };
  } else {
    let rows: string[], start: { x: number; y: number; dir: number } | undefined, vars: Record<string, number> = { ...(l.init ?? {}) }, goal = l.goal ?? F;
    if (l.family) {
      const f = FAMILIES[l.family](seed ?? l.seed ?? 1);
      rows = f.rows; start = f.start; vars = { ...vars, ...(f.vars ?? {}) }; goal = f.goal ?? goal;
    } else if (l.route) {
      const m = mapFromRoute(l.sol, l.dir ?? 1, goal, !!l.open, vars); rows = m.rows; start = m.start;
    } else { rows = l.map!; start = l.start; }
    const g = makeGrid(rows, start);
    g.state.vars = vars;
    inst = { world: g.world, state: g.state, goal };
  }
  memo.set(k, inst);
  return { ...inst, state: cloneState(inst.state) };
}

export interface Evaluation {
  status: Machine["status"]; message: string; steps: number; state: State; won: boolean;
  /** what is still wrong (texts) */
  missing: string[];
  /** a hidden map of the family the program failed on */
  variantFailed?: number;
}
function evalOn(l: Level, prog: Program, inst: Instance, budget?: number): Evaluation {
  const m = new Machine(prog, inst.world, inst.state, { budget });
  const r = m.run();
  if (r.status !== "done") return { ...r, won: false, missing: [r.message] };
  if (l.kind === "turtle") {
    const won = sameDrawing(r.state.segs, inst.target!, { colors: !!l.colors });
    return { ...r, won, missing: won ? [] : [r.state.segs.length ? "画出的图形和目标不一样。" : "还没有画出图形。"] };
  }
  const j = judgeGoal(inst.goal, inst.world, r.state);
  return { ...r, won: j.won, missing: j.missing };
}
/** runs a program on a level: the shown map and, for a family, the hidden maps too */
export function evaluate(l: Level, prog: Program, budget?: number): Evaluation {
  if (l.kind && KINDS[l.kind]) return KINDS[l.kind].evaluate(l, prog, budget);
  const first = evalOn(l, prog, instanceOf(l), budget);
  if (!first.won || !l.family) return first;
  for (const s of VARIANT_SEEDS) {
    const r = evalOn(l, prog, instanceOf(l, s), budget);
    if (!r.won) return { ...r, won: false, variantFailed: s, missing: ["这个程序在另一张地图上没有成功。"] };
  }
  return first;
}

/** stars: 3 = at most par blocks, 2 = at most 1.5 x par, else 1 */
export const starsFor = (blocks: number, par: number): number => (blocks <= par ? 3 : blocks <= par * 1.5 ? 2 : 1);

/** the goal of a level as sentences (UI texts) */
export function goalLines(l: Level, inst: Instance): string[] {
  if (l.kind === "turtle") return ["画出和目标一样的图形。"];
  const g = inst.goal, out: string[] = [];
  if (g.flag) out.push("走到旗子处。");
  if (g.stars !== undefined) out.push(g.stars === "all" ? "收集全部星星。" : `收集 ${g.stars} 颗星星。`);
  if (g.lights !== undefined) out.push(g.lights === "all" ? "点亮所有的灯。" : g.lights === 0 ? "不要点灯。" : `点亮 ${g.lights} 盏灯。`);
  for (const [n, v] of Object.entries(g.vars ?? {})) out.push(`变量 ${n} 的值要等于 ${v}。`);
  if (l.family?.startsWith("lampcount")) return ["收集全部星星。", "星星有 5 颗或更多时点亮灯，否则不要点灯。"];
  return out;
}

/** a condition of a level as a block expression */
export function condExpr(src: string): Expr {
  const p = parse(`if ${src} { move }`);
  return p.main[0].cond!;
}
export const condLabel = exprText;

// ---------- random practice (worlds 1-3) ----------
export interface Challenge { level: Level; key: string }
const NAMES = ["move", "left", "right", "take", "light"] as const;

/** the shortest list of commands: breadth first search over (cell, direction, stars taken, lamps lit); null = cannot be solved */
export function solveGrid(world: World, init: State, goal: Goal, maxLen = 40): string[] | null {
  if (world.kind !== "grid") return null;
  const stars = Object.keys(init.stars), lamps = Object.keys(init.lamps);
  const needS = goal.stars === undefined ? 0 : goal.stars === "all" ? stars.length : goal.stars, needL = goal.lights === undefined ? 0 : goal.lights === "all" ? lamps.length : goal.lights;
  const enc = (x: number, y: number, d: number, sm: number, lm: number) => ((((y * world.w + x) * 4 + d) * 16 + sm) * 4 + lm);
  const seen = new Map<number, [number, string]>();
  const q: [number, number, number, number, number][] = [[init.x, init.y, dirOf(init.rot), 0, 0]];
  seen.set(enc(...(q[0] as [number, number, number, number, number])), [-1, ""]);
  const pop = (m: number) => { let n = 0; while (m) { n += m & 1; m >>= 1; } return n; };
  const done = (x: number, y: number, sm: number, lm: number) => (!goal.flag || world.cells[y][x] === "F") && pop(sm) >= needS && (goal.stars === undefined || goal.stars === "all" || pop(sm) === needS) && pop(lm) >= needL;
  for (let i = 0; i < q.length; i++) {
    const [x, y, d, sm, lm] = q[i];
    const here = enc(x, y, d, sm, lm);
    if (done(x, y, sm, lm)) {
      const out: string[] = [];
      for (let k = here; ; ) { const [prev, c] = seen.get(k)!; if (prev < 0) break; out.unshift(c); k = prev; }
      return out;
    }
    const nexts: [string, [number, number, number, number, number]][] = [];
    const [dx, dy] = DIRS[d];
    if (world.cells[y + dy]?.[x + dx] !== undefined && world.cells[y + dy][x + dx] !== "#") nexts.push(["move", [x + dx, y + dy, d, sm, lm]]);
    nexts.push(["left", [x, y, (d + 3) % 4, sm, lm]], ["right", [x, y, (d + 1) % 4, sm, lm]]);
    const si = stars.indexOf(`${x},${y}`), li = lamps.indexOf(`${x},${y}`);
    if (si >= 0 && !(sm & (1 << si))) nexts.push(["take", [x, y, d, sm | (1 << si), lm]]);
    if (li >= 0 && !(lm & (1 << li))) nexts.push(["light", [x, y, d, sm, lm | (1 << li)]]);
    for (const [c, n] of nexts) {
      const k = enc(...n);
      if (seen.has(k)) continue;
      seen.set(k, [here, c]);
      q.push(n);
    }
  }
  void maxLen;
  return null;
}

const commandsText = (cmds: string[]) => cmds.join(" ");
const instKey = (rows: string[], start: { x: number; y: number; dir: number }, goal: Goal) => JSON.stringify([rows, start, goal]);

function randomRoom(r: () => number): { rows: string[]; start: { x: number; y: number; dir: number }; goal: Goal } {
  const w = rint(r, 5, 7), h = rint(r, 5, 6);
  const g = Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x): string => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? "#" : r() < 0.14 ? "#" : ".")));
  const free = () => { for (;;) { const x = rint(r, 1, w - 2), y = rint(r, 1, h - 2); if (g[y][x] === ".") return { x, y }; } };
  const used = new Set<string>();
  const place = (ch: string) => { for (let i = 0; i < 100; i++) { const c = free(); if (!used.has(key(c))) { used.add(key(c)); g[c.y][c.x] = ch; return c; } } return null; };
  const s = free(); used.add(key(s));
  place("F");
  const nStars = rint(r, 0, 3), nLamp = rint(r, 0, 1);
  for (let i = 0; i < nStars; i++) place("*");
  for (let i = 0; i < nLamp; i++) place("L");
  return { rows: g.map((row) => row.join("")), start: { ...s, dir: rint(r, 0, 3) }, goal: { flag: true, ...(nStars ? { stars: "all" as const } : {}), ...(nLamp ? { lights: "all" as const } : {}) } };
}
const UNITS2 = ["move move right", "move right move left", "move take right", "move left move right", "move move take", "move take move right", "move move left", "move take move take right", "move take left move right", "move move right move left", "move right move move", "move take move left", "move move take right", "move left move left move right", "move take move take", "move right move take"];

/** a random solvable level of world 1, 2 or 3; never the same map as `avoid` (the key of the one before) */
export function randomLevel(world: 1 | 2 | 3, r: () => number, avoid = ""): Challenge {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (world === 1) {
      const room = randomRoom(r);
      const g = makeGrid(room.rows, room.start);
      const cmds = solveGrid(g.world, g.state, room.goal);
      if (!cmds || cmds.length < 4 || cmds.length > 24) continue;
      const k = instKey(room.rows, room.start, room.goal);
      if (k === avoid) continue;
      const sol = commandsText(cmds);
      const lv = build({ id: `r1-${attempt}-${Math.floor(r() * 1e6)}`, world: 1, no: 0, title: "随机挑战", palette: [...NAMES], solution: sol, max: cmds.length + 4, goal: room.goal });
      lv.fixed = { world: g.world, state: g.state, goal: room.goal };
      return { level: lv, key: k };
    }
    if (world === 2) {
      const unit = UNITS2[rint(r, 0, UNITS2.length - 1)], k = rint(r, 3, 7), dir = rint(r, 0, 3);
      const sol = `repeat ${k} { ${unit} }`;
      const prog = parse(sol), hasTake = unit.includes("take");
      const goal: Goal = hasTake ? { stars: "all" } : { flag: true };
      const m = mapFromRoute(prog, dir, goal);
      const g = makeGrid(m.rows, m.start);
      const res = new Machine(prog, g.world, g.state).run();
      if (res.status !== "done" || !judgeGoal(goal, g.world, res.state).won) continue;
      const key2 = instKey(m.rows, m.start, goal);
      if (key2 === avoid) continue;
      const lv = build({ id: `r2-${attempt}-${Math.floor(r() * 1e6)}`, world: 2, no: 0, title: "随机挑战", palette: [...NAMES, "repeat"], solution: sol, max: countBlocks(prog) + 2, goal });
      lv.fixed = { world: g.world, state: g.state, goal };
      return { level: lv, key: key2 };
    }
    const fams = W3.filter((l) => l.family && l.family !== "maze4");
    const base = build(fams[rint(r, 0, fams.length - 1)]);
    const seed = rint(r, 200, 999999);
    const fo = FAMILIES[base.family!](seed);
    const goal = fo.goal ?? base.goal ?? F;
    const g = makeGrid(fo.rows, fo.start);
    g.state.vars = { ...(fo.vars ?? {}) };
    const res = new Machine(base.sol, g.world, g.state).run();
    if (res.status !== "done" || !judgeGoal(goal, g.world, res.state).won) continue;
    const key3 = instKey(fo.rows, fo.start, goal);
    if (key3 === avoid) continue;
    const lv: Level = { ...base, id: `r3-${seed}`, no: 0, title: "随机挑战", family: undefined, boss: false, fixed: { world: g.world, state: g.state, goal } };
    return { level: lv, key: key3 };
  }
  throw new Error("no random level");
}
