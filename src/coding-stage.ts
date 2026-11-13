/**
 * 编程 world 7 (events and stories): the STAGE. Pure and deterministic (no DOM, no real clock): a stage holds sprites; a program is a set of event scripts
 * ("when started / tapped / key pressed / message received") that run side by side as THREADS, each one a `Machine` (coding-interp.ts) that shares the stage.
 * Time is a step clock: one tick = 1 / TPS second; a thread runs until it waits, plays a note or ends a round of a loop, then the next thread has its turn.
 * A level is judged by running the child's program on a SCRIPTED sequence of taps / key presses and comparing the states of the sprites (position, turning,
 * size, costume, speech, variables, notes) at given ticks with the states the reference solution produces: within a tolerance, never pixels.
 */
import { Program, Script, cloneProgram, parse } from "./coding-ast";
import { Machine, State, StageSprite, StageState, TPS, makeTurtle } from "./coding-interp";

export interface SpriteSpec { id: string; art: string; x: number; y: number; dir?: number; size?: number; costume?: number; /** the name shown to the child (UI text) */ label: string; /** a short text on a button sprite (digits / symbols) */ text?: string }
export type Input =
  | { tick: number; type: "tap"; sprite: string }
  | { tick: number; type: "stagetap"; x: number; y: number }
  | { tick: number; type: "key"; key: string; hold?: number };
/** an input without its time (a live input of the child) */
export type LiveInput = { type: "tap"; sprite: string } | { type: "stagetap"; x: number; y: number } | { type: "key"; key: string; hold?: number };
export type Prop = "x" | "y" | "dir" | "size" | "costume" | "visible" | "say";
export interface Check {
  tick: number; sprites?: string[]; props?: Prop[]; tol?: number; vars?: string[]; notes?: boolean;
  /** judged on the child's program alone (random positions), on every seed of `StageExt.seeds`: the sprite is inside the ranges, and (moved) not where it started */
  range?: { sprite: string; x?: [number, number]; y?: [number, number]; moved?: boolean };
  /** the variables are at least this large */
  min?: Record<string, number>;
}
export interface StageExt {
  sprites: SpriteSpec[];
  /** the places for the child's scripts: the sprite, the event the hat starts with and the events it can be changed to */
  slots: { sprite: string; on: string; events: string[] }[];
  /** scripts and functions that are always there (pseudo-code, not editable) */
  given?: string;
  inputs: Input[]; ticks: number; checks: Check[]; seed?: number; seeds?: number[];
  /** the texts a `say` can use (id -> text), the messages a `broadcast` can send (id -> label), the variables */
  texts: Record<string, string>; msgs?: Record<string, string>; vars?: string[];
  /** the keys of the level: id -> label (the on-screen buttons, the key picker) */
  keys?: Record<string, string>;
  /** free play: no checks */
  free?: boolean;
}

export interface Snap { sprites: Record<string, { x: number; y: number; dir: number; size: number; costume: number; visible: boolean; say: string }>; vars: Record<string, number>; notes: { tick: number; pitch: number }[] }

export function stageState(ext: StageExt): State {
  const t = makeTurtle().state;
  const sprites: StageSprite[] = ext.sprites.map((s) => ({ id: s.id, art: s.art, x: s.x, y: s.y, dir: s.dir ?? 90, size: s.size ?? 100, costume: s.costume ?? 1, visible: true, say: "" }));
  const stage: StageState = { sprites, notes: [], msgs: [], keys: {}, tapX: 0, tapY: 0, tick: 0 };
  return { ...t, stage, seed: ext.seed ?? 7 };
}

/** the child's program together with the scripts / functions the level always has */
export function withGiven(prog: Program, ext: StageExt): Program {
  const g = ext.given ? parse(ext.given) : { main: [], funcs: [], scripts: [] as Script[] };
  const p = cloneProgram(prog);
  return { main: [], funcs: [...g.funcs, ...p.funcs], scripts: [...(g.scripts ?? []), ...(p.scripts ?? [])] };
}

interface Thread { si: number; m: Machine }
export const STAGE_BUDGET = 60000;

export class StageRun {
  state: State;
  tick = 0;
  status: "running" | "error" = "running";
  message = "";
  /** every broadcast so far (message, tick) */
  sent: { msg: string; tick: number }[] = [];
  private threads: Thread[] = [];
  private scripts: Script[];
  private prog: Program;
  private releases: { tick: number; key: string }[] = [];
  private pending: Input[];
  constructor(prog: Program, public ext: StageExt, scripted = true) {
    this.prog = withGiven(prog, ext);
    this.scripts = this.prog.scripts ?? [];
    this.state = stageState(ext);
    this.pending = scripted ? [...ext.inputs].sort((a, b) => a.tick - b.tick) : [];
  }
  private spawn(si: number): void {
    const s = this.scripts[si];
    if (!s.body.length) return;
    const m = new Machine(this.prog, { kind: "stage" }, this.state, { shared: true, sprite: s.sprite, blocks: s.body, budget: STAGE_BUDGET, maxDepth: 200 });
    const old = this.threads.findIndex((t) => t.si === si);
    if (old >= 0) this.threads[old] = { si, m }; else this.threads.push({ si, m });
  }
  private fire(on: string, sprite?: string): void {
    this.scripts.forEach((s, i) => { if (s.on === on && (sprite === undefined || s.sprite === sprite)) this.spawn(i); });
  }
  /** a live input (the child taps the stage or presses a key while the program runs) */
  inject(inp: LiveInput): void {
    const st = this.state.stage!;
    if (inp.type === "tap") this.fire("tap", inp.sprite);
    else if (inp.type === "stagetap") { st.tapX = inp.x; st.tapY = inp.y; this.fire("stagetap"); }
    else { st.keys[inp.key] = 1; this.releases.push({ tick: this.tick + Math.max(1, inp.hold ?? 1), key: inp.key }); this.fire(`key(${inp.key})`); }
  }
  /** a key goes down / up (live play): the key hat starts when it goes down */
  press(key: string): void { const st = this.state.stage!; if (!st.keys[key]) { st.keys[key] = 1; this.fire(`key(${key})`); } }
  release(key: string): void { delete this.state.stage!.keys[key]; }
  /** the next tick of the clock */
  step(): void {
    if (this.status !== "running") return;
    const st = this.state.stage!;
    st.tick = this.tick;
    for (const r of this.releases.filter((x) => x.tick <= this.tick)) delete st.keys[r.key];
    this.releases = this.releases.filter((x) => x.tick > this.tick);
    if (this.tick === 0) this.fire("start");
    while (this.pending.length && this.pending[0].tick <= this.tick) { const { tick: _t, ...inp } = this.pending.shift()!; void _t; this.inject(inp as LiveInput); }
    for (let k = 0; k < this.threads.length; k++) {
      const { m } = this.threads[k];
      if (m.status !== "running") continue;
      if (m.sleep > 0) { m.tickSleep(); if (m.sleep > 0) continue; }
      m.yielded = false;
      for (let guard = 0; m.status === "running" && !m.yielded && m.sleep === 0 && guard < 4000; guard++) m.step();
      if ((m.status as string) !== "running" && (m.status as string) !== "done") { this.status = "error"; this.message = m.message; return; }
      // messages sent by this thread start the scripts that wait for them now
      while (st.msgs.length) { const msg = st.msgs.shift()!; this.sent.push({ msg, tick: this.tick }); this.fire(`recv(${msg})`); }
    }
    this.tick++;
  }
  runTo(tick: number): void { while (this.tick < tick && this.status === "running") this.step(); }
  snap(): Snap {
    const st = this.state.stage!;
    const sprites: Snap["sprites"] = {};
    for (const s of st.sprites) sprites[s.id] = { x: Math.round(s.x * 10) / 10, y: Math.round(s.y * 10) / 10, dir: Math.round(s.dir), size: Math.round(s.size), costume: s.costume, visible: s.visible, say: s.say };
    return { sprites, vars: { ...this.state.vars }, notes: st.notes.map((n) => ({ tick: n.tick, pitch: n.pitch })) };
  }
}

/** runs a program on the scripted inputs; the snapshots at the given ticks */
export function simulate(prog: Program, ext: StageExt, ticks: number[]): { snaps: Map<number, Snap>; status: "running" | "error"; message: string; run: StageRun } {
  const run = new StageRun(prog, ext);
  const snaps = new Map<number, Snap>();
  const want = [...new Set(ticks)].sort((a, b) => a - b);
  for (const t of want) { run.runTo(t); if (run.status === "error") break; snaps.set(t, run.snap()); }
  run.runTo(ext.ticks);
  return { snaps, status: run.status, message: run.message, run };
}

const PROP_NAME: Record<Prop, string> = { x: "位置", y: "位置", dir: "方向", size: "大小", costume: "造型", visible: "显示状态", say: "说的话" };
const DEFAULT_PROPS: Prop[] = ["x", "y"];
export interface StageJudge { won: boolean; missing: string[]; status: "running" | "error"; message: string }
const refCache = new Map<string, Map<number, Snap>>();
/** the states the reference produces (cached per level) */
export function reference(id: string, ref: Program, ext: StageExt): Map<number, Snap> {
  let r = refCache.get(id);
  if (!r) { r = simulate(ref, ext, ext.checks.map((c) => c.tick)).snaps; refCache.set(id, r); }
  return r;
}
const angDiff = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
/** compares one snapshot of the child with the reference's: the texts say what is wrong */
export function compareSnap(c: Check, mine: Snap, ref: Snap, ext: StageExt): string[] {
  const out: string[] = [];
  const sec = Math.round((c.tick / TPS) * 10) / 10;
  const tol = c.tol ?? 8;
  for (const id of c.sprites ?? ext.sprites.map((s) => s.id)) {
    const a = mine.sprites[id], b = ref.sprites[id];
    if (!a || !b) continue;
    const label = ext.sprites.find((s) => s.id === id)?.label ?? id;
    const bad = new Set<string>();
    for (const p of c.props ?? (c.range || c.min ? [] : DEFAULT_PROPS)) {
      const ok = p === "x" || p === "y" ? Math.abs(a[p] - b[p]) <= tol : p === "dir" ? angDiff(a.dir, b.dir) <= 6 : p === "size" ? Math.abs(a.size - b.size) <= 10 : a[p] === b[p];
      if (!ok) bad.add(PROP_NAME[p]);
    }
    for (const w of bad) out.push(`第 ${sec} 秒：${label}的${w}不对。`);
  }
  for (const v of c.vars ?? []) if ((mine.vars[v] ?? 0) !== (ref.vars[v] ?? 0)) out.push(`第 ${sec} 秒：变量 ${v} 的值不对。`);
  if (c.notes) {
    const same = mine.notes.length === ref.notes.length && mine.notes.every((n, i) => n.pitch === ref.notes[i].pitch && Math.abs(n.tick - ref.notes[i].tick) <= 2);
    if (!same) out.push(`第 ${sec} 秒：音符不对。`);
  }
  return out;
}
export function judgeStage(id: string, prog: Program, ref: Program, ext: StageExt): StageJudge {
  const want = reference(id, ref, ext);
  const mine = simulate(prog, ext, ext.checks.map((c) => c.tick));
  if (mine.status === "error") return { won: false, missing: [mine.message], status: "error", message: mine.message };
  const missing: string[] = [];
  for (const c of ext.checks) {
    const a = mine.snaps.get(c.tick), b = want.get(c.tick);
    if (!a || !b) continue;
    for (const m of compareSnap(c, a, b, ext)) if (!missing.includes(m)) missing.push(m);
  }
  // checks on the child's program alone: random positions (every seed) and lower bounds of variables
  for (const c of ext.checks) {
    if (c.min) { const a = mine.snaps.get(c.tick); if (a) for (const [v, n] of Object.entries(c.min)) if ((a.vars[v] ?? 0) < n) missing.push(`变量 ${v} 的值太小：至少要是 ${n}。`); }
    if (c.range) {
      for (const sd of ext.seeds ?? [ext.seed ?? 7]) {
        const r = simulate(prog, { ...ext, seed: sd }, [c.tick]);
        const a = r.snaps.get(c.tick)?.sprites[c.range.sprite], spec = ext.sprites.find((x) => x.id === c.range!.sprite);
        if (!a || !spec) continue;
        const inside = (v: number, lim?: [number, number]) => !lim || (v >= lim[0] && v <= lim[1]);
        const msg = "位置不在要求的范围内。";
        if ((!inside(a.x, c.range.x) || !inside(a.y, c.range.y) || (c.range.moved && Math.hypot(a.x - spec.x, a.y - spec.y) < 1)) && !missing.includes(msg)) missing.push(msg);
      }
    }
  }
  return { won: missing.length === 0, missing, status: "running", message: "" };
}
