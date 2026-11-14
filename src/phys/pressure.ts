import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-pressure";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.pressure;
export const def: SimDef = {
  meta,
  lesson: [
    "压强表示压力的作用效果：p = F / S。压力一定时，受力面积越小，压强越大（针尖、刀刃）；受力面积一定时，压力越大，压强越大。单位：帕斯卡（Pa），1 Pa = 1 N/m²。",
    "液体内部向各个方向都有压强，同一深度各个方向的压强相等；深度越大，压强越大；深度相同时，液体密度越大，压强越大：p = ρgh。本实验室取 g = 10 N/kg。",
    "大气也有压强。托里拆利实验测出标准大气压约等于 760 mm 高水银柱产生的压强（约 1.013×10⁵ Pa；这个数值按 g = 9.8 N/kg 计算，不取 10 N/kg）。管子倾斜，水银柱的竖直高度不变；海拔越高，大气压越小。",
  ],
  formulas: ["p=\\dfrac{F}{S}", "p=\\rho g h", "p_0=\\rho_{\\text{Hg}}gh"],
  params: [
    { id: "h", label: "探头所在的深度", min: 0, max: 40, step: 1, value: 10, unit: "cm", when: (s) => s.mode === 0 },
    { id: "alt", label: "海拔高度", min: 0, max: 8000, step: 500, value: 0, unit: "m", when: (s) => s.mode === 1 },
    { id: "tilt", label: "玻璃管倾斜的角度", min: 0, max: 60, step: 10, value: 0, unit: "°", when: (s) => s.mode === 1 },
    { id: "F", label: "压力", min: 10, max: 500, step: 10, value: 100, unit: "N", when: (s) => s.mode === 2 },
    { id: "S", label: "受力面积", min: 1, max: 100, step: 1, value: 50, unit: "cm²", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "液体压强"], [1, "大气压"], [2, "固体压强"]] },
    { id: "liq", label: "液体", value: 0, options: Mo.LIQUIDS.map(([i, n]) => [i, n] as [number, string]), when: (s) => s.mode === 0 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const p = Mo.liquidP(Mo.rhoOf(s.liq), s.h / 100); return [
      { label: "液体密度", value: fmt(Mo.rhoOf(s.liq), 0), unit: "kg/m³" }, { label: "深度", value: fmt(s.h, 0), unit: "cm" },
      { label: "液体压强", value: fmt(p, 0), unit: "Pa" }, { label: "加上大气压后的总压强", value: fmt((p + Mo.P0) / 1000, 1), unit: "kPa" }]; }
    if (s.mode === 1) { const p = Mo.atmAt(s.alt), H = Mo.mercuryMm(p); return [
      { label: "大气压", value: fmt(p / 1000, 1), unit: "kPa" }, { label: "水银柱的竖直高度", value: fmt(H, 0), unit: "mm" },
      { label: "玻璃管内水银柱的长度", value: fmt(H / Math.cos(rad(s.tilt)), 0), unit: "mm" }, { label: "管顶", value: "真空" }]; }
    const p = Mo.solidP(s.F, s.S);
    return [{ label: "压力", value: fmt(s.F, 0), unit: "N" }, { label: "受力面积", value: fmt(s.S, 0), unit: "cm²" }, { label: "压强", value: fmt(p, 0), unit: "Pa" }, { label: "压强", value: fmt(p / 1000, 1), unit: "kPa" }];
  },
  draw(c, w, hh, s) {
    if (s.mode === 0) {
      const rho = Mo.rhoOf(s.liq), p = Mo.liquidP(rho, s.h / 100);
      const col = ["#a5d8ff", "#99e9f2", "#ffe8cc", "#ced4da"][s.liq];
      rect(c, 300, 40, 300, 320, col, COL.ink, 4, 10); rect(c, 304, 36, 292, 6, "#fff", null, 0, 0);
      const py = 60 + s.h * 6, px = 450;
      line(c, px, 40, px, py - 14, COL.ink, 5); circle(c, px, py, 14, "#ffd8a8");
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) arrow(c, px + dx * 20, py + dy * 20, px + dx * (20 + Math.min(80, p / 70)), py + dy * (20 + Math.min(80, p / 70)), COL.red, 4);
      line(c, 604, 60, 604, py, COL.grey, 2); txt(c, "h", 618, (60 + py) / 2, 20, COL.grey);
      // U-shaped gauge filled with water
      const dh = (p / (1000 * Mo.g)) * 100;   // cm of water
      const d = Math.min(150, dh * 6);
      c.beginPath(); c.moveTo(60, 60); c.lineTo(60, 280); c.quadraticCurveTo(60, 320, 100, 320); c.lineTo(160, 320); c.quadraticCurveTo(200, 320, 200, 280); c.lineTo(200, 60); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
      const yl = 190 + d / 2, yr = 190 - d / 2;
      rect(c, 64, yl, 32, 300 - yl, "#74c0fc", null, 0, 0); rect(c, 164, yr, 32, 300 - yr, "#74c0fc", null, 0, 0); rect(c, 64, 300, 132, 16, "#74c0fc", null, 0, 8);
      line(c, 50, 190 + d / 2, 210, 190 + d / 2, COL.grey, 1.5, [4, 4]); line(c, 50, 190 - d / 2, 210, 190 - d / 2, COL.grey, 1.5, [4, 4]);
      txt(c, `Δh = ${fmt(dh, 1)} cm`, 130, 360, 20, COL.ink);
      c.beginPath(); c.moveTo(px, py + 14); c.lineTo(140, 330); c.strokeStyle = COL.grey; c.lineWidth = 2; c.setLineDash([3, 6]); c.stroke(); c.setLineDash([]);
      return;
    }
    if (s.mode === 1) {
      const p = Mo.atmAt(s.alt), H = Mo.mercuryMm(p), L = (H / 760) * 220;
      rect(c, 330, 330, 260, 40, "#ced4da", COL.ink, 4, 10); rect(c, 330, 330, 260, 16, "#868e96", null, 0, 8);
      c.save(); c.translate(460, 340); c.rotate(rad(s.tilt));
      const tubeL = 300 / Math.cos(rad(s.tilt)) * 0 + 280;
      rect(c, -16, -tubeL, 32, tubeL + 30, "rgba(255,255,255,0.7)", COL.ink, 3, 14);
      const col = L / Math.cos(rad(s.tilt));
      rect(c, -12, -col, 24, col + 26, "#868e96", null, 0, 8);
      txt(c, "0", 0, -tubeL + 20, 18, COL.grey);
      c.restore();
      line(c, 540, 340, 540, 340 - L, COL.red, 3); line(c, 530, 340 - L, 550, 340 - L, COL.red, 3); txt(c, "H", 568, 340 - L / 2, 20, COL.red, "left");
      // altitude: a mountain
      c.beginPath(); c.moveTo(20, 370); c.lineTo(130, 370 - 30 - (s.alt / 8000) * 260); c.lineTo(240, 370); c.closePath(); c.fillStyle = "#b2f2bb"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 3; c.stroke();
      txt(c, `${fmt(s.alt, 0)} m`, 130, 394, 18, COL.grey);
      return;
    }
    const p = Mo.solidP(s.F, s.S), bw = 40 + Math.sqrt(s.S) * 14, dent = Math.min(60, p / 2500);
    rect(c, 80, 250, 480, 120, "#ffe8cc", COL.ink, 4, 10);
    c.beginPath(); c.moveTo(320 - bw / 2 - 20, 250); c.lineTo(320 - bw / 2, 250 + dent); c.lineTo(320 + bw / 2, 250 + dent); c.lineTo(320 + bw / 2 + 20, 250); c.fillStyle = "#fff"; c.fill();
    rect(c, 320 - bw / 2, 250 + dent - 90, bw, 90, "#9775fa", COL.ink, 4, 8); txt(c, "S", 320, 250 + dent - 45, 24, "#fff");
    arrow(c, 320, 60, 320, 250 + dent - 94, COL.red, 6 + s.F / 100); txt(c, "F", 346, 110, 24, COL.red, "left");
  },
  tasks: [
    { id: "water1", text: "清水中（液体选“清水”）：使探头所在的深度为 20 cm，读出液体压强约 2000 Pa", check: (s) => s.mode === 0 && s.liq === 0 && s.h === 20 },
    { id: "mercury", text: "托里拆利实验：海拔 0 m 时，把玻璃管倾斜 30°，观察水银柱的竖直高度不变（760 mm 左右）", check: (s) => s.mode === 1 && s.alt === 0 && s.tilt === 30 },
    { id: "nail", text: "固体压强：压力 100 N，使受力面积减小到 5 cm²，压强变为 200 kPa", check: (s) => s.mode === 2 && s.F === 100 && s.S === 5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
