/** 遗传 (pure): one-gene crosses (Punnett square), ABO blood-group inheritance and sex determination, exact ratios and random samples. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const MONO = ["AA", "Aa", "aa"];
export const ABO_G = ["AA", "Ao", "BB", "Bo", "AB", "oo"];   // IAIA, IAi, IBIB, IBi, IAIB, ii
const sortG = (a: string, b: string) => (a === b ? a + b : [a, b].sort((x, y) => (x === y ? 0 : x < y ? -1 : 1)).join(""));
const norm = (a: string, b: string, mode: number) => {
  if (mode === 0) return a === "A" && b === "A" ? "AA" : a === "a" && b === "a" ? "aa" : "Aa";
  if (mode === 2) return a === "X" && b === "X" ? "XX" : "XY";
  const p = [a, b].sort(); return p[0] === p[1] ? p[0] + p[1] : p.join("");
};
/** the four cells of the Punnett square: rows = parent 1's alleles, columns = parent 2's alleles */
export function punnett(g1: string, g2: string, mode: number): string[] {
  const out: string[] = [];
  for (const a of g1) for (const b of g2) out.push(norm(a, b, mode));
  void sortG;
  return out;
}
export const SEX = ["XX", "XY"];
export function phenotype(g: string, mode: number): string {
  if (mode === 0) return g.includes("A") ? "显性" : "隐性";
  if (mode === 2) return g === "XX" ? "女孩" : "男孩";
  const a = g.includes("A"), b = g.includes("B");
  return a && b ? "AB" : a ? "A" : b ? "B" : "O";
}
export const classes = (mode: number) => (mode === 0 ? ["显性", "隐性"] : mode === 2 ? ["女孩", "男孩"] : ["A", "B", "AB", "O"]);
export function counts(cells: string[], keys: string[]): Record<string, number> { const o: Record<string, number> = {}; for (const k of keys) o[k] = 0; for (const c of cells) o[c] = (o[c] ?? 0) + 1; return o; }
/** the probability of each phenotype class (exact: counted from the four cells) */
export function probs(cells: string[], mode: number): number[] {
  return classes(mode).map((k) => cells.filter((c) => phenotype(c, mode) === k).length / cells.length);
}
export const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** "1 AA : 2 Aa : 1 aa" (only the genotypes that occur) */
export function ratioText(cells: string[], order: string[]): string {
  const cnt = counts(cells, order), vals = order.map((k) => cnt[k]).filter((v) => v > 0), g = vals.reduce(gcd, 0) || 1;
  return order.filter((k) => cnt[k] > 0).map((k) => `${cnt[k] / g} ${k}`).join(" : ");
}
export function phenoRatioText(cells: string[], mode: number): string {
  const ks = classes(mode), p = ks.map((k) => cells.filter((c) => phenotype(c, mode) === k).length), g = p.reduce(gcd, 0) || 1;
  return ks.map((k, i) => (p[i] ? `${k} ${p[i] / g}` : "")).filter(Boolean).join(" : ");
}
/** N random offspring drawn from the four cells: counts per phenotype class */
export function sample(rng: () => number, cells: string[], mode: number, n: number): number[] {
  const ks = classes(mode), o = ks.map(() => 0);
  for (let i = 0; i < n; i++) o[ks.indexOf(phenotype(cells[Math.floor(rng() * cells.length)], mode))]++;
  return o;
}
export function chiSquare(observed: number[], p: number[]): number {
  const n = observed.reduce((a, b) => a + b, 0); let x = 0;
  observed.forEach((o, i) => { const e = n * p[i]; if (e > 0) x += (o - e) ** 2 / e; });
  return x;
}
export const abid = (g: string) => (g === "AA" ? "IAIA" : g === "Ao" ? "IAi" : g === "BB" ? "IBIB" : g === "Bo" ? "IBi" : g === "AB" ? "IAIB" : "ii");
export function quiz(rng: () => number): Q[] {
  const cr = pick(rng, [["Aa", "Aa"], ["Aa", "aa"], ["aa", "aa"]] as [string, string][]);
  const target = pick(rng, ["隐性", "显性"]);
  const cells = punnett(cr[0], cr[1], 0);
  const pr = cells.filter((c) => phenotype(c, 0) === target).length / 4;
  const N = pick(rng, [100, 200, 400, 800]);
  const ab = pick(rng, [["Ao", "Bo"], ["AB", "oo"], ["Ao", "Ao"], ["AA", "oo"], ["Bo", "oo"], ["AB", "AB"]] as [string, string][]);
  const nTypes = new Set(punnett(ab[0], ab[1], 1).map((g) => phenotype(g, 1))).size;
  const cr2 = pick(rng, [["Aa", "Aa"], ["AA", "Aa"], ["Aa", "aa"], ["AA", "aa"], ["aa", "aa"], ["AA", "AA"]] as [string, string][]);
  const GENO = ["1 AA : 2 Aa : 1 aa", "1 AA : 1 Aa", "1 Aa : 1 aa", "全部为 Aa", "全部为 aa", "全部为 AA"];
  const truth = ratioText(punnett(cr2[0], cr2[1], 0), ["AA", "Aa", "aa"]).replace(/^1 (\w+)$/, "全部为 $1").replace(/^2 (\w+)$/, "全部为 $1").replace(/^4 (\w+)$/, "全部为 $1");
  const ans2 = truth.includes(":") || truth.startsWith("全部") ? truth : truth;
  return [
    numQ(rng, "prob", [MONO.indexOf(cr[0]), MONO.indexOf(cr[1]), target === "隐性" ? 1 : 0], `豌豆的一对基因（A 显性，a 隐性）：亲代为 ${cr[0]} × ${cr[1]}，子代表现为${target}性状的概率是多少？`, pr * 100, "%", 0, "用遗传图解（棋盘）列出 4 种组合。"),
    numQ(rng, "expect", [MONO.indexOf(cr[0]), MONO.indexOf(cr[1]), N], `亲代为 ${cr[0]} × ${cr[1]}，共得到 ${N} 个后代，预期有多少个表现为隐性性状？`, (cells.filter((c) => phenotype(c, 0) === "隐性").length / 4) * N, "个", 0, "预期数 = 总数 × 概率。"),
    numQ(rng, "abo", [ABO_G.indexOf(ab[0]), ABO_G.indexOf(ab[1])], `父母的 ABO 基因型分别是 ${abid(ab[0])} 和 ${abid(ab[1])}，他们的孩子可能有几种血型？`, nTypes, "种", 0, "I^A、I^B 对 i 为显性，I^A 与 I^B 共显性。"),
    numQ(rng, "sex", [], "人的性别由性染色体决定：女性 XX，男性 XY。生一个男孩的概率是多少？", 50, "%", 0, "精子有 X 和 Y 两种，卵细胞都是 X。"),
    makeQ(rng, "geno", [MONO.indexOf(cr2[0]), MONO.indexOf(cr2[1])], `亲代基因型为 ${cr2[0]} × ${cr2[1]}，子代基因型的比为：`, ans2, GENO.filter((x) => x !== ans2), "先写出两个亲本产生的配子，再组合。"),
  ];
}
