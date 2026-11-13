/** 滑轮组与斜面 (pure): force, rope length, useful and total work, mechanical efficiency. */
import { numQ, pick, type Q } from "./qtools";
export interface Mach { F: number; s: number; Wuse: number; Wtot: number; eta: number }
/** a pulley block: n strands carry the load G and the moving pulley Gm; `fric` = friction in the rope and axles, as a force on the load side (N); lift height h */
export function pulley(n: number, G: number, Gm: number, fric: number, h: number): Mach {
  const F = (G + Gm + fric) / n, s = n * h, Wuse = G * h, Wtot = F * s;
  return { F, s, Wuse, Wtot, eta: Wuse / Wtot };
}
/** an inclined plane of length L at angle alpha (deg) with friction coefficient mu: the load G is pulled up along it */
export function incline(G: number, alphaDeg: number, mu: number, L = 2): Mach {
  const a = (alphaDeg * Math.PI) / 180, h = L * Math.sin(a);
  const F = G * (Math.sin(a) + mu * Math.cos(a)), Wuse = G * h, Wtot = F * L;
  return { F, s: L, Wuse, Wtot, eta: Wuse / Wtot };
}
export function quiz(rng: () => number): Q[] {
  const n1 = pick(rng, [2, 3, 4, 5]), G1 = pick(rng, [100, 200, 300, 400]), Gm = pick(rng, [20, 40, 60]);
  const n2 = pick(rng, [2, 3, 4]), h2 = pick(rng, [1, 2, 3]);
  const [Wu, Wt] = pick(rng, [[300, 400], [240, 300], [450, 500], [160, 200], [600, 800]]);
  const Gs = pick(rng, [200, 400, 600]), Ls = pick(rng, [2, 4, 5]), hs = pick(rng, [0.5, 1, 1.25]);
  const [Gp, Gq] = pick(rng, [[90, 10], [80, 20], [180, 20], [45, 5]]);
  return [
    numQ(rng, "F", [n1, G1, Gm], `用 ${n1} 段绳子承担重物的滑轮组提起 ${G1} N 的重物，动滑轮重 ${Gm} N，不计绳重和摩擦，拉力是多少？`, (G1 + Gm) / n1, "N", 1, "F = (G + G动) / n。"),
    numQ(rng, "s", [n2, h2], `用 ${n2} 段绳子承担重物的滑轮组把重物提高 ${h2} m，绳子自由端移动的距离是多少？`, n2 * h2, "m", 0, "s = nh。"),
    numQ(rng, "eta", [Wu, Wt], `使用机械做的有用功是 ${Wu} J，总功是 ${Wt} J，机械效率是多少？`, (Wu / Wt) * 100, "%", 0, "η = W有 / W总。"),
    numQ(rng, "plane", [Gs, Ls, hs], `不计摩擦，用斜面把 ${Gs} N 的重物匀速推上 ${hs} m 高处，斜面长 ${Ls} m，推力是多少？`, (Gs * hs) / Ls, "N", 1, "Gh = Fs。"),
    numQ(rng, "eta2", [Gp, Gq], `用滑轮组提升 ${Gp} N 的重物，动滑轮重 ${Gq} N，不计绳重和摩擦，机械效率是多少？`, (Gp / (Gp + Gq)) * 100, "%", 0, "η = G / (G + G动)。"),
  ];
}
