/** DNA、染色体和基因 (pure, 八下 · 遗传和变异): the structure chromosome - DNA - gene, base pairing (an extension beyond the textbook), the number of chromosomes and the sex ratio (seeded sample). */
import { makeQ, numQ, pick, mulberry32, type Q } from "../phys/qtools";
export const PARTS = [
  { name: "细胞核", fn: "遗传物质储存的主要场所" }, { name: "染色体", fn: "由 DNA 和蛋白质组成，容易被碱性染料染成深色" },
  { name: "DNA", fn: "主要的遗传物质，呈规则的双螺旋结构" }, { name: "基因", fn: "DNA 上具有特定遗传信息的片段，控制生物的性状" }, { name: "蛋白质", fn: "与 DNA 一起组成染色体" },
];
/** [species, chromosomes in a body cell] */
export const SPECIES: [string, number][] = [["人", 46], ["果蝇", 8], ["豌豆", 14], ["玉米", 20], ["水稻", 24], ["猫", 38]];
export const CELLS = ["体细胞", "生殖细胞（精子或卵细胞）", "受精卵"];
/** chromosomes in a cell: body cells and the zygote have pairs, a sex cell has one of each pair (half) */
export const chromosomes = (sp: number, cell: number) => (cell === 1 ? SPECIES[sp][1] / 2 : SPECIES[sp][1]);
export const BASES = ["A", "T", "C", "G"];
export const partner = (b: string) => ({ A: "T", T: "A", C: "G", G: "C" })[b as "A"];
export const STRAND = "ATGCCGTA";
/** boys among n births, every child an independent chance of one half (the father's sperm carries X or Y with equal chance) */
export function boys(n: number, seed: number): number { const r = mulberry32(seed * 6151 + n); let k = 0; for (let i = 0; i < n; i++) if (r() < 0.5) k++; return k; }
export function quiz(rng: () => number): Q[] {
  const sp = pick(rng, [0, 1, 2, 3, 4, 5]), cell = pick(rng, [1, 2]), b = pick(rng, [0, 1, 2, 3]);
  return [
    makeQ(rng, "who", [], "染色体主要由什么组成？", "DNA 和蛋白质", ["DNA 和脂肪", "RNA 和糖类", "蛋白质和无机盐", "糖类和脂肪"], "染色体存在于细胞核中，DNA 是主要的遗传物质。"),
    makeQ(rng, "gene", [], "基因是：", "DNA 上具有特定遗传信息的片段", ["细胞核中的一种细胞器", "染色体上的蛋白质片段", "一个完整的细胞", "只存在于生殖细胞中的物质"], "一个 DNA 分子上有许多个基因，基因控制生物的性状。"),
    numQ(rng, "count", [sp, cell], `${SPECIES[sp][0]}的体细胞中有 ${SPECIES[sp][1]} 条染色体，它的${cell === 1 ? "生殖细胞（精子或卵细胞）" : "受精卵"}中有多少条染色体？`, chromosomes(sp, cell), "", 0, "体细胞中的染色体成对存在；生殖细胞中的染色体数目减半；受精卵恢复到体细胞的数目。"),
    makeQ(rng, "pair", [b], `DNA 的两条链之间，碱基 ${BASES[b]} 与哪个碱基配对？（拓展内容）`, partner(BASES[b]), BASES.filter((x) => x !== partner(BASES[b])), "碱基互补配对：A 与 T 配对，C 与 G 配对。"),
    makeQ(rng, "sex", [], "人的精子中的性染色体可能是：", "X 或 Y", ["只有 X", "只有 Y", "XX", "XY"], "卵细胞的性染色体只有 X；精子是 X 或 Y，所以生男生女的机会均等。"),
  ];
}
