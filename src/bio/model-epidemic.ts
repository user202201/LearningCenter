/** 传染病与免疫 (pure): an SIR epidemic with isolation, route control and vaccination, and the antibody response (first and second contact). RK4, steps of 0.1 day. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const POP = 1000, DAYS = 7, TMAX = 180;   // people, days of being infectious
export interface Opt { R0: number; iso: number; route: number; vacc: number }
/** the effective reproduction number: R0 reduced by isolation and route control (both 0..1), times the susceptible share */
export const reff = (o: Opt) => o.R0 * (1 - o.iso) * (1 - o.route) * ((POP * (1 - o.vacc) - 1) / POP);
export const herd = (R0: number) => (R0 > 1 ? 1 - 1 / R0 : 0);
export interface Epi { S: number[]; I: number[]; R: number[] }
/** one value per day */
export function simulate(o: Opt, tmax = TMAX, dt = 0.1): Epi {
  const gamma = 1 / DAYS, beta = o.R0 * gamma * (1 - o.iso) * (1 - o.route);
  let I = 1, R = POP * o.vacc, S = POP - I - R;
  const out: Epi = { S: [], I: [], R: [] };
  const f = (S: number, I: number): [number, number, number] => { const inf = (beta * S * I) / POP; return [-inf, inf - gamma * I, gamma * I]; };
  const per = Math.round(1 / dt);
  for (let i = 0; i <= Math.round(tmax / dt); i++) {
    if (i % per === 0) { out.S.push(S); out.I.push(I); out.R.push(R); }
    const a = f(S, I), b = f(S + (dt / 2) * a[0], I + (dt / 2) * a[1]), c = f(S + (dt / 2) * b[0], I + (dt / 2) * b[1]), d = f(S + dt * c[0], I + dt * c[1]);
    S += (dt / 6) * (a[0] + 2 * b[0] + 2 * c[0] + d[0]); I += (dt / 6) * (a[1] + 2 * b[1] + 2 * c[1] + d[1]); R += (dt / 6) * (a[2] + 2 * b[2] + 2 * c[2] + d[2]);
  }
  return out;
}
export const peak = (e: Epi) => { const m = Math.max(...e.I); return { v: m, day: e.I.indexOf(m) }; };
/** share of the population ever infected (not counting the vaccinated) at the end */
export const attack = (e: Epi, o: Opt) => (e.R[e.R.length - 1] + e.I[e.I.length - 1] - POP * o.vacc) / POP;
// ---- antibodies: a first contact makes a slow, small response; a later one a fast, 10 times larger one (memory cells) ----
export const primary = (t: number) => (t <= 0 ? 0 : (t / 14) * Math.exp(1 - t / 14));
export const secondary = (t: number) => (t <= 0 ? 0 : 10 * (t / 4) * Math.exp(1 - t / 4));
export const titre = (t: number, tb: number) => primary(t) + secondary(t - tb);
export const LINKS: [string, string][] = [["隔离患者", "控制传染源"], ["戴口罩、勤洗手", "切断传播途径"], ["接种疫苗", "保护易感人群"], ["消毒、杀灭蚊蝇", "切断传播途径"], ["对密切接触者进行医学观察", "控制传染源"], ["锻炼身体、增强抵抗力", "保护易感人群"]];
export function quiz(rng: () => number): Q[] {
  const R0 = pick(rng, [1.5, 2, 2.5, 4, 5, 10]);
  const R0b = pick(rng, [2, 3, 4, 5]), iso = pick(rng, [0, 0.2, 0.5]), route = pick(rng, [0, 0.2, 0.5]), vacc = pick(rng, [0, 0.2, 0.4]);
  const v = pick(rng, [0.1, 0.3, 0.5, 0.8]);
  const l = pick(rng, LINKS);
  return [
    numQ(rng, "herd", [R0], `一种传染病的基本传染数 R0 = ${R0}。至少需要多大比例的人有免疫力，疫情才不会扩大？（群体免疫阈值 = 1 − 1/R0）`, herd(R0) * 100, "%", 0, "R0 越大，需要的免疫比例越高。"),
    numQ(rng, "reff", [R0b, iso, route, vacc], `基本传染数 R0 = ${R0b}，隔离使传播减少 ${iso * 100}%，切断途径使传播再减少 ${route * 100}%，人群中 ${vacc * 100}% 已接种（免疫）。有效传染数 Reff = R0 × (1 − 隔离) × (1 − 途径) × 易感者比例，约为多少？`, R0b * (1 - iso) * (1 - route) * (1 - vacc), "", 2, "Reff < 1 时疫情会逐渐消退。"),
    numQ(rng, "susc", [v], `一个 ${POP} 人的社区中，${v * 100}% 的人已接种疫苗并产生免疫力，其余人为易感人群，易感人群约有多少人？`, POP * (1 - v), "人", 0, "接种疫苗是保护易感人群的措施。"),
    makeQ(rng, "link", [LINKS.indexOf(l)], `“${l[0]}”属于预防传染病的哪一类措施？`, l[1], ["控制传染源", "切断传播途径", "保护易感人群"].filter((x) => x !== l[1]).concat(["消灭病原体的天敌"]), "传染病的三个基本环节：传染源、传播途径、易感人群。"),
    makeQ(rng, "memory", [], "再次接触同一种病原体时，抗体产生得更快、更多，主要是因为体内有：", "记忆细胞", ["红细胞", "血小板", "叶绿体", "更多的病原体"], "第一次感染后，淋巴细胞保留了“记忆”。"),
  ];
}
