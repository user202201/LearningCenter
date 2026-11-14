/** 影响电阻大小的因素 (pure): two wires in turn in a circuit with a 3 V battery and a 5 ohm resistor; the resistance grows with the length, falls with the cross-section, depends on the material and (for metals) rises with the temperature. */
import { makeQ, numQ, pick, type Q } from "./qtools";
/** [name, resistance of a wire 1 m long and 1 mm² thick at 20 ℃ (ohm), temperature coefficient per ℃] */
export const MATS: [string, number, number][] = [["铜", 0.017, 0.0039], ["铝", 0.028, 0.0039], ["铁", 0.1, 0.005], ["康铜", 0.49, 0.00002], ["镍铬合金", 1.1, 0.0004]];
export const resistance = (mat: number, L: number, S: number, T = 20) => (MATS[mat][1] * L * (1 + MATS[mat][2] * (T - 20))) / S;
export const E = 3, R_SERIES = 5;
/** the ammeter reads to 0.01 A */
export const current = (R: number) => Math.round((E / (R_SERIES + R)) * 100) / 100;
/** mode 0 length, 1 cross-section, 2 material, 3 temperature: wire A is the reference, wire B changes one thing */
export const REF: [number, number, number][] = [[4, 1, 0.5], [4, 1, 0.5], [4, 1, 0.5], [2, 3, 0.2]];
export interface Pair { RA: number; RB: number; IA: number; IB: number }
export function pair(mode: number, LB: number, SB: number, matB: number, TB: number): Pair {
  const [m, L, S] = REF[mode];
  const RA = resistance(m, L, S);
  const RB = mode === 0 ? resistance(m, LB, S) : mode === 1 ? resistance(m, L, SB) : mode === 2 ? resistance(matB, L, S) : resistance(m, L, S, TB);
  return { RA, RB, IA: current(RA), IB: current(RB) };
}
export function quiz(rng: () => number): Q[] {
  const [R, n] = pick(rng, [[12, 2], [12, 3], [12, 4], [20, 2], [20, 4], [20, 5], [24, 3], [24, 4], [30, 2], [30, 3], [30, 5], [60, 4], [60, 5], [60, 3]]);
  const R2 = pick(rng, [2, 4, 5, 10]), k = pick(rng, [2, 3]);
  const [a, b, R3] = pick(rng, [[1, 2, 10], [2, 1, 10], [0.5, 1.5, 30], [1, 4, 20], [3, 1, 6]]);
  const fac = pick(rng, ["导体两端的电压", "通过导体的电流"]);
  const tab = pick(rng, [["长度和横截面积都相同的铜丝、铁丝、镍铬合金丝，在室温下电阻最大的是：", "镍铬合金丝", ["铜丝", "铁丝", "三者一样大"]], ["长度和横截面积都相同的铜丝、铁丝、镍铬合金丝，在室温下电阻最小的是：", "铜丝", ["铁丝", "镍铬合金丝", "三者一样大"]]]);
  return [
    numQ(rng, "cut", [R, n], `把一根电阻是 ${R} Ω 的均匀电阻丝截成长度相等的 ${n} 段，每一段的电阻是多少？`, R / n, "Ω", 1, "材料、横截面积不变时，导体的电阻与长度成正比。"),
    numQ(rng, "stretch", [R2, k], `把一根电阻是 ${R2} Ω 的均匀金属丝拉长到原来的 ${k} 倍（体积不变，粗细仍然均匀），它的电阻变为多少？`, R2 * k * k, "Ω", 0, "长度变为 k 倍，横截面积变为 1/k，电阻变为原来的 k × k 倍。"),
    numQ(rng, "area", [a, b, R3], `长度和材料都相同的两根导线，横截面积是 ${a} mm² 的那根电阻为 ${R3} Ω，横截面积是 ${b} mm² 的那根电阻是多少？`, (R3 * a) / b, "Ω", 1, "长度、材料不变时，导体的电阻与横截面积成反比。"),
    makeQ(rng, "factor", [], "下列因素中，不影响导体电阻大小的是：", fac, ["导体的长度", "导体的横截面积", "导体的材料"], "导体的电阻是导体本身的性质，与它的材料、长度、横截面积和温度有关，与电压、电流无关。"),
    makeQ(rng, "table", [], tab[0] as string, tab[1] as string, tab[2] as string[], "在长度、横截面积相同时，镍铬合金的电阻比铁、铜大得多，铜的电阻很小。"),
  ];
}
