/** 植物的无性繁殖 (pure, 八下 · 生殖和发育): grafting (scion and stock), the methods of vegetative propagation and sexual versus asexual reproduction. */
import { makeQ, pick, type Q } from "../phys/qtools";
/** [scion variety, the fruit its branch bears, the group] */
export const SCIONS: [string, string, number][] = [["红富士苹果", "红富士苹果", 0], ["鸭梨", "鸭梨", 1], ["水蜜桃", "水蜜桃", 2]];
/** [stock plant, the group it belongs to] */
export const STOCKS: [string, number, string][] = [["野生山荆子（苹果的近缘植物）", 0, "野生山荆子"], ["杜梨（梨的近缘植物）", 1, "杜梨"], ["山桃（桃的近缘植物）", 2, "山桃"]];
/** a graft only grows together when scion and stock are close relatives (the same group) and the cambium layers touch each other well (alignment of at least 70 %) */
export const compatible = (scion: number, stock: number) => SCIONS[scion][2] === STOCKS[stock][1];
export const takes = (scion: number, stock: number, align: number) => compatible(scion, stock) && align >= 70;
export const GRAFT_TEXT = ["成活：形成层紧密结合，接穗和砧木长在一起", "不成活：形成层没有对齐", "不成活：接穗和砧木亲缘关系太远，不亲和"];
export const graftResult = (scion: number, stock: number, align: number) => (takes(scion, stock, align) ? 0 : compatible(scion, stock) ? 1 : 2);
/** vegetative propagation methods: [method, example of what is done] */
export const METHODS = ["扦插", "嫁接", "压条", "组织培养"];
/** [what is done, the method] */
export const METHOD_ITEMS: [string, number][] = [
  ["把月季的枝条剪成段，插入土中，长成新植株", 0], ["把优良苹果品种的枝条接到野生山荆子的树干上", 1], ["把桂花的一段枝条埋入土中，生根后与母株分离", 2],
  ["取兰花的茎尖，在无菌条件下培养成新植株", 3], ["把葡萄的枝条插入湿润的土中，长出根", 0], ["把一棵桃树的芽接到另一棵桃树上", 1],
];
/** sexual versus asexual reproduction: [statement, 0 sexual / 1 asexual] */
export const COMPARE: [string, number][] = [
  ["由受精卵发育成新个体", 0], ["不经过两性生殖细胞的结合", 1], ["后代具有双亲的遗传特性，变异较多", 0], ["后代保持母体的优良性状，遗传稳定", 1],
  ["能在较短时间内产生大量新个体", 1], ["后代适应环境变化的能力较强，有利于生物进化", 0], ["用种子繁殖", 0], ["扦插、嫁接和组织培养", 1],
];
export const KINDS = ["有性生殖", "无性生殖"];
export function quiz(rng: () => number): Q[] {
  const i = pick(rng, [0, 1, 2]), m = pick(rng, [0, 1, 2, 3]), c = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
  return [
    makeQ(rng, "scion", [i], `把${SCIONS[i][0]}的枝条（接穗）嫁接到${STOCKS[i][0]}（砧木）上，成活后接穗上结出的果实是：`, SCIONS[i][1], SCIONS.filter((_, k) => k !== i).map((x) => x[1]).concat([`${STOCKS[i][2]}的果实`, "介于两者之间的果实"]), "嫁接属于无性生殖，接穗上结出的果实保持接穗的性状。"),
    makeQ(rng, "cambium", [], "嫁接成功的关键是：", "接穗与砧木的形成层紧密结合", ["接穗与砧木的叶片大小相同", "接穗与砧木的粗细完全一样", "接穗不带芽", "嫁接的时间在夜里"], "形成层细胞分裂能力强，两者的形成层紧贴，才能愈合、成活。"),
    makeQ(rng, "method", [m], `“${METHOD_ITEMS.find((x) => x[1] === m)![0]}”属于植物无性繁殖的哪一种方法？`, METHODS[m], METHODS.filter((_, k) => k !== m).concat(["种子繁殖"]), "常见的无性繁殖方法有扦插、嫁接、压条和组织培养。"),
    makeQ(rng, "trait", [], "用扦插、嫁接等方法繁殖的后代，与母体相比：", "能保持母体的优良性状", ["性状一定发生很大变异", "一定具有双亲的性状", "一定比母体差", "性状完全不能预测"], "没有经过两性生殖细胞的结合，后代的遗传物质来自母体。"),
    makeQ(rng, "type", [c], `“${COMPARE[c][0]}”属于：`, KINDS[COMPARE[c][1]], KINDS.filter((_, k) => k !== COMPARE[c][1]).concat(["两种都不是", "两种都是"]), "有性生殖经过两性生殖细胞的结合；无性生殖不经过两性生殖细胞的结合。"),
  ];
}
