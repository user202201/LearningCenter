import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-breathing";
import { COL, lab, txt, circle, ell, rect, line, arrow, axes, curve } from "./draw";
export const meta = CATALOG.breathing;
const dd = (s: Record<string, number>) => (s.mode === 0 ? s.dd : ((1 - Math.cos(s.ph)) / 2) * Math.min(100, s.Vt / 28));
const rr = (s: Record<string, number>) => (s.mode === 0 ? s.rr : ((1 - Math.cos(s.ph)) / 2) * Math.min(100, s.Vt / 28));
const V = (s: Record<string, number>) => (s.mode === 0 ? Mo.vol(s.dd, s.rr) : Mo.volAt(s.ph, s.Vt));
export const def: SimDef = {
  meta,
  lesson: [
    "呼吸运动由膈肌和肋间肌的收缩、舒张引起。吸气时，膈肌收缩（顶部下降），肋骨上升，胸廓容积扩大，肺随之扩张，肺内气压低于外界气压，外界空气进入肺；呼气时相反，胸廓容积缩小，肺内气压高于外界气压，气体排出。",
    "把气管堵住，胸廓扩大时肺内气体的体积增大、气压减小（波义耳定律：温度不变时 P V = 常数）。呼吸频率与每次呼吸量决定每分钟通气量。",
  ],
  formulas: ["P_1 V_1 = P_2 V_2"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "dd", label: "膈肌收缩", min: 0, max: 100, step: 5, value: 0, unit: "%", when: (s) => s.mode === 0 },
    { id: "rr", label: "肋骨上升", min: 0, max: 100, step: 5, value: 0, unit: "%", when: (s) => s.mode === 0 },
    { id: "Vt", label: "每次呼吸量", min: 200, max: 3000, step: 100, value: 500, unit: "mL", when: (s) => s.mode === 1 },
    { id: "f", label: "呼吸频率", min: 6, max: 60, step: 1, value: 15, unit: "次/分钟", when: (s) => s.mode === 1 },
    { id: "ph", label: "呼吸周期的位置", min: 0, max: 6.28, step: 0.05, value: 0, dec: 2, when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "手动控制"], [1, "连续呼吸"]] },
    { id: "block", label: "气管", value: 0, options: [[0, "通畅"], [1, "堵住"]], when: (s) => s.mode === 0 },
  ],
  play: { param: "ph", rate: 1.6, loop: true },
  aspect: 0.62,
  readouts: (s) => {
    const v = V(s);
    if (s.mode === 0) return [
      { label: "胸廓容积", value: fmt(v, 0), unit: "mL" }, { label: "比放松时增加", value: fmt(v - Mo.V0, 0), unit: "mL" },
      { label: "肺内气压", value: fmt(s.block ? Mo.blocked(v) : Mo.P0, 1), unit: "kPa" }, { label: "状态", value: v > Mo.V0 ? "胸廓扩大（吸气）" : "胸廓放松（呼气）" }];
    return [
      { label: "肺的容积", value: fmt(v, 0), unit: "mL" }, { label: "气流（正为吸入）", value: fmt(Mo.flow(s.ph, s.Vt, s.f), 0), unit: "mL/s" },
      { label: "肺内气压", value: fmt(Mo.alveolar(s.ph, s.Vt, s.f), 2), unit: "kPa" }, { label: "每分钟通气量", value: fmt(Mo.vent(s.Vt, s.f), 1), unit: "L" }];
  },
  draw(c, w, h, s) {
    const d = dd(s) / 100, r = rr(s) / 100;
    rect(c, 50 - r * 14, 40, 210 + r * 28, 250, "#fff5f5", COL.ink, 4, 60);
    for (let i = 0; i < 5; i++) { const y = 80 + i * 36 - r * 10, dx = 18 + r * 12; c.beginPath(); c.moveTo(50 - dx + 14, y); c.quadraticCurveTo(155, y + 28 - r * 12, 260 + dx - 14, y); c.strokeStyle = "#dee2e6"; c.lineWidth = 5; c.stroke(); }
    const lv = 0.78 + 0.5 * ((V(s) - Mo.V0) / 2000);
    ell(c, 110, 160, 34 * lv, 70 * lv, "#ffa8a8", COL.ink, 3); ell(c, 200, 160, 34 * lv, 70 * lv, "#ffa8a8", COL.ink, 3);
    line(c, 155, 60, 155, 120, COL.grey, 8); line(c, 155, 120, 110, 150, COL.grey, 5); line(c, 155, 120, 200, 150, COL.grey, 5);
    const dome = 44 * (1 - d); c.beginPath(); c.moveTo(56, 262); c.quadraticCurveTo(155, 262 - 2 * dome, 254, 262 + 0); c.strokeStyle = COL.orange; c.lineWidth = 8; c.stroke(); lab(c, "膈肌", 155, 284, 17, COL.orange);
    if (s.block) { rect(c, 140, 30, 30, 14, COL.red, COL.ink, 3, 3); }
    lab(c, "胸廓", 20, 24, 18, COL.grey, "left");
    if (s.mode === 0) {
      const P = axes(c, 330, 50, 290, 240, 4400, 110, "V (mL)", "P (kPa)", 60, 4);
      // x axis starts at 0: draw the hyperbola from 2400 on
      c.beginPath(); for (let v = 2400; v <= 4400; v += 50) { const px = P.X(v), py = P.Y(Mo.blocked(v)); if (v === 2400) c.moveTo(px, py); else c.lineTo(px, py); } c.strokeStyle = COL.blue; c.lineWidth = 4; c.stroke();
      circle(c, P.X(V(s)), P.Y(s.block ? Mo.blocked(V(s)) : Mo.P0), 8, s.block ? COL.red : COL.green, COL.ink, 3);
    } else {
      const P = axes(c, 330, 50, 290, 240, 6.28, Mo.V0 + 3200, "phase", "V (mL)", Mo.V0 - 100, 4);
      curve(c, P, (x) => Mo.volAt(x, s.Vt), COL.blue, 6.28, 100); circle(c, P.X(s.ph), P.Y(V(s)), 8, COL.red, COL.ink, 3);
      arrow(c, 300, 40, 300, 40 + (Mo.flow(s.ph, s.Vt, s.f) > 0 ? 40 : -0), COL.green, 1);
    }
    if (s.mode === 1) { const fl = Mo.flow(s.ph, s.Vt, s.f); if (Math.abs(fl) > 20) arrow(c, 155, fl > 0 ? 6 : 36, 155, fl > 0 ? 36 : 6, fl > 0 ? COL.green : COL.red, 5); }
    txt(c, "", 0, 0, 1, "#fff");
  },
  tasks: [
    { id: "vol", text: "收缩膈肌并使肋骨上升，让胸廓容积达到 3000 mL 以上", check: (s) => s.mode === 0 && Mo.vol(s.dd, s.rr) >= 3000 },
    { id: "boyle", text: "堵住气管并扩大胸廓：肺内气压降到 90 kPa 以下", check: (s) => s.mode === 0 && s.block === 1 && Mo.blocked(Mo.vol(s.dd, s.rr)) < 90 },
    { id: "vent", text: "连续呼吸：使每分钟通气量达到 15 L 以上（相当于剧烈运动）", check: (s) => s.mode === 1 && Mo.vent(s.Vt, s.f) >= 15 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
