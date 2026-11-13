/**
 * 编程: the block editor. The program is `Program` data (coding-ast.ts); the workspace is drawn from it (every change draws it again), the palette holds the
 * blocks the level allows. Pointer Events only (mouse, finger, pencil): drag a block from the palette into the workspace (it snaps between blocks or
 * into the inner slot of a repeat / if / loop), drag a block inside the workspace to move it, drag it onto the palette or the bin to delete it; a TAP on a
 * palette block appends it to the end of the selected script (the alternative for anybody who does not drag); a double tap or a long press on a block
 * duplicates it; the number fields have − / + and a list of values; undo / redo; the size limit "n / max".
 */
import { h, toast } from "./ui";
import { Blk, BlockKind, Expr, PaletteKind, Program, allLists, cloneBlk, cloneProgram, countBlocks, emptyProgram, newId, num, slotsOf, walk, toText, paramsOf, LIST_ARITY, ListFn, FnName, FN_ARITY, MeProp } from "./coding-ast";
import { COLORS } from "./coding-turtle";
import { condExpr } from "./coding-levels";

export interface SlotOpt { sprite: string; on: string; events: string[] }
export interface EditorOpts {
  palette: PaletteKind[];
  funcs?: { name: string; param?: string; params?: string[] }[];
  /** worlds 7-10: conditions and values are built from small blocks; calls of itself are allowed; lists; the reporters and operators offered; the palette is split in tabs */
  free?: boolean; recursion?: boolean; lists?: string[]; rep?: string[]; ops?: string[]; tabs?: boolean; nums?: number[];
  /** the stage: the scripts the child fills (one hat each), the sprites, the texts a sprite can say, the messages and keys */
  slots?: SlotOpt[]; hideMain?: boolean; sprites?: { id: string; label: string }[]; texts?: Record<string, string>; msgs?: Record<string, string>; keys?: Record<string, string>;
  vars?: string[];
  conds?: string[];
  max: number;
  program?: Program;
  onChange?: (p: Program) => void;
}
export interface HintMark { needed: PaletteKind | null; wrongId: string | null; extraId: string | null }
export interface Editor {
  el: HTMLElement;
  program(): Program;
  setProgram(p: Program): void;
  count(): number;
  highlight(id: string | null): void;
  hint(m: HintMark | null): void;
  setLocked(on: boolean): void;
  undo(): void; redo(): void;
  canUndo(): boolean; canRedo(): boolean;
  onHistory?: () => void;
}

// ---------- looks ----------
const ORDER: PaletteKind[] = ["move", "left", "right", "take", "light", "fd", "tl", "tr", "penup", "pendown", "color", "repeat", "forever", "until", "while", "if", "ifelse", "wait", "waitUntil", "for", "each", "set", "change", "smove", "sturn", "goto", "changex", "changey", "say", "sayfor", "costume", "nextcostume", "size", "show", "hide", "note", "broadcast", "push", "lset", "lremove", "swap", "lclear", "call", "return"];
interface Meta { min: number; max: number; step: number; def: number; presets: number[]; /** the − / + buttons go to the next value of the list */ cycle?: boolean; fmt?: (n: number) => string }
const META: Record<string, Meta> = {
  repeat: { min: 1, max: 40, step: 1, def: 3, presets: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 18, 20, 24, 30, 36] },
  fd: { min: 5, max: 200, step: 5, def: 40, presets: [5, 6, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100] },
  turn: { min: 1, max: 360, step: 5, def: 90, presets: [10, 15, 30, 36, 40, 45, 60, 72, 90, 108, 120, 135, 144, 150, 180] },
  arg: { min: 1, max: 9, step: 1, def: 2, presets: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  /** the arguments of a call in a level with free values (the level can give its own numbers: `nums`) */
  argf: { min: -999, max: 999, step: 1, def: 1, presets: [0, 1, 2, 3, 4, 5, 6, 8, 10, 20, 40, 50, 60, 80, 90, 100] },
  val: { min: -99, max: 99, step: 1, def: 0, presets: [0, 1, 2, 3, 4, 5, 6, 8, 10, 20, 50, 100] },
  by: { min: -99, max: 99, step: 1, def: 1, presets: [-5, -2, -1, 1, 2, 3, 4, 5, 10] },
  // phase 2
  idx: { min: -999, max: 999, step: 1, def: 1, presets: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  steps: { min: -300, max: 300, step: 5, def: 10, presets: [-30, -10, 5, 10, 15, 20, 30, 50, 100] },
  secs: { min: 0, max: 10, step: 0.5, def: 1, presets: [0.5, 1, 2, 3, 5] },
  coord: { min: -120, max: 120, step: 10, def: 0, presets: [-100, -60, -30, 0, 30, 60, 100] },
  note: { min: 60, max: 72, step: 1, def: 60, presets: [60, 62, 64, 65, 67, 69, 71, 72], cycle: true, fmt: (n: number) => NOTE_NAME[n] ?? String(n) },
  beats: { min: 0.5, max: 8, step: 0.5, def: 1, presets: [0.5, 1, 2, 3, 4] },
  size: { min: 20, max: 300, step: 10, def: 100, presets: [50, 100, 150, 200] },
  costume: { min: 1, max: 3, step: 1, def: 1, presets: [1, 2, 3] },
  turnd: { min: -360, max: 360, step: 6, def: 90, presets: [6, 15, 30, 45, 90, 180] },
};
/** the notes of a scale in numbered notation (the number is the MIDI note: 60 = middle C) */
const NOTE_NAME: Record<number, string> = { 60: "1", 62: "2", 64: "3", 65: "4", 67: "5", 69: "6", 71: "7", 72: "1˙" };
const GROUP: Record<string, string> = { move: "go", left: "go", right: "go", take: "go", light: "go", fd: "pen", tl: "pen", tr: "pen", penup: "pen", pendown: "pen", color: "pen", repeat: "loop", until: "loop", while: "loop", if: "cond", ifelse: "cond", set: "var", change: "var", call: "func", return: "func", forever: "loop", for: "loop", each: "loop", wait: "loop", waitUntil: "loop", smove: "go", sturn: "go", goto: "go", changex: "go", changey: "go",
  say: "ev", sayfor: "ev", costume: "ev", nextcostume: "ev", size: "ev", show: "ev", hide: "ev", note: "ev", broadcast: "ev", push: "list", lset: "list", lremove: "list", swap: "list", lclear: "list" };
const ICON: Record<string, string> = { move: "↑", left: "↶", right: "↷", take: "★", light: "☀", fd: "↑", tl: "↶", tr: "↷", penup: "✎", pendown: "✎" };
const WORD: Record<string, string> = { move: "前进", left: "左转", right: "右转", take: "拿星星", light: "开灯", fd: "前进", tl: "左转", tr: "右转", penup: "抬笔", pendown: "落笔" };
export const COND_LABEL: Record<string, string> = {
  pathAhead: "前方有路", "!pathAhead": "前方没有路", pathLeft: "左边有路", "!pathLeft": "左边没有路", pathRight: "右边有路", "!pathRight": "右边没有路",
  starHere: "脚下有星星", "!starHere": "脚下没有星星", lightHere: "脚下有灯", "!lightHere": "脚下没有灯", onFlag: "到达旗子", "!onFlag": "还没到旗子",
  "colorIs(r)": "脚下是红色", "colorIs(g)": "脚下是绿色", "colorIs(b)": "脚下是蓝色", "colorIs(y)": "脚下是黄色",
};
const COLOR_NAMES: Record<string, string> = { black: "黑色", red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", blue: "蓝色", purple: "紫色" };

export const kindOf = (b: Blk): string => (b.t === "if" && b.els ? "ifelse" : b.t === "call" ? `call:${b.name}` : b.t);
const TAB_KINDS: [string, string, string[]][] = [
  ["motion", "动作", ["move", "left", "right", "take", "light", "fd", "tl", "tr", "penup", "pendown", "color", "smove", "sturn", "goto", "changex", "changey"]],
  ["events", "事件", ["say", "sayfor", "costume", "nextcostume", "size", "show", "hide", "note", "broadcast"]],
  ["control", "控制", ["repeat", "forever", "until", "while", "if", "ifelse", "wait", "waitUntil", "for", "each"]],
  ["vars", "变量", ["set", "change"]],
  ["lists", "列表", ["push", "lset", "lremove", "swap", "lclear"]],
  ["funcs", "函数", ["call", "return"]],
];
const isControl = (k: string) => ["repeat", "until", "while", "if", "ifelse", "forever", "for", "each"].includes(k);
const exprKey = (e?: Expr): string => (e ? JSON.stringify(e, (k, v) => (k === "id" ? undefined : v)) : "");
/** a condition expression as the key of COND_LABEL ("!pathAhead", "colorIs(r)", "count < 4") */
export function condKey(e: Expr): string {
  if (e.k === "sense") return e.s === "colorIs" ? `colorIs(${e.c})` : e.s;
  if (e.k === "not" && e.a.k === "sense") return "!" + condKey(e.a);
  if (e.k === "cmp") return `${exprStr(e.a)} ${e.op} ${exprStr(e.b)}`;
  return exprStr(e);
}
const exprStr = (e: Expr): string => (e.k === "n" ? String(e.v) : e.k === "v" ? e.name : e.k === "bin" ? `${exprStr(e.a)} ${e.op} ${exprStr(e.b)}` : condKey(e));
const condText = (e: Expr): string => COND_LABEL[condKey(e)] ?? condKey(e);

/**
 * A tap on a small control. The action runs on pointerup (when the finger / mouse went down and up on the same control without moving), and a click that follows
 * it is ignored. Some browsers swallow the click of a tap that comes right after a drag; a child must never have to tap twice. A keyboard press only sends a click,
 * which still works.
 */
function tapOn<T extends HTMLElement>(el: T, fn: (e: Event) => void): T {
  let down: { id: number; x: number; y: number } | null = null, handledAt = -1e9;
  el.addEventListener("pointerdown", (e) => { down = { id: e.pointerId, x: e.clientX, y: e.clientY }; });
  el.addEventListener("pointerup", (e) => {
    if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 12 && !(el as unknown as HTMLButtonElement).disabled) { handledAt = performance.now(); fn(e); }
    down = null;
  });
  el.addEventListener("click", (e) => { if (performance.now() - handledAt < 600) return; fn(e); });
  return el;
}
const cbtn = (props: Record<string, unknown>, ...kids: (Node | string | null)[]): HTMLButtonElement => {
  const { onclick, ...rest } = props;
  const el = h("button", rest, ...kids);
  if (typeof onclick === "function") tapOn(el, onclick as (e: Event) => void);
  return el;
};
const span = (cls: string, text: string, user = false) => h("span", { class: cls + (user ? " user" : "") }, text);

interface Scope { param?: string; params?: string[]; vars: string[]; conds: Expr[]; funcs: { name: string; param?: string; params?: string[] }[]; interactive: boolean; opts: EditorOpts; edit: (fn: () => void) => void; pick: (anchor: HTMLElement, items: PickItem[], onPick: (v: string) => void) => void }
interface PickItem { label: string; value: string; cls?: string; user?: boolean }

const newBlock = (kind: string, o: EditorOpts, scope?: { param?: string }): Blk => {
  const conds = (o.conds ?? []).map(condExpr);
  const find = (f: (k: string) => boolean) => conds.find((c) => f(condKey(c))) ?? conds[0] ?? { k: "sense", s: "pathAhead" } as Expr;
  const b: Blk = { id: newId(), t: "move" };
  const list0 = o.lists?.[0] ?? "xs", text0 = Object.keys(o.texts ?? {})[0] ?? "hi", msg0 = Object.keys(o.msgs ?? {})[0] ?? "go";
  const cond0 = (): Expr => freeCond(o);
  switch (kind) {
    case "forever": b.t = "forever"; b.body = []; break;
    case "for": b.t = "for"; b.name = o.vars?.[0] ?? "i"; b.n = num(1); b.e = num(5); b.body = []; break;
    case "each": b.t = "each"; b.name = o.vars?.[0] ?? "x"; b.list = list0; b.body = []; break;
    case "wait": b.t = "wait"; b.n = num(1); break;
    case "waitUntil": b.t = "waitUntil"; b.cond = cond0(); break;
    case "return": b.t = "return"; b.e = num(0); break;
    case "push": b.t = "push"; b.list = list0; b.e = num(1); break;
    case "lset": b.t = "lset"; b.list = list0; b.n = num(1); b.e = num(0); break;
    case "lremove": b.t = "lremove"; b.list = list0; b.n = num(1); break;
    case "swap": b.t = "swap"; b.list = list0; b.n = num(1); b.e = num(2); break;
    case "lclear": b.t = "lclear"; b.list = list0; break;
    case "smove": b.t = "smove"; b.n = num(META.steps.def); break;
    case "sturn": b.t = "sturn"; b.n = num(90); break;
    case "goto": b.t = "goto"; b.n = num(0); b.e = num(0); break;
    case "changex": case "changey": b.t = kind; b.n = num(10); break;
    case "say": b.t = "say"; b.c = text0; break;
    case "sayfor": b.t = "sayfor"; b.c = text0; b.n = num(1); break;
    case "costume": b.t = "costume"; b.n = num(1); break;
    case "size": b.t = "size"; b.n = num(100); break;
    case "note": b.t = "note"; b.n = num(60); b.e = num(1); break;
    case "broadcast": b.t = "broadcast"; b.c = msg0; break;
    case "repeat": b.t = "repeat"; b.n = num(META.repeat.def); b.body = []; break;
    case "until": b.t = "until"; b.cond = o.free && !conds.length ? cond0() : find((k) => k === "onFlag"); b.body = []; break;
    case "while": b.t = "while"; b.cond = o.free ? cond0() : conds.find((c) => condKey(c) === "!onFlag") ?? find((k) => !k.startsWith("onFlag")); b.body = []; break;
    case "if": b.t = "if"; b.cond = o.free ? cond0() : find((k) => k !== "onFlag" && k !== "!onFlag"); b.body = []; break;
    case "ifelse": b.t = "if"; b.cond = o.free ? cond0() : find((k) => k !== "onFlag" && k !== "!onFlag"); b.body = []; b.els = []; break;
    case "fd": b.t = "fd"; b.n = num(META.fd.def); break;
    case "tl": case "tr": b.t = kind; b.n = num(META.turn.def); break;
    case "color": b.t = "color"; b.c = "red"; break;
    case "set": b.t = "set"; b.name = o.vars?.[o.vars.length - 1] ?? "x"; b.e = num(0); break;
    case "change": b.t = "change"; b.name = o.vars?.[0] ?? "x"; b.e = num(1); break;
    default:
      if (kind.startsWith("call:")) {
        b.t = "call"; b.name = kind.slice(5);
        const f = o.funcs?.find((x) => x.name === b.name), ps = f ? paramsOf(f) : [];
        if (ps.length === 1) b.arg = scope?.param ? { k: "v", name: scope.param } : num(META.arg.def);
        else if (ps.length > 1) b.args = ps.map(() => num(META.arg.def));
      }
      else b.t = kind as BlockKind;
  }
  return b;
};

// ---------- number fields ----------
function numField(sc: Scope, get: () => Expr | undefined, set: (e: Expr) => void, meta: Meta, varsOk = true): HTMLElement {
  const cur = get() ?? num(meta.def);
  const isNum = cur.k === "n";
  const clamp = (v: number) => Math.max(meta.min, Math.min(meta.max, v));
  const stepTo = (d: number): number => {
    const v = (cur as { v: number }).v;
    if (!meta.cycle) return clamp(Math.round((v + d * meta.step) * 100) / 100);
    const i = meta.presets.indexOf(v);
    return meta.presets[Math.max(0, Math.min(meta.presets.length - 1, (i < 0 ? 0 : i) + d))];
  };
  const mk = (d: number, sym: string) => cbtn({ class: "cw-step cw-ctl", type: "button", "data-d": String(d), "aria-label": d > 0 ? "增加" : "减少", disabled: !sc.interactive || !isNum || (isNum && (meta.cycle ? stepTo(d) === (cur as { v: number }).v : d > 0 ? (cur as { v: number }).v >= meta.max : (cur as { v: number }).v <= meta.min)),
    onclick: () => sc.edit(() => set(num(stepTo(d)))) }, sym);
  const names = varsOk ? [...new Set([...(sc.params ?? (sc.param ? [sc.param] : [])), ...sc.vars])] : [];
  const label = cur.k === "n" ? (meta.fmt ? meta.fmt(cur.v) : String(cur.v)) : cur.k === "v" ? cur.name : exprStr(cur);
  const val = cbtn({ class: "cw-val cw-ctl" + (isNum ? "" : " var"), type: "button", disabled: !sc.interactive, "aria-label": "选择数值",
    onclick: (e: Event) => sc.pick(e.currentTarget as HTMLElement, [...(sc.opts.nums && meta === META.argf ? sc.opts.nums : meta.presets).map((p) => ({ label: meta.fmt ? meta.fmt(p) : String(p), value: `n:${p}` })), ...names.map((n) => ({ label: n, value: `v:${n}`, cls: "var" })), ...(sc.opts.free ? exprItems(sc, "num") : [])],
      (v) => sc.edit(() => set(fromPick(sc, v, cur, meta, "num")))) }, label);
  return h("span", { class: "cw-num" }, mk(-1, "−"), val, mk(1, "+"));
}

// ---------- phase 2: values and conditions built from small blocks (levels with `free`) ----------
const OP_LABEL: Record<string, string> = { "+": "+", "-": "−", "*": "×", "/": "÷", "%": "mod", "<": "<", "<=": "≤", ">": ">", ">=": "≥", "==": "=", "!=": "≠", and: "并且", or: "或者" };
const ARITH = ["+", "-", "*", "/", "%"], CMP_OPS = ["<", "<=", ">", ">=", "==", "!="];
const LIST_LABEL: Record<string, string> = { len: "长度", sum: "总和", max: "最大值", min: "最小值", has: "包含", count: "个数", indexOf: "位置", item: "项" };
const FN_LABEL: Record<string, string> = { floor: "取整", abs: "绝对值", sqrt: "平方根", round: "四舍五入", rand: "随机数", minOf: "较小的", maxOf: "较大的", deg: "邻居数", nbr: "邻居", heavier: "更重" };
const ME_LABEL: Record<string, string> = { myX: "我的 x", myY: "我的 y", mySize: "我的大小", myCostume: "我的造型", myDir: "我的方向", floorNum: "脚下的数字", tapX: "点击处的 x", tapY: "点击处的 y" };
const LISTFNS: ListFn[] = ["len", "item", "sum", "max", "min", "has", "count", "indexOf"];
/** the condition a new block starts with in a `free` level */
function freeCond(o: EditorOpts): Expr {
  const rep = o.rep ?? [];
  if (rep.includes("keyDown") && o.keys) return { k: "keyDown", key: Object.keys(o.keys)[0] };
  if (rep.includes("touching") && o.sprites?.length) return { k: "touch", s: o.sprites[o.sprites.length - 1].id };
  if (rep.includes("heavier")) return { k: "fn", f: "heavier", args: [num(1), num(2)] };
  const v = o.vars?.[0];
  return { k: "cmp", op: "==", a: v ? { k: "v", name: v } : num(1), b: num(v ? 0 : 1) };
}
const dflt = (f: FnName): Expr[] => (f === "rand" ? [num(-100), num(100)] : Array.from({ length: FN_ARITY[f] }, (_, i) => num(i === 0 && FN_ARITY[f] === 1 ? 0 : 1)));
/** what the picker of a slot offers beside numbers and variables: operators, reporters, comparisons */
function exprItems(sc: Scope, mode: "num" | "bool"): PickItem[] {
  const o = sc.opts, rep = o.rep ?? [], out: PickItem[] = [];
  if (mode === "num") {
    for (const op of o.ops ?? ["+", "-", "*"]) out.push({ label: `□ ${OP_LABEL[op]} □`, value: `op:${op}`, cls: "ex" });
    if (o.lists?.length) for (const f of LISTFNS) if (rep.includes(f)) out.push({ label: f === "item" ? "第 □ 项" : `${LIST_LABEL[f]}(…)`, value: `rep:${f}`, cls: "ex" });
    for (const f of Object.keys(FN_ARITY) as FnName[]) if (rep.includes(f)) out.push({ label: `${FN_LABEL[f]}(…)`, value: `fn:${f}`, cls: "ex" });
    for (const m of Object.keys(ME_LABEL)) if (rep.includes(m)) out.push({ label: ME_LABEL[m], value: `me:${m}`, cls: "ex" });
    if (rep.includes("call")) for (const f of sc.funcs) out.push({ label: `${f.name}(…)`, value: `call:${f.name}`, cls: "ex" });
  } else {
    for (const op of CMP_OPS) out.push({ label: `□ ${OP_LABEL[op]} □`, value: `cmp:${op}`, cls: "ex" });
    out.push({ label: OP_LABEL.and, value: "logic:and", cls: "ex" }, { label: OP_LABEL.or, value: "logic:or", cls: "ex" }, { label: "非", value: "not", cls: "ex" });
    if (rep.includes("touching")) for (const s of o.sprites ?? []) out.push({ label: `碰到 ${s.label}`, value: `touch:${s.id}`, cls: "ex" });
    if (rep.includes("keyDown")) for (const [k, l] of Object.entries(o.keys ?? {})) out.push({ label: `按住 ${l}`, value: `key:${k}`, cls: "ex" });
    if (rep.includes("heavier")) out.push({ label: `${FN_LABEL.heavier}(…)`, value: "fn:heavier", cls: "ex" });
    if (rep.includes("call")) for (const f of sc.funcs) out.push({ label: `${f.name}(…)`, value: `call:${f.name}`, cls: "ex" });
    for (const c of sc.conds) { const k = condKey(c); out.push({ label: condText(c), value: `sense:${k}`, user: !COND_LABEL[k] }); }
  }
  return out;
}
/** the expression a picker value makes; operators wrap what was there */
function fromPick(sc: Scope, v: string, cur: Expr, meta: Meta, mode: "num" | "bool"): Expr {
  const [kind, rest] = [v.slice(0, v.indexOf(":") < 0 ? v.length : v.indexOf(":")), v.includes(":") ? v.slice(v.indexOf(":") + 1) : ""];
  const o = sc.opts, list0 = o.lists?.[0] ?? "xs";
  switch (kind) {
    case "n": return num(Number(rest));
    case "v": return { k: "v", name: rest };
    case "op": return { k: "bin", op: rest as "+", a: cur.k === "n" || cur.k === "v" || cur.k === "bin" || cur.k === "list" || cur.k === "fn" || cur.k === "call" || cur.k === "me" ? cur : num(meta.def), b: num(1) };
    case "cmp": return { k: "cmp", op: rest as "<", a: cur.k === "cmp" || cur.k === "logic" || cur.k === "not" ? num(0) : cur, b: num(0) };
    case "logic": return { k: "logic", op: rest as "and", a: mode === "bool" && (cur.k === "cmp" || cur.k === "touch" || cur.k === "keyDown" || cur.k === "logic" || cur.k === "not" || cur.k === "fn") ? cur : freeCond(o), b: freeCond(o) };
    case "not": return { k: "not", a: cur };
    case "rep": return { k: "list", f: rest as ListFn, list: list0, ...(LIST_ARITY[rest as ListFn] === 2 ? { a: num(1) } : {}) };
    case "fn": return { k: "fn", f: rest as FnName, args: dflt(rest as FnName) };
    case "me": return { k: "me", p: rest as MeProp };
    case "touch": return { k: "touch", s: rest };
    case "key": return { k: "keyDown", key: rest };
    case "call": { const f = sc.funcs.find((x) => x.name === rest); return { k: "call", name: rest, args: (f ? paramsOf(f) : []).map(() => num(1)) }; }
    case "sense": return condExpr(rest);
  }
  return cur;
}
const exprLabelOf = (e: Expr): string => (e.k === "bin" || e.k === "cmp" || e.k === "logic" ? OP_LABEL[e.op] : "");
const META_VAL = META.val;
/** one slot: a number (with − / +), or a small tree of blocks: operators, reporters, comparisons (each part is a slot again) */
function exprEl(sc: Scope, get: () => Expr | undefined, set: (e: Expr) => void, meta: Meta, mode: "num" | "bool", depth: number): HTMLElement {
  const e = get();
  const wrap = (cls: string, ...kids: (Node | null)[]) => h("span", { class: `cw-ex cw-ex-${cls} d${Math.min(depth, 3)}` }, ...kids);
  const reset = () => sc.edit(() => set(mode === "bool" ? freeCond(sc.opts) : num(meta.def)));
  const x = () => cbtn({ class: "cw-ex-x cw-ctl", type: "button", "aria-label": "还原", title: "还原", disabled: !sc.interactive, onclick: reset }, "✕");
  const kid = (parent: { [k: string]: unknown }, key: string, m: Meta = META_VAL, md: "num" | "bool" = "num") => exprEl(sc, () => parent[key] as Expr, (v) => { parent[key] = v; }, m, md, depth + 1);
  const kidAt = (arr: Expr[], i: number) => exprEl(sc, () => arr[i], (v) => { arr[i] = v; }, META_VAL, "num", depth + 1);
  const opBtn = (cur: string, ops: string[], apply: (op: string) => void) => cbtn({ class: "cw-op cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择运算",
    onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, [...new Set([cur, ...ops])].map((o) => ({ label: OP_LABEL[o], value: o })), (v) => sc.edit(() => apply(v))) }, OP_LABEL[cur]);
  const choice = (label: string, items: PickItem[], onPick: (v: string) => void, cls = "cw-name") => cbtn({ class: `${cls} cw-ctl`, type: "button", disabled: !sc.interactive, "aria-label": "选择", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, items, (v) => sc.edit(() => onPick(v))) }, span("", label));
  const lists = (cur: string) => (sc.opts.lists ?? []).map((l) => ({ label: l, value: l }));
  const t = (c: string) => span("cw-t", c);
  const u = (c: string) => span("cw-unit", c);
  if (e) switch (e.k) {
    case "bin": return wrap("bin", kid(e as never, "a"), opBtn(e.op, sc.opts.ops ?? ["+", "-", "*"], (v) => { e.op = v as "+"; }), kid(e as never, "b"), x());
    case "cmp": return wrap("cmp", kid(e as never, "a"), opBtn(e.op, CMP_OPS, (v) => { e.op = v as "<"; }), kid(e as never, "b"), x());
    case "logic": return wrap("logic", kid(e as never, "a", META_VAL, "bool"), opBtn(e.op, ["and", "or"], (v) => { e.op = v as "and"; }), kid(e as never, "b", META_VAL, "bool"), x());
    case "not": return wrap("not", t("非"), kid(e as never, "a", META_VAL, "bool"), x());
    case "list": {
      const lb = choice(e.list, lists(e.list), (v) => { e.list = v; });
      if (e.f === "item") return wrap("rep", lb, t("第"), kid(e as never, "a", META.idx), t("项"), x());
      return wrap("rep", t(LIST_LABEL[e.f]), u("("), lb, ...(LIST_ARITY[e.f] === 2 ? [u(","), kid(e as never, "a")] : []), u(")"), x());
    }
    case "fn": {
      if (e.f === "rand") return wrap("rep", t(FN_LABEL.rand), kidAt(e.args, 0), t("到"), kidAt(e.args, 1), x());
      const parts: Node[] = [];
      e.args.forEach((_, i) => { if (i) parts.push(u(",")); parts.push(kidAt(e.args, i)); });
      return wrap("rep", t(FN_LABEL[e.f]), u("("), ...parts, u(")"), x());
    }
    case "call": {
      const parts: Node[] = [];
      e.args.forEach((_, i) => { if (i) parts.push(u(",")); parts.push(kidAt(e.args, i)); });
      return wrap("rep", span("cw-fn", e.name), u("("), ...parts, u(")"), x());
    }
    case "touch": return wrap("rep", t("碰到"), choice((sc.opts.sprites ?? []).find((s) => s.id === e.s)?.label ?? e.s, (sc.opts.sprites ?? []).map((s) => ({ label: s.label, value: s.id })), (v) => { e.s = v; }), x());
    case "keyDown": return wrap("rep", t("按住"), choice(sc.opts.keys?.[e.key] ?? e.key, Object.entries(sc.opts.keys ?? {}).map(([k, l]) => ({ label: l, value: k })), (v) => { e.key = v; }), x());
    case "me": return wrap("rep", t(ME_LABEL[e.p]), x());
    case "sense": return wrap("rep", choice(condText(e), sc.conds.map((c) => ({ label: condText(c), value: condKey(c), user: !COND_LABEL[condKey(c)] })), (v) => set(sc.conds.find((c) => condKey(c) === v) ?? e), "cw-cond"));
  }
  if (mode === "bool") return cbtn({ class: "cw-cond cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择条件", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, exprItems(sc, "bool"), (v) => sc.edit(() => set(fromPick(sc, v, e ?? num(0), meta, "bool")))) }, "选择条件");
  return numField(sc, get, set, meta);
}
/** a number slot (old levels: the number field; levels with `free`: a slot that can hold a small tree of blocks) */
const slot = (sc: Scope, get: () => Expr | undefined, set: (e: Expr) => void, meta: Meta): HTMLElement => (sc.opts.free ? exprEl(sc, get, set, meta, "num", 0) : numField(sc, get, set, meta));
const condSlot = (sc: Scope, b: Blk): HTMLElement => exprEl(sc, () => b.cond, (e) => { b.cond = e; }, META_VAL, "bool", 0);
void exprLabelOf; void ARITH;

// ---------- one block ----------
function blockEl(b: Blk, sc: Scope, seqs: Map<HTMLElement, { list: Blk[]; script: number }>, script: number, inPalette = false): HTMLElement {
  const kind = kindOf(b);
  const grp = GROUP[kind.startsWith("call:") ? "call" : kind] ?? "go";
  const el = h("div", { class: `cw-b cw-g-${grp}` + (isControl(kind) ? " cw-c" : ""), "data-id": b.id, "data-kind": kind, tabIndex: sc.interactive ? 0 : -1 });
  const head = h("div", { class: "cw-head" });
  const ico = (k: string) => (ICON[k] ? h("span", { class: "cw-ico", "aria-hidden": "true" }, ICON[k]) : null);
  const setE = (key: "n" | "arg" | "e") => (e: Expr) => { (b as unknown as Record<string, Expr>)[key] = e; };
  const condBtn = () => cbtn({ class: "cw-cond cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择条件",
    onclick: (e: Event) => sc.pick(e.currentTarget as HTMLElement, sc.conds.map((c) => ({ label: condText(c), value: condKey(c), user: !COND_LABEL[condKey(c)] })), (v) => sc.edit(() => { b.cond = sc.conds.find((c) => condKey(c) === v) ?? b.cond; })) },
    h("span", { class: COND_LABEL[condKey(b.cond ?? num(0))] ? "" : "user" }, condText(b.cond ?? num(0))));
  const varBtn = (field: "name" = "name") => cbtn({ class: "cw-name cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择变量", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, sc.vars.map((v) => ({ label: v, value: v })), (v) => sc.edit(() => { b[field] = v; })) }, b.name ?? "x");
  const listBtn = () => cbtn({ class: "cw-name cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择列表", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, (sc.opts.lists ?? []).map((v) => ({ label: v, value: v })), (v) => sc.edit(() => { b.list = v; })) }, b.list ?? "xs");
  const textBtn = () => cbtn({ class: "cw-text cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择说的话", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, Object.entries(sc.opts.texts ?? {}).map(([k, t]) => ({ label: t, value: k })), (v) => sc.edit(() => { b.c = v; })) }, span("", sc.opts.texts?.[b.c ?? ""] ?? b.c ?? ""));
  const msgBtn = () => cbtn({ class: "cw-name cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择消息", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, Object.entries(sc.opts.msgs ?? {}).map(([k, t]) => ({ label: t, value: k })), (v) => sc.edit(() => { b.c = v; })) }, span("", sc.opts.msgs?.[b.c ?? ""] ?? b.c ?? ""));
  const T = (c: string) => span("cw-t", c), U = (c: string) => span("cw-unit", c);
  const S = (key: "n" | "e", meta: Meta) => slot(sc, () => b[key], setE(key), meta);
  switch (kind) {
    case "forever": head.append(T("一直重复")); break;
    case "for": head.append(T("计数"), varBtn(), T("从"), S("n", META.idx), T("到"), S("e", META.idx)); break;
    case "each": head.append(T("对每一项"), varBtn(), T("在"), listBtn()); break;
    case "wait": head.append(T("等待"), S("n", META.secs), T("秒")); break;
    case "waitUntil": head.append(T("等到"), condSlot(sc, b)); break;
    case "return": head.append(T("返回"), S("e", META.val)); break;
    case "push": head.append(T("加入"), S("e", META.val), T("到"), listBtn()); break;
    case "lset": head.append(T("把"), listBtn(), T("第"), S("n", META.idx), T("项设为"), S("e", META.val)); break;
    case "lremove": head.append(T("删除"), listBtn(), T("第"), S("n", META.idx), T("项")); break;
    case "swap": head.append(T("交换"), listBtn(), T("第"), S("n", META.idx), T("和"), S("e", META.idx), T("项")); break;
    case "lclear": head.append(T("清空"), listBtn()); break;
    case "smove": head.append(T("走"), S("n", META.steps), T("步")); break;
    case "sturn": head.append(T("转"), S("n", META.turnd), U("°")); break;
    case "goto": head.append(T("移到 x"), S("n", META.coord), T("y"), S("e", META.coord)); break;
    case "changex": head.append(T("x 增加"), S("n", META.steps)); break;
    case "changey": head.append(T("y 增加"), S("n", META.steps)); break;
    case "say": head.append(T("说"), textBtn()); break;
    case "sayfor": head.append(T("说"), textBtn(), S("n", META.secs), T("秒")); break;
    case "costume": head.append(T("造型"), S("n", META.costume)); break;
    case "nextcostume": head.append(T("下一个造型")); break;
    case "size": head.append(T("大小"), S("n", META.size), U("%")); break;
    case "show": head.append(T("显示")); break;
    case "hide": head.append(T("隐藏")); break;
    case "note": head.append(T("弹音符"), S("n", META.note), T("拍数"), S("e", META.beats)); break;
    case "broadcast": head.append(T("广播"), msgBtn()); break;
    case "move": case "left": case "right": case "take": case "light": case "penup": case "pendown": head.append(ico(kind)!, span("cw-t", WORD[kind])); break;
    case "fd": head.append(ico("fd")!, span("cw-t", WORD.fd), slot(sc, () => b.n, setE("n"), META.fd)); break;
    case "tl": case "tr": head.append(ico(kind)!, span("cw-t", WORD[kind]), slot(sc, () => b.n, setE("n"), META.turn), span("cw-unit", "°")); break;
    case "color": head.append(span("cw-t", "颜色"), cbtn({ class: "cw-swatch cw-ctl", type: "button", style: `background:${COLORS[b.c ?? "black"]}`, title: COLOR_NAMES[b.c ?? "black"], "aria-label": COLOR_NAMES[b.c ?? "black"], disabled: !sc.interactive,
      onclick: (e: Event) => sc.pick(e.currentTarget as HTMLElement, Object.keys(COLORS).map((c) => ({ label: COLOR_NAMES[c], value: c, cls: `sw-${c}` })), (v) => sc.edit(() => { b.c = v; })) })); break;
    case "repeat": head.append(span("cw-t", "重复"), span("cw-unit", "×"), slot(sc, () => b.n, setE("n"), META.repeat)); break;
    case "until": head.append(span("cw-t", "直到"), sc.opts.free ? condSlot(sc, b) : condBtn()); break;
    case "while": head.append(span("cw-t", "只要"), sc.opts.free ? condSlot(sc, b) : condBtn()); break;
    case "if": case "ifelse": head.append(span("cw-t", "如果"), sc.opts.free ? condSlot(sc, b) : condBtn()); break;
    case "set": {
      if (sc.opts.free) { head.append(span("cw-t", "设定"), varBtn(), span("cw-unit", "="), slot(sc, () => b.e, setE("e"), META.val)); break; }
      const e = b.e ?? num(0), op = e.k === "bin" ? e.op : "", A = e.k === "bin" ? e.a : e, B = e.k === "bin" ? e.b : num(0);
      const write = (a: Expr, o: string, bb: Expr) => { b.e = o ? { k: "bin", op: o as "+" | "-" | "*", a, b: bb } : a; };
      head.append(span("cw-t", "设定"),
        cbtn({ class: "cw-name cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择变量", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, sc.vars.map((v) => ({ label: v, value: v })), (v) => sc.edit(() => { b.name = v; })) }, b.name ?? "x"),
        span("cw-unit", "="), numField(sc, () => A, (x) => write(x, op, B), META.val),
        cbtn({ class: "cw-op cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择运算",
          onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, [{ label: "·", value: "" }, { label: "+", value: "+" }, { label: "−", value: "-" }, { label: "×", value: "*" }], (v) => sc.edit(() => write(A, v, B))) }, op === "*" ? "×" : op === "-" ? "−" : op || "·"),
        ...(op ? [numField(sc, () => B, (x) => write(A, op, x), META.val)] : []));
      break;
    }
    case "change": if (sc.opts.free) { head.append(span("cw-t", "改变"), varBtn(), span("cw-unit", "+="), slot(sc, () => b.e, setE("e"), META.by)); break; }
      head.append(span("cw-t", "改变"),
      cbtn({ class: "cw-name cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择变量", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, sc.vars.map((v) => ({ label: v, value: v })), (v) => sc.edit(() => { b.name = v; })) }, b.name ?? "x"),
      span("cw-unit", "+="), numField(sc, () => b.e, setE("e"), META.by)); break;
    default: {   // call:<name>
      const f = sc.funcs.find((x) => x.name === b.name), ps = f ? paramsOf(f) : [];
      if (ps.length > 1 || (sc.opts.free && ps.length === 1)) {
        // one slot for every parameter; a call with one argument keeps `arg` (the form of phase 1), several arguments are `args`
        const args = (): Expr[] => (b.args ?? (b.arg ? [b.arg] : [])).concat(ps.map(() => num(META.arg.def))).slice(0, ps.length);
        const write = (i: number, e: Expr) => { const a = args(); a[i] = e; if (a.length === 1) { b.arg = a[0]; delete b.args; } else { b.args = a; delete b.arg; } };
        head.append(span("cw-t", "运行"), span("cw-fn", b.name ?? ""), ...ps.flatMap((pn, i) => [span("cw-par", pn), slot(sc, () => args()[i], (e) => write(i, e), META.argf)]));
      } else head.append(span("cw-t", "运行"), span("cw-fn", b.name ?? ""), ...(ps.length ? [numField(sc, () => b.arg, setE("arg"), META.arg)] : []));
    }
  }
  el.append(head);
  if (isControl(kind)) {
    const inner = (key: "body" | "els", list: Blk[]) => {
      const box = h("div", { class: "cw-seq cw-inner", "data-slot": key });
      seqs.set(box, { list, script });
      if (!inPalette) for (const c of list) box.append(blockEl(c, sc, seqs, script));
      return box;
    };
    el.append(inner("body", b.body ?? (b.body = [])));
    if (kind === "ifelse") el.append(span("cw-else", "否则"), inner("els", b.els!));
    el.append(h("div", { class: "cw-foot" }));
  }
  return el;
}

/** the name of an event of a script hat ("start", "tap", "stagetap", "key(right)", "recv(go)") */
export function eventLabel(on: string, o: Pick<EditorOpts, "keys" | "msgs">): string {
  if (on === "start") return "开始运行";
  if (on === "tap") return "被点击";
  if (on === "stagetap") return "舞台被点击";
  if (on.startsWith("key(")) return `按下 ${o.keys?.[on.slice(4, -1)] ?? on.slice(4, -1)}`;
  if (on.startsWith("recv(")) return `收到 ${o.msgs?.[on.slice(5, -1)] ?? on.slice(5, -1)}`;
  return on;
}
/** a program drawn as blocks, not editable (the reference answer, the lessons) */
export function programEl(p: Program, o: { vars?: string[]; funcs?: { name: string; param?: string; params?: string[] }[]; conds?: string[]; ed?: Partial<EditorOpts> } = {}): HTMLElement {
  const opts: EditorOpts = { palette: [], max: 99, ...(o.ed ?? {}) };
  const sc: Scope = { vars: o.vars ?? [], conds: [], funcs: o.funcs ?? p.funcs, interactive: false, opts, edit: () => {}, pick: () => {} };
  const seqs = new Map<HTMLElement, { list: Blk[]; script: number }>();
  const root = h("div", { class: "cw-static" });
  const script = (title: string, list: Blk[], i: number, params?: string[], hatKids?: (Node | null)[]) => {
    const box = h("div", { class: "cw-seq", "data-slot": "script" });
    const s2 = { ...sc, param: params?.[0], params };
    for (const b of list) box.append(blockEl(b, s2, seqs, i));
    const [first, ...rest] = title.split(" ");
    return h("div", { class: "cw-script" }, h("div", { class: "cw-hat" }, span("cw-t", first), rest.length ? span("cw-fn", rest.join(" ")) : null, ...(hatKids ?? [])), box);
  };
  for (let i = 0; i < p.funcs.length; i++) { const ps = paramsOf(p.funcs[i]); root.append(script(`定义 ${p.funcs[i].name}${ps.length ? `(${ps.join(", ")})` : ""}`, p.funcs[i].body, i + 1, ps)); }
  (p.scripts ?? []).forEach((sp, j) => root.append(script(`当 ${eventLabel(sp.on, opts)}`, sp.body, p.funcs.length + 1 + j, undefined, [span("cw-sprite", opts.sprites?.find((x) => x.id === sp.sprite)?.label ?? sp.sprite)])));
  if (p.main.length || !(p.scripts ?? []).length) root.append(script("开始", p.main, 0));
  return root;
}

// ---------- the editor ----------
export function createEditor(o: EditorOpts): Editor {
  const funcs = o.funcs ?? [];
  let prog = o.program ? cloneProgram(o.program) : emptyProgram(funcs);
  for (const f of funcs) if (!prog.funcs.some((x) => x.name === f.name)) prog.funcs.push({ name: f.name, ...(f.params ? { params: f.params } : { param: f.param }), body: [] });
  /** the scripts of a stage level: one for every slot, in the order of the slots */
  const fixSlots = () => { if (o.slots) prog.scripts = o.slots.map((sl, i) => ({ sprite: sl.sprite, on: prog.scripts?.[i]?.on ?? sl.on, body: prog.scripts?.[i]?.body ?? [] })); };
  fixSlots();
  const hist: string[] = [JSON.stringify(prog)];
  let hi = 0, cur = o.hideMain ? (prog.funcs.length ? 1 : 1 + prog.funcs.length) : 0, locked = false, hintMark: HintMark | null = null, running: string | null = null;
  const conds = (o.conds ?? []).map(condExpr);
  const vars = o.vars ?? [];
  const seqs = new Map<HTMLElement, { list: Blk[]; script: number }>();
  const ws = h("div", { class: "cw-ws", id: "cw-ws" });
  const ind = h("div", { class: "cw-ind", hidden: true });
  const countEl = h("span", { class: "cw-count", id: "cw-count" });
  const bin = h("div", { class: "cw-bin", id: "cw-bin", title: "拖到这里删除", "aria-label": "删除积木" }, h("span", { "aria-hidden": "true" }, "✕"), h("span", { class: "cw-bin-t" }, "删除"));
  const undoB = cbtn({ class: "cw-ubtn", id: "cw-undo", type: "button", "aria-label": "撤销", title: "撤销", onclick: () => api.undo() }, "↶");
  const redoB = cbtn({ class: "cw-ubtn", id: "cw-redo", type: "button", "aria-label": "重做", title: "重做", onclick: () => api.redo() }, "↷");
  const bar = h("div", { class: "cw-bar" }, undoB, redoB, countEl, bin);
  const pal = h("div", { class: "cw-pal", id: "cw-pal" });
  const tabsEl = h("div", { class: "cw-tabs", id: "cw-tabs", role: "tablist", hidden: true });
  const root = h("div", { class: "cw" }, ws, bar, tabsEl, pal);
  let tab = "";
  let pop: HTMLElement | null = null;

  const closePop = () => { pop?.remove(); pop = null; };
  const pick: Scope["pick"] = (anchor, items, onPick) => {
    closePop();
    const box = h("div", { class: "cw-pop", role: "listbox" });
    for (const it of items) box.append(cbtn({ class: "cw-pi " + (it.cls ?? ""), type: "button", role: "option", style: it.cls?.startsWith("sw-") ? `--sw:${COLORS[it.cls.slice(3)]}` : "", onclick: () => { closePop(); onPick(it.value); } }, h("span", { class: it.user ? "user" : "" }, it.label)));
    document.body.append(box);
    pop = box;
    const r = anchor.getBoundingClientRect(), pw = box.offsetWidth, ph = box.offsetHeight;
    box.style.left = `${Math.max(6, Math.min(innerWidth - pw - 6, r.left + r.width / 2 - pw / 2))}px`;
    box.style.top = `${r.bottom + 6 + ph > innerHeight - 6 ? Math.max(6, r.top - ph - 6) : r.bottom + 6}px`;
    // (the click that opens the list comes after its pointerdown, so the listener can be added at once)
    const off = () => { document.removeEventListener("pointerdown", away, true); document.removeEventListener("keydown", esc, true); };
    const away = (e: Event) => { if (!box.contains(e.target as Node)) { closePop(); off(); } };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") { closePop(); off(); } };
    document.addEventListener("pointerdown", away, true); document.addEventListener("keydown", esc, true);
  };

  const commit = () => {
    const s = JSON.stringify(prog);
    if (s === hist[hi]) return;
    hist.splice(hi + 1); hist.push(s); hi = hist.length - 1;
    if (hist.length > 100) { hist.shift(); hi--; }
    render(); o.onChange?.(prog); api.onHistory?.();
  };
  const edit = (fn: () => void) => { fn(); commit(); };
  const F = () => prog.funcs.length;
  const sc = (script: number): Scope => { const ps = script > 0 && script <= F() ? paramsOf(prog.funcs[script - 1]) : []; return { param: ps[0], params: ps, vars, conds, funcs, interactive: !locked, opts: o, edit, pick }; };
  const listOf = (script: number) => (script === 0 ? prog.main : script <= F() ? prog.funcs[script - 1].body : prog.scripts![script - F() - 1].body);

  function render() {
    seqs.clear();
    ws.replaceChildren();
    const mk = (title: string, fn: string | null, script: number) => {
      const box = h("div", { class: "cw-seq cw-root", "data-slot": "script", "data-script": String(script) });
      seqs.set(box, { list: listOf(script), script });
      for (const b of listOf(script)) box.append(blockEl(b, sc(script), seqs, script));
      const hat = h("div", { class: "cw-hat", "data-script": String(script), onclick: () => { cur = script; mark(); } }, span("cw-t", title), fn ? span("cw-fn", fn) : null,
        script > 0 && paramsOf(prog.funcs[script - 1]).length ? span("cw-par", `(${paramsOf(prog.funcs[script - 1]).join(", ")})`) : null);
      return h("div", { class: "cw-script" + (script === cur ? " cur" : ""), "data-script": String(script) }, hat, box);
    };
    const mkEvent = (j: number) => {
      const script = F() + 1 + j, slotO = o.slots![j], sp = prog.scripts![j];
      const box = h("div", { class: "cw-seq cw-root", "data-slot": "script", "data-script": String(script) });
      seqs.set(box, { list: sp.body, script });
      for (const b of sp.body) box.append(blockEl(b, sc(script), seqs, script));
      const evBtn = cbtn({ class: "cw-evsel cw-ctl", type: "button", disabled: locked || slotO.events.length < 2, "aria-label": "选择事件", "data-on": sp.on,
        onclick: (ev: Event) => pick(ev.currentTarget as HTMLElement, slotO.events.map((e) => ({ label: eventLabel(e, o), value: e })), (v) => edit(() => { sp.on = v; })) }, span("", eventLabel(sp.on, o)));
      const hat = h("div", { class: "cw-hat cw-hat-ev", "data-script": String(script), onclick: () => { cur = script; mark(); } }, span("cw-sprite", o.sprites?.find((x) => x.id === sp.sprite)?.label ?? sp.sprite), span("cw-t", "当"), evBtn);
      return h("div", { class: "cw-script cw-script-ev" + (script === cur ? " cur" : ""), "data-script": String(script) }, hat, box);
    };
    for (let i = 1; i <= prog.funcs.length; i++) ws.append(mk("定义", prog.funcs[i - 1].name, i));
    (prog.scripts ?? []).forEach((_, j) => ws.append(mkEvent(j)));
    if (!o.hideMain) ws.append(mk("开始", null, 0));
    ws.append(ind);
    mark();
    const n = countBlocks(prog);
    countEl.textContent = `${n} / ${o.max}`;
    countEl.classList.toggle("full", n >= o.max);
    undoB.disabled = hi <= 0; redoB.disabled = hi >= hist.length - 1;
  }
  const mark = () => {
    ws.querySelectorAll(".cw-script").forEach((s) => s.classList.toggle("cur", (s as HTMLElement).dataset.script === String(cur)));
    ws.querySelectorAll(".cw-b.running, .cw-b.hint-wrong, .cw-b.hint-extra").forEach((e) => e.classList.remove("running", "hint-wrong", "hint-extra"));
    if (running) ws.querySelector(`[data-id="${running}"]`)?.classList.add("running");
    if (hintMark?.wrongId) ws.querySelector(`[data-id="${hintMark.wrongId}"]`)?.classList.add("hint-wrong");
    if (hintMark?.extraId) ws.querySelector(`[data-id="${hintMark.extraId}"]`)?.classList.add("hint-extra");
    pal.querySelectorAll(".cw-b").forEach((e) => e.classList.toggle("hint", !!hintMark?.needed && (hintMark.needed === "call" ? (e as HTMLElement).dataset.kind!.startsWith("call:") : (e as HTMLElement).dataset.kind === hintMark.needed)));
  };

  // the palette
  /** the tabs of the palette (worlds 7-10): only the groups that have a block in this level */
  const tabList = () => (o.tabs ? TAB_KINDS.map(([id, label, ks]) => ({ id, label, kinds: ks.filter((k) => o.palette.includes(k as PaletteKind)) })).filter((t) => t.kinds.length) : []);
  const kinds = (): string[] => {
    const out: string[] = [];
    const tabs = tabList(), active = tabs.length > 1 ? tabs.find((t) => t.id === tab) ?? tabs[0] : null;
    for (const k of ORDER) {
      if (!o.palette.includes(k)) continue;
      if (active && !active.kinds.includes(k)) continue;
      if (k === "call") for (const f of funcs) out.push(`call:${f.name}`);
      else out.push(k);
    }
    return out;
  };
  const buildPal = () => {
    pal.replaceChildren();
    const tabs = tabList();
    tabsEl.hidden = tabs.length < 2;
    if (tabs.length > 1) {
      if (!tabs.some((t) => t.id === tab)) tab = tabs[0].id;
      tabsEl.replaceChildren(...tabs.map((t) => cbtn({ class: "cw-tab" + (t.id === tab ? " on" : ""), type: "button", role: "tab", "aria-selected": String(t.id === tab), "data-tab": t.id, onclick: () => { tab = t.id; buildPal(); mark(); } }, t.label)));
    }
    for (const k of kinds()) {
      const b = newBlock(k, o);
      const s: Scope = { vars, conds, funcs, interactive: false, opts: o, edit, pick };
      const el = blockEl(b, s, new Map(), 0, true);
      el.classList.add("cw-pitem");
      el.dataset.pal = k;
      el.tabIndex = 0; el.setAttribute("role", "button");
      pal.append(el);
    }
  };

  // ----- placing blocks -----
  const scriptOfList = (list: Blk[]): number => { for (const [, v] of seqs) if (v.list === list) return v.script; return 0; };
  const canPlace = (b: Blk, script: number): boolean => {
    let ok = true;
    walk([b], (x) => {
      if (x.t !== "call") return;
      const idx = prog.funcs.findIndex((f) => f.name === x.name);
      // a function may call only the functions defined before it (no recursion in phase 1; levels about recursion allow it)
      if (script > 0 && script <= F() && !o.recursion && idx >= script - 1) ok = false;
    });
    return ok;
  };
  const room = (add: number) => {
    if (countBlocks(prog) + add > o.max) { toast(`最多可以使用 ${o.max} 块积木。`); return false; }
    return true;
  };
  const append = (kind: string) => {
    if (locked) return;
    const b = newBlock(kind, o, { param: cur > 0 && cur <= F() ? paramsOf(prog.funcs[cur - 1])[0] : undefined });
    if (!canPlace(b, cur)) return void toast("积木不能调用自己或后面的积木。");
    if (!room(1)) return;
    listOf(cur).push(b);
    commit();
    ws.querySelector(`[data-id="${b.id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const locate = (id: string): { list: Blk[]; i: number; b: Blk } | null => {
    let r: { list: Blk[]; i: number; b: Blk } | null = null;
    for (const l of allLists(prog)) walk(l, (b, parent, i) => { if (b.id === id) r = { list: parent, i, b }; });
    return r;
  };
  const duplicate = (id: string) => {
    const at = locate(id);
    if (!at || locked) return;
    const n = countBlocks({ main: [at.b], funcs: [] });
    if (!room(n)) return;
    at.list.splice(at.i + 1, 0, cloneBlk(at.b));
    commit();
  };
  const remove = (id: string) => { const at = locate(id); if (at && !locked) { at.list.splice(at.i, 1); commit(); } };

  // ----- dragging -----
  interface Drag { pid: number; src: "pal" | "ws"; kind?: string; id?: string; x0: number; y0: number; moved: boolean; ghost?: HTMLElement; el: HTMLElement; target?: { list: Blk[]; index: number } | null; timer?: number; longPressed?: boolean }
  let drag: Drag | null = null;
  let lastTap = { id: "", t: 0 };
  const findSlot = (x: number, y: number, skip: HTMLElement | null) => {
    let best: { list: Blk[]; index: number; score: number; line: number; left: number; width: number } | null = null;
    for (const [box, info] of seqs) {
      if (skip && skip.contains(box)) continue;
      const r = box.getBoundingClientRect();
      if (r.width === 0) continue;
      const dx = x < r.left ? r.left - x : x > r.right ? x - r.right : 0;
      if (dx > 70) continue;
      const kids = [...box.children].filter((c) => c.classList.contains("cw-b") && c !== skip) as HTMLElement[];
      const lines = kids.length === 0 ? [r.top + r.height / 2] : [kids[0].getBoundingClientRect().top, ...kids.map((k, i) => (i === kids.length - 1 ? k.getBoundingClientRect().bottom : (k.getBoundingClientRect().bottom + kids[i + 1].getBoundingClientRect().top) / 2))];
      lines.forEach((ly, i) => {
        const score = Math.abs(y - ly) + dx * 1.5 + (kids.length === 0 && y >= r.top && y <= r.bottom ? -30 : 0);
        if (!best || score < best.score) {
          // the index counts the blocks without the dragged one (it is left out of `kids`)
          best = { list: info.list, index: i, score, line: ly, left: r.left, width: r.width };
        }
      });
    }
    return best as { list: Blk[]; index: number; score: number; line: number; left: number; width: number } | null;
  };
  const clearDrag = () => { if (drag) { try { root.releasePointerCapture(drag.pid); } catch { /* it was not captured */ } } drag?.ghost?.remove(); ind.hidden = true; root.classList.remove("dragging", "over-bin"); ws.querySelectorAll(".cw-b.drag-src").forEach((e) => e.classList.remove("drag-src")); if (drag?.timer) clearTimeout(drag.timer); drag = null; };
  const overDelete = (x: number, y: number) => {
    for (const el of [pal, bin]) { const r = el.getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return true; }
    return false;
  };
  const place = (d: Drag, t: { list: Blk[]; index: number }) => {
    if (d.src === "pal") {
      const script = scriptOfList(t.list);
      const b = newBlock(d.kind!, o, { param: script > 0 && script <= F() ? paramsOf(prog.funcs[script - 1])[0] : undefined });
      if (!canPlace(b, script)) return void toast("积木不能调用自己或后面的积木。");
      if (!room(1)) return;
      t.list.splice(t.index, 0, b);
      cur = script;
      commit();
    } else {
      const at = locate(d.id!);
      if (!at) return;
      const script = scriptOfList(t.list);
      if (!canPlace(at.b, script)) return void toast("积木不能调用自己或后面的积木。");
      // the target index was counted without the dragged block, so take it out first
      at.list.splice(at.i, 1);
      t.list.splice(Math.min(t.index, t.list.length), 0, at.b);
      cur = script;
      commit();
    }
  };
  root.addEventListener("pointerdown", (e) => {
    if (locked || !e.isPrimary || (e.pointerType === "mouse" && e.button !== 0)) return;
    const tgt = e.target as HTMLElement;
    if (tgt.closest(".cw-ctl, .cw-ubtn, .cw-hat")) return;
    const b = tgt.closest<HTMLElement>(".cw-b");
    if (!b) return;
    const inPal = !!b.closest(".cw-pal");
    if (!inPal && !b.closest(".cw-ws")) return;
    closePop();
    drag = { pid: e.pointerId, src: inPal ? "pal" : "ws", kind: inPal ? b.dataset.pal : undefined, id: inPal ? undefined : b.dataset.id, x0: e.clientX, y0: e.clientY, moved: false, el: b };
    try { root.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
    if (!inPal) {
      const id = b.dataset.id!;
      drag.timer = window.setTimeout(() => { if (drag && !drag.moved) { drag.longPressed = true; const keep = drag; duplicate(id); keep.moved = false; } }, 650);
    }
  });
  root.addEventListener("pointermove", (e) => {
    const d = drag;
    if (!d || e.pointerId !== d.pid) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 7) return;
      d.moved = true;
      if (d.timer) clearTimeout(d.timer);
      const clone = d.el.cloneNode(true) as HTMLElement;
      clone.classList.add("cw-ghost"); clone.removeAttribute("id"); clone.style.width = `${Math.min(d.el.offsetWidth, 260)}px`;
      document.body.append(clone);
      d.ghost = clone;
      root.classList.add("dragging");
      if (d.src === "ws") d.el.classList.add("drag-src");
    }
    d.ghost!.style.transform = `translate(${e.clientX - 24}px, ${e.clientY - 20}px)`;
    const del = overDelete(e.clientX, e.clientY);
    root.classList.toggle("over-bin", del);
    // scroll the workspace when the pointer is near its edge
    const wr = ws.getBoundingClientRect();
    if (e.clientY > wr.top && e.clientY < wr.top + 28) ws.scrollTop -= 12; else if (e.clientY < wr.bottom && e.clientY > wr.bottom - 28) ws.scrollTop += 12;
    const inWs = e.clientX >= wr.left && e.clientX <= wr.right && e.clientY >= wr.top && e.clientY <= wr.bottom;
    const slot = !del && inWs ? findSlot(e.clientX, e.clientY, d.src === "ws" ? d.el : null) : null;
    d.target = slot ? { list: slot.list, index: slot.index } : null;
    if (slot) {
      ind.hidden = false;
      ind.style.top = `${slot.line - wr.top + ws.scrollTop - 2}px`;
      ind.style.left = `${slot.left - wr.left + ws.scrollLeft}px`;
      ind.style.width = `${slot.width}px`;
    } else ind.hidden = true;
  });
  const finish = (e: PointerEvent, cancel: boolean) => {
    const d = drag;
    if (!d || e.pointerId !== d.pid) return;
    const moved = d.moved, longPressed = d.longPressed;
    const del = moved && overDelete(e.clientX, e.clientY);
    const target = d.target;
    clearDrag();
    if (cancel) return;
    if (moved) {
      if (d.src === "ws" && del) remove(d.id!);
      else if (target) place(d, target);
      return;
    }
    if (longPressed) return;
    if (d.src === "pal") return void append(d.kind!);
    // a tap on a block of the workspace: twice quickly = duplicate
    const now = performance.now();
    if (lastTap.id === d.id && now - lastTap.t < 380) { lastTap = { id: "", t: 0 }; duplicate(d.id!); } else lastTap = { id: d.id!, t: now };
  };
  root.addEventListener("pointerup", (e) => finish(e, false));
  root.addEventListener("pointercancel", (e) => finish(e, true));
  root.addEventListener("keydown", (e) => {
    if (locked) return;
    const t = e.target as HTMLElement;
    if (t.matches(".cw-pitem") && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); append(t.dataset.pal!); }
    else if (t.matches(".cw-ws .cw-b") && (e.key === "Delete" || e.key === "Backspace")) { e.preventDefault(); remove(t.dataset.id!); }
    else if (t.matches(".cw-ws .cw-b") && (e.key === "d" || e.key === "D")) { e.preventDefault(); duplicate(t.dataset.id!); }
  });
  root.addEventListener("contextmenu", (e) => e.preventDefault());

  const api: Editor = {
    el: root,
    program: () => cloneProgram(prog),
    setProgram(p) { prog = cloneProgram(p); for (const f of funcs) if (!prog.funcs.some((x) => x.name === f.name)) prog.funcs.push({ name: f.name, ...(f.params ? { params: f.params } : { param: f.param }), body: [] }); fixSlots(); hist.splice(0, hist.length, JSON.stringify(prog)); hi = 0; render(); o.onChange?.(prog); api.onHistory?.(); },
    count: () => countBlocks(prog),
    highlight(id) { running = id; mark(); if (id) ws.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" }); },
    hint(m) {
      // the block that is needed may be in another tab
      const t = m?.needed ? tabList().find((x) => x.kinds.includes(m.needed as string)) : null;
      if (t && tabList().length > 1 && t.id !== tab) { tab = t.id; buildPal(); }
      hintMark = m; mark();
    },
    setLocked(on) { locked = on; root.classList.toggle("locked", on); render(); },
    undo() { if (hi > 0 && !locked) { hi--; prog = JSON.parse(hist[hi]); render(); o.onChange?.(prog); api.onHistory?.(); } },
    redo() { if (hi < hist.length - 1 && !locked) { hi++; prog = JSON.parse(hist[hi]); render(); o.onChange?.(prog); api.onHistory?.(); } },
    canUndo: () => hi > 0, canRedo: () => hi < hist.length - 1,
  };
  buildPal();
  render();
  return api;
}

/** the program as pseudo-code for the "显示代码" panel */
export const codeText = (p: Program): string => toText(p) || "// ";
export { slotsOf, exprKey };
