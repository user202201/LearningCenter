/** 电与磁 (pure): the electromagnet, the motor force and its direction, electromagnetic induction. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const CORE_GAIN = 20;
/** the strength of an electromagnet (relative units) and the number of paper clips it lifts */
export const strength = (N: number, I: number, core: number) => N * I * (core ? CORE_GAIN : 1);
export const clips = (N: number, I: number, core: number) => Math.min(30, Math.floor(strength(N, I, core) / 200));
export const LEN = 0.1;   // m: the length of the wire in the magnetic field of the motor
export const motorForce = (B: number, I: number) => B * I * LEN;
/** +1 clockwise, -1 counter-clockwise (reversing the current OR the poles reverses it); 0 without current */
export const motorDir = (I: number, dirI: number, poleLeftN: number) => (I > 0 ? dirI * (poleLeftN ? 1 : -1) : 0);
const PHI0 = 2e-4, A = 3;   // Wb, cm: the flux through the coil when the magnet sits in it; the width of the flux curve
/** flux through the coil (Wb) with the magnet at position x (cm; 0 = in the coil), a dipole-like curve */
export const flux = (x: number) => PHI0 / (1 + (x / A) ** 2) ** 1.5;
/** d flux / dx (Wb per cm) */
export const dflux = (x: number) => (-3 * PHI0 * x) / (A * A) / (1 + (x / A) ** 2) ** 2.5;
/** induced emf in volts: -N dPhi/dt for a magnet moving at v cm/s (positive = to the right) */
export const emf = (N: number, x: number, v: number) => -N * dflux(x) * v;
export const position = (x0: number, v: number, t: number) => x0 + v * t;
export function quiz(rng: () => number): Q[] {
  const B = pick(rng, [0.2, 0.5, 1]), I = pick(rng, [1, 2, 4, 5]);
  const [N1, I1] = pick(rng, [[100, 1], [100, 2], [200, 1], [50, 2]]);
  return [
    numQ(rng, "force", [B, I], `磁感应强度 ${B} T 的磁场中，长 ${LEN} m 的导线通过 ${I} A 的电流（电流与磁场垂直），受到的力是多少？`, B * I * LEN, "N", 3, "F = BIL。"),
    makeQ(rng, "core", [], "在通电螺线管中插入铁芯，电磁铁的磁性：", "增强", ["减弱", "不变", "消失"], "铁芯被磁化，磁性大大增强。"),
    makeQ(rng, "motor_rev", [], "要使直流电动机的转动方向相反，可以：", "只改变电流方向（或只对调磁极）", ["同时改变电流方向和对调磁极", "增大电源电压", "增加线圈匝数", "换用更强的磁铁"], "转动方向由电流方向和磁场方向共同决定，只改变其中一个会反向。"),
    makeQ(rng, "induction", [], "闭合电路的一部分导体在磁场中做切割磁感线运动时：", "电路中产生感应电流", ["电路中没有电流", "导体一定会发热而没有电流", "电路中产生恒定的电流，与运动无关"], "这是电磁感应现象，发电机就是根据它制成的。"),
    makeQ(rng, "turns", [N1, I1], `电磁铁的匝数 ${N1}、电流 ${I1} A；若匝数不变，电流增大为原来的 2 倍，磁性：`, "增强", ["减弱", "不变", "先增强后减弱"], "匝数一定时，电流越大，磁性越强。"),
  ];
}
