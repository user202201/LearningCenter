import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-population";
import { COL, lab, txt, circle, line, axes, curve } from "./draw";
export const meta = CATALOG.population;
type S = Record<string, number>;
const TMAX = 60;
const cache = new Map<string, Mo.Traj>();
export const lv = (s: S) => { const k = [s.a, s.b, s.c, s.d, s.x0, s.y0].join("|"); let r = cache.get(k); if (!r) { if (cache.size > 30) cache.clear(); r = Mo.simulate({ a: s.a, b: s.b, c: s.c, d: s.d }, s.x0, s.y0, TMAX); cache.set(k, r); } return r; };
const idx = (s: S) => Math.min(TMAX * 10, Math.round(s.T * 10));
export const def: SimDef = {
  meta,
  lesson: [
    "在一个生态系统中，捕食者和猎物的数量相互制约，呈周期性波动：猎物增多 → 捕食者增多 → 猎物减少 → 捕食者减少 → 猎物又增多。生态系统具有一定的自我调节能力，保持相对稳定的状态——生态平衡；但这种调节能力有限，过度捕杀或破坏会打破平衡。",
    "种群在资源有限的环境中呈“S”形增长，最终稳定在环境容纳量（K）附近；种群数量为 K/2 时增长最快。",
  ],
  formulas: ["\\dot x = a x - b x y,\\ \\dot y = d x y - c y", "N(t)=\\dfrac{K}{1+(K/N_0-1)e^{-rt}}"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "a", label: "猎物的增长率 a", min: 0.5, max: 1.5, step: 0.1, value: 1, dec: 1, when: (s) => s.mode === 0 },
    { id: "b", label: "被捕食系数 b", min: 0.05, max: 0.2, step: 0.01, value: 0.1, dec: 2, when: (s) => s.mode === 0 },
    { id: "c", label: "捕食者的死亡率 c", min: 0.2, max: 1, step: 0.1, value: 0.5, dec: 1, when: (s) => s.mode === 0 },
    { id: "d", label: "转化率 d", min: 0.01, max: 0.05, step: 0.01, value: 0.02, dec: 2, when: (s) => s.mode === 0 },
    { id: "x0", label: "猎物的初始数量", min: 5, max: 80, step: 1, value: 40, when: (s) => s.mode === 0 },
    { id: "y0", label: "捕食者的初始数量", min: 2, max: 40, step: 1, value: 9, when: (s) => s.mode === 0 },
    { id: "N0", label: "初始数量", min: 10, max: 500, step: 10, value: 20, when: (s) => s.mode === 1 },
    { id: "r", label: "增长率 r", min: 0.1, max: 1, step: 0.05, value: 0.5, dec: 2, when: (s) => s.mode === 1 },
    { id: "K", label: "环境容纳量 K", min: 200, max: 2000, step: 100, value: 1000, when: (s) => s.mode === 1 },
    { id: "T", label: "时间", min: 0, max: TMAX, step: 0.5, value: 0, dec: 1 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "捕食者与猎物"], [1, "种群的 S 形增长"]] }],
  play: { param: "T", rate: 6 },
  aspect: 0.62,
  readouts: (s) => { if (s.mode === 1) { const N = Mo.logistic(s.N0, s.r, s.K, s.T); return [
    { label: "种群数量", value: fmt(N, 0), unit: "只" }, { label: "环境容纳量 K", value: String(s.K), unit: "只" }, { label: "当前增长速率", value: fmt(Mo.growthRate(N, s.r, s.K), 1), unit: "只/单位时间" }, { label: "增长最快时的数量 K/2", value: String(s.K / 2), unit: "只" }]; }
    const tr = lv(s), i = idx(s), eq = Mo.equilibrium(s); return [
    { label: "猎物数量", value: fmt(tr.x[i], 0), unit: "只" }, { label: "捕食者数量", value: fmt(tr.y[i], 1), unit: "只" },
    { label: "平衡点（猎物，捕食者）", value: `${fmt(eq[0], 1)}，${fmt(eq[1], 1)}` }, { label: "小幅振荡的周期", value: fmt(Mo.period(s), 1) }]; },
  draw(c, w, h, s) {
    if (s.mode === 1) {
      const P = axes(c, 70, 40, 540, 290, TMAX, s.K * 1.15, "t", "N", 0, 4);
      line(c, P.X(0), P.Y(s.K), P.X(TMAX), P.Y(s.K), COL.orange, 2, [8, 6]); line(c, P.X(0), P.Y(s.K / 2), P.X(TMAX), P.Y(s.K / 2), COL.grey, 1.5, [4, 6]);
      curve(c, P, (x) => Mo.logistic(s.N0, s.r, s.K, x), COL.green, TMAX, 120); circle(c, P.X(s.T), P.Y(Mo.logistic(s.N0, s.r, s.K, s.T)), 8, COL.red, COL.ink, 3);
      txt(c, "K", 626, P.Y(s.K), 18, COL.orange, "left"); return;
    }
    const tr = lv(s), i = idx(s), ymax = Math.max(60, ...tr.x) * 1.05;
    const P = axes(c, 50, 40, 340, 290, TMAX, ymax, "t", "N", 0, 4);
    c.beginPath(); tr.t.forEach((t, k) => { const x = P.X(t), y = P.Y(tr.x[k]); if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.strokeStyle = COL.green; c.lineWidth = 4; c.stroke();
    c.beginPath(); tr.t.forEach((t, k) => { const x = P.X(t), y = P.Y(tr.y[k] * 3); if (k) c.lineTo(x, y); else c.moveTo(x, y); }); c.strokeStyle = COL.red; c.lineWidth = 4; c.stroke();
    line(c, P.X(s.T), P.Y(0), P.X(s.T), P.Y(ymax), COL.grey, 1.5, [4, 5]);
    lab(c, "猎物", 56, 22, 16, COL.green, "left"); lab(c, "捕食者（×3）", 130, 22, 16, COL.red, "left");
    const Q = axes(c, 440, 40, 180, 290, Math.max(...tr.x) * 1.1, Math.max(...tr.y) * 1.1, "prey", "pred", 0, 3);
    c.beginPath(); tr.x.forEach((x, k) => { const px = Q.X(x), py = Q.Y(tr.y[k]); if (k) c.lineTo(px, py); else c.moveTo(px, py); }); c.strokeStyle = COL.purple; c.lineWidth = 3; c.stroke();
    circle(c, Q.X(tr.x[i]), Q.Y(tr.y[i]), 7, COL.red, COL.ink, 3);
    const eq = Mo.equilibrium(s); if (eq[0] < Q.xmax && eq[1] < Q.ymax) circle(c, Q.X(eq[0]), Q.Y(eq[1]), 5, COL.ink, null);
  },
  tasks: [
    { id: "eq", text: "把两个种群的初始数量设在平衡点：数量几乎不再变化（先算 c/d 和 a/b）", check: (s) => s.mode === 0 && Math.abs(s.x0 - s.c / s.d) < 0.6 && Math.abs(s.y0 - s.a / s.b) < 0.6 },
    { id: "crash", text: "增大捕食系数 b，使猎物数量的最低值降到 5 只以下", check: (s) => s.mode === 0 && Math.min(...lv(s).x) < 5 },
    { id: "k90", text: "S 形增长：使种群数量达到环境容纳量的 90% 以上", check: (s) => s.mode === 1 && Mo.logistic(s.N0, s.r, s.K, s.T) >= 0.9 * s.K },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
