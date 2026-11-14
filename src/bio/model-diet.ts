/** 合理营养 (pure): food groups of a day, their energy and nutrients, the recommended ranges, and the diseases of a lack of a nutrient. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
/** per 100 g: [name, kcal, protein g, fat g, carbohydrate g, recommended range g/day for a school child] */
export const GROUPS: [string, number, number, number, number, [number, number]][] = [
  ["谷类和薯类", 350, 10, 1.5, 72, [250, 400]], ["蔬菜", 25, 1.5, 0.2, 4, [300, 500]], ["水果", 50, 0.7, 0.2, 12, [200, 350]], ["肉、蛋、鱼", 160, 18, 9, 1, [120, 200]], ["奶和豆制品", 55, 3, 3, 5, [300, 500]], ["油", 900, 0, 100, 0, [20, 30]],
];
export const amounts = (s: Record<string, number>) => GROUPS.map((_, i) => s[`g${i}`]);
export const energy = (g: number[]) => g.reduce((a, x, i) => a + (x / 100) * GROUPS[i][1], 0);
export const nutrient = (g: number[], k: 2 | 3 | 4) => g.reduce((a, x, i) => a + (x / 100) * GROUPS[i][k], 0);
export const fatShare = (g: number[]) => { const e = energy(g); return e ? (nutrient(g, 3) * 9) / e : 0; };
export const inRange = (g: number[]) => g.filter((x, i) => x >= GROUPS[i][5][0] && x <= GROUPS[i][5][1]).length;
export const balanced = (g: number[], need: number) => inRange(g) === GROUPS.length && Math.abs(energy(g) - need) <= 0.1 * need;
export const LACK: [string, string][] = [["维生素 A", "夜盲症"], ["维生素 C", "坏血病"], ["维生素 D 或钙", "佝偻病（儿童）"], ["维生素 B₁", "脚气病"], ["铁", "缺铁性贫血"], ["碘", "地方性甲状腺肿（大脖子病）"]];
export function quiz(rng: () => number): Q[] {
  const a = pick(rng, [100, 200, 300]), b = pick(rng, [50, 100, 150]), i = pick(rng, [0, 3, 4]);
  const lk = pick(rng, LACK);
  const oil = pick(rng, [10, 20, 30]);
  return [
    numQ(rng, "energy", [a, b], `按表中数据（谷类 350 kcal / 100 g，蔬菜 25 kcal / 100 g）：${a} g 谷类加 ${b} g 蔬菜共提供多少 kcal 的能量？`, (a * 350 + b * 25) / 100, "kcal", 0, "能量 = 质量 / 100 × 每 100 g 的能量。"),
    numQ(rng, "protein", [i, a], `按表中数据（谷类蛋白质 10 g / 100 g，肉蛋鱼 18 g / 100 g，奶和豆制品 3 g / 100 g）：${a} g ${GROUPS[i][0]}含蛋白质多少克？`, (a / 100) * GROUPS[i][2], "g", 1, "蛋白质 = 质量 / 100 × 每 100 g 的蛋白质。"),
    numQ(rng, "oil", [oil], `每克脂肪约提供 9 kcal 的能量。${oil} g 食用油（脂肪含量 100 %）约提供多少 kcal？`, oil * 9, "kcal", 0, "能量 = 脂肪质量 × 9。"),
    makeQ(rng, "lack", [LACK.indexOf(lk)], `缺乏${lk[0]}，容易引起：`, lk[1], LACK.map((x) => x[1]).filter((x) => x !== lk[1]), "食物多样、荤素搭配可以避免营养缺乏。"),
    makeQ(rng, "energy-main", [], "人体生命活动所需能量的主要来源是：", "糖类", ["维生素", "水", "无机盐"], "糖类是主要供能物质，脂肪是备用能源，蛋白质是构成细胞的基本物质。"),
  ];
}
