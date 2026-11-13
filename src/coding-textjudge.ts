/**
 * 编程, text coding: JUDGING a program against the hidden cases of a level (pure, no DOM). The expected output of a case is what the reference solution
 * prints for it (run by the same interpreter, which suite 86 checks against real python3); a drawing level compares the drawn SEGMENTS (coding-turtle.ts).
 * Output comparison: line endings are unified, spaces at the end of a line and empty lines at the end are ignored, everything else must be exactly equal.
 */
import { lex, parseProgram, PyError, Stmt, Expr } from "./coding-textlang";
import { run, RunResult } from "./coding-textrun";
import { sameDrawing } from "./coding-turtle";
import type { TLevel, TCase } from "./coding-textlevels";

export const normalize = (s: string): string => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");
export const programFor = (code: string, c: TCase): string => (c.call ? code.replace(/\s+$/, "") + "\n" + c.call + "\n" : code);
/** tokens of a program (comments and layout do not count): the size that the stars use */
export function countTokens(code: string): number {
  try { return lex(code).filter((t) => t.t !== "nl" && t.t !== "indent" && t.t !== "dedent" && t.t !== "eof").length; } catch { return code.split(/\s+/).filter(Boolean).length; }
}
export interface CaseResult { index: number; input: string; call: string; expected: string; got: string; ok: boolean; error: PyError | null; steps: number; reason: "ok" | "output" | "error" | "budget" | "drawing" }
export interface Judgement { passed: boolean; cases: CaseResult[]; first: CaseResult | null; rule: string | null; tokens: number }

const refCache = new Map<string, RunResult>();
export function refRun(level: TLevel, i: number): RunResult {
  const key = `${level.id}#${i}`;
  let r = refCache.get(key);
  if (!r) {
    const c = level.cases[i];
    r = run(programFor(level.ref, c), { input: c.input ?? "", seed: c.seed ?? 1, budget: 2_000_000 });
    if (r.error) throw new Error(`reference of ${level.id} fails on case ${i}: ${r.error.message}`);
    refCache.set(key, r);
  }
  return r;
}
export const expectedOutput = (level: TLevel, i: number): string => normalize(refRun(level, i).stdout);
export const parOf = (level: TLevel): number => countTokens(level.ref);

const calls = (e: Expr | undefined, name: string): boolean => {
  if (!e) return false;
  switch (e.k) {
    case "call": return (e.f.k === "name" && e.f.id === name) || calls(e.f, name) || e.args.some((a) => calls(a, name)) || e.kw.some(([, x]) => calls(x, name));
    case "bin": case "logic": return calls(e.a, name) || calls(e.b, name);
    case "un": return calls(e.a, name);
    case "cmp": return calls(e.first, name) || e.ops.some(([, x]) => calls(x, name));
    case "cond": return calls(e.c, name) || calls(e.a, name) || calls(e.b, name);
    case "list": case "tuple": case "set": return e.items.some((x) => calls(x, name));
    case "idx": return calls(e.o, name) || calls(e.i, name);
    case "attr": return calls(e.o, name);
    case "fstr": return e.parts.some((p) => typeof p !== "string" && calls(p.e, name));
    default: return false;
  }
};
const stmtCalls = (body: Stmt[], name: string): boolean => body.some((s) => {
  switch (s.k) {
    case "expr": return calls(s.e, name);
    case "assign": return calls(s.value, name);
    case "aug": return calls(s.value, name);
    case "return": return calls(s.e, name);
    case "if": return s.tests.some((t) => calls(t.c, name) || stmtCalls(t.body, name)) || (s.els ? stmtCalls(s.els, name) : false);
    case "while": return calls(s.c, name) || stmtCalls(s.body, name);
    case "for": return calls(s.iter, name) || stmtCalls(s.body, name);
    default: return false;
  }
});
/** does the function `name` call itself? */
export function callsItself(code: string, name: string): boolean {
  try {
    const prog = parseProgram(code);
    return prog.some((s) => s.k === "def" && s.name === name && stmtCalls(s.body, name));
  } catch { return false; }
}
/** the names (also method names after a dot) used in the program */
export function namesUsed(code: string): Set<string> {
  try { return new Set(lex(code).filter((t) => t.t === "name").map((t) => t.v)); } catch { return new Set(); }
}

export function judge(level: TLevel, code: string): Judgement {
  const results: CaseResult[] = [];
  let rule: string | null = null;
  const used = namesUsed(code);
  for (const f of level.forbid ?? []) if (used.has(f)) rule = `题目要求不能使用 ${f}。`;
  if (level.recursive && !callsItself(code, level.recursive)) rule = `函数 ${level.recursive} 需要调用它自己（递归）。`;
  level.cases.forEach((c, i) => {
    const input = c.input ?? "", call = c.call ?? "";
    const r = run(programFor(code, c), { input, seed: c.seed ?? 1, budget: level.budget ?? 400_000 });
    const ref = refRun(level, i);
    const base = { index: i, input, call, steps: r.steps, error: r.error };
    if (level.kind === "draw") {
      const ok = !r.error && sameDrawing(r.segs, ref.segs);
      results.push({ ...base, expected: "", got: r.error ? "" : `${r.segs.length}`, ok, reason: r.error ? (r.error.kind === "StepLimit" ? "budget" : "error") : ok ? "ok" : "drawing" });
      return;
    }
    const expected = normalize(ref.stdout), got = normalize(r.stdout);
    const ok = !r.error && got === expected;
    results.push({ ...base, expected, got, ok, reason: r.error ? (r.error.kind === "StepLimit" && level.budget ? "budget" : "error") : ok ? "ok" : "output" });
  });
  const first = results.find((x) => !x.ok) ?? null;
  return { passed: !first && !rule, cases: results, first, rule, tokens: countTokens(code) };
}

/** 1 star: all tests pass; +1 when the program is not longer than 1.6 x the reference (tokens); +1 when it passed at the first submit; after the reference was shown at most 1 */
export function starsFor(tokens: number, par: number, firstTry: boolean, usedAnswer: boolean): number {
  if (usedAnswer) return 1;
  return 1 + (tokens <= Math.ceil(par * 1.6) ? 1 : 0) + (firstTry ? 1 : 0);
}
