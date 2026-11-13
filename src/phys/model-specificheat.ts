/** 比热容 (pure): Q = c m dT with two samples heated by the same power. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const SUBST: [number, string, number, number][] = [[0, "煤油", 2100, 200], [1, "食用油", 2000, 200], [2, "沙子", 920, 300], [3, "铜块", 390, 400]];
export const C_WATER = 4200, BOIL_WATER = 100, T0 = 20;
export const cOf = (i: number) => SUBST[i][2];
const capOf = (i: number) => SUBST[i][3];
/** temperature rise of a sample after heat Q = P t (J) */
export const rise = (Q: number, c: number, m: number) => Q / (c * m);
/** water stays at 100 degrees while it boils (the model does not go beyond that) */
export const tempWater = (P: number, m: number, t: number) => Math.min(BOIL_WATER, T0 + rise(P * t, C_WATER, m));
export const tempOther = (i: number, P: number, m: number, t: number) => Math.min(capOf(i), T0 + rise(P * t, cOf(i), m));
export function quiz(rng: () => number): Q[] {
  const m1 = pick(rng, [0.2, 0.5, 1, 2]), d1 = pick(rng, [10, 20, 30, 50]);
  const c2 = pick(rng, [390, 460, 880, 2100, 4200]), m2 = pick(rng, [0.1, 0.2, 0.5, 1]), d2 = pick(rng, [10, 20, 50]);
  const m3 = pick(rng, [0.5, 1, 2]), Q3 = pick(rng, [42, 84, 126, 168]);
  const half = pick(rng, [2, 3]);
  return [
    numQ(rng, "Q", [m1, d1], `质量 ${m1} kg 的水温度升高 ${d1} °C，吸收的热量是多少？（c水 = 4200 J/(kg·°C)）`, (C_WATER * m1 * d1) / 1000, "kJ", 1, "Q = cmΔt。"),
    numQ(rng, "c", [c2, m2, d2], `质量 ${m2} kg 的某种物质温度升高 ${d2} °C 吸收了 ${fmtJ(c2 * m2 * d2)} J 的热量，它的比热容是多少？`, c2, "J/(kg·°C)", 0, "c = Q / (mΔt)。"),
    numQ(rng, "Tfinal", [m3, Q3], `质量 ${m3} kg、温度 20 °C 的水吸收 ${Q3} kJ 的热量（未沸腾），末温是多少？`, 20 + (Q3 * 1000) / (C_WATER * m3), "°C", 0, "Δt = Q / (cm)。"),
    makeQ(rng, "which", [], "质量相等的水和煤油吸收相同的热量，温度升高较多的是：", "煤油", ["水", "两者升高的温度相同", "无法比较"], "水的比热容较大，升温较慢。"),
    makeQ(rng, "property", [half], `把一杯水倒掉 1/${half}，剩下的水的比热容：`, "不变", ["变为原来的一半", `变为原来的 ${half} 倍`, "变为原来的 1/4"], "比热容是物质的一种特性，与质量、温度变化无关。"),
  ];
}
const fmtJ = (v: number) => String(Math.round(v));
