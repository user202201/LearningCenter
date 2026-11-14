/** 电磁继电器、扬声器和话筒 (pure): a relay (a low-voltage control circuit switching a 220 V circuit), a temperature alarm, a loudspeaker (a coil in a magnetic field moves a cone) and a microphone (a moving coil induces a current). */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const R_COIL = 150, I_PULL = 0.02, V_MAINS = 220;
export const U_PULL = R_COIL * I_PULL;                         // 3 V: the smallest control voltage that pulls the armature in
export const LOADS: [string, number][] = [["台灯", 40], ["电热水器", 2000], ["水泵的电动机", 750]];
export const coilCurrent = (U: number, closed: number) => (closed === 1 ? U / R_COIL : 0);
export const engaged = (I: number) => I >= I_PULL - 1e-12;
export const loadCurrent = (P: number) => P / V_MAINS;
export const alarmOn = (T: number, Tset: number) => T >= Tset;
/** the signal current of the loudspeaker / the sound pressure of the microphone, as a function of the time in ms */
export const wave = (A: number, f: number, tms: number) => A * Math.sin(2 * Math.PI * f * (tms / 1000));
/** the force on the speaker's coil (left-hand rule) points the way the current points, so the cone moves in and out with it; its size follows the current */
export const direction = (x: number) => (x > 1e-9 ? 1 : x < -1e-9 ? -1 : 0);
/** the induced voltage of a microphone follows how fast the coil moves: larger for a louder (A) and higher (f) sound (percent of the largest value, an illustrative scale) */
export const emfPercent = (A: number, f: number) => (A * f) / 10;
export function quiz(rng: () => number): Q[] {
  const [R, U] = pick(rng, [[100, 3], [150, 6], [300, 9], [200, 12], [200, 6]]);
  const [Ip, Rc] = pick(rng, [[20, 150], [30, 200], [25, 120], [40, 150], [50, 60]]);
  const P = pick(rng, [440, 1100, 2200, 660, 330]);
  const rel = pick(rng, [
    ["电磁继电器的主要作用是：", "用低电压、弱电流的控制电路，控制高电压、强电流的工作电路", ["把交流电变成直流电", "升高电路的电压", "把电能转化为机械能"]],
    ["电磁继电器的核心部分是：", "电磁铁", ["永磁体", "电动机", "变压器"]],
  ] as [string, string, string[]][]);
  const pri = pick(rng, [
    ["扬声器的工作原理是：", "通电线圈在磁场中受力运动", ["电磁感应", "电流的磁效应", "摩擦起电"]],
    ["动圈式话筒的工作原理是：", "电磁感应", ["通电线圈在磁场中受力运动", "电流的热效应", "电流的磁效应"]],
  ] as [string, string, string[]][]);
  return [
    numQ(rng, "coilI", [R, U], `电磁继电器线圈的电阻是 ${R} Ω，控制电路的电压是 ${U} V，线圈中的电流是多少毫安？`, (U / R) * 1000, "mA", 1, "I = U / R，注意 1 A = 1000 mA。"),
    numQ(rng, "minU", [Ip, Rc], `电磁继电器的衔铁在线圈电流达到 ${Ip} mA 时被吸合，线圈电阻是 ${Rc} Ω，控制电路的电源电压至少是多少伏？`, (Ip / 1000) * Rc, "V", 1, "U = IR。"),
    numQ(rng, "loadI", [P], `继电器控制的工作电路电压是 220 V，接入的用电器功率是 ${P} W，它正常工作时的电流是多少安？`, P / V_MAINS, "A", 1, "I = P / U。"),
    makeQ(rng, "relay", [], rel[0], rel[1], rel[2], "电磁继电器实质是一个由电磁铁控制的开关，用安全的低压电路控制危险的高压电路，还能实现远距离操纵和自动控制。"),
    makeQ(rng, "principle", [], pri[0], pri[1], pri[2], "扬声器是把变化的电流变成声音，线圈受力带动纸盆振动；话筒是把声音变成变化的电流，线圈振动切割磁感线产生感应电流。"),
  ];
}
