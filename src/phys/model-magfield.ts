/** 磁场与磁感线、奥斯特实验、地磁场 (pure): a bar magnet / solenoid as two poles (field lines traced numerically), the field of a straight wire against the Earth's field, the dip of the Earth's field. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const CX = 320, CY = 200, PD = 62;   // the magnet's centre and the distance of each pole from it (drawing units)
export type V2 = [number, number];
/** the poles: ns = +1: N on the right, -1: N on the left */
export const poles = (ns: number): { N: V2; S: V2 } => ({ N: [CX + ns * PD, CY], S: [CX - ns * PD, CY] });
const SOFT = 4;
/** the field at (x, y) of a north pole and a south pole (strength 1 each): points away from N and towards S */
export function field(x: number, y: number, ns: number): V2 {
  const { N, S } = poles(ns);
  const f = (p: V2, sg: number): V2 => { const dx = x - p[0], dy = y - p[1], r2 = dx * dx + dy * dy + SOFT * SOFT, r3 = r2 * Math.sqrt(r2); return [(sg * dx) / r3, (sg * dy) / r3]; };
  const a = f(N, 1), b = f(S, -1);
  return [(a[0] + b[0]) * 1e4, (a[1] + b[1]) * 1e4];
}
export const strength = (x: number, y: number, ns: number) => Math.hypot(...field(x, y, ns));
/** the direction the north end of a small compass needle points (degrees, counter-clockwise from the right, y up) */
export function needleAngle(x: number, y: number, ns: number): number { const [bx, by] = field(x, y, ns); return (Math.atan2(-by, bx) * 180) / Math.PI; }
/** one field line from (x0, y0) following the field (dir = 1) or against it (-1) until it reaches a pole, leaves the 640 x 397 area or 700 steps */
export function trace(x0: number, y0: number, ns: number, dir = 1): V2[] {
  const { N, S } = poles(ns), pts: V2[] = [[x0, y0]];
  let x = x0, y = y0;
  for (let i = 0; i < 700; i++) {
    const [bx, by] = field(x, y, ns), m = Math.hypot(bx, by) || 1;
    const k = 4 * dir; x += (bx / m) * k; y += (by / m) * k;
    pts.push([x, y]);
    if (x < -20 || x > 660 || y < -20 || y > 417) break;
    if (Math.hypot(x - S[0], y - S[1]) < 6 || Math.hypot(x - N[0], y - N[1]) < 6) break;
  }
  return pts;
}
/** the field lines of the magnet: n lines leaving the N pole at equal angles */
export function lines(ns: number, n = 12): V2[][] {
  const { N } = poles(ns), out: V2[][] = [];
  for (let i = 0; i < n; i++) { const a = (2 * Math.PI * (i + 0.5)) / n; out.push(trace(N[0] + 8 * Math.cos(a), N[1] + 8 * Math.sin(a), ns, 1)); }
  return out;
}
export const solenoidRightPole = (cur: number) => (cur > 0 ? "N" : "S");
export const BE = 30;                      // microtesla: the horizontal part of the Earth's field
/** field of a long straight wire in microtesla at d cm: mu0 I / (2 pi d) */
export const wireB = (I: number, d: number) => (20 * I) / d;
/** deflection of a compass needle in degrees (the sign is the current's direction): tan(phi) = B_wire / B_earth */
export const deflection = (I: number, d: number, dir: number) => (dir * (Math.atan2(wireB(I, d), BE) * 180) / Math.PI);
/** the dip of the Earth's field at latitude lat (degrees), dipole model: tan(dip) = 2 tan(lat) */
export const dip = (lat: number) => { const l = (lat * Math.PI) / 180; return (Math.atan2(2 * Math.sin(l), Math.cos(l)) * 180) / Math.PI; };
/** field strength and horizontal part relative to the equator */
export const earthB = (lat: number) => Math.sqrt(1 + 3 * Math.sin((lat * Math.PI) / 180) ** 2);
export const earthH = (lat: number) => Math.cos((lat * Math.PI) / 180);
export function quiz(rng: () => number): Q[] {
  const [I, d] = pick(rng, [[5, 2], [2, 4], [10, 5], [3, 6], [4, 2]]);
  const lat = pick(rng, [30, 45, 60, 20]);
  return [
    makeQ(rng, "oersted", [], "奥斯特实验中，通电直导线下方的小磁针发生偏转，这说明：", "电流周围存在磁场", ["磁铁周围存在电流", "小磁针本身带电", "导线被磁化了"], "1820 年奥斯特发现电流的磁效应；改变电流方向，小磁针偏转的方向也相反。"),
    makeQ(rng, "lines", [], "关于磁体外部的磁感线，下列说法正确的是：", "从 N 极出发，回到 S 极", ["从 S 极出发，回到 N 极", "从 N 极出发，到无穷远处终止", "磁感线可以相交"], "磁感线是为了描述磁场而画的曲线，磁体外部从 N 极到 S 极，磁感线不相交，也不是真实存在的线。"),
    makeQ(rng, "earth", [], "关于地磁场，下列说法正确的是：", "地磁的南极在地理北极附近，地磁的北极在地理南极附近", ["地磁的北极在地理北极附近", "地磁场的南北极与地理南北极完全重合", "地球周围没有磁场"], "小磁针静止时 N 极指向地理北方，因为地理北极附近是地磁的 S 极；地磁两极与地理两极并不重合，存在磁偏角。"),
    numQ(rng, "Bwire", [I, d], `长直导线中的电流是 ${I} A，距导线 ${d} cm 处，电流产生的磁场的磁感应强度是多少？（B = μ₀I / 2πd，μ₀ = 4π×10⁻⁷ T·m/A）`, wireB(I, d), "μT", 1, "B = 2×10⁻⁷ × I / d；1 μT = 10⁻⁶ T。"),
    numQ(rng, "dip", [lat], `用偶极子模型估算：地球上纬度 ${lat}° 处，地磁场的磁倾角（tan 磁倾角 = 2 tan 纬度）约是多少？`, dip(lat), "°", 1, "tan I = 2 tan φ：赤道处为 0°，磁极处为 90°。"),
  ];
}
