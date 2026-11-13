/**
 * 编程, text coding: the BRIDGE from blocks to written code. `blocksToPython` turns a block program of phase 1 (coding-ast.ts) into Python text of the
 * small language, so that a child can "build with blocks first, then look at the code" (world 11 mini-lesson, the workshop's "from my drawings").
 * Drawing programs (fd / tl / tr / penup / pendown / color / repeat / if / while / until / set / change / functions) convert and RUN with the same picture
 * (the block turtle starts heading up, so the code starts with turtle.setheading(90)). Robot programs (move / take / light / sensors) convert to text
 * only (`runnable: false`): the robot lives in the block world.
 */
import { Blk, Expr, Program } from "./coding-ast";

const PREC: Record<string, number> = { "==": 1, "!=": 1, "<": 1, "<=": 1, ">": 1, ">=": 1, "+": 2, "-": 2, "*": 3 };
export interface Bridge { code: string; runnable: boolean }

export function blocksToPython(p: Program): Bridge {
  let runnable = true, turtleUsed = false;
  const vars = new Set<string>();
  const params = new Set<string>(p.funcs.map((f) => f.param).filter((x): x is string => !!x));
  const robot = new Set(["move", "left", "right", "take", "light"]);
  const ex = (e: Expr, parent = 0): string => {
    switch (e.k) {
      case "n": return String(e.v);
      case "v": if (!params.has(e.name)) vars.add(e.name); return e.name;
      case "sense": runnable = false; return e.s === "colorIs" ? `color_is("${e.c ?? "r"}")` : e.s;
      case "not": return "not " + ex(e.a, 9);
      case "bin": case "cmp": { const q = PREC[e.op]; const s = `${ex(e.a, q)} ${e.op} ${ex(e.b, q + 1)}`; return q < parent ? `(${s})` : s; }
      default: return "0";
    }
  };
  const used = new Set<string>();
  const scan = (l: Blk[]) => { for (const b of l) { if (b.name) used.add(b.name); scan(b.body ?? []); scan(b.els ?? []); } };
  for (const f of p.funcs) { scan(f.body); if (f.param) used.add(f.param); }
  scan(p.main);
  const loopVar = (depth: number): string => { const names = ["i", "j", "k", "m", "n2", "p2"].filter((x) => !used.has(x) && !vars.has(x)); return names[depth % names.length] ?? `i${depth}`; };
  const out: string[] = [];
  const emit = (l: Blk[], ind: string, depth: number, fn: { globals: Set<string> } | null) => {
    if (!l.length) { out.push(ind + "pass"); return; }
    for (const b of l) {
      switch (b.t) {
        case "fd": turtleUsed = true; out.push(`${ind}turtle.forward(${ex(b.n!)})`); break;
        case "tl": turtleUsed = true; out.push(`${ind}turtle.left(${ex(b.n!)})`); break;
        case "tr": turtleUsed = true; out.push(`${ind}turtle.right(${ex(b.n!)})`); break;
        case "penup": turtleUsed = true; out.push(`${ind}turtle.penup()`); break;
        case "pendown": turtleUsed = true; out.push(`${ind}turtle.pendown()`); break;
        case "color": turtleUsed = true; out.push(`${ind}turtle.color("${b.c ?? "black"}")`); break;
        case "move": case "left": case "right": case "take": case "light": runnable = false; out.push(`${ind}${b.t}()`); break;
        case "repeat": { const v = loopVar(depth); out.push(`${ind}for ${v} in range(${ex(b.n!)}):`); emit(b.body ?? [], ind + "    ", depth + 1, fn); break; }
        case "while": out.push(`${ind}while ${ex(b.cond!)}:`); emit(b.body ?? [], ind + "    ", depth + 1, fn); break;
        case "until": out.push(`${ind}while not (${ex(b.cond!)}):`); emit(b.body ?? [], ind + "    ", depth + 1, fn); break;
        case "if":
          out.push(`${ind}if ${ex(b.cond!)}:`); emit(b.body ?? [], ind + "    ", depth + 1, fn);
          if (b.els) { out.push(`${ind}else:`); emit(b.els, ind + "    ", depth + 1, fn); }
          break;
        case "call": out.push(`${ind}${b.name}(${b.arg ? ex(b.arg) : ""})`); break;
        case "set": if (fn && !params.has(b.name!)) fn.globals.add(b.name!); vars.add(b.name!); out.push(`${ind}${b.name} = ${ex(b.e!)}`); break;
        case "change": if (fn && !params.has(b.name!)) fn.globals.add(b.name!); vars.add(b.name!); out.push(`${ind}${b.name} += ${ex(b.e!)}`); break;
      }
    }
  };
  const defs: string[] = [];
  for (const f of p.funcs) {
    const saved = out.splice(0);
    const fn = { globals: new Set<string>() };
    emit(f.body, "    ", 1, fn);
    const body = out.splice(0);
    out.push(...saved);
    defs.push(`def ${f.name}(${f.param ?? ""}):`, ...(fn.globals.size ? [`    global ${[...fn.globals].join(", ")}`] : []), ...body, "");
  }
  const mainStart = out.length;
  emit(p.main, "", 0, null);
  const main = out.splice(mainStart);
  const head: string[] = [];
  if (turtleUsed) head.push("import turtle", "turtle.setheading(90)   # 积木里的海龟一开始朝上", "");
  const initVars = [...vars].filter((v) => !params.has(v));
  if (initVars.length) head.push(...initVars.map((v) => `${v} = 0`), "");
  void robot;
  return { code: [...head, ...defs, ...main].join("\n").replace(/\n+$/, "") + "\n", runnable };
}
