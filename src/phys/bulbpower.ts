import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-bulbpower";
import { COL, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.bulbpower;
const sol = (s: Record<string, number>) => Mo.solve(s.bulb, Mo.CELLS[s.cells], s.Rp);
export const def: SimDef = {
  meta,
  lesson: [
    "测量小灯泡的电功率：用电压表测小灯泡两端的电压 U，用电流表测通过它的电流 I，由 P = UI 算出电功率。滑动变阻器与小灯泡串联，用来改变小灯泡两端的电压（连接时滑片放在阻值最大处，闭合开关后再慢慢减小电阻）。",
    "小灯泡两端电压等于额定电压时正常发光，这时的电功率就是额定功率；电压低于额定电压时功率较小，灯较暗；电压高于额定电压时功率较大，灯较亮，但太高会烧坏灯丝（实验中电压不能超过额定电压的 1.2 倍）。小灯泡的亮暗取决于它的实际功率。",
    "由 R = U / I 可以算出各次的灯丝电阻：电压越大，灯丝温度越高，电阻越大，所以小灯泡的电阻不是定值，不能用多次测量取平均值的方法求功率。",
  ],
  formulas: ["P=UI", "R=\\dfrac{U}{I}"],
  params: [{ id: "Rp", label: "滑动变阻器接入的电阻", min: 0, max: 20, step: 0.5, value: 20, unit: "Ω" }],
  choices: [
    { id: "bulb", label: "小灯泡", value: 0, options: [[0, "2.5 V 灯泡"], [1, "3.8 V 灯泡"]] },
    { id: "cells", label: "电池", value: 1, options: [[0, "2 节"], [1, "3 节"], [2, "4 节"]] },
  ],
  hidden: { n: 0, U0: 0, I0: 0, U1: 0, I1: 0, U2: 0, I2: 0, U3: 0, I3: 0, U4: 0, I4: 0 },
  actions: [{ id: "rec", label: "记录一组数据", run: (s) => { if (s.n >= Mo.MAXREC) return; const l = sol(s); return { n: s.n + 1, [`U${s.n}`]: l.U, [`I${s.n}`]: l.I }; } }],
  aspect: 0.62,
  readouts: (s) => {
    const l = sol(s);
    return [
      { label: "电压表的示数", value: fmt(l.U, 2), unit: "V" }, { label: "电流表的示数", value: fmt(l.I, 3), unit: "A" },
      { label: "实际功率", value: fmt(l.P, 3), unit: "W" }, { label: "额定功率", value: fmt(l.Pn, 2), unit: "W" },
      { label: "灯丝的电阻", value: fmt(l.R, 1), unit: "Ω" }, { label: "小灯泡", value: Mo.NAMES[Mo.brightness(l.ratio)] },
      { label: "已记录的数据组数", value: fmt(s.n, 0) },
    ];
  },
  draw(c, w, hh, s) {
    const l = sol(s), br = Mo.brightness(l.ratio);
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    const X0 = 70, X1 = 570, Y0 = 70, Y1 = 320;
    for (const [a, b, d, e] of [[X0, Y0, 190, Y0], [330, Y0, X1, Y0], [X1, Y0, X1, 150], [X1, 230, X1, Y1], [X1, Y1, 400, Y1], [300, Y1, X0, Y1], [X0, Y1, X0, Y0]] as number[][]) line(c, a, b, d, e, COL.ink, 4);
    // rheostat on the top left
    rect(c, 190, Y0 - 16, 140, 32, "#fff", COL.ink, 4, 6); const px = 190 + 140 * (s.Rp / 20); line(c, px, Y0 - 16, px, Y0 - 44, COL.red, 5); txt(c, "Rp", 260, Y0 - 62, 18, COL.ink);
    // bulb on the right, with glow
    const g = br === "off" ? 0 : Math.min(1, l.ratio / 1.5);
    if (g > 0) { const grad = c.createRadialGradient(X1, 190, 6, X1, 190, 20 + 60 * g); grad.addColorStop(0, `rgba(255,224,102,${0.9 * g})`); grad.addColorStop(1, "rgba(255,224,102,0)"); circle(c, X1, 190, 20 + 60 * g, "rgba(0,0,0,0)", null); c.beginPath(); c.arc(X1, 190, 20 + 60 * g, 0, Math.PI * 2); c.fillStyle = grad; c.fill(); }
    circle(c, X1, 190, 30, g > 0.05 ? `rgba(255,${Math.round(244 - 40 * g)},${Math.round(180 - 130 * g)},1)` : "#fff", COL.ink, 4); line(c, X1 - 14, 176, X1 + 14, 204, COL.ink, 3); line(c, X1 - 14, 204, X1 + 14, 176, COL.ink, 3);
    // ammeter (bottom, in series), voltmeter (across the bulb)
    circle(c, 350, Y1, 28, "#fff", COL.ink, 4); txt(c, "A", 350, Y1, 24, COL.ink);
    circle(c, 480, 190, 26, "#fff", COL.ink, 4); txt(c, "V", 480, 190, 22, COL.ink);
    line(c, X1, 150, 480, 150, COL.ink, 3); line(c, 480, 150, 480, 164, COL.ink, 3); line(c, 480, 216, 480, 230, COL.ink, 3); line(c, 480, 230, X1, 230, COL.ink, 3);
    // battery
    line(c, 160, Y1 - 18, 160, Y1 + 18, COL.ink, 6); line(c, 176, Y1 - 10, 176, Y1 + 10, COL.ink, 3); line(c, 192, Y1 - 18, 192, Y1 + 18, COL.ink, 6); line(c, 208, Y1 - 10, 208, Y1 + 10, COL.ink, 3);
    txt(c, `${fmt(l.U, 2)} V`, 480, 120, 20, COL.blue); txt(c, `${fmt(l.I, 2)} A`, 350, Y1 + 46, 20, COL.red);
  },
  tasks: [
    { id: "normal", text: "使小灯泡正常发光（电压表示数约等于额定电压）", check: (s) => Mo.brightness(sol(s).ratio) === "normal" },
    { id: "over", text: "使小灯泡的实际功率超过额定功率的 1.2 倍（实验中应避免）", check: (s) => sol(s).ratio > 1.2 },
    { id: "big", text: "换用 3.8 V 的灯泡，使它正常发光", check: (s) => s.bulb === 1 && Mo.brightness(sol(s).ratio) === "normal" },
    { id: "rec", text: "改变滑动变阻器，记录 3 组电压和电流的数据", check: (s) => s.n >= 3 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
