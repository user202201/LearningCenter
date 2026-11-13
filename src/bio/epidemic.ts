import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-epidemic";
import { COL, lab, txt, circle, line, axes, curve } from "./draw";
export const meta = CATALOG.epidemic;
type S = Record<string, number>;
const opt = (s: S): Mo.Opt => ({ R0: s.R0, iso: s.iso / 100, route: s.route / 100, vacc: s.vacc / 100 });
const cache = new Map<string, Mo.Epi>();
export const epi = (s: S) => { const k = [s.R0, s.iso, s.route, s.vacc].join("|"); let r = cache.get(k); if (!r) { if (cache.size > 40) cache.clear(); r = Mo.simulate(opt(s)); cache.set(k, r); } return r; };
const tb = (s: S) => s.tb;
export const def: SimDef = {
  meta,
  lesson: [
    "传染病由病原体引起，能在人与人之间或人与动物之间传播。流行的三个基本环节：传染源（能散播病原体的人或动物）、传播途径（空气、飞沫、饮水、食物、接触、媒介生物等）、易感人群。预防措施相应有三类：控制传染源、切断传播途径、保护易感人群。",
    "人体的免疫：病原体进入后，淋巴细胞产生抗体，抗体与抗原（病原体）特异性结合；之后保留记忆细胞，再次接触同一病原体时，产生抗体又快又多。接种疫苗就是让人在不得病的情况下获得这种免疫力。图中是一个简化的传播模型（S 易感者、I 感染者、R 康复或免疫者）。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }, { text: "相关：安全与急救", href: "#/science/notes" }],
  params: [
    { id: "R0", label: "基本传染数 R0", min: 1, max: 6, step: 0.5, value: 2.5, dec: 1, when: (s) => s.mode === 0 },
    { id: "iso", label: "隔离患者（控制传染源）", min: 0, max: 90, step: 10, value: 0, unit: "%", when: (s) => s.mode === 0 },
    { id: "route", label: "切断传播途径（口罩、消毒）", min: 0, max: 90, step: 10, value: 0, unit: "%", when: (s) => s.mode === 0 },
    { id: "vacc", label: "接种疫苗（保护易感人群）", min: 0, max: 90, step: 10, value: 0, unit: "%", when: (s) => s.mode === 0 },
    { id: "tb", label: "第二次接触病原体（或加强针）的时间", min: 7, max: 60, step: 1, value: 7, unit: "天", when: (s) => s.mode === 1 },
    { id: "t", label: "时间", min: 0, max: 120, step: 5, value: 0, unit: "天" },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "传染病的传播"], [1, "抗体与接种"]] }],
  play: { param: "t", rate: 12 },
  aspect: 0.62,
  readouts: (s) => { if (s.mode === 1) return [
    { label: "此刻的抗体量", value: fmt(Mo.titre(s.t, tb(s)), 2), unit: "相对值" }, { label: "第一次接触后的抗体峰值", value: "1", unit: "相对值" }, { label: "再次接触后的抗体峰值", value: "10", unit: "相对值" }];
    const e = epi(s), p = Mo.peak(e), i = Math.min(120, s.t); return [
    { label: "有效传染数 Reff", value: fmt(Mo.reff(opt(s)), 2) }, { label: "群体免疫阈值", value: fmt(Mo.herd(s.R0) * 100, 0), unit: "%" },
    { label: "感染人数峰值", value: fmt(p.v, 0), unit: "人" }, { label: "此刻感染者", value: fmt(e.I[i], 0), unit: "人" }]; },
  draw(c, w, h, s) {
    if (s.mode === 1) {
      const P = axes(c, 70, 40, 540, 290, 120, 11, "day", "antibody", 0, 4);
      curve(c, P, (x) => Mo.titre(x, tb(s)), COL.blue, 120, 240); line(c, P.X(tb(s)), P.Y(0), P.X(tb(s)), P.Y(11), COL.orange, 2, [6, 5]); lab(c, "再次接触", P.X(tb(s)) + 4, 50, 16, COL.orange, "left");
      circle(c, P.X(s.t), P.Y(Mo.titre(s.t, tb(s))), 7, COL.red, COL.ink, 3);
      txt(c, "1", P.X(14), P.Y(1) - 14, 16, COL.grey); return;
    }
    const e = epi(s), P = axes(c, 70, 40, 540, 290, 120, Mo.POP, "day", "N", 0, 4);
    for (const [arr, col] of [[e.S, COL.blue], [e.I, COL.red], [e.R, COL.green]] as [number[], string][]) { c.beginPath(); arr.slice(0, 121).forEach((v, k) => { const x = P.X(k), y = P.Y(v); if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.strokeStyle = col; c.lineWidth = 4; c.stroke(); }
    const i = Math.min(120, s.t); line(c, P.X(i), P.Y(0), P.X(i), P.Y(Mo.POP), COL.grey, 1.5, [4, 5]);
    for (const [arr, col] of [[e.S, COL.blue], [e.I, COL.red], [e.R, COL.green]] as [number[], string][]) circle(c, P.X(i), P.Y(arr[i]), 6, col, COL.ink, 2);
    lab(c, "易感者 S", 76, 24, 16, COL.blue, "left"); lab(c, "感染者 I", 190, 24, 16, COL.red, "left"); lab(c, "康复或免疫者 R", 300, 24, 16, COL.green, "left");
  },
  tasks: [
    { id: "herd", text: "只靠接种疫苗（不隔离、不切断途径），使有效传染数 Reff 降到 1 以下，疫情不再扩大", check: (s) => s.mode === 0 && s.iso === 0 && s.route === 0 && Mo.reff(opt(s)) <= 1 },
    { id: "flat", text: "接种不超过 30%：用隔离和切断途径，使感染人数峰值低于 100 人（总人口 1000）", check: (s) => s.mode === 0 && s.vacc <= 30 && (s.iso > 0 || s.route > 0) && Mo.peak(epi(s)).v < 100 },
    { id: "boost", text: "把第二次接触的时间推迟到 14 天以后：再次反应的抗体量大约是第一次的 10 倍", check: (s) => s.mode === 1 && s.tb >= 14 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
