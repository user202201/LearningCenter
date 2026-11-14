/** 光的色散与色光混合 (pure): a prism (Cauchy dispersion of an exaggerated "teaching glass"), the mixing of coloured lights, the colour of an opaque object. Angles in degrees. */
import { makeQ, numQ, pick, type Q } from "./qtools";
/** the six colours of the spectrum: wavelength in micrometres, colour of the ray */
export const WAVES = [
  { k: "R", l: 0.65, c: "#e03131" }, { k: "O", l: 0.6, c: "#f76707" }, { k: "Y", l: 0.575, c: "#f5b800" },
  { k: "G", l: 0.53, c: "#2f9e44" }, { k: "B", l: 0.47, c: "#1c7ed6" }, { k: "V", l: 0.42, c: "#7048e8" },
] as const;
/** refractive index of the teaching glass (real glass disperses about three times less): n = 1.55 + 0.02 / lambda^2 */
export const nGlass = (lum: number) => 1.55 + 0.02 / (lum * lum);
const R = (d: number) => (d * Math.PI) / 180, D = (r: number) => (r * 180) / Math.PI;
export interface Pr { tir: boolean; r1: number; r2: number; theta2: number; dev: number }
/** a ray of wavelength `lum` hitting the first face of a prism with apex angle A at the angle of incidence th1 */
export function prism(A: number, th1: number, lum: number): Pr {
  const n = nGlass(lum), r1 = D(Math.asin(Math.sin(R(th1)) / n)), r2 = A - r1, s = n * Math.sin(R(r2));
  if (Math.abs(s) > 1) return { tir: true, r1, r2, theta2: NaN, dev: NaN };
  const theta2 = D(Math.asin(s));
  return { tir: false, r1, r2, theta2, dev: th1 + theta2 - A };
}
/** the spread between red and violet (null when one of them is totally reflected) */
export function spread(A: number, th1: number): number | null {
  const a = prism(A, th1, 0.65), b = prism(A, th1, 0.42);
  return a.tir || b.tir ? null : b.dev - a.dev;
}
/** the minimum deviation of a prism of index n: 2 asin(n sin(A/2)) - A */
export const minDeviation = (n: number, A: number) => 2 * D(Math.asin(n * Math.sin(R(A / 2)))) - A;
/** name of the colour made by three lights of brightness 0..100 (a light counts as "on" when it is at least half as bright as the brightest) */
export function mixName(r: number, g: number, b: number): string {
  const m = Math.max(r, g, b);
  if (m < 20) return "黑色";
  const on = [r, g, b].map((v) => v / m >= 0.5);
  const key = on.map((x) => (x ? "1" : "0")).join("");
  const t: Record<string, string> = { "100": "红色", "010": "绿色", "001": "蓝色", "110": "黄色", "011": "青色", "101": "品红色" };
  if (key === "111") return m >= 60 ? "白色" : "灰色";
  return t[key];
}
/** colour of an opaque object under a lamp (each 0 / 1 per channel): the object returns only the colours it reflects */
export const OBJECTS: [string, number[]][] = [["白色", [1, 1, 1]], ["红色", [1, 0, 0]], ["绿色", [0, 1, 0]], ["蓝色", [0, 0, 1]], ["黑色", [0, 0, 0]]];
export const LAMPS: [string, number[]][] = [["白光", [1, 1, 1]], ["红光", [1, 0, 0]], ["绿光", [0, 1, 0]], ["蓝光", [0, 0, 1]]];
export const seen = (obj: number, lamp: number): number[] => OBJECTS[obj][1].map((v, i) => v * LAMPS[lamp][1][i] * 100);
export const seenName = (obj: number, lamp: number) => { const s = seen(obj, lamp); return mixName(s[0], s[1], s[2]); };
const PAIRS: [string, number[]][] = [["红光和绿光", [100, 100, 0]], ["绿光和蓝光", [0, 100, 100]], ["红光和蓝光", [100, 0, 100]], ["红、绿、蓝三种色光", [100, 100, 100]]];
export function quiz(rng: () => number): Q[] {
  const n = pick(rng, [1.5, 1.6, 1.7]), A = pick(rng, [40, 50, 60]);
  const pi = Math.floor(rng() * 4), [pn, pv] = PAIRS[pi];
  const oi = 1 + Math.floor(rng() * 3), li = 1 + Math.floor(rng() * 3);
  const cols = ["红色", "绿色", "蓝色", "黄色", "青色", "品红色", "白色", "黑色"];
  const ans = seenName(oi, li);
  return [
    makeQ(rng, "faster", [], "白光通过三棱镜后分解成七色光，其中偏折程度最大的是：", "紫光", ["红光", "黄光", "绿光"], "同一种玻璃对紫光的折射率最大，所以紫光偏折得最厉害，红光最小。"),
    makeQ(rng, "mix", [pi], `${pn}混合后，得到的光是什么颜色？`, mixName(pv[0], pv[1], pv[2]), cols, "红、绿、蓝是色光的三原色；红加绿得黄，绿加蓝得青，红加蓝得品红，三种合在一起得白光。"),
    makeQ(rng, "obj", [oi, li], `在${LAMPS[li][0]}下，看${OBJECTS[oi][0]}的不透明物体，它呈现的颜色是：`, ans, cols, "不透明物体的颜色由它反射的色光决定：它只反射与自己颜色相同的光，吸收其他色光。"),
    numQ(rng, "mindev", [n, A], `折射率为 ${n} 的三棱镜，顶角 ${A}°，光线的最小偏向角约是多少？`, minDeviation(n, A), "°", 1, "δ = 2 arcsin(n sin(A/2)) − A。"),
    makeQ(rng, "primary", [], "光的三原色是：", "红、绿、蓝", ["红、黄、蓝", "红、黄、绿", "黄、绿、蓝", "橙、黄、紫"], "色光的三原色是红、绿、蓝；颜料的三原色才是红、黄、蓝（品红、黄、青）。"),
  ];
}
