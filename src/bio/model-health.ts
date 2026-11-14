/** 健康的生活习惯 (pure): exercise intensity (heart-rate zones) and sleep. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const maxHr = (age: number) => 220 - age;
export const intensity = (hr: number, age: number) => hr / maxHr(age);
export const zone = (hr: number, age: number) => { const x = intensity(hr, age); return x < 0.5 ? "热身（轻松）" : x < 0.7 ? "中等强度" : x < 0.85 ? "有氧锻炼" : "高强度（不宜持续）"; };
export const target = (age: number): [number, number] => [Math.round(0.7 * maxHr(age)), Math.round(0.85 * maxHr(age))];
export const sleepRange = (age: number): [number, number] => (age < 6 ? [10, 13] : age < 13 ? [9, 12] : [8, 10]);
export const sleepOk = (age: number, h: number) => h >= sleepRange(age)[0] && h <= sleepRange(age)[1];
export function quiz(rng: () => number): Q[] {
  const age = pick(rng, [8, 10, 12, 14, 16]), age2 = pick(rng, [8, 10, 12, 14, 16]), age3 = pick(rng, [7, 11, 15]);
  return [
    numQ(rng, "max", [age], `估算最大心率 = 220 − 年龄（次/分钟）。${age} 岁时最大心率约是多少？`, maxHr(age), "次/分钟", 0, "只是估算，因人而异。"),
    numQ(rng, "low", [age2], `有氧锻炼的目标心率是最大心率的 70 %–85 %。${age2} 岁时下限约是多少次/分钟？（取整数）`, target(age2)[0], "次/分钟", 0, "下限 = 0.7 ×（220 − 年龄）。"),
    numQ(rng, "high", [age3], `${age3} 岁时有氧锻炼目标心率的上限（85 %）约是多少次/分钟？（取整数）`, target(age3)[1], "次/分钟", 0, "上限 = 0.85 ×（220 − 年龄）。"),
    makeQ(rng, "sleep", [age], `按模型，${age} 岁的人每天推荐睡眠约多少小时？`, `${sleepRange(age)[0]}–${sleepRange(age)[1]} 小时`, ["6–7 小时", "7–8 小时", "8–10 小时", "9–12 小时", "10–13 小时"].filter((x) => x !== `${sleepRange(age)[0]}–${sleepRange(age)[1]} 小时`), "睡眠不足会影响生长发育、注意力和免疫力。"),
    makeQ(rng, "habit", [], "下列属于健康生活方式的是：", "合理饮食、适度运动、规律作息", ["长时间使用电子屏幕", "吸烟喝酒", "经常熬夜", "不吃早餐"], "不吸烟、不喝酒、拒绝毒品，保持心理健康。"),
  ];
}
