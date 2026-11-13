import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-eye";
import { COL, lab, txt, circle, ell, line, rect } from "./draw";
export const meta = CATALOG.eye;
const LENS_X = 300, K = 8820;   // drawing units: the image is K / (power - vergence) behind the lens
export const def: SimDef = {
  meta,
  lesson: [
    "眼球的晶状体相当于凸透镜，把物体的像成在视网膜上。看远处时睫状肌舒张，晶状体变薄；看近处时睫状肌收缩，晶状体变厚，屈光力增大。调节有一定的范围，所以有远点和近点。",
    "近视眼的眼球前后径过长，或晶状体曲度过大，远处物体的像落在视网膜前方，看不清远处；应配戴凹透镜矫正。成像规律与物理实验室的凸透镜相同：1/u + 1/v = 1/f（屈光力 = 1/f）。",
  ],
  formulas: ["\\dfrac{1}{u}+\\dfrac{1}{v}=\\dfrac{1}{f}"],
  links: [{ text: "相关：物理实验室·凸透镜成像", href: "#/science/physics/lens" }, { text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "u", label: "物体的距离", min: 0.1, max: 6, step: 0.1, value: 1, unit: "m" },
    { id: "myopia", label: "近视程度", min: 0, max: 6, step: 0.25, value: 0, unit: "D", dec: 2 },
    { id: "glass", label: "眼镜的焦度（凹透镜为负）", min: -6, max: 3, step: 0.25, value: 0, unit: "D", dec: 2 },
  ],
  aspect: 0.6,
  readouts: (s) => [
    { label: "成像清晰度", value: fmt(Mo.sharpness(s.u, s.glass, s.myopia) * 100, 0), unit: "%" },
    { label: "晶状体的屈光力", value: fmt(Mo.used(s.u, s.glass, s.myopia), 1), unit: "D" },
    { label: "裸眼看清的范围", value: `${fmt(Mo.nearPoint(s.myopia) * 100, 0)} cm – ${Mo.farPoint(s.myopia) === Infinity ? "∞" : fmt(Mo.farPoint(s.myopia) * 100, 0) + " cm"}` },
    { label: "像的位置", value: ["落在视网膜前方", "落在视网膜上", "落在视网膜后方"][Mo.imageSide(s.u, s.glass, s.myopia) + 1] }],
  draw(c, w, h, s) {
    const cy = 190, ret = LENS_X + K / (Mo.PMIN - s.myopia), P = Mo.used(s.u, s.glass, s.myopia), vg = Mo.vergence(s.u, s.glass);
    const img = P - vg > 0.5 ? LENS_X + K / (P - vg) : LENS_X + 9999;
    ell(c, (LENS_X + ret) / 2 - 10, cy, (ret - LENS_X) / 2 + 60, 100, "#f8f9fa", COL.ink, 4);
    line(c, ret, cy - 90, ret, cy + 90, COL.red, 6); lab(c, "视网膜", ret, cy + 114, 17, COL.red);
    const th = 30 - (P - Mo.PMIN) * 1.4; ell(c, LENS_X, cy, Math.max(7, 16 + (P - Mo.PMIN) * 1.2), 60, "rgba(116,192,252,0.55)", COL.ink, 4); lab(c, "晶状体", LENS_X, cy - 82, 17); void th;
    if (s.glass !== 0) { const gx = 190; c.beginPath(); if (s.glass < 0) { c.moveTo(gx - 10, cy - 55); c.quadraticCurveTo(gx + 6, cy, gx - 10, cy + 55); c.moveTo(gx + 10, cy - 55); c.quadraticCurveTo(gx - 6, cy, gx + 10, cy + 55); } else { c.moveTo(gx, cy - 55); c.quadraticCurveTo(gx - 20, cy, gx, cy + 55); c.quadraticCurveTo(gx + 20, cy, gx, cy - 55); } c.strokeStyle = COL.green; c.lineWidth = 5; c.stroke(); lab(c, s.glass < 0 ? "凹透镜" : "凸透镜", gx, cy - 78, 16, COL.green); }
    // three rays from a point on the axis: they enter the lens at -30, 0, +30 and meet at the image point
    const spread = Math.min(26, Math.max(2, 9 / s.u)), ix = Math.min(img, 640);
    for (const y0 of [-30, 0, 30]) { line(c, 20, cy - (y0 * spread) / 30 * 0 - 0, LENS_X, cy + y0, "#f08c00", 2.5); if (img < 2000) line(c, LENS_X, cy + y0, ix, cy, "#f08c00", 2.5); }
    circle(c, 20, cy, 9, COL.green, COL.ink, 3); lab(c, `${fmt(s.u, 1)} m`, 20, cy - 24, 16, COL.green, "left");
    if (img < 2000) circle(c, ix, cy, 6, COL.red, COL.ink, 2);
    rect(c, 8, 340, 624, 0.1, "", null, 0, 0); txt(c, "", 0, 0, 1, "#fff");
  },
  tasks: [
    { id: "far", text: "正常眼（近视 0 D）看 5 m 以外的物体：成像清晰（清晰度 95% 以上）", check: (s) => s.myopia === 0 && s.u >= 5 && s.glass === 0 && Mo.sharpness(s.u, s.glass, s.myopia) >= 0.95 },
    { id: "blur", text: "近视 2.5 D 以上，不戴眼镜看 5 m 以外的物体：看不清（清晰度低于 60%）", check: (s) => s.myopia >= 2.5 && s.u >= 5 && s.glass === 0 && Mo.sharpness(s.u, s.glass, s.myopia) < 0.6 },
    { id: "fix", text: "近视 2 D 以上，用凹透镜矫正，看 5 m 以外的物体：成像清晰", check: (s) => s.myopia >= 2 && s.u >= 5 && s.glass < 0 && Mo.sharpness(s.u, s.glass, s.myopia) >= 0.95 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
