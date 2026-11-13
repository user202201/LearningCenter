/** 欧姆定律与串、并联电路 (pure): closed-form solvers for two resistors in series, in parallel, and with a rheostat; power and Joule heat. */
import { numQ, pick, type Q } from "./qtools";
export const R0 = 10, RMAX = 50;
export interface Circ { R: number; I: number; I1: number; I2: number; U1: number; U2: number; P1: number; P2: number; P: number; Q1: number }
/** mode 0 series, 1 parallel, 2 series with a fixed R1 = R0 and the rheostat Rp = RMAX * pos as R2 */
export function solve(mode: number, U: number, R1: number, R2: number, t = 0): Circ {
  let R: number, I1: number, I2: number, U1: number, U2: number;
  if (mode === 1) { R = (R1 * R2) / (R1 + R2); I1 = U / R1; I2 = U / R2; U1 = U2 = U; }
  else { R = R1 + R2; I1 = I2 = U / R; U1 = I1 * R1; U2 = I2 * R2; }
  const I = mode === 1 ? I1 + I2 : I1;
  return { R, I, I1, I2, U1, U2, P1: U1 * I1, P2: U2 * I2, P: U * I, Q1: I1 * I1 * R1 * t };
}
export const rheostat = (pos: number) => RMAX * pos;
export function quiz(rng: () => number): Q[] {
  const U1 = pick(rng, [6, 12, 24]), Ra = pick(rng, [10, 20, 30]), Rb = pick(rng, [20, 30, 40]);
  const [p1, p2] = pick(rng, [[20, 30], [10, 10], [30, 60], [12, 6], [40, 40]]);
  const U3 = pick(rng, [6, 9, 12]), Rc = pick(rng, [10, 20]), Rd = pick(rng, [20, 40, 30]);
  const Uw = pick(rng, [3, 6, 12, 220]), Iw = pick(rng, [0.5, 1, 2, 0.1]);
  const Iq = pick(rng, [0.5, 1, 2, 3]), Rq = pick(rng, [5, 10, 20]), tq = pick(rng, [10, 30, 60]);
  return [
    numQ(rng, "series_I", [U1, Ra, Rb], `电阻 ${Ra} Ω 与 ${Rb} Ω 串联后接在 ${U1} V 的电源上，电路中的电流是多少？`, U1 / (Ra + Rb), "A", 2, "I = U / (R₁ + R₂)。"),
    numQ(rng, "par_R", [p1, p2], `电阻 ${p1} Ω 与 ${p2} Ω 并联，总电阻是多少？`, (p1 * p2) / (p1 + p2), "Ω", 1, "1/R = 1/R₁ + 1/R₂。"),
    numQ(rng, "U1", [U3, Rc, Rd], `${Rc} Ω 和 ${Rd} Ω 的电阻串联在 ${U3} V 的电源上，${Rc} Ω 电阻两端的电压是多少？`, (U3 * Rc) / (Rc + Rd), "V", 2, "串联电路电压与电阻成正比。"),
    numQ(rng, "P", [Uw, Iw], `用电器两端的电压是 ${Uw} V，通过的电流是 ${Iw} A，电功率是多少？`, Uw * Iw, "W", 1, "P = UI。"),
    numQ(rng, "Q", [Iq, Rq, tq], `电阻 ${Rq} Ω 的电阻丝通过 ${Iq} A 的电流，${tq} s 内产生的热量是多少？`, Iq * Iq * Rq * tq, "J", 0, "Q = I²Rt。"),
  ];
}
