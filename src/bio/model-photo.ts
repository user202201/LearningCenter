/** 光合作用 (pure): the rate of oxygen release as a function of light, carbon dioxide and temperature (saturating, with an enzyme optimum), and the starch test. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const KI = 15, KC = 0.03, PMAX = 40, TOPT = 30;
export const tf = (T: number) => Math.max(0, 1 - ((T - TOPT) / 25) ** 2);   // 0 at 5 and 55 degrees
export const fI = (I: number) => I / (I + KI);
export const fC = (C: number) => C / (C + KC);
export const rate = (I: number, C: number, T: number) => PMAX * fI(I) * fC(C) * tf(T);
/** the rate that more light can not exceed */
export const limit = (C: number, T: number) => PMAX * fC(C) * tf(T);
export function limiting(I: number, C: number, T: number): string {
  const f = [fI(I), fC(C), tf(T)], i = f.indexOf(Math.min(...f));
  return ["光照强度", "二氧化碳浓度", "温度"][i];
}
/** share of a leaf region that has turned blue-black with iodine after `hours` hours at the given oxygen rate */
export const starch = (r: number, hours: number) => 1 - Math.exp((-r * hours) / 30);
export function quiz(rng: () => number): Q[] {
  const I = pick(rng, [5, 15, 30, 45, 60, 80]), C = pick(rng, [0.02, 0.04, 0.08, 0.15]), T = pick(rng, [15, 20, 25, 30, 35]);
  const C2 = pick(rng, [0.04, 0.08, 0.1, 0.2]), T2 = pick(rng, [20, 25, 30, 35]);
  const C3 = pick(rng, [0.04, 0.08, 0.1, 0.2]), T3 = pick(rng, [20, 25, 30]);
  const lim = pick(rng, [[5, 0.1, 30, "光照强度"], [60, 0.01, 30, "二氧化碳浓度"], [60, 0.1, 10, "温度"]] as [number, number, number, string][]);
  return [
    numQ(rng, "rate", [I, C, T], `某水草在光照 ${I} klx、二氧化碳浓度 ${C}%、温度 ${T} °C 时，每分钟放出的氧气气泡数约为（模型：最大 40 个，半饱和光强 15 klx，半饱和 CO₂ 0.03%，最适温度 30 °C）：`, rate(I, C, T), "个", 1, "速率 = 40 × I/(I+15) × C/(C+0.03) × 温度因子。"),
    makeQ(rng, "limit", [lim[0], lim[1], lim[2]], `光照 ${lim[0]} klx、二氧化碳浓度 ${lim[1]}%、温度 ${lim[2]} °C 时，限制光合速率的主要因素是：`, limiting(lim[0], lim[1], lim[2]), ["光照强度", "二氧化碳浓度", "温度", "水分"].filter((x) => x !== limiting(lim[0], lim[1], lim[2])), "最不足的那个因素限制速率。"),
    numQ(rng, "limit_value", [C2, T2], `二氧化碳浓度 ${C2}%、温度 ${T2} °C 时，光照再强，每分钟放出的氧气气泡数最多约为：`, limit(C2, T2), "个", 1, "光照饱和后速率趋于上限。"),
    numQ(rng, "half", [C3, T3], `二氧化碳浓度 ${C3}%、温度 ${T3} °C 时，光照强度等于半饱和光强（15 klx）时，速率约为上限的一半，是多少个/分钟？`, limit(C3, T3) / 2, "个", 1, "I = 15 klx 时 I/(I+15) = 1/2。"),
    makeQ(rng, "starch", [], "把一片叶子的一半用锡箔遮光，光照数小时后用碘液检验，变成蓝黑色的是：", "没有遮光的部分", ["遮光的部分", "整片叶子", "叶脉以外的部分", "两部分都不变色"], "光合作用制造淀粉，淀粉遇碘变蓝。"),
  ];
}
