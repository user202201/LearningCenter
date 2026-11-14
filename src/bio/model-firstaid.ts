/** 急救与安全用药 (pure): chest compressions, drug dose by body mass, and the order of the steps of first aid for a burn. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const effectiveCpr = (rate: number, depth: number) => rate >= 100 && rate <= 120 && depth >= 5 && depth <= 6;
export const cprText = (rate: number, depth: number) => (rate < 100 ? "太慢" : rate > 120 ? "太快" : depth < 5 ? "太浅" : depth > 6 ? "太深" : "有效");
export const compressions = (rate: number, minutes: number) => rate * minutes;
/** a dose in mg for a body mass, and whether the total of a day stays within the maximum (mg/kg/day) */
export const dose = (kg: number, mgkg: number) => kg * mgkg;
export const daily = (kg: number, mgkg: number, times: number) => dose(kg, mgkg) * times;
export const safeDaily = (kg: number, mgkg: number, times: number, maxMgKg: number) => daily(kg, mgkg, times) <= kg * maxMgKg;
/** the maximum daily dose of the EXAMPLE drug of this exercise (mg per kg per day): made up for the calculation; every real drug has its own limit, so a real dose follows the package leaflet, a doctor or a pharmacist */
export const MAX_MGKG = 30;
export const BURN: string[] = ["冲：用流动的凉水冲洗", "脱：小心脱去衣物", "泡：继续浸泡在凉水中", "盖：用干净的纱布覆盖", "送：及时送往医院"];
export function quiz(rng: () => number): Q[] {
  const r = pick(rng, [100, 110, 120]), m = pick(rng, [1, 2, 3, 5]);
  const kg = pick(rng, [20, 30, 40, 50]), mg = pick(rng, [5, 7.5, 10]), t = pick(rng, [2, 3, 4]);
  return [
    numQ(rng, "press", [r, m], `心肺复苏时按压频率为每分钟 ${r} 次，${m} 分钟共按压多少次？`, compressions(r, m), "次", 0, "按压频率应为每分钟 100–120 次。"),
    numQ(rng, "dose", [kg, mg], `例题（示例药，数字是假设的）：剂量为每次每千克体重 ${mg} mg。体重 ${kg} kg，每次应服多少毫克？`, dose(kg, mg), "mg", 1, "剂量 = 体重 × 每千克剂量。真实用药必须按说明书，或咨询医生、药师。"),
    numQ(rng, "daily", [kg, mg, t], `例题（示例药）：体重 ${kg} kg，每次每千克 ${mg} mg，一天服 ${t} 次，一天共多少毫克？`, daily(kg, mg, t), "mg", 1, "一天的总量不能超过该药说明书规定的每日最大剂量；每种药的限量不同，要看说明书或咨询医生、药师。"),
    makeQ(rng, "number", [], "发现有人突然倒地、没有呼吸和心跳，应先：", "立即拨打 120 并开始心肺复苏", ["先喂水", "把人扶起来行走", "等待其他人来处理", "用冷水泼醒"], "急救电话 120；成人按压深度约 5–6 cm，按压与吹气的比例为 30 : 2。"),
    makeQ(rng, "otc", [], "关于药品的使用，下列做法正确的是：", "服药前阅读说明书，按量按时服用", ["症状好转后随意加量", "不同的药一起大量服用", "过期的药减半服用", "按别人的经验服药"], "非处方药（OTC）也要看说明书；处方药凭医生处方购买。"),
  ];
}
