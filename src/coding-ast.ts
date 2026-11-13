/**
 * 编程 (coding): the program of a child as data. A program is `{ main, funcs }`; a block is a plain object (`Blk`) with an id (the editor and the
 * interpreter use it to light the block that runs). Pure: no screens, no storage. The same data is
 *  - drawn as blocks by coding-editor.ts,
 *  - run by coding-interp.ts,
 *  - written as pseudo-code by `toText` and read back by `parse` (the syntax of the level files and the bridge to text coding in a later phase).
 */
export type BlockKind = "move" | "left" | "right" | "take" | "light" | "fd" | "tl" | "tr" | "penup" | "pendown" | "color" | "repeat" | "until" | "while" | "if" | "call" | "set" | "change";
/** what the palette offers: the kinds above plus "ifelse" (an `if` that has an else part) */
export type PaletteKind = BlockKind | "ifelse";
export type Sense = "pathAhead" | "pathLeft" | "pathRight" | "starHere" | "onFlag" | "lightHere" | "colorIs";
export const SENSES: Sense[] = ["pathAhead", "pathLeft", "pathRight", "starHere", "onFlag", "lightHere", "colorIs"];
export type CmpOp = "<" | "<=" | ">" | ">=" | "==" | "!=";
export type Expr =
  | { k: "n"; v: number }
  | { k: "v"; name: string }
  | { k: "bin"; op: "+" | "-" | "*"; a: Expr; b: Expr }
  | { k: "cmp"; op: CmpOp; a: Expr; b: Expr }
  | { k: "sense"; s: Sense; c?: string }
  | { k: "not"; a: Expr };

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
  /** call: the argument */
  arg?: Expr;
  /** set: the value; change: the amount added */
  e?: Expr;
  /** colour name */
  c?: string;
}
export interface Func { name: string; param?: string; body: Blk[] }
export interface Program { main: Blk[]; funcs: Func[] }

export const num = (v: number): Expr => ({ k: "n", v });
export const emptyProgram = (funcs: { name: string; param?: string }[] = []): Program => ({ main: [], funcs: funcs.map((f) => ({ name: f.name, param: f.param, body: [] })) });

let counter = 0;
export const newId = (): string => `b${++counter}`;

/** how many inner block lists a block has */
export const slotsOf = (b: Blk): Blk[][] => [b.body, b.els].filter((x): x is Blk[] => Array.isArray(x));
export function walk(list: Blk[], f: (b: Blk, parent: Blk[], i: number) => void): void {
  list.forEach((b, i) => { f(b, list, i); for (const s of slotsOf(b)) walk(s, f); });
}
export const allLists = (p: Program): Blk[][] => [p.main, ...p.funcs.map((f) => f.body)];
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
const PREC: Record<string, number> = { "==": 1, "!=": 1, "<": 1, "<=": 1, ">": 1, ">=": 1, "+": 2, "-": 2, "*": 3 };
export function exprText(e: Expr, parent = 0): string {
  switch (e.k) {
    case "n": return String(e.v);
    case "v": return e.name;
    case "sense": return e.s === "colorIs" ? `colorIs(${e.c ?? "r"})` : e.s;
    case "not": return "!" + exprText(e.a, 9);
    case "bin": case "cmp": {
      const p = PREC[e.op];
      const s = `${exprText(e.a, p)} ${e.op} ${exprText(e.b, p + 1)}`;
      return p < parent ? `(${s})` : s;
    }
  }
}
function listText(l: Blk[], ind: string, out: string[]): void {
  for (const b of l) {
    const inner = (name: string, head: string, body: Blk[]) => { out.push(`${ind}${head} {`); listText(body, ind + "  ", out); out.push(`${ind}}`); void name; };
    switch (b.t) {
      case "move": case "left": case "right": case "take": case "light": case "penup": case "pendown": out.push(ind + b.t); break;
      case "fd": case "tl": case "tr": out.push(`${ind}${b.t} ${exprText(b.n ?? num(0))}`); break;
      case "color": out.push(`${ind}color ${b.c ?? "black"}`); break;
      case "repeat": inner("repeat", `repeat ${exprText(b.n ?? num(1))}`, b.body ?? []); break;
      case "until": case "while": inner(b.t, `${b.t} ${exprText(b.cond ?? num(0))}`, b.body ?? []); break;
      case "if":
        out.push(`${ind}if ${exprText(b.cond ?? num(0))} {`); listText(b.body ?? [], ind + "  ", out);
        if (b.els) { out.push(`${ind}} else {`); listText(b.els, ind + "  ", out); }
        out.push(`${ind}}`); break;
      case "call": out.push(`${ind}${b.name}${b.arg ? `(${exprText(b.arg)})` : ""}`); break;
      case "set": out.push(`${ind}set ${b.name} = ${exprText(b.e ?? num(0))}`); break;
      case "change": out.push(`${ind}change ${b.name} by ${exprText(b.e ?? num(1))}`); break;
    }
  }
}
/** the program as pseudo-code (definitions first, then the main program); `parse(toText(p))` gives back the same program */
export function toText(p: Program): string {
  const out: string[] = [];
  for (const f of p.funcs) { out.push(`def ${f.name}${f.param ? `(${f.param})` : ""} {`); listText(f.body, "  ", out); out.push("}"); }
  listText(p.main, "", out);
  return out.join("\n");
}

// ---------- parse ----------
export class ParseError extends Error {}
const KEYWORDS = new Set(["move", "left", "right", "take", "light", "penup", "pendown", "fd", "tl", "tr", "color", "repeat", "until", "while", "if", "else", "set", "change", "by", "def"]);
function tokenize(src: string): string[] {
  const re = /\s+|\/\/[^\n]*|(<=|>=|==|!=|-?\d+(?:\.\d+)?|[{}()=+\-*!<>,;]|[\p{L}_][\p{L}\p{N}_]*)/gu;
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
  function primary(): Expr {
    const t = next();
    if (t === undefined) throw new ParseError("unexpected end");
    if (isNum(t)) return num(Number(t));
    if (t === "(") { const e = cmp(); expect(")"); return e; }
    if (t === "!") return { k: "not", a: primary() };
    if (!/^[\p{L}_]/u.test(t)) throw new ParseError(`unexpected "${t}"`);
    if ((SENSES as string[]).includes(t)) {
      if (t === "colorIs") { expect("("); const c = next(); expect(")"); return { k: "sense", s: "colorIs", c }; }
      return { k: "sense", s: t as Sense };
    }
    return { k: "v", name: t };
  }
  function mul(): Expr { let a = primary(); while (peek() === "*") { next(); a = { k: "bin", op: "*", a, b: primary() }; } return a; }
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
  function block(): Blk[] { expect("{"); const l = stmts("}"); expect("}"); return l; }
  function stmt(): Blk {
    const t = next();
    const b: Blk = { id: newId(), t: "move" };
    switch (t) {
      case "move": case "left": case "right": case "take": case "light": case "penup": case "pendown": b.t = t; return b;
      case "fd": case "tl": case "tr": b.t = t; b.n = cmp(); return b;
      case "color": b.t = "color"; b.c = next(); return b;
      case "repeat": b.t = "repeat"; b.n = cmp(); b.body = block(); return b;
      case "until": case "while": b.t = t; b.cond = cmp(); b.body = block(); return b;
      case "if": b.t = "if"; b.cond = cmp(); b.body = block(); if (peek() === "else") { next(); b.els = block(); } return b;
      case "set": b.t = "set"; b.name = next(); expect("="); b.e = cmp(); return b;
      case "change": b.t = "change"; b.name = next(); expect("by"); b.e = cmp(); return b;
      default:
        if (t === undefined || !/^[\p{L}_]/u.test(t) || KEYWORDS.has(t)) throw new ParseError(`unexpected "${t}"`);
        b.t = "call"; b.name = t;
        if (peek() === "(") { next(); b.arg = cmp(); expect(")"); }
        return b;
    }
  }
  function stmts(end?: string): Blk[] { const l: Blk[] = []; while (i < toks.length && peek() !== end) l.push(stmt()); return l; }
  const p: Program = { main: [], funcs: [] };
  while (i < toks.length) {
    if (peek() === "def") {
      next(); const name = next(); let param: string | undefined;
      if (peek() === "(") { next(); param = next(); expect(")"); }
      p.funcs.push({ name, param, body: block() });
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
