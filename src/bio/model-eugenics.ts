/** 遗传病与优生 (pure, 八下 · 遗传和变异): why close relatives marrying raises the chance of a child with a recessive genetic disease, and the measures of eugenics. Textbook level, a teaching calculation. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
/** [relationship, the chance that the partner carries the same gene when one partner does (the share of genes relatives have in common); unrelated = the population's carrier rate] */
export const REL: [string, number][] = [["没有亲缘关系", 0], ["表兄妹（三代以内的旁系血亲）", 1 / 8], ["同胞兄妹（亲兄妹）", 1 / 2]];
/** the chance that both partners carry the same recessive gene, when 1 person in N is a carrier */
export const bothCarry = (N: number, rel: number) => (rel === 0 ? 1 / (N * N) : (1 / N) * REL[rel][1]);
/** the chance that a child has the disease (both carry the gene, and the child receives it from each: one in four) */
export const risk = (N: number, rel: number) => bothCarry(N, rel) / 4;
export const per10000 = (v: number) => v * 10000;
/** how many times higher the chance is than for unrelated partners */
export const fold = (N: number, rel: number) => bothCarry(N, rel) / bothCarry(N, 0);
export const MEASURES = ["禁止近亲结婚", "遗传咨询", "产前诊断", "适龄生育"];
export const MEASURE_ITEMS: [string, number][] = [
  ["表兄妹结婚，后代患隐性遗传病的机会大大增加", 0], ["我国法律规定直系血亲和三代以内的旁系血亲不能结婚", 0],
  ["医生根据家族病史，推算后代患某种遗传病的可能性", 1], ["了解双方家庭中的遗传病情况后，给出生育建议", 1],
  ["怀孕后检查胎儿是否患有严重的遗传病", 2], ["通过羊水检查、B 超等方法了解胎儿的发育情况", 2],
  ["年龄过大生育，后代患某些遗传病的风险增加", 3], ["在适合的年龄生育，有利于母亲和孩子的健康", 3],
];
export function quiz(rng: () => number): Q[] {
  const N = pick(rng, [20, 40, 50, 100]), r = pick(rng, [0, 1, 2]), N2 = pick(rng, [20, 40, 50, 100]), r2 = pick(rng, [1, 2]), i = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  return [
    numQ(rng, "risk", [N, r], `每 ${N} 人中有 1 位某隐性遗传病基因的携带者。夫妻${REL[r][0]}时，孩子患这种病的概率是每一万个孩子中约多少个？（携带者之间的孩子患病概率为 1/4）`, per10000(risk(N, r)), "/10000", 2, "患病概率 = 双方都携带同一致病基因的概率 × 1/4。"),
    numQ(rng, "ratio", [N2, r2], `每 ${N2} 人中有 1 位携带者。夫妻是${REL[r2][0]}时，双方都携带同一致病基因的概率是无亲缘关系时的多少倍？`, fold(N2, r2), "×", 2, "亲缘关系越近，两人带有同一致病基因的可能性越大。"),
    makeQ(rng, "ban", [], "我国法律禁止下列哪些亲属之间结婚？", "直系血亲和三代以内的旁系血亲", ["所有亲戚", "只有兄弟姐妹", "同姓的人", "同一个村的人"], "禁止近亲结婚可以大大降低后代患隐性遗传病的概率。"),
    makeQ(rng, "measure", [i], `“${MEASURE_ITEMS[i][0]}”属于优生措施中的：`, MEASURES[MEASURE_ITEMS[i][1]], MEASURES.filter((_, k) => k !== MEASURE_ITEMS[i][1]), "优生优育的措施包括禁止近亲结婚、遗传咨询、产前诊断和适龄生育。"),
    makeQ(rng, "carrier", [], "某隐性遗传病基因的携带者（Aa）本人通常：", "不患病，但会把致病基因传给后代", ["一定患病", "不会把致病基因传给后代", "患病但症状很轻", "只传给女儿"], "隐性基因 a 的作用被显性基因 A 掩盖，所以携带者表现正常。"),
  ];
}
