/** 眼与视觉 (pure): the eye as a lens that changes its power to focus on the retina (accommodation), short-sight and the correcting lens. Powers in dioptres, distances in metres. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const PMIN = 58.8, AMP = 10;   // total power of the relaxed eye, and how much more it can add by thickening the lens
/** the vergence of the light at the eye: object at u metres seen through a lens of power `glass` (negative = concave) */
export const vergence = (u: number, glass: number) => 1 / u - glass;
/** the power the eye needs to focus on its retina (a myopic eye is longer: its retina is at 1 / (PMIN - myopia)) */
export const needed = (u: number, glass: number, myopia: number) => vergence(u, glass) + PMIN - myopia;
export const used = (u: number, glass: number, myopia: number) => Math.min(PMIN + AMP, Math.max(PMIN, needed(u, glass, myopia)));
export const defocus = (u: number, glass: number, myopia: number) => Math.abs(needed(u, glass, myopia) - used(u, glass, myopia));
export const sharpness = (u: number, glass: number, myopia: number) => 1 / (1 + (defocus(u, glass, myopia) / 0.5) ** 2);
export const farPoint = (myopia: number) => (myopia > 0 ? 1 / myopia : Infinity);
export const nearPoint = (myopia: number) => 1 / (AMP + myopia);
/** where the image falls relative to the retina: -1 in front of it, 0 on it, 1 behind it (image distance = 1/(power - vergence)) */
export const imageSide = (u: number, glass: number, myopia: number) => { const d = used(u, glass, myopia) - needed(u, glass, myopia); return Math.abs(d) < 1e-9 ? 0 : d > 0 ? -1 : 1; };
export function quiz(rng: () => number): Q[] {
  const m = pick(rng, [1, 1.5, 2, 2.5, 3, 4, 5]), m2 = pick(rng, [0.5, 1, 1.25, 2, 2.5, 4]), u = pick(rng, [0.1, 0.125, 0.2, 0.25, 0.5]);
  const m3 = pick(rng, [0, 1, 2, 3, 5]);
  return [
    numQ(rng, "far", [m], `近视眼的度数是 ${m * 100} 度（即 ${m} D），他不戴眼镜时能看清的最远距离（远点）是多少厘米？`, 100 / m, "cm", 0, "远点 = 1 / 近视度数（D），单位为米。"),
    numQ(rng, "corr", [m2], `一位近视者的远点为 ${100 / m2} cm，要看清无穷远处，应配戴焦度为多少 D 的镜片？（凹透镜为负）`, -m2, "D", 2, "凹透镜使光线发散，镜片的焦度 = −1 / 远点（m）。"),
    numQ(rng, "acc", [u], `正常眼要看清 ${u * 100} cm 处的物体，晶状体要比看远处时多增加多少 D 的屈光力？`, 1 / u, "D", 1, "需要增加的屈光力 = 1 / 物距（m）。"),
    numQ(rng, "near", [m3], `模型：眼的调节能力为 ${AMP} D。近视 ${m3} D 的人，近点（能看清的最近距离）是多少厘米？`, 100 / (AMP + m3), "cm", 0, "近点 = 1 / (调节能力 + 近视度数)（m）。"),
    makeQ(rng, "front", [], "近视眼看远处的物体时，物像落在视网膜的：", "前方", ["后方", "正上方", "正中央"], "眼球前后径过长或晶状体曲度过大。"),
  ];
}
