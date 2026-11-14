/** 光的直线传播 (pure): the pinhole image, the shadow of an object lit by a point / an extended source (similar triangles), and the Sun-Moon-Earth alignments of an eclipse. */
import { makeQ, numQ, pick, shuffle, type Q } from "./qtools";
export const C_KM_S = 3e5;
// ---------- pinhole ----------
export const pinholeHeight = (h: number, u: number, v: number) => (h * v) / u;
/** the width (mm) of the patch of light that one point of the object makes on the screen: it is the hole's diameter seen from the point, enlarged by the screen distance */
export const blurMm = (d: number, u: number, v: number) => (d * (u + v)) / u;
export const SHARP_MM = 2;
// ---------- shadow of an object of width D lit by a source of width s: distances a (source to object), b (object to screen) ----------
export interface Shadow { umbra: number; whole: number; penumbra: boolean }
export function shadow(D: number, s: number, a: number, b: number): Shadow {
  const whole = D + ((D + s) * b) / a, inner = D + ((D - s) * b) / a;
  return { umbra: Math.max(0, inner), whole, penumbra: s > 0 && b > 0 };
}
// ---------- eclipses ----------
export type Eclipse = "none" | "solar" | "lunar";
/** phase = the angle (degrees) of the Moon round the Earth, 0 = between the Sun and the Earth; beta = how far the Moon is above or below the plane of the Earth's orbit (degrees); the limits are illustrative */
export function eclipse(phase: number, beta: number): Eclipse {
  const nearNew = phase <= 5 || phase >= 355, nearFull = Math.abs(phase - 180) <= 5;
  if (nearNew && Math.abs(beta) <= 1.5) return "solar";
  if (nearFull && Math.abs(beta) <= 1) return "lunar";
  return "none";
}
export const MOON_AT = (phase: number) => (phase <= 5 || phase >= 355 ? "新月的位置（月球在太阳和地球之间）" : Math.abs(phase - 180) <= 5 ? "满月的位置（地球在太阳和月球之间）" : "其他位置");
const STRAIGHT = ["影子的形成", "小孔成像", "日食和月食", "激光准直（开凿隧道时用来指向）", "排队时向前看齐"];
const OTHER = ["平静的水面上出现岸边的倒影", "雨后天空出现彩虹", "插入水中的筷子看起来向上弯折", "用放大镜看到放大的字", "汽车的后视镜里看到后面的车"];
export function quiz(rng: () => number): Q[] {
  const [h, u, v] = pick(rng, [[6, 30, 15], [10, 20, 40], [4, 16, 24], [8, 40, 10], [12, 24, 12]]);
  const [D, a, b] = pick(rng, [[10, 20, 20], [5, 10, 30], [8, 20, 10], [6, 30, 60], [12, 24, 24]]);
  const x = pick(rng, [0.384, 150, 60, 30, 300]);
  const ans = pick(rng, STRAIGHT);
  const solar = rng() < 0.5;
  return [
    numQ(rng, "img_h", [h, u, v], `小孔成像：蜡烛高 ${h} cm，蜡烛到小孔 ${u} cm，小孔到光屏 ${v} cm，光屏上像的高度是多少？`, (h * v) / u, "cm", 1, "像高 ÷ 物高 = 像到小孔的距离 ÷ 物到小孔的距离（相似三角形）。"),
    numQ(rng, "shadow", [D, a, b], `点光源到宽 ${D} cm 的挡板的距离是 ${a} cm，挡板到光屏的距离是 ${b} cm，光屏上影的宽度是多少？`, (D * (a + b)) / a, "cm", 1, "光沿直线传播，影的宽度 ÷ 挡板宽度 = 光源到屏的距离 ÷ 光源到挡板的距离。"),
    numQ(rng, "lighttime", [x], `某天体离地球约 ${x}×10⁶ km，光在真空中的速度取 3×10⁵ km/s，光从那里传到地球需要多长时间？`, (x * 1e6) / C_KM_S, "s", 2, "t = s / v。"),
    makeQ(rng, "straight", [], "下列现象中，由光的直线传播形成的是：", ans, shuffle(rng, OTHER).slice(0, 3), "影子、小孔成像、日食和月食都是光沿直线传播形成的；倒影是反射，彩虹和筷子“弯折”是折射。"),
    solar
      ? makeQ(rng, "eclipse", [0], "发生日食时，太阳、月球、地球三者的位置关系是：", "月球在太阳和地球之间，三者几乎在同一条直线上", ["地球在太阳和月球之间，三者几乎在同一条直线上", "太阳在月球和地球之间，三者几乎在同一条直线上", "三者成直角"], "月球挡住射向地球的太阳光，月球的影子落在地球上，形成日食。")
      : makeQ(rng, "eclipse", [1], "发生月食时，太阳、地球、月球三者的位置关系是：", "地球在太阳和月球之间，三者几乎在同一条直线上", ["月球在太阳和地球之间，三者几乎在同一条直线上", "太阳在地球和月球之间，三者几乎在同一条直线上", "三者成直角"], "地球挡住射向月球的太阳光，月球进入地球的影子，形成月食。"),
  ];
}
