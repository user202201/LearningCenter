/** 细胞分裂 (pure): the numbers of chromosomes, chromatids and DNA molecules in the stages of mitosis (N = chromosomes of a body cell). */
import { numQ, pick, type Q } from "../phys/qtools";
export const STAGES = ["间期", "前期", "中期", "后期", "末期", "分裂完成"];
export interface Counts { chrom: number; chromatids: number; dna: number; cells: number }
/** per cell (after the last stage: per daughter cell) */
export function counts(N: number, stage: number): Counts {
  switch (stage) {
    case 0: case 1: case 2: return { chrom: N, chromatids: 2 * N, dna: 2 * N, cells: 1 };
    case 3: case 4: return { chrom: 2 * N, chromatids: 0, dna: 2 * N, cells: 1 };
    default: return { chrom: N, chromatids: 0, dna: N, cells: 2 };
  }
}
export function quiz(rng: () => number): Q[] {
  const n = () => pick(rng, [4, 6, 8, 12, 24, 46]);
  const a = n(), b = n(), c = n(), d = n(), e = pick(rng, [4, 8, 12, 24, 46]);
  return [
    numQ(rng, "ana", [a], `某生物的体细胞中有 ${a} 条染色体。有丝分裂后期，一个细胞中有多少条染色体？`, 2 * a, "条", 0, "后期着丝点分裂，染色体数目暂时加倍。"),
    numQ(rng, "chromatid", [b], `某生物的体细胞中有 ${b} 条染色体。有丝分裂中期，一个细胞中有多少条染色单体？`, 2 * b, "条", 0, "复制后每条染色体含有两条染色单体。"),
    numQ(rng, "daughter", [c], `某生物的体细胞中有 ${c} 条染色体。有丝分裂完成后，每个子细胞中有多少条染色体？`, c, "条", 0, "子细胞与母细胞的染色体数目相同。"),
    numQ(rng, "gamete", [e], `人的体细胞中有 ${e} 条染色体时（以此类推），生殖细胞（精子或卵细胞）中有多少条染色体？`, e / 2, "条", 0, "生殖细胞中的染色体数目是体细胞的一半。"),
    numQ(rng, "dna", [d], `某生物的体细胞核中有 ${d} 个 DNA 分子。分裂间期 DNA 复制后，细胞核中有多少个 DNA 分子？`, 2 * d, "个", 0, "DNA 复制后数目加倍。"),
  ];
}
