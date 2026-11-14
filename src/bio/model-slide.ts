/** 制作临时装片 (pure, 七上 · 细胞): the steps of the two temporary mounts of the textbook (onion epidermis, cheek cells) and a teaching model of the air bubbles under the cover slip. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const ONION = ["擦拭载玻片和盖玻片", "在载玻片中央滴一滴清水", "撕取一小块洋葱鳞片叶内表皮", "把内表皮放入水滴中展平", "盖上盖玻片（一侧先接触水滴，缓缓放平）", "在盖玻片一侧滴一滴碘液", "在盖玻片另一侧用吸水纸吸引碘液"];
export const CHEEK = ["擦拭载玻片和盖玻片", "在载玻片中央滴一滴生理盐水", "用消毒牙签的钝端在口腔内侧壁轻刮几下", "把刮取物涂抹在生理盐水中", "盖上盖玻片（一侧先接触水滴，缓缓放平）", "在盖玻片一侧滴一滴稀碘液", "在盖玻片另一侧用吸水纸吸引碘液"];
export const ONION_FN = ["保持洁净，避免杂质影响观察。", "清水使植物细胞保持正常形态。", "材料要薄而透明，光线才能透过。", "展平后细胞不重叠，便于观察。", "这样可以避免产生气泡。", "碘液使细胞核等结构着色，看得更清楚。", "染液从一侧渗入，把另一侧的碘液吸干，使标本染色。"];
export const CHEEK_FN = ["保持洁净，避免杂质影响观察。", "0.9 % 的生理盐水与人体细胞的渗透压相近，使细胞保持正常形态。", "牙签要消毒，轻刮即可，取材太多会使细胞重叠。", "涂抹均匀，细胞才不会重叠。", "这样可以避免产生气泡。", "稀碘液使细胞核着色。", "染液从一侧渗入，把另一侧的碘液吸干，使标本染色。"];
/** bubbles under the cover slip: more when it is dropped at a steep angle (the angle between the cover slip and the glass slide when it is let go) and when the water drop is too small (1-5) */
export const bubbles = (angle: number, water: number) => Math.round(12 * (angle / 90) ** 2 + 4 * Math.max(0, 2 - water));
export const WATER = ["太少，盖玻片下会留有空气", "偏少", "合适", "偏多", "太多，水会溢出盖玻片"];
export function quiz(rng: () => number): Q[] {
  const i = pick(rng, [0, 1, 2, 3, 4, 5]);
  return [
    makeQ(rng, "order", [i], `制作洋葱鳞片叶表皮临时装片时，紧接在“${ONION[i]}”之后的一步是：`, ONION[i + 1], ONION.filter((_, k) => k !== i + 1), "顺序可记为：擦、滴、撕、展、盖、染、吸。"),
    makeQ(rng, "saline", [], "制作人的口腔上皮细胞临时装片时，应在载玻片中央滴一滴：", "生理盐水", ["清水", "碘液", "酒精", "蒸馏水"], "生理盐水（0.9 %）使人体细胞保持正常形态；植物细胞有细胞壁，滴清水即可。"),
    makeQ(rng, "stain", [], "用碘液给临时装片染色的目的是：", "使细胞核等结构着色，便于观察", ["杀死细胞，防止细胞分裂", "使细胞膨胀变大", "增加盖玻片的透明度", "使细胞保持运动"], "细胞的有些结构几乎无色透明，染色后更清楚。"),
    makeQ(rng, "bubble", [], "盖盖玻片时，为了避免产生气泡，正确的做法是：", "用镊子夹起盖玻片，使一侧先接触水滴，再缓缓放平", ["让盖玻片从高处直接落下", "先把盖玻片放平，再往下按", "先盖上盖玻片，再滴水", "用手指压紧盖玻片"], "缓缓放平，空气可以被赶出。"),
    numQ(rng, "steps", [], "洋葱鳞片叶表皮临时装片的制作步骤（擦、滴、撕、展、盖、染、吸）共有几步？", ONION.length, "", 0, "擦、滴、撕、展、盖、染、吸，共 7 步。"),
  ];
}
