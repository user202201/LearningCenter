/** 消化 (pure): the salivary amylase experiment (activity against temperature and pH) and what each organ of the digestive tract does to each food. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const T_OPT = 37, PH_OPT = 6.8;
export const actT = (T: number) => (T <= T_OPT ? Math.exp(-(((T_OPT - T) / 14) ** 2)) : Math.exp(-(((T - T_OPT) / 7) ** 2)));
export const actPH = (pH: number) => Math.exp(-(((pH - PH_OPT) / 1.6) ** 2));
export const activity = (T: number, pH: number) => actT(T) * actPH(pH);
/** the share of the starch still present after `min` minutes */
export const remaining = (T: number, pH: number, min: number) => Math.exp(-activity(T, pH) * min);
export const ORGANS = ["口腔", "食道", "胃", "小肠", "大肠"];
export const FOODS = ["淀粉（米饭）", "蛋白质（鸡蛋）", "脂肪（肥肉）"];
/** how far each food is digested once it has passed organ j */
export const PROGRESS: number[][] = [[0.3, 0.3, 0.3, 1, 1], [0, 0, 0.35, 1, 1], [0, 0, 0, 1, 1]];
export const FINAL = ["葡萄糖", "氨基酸", "甘油和脂肪酸"];
export const ENZ: string[][] = [
  ["唾液淀粉酶：淀粉 → 麦芽糖", "不消化", "不消化", "肠液和胰液中的酶：麦芽糖 → 葡萄糖", "不消化"],
  ["不消化", "不消化", "胃液中的胃蛋白酶：蛋白质 → 多肽", "肠液和胰液中的酶：多肽 → 氨基酸", "不消化"],
  ["不消化", "不消化", "不消化", "胆汁乳化脂肪，肠液和胰液中的酶：脂肪 → 甘油和脂肪酸", "不消化"],
];
export function quiz(rng: () => number): Q[] {
  const T = pick(rng, [20, 30, 37, 45, 50]), pH = pick(rng, [5, 6.8, 7, 8, 9]);
  return [
    numQ(rng, "act", [T, pH], `唾液淀粉酶的活性模型：最适温度 37 °C、最适 pH 6.8，两侧近似钟形（温度高于 37 °C 时下降更快）。在 ${T} °C、pH ${pH} 时，酶活性约为最大值的百分之几？`, activity(T, pH) * 100, "%", 0, "温度或 pH 偏离最适值，酶的活性都下降。"),
    makeQ(rng, "site", [], "蛋白质开始被消化的器官是：", "胃", ["口腔", "小肠", "大肠", "食道"], "胃液中的胃蛋白酶初步消化蛋白质。"),
    makeQ(rng, "end", [], "淀粉最终被消化成：", "葡萄糖", ["麦芽糖", "氨基酸", "甘油", "脂肪酸"], "淀粉在口腔中先变成麦芽糖，在小肠中变成葡萄糖。"),
    makeQ(rng, "bile", [], "胆汁不含消化酶，它的作用是：", "把脂肪乳化成小颗粒，便于消化", ["把蛋白质分解成氨基酸", "把淀粉分解成葡萄糖", "杀死食物中的细菌", "吸收水分"], "胆汁由肝脏分泌，储存在胆囊中。"),
    makeQ(rng, "cold", [], "唾液淀粉酶在 0 °C 时活性很低，在 100 °C 时：", "已被破坏，降温后也不能恢复", ["活性最高", "活性与 37 °C 时相同", "降温后能完全恢复", "变成另一种酶"], "低温抑制酶的活性，高温破坏酶的结构。"),
  ];
}
