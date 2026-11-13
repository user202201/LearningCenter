/** 光的折射 (pure): Snell's law, total internal reflection, the critical angle. Angles in degrees from the normal. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const C = 3e8;
export const N = { air: 1, water: 1.33, glass: 1.5 } as const;
export interface Ref { tir: boolean; thetaT: number; thetaR: number }
export function refract(n1: number, n2: number, thetaI: number): Ref {
  const s = (n1 * Math.sin((thetaI * Math.PI) / 180)) / n2;
  if (s > 1 + 1e-12) return { tir: true, thetaT: NaN, thetaR: thetaI };
  return { tir: false, thetaT: (Math.asin(Math.min(1, s)) * 180) / Math.PI, thetaR: thetaI };
}
/** the critical angle (only when going from the denser into the less dense medium) */
export const critical = (n1: number, n2: number): number | null => (n1 > n2 ? (Math.asin(n2 / n1) * 180) / Math.PI : null);
export const speedIn = (n: number) => C / n;
export function quiz(rng: () => number): Q[] {
  const ti = pick(rng, [30, 40, 45, 50, 60]);
  const [nm, nn] = pick(rng, [["水", 1.33], ["玻璃", 1.5]] as const);
  const [cm, cn] = pick(rng, [["水", 1.33], ["玻璃", 1.5]] as const);
  const [sm, sn] = pick(rng, [["水", 1.33], ["玻璃", 1.5]] as const);
  const tw = pick(rng, [30, 40, 45, 50, 60, 70]);
  const tir = refract(1.33, 1, tw).tir;
  return [
    numQ(rng, "snell", [ti, nn], `光从空气斜射入${nm}（折射率 ${nn}），入射角 ${ti}°，折射角约是多少？`, refract(1, nn, ti).thetaT, "°", 1, "n₁ sin θ₁ = n₂ sin θ₂。"),
    numQ(rng, "critical", [cn], `光从${cm}（折射率 ${cn}）射入空气，临界角约是多少？`, critical(cn, 1)!, "°", 1, "sin C = n₂ / n₁。"),
    numQ(rng, "speed", [sn], `光在${sm}（折射率 ${sn}）中的速度约是多少？（真空中为 3×10⁸ m/s）`, speedIn(sn) / 1e8, "×10⁸ m/s", 2, "v = c / n。"),
    makeQ(rng, "toward", [], "光从空气斜射入水中时，折射角与入射角相比：", "折射角小于入射角", ["折射角大于入射角", "折射角等于入射角", "折射光线不偏折，方向不变（斜射时也如此）", "光线被全部反射"], "光从空气进入水，折射光线向法线偏折。"),
    makeQ(rng, "tir", [tw], `光从水（折射率 1.33）斜射向空气，入射角 ${tw}°（水的临界角约 48.8°），会发生什么？`, tir ? "发生全反射，没有折射光线" : "有折射光线，折射角大于入射角", tir ? ["有折射光线，折射角大于入射角", "有折射光线，折射角小于入射角", "折射角等于入射角"] : ["发生全反射，没有折射光线", "有折射光线，折射角小于入射角", "折射角等于入射角"], "入射角超过临界角时发生全反射。"),
  ];
}
