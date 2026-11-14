/** 生殖和发育 of animals (pure): the life cycles of an insect (incomplete and complete metamorphosis), a frog and a bird. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export interface Cycle { name: string; kind: string; fert: string; stages: [string, number][] }   // [stage, days]
export const CYCLES: Cycle[] = [
  { name: "蝗虫", kind: "不完全变态", fert: "体内受精", stages: [["受精卵", 14], ["若虫", 56], ["成虫", 60]] },
  { name: "家蚕", kind: "完全变态", fert: "体内受精", stages: [["受精卵", 10], ["幼虫", 25], ["蛹", 12], ["成虫", 7]] },
  { name: "青蛙", kind: "变态发育", fert: "体外受精", stages: [["受精卵", 10], ["蝌蚪", 60], ["幼蛙", 30], ["成蛙", 300]] },
  { name: "鸡", kind: "不变态", fert: "体内受精", stages: [["受精卵", 21], ["雏鸡", 120], ["成鸡", 365]] },
];
export const total = (c: number) => CYCLES[c].stages.reduce((a, s) => a + s[1], 0);
export const stageAt = (c: number, i: number) => CYCLES[c].stages[Math.min(i, CYCLES[c].stages.length - 1)];
export const hasPupa = (c: number) => CYCLES[c].stages.some((s) => s[0] === "蛹");
export function quiz(rng: () => number): Q[] {
  const c = pick(rng, [0, 1, 2, 3]), c2 = pick(rng, [0, 1, 2, 3]);
  return [
    numQ(rng, "total", [c], `按模型，${CYCLES[c].name}从受精卵到成体各阶段共需约多少天？（${CYCLES[c].stages.map((s) => `${s[0]} ${s[1]} 天`).join("，")}）`, total(c), "天", 0, "把各阶段的天数相加。"),
    numQ(rng, "stages", [c2], `${CYCLES[c2].name}的发育一共分为几个阶段？（${CYCLES[c2].stages.map((s) => s[0]).join("、")}）`, CYCLES[c2].stages.length, "个", 0, "数一数阶段名称。"),
    makeQ(rng, "kind", [c], `${CYCLES[c].name}的发育方式属于：`, CYCLES[c].kind, ["完全变态", "不完全变态", "变态发育", "不变态"].filter((x) => x !== CYCLES[c].kind), "家蚕有蛹期，是完全变态；蝗虫没有蛹期，是不完全变态。"),
    makeQ(rng, "fert", [c2], `${CYCLES[c2].name}的受精方式是：`, CYCLES[c2].fert, ["体内受精", "体外受精"].concat(["孤雌生殖", "出芽生殖"]).filter((x) => x !== CYCLES[c2].fert), "两栖动物在水中体外受精，昆虫和鸟类体内受精。"),
    makeQ(rng, "pupa", [], "家蚕的发育过程中，不吃不动的阶段是：", "蛹", ["幼虫", "受精卵", "成虫"], "完全变态的幼虫要经过蛹期才变成成虫。"),
  ];
}
