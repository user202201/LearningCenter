/**
 * 编程: the block editor. The program is `Program` data (coding-ast.ts); the workspace is drawn from it (every change draws it again), the palette holds the
 * blocks the level allows. Pointer Events only (mouse, finger, pencil): drag a block from the palette into the workspace (it snaps between blocks or
 * into the inner slot of a repeat / if / loop), drag a block inside the workspace to move it, drag it onto the palette or the bin to delete it; a TAP on a
 * palette block appends it to the end of the selected script (the alternative for anybody who does not drag); a double tap or a long press on a block
 * duplicates it; the number fields have − / + and a list of values; undo / redo; the size limit "n / max".
 */
import { h, toast } from "./ui";
import { Blk, BlockKind, Expr, PaletteKind, Program, cloneBlk, cloneProgram, countBlocks, emptyProgram, newId, num, slotsOf, walk, toText } from "./coding-ast";
import { COLORS } from "./coding-turtle";
import { condExpr } from "./coding-levels";

export interface EditorOpts {
  palette: PaletteKind[];
  funcs?: { name: string; param?: string }[];
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
const ORDER: PaletteKind[] = ["move", "left", "right", "take", "light", "fd", "tl", "tr", "penup", "pendown", "color", "repeat", "until", "while", "if", "ifelse", "set", "change", "call"];
interface Meta { min: number; max: number; step: number; def: number; presets: number[] }
const META: Record<string, Meta> = {
  repeat: { min: 1, max: 40, step: 1, def: 3, presets: [2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 18, 20, 24, 30, 36] },
  fd: { min: 5, max: 200, step: 5, def: 40, presets: [5, 6, 10, 20, 30, 40, 45, 50, 60, 70, 80, 90, 100] },
  turn: { min: 1, max: 360, step: 5, def: 90, presets: [10, 15, 30, 36, 40, 45, 60, 72, 90, 108, 120, 135, 144, 150, 180] },
  arg: { min: 1, max: 9, step: 1, def: 2, presets: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  val: { min: -99, max: 99, step: 1, def: 0, presets: [0, 1, 2, 3, 4, 5, 6, 8, 10, 20, 50, 100] },
  by: { min: -99, max: 99, step: 1, def: 1, presets: [-5, -2, -1, 1, 2, 3, 4, 5, 10] },
};
const GROUP: Record<string, string> = { move: "go", left: "go", right: "go", take: "go", light: "go", fd: "pen", tl: "pen", tr: "pen", penup: "pen", pendown: "pen", color: "pen", repeat: "loop", until: "loop", while: "loop", if: "cond", ifelse: "cond", set: "var", change: "var", call: "func" };
const ICON: Record<string, string> = { move: "↑", left: "↶", right: "↷", take: "★", light: "☀", fd: "↑", tl: "↶", tr: "↷", penup: "✎", pendown: "✎" };
const WORD: Record<string, string> = { move: "前进", left: "左转", right: "右转", take: "拿星星", light: "开灯", fd: "前进", tl: "左转", tr: "右转", penup: "抬笔", pendown: "落笔" };
export const COND_LABEL: Record<string, string> = {
  pathAhead: "前方有路", "!pathAhead": "前方没有路", pathLeft: "左边有路", "!pathLeft": "左边没有路", pathRight: "右边有路", "!pathRight": "右边没有路",
  starHere: "脚下有星星", "!starHere": "脚下没有星星", lightHere: "脚下有灯", "!lightHere": "脚下没有灯", onFlag: "到达旗子", "!onFlag": "还没到旗子",
  "colorIs(r)": "脚下是红色", "colorIs(g)": "脚下是绿色", "colorIs(b)": "脚下是蓝色", "colorIs(y)": "脚下是黄色",
};
const COLOR_NAMES: Record<string, string> = { black: "黑色", red: "红色", orange: "橙色", yellow: "黄色", green: "绿色", blue: "蓝色", purple: "紫色" };

export const kindOf = (b: Blk): string => (b.t === "if" && b.els ? "ifelse" : b.t === "call" ? `call:${b.name}` : b.t);
const isControl = (k: string) => ["repeat", "until", "while", "if", "ifelse"].includes(k);
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

const span = (cls: string, text: string, user = false) => h("span", { class: cls + (user ? " user" : "") }, text);

interface Scope { param?: string; vars: string[]; conds: Expr[]; funcs: { name: string; param?: string }[]; interactive: boolean; opts: EditorOpts; edit: (fn: () => void) => void; pick: (anchor: HTMLElement, items: PickItem[], onPick: (v: string) => void) => void }
interface PickItem { label: string; value: string; cls?: string; user?: boolean }

const newBlock = (kind: string, o: EditorOpts, scope?: { param?: string }): Blk => {
  const conds = (o.conds ?? []).map(condExpr);
  const find = (f: (k: string) => boolean) => conds.find((c) => f(condKey(c))) ?? conds[0] ?? { k: "sense", s: "pathAhead" } as Expr;
  const b: Blk = { id: newId(), t: "move" };
  switch (kind) {
    case "repeat": b.t = "repeat"; b.n = num(META.repeat.def); b.body = []; break;
    case "until": b.t = "until"; b.cond = find((k) => k === "onFlag"); b.body = []; break;
    case "while": b.t = "while"; b.cond = conds.find((c) => condKey(c) === "!onFlag") ?? find((k) => !k.startsWith("onFlag")); b.body = []; break;
    case "if": b.t = "if"; b.cond = find((k) => k !== "onFlag" && k !== "!onFlag"); b.body = []; break;
    case "ifelse": b.t = "if"; b.cond = find((k) => k !== "onFlag" && k !== "!onFlag"); b.body = []; b.els = []; break;
    case "fd": b.t = "fd"; b.n = num(META.fd.def); break;
    case "tl": case "tr": b.t = kind; b.n = num(META.turn.def); break;
    case "color": b.t = "color"; b.c = "red"; break;
    case "set": b.t = "set"; b.name = o.vars?.[o.vars.length - 1] ?? "x"; b.e = num(0); break;
    case "change": b.t = "change"; b.name = o.vars?.[0] ?? "x"; b.e = num(1); break;
    default:
      if (kind.startsWith("call:")) { b.t = "call"; b.name = kind.slice(5); const f = o.funcs?.find((x) => x.name === b.name); if (f?.param) b.arg = scope?.param ? { k: "v", name: scope.param } : num(META.arg.def); }
      else b.t = kind as BlockKind;
  }
  return b;
};

// ---------- number fields ----------
function numField(sc: Scope, get: () => Expr | undefined, set: (e: Expr) => void, meta: Meta, varsOk = true): HTMLElement {
  const cur = get() ?? num(meta.def);
  const isNum = cur.k === "n";
  const clamp = (v: number) => Math.max(meta.min, Math.min(meta.max, v));
  const mk = (d: number, sym: string) => h("button", { class: "cw-step cw-ctl", type: "button", "data-d": String(d), "aria-label": d > 0 ? "增加" : "减少", disabled: !sc.interactive || !isNum || (isNum && (d > 0 ? (cur as { v: number }).v >= meta.max : (cur as { v: number }).v <= meta.min)),
    onclick: () => sc.edit(() => set(num(clamp((cur as { v: number }).v + d * meta.step)))) }, sym);
  const names = varsOk ? [...(sc.param ? [sc.param] : []), ...sc.vars.filter((v) => v !== sc.param)] : [];
  const label = cur.k === "n" ? String(cur.v) : cur.k === "v" ? cur.name : exprStr(cur);
  const val = h("button", { class: "cw-val cw-ctl" + (isNum ? "" : " var"), type: "button", disabled: !sc.interactive, "aria-label": "选择数值",
    onclick: (e: Event) => sc.pick(e.currentTarget as HTMLElement, [...meta.presets.map((p) => ({ label: String(p), value: `n:${p}` })), ...names.map((n) => ({ label: n, value: `v:${n}`, cls: "var" }))], (v) => sc.edit(() => set(v.startsWith("n:") ? num(Number(v.slice(2))) : { k: "v", name: v.slice(2) }))) }, label);
  return h("span", { class: "cw-num" }, mk(-1, "−"), val, mk(1, "+"));
}

// ---------- one block ----------
function blockEl(b: Blk, sc: Scope, seqs: Map<HTMLElement, { list: Blk[]; script: number }>, script: number, inPalette = false): HTMLElement {
  const kind = kindOf(b);
  const grp = GROUP[kind.startsWith("call:") ? "call" : kind] ?? "go";
  const el = h("div", { class: `cw-b cw-g-${grp}` + (isControl(kind) ? " cw-c" : ""), "data-id": b.id, "data-kind": kind, tabIndex: sc.interactive ? 0 : -1 });
  const head = h("div", { class: "cw-head" });
  const ico = (k: string) => (ICON[k] ? h("span", { class: "cw-ico", "aria-hidden": "true" }, ICON[k]) : null);
  const setE = (key: "n" | "arg" | "e") => (e: Expr) => { (b as unknown as Record<string, Expr>)[key] = e; };
  const condBtn = () => h("button", { class: "cw-cond cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择条件",
    onclick: (e: Event) => sc.pick(e.currentTarget as HTMLElement, sc.conds.map((c) => ({ label: condText(c), value: condKey(c), user: !COND_LABEL[condKey(c)] })), (v) => sc.edit(() => { b.cond = sc.conds.find((c) => condKey(c) === v) ?? b.cond; })) },
    h("span", { class: COND_LABEL[condKey(b.cond ?? num(0))] ? "" : "user" }, condText(b.cond ?? num(0))));
  switch (kind) {
    case "move": case "left": case "right": case "take": case "light": case "penup": case "pendown": head.append(ico(kind)!, span("cw-t", WORD[kind])); break;
    case "fd": head.append(ico("fd")!, span("cw-t", WORD.fd), numField(sc, () => b.n, setE("n"), META.fd)); break;
    case "tl": case "tr": head.append(ico(kind)!, span("cw-t", WORD[kind]), numField(sc, () => b.n, setE("n"), META.turn), span("cw-unit", "°")); break;
    case "color": head.append(span("cw-t", "颜色"), h("button", { class: "cw-swatch cw-ctl", type: "button", style: `background:${COLORS[b.c ?? "black"]}`, title: COLOR_NAMES[b.c ?? "black"], "aria-label": COLOR_NAMES[b.c ?? "black"], disabled: !sc.interactive,
      onclick: (e: Event) => sc.pick(e.currentTarget as HTMLElement, Object.keys(COLORS).map((c) => ({ label: COLOR_NAMES[c], value: c, cls: `sw-${c}` })), (v) => sc.edit(() => { b.c = v; })) })); break;
    case "repeat": head.append(span("cw-t", "重复"), span("cw-unit", "×"), numField(sc, () => b.n, setE("n"), META.repeat)); break;
    case "until": head.append(span("cw-t", "直到"), condBtn()); break;
    case "while": head.append(span("cw-t", "只要"), condBtn()); break;
    case "if": case "ifelse": head.append(span("cw-t", "如果"), condBtn()); break;
    case "set": {
      const e = b.e ?? num(0), op = e.k === "bin" ? e.op : "", A = e.k === "bin" ? e.a : e, B = e.k === "bin" ? e.b : num(0);
      const write = (a: Expr, o: string, bb: Expr) => { b.e = o ? { k: "bin", op: o as "+" | "-" | "*", a, b: bb } : a; };
      head.append(span("cw-t", "设定"),
        h("button", { class: "cw-name cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择变量", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, sc.vars.map((v) => ({ label: v, value: v })), (v) => sc.edit(() => { b.name = v; })) }, b.name ?? "x"),
        span("cw-unit", "="), numField(sc, () => A, (x) => write(x, op, B), META.val),
        h("button", { class: "cw-op cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择运算",
          onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, [{ label: "·", value: "" }, { label: "+", value: "+" }, { label: "−", value: "-" }, { label: "×", value: "*" }], (v) => sc.edit(() => write(A, v, B))) }, op === "*" ? "×" : op === "-" ? "−" : op || "·"),
        ...(op ? [numField(sc, () => B, (x) => write(A, op, x), META.val)] : []));
      break;
    }
    case "change": head.append(span("cw-t", "改变"),
      h("button", { class: "cw-name cw-ctl", type: "button", disabled: !sc.interactive, "aria-label": "选择变量", onclick: (ev: Event) => sc.pick(ev.currentTarget as HTMLElement, sc.vars.map((v) => ({ label: v, value: v })), (v) => sc.edit(() => { b.name = v; })) }, b.name ?? "x"),
      span("cw-unit", "+="), numField(sc, () => b.e, setE("e"), META.by)); break;
    default: {   // call:<name>
      const f = sc.funcs.find((x) => x.name === b.name);
      head.append(span("cw-t", "运行"), span("cw-fn", b.name ?? ""), ...(f?.param ? [numField(sc, () => b.arg, setE("arg"), META.arg)] : []));
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

/** a program drawn as blocks, not editable (the reference answer, the lessons) */
export function programEl(p: Program, o: { vars?: string[]; funcs?: { name: string; param?: string }[]; conds?: string[] } = {}): HTMLElement {
  const sc: Scope = { vars: o.vars ?? [], conds: [], funcs: o.funcs ?? p.funcs, interactive: false, opts: { palette: [], max: 99 }, edit: () => {}, pick: () => {} };
  const seqs = new Map<HTMLElement, { list: Blk[]; script: number }>();
  const root = h("div", { class: "cw-static" });
  const script = (title: string, list: Blk[], i: number, param?: string) => {
    const box = h("div", { class: "cw-seq", "data-slot": "script" });
    const s2 = { ...sc, param };
    for (const b of list) box.append(blockEl(b, s2, seqs, i));
    return h("div", { class: "cw-script" }, h("div", { class: "cw-hat" }, span("cw-t", title.split(" ")[0]), title.includes(" ") ? span("cw-fn", title.split(" ")[1]) : null), box);
  };
  for (let i = 0; i < p.funcs.length; i++) root.append(script(`定义 ${p.funcs[i].name}${p.funcs[i].param ? `(${p.funcs[i].param})` : ""}`, p.funcs[i].body, i + 1, p.funcs[i].param));
  root.append(script("开始", p.main, 0));
  return root;
}

// ---------- the editor ----------
export function createEditor(o: EditorOpts): Editor {
  const funcs = o.funcs ?? [];
  let prog = o.program ? cloneProgram(o.program) : emptyProgram(funcs);
  for (const f of funcs) if (!prog.funcs.some((x) => x.name === f.name)) prog.funcs.push({ name: f.name, param: f.param, body: [] });
  const hist: string[] = [JSON.stringify(prog)];
  let hi = 0, cur = 0, locked = false, hintMark: HintMark | null = null, running: string | null = null;
  const conds = (o.conds ?? []).map(condExpr);
  const vars = o.vars ?? [];
  const seqs = new Map<HTMLElement, { list: Blk[]; script: number }>();
  const ws = h("div", { class: "cw-ws", id: "cw-ws" });
  const ind = h("div", { class: "cw-ind", hidden: true });
  const countEl = h("span", { class: "cw-count", id: "cw-count" });
  const bin = h("div", { class: "cw-bin", id: "cw-bin", title: "拖到这里删除", "aria-label": "删除积木" }, h("span", { "aria-hidden": "true" }, "✕"), h("span", { class: "cw-bin-t" }, "删除"));
  const undoB = h("button", { class: "cw-ubtn", id: "cw-undo", type: "button", "aria-label": "撤销", title: "撤销", onclick: () => api.undo() }, "↶");
  const redoB = h("button", { class: "cw-ubtn", id: "cw-redo", type: "button", "aria-label": "重做", title: "重做", onclick: () => api.redo() }, "↷");
  const bar = h("div", { class: "cw-bar" }, undoB, redoB, countEl, bin);
  const pal = h("div", { class: "cw-pal", id: "cw-pal" });
  const root = h("div", { class: "cw" }, ws, bar, pal);
  let pop: HTMLElement | null = null;

  const closePop = () => { pop?.remove(); pop = null; };
  const pick: Scope["pick"] = (anchor, items, onPick) => {
    closePop();
    const box = h("div", { class: "cw-pop", role: "listbox" });
    for (const it of items) box.append(h("button", { class: "cw-pi " + (it.cls ?? ""), type: "button", role: "option", style: it.cls?.startsWith("sw-") ? `--sw:${COLORS[it.cls.slice(3)]}` : "", onclick: () => { closePop(); onPick(it.value); } }, h("span", { class: it.user ? "user" : "" }, it.label)));
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
  const sc = (script: number): Scope => ({ param: script > 0 ? prog.funcs[script - 1]?.param : undefined, vars, conds, funcs, interactive: !locked, opts: o, edit, pick });
  const listOf = (script: number) => (script === 0 ? prog.main : prog.funcs[script - 1].body);

  function render() {
    seqs.clear();
    ws.replaceChildren();
    const mk = (title: string, fn: string | null, script: number) => {
      const box = h("div", { class: "cw-seq cw-root", "data-slot": "script", "data-script": String(script) });
      seqs.set(box, { list: listOf(script), script });
      for (const b of listOf(script)) box.append(blockEl(b, sc(script), seqs, script));
      const hat = h("div", { class: "cw-hat", "data-script": String(script), onclick: () => { cur = script; mark(); } }, span("cw-t", title), fn ? span("cw-fn", fn) : null,
        script > 0 && prog.funcs[script - 1].param ? span("cw-par", `(${prog.funcs[script - 1].param})`) : null);
      return h("div", { class: "cw-script" + (script === cur ? " cur" : ""), "data-script": String(script) }, hat, box);
    };
    for (let i = 1; i <= prog.funcs.length; i++) ws.append(mk("定义", prog.funcs[i - 1].name, i));
    ws.append(mk("开始", null, 0));
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
  const kinds = (): string[] => {
    const out: string[] = [];
    for (const k of ORDER) {
      if (!o.palette.includes(k)) continue;
      if (k === "call") for (const f of funcs) out.push(`call:${f.name}`);
      else out.push(k);
    }
    return out;
  };
  const buildPal = () => {
    pal.replaceChildren();
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
      // a function may call only the functions defined before it (no recursion in this phase)
      if (script > 0 && idx >= script - 1) ok = false;
    });
    return ok;
  };
  const room = (add: number) => {
    if (countBlocks(prog) + add > o.max) { toast(`最多可以使用 ${o.max} 块积木。`); return false; }
    return true;
  };
  const append = (kind: string) => {
    if (locked) return;
    const b = newBlock(kind, o, { param: cur > 0 ? prog.funcs[cur - 1]?.param : undefined });
    if (!canPlace(b, cur)) return void toast("积木不能调用自己或后面的积木。");
    if (!room(1)) return;
    listOf(cur).push(b);
    commit();
    ws.querySelector(`[data-id="${b.id}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const locate = (id: string): { list: Blk[]; i: number; b: Blk } | null => {
    let r: { list: Blk[]; i: number; b: Blk } | null = null;
    for (const l of [prog.main, ...prog.funcs.map((f) => f.body)]) walk(l, (b, parent, i) => { if (b.id === id) r = { list: parent, i, b }; });
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
      const b = newBlock(d.kind!, o, { param: script > 0 ? prog.funcs[script - 1]?.param : undefined });
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
    setProgram(p) { prog = cloneProgram(p); for (const f of funcs) if (!prog.funcs.some((x) => x.name === f.name)) prog.funcs.push({ name: f.name, param: f.param, body: [] }); hist.splice(0, hist.length, JSON.stringify(prog)); hi = 0; render(); o.onChange?.(prog); api.onHistory?.(); },
    count: () => countBlocks(prog),
    highlight(id) { running = id; mark(); if (id) ws.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: "nearest" }); },
    hint(m) { hintMark = m; mark(); },
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
