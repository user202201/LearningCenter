import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-hormone";
import { COL, lab, txt, circle, line, rect, axes } from "./draw";
export const meta = CATALOG.hormone;
const cache = new Map<string, Mo.Run>();
const run = (s: Record<string, number>) => { const k = `${s.carbs}|${s.dia}|${s.dose}`; let r = cache.get(k); if (!r) { if (cache.size > 40) cache.clear(); r = Mo.simulate(s.carbs, s.dia, s.dose); cache.set(k, r); } return r; };
export const def: SimDef = {
  meta,
  lesson: [
    "人体的激素由内分泌腺分泌，直接进入血液，含量很少，作用很大。胰岛分泌的胰岛素能调节糖的吸收、利用和转化，使血糖浓度降低并保持稳定（正常空腹约 3.9–6.1 mmol/L）。",
    "胰岛素分泌不足会患糖尿病：餐后血糖明显升高，超过肾脏的限度时尿中会出现葡萄糖，可以注射胰岛素治疗。图中为简化的模型，仅用于理解变化趋势。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "carbs", label: "一餐摄入的糖类", min: 0, max: 150, step: 10, value: 50, unit: "g" },
    { id: "dose", label: "注射胰岛素", min: 0, max: 100, step: 10, value: 0, unit: "单位" },
    { id: "t", label: "进餐后的时间", min: 0, max: 240, step: 5, value: 60, unit: "分钟" },
  ],
  choices: [{ id: "dia", label: "胰岛功能", value: 0, options: [[0, "正常"], [1, "胰岛素分泌不足（糖尿病）"]] }],
  play: { param: "t", rate: 30 },
  aspect: 0.62,
  readouts: (s) => { const r = run(s), g = r.G[s.t], p = Mo.peak(r); return [
    { label: "此刻的血糖", value: fmt(g, 1), unit: "mmol/L" }, { label: "此刻的血液胰岛素", value: fmt(r.I[s.t], 0), unit: "mU/L" },
    { label: "餐后血糖峰值", value: fmt(p.v, 1), unit: "mmol/L" }, { label: "尿中是否出现葡萄糖", value: p.v > Mo.KIDNEY ? "会出现" : "不会出现" }]; },
  draw(c, w, h, s) {
    const r = run(s);
    const P = axes(c, 70, 30, 540, 170, 240, 16, "t (min)", "G (mmol/L)", 0, 4);
    c.fillStyle = "rgba(81,207,102,0.2)"; c.fillRect(P.X(0), P.Y(Mo.NORMAL[1]), P.w, P.Y(Mo.NORMAL[0]) - P.Y(Mo.NORMAL[1]));
    line(c, P.X(0), P.Y(Mo.KIDNEY), P.X(240), P.Y(Mo.KIDNEY), COL.orange, 2, [8, 6]);
    c.beginPath(); r.G.forEach((g, i) => { const x = P.X(i), y = P.Y(Math.min(16, g)); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.strokeStyle = COL.red; c.lineWidth = 4; c.stroke();
    circle(c, P.X(s.t), P.Y(Math.min(16, r.G[s.t])), 7, COL.red, COL.ink, 3); line(c, P.X(s.t), P.Y(0), P.X(s.t), P.Y(16), COL.grey, 1.5, [4, 5]);
    const Q = axes(c, 70, 250, 540, 100, 240, 100, "t (min)", "I (mU/L)", 0, 4);
    c.beginPath(); r.I.forEach((v, i) => { const x = Q.X(i), y = Q.Y(Math.min(100, v)); if (i) c.lineTo(x, y); else c.moveTo(x, y); }); c.strokeStyle = COL.blue; c.lineWidth = 4; c.stroke();
    circle(c, Q.X(s.t), Q.Y(Math.min(100, r.I[s.t])), 7, COL.blue, COL.ink, 3);
    lab(c, "血糖", 80, 18, 18, COL.red, "left"); lab(c, "胰岛素", 80, 238, 18, COL.blue, "left"); lab(c, "尿糖线", 610, P.Y(Mo.KIDNEY) - 10, 14, COL.orange, "right");
  },
  tasks: [
    { id: "meal", text: "健康的人吃 100 g 糖类：3 小时（180 分钟）后血糖回到 7.8 mmol/L 以下", check: (s) => s.dia === 0 && s.carbs >= 100 && run(s).G[180] < 7.8 },
    { id: "diab", text: "选择“胰岛素分泌不足”，不注射胰岛素：血糖峰值超过 11 mmol/L", check: (s) => s.dia === 1 && s.dose === 0 && Mo.peak(run(s)).v > 11 },
    { id: "inject", text: "胰岛素分泌不足的人吃 50 g 糖类，注射胰岛素使血糖峰值降到 9 mmol/L 以下", check: (s) => s.dia === 1 && s.carbs >= 50 && Mo.peak(run(s)).v < 9 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
