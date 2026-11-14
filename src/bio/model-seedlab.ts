/** 种子的结构与发芽率 (pure, 七上 · 绿色植物): the structure of a bean seed and a maize kernel, the iodine test for starch and the measurement of the germination rate on samples (seeded). */
import { makeQ, numQ, pick, mulberry32, type Q } from "../phys/qtools";
export const BEAN = [
  { name: "种皮", fn: "保护种子内部的结构" }, { name: "胚根", fn: "萌发时发育成根" }, { name: "胚轴", fn: "萌发时发育成连接根和茎的部分" },
  { name: "胚芽", fn: "萌发时发育成茎和叶" }, { name: "子叶", fn: "两片，储存营养物质" },
];
export const MAIZE = [
  { name: "果皮和种皮", fn: "保护种子内部的结构" }, { name: "胚乳", fn: "储存营养物质" }, { name: "子叶", fn: "一片，把胚乳中的营养转运给胚" },
  { name: "胚芽", fn: "萌发时发育成茎和叶" }, { name: "胚轴", fn: "萌发时发育成连接根和茎的部分" }, { name: "胚根", fn: "萌发时发育成根" },
];
export const SEEDS = ["菜豆种子", "玉米种子"];
/** the three parts the iodine is dropped on: the outer coat, the part that stores the food (bean: the cotyledons, maize: the endosperm), the embryo */
export const PARTS = [["种皮", "子叶", "胚"], ["果皮和种皮", "胚乳", "胚"]];
/** starch turns iodine blue-black: only the food store has plenty of it */
export const blue = (seed: number, part: number) => part === 1;
export const IODINE_TEXT = ["滴碘液后不变蓝：几乎不含淀粉", "滴碘液后变成蓝色：含有大量淀粉"];
/** the seeds that germinated in each of the three groups of n seeds of a lot whose true germination rate is `lot` % (every seed is an independent chance) */
export function groups(n: number, lot: number, seed: number): number[] {
  return [0, 1, 2].map((g) => { const r = mulberry32(seed * 997 + g * 131 + n * 7 + 5); let k = 0; for (let i = 0; i < n; i++) if (r() * 100 < lot) k++; return k; });
}
export const average = (ks: number[], n: number) => (ks.reduce((a, b) => a + b, 0) / (3 * n)) * 100;
export const PASS = 90;
const DESC = ["保护种子内部结构的是", "将来发育成根的是", "将来发育成连接根和茎的部分的是", "将来发育成茎和叶的是", "菜豆种子储存营养物质的是"];
export function quiz(rng: () => number): Q[] {
  const i = pick(rng, [0, 1, 2, 3, 4]), n = pick(rng, [50, 100]);
  const a = n - pick(rng, [2, 4, 6, 8, 10]), b = n - pick(rng, [1, 3, 5, 7, 9]), c = n - pick(rng, [0, 2, 4, 6, 12]);
  return [
    makeQ(rng, "part", [i], `菜豆种子的结构中，${DESC[i]}：`, BEAN[i].name, BEAN.filter((_, k) => k !== i).map((x) => x.name).concat(["胚乳"]), "种皮保护种子；胚由胚根、胚轴、胚芽和子叶组成，是新植物的幼体。"),
    makeQ(rng, "store", [], "玉米种子储存营养物质的结构是：", "胚乳", ["子叶", "胚芽", "果皮和种皮", "胚根"], "玉米是单子叶植物，营养储存在胚乳中；菜豆是双子叶植物，营养储存在子叶中。"),
    makeQ(rng, "iodine", [], "在玉米种子的纵切面上滴一滴碘液，变成蓝色的部分是：", "胚乳", ["果皮和种皮", "胚芽", "胚轴", "胚根"], "淀粉遇碘变蓝，胚乳中含有大量淀粉。"),
    numQ(rng, "avg", [n, a, b, c], `测定种子的萌发率：每组 ${n} 粒，共 3 组，萌发的种子分别为 ${a} 粒、${b} 粒、${c} 粒。平均萌发率是多少？`, ((a + b + c) / (3 * n)) * 100, "%", 1, "平均萌发率 = 三组萌发的种子总数 ÷ 种子总数 × 100 %。"),
    makeQ(rng, "samp", [], "测定种子的萌发率时，为了减小误差，应该：", "每组取数量较多的种子，并重复做几组取平均值", ["只取 1 粒最饱满的种子", "只做一组，数量越少越好", "挑选颜色最好的种子", "把萌发的种子扔掉不数"], "样本越大、重复越多，结果越接近整批种子的真实萌发率。"),
  ];
}
