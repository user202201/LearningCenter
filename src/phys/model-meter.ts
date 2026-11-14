/** 电功与电能表 (pure): W = UIt, the kW·h, the dial of an energy meter and the revolutions of its disc (r/(kW·h)). */
import { makeQ, numQ, pick, fmt, type Q } from "./qtools";
export const J_PER_KWH = 3.6e6;
export const RATES = [600, 1200, 2500, 3000];
export const work = (U: number, I: number, t: number) => U * I * t;
export const toKwh = (J: number) => J / J_PER_KWH;
export const energyKwh = (P: number, hours: number) => (P / 1000) * hours;
/** the dial shows five digits and a red tenth, so it wraps at 100000 kW·h and shows one decimal */
export const dial = (start: number, kwh: number) => Math.round(((start + kwh) % 100000) * 10) / 10;
export const dialText = (x: number) => `${String(Math.floor(x)).padStart(5, "0")}.${Math.round((x - Math.floor(x)) * 10) % 10}`;
export const cost = (kwh: number, price: number) => kwh * price;
export const revs = (kwh: number, rate: number) => kwh * rate;
export const powerFromRevs = (n: number, t: number, rate: number) => ((n / rate) * J_PER_KWH) / t;
/** a numeric question whose choices carry a Chinese unit written as a template (so the unit is translated together with the number: "{0} 元") */
const numT = (rng: () => number, kind: string, p: number[], q: string, v: number, f: (x: number) => string, why: string): Q =>
  makeQ(rng, kind, p, q, f(v), [v * 2, v / 2, v * 10, v / 10, v * 1.5, v * 0.75, v + 10, v - 10].filter((x) => x > 0).map(f), why);
export function quiz(rng: () => number): Q[] {
  const U = pick(rng, [6, 12, 36, 220]), I = pick(rng, [0.5, 1, 2, 0.2]), t = pick(rng, [10, 30, 60, 120]);
  const P = pick(rng, [100, 200, 500, 800, 1000, 1500, 2000]), hh = pick(rng, [2, 3, 4, 5, 0.5, 1.5]);
  const k = pick(rng, [80, 120, 150, 200, 250]), pr = pick(rng, [0.5, 0.6, 0.55, 0.8]);
  const rate = pick(rng, [600, 1200, 3000]), e = pick(rng, [0.1, 0.2, 0.5]);
  const par = pick(rng, [
    ["电能表铭牌上的“220 V”表示：", "电能表应该在 220 V 的电路中使用", ["电能表允许通过的最大电压是 220 V", "电能表的功率是 220 W", "每小时消耗 220 度电"]],
    ["电能表铭牌上的“10(20) A”表示：", "标定电流是 10 A，额定最大电流是 20 A", ["额定电压是 10 V，最大电压是 20 V", "每分钟允许通过 10 A 的电流", "额定功率是 10 W，最大功率是 20 W"]],
    ["电能表铭牌上的“3000 r/(kW·h)”表示：", "每消耗 1 kW·h 的电能，电能表的转盘转 3000 转", ["电能表的转盘每秒转 3000 转", "用电器的功率是 3000 W", "电能表最多能记录 3000 kW·h"]],
  ] as [string, string, string[]][]);
  return [
    numQ(rng, "work", [U, I, t], `一个用电器两端的电压是 ${U} V，通过的电流是 ${I} A，通电 ${t} s，电流做的功是多少焦？`, U * I * t, "J", 0, "W = UIt。"),
    numQ(rng, "energy", [P, hh], `一台功率为 ${P} W 的用电器连续工作 ${hh} h，消耗的电能是多少千瓦时？`, (P / 1000) * hh, "kW·h", 2, "W = Pt，功率用 kW、时间用 h，得到的电能单位就是 kW·h。"),
    numT(rng, "cost", [k, pr], `某用户一个月用电 ${k} kW·h，电价是 ${pr} 元/(kW·h)，应交电费多少元？`, k * pr, (x) => `${fmt(x, 2)} 元`, "电费 = 电能 × 电价。"),
    numT(rng, "revs", [rate, e], `电能表上标有“${rate} r/(kW·h)”，某用电器单独工作时消耗了 ${e} kW·h 的电能，电能表的转盘转了多少转？`, rate * e, (x) => `${fmt(x, 0)} 转`, "转数 = 电能 × 每千瓦时的转数。"),
    makeQ(rng, "param", [], par[0], par[1], par[2], "220 V 是电能表的额定电压；10(20) A 中，10 A 是标定电流，20 A 是额定最大电流；3000 r/(kW·h) 是每消耗 1 kW·h 的电能转盘转 3000 转。"),
  ];
}
