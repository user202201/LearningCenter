/** 人体内废物的排出 (pure): the kidney: filtration (glomerulus), reabsorption (tubule), water balance, urea and glucose. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const GFR = 125, TM_GLU = 10, UREA_G = 25, PLASMA_UREA = 0.3;   // mL/min, renal threshold of glucose mmol/L, urea made per day (g), g/L in plasma
export const filtered = (gfr = GFR) => (gfr * 1440) / 1000;                       // L of primary urine per day
/** the urine volume (L/day): what is drunk + water of metabolism - sweat - breath and faeces, at least 0.5 L */
export const urine = (water: number, sweat: number) => Math.max(0.5, water + 0.3 - sweat - 0.6);
export const reabsorbed = (u: number, gfr = GFR) => 1 - u / filtered(gfr);
export const glucoseInUrine = (glu: number, gfr = GFR) => Math.max(0, (glu - TM_GLU) * filtered(gfr));   // mmol per day
export const ureaFactor = (u: number) => UREA_G / u / PLASMA_UREA;                 // urine urea concentration / plasma
export function quiz(rng: () => number): Q[] {
  const g = pick(rng, [100, 125, 150]), w = pick(rng, [1, 1.5, 2, 3]), sw = pick(rng, [0, 0.3, 0.6]);
  const u2 = pick(rng, [1, 1.25, 1.5, 2]);
  return [
    numQ(rng, "filtered", [g], `两肾每分钟滤过形成原尿 ${g} mL。一天（1440 分钟）形成原尿多少升？`, filtered(g), "L", 0, "原尿量 = 每分钟滤过量 × 1440。"),
    numQ(rng, "urine", [w, sw], `某人一天喝水 ${w} L，出汗 ${sw} L，代谢产生水 0.3 L，呼吸和粪便带走 0.6 L（尿量不少于 0.5 L）。一天尿量约多少升？`, urine(w, sw), "L", 2, "尿量 = 饮水 + 代谢水 − 汗 − 呼吸和粪便丢失。"),
    numQ(rng, "reabs", [u2], `一天形成原尿 180 L，排出尿 ${u2} L。肾小管重吸收了原尿中的百分之几？`, (1 - u2 / 180) * 100, "%", 1, "重吸收的比例 = 1 −（尿量 / 原尿量）。"),
    makeQ(rng, "step", [], "尿液形成的两个主要过程是：", "肾小球的滤过作用和肾小管的重吸收作用", ["肾小球的重吸收和肾小管的滤过", "只有肾小管的分泌", "膀胱的滤过和重吸收"], "血液流经肾小球时，血细胞和大分子蛋白质不能滤过。"),
    makeQ(rng, "gluc", [], "健康人的尿中一般不含葡萄糖，因为葡萄糖：", "被肾小管全部重吸收回血液", ["不能被肾小球滤过", "在膀胱中被分解", "在肝脏中被排出", "随汗液排出"], "血糖过高超过重吸收限度时，尿中才出现葡萄糖。"),
  ];
}
