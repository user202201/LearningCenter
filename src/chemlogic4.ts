/**
 * 化学 part 2 (pure): atoms and ions (structure drawings), laboratory work (apparatus, ordering the steps, safety), chemistry and life (nutrients, materials,
 * elements and health, the environment), properties and uses of common substances (and the general properties of acids, bases and salts, decided by the judges).
 * Question banks are CONTENT (written from memory, shown in `user` boxes); everything that can be computed is computed.
 */
import * as L from "./chemlogic";
import type { Q, Part, Rnd, OrdQ, Rx } from "./chemlogic";
import { mix } from "./chemlogic3";

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
const M = () => L.data().more;
const u = (s: string): Part => ({ u: s });
const uw = (xs: string[]): Part[][] => xs.map((x) => [u(x)]);

// ---------- generic banks ----------
export interface BankItem { q: string; a: string; w: string[]; e: string }
const BANKS: Record<string, () => { id: string; b?: BankItem; ord?: [string, string[]] }[]> = {
  lab: () => [...M().lab.map((b, i) => ({ id: `qa${i}`, b })), ...M().ord.map((o, i) => ({ id: `ord${i}`, ord: o as [string, string[]] }))],
  life: () => M().life.map((b, i) => ({ id: `qa${i}`, b })),
  prop: () => M().prop.map((b, i) => ({ id: `qa${i}`, b })),
  atom: () => M().atomqa.map((b, i) => ({ id: `qa${i}`, b })),
  rem: () => M().remgas.map((b, i) => ({ id: `gas${i}`, b })),
  flow: () => M().flowqa.map((b, i) => ({ id: `qa${i}`, b })),
};
/** the share of a round that comes from the written banks (the rest is made by the generators) */
export const BANK_SHARE: Record<string, number> = { lab: 0.6, life: 0.4, prop: 0.4, atom: 0.3, rem: 0.2, flow: 0.2 };
export const bankIds = (mode: string): string[] => (BANKS[mode]?.() ?? []).map((x) => x.id);
export function bankQ(mode: string, id: string, r: Rnd, lv = 0): Q | null {
  const e = BANKS[mode]?.().find((x) => x.id === id);
  if (!e) return null;
  const key = `${mode}:${id}`, base = { mode, lv: lv || 1, key };
  if (e.ord) {
    const items = e.ord[1], shown = shuf(r, items.map((_, i) => i)).map((i) => items[i]);
    const same = shown.every((x, i) => x === items[i]);
    return { t: "ord", ...base, kind: "ord", lv: 2, stem: [u(e.ord[0]), "（点击步骤，按先后顺序依次选出）"], items, shown: same ? shown.slice().reverse() : shown, expl: ["正确的顺序：", ...items.flatMap((x, i) => [u((i ? " " : "") + `${i + 1}. `), u(x)])] } as OrdQ;
  }
  const b = e.b!;
  return choiceQ({ ...base, kind: mode === "rem" ? "gas" : "qa", stem: [u(b.q)], expl: [u(b.e)] }, r, [u(b.a)], uw(b.w), { meta: { bank: id } }) as Q;
}

// ---------- atoms ----------
const CAPS = [2, 8, 8, 8];
export function shells(e: number): number[] {
  const out: number[] = []; let left = e;
  for (const c of CAPS) { if (left <= 0) break; out.push(Math.min(c, left)); left -= c; }
  return out;
}
const atomOf = (z: number) => M().atoms.find((a) => a[0] === z)!;
const symOf = (z: number): string => atomOf(z)[1] as string;
const nameZh = (z: number): string => atomOf(z)[2] as string;
export const ionText = (z: number, e: number): string => { const c = z - e, n = Math.abs(c); return symOf(z) + (c === 0 ? "" : (n > 1 ? (n === 2 ? "²" : "³") : "") + (c > 0 ? "⁺" : "⁻")); };
const partLabel = (z: number, e: number): Part[] => (z === e ? [u(symOf(z)), " 原子"] : [u(ionText(z, e))]);
const labKey = (z: number, e: number): string => `${z}/${e}`;
/** the usual ion of an atom of Z <= 20: it loses (<= 3 outer electrons) or gains (>= 6) electrons to reach a full outer shell; null for the others */
export function usualIon(z: number): number | null {
  if (z === 1 || z === 5 || z === 2 || z === 10 || z === 18) return null;
  const sh = shells(z), v = sh[sh.length - 1];
  return v <= 3 ? z - v : v >= 6 ? z + 8 - v : null;
}
const IONIZABLE = (): number[] => M().atoms.map((a) => a[0] as number).filter((z) => z > 1 && usualIon(z) !== null);

export function genAtom(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "atom", kind, lv: lv || 1, key: `atom:${kind}` };
  const zs = M().atoms.map((a) => a[0] as number);
  if (kind === "z2el") {
    const z = pick(r, zs), lab = (k: number): Part[] => [{ u: symOf(k) }, { u: " " + nameZh(k) }];
    const near = shuf(r, zs.filter((k) => k !== z && Math.abs(k - z) <= 3));
    return choiceQ({ ...base, stem: [`核电荷数（质子数）为 ${z} 的元素是：`], expl: [`元素的种类由核电荷数决定。核电荷数为 ${z} 的元素是`, u(`${nameZh(z)}（${symOf(z)}）`), { u: L.U.dot }] }, r, lab(z), near.map(lab), { meta: { z } }) as Q;
  }
  if (kind === "outer" || kind === "period") {
    const z = pick(r, zs), sh = shells(z), right = kind === "outer" ? sh[sh.length - 1] : sh.length;
    const wr = [1, 2, 3, 4, 5, 6, 7, 8].filter((x) => x !== right && (kind === "outer" || x <= 4));
    return choiceQ({ ...base, lv: kind === "outer" ? 1 : 2, stem: [kind === "outer" ? "下图是某原子的结构示意图，它的最外层电子数是：" : "下图是某原子的结构示意图，该元素位于元素周期表的第几周期："], expl: [kind === "outer" ? `最外层是最外面的一个电子层，有 ${right} 个电子。` : `电子层数 = 周期数：这个原子有 ${right} 个电子层，在第 ${right} 周期。`] }, r, [{ u: String(right) }], uw(shuf(r, wr).map(String)), { spec: { k: "atom", z, e: z }, meta: { z, right } }) as Q;
  }
  if (kind === "fig") {
    for (let t = 0; t < 200; t++) {
      const z = pick(r, zs.filter((x) => x > 2)), ion = r() < 0.6 ? usualIon(z) : null, e = ion ?? z;
      if (e < 2) continue;
      const right = labKey(z, e), pool: [number, number][] = [];
      for (const dz of [-1, 1, 2, -2]) { const z2 = z + dz; if (z2 >= 3 && z2 <= 20) pool.push([z2, e]); }
      for (const de of [-1, 1, -2, 2]) if (e + de >= 2) pool.push([z, e + de]);
      pool.push([z, z]);
      const uniq = new Map<string, [number, number]>();
      for (const [a, b] of pool) if (labKey(a, b) !== right) uniq.set(labKey(a, b), [a, b]);
      if (uniq.size < 3) continue;
      const wr = shuf(r, [...uniq.values()]).slice(0, 3);
      const kindTxt = e === z ? "原子" : e < z ? "阳离子" : "阴离子";
      return choiceQ({ ...base, lv: lv || 2, stem: ["下图是某粒子的结构示意图（圆圈内是核电荷数）。该粒子是："], expl: [`核电荷数为 ${z}，是`, u(`${nameZh(z)}（${symOf(z)}）`), `；核外电子数为 ${e}，${e === z ? "与核电荷数相等，是原子" : e < z ? "少于核电荷数，是阳离子" : "多于核电荷数，是阴离子"}。该粒子是`, ...partLabel(z, e), { u: L.U.dot }] }, r, partLabel(z, e), wr.map(([a, b]) => partLabel(a, b)), { spec: { k: "atom", z, e }, meta: { z, e, kind: kindTxt } }) as Q;
    }
    throw new Error("no figure");
  }
  if (kind === "ion") {
    const z = pick(r, IONIZABLE()), e = usualIon(z)!, sh = shells(z), v = sh[sh.length - 1], c = z - e;
    const right = ionText(z, e), wr = new Set<string>();
    for (const b of [z, e + 1, e - 1, 2 * z - e]) if (b >= 0) wr.add(ionText(z, b));
    for (const k of shuf(r, zs.filter((x) => x !== z && Math.abs(x - z) <= 2))) { const ee = usualIon(k); if (ee !== null) wr.add(ionText(k, ee)); }
    wr.delete(right);
    return choiceQ({ ...base, lv: lv || 2, stem: [`${symOf(z)}原子的最外层有 ${v} 个电子。它在化学反应中容易${c > 0 ? "失去" : "得到"}电子，形成的稳定离子是：`], expl: [`最外层电子数 ${v}：${c > 0 ? "少于 4 个，容易失去电子" : "多于 4 个，容易得到电子"}，达到 8 个电子的稳定结构（第一层只有 2 个电子时也稳定）。${symOf(z)}原子${c > 0 ? "失去" : "得到"} ${Math.abs(c)} 个电子，形成`, u(right), { u: L.U.dot }] }, r, [u(right)], uw(shuf(r, [...wr])), { meta: { z, right } }) as Q;
  }
  // cell
  const z = pick(r, zs), at = atomOf(z), neutron = r() < 0.5 && z >= 3 && z !== 17;
  const spec = { k: "cell" as const, z };
  if (neutron) {
    const n = Math.round(at[3] as number) - z;
    return { t: "num", ...base, lv: 3, stem: [`下图是元素周期表中的一格。该原子的中子数是多少？（相对原子质量取整数）`], spec, steps: [{ label: ["中子数"], answer: n, tol: 0.001, say: [{ f: `${Math.round(at[3] as number)} − ${z} = ${n}` }] }], expl: ["相对原子质量 ≈ 质子数 + 中子数，质子数 = 原子序数：", { f: `${Math.round(at[3] as number)} − ${z} = ${n}` }], meta: { z, n } } as Q;
  }
  const lab = (k: number): Part[] => [u(nameZh(k)), u(` (${symOf(k)})`)];
  return choiceQ({ ...base, lv: lv || 2, stem: ["下图是元素周期表中的一格，它表示的元素是："], expl: ["格中的数字是原子序数（= 核电荷数 = 质子数）、元素符号和相对原子质量。该元素是", u(`${nameZh(z)}（${symOf(z)}）`), { u: L.U.dot }] }, r, lab(z), shuf(r, zs.filter((k) => k !== z && Math.abs(k - z) <= 3)).map(lab), { spec, meta: { z } }) as Q;
}

// ---------- laboratory ----------
export function genLab(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "lab", kind, lv: lv || 1, key: `lab:${kind}` };
  const apps = M().apps;
  if (kind === "app") {
    const a = pick(r, apps);
    return choiceQ({ ...base, key: `lab:app:${a[0]}`, stem: ["下图中的仪器是："], expl: ["这是", u(a[1]), u(L.U.colon), u(a[2]), { u: L.U.dot }] }, r, uw([a[1]])[0], uw(apps.filter((x) => x[0] !== a[0]).map((x) => x[1])), { spec: { k: "app", id: a[0] }, meta: { id: a[0], name: a[1] } }) as Q;
  }
  const a = pick(r, apps);
  if (r() < 0.5) {
    return choiceQ({ ...base, key: `lab:use:${a[0]}`, stem: ["下面这种用途的仪器是："], expl: [u(a[1]), u(L.U.colon), u(a[2]), { u: L.U.dot }] }, r, uw([a[1]])[0], uw(apps.filter((x) => x[0] !== a[0]).map((x) => x[1])), { meta: { id: a[0], use: a[2] } }) as Q;
  }
  return choiceQ({ ...base, key: `lab:use:${a[0]}`, stem: ["仪器", u(` ${a[1]} `), "的用途是："], expl: [u(a[1]), u(L.U.colon), u(a[2]), { u: L.U.dot }] }, r, uw([a[2]])[0], uw(apps.filter((x) => x[0] !== a[0]).map((x) => x[2])), { meta: { id: a[0], use: a[2] } }) as Q;
}

// ---------- chemistry and life ----------
export function genLife(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "life", kind, lv: lv || 1, key: `life:${kind}` };
  const D = M();
  if (kind === "food") {
    const tbl = D.foods as [string, string[]][], [cls, items] = pick(r, tbl);
    if (r() < 0.5) {
      const it = pick(r, items), others = tbl.filter(([c]) => c !== cls);
      return choiceQ({ ...base, key: `life:food:${it}`, stem: ["食物", u(` ${it} `), "中富含的营养素主要是："], expl: [u(it), "富含", u(cls), { u: L.U.dot }] }, r, [u(cls)], uw(others.map(([c]) => c)), { meta: { item: it, cls } }, 4) as Q;
    }
    const right = pick(r, items), wrongs = shuf(r, tbl.filter(([c]) => c !== cls).flatMap(([, xs]) => xs));
    return choiceQ({ ...base, key: `life:foodof:${cls}`, stem: ["下列食物中，富含", u(` ${cls} `), "的是："], expl: [u(right), "富含", u(cls), { u: L.U.dot }] }, r, [u(right)], uw(wrongs), { meta: { cls, right } }) as Q;
  }
  if (kind === "nutr") {
    const [n, f] = pick(r, D.nutr as [string, string][]), others = (D.nutr as [string, string][]).filter(([x]) => x !== n);
    return choiceQ({ ...base, key: `life:nutr:${n}`, stem: ["下面的描述对应的营养素是：", u(f)], expl: [u(n), u(L.U.colon), u(f), { u: L.U.dot }] }, r, [u(n)], uw(others.map(([x]) => x)), { meta: { n } }) as Q;
  }
  if (kind === "elem") {
    const [e, s] = pick(r, D.health as [string, string][]), others = (D.health as [string, string][]).filter(([x]) => x !== e);
    if (r() < 0.5) return choiceQ({ ...base, key: `life:elem:${e}`, lv: 2, stem: ["人体缺少下列哪种元素：", u(s)], expl: ["缺少", u(e), u(L.U.colon), u(s), { u: L.U.dot }] }, r, [u(e)], uw(others.map(([x]) => x)), { meta: { e } }) as Q;
    return choiceQ({ ...base, key: `life:elemof:${e}`, lv: 2, stem: ["人体缺少", u(` ${e} `), "元素，容易出现："], expl: ["缺少", u(e), u(L.U.colon), u(s), { u: L.U.dot }] }, r, [u(s)], uw(others.map(([, x]) => x)), { meta: { e } }) as Q;
  }
  if (kind === "trace") {
    const t = pick(r, D.trace.trace), m = shuf(r, D.trace.major).slice(0, 3);
    return choiceQ({ ...base, stem: ["下列元素中，属于人体必需的微量元素的是："], expl: [u(t), "属于微量元素；钙、钠、钾、镁、磷等含量较多，属于常量元素。"] }, r, [u(t)], uw(m), { meta: { t } }) as Q;
  }
  if (kind === "mat") {
    const tbl = D.material as [string, string[]][], [cls, items] = pick(r, tbl), right = pick(r, items);
    if (r() < 0.5) return choiceQ({ ...base, key: `life:matof:${cls}`, lv: 2, stem: ["下列物品或材料中，属于", u(` ${cls} `), "的是："], expl: [u(right), "属于", u(cls), { u: L.U.dot }] }, r, [u(right)], uw(shuf(r, tbl.filter(([c]) => c !== cls).flatMap(([, xs]) => xs))), { meta: { cls, right } }) as Q;
    return choiceQ({ ...base, key: `life:mat:${right}`, lv: 2, stem: ["下列物品或材料", u(` ${right} `), "属于："], expl: [u(right), "属于", u(cls), { u: L.U.dot }] }, r, [u(cls)], uw(tbl.filter(([c]) => c !== cls).map(([c]) => c)), { meta: { item: right, cls } }, 4) as Q;
  }
  // env
  const [pb, cause] = pick(r, D.env as [string, string][]), others = (D.env as [string, string][]).filter(([x]) => x !== pb);
  return choiceQ({ ...base, key: `life:env:${pb}`, lv: 2, stem: ["造成", u(` ${pb} `), "的主要原因是："], expl: [u(pb), "：主要由", u(cause), "引起。"] }, r, [u(cause)], uw(others.map(([, x]) => x)), { meta: { pb, cause } }) as Q;
}

// ---------- uses and the general properties of acids, bases, salts ----------
type XT = "metal" | "basicox" | "acidox" | "base" | "salt" | "acid";
interface X { f: string; t: XT; c?: { cat: string; an: string } }
const XS: X[] = [
  { f: "Mg", t: "metal" }, { f: "Zn", t: "metal" }, { f: "Fe", t: "metal" }, { f: "Cu", t: "metal" }, { f: "Ag", t: "metal" },
  { f: "CuO", t: "basicox" }, { f: "Fe2O3", t: "basicox" }, { f: "CaO", t: "basicox" }, { f: "CO2", t: "acidox" }, { f: "SO2", t: "acidox" },
  { f: "NaOH", t: "base", c: { cat: "Na", an: "OH" } }, { f: "Cu(OH)2", t: "base", c: { cat: "Cu", an: "OH" } }, { f: "Mg(OH)2", t: "base", c: { cat: "Mg", an: "OH" } },
  { f: "CaCO3", t: "salt", c: { cat: "Ca", an: "CO3" } }, { f: "Na2CO3", t: "salt", c: { cat: "Na", an: "CO3" } }, { f: "NaCl", t: "salt", c: { cat: "Na", an: "Cl" } }, { f: "BaCl2", t: "salt", c: { cat: "Ba", an: "Cl" } },
  { f: "CuSO4", t: "salt", c: { cat: "Cu", an: "SO4" } }, { f: "Na2SO4", t: "salt", c: { cat: "Na", an: "SO4" } }, { f: "AgNO3", t: "salt", c: { cat: "Ag", an: "NO3" } }, { f: "KNO3", t: "salt", c: { cat: "K", an: "NO3" } },
  { f: "HCl", t: "acid", c: { cat: "H", an: "Cl" } }, { f: "H2SO4", t: "acid", c: { cat: "H", an: "SO4" } },
];
interface R { id: string; zh: string; t: "acid" | "base" | "salt"; c: { cat: string; an: string } }
const RS: R[] = [
  { id: "HCl", zh: "稀盐酸", t: "acid", c: { cat: "H", an: "Cl" } }, { id: "H2SO4", zh: "稀硫酸", t: "acid", c: { cat: "H", an: "SO4" } },
  { id: "NaOH", zh: "氢氧化钠溶液", t: "base", c: { cat: "Na", an: "OH" } }, { id: "Ca(OH)2", zh: "澄清石灰水", t: "base", c: { cat: "Ca", an: "OH" } },
  { id: "CuSO4", zh: "硫酸铜溶液", t: "salt", c: { cat: "Cu", an: "SO4" } }, { id: "Na2CO3", zh: "碳酸钠溶液", t: "salt", c: { cat: "Na", an: "CO3" } },
];
export const aspItems = { XS, RS };
const REASON: Record<string, string> = {
  metalacid: "排在氢前面的金属能与稀酸反应，放出氢气。", nometalacid: "排在氢后面的金属不能与稀酸反应。", oxacid: "金属氧化物能与酸反应，生成盐和水。", acidoxacid: "非金属氧化物不能与酸反应。",
  baseacid: "酸与碱发生中和反应，生成盐和水。", acidox_base: "碱能与非金属氧化物反应，生成盐和水。", basicox_base: "金属氧化物不能与碱反应。", metal_base: "金属不能与碱溶液反应（初中范围）。",
  metalsalt: "排在前面的金属能把排在后面的金属从它的盐溶液中置换出来。", nometalsalt: "这种金属不如盐中的金属活泼，不能把它置换出来。", oxsalt: "氧化物不与盐溶液反应。", acidsalt: "酸与盐的反应要看有没有沉淀、气体或水生成。", basebase: "两种碱之间不反应。", acidacid: "两种酸之间不反应。",
};
/** does the reagent R react with X? null when the judge says "not sure" (such a pair is never asked) */
export function reacts(R: R, X: X): { yes: boolean; why: string } | null {
  const act = (s: string) => L.data().activity.indexOf(s);
  if (R.t === "acid") {
    if (X.t === "metal") return act(X.f) < act("H") ? { yes: true, why: REASON.metalacid } : { yes: false, why: REASON.nometalacid };
    if (X.t === "basicox") return { yes: true, why: REASON.oxacid };
    if (X.t === "acidox") return { yes: false, why: REASON.acidoxacid };
    if (X.t === "acid") return { yes: false, why: REASON.acidacid };
  }
  if (R.t === "base") {
    if (X.t === "acidox") return { yes: true, why: REASON.acidox_base };
    if (X.t === "basicox") return { yes: false, why: REASON.basicox_base };
    if (X.t === "metal") return { yes: false, why: REASON.metal_base };
    if (X.t === "base") return { yes: false, why: REASON.basebase };
  }
  if (R.t === "salt") {
    if (X.t === "metal") {
      return R.id === "CuSO4" && act(X.f) < act("Cu") ? { yes: true, why: REASON.metalsalt } : { yes: false, why: REASON.nometalsalt };
    }
    if (X.t === "basicox" || X.t === "acidox") return { yes: false, why: REASON.oxsalt };
  }
  // compounds of the solubility table: the 复分解 judge
  if (!X.c) return null;
  const m = L.metathesis(R.c, X.c);
  if (m.ambiguous || mix(R.c, X.c).ambiguous) return null;
  return { yes: m.happens, why: m.why };
}

export function genProp(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "prop", kind, lv: lv || 1, key: `prop:${kind}` };
  const U = M().uses as [string, string, string][];
  if (kind === "use") {
    const x = pick(r, U), others = U.filter((y) => y !== x);
    if (r() < 0.5) return choiceQ({ ...base, key: `prop:use:${x[0]}`, stem: ["下面这种用途对应的物质是：", u(x[2])], expl: [u(x[0]), u(L.U.colon), u(x[2]), { u: L.U.dot }] }, r, [u(x[0])], uw(others.map((y) => y[0])), { meta: { name: x[0] } }) as Q;
    return choiceQ({ ...base, key: `prop:usefor:${x[0]}`, stem: ["物质", u(` ${x[0]} `), "的用途是："], expl: [u(x[0]), u(L.U.colon), u(x[2]), { u: L.U.dot }] }, r, [u(x[2])], uw(others.map((y) => y[2])), { meta: { name: x[0], use: x[2] } }) as Q;
  }
  // asp: which of four substances react / do not react with a reagent
  for (let t = 0; t < 400; t++) {
    const R_ = pick(r, RS), pos = r() < 0.6;
    const res = XS.map((x) => ({ x, v: reacts(R_, x) })).filter((e): e is { x: X; v: { yes: boolean; why: string } } => e.v !== null && e.x.f !== R_.id);
    const yes = res.filter((e) => e.v.yes), no = res.filter((e) => !e.v.yes);
    if (yes.length < 3 || no.length < 3) continue;
    const one = pick(r, pos ? yes : no), rest = shuf(r, pos ? no : yes).slice(0, 3), all = shuf(r, [one, ...rest]);
    const lab = (e: { x: X }): Part[] => [{ f: e.x.f }, u(" " + L.nameOf(e.x.f))];
    const expl: Part[] = [];
    for (const e of all) expl.push({ u: " " }, { f: e.x.f }, e.v.yes ? "：能反应。" : "：不能反应。", e.v.why);
    return choiceQ({ ...base, key: `prop:asp:${R_.id}:${pos ? "yes" : "no"}`, lv: lv || 2, stem: [pos ? `下列物质中，能与${R_.zh}反应的是：` : `下列物质中，不能与${R_.zh}反应的是：`], expl }, r, lab(one), rest.map(lab), { meta: { R: R_.id, pos, right: one.x.f, choices: all.map((e) => e.x.f) } }) as Q;
  }
  throw new Error("no property question");
}
void [ri, wrap, fWrap, sub, num, mr, eqP, mix];
