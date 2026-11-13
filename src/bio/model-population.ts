/** 种群与生态平衡 (pure): the Lotka-Volterra predator-prey model (RK4) and logistic growth. */
import { numQ, pick, type Q } from "../phys/qtools";
export interface LV { a: number; b: number; c: number; d: number }
/** x' = a x - b x y (prey), y' = d x y - c y (predators) */
export const deriv = (p: LV, x: number, y: number): [number, number] => [p.a * x - p.b * x * y, p.d * x * y - p.c * y];
export interface Traj { t: number[]; x: number[]; y: number[] }
/** samples every `every` time units, RK4 step h */
export function simulate(p: LV, x0: number, y0: number, T: number, h = 0.01, every = 0.1): Traj {
  const out: Traj = { t: [0], x: [x0], y: [y0] };
  let x = x0, y = y0; const steps = Math.round(T / h), per = Math.round(every / h);
  for (let i = 1; i <= steps; i++) {
    const k1 = deriv(p, x, y), k2 = deriv(p, x + (h / 2) * k1[0], y + (h / 2) * k1[1]), k3 = deriv(p, x + (h / 2) * k2[0], y + (h / 2) * k2[1]), k4 = deriv(p, x + h * k3[0], y + h * k3[1]);
    x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); y += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    if (i % per === 0) { out.t.push(i * h); out.x.push(x); out.y.push(y); }
  }
  return out;
}
/** the conserved quantity of the model: constant along every orbit */
export const invariant = (p: LV, x: number, y: number) => p.d * x - p.c * Math.log(x) + p.b * y - p.a * Math.log(y);
export const equilibrium = (p: LV): [number, number] => [p.c / p.d, p.a / p.b];
export const period = (p: LV) => (2 * Math.PI) / Math.sqrt(p.a * p.c);
export const logistic = (N0: number, r: number, K: number, t: number) => K / (1 + (K / N0 - 1) * Math.exp(-r * t));
export const growthRate = (N: number, r: number, K: number) => r * N * (1 - N / K);
export function quiz(rng: () => number): Q[] {
  const c = pick(rng, [0.4, 0.5, 0.6]), d = pick(rng, [0.01, 0.02, 0.04]), a = pick(rng, [0.8, 1, 1.2]), b = pick(rng, [0.05, 0.1, 0.2]);
  const N0 = pick(rng, [10, 20, 50]), r = pick(rng, [0.3, 0.5, 1]), K = pick(rng, [500, 1000, 2000]), t = pick(rng, [2, 5, 10]);
  const K2 = pick(rng, [200, 400, 1000, 5000]);
  const a2 = pick(rng, [0.5, 1, 1.5]), c2 = pick(rng, [0.2, 0.5, 1]);
  return [
    numQ(rng, "eqx", [c, d], `捕食者—猎物模型中，捕食者的死亡率 c = ${c}，转化率 d = ${d}。猎物数量的平衡值 x* = c/d 是多少？`, c / d, "只", 1, "在平衡点，两个种群的数量都不变。"),
    numQ(rng, "eqy", [a, b], `猎物的增长率 a = ${a}，被捕食系数 b = ${b}。捕食者数量的平衡值 y* = a/b 是多少？`, a / b, "只", 1, "在平衡点，猎物的增加量恰好等于被捕食的量。"),
    numQ(rng, "logN", [N0, r, K, t], `种群按逻辑斯谛增长：N(t) = K / (1 + (K/N₀ − 1)e^(−rt))。N₀ = ${N0}，r = ${r}，K = ${K}，t = ${t} 时，种群数量约为多少？`, logistic(N0, r, K, t), "只", 0, "数量先快后慢，趋近环境容纳量 K。"),
    numQ(rng, "halfK", [K2], `环境容纳量为 ${K2} 只的种群，种群数量为多少时增长最快（用于合理捕捞的“最大持续产量”）？`, K2 / 2, "只", 0, "逻辑斯谛增长在 K/2 时增长最快。"),
    numQ(rng, "period", [a2, c2], `捕食者—猎物振荡在小幅度时的周期约为 2π/√(ac)。a = ${a2}，c = ${c2}，周期约是多少个时间单位？`, (2 * Math.PI) / Math.sqrt(a2 * c2), "", 1, "周期与种群的增长率、死亡率有关。"),
  ];
}
