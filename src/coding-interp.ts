/**
 * 编程 (coding): the interpreter. Pure and deterministic: no screens, no clock, no randomness.
 * A `Machine` runs a program one block at a time (`step()`), so the screen can light the running block, change the speed, stop and reset; `run()` runs it to
 * the end at once (tests, the dry run before the animation). An explicit stack (no recursion in the host) lets it stop at any step.
 * Endless programs are stopped in two ways: a step budget, and an exact detector: when a `while` / `until` loop comes back to its check with exactly the same
 * state as at the check before (and the check said "go on" both times), the body can never change anything: it is endless.
 * Two worlds share it: the robot on a grid (worlds 1-5) and the turtle with a pen (world 6).
 */
import { Blk, Expr, Program, Func, paramsOf, num, LIST_ARITY } from "./coding-ast";

export interface Seg { x1: number; y1: number; x2: number; y2: number; c: string }
export interface State {
  x: number; y: number;
  /** degrees; grid: a multiple of 90 (0 = up), keeps counting (so a screen can turn the robot the short way); turtle: the heading, clockwise, 0 = up */
  rot: number;
  stars: Record<string, 1>; got: number;
  /** lamps: 0 = not lit yet, 1 = lit */
  lamps: Record<string, 0 | 1>; lit: number;
  vars: Record<string, number>;
  pen: boolean; color: string; segs: Seg[];
  total: { stars: number; lamps: number };
  crashed?: boolean;
  /** phase 2: the lists of the program (items numbered from 1 in the blocks), fixed data of a level (graph, weights), the random seed, how often the scale was used, the stage with its sprites */
  lists?: Record<string, number[]>;
  data?: LevelData;
  seed?: number;
  weighs?: number;
  swaps?: number;
  stage?: StageState;
}
/** fixed data a level gives to the program: a graph (nodes 1..n with positions on a 100 x 100 drawing), weights on a balance scale */
export interface LevelData { graph?: { n: number; edges: [number, number][]; pos: [number, number][] }; weights?: number[] }
export const STAGE_W = 240, STAGE_H = 180, TPS = 20, BEAT_TICKS = 10;
export interface StageSprite { id: string; art: string; x: number; y: number; dir: number; size: number; costume: number; visible: boolean; say: string }
export interface StageState { sprites: StageSprite[]; notes: { tick: number; pitch: number; beats: number; sprite: string }[]; msgs: string[]; keys: Record<string, 1>; tapX: number; tapY: number; tick: number }
export interface GridWorld { kind: "grid"; w: number; h: number; cells: string[] }
export interface TurtleWorld { kind: "turtle" }
/** the worlds of worlds 7-10 (coding-stage.ts, coding-levels2.ts) have no map: the sprites / the lists are in the state */
export interface PlainWorld { kind: "stage" | "data" }
export type World = GridWorld | TurtleWorld | PlainWorld;
export interface Goal { flag?: boolean; stars?: "all" | number; lights?: "all" | number; vars?: Record<string, number>; lists?: Record<string, number[]> }

export type Status = "running" | "done" | "crash" | "infinite" | "budget" | "error";
export const MSG = {
  crash: "前面没有路，机器人撞到了。",
  infinite: "程序一直在循环，不会停下来。",
  budget: "程序运行的步数太多，已经停止。",
  deep: "积木调用得太深，可能在调用自己。",
  range: "列表里没有这一项。",
  div: "不能除以 0。",
  big: "列表太长了。",
  nofunc: "找不到这个积木。",
  noStar: "这里没有星星，不能拿。",
  noLamp: "这里没有灯，不能点亮。",
} as const;

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
export const dirOf = (rot: number): number => ((Math.round(rot / 90) % 4) + 4) % 4;

/** a map in text: # wall, . floor, ^ > v < the robot (and its direction), F flag, * star, L lamp, r g b y coloured floor */
export function makeGrid(rows: string[], start?: { x: number; y: number; dir: number }): { world: GridWorld; state: State } {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const cells: string[] = [];
  const state: State = { x: 0, y: 0, rot: 0, stars: {}, got: 0, lamps: {}, lit: 0, vars: {}, pen: true, color: "black", segs: [], total: { stars: 0, lamps: 0 }, lists: {} };
  rows.forEach((row, y) => {
    let line = "";
    for (let x = 0; x < w; x++) {
      const ch = row[x] ?? "#";
      if (ch === "*") { state.stars[`${x},${y}`] = 1; state.total.stars++; line += "."; }
      else if (ch === "L") { state.lamps[`${x},${y}`] = 0; state.total.lamps++; line += "."; }
      else if ("^>v<".includes(ch)) { state.x = x; state.y = y; state.rot = "^>v<".indexOf(ch) * 90; line += "."; }
      else line += ch;
    }
    cells.push(line);
  });
  if (start) { state.x = start.x; state.y = start.y; state.rot = start.dir * 90; }
  return { world: { kind: "grid", w, h, cells }, state };
}
export function makeTurtle(): { world: TurtleWorld; state: State } {
  return { world: { kind: "turtle" }, state: { x: 0, y: 0, rot: 0, stars: {}, got: 0, lamps: {}, lit: 0, vars: {}, pen: true, color: "black", segs: [], total: { stars: 0, lamps: 0 }, lists: {} } };
}
export const cloneState = (s: State): State => JSON.parse(JSON.stringify(s));

const free = (w: GridWorld, x: number, y: number): boolean => x >= 0 && y >= 0 && x < w.w && y < w.h && w.cells[y][x] !== "#";
const clampNum = (v: number): number => (Number.isFinite(v) ? Math.max(-1e9, Math.min(1e9, v)) : 0);

interface Frame {
  blocks: Blk[]; i: number; kind: "seq" | "rep" | "call" | "for" | "each"; left?: number;
  /** call: the parameters (and nothing else) of this activation */
  locals?: Record<string, number>; fn?: string;
  /** call used inside an expression: where the result goes when the function returns (the frame of the block that holds the call, and the call itself) */
  ret?: { frame: Frame; expr: Expr };
  /** results of the calls inside the expressions of the block that is running in this frame */
  tmp?: Map<Expr, number>;
  last?: Map<number, Set<string>>;
  /** the end of a round of a loop is a point where a stage thread gives the others their turn */
  loop?: boolean;
  /** for / each */
  name?: string; cur?: number; end?: number; items?: number[]; idx?: number;
}
export interface StepInfo { id: string; t: Blk["t"]; /** the answer of a check (if / while / until) */ yes?: boolean; crash?: boolean }
export interface RunOpts {
  budget?: number; maxDepth?: number;
  /** taking / lighting where there is nothing is not a mistake (used to walk a route and find where the stars and lamps are) */
  lenient?: boolean;
  /** the sprite this program belongs to (event scripts of the stage) */
  sprite?: string;
  /** use the given state itself, not a copy (several threads share one stage) */
  shared?: boolean;
  /** which blocks to run (an event script); default: the main program */
  blocks?: Blk[];
}
export const DEFAULT_BUDGET = 20000;
const rand01 = (st: State): number => {
  let a = ((st.seed ?? 1) + 0x6d2b79f5) | 0; st.seed = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export const spriteRadius = (s: StageSprite): number => 20 * (s.size / 100);
const clampX = (v: number) => Math.max(-STAGE_W / 2, Math.min(STAGE_W / 2, v));
const clampY = (v: number) => Math.max(-STAGE_H / 2, Math.min(STAGE_H / 2, v));

export class Machine {
  status: Status = "running";
  message = "";
  steps = 0;
  state: State;
  /** the block that ran last */
  current: string | null = null;
  /** stage threads: ticks to sleep, and whether the thread has given up its turn */
  sleep = 0;
  yielded = false;
  private wake: (() => void) | null = null;
  private stack: Frame[] = [];
  private funcs = new Map<string, Func>();
  private budget: number;
  private maxDepth: number;
  private lenient: boolean;
  private fault = "";
  private cur: Frame | null = null;
  private spriteId: string;
  constructor(private prog: Program, public world: World, init: State, opts: RunOpts = {}) {
    this.state = opts.shared ? init : cloneState(init);
    this.state.lists ??= {};
    this.budget = opts.budget ?? DEFAULT_BUDGET;
    this.maxDepth = opts.maxDepth ?? 60;
    this.lenient = !!opts.lenient;
    this.spriteId = opts.sprite ?? "";
    for (const f of prog.funcs) this.funcs.set(f.name, f);
    this.stack.push({ blocks: opts.blocks ?? prog.main, i: 0, kind: "seq" });
    this.settle();
    if (!this.stack.length) this.status = "done";
  }

  /** the functions that are being run, the newest last (for the call stack panel): name and the values of the parameters */
  callStack(): { name: string; args: Record<string, number> }[] {
    return this.stack.filter((f) => f.kind === "call").map((f) => ({ name: f.fn ?? "", args: { ...(f.locals ?? {}) } }));
  }
  get depth(): number { return this.stack.filter((f) => f.kind === "call").length; }

  private scope(): Frame | null {
    for (let k = this.stack.length - 1; k >= 0; k--) if (this.stack[k].kind === "call") return this.stack[k];
    return null;
  }
  private lookup(name: string): number {
    const c = this.scope();
    if (c?.locals && name in c.locals) return c.locals[name];
    return this.state.vars[name] ?? 0;
  }
  /** variables are global; a parameter is only read (as in phase 1: `set n` inside a function changes the global n, not the parameter) */
  private assign(name: string, v: number): void { this.state.vars[name] = v; }
  private list(name: string): number[] { return (this.state.lists![name] ??= []); }
  private sprite(): StageSprite | undefined { return this.state.stage?.sprites.find((s) => s.id === this.spriteId); }
  private sense(s: string, c?: string): boolean {
    const st = this.state, w = this.world;
    if (w.kind !== "grid") return false;
    const d = dirOf(st.rot);
    const at = (dd: number) => { const [dx, dy] = DIRS[(d + dd + 4) % 4]; return free(w, st.x + dx, st.y + dy); };
    switch (s) {
      case "pathAhead": return at(0);
      case "pathLeft": return at(3);
      case "pathRight": return at(1);
      case "starHere": return !!st.stars[`${st.x},${st.y}`];
      case "onFlag": return w.cells[st.y]?.[st.x] === "F";
      case "lightHere": return st.lamps[`${st.x},${st.y}`] === 0;
      case "colorIs": return w.cells[st.y]?.[st.x] === c;
    }
    return false;
  }
  private bad(msg: string): number { this.fault ||= msg; return 0; }
  evalExpr(e: Expr): number {
    switch (e.k) {
      case "n": return e.v;
      case "v": return this.lookup(e.name);
      case "sense": return this.sense(e.s, e.c) ? 1 : 0;
      case "not": return this.evalExpr(e.a) ? 0 : 1;
      case "bin": {
        const a = this.evalExpr(e.a), b = this.evalExpr(e.b);
        if (e.op === "/" || e.op === "%") return b === 0 ? this.bad(MSG.div) : clampNum(e.op === "/" ? a / b : a % b);
        return clampNum(e.op === "+" ? a + b : e.op === "-" ? a - b : a * b);
      }
      case "cmp": {
        const a = this.evalExpr(e.a), b = this.evalExpr(e.b);
        return (e.op === "<" ? a < b : e.op === "<=" ? a <= b : e.op === ">" ? a > b : e.op === ">=" ? a >= b : e.op === "==" ? a === b : a !== b) ? 1 : 0;
      }
      case "logic": {
        // the second side is only looked at when it can change the answer: `i <= len(xs) and item(xs, i) != x` never reads past the end
        const a = this.evalExpr(e.a) !== 0;
        if (e.op === "and") return a && this.evalExpr(e.b) !== 0 ? 1 : 0;
        return a || this.evalExpr(e.b) !== 0 ? 1 : 0;
      }
      case "call": return this.cur?.tmp?.get(e) ?? 0;
      case "list": {
        const L = this.state.lists?.[e.list] ?? [];
        const a = e.a ? this.evalExpr(e.a) : 0;
        switch (e.f) {
          case "len": return L.length;
          case "sum": return clampNum(L.reduce((x, y) => x + y, 0));
          case "max": return L.length ? Math.max(...L) : 0;
          case "min": return L.length ? Math.min(...L) : 0;
          case "has": return L.includes(a) ? 1 : 0;
          case "count": return L.filter((x) => x === a).length;
          case "indexOf": return L.indexOf(a) + 1;
          case "item": { const i = Math.floor(a); return i >= 1 && i <= L.length ? L[i - 1] : this.bad(MSG.range); }
        }
        return 0;
      }
      case "fn": {
        const v = e.args.map((x) => this.evalExpr(x)), st = this.state;
        switch (e.f) {
          case "floor": return Math.floor(v[0]);
          case "abs": return Math.abs(v[0]);
          case "sqrt": return v[0] < 0 ? 0 : Math.sqrt(v[0]);
          case "round": return Math.round(v[0]);
          case "rand": { const lo = Math.floor(Math.min(v[0], v[1])), hi = Math.floor(Math.max(v[0], v[1])); return lo + Math.floor(rand01(st) * (hi - lo + 1)); }
          case "minOf": return Math.min(v[0], v[1]);
          case "maxOf": return Math.max(v[0], v[1]);
          case "deg": return st.data?.graph ? st.data.graph.edges.filter(([a, b]) => a === v[0] || b === v[0]).length : 0;
          case "nbr": {
            const g = st.data?.graph; if (!g) return 0;
            const ns = g.edges.filter(([a, b]) => a === v[0] || b === v[0]).map(([a, b]) => (a === v[0] ? b : a)).sort((x, y) => x - y);
            return ns[Math.floor(v[1]) - 1] ?? 0;
          }
          case "heavier": {
            const w = st.data?.weights; st.weighs = (st.weighs ?? 0) + 1;
            const i = Math.floor(v[0]), j = Math.floor(v[1]);
            if (!w || i < 1 || j < 1 || i > w.length || j > w.length) return this.bad(MSG.range);
            return w[i - 1] > w[j - 1] ? 1 : 0;
          }
        }
        return 0;
      }
      case "touch": {
        const me = this.sprite(), other = this.state.stage?.sprites.find((s) => s.id === e.s);
        if (!me || !other || !me.visible || !other.visible) return 0;
        return Math.hypot(me.x - other.x, me.y - other.y) < spriteRadius(me) + spriteRadius(other) ? 1 : 0;
      }
      case "keyDown": return this.state.stage?.keys[e.key] ? 1 : 0;
      case "me": {
        const sp = this.sprite(), st = this.state;
        switch (e.p) {
          case "myX": return sp ? Math.round(sp.x) : 0;
          case "myY": return sp ? Math.round(sp.y) : 0;
          case "mySize": return sp?.size ?? 100;
          case "myCostume": return sp?.costume ?? 1;
          case "myDir": return sp ? Math.round(sp.dir) : 0;
          case "tapX": return st.stage?.tapX ?? 0;
          case "tapY": return st.stage?.tapY ?? 0;
          case "floorNum": { const w = this.world; if (w.kind !== "grid") return 0; const ch = w.cells[st.y]?.[st.x]; return ch && ch >= "0" && ch <= "9" ? Number(ch) : 0; }
        }
      }
    }
    return 0;
  }
  private key(): string {
    const s = this.state, c = this.scope();
    return [Math.round(s.x * 1e6), Math.round(s.y * 1e6), Math.round((((s.rot % 360) + 360) % 360) * 1e6), s.got, s.lit, JSON.stringify(s.vars), s.pen, s.color,
      c ? JSON.stringify(c.locals) : "", s.lists && Object.keys(s.lists).length ? JSON.stringify(s.lists) : "", s.seed ?? "", s.stage ? JSON.stringify(s.stage.sprites) : ""].join("|");
  }
  /** pops the frames that have run to their end (a repeat starts its next round) */
  private settle(): void {
    for (;;) {
      const f = this.stack[this.stack.length - 1];
      if (!f || f.i < f.blocks.length) return;
      if (f.kind === "rep") { f.left = (f.left ?? 1) - 1; this.yielded = true; if (f.left > 0) { f.i = 0; f.last?.clear(); continue; } }
      else if (f.kind === "for") { f.cur = (f.cur ?? 0) + 1; this.yielded = true; if (f.cur <= (f.end ?? 0)) { f.i = 0; f.last?.clear(); this.assign(f.name!, f.cur); continue; } }
      else if (f.kind === "each") { f.idx = (f.idx ?? 0) + 1; this.yielded = true; if (f.idx < (f.items?.length ?? 0)) { f.i = 0; f.last?.clear(); this.assign(f.name!, f.items![f.idx]); continue; } }
      else if (f.loop) this.yielded = true;
      this.stack.pop();
      // a function that ends without a return gives 0
      if (f.kind === "call" && f.ret) f.ret.frame.tmp?.set(f.ret.expr, 0);
    }
  }
  private halt(status: Status, message: string): null { this.status = status; this.message = message; return null; }

  /** a call inside the expressions of a block that has no result yet: the innermost one first */
  private nextCall(e: Expr | undefined, tmp: Map<Expr, number> | undefined): Expr | null {
    if (!e) return null;
    switch (e.k) {
      case "bin": case "cmp": case "logic": return this.nextCall(e.a, tmp) ?? this.nextCall(e.b, tmp);
      case "not": return this.nextCall(e.a, tmp);
      case "list": return this.nextCall(e.a, tmp);
      case "fn": for (const x of e.args) { const r = this.nextCall(x, tmp); if (r) return r; } return null;
      case "call": for (const x of e.args) { const r = this.nextCall(x, tmp); if (r) return r; } return tmp?.has(e) ? null : e;
      default: return null;
    }
  }
  private pending(b: Blk, f: Frame): Expr | null {
    for (const e of [b.n, b.cond, b.arg, ...(b.args ?? []), b.e]) { const r = this.nextCall(e, f.tmp); if (r) return r; }
    return null;
  }
  /** starts a function: a statement (no result wanted) or a call inside an expression */
  private enter(name: string, argv: number[], ret?: { frame: Frame; expr: Expr }): boolean {
    const fn = this.funcs.get(name);
    if (!fn) { this.halt("error", MSG.nofunc); return false; }
    if (this.stack.length >= this.maxDepth) { this.halt("error", MSG.deep); return false; }
    const locals: Record<string, number> = {};
    paramsOf(fn).forEach((p, i) => { locals[p] = argv[i] ?? 0; });
    if (fn.body.length) this.stack.push({ blocks: fn.body, i: 0, kind: "call", locals, fn: name, ret });
    else if (ret) ret.frame.tmp?.set(ret.expr, 0);
    return true;
  }

  /** runs ONE block (a check of a loop or an if counts as a step); null when the program has ended or was stopped */
  step(): StepInfo | null {
    if (this.status !== "running") return null;
    const info = this.stepInner();
    if (this.fault && (this.status === "running" || this.status === "done")) { this.halt("error", this.fault); if (info) info.crash = true; }
    return info;
  }
  private stepInner(): StepInfo | null {
    this.settle();
    const f = this.stack[this.stack.length - 1];
    if (!f) { this.status = "done"; return null; }
    if (++this.steps > this.budget) return this.halt("budget", MSG.budget);
    const b = f.blocks[f.i];
    const st = this.state, w = this.world;
    const info: StepInfo = { id: b.id, t: b.t };
    this.current = b.id;
    this.cur = f;
    // calls inside the expressions of this block come first, one per step
    const pend = this.pending(b, f);
    if (pend && pend.k === "call") {
      const argv = pend.args.map((x) => clampNum(this.evalExpr(x)));
      if (!this.fault) { (f.tmp ??= new Map()); this.enter(pend.name, argv, { frame: f, expr: pend }); }
      return info;
    }
    const clearTmp = () => { f.tmp = undefined; };
    const seq = (blocks: Blk[] | undefined, adv: boolean, loop = false) => { if (adv) f.i++; if (blocks?.length) this.stack.push({ blocks, i: 0, kind: "seq", loop }); };
    const E = (e: Expr | undefined, d = 0) => this.evalExpr(e ?? { k: "n", v: d });
    const sp = this.sprite();
    switch (b.t) {
      case "move": {
        f.i++;
        if (w.kind !== "grid") break;
        const [dx, dy] = DIRS[dirOf(st.rot)];
        if (!free(w, st.x + dx, st.y + dy)) { st.crashed = true; info.crash = true; this.halt("crash", MSG.crash); return info; }
        st.x += dx; st.y += dy; break;
      }
      case "left": f.i++; st.rot -= 90; break;
      case "right": f.i++; st.rot += 90; break;
      case "take": {
        f.i++;
        if (w.kind !== "grid") break;
        // taking where there is no star is a mistake (so that "if there is a star here" has a reason to exist)
        if (!st.stars[`${st.x},${st.y}`]) { if (this.lenient) break; st.crashed = true; info.crash = true; this.halt("crash", MSG.noStar); return info; }
        delete st.stars[`${st.x},${st.y}`]; st.got++; break;
      }
      case "light": {
        f.i++;
        if (w.kind !== "grid") break;
        const lk = `${st.x},${st.y}`;
        if (st.lamps[lk] === undefined) { if (this.lenient) break; st.crashed = true; info.crash = true; this.halt("crash", MSG.noLamp); return info; }
        if (st.lamps[lk] === 0) { st.lamps[lk] = 1; st.lit++; }
        break;
      }
      case "fd": {
        f.i++;
        if (w.kind !== "turtle") break;
        const n = Math.max(-2000, Math.min(2000, E(b.n)));
        const a = (st.rot * Math.PI) / 180, x2 = st.x + Math.sin(a) * n, y2 = st.y - Math.cos(a) * n;
        if (st.pen && n !== 0) st.segs.push({ x1: st.x, y1: st.y, x2, y2, c: st.color });
        st.x = x2; st.y = y2; break;
      }
      case "tl": f.i++; st.rot -= E(b.n); break;
      case "tr": f.i++; st.rot += E(b.n); break;
      case "penup": f.i++; st.pen = false; break;
      case "pendown": f.i++; st.pen = true; break;
      case "color": f.i++; st.color = b.c ?? "black"; break;
      case "set": f.i++; this.assign(b.name ?? "x", clampNum(E(b.e))); break;
      case "change": f.i++; this.assign(b.name ?? "x", clampNum((st.vars[b.name ?? "x"] ?? 0) + E(b.e, 1))); break;   // (the global variable: a parameter is only read, as in phase 1)
      case "repeat": {
        f.i++;
        const n = Math.max(0, Math.min(10000, Math.floor(E(b.n, 1))));
        if (n > 0 && b.body?.length) this.stack.push({ blocks: b.body, i: 0, kind: "rep", left: n });
        break;
      }
      case "forever": {
        if (b.body?.length) { f.i++; this.stack.push({ blocks: b.body, i: 0, kind: "rep", left: Infinity }); } else this.yielded = true;
        break;
      }
      case "for": {
        f.i++;
        const from = Math.floor(E(b.n, 1)), to = Math.floor(E(b.e, 1));
        if (from <= to && b.body?.length) { this.stack.push({ blocks: b.body, i: 0, kind: "for", name: b.name, cur: from, end: Math.min(to, from + 10000) }); this.assign(b.name ?? "i", from); }
        break;
      }
      case "each": {
        f.i++;
        const items = [...this.list(b.list ?? "xs")];
        if (items.length && b.body?.length) { this.stack.push({ blocks: b.body, i: 0, kind: "each", name: b.name, items, idx: 0 }); this.assign(b.name ?? "x", items[0]); }
        break;
      }
      case "while": case "until": {
        const c = E(b.cond) !== 0;
        const go = b.t === "while" ? c : !c;
        info.yes = go;
        if (!go) { f.i++; break; }
        // the same state at the check of this loop as at an earlier check (every one said "go on"): it will go round for ever
        const seen = ((f.last ??= new Map()).get(f.i) ?? new Set<string>());
        const k = this.key();
        if (seen.has(k)) { this.halt("infinite", MSG.infinite); return info; }
        seen.add(k); f.last.set(f.i, seen);
        clearTmp();
        seq(b.body, false, true);
        this.settle();
        return info;
      }
      case "if": {
        const c = E(b.cond) !== 0;
        info.yes = c;
        clearTmp();
        seq(c ? b.body : b.els, true);
        this.settle();
        if (!this.stack.length) this.status = "done";
        return info;
      }
      case "waitUntil": {
        const c = E(b.cond) !== 0;
        info.yes = c;
        if (c) f.i++; else this.yielded = true;
        break;
      }
      case "call": {
        f.i++;
        const args = b.args ?? (b.arg ? [b.arg] : []);
        const argv = args.map((x) => clampNum(E(x)));
        clearTmp();
        if (!this.enter(b.name ?? "", argv)) return info;
        this.settle();
        if (!this.stack.length) this.status = "done";
        return info;
      }
      case "return": {
        const v = clampNum(E(b.e));
        let k = this.stack.length - 1;
        while (k >= 0 && this.stack[k].kind !== "call") k--;
        if (k < 0) { this.stack.length = 0; this.status = "done"; return info; }
        const cf = this.stack[k];
        this.stack.length = k;
        if (cf.ret) cf.ret.frame.tmp?.set(cf.ret.expr, v);
        this.settle();
        if (!this.stack.length) this.status = "done";
        return info;
      }
      case "push": {
        f.i++;
        const L = this.list(b.list ?? "xs");
        if (L.length >= 500) { this.halt("error", MSG.big); return info; }
        L.push(clampNum(E(b.e)));
        break;
      }
      case "lset": { f.i++; const L = this.list(b.list ?? "xs"), i = Math.floor(E(b.n, 1)); if (i < 1 || i > L.length) this.bad(MSG.range); else L[i - 1] = clampNum(E(b.e)); break; }
      case "lremove": { f.i++; const L = this.list(b.list ?? "xs"), i = Math.floor(E(b.n, 1)); if (i < 1 || i > L.length) this.bad(MSG.range); else L.splice(i - 1, 1); break; }
      case "swap": {
        f.i++;
        const L = this.list(b.list ?? "xs"), i = Math.floor(E(b.n, 1)), j = Math.floor(E(b.e, 2));
        if (i < 1 || j < 1 || i > L.length || j > L.length) this.bad(MSG.range); else { const t = L[i - 1]; L[i - 1] = L[j - 1]; L[j - 1] = t; st.swaps = (st.swaps ?? 0) + 1; }
        break;
      }
      case "lclear": f.i++; this.state.lists![b.list ?? "xs"] = []; break;
      // ----- the stage -----
      case "smove": {
        f.i++;
        const n = Math.max(-2000, Math.min(2000, E(b.n)));
        if (sp) { const a = (sp.dir * Math.PI) / 180; sp.x = clampX(sp.x + Math.sin(a) * n); sp.y = clampY(sp.y + Math.cos(a) * n); }
        break;
      }
      case "sturn": f.i++; if (sp) sp.dir = (((sp.dir + E(b.n)) % 360) + 360) % 360; break;
      case "goto": { f.i++; const x = E(b.n), y = E(b.e); if (sp) { sp.x = clampX(x); sp.y = clampY(y); } break; }
      case "changex": f.i++; if (sp) sp.x = clampX(sp.x + E(b.n)); break;
      case "changey": f.i++; if (sp) sp.y = clampY(sp.y + E(b.n)); break;
      case "say": f.i++; if (sp) sp.say = b.c ?? ""; break;
      case "sayfor": {
        f.i++;
        const secs = E(b.n, 1), text = b.c ?? "";
        if (sp) { sp.say = text; this.sleep = Math.max(1, Math.round(secs * TPS)); this.wake = () => { if (sp.say === text) sp.say = ""; }; this.yielded = true; }
        break;
      }
      case "costume": f.i++; if (sp) sp.costume = Math.max(1, Math.min(3, Math.round(E(b.n, 1)))); break;
      case "nextcostume": f.i++; if (sp) sp.costume = (sp.costume % 3) + 1; break;
      case "size": f.i++; if (sp) sp.size = Math.max(20, Math.min(300, E(b.n, 100))); break;
      case "show": f.i++; if (sp) sp.visible = true; break;
      case "hide": f.i++; if (sp) sp.visible = false; break;
      case "note": {
        f.i++;
        const pitch = Math.round(E(b.n, 60)), beats = Math.max(0, Math.min(8, E(b.e, 1)));
        if (st.stage) st.stage.notes.push({ tick: st.stage.tick, pitch, beats, sprite: this.spriteId });
        this.sleep = Math.round(beats * BEAT_TICKS); this.yielded = true;
        break;
      }
      case "wait": f.i++; this.sleep = Math.max(0, Math.round(Math.min(60, E(b.n, 1)) * TPS)); this.yielded = true; break;
      case "broadcast": f.i++; if (st.stage) st.stage.msgs.push(b.c ?? ""); break;
    }
    clearTmp();
    this.settle();
    if (!this.stack.length) this.status = "done";
    return info;
  }

  /** a stage thread: one tick of waiting (and what happens when the waiting is over) */
  tickSleep(): void {
    if (this.sleep > 0 && --this.sleep === 0 && this.wake) { const w = this.wake; this.wake = null; w(); }
  }

  /** runs to the end (or until it is stopped) */
  run(): { status: Status; message: string; steps: number; state: State } {
    while (this.status === "running") this.step();
    return { status: this.status, message: this.message, steps: this.steps, state: this.state };
  }
}

export function runProgram(prog: Program, world: World, init: State, opts?: RunOpts) {
  return new Machine(prog, world, init, opts).run();
}

/** has the goal been reached? (`missing` = what is still wrong, as texts for the screen) */
export function judgeGoal(goal: Goal, world: World, s: State): { won: boolean; missing: string[] } {
  const missing: string[] = [];
  if (world.kind === "grid") {
    if (goal.flag && world.cells[s.y]?.[s.x] !== "F") missing.push("机器人还没有到达旗子。");
    if (goal.stars !== undefined) {
      const need = goal.stars === "all" ? s.total.stars : goal.stars;
      if (goal.stars === "all" ? s.got < need : s.got !== need) missing.push(goal.stars === "all" ? "还有星星没有收集。" : "收集的星星数量不对。");
    }
    if (goal.lights !== undefined) {
      const need = goal.lights === "all" ? s.total.lamps : goal.lights;
      if (goal.lights === "all" ? s.lit < need : s.lit !== need) missing.push(goal.lights === "all" || s.lit < need ? "还有灯没有点亮。" : "点亮的灯太多了。");
    }
  }
  for (const [name, v] of Object.entries(goal.vars ?? {})) if (Math.abs((s.vars[name] ?? 0) - v) > 1e-9) missing.push("变量的数值不对。");
  for (const [name, v] of Object.entries(goal.lists ?? {})) if (JSON.stringify(s.lists?.[name] ?? []) !== JSON.stringify(v)) missing.push("列表的内容不对。");
  return { won: missing.length === 0, missing };
}
