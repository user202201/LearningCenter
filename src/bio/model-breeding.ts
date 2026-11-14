/** 育种与生物技术 (pure, 八下 · 遗传和变异): cross breeding with two traits (9:3:3:1), the techniques of breeding and biotechnology, and cloning. Textbook level. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
/** F2 phenotypes of a cross of two pure lines AAbb (high yield, susceptible) x aaBB (low yield, resistant), in sixteenths: [name, sixteenths] */
export const F2: [string, number][] = [["高产抗病（A_B_）", 9], ["高产感病（A_bb）", 3], ["低产抗病（aaB_）", 3], ["低产感病（aabb）", 1]];
export const f2count = (n: number, i: number) => (n * F2[i][1]) / 16;
export const pureTarget = (n: number) => n / 16;   // AABB: the only high-yield, resistant plants that breed true
export const TECHS = ["杂交育种", "诱变育种", "转基因技术", "克隆技术"];
export const TECH_ITEMS: [string, number][] = [
  ["让高产易倒伏的水稻与低产抗倒伏的水稻杂交，选育优良品种", 0], ["让两个品种杂交，从后代中选出优良个体，培育杂交水稻", 0],
  ["用射线处理萌发的种子，从变异的后代中选育新品种", 1], ["让种子搭载航天器在太空飞行，再选育新品种", 1],
  ["把苏云金杆菌的抗虫基因转入棉花，培育抗虫棉", 2], ["把人的胰岛素基因转入大肠杆菌，用来生产胰岛素", 2],
  ["用体细胞的细胞核培育出多莉羊", 3], ["由一个体细胞核发育成遗传物质与供核个体基本相同的个体", 3],
];
/** the three sheep of the cloning model: name, face colour */
export const SHEEP: [string, string][] = [["甲羊", "白脸"], ["乙羊", "黑脸"], ["丙羊", "棕脸"]];
export const FACE_COLORS = ["#f8f9fa", "#343a40", "#a9815a"];
/** the clone's traits follow the sheep that gave the cell nucleus: that is where nearly all its genetic material comes from */
export const faceOf = (nuc: number, _egg: number, _sur: number) => nuc;
export function quiz(rng: () => number): Q[] {
  const n = pick(rng, [160, 320, 480, 800]), n2 = pick(rng, [160, 320, 480, 800]), i = pick(rng, [0, 1, 2, 3, 4, 5, 6, 7]), k = pick(rng, [0, 1]);
  const PR = [["杂交育种是：", "让不同品种杂交，从后代中选出具有优良性状的新品种", ["让生物吸收宇宙射线", "把一个细胞核移入去核的卵细胞", "把一种生物的基因转入另一种生物"]], ["诱变育种（如太空育种）的原理是：", "诱发生物的遗传物质发生改变（变异），再选育", ["让生物的性状永远不变", "让生物适应新的生活环境", "把两个品种的优点直接拼合"]]] as const;
  return [
    numQ(rng, "f2", [n], `用高产感病（AAbb）和低产抗病（aaBB）的纯种杂交，F1 自交得 ${n} 株 F2，理论上高产抗病（A_B_）的约有多少株？`, f2count(n, 0), "", 0, "F2 的四种表现型比例约为 9 : 3 : 3 : 1。"),
    numQ(rng, "pure", [n2], `同样的杂交，${n2} 株 F2 中，理论上高产抗病且能稳定遗传的纯合子（AABB）约有多少株？`, pureTarget(n2), "", 0, "AABB 占 F2 的 1/16；高产抗病的其他植株自交后代还会出现性状分离。"),
    makeQ(rng, "tech", [i], `“${TECH_ITEMS[i][0]}”属于：`, TECHS[TECH_ITEMS[i][1]], TECHS.filter((_, t) => t !== TECH_ITEMS[i][1]), "杂交育种、诱变育种、转基因技术和克隆技术是常见的育种与生物技术。"),
    makeQ(rng, "dolly", [], "多莉羊（克隆羊）的遗传物质主要来自：", "提供细胞核的羊", ["提供卵细胞的羊", "代孕母羊", "三只羊各占三分之一"], "细胞核是遗传的控制中心，克隆个体的性状与供核个体基本相同。"),
    makeQ(rng, "principle", [k], PR[k][0], PR[k][1], [...PR[k][2]], "育种就是利用遗传和变异的原理培育新品种。"),
  ];
}
