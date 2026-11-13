/**
 * 化学 (junior-high chemistry trainer), the pure part: formulas (parsing, atom counts, masses), the reaction library (`src/data/chem.json`, written from memory,
 * lazily imported), the judges (balance, 复分解 with the solubility table, metal activity) and the question generators of every practice mode. No screens, no storage
 * of its own except the progress of this device (`learn.chem.v1`). Questions are never stored: each is made on the spot from the data and a seed.
 */
import * as G from "./game";

// ---------- data ----------
export interface Term { c: number; f: string; mark: "" | "↑" | "↓" }
export interface Rx { id: string; eq: string; cond: string[]; type: string; ch: string; ph: string; l: Term[]; r: Term[] }
export interface Sub { f: string; n: string; a: string; c: string }
export interface Elem { s: string; n: string; ar: number; v: number[] }
export interface ChemData {
  chapters: Record<string, string>; reactions: Rx[]; subs: Sub[]; mix: { n: string; a: string }[]; elements: Elem[]; groups: { f: string; n: string; c: number }[];
  ions: { cat: string[]; catZh: string[]; catCh: number[]; an: string[]; sol: Record<string, string[]> };
  activity: string[]; indicators: { n: string; acid: string; neutral: string; base: string }[]; ph: { n: string; v: number }[];
  solub: { T: number[]; d: { f: string; n: string; v: number[] }[] };
  gases: { f: string; n: string; rx: string[]; gen: Record<string, string>; col: string[]; why: string; test: string; full: string; bad: string[][] }[];
}
let D!: ChemData;
export const data = (): ChemData => D;
const parseSide = (s: string): Term[] => s.split("+").map((t) => { const m = /^(\d*)(.+?)([↑↓]?)$/.exec(t)!; return { c: m[1] ? +m[1] : 1, f: m[2], mark: m[3] as Term["mark"] }; });
export function setData(raw: Omit<ChemData, never>): ChemData {
  D = raw as ChemData;
  for (const r of D.reactions) { const [a, b] = r.eq.split("="); r.l = parseSide(a); r.r = parseSide(b); }
  AR = new Map(D.elements.map((e) => [e.s, e.ar]));
  SUB = new Map(D.subs.map((s) => [s.f, s]));
  RXBY = new Map(D.reactions.map((r) => [r.id, r]));
  return D;
}
export async function loadChem(): Promise<ChemData> { if (!D) setData((await import("./data/chem.json")).default as unknown as ChemData); return D; }
let AR = new Map<string, number>(), SUB = new Map<string, Sub>(), RXBY = new Map<string, Rx>();
export const rxById = (id: string): Rx | undefined => RXBY.get(id);
export const subOf = (f: string): Sub | undefined => SUB.get(f);
export const nameOf = (f: string): string => SUB.get(f)?.n ?? f;

// ---------- formulas ----------
/** atoms per element; handles brackets and a hydrate dot: "Al2(SO4)3", "CuSO4·5H2O"; throws on anything it does not understand */
export function parseFormula(f: string): Record<string, number> {
  const tot: Record<string, number> = {};
  const [main, ...hyd] = f.split("·");
  const add = (s: string, k: number) => {
    const st: Record<string, number>[] = [{}];
    let i = 0;
    const num = () => { let n = ""; while (i < s.length && s[i] >= "0" && s[i] <= "9") n += s[i++]; return n ? +n : 1; };
    while (i < s.length) {
      if (s[i] === "(") { st.push({}); i++; }
      else if (s[i] === ")") { i++; const k2 = num(); const top = st.pop()!; if (!st.length) throw new Error("bad formula " + f); for (const [e, v] of Object.entries(top)) st[st.length - 1][e] = (st[st.length - 1][e] ?? 0) + v * k2; }
      else {
        const m = /^[A-Z][a-z]?/.exec(s.slice(i));
        if (!m || !AR.has(m[0])) throw new Error("bad formula " + f);
        i += m[0].length; st[st.length - 1][m[0]] = (st[st.length - 1][m[0]] ?? 0) + num();
      }
    }
    if (st.length !== 1) throw new Error("bad formula " + f);
    for (const [e, v] of Object.entries(st[0])) tot[e] = (tot[e] ?? 0) + v * k;
  };
  add(main, 1);
  for (const x of hyd) { const m = /^(\d*)(.*)$/.exec(x)!; add(m[2], m[1] ? +m[1] : 1); }
  return tot;
}
export const mr = (f: string): number => Object.entries(parseFormula(f)).reduce((s, [e, n]) => s + (AR.get(e) ?? 0) * n, 0);
export const ar = (e: string): number => AR.get(e) ?? 0;
export function atomsOf(side: { c: number; f: string }[]): Record<string, number> {
  const o: Record<string, number> = {};
  for (const t of side) for (const [e, n] of Object.entries(parseFormula(t.f))) o[e] = (o[e] ?? 0) + n * t.c;
  return o;
}
/** per element: atoms on the left and on the right (the balance scale reads this) */
export function balanceRows(l: { c: number; f: string }[], r: { c: number; f: string }[]): { e: string; l: number; r: number }[] {
  const a = atomsOf(l), b = atomsOf(r);
  const order = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return order.map((e) => ({ e, l: a[e] ?? 0, r: b[e] ?? 0 }));
}
export const isBalanced = (l: { c: number; f: string }[], r: { c: number; f: string }[]): boolean => balanceRows(l, r).every((x) => x.l === x.r);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
export const gcdAll = (xs: number[]): number => xs.reduce(gcd, 0);
export const lowestTerms = (l: { c: number }[], r: { c: number }[]): boolean => gcdAll([...l, ...r].map((t) => t.c)) === 1;

const METALS = new Set(["Li", "Na", "Mg", "Al", "K", "Ca", "Mn", "Fe", "Cu", "Zn", "Ag", "Ba", "W", "Hg"]);
const isElem = (f: string) => Object.keys(parseFormula(f)).length === 1 && !f.includes("·") && /^[A-Z][a-z]?\d*$/.test(f);
const nonmetalOxide = (f: string) => SUB.get(f)?.c === "oxide" && !Object.keys(parseFormula(f)).some((e) => METALS.has(e));
/** the four basic types by structure (化合 / 分解 / 置换 / 复分解), everything else is 其他 */
export function classifyType(rx: Rx): string {
  const { l, r } = rx;
  if (l.length >= 2 && r.length === 1) return "化合";
  if (l.length === 1 && r.length >= 2) return "分解";
  const el = (t: Term[]) => t.filter((x) => isElem(x.f)).length;
  if (l.length === 2 && r.length === 2 && el(l) === 1 && el(r) === 1) return "置换";
  if (l.length === 2 && el(l) === 0 && el(r) === 0 && r.length >= 2 && !l.some((x) => nonmetalOxide(x.f) || SUB.get(x.f)?.c === "org")) return "复分解";
  return "其他";
}
/** easy / medium / hard by size of the coefficients and number of substances */
export function levelOf(rx: Rx): number {
  const cs = [...rx.l, ...rx.r].map((t) => t.c), n = cs.length, mx = Math.max(...cs);
  return mx <= 2 && n <= 3 ? 1 : mx <= 3 && n <= 4 ? 2 : 3;
}
export const CONDS = ["点燃", "加热", "通电", "高温", "催化剂", "常温", "光照"];

// ---------- random ----------
export type Rnd = () => number;
export function rng(seed: number): Rnd { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const ri = (r: Rnd, n: number) => Math.floor(r() * n);
const pick = <T,>(r: Rnd, a: readonly T[]): T => a[ri(r, a.length)];
const shuf = <T,>(r: Rnd, a: readonly T[]): T[] => G.shuffle(a, r);

// ---------- questions ----------
/** a piece of text: UI text (translated), the user's own content, a formula, or an equation */
export type Part = string | { u: string } | { f: string } | { eq: string } | { cross: { cat: string; cc: number; an: string; ac: number } };
export interface QBase { key: string; mode: string; kind: string; lv: number; stem: Part[]; expl: Part[] }
export interface ChoiceQ extends QBase { t: "choice"; fig?: string; tbl?: { head: string[]; rows: string[][] }; choices: Part[][]; right: number }
export interface NumStep { label: Part[]; answer: number; tol: number; unit?: string; say: Part[] }
export interface NumQ extends QBase { t: "num"; steps: NumStep[]; meta?: Record<string, unknown> }
export interface BalQ extends QBase { t: "bal"; rx: string }
export interface WriteQ extends QBase { t: "write"; rx: string; desc: string; tiles: string[] }
export interface ClassQ extends QBase { t: "class"; items: { id: string; f?: string; n: string; cat: string }[]; buckets: string[] }
export type Q = ChoiceQ | NumQ | BalQ | WriteQ | ClassQ;
export const partKey = (p: Part[]) => JSON.stringify(p);
const num = (x: number) => String(+x.toFixed(2));
const sgn = (v: number) => (v > 0 ? `+${v}` : `${v}`);

/** the modes of the home screen: id, name, hint, the question kinds it mixes */
export const MODES: { id: string; name: string; sub: string; badge: string; kinds: string[]; byRx?: boolean }[] = [
  { id: "bal", name: "配平", sub: "用天平把方程式配平", badge: "2H₂", kinds: ["bal"], byRx: true },
  { id: "wr", name: "写方程式", sub: "由文字写出化学方程式", badge: "→", kinds: ["write"], byRx: true },
  { id: "val", name: "化学式与化合价", sub: "交叉法、化合价、相对分子质量", badge: "NaCl", kinds: ["cross", "find", "n2f", "f2n", "mr", "pct"] },
  { id: "type", name: "反应类型与现象", sub: "类型、条件、实验现象", badge: "A+B", kinds: ["type", "pick", "cond", "ph"], byRx: true },
  { id: "calc", name: "根据方程式计算", sub: "分步计算质量", badge: "g", kinds: ["calc"], byRx: true },
  { id: "sol", name: "溶液", sub: "质量分数、配制、溶解度", badge: "%", kinds: ["frac", "prep", "dilute", "read", "sat", "satfrac"] },
  { id: "dec", name: "复分解反应", sub: "能否发生，为什么", badge: "↓↑", kinds: ["dec"] },
  { id: "act", name: "金属活动性", sub: "能否反应，生成什么", badge: "Zn", kinds: ["acid", "salt", "notreact", "order"] },
  { id: "cls", name: "物质分类", sub: "把物质拖进正确的类别", badge: "▦", kinds: ["class"] },
  { id: "ind", name: "指示剂与 pH", sub: "颜色、酸碱性、pH 变化", badge: "pH", kinds: ["color", "acidity", "more", "change", "red"] },
  { id: "gas", name: "气体的制取", sub: "药品、装置、收集与检验", badge: "O₂", kinds: ["react", "gen", "col", "test", "full"] },
];
export const modeOf = (id: string) => MODES.find((m) => m.id === id)!;
export const TYPES = ["化合", "分解", "置换", "复分解", "其他"];
export const TYPE_NAME: Record<string, string> = { 化合: "化合反应", 分解: "分解反应", 置换: "置换反应", 复分解: "复分解反应", 其他: "其他反应" };
const TYPE_RULE: Record<string, string> = {
  化合: "化合反应：两种或两种以上的物质生成一种物质（多变一）。",
  分解: "分解反应：一种物质生成两种或两种以上的物质（一变多）。",
  置换: "置换反应：一种单质与一种化合物反应，生成另一种单质和另一种化合物。",
  复分解: "复分解反应：两种化合物互相交换成分，生成另外两种化合物。",
  其他: "不属于四种基本反应类型，例如氧气与有机物的反应，或非金属氧化物与碱、一氧化碳与金属氧化物的反应。",
};
const eqP = (rx: Rx): Part => ({ eq: rx.id });

// ---------- valence: ions, formula by the cross method ----------
interface Ion { k: string; f: string; ch: number; n: string }
const CAT: Ion[] = [["H", "H", 1, "氢"], ["Na", "Na", 1, "钠"], ["K", "K", 1, "钾"], ["Ag", "Ag", 1, "银"], ["Mg", "Mg", 2, "镁"], ["Ca", "Ca", 2, "钙"], ["Ba", "Ba", 2, "钡"], ["Zn", "Zn", 2, "锌"], ["Al", "Al", 3, "铝"], ["Fe2", "Fe", 2, "亚铁"], ["Fe3", "Fe", 3, "铁"], ["Cu", "Cu", 2, "铜"], ["NH4", "NH4", 1, "铵"]].map(([k, f, ch, n]) => ({ k, f, ch, n } as Ion));
const AN: Ion[] = [["Cl", "Cl", -1, "氯"], ["O", "O", -2, "氧"], ["S", "S", -2, "硫"], ["OH", "OH", -1, "氢氧"], ["NO3", "NO3", -1, "硝酸"], ["SO4", "SO4", -2, "硫酸"], ["CO3", "CO3", -2, "碳酸"], ["PO4", "PO4", -3, "磷酸"]].map(([k, f, ch, n]) => ({ k, f, ch, n } as Ion));
const catByK = (k: string) => CAT.find((c) => c.k === k)!;
const part = (f: string, n: number): string => {
  if (n === 1) return f;
  return (Object.keys(parseFormula(f)).length > 1 ? `(${f})` : f) + n;
};
const build = (cat: Ion, an: Ion, a: number, b: number, parens = true): string => {
  const p = (i: Ion, n: number) => (parens ? part(i.f, n) : i.f + (n > 1 ? n : ""));
  return p(cat, a) + p(an, b);
};
/** formula of the compound of a cation and an anion (cross method, lowest terms) */
export function crossFormula(cat: Ion, an: Ion): string {
  const g = gcd(cat.ch, -an.ch);
  return build(cat, an, -an.ch / g, cat.ch / g);
}
export function ionName(cat: Ion, an: Ion): string {
  if (cat.k === "H") return an.k === "Cl" ? "盐酸" : an.k === "O" ? "水" : an.k === "S" ? "氢硫酸" : an.n + "";
  if (an.k === "Cl" || an.k === "O" || an.k === "S") return an.n + "化" + cat.n;
  if (an.k === "OH") return "氢氧化" + cat.n;
  return an.n + cat.n;
}
export const IONS = { CAT, AN, catByK, crossFormula, ionName };
const catPool = (lv: number) => CAT.filter((c) => c.k !== "H" && (lv >= 3 || (c.k !== "NH4" && c.k !== "Ag" && c.k !== "Fe3" && c.k !== "Fe2")) && (lv >= 2 || !["Ba", "Zn", "Cu"].includes(c.k)));
const anPool = (lv: number) => AN.filter((a) => lv >= 3 || (lv >= 2 ? a.k !== "PO4" : ["Cl", "O", "OH", "SO4"].includes(a.k)));

function badFormulas(cat: Ion, an: Ion, right: string, r: Rnd): string[] {
  const g = gcd(cat.ch, -an.ch), a = -an.ch / g, b = cat.ch / g;
  const c: string[] = [];
  if (a !== b) c.push(build(cat, an, b, a));            // subscripts not crossed
  if (g > 1) c.push(build(cat, an, -an.ch, cat.ch));      // not in lowest terms
  c.push(build(cat, an, a + 1, b), build(cat, an, a, b + 1), build(cat, an, a + 1, b + 1), build(cat, an, a, b + 2), build(cat, an, a + 2, b));
  if ((a > 1 && Object.keys(parseFormula(cat.f)).length > 1) || (b > 1 && Object.keys(parseFormula(an.f)).length > 1)) c.push(build(cat, an, a, b, false));   // brackets forgotten
  const out: string[] = [];
  for (const x of shuf(r, c.slice(0, c.length))) if (x !== right && !out.includes(x) && !isRight(cat, an, x)) out.push(x);
  return out;
}
/** a formula string is a correct answer for cat + an when it is exactly the cross-method formula */
const isRight = (cat: Ion, an: Ion, f: string): boolean => f === crossFormula(cat, an);

function chooseFrom(r: Rnd, right: Part[], wrongs: Part[][], n = 4): { choices: Part[][]; right: number } {
  const seen = new Set([partKey(right)]);
  const w: Part[][] = [];
  for (const x of wrongs) { const k = partKey(x); if (!seen.has(k)) { seen.add(k); w.push(x); } if (w.length === n - 1) break; }
  const all = shuf(r, [right, ...w]);
  return { choices: all, right: all.findIndex((x) => partKey(x) === partKey(right)) };
}
const choiceQ = (base: Omit<QBase, "expl"> & { expl: Part[] }, r: Rnd, right: Part[], wrongs: Part[][], extra: Partial<ChoiceQ> = {}, n = 4): ChoiceQ => ({ ...base, t: "choice", ...chooseFrom(r, right, wrongs, n), ...extra });

/** valences of an element in a compound by the rule "the sum of all valences is zero": other elements are taken from the table; null when not solvable (or fractional) */
const FIXED: Record<string, number> = { H: 1, Li: 1, Na: 1, K: 1, Ag: 1, Ca: 2, Mg: 2, Ba: 2, Zn: 2, Al: 3, O: -2, F: -1 };
export function valenceIn(f: string, target: string): { v: number; terms: string } | null {
  const atoms = parseFormula(f);
  if (!(target in atoms) || f.includes("·")) return null;
  const known: Record<string, number> = { ...FIXED };
  if (!("O" in atoms)) known.Cl = -1;
  if (target === "N" && "H" in atoms && !("O" in atoms)) known.N = NaN;
  const unknown = Object.keys(atoms).filter((e) => !(e in known));
  if (unknown.length !== 1 || unknown[0] !== target) return null;
  let sum = 0; const parts: string[] = [];
  for (const [e, n] of Object.entries(atoms)) if (e !== target) { sum += known[e] * n; parts.push(`(${sgn(known[e])})×${n}`); }
  const x = -sum / atoms[target];
  if (!Number.isInteger(x) || x === 0) return null;
  return { v: x, terms: `${atoms[target] > 1 ? atoms[target] + "x" : "x"}${parts.length ? " + " + parts.join(" + ") : ""} = 0` };
}
let FINDS: { f: string; e: string }[] | null = null;
function findList() {
  if (FINDS) return FINDS;
  FINDS = [];
  for (const s of D.subs) { if (s.c === "other" || s.f.includes("·")) continue; for (const e of Object.keys(parseFormula(s.f))) if (!(e in FIXED) && e !== "Cl" && valenceIn(s.f, e)) FINDS.push({ f: s.f, e }); else if (e === "Cl" && valenceIn(s.f, e)) FINDS.push({ f: s.f, e }); }
  return FINDS;
}
export const findCases = (): { f: string; e: string }[] => findList();

const nameable = () => D.subs.filter((s) => s.c !== "other" && !s.f.includes("·"));
function genVal(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "val", kind, lv: lv || 1 };
  if (kind === "cross") {
    const lvl = lv || ri(r, 3) + 1;
    const cat = pick(r, catPool(lvl)), an = pick(r, anPool(lvl));
    const right = crossFormula(cat, an);
    const showCat = cat.f, showAn = an.f;
    const stem: Part[] = ["已知化合价：", { f: showCat }, `${sgn(cat.ch)}`, "，", { f: showAn }, `${sgn(an.ch)}`, "。写出它们组成的化合物的化学式。"];
    return choiceQ({ ...base, lv: lvl, key: `val:cross`, stem, expl: ["交叉法：把化合价的绝对值交叉写在对方元素的右下角，约成最简整数比，原子团超过 1 个要加括号。化学式：", { f: right }, "。"] }, r, [{ f: right }], badFormulas(cat, an, right, r).map((x) => [{ f: x }] as Part[]), { }, 4) && { ...choiceQ({ ...base, lv: lvl, key: `val:cross`, stem, expl: ["交叉法：把化合价的绝对值交叉写在对方元素的右下角，约成最简整数比，原子团超过 1 个要加括号。化学式：", { f: right }, "。", { cross: { cat: cat.f, cc: cat.ch, an: an.f, ac: an.ch } }] }, r, [{ f: right }], badFormulas(cat, an, right, r).map((x) => [{ f: x }] as Part[])), meta: { cat: { f: cat.f, ch: cat.ch }, an: { f: an.f, ch: an.ch } } } as ChoiceQ;
  }
  if (kind === "find") {
    const list = findList().filter((x) => !lv || (lv === 1 ? !/[()]/.test(x.f) && Object.keys(parseFormula(x.f)).length <= 2 : true));
    const c = pick(r, list.length ? list : findList()); const sol = valenceIn(c.f, c.e)!;
    const cands = [-4, -3, -2, -1, 1, 2, 3, 4, 5, 6, 7];
    const wrongs = shuf(r, cands.filter((v) => v !== sol.v).sort((a, b) => Math.abs(a - sol.v) - Math.abs(b - sol.v)).slice(0, 6)).map((v) => [{ f: sgn(v) }] as Part[]);
    return choiceQ({ ...base, key: `val:find`, stem: ["求下列化合物中指定元素的化合价：", { f: c.f }, " 中的 ", { f: c.e }], expl: ["在化合物中各元素化合价的代数和为零。设该元素的化合价为 x：", { f: sol.terms }, "，得 x = ", { f: sgn(sol.v) }, "。"] }, r, [{ f: sgn(sol.v) }], wrongs) as Q;
  }
  if (kind === "n2f" || kind === "f2n") {
    const pool = nameable().filter((s) => !lv || (lv === 1 ? (s.c === "elem" || s.c === "oxide" || s.c === "acid") : lv === 2 ? s.c !== "org" : true));
    const s = pick(r, pool.length ? pool : nameable());
    const sameKind = shuf(r, nameable().filter((x) => x.f !== s.f && x.c === s.c));
    const near = shuf(r, nameable().filter((x) => x.f !== s.f && x.c !== s.c && Object.keys(parseFormula(x.f)).some((e) => e in parseFormula(s.f))));
    const wr = [...sameKind.slice(0, 4), ...near.slice(0, 3), ...shuf(r, nameable().filter((x) => x.f !== s.f)).slice(0, 3)];
    if (kind === "n2f") return choiceQ({ ...base, key: `val:n2f`, stem: ["下列物质的化学式是：", { u: s.n }], expl: [{ u: s.n }, " 的化学式是 ", { f: s.f }, "。", ...(s.a ? ["（", { u: s.a }, "）"] as Part[] : [])] }, r, [{ f: s.f }], wr.map((x) => [{ f: x.f }] as Part[])) as Q;
    return choiceQ({ ...base, key: `val:f2n`, stem: ["下列化学式表示的物质是：", { f: s.f }], expl: [{ f: s.f }, " 是 ", { u: s.n }, "。", ...(s.a ? ["（", { u: s.a }, "）"] as Part[] : [])] }, r, [{ u: s.n }], wr.map((x) => [{ u: x.n }] as Part[])) as Q;
  }
  if (kind === "mr" || kind === "pct") {
    const pool = D.subs.filter((s) => s.c !== "other" && (lv === 1 ? Object.keys(parseFormula(s.f)).length <= 2 && !s.f.includes("(") && !s.f.includes("·") : lv === 2 ? !s.f.includes("·") : true) && mr(s.f) < 400);
    const s = pick(r, pool);
    const atoms = parseFormula(s.f), els = Object.keys(atoms);
    const calc = els.map((e) => `${num(ar(e))}×${atoms[e]}`).join(" + ");
    if (kind === "mr" || els.length === 1) {
      const m = mr(s.f);
      return { ...base, t: "num", key: "val:mr", kind: "mr", stem: ["计算相对分子质量：", { f: s.f }, "（相对原子质量：", { f: els.map((e) => `${e}=${num(ar(e))}`).join("，") }, "）"], steps: [{ label: ["相对分子质量"], answer: m, tol: 0.001, say: [{ f: `${calc} = ${num(m)}` }] }], expl: ["相对分子质量等于各原子的相对原子质量之和：", { f: `${calc} = ${num(m)}` }, "。"], meta: { f: s.f, m } } as NumQ;
    }
    const e = pick(r, els), m = mr(s.f), p = +(ar(e) * atoms[e] / m * 100).toFixed(1);
    return { ...base, t: "num", key: "val:pct", kind: "pct", stem: ["计算质量分数（%，保留一位小数）：", { f: s.f }, " 中 ", { f: e }, " 的质量分数（相对原子质量：", { f: els.map((x) => `${x}=${num(ar(x))}`).join("，") }, "）"], steps: [{ label: ["质量分数 / %"], answer: p, tol: 0.1, unit: "%", say: [{ f: `${num(ar(e))}×${atoms[e]} ÷ ${num(m)} × 100% = ${p}%` }] }], expl: ["元素的质量分数 = 该元素的相对原子质量之和 ÷ 相对分子质量 × 100%：", { f: `${num(ar(e))}×${atoms[e]} ÷ ${num(m)} × 100% = ${p}%` }, "。"], meta: { f: s.f, e, p } } as NumQ;
  }
  throw new Error("kind " + kind);
}

// ---------- reaction types, conditions, phenomena ----------
const PH_KEYS = ["白色沉淀", "蓝色沉淀", "红褐色沉淀", "气泡", "淡蓝色火焰", "蓝紫色火焰", "蓝色火焰", "火星四射", "白烟", "石蕊溶液，溶液变红", "变黑", "变红", "变蓝", "浅绿色", "变为黄色", "刺激性气味", "水珠", "耀眼", "放出大量的热", "浑浊", "无明显现象"];
const phSet = (t: string) => PH_KEYS.filter((k) => t.includes(k));
const distinctivePh = (rx: Rx) => phSet(rx.ph).length > 0 && rx.ph.length > 6;
const condText = (c: string[]) => c.join("、");
function genType(r: Rnd, lv: number, kind: string, rx: Rx): Q {
  const base = { mode: "type", kind, lv: lv || levelOf(rx), key: `type:${rx.id}` };
  const answerType = rx.type;
  if (kind === "type") {
    const wrongs = TYPES.filter((t) => t !== answerType).map((t) => [TYPE_NAME[t]] as Part[]);
    const q = choiceQ({ ...base, stem: ["判断下面反应的基本类型：", eqP(rx)], expl: [TYPE_NAME[answerType], "。", TYPE_RULE[answerType]] }, r, [TYPE_NAME[answerType]], wrongs, {}, 5);
    q.choices = TYPES.map((t) => [TYPE_NAME[t]] as Part[]); q.right = TYPES.indexOf(answerType);
    return q;
  }
  if (kind === "pick") {
    const pool = D.reactions.filter((x) => x.type !== answerType);
    const others = shuf(r, pool).filter((x, i, a) => a.findIndex((y) => y.type === x.type) === i).slice(0, 3);
    const types = new Set(others.map((x) => x.type));
    const wr = shuf(r, D.reactions.filter((x) => x.type !== answerType && types.has(x.type))).slice(0, 8);
    const right: Part[] = [eqP(rx)];
    return choiceQ({ ...base, key: `type:${rx.id}`, stem: ["下列反应中，属于", TYPE_NAME[answerType], "的是："], expl: [TYPE_NAME[answerType], "。", TYPE_RULE[answerType]] }, r, right, wr.map((x) => [eqP(x)] as Part[])) as Q;
  }
  if (kind === "cond") {
    const mine = condText(rx.cond);
    const combos = new Set<string>(CONDS);
    for (const x of D.reactions) combos.add(condText(x.cond));
    const wr = shuf(r, [...combos].filter((c) => c !== mine)).map((c) => [c] as Part[]);
    return choiceQ({ ...base, stem: ["下面反应发生需要的条件是：", eqP(rx)], expl: ["条件：", condText(rx.cond), "。"] }, r, [mine], wr) as Q;
  }
  // phenomenon
  const mine = phSet(rx.ph);
  const wr = shuf(r, D.reactions.filter((x) => x.ph !== rx.ph && distinctivePh(x) && !phSet(x.ph).some((k) => mine.includes(k)))).filter((x, i, a) => a.findIndex((y) => y.ph === x.ph) === i).map((x) => [{ u: x.ph }] as Part[]);
  return choiceQ({ ...base, stem: ["下面反应的实验现象是：", eqP(rx)], expl: [{ u: rx.ph }] }, r, [{ u: rx.ph }], wr) as Q;
}
export const phEligible = (rx: Rx): boolean => distinctivePh(rx) && D.reactions.filter((x) => x.ph !== rx.ph && distinctivePh(x) && !phSet(x.ph).some((k) => phSet(rx.ph).includes(k))).length >= 6;

// ---------- balancing and writing ----------
function genBal(_r: Rnd, lv: number, rx: Rx): Q {
  return { t: "bal", mode: "bal", kind: "bal", lv: lv || levelOf(rx), key: `bal:${rx.id}`, rx: rx.id, stem: ["配平下面的化学方程式（先让各元素的原子数相等，再检查系数是最简整数比）："], expl: ["配平后：", eqP(rx), "。"] };
}
const COND_SENT: Record<string, string> = { 点燃: "点燃的条件下", 加热: "加热的条件下", 通电: "通电的条件下", 高温: "高温的条件下", 催化剂: "催化剂的作用下", 常温: "", 光照: "光照的条件下" };
export function describeRx(rx: Rx): string {
  const names = (t: Term[]) => t.map((x) => nameOf(x.f)).join("和");
  const conds = rx.cond.map((c) => COND_SENT[c]).filter(Boolean);
  const cs = conds.length ? "在" + conds.join("、").replace(/的条件下/g, "").replace(/的作用下/g, "") + (rx.cond.includes("催化剂") ? "作用下" : "条件下") : "";
  return `${names(rx.l)}${cs}反应，生成${names(rx.r)}。`;
}
function genWrite(r: Rnd, lv: number, rx: Rx): Q {
  const have = new Set([...rx.l, ...rx.r].map((t) => t.f));
  const near = D.subs.filter((s) => !have.has(s.f) && s.c !== "other" && !s.f.includes("·")).filter((s) => Object.keys(parseFormula(s.f)).some((e) => [...have].some((f) => e in parseFormula(f))));
  const extra = shuf(r, near).slice(0, 4).map((s) => s.f);
  return { t: "write", mode: "wr", kind: "write", lv: lv || levelOf(rx), key: `wr:${rx.id}`, rx: rx.id, desc: describeRx(rx), tiles: shuf(r, [...have, ...extra]), stem: ["用下面的化学式组成化学方程式，并配平："], expl: [eqP(rx)] };
}
/** judge a written equation: the same substances on each side, balanced, lowest terms */
export function judgeWrite(rx: Rx, left: { c: number; f: string }[], right: { c: number; f: string }[]): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const set = (t: { f: string }[]) => [...new Set(t.map((x) => x.f))].sort().join("|");
  if (!left.length || !right.length) problems.push("empty");
  const want = (t: Term[]) => [...new Set(t.map((x) => x.f))].sort().join("|");
  if (set(left) !== want(rx.l) || set(right) !== want(rx.r)) problems.push("formulas");
  if (left.length && right.length && !isBalanced(left, right)) problems.push("balance");
  if (!problems.length && !lowestTerms(left, right)) problems.push("lowest");
  return { ok: problems.length === 0, problems };
}

// ---------- calculation by the equation ----------
export interface CalcCase { a: Term; b: Term; given: number; ans: number; m: number }
const nameFree = (t: Term) => !t.f.includes("·");
export function calcCase(r: Rnd, rx: Rx, lv: number): CalcCase | null {
  const all = [...rx.l, ...rx.r].filter(nameFree);
  for (let tries = 0; tries < 40; tries++) {
    const a = pick(r, all), b = pick(r, all);
    if (a === b || a.f === b.f) continue;
    const wa = a.c * mr(a.f), wb = b.c * mr(b.f);
    const m = pick(r, lv >= 3 ? [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2] : [0.1, 0.2, 0.5, 1, 2, 5, 0.25]);
    const given = +(m * wa).toFixed(4), ans = +(m * wb).toFixed(4);
    const dec = (x: number) => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
    if (!dec(given) || !dec(ans) || given < 1 || given > 500 || ans < 0.1 || ans > 500) continue;
    return { a, b, given, ans, m };
  }
  return null;
}
export const calcTol = (ans: number): number => Math.max(0.05, 0.01 * ans);
function genCalc(r: Rnd, lv: number, rx: Rx): Q | null {
  const cc = calcCase(r, rx, lv);
  if (!cc) return null;
  const { a, b } = cc;
  const ma = mr(a.f), mb = mr(b.f), wa = a.c * ma, wb = b.c * mb;
  const side = (t: Term) => (rx.l.includes(t) ? "反应物" : "生成物");
  void side;
  return {
    t: "num", mode: "calc", kind: "calc", lv: lv || levelOf(rx), key: `calc:${rx.id}`,
    stem: ["根据化学方程式计算（相对原子质量见下方；结果保留到小数点后一位或两位）：", eqP(rx), { f: `${a.f}：${num(cc.given)} g，求 ${b.f} 的质量（g）` }],
    steps: [
      { label: ["第 1 步：已知物质的 系数 × 相对分子质量 = ", { f: a.f }], answer: wa, tol: 0.001, say: [{ f: `${a.c} × ${num(ma)} = ${num(wa)}` }] },
      { label: ["第 2 步：所求物质的 系数 × 相对分子质量 = ", { f: b.f }], answer: wb, tol: 0.001, say: [{ f: `${b.c} × ${num(mb)} = ${num(wb)}` }] },
      { label: ["第 3 步：列比例 ", { f: `${num(wa)} : ${num(wb)} = ${num(cc.given)} : x` }, "，求 x（g）"], answer: cc.ans, tol: calcTol(cc.ans), unit: "g", say: [{ f: `x = ${num(cc.given)} × ${num(wb)} ÷ ${num(wa)} = ${num(cc.ans)}` }] },
    ],
    expl: ["质量比等于（系数 × 相对分子质量）之比：", { f: `${num(wa)} : ${num(wb)} = ${num(cc.given)} : x，x = ${num(cc.ans)} g` }, "。"],
    meta: { rx: rx.id, a: a.f, ac: a.c, b: b.f, bc: b.c, given: cc.given, ans: cc.ans },
  };
}

// ---------- solutions ----------
const SOLUTES = [["NaCl", "氯化钠"], ["KNO3", "硝酸钾"], ["NaOH", "氢氧化钠"], ["CuSO4", "硫酸铜"], ["KCl", "氯化钾"]];
function solTable(f: string[]): { head: string[]; rows: string[][] } {
  return { head: ["T / ℃", ...D.solub.T.map(String)], rows: f.map((x) => [x, ...D.solub.d.find((d) => d.f === x)!.v.map(String)]) };
}
function genSol(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "sol", kind, lv: lv || 1, key: `sol:${kind}` };
  const one = (label: Part[], answer: number, tol: number, say: Part[], stem: Part[], expl: Part[], meta: Record<string, unknown>): NumQ => ({ t: "num", ...base, stem, steps: [{ label, answer, tol, say }], expl, meta });
  if (kind === "frac") {
    const total = pick(r, [50, 100, 200, 250, 500]), p = pick(r, [2, 4, 5, 8, 10, 15, 20, 25]);
    const solute = total * p / 100, water = total - solute;
    return one(["质量分数 / %"], p, 0.05, [{ f: `${num(solute)} ÷ ${total} × 100% = ${p}%` }], [`${num(solute)} g 溶质完全溶解在 ${num(water)} g 水中，所得溶液的溶质质量分数是多少（%）？`], ["质量分数 = 溶质质量 ÷ 溶液质量 × 100%，溶液质量 = 溶质质量 + 溶剂质量：", { f: `${num(solute)} ÷ ${total} × 100% = ${p}%` }, "。"], { solute, water, p });
  }
  if (kind === "prep") {
    const [f] = pick(r, SOLUTES), total = pick(r, [50, 100, 150, 200, 250, 500]), p = pick(r, [2, 4, 5, 8, 10, 15, 20]);
    const solute = total * p / 100, water = total - solute, askWater = r() < 0.5;
    const stem: Part[] = [`配制 ${total} g 质量分数为 ${p}% 的 ${f} 溶液，需要${askWater ? "水" : "溶质 " + f}多少 g？`];
    const ans = askWater ? water : solute;
    return one([askWater ? "水的质量 / g" : "溶质的质量 / g"], ans, 0.05, [{ f: askWater ? `${total} − ${num(solute)} = ${num(water)}` : `${total} × ${p}% = ${num(solute)}` }], stem, ["溶质质量 = 溶液质量 × 质量分数 = ", { f: `${total} × ${p}% = ${num(solute)} g` }, "；水的质量 = 溶液质量 − 溶质质量 = ", { f: `${total} − ${num(solute)} = ${num(water)} g` }, "。"], { total, p, solute, water, askWater });
  }
  if (kind === "dilute") {
    const q = pick(r, [2, 4, 5, 10]), k = pick(r, [2, 3, 4, 5]), p = q * k, a = pick(r, [20, 30, 40, 50, 60, 100, 200]);
    const water = a * (k - 1);
    return one(["加入水的质量 / g"], water, 0.05, [{ f: `${a} × ${p}% ÷ ${q}% − ${a} = ${water}` }], [`把 ${a} g 质量分数为 ${p}% 的溶液稀释成质量分数为 ${q}% 的溶液，需要加水多少 g？`], ["稀释前后溶质的质量不变：", { f: `${a} × ${p}% = (${a} + x) × ${q}%，x = ${water} g` }, "。"], { a, p, q, water });
  }
  if (kind === "read" || kind === "sat" || kind === "satfrac") {
    const row = pick(r, kind === "read" ? D.solub.d : D.solub.d.filter((d) => ["KNO3", "NaCl", "NH4Cl", "KCl"].includes(d.f)));
    const ti = ri(r, D.solub.T.length), T = D.solub.T[ti], S = row.v[ti];
    const tbl = solTable(kind === "read" ? D.solub.d.map((d) => d.f) : [row.f]);
    if (kind === "read") {
      const wrongs = row.v.filter((v) => v !== S).map((v) => [{ f: String(v) }] as Part[]);
      return choiceQ({ ...base, stem: [`${T} ℃时，下表中 ${row.f} 的溶解度是多少（g / 100 g 水）？`], expl: [`${T} ℃时 ${row.f} 的溶解度是 ${S} g：在该温度下，100 g 水中最多溶解 ${S} g。`] }, r, [{ f: String(S) }], shuf(r, wrongs), { tbl }) as Q;
    }
    if (kind === "sat") {
      const x = Math.max(1, Math.round(S * pick(r, [0.4, 0.6, 0.8, 1.3, 1.6, 2])));
      if (x === S) return genSol(r, lv, kind);
      const sat = x > S;
      const right = sat ? "饱和溶液，有固体剩余" : "不饱和溶液";
      return choiceQ({ ...base, stem: [`${T} ℃时，把 ${x} g ${row.f} 加入 100 g 水中充分搅拌，得到的溶液是："`.replace(/"$/, "")], expl: [`${T} ℃时 ${row.f} 的溶解度是 ${S} g，100 g 水最多溶解 ${S} g；加入 ${x} g，${sat ? "超过" : "没有超过"} ${S} g，所以是${right}。`] }, r, [right], ["饱和溶液，有固体剩余", "不饱和溶液", "恰好饱和", "无法判断"].filter((c) => c !== right).map((c) => [c] as Part[]), { tbl }) as Q;
    }
    const p = +(S / (100 + S) * 100).toFixed(1);
    return { t: "num", ...base, stem: [`${T} ℃时，${row.f} 饱和溶液的溶质质量分数是多少（%，保留一位小数）？`], steps: [{ label: ["质量分数 / %"], answer: p, tol: 0.1, unit: "%", say: [{ f: `${S} ÷ (100 + ${S}) × 100% = ${p}%` }] }], expl: ["饱和溶液的质量分数 = 溶解度 ÷ (100 + 溶解度) × 100%：", { f: `${S} ÷ ${100 + S} × 100% = ${p}%` }, "。"], meta: { f: row.f, T, S, p } } as NumQ;
  }
  throw new Error("kind " + kind);
}

// ---------- acids, bases, salts: the 复分解 judge ----------
export interface Cmp { cat: string; an: string }
const catIdx = (k: string) => D.ions.cat.indexOf(k);
export const solOf = (cat: string, an: string): string => D.ions.sol[an][catIdx(cat)];
export const cmpFormula = (c: Cmp): string => crossFormula(catByK(c.cat), AN.find((a) => a.k === c.an)!);
export const cmpKind = (c: Cmp): "acid" | "base" | "salt" => (c.cat === "H" ? "acid" : c.an === "OH" ? "base" : "salt");
export function compounds(): Cmp[] {
  const out: Cmp[] = [];
  for (const an of D.ions.an) for (const cat of D.ions.cat) {
    const s = solOf(cat, an);
    if (s === "-" || (cat === "H" && an === "CO3") || (cat === "NH4" && an === "OH")) continue;
    out.push({ cat, an });
  }
  return out;
}
export interface Meta { happens: boolean; reasons: string[]; ambiguous: boolean; products: string[]; why: string }
export function metathesis(a: Cmp, b: Cmp): Meta {
  const ka = cmpKind(a), kb = cmpKind(b);
  const sa = solOf(a.cat, a.an), sb = solOf(b.cat, b.an);
  const usable = (c: Cmp, s: string) => cmpKind(c) === "acid" || s === "s" || s === "v" || (s === "m" && cmpKind(c) === "base");
  const ambiguousIn = (sa === "m" && ka === "salt") || (sb === "m" && kb === "salt");
  const out = (happens: boolean, reasons: string[], products: string[], ambiguous: boolean, why: string): Meta => ({ happens, reasons, ambiguous: ambiguous || ambiguousIn, products, why });
  const swap = (x: Cmp, y: Cmp): [Cmp, Cmp] => [{ cat: x.cat, an: y.an }, { cat: y.cat, an: x.an }];
  const [p1, p2] = swap(a, b);
  const cell = (c: Cmp) => (c.cat === "H" && c.an === "OH" ? "w" : c.cat === "H" && c.an === "CO3" ? "g" : c.cat === "NH4" && c.an === "OH" ? "g" : solOf(c.cat, c.an));
  const c1 = cell(p1), c2 = cell(p2);
  const prod = [p1, p2].map((c) => (c.cat === "H" && c.an === "OH" ? "H2O" : c.cat === "H" && c.an === "CO3" ? "H2CO3" : c.cat === "NH4" && c.an === "OH" ? "NH3·H2O" : cmpFormula(c)));
  const amb = [c1, c2].includes("-");
  if (ka === kb && ka !== "salt") return out(false, [], prod, false, "两种酸或两种碱之间不发生复分解反应。");
  const pair = [ka, kb].sort().join("+");
  if (pair === "acid+base") return out(true, ["water"], prod, amb, "酸与碱发生中和反应，生成水。");
  if (pair === "acid+salt") {
    const salt = ka === "salt" ? a : b, acid = ka === "acid" ? a : b;
    if (salt.an === "CO3") return out(true, ["gas"], [cmpFormula({ cat: salt.cat, an: acid.an }), "H2O", "CO2"], false, "碳酸盐与酸反应，生成二氧化碳气体和水。");
    const ss = solOf(salt.cat, salt.an);
    if (ss !== "s" && ss !== "v") return out(false, [], prod, amb, "不溶于水的盐不能与酸发生反应（碳酸盐除外）。");
    const np = cmpFormula({ cat: salt.cat, an: acid.an }), ns = solOf(salt.cat, acid.an);
    return ns === "i" || ns === "m" ? out(true, ["precipitate"], [np, cmpFormula({ cat: "H", an: salt.an })], amb, "生成了沉淀。") : out(false, [], [np, cmpFormula({ cat: "H", an: salt.an })], amb, "没有沉淀、气体或水生成。");
  }
  if (pair === "base+salt") {
    const base = ka === "base" ? a : b, salt = ka === "base" ? b : a;
    const sbs = solOf(base.cat, base.an), ss = solOf(salt.cat, salt.an);
    if (!usable(base, sbs)) return out(false, [], prod, amb, "不溶于水的碱不能与盐反应。");
    if (ss !== "s" && ss !== "v") return out(false, [], prod, amb, "不溶于水的盐不能与碱反应。");
    const np1 = cmpFormula({ cat: base.cat, an: salt.an }), np2 = salt.cat === "NH4" ? "NH3" : cmpFormula({ cat: salt.cat, an: "OH" });
    const reasons: string[] = [];
    if (salt.cat === "NH4") reasons.push("gas");
    else { const s2 = solOf(salt.cat, "OH"); if (s2 === "i" || s2 === "m") reasons.push("precipitate"); }
    const s1 = solOf(base.cat, salt.an); if (s1 === "i" || s1 === "m") reasons.push("precipitate");
    const rr = [...new Set(reasons)];
    return out(rr.length > 0, rr, [np1, np2], amb || solOf(salt.cat, "OH") === "-", rr.length ? "生成了沉淀或气体。" : "没有沉淀、气体或水生成。");
  }
  // salt + salt
  if (sa !== "s" && sa !== "v") return out(false, [], prod, amb, "不溶于水的盐不能与盐反应。");
  if (sb !== "s" && sb !== "v") return out(false, [], prod, amb, "不溶于水的盐不能与盐反应。");
  const rr = [c1, c2].some((c) => c === "i" || c === "m") ? ["precipitate"] : [];
  return out(rr.length > 0, rr, prod, amb, rr.length ? "生成了沉淀。" : "没有沉淀、气体或水生成。");
}
const REASON_ZH: Record<string, string> = { precipitate: "能反应，生成沉淀", gas: "能反应，生成气体", water: "能反应，生成水" };
function genDec(r: Rnd, lv: number): Q {
  const all = compounds().filter((c) => !(c.cat === "NH4" && c.an === "OH"));
  const gen = lv === 1 ? all.filter((c) => !["Ag", "Fe2", "Fe3", "Al", "Zn", "Mg"].includes(c.cat)) : all;
  for (let tries = 0; tries < 400; tries++) {
    const a = pick(r, gen), b = pick(r, gen);
    if (cmpFormula(a) === cmpFormula(b)) continue;
    const m = metathesis(a, b);
    if (m.ambiguous || m.reasons.length > 1) continue;
    if (tries < 200 && ((m.happens ? 1 : 0) !== (r() < 0.5 ? 1 : 0))) continue;   // about half yes, half no
    const fa = cmpFormula(a), fb = cmpFormula(b);
    const right = m.happens ? REASON_ZH[m.reasons[0]] : "不能反应";
    const names = (c: Cmp) => ({ u: ionName(catByK(c.cat), AN.find((x) => x.k === c.an)!) });
    const eqs: Part[] = m.happens ? ["生成物：", { f: m.products.join(" + ") }, "。"] : [];
    return choiceQ({ mode: "dec", kind: "dec", lv: lv || 2, key: "dec:" + [fa, fb].sort().join("+"), stem: ["判断下面两种物质能否发生复分解反应（两种物质都在溶液中）：", { f: fa }, " + ", { f: fb }, " （", names(a), "、", names(b), "）"], expl: [m.why, ...eqs, "复分解反应的条件：生成物中有沉淀、气体或水，反应物要能溶于水（酸与不溶性碱或碳酸盐反应除外）。"] }, r, [right], ["能反应，生成沉淀", "能反应，生成气体", "能反应，生成水", "不能反应"].filter((c) => c !== right).map((c) => [c] as Part[])) as Q;
  }
  throw new Error("no pair");
}

// ---------- metal activity ----------
export const ACT_METALS: Ion[] = [["Mg", "Mg", 2, "镁"], ["Al", "Al", 3, "铝"], ["Zn", "Zn", 2, "锌"], ["Fe2", "Fe", 2, "亚铁"], ["Cu", "Cu", 2, "铜"], ["Ag", "Ag", 1, "银"]].map(([k, f, ch, n]) => ({ k, f, ch, n } as Ion));
const actIdx = (sym: string) => D.activity.indexOf(sym);
export const reactsWithAcid = (sym: string): boolean => actIdx(sym) < actIdx("H");
export const displaces = (m: string, saltMetal: string): boolean => actIdx(m) < actIdx(saltMetal);
const ANION_BY = (k: string) => AN.find((a) => a.k === k)!;
function genAct(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "act", kind, lv: lv || 2 };
  const sym = (m: Ion) => m.f;
  if (kind === "order") {
    const most = r() < 0.5;
    const four = shuf(r, ACT_METALS).slice(0, 4);
    const sorted = four.slice().sort((a, b) => actIdx(a.f) - actIdx(b.f));
    const right = most ? sorted[0] : sorted[3];
    return choiceQ({ ...base, key: `act:order`, stem: [most ? "下列金属中，活动性最强的是：" : "下列金属中，活动性最弱的是："], expl: ["金属活动性顺序（由强到弱）：", { f: D.activity.join(" ") }, "。"] }, r, [{ f: sym(right) }], four.filter((x) => x !== right).map((x) => [{ f: sym(x) }] as Part[])) as Q;
  }
  if (kind === "notreact") {
    const acid = r() < 0.5 ? "HCl" : "H2SO4";
    const not = pick(r, [ACT_METALS[4], ACT_METALS[5]]);
    const yes = shuf(r, ACT_METALS.slice(0, 4)).slice(0, 3);
    return choiceQ({ ...base, key: `act:notreact`, stem: [`下列金属中，不能与稀${acid === "HCl" ? "盐酸" : "硫酸"}反应放出氢气的是：`], expl: [{ f: sym(not) }, " 排在氢的后面，不能置换出酸中的氢。金属活动性顺序：", { f: D.activity.join(" ") }, "。"] }, r, [{ f: sym(not) }], yes.map((x) => [{ f: sym(x) }] as Part[])) as Q;
  }
  const dec = (cat: Ion, an: Ion): string => crossFormula(cat, an);
  const label = (prod: string[]): string => `能反应，生成 ${prod.join(" 和 ")}`;
  if (kind === "acid") {
    const m = pick(r, ACT_METALS), acid = pick(r, ["HCl", "H2SO4"]);
    const an = ANION_BY(acid === "HCl" ? "Cl" : "SO4");
    const reacts = reactsWithAcid(m.f);
    const salt = dec(m, an);
    const wrongSalt = m.k === "Fe2" ? dec(catByK("Fe3"), an) : m.k === "Al" ? build(m, an, 2, 3 - (an.ch === -2 ? 0 : 0)) : build(m, an, 1, 1);
    const right = reacts ? label([salt, "H2"]) : "不能反应";
    const wrongs = [reacts ? "不能反应" : label([salt, "H2"]), label([wrongSalt, "H2"]), label([salt, "H2O"]), label([salt, "O2"])].filter((x) => x !== right);
    return choiceQ({ ...base, key: `act:acid`, stem: [`${sym(m)} 与稀${acid === "HCl" ? "盐酸" : "硫酸"}混合：`, { f: `${sym(m)} + ${acid}` }], expl: [reacts ? [sym(m), " 排在氢的前面，能置换出酸中的氢：", { f: `${sym(m)} + ${acid} → ${salt} + H2` }, m.k === "Fe2" ? "。铁与酸反应生成亚铁盐（+2 价）。" : "。"] : [sym(m), " 排在氢的后面，不能与稀酸反应。"]].flat() as Part[] }, r, [right], wrongs.map((x) => [{ f: x.replace(/^能反应，生成 /, "") === x ? "" : "" } as Part].length ? [x] : [x])) as Q;
  }
  // a metal in a salt solution
  const m = pick(r, ACT_METALS), s = pick(r, ACT_METALS.filter((x) => x !== m));
  const anSalt = ANION_BY(pick(r, s.k === "Ag" ? ["NO3"] : ["SO4", "Cl", "NO3"]));
  const saltF = dec(s, anSalt), prodF = dec(m, anSalt);
  const reacts = displaces(m.f, s.f);
  const right = reacts ? label([prodF, s.f]) : "不能反应";
  const badProd = m.k === "Fe2" ? dec(catByK("Fe3"), anSalt) : build(m, anSalt, 1, 1);
  const rev = label([dec(s, anSalt) === saltF ? dec(m, anSalt) : prodF, s.f]);
  const wrongs = [reacts ? "不能反应" : rev, label([badProd === prodF ? build(m, anSalt, 2, 1) : badProd, s.f]), label([prodF, "H2"]), label([saltF, m.f])].filter((x) => x !== right);
  return choiceQ({ ...base, key: `act:salt`, stem: [`${m.f} 放入 ${saltF} 溶液中：`, { f: `${m.f} + ${saltF}` }], expl: [reacts ? [m.f, " 比 ", s.f, " 活泼，能把 ", s.f, " 从盐溶液中置换出来：", { f: `${m.f} + ${saltF} → ${prodF} + ${s.f}` }, "。"] : [m.f, " 不如 ", s.f, " 活泼，不能把 ", s.f, " 从盐溶液中置换出来，不反应。"], "金属活动性顺序：", { f: D.activity.join(" ") }, "。"].flat() as Part[] }, r, [right], wrongs.map((x) => [x])) as Q;
}

// ---------- classification ----------
export const BUCKETS: Record<string, string> = { elem: "单质", oxide: "氧化物", acid: "酸", base: "碱", salt: "盐", mix: "混合物", org: "有机物" };
export function classPool(): { id: string; f?: string; n: string; cat: string }[] {
  return [...D.subs.filter((s) => s.c !== "other").map((s) => ({ id: s.f, f: s.f, n: s.n, cat: s.c })), ...D.mix.map((m) => ({ id: "mix:" + m.n, n: m.n, cat: "mix" }))];
}
function genClass(r: Rnd, lv: number): Q {
  const bk = lv === 1 ? ["elem", "oxide", "acid", "base", "salt"] : lv === 2 ? ["elem", "oxide", "acid", "base", "salt", "mix"] : ["elem", "oxide", "acid", "base", "salt", "mix", "org"];
  const buckets = lv === 0 ? shuf(r, ["elem", "oxide", "acid", "base", "salt", "mix"]).slice(0, 5) : bk.length > 6 ? shuf(r, bk).slice(0, 6) : bk;
  const pool = classPool().filter((x) => buckets.includes(x.cat));
  const items: ReturnType<typeof classPool> = [];
  const per = Math.ceil(8 / buckets.length);
  for (const b of shuf(r, buckets)) items.push(...shuf(r, pool.filter((x) => x.cat === b)).slice(0, items.length + per > 8 ? 8 - items.length : per));
  while (items.length < 8) { const x = pick(r, pool); if (!items.includes(x)) items.push(x); }
  return { t: "class", mode: "cls", kind: "class", lv: lv || 2, key: "cls:" + items.map((x) => x.id).sort().join(","), items: shuf(r, items).slice(0, 8), buckets: BUCKETS && buckets, stem: ["把下面的物质拖到所属的类别中（也可以先点物质，再点类别）。"], expl: ["纯净物分为单质和化合物；由两种元素组成、其中一种是氧的化合物是氧化物；酸、碱、盐是电离出的离子不同的三类化合物；混合物由多种物质组成。"] };
}

// ---------- indicators and pH ----------
export const acidity = (v: number): "acid" | "neutral" | "base" => (v < 7 ? "acid" : v > 7 ? "base" : "neutral");
const ACID_ZH: Record<string, string> = { acid: "酸性", neutral: "中性", base: "碱性" };
function genInd(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "ind", kind, lv: lv || 1, key: `ind:${kind}` };
  if (kind === "color") {
    const ind = pick(r, D.indicators), med = pick(r, ["acid", "neutral", "base"] as const);
    const right = ind[med];
    const colors = ["红色", "紫色", "蓝色", "无色", "黄色", "绿色"];
    return choiceQ({ ...base, stem: [{ u: ind.n }, `遇到${ACID_ZH[med]}溶液显示的颜色是：`], expl: [{ u: ind.n }, `：酸性 ${ind.acid}，中性 ${ind.neutral}，碱性 ${ind.base}。`] }, r, [right], colors.filter((c) => c !== right).map((c) => [c] as Part[])) as Q;
  }
  if (kind === "acidity") {
    const it = pick(r, D.ph), right = ACID_ZH[acidity(it.v)];
    return choiceQ({ ...base, stem: [{ u: it.n }, ` 的 pH 约为 ${it.v}，它是：`], expl: ["pH < 7 显酸性，pH = 7 显中性，pH > 7 显碱性。pH 约为 ", { f: String(it.v) }, "，所以显", right, "。"] }, r, [right], ["酸性", "中性", "碱性"].filter((c) => c !== right).map((c) => [c] as Part[]), {}, 3) as Q;
  }
  if (kind === "more") {
    const two = shuf(r, D.ph).slice(0, 4).sort((a, b) => a.v - b.v);
    if (new Set(two.map((x) => x.v)).size < 4) return genInd(r, lv, kind);
    const acid = r() < 0.5, right = acid ? two[0] : two[3];
    return choiceQ({ ...base, stem: [acid ? "下列溶液中，酸性最强的是：" : "下列溶液中，碱性最强的是："], expl: [acid ? "pH 越小，酸性越强。" : "pH 越大，碱性越强。", { u: right.n }, " 的 pH 约为 ", { f: String(right.v) }, "。"] }, r, [{ u: right.n }], two.filter((x) => x !== right).map((x) => [{ u: x.n }] as Part[])) as Q;
  }
  if (kind === "red") {
    const baseOnes = D.ph.filter((x) => x.v > 7), others = D.ph.filter((x) => x.v <= 7);
    const right = pick(r, baseOnes);
    return choiceQ({ ...base, stem: ["下列溶液中，能使无色酚酞溶液变红的是："], expl: ["无色酚酞溶液遇碱性溶液变红，遇酸性或中性溶液不变色。", { u: right.n }, " 显碱性（pH 约为 ", { f: String(right.v) }, "）。"] }, r, [{ u: right.n }], shuf(r, others).slice(0, 3).map((x) => [{ u: x.n }] as Part[])) as Q;
  }
  const cases: [string, string, string][] = [
    ["向稀盐酸中不断滴加氢氧化钠溶液，溶液的 pH 变化是：", "逐渐增大", "酸被中和，酸性减弱，pH 增大；恰好中和时 pH = 7，氢氧化钠过量后 pH 大于 7。"],
    ["向氢氧化钠溶液中不断滴加稀盐酸，溶液的 pH 变化是：", "逐渐减小", "碱被中和，碱性减弱，pH 减小；恰好中和时 pH = 7，盐酸过量后 pH 小于 7。"],
    ["向稀盐酸中加水稀释，溶液的 pH 变化是：", "逐渐增大，但始终小于 7", "酸性减弱，pH 增大，但稀释不能使酸变成碱，pH 只会无限接近 7。"],
    ["向氢氧化钠溶液中加水稀释，溶液的 pH 变化是：", "逐渐减小，但始终大于 7", "碱性减弱，pH 减小，但稀释不能使碱变成酸，pH 只会无限接近 7。"],
    ["酸雨是指 pH 小于多少的雨水：", "5.6", "正常雨水溶有二氧化碳，pH 约为 5.6；pH 小于 5.6 的雨水叫酸雨。"],
  ];
  const [q, right, why] = pick(r, cases);
  const pool = ["逐渐增大", "逐渐减小", "不变", "逐渐增大，但始终小于 7", "逐渐减小，但始终大于 7", "先增大后减小", "7", "5.6", "6.5", "4.5"];
  const wr = right === "5.6" ? ["7", "6.5", "4.5"] : pool.slice(0, 6).filter((x) => x !== right && (!right.includes("始终") || !x.includes("始终") || true));
  return choiceQ({ ...base, key: "ind:change", kind: "change", stem: [q], expl: [why] }, r, [right], wr.map((x) => [x])) as Q;
}

// ---------- gases ----------
export function genGas(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "gas", kind, lv: lv || 2, key: `gas:${kind}` };
  const g = pick(r, D.gases);
  if (kind === "react") {
    const rxe = pick(r, g.rx), rx = D.reactions.find((x) => x.eq === rxe)!;
    const label = (t: Term[]) => t.map((x) => nameOf(x.f)).join("和");
    const right = rx.l.length > 1 || rx.l.length === 1 ? label(rx.l) : "";
    const wrongs = [...g.bad.map((b) => b[0]), ...D.gases.filter((x) => x !== g).map((x) => label(D.reactions.find((y) => y.eq === x.rx[0])!.l))];
    const why = g.bad.map((b) => b[1]);
    return choiceQ({ ...base, stem: ["实验室制取", { f: g.f }, "（", { u: g.n }, "）可以选用的药品是："], expl: [eqP(rx), "。", ...why.length ? ["其他药品不合适：", { u: g.bad.map((b) => b[0] + "：" + b[1]).join(" ") }] as Part[] : []] }, r, [{ u: right }], wrongs.filter((x) => x !== right).map((x) => [{ u: x }] as Part[])) as Q;
  }
  if (kind === "gen") {
    const rxe = pick(r, g.rx), rx = D.reactions.find((x) => x.eq === rxe)!, right = g.gen[rxe];
    const solid = right === "A";
    return choiceQ({ ...base, stem: ["用下面的反应制取", { f: g.f }, "，应选用的发生装置是：", eqP(rx)], expl: [solid ? "反应物是固体，需要加热：选用装置 A（固体加热型）。" : "反应物是固体和液体，不需要加热：选用装置 B（固液常温型）。"] }, r, [right], [["A", "B"].find((x) => x !== right)!].map((x) => [x] as Part[]), { fig: "AB" }, 2) as Q;
  }
  if (kind === "col") {
    const dry = r() < 0.5 && g.f !== "CO2";
    const want = g.f === "CO2" ? "D" : dry ? (g.col.includes("E") ? "E" : "D") : "C";
    const phrase = g.f === "CO2" ? "收集" : dry ? "收集较干燥的" : "收集较纯净的";
    return choiceQ({ ...base, stem: [phrase, { f: g.f }, "（", { u: g.n }, "）应选用的收集装置是："], expl: [g.why, `装置 ${want}：${want === "C" ? "排水法" : want === "D" ? "向上排空气法" : "向下排空气法"}。`] }, r, [want], ["C", "D", "E"].filter((x) => x !== want).map((x) => [x] as Part[]), { fig: "CDE" }, 3) as Q;
  }
  if (kind === "test") {
    return choiceQ({ ...base, stem: ["检验", { f: g.f }, "（", { u: g.n }, "）的方法是："], expl: [{ u: g.test }] }, r, [{ u: g.test }], D.gases.filter((x) => x !== g).map((x) => [{ u: x.test }] as Part[]), {}, 3) as Q;
  }
  return choiceQ({ ...base, key: "gas:full", kind: "full", stem: ["怎样证明", { f: g.f }, "（", { u: g.n }, "）已经收集满："], expl: [{ u: g.full }] }, r, [{ u: g.full }], D.gases.filter((x) => x !== g).map((x) => [{ u: x.full }] as Part[]), {}, 3) as Q;
}

// ---------- rounds ----------
export const ROUND = 10;
export function makeQ(mode: string, kind: string, r: Rnd, lv: number, rx?: Rx): Q | null {
  switch (mode) {
    case "bal": return genBal(r, lv, rx!);
    case "wr": return genWrite(r, lv, rx!);
    case "val": return genVal(r, lv, kind);
    case "type": return genType(r, lv, kind, rx!);
    case "calc": return genCalc(r, lv, rx!);
    case "sol": return genSol(r, lv, kind);
    case "dec": return genDec(r, lv);
    case "act": return genAct(r, lv, kind);
    case "cls": return genClass(r, lv);
    case "ind": return genInd(r, lv, kind);
    case "gas": return genGas(r, lv, kind);
  }
  return null;
}
export interface Progress { cards: Record<string, G.Card>; plays: number; last?: { date: string; score: number; total: number }; lv: number }
export const EMPTY_PROGRESS: Progress = { cards: {}, plays: 0, lv: 0 };
export const STORE_KEY = "learn.chem.v1";
export function loadProgress(): Progress {
  try { const o = JSON.parse(localStorage.getItem(STORE_KEY) ?? "null"); if (o && typeof o === "object" && o.cards) return { cards: o.cards, plays: o.plays ?? 0, last: o.last, lv: o.lv ?? 0 }; } catch { /* no storage */ }
  return { cards: {}, plays: 0, lv: 0 };
}
export function saveProgress(p: Progress): void { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch { /* no storage */ } }
export function applyAnswers(p: Progress, answers: { key: string; right: boolean }[], today: string, summary?: { score: number; total: number }): Progress {
  const cards = { ...p.cards };
  for (const a of answers) cards[a.key] = G.applyOutcome(cards[a.key], a.right, false, today);
  return { ...p, cards, plays: p.plays + (summary ? 1 : 0), last: summary ? { date: today, ...summary } : p.last };
}
/** due first, then never asked, then the known ones (least known first) */
export function selectIds(ids: string[], keyOf: (id: string) => string, p: Progress, today: string, n: number, r: Rnd, avoid?: string): string[] {
  const card = (id: string) => p.cards[keyOf(id)];
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const list = ids.filter((i) => i !== avoid);
  const due = list.filter((i) => card(i) && card(i).due <= today).sort((a, b) => card(a).box - card(b).box || cmp(card(a).due, card(b).due) || r() - 0.5);
  const fresh = shuf(r, list.filter((i) => !card(i)));
  const known = list.filter((i) => card(i) && card(i).due > today).sort((a, b) => card(a).box - card(b).box || r() - 0.5);
  return shuf(r, [...due, ...fresh, ...known].slice(0, n));
}
export const eligible = (mode: string, lv: number): Rx[] => {
  const lvOk = (x: Rx) => !lv || levelOf(x) === lv;
  if (mode === "type") return D.reactions.filter(lvOk);
  return D.reactions.filter((x) => lvOk(x) && (mode !== "calc" || calcCase(rng(1), x, 2) !== null));
};
/** a round of `n` questions of a mode */
export function buildRound(mode: string, lv: number, seed: number, p: Progress, today: string, n = ROUND, avoid?: string): Q[] {
  const r = rng(seed), m = modeOf(mode);
  const out: Q[] = [];
  if (m.byRx) {
    let pool = eligible(mode, lv);
    if (pool.length < n && lv) pool = eligible(mode, 0);
    const ids = selectIds(pool.map((x) => x.id), (id) => `${mode}:${id}`, p, today, n, r, avoid);
    const kinds = shuf(r, m.kinds);
    ids.forEach((id, i) => {
      const rx = rxById(id)!;
      let kind = kinds[i % kinds.length];
      if (mode === "type" && kind === "ph" && !phEligible(rx)) kind = "type";
      const q = makeQ(mode, kind, r, lv, rx);
      if (q) out.push(q);
    });
    return out;
  }
  const kinds = shuf(r, m.kinds);
  const seen = new Set<string>();
  for (let i = 0, tries = 0; out.length < n && tries < 400; tries++) {
    const q = makeQ(mode, kinds[i % kinds.length], r, lv);
    if (!q) continue;
    const k = JSON.stringify([q.stem, q.t === "choice" ? q.choices : q.t === "class" ? q.items.map((x) => x.id) : 0]);
    if (seen.has(k)) continue;
    seen.add(k); out.push(q); i++;
  }
  return out;
}
export function checkChoiceQ(q: ChoiceQ): string[] {
  const bad: string[] = [];
  const keys = q.choices.map((c) => partKey(c));
  if (new Set(keys).size !== keys.length) bad.push("duplicate choices");
  if (q.right < 0 || q.right >= q.choices.length) bad.push("no right choice");
  return bad;
}
