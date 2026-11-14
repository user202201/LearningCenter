/** 骨的成分与特性 (pure): organic matter (elastic) and inorganic salts (hard) of bone change with age; burning and acid experiments. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const organic = (age: number) => (age <= 12 ? 0.5 : age <= 40 ? 0.5 - ((age - 12) / 28) * (0.5 - 1 / 3) : Math.max(0.2, 1 / 3 - ((age - 40) / 40) * (1 / 3 - 0.2)));
export const TREAT = ["不处理", "煅烧（烧掉有机物）", "盐酸浸泡（溶去无机盐）"];
/** how well the bone bends (0 brittle .. 1 soft): burned = 0, acid = 1, otherwise rises with organic matter */
export const bend = (age: number, t: number) => (t === 1 ? 0 : t === 2 ? 1 : (organic(age) - 0.2) / 0.3 * 0.7);
export const hardness = (age: number, t: number) => (t === 2 ? 0.05 : 1 - 0.5 * bend(age, t));
export const RESULT = ["有弹性又坚硬", "变脆，易碎（只剩无机盐）", "变软，可以弯曲（只剩有机物）"];
export function quiz(rng: () => number): Q[] {
  const age = pick(rng, [5, 12, 20, 30, 40, 60, 80]), t = pick(rng, [0, 1, 2]);
  return [
    numQ(rng, "organic", [age], `按模型：12 岁以前骨中有机物约占 50 %，12 岁到 40 岁线性降到 1/3，之后继续下降，80 岁时约占 20 %。${age} 岁时有机物约占百分之几？`, organic(age) * 100, "%", 0, "儿童的骨有机物多，柔韧；老人的骨无机物多，脆。"),
    makeQ(rng, "treat", [t], `骨经过“${TREAT[t]}”后的变化是：`, t === 0 ? RESULT[0] : t === 1 ? RESULT[1] : RESULT[2], RESULT.filter((x) => x !== RESULT[t]).concat(["完全溶解", "变成黑色"]), "煅烧去掉有机物，骨变脆；盐酸溶去无机盐，骨变软。"),
    makeQ(rng, "child", [], "儿童的骨比老年人的骨更容易发生弯曲变形而不易骨折，是因为儿童的骨：", "有机物含量较多，弹性大", ["无机物含量较多", "没有有机物", "比较厚"], "有机物使骨柔韧，无机物使骨坚硬。"),
    makeQ(rng, "inorganic", [], "骨中使骨坚硬的成分是：", "无机盐", ["有机物", "水", "血液"], "无机盐主要是钙盐和磷酸盐。"),
    makeQ(rng, "joint", [], "关节的基本结构包括：", "关节面（关节头和关节窝）、关节囊和关节腔", ["骨膜、骨髓和骨质", "肌腱和肌腹", "关节头和骨松质"], "关节腔内的滑液和关节软骨使关节灵活。"),
  ];
}
