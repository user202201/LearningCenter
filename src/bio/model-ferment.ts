/** 微生物与发酵 (pure): yeast fermentation (carbon dioxide, ethanol) and the growth curve of bacteria. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const yeastTemp = (T: number) => (T >= 60 ? 0 : Math.max(0, 1 - ((T - 35) / 30) ** 2));   // 0 at 5 and 65 degrees, killed at 60
/** mL of carbon dioxide per minute */
export const gasRate = (sugar: number, T: number, yeast: number) => 2 * yeast * (sugar / (sugar + 3)) * yeastTemp(T);
export const gasCap = (sugar: number) => 40 * sugar;
export const gasTotal = (sugar: number, T: number, yeast: number, t: number) => Math.min(gasRate(sugar, T, yeast) * t, gasCap(sugar));
export const ethanol = (gas: number) => gas * 0.0018 * (92 / 88);   // g
/** the glucose that gives `m` g of carbon dioxide: C6H12O6 -> 2 C2H5OH + 2 CO2 (180 g : 88 g) */
export const co2Mass = (glucose: number) => (glucose * 88) / 180;
// ---- bacteria ----
export const K_MAX = 1e9, N_START = 100, LAG = 60, STAT = 120, DEATH = 120;
/** minutes for the population to double (Infinity outside 5-50 degrees) */
export const doubling = (T: number) => (T < 5 || T > 50 ? Infinity : 20 + 1.5 * Math.abs(T - 37));
export function bacteria(T: number, hours: number): { N: number; phase: string; divisions: number } {
  const t = hours * 60, g = doubling(T);
  if (!Number.isFinite(g)) return { N: N_START, phase: t < LAG ? "延缓期" : "不生长", divisions: 0 };
  if (t <= LAG) return { N: N_START, phase: "延缓期", divisions: 0 };
  const tfull = LAG + g * Math.log2(K_MAX / N_START);
  if (t <= tfull) return { N: N_START * 2 ** ((t - LAG) / g), phase: "对数期", divisions: (t - LAG) / g };
  if (t <= tfull + STAT) return { N: K_MAX, phase: "稳定期", divisions: Math.log2(K_MAX / N_START) };
  return { N: K_MAX * Math.exp(-(t - tfull - STAT) / DEATH), phase: "衰亡期", divisions: Math.log2(K_MAX / N_START) };
}
export const PRODUCTS: [string, string][] = [["酵母菌", "酒精和二氧化碳"], ["乳酸菌", "乳酸"], ["醋酸菌", "醋酸"]];
export function quiz(rng: () => number): Q[] {
  const n0 = pick(rng, [100, 1000, 5000]), n = pick(rng, [3, 4, 5, 6, 8, 10]);
  const glu = pick(rng, [18, 36, 90, 180]);
  const pr = pick(rng, PRODUCTS);
  return [
    numQ(rng, "dbl", [n0, n], `一个细菌每 20 分钟分裂一次。培养液中最初有 ${n0} 个细菌，经过 ${n} 次分裂后（忽略死亡）共有多少个？`, n0 * 2 ** n, "个", 0, "细菌以二分裂的方式繁殖：N = N₀ × 2ⁿ。"),
    numQ(rng, "co2", [glu], `酵母菌无氧呼吸：C₆H₁₂O₆ → 2C₂H₅OH + 2CO₂。${glu} g 葡萄糖完全发酵，最多产生多少克二氧化碳？（相对分子质量：葡萄糖 180，二氧化碳 44）`, co2Mass(glu), "g", 1, "180 g 葡萄糖产生 88 g 二氧化碳。"),
    makeQ(rng, "prod", [PRODUCTS.indexOf(pr)], `${pr[0]}发酵的产物主要是：`, pr[1], PRODUCTS.map((x) => x[1]).filter((x) => x !== pr[1]).concat(["酒精和乳酸", "醋酸和氧气"]), "酿酒用酵母菌，制酸奶、泡菜用乳酸菌，制醋用醋酸菌。"),
    makeQ(rng, "phase", [], "细菌生长曲线中，细菌数量按指数方式增长最快的时期是：", "对数期", ["延缓期", "稳定期", "衰亡期"], "对数期营养充足、环境适宜，繁殖速度最快。"),
    makeQ(rng, "anaer", [], "酵母菌酿酒（产生酒精）需要的条件是：", "无氧（密封）", ["充足的氧气", "强光照", "低于 0 °C", "高于 100 °C"], "有氧时酵母菌大量繁殖，无氧时发酵产生酒精。"),
  ];
}
