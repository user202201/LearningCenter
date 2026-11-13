/**
 * 编程 phase 2, block programming extension: WORLDS 7-10 as data (docs/coding-curriculum.md section 8). Pure: no screens, no storage.
 * Written by a model from memory; a teacher must proofread. Every level has a reference solution in the pseudo-code syntax; par = its blocks.
 *  - world 7 事件与故事: a STAGE with sprites (coding-stage.ts), judged on scripted taps / key presses
 *  - world 8 函数进阶与递归: functions with several parameters, return values, recursion (calculation levels, robot, turtle)
 *  - world 9 列表与数据: lists (data levels, a row of numbers on the floor)
 *  - world 10 算法: searching, sorting, greedy, graphs, the balance scale; some levels judge the number of steps
 * Two new kinds of level are registered in coding-levels.ts (`KINDS`): "stage" and "data". A data level is judged by running the program on a shown
 * instance and on five hidden ones (random lists / numbers) and comparing the named variables and lists with what the reference solution leaves.
 */
import { Program, PaletteKind, parse, walk, allLists, exprText, Expr } from "./coding-ast";
import { Machine, State, LevelData, makeTurtle, cloneState } from "./coding-interp";
import { Level, LevelSpec, Evaluation, Instance, KINDS, build, registerLevels, registerWorlds, mulberry32, VARIANT_SEEDS, FAMILIES, maze } from "./coding-levels";
import { StageExt, Input, stageState, judgeStage } from "./coding-stage";

export interface DataExt {
  /** the generator of the instances (a name in GENS) */
  gen: string;
  /** the variables and lists compared with the reference's */
  check: string[];
  /** the program is judged by its number of steps: at most 1.5 x the reference's + 30 on every instance */
  eff?: boolean;
  maxWeighs?: number; maxSwaps?: number | "len-1";
  /** how the data is drawn: lists as boxes, bars, a graph, a balance scale, the function tests */
  view: "list" | "bars" | "graph" | "scale" | "calc";
}
export interface Ext {
  stage?: StageExt; data?: DataExt;
  /** sentences that say what to do (UI texts) */
  goal?: string[];
  /** conditions and values are built from small blocks (otherwise the level offers a list of conditions) */
  free?: boolean;
  /** a function may call itself */
  recursion?: boolean;
  /** the lists the blocks can use */
  lists?: string[];
  /** reporters the value slots offer: list functions, number functions, "touching", "keyDown", "me", user functions ("call") */
  rep?: string[];
  /** arithmetic operators offered (default + - *) */
  ops?: string[];
  /** the main program is made by the level (the tests of a function) and cannot be edited */
  hideMain?: boolean;
  /** the numbers the value slots offer as a list */
  nums?: number[];
}
export const extOf = (l: { ext?: unknown }): Ext => (l.ext ?? {}) as Ext;

// ---------- random helpers ----------
const rngOf = (seed: number, salt: number) => mulberry32(seed * 7919 + salt * 104729 + 17);
const ri = (r: () => number, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const distinct = (r: () => number, n: number, a: number, b: number): number[] => { const s = new Set<number>(); while (s.size < n) s.add(ri(r, a, b)); return [...s]; };
const shuffle = <T,>(r: () => number, l: T[]): T[] => { const a = [...l]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------- data instances ----------
export interface DataInst { lists: Record<string, number[]>; vars: Record<string, number>; /** the program is this (tests of functions) */ main?: string; data?: LevelData }
type Gen = (r: () => number, shown: boolean) => DataInst;
const calc = (fn: string, shown: number[][], rnd: (r: () => number) => number[][]): Gen => (r, sh) => {
  const args = sh ? shown : rnd(r);
  return { lists: {}, vars: {}, main: args.map((a, i) => `set r${i + 1} = ${fn}(${a.join(", ")})`).join(" ") };
};
const calc2 = (tests: [string, number[][], (r: () => number) => number[][]][]): Gen => (r, sh) => {
  let k = 0; const parts: string[] = [];
  for (const [fn, shown, rnd] of tests) for (const a of sh ? shown : rnd(r)) parts.push(`set r${++k} = ${fn}(${a.join(", ")})`);
  return { lists: {}, vars: {}, main: parts.join(" ") };
};
function graphInst(r: () => number): DataInst {
  const n = 7;
  const edges: [number, number][] = [];
  for (let i = 2; i <= n; i++) edges.push([ri(r, 1, i - 1), i]);
  while (edges.length < n + 1) { const a = ri(r, 1, n), b = ri(r, 1, n); if (a !== b && !edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) edges.push([Math.min(a, b), Math.max(a, b)]); }
  const order = shuffle(r, Array.from({ length: n }, (_, i) => i));
  const pos = Array.from({ length: n }, (_, i) => { const a = (order[i] / n) * Math.PI * 2 - Math.PI / 2; return [Math.round(50 + 38 * Math.cos(a)), Math.round(50 + 38 * Math.sin(a))] as [number, number]; });
  return { lists: { dist: Array(n).fill(-1), q: [] }, vars: {}, data: { graph: { n, edges, pos } } };
}
export const GENS: Record<string, Gen> = {
  empty: () => ({ lists: { xs: [] }, vars: {} }),
  list3: (r) => ({ lists: { xs: Array.from({ length: ri(r, 5, 8) }, () => ri(r, 1, 9)) }, vars: {} }),
  list20: (r) => ({ lists: { xs: Array.from({ length: ri(r, 5, 8) }, () => ri(r, 1, 20)) }, vars: {} }),
  filter: (r) => ({ lists: { xs: Array.from({ length: ri(r, 6, 9) }, () => ri(r, 1, 20)), evens: [] }, vars: {} }),
  search: (r) => { const xs = distinct(r, ri(r, 6, 10), 1, 30); const t = r() < 0.8 ? xs[ri(r, 0, xs.length - 1)] : 31; return { lists: { xs }, vars: { t } }; },
  search20: (r) => { const xs = distinct(r, 20, 1, 60); return { lists: { xs }, vars: { t: xs[ri(r, 1, 4)] } }; },
  sorted64: (r) => { const xs: number[] = []; let v = 0; for (let i = 0; i < 64; i++) { v += ri(r, 1, 3); xs.push(v); } return { lists: { xs }, vars: { t: xs[ri(r, 40, 63)] } }; },
  sortme: (r) => ({ lists: { xs: distinct(r, ri(r, 6, 8), 1, 30) }, vars: {} }),
  avg: (r) => {
    for (;;) { const n = ri(r, 4, 6); const xs = Array.from({ length: n }, () => ri(r, 2, 10)); const s = xs.slice(0, -1).reduce((a, b) => a + b, 0); const last = n * Math.ceil((s + 1) / n) - s; if (last >= 1 && last <= 12) { xs[n - 1] = last; return { lists: { xs }, vars: {} }; } }
  },
  mode: (r) => {
    for (;;) { const xs = Array.from({ length: ri(r, 7, 9) }, () => ri(r, 1, 6)); const c = [1, 2, 3, 4, 5, 6].map((v) => xs.filter((x) => x === v).length); const m = Math.max(...c); if (c.filter((x) => x === m).length === 1 && m >= 3) return { lists: { xs }, vars: {} }; }
  },
  shop: (r) => ({ lists: { ps: Array.from({ length: ri(r, 5, 7) }, () => ri(r, 2, 9)), bag: [] }, vars: { b: ri(r, 15, 25) } }),
  pairs: (r) => ({ lists: { xs: Array.from({ length: ri(r, 6, 8) }, () => ri(r, 1, 9)) }, vars: {} }),
  coins: (r) => ({ lists: { coins: [25, 10, 5, 1] }, vars: { amt: ri(r, 41, 99) } }),
  gcd: (r) => { const g = ri(r, 2, 9), p = ri(r, 20, 60), q = ri(r, 2, 15); return { lists: {}, vars: { a: g * p, b: g * q } }; },
  prime: (r) => ({ lists: {}, vars: { n: [53, 97, 91, 221, 997, 1001, 541, 589, 899, 983, 713, 1009][ri(r, 0, 11)] } }),
  graph: (r) => graphInst(r),
  weights8: (r) => ({ lists: {}, vars: {}, data: { weights: distinct(r, 8, 10, 99) } }),
  weights5: (r) => ({ lists: { order: [1, 2, 3, 4, 5] }, vars: {}, data: { weights: distinct(r, 5, 10, 99) } }),
  merge: (r) => ({ lists: { a: distinct(r, ri(r, 3, 6), 1, 25).sort((x, y) => x - y), b: distinct(r, ri(r, 3, 6), 1, 25).sort((x, y) => x - y), c: [] }, vars: {} }),
  // the tests of functions (world 8): the shown ones are written in the level, the hidden ones are other numbers
  double: calc("double", [[3], [10], [0]], (r) => [[ri(r, 1, 9)], [ri(r, 10, 60)], [ri(r, 0, 3)]]),
  sum3: calc("sum3", [[1, 2, 3], [10, 20, 30], [5, 0, 7]], (r) => [[ri(r, 1, 9), ri(r, 1, 9), ri(r, 1, 9)], [ri(r, 10, 40), ri(r, 1, 9), ri(r, 0, 9)], [0, 0, ri(r, 1, 9)]]),
  bigger: calc("bigger", [[3, 8], [9, 2], [5, 5]], (r) => [[ri(r, 1, 9), ri(r, 10, 20)], [ri(r, 10, 30), ri(r, 1, 9)], [7, 7]]),
  even: calc("even", [[4], [7], [0]], (r) => [[ri(r, 1, 50) * 2], [ri(r, 1, 50) * 2 + 1], [ri(r, 1, 9) * 2 + 1]]),
  hyp2: calc("hyp2", [[3, 4], [5, 12], [0, 6]], (r) => [[ri(r, 1, 9), ri(r, 1, 9)], [ri(r, 5, 15), ri(r, 5, 15)], [0, ri(r, 1, 9)]]),
  total: calc("total", [[3], [5], [0]], (r) => [[ri(r, 1, 9)], [ri(r, 10, 30)], [ri(r, 0, 2)]]),
  fact: calc("fact", [[3], [5], [1]], (r) => [[ri(r, 2, 4)], [ri(r, 5, 8)], [0]]),
  fib: calc("fib", [[5], [7], [1]], (r) => [[ri(r, 2, 6)], [ri(r, 7, 11)], [0]]),
  boss8: calc2([["power", [[2, 5], [3, 3]], (r) => [[ri(r, 2, 5), ri(r, 3, 5)], [ri(r, 2, 4), 0]]], ["digsum", [[1234], [907]], (r) => [[ri(r, 100, 9999)], [ri(r, 1000, 99999)]]]]),
};
const instCache = new Map<string, DataInst>();
export function dataInst(l: Level, seed?: number): DataInst {
  const k = `${l.id}#${seed ?? ""}`;
  let d = instCache.get(k);
  if (!d) {
    const e = extOf(l).data!;
    const shown = seed === undefined;
    d = GENS[e.gen](rngOf(shown ? 1 : seed!, l.no + l.world * 50), shown);
    instCache.set(k, d);
  }
  return JSON.parse(JSON.stringify(d));
}
function dataState(inst: DataInst): State {
  const t = makeTurtle().state;
  return { ...t, vars: { ...inst.vars }, lists: JSON.parse(JSON.stringify(inst.lists)), data: inst.data ? JSON.parse(JSON.stringify(inst.data)) : undefined, seed: 1, weighs: 0, swaps: 0 };
}
/** the program that runs on an instance: the child's functions with the main program of the level (function tests) or the child's main */
function programOn(prog: Program, inst: DataInst): Program {
  return inst.main ? { main: parse(inst.main).main, funcs: prog.funcs } : prog;
}
export interface Outcome { status: Machine["status"]; message: string; steps: number; state: State; machine: Machine }
export function runData(l: Level, prog: Program, inst: DataInst, budget?: number): Outcome {
  const m = new Machine(programOn(prog, inst), { kind: "data" }, dataState(inst), { budget, maxDepth: extOf(l).recursion ? 400 : 60 });
  const r = m.run();
  return { status: r.status, message: r.message, steps: r.steps, state: r.state, machine: m };
}
const refCache = new Map<string, Outcome>();
export function refOutcome(l: Level, seed?: number): Outcome {
  const k = `${l.id}#${seed ?? ""}`;
  let o = refCache.get(k);
  if (!o) { o = runData(l, l.sol, dataInst(l, seed), 100000); refCache.set(k, o); }
  return o;
}
/** the most steps a program may use on this instance */
export const stepBound = (l: Level, seed?: number): number => Math.ceil(refOutcome(l, seed).steps * 1.5) + 30;
export const weighBound = (l: Level): number => extOf(l).data?.maxWeighs ?? 1e9;

function sameValue(a: number[] | number | undefined, b: number[] | number | undefined): boolean {
  if (Array.isArray(a) || Array.isArray(b)) return JSON.stringify(a ?? []) === JSON.stringify(b ?? []);
  return Math.abs((a ?? 0) - (b ?? 0)) < 1e-9;
}
function judgeOn(l: Level, prog: Program, seed?: number, budget?: number): Evaluation {
  const e = extOf(l).data!, inst = dataInst(l, seed), want = refOutcome(l, seed);
  const bound = e.eff ? stepBound(l, seed) : undefined;
  const r = runData(l, prog, inst, bound ? Math.min(bound, budget ?? 1e9) : budget);
  const out = (won: boolean, missing: string[]): Evaluation => ({ status: r.status, message: r.message, steps: r.steps, state: r.state, won, missing });
  if (r.status === "budget" && bound) return out(false, [`程序用的步数太多，最多 ${bound} 步。`]);
  if (r.status !== "done") return out(false, [r.message]);
  const missing: string[] = [];
  for (const name of e.check) {
    const isList = name in want.state.lists! || name in inst.lists;
    if (isList ? !sameValue(r.state.lists![name], want.state.lists![name]) : !sameValue(r.state.vars[name], want.state.vars[name])) missing.push(isList ? `列表 ${name} 的内容不对。` : `变量 ${name} 的值不对。`);
  }
  if (e.maxWeighs !== undefined && (r.state.weighs ?? 0) > e.maxWeighs) missing.push(`天平用了 ${r.state.weighs} 次，最多 ${e.maxWeighs} 次。`);
  if (e.maxSwaps !== undefined) { const lim = e.maxSwaps === "len-1" ? Math.max(0, (inst.lists.xs?.length ?? 1) - 1) : e.maxSwaps; if ((r.state.swaps ?? 0) > lim) missing.push(`交换了 ${r.state.swaps} 次，最多 ${lim} 次。`); }
  return out(missing.length === 0, missing);
}
const dataHandler: import("./coding-levels").KindHandler = {
  instance(l: Level, seed?: number): Instance { return { world: { kind: "data" }, state: dataState(dataInst(l, seed)), goal: {} }; },
  evaluate(l: Level, prog: Program, budget?: number): Evaluation {
    const first = judgeOn(l, prog, undefined, budget);
    if (!first.won) return first;
    for (const s of VARIANT_SEEDS) {
      const r = judgeOn(l, prog, s, budget);
      if (!r.won) return { ...r, won: false, variantFailed: s, missing: ["这个程序在另一组数据上没有成功。", ...r.missing] };
    }
    return first;
  },
};
/** what the data of an instance must look like at the end (shown as the target) */
export const dataTarget = (l: Level, seed?: number): { lists: Record<string, number[]>; vars: Record<string, number> } => {
  const e = extOf(l).data!, want = refOutcome(l, seed).state;
  const lists: Record<string, number[]> = {}, vars: Record<string, number> = {};
  for (const n of e.check) { if (n in want.lists!) lists[n] = want.lists![n]; else vars[n] = want.vars[n] ?? 0; }
  return { lists, vars };
};

// ---------- the stage ----------
KINDS.stage = {
  instance(l) { return { world: { kind: "stage" }, state: stageState(extOf(l).stage!), goal: {} }; },
  evaluate(l, prog) {
    const ext = extOf(l).stage!;
    const j = judgeStage(l.id, prog, l.sol, ext);
    return { status: j.status === "error" ? "error" : "done", message: j.message, steps: 0, state: stageState(ext), won: j.won, missing: j.missing };
  },
};
KINDS.data = dataHandler;

// ---------- the levels ----------
const spec = (world: number, no: number, title: string, o: Omit<LevelSpec, "id" | "world" | "no" | "title">): LevelSpec => ({ id: `w${world}-${String(no).padStart(2, "0")}`, world, no, title, ...o });
const T = (o: Partial<StageExt> & Pick<StageExt, "sprites" | "slots" | "inputs" | "ticks" | "checks" | "texts">): StageExt => ({ ...o });
const CAT = { id: "cat", art: "cat", x: -80, y: -20, label: "小猫" };
const DOG = { id: "dog", art: "dog", x: 80, y: -20, label: "小狗" };
const sec = (s: number) => Math.round(s * 20);
const KEYS = { right: "→", left: "←", up: "↑", down: "↓", space: "空格" };

const TEXTS = { hi: "你好！", bye: "再见！", meow: "喵！", hi2: "你好，小猫！", q1: "你喜欢苹果吗？", a1: "喜欢！", q2: "我也喜欢。", q: "3 + 4 = 7 吗？", ok: "答对了！", no: "再想想。", wow: "真好玩！" };

/** the basket is moved right and left over the whole stage: 10 ticks right, then 20 ticks left, 20 right ... */
const SWEEP: Input[] = [{ tick: 0, type: "key", key: "right", hold: 10 }, ...Array.from({ length: 8 }, (_, k): Input => ({ tick: 10 + 20 * k, type: "key", key: k % 2 ? "right" : "left", hold: 20 }))];
const W7: LevelSpec[] = [
  spec(7, 1, "出发", { kind: "stage", palette: ["smove", "sturn"], solution: "on start cat { smove 100 }", max: 3, lesson: "stage",
    ext: { goal: ["点“开始”。让小猫向右走 100 步。"], stage: T({ sprites: [CAT], slots: [{ sprite: "cat", on: "start", events: ["start"] }], inputs: [], ticks: sec(2), texts: TEXTS, checks: [{ tick: sec(1) }] }) } as Ext } as LevelSpec),
  spec(7, 2, "说话", { kind: "stage", palette: ["say"], solution: "on start cat { say hi }", max: 3,
    ext: { goal: ["让小猫说“你好！”。"], stage: T({ sprites: [CAT], slots: [{ sprite: "cat", on: "start", events: ["start"] }], inputs: [], ticks: sec(2), texts: TEXTS, checks: [{ tick: sec(0.5), props: ["say"] }] }) } as Ext } as LevelSpec),
  spec(7, 3, "等一等", { kind: "stage", palette: ["say", "wait"], solution: "on start cat { say hi wait 1 say bye }", max: 5,
    ext: { goal: ["小猫先说“你好！”，等 1 秒，再说“再见！”。"], stage: T({ sprites: [CAT], slots: [{ sprite: "cat", on: "start", events: ["start"] }], inputs: [], ticks: sec(3), texts: TEXTS, checks: [{ tick: sec(0.5), props: ["say"] }, { tick: sec(1.5), props: ["say"] }] }) } as Ext } as LevelSpec),
  spec(7, 4, "点一下", { kind: "stage", palette: ["say"], solution: "on tap cat { say meow }", max: 3, lesson: "events",
    ext: { goal: ["点一下小猫，它说“喵！”。", "在没有点之前，小猫不说话。"], stage: T({ sprites: [CAT], slots: [{ sprite: "cat", on: "start", events: ["start", "tap"] }], inputs: [{ tick: sec(1), type: "tap", sprite: "cat" }], ticks: sec(3), texts: TEXTS, checks: [{ tick: sec(0.5), props: ["say"] }, { tick: sec(2), props: ["say"] }] }) } as Ext } as LevelSpec),
  spec(7, 5, "按键", { kind: "stage", palette: ["changex", "smove"], solution: "on key(right) cat { changex 30 } on key(left) cat { changex -30 }", max: 5,
    ext: { goal: ["按 → 键，小猫向右走 30 步。", "按 ← 键，小猫向左走 30 步。"], stage: T({ sprites: [CAT], slots: [{ sprite: "cat", on: "start", events: ["start", "key(right)", "key(left)"] }, { sprite: "cat", on: "start", events: ["start", "key(right)", "key(left)"] }],
      inputs: [{ tick: sec(0.5), type: "key", key: "right" }, { tick: sec(1.5), type: "key", key: "right" }, { tick: sec(2.5), type: "key", key: "left" }], ticks: sec(4), texts: TEXTS, keys: KEYS,
      checks: [{ tick: sec(1) }, { tick: sec(2) }, { tick: sec(3) }] }) } as Ext } as LevelSpec),
  spec(7, 6, "走路动画", { kind: "stage", palette: ["smove", "nextcostume", "repeat"], solution: "on start cat { repeat 8 { smove 10 nextcostume } }", max: 6, lesson: "anim",
    ext: { goal: ["小猫向右走 8 次，每次走 10 步。", "每走一次，换一个造型。"], stage: T({ sprites: [CAT], slots: [{ sprite: "cat", on: "start", events: ["start"] }], inputs: [], ticks: sec(2), texts: TEXTS, checks: [{ tick: 4, props: ["x", "costume"] }, { tick: 12, props: ["x", "costume"] }] }) } as Ext } as LevelSpec),
  spec(7, 7, "时钟", { kind: "stage", palette: ["wait", "sturn", "forever"], solution: "on start hand { forever { wait 1 sturn 6 } }", max: 5,
    ext: { goal: ["秒针每秒钟转 6 度。", "一直转下去。"], stage: T({ sprites: [{ id: "hand", art: "hand", x: 0, y: 0, dir: 0, label: "秒针" }], slots: [{ sprite: "hand", on: "start", events: ["start"] }], inputs: [], ticks: sec(6), texts: TEXTS,
      checks: [{ tick: sec(2.5), props: ["dir"] }, { tick: sec(5.5), props: ["dir"] }] }) } as Ext } as LevelSpec),
  spec(7, 8, "随机跳", { kind: "stage", palette: ["goto"], solution: "on tap cat { goto(rand(-100, 100), rand(-60, 60)) }", max: 3, lesson: "random",
    ext: { free: true, rep: ["rand"], goal: ["点一下小猫，它跳到舞台上的任意位置。", "x 在 -100 到 100 之间，y 在 -60 到 60 之间。"], stage: T({ sprites: [CAT], slots: [{ sprite: "cat", on: "start", events: ["start", "tap"] }],
      inputs: [{ tick: sec(0.5), type: "tap", sprite: "cat" }, { tick: sec(1.5), type: "tap", sprite: "cat" }, { tick: sec(2.5), type: "tap", sprite: "cat" }, { tick: sec(3.5), type: "tap", sprite: "cat" }], ticks: sec(5), texts: TEXTS,
      checks: [{ tick: sec(4.5), range: { sprite: "cat", x: [-100, 100], y: [-60, 60], moved: true } }], seeds: [7, 11, 23] }) } as Ext } as LevelSpec),
  spec(7, 9, "两个朋友", { kind: "stage", palette: ["say", "broadcast"], solution: "on start cat { say hi broadcast hello } on recv(hello) dog { say hi2 }", max: 5, lesson: "broadcast",
    ext: { goal: ["小猫说“你好！”，并发出“问候”的消息。", "小狗收到消息，回答“你好，小猫！”。"], stage: T({ sprites: [CAT, DOG], slots: [{ sprite: "cat", on: "start", events: ["start"] }, { sprite: "dog", on: "start", events: ["start", "recv(hello)"] }], inputs: [], ticks: sec(2), texts: TEXTS, msgs: { hello: "问候" },
      checks: [{ tick: sec(0.5), props: ["say"] }] }) } as Ext } as LevelSpec),
  spec(7, 10, "小故事", { kind: "stage", palette: ["sayfor", "broadcast"], solution: "on start cat { sayfor(q1, 2) broadcast ask } on recv(ask) dog { sayfor(a1, 2) broadcast again } on recv(again) cat { sayfor(q2, 2) }", max: 8,
    ext: { goal: ["小猫问：“你喜欢苹果吗？”，说 2 秒。", "小狗收到消息，回答“喜欢！”，说 2 秒。", "小猫再说一句：“我也喜欢。”。"], stage: T({ sprites: [CAT, DOG],
      slots: [{ sprite: "cat", on: "start", events: ["start"] }, { sprite: "dog", on: "start", events: ["start", "recv(ask)", "recv(again)"] }, { sprite: "cat", on: "start", events: ["start", "recv(ask)", "recv(again)"] }],
      inputs: [], ticks: sec(7), texts: TEXTS, msgs: { ask: "提问", again: "再说" }, checks: [{ tick: sec(1), props: ["say"] }, { tick: sec(3), props: ["say"] }, { tick: sec(5), props: ["say"] }] }) } as Ext } as LevelSpec),
  spec(7, 11, "音乐", { kind: "stage", palette: ["note", "repeat"], solution: "on start bird { repeat 2 { note(60, 1) } repeat 2 { note(67, 1) } repeat 2 { note(69, 1) } note(67, 2) }", max: 9, lesson: "music",
    ext: { goal: ["弹《小星星》的前七个音：1 1 5 5 6 6 5。", "最后一个音长 2 拍。"], stage: T({ sprites: [{ id: "bird", art: "bird", x: 0, y: -10, label: "小鸟" }], slots: [{ sprite: "bird", on: "start", events: ["start"] }], inputs: [], ticks: sec(5), texts: TEXTS, checks: [{ tick: sec(4.5), props: [], notes: true }] }) } as Ext } as LevelSpec),
  spec(7, 12, "宠物跟着点击", { kind: "stage", palette: ["goto"], solution: "on stagetap pet { goto(tapX, tapY) }", max: 3,
    ext: { free: true, rep: ["me"], goal: ["点一下舞台，宠物跑到被点的位置。"], stage: T({ sprites: [{ id: "pet", art: "dog", x: -80, y: -50, label: "宠物" }], slots: [{ sprite: "pet", on: "start", events: ["start", "stagetap"] }],
      inputs: [{ tick: sec(0.5), type: "stagetap", x: 60, y: 40 }, { tick: sec(1.5), type: "stagetap", x: -70, y: 30 }, { tick: sec(2.5), type: "stagetap", x: 20, y: -60 }], ticks: sec(4), texts: TEXTS, checks: [{ tick: sec(1) }, { tick: sec(2) }, { tick: sec(3.5) }] }) } as Ext } as LevelSpec),
  spec(7, 13, "小测验", { kind: "stage", palette: ["say", "change"], vars: ["score"], solution: "on start teacher { say q } on tap a { say ok change score by 1 } on tap b { say no }", max: 7, lesson: "score",
    ext: { goal: ["老师问：“3 + 4 = 7 吗？”。", "点“对”：说“答对了！”，得 1 分。", "点“错”：说“再想想。”。"], stage: T({
      sprites: [{ id: "teacher", art: "robot", x: -70, y: 30, label: "老师" }, { id: "a", art: "btn", text: "✓", x: -20, y: -55, label: "对" }, { id: "b", art: "btn", text: "✗", x: 50, y: -55, label: "错" }],
      slots: [{ sprite: "teacher", on: "start", events: ["start"] }, { sprite: "a", on: "start", events: ["start", "tap"] }, { sprite: "b", on: "start", events: ["start", "tap"] }], vars: ["score"],
      inputs: [{ tick: sec(1), type: "tap", sprite: "b" }, { tick: sec(2), type: "tap", sprite: "a" }, { tick: sec(3), type: "tap", sprite: "a" }], ticks: sec(4), texts: TEXTS,
      checks: [{ tick: sec(0.5), sprites: ["teacher"], props: ["say"] }, { tick: sec(1.5), sprites: ["b"], props: ["say"] }, { tick: sec(2.5), sprites: ["a"], props: ["say"], vars: ["score"] }, { tick: sec(3.5), vars: ["score"] }] }) } as Ext } as LevelSpec),
  spec(7, 14, "接苹果", { kind: "stage", boss: true, palette: ["forever", "if", "changex", "change", "broadcast"], vars: ["score"], solution: "on start basket { forever { if keyDown(left) { changex -10 } if keyDown(right) { changex 10 } if touching(apple) { change score by 1 broadcast caught } } }", max: 12,
    ext: { free: true, rep: ["keyDown", "touching"], goal: ["用 ← → 键移动篮子。", "篮子碰到苹果时，得 1 分，并通知苹果回到上面。"], stage: T({
      sprites: [{ id: "basket", art: "basket", x: 0, y: -70, label: "篮子" }, { id: "apple", art: "apple", x: 30, y: 90, label: "苹果" }],
      slots: [{ sprite: "basket", on: "start", events: ["start"] }], vars: ["score"], msgs: { caught: "接到了" }, keys: KEYS,
      given: "on start apple { forever { goto(rand(-100, 100), 90) repeat 15 { changey -12 } } } on recv(caught) apple { goto(rand(-100, 100), 90) }",
      inputs: SWEEP, ticks: sec(9), texts: TEXTS,
      checks: [{ tick: sec(1), sprites: ["basket"] }, { tick: sec(8.5), min: { score: 3 } }] }) } as Ext } as LevelSpec),
];

const DATA = ["push", "lset", "lremove", "swap", "lclear"] as const;
void DATA;
const d = (gen: string, check: string[], view: DataExt["view"], o: Partial<DataExt> = {}): DataExt => ({ gen, check, view, ...o });
const L2 = ["len", "item"];
const LALL = ["len", "item", "sum", "max", "min", "has", "count", "indexOf"];
const W8: LevelSpec[] = [
  spec(8, 1, "两个数字", { kind: "turtle", palette: ["fd", "tr", "repeat", "call"], funcs: [{ name: "rect", params: ["a", "b"] }], lesson: "params2",
    solution: "def rect(a, b) { repeat 2 { fd a tr 90 fd b tr 90 } } rect(80, 40) rect(40, 20)", max: 8, note: "函数 rect(a, b)：画长为 a、宽为 b 的长方形。调用 rect(80, 40) 和 rect(40, 20)。", ext: { free: true, goal: [] } as Ext } as LevelSpec),
  spec(8, 2, "返回数字", { kind: "data", palette: ["return"], funcs: [{ name: "double", param: "x" }], solution: "def double(x) { return x * 2 }", max: 2, lesson: "return",
    ext: { free: true, hideMain: true, ops: ["+", "-", "*"], goal: ["完成函数 double(x)：返回 x 的 2 倍。", "下面的测试会调用它。"], data: d("double", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 3, "三个参数", { kind: "data", palette: ["return"], funcs: [{ name: "sum3", params: ["a", "b", "c"] }], solution: "def sum3(a, b, c) { return a + b + c }", max: 2,
    ext: { free: true, hideMain: true, goal: ["完成函数 sum3(a, b, c)：返回三个数的和。"], data: d("sum3", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 4, "较大的数", { kind: "data", palette: ["return", "if"], funcs: [{ name: "bigger", params: ["a", "b"] }], solution: "def bigger(a, b) { if a > b { return a } return b }", max: 5,
    ext: { free: true, hideMain: true, goal: ["完成函数 bigger(a, b)：返回两个数中较大的一个。"], data: d("bigger", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 5, "偶数吗", { kind: "data", palette: ["return"], funcs: [{ name: "even", param: "n" }], solution: "def even(n) { return n % 2 == 0 }", max: 2,
    ext: { free: true, hideMain: true, ops: ["+", "-", "*", "/", "%"], goal: ["完成函数 even(n)：n 是偶数时返回 1，否则返回 0。", "提示：n 除以 2 的余数是 0。"], data: d("even", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 6, "函数调用函数", { kind: "data", palette: ["return", "call"], funcs: [{ name: "sq", param: "n" }, { name: "hyp2", params: ["a", "b"] }], solution: "def sq(n) { return n * n } def hyp2(a, b) { return sq(a) + sq(b) }", max: 4,
    ext: { free: true, hideMain: true, rep: ["call"], goal: ["完成 sq(n)：返回 n 的平方。", "完成 hyp2(a, b)：返回 a 的平方加 b 的平方，要用到 sq。"], data: d("hyp2", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 7, "自己调用自己", { family: "line", goal: { flag: true }, palette: ["move", "if", "call"], funcs: [{ name: "go" }], lesson: "recursion", conds: ["pathAhead"],
    solution: "def go { if pathAhead { move go } } go", max: 5, ext: { free: false, recursion: true } as Ext } as LevelSpec),
  spec(8, 8, "停止条件", { kind: "data", palette: ["return", "if", "call"], funcs: [{ name: "total", param: "n" }], lesson: "base", solution: "def total(n) { if n == 0 { return 0 } return n + total(n - 1) }", max: 6,
    ext: { free: true, hideMain: true, recursion: true, rep: ["call"], goal: ["完成 total(n)：返回 1 + 2 + … + n。", "total(0) 是 0。函数要调用自己，并且要有停止条件。"], data: d("total", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 9, "阶乘", { kind: "data", palette: ["return", "if", "call"], funcs: [{ name: "fact", param: "n" }], solution: "def fact(n) { if n == 0 { return 1 } return n * fact(n - 1) }", max: 6,
    ext: { free: true, hideMain: true, recursion: true, rep: ["call"], goal: ["完成 fact(n)：返回 n 的阶乘，即 1 × 2 × … × n。", "0 的阶乘是 1。"], data: d("fact", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 10, "斐波那契数列", { kind: "data", palette: ["return", "if", "call"], funcs: [{ name: "fib", param: "n" }], solution: "def fib(n) { if n < 2 { return n } return fib(n - 1) + fib(n - 2) }", max: 6,
    ext: { free: true, hideMain: true, recursion: true, rep: ["call"], goal: ["完成 fib(n)：数列 0, 1, 1, 2, 3, 5, 8 … 的第 n 项（从第 0 项算起）。", "每一项等于前两项的和。"], data: d("fib", ["r1", "r2", "r3"], "calc") } as Ext } as LevelSpec),
  spec(8, 11, "画一棵树", { kind: "turtle", palette: ["fd", "tl", "tr", "if", "call"], funcs: [{ name: "tree", param: "n" }], lesson: "fractal", conds: ["n > 8"],
    solution: "def tree(n) { if n > 8 { fd n tl 30 tree(n / 2) tr 60 tree(n / 2) tl 30 fd 0 - n } } tree(48)", max: 12, note: "树干长 48。每个树枝的长度是上一级的一半，小于 8 就不再画。", ext: { free: true, recursion: true } as Ext } as LevelSpec),
  spec(8, 12, "雪花曲线", { kind: "turtle", palette: ["fd", "tl", "tr", "if", "ifelse", "repeat", "call"], funcs: [{ name: "koch", params: ["n", "len"] }], conds: ["n == 0"],
    solution: "def koch(n, len) { if n == 0 { fd len } else { koch(n - 1, len / 3) tl 60 koch(n - 1, len / 3) tr 120 koch(n - 1, len / 3) tl 60 koch(n - 1, len / 3) } } repeat 3 { koch(2, 90) tr 120 }", max: 16,
    note: "每条边 koch(2, 90)：n 是层数，len 是长度。n 为 0 时画直线，否则分成四段。", ext: { free: true, recursion: true } as Ext } as LevelSpec),
  spec(8, 13, "三角形里的三角形", { kind: "turtle", palette: ["fd", "tl", "tr", "if", "ifelse", "repeat", "call"], funcs: [{ name: "tri", params: ["n", "s"] }], conds: ["n == 0"],
    solution: "def tri(n, s) { if n == 0 { repeat 3 { fd s tr 120 } } else { tri(n - 1, s / 2) fd s / 2 tri(n - 1, s / 2) fd 0 - s / 2 tr 60 fd s / 2 tl 60 tri(n - 1, s / 2) tr 60 fd 0 - s / 2 tl 60 } } tri(2, 96)", max: 24,
    note: "谢尔宾斯基三角形：n 为 0 时画一个三角形，否则在三个角上各画一个小三角形（边长减半）。", ext: { free: true, recursion: true } as Ext } as LevelSpec),
  spec(8, 14, "递归大挑战", { kind: "data", boss: true, palette: ["return", "if", "call"], funcs: [{ name: "power", params: ["a", "b"] }, { name: "digsum", param: "n" }],
    solution: "def power(a, b) { if b == 0 { return 1 } return a * power(a, b - 1) } def digsum(n) { if n < 10 { return n } return n % 10 + digsum(floor(n / 10)) }", max: 12,
    ext: { free: true, hideMain: true, recursion: true, rep: ["call", "floor"], ops: ["+", "-", "*", "/", "%"], goal: ["完成 power(a, b)：返回 a 的 b 次方。", "完成 digsum(n)：返回 n 各位数字之和，例如 1234 是 10。"], data: d("boss8", ["r1", "r2", "r3", "r4"], "calc") } as Ext } as LevelSpec),
];

const FOR = ["for", "each", "if", "ifelse", "while", "set", "change"] as const;
void FOR;
const W9: LevelSpec[] = [
  spec(9, 1, "建立列表", { kind: "data", palette: ["push"], solution: "add(xs, 4) add(xs, 8) add(xs, 15)", max: 5, lesson: "list",
    ext: { free: true, lists: ["xs"], goal: ["列表 xs 现在是空的。", "依次加入 4、8、15。"], data: d("empty", ["xs"], "list") } as Ext } as LevelSpec),
  spec(9, 2, "第几项", { kind: "data", palette: ["set"], vars: ["a"], solution: "set a = item(xs, 3)", max: 3,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["把列表 xs 的第 3 项放进变量 a。"], data: d("list3", ["a"], "list") } as Ext } as LevelSpec),
  spec(9, 3, "有多长", { kind: "data", palette: ["set"], vars: ["n", "last"], solution: "set n = len(xs) set last = item(xs, n)", max: 4,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["变量 n 放列表的长度。", "变量 last 放最后一项。"], data: d("list3", ["n", "last"], "list") } as Ext } as LevelSpec),
  spec(9, 4, "求和", { kind: "data", palette: ["each", "change"], vars: ["s", "x"], solution: "each x in xs { change s by x }", max: 4, lesson: "each",
    ext: { free: true, lists: ["xs"], goal: ["用“对每一项”把 xs 的所有数相加，结果放进 s。"], data: d("list3", ["s"], "list") } as Ext } as LevelSpec),
  spec(9, 5, "最大值", { kind: "data", palette: ["each", "if", "set"], vars: ["m", "x"], solution: "set m = item(xs, 1) each x in xs { if x > m { set m = x } }", max: 7, lesson: "agg",
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["找出 xs 里最大的数，放进变量 m。", "提示：先假设第 1 项最大，再逐项比较。"], data: d("list20", ["m"], "bars") } as Ext } as LevelSpec),
  spec(9, 6, "最小值", { kind: "data", palette: ["each", "if", "set"], vars: ["m", "x"], solution: "set m = item(xs, 1) each x in xs { if x < m { set m = x } }", max: 7,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["找出 xs 里最小的数，放进变量 m。"], data: d("list20", ["m"], "bars") } as Ext } as LevelSpec),
  spec(9, 7, "计数", { kind: "data", palette: ["each", "if", "change"], vars: ["c", "x"], solution: "each x in xs { if x > 5 { change c by 1 } }", max: 5,
    ext: { free: true, lists: ["xs"], goal: ["数一数 xs 里有几个数大于 5，结果放进 c。"], data: d("list3", ["c"], "list") } as Ext } as LevelSpec),
  spec(9, 8, "筛选偶数", { kind: "data", palette: ["each", "if", "push"], vars: ["x"], solution: "each x in xs { if x % 2 == 0 { add(evens, x) } }", max: 5, lesson: "filter",
    ext: { free: true, lists: ["xs", "evens"], ops: ["+", "-", "*", "/", "%"], goal: ["把 xs 里的偶数依次放进列表 evens。"], data: d("filter", ["evens"], "list") } as Ext } as LevelSpec),
  spec(9, 9, "查找", { kind: "data", palette: ["while", "if", "set", "change"], vars: ["i", "pos"], solution: "set pos = 0 set i = 1 while i <= len(xs) and pos == 0 { if item(xs, i) == t { set pos = i } change i by 1 }", max: 9,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["在 xs 里找数 t，把它第一次出现的位置放进 pos。", "找不到时，pos 是 0。"], data: d("search", ["pos"], "list") } as Ext } as LevelSpec),
  spec(9, 10, "地板上的数字", { family: "numrow", goal: { flag: true }, palette: ["move", "until", "push"], conds: ["onFlag"], lesson: "floor", ext: { free: true, lists: ["xs"], rep: ["me"] } as Ext,
    solution: "until onFlag { add(xs, floorNum) move }", max: 6, note: "机器人站在每个数字上时，把脚下的数字放进列表 xs。" } as LevelSpec),
  spec(9, 11, "平均数", { kind: "data", palette: ["set"], vars: ["total", "avg"], solution: "set total = sum(xs) set avg = total / len(xs)", max: 4,
    ext: { free: true, lists: ["xs"], rep: ["len", "sum"], ops: ["+", "-", "*", "/"], goal: ["变量 total 放所有数的和。", "变量 avg 放平均数（和除以个数）。"], data: d("avg", ["total", "avg"], "bars") } as Ext } as LevelSpec),
  spec(9, 12, "出现最多的数", { kind: "data", palette: ["each", "if", "set"], vars: ["x", "c", "best", "mode"], solution: "each x in xs { set c = count(xs, x) if c > best { set best = c set mode = x } }", max: 8,
    ext: { free: true, lists: ["xs"], rep: ["count"], goal: ["找出 xs 里出现次数最多的数，放进 mode。", "best 记录目前最多的次数。"], data: d("mode", ["mode"], "bars") } as Ext } as LevelSpec),
  spec(9, 13, "购物清单", { kind: "data", palette: ["each", "if", "change", "push"], vars: ["p", "spent"], solution: "each p in ps { if spent + p <= b { change spent by p add(bag, p) } }", max: 8,
    ext: { free: true, lists: ["ps", "bag"], goal: ["列表 ps 是商品的价格，b 是预算。", "按顺序买：买得起就买，把价格放进 bag，并把总花费放进 spent。"], data: d("shop", ["spent", "bag"], "list") } as Ext } as LevelSpec),
  spec(9, 14, "凑十游戏", { kind: "data", boss: true, palette: ["for", "if", "change"], vars: ["i", "j", "pairs"], solution: "for i = 1 to len(xs) { for j = i + 1 to len(xs) { if item(xs, i) + item(xs, j) == 10 { change pairs by 1 } } }", max: 10, lesson: "nested",
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["数一数 xs 里有多少对数（位置不同）加起来是 10。", "每一对只数一次。结果放进 pairs。"], data: d("pairs", ["pairs"], "list") } as Ext } as LevelSpec),
];

const SORTP: PaletteKind[] = ["for", "while", "if", "set", "change", "swap"];
const W10: LevelSpec[] = [
  spec(10, 1, "顺序查找", { kind: "data", palette: ["while", "if", "set", "change"], vars: ["i", "pos"], solution: "set pos = 0 set i = 1 while i <= len(xs) and pos == 0 { if item(xs, i) == t { set pos = i } change i by 1 }", max: 9, lesson: "search",
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["在 xs 里找数 t，把第一次出现的位置放进 pos。", "找到以后要马上停下来：步数不能超过限制。"], data: d("search20", ["pos"], "bars", { eff: true }) } as Ext } as LevelSpec),
  spec(10, 2, "二分查找", { kind: "data", palette: ["while", "if", "ifelse", "set"], vars: ["lo", "hi", "mid", "pos"], lesson: "binary",
    solution: "set lo = 1 set hi = len(xs) set pos = 0 while lo <= hi and pos == 0 { set mid = floor((lo + hi) / 2) if item(xs, mid) == t { set pos = mid } else { if item(xs, mid) < t { set lo = mid + 1 } else { set hi = mid - 1 } } }", max: 16,
    ext: { free: true, lists: ["xs"], rep: ["len", "item", "floor"], ops: ["+", "-", "*", "/"], goal: ["xs 已经从小到大排好，一共有 64 个数。", "每次看中间的数，把范围缩小一半。找到 t，把位置放进 pos。"], data: d("sorted64", ["pos"], "bars", { eff: true }) } as Ext } as LevelSpec),
  spec(10, 3, "选择排序", { kind: "data", palette: SORTP, vars: ["i", "j", "m"], lesson: "sort", solution: "for i = 1 to len(xs) - 1 { set m = i for j = i + 1 to len(xs) { if item(xs, j) < item(xs, m) { set m = j } } swap(xs, i, m) }", max: 12,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["把 xs 从小到大排好。", "每一轮：找出剩下的最小的数，换到最前面。"], data: d("sortme", ["xs"], "bars") } as Ext } as LevelSpec),
  spec(10, 4, "冒泡排序", { kind: "data", palette: SORTP, vars: ["i", "j"], solution: "for i = 1 to len(xs) - 1 { for j = 1 to len(xs) - i { if item(xs, j) > item(xs, j + 1) { swap(xs, j, j + 1) } } }", max: 8,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["把 xs 从小到大排好。", "每一轮：从左到右，相邻的两个数如果左边大，就交换。"], data: d("sortme", ["xs"], "bars") } as Ext } as LevelSpec),
  spec(10, 5, "插入排序", { kind: "data", palette: SORTP, vars: ["i", "j"], solution: "for i = 2 to len(xs) { set j = i while j > 1 and item(xs, j - 1) > item(xs, j) { swap(xs, j, j - 1) change j by -1 } }", max: 9,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["把 xs 从小到大排好。", "每一轮：把第 i 个数向左移到合适的位置，像整理扑克牌。"], data: d("sortme", ["xs"], "bars") } as Ext } as LevelSpec),
  spec(10, 6, "少换几次", { kind: "data", palette: SORTP, vars: ["i", "j", "m"], solution: "for i = 1 to len(xs) - 1 { set m = i for j = i + 1 to len(xs) { if item(xs, j) < item(xs, m) { set m = j } } if m != i { swap(xs, i, m) } }", max: 14,
    ext: { free: true, lists: ["xs"], rep: L2, goal: ["把 xs 从小到大排好，交换的次数不能超过 长度 − 1。", "冒泡排序会换很多次，选择排序最多换 长度 − 1 次。"], data: d("sortme", ["xs"], "bars", { maxSwaps: "len-1" }) } as Ext } as LevelSpec),
  spec(10, 7, "贪心找零", { kind: "data", palette: ["each", "while", "change"], vars: ["c", "n", "amt"], lesson: "greedy", solution: "each c in coins { while amt >= c { change amt by 0 - c change n by 1 } }", max: 8,
    ext: { free: true, lists: ["coins"], ops: ["+", "-", "*"], goal: ["要找 amt 分钱，硬币面值在列表 coins 里（从大到小）。", "每次先用最大的硬币。把用掉的硬币个数放进 n。"], data: d("coins", ["n", "amt"], "list") } as Ext } as LevelSpec),
  spec(10, 8, "最大公约数", { kind: "data", palette: ["while", "set"], vars: ["a", "b", "t", "g"], lesson: "euclid", solution: "while b != 0 { set t = b set b = a % b set a = t } set g = a", max: 8,
    ext: { free: true, ops: ["+", "-", "*", "/", "%"], goal: ["求 a 和 b 的最大公约数，放进 g。", "辗转相除法：用 a 除以 b 的余数代替 b，直到 b 为 0。"], data: d("gcd", ["g"], "list", { eff: true }) } as Ext } as LevelSpec),
  spec(10, 9, "质数吗", { kind: "data", palette: ["while", "if", "set", "change"], vars: ["p", "d"], solution: "set p = 1 set d = 2 while d * d <= n and p == 1 { if n % d == 0 { set p = 0 } change d by 1 } if n < 2 { set p = 0 }", max: 12,
    ext: { free: true, ops: ["+", "-", "*", "/", "%"], goal: ["n 是质数时，p 是 1，否则 p 是 0。", "只需要试到 d × d 大于 n 为止：步数有限制。"], data: d("prime", ["p"], "list", { eff: true }) } as Ext } as LevelSpec),
  spec(10, 10, "最短路线", { kind: "data", palette: ["while", "for", "if", "set", "change", "push", "lset"], vars: ["head", "u", "k", "v"], lesson: "bfs",
    solution: "setItem(dist, 1, 0) add(q, 1) set head = 1 while head <= len(q) { set u = item(q, head) change head by 1 for k = 1 to deg(u) { set v = nbr(u, k) if item(dist, v) == -1 { setItem(dist, v, item(dist, u) + 1) add(q, v) } } }", max: 16,
    ext: { free: true, lists: ["dist", "q"], rep: ["len", "item", "deg", "nbr"], goal: ["地图上有 7 个地点，从 1 号出发。", "列表 dist 放每个地点到 1 号的最少步数（现在都是 −1）。队列 q 放等待处理的地点。"], data: d("graph", ["dist"], "graph") } as Ext } as LevelSpec),
  spec(10, 11, "沿着左墙走", { family: "mazeL", goal: { flag: true }, palette: ["move", "left", "right", "until", "ifelse"], conds: ["onFlag", "pathLeft", "pathAhead"], ext: {} as Ext,
    solution: "until onFlag { if pathLeft { left move } else { if pathAhead { move } else { right } } }", max: 10, note: "左手扶着墙走，就能走出迷宫。" } as LevelSpec),
  spec(10, 12, "天平找最重", { kind: "data", palette: ["for", "if", "set"], vars: ["i", "best"], lesson: "scale", solution: "set best = 1 for i = 2 to 8 { if heavier(i, best) { set best = i } }", max: 7,
    ext: { free: true, rep: ["heavier"], goal: ["8 个硬币，其中有一个最重。heavier(i, j) 比较第 i 个和第 j 个。", "找出最重的硬币，把编号放进 best。天平最多用 7 次。"], data: d("weights8", ["best"], "scale", { maxWeighs: 7 }) } as Ext } as LevelSpec),
  spec(10, 13, "天平排序", { kind: "data", palette: ["for", "while", "set", "change", "swap"], vars: ["i", "j"], solution: "for i = 2 to 5 { set j = i while j > 1 and heavier(item(order, j - 1), item(order, j)) { swap(order, j, j - 1) change j by -1 } }", max: 10,
    ext: { free: true, lists: ["order"], rep: ["heavier", "item"], goal: ["5 个硬币。列表 order 放硬币编号。", "排成从轻到重的顺序。天平最多用 10 次。"], data: d("weights5", ["order"], "scale", { maxWeighs: 10 }) } as Ext } as LevelSpec),
  spec(10, 14, "合并两个队伍", { kind: "data", boss: true, palette: ["while", "if", "ifelse", "set", "change", "push"], vars: ["i", "j"], solution: "set i = 1 set j = 1 while i <= len(a) or j <= len(b) { if j > len(b) or (i <= len(a) and item(a, i) <= item(b, j)) { add(c, item(a, i)) change i by 1 } else { add(c, item(b, j)) change j by 1 } }", max: 14,
    ext: { free: true, lists: ["a", "b", "c"], rep: L2, goal: ["a 和 b 都已经从小到大排好。", "把它们合并成一个从小到大的列表 c。步数有限制。"], data: d("merge", ["c"], "list", { eff: true }) } as Ext } as LevelSpec),
];
void LALL;

// numbers on the floor (world 9) and the left-hand rule (world 10): two map families
const numrow = (seed: number) => {
  const r = rngOf(seed, 91), n = ri(r, 3, 6), digits = Array.from({ length: n }, () => ri(r, 1, 9));
  const top = "#".repeat(n + 3);
  return { rows: [top, "#" + digits.join("") + "F#", top], start: { x: 1, y: 1, dir: 1 }, goal: { flag: true, lists: { xs: digits } } };
};
FAMILIES.numrow = numrow as never;
FAMILIES.mazeL = ((s: number) => maze(rngOf(s, 77), 5)) as never;

/** conditions, variables and lists a level offers, taken from its reference solution (so the offer and the solution can never disagree) */
function finish(sp: LevelSpec): Level {
  const sol = parse(sp.solution);
  const conds = new Set<string>(sp.conds ?? []);
  const vars = new Set<string>(sp.vars ?? []);
  const cs: Expr[] = [];
  const addVars = (p: Program) => { for (const l of allLists(p)) walk(l, (b) => { if (b.cond) cs.push(b.cond); if (b.t === "set" || b.t === "change" || b.t === "for" || b.t === "each") vars.add(b.name!); }); };
  addVars(sol);
  for (const c of cs) conds.add(exprText(c));
  const x = extOf(sp);
  const spec2: LevelSpec = { ...sp, conds: x.free || sp.conds ? [...conds] : sp.conds, vars: vars.size ? [...vars] : sp.vars };
  return build(spec2);
}
export const WORLDS2 = [{ id: 7, name: "事件与故事" }, { id: 8, name: "函数进阶与递归" }, { id: 9, name: "列表与数据" }, { id: 10, name: "算法" }];
export const LEVELS2: Level[] = [...W7, ...W8, ...W9, ...W10].map(finish);
registerWorlds(WORLDS2);
registerLevels(LEVELS2);
void cloneState;
