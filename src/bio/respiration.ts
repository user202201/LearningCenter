import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-respiration";
import { COL, lab, txt, circle, ell, rect, line, arrow, axes, curve } from "./draw";
export const meta = CATALOG.respiration;
const isDay = (t: number) => Mo.light(t) > 0;
export const def: SimDef = {
  meta,
  lesson: [
    "呼吸作用：活细胞在线粒体中利用氧，把有机物分解成二氧化碳和水，并释放能量，白天和夜晚都在进行。光合作用只在有光时进行。白天光合作用强于呼吸作用，植物释放氧气；夜晚只有呼吸作用，植物吸收氧气、放出二氧化碳。",
    "温度升高，酶的活性增大，呼吸作用增强（模型：温度每升高 10 °C，速率约为原来的 2 倍）。萌发的种子呼吸旺盛，放出的二氧化碳使澄清石灰水变浑浊。",
  ],
  formulas: ["\\text{有机物 + 氧气} \\to \\text{二氧化碳 + 水 + 能量}"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "t", label: "一天中的时刻", min: 0, max: 24, step: 0.25, value: 12, unit: "时", when: (s) => s.exp === 0 },
    { id: "T", label: "温度", min: 0, max: 40, step: 1, value: 20, unit: "°C" },
    { id: "mass", label: "种子质量", min: 10, max: 100, step: 10, value: 50, unit: "g", when: (s) => s.exp === 1 },
    { id: "min", label: "时间", min: 0, max: 60, step: 5, value: 0, unit: "分钟", when: (s) => s.exp === 1 },
  ],
  choices: [
    { id: "exp", label: "实验", value: 0, options: [[0, "植物的昼夜气体交换"], [1, "种子的呼吸"]] },
    { id: "cover", label: "植物", value: 0, options: [[0, "见光"], [1, "全天用黑袋罩住"]], when: (s) => s.exp === 0 },
    { id: "live", label: "种子", value: 1, options: [[1, "萌发的种子"], [0, "煮熟的种子"]], when: (s) => s.exp === 1 },
  ],
  play: { param: "t", rate: 2.4, loop: true },
  aspect: 0.6,
  readouts: (s) => s.exp === 0 ? [
    { label: "光合速率", value: fmt(Mo.ps(s.t, s.cover), 1), unit: "个单位" },
    { label: "呼吸速率", value: fmt(Mo.resp(s.T), 1), unit: "个单位" },
    { label: "净氧气释放", value: fmt(Mo.net(s.t, s.T, s.cover), 1), unit: "个单位" },
    { label: "全天净积累", value: fmt(Mo.daily(s.T, s.cover), 0), unit: "个单位" }] : [
    { label: "二氧化碳", value: fmt(Mo.co2(s.mass, s.min, s.T, s.live), 0), unit: "mL" },
    { label: "石灰水浑浊度", value: fmt(Mo.turbidity(Mo.co2(s.mass, s.min, s.T, s.live)) * 100, 0), unit: "%" }],
  draw(c, w, h, s) {
    if (s.exp === 0) {
      const day = isDay(s.t);
      rect(c, 10, 10, 290, 360, day ? "#d0ebff" : "#1c2541", "#adb5bd", 2, 18);
      if (day) circle(c, 250, 55, 24, "#ffd43b", COL.orange, 3); else { circle(c, 250, 55, 20, "#f8f9fa", "#adb5bd", 2); circle(c, 258, 50, 17, "#1c2541", null); }
      rect(c, 10, 320, 290, 50, "#a9815a", "#7b5a3a", 2, 8); line(c, 155, 325, 155, 150, COL.leaf2, 8);
      for (const [dx, dy, a] of [[-50, 200, 0.5], [50, 230, -0.5], [-40, 270, 0.4], [45, 160, -0.4], [0, 125, 0]]) ell(c, 155 + dx, dy, 44, 14, COL.leaf, COL.leaf2, 3, a);
      const ink = day ? COL.ink : "#e9ecef";
      if (day) { arrow(c, 30, 120, 90, 160, COL.purple, 4); txt(c, "CO2", 40, 105, 18, COL.purple); arrow(c, 230, 160, 285, 110, COL.blue, 4); txt(c, "O2", 270, 100, 18, COL.blue); }
      else { arrow(c, 30, 160, 90, 190, COL.blue, 4); txt(c, "O2", 38, 146, 18, "#a5d8ff"); arrow(c, 230, 190, 285, 140, COL.purple, 4); txt(c, "CO2", 262, 128, 18, "#d0bfff"); }
      lab(c, day ? "白天" : "夜晚", 26, 36, 22, ink, "left");
      const P = axes(c, 360, 50, 260, 240, 24, 45, "t (h)", "units", -15, 4);
      curve(c, P, (x) => Mo.ps(x, s.cover), COL.green, 24, 120); line(c, P.X(0), P.Y(Mo.resp(s.T)), P.X(24), P.Y(Mo.resp(s.T)), COL.red, 3, [6, 5]);
      curve(c, P, (x) => Mo.net(x, s.T, s.cover), COL.ink, 24, 120, 3);
      line(c, P.X(s.t), P.Y(-15), P.X(s.t), P.Y(30), COL.orange, 3); circle(c, P.X(s.t), P.Y(Mo.net(s.t, s.T, s.cover)), 7, COL.orange, COL.ink, 2);
    } else {
      rect(c, 40, 100, 150, 220, "#e7f5ff", COL.ink, 4, 14); for (let i = 0; i < 14; i++) ell(c, 70 + (i % 5) * 24, 270 - Math.floor(i / 5) * 24, 10, 7, s.live ? "#f1e0b0" : "#a67c52", COL.ink, 2, 0.5);
      line(c, 190, 120, 330, 120, COL.grey, 6); line(c, 330, 120, 330, 300, COL.grey, 6);
      rect(c, 280, 220, 150, 130, "#f8f9fa", COL.ink, 4, 12);
      const tb = Mo.turbidity(Mo.co2(s.mass, s.min, s.T, s.live));
      rect(c, 284, 240, 142, 106, `rgba(${255 - Math.round(70 * tb)},${255 - Math.round(60 * tb)},${255 - Math.round(50 * tb)},${0.35 + 0.6 * tb})`, null, 0, 8);
      lab(c, "澄清石灰水", 355, 205, 18, COL.grey);
      for (let i = 0; i < Math.round(tb * 8); i++) circle(c, 310 + (i * 31) % 100, 340 - ((i * 47) % 80), 4, "#fff", "#4dabf7", 2);
      lab(c, s.live ? "萌发的种子" : "煮熟的种子", 115, 80, 18, COL.ink);
    }
  },
  tasks: [
    { id: "night", text: "把时刻调到夜间：植物净吸收氧气（净氧气释放为负）", check: (s) => s.exp === 0 && !isDay(s.t) && Mo.net(s.t, s.T, s.cover) < 0 },
    { id: "comp", text: "找到补偿点：光合速率与呼吸速率几乎相等（相差不到 0.6 个单位）", check: (s) => s.exp === 0 && s.cover === 0 && isDay(s.t) && Math.abs(Mo.net(s.t, s.T, 0)) <= 0.6 },
    { id: "warm", text: "把温度升到 30 °C 以上：呼吸速率达到 20 °C 时的 2 倍以上", check: (s) => Mo.resp(s.T) >= 2 * Mo.resp(20) - 1e-9 },
    { id: "lime", text: "萌发的种子呼吸 30 分钟以上，石灰水明显变浑浊（浑浊度 50% 以上）", check: (s) => s.exp === 1 && s.live === 1 && Mo.turbidity(Mo.co2(s.mass, s.min, s.T, 1)) >= 0.5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
