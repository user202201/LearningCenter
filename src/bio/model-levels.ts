/** 生物体的结构层次 (pure): the levels of an animal and of a plant, and examples of each. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const LEVELS = [["细胞", "组织", "器官", "系统", "个体"], ["细胞", "组织", "器官", "个体"]];
/** [name, index of the level in its own list] ; kind 0 = animal, 1 = plant */
export const ITEMS: [string, number][][] = [
  [["神经细胞", 0], ["红细胞", 0], ["肌肉组织", 1], ["上皮组织", 1], ["心脏", 2], ["胃", 2], ["消化系统", 3], ["呼吸系统", 3], ["人", 4], ["青蛙", 4]],
  [["叶肉细胞", 0], ["保卫细胞", 0], ["保护组织", 1], ["输导组织", 1], ["叶", 2], ["花", 2], ["玉米", 3], ["向日葵", 3]],
];
export const TISSUES = 4, SYSTEMS = 8, PLANT_ORGANS = 6;
export function quiz(rng: () => number): Q[] {
  const kd = pick(rng, [0, 1]), it = pick(rng, ITEMS[kd]);
  const ans = LEVELS[kd][it[1]];
  const kn = pick(rng, [0, 1]), idx = Math.floor(rng() * (LEVELS[kn].length - 1)), nx = LEVELS[kn][idx + 1];
  const kc = pick(rng, [0, 1]);
  return [
    makeQ(rng, "item", [kd, ITEMS[kd].indexOf(it)], `“${it[0]}”属于${kd === 0 ? "动物体" : "植物体"}的哪个结构层次？`, ans, LEVELS[0].filter((x) => x !== ans), "细胞 → 组织 → 器官 →（系统）→ 个体。"),
    makeQ(rng, "next", [kn, idx], `${kn === 0 ? "动物体" : "植物体"}的结构层次从小到大排列，“${LEVELS[kn][idx]}”的上一级是：`, nx, LEVELS[0].filter((x) => x !== nx && x !== LEVELS[kn][idx]), kn === 1 ? "植物体没有系统这一层次。" : "动物体有系统这一层次。"),
    numQ(rng, "count", [kc], `${kc === 0 ? "动物体" : "植物体"}的结构层次共有几级？`, LEVELS[kc].length, "级", 0, "植物体没有系统。"),
    numQ(rng, "tissues", [], "人体的基本组织（上皮组织、结缔组织、肌肉组织、神经组织）共有几类？", TISSUES, "类", 0, "四大基本组织。"),
    numQ(rng, "systems", [], "人体共有几个系统（运动、消化、呼吸、循环、泌尿、神经、内分泌、生殖）？", SYSTEMS, "个", 0, "八大系统协调配合。"),
  ];
}
