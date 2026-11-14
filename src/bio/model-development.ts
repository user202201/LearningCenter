/** 人的由来与青春期 (pure): growth of the embryo / fetus by week, and height growth with the growth spurt of puberty. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
/** [week, length mm, mass g] */
export const FETUS: [number, number, number][] = [[0, 0.1, 0], [8, 30, 4], [12, 60, 14], [20, 250, 300], [28, 370, 1000], [36, 470, 2600], [40, 500, 3400]];
const lerp = (w: number, k: 1 | 2) => { for (let i = 1; i < FETUS.length; i++) if (w <= FETUS[i][0]) { const a = FETUS[i - 1], b = FETUS[i], t = (w - a[0]) / (b[0] - a[0]); return a[k] + t * (b[k] - a[k]); } return FETUS[FETUS.length - 1][k]; };
export const lengthAt = (w: number) => lerp(w, 1);
export const massAt = (w: number) => lerp(w, 2);
export const phase = (w: number) => (w < 1 ? "受精卵" : w < 8 ? "胚胎" : "胎儿");
export const PEAK = [12, 14];   // age of the growth spurt: 0 girls, 1 boys
/** growth speed in cm per year */
export const velocity = (age: number, sex: number) => 5 + 4 * Math.exp(-age / 3) * 2 + 7 * Math.exp(-(((age - PEAK[sex]) / 1.5) ** 2));
export function height(age: number, sex: number, h0 = 50): number { let h = h0; for (let a = 0; a < age - 1e-12;) { const dt = Math.min(0.01, age - a); h += velocity(a + dt / 2, sex) * dt; a += dt; } return h; }
export function quiz(rng: () => number): Q[] {
  const w = pick(rng, [8, 12, 20, 28, 36, 40]), w2 = pick(rng, [8, 12, 20, 28, 36, 40]), sx = pick(rng, [0, 1]);
  return [
    numQ(rng, "len", [w], `按模型，怀孕第 ${w} 周时胎儿的身长约为多少毫米？（8 周 30，12 周 60，20 周 250，28 周 370，36 周 470，40 周 500）`, lengthAt(w), "mm", 0, "按表格读数。"),
    numQ(rng, "mass", [w2], `按模型，怀孕第 ${w2} 周时胎儿的质量约为多少克？（8 周 4，12 周 14，20 周 300，28 周 1000，36 周 2600，40 周 3400）`, massAt(w2), "g", 0, "按表格读数。"),
    numQ(rng, "spurt", [sx], `按模型，${sx === 0 ? "女孩" : "男孩"}青春期身高突增最快的年龄约是多少岁？`, PEAK[sx], "岁", 0, "女孩的身高突增一般比男孩早约两年。"),
    makeQ(rng, "fert", [], "精子和卵细胞结合形成受精卵的部位是：", "输卵管", ["子宫", "卵巢", "阴道"], "受精卵在输卵管内形成，并移动到子宫内着床。"),
    makeQ(rng, "nutri", [], "胎儿在母体内通过什么获得营养物质和氧气？", "胎盘和脐带", ["羊水", "卵黄", "肺"], "胎儿与母体的物质交换在胎盘处进行。"),
  ];
}
