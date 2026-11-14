/** 连通器、流体压强与流速 (pure): the U-tube with two liquids, Bernoulli's law in a pipe that narrows, the air between two sheets of paper. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const G = 9.8;
/** the liquid poured into the right arm (the left arm holds water): name, density kg/m^3 */
export const LIQ: [string, number][] = [["水", 1000], ["酒精", 800], ["植物油", 900], ["盐水", 1200]];
/** the two liquids meet at the same horizontal level: p = rho g h is equal on both sides, so rho1 h1 = rho2 h2 (heights in cm, above that level) */
export const hRight = (h1: number, rho2: number, rho1 = 1000) => (h1 * rho1) / rho2;
export const liquidP = (rho: number, hCm: number) => rho * G * (hCm / 100);
export const A1 = 10, P_IN = 150, RHO_W = 1000, RHO_AIR = 1.29;
/** flow Q in L/s through a pipe of cross-section A cm^2: v in m/s */
export const speed = (Q: number, A: number) => (Q * 1e-3) / (A * 1e-4);
/** Bernoulli: p + rho v^2 / 2 is the same along the pipe: the pressure (kPa) in the narrow part, given the wide part's p1 (kPa) */
export const narrowP = (Q: number, A2: number, p1 = P_IN) => p1 - (0.5 * RHO_W * (speed(Q, A2) ** 2 - speed(Q, A1) ** 2)) / 1000;
export const dropKPa = (v1: number, v2: number) => (0.5 * RHO_W * (v2 * v2 - v1 * v1)) / 1000;
/** the air that is blown between two sheets of paper: the pressure drop in Pa and whether the sheets are pushed together */
export const airDrop = (v: number) => 0.5 * RHO_AIR * v * v;
export const CLOSE_AT = 10;   // Pa: the weight of a sheet of paper is about this much per area
export const closes = (v: number) => airDrop(v) >= CLOSE_AT;
export function quiz(rng: () => number): Q[] {
  const h1 = pick(rng, [10, 12, 15, 20]), [ln, lr] = pick(rng, [LIQ[1], LIQ[2], LIQ[3]]);
  const [Q, A] = pick(rng, [[1, 5], [2, 10], [3, 5], [1.5, 5], [2, 4]]);
  const [v1, v2] = pick(rng, [[1, 5], [2, 6], [2, 8], [3, 7], [1, 9]]);
  return [
    numQ(rng, "h_right", [h1, lr], `U 形管左管是水，右管倒入${ln}（密度 ${lr} kg/m³），静止时左管的水柱比两液体交界面高 ${h1} cm，右管的${ln}柱比交界面高多少？`, hRight(h1, lr), "cm", 1, "交界面处两边压强相等：ρ水 h水 = ρ液 h液。"),
    numQ(rng, "bern_v", [Q, A], `流量为 ${Q} L/s 的水通过横截面积 ${A} cm² 的管子，水的流速是多少？`, speed(Q, A), "m/s", 1, "v = Q / S。"),
    numQ(rng, "dp", [v1, v2], `水平管里的水，宽处流速 ${v1} m/s，窄处流速 ${v2} m/s，窄处的压强比宽处低多少？（水的密度 1000 kg/m³）`, dropKPa(v1, v2), "kPa", 1, "p + ½ρv² 不变，Δp = ½ρ(v₂² − v₁²)。"),
    makeQ(rng, "bern", [], "对于流动的液体或气体，下列说法正确的是：", "流速大的地方压强小，流速小的地方压强大", ["流速大的地方压强大", "流速不影响压强", "流速大的地方压强小，所以两张纸中间吹气时纸会分开"], "两张纸中间的空气流速大、压强小，纸被外面较大的气压压向中间。"),
    makeQ(rng, "connected", [], "下列哪一个是利用连通器原理工作的？", "船闸", ["注射器", "吸盘挂钩", "飞机的机翼"], "船闸、茶壶、锅炉水位计都是上端开口、下端连通的连通器。"),
  ];
}
