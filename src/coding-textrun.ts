/**
 * 编程, text coding: the interpreter of the small Python-like language (parser: coding-textlang.ts). Pure and deterministic: no DOM, no eval, no clock;
 * `import random` is a real Mersenne Twister (the same numbers as CPython after `random.seed(n)` for ints), so a program gives the same output here and in real Python.
 * Values: int = bigint, float = number, bool = boolean, str = string, None = null, list / tuple / dict / set / range = the classes below.
 * Safety: a STEP budget (statements, loop turns, calls, comprehension turns), a call-depth limit, an output limit, size guards for ** and *.
 */
import { PyError, Stmt, Expr, Param, parseProgram, keywordList } from "./coding-textlang";
import type { Seg } from "./coding-interp";

export class PyList { constructor(public a: Val[]) {} }
export class PyTuple { constructor(public a: Val[]) {} }
export class PyDict { m = new Map<string, [Val, Val]>(); }
export class PySet { m = new Map<string, Val>(); }
export class PyRange {
  constructor(public s: bigint, public e: bigint, public st: bigint) {}
  get len(): number { const n = this.st > 0n ? (this.e - this.s + this.st - 1n) / this.st : (this.s - this.e - this.st - 1n) / -this.st; return n > 0n ? Number(n) : 0; }
  at(i: number): bigint { return this.s + BigInt(i) * this.st; }
}
class Frame {
  vars = new Map<string, Val>();
  constructor(public parent: Frame | null, public locals: Set<string> | null, public globals: Set<string> | null, public fname: string) {}
}
export class PyFunc {
  constructor(public name: string, public params: Param[], public body: Stmt[] | Expr, public locals: Set<string>, public globals: Set<string>, public closure: Frame, public isLambda: boolean, public defaults: (Val | undefined)[]) {}
}
export class PyBuiltin { constructor(public name: string, public fn: (a: Val[], kw: Record<string, Val> | null) => Val) {} }
export class PyModule { constructor(public name: string, public attrs: Record<string, Val>) {} }
export type Val = null | boolean | bigint | number | string | PyList | PyTuple | PyDict | PySet | PyRange | PyFunc | PyBuiltin | PyModule;

// ---------- type names ----------
export const typeName = (v: Val): string =>
  v === null ? "NoneType" : typeof v === "boolean" ? "bool" : typeof v === "bigint" ? "int" : typeof v === "number" ? "float" : typeof v === "string" ? "str"
    : v instanceof PyList ? "list" : v instanceof PyTuple ? "tuple" : v instanceof PyDict ? "dict" : v instanceof PySet ? "set" : v instanceof PyRange ? "range"
      : v instanceof PyModule ? "module" : "function";
const CN: Record<string, string> = { NoneType: "空值 None", bool: "布尔值", int: "整数", float: "小数", str: "文字", list: "列表", tuple: "元组", dict: "字典", set: "集合", range: "range", function: "函数", module: "模块" };
export const cnType = (v: Val): string => CN[typeName(v)] ?? typeName(v);

// ---------- numbers ----------
const isInt = (v: Val): v is bigint | boolean => typeof v === "bigint" || typeof v === "boolean";
const isNum = (v: Val): v is bigint | boolean | number => isInt(v) || typeof v === "number";
const big = (v: bigint | boolean): bigint => (typeof v === "boolean" ? (v ? 1n : 0n) : v);
const flt = (v: bigint | boolean | number): number => (typeof v === "number" ? v : Number(big(v)));

/** Python's repr of a float */
export function floatRepr(x: number): string {
  if (Number.isNaN(x)) return "nan";
  if (x === Infinity) return "inf";
  if (x === -Infinity) return "-inf";
  if (x === 0) return Object.is(x, -0) ? "-0.0" : "0.0";
  const sign = x < 0 ? "-" : "";
  const [m, e] = Math.abs(x).toExponential().split("e");
  const digits = m.replace(".", ""), exp = parseInt(e, 10);
  if (exp < -4 || exp >= 16) return `${sign}${digits[0]}${digits.length > 1 ? "." + digits.slice(1) : ""}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  if (exp >= 0) return sign + (digits.length <= exp + 1 ? digits.padEnd(exp + 1, "0") + ".0" : digits.slice(0, exp + 1) + "." + digits.slice(exp + 1));
  return `${sign}0.${"0".repeat(-exp - 1)}${digits}`;
}
/** x with f decimals, correctly rounded from the exact binary value, ties to even (Python's format / round) */
export function toFixedExact(x: number, f: number): string {
  if (!Number.isFinite(x)) return floatRepr(x);
  const neg = x < 0 || Object.is(x, -0);
  let a = Math.abs(x);
  if (a === 0) return (neg ? "-" : "") + (f > 0 ? "0." + "0".repeat(f) : "0");
  // a = m * 2^e with m a 53-bit integer
  let e = 0;
  while (!Number.isInteger(a) && e > -1100) { a *= 2; e--; }
  let m = BigInt(a);
  while (e > 0) { m *= 2n; e--; }
  let q: bigint;
  if (e === 0) q = m * 10n ** BigInt(f);
  else {
    const num = m * 10n ** BigInt(f), den = 1n << BigInt(-e);
    q = num / den;
    const r2 = (num % den) * 2n;
    if (r2 > den || (r2 === den && q % 2n === 1n)) q += 1n;
  }
  let s = q.toString();
  if (f > 0) { s = s.padStart(f + 1, "0"); s = s.slice(0, s.length - f) + "." + s.slice(s.length - f); }
  return (neg ? "-" : "") + s;
}

// ---------- repr / str ----------
export function reprStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = q;
  for (const ch of s) {
    if (ch === q || ch === "\\") out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else if (ch < " " || ch === "\x7f") out += "\\x" + ch.charCodeAt(0).toString(16).padStart(2, "0");
    else out += ch;
  }
  return out + q;
}
export function repr(v: Val, seen: unknown[] = []): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "number") return floatRepr(v);
  if (typeof v === "string") return reprStr(v);
  if (seen.includes(v)) return v instanceof PyList ? "[...]" : "{...}";
  const s = [...seen, v];
  if (v instanceof PyList) return "[" + v.a.map((x) => repr(x, s)).join(", ") + "]";
  if (v instanceof PyTuple) return v.a.length === 1 ? `(${repr(v.a[0], s)},)` : "(" + v.a.map((x) => repr(x, s)).join(", ") + ")";
  if (v instanceof PyDict) return "{" + [...v.m.values()].map(([k, x]) => `${repr(k, s)}: ${repr(x, s)}`).join(", ") + "}";
  if (v instanceof PySet) return v.m.size ? "{" + [...v.m.values()].map((x) => repr(x, s)).join(", ") + "}" : "set()";
  if (v instanceof PyRange) return v.st === 1n ? `range(${v.s}, ${v.e})` : `range(${v.s}, ${v.e}, ${v.st})`;
  if (v instanceof PyFunc) return `<function ${v.name}>`;
  if (v instanceof PyBuiltin) return `<built-in function ${v.name}>`;
  return `<module '${(v as PyModule).name}'>`;
}
export const str = (v: Val): string => (typeof v === "string" ? v : repr(v));

// ---------- hashing / equality / ordering ----------
function keyOf(v: Val, line: number): string {
  if (v === null) return "N";
  if (typeof v === "boolean") return "i" + (v ? 1 : 0);
  if (typeof v === "bigint") return "i" + v;
  if (typeof v === "number") return Number.isInteger(v) && Number.isFinite(v) ? "i" + BigInt(v) : "f" + v;
  if (typeof v === "string") return "s" + v;
  if (v instanceof PyTuple) return "t(" + v.a.map((x) => keyOf(x, line)).join(",") + ")";
  if (v instanceof PyRange || v instanceof PyFunc || v instanceof PyBuiltin || v instanceof PyModule) return "o" + repr(v);
  throw new PyError("TypeError", `第 ${line} 行：${cnType(v)}不能做字典的键，也不能放进集合。`, line, "可以用文字、数字或元组做键。");
}
export function eq(a: Val, b: Val): boolean {
  if (isNum(a) && isNum(b)) {
    if (typeof a === "number" || typeof b === "number") return flt(a) === flt(b);
    return big(a) === big(b);
  }
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (a === null || b === null) return a === b;
  if ((a instanceof PyList && b instanceof PyList) || (a instanceof PyTuple && b instanceof PyTuple)) return a.a.length === b.a.length && a.a.every((x, i) => eq(x, b.a[i]));
  if (a instanceof PyDict && b instanceof PyDict) return a.m.size === b.m.size && [...a.m.entries()].every(([k, [, v]]) => b.m.has(k) && eq(v, b.m.get(k)![1]));
  if (a instanceof PySet && b instanceof PySet) return a.m.size === b.m.size && [...a.m.keys()].every((k) => b.m.has(k));
  if (a instanceof PyRange && b instanceof PyRange) return a.len === b.len && (a.len === 0 || (a.s === b.s && (a.len === 1 || a.st === b.st)));
  return a === b;
}
/** -1 / 0 / 1; throws a TypeError for values that cannot be ordered */
export function cmp(a: Val, b: Val, op: string, line: number): number {
  if (isNum(a) && isNum(b)) {
    if (typeof a === "number" || typeof b === "number") { const x = flt(a), y = flt(b); return x < y ? -1 : x > y ? 1 : x === y ? 0 : NaN; }
    const x = big(a), y = big(b); return x < y ? -1 : x > y ? 1 : 0;
  }
  if (typeof a === "string" && typeof b === "string") return a < b ? -1 : a > b ? 1 : 0;
  if ((a instanceof PyList && b instanceof PyList) || (a instanceof PyTuple && b instanceof PyTuple)) {
    const n = Math.min(a.a.length, b.a.length);
    for (let i = 0; i < n; i++) { if (!eq(a.a[i], b.a[i])) return cmp(a.a[i], b.a[i], op, line); }
    return a.a.length < b.a.length ? -1 : a.a.length > b.a.length ? 1 : 0;
  }
  const hint = (typeof a === "string" && isNum(b)) || (typeof b === "string" && isNum(a)) ? "input() 得到的是文字，比较大小前需要用 int() 或 float() 变成数字。" : undefined;
  throw new PyError("TypeError", `第 ${line} 行：不能比较${cnType(a)}和${cnType(b)}的大小（${op}）。`, line, hint);
}
export function truthy(v: Val): boolean {
  if (v === null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "bigint") return v !== 0n;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (v instanceof PyList || v instanceof PyTuple) return v.a.length > 0;
  if (v instanceof PyDict || v instanceof PySet) return v.m.size > 0;
  if (v instanceof PyRange) return v.len > 0;
  return true;
}

// ---------- Mersenne Twister (CPython's random) ----------
class MT {
  mt = new Uint32Array(624); i = 625;
  constructor(seed: bigint) { this.seed(seed); }
  initGen(s: number) {
    this.mt[0] = s >>> 0;
    for (let k = 1; k < 624; k++) { const p = this.mt[k - 1] ^ (this.mt[k - 1] >>> 30); this.mt[k] = (Math.imul(1812433253, p) + k) >>> 0; }
    this.i = 624;
  }
  seed(seed: bigint) {
    let a = seed < 0n ? -seed : seed;
    const key: number[] = [];
    do { key.push(Number(a & 0xffffffffn)); a >>= 32n; } while (a > 0n);
    this.initGen(19650218);
    let i = 1, j = 0;
    for (let k = Math.max(624, key.length); k; k--) {
      const p = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(p, 1664525)) + key[j] + j) >>> 0;
      i++; j++; if (i >= 624) { this.mt[0] = this.mt[623]; i = 1; } if (j >= key.length) j = 0;
    }
    for (let k = 623; k; k--) {
      const p = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(p, 1566083941)) - i) >>> 0;
      i++; if (i >= 624) { this.mt[0] = this.mt[623]; i = 1; }
    }
    this.mt[0] = 0x80000000; this.i = 624;
  }
  u32(): number {
    if (this.i >= 624) {
      const m = this.mt;
      for (let k = 0; k < 624; k++) {
        const y = (m[k] & 0x80000000) | (m[(k + 1) % 624] & 0x7fffffff);
        m[k] = m[(k + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.i = 0;
    }
    let y = this.mt[this.i++];
    y ^= y >>> 11; y ^= (y << 7) & 0x9d2c5680; y ^= (y << 15) & 0xefc60000; y ^= y >>> 18;
    return y >>> 0;
  }
  random(): number { const a = this.u32() >>> 5, b = this.u32() >>> 6; return (a * 67108864 + b) / 9007199254740992; }
  bits(k: number): bigint {
    if (k <= 32) return BigInt(this.u32() >>> (32 - k));
    let r = 0n;
    for (let i = 0, left = k; left > 0; i++, left -= 32) { let x = this.u32(); if (left < 32) x >>>= 32 - left; r |= BigInt(x) << BigInt(32 * i); }
    return r;
  }
  below(n: bigint): bigint {
    const k = n.toString(2).length;
    let r = this.bits(k);
    while (r >= n) r = this.bits(k);
    return r;
  }
}

// ---------- the interpreter ----------
export interface TraceEvent { line: number; fn: string; scopes: { name: string; vars: [string, string][] }[]; out: number; steps: number }
export interface RunOptions { input?: string; seed?: number; budget?: number; maxDepth?: number; trace?: boolean; maxTrace?: number }
export interface RunResult {
  stdout: string; error: PyError | null; segs: Seg[]; fills: { pts: [number, number][]; c: string }[]; steps: number; trace: TraceEvent[]; traceCut: boolean;
  /** the names and values of the global variables at the end */
  globals: [string, string][]; usedTurtle: boolean;
}
export const DEFAULT_STEPS = 300000;
const MAX_OUT = 200000;

const TCOLORS: Record<string, string> = { black: "black", red: "red", orange: "orange", yellow: "yellow", green: "green", blue: "blue", purple: "purple" };
const TCOLOR_EXTRA: Record<string, string> = { pink: "#e64980", brown: "#8d5524", gray: "#868e96", grey: "#868e96", white: "#ffffff", cyan: "#15aabf", gold: "#f59f00", violet: "#7048e8" };
export const turtleColorHex = (c: string): string => ({ black: "#2d2230", red: "#e03131", orange: "#f76707", yellow: "#f59f00", green: "#2f9e44", blue: "#1c7ed6", purple: "#7048e8" } as Record<string, string>)[c] ?? (c.startsWith("#") ? c : "#2d2230");

const SIG = { brk: 1, cont: 2, ret: 3 } as const;
const STR_METHODS = ["upper", "lower", "capitalize", "title", "swapcase", "strip", "lstrip", "rstrip", "split", "rsplit", "splitlines", "join", "replace", "find", "rfind", "index", "count", "startswith", "endswith", "isdigit", "isalpha", "isalnum", "isspace", "isupper", "islower", "center", "ljust", "rjust", "zfill", "format", "partition", "isnumeric"];
const LIST_METHODS = ["append", "extend", "insert", "pop", "remove", "sort", "reverse", "index", "count", "copy", "clear"];
const DICT_METHODS = ["get", "keys", "values", "items", "pop", "update", "setdefault", "copy", "clear"];
const SET_METHODS = ["add", "remove", "discard", "union", "intersection", "difference", "copy", "clear", "issubset"];

/** edit distance where swapping two neighbours counts as one change (optimal string alignment) */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
/** the most similar candidate (equal ignoring case first; else edit distance 1 for short names, 2 for longer ones; the earlier candidates win ties) */
export function didYouMean(name: string, cands: Iterable<string>): string | null {
  let best: string | null = null, bd = 99;
  for (const c of cands) {
    if (c === name || c.startsWith("__")) continue;
    if (c.toLowerCase() === name.toLowerCase()) return c;
    const d = editDistance(name.toLowerCase(), c.toLowerCase());
    if (d < bd) { bd = d; best = c; }
  }
  return best !== null && bd <= (name.length <= 4 ? 1 : 2) ? best : null;
}

class Interp {
  out = "";
  inputLines: string[]; inputPos = 0;
  steps = 0; budget: number; depth = 0; maxDepth: number;
  line = 0;
  root: Frame; fr: Frame; stack: Frame[];
  ret: Val = null;
  rng: MT;
  builtins = new Map<string, Val>();
  modules = new Map<string, PyModule>();
  trace: TraceEvent[] = []; traceOn: boolean; maxTrace: number; traceCut = false;
  // turtle
  t = { x: 0, y: 0, h: 0, pen: true, color: "black", fill: "black", filling: null as [number, number][] | null, used: false };
  segs: Seg[] = []; fills: { pts: [number, number][]; c: string }[] = [];

  constructor(o: RunOptions) {
    this.inputLines = (o.input ?? "").replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
    if ((o.input ?? "") === "") this.inputLines = [];
    this.budget = o.budget ?? DEFAULT_STEPS; this.maxDepth = o.maxDepth ?? 200;
    this.root = new Frame(null, null, null, "<模块>"); this.fr = this.root; this.stack = [this.root];
    this.rng = new MT(BigInt(o.seed ?? 1));
    this.traceOn = !!o.trace; this.maxTrace = o.maxTrace ?? 2500;
    this.setupBuiltins();
  }

  // ----- errors -----
  err(kind: ConstructorParameters<typeof PyError>[0], msg: string, hint?: string, line = this.line): never { throw new PyError(kind, `第 ${line} 行：${msg}`, line, hint); }
  tick() { if (++this.steps > this.budget) this.err("StepLimit", `程序运行得太久（超过 ${this.budget} 步），可能是死循环。`, "检查 while 的条件会不会变成 False，或者 for 的范围是否太大。"); }
  write(s: string) { this.out += s; if (this.out.length > MAX_OUT) this.err("OutputLimit", "输出的内容太多了。", "检查 print 是不是在没有结束的循环里。"); }

  // ----- scopes -----
  /** the names a child can use: his own first, then the built-in ones (so that a "did you mean" prefers his variables) */
  allNames(): string[] {
    const n = new Set<string>();
    for (let f: Frame | null = this.fr; f; f = f.parent) for (const [k, v] of f.vars) if (!(v instanceof PyModule)) n.add(k);
    for (const k of this.root.vars.keys()) n.add(k);
    for (const k of this.builtins.keys()) n.add(k);
    return [...n];
  }
  lookup(name: string, line: number): Val {
    for (let f: Frame | null = this.fr; f; f = f.parent) {
      if (f.globals?.has(name)) { if (this.root.vars.has(name)) return this.root.vars.get(name)!; break; }
      if (f.vars.has(name)) return f.vars.get(name)!;
      if (f.locals?.has(name)) this.err("UnboundLocalError", `变量 ${name} 在赋值之前就被使用了。`, `函数里只要给 ${name} 赋过值，它就是这个函数自己的变量。要修改外面的变量，请在函数开头写 global ${name}。`, line);
    }
    if (this.root.vars.has(name) && !this.fr.locals?.has(name)) return this.root.vars.get(name)!;
    if (this.builtins.has(name)) return this.builtins.get(name)!;
    const sug = didYouMean(name, [...this.allNames(), ...keywordList]);
    const low: Record<string, string> = { true: "True", false: "False", none: "None" };
    this.err("NameError", `名字 ${name} 没有定义。`, low[name] ? `Python 区分大小写，请写成 ${low[name]}。` : sug ? `你是不是想写 ${sug}？` : "请检查拼写，变量要先赋值才能使用；文字要用引号括起来。", line);
  }
  assignName(name: string, v: Val) { if (this.fr.globals?.has(name)) this.root.vars.set(name, v); else this.fr.vars.set(name, v); }

  // ----- statements -----
  record(line: number) {
    if (this.trace.length >= this.maxTrace) { this.traceCut = true; return; }
    const scopes: TraceEvent["scopes"] = [];
    for (const f of this.stack) {
      const vars: [string, string][] = [];
      for (const [k, v] of f.vars) { if (v instanceof PyFunc || v instanceof PyBuiltin || v instanceof PyModule) continue; const s = repr(v); vars.push([k, s.length > 60 ? s.slice(0, 57) + "..." : s]); }
      scopes.push({ name: f.fname, vars });
    }
    this.trace.push({ line, fn: this.fr.fname, scopes, out: this.out.length, steps: this.steps });
  }
  execBlock(body: Stmt[]): number {
    for (const s of body) { const r = this.exec(s); if (r) return r; }
    return 0;
  }
  exec(s: Stmt): number {
    this.tick(); this.line = s.line;
    if (this.traceOn) this.record(s.line);
    switch (s.k) {
      case "expr": this.eval(s.e); return 0;
      case "pass": return 0;
      case "assign": {
        const v = this.eval(s.value);
        for (const t of s.targets) this.assign(t, v);
        return 0;
      }
      case "aug": {
        this.line = s.line;
        if (s.target.k === "name") { const cur = this.lookup(s.target.id, s.line); const nv = this.binop(s.op, cur, this.eval(s.value), s.line, true); this.assignName(s.target.id, nv); }
        else if (s.target.k === "idx") {
          const o = this.eval(s.target.o), i = this.eval(s.target.i);
          const cur = this.getItem(o, i, s.line); this.setItem(o, i, this.binop(s.op, cur, this.eval(s.value), s.line, true), s.line);
        }
        return 0;
      }
      case "if": {
        for (const t of s.tests) { this.line = t.line; if (this.traceOn && t !== s.tests[0]) this.record(t.line); if (truthy(this.eval(t.c))) return this.execBlock(t.body); }
        return s.els ? this.execBlock(s.els) : 0;
      }
      case "while": {
        for (;;) {
          this.line = s.line;
          if (!truthy(this.eval(s.c))) break;
          const r = this.execBlock(s.body);
          if (r === SIG.brk) break; if (r === SIG.ret) return r;
          this.tick();
          if (this.traceOn) this.record(s.line);
        }
        return 0;
      }
      case "for": {
        const it = this.eval(s.iter);
        this.line = s.line;
        const seq = this.iterate(it, s.line);
        let first = true;
        for (const x of seq) {
          if (!first) { this.tick(); if (this.traceOn) this.record(s.line); }
          first = false;
          this.assign(s.target, x);
          const r = this.execBlock(s.body);
          if (r === SIG.brk) break; if (r === SIG.ret) return r;
        }
        return 0;
      }
      case "def": {
        const defaults = s.params.map((p) => (p.def ? this.eval(p.def) : undefined));
        this.assignName(s.name, new PyFunc(s.name, s.params, s.body, s.locals!, s.globals!, this.fr, false, defaults));
        return 0;
      }
      case "return": this.ret = s.e ? this.eval(s.e) : null; return SIG.ret;
      case "break": return SIG.brk;
      case "continue": return SIG.cont;
      case "global": return 0;
      case "import": {
        const m = this.module(s.mod, s.line);
        this.assignName(s.as ?? s.mod.split(".")[0], m);
        return 0;
      }
      case "from": {
        const m = this.module(s.mod, s.line);
        if (s.names === "*") { for (const [k, v] of Object.entries(m.attrs)) if (!k.startsWith("_")) this.assignName(k, v); }
        else for (const n of s.names) { if (!(n in m.attrs)) this.err("NameError", `模块 ${s.mod} 里没有 ${n}。`, didYouMean(n, Object.keys(m.attrs)) ? `你是不是想写 ${didYouMean(n, Object.keys(m.attrs))}？` : undefined, s.line); this.assignName(n, m.attrs[n]); }
        return 0;
      }
      case "del": {
        const t = s.target;
        if (t.k === "idx") {
          const o = this.eval(t.o), i = this.eval(t.i);
          this.line = s.line;
          if (o instanceof PyList) { const k = this.index(i, o.a.length, s.line, "列表"); o.a.splice(k, 1); }
          else if (o instanceof PyDict) { const kk = keyOf(i, s.line); if (!o.m.has(kk)) this.err("KeyError", `字典里没有键 ${repr(i)}。`, undefined, s.line); o.m.delete(kk); }
          else this.err("TypeError", `${cnType(o)}不能删除其中的元素。`);
        } else if (t.k === "name") this.fr.vars.delete(t.id);
        else this.err("SyntaxError", "del 后面需要变量名或 列表[位置]。");
        return 0;
      }
      case "assert": {
        if (!truthy(this.eval(s.c))) this.err("AssertionError", s.msg ? str(this.eval(s.msg)) : "assert 的条件不成立。");
        return 0;
      }
    }
  }
  assign(t: Expr, v: Val) {
    switch (t.k) {
      case "name": this.assignName(t.id, v); return;
      case "idx": { const o = this.eval(t.o), i = this.eval(t.i); this.setItem(o, i, v, t.line); return; }
      case "tuple": case "list": {
        const vals = [...this.iterate(v, t.line)];
        if (vals.length !== t.items.length) this.err("ValueError", vals.length < t.items.length ? `需要 ${t.items.length} 个值，但只有 ${vals.length} 个。` : `值太多：需要 ${t.items.length} 个，给了 ${vals.length} 个。`, undefined, t.line);
        t.items.forEach((x, i) => this.assign(x, vals[i]));
        return;
      }
      default: this.err("SyntaxError", "这里不能赋值。", undefined, t.line);
    }
  }

  // ----- iteration, indexing -----
  iterate(v: Val, line: number): Iterable<Val> {
    if (v instanceof PyList || v instanceof PyTuple) return (function* (a: Val[]) { for (let i = 0; i < a.length; i++) yield a[i]; })(v.a);
    if (typeof v === "string") return (function* () { for (const ch of v) yield ch; })();
    if (v instanceof PyRange) return (function* () { const n = v.len; for (let i = 0; i < n; i++) yield v.at(i); })();
    if (v instanceof PyDict) return [...v.m.values()].map(([k]) => k);
    if (v instanceof PySet) return [...v.m.values()];
    this.line = line;
    return this.err("TypeError", `${cnType(v)}不能用在 for 循环里。`, typeof v === "bigint" ? "想重复 n 次，请写 for i in range(n):。" : undefined, line);
  }
  index(i: Val, n: number, line: number, what: string): number {
    if (!isInt(i)) this.err("TypeError", `${what}的位置必须是整数，不能是${cnType(i)}。`, typeof i === "number" ? "小数要先用 int() 变成整数。" : undefined, line);
    let k = Number(big(i as bigint));
    const orig = k;
    if (k < 0) k += n;
    if (k < 0 || k >= n) this.err("IndexError", `${what}的位置 ${orig} 超出范围：${n === 0 ? `${what}是空的` : `${what}一共有 ${n} 个元素，有效位置是 0 到 ${n - 1}（也可以用 -1 到 -${n}）`}。`, "位置从 0 开始数；最后一个元素的位置是 长度 - 1。", line);
    return k;
  }
  getItem(o: Val, i: Val, line: number): Val {
    this.line = line;
    if (o instanceof PyList || o instanceof PyTuple) return o.a[this.index(i, o.a.length, line, o instanceof PyList ? "列表" : "元组")];
    if (typeof o === "string") return o[this.index(i, o.length, line, "文字")];
    if (o instanceof PyRange) return o.at(this.index(i, o.len, line, "range"));
    if (o instanceof PyDict) {
      const e = o.m.get(keyOf(i, line));
      if (!e) this.err("KeyError", `字典里没有键 ${repr(i)}。`, "可以用 d.get(键) 取值，键不存在时得到 None；或者先用 in 检查。", line);
      return e![1];
    }
    return this.err("TypeError", `${cnType(o)}不能用 [ ] 取元素。`, undefined, line);
  }
  setItem(o: Val, i: Val, v: Val, line: number) {
    this.line = line;
    if (o instanceof PyList) { o.a[this.index(i, o.a.length, line, "列表")] = v; return; }
    if (o instanceof PyDict) { o.m.set(keyOf(i, line), [i, v]); return; }
    if (typeof o === "string" || o instanceof PyTuple) this.err("TypeError", `${cnType(o)}不能被修改（赋值）。`, typeof o === "string" ? "文字是不可变的：可以用 replace 或拼接做出一个新的文字。" : undefined, line);
    this.err("TypeError", `${cnType(o)}不能用 [ ] 赋值。`, undefined, line);
  }
  sliceBounds(n: number, lo: Val | undefined, hi: Val | undefined, st: Val | undefined, line: number): number[] {
    const get = (v: Val | undefined): number | null => { if (v === undefined || v === null) return null; if (!isInt(v)) this.err("TypeError", "切片的位置必须是整数。", undefined, line); return Number(big(v as bigint)); };
    const step = get(st) ?? 1;
    if (step === 0) this.err("ValueError", "切片的步长不能是 0。", undefined, line);
    let a = get(lo), b = get(hi);
    const idx: number[] = [];
    if (step > 0) {
      a = a === null ? 0 : a < 0 ? Math.max(0, a + n) : Math.min(a, n);
      b = b === null ? n : b < 0 ? Math.max(0, b + n) : Math.min(b, n);
      for (let i = a; i < b; i += step) idx.push(i);
    } else {
      a = a === null ? n - 1 : a < 0 ? Math.max(-1, a + n) : Math.min(a, n - 1);
      b = b === null ? -1 : b < 0 ? Math.max(-1, b + n) : Math.min(b, n - 1);
      for (let i = a; i > b; i += step) idx.push(i);
    }
    return idx;
  }

  // ----- expressions -----
  eval(e: Expr): Val {
    switch (e.k) {
      case "num": return e.v;
      case "str": return e.v;
      case "const": return e.v;
      case "name": return this.lookup(e.id, e.line);
      case "fstr": {
        let s = "";
        for (const p of e.parts) {
          if (typeof p === "string") { s += p; continue; }
          let v = this.eval(p.e);
          if (p.eq !== undefined) s += p.eq + "=";
          if (p.conv === "r") v = repr(v); else if (p.conv === "s") v = str(v);
          let spec = "";
          if (p.spec) for (const sp of p.spec) spec += typeof sp === "string" ? sp : str(this.eval(sp.e));
          this.line = e.line;
          s += p.eq !== undefined && !p.spec && !p.conv ? repr(v) : this.format(v, spec, e.line);
        }
        return s;
      }
      case "list": return new PyList(e.items.map((x) => this.eval(x)));
      case "tuple": return new PyTuple(e.items.map((x) => this.eval(x)));
      case "set": { const s = new PySet(); for (const x of e.items) { const v = this.eval(x); s.m.set(keyOf(v, e.line), v); } return s; }
      case "dict": { const d = new PyDict(); for (const [k, v] of e.pairs) { const kk = this.eval(k); d.m.set(keyOf(kk, e.line), [kk, this.eval(v)]); } return d; }
      case "un": {
        const a = this.eval(e.a);
        if (e.op === "not") return !truthy(a);
        this.line = e.line;
        if (!isNum(a)) this.err("TypeError", `不能对${cnType(a)}使用负号 / 正号。`, undefined, e.line);
        if (e.op === "+") return typeof a === "number" ? a : big(a as bigint | boolean);
        return typeof a === "number" ? -a : -big(a as bigint | boolean);
      }
      case "bin": { const a = this.eval(e.a), b = this.eval(e.b); return this.binop(e.op, a, b, e.line, false); }
      case "logic": { const a = this.eval(e.a); return e.op === "and" ? (truthy(a) ? this.eval(e.b) : a) : truthy(a) ? a : this.eval(e.b); }
      case "cond": return truthy(this.eval(e.c)) ? this.eval(e.a) : this.eval(e.b);
      case "cmp": {
        let left = this.eval(e.first);
        for (const [op, re] of e.ops) {
          const right = this.eval(re);
          this.line = e.line;
          let r: boolean;
          switch (op) {
            case "==": r = eq(left, right); break;
            case "!=": r = !eq(left, right); break;
            case "<": r = cmp(left, right, "<", e.line) < 0; break;
            case ">": r = cmp(left, right, ">", e.line) > 0; break;
            case "<=": r = cmp(left, right, "<=", e.line) <= 0; break;
            case ">=": r = cmp(left, right, ">=", e.line) >= 0; break;
            case "in": r = this.contains(right, left, e.line); break;
            case "not in": r = !this.contains(right, left, e.line); break;
            case "is": r = left === right || (left === null && right === null); break;
            default: r = !(left === right || (left === null && right === null));
          }
          if (!r) return false;
          left = right;
        }
        return true;
      }
      case "idx": { const o = this.eval(e.o), i = this.eval(e.i); return this.getItem(o, i, e.line); }
      case "slice": {
        const o = this.eval(e.o);
        const lo = e.lo ? this.eval(e.lo) : undefined, hi = e.hi ? this.eval(e.hi) : undefined, st = e.st ? this.eval(e.st) : undefined;
        this.line = e.line;
        if (typeof o === "string") return this.sliceBounds(o.length, lo, hi, st, e.line).map((i) => o[i]).join("");
        if (o instanceof PyList) return new PyList(this.sliceBounds(o.a.length, lo, hi, st, e.line).map((i) => o.a[i]));
        if (o instanceof PyTuple) return new PyTuple(this.sliceBounds(o.a.length, lo, hi, st, e.line).map((i) => o.a[i]));
        if (o instanceof PyRange) return new PyList(this.sliceBounds(o.len, lo, hi, st, e.line).map((i) => o.at(i)));
        return this.err("TypeError", `${cnType(o)}不能切片。`, undefined, e.line);
      }
      case "attr": {
        const o = this.eval(e.o);
        this.line = e.line;
        return this.getAttr(o, e.name, e.line);
      }
      case "lambda": return new PyFunc("<lambda>", e.params.map((n) => ({ name: n })), e.body, new Set(e.params), new Set(), this.fr, true, e.params.map(() => undefined));
      case "comp": return this.comprehension(e);
      case "call": return this.callExpr(e);
    }
  }
  comprehension(e: Extract<Expr, { k: "comp" }>): Val {
    const out: Val[] = [], dict = new PyDict(), set = new PySet();
    const names = new Set<string>();
    const targets = (t: Expr) => { if (t.k === "name") names.add(t.id); else if (t.k === "tuple" || t.k === "list") t.items.forEach(targets); };
    for (const c of e.clauses) if ("target" in c) targets(c.target);
    // the first iterable is evaluated in the enclosing scope (like Python)
    const c0 = e.clauses[0];
    const first = c0 && "iter" in c0 ? this.eval(c0.iter) : null;
    const frame = new Frame(this.fr, names, null, this.fr.fname);
    const saved = this.fr;
    try {
      this.fr = frame;
      const go = (ci: number) => {
        if (ci === e.clauses.length) {
          this.tick();
          if (e.kind === "dict") { const k = this.eval(e.elt); dict.m.set(keyOf(k, e.line), [k, this.eval(e.val!)]); }
          else if (e.kind === "set") { const v = this.eval(e.elt); set.m.set(keyOf(v, e.line), v); }
          else out.push(this.eval(e.elt));
          return;
        }
        const c = e.clauses[ci];
        if ("cond" in c) { if (truthy(this.eval(c.cond))) go(ci + 1); return; }
        const it = ci === 0 ? first : this.eval(c.iter);
        for (const x of this.iterate(it, e.line)) { this.assign(c.target, x); go(ci + 1); }
      };
      go(0);
    } finally { this.fr = saved; }
    return e.kind === "dict" ? dict : e.kind === "set" ? set : new PyList(out);
  }
  contains(c: Val, x: Val, line: number): boolean {
    if (typeof c === "string") {
      if (typeof x !== "string") this.err("TypeError", `用 in 检查文字时，左边也必须是文字，不能是${cnType(x)}。`, undefined, line);
      return c.includes(x as string);
    }
    if (c instanceof PyList || c instanceof PyTuple) return c.a.some((y) => eq(y, x));
    if (c instanceof PyDict) return c.m.has(keyOf(x, line));
    if (c instanceof PySet) return c.m.has(keyOf(x, line));
    if (c instanceof PyRange) return isNum(x) && [...this.iterate(c, line)].some((y) => eq(y, x));
    return this.err("TypeError", `${cnType(c)}不能用 in 检查。`, undefined, line);
  }

  binop(op: string, a: Val, b: Val, line: number, aug: boolean): Val {
    this.line = line;
    if (isNum(a) && isNum(b)) return this.numop(op, a, b, line);
    if (op === "+") {
      if (typeof a === "string" && typeof b === "string") return a + b;
      if (a instanceof PyList && b instanceof PyList) return new PyList([...a.a, ...b.a]);
      if (a instanceof PyTuple && b instanceof PyTuple) return new PyTuple([...a.a, ...b.a]);
      if ((typeof a === "string" && isNum(b)) || (isNum(a) && typeof b === "string")) this.err("TypeError", `不能用 + 把${cnType(a)}和${cnType(b)}连在一起。`, "文字和数字不能直接相加：用 str(数字) 把数字变成文字，或者用 int(文字) 把文字变成数字；也可以用 f\"...{变量}...\"。", line);
    }
    if (op === "*") {
      const rep = (s: Val, n: Val): Val | undefined => {
        if (!isInt(n)) return undefined;
        const k = Math.max(0, Number(big(n)));
        if (typeof s === "string") { if (s.length * k > 1e6) this.err("OverflowError", "重复后的文字太长了。", undefined, line); return s.repeat(k); }
        if (s instanceof PyList) { if (s.a.length * k > 1e6) this.err("OverflowError", "重复后的列表太长了。", undefined, line); const r: Val[] = []; for (let i = 0; i < k; i++) r.push(...s.a); return new PyList(r); }
        if (s instanceof PyTuple) { const r: Val[] = []; for (let i = 0; i < k; i++) r.push(...s.a); return new PyTuple(r); }
        return undefined;
      };
      const r = rep(a, b) ?? rep(b, a);
      if (r !== undefined) return r;
    }
    if (op === "%" && typeof a === "string") return this.percentFormat(a, b, line);
    void aug;
    if (a === null || b === null) this.err("TypeError", `${a === null && b === null ? "两个 None" : "None"} 不能参加 ${op} 运算。`, "函数如果没有 return，得到的就是 None。检查函数最后有没有 return。", line);
    return this.err("TypeError", `不能对${cnType(a)}和${cnType(b)}使用 ${op}。`, undefined, line);
  }
  numop(op: string, a: bigint | boolean | number, b: bigint | boolean | number, line: number): Val {
    const bothInt = isInt(a) && isInt(b);
    if (bothInt) {
      const x = big(a as bigint | boolean), y = big(b as bigint | boolean);
      switch (op) {
        case "+": return x + y;
        case "-": return x - y;
        case "*": return x * y;
        case "/": if (y === 0n) this.err("ZeroDivisionError", "除数不能是 0。", "检查除数是不是 0。", line); return Number(x) / Number(y);
        case "//": { if (y === 0n) this.err("ZeroDivisionError", "整除的除数不能是 0。", "检查除数是不是 0。", line); let q = x / y; if (x % y !== 0n && (x < 0n) !== (y < 0n)) q -= 1n; return q; }
        case "%": { if (y === 0n) this.err("ZeroDivisionError", "取余数的除数不能是 0。", "检查除数是不是 0。", line); let r = x % y; if (r !== 0n && (r < 0n) !== (y < 0n)) r += y; return r; }
        case "**": {
          if (y < 0n) { if (x === 0n) this.err("ZeroDivisionError", "0 不能做负数次方。", undefined, line); return Math.pow(Number(x), Number(y)); }
          const absx = x < 0n ? -x : x;
          if (absx > 1n && Number(y) * Math.log10(Number(absx > 1n ? absx : 2n)) > 20000) this.err("OverflowError", "乘方的结果太大了。", undefined, line);
          return x ** y;
        }
      }
    }
    const x = flt(a), y = flt(b);
    switch (op) {
      case "+": return x + y;
      case "-": return x - y;
      case "*": return x * y;
      case "/": if (y === 0) this.err("ZeroDivisionError", "除数不能是 0。", "检查除数是不是 0。", line); return x / y;
      case "//": { if (y === 0) this.err("ZeroDivisionError", "整除的除数不能是 0。", undefined, line); return Math.floor(x / y); }
      case "%": { if (y === 0) this.err("ZeroDivisionError", "取余数的除数不能是 0。", undefined, line); let r = x % y; if (r !== 0 && (r < 0) !== (y < 0)) r += y; return r; }
      case "**": {
        if (x === 0 && y < 0) this.err("ZeroDivisionError", "0 不能做负数次方。", undefined, line);
        if (x < 0 && !Number.isInteger(y)) this.err("ValueError", "负数的小数次方不是实数（这门入门语言不支持复数）。", undefined, line);
        return Math.pow(x, y);
      }
    }
    return this.err("TypeError", `不支持运算 ${op}。`, undefined, line);
  }
  percentFormat(fmt: string, arg: Val, line: number): string {
    const args = arg instanceof PyTuple ? arg.a : [arg];
    let k = 0;
    const out = fmt.replace(/%([-+0 ]*)(\d*)(?:\.(\d+))?([sdifrx%])/g, (_m, flags: string, w: string, p: string | undefined, t: string) => {
      if (t === "%") return "%";
      if (k >= args.length) this.err("TypeError", "% 格式里的占位符比给的值多。", undefined, line);
      const v = args[k++];
      let s: string;
      if (t === "s") s = str(v); else if (t === "r") s = repr(v);
      else if (t === "d" || t === "i") { if (!isNum(v)) this.err("TypeError", `%d 需要数字，不能是${cnType(v)}。`, undefined, line); s = (typeof v === "number" ? BigInt(Math.trunc(v)) : big(v as bigint)).toString(); }
      else if (t === "x") s = big(v as bigint).toString(16);
      else { if (!isNum(v)) this.err("TypeError", `%f 需要数字，不能是${cnType(v)}。`, undefined, line); s = toFixedExact(flt(v), p === undefined ? 6 : Number(p)); }
      if (flags.includes("+") && /^\d/.test(s) && t !== "s") s = "+" + s;
      const width = w ? Number(w) : 0;
      if (s.length < width) s = flags.includes("-") ? s.padEnd(width) : flags.includes("0") && t !== "s" ? (s[0] === "-" || s[0] === "+" ? s[0] + s.slice(1).padStart(width - 1, "0") : s.padStart(width, "0")) : s.padStart(width);
      return s;
    });
    if (k < args.length) this.err("TypeError", "% 格式里的占位符比给的值少。", undefined, line);
    return out;
  }

  // ----- format spec -----
  format(v: Val, spec: string, line: number): string {
    if (spec === "") return str(v);
    const m = /^(?:(.)?([<>=^]))?([+\- ])?(#)?(0)?(\d+)?([,_])?(?:\.(\d+))?([a-zA-Z%])?$/su.exec(spec);
    if (!m) this.err("ValueError", `格式 “${spec}” 不正确。`, "例如 {x:.2f}（两位小数）、{x:>5}（右对齐宽度 5）、{x:05d}。", line);
    const [, fill0, align0, sign, , zero, width, comma, prec, type] = m!;
    let fill = fill0 ?? " ", align = align0 ?? "";
    let body: string;
    const w = width ? Number(width) : 0;
    const numeric = isNum(v);
    if (typeof v === "string" || !numeric) {
      if (type && type !== "s") this.err("ValueError", `文字不能用格式 ${type}。`, undefined, line);
      body = str(v);
      if (!numeric && typeof v !== "string" && type === undefined && spec !== "" && !(v instanceof PyList)) { /* fall through: Python would complain for some, we are lenient */ }
      if (prec !== undefined) body = body.slice(0, Number(prec));
      if (!align) align = "<";
    } else {
      let neg = false, digits: string;
      const t = type ?? (typeof v === "number" ? "" : "d");
      if (t === "f" || t === "F" || t === "e" || t === "E" || t === "%" || t === "g" || t === "") {
        const x = flt(v as number);
        neg = x < 0 || Object.is(x, -0);
        const ax = Math.abs(x);
        if (t === "f" || t === "F") digits = toFixedExact(ax, prec === undefined ? 6 : Number(prec));
        else if (t === "%") digits = toFixedExact(ax * 100, prec === undefined ? 6 : Number(prec)) + "%";
        else if (t === "e" || t === "E") { digits = ax.toExponential(prec === undefined ? 6 : Number(prec)).replace(/e([+-])(\d)$/, "e$10$2"); if (t === "E") digits = digits.toUpperCase(); }
        else if (t === "g") { const P = prec === undefined ? 6 : Math.max(1, Number(prec)); const ex = ax === 0 ? 0 : Math.floor(Math.log10(ax)); digits = ex < -4 || ex >= P ? ax.toExponential(P - 1).replace(/\.?0+e/, "e").replace(/e([+-])(\d)$/, "e$10$2") : String(Number(ax.toPrecision(P))); }
        else digits = prec === undefined ? (typeof v === "number" ? floatRepr(ax) : big(v as bigint).toString().replace("-", "")) : (Number(ax.toPrecision(Math.max(1, Number(prec)))) + "");
        if (t === "" && typeof v !== "number") digits = big(v as bigint | boolean).toString().replace("-", "");
      } else if (t === "d" || t === "b" || t === "o" || t === "x" || t === "X") {
        if (typeof v === "number") this.err("ValueError", `小数不能用格式 ${t}。`, "整数才能用 d / b / o / x；小数请用 f。", line);
        const x = big(v as bigint | boolean); neg = x < 0n;
        const ax = neg ? -x : x;
        digits = t === "d" ? ax.toString() : t === "b" ? ax.toString(2) : t === "o" ? ax.toString(8) : t === "x" ? ax.toString(16) : ax.toString(16).toUpperCase();
      } else if (t === "s") { this.err("ValueError", "数字不能用格式 s。", undefined, line); digits = ""; }
      else { this.err("ValueError", `不认识的格式 ${t}。`, undefined, line); digits = ""; }
      if (comma) { const [ip, fp] = digits.split("."); const pct = fp?.endsWith("%") ?? false; const ipp = ip.replace(/\B(?=(\d{3})+(?!\d))/g, comma); digits = ipp + (fp !== undefined ? "." + fp : ""); void pct; }
      const sg = neg ? "-" : sign === "+" ? "+" : sign === " " ? " " : "";
      if (zero && !align0) { fill = "0"; align = "="; }
      if (!align) align = ">";
      if (align === "=") { body = sg + digits.padStart(Math.max(0, w - sg.length), fill); return body; }
      body = sg + digits;
    }
    if (body.length >= w) return body;
    const padn = w - body.length;
    if (align === "<") return body + fill.repeat(padn);
    if (align === ">") return fill.repeat(padn) + body;
    const l = Math.floor(padn / 2);
    return fill.repeat(l) + body + fill.repeat(padn - l);
  }

  // ----- calls -----
  callExpr(e: Extract<Expr, { k: "call" }>): Val {
    if (e.f.k === "attr") {
      const o = this.eval(e.f.o);
      const args = e.args.map((a) => this.eval(a));
      const kw = e.kw.length ? Object.fromEntries(e.kw.map(([n, x]) => [n, this.eval(x)])) : null;
      this.line = e.line;
      if (o instanceof PyModule) { const f = this.getAttr(o, e.f.name, e.line); return this.callValue(f, args, kw, e.line); }
      const r = this.method(o, e.f.name, args, kw, e.line);
      this.line = e.line;
      return r;
    }
    const f = this.eval(e.f);
    const args = e.args.map((a) => this.eval(a));
    const kw = e.kw.length ? Object.fromEntries(e.kw.map(([n, x]) => [n, this.eval(x)])) : null;
    this.line = e.line;
    const r = this.callValue(f, args, kw, e.line, e.f.k === "name" ? e.f.id : undefined);
    this.line = e.line;
    return r;
  }
  callValue(f: Val, args: Val[], kw: Record<string, Val> | null, line: number, name?: string): Val {
    if (f instanceof PyBuiltin) { this.line = line; return f.fn(args, kw); }
    if (!(f instanceof PyFunc)) this.err("TypeError", `${name ? name + " 是" : ""}${cnType(f)}，不能当作函数调用。`, name ? `${name} 后面的括号 ( ) 是调用函数的意思。如果想相乘，请写 ${name} * (...)。` : undefined, line);
    const fn = f as PyFunc;
    this.tick();
    if (this.depth >= this.maxDepth) this.err("RecursionError", `函数调用得太深了（超过 ${this.maxDepth} 层）。`, "递归函数必须有结束的条件，并且每次调用要更接近这个条件。", line);
    const frame = new Frame(fn.closure, fn.locals, fn.globals, fn.name);
    const np = fn.params.length;
    if (args.length > np) this.err("TypeError", `函数 ${fn.name} 只需要 ${np} 个参数，却给了 ${args.length} 个。`, undefined, line);
    for (let i = 0; i < np; i++) {
      const p = fn.params[i];
      if (i < args.length) frame.vars.set(p.name, args[i]);
      else if (kw && p.name in kw) frame.vars.set(p.name, kw[p.name]);
      else if (fn.defaults[i] !== undefined) frame.vars.set(p.name, fn.defaults[i]!);
      else this.err("TypeError", `调用函数 ${fn.name} 时缺少参数 ${p.name}。`, `${fn.name} 需要 ${np} 个参数：${fn.params.map((x) => x.name).join(", ")}。`, line);
    }
    if (kw) for (const k of Object.keys(kw)) if (!fn.params.some((p) => p.name === k)) this.err("TypeError", `函数 ${fn.name} 没有名叫 ${k} 的参数。`, undefined, line);
    const savedFr = this.fr;
    this.fr = frame; this.stack.push(frame); this.depth++;
    try {
      if (fn.isLambda) return this.eval(fn.body as Expr);
      this.ret = null;
      const r = this.execBlock(fn.body as Stmt[]);
      const v = r === SIG.ret ? this.ret : null;
      this.ret = null;
      return v;
    } finally { this.depth--; this.stack.pop(); this.fr = savedFr; }
  }
  getAttr(o: Val, name: string, line: number): Val {
    if (o instanceof PyModule) {
      if (name in o.attrs) return o.attrs[name];
      const sug = didYouMean(name, Object.keys(o.attrs));
      this.err("AttributeError", `模块 ${o.name} 里没有 ${name}。`, sug ? `你是不是想写 ${o.name}.${sug}？` : undefined, line);
    }
    const lists: Record<string, string[]> = { str: STR_METHODS, list: LIST_METHODS, dict: DICT_METHODS, set: SET_METHODS };
    const tn = typeName(o);
    if (lists[tn]?.includes(name) || (tn === "tuple" && (name === "index" || name === "count"))) return new PyBuiltin(name, (a, kw) => this.method(o, name, a, kw, line));
    const sug = lists[tn] ? didYouMean(name, lists[tn]) : null;
    return this.err("AttributeError", `${cnType(o)}没有方法 ${name}。`, sug ? `你是不是想写 ${sug}？` : isNum(o) ? "数字没有方法；如果想把它变成文字，用 str(数字)。" : undefined, line);
  }

  // ----- methods -----
  method(o: Val, name: string, args: Val[], kw: Record<string, Val> | null, line: number): Val {
    const want = (min: number, max = min) => { if (args.length < min || args.length > max) this.err("TypeError", `${name}() 需要 ${min === max ? min : `${min} 到 ${max}`} 个参数，给了 ${args.length} 个。`, undefined, line); };
    const needStr = (v: Val, what = "参数") => { if (typeof v !== "string") this.err("TypeError", `${what}必须是文字，不能是${cnType(v)}。`, undefined, line); return v as string; };
    if (typeof o === "string") {
      switch (name) {
        case "upper": want(0); return o.toUpperCase();
        case "lower": want(0); return o.toLowerCase();
        case "capitalize": want(0); return o ? o[0].toUpperCase() + o.slice(1).toLowerCase() : o;
        case "title": want(0); return o.toLowerCase().replace(/(^|[^\p{L}'])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase());
        case "swapcase": want(0); return [...o].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join("");
        case "strip": case "lstrip": case "rstrip": {
          want(0, 1);
          const chars = args.length && args[0] !== null ? needStr(args[0]) : null;
          const inSet = (c: string) => (chars === null ? /\s/.test(c) : chars.includes(c));
          let a = 0, b = o.length;
          if (name !== "rstrip") while (a < b && inSet(o[a])) a++;
          if (name !== "lstrip") while (b > a && inSet(o[b - 1])) b--;
          return o.slice(a, b);
        }
        case "split": case "rsplit": {
          want(0, 2);
          const sepV = args.length ? args[0] : kw?.sep ?? null;
          const maxV = args.length > 1 ? args[1] : kw?.maxsplit;
          const max = maxV === undefined || maxV === null ? -1 : Number(big(maxV as bigint));
          if (sepV === null || sepV === undefined) {
            const parts = o.trim().split(/\s+/).filter((x) => x !== "");
            if (max >= 0 && parts.length > max + 1) { const t = o.trimStart(); let rest = t, out: string[] = []; for (let i = 0; i < max; i++) { const mm = /^(\S+)\s+/.exec(rest)!; out.push(mm[1]); rest = rest.slice(mm[0].length); } out.push(rest.trimEnd() === rest ? rest : rest); return new PyList(out); }
            return new PyList(parts);
          }
          const sep = needStr(sepV, "分隔符");
          if (sep === "") this.err("ValueError", "分隔符不能是空文字。", undefined, line);
          let parts = o.split(sep);
          if (max >= 0 && parts.length > max + 1) { if (name === "split") parts = [...parts.slice(0, max), parts.slice(max).join(sep)]; else parts = [parts.slice(0, parts.length - max).join(sep), ...parts.slice(parts.length - max)]; }
          return new PyList(parts);
        }
        case "splitlines": want(0); return new PyList(o === "" ? [] : o.replace(/\n$/, "").split("\n"));
        case "join": {
          want(1);
          const items = [...this.iterate(args[0], line)];
          for (const x of items) if (typeof x !== "string") this.err("TypeError", `join 只能连接文字，但列表里有${cnType(x)} ${repr(x)}。`, "先用 str() 把数字变成文字，例如 \",\".join([str(x) for x in nums])。", line);
          return items.join(o);
        }
        case "replace": {
          want(2, 3);
          const a = needStr(args[0]), b = needStr(args[1]);
          const cnt = args.length > 2 ? Number(big(args[2] as bigint)) : -1;
          if (cnt < 0) return a === "" ? [...o].join(b).length ? b + [...o].join(b) + b : b : o.split(a).join(b);
          let out = "", rest = o, k = 0;
          while (k < cnt) { const i = rest.indexOf(a); if (i < 0 || a === "") break; out += rest.slice(0, i) + b; rest = rest.slice(i + a.length); k++; }
          return out + rest;
        }
        case "find": case "rfind": case "index": {
          want(1, 3);
          const sub = needStr(args[0]);
          let st = args.length > 1 && args[1] !== null ? Number(big(args[1] as bigint)) : 0;
          let en = args.length > 2 && args[2] !== null ? Number(big(args[2] as bigint)) : o.length;
          if (st < 0) st = Math.max(0, st + o.length); if (en < 0) en += o.length;
          const seg = o.slice(0, en);
          const i = name === "rfind" ? seg.lastIndexOf(sub) : seg.indexOf(sub, st);
          if (name === "rfind" && i < st) return -1n;
          if (i < 0 && name === "index") this.err("ValueError", `文字里找不到 ${repr(sub)}。`, "find 找不到时返回 -1，不会报错。", line);
          return BigInt(i);
        }
        case "count": { want(1); const sub = needStr(args[0]); if (sub === "") return BigInt(o.length + 1); return BigInt(o.split(sub).length - 1); }
        case "startswith": case "endswith": {
          want(1);
          const subs = args[0] instanceof PyTuple ? args[0].a.map((x) => needStr(x)) : [needStr(args[0])];
          return subs.some((s) => (name === "startswith" ? o.startsWith(s) : o.endsWith(s)));
        }
        case "isdigit": case "isnumeric": want(0); return /^[0-9]+$/.test(o);
        case "isalpha": want(0); return o.length > 0 && /^\p{L}+$/u.test(o);
        case "isalnum": want(0); return o.length > 0 && /^[\p{L}\p{N}]+$/u.test(o);
        case "isspace": want(0); return o.length > 0 && /^\s+$/.test(o);
        case "isupper": want(0); return /\p{L}/u.test(o) && o === o.toUpperCase() && o !== o.toLowerCase();
        case "islower": want(0); return /\p{L}/u.test(o) && o === o.toLowerCase() && o !== o.toUpperCase();
        case "center": case "ljust": case "rjust": {
          want(1, 2);
          const w = Number(big(args[0] as bigint)), f = args.length > 1 ? needStr(args[1]) : " ";
          if (o.length >= w) return o;
          const n = w - o.length;
          if (name === "ljust") return o + f.repeat(n);
          if (name === "rjust") return f.repeat(n) + o;
          const l = Math.floor(n / 2) + (n % 2 && w % 2 ? 1 : 0);
          return f.repeat(n - l) + o + f.repeat(l);
        }
        case "zfill": { want(1); const w = Number(big(args[0] as bigint)); const sg = /^[+-]/.test(o) ? o[0] : ""; return sg + o.slice(sg.length).padStart(Math.max(0, w - sg.length), "0"); }
        case "partition": { want(1); const s = needStr(args[0]); const i = o.indexOf(s); return i < 0 ? new PyTuple([o, "", ""]) : new PyTuple([o.slice(0, i), s, o.slice(i + s.length)]); }
        case "format": {
          let auto = 0;
          return o.replace(/\{\{|\}\}|\{([^{}:!]*)(?:!([rs]))?(?::([^{}]*))?\}/g, (m, key: string, conv: string, spec: string) => {
            if (m === "{{") return "{"; if (m === "}}") return "}";
            let v: Val;
            if (key === "" || key === undefined) { if (auto >= args.length) this.err("IndexError", "format 的 {} 比给的值多。", undefined, line); v = args[auto++]; }
            else if (/^\d+$/.test(key)) { if (Number(key) >= args.length) this.err("IndexError", `format 里没有第 ${key} 个值。`, undefined, line); v = args[Number(key)]; }
            else { if (!kw || !(key in kw)) this.err("KeyError", `format 里没有名叫 ${key} 的值。`, undefined, line); v = kw![key]; }
            if (conv === "r") v = repr(v);
            return this.format(v, spec ?? "", line);
          });
        }
      }
    } else if (o instanceof PyList) {
      switch (name) {
        case "append": want(1); o.a.push(args[0]); return null;
        case "extend": want(1); o.a.push(...this.iterate(args[0], line)); return null;
        case "insert": { want(2); let i = Number(big(args[0] as bigint)); if (i < 0) i = Math.max(0, i + o.a.length); o.a.splice(Math.min(i, o.a.length), 0, args[1]); return null; }
        case "pop": {
          want(0, 1);
          if (!o.a.length) this.err("IndexError", "不能从空列表里 pop。", undefined, line);
          const i = args.length ? this.index(args[0], o.a.length, line, "列表") : o.a.length - 1;
          return o.a.splice(i, 1)[0];
        }
        case "remove": { want(1); const i = o.a.findIndex((x) => eq(x, args[0])); if (i < 0) this.err("ValueError", `列表里没有 ${repr(args[0])}，不能删除。`, "可以先用 in 检查它是否在列表里。", line); o.a.splice(i, 1); return null; }
        case "sort": { want(0); const key = kw?.key; const rev = kw?.reverse !== undefined && truthy(kw.reverse); o.a = this.sorted(o.a, key ?? null, rev, line); return null; }
        case "reverse": want(0); o.a.reverse(); return null;
        case "index": { want(1); const i = o.a.findIndex((x) => eq(x, args[0])); if (i < 0) this.err("ValueError", `列表里没有 ${repr(args[0])}。`, undefined, line); return BigInt(i); }
        case "count": want(1); return BigInt(o.a.filter((x) => eq(x, args[0])).length);
        case "copy": want(0); return new PyList([...o.a]);
        case "clear": want(0); o.a = []; return null;
      }
    } else if (o instanceof PyTuple) {
      if (name === "index") { want(1); const i = o.a.findIndex((x) => eq(x, args[0])); if (i < 0) this.err("ValueError", `元组里没有 ${repr(args[0])}。`, undefined, line); return BigInt(i); }
      if (name === "count") { want(1); return BigInt(o.a.filter((x) => eq(x, args[0])).length); }
    } else if (o instanceof PyDict) {
      switch (name) {
        case "get": { want(1, 2); const e = o.m.get(keyOf(args[0], line)); return e ? e[1] : args.length > 1 ? args[1] : null; }
        case "keys": want(0); return new PyList([...o.m.values()].map(([k]) => k));
        case "values": want(0); return new PyList([...o.m.values()].map(([, v]) => v));
        case "items": want(0); return new PyList([...o.m.values()].map(([k, v]) => new PyTuple([k, v])));
        case "pop": { want(1, 2); const kk = keyOf(args[0], line); const e = o.m.get(kk); if (!e) { if (args.length > 1) return args[1]; this.err("KeyError", `字典里没有键 ${repr(args[0])}。`, undefined, line); } o.m.delete(kk); return e![1]; }
        case "update": { want(1); const src = args[0]; if (src instanceof PyDict) for (const [kk, e] of src.m) o.m.set(kk, e); else this.err("TypeError", "update 需要另一个字典。", undefined, line); return null; }
        case "setdefault": { want(1, 2); const kk = keyOf(args[0], line); if (!o.m.has(kk)) o.m.set(kk, [args[0], args.length > 1 ? args[1] : null]); return o.m.get(kk)![1]; }
        case "copy": want(0); { const d = new PyDict(); for (const [kk, e] of o.m) d.m.set(kk, [...e]); return d; }
        case "clear": want(0); o.m.clear(); return null;
      }
    } else if (o instanceof PySet) {
      switch (name) {
        case "add": want(1); o.m.set(keyOf(args[0], line), args[0]); return null;
        case "remove": { want(1); const kk = keyOf(args[0], line); if (!o.m.has(kk)) this.err("KeyError", `集合里没有 ${repr(args[0])}。`, undefined, line); o.m.delete(kk); return null; }
        case "discard": want(1); o.m.delete(keyOf(args[0], line)); return null;
        case "copy": { want(0); const s = new PySet(); for (const [kk, v] of o.m) s.m.set(kk, v); return s; }
        case "clear": want(0); o.m.clear(); return null;
        case "union": case "intersection": case "difference": case "issubset": {
          want(1);
          const other = new PySet(); for (const x of this.iterate(args[0], line)) other.m.set(keyOf(x, line), x);
          if (name === "issubset") return [...o.m.keys()].every((kk) => other.m.has(kk));
          const r = new PySet();
          if (name === "union") { for (const [kk, v] of o.m) r.m.set(kk, v); for (const [kk, v] of other.m) r.m.set(kk, v); }
          else for (const [kk, v] of o.m) if (other.m.has(kk) === (name === "intersection")) r.m.set(kk, v);
          return r;
        }
      }
    }
    return this.getAttr(o, name, line) as never;
  }
  sorted(a: Val[], key: Val | null, reverse: boolean, line: number): Val[] {
    const pairs = a.map((v, i) => ({ v, k: key !== null ? this.callValue(key, [v], null, line) : v, i }));
    // Python keeps equal elements in their original order, also with reverse=True
    pairs.sort((x, y) => { const c = cmp(x.k, y.k, "<", line); return (reverse ? -c : c) || x.i - y.i; });
    return pairs.map((p) => p.v);
  }

  // ----- modules, builtins -----
  module(name: string, line: number): PyModule {
    const m = this.modules.get(name);
    if (m) return m;
    const sug = didYouMean(name, [...this.modules.keys()]);
    return this.err("NameError", `没有名叫 ${name} 的模块。`, `这里可以用的模块：${[...this.modules.keys()].join("、")}。${sug ? `你是不是想写 ${sug}？` : ""}`, line);
  }
  toInt(v: Val, base?: Val): bigint {
    if (isInt(v)) return big(v);
    if (typeof v === "number") {
      if (!Number.isFinite(v)) this.err("ValueError", "无穷大或 nan 不能变成整数。");
      return BigInt(Math.trunc(v));
    }
    if (typeof v === "string") {
      const b = base === undefined ? 10 : Number(big(base as bigint));
      const t = v.trim().replace(/_/g, "");
      const ok = b === 10 ? /^[+-]?\d+$/.test(t) : new RegExp(`^[+-]?[${"0123456789abcdefghijklmnopqrstuvwxyz".slice(0, b)}]+$`, "i").test(t);
      if (!ok) this.err("ValueError", `无法把 ${repr(v)} 变成整数。`, /^[+-]?\d*\.\d+$/.test(t) ? "带小数点的文字要先用 float()，再用 int()。" : "int() 只能转换由数字组成的文字，例如 \"12\"。input() 读到的内容可能带有空格或字母。");
      const neg = t.startsWith("-");
      const digits = t.replace(/^[+-]/, "");
      return b === 10 ? (neg ? -BigInt(digits) : BigInt(digits)) : [...digits.toLowerCase()].reduce((acc, d) => acc * BigInt(b) + BigInt(parseInt(d, 36)), 0n) * (neg ? -1n : 1n);
    }
    return this.err("TypeError", `int() 不能转换${cnType(v)}。`, undefined);
  }
  toFloat(v: Val): number {
    if (isNum(v)) return flt(v);
    if (typeof v === "string") {
      const t = v.trim().replace(/_/g, "");
      if (/^[+-]?(inf|infinity)$/i.test(t)) return t.startsWith("-") ? -Infinity : Infinity;
      if (/^[+-]?nan$/i.test(t)) return NaN;
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) this.err("ValueError", `无法把 ${repr(v)} 变成小数。`, "float() 只能转换数字形式的文字，例如 \"3.14\"。");
      return Number(t);
    }
    return this.err("TypeError", `float() 不能转换${cnType(v)}。`);
  }
  pyRound(x: Val, nd: Val | undefined): Val {
    if (nd === undefined || nd === null) {
      if (isInt(x)) return big(x);
      const f = flt(x as number);
      if (!Number.isFinite(f)) this.err("ValueError", "无穷大或 nan 不能取整。");
      const r = Math.round(f);
      return BigInt(Math.abs(f % 1) === 0.5 ? 2 * Math.round(f / 2) : r);
    }
    const n = Number(big(nd as bigint));
    if (isInt(x)) { if (n >= 0) return big(x); const m = 10n ** BigInt(-n); const v = big(x); let q = v / m, r = v % m; if (r < 0n) { q -= 1n; r += m; } if (r * 2n > m || (r * 2n === m && q % 2n === 1n)) q += 1n; return q * m; }
    const f = flt(x as number);
    if (!Number.isFinite(f)) return f;
    if (n >= 0) return Number(toFixedExact(f, n));
    const m = Math.pow(10, -n); return Math.round(f / m) * m;
  }
  setupBuiltins() {
    const B = (name: string, fn: (a: Val[], kw: Record<string, Val> | null) => Val) => this.builtins.set(name, new PyBuiltin(name, fn));
    const need = (name: string, a: Val[], min: number, max = min) => { if (a.length < min || a.length > max) this.err("TypeError", `${name}() 需要 ${min === max ? min : `${min} 到 ${max}`} 个参数，给了 ${a.length} 个。`); };
    B("print", (a, kw) => {
      const sep = kw?.sep === undefined || kw.sep === null ? " " : str(kw.sep), end = kw?.end === undefined || kw.end === null ? "\n" : str(kw.end);
      this.write(a.map(str).join(sep) + end); return null;
    });
    B("input", (a) => {
      need("input", a, 0, 1);
      if (a.length) this.write(str(a[0]));
      if (this.inputPos >= this.inputLines.length) this.err("EOFError", "程序在等待输入，但已经没有更多的输入了。", "请在“输入”框里填写数据，每行对应一次 input()。");
      return this.inputLines[this.inputPos++];
    });
    B("len", (a) => {
      need("len", a, 1);
      const v = a[0];
      if (typeof v === "string") return BigInt(v.length);
      if (v instanceof PyList || v instanceof PyTuple) return BigInt(v.a.length);
      if (v instanceof PyDict || v instanceof PySet) return BigInt(v.m.size);
      if (v instanceof PyRange) return BigInt(v.len);
      return this.err("TypeError", `${cnType(v)}没有长度，不能用 len()。`, isNum(v) ? "len() 只能用于文字、列表、字典等。数字的位数可以用 len(str(n))。" : undefined);
    });
    B("range", (a) => {
      need("range", a, 1, 3);
      for (const x of a) if (!isInt(x)) this.err("TypeError", `range() 的参数必须是整数，不能是${cnType(x)}。`, typeof x === "number" ? "小数要先用 int() 变成整数。" : undefined);
      const v = a.map((x) => big(x as bigint));
      const st = v.length > 2 ? v[2] : 1n;
      if (st === 0n) this.err("ValueError", "range() 的步长不能是 0。");
      return v.length === 1 ? new PyRange(0n, v[0], 1n) : new PyRange(v[0], v[1], st);
    });
    B("int", (a) => { need("int", a, 0, 2); return a.length ? this.toInt(a[0], a[1]) : 0n; });
    B("float", (a) => { need("float", a, 0, 1); return a.length ? this.toFloat(a[0]) : 0; });
    B("str", (a) => { need("str", a, 0, 1); return a.length ? str(a[0]) : ""; });
    B("bool", (a) => { need("bool", a, 0, 1); return a.length ? truthy(a[0]) : false; });
    B("list", (a) => { need("list", a, 0, 1); return new PyList(a.length ? [...this.iterate(a[0], this.line)] : []); });
    B("tuple", (a) => { need("tuple", a, 0, 1); return new PyTuple(a.length ? [...this.iterate(a[0], this.line)] : []); });
    B("set", (a) => { need("set", a, 0, 1); const s = new PySet(); if (a.length) for (const x of this.iterate(a[0], this.line)) s.m.set(keyOf(x, this.line), x); return s; });
    B("dict", (a, kw) => {
      const d = new PyDict();
      if (a.length) for (const p of this.iterate(a[0], this.line)) { const kv = [...this.iterate(p, this.line)]; d.m.set(keyOf(kv[0], this.line), [kv[0], kv[1]]); }
      if (kw) for (const [k, v] of Object.entries(kw)) d.m.set("s" + k, [k, v]);
      return d;
    });
    B("abs", (a) => { need("abs", a, 1); const v = a[0]; if (!isNum(v)) this.err("TypeError", `abs() 需要数字，不能是${cnType(v)}。`); return typeof v === "number" ? Math.abs(v) : big(v as bigint | boolean) < 0n ? -big(v as bigint | boolean) : big(v as bigint | boolean); });
    const minmax = (name: "min" | "max") => (a: Val[], kw: Record<string, Val> | null): Val => {
      const items = a.length === 1 ? [...this.iterate(a[0], this.line)] : a;
      if (!items.length) { if (kw && "default" in kw) return kw.default; this.err("ValueError", `${name}() 的参数是空的，没有${name === "min" ? "最小" : "最大"}值。`); }
      const key = kw?.key ?? null;
      let best = items[0], bk = key ? this.callValue(key, [best], null, this.line) : best;
      for (let i = 1; i < items.length; i++) {
        const k = key ? this.callValue(key, [items[i]], null, this.line) : items[i];
        const c = cmp(k, bk, name === "min" ? "<" : ">", this.line);
        if (name === "min" ? c < 0 : c > 0) { best = items[i]; bk = k; }
      }
      return best;
    };
    B("min", minmax("min")); B("max", minmax("max"));
    B("sum", (a, kw) => {
      need("sum", a, 1, 2);
      let acc: Val = a.length > 1 ? a[1] : kw?.start ?? 0n;
      let fm = false, f = 0, c = 0;   // CPython 3.12+: floats are added with compensated (Neumaier) summation
      for (const x of this.iterate(a[0], this.line)) {
        if (!fm && typeof x === "number" && isNum(acc)) { fm = true; f = flt(acc as number); c = 0; }
        if (fm) {
          if (isNum(x)) {
            const v = flt(x as number), t = f + v;
            if (Number.isFinite(t)) { if (Math.abs(f) >= Math.abs(v)) c += (f - t) + v; else c += (v - t) + f; }
            f = t; continue;
          }
          acc = Number.isFinite(c) && c !== 0 && Number.isFinite(f) ? f + c : f; fm = false;
        }
        acc = this.binop("+", acc, x, this.line, false);
      }
      return fm ? (Number.isFinite(c) && c !== 0 && Number.isFinite(f) ? f + c : f) : acc;
    });
    B("sorted", (a, kw) => { need("sorted", a, 1); return new PyList(this.sorted([...this.iterate(a[0], this.line)], kw?.key ?? null, kw?.reverse !== undefined && truthy(kw.reverse), this.line)); });
    B("reversed", (a) => { need("reversed", a, 1); return new PyList([...this.iterate(a[0], this.line)].reverse()); });
    B("enumerate", (a, kw) => { need("enumerate", a, 1, 2); const st = a.length > 1 ? big(a[1] as bigint) : kw?.start !== undefined ? big(kw.start as bigint) : 0n; return new PyList([...this.iterate(a[0], this.line)].map((x, i) => new PyTuple([st + BigInt(i), x]))); });
    B("zip", (a) => { const ls = a.map((x) => [...this.iterate(x, this.line)]); const n = ls.length ? Math.min(...ls.map((l) => l.length)) : 0; return new PyList(Array.from({ length: n }, (_, i) => new PyTuple(ls.map((l) => l[i])))); });
    B("map", (a) => { need("map", a, 2, 3); const ls = a.slice(1).map((x) => [...this.iterate(x, this.line)]); const n = Math.min(...ls.map((l) => l.length)); return new PyList(Array.from({ length: n }, (_, i) => this.callValue(a[0], ls.map((l) => l[i]), null, this.line))); });
    B("filter", (a) => { need("filter", a, 2); return new PyList([...this.iterate(a[1], this.line)].filter((x) => truthy(a[0] === null ? x : this.callValue(a[0], [x], null, this.line)))); });
    B("any", (a) => { need("any", a, 1); for (const x of this.iterate(a[0], this.line)) if (truthy(x)) return true; return false; });
    B("all", (a) => { need("all", a, 1); for (const x of this.iterate(a[0], this.line)) if (!truthy(x)) return false; return true; });
    B("round", (a) => { need("round", a, 1, 2); if (!isNum(a[0])) this.err("TypeError", `round() 需要数字，不能是${cnType(a[0])}。`); return this.pyRound(a[0], a[1]); });
    B("pow", (a) => { need("pow", a, 2, 3); if (a.length === 3) { let r = 1n, b = big(a[0] as bigint) % big(a[2] as bigint), e = big(a[1] as bigint); const m = big(a[2] as bigint); while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; } return this.binop("**", a[0], a[1], this.line, false); });
    B("divmod", (a) => { need("divmod", a, 2); return new PyTuple([this.binop("//", a[0], a[1], this.line, false), this.binop("%", a[0], a[1], this.line, false)]); });
    B("ord", (a) => { need("ord", a, 1); if (typeof a[0] !== "string" || [...a[0]].length !== 1) this.err("TypeError", "ord() 需要一个字符。"); return BigInt((a[0] as string).codePointAt(0)!); });
    B("chr", (a) => { need("chr", a, 1); const n = Number(big(a[0] as bigint)); if (n < 0 || n > 0x10ffff) this.err("ValueError", "chr() 的参数超出范围。"); return String.fromCodePoint(n); });
    B("repr", (a) => { need("repr", a, 1); return repr(a[0]); });
    B("format", (a) => { need("format", a, 1, 2); return this.format(a[0], a.length > 1 ? str(a[1]) : "", this.line); });
    B("bin", (a) => { const v = big(a[0] as bigint); return (v < 0n ? "-0b" : "0b") + (v < 0n ? -v : v).toString(2); });
    B("hex", (a) => { const v = big(a[0] as bigint); return (v < 0n ? "-0x" : "0x") + (v < 0n ? -v : v).toString(16); });
    B("isinstance", (a) => {
      need("isinstance", a, 2);
      const names = (a[1] instanceof PyTuple ? a[1].a : [a[1]]).map((x) => (x instanceof PyBuiltin ? x.name : ""));
      const tn = typeName(a[0]);
      return names.some((n) => n === tn || (n === "int" && tn === "bool") || (n === "float" && false));
    });
    const types = new Map<string, PyBuiltin>();
    for (const n of ["int", "float", "str", "bool", "list", "tuple", "dict", "set"]) types.set(n, this.builtins.get(n) as PyBuiltin);
    B("type", (a) => { need("type", a, 1); return types.get(typeName(a[0])) ?? new PyBuiltin(typeName(a[0]), () => null); });
    this.builtins.set("__name__", "__main__");

    // ----- math -----
    const mathFn = (name: string, f: (x: number) => number, dom?: (x: number) => boolean) => new PyBuiltin(name, (a) => {
      need(`math.${name}`, a, 1);
      if (!isNum(a[0])) this.err("TypeError", `math.${name}() 需要数字，不能是${cnType(a[0])}。`);
      const x = flt(a[0]); if (dom && !dom(x)) this.err("ValueError", `math.${name}(${floatRepr(x)}) 的参数不在允许的范围内。`);
      return f(x);
    });
    const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };
    this.modules.set("math", new PyModule("math", {
      pi: Math.PI, e: Math.E, inf: Infinity, nan: NaN, tau: 2 * Math.PI,
      sqrt: mathFn("sqrt", Math.sqrt, (x) => x >= 0), sin: mathFn("sin", Math.sin), cos: mathFn("cos", Math.cos), tan: mathFn("tan", Math.tan),
      radians: mathFn("radians", (x) => (x * Math.PI) / 180), degrees: mathFn("degrees", (x) => (x * 180) / Math.PI),
      log10: mathFn("log10", Math.log10, (x) => x > 0), log2: mathFn("log2", Math.log2, (x) => x > 0), exp: mathFn("exp", Math.exp), fabs: mathFn("fabs", Math.abs),
      atan: mathFn("atan", Math.atan), asin: mathFn("asin", Math.asin, (x) => Math.abs(x) <= 1), acos: mathFn("acos", Math.acos, (x) => Math.abs(x) <= 1),
      log: new PyBuiltin("log", (a) => { need("math.log", a, 1, 2); const x = flt(a[0] as number); if (x <= 0) this.err("ValueError", "math.log() 的参数必须大于 0。"); return a.length > 1 ? Math.log(x) / Math.log(flt(a[1] as number)) : Math.log(x); }),
      floor: new PyBuiltin("floor", (a) => { need("math.floor", a, 1); return isInt(a[0]) ? big(a[0]) : BigInt(Math.floor(flt(a[0] as number))); }),
      ceil: new PyBuiltin("ceil", (a) => { need("math.ceil", a, 1); return isInt(a[0]) ? big(a[0]) : BigInt(Math.ceil(flt(a[0] as number))); }),
      trunc: new PyBuiltin("trunc", (a) => { need("math.trunc", a, 1); return isInt(a[0]) ? big(a[0]) : BigInt(Math.trunc(flt(a[0] as number))); }),
      pow: new PyBuiltin("pow", (a) => { need("math.pow", a, 2); return Math.pow(flt(a[0] as number), flt(a[1] as number)); }),
      hypot: new PyBuiltin("hypot", (a) => Math.hypot(...a.map((x) => flt(x as number)))),
      gcd: new PyBuiltin("gcd", (a) => a.reduce((acc: bigint, x) => gcd(acc, big(x as bigint)), 0n)),
      lcm: new PyBuiltin("lcm", (a) => a.reduce((acc: bigint, x) => { const y = big(x as bigint); return acc === 0n || y === 0n ? 0n : (acc * y < 0n ? -(acc * y) : acc * y) / gcd(acc, y); }, 1n)),
      isqrt: new PyBuiltin("isqrt", (a) => { const n = big(a[0] as bigint); if (n < 0n) this.err("ValueError", "isqrt() 的参数不能是负数。"); let x = BigInt(Math.floor(Math.sqrt(Number(n)))); while (x * x > n) x--; while ((x + 1n) * (x + 1n) <= n) x++; return x; }),
      factorial: new PyBuiltin("factorial", (a) => { const n = big(a[0] as bigint); if (n < 0n) this.err("ValueError", "factorial() 的参数不能是负数。"); if (n > 3000n) this.err("OverflowError", "阶乘的结果太大了。"); let r = 1n; for (let i = 2n; i <= n; i++) r *= i; return r; }),
      isclose: new PyBuiltin("isclose", (a, kw) => { const x = flt(a[0] as number), y = flt(a[1] as number); const rt = kw?.rel_tol !== undefined ? flt(kw.rel_tol as number) : 1e-9, at = kw?.abs_tol !== undefined ? flt(kw.abs_tol as number) : 0; return Math.abs(x - y) <= Math.max(rt * Math.max(Math.abs(x), Math.abs(y)), at); }),
    }));

    // ----- random (CPython's algorithms) -----
    const rnd = (name: string, f: (a: Val[], kw: Record<string, Val> | null) => Val) => new PyBuiltin(name, f);
    const below = (n: bigint) => this.rng.below(n);
    const randrange = (a: Val[]): bigint => {
      const v = a.map((x) => { if (!isInt(x)) this.err("TypeError", `random 的参数必须是整数，不能是${cnType(x)}。`, "小数请先用 int() 变成整数。"); return big(x as bigint); });
      const [start, stop, step] = v.length === 1 ? [0n, v[0], 1n] : [v[0], v[1], v.length > 2 ? v[2] : 1n];
      if (step === 0n) this.err("ValueError", "步长不能是 0。");
      const width = stop - start;
      const n = step > 0n ? (width + step - 1n) / step : (width + step + 1n) / step;
      if (n <= 0n) this.err("ValueError", "randrange 的范围是空的。");
      return start + step * below(n);
    };
    const seqOf = (v: Val): Val[] => (v instanceof PyList || v instanceof PyTuple ? v.a : typeof v === "string" ? [...v] : this.err("TypeError", `需要列表或文字，不能是${cnType(v)}。`));
    this.modules.set("random", new PyModule("random", {
      seed: rnd("seed", (a) => { this.rng.seed(a.length && a[0] !== null ? (isInt(a[0]) ? big(a[0]) : BigInt(Math.trunc(flt(a[0] as number)))) : 1n); return null; }),
      random: rnd("random", () => this.rng.random()),
      randint: rnd("randint", (a) => { need("random.randint", a, 2); const lo = big(a[0] as bigint), hi = big(a[1] as bigint); if (hi < lo) this.err("ValueError", `randint(${lo}, ${hi})：第一个数不能比第二个数大。`); return lo + below(hi - lo + 1n); }),
      randrange: rnd("randrange", (a) => { need("random.randrange", a, 1, 3); return randrange(a); }),
      uniform: rnd("uniform", (a) => { need("random.uniform", a, 2); const x = flt(a[0] as number), y = flt(a[1] as number); return x + (y - x) * this.rng.random(); }),
      choice: rnd("choice", (a) => { need("random.choice", a, 1); const s = seqOf(a[0]); if (!s.length) this.err("IndexError", "不能从空的序列里选。"); return s[Number(below(BigInt(s.length)))]; }),
      shuffle: rnd("shuffle", (a) => { need("random.shuffle", a, 1); if (!(a[0] instanceof PyList)) this.err("TypeError", "shuffle 需要一个列表。"); const x = (a[0] as PyList).a; for (let i = x.length - 1; i >= 1; i--) { const j = Number(below(BigInt(i + 1))); [x[i], x[j]] = [x[j], x[i]]; } return null; }),
      sample: rnd("sample", (a) => {
        need("random.sample", a, 2);
        const pop = seqOf(a[0]), n = pop.length, k = Number(big(a[1] as bigint));
        if (k < 0 || k > n) this.err("ValueError", "sample 的个数超出范围。");
        const res: Val[] = new Array(k);
        let setsize = 21; if (k > 5) setsize += Math.pow(4, Math.ceil(Math.log(k * 3) / Math.log(4)));
        if (n <= setsize) { const pool = [...pop]; for (let i = 0; i < k; i++) { const j = Number(below(BigInt(n - i))); res[i] = pool[j]; pool[j] = pool[n - i - 1]; } }
        else { const sel = new Set<number>(); for (let i = 0; i < k; i++) { let j = Number(below(BigInt(n))); while (sel.has(j)) j = Number(below(BigInt(n))); sel.add(j); res[i] = pop[j]; } }
        return new PyList(res);
      }),
    }));

    // ----- turtle -----
    const tn = (name: string, f: (a: Val[]) => Val) => new PyBuiltin(name, (a) => { this.t.used = true; return f(a); });
    const num1 = (name: string, a: Val[]): number => { if (a.length < 1 || !isNum(a[0])) this.err("TypeError", `${name}() 需要一个数字。`, `例如 ${name}(50)。`); return flt(a[0] as number); };
    const go = (d: number) => { const t = this.t; const nx = t.x + d * Math.cos((t.h * Math.PI) / 180), ny = t.y + d * Math.sin((t.h * Math.PI) / 180); this.moveTo(nx, ny); };
    const col = (a: Val[]): string => {
      const c = a[0];
      if (typeof c !== "string") this.err("TypeError", "颜色要写成文字，例如 \"red\"。");
      const s = (c as string).toLowerCase();
      if (/^#[0-9a-f]{6}$/.test(s)) return s;
      if (TCOLORS[s]) return TCOLORS[s];
      if (TCOLOR_EXTRA[s]) return TCOLOR_EXTRA[s];
      return this.err("ValueError", `不认识的颜色 ${repr(c)}。`, "可以用：black、red、orange、yellow、green、blue、purple、pink、brown、gray，或 \"#rrggbb\"。");
    };
    const noop = (name: string) => tn(name, () => null);
    const T: Record<string, Val> = {
      forward: tn("forward", (a) => { go(num1("forward", a)); return null; }),
      backward: tn("backward", (a) => { go(-num1("backward", a)); return null; }),
      left: tn("left", (a) => { this.t.h += num1("left", a); return null; }),
      right: tn("right", (a) => { this.t.h -= num1("right", a); return null; }),
      penup: tn("penup", () => { this.t.pen = false; return null; }),
      pendown: tn("pendown", () => { this.t.pen = true; return null; }),
      isdown: tn("isdown", () => this.t.pen),
      color: tn("color", (a) => { if (a.length) { const c = col(a); this.t.color = c; this.t.fill = a.length > 1 ? col([a[1]]) : c; } return null; }),
      pencolor: tn("pencolor", (a) => { this.t.color = col(a); return null; }),
      fillcolor: tn("fillcolor", (a) => { this.t.fill = col(a); return null; }),
      goto: tn("goto", (a) => { const [x, y] = a.length === 1 && a[0] instanceof PyTuple ? a[0].a : a; this.moveTo(flt(x as number), flt(y as number)); return null; }),
      setheading: tn("setheading", (a) => { this.t.h = num1("setheading", a); return null; }),
      home: tn("home", () => { this.moveTo(0, 0); this.t.h = 0; return null; }),
      setx: tn("setx", (a) => { this.moveTo(num1("setx", a), this.t.y); return null; }),
      sety: tn("sety", (a) => { this.moveTo(this.t.x, num1("sety", a)); return null; }),
      xcor: tn("xcor", () => this.t.x), ycor: tn("ycor", () => this.t.y), heading: tn("heading", () => ((this.t.h % 360) + 360) % 360),
      dot: tn("dot", () => { const t = this.t; if (t.pen) this.segs.push({ x1: t.x, y1: -t.y, x2: t.x + 0.01, y2: -t.y, c: t.color }); return null; }),
      circle: tn("circle", (a) => {
        const r = num1("circle", a);
        const extent = a.length > 1 && a[1] !== null ? flt(a[1] as number) : 360;
        const frac = Math.abs(extent) / 360;
        const steps = a.length > 2 && a[2] !== null ? Number(big(a[2] as bigint)) : 1 + Math.floor(Math.min(11 + Math.abs(r) / 6, 59) * frac);
        let w = extent / steps, w2 = 0.5 * w, l = 2 * r * Math.sin((w2 * Math.PI) / 180);
        if (r < 0) { l = -l; w = -w; w2 = -w2; }
        this.t.h += w2;
        for (let i = 0; i < steps; i++) { go(l); this.t.h += w; }
        this.t.h -= w2;
        return null;
      }),
      begin_fill: tn("begin_fill", () => { this.t.filling = [[this.t.x, -this.t.y]]; return null; }),
      end_fill: tn("end_fill", () => { const t = this.t; if (t.filling && t.filling.length > 2) this.fills.push({ pts: t.filling, c: t.fill }); t.filling = null; return null; }),
    };
    const alias = (n: string, to: string) => { T[n] = T[to]; };
    alias("fd", "forward"); alias("bk", "backward"); alias("back", "backward"); alias("lt", "left"); alias("rt", "right"); alias("up", "penup"); alias("pu", "penup");
    alias("down", "pendown"); alias("pd", "pendown"); alias("seth", "setheading"); alias("setpos", "goto"); alias("setposition", "goto"); alias("pos", "xcor");
    for (const n of ["speed", "hideturtle", "ht", "showturtle", "st", "pensize", "width", "shape", "tracer", "update", "done", "mainloop", "exitonclick", "bgcolor", "title", "setup", "clear", "reset", "colormode", "delay", "write", "shapesize", "turtlesize"]) T[n] = noop(n);
    const screenObj = new PyModule("Screen", Object.fromEntries(["bgcolor", "exitonclick", "tracer", "setup", "title", "update", "mainloop", "done", "colormode", "delay", "bgpic"].map((n) => [n, noop(n)])));
    T.Screen = tn("Screen", () => screenObj);
    const turtleObj = new PyModule("Turtle", T);
    T.Turtle = tn("Turtle", () => turtleObj);
    this.modules.set("turtle", new PyModule("turtle", T));
  }
  moveTo(nx: number, ny: number) {
    const t = this.t;
    if (t.pen) this.segs.push({ x1: t.x, y1: -t.y, x2: nx, y2: -ny, c: t.color });
    t.x = nx; t.y = ny;
    if (t.filling) t.filling.push([nx, -ny]);
  }
}

/** parses and runs a program: stdout, the error (if any), the drawn segments, the trace (when asked) */
export function run(source: string, opts: RunOptions = {}): RunResult {
  let prog: Stmt[];
  const bare = (): RunResult => ({ stdout: "", error: null, segs: [], fills: [], steps: 0, trace: [], traceCut: false, globals: [], usedTurtle: false });
  try { prog = parseProgram(source); } catch (e) {
    if (e instanceof PyError) return { ...bare(), error: e };
    throw e;
  }
  const blank = /(^|[^\p{L}\p{N}_])___+(?![\p{L}\p{N}_])/u.exec(source.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n"));
  if (blank) {
    const ln = source.split("\n").findIndex((l) => !l.trim().startsWith("#") && /(^|[^\p{L}\p{N}_])___+(?![\p{L}\p{N}_])/u.test(l)) + 1;
    return { ...bare(), error: new PyError("BlankError", `第 ${ln} 行：这里还有空白 ___ 需要补上。`, ln, "把 ___ 换成你的代码。") };
  }
  const it = new Interp(opts);
  let error: PyError | null = null;
  try { it.execBlock(prog); } catch (e) {
    if (e instanceof PyError) error = e;
    else if (e instanceof RangeError) error = new PyError("RecursionError", `第 ${it.line} 行：函数调用得太深了。`, it.line, "递归函数必须有结束的条件。");
    else throw e;
  }
  const globals: [string, string][] = [];
  for (const [k, v] of it.root.vars) { if (v instanceof PyFunc || v instanceof PyBuiltin || v instanceof PyModule) continue; globals.push([k, repr(v)]); }
  return { stdout: it.out, error, segs: it.segs, fills: it.fills, steps: it.steps, trace: it.trace, traceCut: it.traceCut, globals, usedTurtle: it.t.used };
}
