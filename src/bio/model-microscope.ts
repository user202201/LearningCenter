/** 显微镜 (pure): magnification, field of view, focus and the inverted image. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const EYE = [5, 10, 16], OBJ = [4, 10, 40];
export const FIELD = 180;           // the field of view in mm is FIELD / (total magnification)
export const CELL = 0.05;           // the width of one cell of the onion skin in mm
export const mag = (eye: number, obj: number) => eye * obj;
export const fov = (m: number) => FIELD / m;
export const cellsAcross = (m: number) => fov(m) / CELL;
export const workDist = (obj: number) => (obj === 4 ? 28 : obj === 10 ? 16 : 4);   // mm between the objective and the slide when the image is sharpest
const tol = (obj: number) => (obj === 4 ? 6 : obj === 10 ? 3 : 1);
/** 0..1: how sharp the image is when the objective is `d` mm from the slide */
export const sharp = (d: number, obj: number) => Math.max(0, 1 - ((d - workDist(obj)) / tol(obj)) ** 2);
export const ROT: Record<string, string> = { p: "d", b: "q", d: "p", q: "b", n: "u", u: "n" };
const DIRS = ["左", "右", "上", "下"];
export function quiz(rng: () => number): Q[] {
  const eye = pick(rng, EYE), obj = pick(rng, OBJ);
  const M = pick(rng, [40, 50, 100, 160, 400, 640]);
  const m1 = pick(rng, [40, 100]), ratio = pick(rng, [2, 4, 5, 10]), n = ratio * pick(rng, [2, 3, 4, 5]);
  const letter = pick(rng, Object.keys(ROT)), di = Math.floor(rng() * 4);
  const dirQ = DIRS[di];
  return [
    numQ(rng, "mag", [eye, obj], `目镜是 ${eye}×，物镜是 ${obj}×，显微镜的总放大倍数是多少？`, eye * obj, "倍", 0, "总放大倍数 = 目镜倍数 × 物镜倍数。"),
    numQ(rng, "fov", [M], `某显微镜的视野直径与总放大倍数成反比。放大 100 倍时视野直径为 1.8 mm，放大 ${M} 倍时视野直径是多少？`, FIELD / M, "mm", 2, "放大倍数越大，视野越小。"),
    numQ(rng, "cells", [n, m1, m1 * ratio], `在 ${m1}× 的总放大倍数下，视野中一行有 ${n} 个细胞。换成 ${m1 * ratio}× 后，这一行大约有几个细胞？`, n / ratio, "个", 0, `视野直径缩小为原来的 1/${ratio}。`),
    makeQ(rng, "rot", [Object.keys(ROT).indexOf(letter)], `载玻片上写着字母“${letter}”，在显微镜视野中看到的物像是：`, ROT[letter], shuffle(rng, ["p", "b", "d", "q", "n", "u"]).filter((x) => x !== ROT[letter]), "显微镜成倒立的像：上下、左右都相反（旋转 180°）。"),
    makeQ(rng, "move", [di], `物像在视野的${dirQ}方，要把它移到视野中央，应把玻片向哪个方向移动？`, dirQ, DIRS.filter((x) => x !== dirQ), "物像偏哪个方向，就把玻片向哪个方向移动。"),
  ];
}
