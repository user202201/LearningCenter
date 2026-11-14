/** 动物的主要类群 (pure, 八上 · 动物的主要类群): the six groups of invertebrates (with their typical animals and body features) and the five classes of vertebrates (body covering, breathing, body temperature, reproduction). */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const GROUPS = ["腔肠动物", "扁形动物", "线形动物", "环节动物", "软体动物", "节肢动物"];
export const ORG_ITEMS: [string, number][] = [["水螅", 0], ["海蜇", 0], ["涡虫", 1], ["华枝睾吸虫", 1], ["蛔虫", 2], ["蚯蚓", 3], ["河蚌", 4], ["蝗虫", 5]];
export const FEATURE_ITEMS: [string, number][] = [
  ["身体呈辐射对称，体表有刺细胞", 0], ["身体呈两侧对称，背腹扁平，有口无肛门", 1], ["身体细长，呈圆柱形，体表有角质层", 2], ["身体由许多彼此相似的体节组成", 3],
  ["身体柔软，体表有外套膜，多数有贝壳", 4], ["体表有坚韧的外骨骼，身体和附肢都分节", 5], ["靠刚毛辅助肌肉运动", 3], ["靠足运动，足有斧足、腹足等形状", 4],
];
export const VERTS = ["鱼类", "两栖动物", "爬行动物", "鸟类", "哺乳动物"];
export const VFEATS = ["体表", "呼吸器官", "体温", "生殖方式"];
export const VERT_TABLE: string[][] = [
  ["鳞片，有黏液", "鳃", "变温", "卵生（体外受精）"], ["裸露、湿润", "幼体用鳃，成体用肺，皮肤辅助", "变温", "卵生（体外受精）"], ["鳞片或甲", "肺", "变温", "卵生（体内受精）"],
  ["羽毛", "肺，有气囊辅助", "恒温", "卵生"], ["体表被毛", "肺", "恒温", "胎生、哺乳"],
];
/** an animal drawn for each class (indexes of the 42 organisms of the classification lab) */
export const VERT_ORG = [0, 3, 6, 10, 14];
export const LEGS: [string, number][] = [["蝗虫（昆虫）", 3], ["蜘蛛", 4]];
export function quiz(rng: () => number): Q[] {
  const o = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7]), f = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7]), g = pick(rng, [0, 1, 2, 3, 4]), l = pick(rng, [0, 1]);
  return [
    makeQ(rng, "phylum", [o], `“${ORG_ITEMS[o][0]}”属于：`, GROUPS[ORG_ITEMS[o][1]], GROUPS.filter((_, k) => k !== ORG_ITEMS[o][1]), "无脊椎动物的主要类群有腔肠动物、扁形动物、线形动物、环节动物、软体动物和节肢动物。"),
    makeQ(rng, "feature", [f], `“${FEATURE_ITEMS[f][0]}”是下列哪一类动物的特征？`, GROUPS[FEATURE_ITEMS[f][1]], GROUPS.filter((_, k) => k !== FEATURE_ITEMS[f][1]), "每一类动物都有各自的主要特征。"),
    makeQ(rng, "warm", [], "在脊椎动物的五个类群中，体温恒定的是：", "鸟类和哺乳动物", ["鱼类和两栖动物", "两栖动物和爬行动物", "鱼类和鸟类", "爬行动物和哺乳动物"], "鸟类和哺乳动物是恒温动物，其余三类是变温动物。"),
    makeQ(rng, "cover", [g], `${VERTS[g]}的体表特征是：`, VERT_TABLE[g][0], VERT_TABLE.filter((_, k) => k !== g).map((r) => r[0]).concat(["体表有外骨骼"]), "体表的覆盖物起保护作用，并与动物的生活环境相适应。"),
    numQ(rng, "legs", [l], `${LEGS[l][0]}有几对足？`, LEGS[l][1], "", 0, "昆虫有三对足，蜘蛛有四对足。"),
  ];
}
