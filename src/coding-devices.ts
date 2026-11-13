/**
 * 编程 world 16 (过程控制与物联网): virtual devices, PURE and deterministic. A controller is a block program that runs once per tick (the scan cycle of a PLC):
 * before every run the sensor values are put into variables, the variables stay from tick to tick (that is how a controller remembers: a timer, a state), after
 * the run the actuator variables are read and the environment moves one step. Sensors and actuators are therefore variables of the block language, the
 * conditions of the editor are comparisons like "light < 30" (an AND is written as a sum: "motion + door == 2"). The same Machine as worlds 1-6 runs the program.
 * Every level has several scenarios (light curves, truth-table rows, queues of requests ...); a program wins when it passes ALL of them. Written by a model
 * from memory; the texts of the levels are in src/data/coding-info.json.
 */
import { Program, parse, countBlocks, PaletteKind } from "./coding-ast";
import { Machine, makeTurtle } from "./coding-interp";
import { rng, rint } from "./coding-infomodel";

export type Env = Record<string, number>;
export interface Frame { t: number; s: Record<string, number>; a: Record<string, number>; e: Env }
export interface Fail { msg: number; tick: number }
export interface Scenario { name: string; [k: string]: unknown }
export interface DevLevel {
  id: string; no: number;
  /** the scene drawn by the screen */
  scene: string;
  sensors: string[]; acts: string[]; vars: string[];
  conds: string[];
  palette: PaletteKind[];
  scenarios: Scenario[];
  ticks: number;
  init(sc: Scenario): Env;
  sense(e: Env, t: number, sc: Scenario): Record<string, number>;
  step(e: Env, a: Record<string, number>, t: number, sc: Scenario): Env;
  /** null = the scenario is solved; msg indexes `msgs` of the level's texts */
  check(frames: Frame[], sc: Scenario): Fail | null;
  ref: string; naive: string;
  max: number;
}
const PAL: PaletteKind[] = ["set", "change", "if", "ifelse"];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export interface RunResult { frames: Frame[]; status: "ok" | "loop" | "error"; message: string }
export function runScenario(lv: DevLevel, prog: Program, si: number): RunResult {
  const sc = lv.scenarios[si], world = makeTurtle().world, base = makeTurtle().state;
  let env = lv.init(sc);
  let vars: Record<string, number> = {};
  for (const a of lv.acts) vars[a] = 0;
  const frames: Frame[] = [];
  for (let t = 0; t < lv.ticks; t++) {
    const s = lv.sense(env, t, sc);
    const m = new Machine(prog, world, { ...base, vars: { ...vars, ...s } }, { budget: 4000 });
    const r = m.run();
    if (r.status !== "done") return { frames, status: r.status === "infinite" || r.status === "budget" ? "loop" : "error", message: r.message };
    vars = r.state.vars;
    const a: Record<string, number> = {}; for (const k of lv.acts) a[k] = vars[k] ?? 0;
    env = lv.step(env, a, t, sc);
    frames.push({ t, s, a, e: { ...env } });
  }
  return { frames, status: "ok", message: "" };
}
export interface Verdict { ok: boolean; results: { ok: boolean; fail: Fail | null; status: RunResult["status"] }[]; first: number }
export function judgeAll(lv: DevLevel, prog: Program): Verdict {
  const results = lv.scenarios.map((sc, i) => {
    const r = runScenario(lv, prog, i);
    if (r.status !== "ok") return { ok: false, fail: { msg: -1, tick: r.frames.length }, status: r.status };
    const f = lv.check(r.frames, sc);
    return { ok: !f, fail: f, status: r.status };
  });
  return { ok: results.every((r) => r.ok), results, first: results.findIndex((r) => !r.ok) };
}
export const parLevel = (lv: DevLevel): number => countBlocks(parse(lv.ref));

// ---------- the scenarios' data ----------
const series = (seed: number, n: number, lo: number, hi: number, step: number): number[] => { const r = rng(seed); let v = rint(r, lo, hi); return Array.from({ length: n }, () => (v = clamp(v + rint(r, -step, step), lo, hi))); };
const ramp = (a: number, b: number, n: number): number[] => Array.from({ length: n }, (_, i) => Math.round(a + ((b - a) * i) / (n - 1)));
const D = (name: string, extra: Record<string, unknown> = {}): Scenario => ({ name, ...extra });

// ---------- 1 simple lamp ----------
const lamp1: DevLevel = {
  id: "i16-01", no: 1, scene: "lamp", sensors: ["light"], acts: ["lamp"], vars: ["light", "lamp"], conds: ["light < 30", "light < 50", "light > 50", "light < 70"], palette: PAL, ticks: 14, max: 12,
  scenarios: [D("dusk", { v: ramp(90, 5, 14) }), D("dawn", { v: ramp(5, 90, 14) }), D("cloud", { v: [80, 70, 20, 15, 25, 60, 90, 90, 10, 10, 85, 85, 29, 31] })],
  init: () => ({}), sense: (_, t, sc) => ({ light: (sc.v as number[])[t] }), step: (e) => e,
  check: (f) => { for (const x of f) if ((x.s.light < 30) !== (x.a.lamp === 1)) return { msg: x.s.light < 30 ? 0 : 1, tick: x.t }; return null; },
  ref: "if light < 30 { set lamp = 1 } else { set lamp = 0 }", naive: "set lamp = 1",
};
// ---------- 2 traffic light ----------
const traffic: DevLevel = {
  id: "i16-02", no: 2, scene: "traffic", sensors: [], acts: ["red", "yellow", "green"], vars: ["timer", "red", "yellow", "green"], conds: ["timer <= 4", "timer <= 5", "timer >= 9", "timer == 5"], palette: PAL, ticks: 36, max: 30,
  scenarios: [D("cycle"), D("long", {})],
  init: () => ({}), sense: () => ({}), step: (e) => e,
  check: (f, sc) => {
    const n = sc.name === "long" ? 36 : 18;
    for (const x of f.slice(0, n)) {
      const ph = x.t % 9, want = ph < 4 ? "green" : ph === 4 ? "yellow" : "red";
      const on = ["red", "yellow", "green"].filter((k) => x.a[k] === 1);
      if (on.length !== 1) return { msg: on.length === 0 ? 0 : 1, tick: x.t };
      if (on[0] !== want) return { msg: 2, tick: x.t };
    }
    return null;
  },
  ref: "change timer by 1 if timer <= 4 { set green = 1 set yellow = 0 set red = 0 } else { if timer <= 5 { set green = 0 set yellow = 1 set red = 0 } else { set green = 0 set yellow = 0 set red = 1 } } if timer >= 9 { set timer = 0 }",
  naive: "set green = 1",
};
// ---------- 3 street lamp with hysteresis ----------
const lampCurves: number[][] = [
  ramp(90, 5, 24), ramp(5, 90, 24), [80, 60, 45, 35, 28, 33, 45, 35, 44, 32, 46, 38, 25, 20, 30, 45, 40, 36, 42, 35, 48, 52, 70, 90],
  [20, 25, 45, 35, 45, 35, 45, 35, 45, 35, 45, 35, 45, 35, 45, 35, 60, 55, 52, 51, 49, 48, 55, 60], series(5, 24, 10, 90, 15), series(6, 24, 20, 60, 12), series(7, 24, 0, 100, 25),
  [100, 90, 80, 70, 60, 50, 40, 30, 20, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 90, 80, 70, 60, 50], [40, 40, 40, 40, 29, 40, 40, 40, 51, 40, 40, 40, 29, 40, 40, 51, 40, 40, 40, 40, 40, 40, 40, 40], [55, 45, 35, 25, 35, 45, 55, 45, 35, 25, 35, 45, 55, 45, 35, 25, 35, 45, 55, 45, 35, 25, 35, 45],
];
const lampHyst: DevLevel = {
  id: "i16-03", no: 3, scene: "lamp", sensors: ["light"], acts: ["lamp"], vars: ["light", "lamp"], conds: ["light < 30", "light > 50", "light < 40", "light > 40"], palette: PAL, ticks: 24, max: 14,
  scenarios: lampCurves.map((v, i) => D("curve" + (i + 1), { v })),
  init: () => ({}), sense: (_, t, sc) => ({ light: (sc.v as number[])[t] }), step: (e) => e,
  check: (f) => {
    let prev = 0;
    for (const x of f) {
      const l = x.s.light, a = x.a.lamp;
      if (l < 30 && a !== 1) return { msg: 0, tick: x.t };
      if (l > 50 && a !== 0) return { msg: 1, tick: x.t };
      if (l >= 30 && l <= 50 && a !== prev) return { msg: 2, tick: x.t };
      prev = a;
    }
    return null;
  },
  ref: "if light < 30 { set lamp = 1 } if light > 50 { set lamp = 0 }", naive: "if light < 40 { set lamp = 1 } else { set lamp = 0 }",
};
// ---------- 4 automatic door ----------
const doorWalks: number[][] = [
  [200, 180, 150, 120, 90, 60, 40, 60, 90, 120, 150, 180, 200, 200, 200, 200], [200, 150, 90, 60, 110, 130, 80, 60, 130, 140, 150, 200, 200, 200, 200, 200],
  [200, 200, 200, 80, 200, 200, 200, 200, 70, 200, 200, 200, 200, 200, 200, 200], [90, 80, 70, 60, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160],
  [200, 95, 105, 95, 105, 95, 105, 95, 105, 200, 200, 200, 200, 200, 200, 200],
];
const door: DevLevel = {
  id: "i16-04", no: 4, scene: "door", sensors: ["dist"], acts: ["door"], vars: ["dist", "door", "wait"], conds: ["dist < 100", "wait >= 3", "door == 1", "wait >= 2"], palette: PAL, ticks: 16, max: 16,
  scenarios: doorWalks.map((v, i) => D("walk" + (i + 1), { v })),
  init: () => ({}), sense: (_, t, sc) => ({ dist: (sc.v as number[])[t] }), step: (e) => e,
  check: (f) => {
    let open = 0, wait = 0;
    for (const x of f) {
      if (x.s.dist < 100) { open = 1; wait = 0; } else if (open) { wait++; if (wait >= 3) open = 0; }
      if (x.a.door !== open) return { msg: x.a.door === 1 ? 1 : 0, tick: x.t };
    }
    return null;
  },
  ref: "if dist < 100 { set door = 1 set wait = 0 } else { if door == 1 { change wait by 1 if wait >= 3 { set door = 0 } } }", naive: "if dist < 100 { set door = 1 } else { set door = 0 }",
};
// ---------- 5 thermostat ----------
const thermo: DevLevel = {
  id: "i16-05", no: 5, scene: "thermo", sensors: ["temp"], acts: ["heater"], vars: ["temp", "heater"], conds: ["temp < 18", "temp >= 22", "temp < 20", "temp >= 20"], palette: PAL, ticks: 60, max: 14,
  scenarios: [D("cold", { start: 8, loss: 1 }), D("cool", { start: 15, loss: 1 }), D("warm", { start: 26, loss: 1 }), D("windy", { start: 14, loss: 2 }), D("exact", { start: 20, loss: 1 })],
  init: (sc) => ({ temp: sc.start as number }),
  sense: (e) => ({ temp: e.temp }),
  step: (e, a, _t, sc) => ({ temp: e.temp + (a.heater === 1 ? 3 : 0) - (sc.loss as number) }),
  check: (f) => {
    let switches = 0, prev = 0;
    for (const x of f) {
      if (x.a.heater !== prev) switches++;
      prev = x.a.heater;
      if (x.t >= 16 && (x.e.temp < 15 || x.e.temp > 25)) return { msg: x.e.temp < 15 ? 0 : 1, tick: x.t };
    }
    return switches > 14 ? { msg: 2, tick: f.length - 1 } : null;
  },
  ref: "if temp < 18 { set heater = 1 } if temp >= 22 { set heater = 0 }", naive: "if temp < 20 { set heater = 1 } else { set heater = 0 }",
};
// ---------- 6 watering ----------
const water: DevLevel = {
  id: "i16-06", no: 6, scene: "plant", sensors: ["soil", "tank"], acts: ["pump"], vars: ["soil", "tank", "pump"], conds: ["soil < 30", "soil >= 60", "tank > 0", "tank <= 0"], palette: PAL, ticks: 50, max: 16,
  scenarios: [D("full", { soil: 50, tank: 90 }), D("dry", { soil: 10, tank: 90 }), D("low tank", { soil: 45, tank: 12 }), D("wet", { soil: 75, tank: 60 })],
  init: (sc) => ({ soil: sc.soil as number, tank: sc.tank as number }),
  sense: (e) => ({ soil: e.soil, tank: e.tank }),
  step: (e, a) => { const on = a.pump === 1 && e.tank > 0; return { soil: clamp(e.soil - 2 + (on ? 8 : 0), 0, 100), tank: Math.max(0, e.tank - (on ? 3 : 0)) }; },
  check: (f) => {
    for (const x of f) {
      if (x.a.pump === 1 && x.s.tank <= 0) return { msg: 0, tick: x.t };
      if (x.e.soil > 85) return { msg: 1, tick: x.t };
      if (x.t > 12 && x.s.tank > 0 && x.e.soil < 15) return { msg: 2, tick: x.t };
    }
    return null;
  },
  ref: "if soil < 30 { set pump = 1 } if soil >= 60 { set pump = 0 } if tank <= 0 { set pump = 0 }", naive: "if soil < 30 { set pump = 1 } if soil >= 60 { set pump = 0 }",
};
// ---------- 7 alarm (truth table) ----------
const alarm: DevLevel = {
  id: "i16-07", no: 7, scene: "alarm", sensors: ["smoke", "motion", "door"], acts: ["alarm"], vars: ["smoke", "motion", "door", "alarm"], conds: ["smoke == 1", "motion == 1", "door == 1", "motion + door == 2", "smoke + motion >= 1", "motion + door >= 1"], palette: PAL, ticks: 2, max: 14,
  scenarios: Array.from({ length: 8 }, (_, i) => D(`${(i >> 2) & 1}${(i >> 1) & 1}${i & 1}`, { smoke: (i >> 2) & 1, motion: (i >> 1) & 1, door: i & 1 })),
  init: () => ({}), sense: (_, __, sc) => ({ smoke: sc.smoke as number, motion: sc.motion as number, door: sc.door as number }), step: (e) => e,
  check: (f, sc) => { const want = (sc.smoke as number) || ((sc.motion as number) && (sc.door as number)) ? 1 : 0; return f.every((x) => x.a.alarm === want) ? null : { msg: want ? 0 : 1, tick: 0 }; },
  ref: "set alarm = 0 if smoke == 1 { set alarm = 1 } if motion + door == 2 { set alarm = 1 }", naive: "if smoke == 1 { set alarm = 1 } else { set alarm = 0 }",
};
// ---------- 8 conveyor counter ----------
const beltBoxes = (seed: number, boxes: number): number[] => { const r = rng(seed), out: number[] = [0]; for (let i = 0; i < boxes; i++) { out.push(1, 1); for (let g = rint(r, 1, 3); g > 0; g--) out.push(0); } return out; };
const belt: DevLevel = {
  id: "i16-08", no: 8, scene: "belt", sensors: ["box"], acts: ["pack"], vars: ["box", "pack", "count", "seen"], conds: ["box == 1", "seen == 0", "count >= 5", "count >= 4"], palette: PAL, ticks: 40, max: 18,
  scenarios: [D("12 boxes", { v: beltBoxes(1, 12) }), D("5 boxes", { v: beltBoxes(2, 5) }), D("4 boxes", { v: beltBoxes(3, 4) })],
  init: () => ({}), sense: (_, t, sc) => ({ box: (sc.v as number[])[t] ?? 0 }), step: (e) => e,
  check: (f, sc) => {
    const v = sc.v as number[]; let n = 0;
    for (const x of f) {
      const rising = (v[x.t] ?? 0) === 1 && (v[x.t - 1] ?? 0) === 0;
      if (rising) n++;
      const want = rising && n % 5 === 0 ? 1 : 0;
      if (x.a.pack !== want) return { msg: want ? 0 : 1, tick: x.t };
    }
    return null;
  },
  ref: "set pack = 0 if box == 1 { if seen == 0 { change count by 1 set seen = 1 } } else { set seen = 0 } if count >= 5 { set pack = 1 set count = 0 }",
  naive: "set pack = 0 if box == 1 { change count by 1 } if count >= 5 { set pack = 1 set count = 0 }",
};
// ---------- 9 countdown ----------
const timerLv: DevLevel = {
  id: "i16-09", no: 9, scene: "timer", sensors: ["btn"], acts: ["display", "beep"], vars: ["btn", "display", "beep", "running", "bt"], conds: ["btn == 1", "running == 0", "display > 0", "display == 0", "bt >= 3"], palette: PAL, ticks: 30, max: 24,
  scenarios: [D("one press", { p: [2] }), D("two presses", { p: [1, 15, 16] }), D("pressed while running", { p: [1, 4, 9, 12] })],
  init: () => ({}), sense: (_, t, sc) => ({ btn: (sc.p as number[]).includes(t) ? 1 : 0 }), step: (e) => e,
  check: (f, sc) => {
    const presses = sc.p as number[];
    const disp: number[] = Array(f.length).fill(0), beep: number[] = Array(f.length).fill(0);
    let free = 0;
    for (const p of presses) {
      if (p < free) continue;
      for (let k = 0; k <= 5; k++) if (p + k < f.length) disp[p + k] = 5 - k;
      for (let k = 5; k <= 7; k++) if (p + k < f.length) beep[p + k] = 1;
      free = p + 9;
    }
    for (const x of f) { if (x.a.display !== disp[x.t]) return { msg: 0, tick: x.t }; if (x.a.beep !== beep[x.t]) return { msg: 1, tick: x.t }; }
    return null;
  },
  ref: "if running == 0 { if btn == 1 { set display = 5 set running = 1 set beep = 0 } } else { if display > 0 { change display by -1 if display == 0 { set beep = 1 } } else { change bt by 1 if bt >= 3 { set beep = 0 set running = 0 set bt = 0 } } }",
  naive: "if btn == 1 { set display = 5 }",
};
// ---------- 10 keypad ----------
const keypad: DevLevel = {
  id: "i16-10", no: 10, scene: "keypad", sensors: ["key"], acts: ["open", "alarm"], vars: ["key", "open", "alarm", "state", "fails", "ok"], conds: ["key != 0", "state == 0", "state == 1", "state == 2", "state == 3", "key == 2", "key == 5", "key == 8", "ok == 1", "fails >= 3"], palette: PAL, ticks: 40, max: 40,
  scenarios: [D("right code", { k: [2, 5, 8] }), D("wrong code", { k: [2, 5, 7, 0, 0] }), D("three tries", { k: [1, 2, 5, 9, 3, 2, 2, 5, 8] }), D("break in", { k: [4, 4, 4, 2, 5, 8] }), D("start again", { k: [2, 5, 2, 5, 8, 0, 2, 5, 8] })],
  init: () => ({}), sense: (_, t, sc) => ({ key: (sc.k as number[])[t] ?? 0 }), step: (e) => e,
  check: (f) => {
    const code = [2, 5, 8]; let st = 0, fails = 0, alarm = 0;
    for (const x of f) {
      let open = 0; const k = x.s.key;
      if (k !== 0) { if (k === code[st]) { st++; if (st === 3) { open = 1; st = 0; } } else { st = 0; fails++; if (fails >= 3) alarm = 1; } }
      if (x.a.open !== open) return { msg: open ? 0 : 1, tick: x.t };
      if (x.a.alarm !== alarm) return { msg: 2, tick: x.t };
    }
    return null;
  },
  ref: "set open = 0 if key != 0 { set ok = 0 if state == 0 { if key == 2 { set ok = 1 } } if state == 1 { if key == 5 { set ok = 1 } } if state == 2 { if key == 8 { set ok = 1 } } if ok == 1 { change state by 1 if state == 3 { set open = 1 set state = 0 } } else { set state = 0 change fails by 1 if fails >= 3 { set alarm = 1 } } }",
  naive: "set open = 0 if key != 0 { change state by 1 if state == 3 { set open = 1 set state = 0 } }",
};
// ---------- 11 elevator ----------
const lift: DevLevel = {
  id: "i16-11", no: 11, scene: "lift", sensors: ["floor", "target"], acts: ["move"], vars: ["floor", "target", "move"], conds: ["target > floor", "target < floor", "target != 0", "target == 0", "target == floor"], palette: PAL, ticks: 60, max: 14,
  scenarios: [D("one call", { r: [[3, 4]] }), D("queue", { r: [[2, 5], [4, 3], [6, 1], [8, 4]] }), D("late call", { r: [[30, 2]] }), D("top and bottom", { r: [[1, 5], [2, 1], [3, 5], [4, 1]] })],
  init: () => ({ floor: 1, ptr: 0 }),
  sense: (e, t, sc) => { const q = queueAt(sc.r as number[][], e.served, t); return { floor: e.floor, target: q[0] ?? 0 }; },
  step: (e, a, t, sc) => {
    let floor = e.floor + a.move, bad = e.bad ?? 0;
    if (floor < 1 || floor > 5) { floor = clamp(floor, 1, 5); bad = 1; }
    let served = e.served ?? 0;
    const q = queueAt(sc.r as number[][], served, t);
    if (q.length && q[0] === floor) served++;
    return { floor, served, bad, idleMove: e.idleMove || (!queueAt(sc.r as number[][], e.served ?? 0, t).length && a.move !== 0 ? 1 : 0), ptr: 0 };
  },
  check: (f, sc) => {
    const total = (sc.r as number[][]).length, last = f[f.length - 1].e;
    if (f.some((x) => x.e.bad)) return { msg: 0, tick: f.find((x) => x.e.bad)!.t };
    if (last.idleMove) return { msg: 1, tick: f.find((x) => x.e.idleMove)!.t };
    return (last.served ?? 0) < total ? { msg: 2, tick: f.length - 1 } : null;
  },
  ref: "set move = 0 if target > floor { set move = 1 } if target != 0 { if target < floor { set move = -1 } }", naive: "if target > floor { set move = 1 } else { set move = -1 }",
};
/** the requests made so far (calls are [tick, floor]) that have not been served yet; `served` = how many were served (served in the order they were made) */
function queueAt(r: number[][], served: number | undefined, t: number): number[] { return r.filter((c) => c[0] <= t).map((c) => c[1]).slice(served ?? 0); }
// ---------- 12 / 13 line follower ----------
const lineC = (kind: string, t: number): number => kind === "straight" ? 0 : kind === "s" ? 6 * Math.sin(t / 8) : kind === "wave" ? 9 * Math.sin(t / 6) : kind === "left" ? -t * 0.7 : kind === "sharp" ? 12 * Math.sin(t / 4.5) : kind === "zig" ? (Math.floor(t / 6) % 2 ? 14 : -14) * 0 + 12 * Math.sin(t / 4) : 0;
const mkLine = (id: string, no: number, far: boolean, scenarios: Scenario[], ref: string, naive: string): DevLevel => ({
  id, no, scene: "line", sensors: far ? ["left", "right", "farleft", "farright"] : ["left", "right"], acts: ["steer"], vars: far ? ["left", "right", "farleft", "farright", "steer"] : ["left", "right", "steer"],
  conds: far ? ["left == 1", "right == 1", "farleft == 1", "farright == 1", "left + right == 0"] : ["left == 1", "right == 1", "left + right == 0", "left + right == 2"], palette: PAL, ticks: 60, max: 18, scenarios,
  init: (sc) => ({ p: (sc.p0 as number) ?? 0, c: lineC(sc.kind as string, 0) }),
  sense: (e) => {
    const sees = (off: number, lo: number, hi: number) => (e.c - (e.p + off) >= lo - 3 && e.c - (e.p + off) <= hi - 3 ? 1 : 0);
    void sees;
    const d = e.c - e.p;
    const s: Record<string, number> = { left: d >= -3.5 && d <= -0.5 ? 1 : 0, right: d >= 0.5 && d <= 3.5 ? 1 : 0 };
    if (far) { s.farleft = d >= -6.5 && d < -3.5 ? 1 : 0; s.farright = d > 3.5 && d <= 6.5 ? 1 : 0; }
    return s;
  },
  step: (e, a, t, sc) => ({ p: e.p + clamp(a.steer, far ? -3 : -1, far ? 3 : 1), c: lineC(sc.kind as string, t + 1) }),
  check: (f) => { for (const x of f) if (x.t >= 2 && Math.abs(x.e.c - x.e.p) > (far ? 6 : 4)) return { msg: 0, tick: x.t }; return f.every((x) => x.a.steer === 0) && f.some((x) => Math.abs(x.e.c) > 3) ? { msg: 1, tick: 0 } : null; },
  ref, naive,
});
const line1 = mkLine("i16-12", 12, false, [D("straight", { kind: "straight", p0: 0 }), D("start aside", { kind: "straight", p0: -3 }), D("gentle S", { kind: "s", p0: 0 }), D("left drift", { kind: "left", p0: 0 })],
  "set steer = 0 if left == 1 { set steer = -1 } if right == 1 { set steer = 1 }", "set steer = 0");
const line2 = mkLine("i16-13", 13, true, [D("S", { kind: "s", p0: 0 }), D("waves", { kind: "wave", p0: 0 }), D("sharp", { kind: "sharp", p0: 0 }), D("sharp, start aside", { kind: "sharp", p0: 4 })],
  "set steer = 0 if left == 1 { set steer = -1 } if right == 1 { set steer = 1 } if farleft == 1 { set steer = -3 } if farright == 1 { set steer = 3 }", "set steer = 0 if left == 1 { set steer = -1 } if right == 1 { set steer = 1 }");
// ---------- 14 obstacle car ----------
const obstacles: Record<string, [number, number][]> = { one: [[40, 0]], two: [[30, 0], [70, 1]], three: [[25, 0], [50, 1], [80, 0]], close: [[20, 0], [32, 1], [60, 0], [75, 1]] };
const nearest = (ob: [number, number][], x: number, lane: number): number => { const d = ob.filter((o) => o[1] === lane && o[0] > x).map((o) => o[0] - x); return d.length ? Math.min(...d) : 99; };
const rover: DevLevel = {
  id: "i16-14", no: 14, scene: "rover", sensors: ["dist"], acts: ["speed", "turn"], vars: ["dist", "speed", "turn"], conds: ["dist < 12", "dist < 20", "dist < 30", "dist > 50"], palette: PAL, ticks: 90, max: 14,
  scenarios: Object.keys(obstacles).map((k) => D(k, { o: obstacles[k] })),
  init: () => ({ x: 0, lane: 0, hit: 0 }),
  sense: (e, _t, sc) => ({ dist: Math.min(99, nearest(sc.o as [number, number][], e.x, e.lane)) }),
  step: (e, a, _t, sc) => {
    if (a.turn === 1) return { x: e.x, lane: 1 - e.lane, hit: e.hit };
    const nx = e.x + clamp(a.speed, 0, 3);
    const hit = (sc.o as [number, number][]).some((o) => o[1] === e.lane && o[0] > e.x && o[0] <= nx) ? 1 : 0;
    return { x: nx, lane: e.lane, hit: e.hit || hit };
  },
  check: (f) => { const h = f.find((x) => x.e.hit); if (h) return { msg: 0, tick: h.t }; return f[f.length - 1].e.x >= 100 ? null : { msg: 1, tick: f.length - 1 }; },
  ref: "set turn = 0 set speed = 3 if dist < 12 { set speed = 0 set turn = 1 }", naive: "set speed = 3",
};
// ---------- 15 robot arm ----------
const arm: DevLevel = {
  id: "i16-15", no: 15, scene: "arm", sensors: ["seen", "zone"], acts: ["base", "claw"], vars: ["seen", "zone", "base", "claw"], conds: ["claw == 0", "seen == 0", "zone == 0", "claw == 1", "seen == 1", "zone == 1"], palette: PAL, ticks: 70, max: 16,
  scenarios: [D("object at 40", { obj: 40 }), D("object at 95", { obj: 95 }), D("object at 150", { obj: 150 }), D("object at 25", { obj: 25 })],
  init: (sc) => ({ base: 0, obj: sc.obj as number, holding: 0, done: 0, droppedWrong: 0 }),
  sense: (e) => ({ seen: !e.done && Math.abs(e.base - e.obj) <= 5 ? 1 : 0, zone: e.base <= 5 ? 1 : 0 }),
  step: (e, a) => {
    const base = clamp(a.base, 0, 180);
    let { holding, obj, done, droppedWrong } = e;
    if (!holding && a.claw === 1 && !done && Math.abs(base - obj) <= 5) holding = 1;
    else if (holding && a.claw === 0) { holding = 0; if (obj <= 5) done = 1; else droppedWrong = 1; }
    if (holding) obj = base;
    return { base, obj, holding, done, droppedWrong };
  },
  check: (f) => { const l = f[f.length - 1].e; if (l.droppedWrong) return { msg: 0, tick: f.find((x) => x.e.droppedWrong)!.t }; return l.done ? null : { msg: 1, tick: f.length - 1 }; },
  ref: "if claw == 0 { if seen == 0 { change base by 10 } else { set claw = 1 } } else { if zone == 0 { change base by -10 } else { set claw = 0 } }", naive: "if seen == 0 { change base by 10 } else { set claw = 1 }",
};
// ---------- 16 smart home: run the washer in the cheap hours ----------
const prices = (a: number, b: number): number[] => Array.from({ length: 24 }, (_, h) => ((h >= a && h < b) || (a > b && (h >= a || h < b)) ? 0 : 1));
const home: DevLevel = {
  id: "i16-16", no: 16, scene: "home", sensors: ["hour", "price"], acts: ["washer"], vars: ["hour", "price", "washer", "used"], conds: ["price == 0", "price == 1", "used < 3", "used >= 3", "hour >= 22"], palette: PAL, ticks: 24, max: 14,
  scenarios: [D("night", { p: prices(22, 6) }), D("noon", { p: prices(11, 15) }), D("evening", { p: prices(19, 23) }), D("two windows", { p: prices(1, 3).map((v, h) => (v === 0 || (h >= 13 && h < 15) ? 0 : 1)) })],
  init: () => ({}), sense: (_, t, sc) => ({ hour: t, price: (sc.p as number[])[t] }), step: (e) => e,
  check: (f, sc) => {
    const p = sc.p as number[]; let on = 0;
    for (const x of f) { if (x.a.washer === 1) { on++; if (p[x.t] === 1) return { msg: 0, tick: x.t }; } }
    return on === 3 ? null : { msg: on < 3 ? 1 : 2, tick: f.length - 1 };
  },
  ref: "set washer = 0 if price == 0 { if used < 3 { set washer = 1 change used by 1 } }", naive: "set washer = 1",
};
export const DEVICES: DevLevel[] = [lamp1, traffic, lampHyst, door, thermo, water, alarm, belt, timerLv, keypad, lift, line1, line2, rover, arm, home];
export const deviceById = (id: string): DevLevel | undefined => DEVICES.find((d) => d.id === id);
