/**
 * 化学 part 2 (pure): identification problems (推断题), impurity removal (除杂), flowchart problems. The answers are worked out by the same judges as the
 * rest of the trainer (the solubility table, the 复分解 judge, the activity series) and a small ion simulator for the flowcharts; a question is only made
 * when its answer is UNIQUE (checked by trying every possibility), and the tests recompute all of it independently.
 */
import * as L from "./chemlogic";
import type { Q, Part, Rnd, ChoiceQ, Cmp, FlowRow, Rx } from "./chemlogic";

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
const IN = { catByK: (k: string) => L.IONS.catByK(k), get AN() { return L.IONS.AN; }, get CAT() { return L.IONS.CAT; }, ionName: (c: ReturnType<typeof L.IONS.catByK>, a: ReturnType<typeof L.IONS.catByK>) => L.IONS.ionName(c, a) };
const cmp = (cat: string, an: string): Cmp => ({ cat, an });
const F = (c: Cmp): string => L.cmpFormula(c);
const cname = (c: Cmp): string => IN.ionName(IN.catByK(c.cat), IN.AN.find((a) => a.k === c.an)!);

// ---------- what happens when two solutions are mixed ----------
export type Phase = "gas" | "ppt" | "water" | "sol";
/** the phase of the compound a cation and an anion make (a "m" = slightly soluble compound is taken as a precipitate, as in the 复分解 judge) */
export function phaseOf(cat: string, an: string): Phase {
  if (cat === "H" && an === "OH") return "water";
  if ((cat === "NH4" && an === "OH") || (cat === "H" && an === "CO3")) return "gas";
  const s = L.solOf(cat, an);
  return s === "i" || s === "m" ? "ppt" : "sol";
}
export interface Mixed { happens: boolean; ambiguous: boolean; obs: "gas" | "ppt" | "none"; products: { f: string; phase: Phase }[] }
/** a slightly soluble product (a "m" cell: MgCO3, CaSO4, Ag2SO4, Ca(OH)2) makes a question unclear: such pairs are never asked */
const slight = (c: Cmp): boolean => phaseOf(c.cat, c.an) === "ppt" && L.solOf(c.cat, c.an) === "m";
export function mix(a: Cmp, b: Cmp): Mixed {
  const m = L.metathesis(a, b);
  const cs = [cmp(a.cat, b.an), cmp(b.cat, a.an)], prods = cs.map((c) => ({ f: F(c), phase: phaseOf(c.cat, c.an) }));
  const amb = m.ambiguous || cs.some(slight);
  if (!m.happens) return { happens: false, ambiguous: amb, obs: "none", products: prods };
  const obs = prods.some((p) => p.phase === "gas") ? "gas" : prods.some((p) => p.phase === "ppt") ? "ppt" : "none";
  return { happens: true, ambiguous: amb, obs, products: prods };
}
const OBS_ZH: Record<string, string> = { gas: "产生气泡", ppt: "产生白色沉淀", none: "无明显现象" };
const MARK: Record<string, string> = { gas: "↑", ppt: "↓", none: "—" };
const acidityOf = (c: Cmp): "acid" | "neutral" | "base" => (L.cmpKind(c) === "acid" ? "acid" : L.cmpKind(c) === "base" || c.an === "CO3" ? "base" : "neutral");
const LITMUS: Record<string, string> = { acid: "紫色石蕊溶液变红", neutral: "紫色石蕊溶液不变色", base: "紫色石蕊溶液变蓝" };
const PHENOL: Record<string, string> = { acid: "无色酚酞溶液不变色", neutral: "无色酚酞溶液不变色", base: "无色酚酞溶液变红" };
const POOL1 = [["H", "Cl"], ["H", "SO4"], ["Na", "OH"], ["Ba", "OH"], ["Na", "CO3"], ["Ba", "Cl"], ["Ca", "Cl"], ["Na", "Cl"], ["Na", "SO4"], ["Mg", "Cl"], ["Ag", "NO3"], ["K", "NO3"]].map(([c, a]) => cmp(c, a));
let POOL2c: Cmp[] | null = null;
const pool2 = (): Cmp[] => (POOL2c ??= POOL1.filter((c) => F(c) !== "AgNO3" && F(c) !== "MgCl2"));
export const inferPools = { mat: () => POOL1, one: pool2 };

// ---------- 推断题 ----------
const LETTERS = ["A", "B", "C", "D"];
/** how many assignments of the compounds to the letters give this table of observations (every assignment is tried) */
export function countAssignments(cands: Cmp[], table: string[][]): number {
  const n = cands.length; let count = 0;
  const perm = (used: number[]): void => {
    if (used.length === n) {
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (mix(cands[used[i]], cands[used[j]]).obs !== table[i][j]) return;
      count++; return;
    }
    for (let k = 0; k < n; k++) if (!used.includes(k)) perm([...used, k]);
  };
  perm([]);
  return count;
}
const CATC = ["Cu", "Fe3", "Mg", "Na"], ANC = ["Cl", "SO4"];
const COLOR_ZH: Record<string, string> = { Cu: "溶液呈蓝色。", Fe3: "溶液呈黄色。", Mg: "溶液是无色的。", Na: "溶液是无色的。" };
const NAOH_ZH: Record<string, string> = { Cu: "取少量溶液，滴加氢氧化钠溶液，产生蓝色沉淀。", Fe3: "取少量溶液，滴加氢氧化钠溶液，产生红褐色沉淀。", Mg: "取少量溶液，滴加氢氧化钠溶液，产生白色沉淀。", Na: "取少量溶液，滴加氢氧化钠溶液，无明显现象。" };
const BACL_ZH: Record<string, string> = { SO4: "另取少量溶液，滴加氯化钡溶液，产生白色沉淀。", Cl: "另取少量溶液，滴加氯化钡溶液，无明显现象。" };
/** the observation of a clue for a compound of the unknown pool (the same table the question uses) */
export const clueOf = (clue: string, c: { cat: string; an: string }): string => (clue === "color" ? COLOR_ZH[c.cat] : clue === "naoh" ? NAOH_ZH[c.cat] : BACL_ZH[c.an]);
const CLUES = ["color", "naoh", "bacl"];

export function genInfer(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "infer", kind, lv: lv || 2, key: `infer:${kind}` };
  if (kind === "mat") {
    const n = lv === 1 ? 3 : 4;
    for (let tries = 0; tries < 3000; tries++) {
      const cands = shuf(r, POOL1).slice(0, n), pairs = [];
      let bad = false;
      for (let i = 0; i < n && !bad; i++) for (let j = i + 1; j < n; j++) { const m = mix(cands[i], cands[j]); if (m.ambiguous) { bad = true; break; } pairs.push(m.obs); }
      if (bad) continue;
      const order = shuf(r, cands.map((_, i) => i));   // letter k holds compound cands[order[k]]
      const holds = order.map((i) => cands[i]);
      const table = holds.map((a, i) => holds.map((b, j) => (i === j ? "" : mix(a, b).obs)));
      if (table.flat().filter((x) => x && x !== "none").length < 4) continue;
      if (countAssignments(holds, table) !== 1) continue;
      const ask = ri(r, n), right = holds[ask];
      const tbl = { head: ["", ...LETTERS.slice(0, n)], rows: holds.map((_, i) => [LETTERS[i], ...holds.map((__, j) => (i === j ? "" : MARK[table[i][j]]))]) };
      return choiceQ({ ...base, lv: lv || (n === 3 ? 1 : 2), stem: [`有 ${n} 瓶无色溶液 ${LETTERS.slice(0, n).join(L.U.sep)}，它们分别是下列物质的溶液中的一种：${holds.map(F).sort().map(sub).join(L.U.sep)}。把它们两两混合，现象如下表（↓ 表示产生白色沉淀，↑ 表示产生气体，— 表示无明显现象，空格是同一种溶液）。${LETTERS[ask]} 是：`], expl: [`根据两两混合的现象逐一推断。结果：`, { u: " " + holds.map((c, i) => `${LETTERS[i]} = ${F(c)}`).join(L.U.comma) }, "。每种溶液与其他溶液混合的现象组合是唯一的，所以推断的结果是唯一的。"] }, r, [{ f: F(right) }, { u: " " + cname(right) }], shuf(r, cands.filter((c) => F(c) !== F(right))).map((c) => [{ f: F(c) }, { u: " " + cname(c) }]), { tbl, meta: { letters: LETTERS.slice(0, n), assign: holds.map(F), ask, cands: cands.map(F) } }, n) as Q;
    }
    throw new Error("no matrix");
  }
  if (kind === "one") {
    const reag: { id: string; zh?: string; c?: Cmp; obs: (x: Cmp) => string | null }[] = [
      { id: "litmus", zh: "紫色石蕊溶液", obs: (x) => LITMUS[acidityOf(x)] },
      { id: "phenol", zh: "无色酚酞溶液", obs: (x) => PHENOL[acidityOf(x)] },
      ...pool2().map((c) => ({ id: F(c), c, obs: (x: Cmp): string | null => { if (F(x) === F(c)) return null; const m = mix(c, x); return m.ambiguous ? null : OBS_ZH[m.obs]; } })),
    ];
    for (let tries = 0; tries < 3000; tries++) {
      const trio = shuf(r, pool2()).slice(0, 3);
      const rs = reag.filter((x) => !(x.c && trio.some((t) => F(t) === F(x.c!)))).map((x) => ({ x, v: trio.map((t) => x.obs(t)) })).filter((e) => e.v.every((o) => o !== null));
      const valid = rs.filter((e) => new Set(e.v).size === 3), invalid = rs.filter((e) => new Set(e.v).size < 3);
      if (!valid.length || invalid.length < 3) continue;
      const right = pick(r, valid), wrongs = shuf(r, invalid).slice(0, 3);
      const label = (e: (typeof rs)[number]): Part[] => (e.x.zh ? [e.x.zh] : [{ f: e.x.id }, { u: " " + cname(e.x.c!) }]);
      return choiceQ({ ...base, lv: lv || 2, stem: [`有三瓶无色溶液，分别是 ${trio.map(F).sort().map(sub).join(L.U.sep)} 的溶液（标签已丢失）。只用一种试剂一次就把它们区分开，这种试剂是：`], expl: [right.x.zh ? right.x.zh : { f: right.x.id }, " 分别加入三种溶液，现象依次是：", { u: " " + trio.map((t, i) => `${F(t)}：${right.v[i]}`).join(L.U.semi) }, "。三种现象各不相同，能区分开。其他选项的现象有相同的，不能一次区分。"] }, r, label(right), wrongs.map(label), { meta: { trio: trio.map(F), right: right.x.id, choices: [right, ...wrongs].map((e) => e.x.id) } }) as Q;
    }
    throw new Error("no reagent");
  }
  // unk: the unknown salt, found from the clues
  const all = CATC.flatMap((c) => ANC.map((a) => cmp(c, a)));
  for (let tries = 0; tries < 2000; tries++) {
    const x = pick(r, all), nClues = lv === 1 ? 3 : 2 + ri(r, 2), clues = shuf(r, CLUES).slice(0, nClues);
    const fits = all.filter((c) => clues.every((k) => clueOf(k, c) === clueOf(k, x)));
    if (fits.length !== 1) continue;
    const wrongs = shuf(r, all.filter((c) => F(c) !== F(x)));
    return choiceQ({ ...base, key: "infer:unk", stem: ["某盐 X 的溶液是下列八种溶液中的一种：", { f: all.map(F).join(L.U.sep) }, { u: L.U.dot }, ...clues.flatMap((k, i) => [i ? { u: " " } : "", clueOf(k, x)]) as Part[], "X 的化学式是："], expl: ["蓝色溶液含 Cu²⁺，黄色溶液含 Fe³⁺；氢氧化钠与 Cu²⁺ 生成蓝色沉淀，与 Fe³⁺ 生成红褐色沉淀，与 Mg²⁺ 生成白色沉淀；氯化钡与 SO₄²⁻ 生成不溶于水的白色沉淀 BaSO₄。根据上面的现象，只有一种盐符合：", { f: F(x) }, { u: " " + cname(x) }] }, r, [{ f: F(x) }, { u: " " + cname(x) }], wrongs.map((c) => [{ f: F(c) }, { u: " " + cname(c) }]), { meta: { x: F(x), clues, cands: all.map(F) } }) as Q;
  }
  throw new Error("no unknown");
}

// ---------- 除杂 ----------
export interface RemRes { ok: boolean; why: "ok" | "none" | "main" | "new" | "amb"; extra?: string }
/** can reagent R (added in just the right amount) remove the impurity I from the solution of the main substance M without changing M or adding a new impurity? */
export function removes(R: Cmp, I: Cmp, M: Cmp): RemRes {
  const mi = mix(R, I), mm = mix(R, M);
  if (mi.ambiguous || mm.ambiguous) return { ok: false, why: "amb" };
  if (!mi.happens) return { ok: false, why: "none" };
  if (mm.happens) return { ok: false, why: "main" };
  const extra = mi.products.filter((p) => p.phase === "sol" && p.f !== F(M)).map((p) => p.f);
  if (extra.length) return { ok: false, why: "new", extra: extra[0] };
  return { ok: true, why: "ok" };
}
const SCHOOL_R = ["HCl", "H2SO4", "NaOH", "KOH", "Ca(OH)2", "Ba(OH)2", "Na2CO3", "K2CO3", "CaCO3", "BaCl2", "Ba(NO3)2", "CaCl2", "CuSO4", "AgNO3", "MgCl2", "NaCl", "Na2SO4", "KNO3"];
/** the reagents of a school laboratory (the unlikely ones are not offered) */
const ALLC = (): Cmp[] => L.compounds().filter((c) => SCHOOL_R.includes(F(c)));
const SOLUBLE = (): Cmp[] => ALLC().filter((c) => ["s", "v"].includes(L.solOf(c.cat, c.an)) && ["H", "Na", "K", "Ba", "Ca", "Mg", "Cu", "Zn"].includes(c.cat) && c.cat !== "NH4");
export const remPool = SOLUBLE;
const WHY_ZH: Record<string, string> = { none: "：不能与杂质反应。", main: "：也会与主要物质反应。", amb: "：不能确定。" };

// metals and oxides (solid mixtures)
const MET: Record<string, string> = { Fe: "Fe2", Cu: "Cu", Zn: "Zn", Mg: "Mg", Ag: "Ag" };
const act = (s: string): number => L.data().activity.indexOf(s);
export interface SolidRes { ok: boolean; why: "ok" | "none" | "main" | "new"; extra?: string }
/** removes the impurity I (a metal symbol or "CuO") from the solid M (a metal symbol) with reagent R: an acid, or the solution of a salt of the metal Y */
export function removesSolid(R: { kind: "acid" | "salt" | "naoh"; y?: string }, I: string, M: string): SolidRes {
  const isOx = I === "CuO";
  const reactsI = R.kind === "acid" ? (isOx ? true : act(I) < act("H")) : R.kind === "salt" ? (!isOx && act(I) < act(R.y!)) : false;
  const reactsM = R.kind === "acid" ? act(M) < act("H") : R.kind === "salt" ? (M !== R.y && act(M) < act(R.y!)) : false;
  if (!reactsI) return { ok: false, why: "none" };
  if (reactsM) return { ok: false, why: "main" };
  if (R.kind === "salt" && R.y !== M) return { ok: false, why: "new", extra: R.y };
  return { ok: true, why: "ok" };
}
const SREAG: { f: string; kind: "acid" | "salt" | "naoh"; y?: string }[] = [
  { f: "HCl", kind: "acid" }, { f: "H2SO4", kind: "acid" }, { f: "CuSO4", kind: "salt", y: "Cu" }, { f: "ZnSO4", kind: "salt", y: "Zn" }, { f: "AgNO3", kind: "salt", y: "Ag" }, { f: "FeSO4", kind: "salt", y: "Fe" }, { f: "NaOH", kind: "naoh" },
];
export const solidReagents = SREAG;

export function genRem(r: Rnd, lv: number, kind: string, bank?: { q: string; a: string; w: string[]; e: string }): Q {
  const base = { mode: "rem", kind, lv: lv || 2, key: `rem:${kind}` };
  if (kind === "gas" && bank) {
    return choiceQ({ ...base, lv: 1, stem: [{ u: bank.q }], expl: [{ u: bank.e }] }, r, [{ u: bank.a }], bank.w.map((x) => [{ u: x }])) as Q;
  }
  if (kind === "soln") {
    const sol = SOLUBLE();
    for (let tries = 0; tries < 4000; tries++) {
      const M = pick(r, sol), I = pick(r, sol);
      if (F(M) === F(I) || (M.cat !== I.cat && M.an !== I.an)) continue;
      if (lv === 1 && L.cmpKind(M) !== "salt") continue;
      const res = ALLC().filter((c) => F(c) !== F(M) && F(c) !== F(I)).map((c) => ({ c, res: removes(c, I, M) }));
      const valid = res.filter((e) => e.res.ok), bad = res.filter((e) => !e.res.ok && e.res.why !== "amb");
      if (!valid.length || bad.length < 3) continue;
      const right = pick(r, valid), pls = shuf(r, bad.filter((e) => e.res.why === "new" || e.res.why === "main")), rest = shuf(r, bad.filter((e) => e.res.why === "none"));
      const wrongs = [...pls.slice(0, 2), ...rest, ...pls.slice(2)].slice(0, 3);
      const lab = (e: { c: Cmp }): Part[] => [{ f: F(e.c) }, { u: " " + cname(e.c) }];
      const rm = L.metathesis(right.c, I);
      const eqText = `${F(right.c)} + ${F(I)} → ${rm.products.join(" + ")}`;
      const exs: Part[] = [{ f: eqText }, "：杂质被除去，生成物中没有新的杂质，也不与主要物质反应。"];
      for (const w of wrongs) {
        exs.push({ u: " " }, { f: F(w.c) }, w.res.why === "new" ? "：引入了新杂质：" : WHY_ZH[w.res.why], ...(w.res.why === "new" ? [{ f: w.res.extra! } as Part, { u: L.U.dot } as Part] : []));
      }
      return choiceQ({ ...base, stem: [`除去 ${sub(F(M))} 溶液中混有的少量 ${sub(F(I))}，下列试剂（适量）中可选用的是：`], expl: exs }, r, lab(right), wrongs.map(lab), { meta: { M: F(M), I: F(I), choices: [right, ...wrongs].map((e) => F(e.c)), right: F(right.c) } }) as Q;
    }
    throw new Error("no removal");
  }
  // solid: a metal powder with a little of another metal or of CuO
  const Ms = ["Cu", "Ag"], Is = ["Fe", "Zn", "Mg", "CuO", "Cu"];
  for (let tries = 0; tries < 400; tries++) {
    const M = pick(r, Ms), I = pick(r, Is);
    if (M === I || (I === "Cu" && M !== "Ag")) continue;
    const res = SREAG.map((x) => ({ x, res: removesSolid(x, I, M) }));
    const valid = res.filter((e) => e.res.ok), bad = res.filter((e) => !e.res.ok);
    if (!valid.length || bad.length < 3) continue;
    const right = pick(r, valid), wrongs = shuf(r, bad).slice(0, 3);
    const lab = (e: { x: { f: string } }): Part[] => [{ f: e.x.f }, { u: " " + L.nameOf(e.x.f) }];
    const exs: Part[] = [right.x.kind === "acid" ? `${sub(I)} 能与稀酸反应而溶解，${sub(M)} 排在氢的后面，不与稀酸反应；过滤、洗涤、干燥即得 ${sub(M)}。` : `${sub(I)} 能把 ${sub(M)} 从它的盐溶液中置换出来，生成的正是 ${sub(M)}，没有引入新杂质。`];
    for (const w of wrongs) exs.push({ u: " " }, { f: w.x.f }, w.res.why === "new" ? "：引入了新杂质：" : WHY_ZH[w.res.why], ...(w.res.why === "new" ? [{ f: w.res.extra! } as Part, { u: L.U.dot } as Part] : []));
    const tmpl = I === "CuO" ? `除去 ${sub(M)} 粉中混有的少量 ${sub(I)}，下列试剂中可选用的是：` : `除去 ${sub(M)} 粉中混有的少量 ${sub(I)} 粉，下列试剂中可选用的是：`;
    return choiceQ({ ...base, stem: [tmpl], expl: exs }, r, lab(right), wrongs.map(lab), { meta: { M, I, right: right.x.f, choices: [right, ...wrongs].map((e) => e.x.f) } }) as Q;
  }
  throw new Error("no solid removal");
}

// ---------- flowcharts: the ion simulator ----------
export interface SimState { ions: string[]; solids: string[] }
const ionKey = (side: "c" | "a", k: string) => `${side}:${k}`;
export function ionStr(key: string): string {
  const [side, k] = key.split(":");
  const i = side === "c" ? IN.catByK(k) : IN.AN.find((a) => a.k === k)!;
  const n = Math.abs(i.ch), s = i.ch > 0 ? "⁺" : "⁻";
  return L.sub(i.f) + (n > 1 ? (n === 2 ? "²" : "³") : "") + s;
}
const symOfKey = (k: string): string => IN.catByK(k).f;
const cationOfSym = (sym: string): string | null => IN.CAT.find((c) => c.f === sym && (sym !== "Fe" || c.k === "Fe2"))?.k ?? null;
/** a compound is added IN EXCESS to the solution: ions that form a precipitate (only "i" cells), a gas or water with a reagent ion leave the solution; the excess reagent ions stay */
export function addExcess(st: SimState, cat: string, an: string): SimState {
  const ions = new Set(st.ions), solids = new Set(st.solids);
  for (const k of st.ions) {
    const [side, v] = k.split(":");
    if (side === "a") {
      const p = phaseOf(cat, v);
      if (p === "ppt" && L.solOf(cat, v) === "i") { ions.delete(k); solids.add(F(cmp(cat, v))); }
      else if (p === "gas" || p === "water") ions.delete(k);
    } else {
      const p = phaseOf(v, an);
      if (p === "ppt" && L.solOf(v, an) === "i") { ions.delete(k); solids.add(F(cmp(v, an))); }
      else if (p === "gas" || p === "water") ions.delete(k);
    }
  }
  ions.add(ionKey("c", cat)); ions.add(ionKey("a", an));
  return { ions: [...ions], solids: [...solids] };
}
/** a metal added in excess: it displaces the metals below it from their salts and stays (as a solid) */
export function addMetal(st: SimState, sym: string): SimState {
  const ions = new Set(st.ions), solids = new Set(st.solids);
  let displaced = false;
  for (const k of st.ions) {
    if (!k.startsWith("c:")) continue;
    const s = symOfKey(k.slice(2));
    if (s !== "H" && act(sym) < act(s)) { ions.delete(k); solids.add(s); displaced = true; }
  }
  const my = cationOfSym(sym);
  if (my && displaced) ions.add(ionKey("c", my));
  solids.add(sym);
  return { ions: [...ions], solids: [...solids] };
}
/** dilute acid added in excess to a solid: the metals above hydrogen dissolve */
export function addAcidToSolids(solids: string[], cat: string, an: string): SimState {
  const ions = new Set<string>([ionKey("c", cat), ionKey("a", an)]), out: string[] = [];
  for (const s of solids) {
    const ck = cationOfSym(s);
    if (ck && act(s) < act("H")) ions.add(ionKey("c", ck)); else out.push(s);
  }
  return { ions: [...ions], solids: out };
}
export interface FlowStep { n: number; op?: string; add?: string[]; metal?: string; acid?: string[]; on?: string; residue?: string; filtrate?: string; resFormula?: string[]; rx?: string }
export interface Flow { id: string; t: string; kind: "ops" | "sim" | "chain"; start?: string[]; steps: FlowStep[]; end?: string[]; nodes?: string[] }
export interface Staged { n: number; residue?: SimState["solids"]; filtrate?: string[]; label?: string }
const startState = (f: Flow): SimState => {
  const ions = new Set<string>();
  for (const x of f.start!) {
    const c = L.compounds().find((k) => F(k) === x);
    if (c) { ions.add(ionKey("c", c.cat)); ions.add(ionKey("a", c.an)); }
  }
  return { ions: [...ions], solids: [] };
};
/** run a simulated flow: what is on the filter (residue) and in the filtrate after each filtering step */
export function simulate(f: Flow): { residue: Record<string, string[]>; filtrate: Record<string, string[]> } {
  let st = startState(f);
  const res: Record<string, string[]> = {}, fil: Record<string, string[]> = {};
  const held: Record<string, string[]> = {};
  for (const s of f.steps) {
    if (s.add) st = addExcess(st, s.add[0], s.add[1]);
    else if (s.metal) st = addMetal(st, s.metal);
    else if (s.acid) { const A = held[s.on!] ?? st.solids; st = addAcidToSolids(A, s.acid[0], s.acid[1]); }
    else if (s.op === "过滤") { res[s.residue!] = st.solids.slice(); held[s.residue!] = st.solids.slice(); fil[s.filtrate!] = st.ions.slice(); st = { ions: st.ions, solids: [] }; }
    if (s.filtrate && !s.op) fil[s.filtrate] = st.ions.slice();
  }
  return { residue: res, filtrate: fil };
}
export const FLOWS = (): Flow[] => L.data().more.flows as unknown as Flow[];
/** the picture of a flow: boxes (substances / named parts) and numbered steps; the names of the operations are hidden (they are asked) */
export function flowRows(f: Flow): FlowRow[] {
  const rows: FlowRow[] = [];
  if (f.kind === "chain") {
    f.nodes!.forEach((nd, i) => { rows.push({ k: "box", t: nd }); if (i < f.steps.length) rows.push({ k: "pill", n: f.steps[i].n }); });
    return rows;
  }
  rows.push({ k: "box", t: f.start!.join(", ") });
  for (const s of f.steps) {
    const t = s.add ? `+${F(cmp(s.add[0], s.add[1]))}` : s.metal ? `+${s.metal}` : s.acid ? `${s.on} +${F(cmp(s.acid[0], s.acid[1]))}` : undefined;
    rows.push({ k: "pill", n: s.n, t });
    if (s.op === "过滤") rows.push({ k: "box", t: s.filtrate!, side: s.residue });
    else if (s.filtrate) rows.push({ k: "box", t: s.filtrate });
  }
  if (f.end) rows.push({ k: "box", t: f.end.join(", ") });
  return rows;
}
const setTxt = (xs: string[]): string => (xs.length ? xs.join(L.U.sep) : "无");

export function genFlow(r: Rnd, lv: number, kind: string): Q {
  const base = { mode: "flow", kind, lv: lv || 2, key: `flow:${kind}` };
  const flows = FLOWS();
  const TY = L.TYPES;
  if (kind === "type") {
    const f = pick(r, flows.filter((x) => x.kind === "chain")), s = pick(r, f.steps), rx = L.data().reactions.find((x) => x.eq === s.rx)!;
    return choiceQ({ ...base, lv: 1, key: `flow:type:${f.id}:${s.n}`, stem: [`下面是 “${f.t}” 的流程，各步都发生化学反应。步骤 ${s.n} 的反应属于：`], expl: [L.TYPE_NAME[rx.type], "。该步的化学方程式：", { eq: rx.id }] }, r, [L.TYPE_NAME[rx.type]], wrap(TY.filter((t) => t !== rx.type).map((t) => L.TYPE_NAME[t])), { spec: { k: "flow", rows: flowRows(f) }, meta: { flow: f.id, n: s.n, rx: rx.id } }, 4) as Q;
  }
  if (kind === "op") {
    const f = pick(r, flows.filter((x) => x.steps.some((s) => s.op))), s = pick(r, f.steps.filter((x) => x.op));
    return choiceQ({ ...base, lv: 1, key: `flow:op:${f.id}:${s.n}`, stem: [`下面是 “${f.t}” 的流程（所加试剂均过量）。操作 ${s.n} 的名称是：`], expl: [`操作 ${s.n}：`, s.op!, s.op === "过滤" ? "。把不溶于水的固体和液体分开。" : s.op === "蒸发" ? "。使溶剂挥发，得到溶质的晶体。" : "。把固体溶解在水中。"] }, r, [s.op!], wrap(L.data().more.opnames.filter((x) => x !== s.op)), { spec: { k: "flow", rows: flowRows(f) }, meta: { flow: f.id, n: s.n, op: s.op } }) as Q;
  }
  const sims = flows.filter((x) => x.kind === "sim" || (x.kind === "ops" && kind === "res"));
  const f = pick(r, sims), out = f.kind === "sim" ? simulate(f) : { residue: { A: f.steps.find((x) => x.residue)!.resFormula! }, filtrate: { B: ["c:Na", "a:Cl"] } };
  const spec = { k: "flow" as const, rows: flowRows(f) };
  if (kind === "res") {
    const letter = pick(r, Object.keys(out.residue)), right = out.residue[letter];
    const universe = [...new Set([...Object.values(out.residue).flat(), ...(f.id === "f2" ? ["BaCO3", "BaSO4", "Mg(OH)2", "CaCO3", "Ca(OH)2"] : f.id === "f3" ? ["Cu", "Fe", "Zn"] : ["SiO2", "NaCl"])])];
    const key = (xs: string[]) => xs.slice().sort().join("|");
    const cands = new Map<string, string[]>();
    for (const s of shuf(r, universe)) { const x = [...right.filter((y) => y !== s)]; if (x.length) cands.set(key(x), x); const y = [...right, s]; if (!right.includes(s)) cands.set(key(y), y); }
    for (const s of universe) if (!right.includes(s)) cands.set(key([s]), [s]);
    cands.set("none", []);
    cands.delete(key(right));
    const wrongs = shuf(r, [...cands.values()]).slice(0, 3);
    const lab = (xs: string[]): Part[] => (xs.length ? xs.flatMap((x, i) => (i ? [{ u: L.U.sep } as Part, { f: x } as Part] : [{ f: x } as Part])) : [{ u: "∅" } as Part]);
    return choiceQ({ ...base, key: `flow:res:${f.id}:${letter}`, stem: [`下面是 “${f.t}” 的流程（所加试剂均过量）。固体 ${letter} 的成分是：`], expl: [`固体 ${letter} 是过滤时留在滤纸上的不溶物：`, ...lab(right), { u: L.U.dot }] }, r, lab(right), wrongs.map(lab), { spec, meta: { flow: f.id, letter, right } }, 4) as Q;
  }
  // fil: the ions in a filtrate / a solution
  const letter = pick(r, Object.keys(out.filtrate)), right = out.filtrate[letter];
  const all = [...new Set(Object.values(out.filtrate).flat())];
  const extraPool = f.id === "f2" ? ["c:Ba", "c:Mg", "c:Ca", "a:SO4", "a:OH", "a:CO3", "c:H"] : f.id === "f3" ? ["c:Cu", "c:Fe2", "c:H", "a:SO4"] : ["c:Na", "a:Cl", "a:SO4", "c:Cu"];
  const universe = [...new Set([...all, ...extraPool])];
  const key = (xs: string[]) => xs.slice().sort().join("|");
  const cands = new Map<string, string[]>();
  for (const s of shuf(r, universe)) { if (right.includes(s)) { const x = right.filter((y) => y !== s); if (x.length) cands.set(key(x), x); } else cands.set(key([...right, s]), [...right, s]); }
  cands.delete(key(right));
  const wrongs = shuf(r, [...cands.values()]).slice(0, 3);
  const lab = (xs: string[]): Part[] => xs.slice().sort().flatMap((x, i) => (i ? [{ u: L.U.sep } as Part, { u: ionStr(x) } as Part] : [{ u: ionStr(x) } as Part]));
  return choiceQ({ ...base, key: `flow:fil:${f.id}:${letter}`, stem: [`下面是 “${f.t}” 的流程（所加试剂均过量，微溶物视为可溶）。溶液 ${letter} 中含有的离子是：`], expl: [`溶液 ${letter} 中：`, ...lab(right), { u: L.U.dot }, "加入的过量试剂的离子还留在溶液中；与它们结合成沉淀、气体或水的离子已被除去。"] }, r, lab(right), wrongs.map(lab), { spec, meta: { flow: f.id, letter, right } }, 4) as Q;
}
export { setTxt };
export type { ChoiceQ };
