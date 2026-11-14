/** 探究电流与电压、电阻的关系 (pure): the ammeter reads to 0.01 A; a guided table of readings; the checks that the points show "proportional" / "inversely proportional". */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const RS = [5, 10, 15, 20, 25];
export const U_FIXED = 3;
export const MAXROWS = 6;
export const ammeter = (U: number, R: number) => Math.round((U / R) * 100) / 100;
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
/** I / U is the same for every point (within 5 %, the ammeter's reading error is much smaller than that) */
export function proportional(us: number[], is: number[]): boolean {
  if (us.length < 3) return false;
  const k = us.map((u, i) => is[i] / u), m = mean(k);
  return k.every((x) => Math.abs(x - m) <= 0.05 * m);
}
/** I x R is the same for every point */
export function inverse(rs: number[], is: number[]): boolean {
  if (rs.length < 3) return false;
  const k = rs.map((r, i) => is[i] * r), m = mean(k);
  return k.every((x) => Math.abs(x - m) <= 0.05 * m);
}
export function quiz(rng: () => number): Q[] {
  const [R, U] = pick(rng, [[10, 3], [5, 2], [20, 6], [15, 3], [25, 5], [10, 4]]);
  const [U2, I2] = pick(rng, [[3, 0.6], [3, 0.2], [6, 0.4], [2, 0.4], [4, 0.8]]);
  const [U3, R1, R2] = pick(rng, [[3, 5, 10], [3, 10, 15], [6, 10, 20], [6, 20, 30], [4, 5, 20]]);
  const con = pick(rng, [
    ["探究电流与电压的关系，得到的结论是：", "电阻一定时，通过导体的电流与导体两端的电压成正比", ["电压一定时，通过导体的电流与导体的电阻成正比", "电阻一定时，导体两端的电压与通过导体的电流成正比", "电流一定时，导体的电阻与导体两端的电压成正比"]],
    ["探究电流与电阻的关系，得到的结论是：", "电压一定时，通过导体的电流与导体的电阻成反比", ["电压一定时，通过导体的电流与导体的电阻成正比", "电阻一定时，通过导体的电流与导体两端的电压成反比", "电流一定时，导体两端的电压与导体的电阻成反比"]],
  ] as [string, string, string[]][]);
  const ctl = pick(rng, [
    ["探究电流与电阻的关系时，换用不同阻值的定值电阻后，应调节滑动变阻器，使：", "定值电阻两端的电压保持不变", ["通过定值电阻的电流保持不变", "滑动变阻器接入的电阻保持不变", "电源电压保持不变"]],
    ["探究电流与电压的关系时，滑动变阻器的主要作用是：", "改变定值电阻两端的电压和通过它的电流", ["保持定值电阻两端的电压不变", "保持电路中的电流不变", "改变定值电阻的阻值"]],
  ] as [string, string, string[]][]);
  return [
    numQ(rng, "I", [R, U], `定值电阻的阻值是 ${R} Ω，两端的电压是 ${U} V，通过它的电流是多少安？`, U / R, "A", 2, "I = U / R。"),
    numQ(rng, "Rgraph", [U2, I2], `某电阻的 I-U 图线是过原点的直线，图线上有一点：电压 ${U2} V，电流 ${I2} A，这个电阻是多少欧？`, U2 / I2, "Ω", 1, "R = U / I，也等于图线斜率的倒数。"),
    numQ(rng, "Inew", [U3, R1, R2], `保持定值电阻两端的电压 ${U3} V 不变，把电阻由 ${R1} Ω 换成 ${R2} Ω，电路中的电流变为多少安？`, U3 / R2, "A", 2, "电压一定时，电流与电阻成反比：I = U / R。"),
    makeQ(rng, "conclusion", [], con[0], con[1], con[2], "这两个关系合起来，就是欧姆定律 I = U / R。"),
    makeQ(rng, "control", [], ctl[0], ctl[1], ctl[2], "探究电流与多个因素的关系时用控制变量法：每次只改变一个量，其他的量保持不变。"),
  ];
}
