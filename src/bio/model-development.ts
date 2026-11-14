/** 人的由来与青春期 (pure): growth of the embryo / fetus by week, and height growth with the growth spurt of puberty. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
/** [week, length mm, mass g] */
export const FETUS: [number, number, number][] = [[0, 0.1, 0], [8, 16, 1], [10, 31, 4], [12, 60, 14], [20, 250, 300], [28, 370, 1000], [36, 470, 2600], [40, 500, 3400]];
const lerp = (w: number, k: 1 | 2) => { for (let i = 1; i < FETUS.length; i++) if (w <= FETUS[i][0]) { const a = FETUS[i - 1], b = FETUS[i], t = (w - a[0]) / (b[0] - a[0]); return a[k] + t * (b[k] - a[k]); } return FETUS[FETUS.length - 1][k]; };
export const lengthAt = (w: number) => lerp(w, 1);
export const massAt = (w: number) => lerp(w, 2);
export const phase = (w: number) => (w < 1 ? "受精卵" : w < 8 ? "胚胎" : "胎儿");
/** median height (cm) at each age 0..18, girls / boys: rounded values after the national growth charts of Chinese children (about 50 cm at birth, 87 cm at 2, 138 cm at 10, 160 cm / 172 cm at 18); a teaching table, not a measurement */
export const HEIGHTS: [number[], number[]] = [
  [50, 75.5, 87.5, 96, 103, 109.5, 115.5, 121.5, 127, 132.5, 138, 144.8, 151.6, 156.1, 158.2, 159.3, 160, 160.2, 160.4],
  [50, 75.5, 87.5, 96.5, 103.5, 110, 116, 122, 128, 133, 138.3, 143.8, 149.8, 156.3, 162.8, 167.3, 170.3, 171.6, 172],
];
/** monotone cubic (Fritsch-Carlson) through the table: smooth, never goes down, velocity = its slope */
function slopes(y: number[]): number[] {
  const n = y.length, d = y.slice(1).map((v, i) => v - y[i]), m = new Array<number>(n).fill(0);
  for (let k = 1; k < n - 1; k++) m[k] = d[k - 1] * d[k] > 0 ? 2 / (1 / d[k - 1] + 1 / d[k]) : 0;
  const end = (d0: number, d1: number, m1: number) => { const e = (3 * d0 - m1) / 2; return Math.sign(e) !== Math.sign(d0) ? 0 : Math.sign(d0) !== Math.sign(d1) && Math.abs(e) > 3 * Math.abs(d0) ? 3 * d0 : e; };
  m[0] = end(d[0], d[1], m[1]); m[n - 1] = end(d[n - 2], d[n - 3], m[n - 2]);
  return m;
}
const SLOPES = [slopes(HEIGHTS[0]), slopes(HEIGHTS[1])];
function hermite(age: number, sex: number, deriv: boolean): number {
  const y = HEIGHTS[sex], m = SLOPES[sex], a = Math.min(18 - 1e-9, Math.max(0, age)), k = Math.floor(a), t = a - k;
  const t2 = t * t, t3 = t2 * t;
  if (deriv) return (6 * t2 - 6 * t) * y[k] + (3 * t2 - 4 * t + 1) * m[k] + (-6 * t2 + 6 * t) * y[k + 1] + (3 * t2 - 2 * t) * m[k + 1];
  return (2 * t3 - 3 * t2 + 1) * y[k] + (t3 - 2 * t2 + t) * m[k] + (-2 * t3 + 3 * t2) * y[k + 1] + (t3 - t2) * m[k + 1];
}
/** growth speed in cm per year */
export const velocity = (age: number, sex: number) => (age >= 18 ? 0 : hermite(age, sex, true));
/** height in cm (girls sex = 0, boys sex = 1; `h0` is only the starting value kept for the old signature: the table starts at 50 cm) */
export const height = (age: number, sex: number, _h0 = 50): number => (age >= 18 ? HEIGHTS[sex][18] : hermite(age, sex, false));
/** the age of the fastest growth in puberty (searched between 8 and 16 years): girls about 11, boys about 13 */
export const peakAge = (sex: number): number => { let best = 8, bv = -1; for (let a = 8; a <= 16; a += 0.05) { const v = velocity(a, sex); if (v > bv) { bv = v; best = a; } } return Math.round(best * 10) / 10; };
export const PEAK = [peakAge(0), peakAge(1)];   // age of the growth spurt: 0 girls, 1 boys
/** the growth spurt of puberty: within 1.5 years of the fastest growth (not the quick growth of the first years) */
export const inSpurt = (age: number, sex: number): boolean => Math.abs(age - PEAK[sex]) <= 1.5;
export function quiz(rng: () => number): Q[] {
  const w = pick(rng, [8, 12, 20, 28, 36, 40]), w2 = pick(rng, [8, 12, 20, 28, 36, 40]), sx = pick(rng, [0, 1]);
  return [
    numQ(rng, "len", [w], `按模型，怀孕第 ${w} 周时胎儿的身长约为多少毫米？（8 周 16，12 周 60，20 周 250，28 周 370，36 周 470，40 周 500；孕周从末次月经算起，12 周以前指头臀长，之后指身长）`, lengthAt(w), "mm", 0, "按表格读数。"),
    numQ(rng, "mass", [w2], `按模型，怀孕第 ${w2} 周时胎儿的质量约为多少克？（8 周 1，12 周 14，20 周 300，28 周 1000，36 周 2600，40 周 3400）`, massAt(w2), "g", 0, "按表格读数。"),
    numQ(rng, "spurt", [sx], `按模型，${sx === 0 ? "女孩" : "男孩"}青春期身高突增最快的年龄约是多少岁？`, PEAK[sx], "岁", 0, "女孩的身高突增一般比男孩早约两年（女孩约 11 岁，男孩约 13 岁）。"),
    makeQ(rng, "fert", [], "精子和卵细胞结合形成受精卵的部位是：", "输卵管", ["子宫", "卵巢", "阴道"], "受精卵在输卵管内形成，并移动到子宫内着床。"),
    makeQ(rng, "nutri", [], "胎儿在母体内通过什么获得营养物质和氧气？", "胎盘和脐带", ["羊水", "卵黄", "肺"], "胎儿与母体的物质交换在胎盘处进行。"),
  ];
}
