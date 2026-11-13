import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-ferment";
import { COL, lab, txt, circle, ell, rect, line, axes, curve } from "./draw";
export const meta = CATALOG.ferment;
type S = Record<string, number>;
const gas = (s: S) => Mo.gasTotal(s.sugar, s.T, s.yeast, s.t);
export const def: SimDef = {
  meta,
  lesson: [
    "微生物包括细菌、真菌和病毒。酵母菌是单细胞真菌，在无氧条件下分解葡萄糖，产生酒精和二氧化碳，用于酿酒和蒸馒头；乳酸菌产生乳酸，用于制酸奶和泡菜；醋酸菌产生醋酸。发酵需要适宜的温度：温度过高会杀死微生物。",
    "细菌通过分裂繁殖，生长曲线有延缓期、对数期、稳定期和衰亡期四个时期。在适宜条件下，大肠杆菌约 20 分钟分裂一次。",
  ],
  formulas: ["C_6H_{12}O_6 \\to 2C_2H_5OH + 2CO_2"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "sugar", label: "糖的浓度", min: 0, max: 20, step: 1, value: 5, unit: "%", when: (s) => s.mode === 0 },
    { id: "yeast", label: "酵母菌的量", min: 1, max: 10, step: 1, value: 2, unit: "g", when: (s) => s.mode === 0 },
    { id: "T", label: "温度", min: 0, max: 70, step: 1, value: 20, unit: "°C" },
    { id: "t", label: "时间", min: 0, max: 60, step: 1, value: 0, unit: "分钟", when: (s) => s.mode === 0 },
    { id: "hours", label: "培养时间", min: 0, max: 14, step: 0.5, value: 0, unit: "小时", when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "酵母菌发酵"], [1, "细菌的生长曲线"]] }],
  play: { param: "hours", rate: 1.5 },
  aspect: 0.62,
  readouts: (s) => s.mode === 0 ? [
    { label: "产生气体的速率", value: fmt(Mo.gasRate(s.sugar, s.T, s.yeast), 1), unit: "mL/分钟" }, { label: "累计的二氧化碳", value: fmt(gas(s), 0), unit: "mL" },
    { label: "酒精", value: fmt(Mo.ethanol(gas(s)), 2), unit: "g" }] : (() => { const b = Mo.bacteria(s.T, s.hours); return [
    { label: "细菌数量", value: b.N >= 1e4 ? b.N.toExponential(2).replace("e+", " × 10^") : fmt(b.N, 0), unit: "个" }, { label: "所处时期", value: b.phase }, { label: "分裂次数", value: fmt(b.divisions, 1), unit: "次" },
    { label: "分裂一次所需时间", value: Number.isFinite(Mo.doubling(s.T)) ? fmt(Mo.doubling(s.T), 0) : "不能生长", unit: Number.isFinite(Mo.doubling(s.T)) ? "分钟" : "" }]; })(),
  draw(c, w, h, s) {
    if (s.mode === 0) {
      ell(c, 150, 280, 90, 85, "#fff3bf", COL.ink, 4); rect(c, 125, 150, 50, 70, "#fff3bf", COL.ink, 4, 4);
      const g = gas(s), r = 6 + Math.cbrt(g) * 6;
      ell(c, 150, 130 - r / 2, r, r * 1.15, "#ffc9c9", COL.ink, 4); line(c, 150, 130, 150, 150, COL.ink, 4);
      const nb = Math.round(Mo.gasRate(s.sugar, s.T, s.yeast) * 1.2);
      for (let i = 0; i < Math.min(14, nb); i++) circle(c, 110 + ((i * 37) % 80), 340 - ((i * 53) % 110), 3 + (i % 3), "#fff", "#4dabf7", 2);
      for (let i = 0; i < 18; i++) circle(c, 100 + ((i * 41) % 100), 310 + ((i * 29) % 40), 3, "#e8c26b", null);
      txt(c, `${s.T}°C`, 150, 385, 18, COL.red);
      const P = axes(c, 340, 50, 280, 240, 60, Math.max(40, Mo.gasCap(s.sugar) * 0 + Mo.gasRate(s.sugar, s.T, s.yeast) * 60 * 1.1), "t", "CO2 mL", 0, 4);
      curve(c, P, (x) => Mo.gasTotal(s.sugar, s.T, s.yeast, x), COL.blue, 60, 60); circle(c, P.X(s.t), P.Y(gas(s)), 7, COL.red, COL.ink, 3);
    } else {
      const P = axes(c, 70, 40, 540, 290, 14, 10, "hours", "log10 N", 0, 4);
      curve(c, P, (x) => Math.log10(Math.max(1, Mo.bacteria(s.T, x).N)), COL.green, 14, 160);
      const b = Mo.bacteria(s.T, s.hours); circle(c, P.X(s.hours), P.Y(Math.log10(b.N)), 8, COL.red, COL.ink, 3);
      lab(c, b.phase, 90, 60, 20, COL.purple, "left");
    }
  },
  tasks: [
    { id: "bubbles", text: "30–40 °C、糖的浓度 5% 以上、酵母菌 2 g 以上：发酵 30 分钟，累计二氧化碳超过 60 mL（气球鼓起）", check: (s) => s.mode === 0 && s.T >= 30 && s.T <= 40 && s.sugar >= 5 && s.yeast >= 2 && s.t >= 30 && gas(s) > 60 },
    { id: "hot", text: "把温度升到 65 °C 以上：发酵 10 分钟后没有气体（酵母菌被杀死）", check: (s) => s.mode === 0 && s.T >= 65 && s.sugar >= 5 && s.t >= 10 && gas(s) === 0 },
    { id: "log", text: "细菌在 37 °C 下培养：找到对数期（数量迅速增加）", check: (s) => s.mode === 1 && s.T === 37 && Mo.bacteria(s.T, s.hours).phase === "对数期" },
    { id: "death", text: "37 °C 下继续培养，找到衰亡期", check: (s) => s.mode === 1 && s.T === 37 && Mo.bacteria(s.T, s.hours).phase === "衰亡期" },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
