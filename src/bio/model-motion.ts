/** 动物的运动 (pure): the forearm as a lever (elbow = fulcrum, biceps = effort, the load in the hand). Distances in m, forces in N. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const G = 9.8, FOREARM_M = 1.5, FOREARM_CM = 0.15;   // the forearm itself weighs 1.5 kg, its centre is 15 cm from the elbow
/** elbow angle in degrees (180 = straight): the biceps flexes it, the triceps extends it */
export const angle = (b: number, t: number) => Math.min(175, Math.max(30, 100 - 0.9 * (b - t)));
/** the forearm's angle from the horizontal when the upper arm hangs down (elbow 90 degrees = horizontal) */
export const tilt = (theta: number) => theta - 90;
/** the effort of the biceps (N) that holds the forearm and the load */
export const force = (m: number, d2: number, d1: number, theta: number) => ((m * G * d2 + FOREARM_M * G * FOREARM_CM) * Math.cos((tilt(theta) * Math.PI) / 180)) / d1;
export const kind = (d1: number, d2: number) => (d1 < d2 ? "费力杠杆" : d1 > d2 ? "省力杠杆" : "等臂杠杆");
export function quiz(rng: () => number): Q[] {
  const m = pick(rng, [1, 2, 3, 5]), d2 = pick(rng, [0.25, 0.3, 0.35]), d1 = pick(rng, [0.03, 0.04, 0.05]);
  const a = pick(rng, [2, 3, 4, 5, 6, 8]), b = pick(rng, [10, 15, 20, 30, 35]);
  const flex = pick(rng, [0, 1]);
  const pair = flex === 0 ? "肱二头肌收缩，肱三头肌舒张" : "肱二头肌舒张，肱三头肌收缩";
  return [
    numQ(rng, "force", [m, d2, d1], `前臂水平（肘 90°），手中握着 ${m} kg 的重物（距肘 ${d2 * 100} cm），肱二头肌附着点距肘 ${d1 * 100} cm，前臂自重 1.5 kg（重心距肘 15 cm）。肱二头肌的拉力约为多少牛？（g = 9.8 N/kg）`, force(m, d2, d1, 90), "N", 0, "力矩平衡：拉力 × 动力臂 = 总阻力矩。"),
    makeQ(rng, "lever", [a, b], `杠杆的动力臂 ${a} cm，阻力臂 ${b} cm，这是：`, kind(a, b), ["省力杠杆", "费力杠杆", "等臂杠杆"].filter((x) => x !== kind(a, b)).concat(["不是杠杆"]), "动力臂小于阻力臂的是费力杠杆。"),
    makeQ(rng, "pair", [flex], `${flex === 0 ? "屈肘" : "伸肘"}时，骨骼肌的状态是：`, pair, shuffle(rng, ["肱二头肌和肱三头肌同时收缩", "肱二头肌和肱三头肌同时舒张", flex === 0 ? "肱二头肌舒张，肱三头肌收缩" : "肱二头肌收缩，肱三头肌舒张"]), "一个动作至少由两组肌肉相互配合完成。"),
    makeQ(rng, "comp", [], "哺乳动物的运动系统由下列哪几部分组成？", "骨、骨连结（关节）和骨骼肌", ["骨、神经和血管", "肌肉、皮肤和骨", "骨、关节和神经", "骨骼肌、脂肪和骨"], "关节是骨连结的主要形式。"),
    makeQ(rng, "drive", [], "在运动中，骨骼肌起的作用是：", "收缩产生动力，牵动骨绕关节转动", ["作为支点", "作为杠杆", "只起保护作用", "运输血液"], "骨起杠杆作用，关节起支点作用，骨骼肌起动力作用。"),
  ];
}
