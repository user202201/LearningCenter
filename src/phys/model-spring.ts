/** 弹力与重力 (pure): Hooke's law and weight G = m g. */
import { numQ, pick, type Q } from "./qtools";
export const G_EARTH = 9.8;
export const PLANETS: [number, string][] = [[0, "地球"], [1, "月球"], [2, "火星"], [3, "木星"]];
export const GRAV = [9.8, 1.6, 3.7, 24.8];
export const ELASTIC_LIMIT = 0.3;   // m: beyond this extension the spring does not return to its length
export const weight = (m: number, g: number) => m * g;
export const extension = (F: number, k: number) => F / k;
export const beyondLimit = (x: number) => x > ELASTIC_LIMIT + 1e-9;
export function quiz(rng: () => number): Q[] {
  const m1 = pick(rng, [0.5, 1, 2, 5, 10]), m2 = pick(rng, [6, 12, 18, 30, 60]);
  const F = pick(rng, [2, 3, 4, 6]), x = pick(rng, [2, 3, 4, 5]), F2 = F * pick(rng, [2, 3]);
  const G = pick(rng, [9.8, 19.6, 29.4, 49, 98]);
  const F3 = pick(rng, [2, 4, 5, 10]), x3 = pick(rng, [0.04, 0.08, 0.1, 0.2]);
  return [
    numQ(rng, "G", [m1], `质量 ${m1} kg 的物体在地球上受到的重力是多少？（g = 9.8 N/kg）`, m1 * G_EARTH, "N", 1, "G = mg。"),
    numQ(rng, "moon", [m2], `质量 ${m2} kg 的宇航员在月球上受到的重力是多少？（月球上 g = 1.6 N/kg）`, m2 * 1.6, "N", 1, "质量不变，g 变小，重力变小。"),
    numQ(rng, "hooke", [F, x, F2], `弹簧受 ${F} N 的拉力时伸长 ${x} cm（在弹性限度内），受 ${F2} N 的拉力时伸长多少？`, (F2 * x) / F, "cm", 1, "在弹性限度内，伸长量与拉力成正比。"),
    numQ(rng, "mass", [G], `物体在地球上受到的重力是 ${G} N，它的质量是多少？（g = 9.8 N/kg）`, G / G_EARTH, "kg", 1, "m = G / g。"),
    numQ(rng, "k", [F3, x3], `弹簧受 ${F3} N 的拉力时伸长 ${x3} m，弹簧的劲度系数是多少？`, F3 / x3, "N/m", 0, "F = kx。"),
  ];
}
