import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-eye";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.eye;
const dist = (m: number) => (m === Infinity ? "∞" : fmt(m * 100, 0));
const U = (s: Record<string, number>) => (s.far ? Infinity : s.u / 100);
export const def: SimDef = {
  meta,
  lesson: [
    "眼睛的晶状体相当于一个凸透镜，视网膜相当于光屏，物体在视网膜上成倒立、缩小的实像。睫状肌改变晶状体的凸起程度（调节），使远近不同的物体都能在视网膜上成清晰的像。看清物体的最近距离叫近点，最远距离叫远点（正常眼的近点约 10 到 25 cm，远点在无穷远）。",
    "近视眼：晶状体太凸（或眼球太长），像成在视网膜前，远点变近，要配戴凹透镜（发散）矫正；远视眼：晶状体太薄（或眼球太短），像成在视网膜后，近点变远，要配戴凸透镜（会聚）矫正。眼镜的焦度 P = 1 / f（单位 D），100 度 = 1 D，凹透镜为负。",
    "显微镜由物镜和目镜两个凸透镜组成：物镜成放大的实像，目镜相当于放大镜，把这个像再放大成虚像，总放大倍数 = 物镜倍数 × 目镜倍数，倍数越大，视野越小。望远镜的物镜焦距长、目镜焦距短，角放大率 M = f物 / f目，镜筒长度约等于两个焦距之和。",
  ],
  formulas: ["P=\\dfrac{1}{f}", "M_{\\text{显微镜}}=M_{\\text{物}}\\times M_{\\text{目}}", "M_{\\text{望远镜}}=\\dfrac{f_{\\text{物}}}{f_{\\text{目}}}"],
  params: [
    { id: "u", label: "物体到眼睛的距离", min: 10, max: 600, step: 5, value: 100, unit: "cm", when: (s) => s.mode === 0 && !s.far },
    { id: "P", label: "眼镜的焦度（凹透镜为负）", min: -6, max: 4, step: 0.5, value: 0, unit: "D", when: (s) => s.mode === 0 },
    { id: "fo", label: "物镜的焦距", min: 20, max: 120, step: 10, value: 40, unit: "cm", when: (s) => s.mode === 2 },
    { id: "fe", label: "目镜的焦距", min: 2, max: 10, step: 1, value: 5, unit: "cm", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "眼睛与眼镜"], [1, "显微镜"], [2, "望远镜"]] },
    { id: "vision", label: "视力", value: 0, options: [[0, "正常"], [1, "近视"], [2, "远视"]], when: (s) => s.mode === 0 },
    { id: "far", label: "看哪里", value: 0, options: [[0, "指定距离"], [1, "极远处"]], when: (s) => s.mode === 0 },
    { id: "ob", label: "物镜", value: 1, options: Mo.OBJECTIVES.map((v, i) => [i, `${v}×`] as [number, string]), when: (s) => s.mode === 1 },
    { id: "ey", label: "目镜", value: 1, options: Mo.EYEPIECES.map((v, i) => [i, `${v}×`] as [number, string]), when: (s) => s.mode === 1 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) {
      const v = Mo.view(s.vision, U(s), s.P), r = Mo.range(s.vision, s.P);
      return [
        { label: "晶状体需要增加的焦度", value: fmt(v.need, 2), unit: "D" }, { label: "像的位置", value: v.where === "on" ? "在视网膜上" : v.where === "before" ? "在视网膜前" : "在视网膜后" },
        { label: "能看清吗", value: v.clear ? "能看清" : "看不清" }, { label: "近点", value: dist(r.near), unit: r.near === Infinity ? "" : "cm" }, { label: "远点", value: dist(r.far), unit: r.far === Infinity ? "" : "cm" },
        { label: "眼镜", value: s.P === 0 ? "没有" : s.P < 0 ? "凹透镜" : "凸透镜" },
      ];
    }
    if (s.mode === 1) { const m = Mo.microMag(Mo.OBJECTIVES[s.ob], Mo.EYEPIECES[s.ey]); return [{ label: "总放大倍数", value: fmt(m, 0), unit: "×" }, { label: "视野的直径", value: fmt(Mo.fieldMm(Mo.OBJECTIVES[s.ob]), 2), unit: "mm" }, { label: "视野里排得下的细胞数", value: fmt(Mo.cellsAcross(Mo.OBJECTIVES[s.ob]), 0) }]; }
    return [{ label: "角放大率", value: fmt(Mo.teleMag(s.fo, s.fe), 1), unit: "×" }, { label: "镜筒的长度", value: fmt(Mo.teleLen(s.fo, s.fe), 0), unit: "cm" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const v = Mo.view(s.vision, U(s), s.P);
      c.beginPath(); c.ellipse(380, 200, 150, 100, 0, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
      line(c, 400, 100, 400, 300, COL.red, 6); txt(c, "retina", 470, 322, 16, COL.red);   // the retina (a vertical line)
      c.beginPath(); c.ellipse(300, 200, 12 + Math.min(Mo.AMAX, Math.max(0, v.need)) * 1.5 + (s.vision === 1 ? 4 : s.vision === 2 ? -3 : 0), 62, 0, 0, Math.PI * 2); c.fillStyle = "#c5f6fa"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
      const fx = Math.min(590, Math.max(330, 400 + ((v.image === Infinity ? 5 : v.image / 0.024) - 1) * 600)), g = s.P !== 0;   // (the distance of the image from the retina is exaggerated so that it can be seen)
      if (g) { rect(c, 225, 130, 10, 140, s.P < 0 ? "#a5d8ff" : "#b2f2bb", COL.ink, 3, 5); txt(c, s.P < 0 ? "-" : "+", 230, 290, 22, COL.ink); }
      for (const dy of [-40, 0, 40]) { line(c, 90, 200 + dy * 1.2, 300, 200 + dy, COL.orange, 3); line(c, 300, 200 + dy, fx, 200, COL.orange, 3); }
      circle(c, fx, 200, 7, v.clear ? COL.green : COL.red);
      arrow(c, 40, 260, 40, 140, COL.blue, 5); txt(c, s.far ? "far" : `${s.u} cm`, 60, 285, 18, COL.grey);
      return;
    }
    if (s.mode === 1) {
      const m = Mo.microMag(Mo.OBJECTIVES[s.ob], Mo.EYEPIECES[s.ey]), r = 150, cx = 200, cy = 200;
      circle(c, cx, cy, r, "#fff", COL.ink, 5);
      const cr = Math.min(40, Math.max(4, r / Mo.cellsAcross(Mo.OBJECTIVES[s.ob])));
      for (let i = 0; i < 40; i++) { const a = i * 2.4, rr = Math.sqrt(i / 40) * (r - 24); circle(c, cx + rr * Math.cos(a), cy + rr * Math.sin(a), cr, i % 3 ? "#d3f9d8" : "#ffd8a8", "#2b8a3e", 2); }
      rect(c, 420, 70, 40, 90, "#adb5bd", COL.ink, 4, 8); rect(c, 420, 170, 40, 90, "#ced4da", COL.ink, 4, 8); rect(c, 400, 280, 80, 18, "#868e96", COL.ink, 4, 6);
      txt(c, `${m}x`, 540, 160, 38, COL.purple);
      return;
    }
    const L = Mo.teleLen(s.fo, s.fe), k = 520 / 130, x0 = 40;
    const xo = x0 + 30, xe = xo + L * k * 0.95;
    rect(c, xo, 140, xe - xo, 120, "#e9ecef", COL.ink, 3, 6);
    for (const [x, hgt, col] of [[xo, 56, "#c5f6fa"], [xe, 26, "#ffe8cc"]] as [number, number, string][]) { c.beginPath(); c.ellipse(x, 200, 10, hgt, 0, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke(); }
    const xf = xo + s.fo * k * 0.95;
    for (const dy of [-30, 0, 30]) { line(c, 10, 200 + dy * 0.7, xo, 200 + dy * 0.7, COL.orange, 3); line(c, xo, 200 + dy * 0.7, xf, 200, COL.orange, 3); line(c, xf, 200, xe, 200 + dy * 0.3, COL.orange, 3); line(c, xe, 200 + dy * 0.3, 620, 200 + dy * 0.3 * 1.6 + 0, COL.orange, 3); }
    circle(c, xf, 200, 6, COL.red); txt(c, "F", xf, 232, 16, COL.red);
    txt(c, `M = ${fmt(Mo.teleMag(s.fo, s.fe), 1)}`, 320, 340, 28, COL.purple);
  },
  tasks: [
    { id: "myopia", text: "近视眼：用凹透镜（负焦度）使极远处的物体看得清", check: (s) => s.mode === 0 && s.vision === 1 && s.far === 1 && s.P < 0 && Mo.view(1, Infinity, s.P).clear },
    { id: "hyper", text: "远视眼：配戴凸透镜，使 25 cm 处的书本看得清", check: (s) => s.mode === 0 && s.vision === 2 && !s.far && s.u === 25 && s.P > 0 && Mo.view(2, 0.25, s.P).clear },
    { id: "micro", text: "显微镜：使总放大倍数达到 400 倍以上", check: (s) => s.mode === 1 && Mo.microMag(Mo.OBJECTIVES[s.ob], Mo.EYEPIECES[s.ey]) >= 400 },
    { id: "tele", text: "望远镜：使角放大率至少为 20 倍，且镜筒不长于 90 cm", check: (s) => s.mode === 2 && Mo.teleMag(s.fo, s.fe) >= 20 && Mo.teleLen(s.fo, s.fe) <= 90 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
