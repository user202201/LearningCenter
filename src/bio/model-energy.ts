/** 测定食物中的能量 (pure, 七下 · 人体的营养): burn a food under a can of water and compute Q = c m dT; the energy values are rounded teaching data. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const C_WATER = 4.2;   // J / (g degC), 1 mL of water = 1 g
/** [food, energy in kJ per gram (rounded teaching values)] */
export const FOODS: [string, number][] = [["花生仁", 24], ["核桃仁", 28], ["黄豆", 16], ["大米", 15]];
/** the share of the heat that reaches the water: without / with a wind shield (a metal screen) round the flame */
export const ETA = [0.35, 0.75];
export const T0 = 20;
/** temperature rise the water would show (a rise above 80 degC means the water boils: the experiment is not valid) */
export const riseRaw = (food: number, m: number, vw: number, shield: number) => (ETA[shield] * m * FOODS[food][1] * 1000) / (C_WATER * vw);
export const boils = (food: number, m: number, vw: number, shield: number) => riseRaw(food, m, vw, shield) > 100 - T0;
export const rise = (food: number, m: number, vw: number, shield: number) => Math.min(100 - T0, riseRaw(food, m, vw, shield));
export const heat = (vw: number, dT: number) => C_WATER * vw * dT;
export const measured = (food: number, m: number, vw: number, shield: number) => heat(vw, rise(food, m, vw, shield)) / (m * 1000);
export function quiz(rng: () => number): Q[] {
  const vw = pick(rng, [30, 50, 100]), dT = pick(rng, [10, 15, 20, 25]);
  const Q1 = pick(rng, [4200, 8400, 12600]), m = pick(rng, [0.5, 1, 2]);
  const f = pick(rng, [0, 1, 2, 3]), m2 = pick(rng, [0.5, 1, 2]);
  const vw2 = pick(rng, [30, 50, 100]), dT2 = pick(rng, [10, 15, 20, 25]);
  return [
    numQ(rng, "q", [vw, dT], `质量为 ${vw} g 的水（1 mL 水约重 1 g），温度升高了 ${dT} ℃。水吸收的热量是多少？（水的比热容 4.2 J/(g·℃)）`, heat(vw, dT), "J", 0, "Q = c × m × ΔT。"),
    numQ(rng, "per", [Q1, m], `水吸收的热量为 ${Q1} J，这些热量来自 ${m} g 食物的燃烧，测得每克食物含能量多少千焦？`, Q1 / (m * 1000), "kJ/g", 1, "每克食物的能量 = Q ÷ 食物的质量，再把焦耳换成千焦。"),
    numQ(rng, "dt", [vw2, dT2], `${vw2} g 的水吸收了 ${heat(vw2, dT2)} J 的热量，水温升高多少摄氏度？（水的比热容 4.2 J/(g·℃)）`, dT2, "℃", 0, "ΔT = Q ÷ (c × m)。"),
    numQ(rng, "total", [f, m2], `${FOODS[f][0]}每克约含 ${FOODS[f][1]} kJ 的能量，${m2} g ${FOODS[f][0]}完全燃烧，放出的能量约是多少千焦？`, FOODS[f][1] * m2, "kJ", 0, "能量 = 每克含有的能量 × 质量。"),
    makeQ(rng, "loss", [], "实验测得的数值通常比食物实际含有的能量小，主要原因是：", "燃烧放出的热量没有全部被水吸收，有一部分散失到空气中", ["食物没有燃烧", "水的比热容太小", "水的质量测得太大", "食物中的能量会消失"], "加挡风罩、减小水与火焰的距离等办法可以减少热量散失。"),
  ];
}
