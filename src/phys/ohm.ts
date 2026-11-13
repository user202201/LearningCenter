import { mountSim, type SimDef, type PhysCtx, fmt, clamp } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-ohm";
import { COL, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.ohm;
const vals = (s: Record<string, number>) => (s.mode === 2 ? { R1: Mo.R0, R2: Mo.rheostat(s.pos) } : { R1: s.R1, R2: s.R2 });
const solveS = (s: Record<string, number>) => { const v = vals(s); return Mo.solve(s.mode, s.U, v.R1, v.R2, s.t); };
let target = "";
export const def: SimDef = {
  meta,
  lesson: [
    "欧姆定律：导体中的电流跟导体两端的电压成正比，跟导体的电阻成反比：I = U / R。串联电路：电流处处相等，总电压等于各部分电压之和，总电阻 R = R₁ + R₂，电压与电阻成正比（分压）。并联电路：各支路两端电压相等，干路电流等于各支路电流之和，1/R = 1/R₁ + 1/R₂，电流与电阻成反比（分流）。",
    "滑动变阻器通过改变接入电路的电阻丝长度改变电阻，从而改变电路中的电流和电压。电功率 P = UI = I²R = U²/R；电流通过导体产生的热量 Q = I²Rt（焦耳定律）。",
    "拖动画面中的电阻（或滑动变阻器的滑片），也可以改变它们的阻值。",
  ],
  formulas: ["I=\\dfrac{U}{R}", "R=R_1+R_2", "\\dfrac{1}{R}=\\dfrac{1}{R_1}+\\dfrac{1}{R_2}", "P=UI", "Q=I^2Rt"],
  params: [
    { id: "U", label: "电源电压", min: 1, max: 12, step: 1, value: 6, unit: "V" },
    { id: "R1", label: "电阻 R₁", min: 1, max: 50, step: 1, value: 10, unit: "Ω", when: (s) => s.mode < 2 },
    { id: "R2", label: "电阻 R₂", min: 1, max: 50, step: 1, value: 30, unit: "Ω", when: (s) => s.mode < 2 },
    { id: "pos", label: "滑动变阻器的滑片位置（0 到 50 Ω）", min: 0, max: 1, step: 0.05, value: 0.5, when: (s) => s.mode === 2 },
    { id: "t", label: "通电时间", min: 0, max: 60, step: 1, value: 10, unit: "s" },
  ],
  choices: [{ id: "mode", label: "电路", value: 0, options: [[0, "串联"], [1, "并联"], [2, "滑动变阻器"]] }],
  aspect: 0.62,
  pointer: (kind, x, y, s) => {
    if (kind === "down") {
      target = "";
      if (s.mode === 0 && y > 55 && y < 125) target = x > 180 && x < 300 ? "R1" : x > 380 && x < 500 ? "R2" : "";
      else if (s.mode === 1 && x > 200 && x < 300 && y > 140 && y < 260) target = "R1";
      else if (s.mode === 1 && x > 400 && x < 500 && y > 140 && y < 260) target = "R2";
      else if (s.mode === 2 && x > 390 && x < 510 && y > 40 && y < 130) target = "pos";
    }
    if (kind === "up") { target = ""; return; }
    if (!target) return;
    if (target === "pos") return { pos: clamp((x - 400) / 100, 0, 1) };
    const frac = s.mode === 1 ? (y - 160) / 80 : (x - (target === "R1" ? 200 : 400)) / 80;
    return { [target]: clamp(Math.round(1 + 49 * clamp(frac, 0, 1)), 1, 50) };
  },
  readouts: (s) => {
    const r = solveS(s), v = vals(s);
    return [
      { label: "总电阻", value: fmt(r.R, 2), unit: "Ω" }, { label: "干路电流 I", value: fmt(r.I, 3), unit: "A" },
      { label: "R₁ 两端的电压", value: fmt(r.U1, 2), unit: "V" }, { label: "R₂ 两端的电压", value: fmt(r.U2, 2), unit: "V" },
      { label: "通过 R₁ 的电流", value: fmt(r.I1, 3), unit: "A" }, { label: "通过 R₂ 的电流", value: fmt(r.I2, 3), unit: "A" },
      { label: "R₁ 的电功率", value: fmt(r.P1, 2), unit: "W" }, { label: "R₂ 的电功率", value: fmt(r.P2, 2), unit: "W" },
      { label: "总电功率", value: fmt(r.P, 2), unit: "W" }, { label: "R₁ 产生的热量", value: fmt(r.Q1, 1), unit: "J" },
      { label: v.R2 === 0 ? "" : "R₂ 的阻值", value: fmt(v.R2, 1), unit: "Ω" },
    ].filter((x) => x.label);
  },
  draw(c, w, hh, s) {
    const r = solveS(s), v = vals(s);
    const wire = (...p: number[]) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke(); };
    const res = (cx: number, cy: number, vert: boolean, label: string, val: number, fixed = false) => {
      const bw = vert ? 36 : 80, bh = vert ? 80 : 36; rect(c, cx - bw / 2, cy - bh / 2, bw, bh, fixed ? "#fff" : "#ffec99", COL.ink, 4, 4);
      txt(c, label, cx, cy - (vert ? 0 : 0), 20, COL.ink); txt(c, `${fmt(val, val % 1 ? 1 : 0)} Ω`, cx + (vert ? 46 : 0), cy + (vert ? 0 : 36), 18, COL.grey, vert ? "left" : "center");
    };
    const meter = (cx: number, cy: number, letter: string, value: string, color: string) => { circle(c, cx, cy, 28, "#fff"); txt(c, letter, cx, cy, 26, color); txt(c, value, cx, cy + 46, 17, color); };
    const battery = (x: number, y1: number, y2: number) => { wire(x, y1, x, 170); wire(x, 230, x, y2); line(c, x - 22, 170, x + 22, 170, COL.ink, 4); line(c, x - 12, 230, x + 12, 230, COL.ink, 10); line(c, x - 12, 200, x + 12, 200, "#fff0", 1); txt(c, "+", x - 36, 168, 22, COL.red); txt(c, `${s.U} V`, x + 40, 200, 22, COL.ink, "left"); };
    if (s.mode === 1) {
      wire(60, 90, 580, 90, 580, 310, 60, 310); battery(60, 90, 310);
      line(c, 250, 90, 250, 160, COL.ink, 4); line(c, 250, 240, 250, 310, COL.ink, 4); line(c, 450, 90, 450, 160, COL.ink, 4); line(c, 450, 240, 450, 310, COL.ink, 4);
      res(250, 200, true, "R1", v.R1); res(450, 200, true, "R2", v.R2);
      meter(150, 90, "A", `${fmt(r.I, 2)} A`, COL.blue);
      txt(c, `I1 = ${fmt(r.I1, 2)} A`, 250, 345, 18, COL.blue); txt(c, `I2 = ${fmt(r.I2, 2)} A`, 450, 345, 18, COL.blue);
      return;
    }
    wire(60, 90, 60, 310, 580, 310, 580, 90); wire(60, 90, 200, 90); wire(520, 90, 580, 90);
    battery(60, 90, 310);
    res(240, 90, false, "R1", v.R1, s.mode === 2);
    let x2l = 440, x2r = 520, vx = 480;
    if (s.mode === 2) {
      x2l = 400; vx = 460; wire(280, 90, 400, 90);
      rect(c, 400, 74, 120, 32, "#fff", COL.ink, 4, 4);
      const sx = 400 + 120 * s.pos; line(c, sx, 44, sx, 74, COL.red, 5); line(c, sx - 10, 58, sx, 74, COL.red, 5); line(c, sx + 10, 58, sx, 74, COL.red, 5);
      txt(c, "Rp", 460, 130, 20, COL.ink); txt(c, `${fmt(v.R2, 1)} Ω`, 460, 154, 18, COL.grey);
    } else { wire(280, 90, 440, 90); res(480, 90, false, "R2", v.R2); }
    meter(320, 310, "A", `${fmt(r.I, 2)} A`, COL.blue);
    meter(240, 200, "V", `${fmt(r.U1, 2)} V`, COL.green); meter(vx, 200, "V", `${fmt(r.U2, 2)} V`, COL.green);
    wire(212, 200, 200, 200, 200, 92); wire(268, 200, 280, 200, 280, 92); wire(vx - 28, 200, x2l, 200, x2l, 92); wire(vx + 28, 200, x2r, 200, x2r, 92);
  },
  tasks: [
    { id: "i02", text: "串联：使电路中的电流为 0.2 A（U = 6 V 时 R₁ + R₂ = 30 Ω）", check: (s) => s.mode === 0 && Math.abs(Mo.solve(0, s.U, s.R1, s.R2).I - 0.2) < 0.005 },
    { id: "par6", text: "并联：使总电阻为 6 Ω", check: (s) => s.mode === 1 && Math.abs(Mo.solve(1, s.U, s.R1, s.R2).R - 6) < 0.01 },
    { id: "rheo", text: "滑动变阻器：使 10 Ω 定值电阻两端的电压为 3 V（电源 6 V）", check: (s) => s.mode === 2 && s.U === 6 && Math.abs(solveS(s).U1 - 3) < 0.05 },
    { id: "power", text: "使电路的总功率超过 5 W", check: (s) => solveS(s).P > 5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
