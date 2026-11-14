/** 镜面反射与漫反射 (pure): every small facet of a surface obeys the law of reflection; a rough surface has facets tilted every way, so the reflected light is spread. */
import { makeQ, numQ, pick, shuffle, type Q } from "./qtools";
/** r = roughness 0..1: the facets are tilted by up to 25 r degrees, so the reflected rays leave within ± 2 x 25 r of the mirror direction; a smooth surface still has the width of the eye (±2°) */
export const spread = (r: number) => Math.max(2, 50 * r);
/** the facet tilts used for the nine rays that are drawn (fractions of the largest tilt) */
export const TILTS = [-1, 0.6, -0.3, 1, 0, -0.8, 0.4, -0.6, 0.9];
/** direction of the ray from facet i (degrees from the normal) for the incident angle theta (law of reflection at the tilted facet) */
export const outAngle = (r: number, theta: number, i: number) => theta + 2 * 25 * r * TILTS[i];
/** brightness (0..1) seen by an eye in the direction alpha: the same light spread over a wider angle is dimmer */
export const brightness = (r: number, theta: number, alpha: number) => (Math.abs(alpha - theta) <= spread(r) ? Math.min(1, 2 / spread(r)) : 0);
export const isMirror = (r: number) => spread(r) <= 5;
const DIFFUSE = ["教室里不同位置的同学都能看到黑板上的字", "从各个方向都能看到屏幕上的画面", "能从不同方向看到桌上的书"];
const MIRROR = ["平静的水面映出岸边的树", "玻璃幕墙把阳光强烈地反射到街上", "在镜子里看到自己的像", "光滑的黑板反光，某个位置的同学看不清字"];
export function quiz(rng: () => number): Q[] {
  const t = pick(rng, [10, 15, 20, 25, 30, 35, 40]), b = pick(rng, [20, 30, 40, 50, 60]);
  return [
    numQ(rng, "facet", [t], `一束光竖直射向一个与水平面成 ${t}° 角的小平面（可以看成小镜面），反射光线与竖直方向的夹角是多少度？`, 2 * t, "°", 0, "小平面的法线与竖直方向成 t 角，入射角是 t，反射角也是 t，所以反射光线与入射光线的方向相差 2t。"),
    numQ(rng, "outang", [b], `一束光射到平面镜上，入射光线与镜面的夹角是 ${b}°，反射角是多少度？`, 90 - b, "°", 0, "入射角是入射光线与法线的夹角，等于 90° 减去它与镜面的夹角；反射角等于入射角。"),
    makeQ(rng, "type", [], "下列现象中，属于漫反射的是：", pick(rng, DIFFUSE), shuffle(rng, MIRROR).slice(0, 3), "漫反射使反射光射向各个方向，所以从不同位置都能看到物体；镜面反射的光只射向一个方向。"),
    makeQ(rng, "see", [], "我们能看见不发光的物体，是因为：", "物体表面发生漫反射，反射光进入了眼睛", ["物体自己发出了光", "眼睛发出的光照到了物体上", "物体表面发生镜面反射，反射光射向各个方向"], "不发光的物体被光照亮后，向各个方向漫反射，反射光进入眼睛，我们就看见它了。"),
    makeQ(rng, "glare", [], "玻璃幕墙会造成“光污染”，是因为光射到它的表面时发生了：", "镜面反射", ["漫反射", "折射", "色散"], "光滑的幕墙表面发生镜面反射，反射光集中射向同一方向，十分耀眼。"),
  ];
}
