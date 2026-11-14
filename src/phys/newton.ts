import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-newton";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.newton;
const SURF_COL = ["#f06595", "#e599f7", "#d9a066", "#a5d8ff", "#f8f9fa"];
export const def: SimDef = {
  meta,
  lesson: [
    "斜面实验：让同一辆小车从斜面同一高度滑下，到达水平面时速度相同。水平面越光滑，小车受到的阻力越小，速度减小得越慢，滑行得越远。推理：如果水平面绝对光滑，小车将一直做匀速直线运动。本实验室取 g = 10 N/kg。",
    "牛顿第一定律：一切物体在没有受到力的作用时，总保持静止状态或匀速直线运动状态。物体保持原来运动状态不变的性质叫惯性。",
    "二力平衡的条件：作用在同一个物体上的两个力，大小相等、方向相反，并且在同一条直线上。物体受平衡力时，保持静止或匀速直线运动状态。",
  ],
  formulas: ["F_1=F_2", "s=\\dfrac{v^2}{2\\mu g}"],
  params: [
    { id: "v0", label: "到达水平面时的速度", min: 1, max: 3, step: 0.5, value: 1.5, unit: "m/s", when: (s) => s.mode === 0 },
    { id: "t", label: "时间", min: 0, max: 10, step: 0.1, value: 0.5, unit: "s", when: (s) => s.mode === 0 },
    { id: "F1", label: "向右的力 F₁", min: 0, max: 10, step: 1, value: 5, unit: "N", when: (s) => s.mode === 1 },
    { id: "F2", label: "另一个力 F₂", min: 0, max: 10, step: 1, value: 3, unit: "N", when: (s) => s.mode === 1 },
    { id: "off", label: "两个力的作用线相距", min: 0, max: 3, step: 1, value: 0, unit: "cm", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "阻力对运动的影响"], [1, "二力平衡"]] },
    { id: "surf", label: "水平面", value: 2, options: Mo.SURFACES.map(([i, n]) => [i, n] as [number, string]), when: (s) => s.mode === 0 },
    { id: "dir", label: "F₂ 的方向", value: 180, options: Mo.DIRS, when: (s) => s.mode === 1 },
  ],
  play: { param: "t", rate: 1 },
  aspect: 0.55,
  readouts: (s) => {
    if (s.mode === 1) { const r = Mo.twoForces(s.F1, s.F2, s.dir, s.off); return [
      { label: "合力", value: fmt(r.mag, 1), unit: "N" }, { label: "两个力", value: r.balanced ? "平衡" : "不平衡" },
      { label: "物体的运动", value: r.balanced ? "保持静止或匀速直线运动" : r.couple > 0 ? "会发生转动" : "运动状态改变" }]; }
    const mu = Mo.muOf(s.surf), k = Mo.car(s.v0, mu, s.t);
    return [
      { label: "速度", value: fmt(k.v, 2), unit: "m/s" }, { label: "滑行的路程", value: fmt(k.s, 2), unit: "m" },
      { label: "小车受到的阻力产生的加速度", value: fmt(mu * Mo.g, 2), unit: "m/s²" },
      { label: "停下来的路程", value: mu > 0 ? fmt(Mo.stopDistance(s.v0, mu), 2) : "∞", unit: mu > 0 ? "m" : "" },
      { label: "小车的运动", value: mu === 0 ? "一直做匀速直线运动" : k.stopped ? "已停下" : "减速滑行" },
    ];
  },
  draw(c, w, hh, s) {
    if (s.mode === 1) {
      const r = Mo.twoForces(s.F1, s.F2, s.dir, s.off), cx = 320, cy = 175, k = 24;
      rect(c, cx - 70, cy - 40, 140, 80, "#fff3bf", COL.ink, 4, 10); txt(c, "m", cx, cy, 24, COL.ink);
      arrow(c, cx + 70, cy, cx + 70 + s.F1 * k, cy, COL.red, 6); txt(c, "F1", cx + 70 + s.F1 * k + 6, cy - 22, 20, COL.red, "left");
      const a = (s.dir * Math.PI) / 180, oy = s.dir === 180 ? s.off * 12 : 0;
      arrow(c, cx - 70, cy + oy, cx - 70 + s.F2 * k * Math.cos(a), cy + oy - s.F2 * k * Math.sin(a), COL.blue, 6); txt(c, "F2", cx - 70 + s.F2 * k * Math.cos(a) - 6, cy + oy - s.F2 * k * Math.sin(a) - 22, 20, COL.blue, "right");
      if (r.mag > 0.05) arrow(c, cx, cy + 70, cx + r.x * k, cy + 70 - r.y * k, COL.purple, 5);
      if (r.couple > 0) { c.beginPath(); c.arc(cx, cy, 100, -0.6, 0.6); c.strokeStyle = COL.orange; c.lineWidth = 5; c.stroke(); arrow(c, cx + 100 * Math.cos(0.5), cy + 100 * Math.sin(0.5), cx + 100 * Math.cos(0.65), cy + 100 * Math.sin(0.65), COL.orange, 5); }
      txt(c, r.balanced ? "= 0" : `F = ${fmt(r.mag, 1)} N`, cx, 330, 24, r.balanced ? COL.green : COL.purple);
      return;
    }
    const mu = Mo.muOf(s.surf), k = Mo.car(s.v0, mu, s.t), sc = 560 / 8, x0 = 50;
    // the slope on the left, the surface to the right
    c.beginPath(); c.moveTo(10, 60); c.lineTo(x0, 150); c.lineTo(10, 150); c.closePath(); c.fillStyle = "#dee2e6"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 3; c.stroke();
    rect(c, x0, 150, 580, 30, SURF_COL[s.surf], COL.ink, 3, 4);
    for (let m = 0; m <= 8; m++) { line(c, x0 + m * sc, 180, x0 + m * sc, 192, COL.grey, 2); txt(c, String(m), x0 + m * sc, 206, 16, COL.grey); }
    txt(c, "m", 626, 206, 16, COL.grey, "right");
    const cxp = x0 + Math.min(8.3, k.s) * sc;
    rect(c, cxp - 28, 112, 56, 28, COL.teal, COL.ink, 3, 8); circle(c, cxp - 15, 144, 8, COL.ink, null); circle(c, cxp + 15, 144, 8, COL.ink, null);
    if (k.v > 0.02) arrow(c, cxp + 34, 126, cxp + 34 + k.v * 28, 126, COL.red, 5);
    if (mu > 0) { const st = x0 + Mo.stopDistance(s.v0, mu) * sc; if (st < 620) { line(c, st, 100, st, 150, COL.orange, 3, [6, 5]); txt(c, "s", st, 88, 18, COL.orange); } }
    txt(c, `v = ${fmt(k.v, 2)} m/s`, 320, 260, 24, COL.ink);
  },
  tasks: [
    { id: "smooth", text: "选择理想光滑表面，让时间超过 5 s：小车一直做匀速直线运动，速度不变", check: (s) => s.mode === 0 && s.surf === 4 && s.t >= 5 },
    { id: "towel", text: "选择毛巾，初速度不小于 2 m/s：小车停下的路程不超过 0.5 m", check: (s) => s.mode === 0 && s.surf === 0 && s.v0 >= 2 && Mo.stopDistance(s.v0, 0.5) <= 0.5 },
    { id: "balance", text: "二力平衡：使 F₁ 和 F₂ 大小相等、方向相反、在同一直线上（F₁ 不为 0）", check: (s) => s.mode === 1 && s.F1 > 0 && Mo.twoForces(s.F1, s.F2, s.dir, s.off).balanced },
    { id: "turn", text: "使两个力大小相等、方向相反，但不在同一直线上：物体会转动", check: (s) => s.mode === 1 && s.F1 > 0 && s.F1 === s.F2 && s.dir === 180 && s.off > 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
