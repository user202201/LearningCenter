/** 家庭电路、保险丝、安全用电 (pure): the load on a 220 V household circuit and its fuse, the current through a person who touches a wire, the test pen. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const V = 220;
export const APPS: [string, number][] = [["电灯", 60], ["电视", 150], ["电饭煲", 800], ["空调", 1500], ["电热水器", 2000]];
export const FUSES = [5, 10, 15, 20];
export const R_SHORT = 0.1;       // ohm: a wire laid straight across the supply
export interface Load { P: number; I: number; blown: boolean }
/** `on` = 0 / 1 per appliance, `fuse` = the rated current in A; a short circuit puts the wire resistance across the supply */
export function load(on: number[], fuse: number, short: boolean): Load {
  const P = on.reduce((a, v, i) => a + v * APPS[i][1], 0), I = (short ? V / R_SHORT : 0) + P / V;
  return { P, I, blown: I > fuse };
}
export const R_BODY = [2000, 800];        // ohm: dry hand, wet hand
export const R_STAND = [1000, 1e6];       // ohm: bare floor / shoes, insulating mat
/** current through a person (A): touching the live wire (0) closes a circuit through the floor, touching the neutral (1) has almost no voltage to drive it */
export const bodyCurrent = (touch: number, hand: number, stand: number) => (touch === 0 ? V / (R_BODY[hand] + R_STAND[stand]) : 0);
export const RCD_MA = 30;
export const rcdTrips = (I: number) => I * 1000 >= RCD_MA;
export type Danger = "none" | "tingle" | "stuck" | "lethal";
export const danger = (I: number): Danger => { const mA = I * 1000; return mA < 1 ? "none" : mA < 10 ? "tingle" : mA < 30 ? "stuck" : "lethal"; };
export const DANGER: Record<Danger, string> = { none: "几乎没有感觉", tingle: "有麻的感觉，能自己摆脱", stuck: "难以摆脱，有危险", lethal: "严重危险，可能致命" };
/** the three holes of a socket: 0 left = neutral, 1 right = live, 2 top = earth; the pen lights only on the live wire AND when a finger touches its metal end */
export const HOLES = ["零线", "火线", "地线"];
export const penLit = (hole: number, hold: number) => hole === 1 && hold === 1;
export function quiz(rng: () => number): Q[] {
  const [an, ap] = pick(rng, [APPS[2], APPS[3], APPS[4], APPS[1]]);
  const [i1, i2] = [Math.floor(rng() * 5), Math.floor(rng() * 5)].map((i, k) => (k ? (i + 1) % 5 : i));
  const R = pick(rng, [1, 2, 4, 5, 10]);
  return [
    numQ(rng, "I", [ap], `一台${an}的额定功率是 ${ap} W，接在 220 V 的家庭电路中，正常工作的电流是多少？`, ap / V, "A", 2, "I = P / U。"),
    numQ(rng, "Ptot", [APPS[i1][1], APPS[i2][1]], `同时使用${APPS[i1][0]}（${APPS[i1][1]} W）和${APPS[i2][0]}（${APPS[i2][1]} W），电路的总功率是多少？`, APPS[i1][1] + APPS[i2][1], "W", 0, "并联电路的总功率等于各用电器功率之和。"),
    numQ(rng, "body", [R], `人体的电阻按 ${R} kΩ 计算，接触 220 V 的火线（站在大地上，不计其他电阻），通过人体的电流是多少？`, (V / (R * 1000)) * 1000, "mA", 1, "I = U / R；超过 30 mA 就很危险。"),
    makeQ(rng, "fuse", [], "保险丝在家庭电路中的连接方法和特点是：", "串联在火线上，熔点较低、电阻较大", ["并联在火线上，熔点较高", "串联在零线上，熔点较高、电阻较小", "并联在用电器两端，电阻很小"], "电流过大时保险丝产生的热量多，因熔点低而熔断，切断电路。"),
    makeQ(rng, "safe", [], "对人体安全的电压是：", "不高于 36 V", ["220 V", "不高于 220 V", "不高于 380 V"], "不高于 36 V 的电压对人体是安全的；家庭电路的 220 V 对人体有危险。"),
  ];
}
