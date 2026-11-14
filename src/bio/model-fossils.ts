/** 化石与生物进化的证据 (pure): radioactive dating (half-lives) and the order of life in the rock layers. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const ISOTOPES: [string, number][] = [["碳-14", 5730], ["钾-40", 1.25e9], ["铀-238", 4.47e9]];   // half-life in years
export const remaining = (years: number, half: number) => 0.5 ** (years / half);
/** age (years) of a sample with `frac` (0..1) of the isotope left */
export const age = (frac: number, half: number) => half * Math.log2(1 / frac);
export const LAYERS = ["寒武纪（约 5.4 亿年前）", "泥盆纪（约 4 亿年前）", "石炭纪（约 3.5 亿年前）", "中生代（约 2.5 亿 – 6600 万年前）", "新生代（6600 万年前至今）"];
/** [fossil, layer index] */
export const FOSSILS: [string, number][] = [["三叶虫", 0], ["早期鱼类", 1], ["两栖类", 2], ["巨型蕨类", 2], ["恐龙", 3], ["始祖鸟", 3], ["哺乳动物繁盛", 4], ["人类化石", 4]];
export function quiz(rng: () => number): Q[] {
  const n = pick(rng, [1, 2, 3, 4]), iso = pick(rng, [0, 1, 2]), f = pick(rng, [0.5, 0.25, 0.125, 0.0625]);
  const fo = pick(rng, FOSSILS);
  return [
    numQ(rng, "left", [n], `一种放射性同位素每过一个半衰期，剩下的量减半。经过 ${n} 个半衰期，剩下原来的百分之几？`, 100 * 0.5 ** n, "%", 2, "每个半衰期减半。"),
    numQ(rng, "age", [0, f], `碳-14 的半衰期是 5730 年。测得某化石中碳-14 只剩 ${f * 100} %，它的年龄约多少年？`, age(f, 5730), "年", 0, "年龄 = 半衰期 × 经过的半衰期数。"),
    numQ(rng, "half", [iso], `${ISOTOPES[iso][0]}的半衰期约 ${ISOTOPES[iso][1].toExponential(2).replace("e+", " × 10^")} 年。测得一块岩石中它只剩一半，岩石的年龄约是多少年？`, ISOTOPES[iso][1], "年", 0, "剩一半说明恰好过了一个半衰期。"),
    makeQ(rng, "layer", [FOSSILS.indexOf(fo)], `“${fo[0]}”化石最早大量出现在：`, LAYERS[fo[1]], LAYERS.filter((x) => x !== LAYERS[fo[1]]), "越古老的地层，埋藏的化石越简单、越低等。"),
    makeQ(rng, "order", [], "在未经扰动的地层中，下面的地层与上面的地层相比：", "更古老，化石更简单、低等", ["更年轻，化石更复杂", "年代相同", "没有化石"], "化石是研究生物进化最直接、最重要的证据。"),
  ];
}
