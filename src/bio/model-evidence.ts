/** 进化的其他证据 (pure, 八下 · 生物的进化): comparative anatomy (homologous limb bones), embryos, a molecular comparison (cytochrome c, an extension) and a simple evolutionary tree of primates. Teaching values, rounded. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const BONES = ["肱骨", "尺骨和桡骨", "腕骨", "掌骨", "指骨"];
export const BONE_FN = ["上臂的骨，连接肩部", "前臂的两根骨", "手腕的许多小骨", "手掌部分的骨", "手指（鳍、翼）末端的骨"];
/** [animal, function of the limb, the lengths of the five bone groups in drawing units] */
export const LIMBS: [string, string, number[]][] = [["人的上肢", "抓握、使用工具", [110, 120, 30, 60, 70]], ["蝙蝠的翼", "飞行", [50, 120, 20, 60, 120]], ["鲸的鳍", "游泳", [60, 50, 30, 40, 60]]];
export const HOMOLOGY_TEXT = "它们的骨骼结构基本相同，功能却不同，说明起源于共同的祖先。";
/** embryos compared with the human embryo: [species, how far its adult form differs from the human] */
export const EMBRYOS: [string, number][] = [["鱼", 0.85], ["龟", 0.7], ["鸡", 0.6], ["猪", 0.35]];
/** the resemblance (0-1) of the embryo of species i to the human embryo at `stage` percent of the development: all vertebrate embryos look alike early on and grow different later */
export const similarity = (sp: number, stage: number) => 1 - EMBRYOS[sp][1] * (stage / 100) ** 1.5;
/** cytochrome c: [species, amino acids (of 104) that differ from the human protein] (rounded literature values, an extension of the textbook) */
export const CYT: [string, number][] = [["黑猩猩", 0], ["恒河猴", 1], ["狗", 10], ["马", 12], ["鸡", 13], ["海龟", 15], ["金枪鱼", 21], ["酵母菌", 44]];
export const identical = (i: number) => ((104 - CYT[i][1]) / 104) * 100;
/** primates and a mouse: the time (million years ago) at which each lineage joins the rest; human and chimpanzee join each other first */
export const TREE_SP = ["人", "黑猩猩", "大猩猩", "猩猩", "猕猴", "小鼠"];
export const JOIN = [7, 7, 9, 14, 28, 90];
export const mrca = (a: number, b: number) => (a === b ? 0 : Math.max(JOIN[a], JOIN[b]));
export function quiz(rng: () => number): Q[] {
  const a = pick(rng, [0, 1, 2, 3, 4, 5]), b = pick(rng, [0, 1, 2, 3, 4, 5].filter((x) => x !== a)), ci = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  const four = shuffle(rng, [0, 1, 2, 3, 4, 5, 6, 7]).slice(0, 4), best = four.reduce((m, i) => (CYT[i][1] < CYT[m][1] ? i : m));
  return [
    makeQ(rng, "homol", [], "蝙蝠的翼、鲸的鳍和人的上肢，骨骼结构基本相同而功能不同，这说明它们：", "起源于共同的祖先", ["功能完全相同", "是各自独立起源的", "生活环境完全相同", "没有任何亲缘关系"], "这样的器官叫同源器官，是比较解剖学提供的进化证据。"),
    makeQ(rng, "embry", [], "各种脊椎动物（鱼、龟、鸡、人）的早期胚胎都有鳃裂和尾，这说明：", "它们可能有共同的祖先", ["它们长大后的形态相同", "人的胚胎会发育成鱼", "鳃裂在发育中不会消失", "它们的食物相同"], "胚胎早期相似，越到后期差异越大，是胚胎学提供的进化证据。"),
    numQ(rng, "cyt", [ci], `细胞色素 c 有 104 个氨基酸。${CYT[ci][0]}与人的有 ${CYT[ci][1]} 个氨基酸不同，两者相同的氨基酸约占多少？（拓展内容）`, identical(ci), "%", 1, "差异越小，说明亲缘关系越近。"),
    numQ(rng, "mrca", [a, b], `在进化树中，${TREE_SP[a]}与${TREE_SP[b]}的最近共同祖先大约生活在多少百万年前？（教学用的约数）`, mrca(a, b), "Ma", 0, "两条谱系分开得越晚，亲缘关系越近。"),
    makeQ(rng, "closest", four, `下列生物中，细胞色素 c 的氨基酸序列与人的差异最小、亲缘关系最近的是：（拓展内容）`, CYT[best][0], four.filter((i) => i !== best).map((i) => CYT[i][0]), "分子差异越小，亲缘关系越近。"),
  ];
}
