/**
 * 化学 part 2 (pure): solubility curves, solutions with density / mixing, and the advanced calculations by the equation (gas volume, purity, yield, mass loss,
 * the solution left after a reaction, an excess reactant). Questions are made on the spot from the data and a seed; the figure of a question is a `Spec`
 * (drawn by `chemfig2.ts`), so the numbers a figure shows can be read back by the tests.
 */
import * as L from "./chemlogic";
import type { Part, Q, NumQ, Rnd, Rx, Term } from "./chemlogic";

// (the helpers of chemlogic.ts are reached through small wrappers: the two modules import each other, so nothing may be read from `L` while this file is loading)
const ri = (r: Rnd, n: number): number => L.ri(r, n);
const pick = <T,>(r: Rnd, a: readonly T[]): T => L.pick(r, a);
const shuf = <T,>(r: Rnd, a: readonly T[]): T[] => L.shuf(r, a);
const choiceQ: typeof L.choiceQ = (...a) => L.choiceQ(...a);
const wrap = (xs: string[]): Part[][] => L.wrap(xs);
const fWrap = (xs: string[]): Part[][] => L.fWrap(xs);
const sub = (f: string): string => L.sub(f);
const num = (x: number): string => L.num(x);
const mr = (f: string): number => L.mr(f);
const eqP = (rx: Rx): Part => L.eqP(rx);

// ---------- solubility curves ----------
const CURVE_SUBS = ["KNO3", "NaCl", "NH4Cl", "KCl"];
const sv = (f: string, ti: number): number => L.data().solub.d.find((d) => d.f === f)!.v[ti];
const Tg = (): number[] => L.data().solub.T;
const COOL = "降温结晶（冷却热饱和溶液）", EVAP = "蒸发结晶（蒸发溶剂）", HEAT = "升高温度", FILT = "过滤", DIST = "蒸馏";
export const STEEP = (f: string): number => sv(f, 5) / sv(f, 1);
/** how a substance is got out of its solution: a steep curve = cooling, a flat one = evaporation, a falling one = heating */
export function crystallise(f: string): string | null {
  const d = L.data().solub.d.find((x) => x.f === f)!.v;
  if (d[5] < d[0]) return HEAT;
  const k = d[5] / d[1];
  return k >= 2.5 ? COOL : k <= 1.3 ? EVAP : null;
}
export const CURVE_STEEP = ["KNO3", "CuSO4"], CURVE_FLAT = ["NaCl"];
const rangeTxt = (i: number): string => `${Tg()[i]}～${Tg()[i + 1]} ℃`;

export function genCurve(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "curve", kind, lv: lv || 1, key: `curve:${kind}` };
  const T = Tg();
  if (kind === "read") {
    const s = pick(r, ["KNO3", "NH4Cl", "KCl"]), ti = 1 + ri(r, 5), S = sv(s, ti);
    const others = shuf(r, CURVE_SUBS.filter((x) => x !== s)).slice(0, 1 + ri(r, 2));
    const wr = shuf(r, [0.55, 0.7, 1.35, 1.6, 2]).slice(0, 3).map((k) => +(S * k).toFixed(1));
    return choiceQ({ ...base, stem: [`根据图中的溶解度曲线，${T[ti]} ℃时 ${sub(s)} 的溶解度约为多少（g / 100 g 水）？`], expl: [`在横坐标 ${T[ti]} ℃处向上找到 ${sub(s)} 的曲线，再向左读纵坐标：约 ${S} g，即 ${T[ti]} ℃时 100 g 水最多溶解 ${S} g ${sub(s)}。`] }, r, [{ f: String(S) }], fWrap(wr.map(String)), { spec: { k: "curve", subs: [s, ...others], marks: [{ T: T[ti], S: 0, n: "" }] }, meta: { s, T: T[ti], S } }) as Q;
  }
  if (kind === "cmp") {
    for (let t = 0; t < 200; t++) {
      const trio = shuf(r, CURVE_SUBS).slice(0, 3), ti = 1 + ri(r, 5);
      const vals = trio.map((f) => sv(f, ti)).sort((a, b) => a - b);
      if (vals[1] - vals[0] < 3 || vals[2] - vals[1] < 3) continue;
      const order = trio.slice().sort((a, b) => sv(b, ti) - sv(a, ti));
      const txt = (o: string[]) => o.join(" > ");
      const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map((p) => p.map((i) => trio[i]));
      return choiceQ({ ...base, lv: lv || 2, stem: [`${T[ti]} ℃时，图中三种物质的溶解度由大到小的顺序是：`], expl: [`在 ${T[ti]} ℃处作竖线，与三条曲线的交点由高到低的顺序，就是溶解度由大到小的顺序：`, { f: txt(order) }] }, r, [{ f: txt(order) }], shuf(r, perms.map(txt)).map((x) => [{ f: x }]), { spec: { k: "curve", subs: trio, marks: [{ T: T[ti], S: 0, n: "" }] }, meta: { T: T[ti], order } }) as Q;
    }
    throw new Error("no trio");
  }
  if (kind === "pt") {
    const s = pick(r, CURVE_SUBS), ti = 1 + ri(r, 5), S = sv(s, ti), which = ri(r, 3);
    const x = which === 0 ? Math.max(1, Math.round(S * 0.6)) : which === 1 ? S : Math.round(S * 1.4);
    const A = "不饱和溶液", B = "恰好饱和的溶液", C = "饱和溶液，且有固体未溶解";
    const right = which === 0 ? A : which === 1 ? B : C;
    return choiceQ({ ...base, stem: [`图中点 P 表示：${T[ti]} ℃时，100 g 水中溶解了 ${x} g ${sub(s)} 所形成的溶液。它是：`], expl: [which === 0 ? `点 P 在曲线的下方：${x} g 小于 ${T[ti]} ℃时的溶解度 ${S} g，所以是不饱和溶液。` : which === 1 ? `点 P 在曲线上：${x} g 等于 ${T[ti]} ℃时的溶解度，恰好饱和。` : `点 P 在曲线的上方：${x} g 大于 ${T[ti]} ℃时的溶解度 ${S} g，多出来的溶质不能溶解，得到饱和溶液，且有固体未溶解。`] }, r, [right], wrap([A, B, C].filter((c) => c !== right)), { spec: { k: "curve", subs: [s], marks: [{ T: T[ti], S: x, n: "P" }] }, meta: { s, T: T[ti], x, S, which } }, 3) as Q;
  }
  if (kind === "cool") {
    const s = pick(r, ["KNO3", "NH4Cl", "KCl"]), i2 = ri(r, 3), i1 = i2 + 1 + ri(r, 5 - i2);
    const m = pick(r, [50, 100, 200, 250]), d = +(sv(s, i1) - sv(s, i2)).toFixed(2), ans = +(m * d / 100).toFixed(3);
    return { t: "num", ...base, lv: lv || 3, stem: [`${sub(s)} 的溶解度：${T[i1]} ℃时为 ${num(sv(s, i1))} g，${T[i2]} ℃时为 ${num(sv(s, i2))} g。${T[i1]} ℃时，${m} g 水中溶解 ${sub(s)} 恰好饱和，把这份饱和溶液降温到 ${T[i2]} ℃，最多析出晶体多少 g？`], spec: { k: "curve", subs: [s], marks: [] }, steps: [{ label: [`第 1 步：每 100 g 水析出晶体的质量（g）= ${T[i1]} ℃与 ${T[i2]} ℃的溶解度之差`], answer: d, tol: 0.06, say: [{ f: `${num(sv(s, i1))} − ${num(sv(s, i2))} = ${num(d)}` }] }, { label: [`第 2 步：${m} g 水析出晶体的质量（g）`], answer: ans, tol: L.calcTol(ans), unit: "g", say: [{ f: `${num(d)} × ${m} ÷ 100 = ${num(ans)}` }] }], expl: ["降温时溶剂的质量不变，析出的晶体质量 = 溶解度之差 × 水的质量 ÷ 100：", { f: `(${num(sv(s, i1))} − ${num(sv(s, i2))}) × ${m} ÷ 100 = ${num(ans)} g` }], meta: { s, T1: T[i1], T2: T[i2], m, ans } } as NumQ;
  }
  if (kind === "how") {
    const s = pick(r, ["KNO3", "NaCl", "Ca(OH)2", "CuSO4"]), right = crystallise(s)!;
    const spec = s === "Ca(OH)2" ? undefined : { k: "curve" as const, subs: s === "CuSO4" ? ["CuSO4", "NaCl"] : ["KNO3", "NaCl"], marks: [] };
    return choiceQ({ ...base, stem: [`要从 ${sub(s)} 的饱和溶液中得到较多的晶体，较好的方法是：`], expl: [right === COOL ? `${sub(s)} 的溶解度随温度升高明显增大（曲线陡），冷却热饱和溶液时析出大量晶体。` : right === EVAP ? `${sub(s)} 的溶解度受温度影响很小（曲线平缓），降温析出很少，应蒸发溶剂。` : `${sub(s)} 的溶解度随温度升高而减小，升高温度时晶体析出。`] }, r, [right], wrap([COOL, EVAP, HEAT, FILT].filter((c) => c !== right)), { spec, meta: { s, right } }) as Q;
  }
  if (kind === "purify") {
    const a = pick(r, [...CURVE_STEEP, ...CURVE_FLAT]), pool = CURVE_STEEP.includes(a) ? CURVE_FLAT : CURVE_STEEP, b = pick(r, pool);
    const right = CURVE_STEEP.includes(a) ? COOL : EVAP;
    return choiceQ({ ...base, lv: lv || 2, stem: [`${sub(a)} 中混有少量的 ${sub(b)}，提纯 ${sub(a)} 应采用的方法是：`], expl: [CURVE_STEEP.includes(a) ? `${sub(a)} 的溶解度受温度影响大，${sub(b)} 受温度影响小：把混合物配成热的饱和溶液，降温时 ${sub(a)} 大量析出，少量的 ${sub(b)} 仍留在溶液中。` : `${sub(a)} 的溶解度受温度影响小，${sub(b)} 受温度影响大：蒸发溶剂时 ${sub(a)} 析出，少量的 ${sub(b)} 留在溶液里。`] }, r, [right], wrap([COOL, EVAP, FILT, DIST].filter((c) => c !== right)), { spec: { k: "curve", subs: [a, b], marks: [] }, meta: { a, b, right } }) as Q;
  }
  // cross
  const pairs: [string, string, number][] = [];
  for (let i = 0; i < CURVE_SUBS.length; i++) for (let j = i + 1; j < CURVE_SUBS.length; j++) {
    const a = CURVE_SUBS[i], b = CURVE_SUBS[j], idx: number[] = [];
    for (let k = 0; k < T.length - 1; k++) if ((sv(a, k) - sv(b, k)) * (sv(a, k + 1) - sv(b, k + 1)) < 0) idx.push(k);
    if (idx.length === 1) pairs.push([a, b, idx[0]]);
  }
  const [a, b, k] = pick(r, pairs);
  const wr = shuf(r, [0, 1, 2, 3, 4].filter((i) => i !== k)).slice(0, 3).map((i) => rangeTxt(i));
  return choiceQ({ ...base, lv: lv || 2, stem: [`${sub(a)} 和 ${sub(b)} 的溶解度曲线相交，交点所在的温度范围是：`], expl: [`在 ${rangeTxt(k)} 之间，两种物质溶解度的大小关系发生了变化，所以两条曲线在这个范围内相交；交点处两种物质的溶解度相等。`] }, r, [{ u: rangeTxt(k) }], wr.map((x) => [{ u: x }]), { spec: { k: "curve", subs: [a, b], marks: [] }, meta: { a, b, k } }) as Q;
}

// ---------- solutions: density, mixing, adding ----------
export function genSol2(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "sol", kind, lv: lv || 2, key: `sol:${kind}` };
  const D = L.data().more;
  if (kind === "dens") {
    const v = ri(r, 3);
    if (v === 0) {
      const row = pick(r, D.dens.filter((d) => d[2] >= 30)), [f, n, P, d] = row;
      void n;
      const M = pick(r, [50, 100, 200, 250, 500]), p = pick(r, [5, 10, 20, 25].filter((x) => x < P));
      const solute = M * p / 100, mass = M * p / P, V = mass / d;
      return { t: "num", ...base, stem: [`用质量分数为 ${P}%、密度为 ${d} g/mL 的${row[1]}（溶质 ${sub(f)}）配制 ${M} g 质量分数为 ${p}% 的稀溶液，需要浓溶液多少 mL？（保留一位小数）`], steps: [
        { label: ["第 1 步：稀溶液中溶质的质量（g）"], answer: solute, tol: 0.05, say: [{ f: `${M} × ${p}% = ${num(solute)}` }] },
        { label: ["第 2 步：需要浓溶液的质量（g）"], answer: mass, tol: L.calcTol(mass), say: [{ f: `${num(solute)} ÷ ${P}% = ${num(mass)}` }] },
        { label: ["第 3 步：需要浓溶液的体积（mL）"], answer: V, tol: Math.max(0.1, V * 0.01), unit: "mL", say: [{ f: `${num(mass)} ÷ ${d} = ${num(V)}` }] }],
      expl: ["稀释前后溶质的质量不变；体积 = 质量 ÷ 密度：", { f: `${M} × ${p}% ÷ ${P}% ÷ ${d} = ${num(V)} mL` }], meta: { v: "conc", P, d, M, p, V } } as NumQ;
    }
    if (v === 1) {
      const row = pick(r, D.dens.filter((x) => x[2] <= 20)), [f, , p, d] = row, V = pick(r, [50, 100, 200, 250, 500]);
      const m = V * d, solute = m * p / 100;
      return { t: "num", ...base, stem: [`${V} mL 质量分数为 ${p}%、密度为 ${d} g/mL 的${row[1]}（溶质 ${sub(f)}），其中含溶质多少 g？`], steps: [
        { label: ["第 1 步：溶液的质量（g）= 体积 × 密度"], answer: m, tol: L.calcTol(m), say: [{ f: `${V} × ${d} = ${num(m)}` }] },
        { label: ["第 2 步：溶质的质量（g）"], answer: solute, tol: L.calcTol(solute), unit: "g", say: [{ f: `${num(m)} × ${p}% = ${num(solute)}` }] }],
      expl: ["溶液质量 = 体积 × 密度；溶质质量 = 溶液质量 × 质量分数：", { f: `${V} × ${d} × ${p}% = ${num(solute)} g` }], meta: { v: "solute", p, d, V, solute } } as NumQ;
    }
    const f = pick(r, ["NaCl", "KNO3", "NaOH"]), x = pick(r, [5, 10, 20, 25]), V = pick(r, [40, 45, 75, 80, 90, 100, 150]), p = +(x / (x + V) * 100).toFixed(1);
    return { t: "num", ...base, stem: [`把 ${x} g ${sub(f)} 溶于 ${V} mL 水（水的密度为 1 g/mL）中，所得溶液的溶质质量分数是多少（%，保留一位小数）？`], steps: [
      { label: ["第 1 步：水的质量（g）"], answer: V, tol: 0.01, say: [{ f: `${V} mL × 1 g/mL = ${V} g` }] },
      { label: ["第 2 步：质量分数（%）"], answer: p, tol: 0.1, unit: "%", say: [{ f: `${x} ÷ (${x} + ${V}) × 100% = ${p}%` }] }],
    expl: ["水的密度是 1 g/mL，所以 1 mL 水的质量是 1 g；溶液质量 = 溶质质量 + 水的质量：", { f: `${x} ÷ ${x + V} × 100% = ${p}%` }], meta: { v: "water", x, V, p } } as NumQ;
  }
  if (kind === "mix") {
    for (let t = 0; t < 400; t++) {
      const a = pick(r, [50, 100, 150, 200, 300]), b = pick(r, [50, 100, 150, 200, 300]), p = pick(r, [5, 8, 10, 12, 15, 20]), q = pick(r, [20, 25, 30, 40, 50]);
      const ans = (a * p + b * q) / (a + b);
      if (q <= p || Math.abs(ans * 10 - Math.round(ans * 10)) > 1e-9) continue;
      return { t: "num", ...base, stem: [`把 ${a} g 质量分数为 ${p}% 的氯化钠溶液与 ${b} g 质量分数为 ${q}% 的氯化钠溶液混合，所得溶液的溶质质量分数是多少（%）？`], steps: [
        { label: ["第 1 步：混合后溶质的总质量（g）"], answer: (a * p + b * q) / 100, tol: 0.05, say: [{ f: `${a} × ${p}% + ${b} × ${q}% = ${num((a * p + b * q) / 100)}` }] },
        { label: ["第 2 步：混合后溶质的质量分数（%）"], answer: ans, tol: 0.1, unit: "%", say: [{ f: `${num((a * p + b * q) / 100)} ÷ ${a + b} × 100% = ${num(ans)}%` }] }],
      expl: ["混合前后溶质的总质量不变，溶液的总质量也相加：", { f: `(${a} × ${p}% + ${b} × ${q}%) ÷ (${a} + ${b}) × 100% = ${num(ans)}%` }], meta: { a, b, p, q, ans } } as NumQ;
    }
    throw new Error("no mix");
  }
  // conc: add solute / evaporate water
  for (let t = 0; t < 400; t++) {
    const a = pick(r, [50, 100, 150, 200, 250]), p = pick(r, [5, 8, 10, 12, 15, 20]), add = r() < 0.5;
    if (add) {
      const x = pick(r, [5, 10, 15, 20, 25, 30]), ans = (a * p / 100 + x) / (a + x) * 100;
      if (Math.abs(ans * 10 - Math.round(ans * 10)) > 1e-9) continue;
      return { t: "num", ...base, stem: [`在 ${a} g 质量分数为 ${p}% 的氯化钠溶液中，再加入 ${x} g 氯化钠，完全溶解后，溶液的溶质质量分数是多少（%）？`], steps: [{ label: ["溶质质量分数（%）"], answer: ans, tol: 0.1, unit: "%", say: [{ f: `(${a} × ${p}% + ${x}) ÷ (${a} + ${x}) × 100% = ${num(ans)}%` }] }], expl: ["加入溶质后，溶质和溶液的质量都增加了同样的质量：", { f: `(${a} × ${p}% + ${x}) ÷ (${a} + ${x}) × 100% = ${num(ans)}%` }], meta: { add: true, a, p, x, ans } } as NumQ;
    }
    const w = pick(r, [10, 20, 25, 40, 50, 75, 100]);
    if (w >= a) continue;
    const ans = a * p / (a - w);
    if (Math.abs(ans * 10 - Math.round(ans * 10)) > 1e-9) continue;
    return { t: "num", ...base, stem: [`把 ${a} g 质量分数为 ${p}% 的氯化钠溶液蒸发掉 ${w} g 水（没有晶体析出），溶液的溶质质量分数是多少（%）？`], steps: [{ label: ["溶质质量分数（%）"], answer: ans, tol: 0.1, unit: "%", say: [{ f: `${a} × ${p}% ÷ (${a} − ${w}) × 100% = ${num(ans)}%` }] }], expl: ["蒸发水时溶质的质量不变，溶液的质量减小：", { f: `${a} × ${p}% ÷ (${a} − ${w}) × 100% = ${num(ans)}%` }], meta: { add: false, a, p, w, ans } } as NumQ;
  }
  throw new Error("no conc");
}

// ---------- calculations by the equation, advanced ----------
const dec2 = (x: number): boolean => Math.abs(x * 100 - Math.round(x * 100)) < 1e-6;
const solid = (t: Term) => !t.f.includes("·");
const GASLIQ = new Set(["H2", "O2", "N2", "Cl2", "CO", "CO2", "SO2", "SO3", "NO", "NO2", "NH3", "H2O", "H2O2", "Hg", "CH4", "C2H5OH", "C2H2", "C2H4", "C3H8", "C4H10"]);
/** a reactant that can be a weighed solid sample (not a gas, a liquid or an acid solution) */
const sample = (t: Term): boolean => { const c = L.subOf(t.f)?.c; return !GASLIQ.has(t.f) && (c === "salt" || c === "oxide" || c === "base" || c === "elem"); };
const gasTerm = (rx: Rx): Term | null => { const g = rx.r.filter((t) => t.mark === "↑"); return g.length === 1 && ["H2", "O2", "CO2"].includes(g[0].f) ? g[0] : null; };
let POOLS: { gas: Rx[]; heat: Rx[]; carb: Rx[]; two: Rx[]; all: Rx[] } | null = null;
const pools = () => POOLS ??= (() => {
  const R = L.data().reactions;
  const gas = R.filter((x) => gasTerm(x) && x.l.every(solid));
  const heat = R.filter((x) => gasTerm(x) && x.l.length === 1 && x.r.length === 2 && x.cond.some((c) => ["加热", "高温", "催化剂"].includes(c)) && x.cond.every((c) => c !== "催化剂" || x.l[0].f === "KClO3") && !x.r.some((t) => t.f === "H2O"));
  const carb = R.filter((x) => x.l.length === 2 && x.r.length === 3 && gasTerm(x)?.f === "CO2" && x.r.some((t) => t.f === "H2O") && /^[A-Z][a-z]?\d*CO3$/.test(x.l[0].f) && ["HCl", "H2SO4"].includes(x.l[1].f));
  const two = R.filter((x) => x.l.length === 2 && x.l.every((t) => !t.f.includes("·") && L.mr(t.f) < 200) && x.r.length >= 1 && !x.cond.includes("光照"));
  return { gas, heat, carb, two, all: R.filter((x) => x.l.concat(x.r).every(solid)) };
})();
export const calc2Pools = pools;
const ACIDSOL: Record<string, string> = { HCl: "稀盐酸", H2SO4: "稀硫酸" };
const masses = (a: Term, b: Term) => ({ wa: a.c * mr(a.f), wb: b.c * mr(b.f) });

export function genCalc2(r: Rnd, lv: number, kind: string): Q {
  const P = pools(), base = { mode: "calc2", kind, lv: lv || 2 };
  const mkey = (rx: Rx) => `calc2:${kind}:${rx.id}`;
  const MS = [0.1, 0.2, 0.25, 0.5, 1, 2, 5, 0.05];
  for (let tries = 0; tries < 600; tries++) {
    if (kind === "gasv") {
      const rx = pick(r, P.gas), g = gasTerm(rx)!, a = pick(r, rx.l.filter(sample)), rho = L.data().more.gasd.find((x) => x[0] === g.f)![2];
      if (!a) continue;
      const { wa, wb } = masses(a, g), m = pick(r, MS), given = m * wa, gm = m * wb;
      if (!dec2(given) || !dec2(gm) || given < 1 || given > 500 || gm < 0.2) continue;
      const V = gm / rho;
      return { t: "num", ...base, key: mkey(rx), lv: 1, stem: ["根据化学方程式计算：", eqP(rx), `已知 ${sub(a.f)} 的质量为 ${num(given)} g。标准状况下 ${sub(g.f)} 的密度为 ${rho} g/L，求生成的 ${sub(g.f)} 的体积（L，保留一位小数）。`], els: [...new Set([...Object.keys(L.parseFormula(a.f)), ...Object.keys(L.parseFormula(g.f))])], steps: [
        { label: [`第 1 步：生成 ${sub(g.f)} 的质量（g）`], answer: gm, tol: L.calcTol(gm), say: [{ f: `${num(given)} × ${num(wb)} ÷ ${num(wa)} = ${num(gm)}` }] },
        { label: [`第 2 步：${sub(g.f)} 的体积（L）= 质量 ÷ 密度`], answer: V, tol: Math.max(0.1, V * 0.01), unit: "L", say: [{ f: `${num(gm)} ÷ ${rho} = ${num(V)}` }] }],
      expl: ["先由化学方程式求出气体的质量，再用 体积 = 质量 ÷ 密度：", { f: `${num(gm)} g ÷ ${rho} g/L = ${num(V)} L` }], meta: { kind, rx: rx.id, a: a.f, ac: a.c, g: g.f, gc: g.c, given, gm, rho, V } } as NumQ;
    }
    if (kind === "pure" || kind === "yield" || kind === "excess") {
      const rx = pick(r, P.two), a = pick(r, rx.l.filter(sample)), b = pick(r, rx.r.filter((t) => solid(t) && t.f !== a?.f));
      if (!a || !b) continue;
      const { wa, wb } = masses(a, b), m = pick(r, MS), given = m * wa, bm = m * wb;
      if (!dec2(given) || !dec2(bm) || given < 1 || given > 400 || bm < 0.5 || bm > 400) continue;
      if (kind === "pure") {
        const p = pick(r, [50, 60, 75, 80, 90, 95]), w = given * 100 / p;
        if (!dec2(w) || w > 1000) continue;
        return { t: "num", ...base, key: mkey(rx), lv: 1, stem: ["含杂质的样品与反应物发生下面的反应（杂质不参加反应）：", eqP(rx), `取 ${num(w)} g 含 ${sub(a.f)} 的质量分数为 ${p}% 的样品，完全反应后，可得到 ${sub(b.f)} 多少 g？`], els: [...new Set([...Object.keys(L.parseFormula(a.f)), ...Object.keys(L.parseFormula(b.f))])], steps: [
          { label: [`第 1 步：样品中纯 ${sub(a.f)} 的质量（g）`], answer: given, tol: L.calcTol(given), say: [{ f: `${num(w)} × ${p}% = ${num(given)}` }] },
          { label: [`第 2 步：生成 ${sub(b.f)} 的质量（g）`], answer: bm, tol: L.calcTol(bm), unit: "g", say: [{ f: `${num(wa)} : ${num(wb)} = ${num(given)} : x,  x = ${num(bm)}` }] }],
        expl: ["只有纯物质参加反应，先求纯物质的质量 = 样品质量 × 质量分数，再列比例：", { f: `${num(w)} × ${p}% = ${num(given)} g;  x = ${num(bm)} g` }], meta: { kind, rx: rx.id, a: a.f, ac: a.c, b: b.f, bc: b.c, w, p, given, bm } } as NumQ;
      }
      if (kind === "yield") {
        const y = pick(r, [50, 60, 75, 80, 85, 90]), act = bm * y / 100;
        if (!dec2(act)) continue;
        return { t: "num", ...base, key: mkey(rx), lv: 2, stem: ["工业制取时，实际得到的产品比理论值少：", eqP(rx), `用 ${num(given)} g ${sub(a.f)} 反应，产率（实际产量 ÷ 理论产量 × 100%）为 ${y}%，实际得到 ${sub(b.f)} 多少 g？`], els: [...new Set([...Object.keys(L.parseFormula(a.f)), ...Object.keys(L.parseFormula(b.f))])], steps: [
          { label: [`第 1 步：${sub(b.f)} 的理论产量（g）`], answer: bm, tol: L.calcTol(bm), say: [{ f: `${num(given)} × ${num(wb)} ÷ ${num(wa)} = ${num(bm)}` }] },
          { label: ["第 2 步：实际产量（g）= 理论产量 × 产率"], answer: act, tol: L.calcTol(act), unit: "g", say: [{ f: `${num(bm)} × ${y}% = ${num(act)}` }] }],
        expl: ["先按方程式算出理论产量，再乘以产率：", { f: `${num(bm)} × ${y}% = ${num(act)} g` }], meta: { kind, rx: rx.id, a: a.f, ac: a.c, b: b.f, bc: b.c, given, y, bm, act } } as NumQ;
      }
      // excess: b is the reactant that is left over
      const bb = rx.l.find((t) => t.f !== a.f);
      if (!bb) continue;
      const { wb: wbb } = masses(a, bb), need = m * wbb, extra = pick(r, [1, 2, 3, 5, 10]), B = need + extra;
      if (!dec2(need) || !dec2(B) || B > 400 || need < 0.5) continue;
      return { t: "num", ...base, key: mkey(rx), lv: 2, stem: ["两种反应物混合反应：", eqP(rx), `${num(given)} g ${sub(a.f)} 与 ${num(B)} g ${sub(bb.f)} 充分反应（${sub(a.f)} 完全反应），反应后剩余的 ${sub(bb.f)} 的质量是多少 g？`], els: [...new Set([...Object.keys(L.parseFormula(a.f)), ...Object.keys(L.parseFormula(bb.f))])], steps: [
        { label: [`第 1 步：与 ${num(given)} g ${sub(a.f)} 恰好反应的 ${sub(bb.f)} 的质量（g）`], answer: need, tol: L.calcTol(need), say: [{ f: `${num(given)} × ${num(wbb)} ÷ ${num(wa)} = ${num(need)}` }] },
        { label: [`第 2 步：剩余 ${sub(bb.f)} 的质量（g）`], answer: extra, tol: L.calcTol(extra), unit: "g", say: [{ f: `${num(B)} − ${num(need)} = ${num(extra)}` }] }],
      expl: ["完全反应的物质决定生成物的量；另一种物质过量，剩余质量 = 加入的质量 − 反应掉的质量：", { f: `${num(B)} − ${num(need)} = ${num(extra)} g` }], meta: { kind, rx: rx.id, a: a.f, ac: a.c, b: bb.f, bc: bb.c, given, B, need, extra } } as NumQ;
    }
    if (kind === "loss") {
      const rx = pick(r, P.heat), a = rx.l[0], g = gasTerm(rx)!, { wa, wb } = masses(a, g), m = pick(r, MS), given = m * wa, gm = m * wb;
      const p = pick(r, [50, 60, 75, 80, 90]), w = given * 100 / p, w2 = w - gm;
      if (!dec2(given) || !dec2(gm) || !dec2(w) || !dec2(w2) || gm < 0.5 || w > 500) continue;
      return { t: "num", ...base, key: mkey(rx), lv: 3, stem: ["加热含杂质的固体混合物（杂质不含该气体的元素，也不参加反应）：", eqP(rx), `取 ${num(w)} g 混合物加热，直到质量不再减少，剩余固体的质量为 ${num(w2)} g。求混合物中 ${sub(a.f)} 的质量分数（%）。`], els: [...new Set([...Object.keys(L.parseFormula(a.f)), ...Object.keys(L.parseFormula(g.f))])], steps: [
        { label: [`第 1 步：生成 ${sub(g.f)} 的质量（g）= 固体减少的质量`], answer: gm, tol: L.calcTol(gm), say: [{ f: `${num(w)} − ${num(w2)} = ${num(gm)}` }] },
        { label: [`第 2 步：混合物中 ${sub(a.f)} 的质量（g）`], answer: given, tol: L.calcTol(given), say: [{ f: `${num(gm)} × ${num(wa)} ÷ ${num(wb)} = ${num(given)}` }] },
        { label: [`第 3 步：${sub(a.f)} 的质量分数（%）`], answer: p, tol: 0.1, unit: "%", say: [{ f: `${num(given)} ÷ ${num(w)} × 100% = ${num(p)}%` }] }],
      expl: ["质量守恒：固体减少的质量就是逸出气体的质量；再由方程式求反应物的质量：", { f: `${num(given)} ÷ ${num(w)} × 100% = ${num(p)}%` }], meta: { kind, rx: rx.id, a: a.f, ac: a.c, g: g.f, gc: g.c, w, w2, gm, given, p } } as NumQ;
    }
    if (kind === "sollast") {
      const rx = pick(r, P.carb), a = rx.l[0], acid = rx.l[1], salt = rx.r.find((t) => t.mark === "" && t.f !== "H2O")!, co2 = rx.r.find((t) => t.f === "CO2")!;
      const wa = a.c * mr(a.f), ws = salt.c * mr(salt.f), wc = co2.c * mr(co2.f), wacid = acid.c * mr(acid.f), m = pick(r, MS);
      const given = m * wa, sm = m * ws, cm = m * wc, need = m * wacid, W = Math.ceil(need * 4 / 10) * 10;
      if (!dec2(given) || !dec2(sm) || !dec2(cm) || given < 2 || given > 200 || W > 600) continue;
      const total = given + W - cm, p = sm / total * 100;
      return { t: "num", ...base, key: mkey(rx), lv: 3, stem: ["碳酸盐与稀酸反应：", eqP(rx), `向 ${num(W)} g ${ACIDSOL[acid.f]}中加入 ${num(given)} g ${sub(a.f)}，恰好完全反应。求反应后所得溶液的溶质质量分数（%，保留一位小数）。`], els: [...new Set([...Object.keys(L.parseFormula(a.f)), ...Object.keys(L.parseFormula(salt.f))])], steps: [
        { label: [`第 1 步：生成的溶质 ${sub(salt.f)} 的质量（g）`], answer: sm, tol: L.calcTol(sm), say: [{ f: `${num(given)} × ${num(ws)} ÷ ${num(wa)} = ${num(sm)}` }] },
        { label: ["第 2 步：逸出的二氧化碳的质量（g）"], answer: cm, tol: L.calcTol(cm), say: [{ f: `${num(given)} × ${num(wc)} ÷ ${num(wa)} = ${num(cm)}` }] },
        { label: ["第 3 步：所得溶液的溶质质量分数（%）= 溶质 ÷（固体 + 酸溶液 − 气体）"], answer: p, tol: 0.1, unit: "%", say: [{ f: `${num(sm)} ÷ (${num(given)} + ${num(W)} − ${num(cm)}) × 100% = ${num(+p.toFixed(1))}%` }] }],
      expl: ["反应后溶液的质量 = 加入的固体质量 + 酸溶液质量 − 逸出气体的质量：", { f: `${num(sm)} ÷ ${num(total)} × 100% = ${num(+p.toFixed(1))}%` }], meta: { kind, rx: rx.id, a: a.f, ac: a.c, acid: acid.f, salt: salt.f, sc: salt.c, cc: co2.c, given, W, sm, cm, total, p } } as NumQ;
    }
    throw new Error("kind " + kind);
  }
  throw new Error("no case for " + kind);
}
export type { Part };
