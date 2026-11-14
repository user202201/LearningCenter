/** 生物与环境 (pure, 七上): the pillbug experiment (which non-living factor decides where the animals gather), the types of ecosystems and the stability of an ecosystem (a teaching model). */
import { makeQ, numQ, pick, mulberry32, type Q } from "../phys/qtools";
/** [factor, condition on the left, condition on the right, the chance that a pillbug chooses the right side] */
export const FACTORS: [string, string, string, number][] = [["光照", "明亮", "阴暗", 0.85], ["水分", "干燥", "潮湿", 0.9], ["温度", "较热（30 ℃）", "较凉（15 ℃）", 0.7]];
/** pillbugs found on the right side after a while: every animal makes its own choice */
export function onRight(n: number, factor: number, seed: number): number {
  const r = mulberry32(seed * 7717 + factor * 101 + n); let k = 0; for (let i = 0; i < n; i++) if (r() < FACTORS[factor][3]) k++; return k;
}
export const ECOS = ["森林", "草原", "湿地", "海洋", "农田", "城市"];
export const ECO_ITEMS: [string, number][] = [
  ["有“绿色水库”“地球之肺”之称", 0], ["乔木高大，动植物的种类十分繁多", 0], ["降水较少，以草本植物为主，适合放牧", 1], ["有“地球之肾”之称，能净化水质", 2],
  ["水陆之间的过渡地带，能蓄洪抗旱", 2], ["面积最大，浮游植物是主要的生产者", 3], ["农作物是主要的生产者，需要人工管理", 4], ["人是主要的消费者，需要外界输入大量物质和能量", 5],
];
/** the largest disturbance (percent of the biomass removed) an ecosystem with `div` species still recovers from */
export const capacity = (div: number) => (80 * div) / (div + 8);
export const recovers = (div: number, dist: number) => dist <= capacity(div);
/** biomass (share of the original, 0-1) `t` time units after the disturbance */
export function biomass(div: number, dist: number, t: number): number {
  const b0 = 1 - dist / 100;
  if (recovers(div, dist)) return 1 - (1 - b0) * Math.exp(-(0.05 + (0.25 * div) / (div + 8)) * t);
  return b0 * Math.exp(-0.06 * t);
}
const NONLIVING = ["阳光", "空气", "水", "温度", "土壤"], LIVING = ["蚯蚓", "杂草", "细菌", "鼠妇", "蘑菇"];
export function quiz(rng: () => number): Q[] {
  const a = pick(rng, [0, 1, 2, 3, 4]), e = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7]), d = pick(rng, [4, 8, 16, 24, 40]);
  return [
    makeQ(rng, "abiotic", [a], "下列属于非生物因素的是：", NONLIVING[a], LIVING, "生态系统中，影响生物生活的环境因素分为非生物因素（光、温度、水、空气、土壤等）和生物因素（其他生物）。"),
    makeQ(rng, "ecos", [e], `“${ECO_ITEMS[e][0]}”描述的是哪种生态系统？`, `${ECOS[ECO_ITEMS[e][1]]}生态系统`, ECOS.filter((_, k) => k !== ECO_ITEMS[e][1]).map((x) => `${x}生态系统`), "常见的生态系统有森林、草原、湿地、海洋、农田和城市生态系统。"),
    numQ(rng, "cap", [d], `在本模型中，一个生态系统能承受并恢复的最大干扰是 80 × 物种数 ÷ (物种数 + 8) %。物种数为 ${d} 时，约是多少？`, capacity(d), "%", 1, "物种越多，生态系统的自我调节能力越强，越稳定。"),
    makeQ(rng, "control", [], "探究“光对鼠妇分布的影响”时，除光以外的其他条件（温度、湿度等）应该：", "保持相同", ["尽量不同", "越多越好", "每次都改变", "不必考虑"], "对照实验中只能有一个变量。"),
    makeQ(rng, "rep", [], "探究鼠妇的分布时，用 10 只鼠妇而不是 1 只，并重复几次，主要是为了：", "减少偶然性，使结论更可靠", ["使鼠妇长得更快", "增加实验的变量", "让鼠妇不再运动", "节约时间"], "只用 1 只鼠妇，结果可能是偶然的。"),
  ];
}
