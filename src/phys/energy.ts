import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-energy";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.energy;
const energyOf = (s: Record<string, number>) => (s.mode === 0 ? Mo.pendulumEnergy(s.m, s.L, s.th0, s.t) : s.mode === 1 ? Mo.trackEnergy(s.m, s.H0, s.x, s.loss) : null);
export const def: SimDef = {
  meta,
  lesson: [
    "力对物体做功的两个必要因素：作用在物体上的力，和物体在力的方向上移动的距离。W = Fs，单位焦耳（J）。功率表示做功的快慢：P = W / t = Fv，单位瓦特（W）。",
    "动能与质量和速度有关：Ek = ½mv²；重力势能与质量和高度有关：Ep = mgh。动能和势能统称机械能。只有重力做功时，动能和势能相互转化，机械能守恒；有摩擦时，一部分机械能变成内能，总能量仍然守恒。",
    "单摆和过山车：在最高点势能最大、动能为 0；在最低点势能最小、动能最大。条形图中，动能与势能之和（加上损失的内能）总是一样长。",
  ],
  formulas: ["W=Fs", "P=\\dfrac{W}{t}", "E_k=\\dfrac{1}{2}mv^2", "E_p=mgh"],
  params: [
    { id: "m", label: "质量", min: 0.5, max: 5, step: 0.5, value: 1, unit: "kg", when: (s) => s.mode < 2 },
    { id: "L", label: "摆长", min: 0.5, max: 2, step: 0.1, value: 1, unit: "m", when: (s) => s.mode === 0 },
    { id: "th0", label: "释放时偏离竖直方向的角度", min: 5, max: 80, step: 5, value: 40, unit: "°", when: (s) => s.mode === 0 },
    { id: "t", label: "时间", min: 0, max: 10, step: 0.05, value: 0, unit: "s", when: (s) => s.mode === 0 },
    { id: "H0", label: "起点的高度", min: 2, max: 10, step: 1, value: 8, unit: "m", when: (s) => s.mode === 1 },
    { id: "loss", label: "摩擦损失（占起点能量的比例）", min: 0, max: 0.3, step: 0.05, value: 0, when: (s) => s.mode === 1 },
    { id: "x", label: "小车的位置", min: 0, max: 1, step: 0.01, value: 0, when: (s) => s.mode === 1 },
    { id: "F", label: "推力", min: 10, max: 200, step: 10, value: 50, unit: "N", when: (s) => s.mode === 2 },
    { id: "s", label: "沿推力方向移动的距离", min: 1, max: 20, step: 1, value: 4, unit: "m", when: (s) => s.mode === 2 },
    { id: "tw", label: "所用时间", min: 1, max: 20, step: 1, value: 5, unit: "s", when: (s) => s.mode === 2 },
  ],
  choices: [{ id: "mode", label: "实验", value: 0, options: [[0, "单摆"], [1, "过山车"], [2, "功与功率"]] }],
  play: { param: "t", rate: 0.5, loop: true },
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 2) { const W = Mo.work(s.F, s.s); return [{ label: "功", value: fmt(W, 0), unit: "J" }, { label: "功率", value: fmt(Mo.power(W, s.tw), 1), unit: "W" }, { label: "平均速度", value: fmt(s.s / s.tw, 2), unit: "m/s" }]; }
    const e = energyOf(s)!;
    const r = [{ label: "动能", value: fmt(e.Ek, 2), unit: "J" }, { label: "重力势能", value: fmt(e.Ep, 2), unit: "J" }, { label: "转化为内能的能量", value: fmt(e.Eloss, 2), unit: "J" },
      { label: "总能量", value: fmt(e.Ek + e.Ep + e.Eloss, 2), unit: "J" }, { label: "速度", value: fmt(e.v, 2), unit: "m/s" }, { label: "高度", value: fmt(e.h, 2), unit: "m" }];
    if (s.mode === 1 && !e.reached) r.push({ label: "提示", value: "小车到不了这里", unit: "" });
    return r;
  },
  draw(c, w, hh, s) {
    if (s.mode === 2) {
      const W = Mo.work(s.F, s.s);
      rect(c, 20, 250, 600, 22, "#ced4da", COL.ink, 3, 4);
      const bx = 60 + (s.s / 20) * 400;
      rect(c, bx, 190, 80, 60, "#ffa94d", COL.ink, 4, 8); arrow(c, bx - 70, 220, bx - 4, 220, COL.red, 6); txt(c, "F", bx - 80, 200, 22, COL.red, "right");
      line(c, 60, 290, bx, 290, COL.grey, 3); arrow(c, bx - 30, 290, bx, 290, COL.grey, 3); txt(c, "s", (60 + bx) / 2, 310, 22, COL.grey);
      const bar = (x: number, v: number, vmax: number, col: string, label: string) => { const hgt = Math.max(2, (v / vmax) * 130); rect(c, x, 150 - hgt, 40, hgt, col, COL.ink, 3, 4); txt(c, label, x + 20, 166, 18, COL.ink); };
      const top = Math.max(W, Mo.power(W, s.tw), 1); bar(60, W, top, COL.green, "W"); bar(120, Mo.power(W, s.tw), top, COL.purple, "P");
      txt(c, `W = ${fmt(W, 0)} J`, 560, 60, 24, COL.green, "right"); txt(c, `P = ${fmt(Mo.power(W, s.tw), 1)} W`, 560, 96, 24, COL.purple, "right");
      return;
    }
    const e = energyOf(s)!;
    // the scene on the left, the energy bars on the right
    if (s.mode === 0) {
      const { theta } = Mo.pendulum(s.th0, s.L, s.t), pxl = 150 * s.L + 20, ox = 200, oy = 40;
      line(c, 100, oy, 300, oy, COL.ink, 6);
      const bx = ox + pxl * Math.sin(theta) * 1.2, by = oy + pxl * Math.cos(theta) * 1.2;
      c.beginPath(); c.arc(ox, oy, pxl * 1.2, rad(90) - rad(s.th0), rad(90) + rad(s.th0)); c.strokeStyle = "#ced4da"; c.lineWidth = 2; c.setLineDash([5, 6]); c.stroke(); c.setLineDash([]);
      line(c, ox, oy, bx, by, COL.ink, 3); circle(c, bx, by, 14 + s.m * 3, COL.red);
    } else {
      const X = (x: number) => 20 + x * 330, Y = (h: number) => 350 - (h / 10) * 280;
      c.beginPath(); for (let i = 0; i <= 120; i++) { const x = i / 120; (i ? c.lineTo : c.moveTo).call(c, X(x), Y(Mo.trackH(s.H0, x))); }
      c.strokeStyle = COL.ink; c.lineWidth = 5; c.stroke();
      const cx = X(s.x), cy = Y(e.h);
      circle(c, cx, cy - 14, 14, e.Ek > 0 || e.reached ? COL.orange : COL.grey);
      line(c, 20, Y(s.H0), 350, Y(s.H0), COL.red, 2, [6, 6]); txt(c, "H", 362, Y(s.H0), 18, COL.red, "left");
    }
    const bar = (x: number, v: number, col: string, label: string, base = 340, k = 30) => { const hgt = Math.min(240, Math.max(0, (v / Math.max(1, e.E0)) * 240)); rect(c, x, base - hgt, 44, hgt, col, COL.ink, 3, 4); txt(c, label, x + 22, base + 18, 18, COL.ink); };
    bar(400, e.Ek, COL.orange, "Ek"); bar(450, e.Ep, COL.blue, "Ep"); bar(500, e.Eloss, COL.grey, "Q");
    // the sum: stacked
    const tot = e.Ek + e.Ep + e.Eloss, th = (tot / Math.max(1, e.E0)) * 240;
    rect(c, 560, 340 - th, 44, th, "#d0bfff", COL.ink, 3, 4); txt(c, "E", 582, 358, 18, COL.ink);
    line(c, 390, 340 - 240, 610, 340 - 240, COL.red, 2, [5, 5]);
  },
  tasks: [
    { id: "top", text: "单摆：使摆球到达最高点（速度为 0），读出此时动能为 0、势能最大", check: (s) => s.mode === 0 && s.t > 0 && (() => { const e = Mo.pendulumEnergy(s.m, s.L, s.th0, s.t); return e.Ek < 0.03 * e.E0; })() },
    { id: "ek", text: "过山车：使小车的动能大于 40 J（质量 1 kg，起点高度 8 m，位置在最低点附近）", check: (s) => s.mode === 1 && s.loss === 0 && Mo.trackEnergy(s.m, s.H0, s.x, 0).Ek > 40 },
    { id: "power", text: "功与功率：使功率超过 100 W", check: (s) => s.mode === 2 && Mo.power(Mo.work(s.F, s.s), s.tw) > 100 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
