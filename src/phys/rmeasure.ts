import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-rmeasure";
import { COL, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.rmeasure;
type S = Record<string, number>;
const L = (s: S) => Mo.lab(s.target, s.rx, s.Rp);
const rows = (s: S) => Array.from({ length: s.n }, (_, i) => ({ U: s[`u${i}`], I: s[`i${i}`], R: s[`u${i}`] / s[`i${i}`] }));
const hidden: S = { n: 0 }; for (let i = 0; i < Mo.MAXROWS; i++) { hidden[`u${i}`] = 0; hidden[`i${i}`] = 0; }
export const def: SimDef = {
  meta,
  lesson: [
    "伏安法测电阻的原理是 R = U / I：用电压表测出电阻两端的电压 U，用电流表测出通过它的电流 I，就可以算出电阻。电流表与待测电阻串联，电压表与待测电阻并联；滑动变阻器与待测电阻串联，用来改变电路中的电流，多测几组数据。连接电路时开关要断开，滑片放在阻值最大处。",
    "测定值电阻时，多次测量求平均值可以减小误差。测小灯泡的电阻时，不同电压下灯丝的温度不同，电阻也不同：电压越大，灯丝越热，电阻越大，所以不能求平均值。本实验里电流表按 0.02 A 读数，电压表按 0.1 V 读数，读数和真实值有微小的差别，这是正常的。",
  ],
  formulas: ["R=\\dfrac{U}{I}"],
  params: [{ id: "Rp", label: "滑动变阻器接入电路的电阻", min: 0, max: 20, step: 0.5, value: 10, unit: "Ω" }],
  choices: [
    { id: "target", label: "被测的对象", value: 0, options: [[0, "定值电阻"], [1, "小灯泡（2.5 V）"]] },
    { id: "rx", label: "定值电阻", value: 1, options: Mo.RX.map((v, i) => [i, `${v} Ω`] as [number, string]), when: (s) => s.target === 0 },
  ],
  hidden,
  actions: [
    { id: "rec", label: "记录这组数据", run: (s) => { if (s.n >= Mo.MAXROWS) return; const l = L(s); if (l.Iread <= 0) return; for (const r of rows(s)) if (r.U === l.Uread && r.I === l.Iread) return; return { n: s.n + 1, [`u${s.n}`]: l.Uread, [`i${s.n}`]: l.Iread }; } },
    { id: "clear", label: "清除记录", run: () => ({ n: 0 }) },
  ],
  derive: (s, ch) => { if (ch === "target" || ch === "rx") s.n = 0; },
  aspect: 0.62,
  readouts: (s) => {
    const l = L(s), out: { label: string; value: string; unit?: string }[] = [{ label: "电压表的示数", value: fmt(l.Uread, 1), unit: "V" }, { label: "电流表的示数", value: fmt(l.Iread, 2), unit: "A" }, { label: "R = U / I", value: l.Iread > 0 ? fmt(l.R, 1) : "—", unit: l.Iread > 0 ? "Ω" : "" }];
    rows(s).forEach((r, i) => out.push({ label: `第 ${i + 1} 组`, value: `U = ${fmt(r.U, 1)} V，I = ${fmt(r.I, 2)} A，R = ${fmt(r.R, 1)} Ω` }));
    if (s.n >= 2) out.push(s.target === 0 ? { label: "电阻的平均值", value: fmt(Mo.mean(rows(s).map((r) => r.R)), 1), unit: "Ω" } : { label: "灯丝的电阻", value: "随电压增大而增大，不能求平均值" });
    return out;
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    const l = L(s);
    rect(c, 80, 80, 480, 240, "rgba(0,0,0,0)", COL.ink, 4, 14);
    rect(c, 110, 62, 50, 36, COL.yellow, COL.ink, 3, 6); txt(c, "E", 135, 80, 20, COL.ink);
    rect(c, 230, 62, 90, 36, "#e9ecef", COL.ink, 3, 6); txt(c, "RP", 275, 80, 20, COL.ink);
    circle(c, 480, 80, 24, "#fff", COL.ink, 4); txt(c, "A", 480, 80, 22, COL.blue);
    if (s.target === 0) { rect(c, 250, 302, 130, 36, "#ffd8a8", COL.ink, 3, 6); txt(c, `${Mo.RX[s.rx]} ohm`, 315, 320, 20, COL.ink); }
    else { circle(c, 315, 320, 26, `rgba(255,224,102,${Math.min(1, l.I / 0.3)})`, COL.ink, 4); txt(c, "L", 315, 320, 20, COL.ink); }
    line(c, 250, 320, 250, 250, COL.ink, 2); line(c, 380, 320, 380, 250, COL.ink, 2); circle(c, 315, 250, 26, "#fff", COL.ink, 4); txt(c, "V", 315, 250, 22, COL.red); line(c, 250, 250, 289, 250, COL.ink, 2); line(c, 341, 250, 380, 250, COL.ink, 2);
    txt(c, `${fmt(l.Uread, 1)} V`, 130, 190, 28, COL.red); txt(c, `${fmt(l.Iread, 2)} A`, 480, 190, 28, COL.blue);
    txt(c, l.Iread > 0 ? `R = ${fmt(l.R, 1)} ohm` : "R = -", 315, 170, 30, COL.green);
  },
  tasks: [
    { id: "rec3", text: "记录至少 3 组读数", check: (s) => s.n >= 3 },
    { id: "avg", text: "测定值电阻：记录 3 组读数，算出的平均值与它的阻值相差不超过 10 %", check: (s) => s.target === 0 && s.n >= 3 && Math.abs(Mo.mean(rows(s).map((r) => r.R)) / Mo.RX[s.rx] - 1) <= 0.1 },
    { id: "bulb", text: "测小灯泡的电阻：记录两组读数，电压较大的一组电阻也较大", check: (s) => s.target === 1 && rows(s).some((a) => rows(s).some((b) => a.U > b.U + 0.5 && a.R > b.R)) },
    { id: "normal", text: "测小灯泡的电阻：使小灯泡两端的电压是 2.5 V（正常发光）", check: (s) => s.target === 1 && Math.abs(L(s).Uread - Mo.bulbNominal) < 0.05 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
