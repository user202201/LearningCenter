/** 皮肤与体温调节 (pure): body heat balance. Heat made by the body (activity) leaves by the skin (dry loss, depends on the air temperature and clothes) and by sweat evaporation (2.43 kJ per mL). */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const ACTIVITY: [string, number][] = [["静坐", 80], ["慢走", 200], ["跑步", 600]];   // watts
export const dryLoss = (ta: number, cloth: number) => 8 * (1 - 0.1 * cloth) * (34 - ta);   // W (negative = the air heats the body); cloth 0..5
/** sweat needed in mL per hour (0 when the skin alone can carry the heat away) */
export const sweat = (M: number, ta: number, cloth: number) => Math.max(0, ((M - dryLoss(ta, cloth)) * 3.6) / 2.43);
export const state = (M: number, ta: number, cloth: number) => (M < 0.8 * dryLoss(ta, cloth) ? "战栗（产热增加）" : sweat(M, ta, cloth) > 0 ? "排汗、皮肤血管舒张" : "体温平衡");
export function quiz(rng: () => number): Q[] {
  const ta = pick(rng, [0, 10, 20, 25, 30, 34]), cl = pick(rng, [0, 2, 4]), a = pick(rng, [0, 1, 2]);
  const ta2 = pick(rng, [10, 20, 30]), a2 = pick(rng, [1, 2]);
  return [
    numQ(rng, "dry", [ta, cl], `按模型，皮肤向外散失的热量 = 8 ×（1 − 0.1 × 衣服层数）×（34 − 气温）W。气温 ${ta} °C，穿 ${cl} 层衣服时约散失多少 W？`, dryLoss(ta, cl), "W", 0, "气温越低、衣服越少，散热越多。"),
    numQ(rng, "sweat", [a2, ta2], `产热 ${ACTIVITY[a2][1]} W（${ACTIVITY[a2][0]}），气温 ${ta2} °C，不穿多余衣服（0 层）。蒸发每毫升汗水带走 2.43 kJ。每小时至少要排汗约多少毫升？`, sweat(ACTIVITY[a2][1], ta2, 0), "mL", 0, "排汗量 =（产热 − 皮肤散热）× 3600 / 2430。"),
    numQ(rng, "heat", [a], `${ACTIVITY[a][0]}时产热约 ${ACTIVITY[a][1]} W。一小时产生多少千焦的热量？（1 W = 1 J/s）`, (ACTIVITY[a][1] * 3600) / 1000, "kJ", 0, "热量 = 功率 × 时间。"),
    makeQ(rng, "hot", [], "天气炎热时，人体维持体温恒定的主要方式是：", "皮肤血管舒张、汗液蒸发散热", ["皮肤血管收缩、减少排汗", "战栗产热", "停止呼吸", "减少饮水"], "汗液蒸发要吸收热量。"),
    makeQ(rng, "skin", [], "皮肤的功能不包括：", "进行光合作用", ["保护身体", "排出汗液", "调节体温", "感受外界刺激"], "皮肤由表皮、真皮和皮下组织构成。"),
  ];
}
