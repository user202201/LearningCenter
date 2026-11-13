/** 牛顿第一定律与二力平衡 (pure). */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const g = 9.8;
export const SURFACES: [number, string, number][] = [[0, "毛巾", 0.5], [1, "棉布", 0.25], [2, "木板", 0.1], [3, "玻璃", 0.04], [4, "理想光滑表面", 0]];
export const muOf = (i: number) => SURFACES[i][2];
export const stopTime = (v0: number, mu: number) => (mu > 0 ? v0 / (mu * g) : Infinity);
export const stopDistance = (v0: number, mu: number) => (mu > 0 ? (v0 * v0) / (2 * mu * g) : Infinity);
/** the car leaves the slope with v0 and is slowed only by friction (a = mu g) */
export function car(v0: number, mu: number, t: number): { s: number; v: number; stopped: boolean } {
  const ts = stopTime(v0, mu);
  if (t >= ts) return { s: stopDistance(v0, mu), v: 0, stopped: true };
  return { s: v0 * t - 0.5 * mu * g * t * t, v: v0 - mu * g * t, stopped: false };
}
/** two forces on one body: F1 points right, F2 at angle dir (0 same direction, 180 opposite, 90 up); offset = distance between the two lines of action (cm) */
export function twoForces(F1: number, F2: number, dirDeg: number, offset: number): { x: number; y: number; mag: number; balanced: boolean; couple: number } {
  const a = (dirDeg * Math.PI) / 180;
  const x = F1 + F2 * Math.cos(a), y = F2 * Math.sin(a);
  const mag = Math.hypot(x, y);
  const couple = dirDeg === 180 ? Math.min(F1, F2) * offset : 0;   // opposite and parallel: a couple that turns the body (N·cm)
  return { x, y, mag, balanced: mag < 1e-9 && offset === 0, couple };
}
export const DIRS: [number, string][] = [[0, "同一方向"], [180, "相反方向"], [90, "互相垂直"]];
export function quiz(rng: () => number): Q[] {
  const mu = pick(rng, [0.1, 0.2, 0.5]), v = pick(rng, [2, 4, 6]);
  const mu2 = pick(rng, [0.1, 0.2, 0.5]), v2 = pick(rng, [2, 4, 6]);
  const F = pick(rng, [4, 6, 8, 12]);
  const a = pick(rng, [10, 12, 15]), b = pick(rng, [3, 4, 5]);
  return [
    numQ(rng, "dist", [mu, v], `小车以 ${v} m/s 的速度冲上粗糙水平面（动摩擦因数 ${mu}），滑行多远才停下？（g = 9.8 m/s²）`, stopDistance(v, mu), "m", 1, "s = v² / (2μg)。"),
    numQ(rng, "time", [mu2, v2], `小车以 ${v2} m/s 的速度冲上粗糙水平面（动摩擦因数 ${mu2}），经过多少秒停下？（g = 9.8 m/s²）`, stopTime(v2, mu2), "s", 1, "t = v / (μg)。"),
    numQ(rng, "balance", [F], `一个物体受到两个力而处于平衡状态，其中一个力是 ${F} N，另一个力的大小是多少？`, F, "N", 0, "二力平衡：大小相等、方向相反、作用在同一直线上、作用在同一物体上。"),
    makeQ(rng, "first", [], "根据牛顿第一定律，一切物体在不受力的时候：", "总保持静止状态或匀速直线运动状态", ["速度越来越小，最后停下", "速度越来越大", "总保持静止状态", "一定做曲线运动"], "牛顿第一定律：一切物体在没有受到力的作用时，总保持静止状态或匀速直线运动状态。"),
    numQ(rng, "net", [a, b], `一个物体受到同一直线上相反方向的两个力，大小分别为 ${a} N 和 ${b} N，合力是多少？`, a - b, "N", 0, "同一直线上方向相反的两个力，合力等于两力之差。"),
  ];
}
