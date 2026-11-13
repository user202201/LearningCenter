/**
 * 编程 (coding): the interpreter. Pure and deterministic: no screens, no clock, no randomness.
 * A `Machine` runs a program one block at a time (`step()`), so the screen can light the running block, change the speed, stop and reset; `run()` runs it to
 * the end at once (tests, the dry run before the animation). An explicit stack (no recursion in the host) lets it stop at any step.
 * Endless programs are stopped in two ways: a step budget, and an exact detector: when a `while` / `until` loop comes back to its check with exactly the same
 * state as at the check before (and the check said "go on" both times), the body can never change anything: it is endless.
 * Two worlds share it: the robot on a grid (worlds 1-5) and the turtle with a pen (world 6).
 */
import { Blk, Expr, Program, Func } from "./coding-ast";

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
}
export interface GridWorld { kind: "grid"; w: number; h: number; cells: string[] }
export interface TurtleWorld { kind: "turtle" }
export type World = GridWorld | TurtleWorld;
export interface Goal { flag?: boolean; stars?: "all" | number; lights?: "all" | number; vars?: Record<string, number> }

export type Status = "running" | "done" | "crash" | "infinite" | "budget" | "error";
export const MSG = {
  crash: "前面没有路，机器人撞到了。",
  infinite: "程序一直在循环，不会停下来。",
  budget: "程序运行的步数太多，已经停止。",
  deep: "积木调用得太深，可能在调用自己。",
  nofunc: "找不到这个积木。",
} as const;

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
export const dirOf = (rot: number): number => ((Math.round(rot / 90) % 4) + 4) % 4;

/** a map in text: # wall, . floor, ^ > v < the robot (and its direction), F flag, * star, L lamp, r g b y coloured floor */
export function makeGrid(rows: string[], start?: { x: number; y: number; dir: number }): { world: GridWorld; state: State } {
  const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
  const cells: string[] = [];
  const state: State = { x: 0, y: 0, rot: 0, stars: {}, got: 0, lamps: {}, lit: 0, vars: {}, pen: true, color: "black", segs: [], total: { stars: 0, lamps: 0 } };
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
  return { world: { kind: "turtle" }, state: { x: 0, y: 0, rot: 0, stars: {}, got: 0, lamps: {}, lit: 0, vars: {}, pen: true, color: "black", segs: [], total: { stars: 0, lamps: 0 } } };
}
export const cloneState = (s: State): State => JSON.parse(JSON.stringify(s));

const free = (w: GridWorld, x: number, y: number): boolean => x >= 0 && y >= 0 && x < w.w && y < w.h && w.cells[y][x] !== "#";
const clampNum = (v: number): number => (Number.isFinite(v) ? Math.max(-1e9, Math.min(1e9, v)) : 0);

interface Frame { blocks: Blk[]; i: number; kind: "seq" | "rep" | "call"; left?: number; param?: [string, number]; last?: Map<number, string> }
export interface StepInfo { id: string; t: Blk["t"]; /** the answer of a check (if / while / until) */ yes?: boolean; crash?: boolean }
export interface RunOpts { budget?: number; maxDepth?: number }
export const DEFAULT_BUDGET = 20000;

export class Machine {
  status: Status = "running";
  message = "";
  steps = 0;
  state: State;
  /** the block that ran last */
  current: string | null = null;
  private stack: Frame[] = [];
  private funcs = new Map<string, Func>();
  private budget: number;
  private maxDepth: number;
  constructor(private prog: Program, public world: World, init: State, opts: RunOpts = {}) {
    this.state = cloneState(init);
    this.budget = opts.budget ?? DEFAULT_BUDGET;
    this.maxDepth = opts.maxDepth ?? 60;
    for (const f of prog.funcs) this.funcs.set(f.name, f);
    this.stack.push({ blocks: prog.main, i: 0, kind: "seq" });
    this.settle();
    if (!this.stack.length) this.status = "done";
  }

  private lookup(name: string): number {
    for (let k = this.stack.length - 1; k >= 0; k--) if (this.stack[k].kind === "call") return this.stack[k].param?.[0] === name ? this.stack[k].param![1] : (this.state.vars[name] ?? 0);
    return this.state.vars[name] ?? 0;
  }
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
  evalExpr(e: Expr): number {
    switch (e.k) {
      case "n": return e.v;
      case "v": return this.lookup(e.name);
      case "sense": return this.sense(e.s, e.c) ? 1 : 0;
      case "not": return this.evalExpr(e.a) ? 0 : 1;
      case "bin": { const a = this.evalExpr(e.a), b = this.evalExpr(e.b); return clampNum(e.op === "+" ? a + b : e.op === "-" ? a - b : a * b); }
      case "cmp": {
        const a = this.evalExpr(e.a), b = this.evalExpr(e.b);
        return (e.op === "<" ? a < b : e.op === "<=" ? a <= b : e.op === ">" ? a > b : e.op === ">=" ? a >= b : e.op === "==" ? a === b : a !== b) ? 1 : 0;
      }
    }
  }
  private key(): string {
    const s = this.state;
    let call = "";
    for (let k = this.stack.length - 1; k >= 0; k--) if (this.stack[k].kind === "call") { call = JSON.stringify(this.stack[k].param); break; }
    return [Math.round(s.x * 1e6), Math.round(s.y * 1e6), Math.round((((s.rot % 360) + 360) % 360) * 1e6), s.got, s.lit, JSON.stringify(s.vars), s.pen, s.color, call].join("|");
  }
  /** pops the frames that have run to their end (a repeat starts its next round) */
  private settle(): void {
    for (;;) {
      const f = this.stack[this.stack.length - 1];
      if (!f || f.i < f.blocks.length) return;
      if (f.kind === "rep") { f.left = (f.left ?? 1) - 1; if (f.left > 0) { f.i = 0; f.last?.clear(); continue; } }
      this.stack.pop();
    }
  }
  private halt(status: Status, message: string): null { this.status = status; this.message = message; return null; }

  /** runs ONE block (a check of a loop or an if counts as a step); null when the program has ended or was stopped */
  step(): StepInfo | null {
    if (this.status !== "running") return null;
    this.settle();
    const f = this.stack[this.stack.length - 1];
    if (!f) { this.status = "done"; return null; }
    if (++this.steps > this.budget) return this.halt("budget", MSG.budget);
    const b = f.blocks[f.i];
    const st = this.state, w = this.world;
    const info: StepInfo = { id: b.id, t: b.t };
    this.current = b.id;
    const seq = (blocks: Blk[] | undefined, adv: boolean) => { if (adv) f.i++; if (blocks?.length) this.stack.push({ blocks, i: 0, kind: "seq" }); };
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
      case "take": f.i++; if (st.stars[`${st.x},${st.y}`]) { delete st.stars[`${st.x},${st.y}`]; st.got++; } break;
      case "light": f.i++; if (st.lamps[`${st.x},${st.y}`] === 0) { st.lamps[`${st.x},${st.y}`] = 1; st.lit++; } break;
      case "fd": {
        f.i++;
        if (w.kind !== "turtle") break;
        const n = Math.max(-2000, Math.min(2000, this.evalExpr(b.n ?? { k: "n", v: 0 })));
        const a = (st.rot * Math.PI) / 180, x2 = st.x + Math.sin(a) * n, y2 = st.y - Math.cos(a) * n;
        if (st.pen && n !== 0) st.segs.push({ x1: st.x, y1: st.y, x2, y2, c: st.color });
        st.x = x2; st.y = y2; break;
      }
      case "tl": f.i++; st.rot -= this.evalExpr(b.n ?? { k: "n", v: 0 }); break;
      case "tr": f.i++; st.rot += this.evalExpr(b.n ?? { k: "n", v: 0 }); break;
      case "penup": f.i++; st.pen = false; break;
      case "pendown": f.i++; st.pen = true; break;
      case "color": f.i++; st.color = b.c ?? "black"; break;
      case "set": f.i++; st.vars[b.name ?? "x"] = clampNum(this.evalExpr(b.e ?? { k: "n", v: 0 })); break;
      case "change": f.i++; st.vars[b.name ?? "x"] = clampNum((st.vars[b.name ?? "x"] ?? 0) + this.evalExpr(b.e ?? { k: "n", v: 1 })); break;
      case "repeat": {
        f.i++;
        const n = Math.max(0, Math.min(10000, Math.floor(this.evalExpr(b.n ?? { k: "n", v: 1 }))));
        if (n > 0 && b.body?.length) this.stack.push({ blocks: b.body, i: 0, kind: "rep", left: n });
        break;
      }
      case "while": case "until": {
        const c = this.evalExpr(b.cond ?? { k: "n", v: 0 }) !== 0;
        const go = b.t === "while" ? c : !c;
        info.yes = go;
        if (!go) { f.i++; break; }
        const last = (f.last ??= new Map());
        const k = this.key();
        if (last.get(f.i) === k) { this.halt("infinite", MSG.infinite); return info; }
        last.set(f.i, k);
        seq(b.body, false);
        break;
      }
      case "if": {
        const c = this.evalExpr(b.cond ?? { k: "n", v: 0 }) !== 0;
        info.yes = c;
        seq(c ? b.body : b.els, true);
        break;
      }
      case "call": {
        f.i++;
        const fn = this.funcs.get(b.name ?? "");
        if (!fn) { this.halt("error", MSG.nofunc); return info; }
        if (this.stack.length >= this.maxDepth) { this.halt("error", MSG.deep); return info; }
        const arg = b.arg ? clampNum(this.evalExpr(b.arg)) : 0;
        if (fn.body.length) this.stack.push({ blocks: fn.body, i: 0, kind: "call", param: fn.param ? [fn.param, arg] : undefined });
        break;
      }
    }
    this.settle();
    if (!this.stack.length) this.status = "done";
    return info;
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
      if (s.lit < need) missing.push("还有灯没有点亮。");
    }
  }
  for (const [name, v] of Object.entries(goal.vars ?? {})) if ((s.vars[name] ?? 0) !== v) missing.push("变量的数值不对。");
  return { won: missing.length === 0, missing };
}
