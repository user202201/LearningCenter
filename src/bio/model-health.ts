/** 健康的生活习惯 (pure): exercise intensity (heart-rate zones) and sleep. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
/** the usual ADULT estimate of the maximum heart rate (220 - age); for children it is only a rough guide */
export const maxHr = (age: number) => 220 - age;
export const intensity = (hr: number, age: number) => hr / maxHr(age);
export const zone = (hr: number, age: number) => { const x = intensity(hr, age); return x < 0.5 ? "热身（轻松）" : x < 0.7 ? "中等强度" : x < 0.85 ? "较高强度" : "高强度（不宜持续）"; };
/** heart rate of moderate exercise (50-70 %) and of vigorous exercise (70-85 %) */
export const moderate = (age: number): [number, number] => [Math.round(0.5 * maxHr(age)), Math.round(0.7 * maxHr(age))];
export const target = (age: number): [number, number] => [Math.round(0.7 * maxHr(age)), Math.round(0.85 * maxHr(age))];
/** the sleep the Ministry of Education asks for (2021): primary school 10 h, junior high 9 h, senior high 8 h a day (the range runs 2 h above it) */
export const sleepRange = (age: number): [number, number] => (age <= 12 ? [10, 12] : age <= 15 ? [9, 11] : [8, 10]);
export const sleepOk = (age: number, h: number) => h >= sleepRange(age)[0] && h <= sleepRange(age)[1];
export function quiz(rng: () => number): Q[] {
  const age = pick(rng, [8, 10, 12, 14, 16]), age2 = pick(rng, [8, 10, 12, 14, 16]), age3 = pick(rng, [7, 11, 15]);
  return [
    numQ(rng, "max", [age], `常用的成人估算：最大心率 = 220 − 年龄（次/分钟）。按此算，${age} 岁时最大心率约是多少？`, maxHr(age), "次/分钟", 0, "这是成人的常用估算，对儿童只是粗略的参考，因人而异。"),
    numQ(rng, "low", [age2], `较高强度运动的心率约为最大心率的 70 %–85 %（粗略估算）。按 220 − 年龄 计算，${age2} 岁时下限约是多少次/分钟？（取整数）`, target(age2)[0], "次/分钟", 0, "下限 = 0.7 ×（220 − 年龄）；中等强度约为 50 %–70 %。"),
    numQ(rng, "high", [age3], `${age3} 岁时较高强度运动心率的上限（85 %）约是多少次/分钟？（取整数）`, target(age3)[1], "次/分钟", 0, "上限 = 0.85 ×（220 − 年龄）。"),
    makeQ(rng, "sleep", [age], `按模型（教育部的要求：小学生 10 小时，初中生 9 小时，高中生 8 小时），${age} 岁的人每天推荐睡眠约多少小时？`, `${sleepRange(age)[0]}–${sleepRange(age)[1]} 小时`, ["6–7 小时", "7–8 小时", "8–10 小时", "9–11 小时", "10–12 小时", "11–13 小时"].filter((x) => x !== `${sleepRange(age)[0]}–${sleepRange(age)[1]} 小时`), "睡眠不足会影响生长发育、注意力和免疫力。"),
    makeQ(rng, "habit", [], "下列属于健康生活方式的是：", "合理饮食、适度运动、规律作息", ["长时间使用电子屏幕", "吸烟喝酒", "经常熬夜", "不吃早餐"], "不吸烟、不喝酒、拒绝毒品，保持心理健康。"),
  ];
}
