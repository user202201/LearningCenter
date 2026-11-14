/** 耳与听觉 (pure): the hearing range falls with age, safe exposure time falls by half for every 3 dB, and the path of sound through the ear. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const upperLimit = (age: number) => Math.max(8000, 20000 - 150 * Math.max(0, age - 10) * 2);   // Hz
export const audible = (f: number, age: number) => f >= 20 && f <= upperLimit(age);
/** hours of safe listening at `db` (85 dB: 8 hours, every +3 dB halves it) */
export const safeHours = (db: number) => 8 * 2 ** (-(db - 85) / 3);
export const PATH: [string, string][] = [["外耳道", "声波"], ["鼓膜", "鼓膜的振动"], ["听小骨", "骨的振动（放大）"], ["耳蜗", "耳蜗内液体的波动，听觉感受器兴奋"], ["听神经", "神经冲动"], ["大脑皮层的听觉中枢", "形成听觉"]];
export function quiz(rng: () => number): Q[] {
  const age = pick(rng, [10, 20, 30, 40, 50, 60]), db = pick(rng, [85, 88, 91, 94, 97, 100, 106]);
  const db2 = pick(rng, [79, 82, 85, 88]);
  return [
    numQ(rng, "limit", [age], `按模型，听到的最高频率为 20000 − 300 ×（年龄 − 10）Hz，且不低于 8000 Hz。${age} 岁时最高约是多少 Hz？`, upperLimit(age), "Hz", 0, "随着年龄增长，高频听力下降。"),
    numQ(rng, "safe", [db], `按模型，85 dB 时每天安全聆听 8 小时，声音每增加 3 dB，安全时间减半。${db} dB 时安全聆听约多少小时？`, safeHours(db), "小时", 2, "安全时间 = 8 × 2^(−(dB − 85)/3)。"),
    numQ(rng, "safe2", [db2], `同样按模型，${db2} dB 时每天安全聆听约多少小时？`, safeHours(db2), "小时", 2, "声音更小，安全时间更长。"),
    makeQ(rng, "cochlea", [], "听觉感受器位于：", "耳蜗", ["鼓膜", "听小骨", "半规管", "咽鼓管"], "耳蜗内有听觉感受器，把振动转变成神经冲动。"),
    makeQ(rng, "balance", [], "与身体平衡有关的结构是：", "前庭和半规管", ["耳蜗", "鼓膜", "听小骨", "外耳道"], "前庭和半规管内有感受头部位置变动的感受器。"),
  ];
}
