/** 探究凸透镜成像规律 (pure): a candle, a convex lens and a screen on an optical bench. The screen shows a sharp image only at the image distance; the width of the blur is the lens aperture seen from the screen. */
import { makeQ, numQ, pick, type Q } from "./qtools";
import { image } from "./model-lens";
export const FS = [10, 12, 15];                 // the three lenses (cm)
export const APERTURE = 4, SHARP_CM = 0.25;
export const MAXROWS = 6;
/** parallel light (the Sun): the width (cm) of the bright spot on a screen at distance v behind the lens */
export const spot = (f: number, v: number) => (APERTURE * Math.abs(v - f)) / f;
export interface OnScreen { none: boolean; v0: number; blur: number; sharp: boolean; kind: number; m: number }
/** kind: 0 smaller, 1 same size, 2 larger than the object (only for a sharp real image) */
export function onScreen(f: number, u: number, v: number): OnScreen {
  if (u <= f + 1e-9) return { none: true, v0: Infinity, blur: Infinity, sharp: false, kind: -1, m: 0 };
  const v0 = (u * f) / (u - f), blur = (APERTURE * Math.abs(v - v0)) / v0, m = v0 / u;
  return { none: false, v0, blur, sharp: blur <= SHARP_CM, kind: Math.abs(u - 2 * f) < 1e-9 ? 1 : u > 2 * f ? 0 : 2, m };
}
export const KINDS = ["倒立、缩小的实像", "倒立、等大的实像", "倒立、放大的实像"];
export const natureOf = (f: number, u: number) => image(f, u, 0).nature;
export function quiz(rng: () => number): Q[] {
  const d = pick(rng, [16, 20, 24, 30, 36]);
  const [f, u] = pick(rng, [[10, 15], [10, 30], [10, 20], [12, 18], [15, 30], [8, 12]]);
  const [h, u2, v2] = pick(rng, [[4, 30, 15], [3, 15, 30], [2, 20, 20], [6, 36, 18], [5, 25, 50]]);
  return [
    numQ(rng, "focal", [d], `在光具座上，蜡烛和光屏到凸透镜的距离相等，都是 ${d} cm 时，光屏上得到倒立、等大的实像，这个凸透镜的焦距是多少厘米？`, d / 2, "cm", 1, "倒立、等大的实像出现在 u = v = 2f 处，所以 f = u / 2。"),
    numQ(rng, "vdist", [f, u], `凸透镜的焦距是 ${f} cm，蜡烛到凸透镜的距离是 ${u} cm，光屏上成清晰的像时，光屏到凸透镜的距离是多少厘米？`, (u * f) / (u - f), "cm", 1, "由 1/u + 1/v = 1/f 得 v = uf / (u − f)。"),
    numQ(rng, "size", [h, u2, v2], `蜡烛火焰高 ${h} cm，物距是 ${u2} cm，像距是 ${v2} cm，光屏上像的高度是多少厘米？`, (h * v2) / u2, "cm", 1, "像高 ÷ 物高 = 像距 ÷ 物距。"),
    makeQ(rng, "screen", [], "蜡烛到凸透镜的距离小于焦距时，在光屏上找不到像，原因是：", "成的是正立、放大的虚像，虚像不能呈现在光屏上", ["不成像", "成的是倒立、缩小的实像", "光屏太小了"], "实像是光线实际会聚成的，可以呈现在光屏上；虚像是折射光线反向延长线相交成的，不能。"),
    makeQ(rng, "move", [], "蜡烛从离凸透镜 3 倍焦距处向透镜移动到 1.5 倍焦距处（光屏随之移动，仍能得到清晰的像），像的大小和像距的变化是：", "像变大，像距变大", ["像变小，像距变小", "像变大，像距变小", "像变小，像距变大"], "物距减小，像距增大，像变大（成实像时：物近像远像变大）。"),
  ];
}
