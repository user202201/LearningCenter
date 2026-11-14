import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-molecule";
import { COL, arrow, axes, circle, curve, line, rect, txt } from "./draw";

export const meta = CATALOG.molecule;
const hash = (i: number, k: number) => { const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
const ARR = ["排列整齐，位置固定", "排列较紧密，没有固定的位置", "彼此相距很远，没有固定的位置"];
const MOVE = ["在平衡位置附近振动", "可以移动，位置不固定", "自由地做无规则运动"];
const FORCE = ["作用力很大", "作用力较大", "作用力极小"];
const SHAPE = ["有固定的形状和体积", "没有固定的形状，有一定的体积", "没有固定的形状和体积"];
export const def: SimDef = {
  meta,
  lesson: [
    "物质是由分子（或原子）组成的，分子很小，直径约 10⁻¹⁰ m 的数量级。一切物质的分子都在不停地做无规则运动，这种运动叫热运动：温度越高，分子的热运动越剧烈。扩散现象（墨水在水中散开、闻到气味）是分子运动的证据，温度越高，扩散越快。",
    "分子之间同时存在相互作用的引力和斥力。距离等于 r₀ 时引力和斥力相等；距离小于 r₀ 时斥力占主要，距离大于 r₀ 时引力占主要，距离超过分子直径的约 10 倍时，作用力可以忽略（气体容易被压缩、固体难以被拉断都与此有关）。",
    "固体分子排列整齐，在平衡位置附近振动；液体分子排列较紧密、无规则，可以移动；气体分子间距很大，作用力极小，可以自由运动。本实验的扩散画面是模型：为了看得清楚，用的温度范围较大，分子数较少。",
  ],
  params: [
    { id: "T", label: "温度", min: 0, max: 500, step: 10, value: 20, unit: "°C", when: (s) => s.mode !== 1 },
    { id: "t", label: "时间", min: 0, max: 60, step: 1, value: 0, unit: "s", when: (s) => s.mode !== 1 },
    { id: "x", label: "两个分子之间的距离（单位 r₀）", min: 0.7, max: 3.5, step: 0.05, value: 1.5, when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "扩散"], [1, "分子间的作用力"], [2, "物质的三态"]] },
    { id: "state", label: "物态", value: 0, options: Mo.STATES.map((n, i) => [i, n] as [number, string]), when: (s) => s.mode === 2 },
  ],
  play: { param: "t", rate: 4 },
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const m = Mo.mixing(s.T, s.t); return [{ label: "两种分子混合的程度", value: fmt(m, 0), unit: "%" }, { label: "温度", value: fmt(s.T, 0), unit: "°C" }, { label: "每步的移动（20 °C 时为 1）", value: fmt(Mo.stepSize(s.T) / Mo.STEP, 2) }, { label: "已经过的时间", value: fmt(s.t, 0), unit: "s" }]; }
    if (s.mode === 1) { const f = Mo.force(s.x), k = Mo.kind(s.x); return [{ label: "分子间的距离", value: fmt(s.x, 2), unit: "r₀" }, { label: "作用力（相对值，正为斥力）", value: fmt(f, 2) }, { label: "表现为", value: k === "repel" ? "斥力" : k === "attract" ? "引力" : "引力等于斥力" }]; }
    return [{ label: "排列", value: ARR[s.state] }, { label: "运动", value: MOVE[s.state] }, { label: "分子间的作用力", value: FORCE[s.state] }, { label: "形状和体积", value: SHAPE[s.state] }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const cl = Mo.walk(s.T, Math.round(s.t * 10)), X = (u: number) => 40 + u * 280, Y = (u: number) => 60 + u * 280;
      rect(c, 40, 60, 560, 280, "#fff", COL.ink, 4, 8);
      for (let i = 0; i < Mo.NP; i++) { circle(c, X(cl.rx[i]), Y(cl.ry[i]), 7, COL.red, null); circle(c, X(cl.bx[i]), Y(cl.by[i]), 7, COL.blue, null); }
      if (s.t === 0) line(c, 320, 60, 320, 340, COL.grey, 3, [6, 6]);
      txt(c, `${fmt(Mo.mixing(s.T, s.t), 0)} %`, 320, 30, 26, COL.purple);
      return;
    }
    if (s.mode === 1) {
      const P = axes(c, 60, 40, 520, 280, 3.5, 4, "r / r0", "F", -1, 4);
      const f = (x: number) => Math.max(-1, Math.min(4, Mo.force(x)));
      c.beginPath(); let first = true; for (let i = 0; i <= 200; i++) { const x = 0.7 + (2.8 * i) / 200; const px = P.X(x), py = P.Y(f(x)); if (first) { c.moveTo(px, py); first = false; } else c.lineTo(px, py); } c.strokeStyle = COL.purple; c.lineWidth = 4; c.stroke();
      void curve;
      circle(c, P.X(s.x), P.Y(f(s.x)), 9, COL.red);
      const gap = 30 + s.x * 40; circle(c, 320 - gap / 2, 360, 14, COL.blue); circle(c, 320 + gap / 2, 360, 14, COL.blue);
      const fo = Mo.force(s.x); if (Math.abs(fo) > 0.02) { const L = Math.min(50, 8 + Math.abs(fo) * 20), dir = fo > 0 ? -1 : 1; arrow(c, 320 - gap / 2, 360, 320 - gap / 2 + dir * L, 360, COL.red, 4); arrow(c, 320 + gap / 2, 360, 320 + gap / 2 - dir * L, 360, COL.red, 4); }
      return;
    }
    const sp = Mo.spacing[s.state], amp = (0.4 + s.T / 500 * 1.6) * (s.state === 0 ? 3 : s.state === 1 ? 7 : 0);
    rect(c, 60, 40, 520, 320, "#fff", COL.ink, 4, 8);
    for (let i = 0; i < 40; i++) {
      const col = i % 8, row = Math.floor(i / 8);
      let x: number, y: number;
      if (s.state === 2) { const bx = 90 + hash(i, 1) * 460, by = 70 + hash(i, 2) * 260, a = 18 + s.T * 0.12; x = bx + a * Math.sin(s.t * 1.3 + i * 2.1); y = by + a * Math.cos(s.t * 1.1 + i * 1.7); }
      else { const dx = 56 * sp * (s.state === 1 ? 1 : 1), jx = s.state === 1 ? (hash(i, 3) - 0.5) * 30 : 0, jy = s.state === 1 ? (hash(i, 4) - 0.5) * 30 : 0; x = 320 + (col - 3.5) * dx + jx + amp * Math.sin(s.t * 2 + i * 1.9); y = 200 + (row - 2) * dx * (s.state === 1 ? 0.95 : 1) + jy + amp * Math.cos(s.t * 2.3 + i * 1.3); }
      circle(c, x, y, 12, s.state === 0 ? COL.blue : s.state === 1 ? COL.teal : COL.orange);
    }
  },
  tasks: [
    { id: "hot", text: "扩散：把温度升高到 400 °C 以上，让两种分子在 30 s 内混合到 90% 以上", check: (s) => s.mode === 0 && s.T >= 400 && s.t <= 30 && Mo.mixing(s.T, s.t) >= 90 },
    { id: "balance", text: "分子间的作用力：使分子之间的距离等于 r₀，引力等于斥力", check: (s) => s.mode === 1 && Mo.kind(s.x) === "balance" },
    { id: "repel", text: "分子间的作用力：使分子表现为斥力", check: (s) => s.mode === 1 && Mo.kind(s.x) === "repel" },
    { id: "gas", text: "物质的三态：选择气态，观察分子的自由运动", check: (s) => s.mode === 2 && s.state === 2 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
