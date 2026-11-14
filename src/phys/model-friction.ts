/** 摩擦力与斜面 (pure): a block on a plane tilted by alpha, pulled up the slope by F. Positive = up the slope. */
import { numQ, pick, type Q } from "./qtools";
export const g = 10;
export const SURFACES: [number, string][] = [[0, "冰面"], [1, "木板"], [2, "橡胶垫"]];
export const MU_K = [0.05, 0.3, 0.8];
export const muS = (muK: number) => 1.25 * muK;
export interface Fr { N: number; gDown: number; fMax: number; f: number; kind: "static" | "kinetic"; state: "rest" | "up" | "down"; a: number }
const rad = (d: number) => (d * Math.PI) / 180;
/** moving: 0 = at rest, 1 = already sliding up the slope */
export function solve(m: number, F: number, alpha: number, surface: number, moving: number): Fr {
  const N = m * g * Math.cos(rad(alpha)), gDown = m * g * Math.sin(rad(alpha));
  const muk = MU_K[surface], fk = muk * N, fMax = muS(muk) * N;
  const net = F - gDown;   // everything but friction
  if (moving) { const a = (net - fk) / m; return { N, gDown, fMax, f: -fk, kind: "kinetic", state: "up", a }; }
  if (Math.abs(net) <= fMax + 1e-12) return { N, gDown, fMax, f: -net, kind: "static", state: "rest", a: 0 };
  const dir = Math.sign(net);
  return { N, gDown, fMax, f: -dir * fk, kind: "kinetic", state: dir > 0 ? "up" : "down", a: (net - dir * fk) / m };
}
/** the largest angle at which a block stays at rest without a pull */
export const maxAngle = (muStatic: number) => (Math.atan(muStatic) * 180) / Math.PI;
export function quiz(rng: () => number): Q[] {
  const m1 = pick(rng, [2, 5, 10, 20]), mu1 = pick(rng, [0.1, 0.2, 0.3, 0.5]);
  const F2 = pick(rng, [5, 8, 12, 15]);
  const mus = pick(rng, [0.36, 0.5, 0.58, 0.84, 1]);
  const m4 = pick(rng, [2, 4, 5, 10]), al = pick(rng, [20, 30, 37, 45, 60]);
  const m5 = pick(rng, [5, 10, 20, 50]), mu5 = pick(rng, [0.1, 0.2, 0.4]);
  return [
    numQ(rng, "fk", [m1, mu1], `水平地面上质量 ${m1} kg 的物体，与地面的动摩擦因数为 ${mu1}，滑动时受到的摩擦力是多少？（g = 10 N/kg）`, mu1 * m1 * g, "N", 1, "f = μN，水平面上 N = mg。"),
    numQ(rng, "static", [F2], `用 ${F2} N 的水平力推一个静止的箱子，箱子没有被推动（还没到最大静摩擦力），箱子受到的摩擦力是多少？`, F2, "N", 0, "静止时，摩擦力与推力平衡。"),
    numQ(rng, "angle", [mus], `物体与斜面的静摩擦因数为 ${mus}，不加拉力时，物体恰好不下滑的最大斜面倾角约是多少？`, maxAngle(mus), "°", 0, "tan α = μ。"),
    numQ(rng, "normal", [m4, al], `质量 ${m4} kg 的物体放在倾角为 ${al}° 的斜面上，斜面对它的支持力是多少？（g = 10 N/kg）`, m4 * g * Math.cos(rad(al)), "N", 1, "N = mg cos α。"),
    numQ(rng, "uniform", [m5, mu5], `要使质量 ${m5} kg 的物体在水平面上做匀速直线运动（动摩擦因数 ${mu5}），水平拉力应为多少？（g = 10 N/kg）`, mu5 * m5 * g, "N", 1, "匀速时，拉力等于滑动摩擦力。"),
  ];
}
