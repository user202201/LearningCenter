/** 测小灯泡的电功率 (pure): a battery, a rheostat and a small bulb whose filament resistance grows with its temperature (I = In (U / Un)^0.6, i.e. U = Un (I / In)^(5/3)). */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const BULBS = [{ Un: 2.5, In: 0.3 }, { Un: 3.8, In: 0.3 }];
export const CELLS = [2, 3, 4];
export const EMF = 1.5, R_CELL = 0.3;        // V and ohm per cell
export const filamentU = (b: number, I: number) => BULBS[b].Un * (I / BULBS[b].In) ** (5 / 3);
export interface Lab { I: number; U: number; P: number; Pn: number; ratio: number; R: number; Up: number }
/** the current: E = U_bulb(I) + I (Rp + r), found by bisection (the left side grows with I) */
export function solve(bulb: number, cells: number, Rp: number): Lab {
  const E = EMF * cells, r = R_CELL * cells, Rt = Rp + r, { Un, In } = BULBS[bulb];
  let lo = 0, hi = E / Rt;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (filamentU(bulb, mid) + mid * Rt > E) hi = mid; else lo = mid; }
  const I = (lo + hi) / 2, U = filamentU(bulb, I), Pn = Un * In;
  return { I, U, P: U * I, Pn, ratio: (U * I) / Pn, R: I > 0 ? U / I : 0, Up: I * Rp };
}
export type Bright = "off" | "dim" | "normal" | "bright" | "burn";
export const brightness = (ratio: number): Bright => (ratio < 0.1 ? "off" : ratio < 0.9 ? "dim" : ratio <= 1.15 ? "normal" : ratio <= 1.5 ? "bright" : "burn");
export const NAMES: Record<Bright, string> = { off: "几乎不亮", dim: "比正常暗", normal: "正常发光", bright: "比正常亮", burn: "过亮，灯丝可能烧断" };
export const MAXREC = 5;
export function quiz(rng: () => number): Q[] {
  const [U, I] = pick(rng, [[2.5, 0.3], [3.8, 0.32], [2.0, 0.25], [1.5, 0.2], [2.2, 0.28]]);
  const [Un, In, E] = pick(rng, [[2.5, 0.3, 4.5], [3.8, 0.3, 6], [2.5, 0.25, 6], [3.8, 0.35, 4.5]]);
  const [Pn, Uo, Ur] = pick(rng, [[2, 6, 3], [3, 6, 3], [1, 4, 2], [0.75, 2.5, 2], [4, 8, 4]]);
  return [
    numQ(rng, "P", [U, I], `测小灯泡的电功率：电压表示数 ${U} V，电流表示数 ${I} A，小灯泡的实际功率是多少？`, U * I, "W", 3, "P = UI。"),
    numQ(rng, "R", [U, I], `电压表示数 ${U} V，电流表示数 ${I} A，此时灯丝的电阻是多少？`, U / I, "Ω", 1, "R = U / I。"),
    numQ(rng, "Rp", [E, Un, In], `小灯泡的额定电压是 ${Un} V，正常发光时电流是 ${In} A，电源电压 ${E} V。要使它正常发光，应使滑动变阻器接入的电阻是多少？（忽略电源内阻）`, (E - Un) / In, "Ω", 1, "串联分压：U滑 = E − U额，R滑 = U滑 / I。"),
    numQ(rng, "pa", [Pn, Uo, Ur], `一个灯泡标有“${Uo} V ${Pn} W”，接在 ${Ur} V 的电路中（灯丝电阻不变），实际功率是多少？`, (Pn * (Ur / Uo) ** 2), "W", 3, "P实 = P额 (U实 / U额)²。"),
    makeQ(rng, "bright", [], "灯泡的亮暗程度取决于：", "灯泡的实际功率", ["灯泡的额定功率", "通过灯泡的电流", "灯泡两端的电压"], "灯泡越亮，说明实际功率越大；额定功率只是灯泡正常工作时的功率。"),
  ];
}
