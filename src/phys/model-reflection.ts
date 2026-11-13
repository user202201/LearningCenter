/** 光的反射与平面镜成像 (pure). Angles in degrees, measured from the vertical (the normal of a horizontal mirror), clockwise positive. */
import { numQ, pick, type Q } from "./qtools";
export interface Refl { hit: boolean; thetaI: number; thetaR: number; outDir: number }
/** the source sits at angle -theta0 (left of the normal); the mirror is turned clockwise by alpha: reflected direction = theta0 + 2 alpha */
export function reflection(theta0: number, alpha: number): Refl {
  const src = -theta0, nor = alpha;
  const thetaI = Math.abs(src - nor);
  if (thetaI >= 90) return { hit: false, thetaI, thetaR: thetaI, outDir: NaN };
  return { hit: true, thetaI, thetaR: thetaI, outDir: 2 * nor - src };
}
export interface Img { objDist: number; imgDist: number; sep: number; imgH: number; virtual: boolean; upright: boolean }
export const planeImage = (d: number, h: number): Img => ({ objDist: d, imgDist: d, sep: 2 * d, imgH: h, virtual: true, upright: true });
export function quiz(rng: () => number): Q[] {
  const a = pick(rng, [20, 25, 30, 35, 40, 50, 60]), b = pick(rng, [20, 30, 40, 50, 60]);
  const c = pick(rng, [20, 30, 40, 45, 60]);
  const d = pick(rng, [20, 30, 40, 50, 60]);
  const v = pick(rng, [0.5, 1, 1.5, 2]);
  return [
    numQ(rng, "theta_r", [a], `入射角是 ${a}°，反射角是多少？`, a, "°", 0, "反射角等于入射角。"),
    numQ(rng, "from_mirror", [b], `入射光线与镜面的夹角是 ${b}°，反射角是多少？`, 90 - b, "°", 0, "入射角是入射光线与法线的夹角：90° − 夹角。"),
    numQ(rng, "between", [c], `入射角为 ${c}°，入射光线与反射光线的夹角是多少？`, 2 * c, "°", 0, "夹角 = 入射角 + 反射角 = 2 × 入射角。"),
    numQ(rng, "img_sep", [d], `一个人站在平面镜前 ${d} cm 处，他与自己的像相距多少？`, 2 * d, "cm", 0, "像到镜面的距离等于物到镜面的距离。"),
    numQ(rng, "img_speed", [v], `一个人以 ${v} m/s 的速度走向平面镜，他的像相对于他的速度是多少？`, 2 * v, "m/s", 1, "像也以 v 的速度走向镜面，相对速度是 2v。"),
  ];
}
