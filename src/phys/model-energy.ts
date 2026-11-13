/** 功、功率与机械能 (pure): work and power, the pendulum (integrated, not the small-angle formula) and a roller-coaster track. */
import { numQ, pick, type Q } from "./qtools";
export const g = 9.8;
export const work = (F: number, s: number) => F * s;
export const power = (W: number, t: number) => W / t;
/** pendulum: theta'' = -(g/L) sin theta, RK4 with a fixed small step; angles in radians */
export function pendulum(theta0Deg: number, L: number, t: number): { theta: number; omega: number } {
  let th = (theta0Deg * Math.PI) / 180, om = 0;
  const f = (a: number) => -(g / L) * Math.sin(a), dt = 0.002;
  const n = Math.floor(t / dt);
  for (let i = 0; i < n; i++) {
    const k1t = om, k1o = f(th);
    const k2t = om + 0.5 * dt * k1o, k2o = f(th + 0.5 * dt * k1t);
    const k3t = om + 0.5 * dt * k2o, k3o = f(th + 0.5 * dt * k2t);
    const k4t = om + dt * k3o, k4o = f(th + dt * k3t);
    th += (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t); om += (dt / 6) * (k1o + 2 * k2o + 2 * k3o + k4o);
  }
  const rest = t - n * dt;
  if (rest > 1e-12) { th += om * rest; om += f(th) * rest; }
  return { theta: th, omega: om };
}
export interface Energy { Ek: number; Ep: number; Eloss: number; E0: number; v: number; h: number }
export function pendulumEnergy(m: number, L: number, theta0Deg: number, t: number): Energy {
  const { theta, omega } = pendulum(theta0Deg, L, t);
  const h = L * (1 - Math.cos(theta)), v = L * Math.abs(omega);
  return { Ek: 0.5 * m * v * v, Ep: m * g * h, Eloss: 0, E0: m * g * L * (1 - Math.cos((theta0Deg * Math.PI) / 180)), v, h };
}
/** the track: height (m) at position x in [0, 1] for a start height H0 */
export const trackH = (H0: number, x: number) => H0 * (1 - 0.3 * x) * (0.5 + 0.5 * Math.cos(3 * Math.PI * x));
/** energy at x on the track; `loss` = share of the start energy turned into heat per unit of x (rubbing). Ek is never negative: a car that cannot climb stops. */
export function trackEnergy(m: number, H0: number, x: number, loss: number): Energy & { reached: boolean } {
  const E0 = m * g * H0, h = trackH(H0, x), Eloss = loss * E0 * x;
  const Ek = E0 - m * g * h - Eloss;
  const reached = Ek >= -1e-9;
  const ek = Math.max(0, Ek);
  return { Ek: ek, Ep: m * g * h, Eloss, E0, v: Math.sqrt((2 * ek) / m), h, reached };
}
export function quiz(rng: () => number): Q[] {
  const F = pick(rng, [20, 50, 100, 200]), s = pick(rng, [2, 3, 5, 10]);
  const W = pick(rng, [600, 1200, 1500, 3000]), t = pick(rng, [10, 20, 30, 60]);
  const m3 = pick(rng, [0.5, 1, 2, 5]), h3 = pick(rng, [1, 2, 5, 10]);
  const m4 = pick(rng, [0.5, 1, 2, 4]), v4 = pick(rng, [2, 4, 6, 10]);
  const h5 = pick(rng, [1.25, 5, 10, 20, 45]);
  return [
    numQ(rng, "W=Fs", [F, s], `用 ${F} N 的力沿力的方向推动物体前进 ${s} m，做的功是多少？`, work(F, s), "J", 0, "W = Fs。"),
    numQ(rng, "P=W/t", [W, t], `在 ${t} s 内做了 ${W} J 的功，功率是多少？`, power(W, t), "W", 0, "P = W / t。"),
    numQ(rng, "Ep", [m3, h3], `质量 ${m3} kg 的物体被举高 ${h3} m，增加的重力势能是多少？（g = 9.8 N/kg）`, m3 * g * h3, "J", 1, "Ep = mgh。"),
    numQ(rng, "Ek", [m4, v4], `质量 ${m4} kg 的物体以 ${v4} m/s 运动，动能是多少？`, 0.5 * m4 * v4 * v4, "J", 0, "Ek = ½mv²。"),
    numQ(rng, "vfall", [h5], `不计空气阻力，物体从 ${h5} m 高处自由下落，落地时的速度是多少？（g = 9.8 m/s²）`, Math.sqrt(2 * g * h5), "m/s", 1, "机械能守恒：mgh = ½mv²。"),
  ];
}
