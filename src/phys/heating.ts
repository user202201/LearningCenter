import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-heating";
import { COL, axes, circle, curve, line, rect, txt } from "./draw";

export const meta = CATALOG.heating;
const TMAX = 1200;
const PHASE: Record<number, string[]> = {
  0: ["固态", "固液共存（熔化）", "液态", "沸腾（液气共存）", "气态"],
  1: ["硬（固态）", "变软", "液态"],
  2: ["液态", "固液共存（凝固）", "固态"],
};
const phaseName = (mode: number, p: number) => (mode === 2 ? PHASE[2][p === 2 ? 0 : p === 1 ? 1 : 2] : PHASE[mode][p]);
export const def: SimDef = {
  meta,
  lesson: [
    "晶体（如冰）有固定的熔点：熔化时持续吸热，但温度保持不变，图像上有一段水平线；凝固时放热，温度也保持不变。非晶体（如石蜡）没有固定的熔点，边吸热边变软，温度一直上升。",
    "液体沸腾时持续吸热，温度保持在沸点不变（标准大气压下水的沸点是 100 °C）。图像的水平部分越长，说明吸收的热量越多，加热功率越小或质量越大都会使它变长。",
  ],
  formulas: ["Q=cm\\Delta t", "Q=\\lambda m", "Q=Pt"],
  params: [
    { id: "P", label: "加热功率", min: 100, max: 1000, step: 50, value: 400, unit: "W" },
    { id: "m", label: "质量", min: 0.1, max: 0.5, step: 0.1, value: 0.1, unit: "kg" },
    { id: "t", label: "时间", min: 0, max: TMAX, step: 5, value: 100, unit: "s" },
  ],
  choices: [{ id: "mode", label: "实验", value: 0, options: [[0, "冰的熔化与水的沸腾"], [1, "石蜡的熔化"], [2, "水的凝固"]] }],
  play: { param: "t", rate: 60 },
  aspect: 0.56,
  readouts: (s) => {
    const p = Mo.curve(s.mode, s.P, s.m, s.t);
    return [
      { label: "温度", value: fmt(p.T, 1), unit: "°C" },
      { label: "状态", value: phaseName(s.mode, p.phase) },
      { label: s.mode === 2 ? "放出的热量" : "吸收的热量", value: fmt((s.P * s.t) / 1000, 1), unit: "kJ" },
    ];
  },
  draw(c, w, hh, s) {
    const p = Mo.curve(s.mode, s.P, s.m, s.t);
    // beaker
    c.beginPath(); c.moveTo(40, 40); c.lineTo(40, 270); c.quadraticCurveTo(40, 290, 60, 290); c.lineTo(190, 290); c.quadraticCurveTo(210, 290, 210, 270); c.lineTo(210, 40);
    const liquid = s.mode === 1 ? p.phase === 2 : p.phase >= 1 && p.phase <= 3 || (s.mode === 2 && p.phase === 2);
    const level = 130;
    c.save(); c.beginPath(); c.rect(42, level, 166, 160); c.clip();
    const fill = s.mode === 1 ? (p.phase === 2 ? "#ffe066" : p.phase === 1 ? "#ffec99" : "#fff3bf") : p.phase === 0 ? "#e7f5ff" : "#a5d8ff";
    if (s.mode === 1 || p.phase !== 4) { c.fillStyle = fill; c.fillRect(40, p.phase === 0 && s.mode !== 1 ? 190 : level, 170, 160); }
    c.restore();
    if ((s.mode === 0 || s.mode === 2) && (p.phase === 0 || p.phase === 1)) {   // ice cubes
      const n = Math.max(1, Math.ceil(6 * Mo.solidFraction(s.mode, s.P, s.m, s.t)));
      for (let i = 0; i < Math.min(6, n); i++) rect(c, 62 + (i % 3) * 44, 200 + Math.floor(i / 3) * 40, 38, 34, "#e3f2ff", "#74c0fc", 3, 8);
    }
    if (p.phase === 3) for (let i = 0; i < 9; i++) circle(c, 62 + (i * 37) % 130, 150 + ((i * 53 + s.t * 2) % 120), 5 + (i % 3) * 2, "#e7f5ff", "#4dabf7", 2);
    if (s.mode === 0 && p.phase === 4) for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(70 + i * 28, 120); c.bezierCurveTo(50 + i * 28, 90, 90 + i * 28, 70, 70 + i * 28, 30); c.strokeStyle = "#adb5bd"; c.lineWidth = 5; c.stroke(); }
    c.beginPath(); c.moveTo(40, 40); c.lineTo(40, 270); c.quadraticCurveTo(40, 290, 60, 290); c.lineTo(190, 290); c.quadraticCurveTo(210, 290, 210, 270); c.lineTo(210, 40); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
    if (liquid) line(c, 42, level, 208, level, "#4dabf7", 3);
    // flame or ice pack
    if (s.mode === 2) { rect(c, 70, 306, 110, 34, "#a5d8ff", COL.ink, 3, 10); txt(c, "−", 125, 323, 22, COL.blue); }
    else for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(85 + i * 38, 336); c.quadraticCurveTo(70 + i * 38, 312, 85 + i * 38, 296); c.quadraticCurveTo(100 + i * 38, 312, 85 + i * 38, 336); c.fillStyle = i === 1 ? COL.yellow : COL.orange; c.fill(); }
    // thermometer
    const ty = (T: number) => 280 - ((Math.max(-30, Math.min(150, T)) + 30) / 180) * 220;
    rect(c, 128, 40, 14, 240, "#fff", COL.ink, 3, 7); circle(c, 135, 285, 12, COL.red);
    rect(c, 131, ty(p.T), 8, 280 - ty(p.T), COL.red, null, 0, 3);
    txt(c, `${Math.round(p.T)}`, 168, ty(p.T), 18, COL.red, "left");
    // the graph
    const ymax = s.mode === 0 ? 140 : s.mode === 1 ? 200 : 20, ymin = s.mode === 1 ? 0 : -20;
    const P = axes(c, 290, 40, 320, 260, TMAX, ymax, "t/s", "T/°C", ymin, 4);
    curve(c, P, (x) => Mo.curve(s.mode, s.P, s.m, x).T, "#ffa8a8", TMAX, 240, 3);
    c.save(); c.beginPath(); c.rect(P.x0, P.y0 - 5, P.X(s.t) - P.x0, P.h + 10); c.clip(); curve(c, P, (x) => Mo.curve(s.mode, s.P, s.m, x).T, COL.red, TMAX, 240, 5); c.restore();
    circle(c, P.X(s.t), P.Y(p.T), 8, COL.yellow);
  },
  tasks: [
    { id: "plateau", text: "冰的熔化：使加热时间处在熔化阶段（固液共存），观察温度保持 0 °C 不变", check: (s) => s.mode === 0 && Mo.curve(0, s.P, s.m, s.t).phase === 1 },
    { id: "boil", text: "使水沸腾：水温保持在 100 °C 不变（沸腾阶段）", check: (s) => s.mode === 0 && Mo.curve(0, s.P, s.m, s.t).phase === 3 },
    { id: "wax", text: "石蜡的熔化：使石蜡处在变软阶段，温度仍在上升（没有水平线）", check: (s) => s.mode === 1 && Mo.curve(1, s.P, s.m, s.t).phase === 1 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
