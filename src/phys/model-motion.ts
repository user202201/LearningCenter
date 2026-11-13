/** 机械运动: uniform and uniformly accelerated motion in a straight line (pure). */
import { numQ, pick, type Q } from "./qtools";
export const pos = (v0: number, a: number, t: number) => v0 * t + 0.5 * a * t * t;
export const vel = (v0: number, a: number, t: number) => v0 + a * t;
export const avgSpeed = (v0: number, a: number, t: number) => (t > 0 ? pos(v0, a, t) / t : v0);
/** the dots a ticker timer prints every `dt` seconds up to t */
export const tape = (v0: number, a: number, t: number, dt = 0.5): number[] => { const r: number[] = []; for (let x = 0; x <= t + 1e-9; x += dt) r.push(pos(v0, a, x)); return r; };
export const toKmh = (ms: number) => ms * 3.6;
export const toMs = (kmh: number) => kmh / 3.6;
export function quiz(rng: () => number): Q[] {
  const v = pick(rng, [2, 3, 4, 5, 6, 8, 10, 12, 15, 20]), t = pick(rng, [3, 4, 5, 6, 8, 10, 12]);
  const s = pick(rng, [60, 120, 180, 240, 300, 360, 480]), t2 = pick(rng, [10, 12, 15, 20, 30, 40]);
  const kmh = pick(rng, [18, 36, 54, 72, 90, 108]);
  const v0 = pick(rng, [0, 2, 4, 5]), a = pick(rng, [1, 2, 3]), t3 = pick(rng, [2, 3, 4, 5, 6]);
  const s4 = pick(rng, [100, 150, 200, 250, 300]), v4 = pick(rng, [5, 10, 20, 25, 50]);
  return [
    numQ(rng, "s=vt", [v, t], `一辆小车以 ${v} m/s 的速度做匀速直线运动，${t} s 内通过的路程是多少？`, v * t, "m", 0, "s = vt。"),
    numQ(rng, "avg", [s, t2], `物体在 ${t2} s 内通过了 ${s} m，平均速度是多少？`, s / t2, "m/s", 1, "v = s / t。"),
    numQ(rng, "kmh", [kmh], `${kmh} km/h 等于多少 m/s？`, toMs(kmh), "m/s", 0, "1 m/s = 3.6 km/h。"),
    numQ(rng, "v=v0+at", [v0, a, t3], `物体的初速度为 ${v0} m/s，以 ${a} m/s² 的加速度做匀加速直线运动，${t3} s 末的速度是多少？`, vel(v0, a, t3), "m/s", 0, "v = v₀ + at。"),
    numQ(rng, "t=s/v", [s4, v4], `以 ${v4} m/s 的速度匀速前进，通过 ${s4} m 需要多少时间？`, s4 / v4, "s", 0, "t = s / v。"),
  ];
}
