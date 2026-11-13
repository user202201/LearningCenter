import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-microscope";
import { COL, lab, txt, rect, circle, line, ghost } from "./draw";
export const meta = CATALOG.microscope;
const CX = 478, CY = 206, R = 150, STAGE_Y = 340;
function specimen(c: CanvasRenderingContext2D, s: Record<string, number>, k: number, ox: number) {   // k = drawing units per mm of the specimen
  c.save(); c.translate(CX + ox, CY); c.rotate(Math.PI);   // the image is turned by 180 degrees
  if (s.spec === 0) { txt(c, "p", 0, 0, 0.9 * k * 1.25, COL.ink, "center", 900); }
  else {
    const cw = 0.12 * k, ch = Mo.CELL * k;
    for (let r = -14; r <= 14; r++) for (let q = -14; q <= 14; q++) {
      const x = q * cw + (Math.abs(r) % 2) * cw * 0.5, y = r * ch;
      if (Math.abs(x) > R * 1.6 || Math.abs(y) > R * 1.6) continue;
      rect(c, x - cw / 2, y - ch / 2, cw, ch, "#fff1f5", "#b8869a", Math.max(1, k * 0.004), 2);
      circle(c, x - cw * 0.12, y, Math.max(1, ch * 0.2), "#cc5de8", null);
    }
  }
  c.restore();
}
export const def: SimDef = {
  meta,
  lesson: [
    "显微镜的总放大倍数 = 目镜倍数 × 物镜倍数。放大倍数越大，看到的视野越小、细胞越大、数量越少，视野也越暗。",
    "转动粗准焦螺旋使镜筒下降（眼睛看着物镜，避免压坏玻片），再向上慢慢调节，直到物像清晰；高倍镜下只用细准焦螺旋。显微镜成倒立的像：玻片向左移动，物像向右移动；物像偏哪里，就向哪里移动玻片。",
  ],
  formulas: ["M = M_{\\text{目镜}} \\times M_{\\text{物镜}}"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "d", label: "物镜到玻片的距离", min: 0, max: 40, step: 0.5, value: 6, unit: "mm" },
    { id: "sx", label: "向右移动玻片", min: -1, max: 1, step: 0.05, value: 0, unit: "mm", dec: 2 },
  ],
  choices: [
    { id: "eye", label: "目镜", value: 10, options: Mo.EYE.map((v) => [v, `${v}×`]) },
    { id: "obj", label: "物镜", value: 10, options: Mo.OBJ.map((v) => [v, `${v}×`]) },
    { id: "spec", label: "玻片标本", value: 0, options: [[0, "字母 p"], [1, "洋葱表皮"]] },
  ],
  aspect: 0.66,
  readouts: (s) => { const m = Mo.mag(s.eye, s.obj); return [
    { label: "总放大倍数", value: String(m), unit: "×" },
    { label: "视野直径", value: fmt(Mo.fov(m), 2), unit: "mm" },
    { label: "视野中一行的细胞数", value: fmt(Mo.cellsAcross(m), 0), unit: "个" },
    { label: "清晰度", value: fmt(Mo.sharp(s.d, s.obj) * 100, 0), unit: "%" }]; },
  draw(c, w, h, s) {
    const m = Mo.mag(s.eye, s.obj), sh = Mo.sharp(s.d, s.obj);
    rect(c, 40, 346, 220, 18, "#adb5bd"); rect(c, 215, 50, 26, 296, "#ced4da");
    rect(c, 82, 60, 22, 70, "#495057", COL.ink, 3, 4); lab(c, "目镜", 93, 44, 17);
    rect(c, 76, 130, 34, 44, "#868e96");
    rect(c, 70, 174, 46, 14, "#adb5bd");
    const tip = STAGE_Y - s.d * 4.5 - 4;
    rect(c, 87, 188, 12, Math.max(6, tip - 188), "#495057", COL.ink, 3, 3); lab(c, "物镜", 134, 214, 17);
    rect(c, 40, STAGE_Y, 170, 8, "#868e96", COL.ink, 3, 2);
    rect(c, 62, STAGE_Y - 8, 70, 8, "#e7f5ff", "#74c0fc", 2, 1); txt(c, "p", 97, STAGE_Y - 22, 22, COL.ink);
    line(c, 150, STAGE_Y - 6, 150, tip, COL.orange, 3, [5, 5]); txt(c, `${fmt(s.d, 1)}`, 168, (STAGE_Y + tip) / 2, 16, COL.orange, "left");
    c.save(); c.beginPath(); c.arc(CX, CY, R, 0, Math.PI * 2); c.clip();
    c.fillStyle = "#fffdf5"; c.fillRect(CX - R, CY - R, 2 * R, 2 * R);
    const k = R / (Mo.fov(m) / 2);
    ghost(c, (1 - sh) * 9, () => specimen(c, s, k, -s.sx * k));
    c.restore();
    circle(c, CX, CY, R, "", COL.ink, 7);
    txt(c, `${m}x`, CX, CY + R + 22, 20, COL.grey);
  },
  tasks: [
    { id: "x400", text: "把总放大倍数调到 400×，并调到图像清晰（清晰度 90% 以上）", check: (s) => Mo.mag(s.eye, s.obj) === 400 && Mo.sharp(s.d, s.obj) >= 0.9 },
    { id: "low", text: "用低倍镜（总放大倍数不超过 50×）看清洋葱表皮细胞", check: (s) => s.spec === 1 && Mo.mag(s.eye, s.obj) <= 50 && Mo.sharp(s.d, s.obj) >= 0.9 },
    { id: "invert", text: "把玻片向左移动 0.5 mm 以上，并保持图像清晰，观察物像向右移动", check: (s) => s.sx <= -0.5 && Mo.sharp(s.d, s.obj) >= 0.8 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
