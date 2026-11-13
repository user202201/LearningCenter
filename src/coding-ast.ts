/**
 * 编程 (coding): the program of a child as data. A program is `{ main, funcs }`; a block is a plain object (`Blk`) with an id (the editor and the
 * interpreter use it to light the block that runs). Pure: no screens, no storage. The same data is
 *  - drawn as blocks by coding-editor.ts,
 *  - run by coding-interp.ts,
 *  - written as pseudo-code by `toText` and read back by `parse` (the syntax of the level files and the bridge to text coding in a later phase).
 */
export type BlockKind = "move" | "left" | "right" | "take" | "light" | "fd" | "tl" | "tr" | "penup" | "pendown" | "color" | "repeat" | "until" | "while" | "if" | "call" | "set" | "change"
  // phase 2, blocks of worlds 7-10: loops, waiting, results, lists, a stage with sprites (see docs/coding-curriculum.md)
  | "forever" | "for" | "each" | "wait" | "waitUntil" | "return" | "push" | "lset" | "lremove" | "swap" | "lclear"
  | "smove" | "sturn" | "goto" | "changex" | "changey" | "say" | "sayfor" | "costume" | "nextcostume" | "size" | "show" | "hide" | "note" | "broadcast";
/** all the statement kinds of the extension (the editor groups them in tabs) */
export const EXT_KINDS: BlockKind[] = ["forever", "for", "each", "wait", "waitUntil", "return", "push", "lset", "lremove", "swap", "lclear", "smove", "sturn", "goto", "changex", "changey", "say", "sayfor", "costume", "nextcostume", "size", "show", "hide", "note", "broadcast"];
/** what the palette offers: the kinds above plus "ifelse" (an `if` that has an else part) */
export type PaletteKind = BlockKind | "ifelse";
export type Sense = "pathAhead" | "pathLeft" | "pathRight" | "starHere" | "onFlag" | "lightHere" | "colorIs";
export const SENSES: Sense[] = ["pathAhead", "pathLeft", "pathRight", "starHere", "onFlag", "lightHere", "colorIs"];
export type CmpOp = "<" | "<=" | ">" | ">=" | "==" | "!=";
/** reporters over a list: len(xs) sum(xs) max(xs) min(xs) has(xs, x) count(xs, x) indexOf(xs, x) item(xs, i) (items are numbered from 1) */
export type ListFn = "len" | "sum" | "max" | "min" | "has" | "count" | "indexOf" | "item";
export const LIST_FNS: ListFn[] = ["len", "sum", "max", "min", "has", "count", "indexOf", "item"];
export const LIST_ARITY: Record<ListFn, number> = { len: 1, sum: 1, max: 1, min: 1, has: 2, count: 2, indexOf: 2, item: 2 };
/** number reporters: floor(x) abs(x) sqrt(x) round(x) rand(a, b) minOf(a, b) maxOf(a, b) deg(node) nbr(node, k) heavier(i, j) */
export type FnName = "floor" | "abs" | "sqrt" | "round" | "rand" | "minOf" | "maxOf" | "deg" | "nbr" | "heavier";
export const FN_ARITY: Record<FnName, number> = { floor: 1, abs: 1, sqrt: 1, round: 1, rand: 2, minOf: 2, maxOf: 2, deg: 1, nbr: 2, heavier: 2 };
export const FN_NAMES = Object.keys(FN_ARITY) as FnName[];
/** reporters without arguments: where the sprite is, the number on the floor, where the stage was tapped */
export type MeProp = "myX" | "myY" | "mySize" | "myCostume" | "myDir" | "floorNum" | "tapX" | "tapY";
export const ME_PROPS: MeProp[] = ["myX", "myY", "mySize", "myCostume", "myDir", "floorNum", "tapX", "tapY"];
export type Expr =
  | { k: "n"; v: number }
  | { k: "v"; name: string }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "%"; a: Expr; b: Expr }
  | { k: "cmp"; op: CmpOp; a: Expr; b: Expr }
  | { k: "sense"; s: Sense; c?: string }
  | { k: "not"; a: Expr }
  | { k: "logic"; op: "and" | "or"; a: Expr; b: Expr }
  | { k: "call"; name: string; args: Expr[] }
  | { k: "list"; f: ListFn; list: string; a?: Expr }
  | { k: "fn"; f: FnName; args: Expr[] }
  | { k: "touch"; s: string }
  | { k: "keyDown"; key: string }
  | { k: "me"; p: MeProp };

export interface Blk {
  id: string;
  t: BlockKind;
  /** repeat count / forward length / turn angle */
  n?: Expr;
  /** until / while / if */
  cond?: Expr;
  /** the inner blocks (repeat, until, while, if = the "then" part) */
  body?: Blk[];
  /** the "else" part of an if */
  els?: Blk[];
  /** call: the function's name; set / change: the variable */
  name?: string;
  /** call: the argument (one argument), `args` when there are several */
  arg?: Expr;
  args?: Expr[];
  /** the list a list block works on (for each, add, ...) */
  list?: string;
  /** set: the value; change: the amount added */
  e?: Expr;
  /** colour name */
  c?: string;
}
/** a function has one parameter (`param`, as in phase 1) or several (`params`) */
export interface Func { name: string; param?: string; params?: string[]; body: Blk[] }
export const paramsOf = (f: { param?: string; params?: string[] }): string[] => f.params ?? (f.param ? [f.param] : []);
/** a script of a sprite that starts with an event: "start", "tap", "stagetap", "key(left)", "recv(go)" */
export interface Script { sprite: string; on: string; body: Blk[] }
export interface Program { main: Blk[]; funcs: Func[]; scripts?: Script[] }

export const num = (v: number): Expr => ({ k: "n", v });
export const emptyProgram = (funcs: { name: string; param?: string; params?: string[] }[] = []): Program => ({ main: [], funcs: funcs.map((f) => ({ name: f.name, ...(f.params ? { params: f.params } : { param: f.param }), body: [] })) });

let counter = 0;
export const newId = (): string => `b${++counter}`;

/** how many inner block lists a block has */
export const slotsOf = (b: Blk): Blk[][] => [b.body, b.els].filter((x): x is Blk[] => Array.isArray(x));
export function walk(list: Blk[], f: (b: Blk, parent: Blk[], i: number) => void): void {
  list.forEach((b, i) => { f(b, list, i); for (const s of slotsOf(b)) walk(s, f); });
}
export const allLists = (p: Program): Blk[][] => [p.main, ...p.funcs.map((f) => f.body), ...(p.scripts ?? []).map((s) => s.body)];
export function countBlocks(p: Program): number { let n = 0; for (const l of allLists(p)) walk(l, () => n++); return n; }
export const countList = (l: Blk[]): number => { let n = 0; walk(l, () => n++); return n; };

/** a deep copy; `fresh` gives every block a new id */
export function cloneBlk(b: Blk, fresh = true): Blk {
  const c: Blk = JSON.parse(JSON.stringify(b));
  if (fresh) walk([c], (x) => { x.id = newId(); });
  return c;
}
export function cloneProgram(p: Program, fresh = false): Program {
  const c: Program = JSON.parse(JSON.stringify(p));
  if (fresh) for (const l of allLists(c)) walk(l, (x) => { x.id = newId(); });
  return c;
}
/** the program without ids (to compare two programs by shape) */
export function shape(p: Program): string {
  return JSON.stringify(p, (k, v) => (k === "id" ? undefined : v));
}
export function findBlock(p: Program, id: string): Blk | null {
  let r: Blk | null = null;
  for (const l of allLists(p)) walk(l, (b) => { if (b.id === id) r = b; });
  return r;
}

// ---------- pseudo-code (toText) ----------
const PREC: Record<string, number> = { or: 1, and: 2, "==": 3, "!=": 3, "<": 3, "<=": 3, ">": 3, ">=": 3, "+": 4, "-": 4, "*": 5, "/": 5, "%": 5 };
export function exprText(e: Expr, parent = 0): string {
  switch (e.k) {
    case "n": return String(e.v);
    case "v": return e.name;
    case "sense": return e.s === "colorIs" ? `colorIs(${e.c ?? "r"})` : e.s;
    case "not": return "!" + exprText(e.a, 9);
    case "bin": case "cmp": case "logic": {
      const p = PREC[e.op];
      // (a comparison does not chain: `a < b == c` is not read back, so a comparison on its left side gets brackets)
      const s = `${exprText(e.a, e.k === "cmp" ? p + 1 : p)} ${e.op} ${exprText(e.b, p + 1)}`;
      return p < parent ? `(${s})` : s;
    }
    case "call": return `${e.name}(${e.args.map((x) => exprText(x)).join(", ")})`;
    case "list": return LIST_ARITY[e.f] === 1 ? `${e.f}(${e.list})` : `${e.f}(${e.list}, ${exprText(e.a ?? num(1))})`;
    case "fn": return `${e.f}(${e.args.map((x) => exprText(x)).join(", ")})`;
    case "touch": return `touching(${e.s})`;
    case "keyDown": return `keyDown(${e.key})`;
    case "me": return e.p;
  }
}
const argList = (b: Blk): Expr[] => b.args ?? (b.arg ? [b.arg] : []);
function listText(l: Blk[], ind: string, out: string[]): void {
  const X = (e: Expr | undefined, d: Expr = num(0)) => exprText(e ?? d);
  for (const b of l) {
    const inner = (head: string, body: Blk[]) => { out.push(`${ind}${head} {`); listText(body, ind + "  ", out); out.push(`${ind}}`); };
    switch (b.t) {
      case "move": case "left": case "right": case "take": case "light": case "penup": case "pendown": case "nextcostume": case "show": case "hide": out.push(ind + b.t); break;
      case "fd": case "tl": case "tr": case "smove": case "sturn": case "changex": case "changey": case "wait": case "costume": case "size": out.push(`${ind}${b.t} ${X(b.n)}`); break;
      case "color": out.push(`${ind}color ${b.c ?? "black"}`); break;
      case "repeat": inner(`repeat ${X(b.n, num(1))}`, b.body ?? []); break;
      case "forever": inner("forever", b.body ?? []); break;
      case "for": inner(`for ${b.name ?? "i"} = ${X(b.n, num(1))} to ${X(b.e, num(1))}`, b.body ?? []); break;
      case "each": inner(`each ${b.name ?? "x"} in ${b.list ?? "xs"}`, b.body ?? []); break;
      case "until": case "while": inner(`${b.t} ${X(b.cond)}`, b.body ?? []); break;
      case "if":
        out.push(`${ind}if ${X(b.cond)} {`); listText(b.body ?? [], ind + "  ", out);
        if (b.els) { out.push(`${ind}} else {`); listText(b.els, ind + "  ", out); }
        out.push(`${ind}}`); break;
      case "call": out.push(`${ind}${b.name}${argList(b).length ? `(${argList(b).map((x) => exprText(x)).join(", ")})` : ""}`); break;
      case "set": out.push(`${ind}set ${b.name} = ${X(b.e)}`); break;
      case "change": out.push(`${ind}change ${b.name} by ${X(b.e, num(1))}`); break;
      case "waitUntil": out.push(`${ind}waitUntil ${X(b.cond)}`); break;
      case "return": out.push(`${ind}return ${X(b.e)}`); break;
      case "push": out.push(`${ind}add(${b.list ?? "xs"}, ${X(b.e)})`); break;
      case "lset": out.push(`${ind}setItem(${b.list ?? "xs"}, ${X(b.n, num(1))}, ${X(b.e)})`); break;
      case "lremove": out.push(`${ind}removeItem(${b.list ?? "xs"}, ${X(b.n, num(1))})`); break;
      case "swap": out.push(`${ind}swap(${b.list ?? "xs"}, ${X(b.n, num(1))}, ${X(b.e, num(2))})`); break;
      case "lclear": out.push(`${ind}clear(${b.list ?? "xs"})`); break;
      case "goto": out.push(`${ind}goto(${X(b.n)}, ${X(b.e)})`); break;
      case "note": out.push(`${ind}note(${X(b.n, num(60))}, ${X(b.e, num(1))})`); break;
      case "say": out.push(`${ind}say ${b.c ?? "hi"}`); break;
      case "sayfor": out.push(`${ind}sayfor(${b.c ?? "hi"}, ${X(b.n, num(1))})`); break;
      case "broadcast": out.push(`${ind}broadcast ${b.c ?? "go"}`); break;
    }
  }
}
/** the program as pseudo-code (definitions first, then the event scripts, then the main program); `parse(toText(p))` gives back the same program */
export function toText(p: Program): string {
  const out: string[] = [];
  for (const f of p.funcs) { const ps = paramsOf(f); out.push(`def ${f.name}${ps.length ? `(${ps.join(", ")})` : ""} {`); listText(f.body, "  ", out); out.push("}"); }
  for (const s of p.scripts ?? []) { out.push(`on ${s.on} ${s.sprite} {`); listText(s.body, "  ", out); out.push("}"); }
  listText(p.main, "", out);
  return out.join("\n");
}

// ---------- parse ----------
export class ParseError extends Error {}
const KEYWORDS = new Set(["move", "left", "right", "take", "light", "penup", "pendown", "fd", "tl", "tr", "color", "repeat", "until", "while", "if", "else", "set", "change", "by", "def",
  "forever", "for", "each", "wait", "waitUntil", "return", "smove", "sturn", "goto", "changex", "changey", "say", "sayfor", "costume", "nextcostume", "size", "show", "hide", "note", "broadcast",
  "add", "setItem", "removeItem", "swap", "clear", "on", "and", "or"]);
function tokenize(src: string): string[] {
  const re = /\s+|\/\/[^\n]*|(<=|>=|==|!=|-?\d+(?:\.\d+)?|[{}()=+\-*\/%!<>,;]|[\p{L}_][\p{L}\p{N}_]*)/gu;
  const out: string[] = [];
  let m: RegExpExecArray | null, last = 0;
  while ((m = re.exec(src))) {
    if (m.index !== last) throw new ParseError(`unexpected "${src.slice(last, m.index)}"`);
    last = re.lastIndex;
    if (m[1] !== undefined && m[1] !== ";") out.push(m[1]);
  }
  if (last !== src.length) throw new ParseError(`unexpected "${src.slice(last)}"`);
  return out;
}
/** pseudo-code -> program (ids are made new) */
export function parse(src: string): Program {
  const toks = tokenize(src);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const expect = (t: string) => { if (next() !== t) throw new ParseError(`expected "${t}" near token ${i}`); };
  const isNum = (t?: string) => !!t && /^-?\d/.test(t);
  const isName = (t?: string) => !!t && /^[\p{L}_]/u.test(t);
  const ident = (): string => { const t = next(); if (!isName(t)) throw new ParseError(`name expected near "${t}"`); return t; };
  const name = (): string => { const t = next(); if (!isName(t) || KEYWORDS.has(t)) throw new ParseError(`name expected near "${t}"`); return t; };
  /** `(` expr, expr ... `)` */
  function exprs(n: number): Expr[] { expect("("); const l: Expr[] = []; for (let k = 0; k < n; k++) { if (k) expect(","); l.push(orx()); } expect(")"); return l; }
  function primary(): Expr {
    const t = next();
    if (t === undefined) throw new ParseError("unexpected end");
    if (isNum(t)) return num(Number(t));
    if (t === "(") { const e = orx(); expect(")"); return e; }
    if (t === "!") return { k: "not", a: primary() };
    if (!isName(t)) throw new ParseError(`unexpected "${t}"`);
    if ((SENSES as string[]).includes(t)) {
      if (t === "colorIs") { expect("("); const c = next(); expect(")"); return { k: "sense", s: "colorIs", c }; }
      return { k: "sense", s: t as Sense };
    }
    if ((ME_PROPS as string[]).includes(t)) return { k: "me", p: t as MeProp };
    if (peek() === "(") {
      if ((LIST_FNS as string[]).includes(t)) {
        const f = t as ListFn; next(); const list = name();
        if (LIST_ARITY[f] === 1) { expect(")"); return { k: "list", f, list }; }
        expect(","); const a = orx(); expect(")"); return { k: "list", f, list, a };
      }
      if ((FN_NAMES as string[]).includes(t)) return { k: "fn", f: t as FnName, args: exprs(FN_ARITY[t as FnName]) };
      if (t === "touching") { next(); const s = ident(); expect(")"); return { k: "touch", s }; }
      if (t === "keyDown") { next(); const key = ident(); expect(")"); return { k: "keyDown", key }; }
      // a call of a function of the child (a reporter)
      next(); const args: Expr[] = [];
      if (peek() !== ")") { args.push(orx()); while (peek() === ",") { next(); args.push(orx()); } }
      expect(")");
      return { k: "call", name: t, args };
    }
    return { k: "v", name: t };
  }
  function mul(): Expr { let a = primary(); while (peek() === "*" || peek() === "/" || peek() === "%") { const op = next() as "*" | "/" | "%"; a = { k: "bin", op, a, b: primary() }; } return a; }
  function add(): Expr {
    let a = mul();
    while (peek() === "+" || peek() === "-" || (isNum(peek()) && peek()!.startsWith("-") && toks[i - 1] !== undefined)) {
      // "a -3" is read as a - 3 (the tokenizer glues the sign to the number)
      if (peek() === "+" || peek() === "-") { const op = next() as "+" | "-"; a = { k: "bin", op, a, b: mul() }; }
      else { const v = Number(next()); a = { k: "bin", op: "-", a, b: num(-v) }; }
    }
    return a;
  }
  function cmp(): Expr {
    const a = add();
    const t = peek();
    if (t === "<" || t === "<=" || t === ">" || t === ">=" || t === "==" || t === "!=") { next(); return { k: "cmp", op: t, a, b: add() }; }
    return a;
  }
  function andx(): Expr { let a = cmp(); while (peek() === "and") { next(); a = { k: "logic", op: "and", a, b: cmp() }; } return a; }
  function orx(): Expr { let a = andx(); while (peek() === "or") { next(); a = { k: "logic", op: "or", a, b: andx() }; } return a; }
  function block(): Blk[] { expect("{"); const l = stmts("}"); expect("}"); return l; }
  function stmt(): Blk {
    const t = next();
    const b: Blk = { id: newId(), t: "move" };
    switch (t) {
      case "move": case "left": case "right": case "take": case "light": case "penup": case "pendown": case "nextcostume": case "show": case "hide": b.t = t; return b;
      case "fd": case "tl": case "tr": case "smove": case "sturn": case "changex": case "changey": case "wait": case "costume": case "size": b.t = t; b.n = orx(); return b;
      case "color": b.t = "color"; b.c = next(); return b;
      case "repeat": b.t = "repeat"; b.n = orx(); b.body = block(); return b;
      case "forever": b.t = "forever"; b.body = block(); return b;
      case "for": b.t = "for"; b.name = name(); expect("="); b.n = orx(); expect("to"); b.e = orx(); b.body = block(); return b;
      case "each": b.t = "each"; b.name = name(); expect("in"); b.list = name(); b.body = block(); return b;
      case "until": case "while": b.t = t; b.cond = orx(); b.body = block(); return b;
      case "if": b.t = "if"; b.cond = orx(); b.body = block(); if (peek() === "else") { next(); b.els = block(); } return b;
      case "set": b.t = "set"; b.name = next(); expect("="); b.e = orx(); return b;
      case "change": b.t = "change"; b.name = next(); expect("by"); b.e = orx(); return b;
      case "waitUntil": b.t = "waitUntil"; b.cond = orx(); return b;
      case "return": b.t = "return"; b.e = orx(); return b;
      case "add": { b.t = "push"; expect("("); b.list = name(); expect(","); b.e = orx(); expect(")"); return b; }
      case "setItem": { b.t = "lset"; expect("("); b.list = name(); expect(","); b.n = orx(); expect(","); b.e = orx(); expect(")"); return b; }
      case "removeItem": { b.t = "lremove"; expect("("); b.list = name(); expect(","); b.n = orx(); expect(")"); return b; }
      case "swap": { b.t = "swap"; expect("("); b.list = name(); expect(","); b.n = orx(); expect(","); b.e = orx(); expect(")"); return b; }
      case "clear": { b.t = "lclear"; expect("("); b.list = name(); expect(")"); return b; }
      case "goto": { b.t = "goto"; const [x, y] = exprs(2); b.n = x; b.e = y; return b; }
      case "note": { b.t = "note"; const [x, y] = exprs(2); b.n = x; b.e = y; return b; }
      case "say": b.t = "say"; b.c = ident(); return b;
      case "sayfor": { b.t = "sayfor"; expect("("); b.c = ident(); expect(","); b.n = orx(); expect(")"); return b; }
      case "broadcast": b.t = "broadcast"; b.c = ident(); return b;
      default:
        if (t === undefined || !isName(t) || KEYWORDS.has(t)) throw new ParseError(`unexpected "${t}"`);
        b.t = "call"; b.name = t;
        if (peek() === "(") {
          next(); const args: Expr[] = [];
          if (peek() !== ")") { args.push(orx()); while (peek() === ",") { next(); args.push(orx()); } }
          expect(")");
          if (args.length === 1) b.arg = args[0]; else if (args.length > 1) b.args = args;
        }
        return b;
    }
  }
  function stmts(end?: string): Blk[] { const l: Blk[] = []; while (i < toks.length && peek() !== end) l.push(stmt()); return l; }
  const p: Program = { main: [], funcs: [] };
  while (i < toks.length) {
    if (peek() === "def") {
      next(); const fname = next(); const ps: string[] = [];
      if (peek() === "(") { next(); ps.push(name()); while (peek() === ",") { next(); ps.push(name()); } expect(")"); }
      p.funcs.push({ name: fname, ...(ps.length > 1 ? { params: ps } : { param: ps[0] }), body: block() });
    } else if (peek() === "on") {
      next();
      let on = next();
      if (on === "key" || on === "recv") { expect("("); on += `(${ident()})`; expect(")"); }
      else if (on !== "start" && on !== "tap" && on !== "stagetap" && on !== "none") throw new ParseError(`unknown event "${on}"`);
      const sprite = ident();
      (p.scripts ??= []).push({ sprite, on, body: block() });
    } else p.main.push(stmt());
  }
  return p;
}

// ---------- the next block a child needs ----------
/** the kinds of all blocks in reading order (a repeat is followed by its inner blocks; an if with else counts as "ifelse") */
export function kindTokens(p: Program): { kind: PaletteKind; id: string }[] {
  const out: { kind: PaletteKind; id: string }[] = [];
  for (const l of allLists(p)) walk(l, (b) => out.push({ kind: b.t === "if" && b.els ? "ifelse" : b.t, id: b.id }));
  return out;
}
/**
 * Compares the child's program with the reference in reading order: `needed` = the kind of block the reference has next, `wrongId` = the child's block that
 * differs from the reference there (to take away or replace), `done` = the shapes of kinds are equal.
 */
export function nextHint(user: Program, ref: Program): { needed: PaletteKind | null; wrongId: string | null; extraId: string | null; done: boolean } {
  const u = kindTokens(user), r = kindTokens(ref);
  for (let i = 0; i < Math.max(u.length, r.length); i++) {
    if (i >= u.length) return { needed: r[i].kind, wrongId: null, extraId: null, done: false };
    if (i >= r.length) return { needed: null, wrongId: null, extraId: u[i].id, done: false };
    if (u[i].kind !== r[i].kind) return { needed: r[i].kind, wrongId: u[i].id, extraId: null, done: false };
  }
  return { needed: null, wrongId: null, extraId: null, done: true };
}
