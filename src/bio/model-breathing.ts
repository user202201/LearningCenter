/** 呼吸运动 (pure): thorax volume, Boyle's law and air flow. Volumes in mL, pressures in kPa. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const V0 = 2400, P0 = 101.3, R = 0.1;   // relaxed volume, atmospheric pressure, airway resistance (kPa per L/s)
/** the thorax volume: the diaphragm (0..100 %) and the ribs (0..100 %) each add to it */
export const vol = (dd: number, rr: number) => V0 + 14 * dd + 6 * rr;
/** the pressure in the lungs when the airway is blocked (Boyle's law: P V = constant, starting from V0 at P0) */
export const blocked = (V: number) => (P0 * V0) / V;
export const boyle = (P1: number, V1: number, V2: number) => (P1 * V1) / V2;
/** the volume of the lungs in a breathing cycle: ph in radians (0 = end of expiration) */
export const volAt = (ph: number, Vt: number) => V0 + (Vt * (1 - Math.cos(ph))) / 2;
/** air flow in mL/s (positive = in) */
export const flow = (ph: number, Vt: number, f: number) => (Vt * ((f * 2 * Math.PI) / 60) * Math.sin(ph)) / 2;
export const alveolar = (ph: number, Vt: number, f: number) => P0 - (R * flow(ph, Vt, f)) / 1000;
export const vent = (Vt: number, f: number) => (Vt * f) / 1000;
export function quiz(rng: () => number): Q[] {
  const P1 = pick(rng, [100, 101.3]), V1 = pick(rng, [2000, 2400, 3000]), V2 = V1 * pick(rng, [1.25, 1.5, 2]);
  const Vt = pick(rng, [400, 500, 600, 800]), f = pick(rng, [12, 15, 18, 20, 24]);
  const dd = pick(rng, [0, 10, 25, 50, 80]), rr = pick(rng, [0, 20, 25, 40, 60]);
  return [
    numQ(rng, "boyle", [P1, V1, V2], `密闭的容器中气体的体积从 ${V1} mL 增大到 ${V2} mL，温度不变。原来的气压为 ${P1} kPa，现在的气压是多少？`, boyle(P1, V1, V2), "kPa", 1, "一定质量的气体，温度不变时，压强与体积成反比。"),
    numQ(rng, "vent", [Vt, f], `平静呼吸时每次吸入 ${Vt} mL 空气，每分钟呼吸 ${f} 次，每分钟通气量是多少？`, (Vt * f) / 1000, "L", 1, "每分钟通气量 = 每次呼吸量 × 呼吸频率。"),
    numQ(rng, "vol", [dd, rr], `模型：胸廓容积 = 2400 + 14 × 膈肌收缩% + 6 × 肋骨上升% (mL)。膈肌收缩 ${dd}%、肋骨上升 ${rr}% 时，胸廓容积是多少？`, vol(dd, rr), "mL", 0, "膈肌下降使胸廓上下径增大，肋骨上升使前后径、左右径增大。"),
    makeQ(rng, "insp", [], "吸气时，下列各项变化正确的是：", "膈肌收缩，胸廓容积扩大，肺内气压低于外界气压", shuffle(rng, ["膈肌舒张，胸廓容积扩大，肺内气压低于外界气压", "膈肌收缩，胸廓容积缩小，肺内气压高于外界气压", "膈肌舒张，胸廓容积缩小，肺内气压低于外界气压"]), "气体总是从气压高处流向气压低处。"),
    makeQ(rng, "gas", [], "与吸入的气体相比，呼出的气体中：", "氧气减少，二氧化碳增多", ["氧气增多，二氧化碳减少", "氧气和二氧化碳都不变", "氧气和二氧化碳都增多"], "吸入气体约含 21% 氧气、0.04% 二氧化碳；呼出气体约含 16% 氧气、4% 二氧化碳。"),
  ];
}
