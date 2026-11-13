/** 植物细胞与动物细胞 (pure): the structures, where they are, what they do. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export interface Struct { name: string; fn: string; plant: boolean; animal: boolean }
export const STR: Struct[] = [
  { name: "细胞壁", fn: "保护和支持细胞", plant: true, animal: false },
  { name: "细胞膜", fn: "控制物质进出细胞", plant: true, animal: true },
  { name: "细胞质", fn: "细胞生命活动的主要场所", plant: true, animal: true },
  { name: "细胞核", fn: "含有遗传物质，控制生物的发育和遗传", plant: true, animal: true },
  { name: "叶绿体", fn: "进行光合作用，制造有机物", plant: true, animal: false },
  { name: "液泡", fn: "储存水分、糖类等物质", plant: true, animal: false },
  { name: "线粒体", fn: "进行呼吸作用，释放能量", plant: true, animal: true },
];
/** the structures shown for a kind (0 plant, 1 animal), in the order of the items */
export const listFor = (kind: number): Struct[] => STR.filter((x) => (kind === 0 ? x.plant : x.animal));
export const plantOnly = () => STR.filter((x) => x.plant && !x.animal).length;
export function quiz(rng: () => number): Q[] {
  const a = pick(rng, STR), b = pick(rng, STR.filter((x) => x !== a)), c = pick(rng, STR);
  const names = STR.map((x) => x.name), kd = pick(rng, [0, 1]);
  const yes = kd === 0 ? c.plant : c.animal;
  return [
    makeQ(rng, "func", [STR.indexOf(a)], `下列哪个结构的功能是“${a.fn}”？`, a.name, names.filter((x) => x !== a.name), "把结构的名称与功能对应起来。"),
    makeQ(rng, "role", [STR.indexOf(b)], `${b.name}的功能是：`, b.fn, shuffle(rng, STR.filter((x) => x !== b).map((x) => x.fn)), "细胞的各个结构分工合作。"),
    numQ(rng, "plantonly", [], "植物细胞有、动物细胞没有的结构共有几种？", plantOnly(), "种", 0, "细胞壁、叶绿体、液泡。"),
    makeQ(rng, "has", [kd, STR.indexOf(c)], `${kd === 0 ? "植物" : "动物"}细胞有${c.name}吗？`, yes ? "有" : "没有", ["有", "没有", "不一定", "只在某些时候有"].filter((x) => x !== (yes ? "有" : "没有")), "植物细胞比动物细胞多细胞壁、叶绿体和液泡。"),
    makeQ(rng, "dna", [0], "细胞中的遗传物质主要存在于：", "细胞核", ["细胞壁", "细胞膜", "液泡", "叶绿体"], "细胞核内有染色体，染色体由 DNA 和蛋白质组成。"),
  ];
}
