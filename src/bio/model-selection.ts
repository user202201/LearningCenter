/** 自然选择 (pure): the peppered moth. Two forms, light and dark; predators eat the form that is easier to see against the bark. Frequencies are followed over generations (a simplified model: one generation = survival, then reproduction in proportion). */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
/** relative survival of the dark (wD) and light (wL) form: e = predation pressure 0..1, s = soot on the bark 0..1 */
export const fitness = (e: number, s: number) => ({ wD: 1 - e * (0.8 - 0.6 * s), wL: 1 - e * (0.2 + 0.6 * s) });
export const next = (p: number, wD: number, wL: number) => (p * wD) / (p * wD + (1 - p) * wL);
export function trajectory(p0: number, e: number, s: number, gens: number): number[] {
  const { wD, wL } = fitness(e, s); const out = [p0];
  for (let g = 0; g < gens; g++) out.push(next(out[g], wD, wL));
  return out;
}
/** generations until the dark share exceeds `target` (Infinity when it never does within 1000) */
export function gensTo(p0: number, e: number, s: number, target: number): number {
  const { wD, wL } = fitness(e, s); let p = p0;
  for (let g = 0; g <= 1000; g++) { if (p > target) return g; p = next(p, wD, wL); }
  return Infinity;
}
export function quiz(rng: () => number): Q[] {
  const p = pick(rng, [0.05, 0.1, 0.2, 0.5]), e = pick(rng, [0.3, 0.5, 0.8]), s = pick(rng, [0, 0.2, 0.8, 1]);
  const f = fitness(e, s);
  const e2 = pick(rng, [0.2, 0.4, 0.6, 0.8, 1]), s2 = pick(rng, [0, 0.25, 0.5, 0.75, 1]);
  const [p0, e3, s3] = pick(rng, [[0.05, 0.6, 0.9], [0.1, 0.5, 0.8], [0.01, 0.8, 1], [0.2, 0.7, 0.9], [0.05, 0.9, 0.8]] as [number, number, number][]);
  return [
    numQ(rng, "next", [p, e, s], `某蛾类深色型占 ${p * 100}%。污染程度 s = ${s}，捕食压力 e = ${e}。按模型 深色型存活率 = 1 − e(0.8 − 0.6s)，浅色型存活率 = 1 − e(0.2 + 0.6s)，下一代深色型占多少？（%）`, next(p, f.wD, f.wL) * 100, "%", 1, "下一代比例 = p·wD /(p·wD + (1−p)·wL)。"),
    numQ(rng, "fit", [e2, s2], `捕食压力 e = ${e2}，树皮的污染程度 s = ${s2}。按模型，深色型的存活率（%）是多少？（存活率 = 1 − e(0.8 − 0.6s)）`, fitness(e2, s2).wD * 100, "%", 0, "树皮越黑，深色蛾越不容易被发现。"),
    numQ(rng, "gen", [p0, e3, s3], `起初深色型占 ${p0 * 100}%，e = ${e3}，s = ${s3}。深色型的比例超过 50% 至少需要几代？`, gensTo(p0, e3, s3, 0.5), "代", 0, "逐代按模型计算。"),
    makeQ(rng, "drive", [], "桦尺蛾在污染的环境中深色型增多，说明：", "环境对生物的变异起选择作用，适者生存", ["环境使浅色蛾突然变黑", "深色蛾故意躲避捕食者", "所有蛾都发生了相同的变异", "浅色蛾全部迁出了该地区"], "变异是不定向的，自然选择是定向的。"),
    makeQ(rng, "none", [], "如果没有捕食者（e = 0），两种体色蛾的比例会：", "保持不变", ["浅色型增多", "深色型增多", "深色型消失", "两种体色都消失"], "没有选择压力，比例不变（本模型不含迁入、迁出与随机变化）。"),
  ];
}
