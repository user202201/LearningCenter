/** 生物的分类 (pure): 42 organisms with their features, a dichotomous key built from them, and the groups used by the sorting game. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export type Group = "fish" | "amph" | "rept" | "bird" | "mamm" | "insect" | "spider" | "crust" | "centi" | "snail" | "worm" | "jelly" | "star" | "kelp" | "moss" | "fern" | "pine" | "maize" | "bean" | "mush" | "mold" | "yeast" | "rod" | "coccus" | "phage" | "tmv";
const A = ["cell", "nuc", "multi", "mobile"], P = ["cell", "nuc", "photo", "multi"];
export const GTAGS: Record<Group, string[]> = {
  fish: [...A, "spine", "gill", "scale", "water"], amph: [...A, "spine", "moist"], rept: [...A, "spine", "scale"], bird: [...A, "spine", "warm", "feather"], mamm: [...A, "spine", "warm", "hair"],
  insect: [...A, "exo", "legs6"], spider: [...A, "exo", "legs8"], crust: [...A, "exo", "gill", "water"], centi: [...A, "exo", "legsmany"], snail: [...A, "shell"], worm: [...A, "ring"], jelly: [...A, "radial", "water", "sting"], star: [...A, "radial", "water", "arms"],
  kelp: [...P, "water"], moss: [...P, "spore", "stemleaf"], fern: [...P, "spore", "root"], pine: [...P, "root", "seed", "naked"], maize: [...P, "root", "seed", "fruit", "cot1"], bean: [...P, "root", "seed", "fruit"],
  mush: ["cell", "nuc", "multi", "spore", "cap"], mold: ["cell", "nuc", "multi", "spore", "brush"], yeast: ["cell", "nuc", "budding"], rod: ["cell", "rodshape"], coccus: ["cell", "ball"], phage: ["phagetail"], tmv: ["helix"],
};
/** [name, group, extra tags, colour] */
export const DATA: [string, Group, string[], string][] = [
  ["鲤鱼", "fish", ["bony"], "#f08c00"], ["鲨鱼", "fish", ["cart"], "#868e96"], ["海马", "fish", ["bony", "horse"], "#fcc419"],
  ["青蛙", "amph", ["jump"], "#51cf66"], ["蟾蜍", "amph", ["warty"], "#a9815a"], ["大鲵", "amph", ["tailed"], "#8d6e63"],
  ["蛇", "rept", ["nolimb"], "#82c91e"], ["乌龟", "rept", ["limbs", "carapace"], "#2f9e44"], ["蜥蜴", "rept", ["limbs"], "#74b816"], ["鳄鱼", "rept", ["limbs", "big"], "#5c940d"],
  ["鸡", "bird", ["domestic"], "#fa5252"], ["鸽子", "bird", ["fly"], "#adb5bd"], ["企鹅", "bird", ["swimbird"], "#343a40"], ["鹰", "bird", ["fly", "hook"], "#8d6e63"],
  ["兔", "mamm", ["longear"], "#e9ecef"], ["鲸", "mamm", ["marine", "water"], "#4dabf7"], ["蝙蝠", "mamm", ["fly"], "#495057"], ["老虎", "mamm", ["carn"], "#fd7e14"], ["猴", "mamm", ["grasp"], "#a9815a"], ["大象", "mamm", ["trunk"], "#adb5bd"],
  ["蝗虫", "insect", ["jump"], "#82c91e"], ["蝴蝶", "insect", ["scalewing"], "#f783ac"], ["蜘蛛", "spider", ["web"], "#495057"], ["虾", "crust", [], "#ff8787"], ["蜈蚣", "centi", [], "#c92a2a"], ["蜗牛", "snail", [], "#d9a066"], ["蚯蚓", "worm", [], "#e599a8"],
  ["水母", "jelly", [], "#b197fc"], ["海星", "star", [], "#ff922b"],
  ["海带", "kelp", [], "#2b8a3e"], ["葫芦藓", "moss", [], "#66a80f"], ["蕨", "fern", [], "#37b24d"], ["松", "pine", [], "#1b5e20"], ["玉米", "maize", [], "#fcc419"], ["大豆", "bean", [], "#94d82d"],
  ["蘑菇", "mush", [], "#e03131"], ["青霉", "mold", [], "#3bc9db"], ["酵母菌", "yeast", [], "#f1e0b0"],
  ["乳酸菌", "rod", [], "#f59f00"], ["球菌", "coccus", [], "#e64980"], ["噬菌体", "phage", [], "#7048e8"], ["烟草花叶病毒", "tmv", [], "#12b886"],
];
export interface Org { id: number; name: string; group: Group; tags: Set<string>; color: string }
export const ORGS: Org[] = DATA.map(([name, group, extra, color], id) => ({ id, name, group, tags: new Set([...GTAGS[group], ...extra]), color }));
export const TAGQ: Record<string, string> = {
  cell: "有细胞结构吗？", nuc: "细胞内有成形的细胞核吗？", photo: "能进行光合作用、自己制造有机物吗？", multi: "身体由多个细胞构成吗？", mobile: "能主动运动、摄食吗？", spine: "体内有脊柱吗？", gill: "用鳃呼吸吗？", scale: "体表有鳞片或硬壳吗？",
  warm: "体温恒定吗？", feather: "体表有羽毛吗？", hair: "体表被毛、胎生哺乳吗？", moist: "皮肤裸露、湿润吗？", water: "终生生活在水中吗？", exo: "身体分节、有外骨骼吗？", legs6: "有三对足吗？", legs8: "有四对足吗？", legsmany: "每个体节都有一对足吗？",
  shell: "身体柔软、背着螺旋形的壳吗？", ring: "身体呈圆筒形、由许多环节组成吗？", radial: "身体呈辐射对称吗？", sting: "有带刺细胞的触手吗？", arms: "有五条腕吗？", spore: "用孢子繁殖吗？", stemleaf: "有茎和叶，但没有真正的根吗？",
  root: "有真正的根、茎、叶吗？", seed: "用种子繁殖吗？", naked: "种子外面没有果皮包被吗？", fruit: "种子外有果皮包被吗？", cot1: "种子里只有一片子叶吗？", cap: "有菌盖和菌柄吗？", brush: "直立菌丝的顶端呈扫帚状吗？", budding: "是进行出芽生殖的单细胞生物吗？",
  rodshape: "细胞呈杆状吗？", ball: "细胞呈球状吗？", phagetail: "有头部和尾部吗？", helix: "呈杆状、表面螺旋排列吗？", bony: "骨骼是硬骨吗？", cart: "骨骼是软骨吗？", horse: "头部像马头、直立游泳吗？", tailed: "成体有尾吗？", warty: "皮肤粗糙、有疣状突起吗？",
  jump: "后肢发达、善于跳跃吗？", nolimb: "没有四肢吗？", limbs: "有四肢吗？", carapace: "背上有坚硬的甲壳吗？", big: "体形巨大吗？", domestic: "是常见的家禽吗？", fly: "能飞行吗？", swimbird: "翅膀呈鳍状、擅长游泳吗？", hook: "喙呈钩状、捕食小动物吗？",
  longear: "有一对长耳朵吗？", marine: "生活在海洋里吗？", carn: "是食肉动物吗？", grasp: "手指灵活、能抓握吗？", trunk: "有长长的鼻子吗？", scalewing: "翅膀上有细小的鳞片吗？", web: "会结网捕食吗？",
};
export interface Node { tag?: string; yes?: number; no?: number; leaf?: number }
/** the key: at each node the question that splits the remaining organisms most evenly (ties: the earlier tag in TAGQ) */
export function buildTree(ids: number[] = ORGS.map((o) => o.id)): Node[] {
  const nodes: Node[] = [], tags = Object.keys(TAGQ);
  const make = (set: number[]): number => {
    const idx = nodes.length; nodes.push({});
    if (set.length === 1) { nodes[idx].leaf = set[0]; return idx; }
    let best = "", bd = Infinity;
    for (const t of tags) { const y = set.filter((i) => ORGS[i].tags.has(t)).length; if (y === 0 || y === set.length) continue; const d = Math.abs(set.length - 2 * y); if (d < bd) { bd = d; best = t; } }
    if (!best) throw new Error(`organisms ${set.map((i) => ORGS[i].name).join(",")} cannot be told apart`);
    nodes[idx].tag = best;
    nodes[idx].yes = make(set.filter((i) => ORGS[i].tags.has(best)));
    nodes[idx].no = make(set.filter((i) => !ORGS[i].tags.has(best)));
    return idx;
  };
  make(ids);
  return nodes;
}
export const TREE = buildTree();
/** follow the key with the answers of `ans(tag)`: the questions asked and the organism found */
export function identify(ans: (tag: string) => boolean, tree: Node[] = TREE): { path: [string, boolean][]; leaf: number } {
  const path: [string, boolean][] = []; let n = 0;
  for (let k = 0; k < 200; k++) { const nd = tree[n]; if (nd.leaf !== undefined) return { path, leaf: nd.leaf }; const a = ans(nd.tag!); path.push([nd.tag!, a]); n = a ? nd.yes! : nd.no!; }
  throw new Error("key does not end");
}
export const truth = (org: number) => (tag: string) => ORGS[org].tags.has(tag);
// ---- sorting game ----
export const SETS = [
  { classes: ["鱼类", "两栖类", "爬行类", "鸟类", "哺乳类"], of: (o: Org): number => ["fish", "amph", "rept", "bird", "mamm"].indexOf(o.group) },
  { classes: ["藻类植物", "苔藓植物", "蕨类植物", "裸子植物", "被子植物"], of: (o: Org): number => ({ kelp: 0, moss: 1, fern: 2, pine: 3, maize: 4, bean: 4 } as Record<string, number>)[o.group] ?? -1 },
  { classes: ["动物界", "植物界", "真菌界", "细菌界", "病毒"], of: (o: Org): number => (o.tags.has("mobile") ? 0 : o.tags.has("photo") ? 1 : o.tags.has("nuc") ? 2 : o.tags.has("cell") ? 3 : 4) },
];
export const poolOf = (set: number) => ORGS.filter((o) => SETS[set].of(o) >= 0 && (set !== 0 || SETS[0].of(o) >= 0));
/** the organisms shown by a round of the sorting game: all six plants, otherwise ten of the set, at least one of each class */
export function items(set: number, rng: () => number): number[] {
  const pool = poolOf(set), cls = SETS[set].classes.length;
  if (set === 1) return shuffle(rng, pool.map((o) => o.id));
  const out: number[] = [];
  for (let k = 0; k < cls; k++) out.push(pick(rng, pool.filter((o) => SETS[set].of(o) === k)).id);
  const rest = shuffle(rng, pool.map((o) => o.id).filter((i) => !out.includes(i)));
  return shuffle(rng, [...out, ...rest.slice(0, 10 - out.length)]);
}
export const classOfGroup = (o: Org) => SETS[0].classes[SETS[0].of(o)] ?? SETS[1].classes[SETS[1].of(o)] ?? "";
export function quiz(rng: () => number): Q[] {
  const v = pick(rng, ORGS.filter((o) => SETS[0].of(o) >= 0)), warmQ = pick(rng, ORGS.filter((o) => SETS[0].of(o) >= 0));
  const pl = pick(rng, ORGS.filter((o) => SETS[1].of(o) >= 0));
  return [
    makeQ(rng, "group", [v.id], `“${v.name}”属于脊椎动物中的：`, SETS[0].classes[SETS[0].of(v)], SETS[0].classes.filter((x) => x !== SETS[0].classes[SETS[0].of(v)]), "脊椎动物分为鱼类、两栖类、爬行类、鸟类、哺乳类。"),
    makeQ(rng, "warm", [warmQ.id], `“${warmQ.name}”的体温是否恒定？`, warmQ.tags.has("warm") ? "恒定（恒温动物）" : "不恒定（变温动物）", ["恒定（恒温动物）", "不恒定（变温动物）", "随季节变化的恒温动物", "不一定"].filter((x) => x !== (warmQ.tags.has("warm") ? "恒定（恒温动物）" : "不恒定（变温动物）")), "只有鸟类和哺乳类是恒温动物。"),
    makeQ(rng, "plant", [pl.id], `“${pl.name}”属于：`, SETS[1].classes[SETS[1].of(pl)], SETS[1].classes.filter((x) => x !== SETS[1].classes[SETS[1].of(pl)]), "藻类、苔藓、蕨类用孢子繁殖；裸子植物和被子植物用种子繁殖。"),
    numQ(rng, "ranks", [], "生物分类的基本单位从大到小依次是界、门、纲、目、科、属、种，共有几级？", 7, "级", 0, "最基本的分类单位是种。"),
    makeQ(rng, "kingdoms", [], "生物分为哪几个界（本模型）？", "动物界、植物界、真菌界、细菌界、病毒（非细胞生物）", ["动物界、植物界、真菌界", "动物界、植物界、细菌界、病毒", "动物界、植物界、真菌界、细菌界", "动物界、植物界"], "病毒没有细胞结构。"),
  ];
}
