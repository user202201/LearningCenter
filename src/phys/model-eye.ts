/** 眼睛与眼镜、显微镜与望远镜 (pure): a thin-lens model of the eye with accommodation, the glasses that correct it, the compound microscope and the Kepler telescope. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const RETINA = 1 / 0.024;      // D: the lens power that focuses a parallel beam on the retina of a normal eye (retina 24 mm behind the lens)
export const AMAX = 4;                // D: how much more power the ciliary muscle can add (accommodation, a young eye)
/** relaxed power of the eye lens: normal, myopic (too strong: the eye ball is too long for it), hyperopic (too weak) */
export const RELAXED = [RETINA, 44, 39];
export interface EyeView { need: number; clear: boolean; where: "before" | "on" | "behind"; image: number }
/** object at u metres (Infinity = very far), glasses of power P dioptres: the accommodation the eye would need, and whether it can see sharply */
export function view(vision: number, u: number, P: number): EyeView {
  const inv = u === Infinity ? 0 : 1 / u;
  const need = RETINA - P + inv - RELAXED[vision];
  const clear = need >= -1e-9 && need <= AMAX + 1e-9;
  const used = Math.min(AMAX, Math.max(0, need));
  const V2 = P - inv + RELAXED[vision] + used;      // vergence leaving the eye lens
  return { need, clear, where: clear ? "on" : need < 0 ? "before" : "behind", image: V2 > 1e-6 ? 1 / V2 : Infinity };
}
/** the nearest / farthest distance (m) the naked or corrected eye sees clearly (far = Infinity when parallel light is focused) */
export function range(vision: number, P: number): { near: number; far: number } {
  // need(u) = RETINA - P + 1/u - RELAXED in [0, AMAX]  ->  1/u in [RELAXED + P - RETINA, RELAXED + P - RETINA + AMAX]
  const lo = RELAXED[vision] + P - RETINA, hi = lo + AMAX;
  return { near: hi > 1e-9 ? 1 / hi : Infinity, far: lo > 1e-9 ? 1 / lo : Infinity };
}
/** the glasses (dioptres) that bring the far point of a myopic eye (metres) to infinity: P = -1 / far */
export const myopiaGlass = (far: number) => -1 / far;
export const OBJECTIVES = [4, 10, 40], EYEPIECES = [5, 10, 16];
export const microMag = (obj: number, eye: number) => obj * eye;
/** diameter of the field of view in mm (field number 18 mm / objective power) and how many 0.1 mm cells fit across it */
export const fieldMm = (obj: number) => 18 / obj;
export const cellsAcross = (obj: number) => fieldMm(obj) / 0.1;
export const teleMag = (fo: number, fe: number) => fo / fe;
export const teleLen = (fo: number, fe: number) => fo + fe;
export function quiz(rng: () => number): Q[] {
  const far = pick(rng, [0.4, 0.5, 0.8, 1, 0.25]);
  const [ob, ey] = [pick(rng, OBJECTIVES), pick(rng, EYEPIECES)];
  const [fo, fe] = pick(rng, [[60, 4], [80, 5], [100, 5], [90, 3], [120, 6]]);
  return [
    numQ(rng, "glass_power", [far * 100], `一位近视的同学，最远只能看清 ${far * 100} cm 处的物体。他应该配戴焦度为多少的眼镜（单位 D，1 D = 100 度）？`, myopiaGlass(far), "D", 2, "凹透镜使远处物体成像在近视眼的远点：P = −1 / 远点距离（米）。"),
    numQ(rng, "micro_mag", [ob, ey], `显微镜的物镜是 ${ob}×，目镜是 ${ey}×，总放大倍数是多少？`, microMag(ob, ey), "×", 0, "总放大倍数 = 物镜放大倍数 × 目镜放大倍数。"),
    numQ(rng, "tele_mag", [fo, fe], `开普勒望远镜的物镜焦距 ${fo} cm，目镜焦距 ${fe} cm，它的角放大率约是多少？`, teleMag(fo, fe), "×", 1, "M = f物 / f目。"),
    numQ(rng, "tele_len", [fo, fe], `开普勒望远镜的物镜焦距 ${fo} cm，目镜焦距 ${fe} cm，调好焦后镜筒的长度约是多少？`, teleLen(fo, fe), "cm", 0, "两个凸透镜的焦点重合，筒长 ≈ f物 + f目。"),
    makeQ(rng, "myopia", [], "近视眼的成像情况和矫正方法是：", "像成在视网膜前，配戴凹透镜", ["像成在视网膜后，配戴凸透镜", "像成在视网膜前，配戴凸透镜", "像成在视网膜后，配戴凹透镜"], "近视眼的晶状体太凸（或眼球太长），像落在视网膜前面；凹透镜使光线发散，把像推后到视网膜上。"),
  ];
}
