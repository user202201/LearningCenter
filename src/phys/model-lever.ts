/** 杠杆 (pure): the balance condition F1 L1 = F2 L2 and the three kinds of lever. F in N, L in cm. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export type Kind = "省力杠杆" | "费力杠杆" | "等臂杠杆";
export interface Lev { t1: number; t2: number; balanced: boolean; tilt: number; kind: Kind }
export const WEIGHT = 0.5;   // N per hook weight
export function lever(n1: number, L1: number, n2: number, L2: number): Lev {
  const F1 = n1 * WEIGHT, F2 = n2 * WEIGHT, t1 = F1 * L1, t2 = F2 * L2;
  const balanced = Math.abs(t1 - t2) < 1e-9;
  const big = Math.max(t1, t2, 1e-9);
  const tilt = Math.max(-15, Math.min(15, ((t1 - t2) / big) * 15));   // + = the left end goes down
  const kind: Kind = L1 > L2 ? "省力杠杆" : L1 < L2 ? "费力杠杆" : "等臂杠杆";
  return { t1, t2, balanced, tilt, kind };
}
export function quiz(rng: () => number): Q[] {
  const F1 = pick(rng, [2, 4, 6, 8]), L1 = pick(rng, [20, 30, 40]), L2 = pick(rng, [10, 15, 20, 5]);
  const F1b = pick(rng, [2, 3, 4, 6]), L1b = pick(rng, [10, 20, 30]), F2b = pick(rng, [1, 2, 3]);
  const a = pick(rng, [[30, 10], [10, 30], [20, 20]]);
  const Fl = pick(rng, [300, 600, 900]), la = pick(rng, [1.2, 1.5, 2]), lb = pick(rng, [0.3, 0.5, 0.4]);
  const pair = pick(rng, [[3, 20, 2, 25], [4, 30, 5, 20], [2, 40, 3, 20]]);
  const [n1, d1, n2, d2] = pair;
  const state = n1 * d1 > n2 * d2 ? "左端下沉" : n1 * d1 < n2 * d2 ? "右端下沉" : "保持水平平衡";
  const kind = a[0] > a[1] ? "省力杠杆" : a[0] < a[1] ? "费力杠杆" : "等臂杠杆";
  return [
    numQ(rng, "F2", [F1, L1, L2], `杠杆平衡时，左边动力 ${F1} N，动力臂 ${L1} cm，阻力臂 ${L2} cm，阻力是多少？`, (F1 * L1) / L2, "N", 1, "F₁L₁ = F₂L₂。"),
    numQ(rng, "L2", [F1b, L1b, F2b], `杠杆平衡时，动力 ${F1b} N，动力臂 ${L1b} cm，阻力 ${F2b} N，阻力臂是多少？`, (F1b * L1b) / F2b, "cm", 1, "L₂ = F₁L₁ / F₂。"),
    makeQ(rng, "kind", [a[0], a[1]], `一个杠杆的动力臂是 ${a[0]} cm，阻力臂是 ${a[1]} cm，它是：`, kind, ["省力杠杆", "费力杠杆", "等臂杠杆"].filter((k) => k !== kind).concat(["既省力又省距离的杠杆", "没有支点的杠杆"]), "动力臂大于阻力臂省力，小于阻力臂费力。"),
    numQ(rng, "crowbar", [Fl, la, lb], `用撬棍撬起 ${Fl} N 的重物，阻力臂 ${lb} m，动力臂 ${la} m，所需的动力至少是多少？`, (Fl * lb) / la, "N", 1, "F₁ = F₂L₂ / L₁。"),
    makeQ(rng, "tilt", [n1, d1, n2, d2], `杠杆左边挂 ${n1} 个钩码，距支点 ${d1} cm；右边挂 ${n2} 个钩码，距支点 ${d2} cm（钩码相同），松手后：`, state, ["左端下沉", "右端下沉", "保持水平平衡", "两端都下沉"].filter((s) => s !== state), "比较两边的 F×L。"),
  ];
}
