/** 物态变化: the temperature-time curves of a crystal (ice -> water -> steam), an amorphous solid (wax) and freezing water (pure). */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const C_ICE = 2100, C_WATER = 4200, C_STEAM = 2000, L_FUSION = 3.34e5, L_VAPOUR = 2.26e6;
/** phases: 0 solid, 1 melting / freezing (solid + liquid), 2 liquid, 3 boiling, 4 gas; for the wax: 0 hard, 1 soft, 2 liquid */
export interface Point { T: number; phase: number }
/** mode 0: heating ice from -20 °C; mode 1: heating wax from 20 °C; mode 2: cooling water from 20 °C (power = heat taken away). Q = P t, mass m (kg) */
export function curve(mode: number, P: number, m: number, t: number): Point {
  const Q = Math.max(0, P * t);
  if (mode === 0) {
    const q1 = m * C_ICE * 20, q2 = m * L_FUSION, q3 = m * C_WATER * 100, q4 = m * L_VAPOUR;
    if (Q < q1) return { T: -20 + Q / (m * C_ICE), phase: 0 };
    if (Q < q1 + q2) return { T: 0, phase: 1 };
    if (Q < q1 + q2 + q3) return { T: (Q - q1 - q2) / (m * C_WATER), phase: 2 };
    if (Q < q1 + q2 + q3 + q4) return { T: 100, phase: 3 };
    return { T: 100 + (Q - q1 - q2 - q3 - q4) / (m * C_STEAM), phase: 4 };
  }
  if (mode === 1) {
    // wax: c = 2000 below 40 °C, 4000 between 40 and 70 °C (softening), 2200 above: no flat part
    const q1 = m * 2000 * 20, q2 = m * 4000 * 30;
    if (Q < q1) return { T: 20 + Q / (m * 2000), phase: 0 };
    if (Q < q1 + q2) return { T: 40 + (Q - q1) / (m * 4000), phase: 1 };
    return { T: 70 + (Q - q1 - q2) / (m * 2200), phase: 2 };
  }
  const q1 = m * C_WATER * 20, q2 = m * L_FUSION;
  if (Q < q1) return { T: 20 - Q / (m * C_WATER), phase: 2 };
  if (Q < q1 + q2) return { T: 0, phase: 1 };
  return { T: -(Q - q1 - q2) / (m * C_ICE), phase: 0 };
}
/** the share of the sample that is solid (1 = all ice) */
export function solidFraction(mode: number, P: number, m: number, t: number): number {
  const p = curve(mode, P, m, t), Q = P * t;
  if (mode === 1) return p.phase === 0 ? 1 : p.phase === 1 ? 1 - (Q - m * 2000 * 20) / (m * 4000 * 30) : 0;
  if (mode === 0) return p.phase === 0 ? 1 : p.phase === 1 ? 1 - (Q - m * C_ICE * 20) / (m * L_FUSION) : 0;
  return p.phase === 2 ? 0 : p.phase === 1 ? (Q - m * C_WATER * 20) / (m * L_FUSION) : 1;
}
/** heat needed to warm m kg of a substance by dT */
export const heat = (c: number, m: number, dT: number) => c * m * dT;
export const meltTime = (m: number, P: number) => (L_FUSION * m) / P;
/** the length of the flat part (seconds) of a crystal curve */
export const plateau = (mode: number, P: number, m: number): number => (mode === 0 ? meltTime(m, P) : mode === 2 ? meltTime(m, P) : 0);
export function quiz(rng: () => number): Q[] {
  const m = pick(rng, [0.2, 0.5, 1, 2]), dT = pick(rng, [10, 20, 30, 50, 80]);
  const m2 = pick(rng, [0.1, 0.2, 0.5, 1]);
  const P = pick(rng, [200, 400, 500, 1000]), m3 = pick(rng, [0.1, 0.2, 0.5]);
  const m4 = pick(rng, [0.1, 0.2, 0.5]), P4 = pick(rng, [200, 400, 800]);
  return [
    numQ(rng, "Q=cmdT", [m, dT], `质量 ${m} kg 的水温度升高 ${dT} °C，吸收的热量是多少？（水的比热容 4200 J/(kg·°C)）`, (C_WATER * m * dT) / 1000, "kJ", 1, "Q = cmΔT。"),
    numQ(rng, "melt", [m2], `熔化 ${m2} kg 的冰（已在 0 °C），需要吸收多少热量？（冰的熔化热 3.34×10⁵ J/kg）`, (L_FUSION * m2) / 1000, "kJ", 1, "Q = λm。"),
    numQ(rng, "meltTime", [P, m3], `用 ${P} W 的恒定功率加热 ${m3} kg 的冰（已在 0 °C，热量全部被吸收），熔化完需要多少秒？`, meltTime(m3, P), "s", 0, "t = λm / P。"),
    numQ(rng, "heatTime", [m4, P4], `用 ${P4} W 的恒定功率把 ${m4} kg 的水从 20 °C 加热到 100 °C，需要多少秒？`, (C_WATER * m4 * 80) / P4, "s", 0, "t = cmΔT / P。"),
    makeQ(rng, "concept", [], "晶体（如冰）在熔化过程中，温度怎样变化？", "吸热，温度保持不变", ["吸热，温度不断升高", "放热，温度不断降低", "放热，温度保持不变", "不吸热也不放热"], "晶体有固定的熔点，熔化时吸收热量，温度不变。"),
  ];
}
