/**
 * 编程, text coding: the small Python-like language ("Python 入门"). THIS FILE = errors, lexer, parser (pure, no DOM, no eval).
 * The interpreter is in coding-textrun.ts. The syntax is a subset of real Python 3 (indentation blocks, English keywords), so that
 * what a child writes here also runs in real Python. Errors are friendly Chinese messages with the line number and, where the usual
 * mistake is known (missing colon, Chinese punctuation, print without brackets, = instead of ==), a hint.
 */
export type PyKind =
  | "SyntaxError" | "IndentationError" | "NameError" | "UnboundLocalError" | "TypeError" | "ValueError" | "ZeroDivisionError" | "IndexError" | "KeyError"
  | "AttributeError" | "RecursionError" | "StepLimit" | "EOFError" | "OutputLimit" | "BlankError" | "OverflowError" | "AssertionError";
export class PyError extends Error {
  constructor(public kind: PyKind, message: string, public line: number, public hint?: string) { super(message); }
}
export const KIND_NAME: Record<PyKind, string> = {
  SyntaxError: "语法错误", IndentationError: "缩进错误", NameError: "名字错误", UnboundLocalError: "名字错误", TypeError: "类型错误", ValueError: "值错误",
  ZeroDivisionError: "除以零", IndexError: "位置超出范围", KeyError: "字典没有这个键", AttributeError: "方法错误", RecursionError: "调用太深", StepLimit: "运行太久",
  EOFError: "没有更多输入", OutputLimit: "输出太多", BlankError: "还有空白", OverflowError: "数太大", AssertionError: "断言失败",
};

// ---------- tokens ----------
export type TokT = "name" | "num" | "str" | "op" | "nl" | "indent" | "dedent" | "eof";
export interface Tok { t: TokT; v: string; line: number; col: number; num?: bigint | number; fstr?: boolean; raw?: boolean }

export const KEYWORDS = new Set(["False", "None", "True", "and", "as", "assert", "break", "continue", "def", "del", "elif", "else", "for", "from", "global", "if", "import", "in", "is", "lambda", "not", "or", "pass", "return", "while"]);
/** words real Python has but this small language does not teach: a clear message instead of a mystery */
const UNSUPPORTED = new Set(["class", "try", "except", "finally", "raise", "with", "yield", "nonlocal", "async", "await"]);

const FULLWIDTH: Record<string, string> = { "：": ":", "（": "(", "）": ")", "，": ",", "“": '"', "”": '"', "‘": "'", "’": "'", "；": ";", "【": "[", "】": "]", "。": ".", "＋": "+", "－": "-", "＝": "=", "＜": "<", "＞": ">", "！": "!", "　": " ", "＊": "*", "／": "/", "％": "%", "＃": "#", "｛": "{", "｝": "}" };

const OPS3 = ["**=", "//=", "..."];
const OPS2 = ["**", "//", "==", "!=", "<=", ">=", "+=", "-=", "*=", "/=", "%=", "->"];
const OPS1 = "+-*/%<>=()[]{},:.";

const isNameStart = (c: string) => /[\p{L}_]/u.test(c);
const isNameChar = (c: string) => /[\p{L}\p{N}_]/u.test(c);
const isDigit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";

export function lex(src: string): Tok[] {
  const out: Tok[] = [];
  const lines = src.replace(/\r\n?/g, "\n");
  let i = 0, line = 1, lineStart = 0, depth = 0;
  const brackets: { c: string; line: number }[] = [];
  const indents = [0];
  let atLineStart = true;
  const push = (t: TokT, v: string, extra: Partial<Tok> = {}) => out.push({ t, v, line, col: i - lineStart, ...extra });
  while (i < lines.length) {
    if (atLineStart && depth === 0) {
      // measure the indentation of this line; blank / comment-only lines do not count
      let j = i, w = 0;
      while (j < lines.length && (lines[j] === " " || lines[j] === "\t")) { w += lines[j] === "\t" ? 4 : 1; j++; }
      if (j >= lines.length) { i = j; break; }
      if (lines[j] === "\n") { i = j + 1; line++; lineStart = i; continue; }
      if (lines[j] === "#") { while (j < lines.length && lines[j] !== "\n") j++; i = j; continue; }
      if (lines[j] === "\\" && lines[j + 1] === "\n") { i = j + 2; line++; lineStart = i; continue; }
      i = j;
      atLineStart = false;
      const top = indents[indents.length - 1];
      if (w > top) { indents.push(w); push("indent", ""); }
      else if (w < top) {
        while (indents[indents.length - 1] > w) { indents.pop(); push("dedent", ""); }
        if (indents[indents.length - 1] !== w) throw new PyError("IndentationError", `第 ${line} 行：缩进和上面的代码对不齐。`, line, "同一层的代码，前面的空格数必须一样；每进一层用 4 个空格。");
      }
    }
    const c = lines[i];
    if (c === "\n") {
      if (depth === 0) { if (out.length && out[out.length - 1].t !== "nl") push("nl", ""); atLineStart = true; }
      i++; line++; lineStart = i; continue;
    }
    if (c === " " || c === "\t") { i++; continue; }
    if (c === "#") { while (i < lines.length && lines[i] !== "\n") i++; continue; }
    if (c === "\\" && lines[i + 1] === "\n") { i += 2; line++; lineStart = i; continue; }
    if (FULLWIDTH[c] !== undefined && c !== "　") {
      throw new PyError("SyntaxError", `第 ${line} 行：出现了中文标点“${c}”。`, line, `程序里要用英文标点，请换成 ${FULLWIDTH[c]}（切换到英文输入法）。`);
    }
    if (c === "　") { i++; continue; }
    // strings (with the prefixes f / r / fr / rf)
    const sm = /^([fFrR]{0,2})("""|'''|"|')/.exec(lines.slice(i, i + 5));
    if (sm && (sm[1] === "" || /^(f|r|fr|rf)$/i.test(sm[1]))) {
      const prefix = sm[1].toLowerCase(), q = sm[2], startLine = line;
      const f = prefix.includes("f"), raw = prefix.includes("r");
      i += sm[0].length;
      let s = "";
      let closed = false;
      while (i < lines.length) {
        if (lines.startsWith(q, i)) { i += q.length; closed = true; break; }
        const ch = lines[i];
        if (ch === "\n") {
          if (q.length === 1) break;
          s += ch; i++; line++; lineStart = i; continue;
        }
        if (ch === "\\" && !raw) {
          const n = lines[i + 1];
          const map: Record<string, string> = { n: "\n", t: "\t", r: "\r", "\\": "\\", "'": "'", '"': '"', "0": "\0" };
          if (n === "\n") { i += 2; line++; lineStart = i; continue; }
          if (n !== undefined && map[n] !== undefined) { s += map[n]; i += 2; continue; }
          if (n === "u" && /^[0-9a-fA-F]{4}$/.test(lines.slice(i + 2, i + 6))) { s += String.fromCharCode(parseInt(lines.slice(i + 2, i + 6), 16)); i += 6; continue; }
          s += ch; i++; continue;   // an unknown escape stays as it is (like Python)
        }
        if (ch === "\\" && raw && (lines[i + 1] === q[0])) { s += ch + q[0]; i += 2; continue; }
        s += ch; i++;
      }
      if (!closed) throw new PyError("SyntaxError", `第 ${startLine} 行：字符串没有结束，缺少结尾的引号 ${q}。`, startLine, "字符串要用成对的引号括起来，开头和结尾的引号要一样。");
      out.push({ t: "str", v: s, line: startLine, col: 0, fstr: f, raw });
      continue;
    }
    if (isDigit(c) || (c === "." && isDigit(lines[i + 1]))) {
      let j = i;
      if (c === "0" && /[xXbBoO]/.test(lines[i + 1] ?? "")) {
        const base = { x: 16, b: 2, o: 8 }[lines[i + 1].toLowerCase() as "x" | "b" | "o"];
        j = i + 2;
        while (j < lines.length && /[0-9a-fA-F_]/.test(lines[j])) j++;
        const digits = lines.slice(i + 2, j).replace(/_/g, "");
        const v = digits ? [...digits].reduce((a, d) => a * BigInt(base) + BigInt(parseInt(d, base)), 0n) : -1n;
        if (v < 0n || [...digits].some((d) => isNaN(parseInt(d, base)) || parseInt(d, base) >= base)) throw new PyError("SyntaxError", `第 ${line} 行：数字“${lines.slice(i, j)}”写得不对。`, line);
        push("num", lines.slice(i, j), { num: v }); i = j; continue;
      }
      while (isDigit(lines[j]) || lines[j] === "_") j++;
      let isFloat = false;
      if (lines[j] === "." && lines[j + 1] !== "." && !isNameStart(lines[j + 1] ?? " ")) { isFloat = true; j++; while (isDigit(lines[j]) || lines[j] === "_") j++; }
      if ((lines[j] === "e" || lines[j] === "E") && (isDigit(lines[j + 1]) || ((lines[j + 1] === "+" || lines[j + 1] === "-") && isDigit(lines[j + 2])))) {
        isFloat = true; j += 2; while (isDigit(lines[j])) j++;
      }
      if (j < lines.length && isNameStart(lines[j])) {
        let k = j; while (k < lines.length && isNameChar(lines[k])) k++;
        throw new PyError("SyntaxError", `第 ${line} 行：“${lines.slice(i, k)}”不是有效的写法。`, line, "数字和字母不能连在一起。如果想相乘，请写成 2 * x。");
      }
      const text = lines.slice(i, j).replace(/_/g, "");
      push("num", text, { num: isFloat ? Number(text) : BigInt(text) });
      i = j; continue;
    }
    if (isNameStart(c)) {
      let j = i; while (j < lines.length && isNameChar(lines[j])) j++;
      push("name", lines.slice(i, j)); i = j; continue;
    }
    const three = lines.slice(i, i + 3), two = lines.slice(i, i + 2);
    let op = OPS3.includes(three) ? three : OPS2.includes(two) ? two : OPS1.includes(c) ? c : "";
    if (op === "...") op = ".";
    if (op) {
      if ("([{".includes(op)) { depth++; brackets.push({ c: op, line }); }
      if (")]}".includes(op)) {
        const open = brackets.pop();
        const want = { ")": "(", "]": "[", "}": "{" }[op]!;
        if (!open) throw new PyError("SyntaxError", `第 ${line} 行：多了一个右括号 ${op}。`, line, `前面没有和它配对的 ${want}。`);
        if (open.c !== want) throw new PyError("SyntaxError", `第 ${line} 行：括号不配对：${open.c}（第 ${open.line} 行）和 ${op} 不是一对。`, line);
        depth--;
      }
      push("op", op); i += op.length; continue;
    }
    if (c === ";") throw new PyError("SyntaxError", `第 ${line} 行：不能用分号 ; 连接语句。`, line, "每条语句单独写一行。");
    if (c === "!") throw new PyError("SyntaxError", `第 ${line} 行：单独的 ! 不能使用。`, line, "“不等于”写成 !=，“非”写成 not。");
    if (c === "$" || c === "?" || c === "`" || c === "@" || c === "&" || c === "|" || c === "^" || c === "~") throw new PyError("SyntaxError", `第 ${line} 行：这里不能使用符号“${c}”。`, line, "这门入门语言不支持这个符号。");
    throw new PyError("SyntaxError", `第 ${line} 行：不认识的字符“${c}”。`, line);
  }
  if (brackets.length) {
    const b = brackets[brackets.length - 1];
    throw new PyError("SyntaxError", `第 ${b.line} 行：括号 ${b.c} 没有闭合。`, b.line, `请在合适的位置补上 ${{ "(": ")", "[": "]", "{": "}" }[b.c]}。`);
  }
  if (out.length && out[out.length - 1].t !== "nl") out.push({ t: "nl", v: "", line, col: 0 });
  while (indents.length > 1) { indents.pop(); out.push({ t: "dedent", v: "", line, col: 0 }); }
  out.push({ t: "eof", v: "", line, col: 0 });
  return out;
}

// ---------- the syntax tree ----------
export type Expr =
  | { k: "num"; v: bigint | number; line: number }
  | { k: "str"; v: string; line: number }
  | { k: "fstr"; parts: (string | { e: Expr; conv?: string; spec?: (string | { e: Expr; conv?: string })[]; eq?: string })[]; line: number }
  | { k: "name"; id: string; line: number }
  | { k: "const"; v: boolean | null; line: number }
  | { k: "list" | "tuple" | "set"; items: Expr[]; line: number }
  | { k: "dict"; pairs: [Expr, Expr][]; line: number }
  | { k: "un"; op: "-" | "+" | "not"; a: Expr; line: number }
  | { k: "bin"; op: string; a: Expr; b: Expr; line: number }
  | { k: "logic"; op: "and" | "or"; a: Expr; b: Expr; line: number }
  | { k: "cmp"; first: Expr; ops: [string, Expr][]; line: number }
  | { k: "call"; f: Expr; args: Expr[]; kw: [string, Expr][]; line: number }
  | { k: "idx"; o: Expr; i: Expr; line: number }
  | { k: "slice"; o: Expr; lo?: Expr; hi?: Expr; st?: Expr; line: number }
  | { k: "attr"; o: Expr; name: string; line: number }
  | { k: "cond"; c: Expr; a: Expr; b: Expr; line: number }
  | { k: "lambda"; params: string[]; body: Expr; line: number }
  | { k: "comp"; kind: "list" | "set" | "dict" | "gen"; elt: Expr; val?: Expr; clauses: ({ target: Expr; iter: Expr } | { cond: Expr })[]; line: number };

export interface Param { name: string; def?: Expr }
export type Stmt =
  | { k: "expr"; e: Expr; line: number }
  | { k: "assign"; targets: Expr[]; value: Expr; line: number }
  | { k: "aug"; target: Expr; op: string; value: Expr; line: number }
  | { k: "if"; tests: { c: Expr; body: Stmt[]; line: number }[]; els?: Stmt[]; line: number }
  | { k: "while"; c: Expr; body: Stmt[]; line: number }
  | { k: "for"; target: Expr; iter: Expr; body: Stmt[]; line: number }
  | { k: "def"; name: string; params: Param[]; body: Stmt[]; line: number; locals?: Set<string>; globals?: Set<string> }
  | { k: "return"; e?: Expr; line: number }
  | { k: "break" | "continue" | "pass"; line: number }
  | { k: "global"; names: string[]; line: number }
  | { k: "import"; mod: string; as?: string; line: number }
  | { k: "from"; mod: string; names: string[] | "*"; line: number }
  | { k: "del"; target: Expr; line: number }
  | { k: "assert"; c: Expr; msg?: Expr; line: number };

/** the usual mistakes of a keyword at the start of a line */
const STMT_KW = new Set(["if", "elif", "else", "while", "for", "def"]);

export function parseProgram(src: string): Stmt[] {
  const toks = lex(src);
  let p = 0;
  const peek = (o = 0) => toks[Math.min(p + o, toks.length - 1)];
  const isOp = (v: string, o = 0) => peek(o).t === "op" && peek(o).v === v;
  const isKw = (v: string, o = 0) => peek(o).t === "name" && peek(o).v === v;
  const lineOf = () => peek().line;
  const tokText = (t: Tok) => (t.t === "nl" ? "行末" : t.t === "eof" ? "程序结尾" : t.t === "indent" ? "缩进" : t.t === "dedent" ? "缩进结束" : t.t === "str" ? "字符串" : `“${t.v}”`);
  const fail = (msg: string, line = lineOf(), hint?: string, kind: PyKind = "SyntaxError"): never => { throw new PyError(kind, `第 ${line} 行：${msg}`, line, hint); };
  const unexpected = (what = ""): never => {
    const t = peek();
    if (t.t === "nl" || t.t === "eof") return fail(`这一行没有写完${what}。`, t.t === "eof" && toks.length > 1 ? toks[Math.max(0, p - 1)].line : t.line, "后面还缺少内容，请检查括号、运算符或冒号。");
    if (t.t === "indent") return fail("这一行前面有多余的空格（缩进）。", t.line, "只有在 if / while / for / def 的冒号后面，下一行才需要缩进。", "IndentationError");
    if (t.t === "name" && UNSUPPORTED.has(t.v)) return fail(`这门入门语言还没有学到“${t.v}”。`, t.line);
    if (t.t === "name" && (STMT_KW.has(t.v) || t.v === "return")) return fail(`这里不应该出现“${t.v}”。`, t.line, "请检查上一行的写法是否完整。");
    return fail(`这里的 ${tokText(t)} 不对${what}。`, t.line);
  };
  const eat = (v: string): Tok => { if (!isOp(v)) unexpected(`，应该是 ${v}`); return toks[p++]; };
  const eatName = (): string => { if (peek().t !== "name" || KEYWORDS.has(peek().v)) unexpected("，这里需要一个名字"); return toks[p++].v; };

  // ----- expressions -----
  function parseTestList(): Expr {   // a, b, c  (a tuple without brackets)
    const line = lineOf();
    const first = parseTest();
    if (!isOp(",")) return first;
    const items = [first];
    while (isOp(",")) { p++; if (endOfExprList()) break; items.push(parseTest()); }
    return { k: "tuple", items, line };
  }
  const endOfExprList = () => peek().t === "nl" || peek().t === "eof" || isOp("=") || isOp(")") || isOp("]") || isOp(":") || (peek().t === "op" && /^(\+|-|\*|\/|%|\*\*|\/\/)=$/.test(peek().v));
  function parseTest(): Expr {
    if (isKw("lambda")) {
      const line = lineOf(); p++;
      const params: string[] = [];
      while (!isOp(":")) { params.push(eatName()); if (isOp(",")) p++; else break; }
      eat(":");
      return { k: "lambda", params, body: parseTest(), line };
    }
    const a = parseOr();
    if (isKw("if")) {
      const line = lineOf(); p++;
      const c = parseOr();
      if (!isKw("else")) unexpected("，条件表达式需要 else");
      p++;
      return { k: "cond", c, a, b: parseTest(), line };
    }
    return a;
  }
  function parseOr(): Expr {
    let a = parseAnd();
    while (isKw("or")) { const line = lineOf(); p++; a = { k: "logic", op: "or", a, b: parseAnd(), line }; }
    return a;
  }
  function parseAnd(): Expr {
    let a = parseNot();
    while (isKw("and")) { const line = lineOf(); p++; a = { k: "logic", op: "and", a, b: parseNot(), line }; }
    return a;
  }
  function parseNot(): Expr {
    if (isKw("not")) { const line = lineOf(); p++; return { k: "un", op: "not", a: parseNot(), line }; }
    return parseCmp();
  }
  function parseCmp(): Expr {
    const first = parseArith();
    const ops: [string, Expr][] = [];
    const line = lineOf();
    for (;;) {
      let op = "";
      if (peek().t === "op" && ["<", ">", "==", "!=", "<=", ">="].includes(peek().v)) { op = peek().v; p++; }
      else if (isKw("in")) { op = "in"; p++; }
      else if (isKw("not") && isKw("in", 1)) { op = "not in"; p += 2; }
      else if (isKw("is")) { p++; if (isKw("not")) { p++; op = "is not"; } else op = "is"; }
      else break;
      ops.push([op, parseArith()]);
    }
    if (isOp("=") && ops.length === 0 && first.k !== "name") { /* handled by the caller (statement or condition) */ }
    return ops.length ? { k: "cmp", first, ops, line } : first;
  }
  function parseArith(): Expr {
    let a = parseTerm();
    while (isOp("+") || isOp("-")) { const line = lineOf(); const op = toks[p++].v; a = { k: "bin", op, a, b: parseTerm(), line }; }
    return a;
  }
  function parseTerm(): Expr {
    let a = parseUnary();
    while (isOp("*") || isOp("/") || isOp("//") || isOp("%")) { const line = lineOf(); const op = toks[p++].v; a = { k: "bin", op, a, b: parseUnary(), line }; }
    return a;
  }
  function parseUnary(): Expr {
    if (isOp("-") || isOp("+")) { const line = lineOf(); const op = toks[p++].v as "-" | "+"; return { k: "un", op, a: parseUnary(), line }; }
    return parsePower();
  }
  function parsePower(): Expr {
    const a = parsePostfix();
    if (isOp("**")) { const line = lineOf(); p++; return { k: "bin", op: "**", a, b: parseUnary(), line }; }
    return a;
  }
  function parsePostfix(): Expr {
    let a = parseAtom();
    for (;;) {
      const line = lineOf();
      if (isOp("(")) {
        p++;
        const args: Expr[] = [], kw: [string, Expr][] = [];
        while (!isOp(")")) {
          if (peek().t === "name" && isOp("=", 1) && !KEYWORDS.has(peek().v)) { const n = toks[p].v; p += 2; kw.push([n, parseTest()]); }
          else {
            const e = parseTest();
            if (isKw("for")) args.push({ k: "comp", kind: "gen", elt: e, clauses: parseClauses(), line });
            else { if (kw.length) fail("带名字的参数后面不能再放普通参数。", line); args.push(e); }
          }
          if (isOp(",")) p++; else break;
        }
        if (!isOp(")")) unexpected("，函数调用的括号没有闭合");
        p++;
        a = { k: "call", f: a, args, kw, line };
      } else if (isOp("[")) {
        p++;
        let lo: Expr | undefined, hi: Expr | undefined, st: Expr | undefined;
        let sliced = false;
        if (!isOp(":")) lo = parseTest();
        if (isOp(":")) {
          sliced = true; p++;
          if (!isOp(":") && !isOp("]")) hi = parseTest();
          if (isOp(":")) { p++; if (!isOp("]")) st = parseTest(); }
        }
        if (!isOp("]")) unexpected("，方括号没有闭合");
        p++;
        a = sliced ? { k: "slice", o: a, lo, hi, st, line } : { k: "idx", o: a, i: lo!, line };
      } else if (isOp(".")) {
        p++;
        if (peek().t !== "name") unexpected("，点后面需要一个名字");
        a = { k: "attr", o: a, name: toks[p++].v, line };
      } else break;
    }
    return a;
  }
  function parseClauses(): ({ target: Expr; iter: Expr } | { cond: Expr })[] {
    const cl: ({ target: Expr; iter: Expr } | { cond: Expr })[] = [];
    while (isKw("for") || isKw("if")) {
      if (isKw("for")) {
        p++;
        const target = parseTargetList();
        if (!isKw("in")) unexpected("，for 后面需要 in");
        p++;
        cl.push({ target, iter: parseOr() });
      } else { p++; cl.push({ cond: parseOr() }); }
    }
    return cl;
  }
  function parseTargetList(): Expr {
    const line = lineOf();
    const first = parseArith();
    if (!isOp(",")) return first;
    const items = [first];
    while (isOp(",")) { p++; if (isKw("in") || isOp("=")) break; items.push(parseArith()); }
    return { k: "tuple", items, line };
  }
  function parseAtom(): Expr {
    const t = peek(), line = t.line;
    if (t.t === "num") { p++; return { k: "num", v: t.num!, line }; }
    if (t.t === "str") {
      p++;
      // adjacent strings are joined, like Python
      let parts: Expr = t.fstr ? parseFString(t) : { k: "str", v: t.v, line };
      while (peek().t === "str") {
        const n = toks[p++];
        const r: Expr = n.fstr ? parseFString(n) : { k: "str", v: n.v, line };
        parts = { k: "fstr", parts: [...(parts.k === "fstr" ? parts.parts : [(parts as { v: string }).v]), ...(r.k === "fstr" ? r.parts : [(r as { v: string }).v])], line };
      }
      return parts;
    }
    if (t.t === "name") {
      if (t.v === "True" || t.v === "False") { p++; return { k: "const", v: t.v === "True", line }; }
      if (t.v === "None") { p++; return { k: "const", v: null, line }; }
      if (UNSUPPORTED.has(t.v)) unexpected();
      if (KEYWORDS.has(t.v)) unexpected();
      p++;
      return { k: "name", id: t.v, line };
    }
    if (t.t === "op") {
      if (t.v === "(") {
        p++;
        if (isOp(")")) { p++; return { k: "tuple", items: [], line }; }
        const first = parseTest();
        if (isKw("for")) { const cl = parseClauses(); eat(")"); return { k: "comp", kind: "gen", elt: first, clauses: cl, line }; }
        if (isOp(",")) {
          const items = [first];
          while (isOp(",")) { p++; if (isOp(")")) break; items.push(parseTest()); }
          eat(")");
          return { k: "tuple", items, line };
        }
        if (!isOp(")")) unexpected("，括号没有闭合");
        p++;
        return first;
      }
      if (t.v === "[") {
        p++;
        if (isOp("]")) { p++; return { k: "list", items: [], line }; }
        const first = parseTest();
        if (isKw("for")) { const cl = parseClauses(); eat("]"); return { k: "comp", kind: "list", elt: first, clauses: cl, line }; }
        const items = [first];
        while (isOp(",")) { p++; if (isOp("]")) break; items.push(parseTest()); }
        if (!isOp("]")) unexpected("，方括号没有闭合");
        p++;
        return { k: "list", items, line };
      }
      if (t.v === "{") {
        p++;
        if (isOp("}")) { p++; return { k: "dict", pairs: [], line }; }
        const first = parseTest();
        if (isOp(":")) {
          p++;
          const v = parseTest();
          if (isKw("for")) { const cl = parseClauses(); eat("}"); return { k: "comp", kind: "dict", elt: first, val: v, clauses: cl, line }; }
          const pairs: [Expr, Expr][] = [[first, v]];
          while (isOp(",")) { p++; if (isOp("}")) break; const k = parseTest(); eat(":"); pairs.push([k, parseTest()]); }
          if (!isOp("}")) unexpected("，花括号没有闭合");
          p++;
          return { k: "dict", pairs, line };
        }
        if (isKw("for")) { const cl = parseClauses(); eat("}"); return { k: "comp", kind: "set", elt: first, clauses: cl, line }; }
        const items = [first];
        while (isOp(",")) { p++; if (isOp("}")) break; items.push(parseTest()); }
        if (!isOp("}")) unexpected("，花括号没有闭合");
        p++;
        return { k: "set", items, line };
      }
    }
    return unexpected();
  }
  /** f"text {expr!r:spec} text": the pieces between braces are parsed as expressions */
  function parseFString(t: Tok): Expr {
    const s = t.v, parts: (string | { e: Expr; conv?: string; spec?: (string | { e: Expr; conv?: string })[]; eq?: string })[] = [];
    let i = 0, text = "";
    const sub = (code: string): Expr => {
      let st: Stmt[];
      try { st = parseProgram(code.trim() === "" ? "0" : "(" + code + ")"); } catch (e) {
        if (e instanceof PyError) throw new PyError(e.kind, `第 ${t.line} 行：f 字符串里的 {${code}} 写得不对。`, t.line, e.message.replace(/^第 \d+ 行：/, ""));
        throw e;
      }
      const e0 = st[0] as { k: "expr"; e: Expr };
      const fix = (e: Expr) => e;
      return fix(e0.e);
    };
    while (i < s.length) {
      const c = s[i];
      if (c === "{" && s[i + 1] === "{") { text += "{"; i += 2; continue; }
      if (c === "}" && s[i + 1] === "}") { text += "}"; i += 2; continue; }
      if (c === "}") fail("f 字符串里有单独的 }。", t.line, "要显示花括号本身，请写两个：}}。");
      if (c !== "{") { text += c; i++; continue; }
      // find the matching close brace
      let j = i + 1, d = 0, q = "";
      while (j < s.length) {
        const ch = s[j];
        if (q) { if (ch === q) q = ""; j++; continue; }
        if (ch === "'" || ch === '"') { q = ch; j++; continue; }
        if ("([{".includes(ch)) d++;
        else if (")]".includes(ch)) d--;
        else if (ch === "}") { if (d === 0) break; d--; }
        j++;
      }
      if (j >= s.length) fail("f 字符串里的 { 没有对应的 }。", t.line, "要显示花括号本身，请写两个：{{。");
      let inner = s.slice(i + 1, j);
      // split expression / !conv / :spec at depth 0 (not inside brackets or strings; "!=" is not a conversion)
      let k = 0, dd = 0, qq = "", exprEnd = inner.length, conv: string | undefined, spec: string | undefined;
      for (; k < inner.length; k++) {
        const ch = inner[k];
        if (qq) { if (ch === qq) qq = ""; continue; }
        if (ch === "'" || ch === '"') { qq = ch; continue; }
        if ("([{".includes(ch)) dd++;
        else if (")]}".includes(ch)) dd--;
        else if (dd === 0 && ch === "!" && inner[k + 1] !== "=") { exprEnd = k; conv = inner[k + 1]; const rest = inner.slice(k + 2); if (rest.startsWith(":")) spec = rest.slice(1); break; }
        else if (dd === 0 && ch === ":") { exprEnd = k; spec = inner.slice(k + 1); break; }
      }
      let code = inner.slice(0, exprEnd), eq: string | undefined;
      if (/=\s*$/.test(code) && !/[=!<>]=\s*$/.test(code)) { eq = code; code = code.replace(/=\s*$/, ""); }
      if (text) { parts.push(text); text = ""; }
      let specParts: (string | { e: Expr; conv?: string })[] | undefined;
      if (spec !== undefined) {
        specParts = [];
        let cur = "";
        for (let m = 0; m < spec.length; m++) {
          if (spec[m] === "{") { const e2 = spec.indexOf("}", m); if (e2 < 0) fail("f 字符串格式里的 { 没有对应的 }。", t.line); if (cur) { specParts.push(cur); cur = ""; } specParts.push({ e: sub(spec.slice(m + 1, e2)) }); m = e2; }
          else cur += spec[m];
        }
        if (cur) specParts.push(cur);
      }
      parts.push({ e: sub(code), conv, spec: specParts, eq });
      inner = "";
      i = j + 1;
    }
    if (text) parts.push(text);
    return { k: "fstr", parts, line: t.line };
  }

  // ----- statements -----
  function toTarget(e: Expr, line: number): Expr {
    if (e.k === "name" || e.k === "idx" || e.k === "attr") return e;
    if (e.k === "tuple" || e.k === "list") { e.items.forEach((x) => toTarget(x, line)); return e; }
    if (e.k === "call") return fail("函数调用的结果不能被赋值。", line, "= 的左边必须是变量名。");
    if (e.k === "num" || e.k === "str" || e.k === "const") return fail("= 的左边不能是一个固定的值。", line, "= 的左边必须是变量名，例如 x = 5。");
    return fail("= 的左边必须是变量名。", line, "例如 total = a + b，而不是 a + b = total。");
  }
  function block(headLine: number, what: string): Stmt[] {
    if (!isOp(":")) {
      if (isOp("=") ) fail(`${what} 里判断“相等”要用两个等号 ==。`, headLine, "一个 = 是给变量赋值，两个 == 才是比较。");
      fail(`${what} 这一行的末尾缺少冒号“:”。`, headLine, "if、elif、else、while、for、def 的末尾都要写一个英文冒号。");
    }
    p++;
    if (peek().t !== "nl") {   // a one-line body:  if x: print(1)
      const s = simpleStatement(); if (peek().t === "nl") p++;
      return [s];
    }
    p++;
    if (peek().t !== "indent") {
      const ln = headLine;
      fail(`${what} 的冒号后面需要缩进的代码。`, ln, "冒号后面的下一行要缩进 4 个空格，表示它属于这一块。", "IndentationError");
    }
    p++;
    const body: Stmt[] = [];
    while (peek().t !== "dedent" && peek().t !== "eof") body.push(statement());
    if (peek().t === "dedent") p++;
    return body;
  }
  function statement(): Stmt {
    const t = peek(), line = t.line;
    if (t.t === "indent") return unexpected() as never;
    if (t.t === "name") {
      switch (t.v) {
        case "if": {
          p++;
          const tests: { c: Expr; body: Stmt[]; line: number }[] = [];
          let c = parseTest();
          tests.push({ c, body: block(line, "if"), line });
          let els: Stmt[] | undefined;
          while (isKw("elif")) { const l2 = lineOf(); p++; c = parseTest(); tests.push({ c, body: block(l2, "elif"), line: l2 }); }
          if (isKw("else")) { const l2 = lineOf(); p++; els = block(l2, "else"); }
          return { k: "if", tests, els, line };
        }
        case "elif": case "else": return fail(`“${t.v}”前面没有对应的 if。`, line, "elif / else 必须紧跟在 if 的代码块后面，并且缩进要和 if 对齐。");
        case "while": { p++; const c = parseTest(); return { k: "while", c, body: block(line, "while"), line }; }
        case "for": {
          p++;
          const target = toTarget(parseTargetList(), line);
          if (!isKw("in")) fail("for 这一行需要写 in。", line, "写法：for i in range(5):");
          p++;
          const iter = parseTestList();
          return { k: "for", target, iter, body: block(line, "for"), line };
        }
        case "def": {
          p++;
          const name = eatName();
          eat("(");
          const params: Param[] = [];
          while (!isOp(")")) {
            const n = eatName();
            let def: Expr | undefined;
            if (isOp("=")) { p++; def = parseTest(); }
            params.push({ name: n, def });
            if (isOp(",")) p++; else break;
          }
          if (!isOp(")")) unexpected("，def 的括号没有闭合");
          p++;
          const body = block(line, "def");
          const d: Stmt = { k: "def", name, params, body, line };
          analyze(d);
          return d;
        }
        default:
          if (UNSUPPORTED.has(t.v)) return fail(`这门入门语言还没有学到“${t.v}”。`, line);
      }
    }
    const s = simpleStatement();
    if (peek().t === "nl") p++;
    else if (peek().t !== "eof") {
      const nt = peek();
      if (s.k === "expr" && s.e.k === "name" && (nt.t === "str" || nt.t === "num" || nt.t === "name")) {
        if (s.e.id === "print") fail("print 后面要加括号。", line, "写成 print(...)，例如 print(\"你好\")。");
        fail(`“${s.e.id}”后面多了内容 ${tokText(nt)}。`, line, "两个词不能直接连在一起。是不是少了运算符、逗号或括号？");
      }
      if (nt.t === "name" || nt.t === "num" || nt.t === "str") fail(`这里多了 ${tokText(nt)}。`, line, "是不是少了运算符（如 + * ,）或者括号没有闭合？");
      unexpected();
    }
    return s;
  }
  function simpleStatement(): Stmt {
    const t = peek(), line = t.line;
    if (t.t === "name") {
      switch (t.v) {
        case "pass": p++; return { k: "pass", line };
        case "break": p++; return { k: "break", line };
        case "continue": p++; return { k: "continue", line };
        case "return": { p++; const e = peek().t === "nl" || peek().t === "eof" ? undefined : parseTestList(); return { k: "return", e, line }; }
        case "global": { p++; const names = [eatName()]; while (isOp(",")) { p++; names.push(eatName()); } return { k: "global", names, line }; }
        case "import": {
          p++; let mod = eatName();
          while (isOp(".")) { p++; mod += "." + eatName(); }
          let as: string | undefined;
          if (isKw("as")) { p++; as = eatName(); }
          return { k: "import", mod, as, line };
        }
        case "from": {
          p++; const mod = eatName();
          if (!isKw("import")) unexpected("，应该是 import");
          p++;
          if (isOp("*")) { p++; return { k: "from", mod, names: "*", line }; }
          const names = [eatName()];
          while (isOp(",")) { p++; names.push(eatName()); }
          return { k: "from", mod, names, line };
        }
        case "del": { p++; const e = parsePostfix(); return { k: "del", target: e, line }; }
        case "assert": { p++; const c = parseTest(); let msg: Expr | undefined; if (isOp(",")) { p++; msg = parseTest(); } return { k: "assert", c, msg, line }; }
        case "print":
          if (peek(1).t === "str" || peek(1).t === "num" || (peek(1).t === "name" && !KEYWORDS.has(peek(1).v))) return fail("print 后面要加括号。", line, "写成 print(...)，例如 print(\"你好\")。");
      }
    }
    const e = parseTestList();
    if (isOp("=")) {
      const targets = [toTarget(e, line)];
      let value: Expr;
      for (;;) {
        p++;
        value = parseTestList();
        if (isOp("=")) { targets.push(toTarget(value, line)); continue; }
        break;
      }
      return { k: "assign", targets, value, line };
    }
    if (peek().t === "op" && /^(\+|-|\*|\/|%|\*\*|\/\/)=$/.test(peek().v)) {
      const op = toks[p++].v.slice(0, -1);
      if (e.k !== "name" && e.k !== "idx") fail("这种写法左边必须是变量。", line);
      return { k: "aug", target: e, op, value: parseTestList(), line };
    }
    if (isOp("=") === false && peek().t === "op" && peek().v === ":" ) fail("这里多了冒号“:”。", line, "冒号只用在 if / elif / else / while / for / def 这一行的末尾。");
    return { k: "expr", e, line };
  }

  const prog: Stmt[] = [];
  while (peek().t !== "eof") {
    if (peek().t === "nl") { p++; continue; }
    if (peek().t === "dedent") { p++; continue; }
    prog.push(statement());
  }
  return prog;
}

/** which names are local to a function (assigned in it, parameters, loop variables) and which are declared global */
function analyze(d: Extract<Stmt, { k: "def" }>): void {
  const locals = new Set<string>(d.params.map((x) => x.name)), globals = new Set<string>();
  const target = (e: Expr) => {
    if (e.k === "name") locals.add(e.id);
    else if (e.k === "tuple" || e.k === "list") e.items.forEach(target);
  };
  const walk = (body: Stmt[]) => {
    for (const s of body) {
      switch (s.k) {
        case "assign": s.targets.forEach(target); break;
        case "aug": target(s.target); break;
        case "for": target(s.target); walk(s.body); break;
        case "while": walk(s.body); break;
        case "if": s.tests.forEach((t) => walk(t.body)); if (s.els) walk(s.els); break;
        case "def": locals.add(s.name); break;
        case "global": s.names.forEach((n) => globals.add(n)); break;
        case "import": locals.add(s.as ?? s.mod.split(".")[0]); break;
        case "from": if (s.names !== "*") s.names.forEach((n) => locals.add(n)); break;
      }
    }
  };
  walk(d.body);
  for (const g of globals) locals.delete(g);
  d.locals = locals; d.globals = globals;
}

export const keywordList = [...KEYWORDS];
