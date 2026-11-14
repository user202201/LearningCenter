/** 血管与血液 (pure): blood components, the speed of blood in the three kinds of vessels (continuity: v = Q / A) and bleeding. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const ML_PER_KG = 75, SV = 70;
export const bloodVolume = (kg: number) => (kg * ML_PER_KG) / 1000;   // L
export const plasmaVolume = (kg: number, hct: number) => bloodVolume(kg) * (1 - hct / 100);
export const rbcPerUl = (hct: number) => (hct / 45) * 5.0e6;
export const anaemic = (hct: number) => hct < 36;
/** [name, total cross-section cm2, wall, valves, pressure mmHg] */
export const VESSELS: [string, number, string, boolean, string][] = [["动脉", 3, "厚、弹性大", false, "高（约 100）"], ["毛细血管", 4500, "极薄（一层细胞）", false, "低（约 25）"], ["静脉", 18, "较薄", true, "很低（约 5）"]];
export const flow = (hr: number) => (SV * hr) / 60;   // cm3 per second
export const speed = (hr: number, v: number) => flow(hr) / VESSELS[v][1];   // cm per second
export const BLEED: [string, string, string][] = [["动脉出血", "鲜红、喷射状", "近心端"], ["静脉出血", "暗红、缓缓流出", "远心端"], ["毛细血管出血", "渗出、像水珠", "自然止血或消毒包扎"]];
export function quiz(rng: () => number): Q[] {
  const kg = pick(rng, [30, 40, 50, 60, 70]), hr = pick(rng, [60, 75, 90, 120]), v = pick(rng, [0, 1, 2]), b = pick(rng, [0, 1, 2]);
  const kg2 = pick(rng, [30, 40, 50, 60]), h2 = pick(rng, [35, 40, 45, 50]);
  return [
    numQ(rng, "vol", [kg], `人体血液约占体重的 7.5 %（约 75 mL/kg）。体重 ${kg} kg 的人血液约有多少升？`, bloodVolume(kg), "L", 2, "血量 = 体重 × 75 mL/kg。"),
    numQ(rng, "plasma", [kg2, h2], `体重 ${kg2} kg，血细胞容积（红细胞等占血液的体积百分比）为 ${h2} %，血浆约有多少升？（血量 75 mL/kg）`, plasmaVolume(kg2, h2), "L", 2, "血浆 = 血量 ×（1 − 血细胞容积比）。"),
    numQ(rng, "speed", [hr, v], `每搏输出量 70 mL，心率 ${hr} 次/分钟；${VESSELS[v][0]}的总横截面积约 ${VESSELS[v][1]} cm²。血流速度 = 流量 / 横截面积，约是多少厘米每秒？`, speed(hr, v), "cm/s", 3, "总横截面积越大，血流越慢。"),
    makeQ(rng, "valve", [], "四肢的静脉内有瓣膜，作用是：", "防止血液倒流", ["增加血压", "增加血流速度", "运输氧气"], "动脉和毛细血管没有瓣膜。"),
    makeQ(rng, "bleed", [b], `${BLEED[b][0]}（${BLEED[b][1]}）时，应在伤口的哪里按压止血？`, BLEED[b][2], ["近心端", "远心端", "自然止血或消毒包扎", "伤口正上方用力揉"].filter((x) => x !== BLEED[b][2]), "动脉血从心脏流向伤口，所以按压近心端；静脉血流回心脏，所以按压远心端。"),
  ];
}
