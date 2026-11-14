/** 汽化与液化、升华与凝华 (pure): evaporation (teaching model), liquefying a gas by cooling / compressing (Clausius-Clapeyron + critical temperature), iodine sublimation, the six changes of state. */
import { makeQ, numQ, pick, shuffle, type Q } from "./qtools";
// ---------- evaporation ----------
export const M0 = 20;                                  // g of water at the start
export const WINDS = ["无风", "微风", "强风"];
const WIND_F = [1, 1.6, 2.4];
/** the rate (g/min) grows with the temperature, the surface area and the air flow (a teaching model: the textbook states the trends only) */
export const evapRate = (T: number, A: number, wind: number) => 0.0005 * A * (T + 20) * WIND_F[wind];
export const waterLeft = (rate: number, t: number) => Math.max(0, M0 - rate * t);
/** evaporation takes heat from the liquid left: it is cooler than its surroundings (an illustrative size) */
export const coolDrop = (rate: number) => Math.min(10, 5 * rate);
// ---------- liquefying a gas ----------
export interface Gas { name: string; Tb: number; L: number; Tc: number }
export const GASES: Gas[] = [{ name: "水蒸气", Tb: 373.15, L: 40700, Tc: 647.1 }, { name: "石油气（丁烷）", Tb: 272.65, L: 22400, Tc: 425.1 }, { name: "氧气", Tb: 90.2, L: 6800, Tc: 154.6 }];
const R = 8.314, K = 273.15;
/** saturated vapour pressure in atmospheres at T (℃), from the boiling point at 1 atm and the heat of vaporisation (Clausius-Clapeyron) */
export const satPressure = (g: number, T: number) => Math.exp((GASES[g].L / R) * (1 / GASES[g].Tb - 1 / (T + K)));
/** the boiling point (℃) at the pressure p (atm) */
export const boilingAt = (g: number, p: number) => 1 / (1 / GASES[g].Tb - (R * Math.log(p)) / GASES[g].L) - K;
export type GState = "gas" | "liquid" | "hot";
/** hot = above the critical temperature: compressing cannot make a liquid */
export function gasState(g: number, T: number, p: number): GState {
  if (T + K > GASES[g].Tc) return "hot";
  return p >= satPressure(g, T) ? "liquid" : "gas";
}
// ---------- iodine in a flask in a water bath ----------
export const M_IODINE = 2, IODINE_MELT = 113.7;
export const sublRate = (bath: number) => 0.004 * 2 ** ((bath - 20) / 15);          // g/min
export const vapour = (bath: number, t: number) => Math.min(M_IODINE, sublRate(bath) * t);
export const crystals = (bath: number, t: number, cold: number) => (cold === 1 ? 0.8 * vapour(bath, t) : 0);
// ---------- the six changes of state ----------
export const PROC = ["熔化", "凝固", "汽化", "液化", "升华", "凝华"];
export const ABSORB = [true, false, true, false, true, false];
const WHY = ["熔化吸热。", "凝固放热。", "汽化吸热。", "液化放热。", "升华吸热。", "凝华放热。"];
export const PHEN: [string, number][] = [["冰雪消融", 0], ["河水结冰", 1], ["湿衣服晾干", 2], ["锅里的水被烧干", 2], ["草叶上的露珠", 3], ["烧开水时壶嘴冒出的白气", 3], ["樟脑丸越来越小", 4], ["冰冻的衣服变干", 4], ["冰箱冷冻室内壁的白霜", 5], ["窗玻璃内侧的冰花", 5], ["铁水浇铸成铁锭", 1], ["冰块在手中变成水", 0]];
export function quiz(rng: () => number): Q[] {
  const m0 = pick(rng, [50, 60, 80]), r = pick(rng, [0.5, 0.8, 1, 1.2, 1.5]), t = pick(rng, [10, 20, 30]);
  const m = pick(rng, [12, 15, 20, 24, 30]), t2 = pick(rng, [5, 6, 8, 10]);
  const factor = pick(rng, [
    ["下列做法中，能减慢蒸发的是：", "把盛有酒精的瓶子盖紧", ["把湿衣服摊开晾晒", "用电吹风吹湿头发", "把洒在地面的水扫开"], "减小液体的表面积、降低温度、减弱液面上方的空气流动，都能减慢蒸发。"],
    ["下列做法中，能加快蒸发的是：", "把湿衣服摊开放在通风处", ["用保鲜膜把水果包起来", "把酒精装在密封的瓶中", "把湿衣服叠在一起放进塑料袋"], "增大液体的表面积、提高温度、加快液面上方的空气流动，都能加快蒸发。"],
  ] as [string, string, string[], string][]);
  const lq = pick(rng, [
    ["使气体液化的两种方法是：", "降低温度和压缩体积", ["升高温度和增大体积", "降低温度和增大体积", "升高温度和压缩体积"], "所有气体在温度降到足够低时都可以液化；在一定温度下压缩体积也可以使气体液化。"],
    ["家用液化石油气是用什么方法装进钢瓶的？", "在常温下压缩体积", ["降低到很低的温度", "升高温度", "增大体积"], "常温下用压缩体积的方法使石油气液化，便于储存和运输。"],
  ] as [string, string, string[], string][]);
  const [ph, pi] = pick(rng, PHEN);
  const names = shuffle(rng, PROC.filter((_, i) => i !== pi));
  return [
    numQ(rng, "remain", [m0, r, t], `一杯水 ${m0} g，每分钟蒸发 ${r} g，${t} min 后还剩多少克？`, m0 - r * t, "g", 1, "剩余的水 = 原来的水 − 每分钟蒸发的质量 × 时间。"),
    numQ(rng, "avgrate", [m, t2], `${m} g 水在 ${t2} min 内全部蒸发，平均每分钟蒸发多少克？`, m / t2, "g", 2, "平均速度 = 蒸发的质量 ÷ 时间。"),
    makeQ(rng, "factor", [], factor[0], factor[1], factor[2], factor[3]),
    makeQ(rng, "liquefy", [], lq[0], lq[1], lq[2], lq[3]),
    makeQ(rng, "process", [PHEN.findIndex((x) => x[0] === ph)], `“${ph}”发生的物态变化是：`, PROC[pi], names, WHY[pi]),
  ];
}
