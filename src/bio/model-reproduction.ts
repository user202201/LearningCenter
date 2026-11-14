/** 人的生殖系统 (pure, textbook level 七下 · 人的由来): the organs of the male and female reproductive system, what happens where, and the order from fertilisation to birth. Schematic and formal only. */
import { makeQ, pick, type Q } from "../phys/qtools";
export interface Organ { name: string; fn: string }
export const FEMALE: Organ[] = [
  { name: "卵巢", fn: "产生卵细胞，分泌雌性激素" }, { name: "输卵管", fn: "输送卵细胞，是受精的场所" },
  { name: "子宫", fn: "胚胎和胎儿发育的场所" }, { name: "阴道", fn: "胎儿产出的通道，也是月经排出的通道" },
];
export const MALE: Organ[] = [
  { name: "睾丸", fn: "产生精子，分泌雄性激素" }, { name: "附睾", fn: "储存精子，使精子成熟" },
  { name: "输精管", fn: "输送精子" }, { name: "精囊腺", fn: "分泌黏液，参与精液的形成" },
];
/** what happens in which female organ: [event, organ index in FEMALE] */
export const EVENTS: [string, number][] = [["产生卵细胞", 0], ["受精作用发生", 1], ["胚胎和胎儿发育", 2], ["胎儿产出（分娩）", 3]];
/** from fertilisation to birth, in order */
export const STAGES = ["精子与卵细胞结合，形成受精卵", "受精卵分裂，形成胚泡", "胚泡植入子宫内膜（怀孕）", "胚胎发育，约 8 周发育成胎儿", "胎儿发育成熟，从母体产出（分娩）"];
export const STAGE_FN = ["受精卵就是新生命的起点。", "分裂的同时，受精卵沿输卵管向子宫移动。", "胚泡的植入标志着怀孕的开始。", "胎儿通过胎盘和脐带从母体获得营养和氧。", "从受精到分娩约 38 周（约 266 天）。"];
export function quiz(rng: () => number): Q[] {
  const all = [...FEMALE, ...MALE], a = pick(rng, all), st = pick(rng, [0, 1, 2, 3]);
  const g = pick(rng, [0, 1]);
  return [
    makeQ(rng, "organ", [all.indexOf(a)], `下列哪个器官的功能是“${a.fn}”？`, a.name, all.filter((x) => x !== a).map((x) => x.name), "人的生殖系统由生殖器官组成，各器官分工合作。"),
    makeQ(rng, "site", [], "受精作用发生的部位是：", "输卵管", ["卵巢", "子宫", "阴道", "胎盘"], "精子与卵细胞在输卵管内结合，形成受精卵。"),
    makeQ(rng, "gonad", [g], g === 0 ? "男性产生生殖细胞的器官是：" : "女性产生生殖细胞的器官是：", g === 0 ? "睾丸" : "卵巢", g === 0 ? ["卵巢", "附睾", "输精管", "子宫"] : ["睾丸", "输卵管", "子宫", "阴道"], "睾丸产生精子，卵巢产生卵细胞，它们同时也是分泌性激素的内分泌器官。"),
    makeQ(rng, "nutri", [], "胎儿在子宫内通过什么从母体获得营养和氧？", "胎盘和脐带", ["卵黄", "输卵管", "羊水", "子宫内膜的分泌物"], "胎儿产生的废物也通过胎盘和脐带由母体排出。"),
    makeQ(rng, "next", [st], `下列哪一步紧接在“${STAGES[st]}”之后？`, STAGES[st + 1], STAGES.filter((_, i) => i !== st + 1), "顺序是：受精 → 胚泡 → 植入子宫内膜 → 胚胎和胎儿发育 → 分娩。"),
  ];
}
