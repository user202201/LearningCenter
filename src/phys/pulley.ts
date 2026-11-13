import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-pulley";
import { COL, arrow, circle, line, poly, rect, txt } from "./draw";

export const meta = CATALOG.pulley;
const calc = (s: Record<string, number>) => (s.mode === 0 ? Mo.pulley(s.n, s.G, s.Gm, s.fric, s.h) : Mo.incline(s.G, s.alpha, s.mu));
export const def: SimDef = {
  meta,
  lesson: [
    "滑轮组由定滑轮和动滑轮组成：承担重物的绳子段数为 n，不计摩擦时 F = (G + G动) / n，绳子自由端移动的距离 s = nh。省力的同时要多移动距离，使用任何机械都不省功。",
    "有用功 W有 = Gh，总功 W总 = Fs，机械效率 η = W有 / W总，总小于 1。增大物重、减小动滑轮重和摩擦，可以提高滑轮组的机械效率。斜面：倾角越大越费力，斜面越粗糙，机械效率越低。",
  ],
  formulas: ["F=\\dfrac{G+G_{\\text{动}}}{n}", "s=nh", "\\eta=\\dfrac{W_{\\text{有}}}{W_{\\text{总}}}"],
  params: [
    { id: "G", label: "物重", min: 1, max: 50, step: 1, value: 10, unit: "N" },
    { id: "n", label: "承担重物的绳子段数", min: 1, max: 5, step: 1, value: 3, when: (s) => s.mode === 0 },
    { id: "Gm", label: "动滑轮重", min: 0, max: 5, step: 0.5, value: 2, unit: "N", when: (s) => s.mode === 0 },
    { id: "fric", label: "摩擦（折算为作用在重物一侧的力）", min: 0, max: 3, step: 0.5, value: 1, unit: "N", when: (s) => s.mode === 0 },
    { id: "h", label: "重物提升的高度", min: 0.1, max: 3, step: 0.1, value: 1, unit: "m", when: (s) => s.mode === 0 },
    { id: "alpha", label: "斜面的倾角", min: 10, max: 60, step: 5, value: 30, unit: "°", when: (s) => s.mode === 1 },
    { id: "mu", label: "摩擦因数", min: 0, max: 0.5, step: 0.05, value: 0.2, when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "机械", value: 0, options: [[0, "滑轮组"], [1, "斜面"]] }],
  aspect: 0.62,
  readouts: (s) => {
    const r = calc(s);
    return [
      { label: "拉力 F", value: fmt(r.F, 2), unit: "N" }, { label: s.mode === 0 ? "绳子自由端移动的距离" : "斜面长", value: fmt(r.s, 2), unit: "m" },
      { label: "有用功", value: fmt(r.Wuse, 2), unit: "J" }, { label: "总功", value: fmt(r.Wtot, 2), unit: "J" }, { label: "机械效率", value: fmt(r.eta * 100, 1), unit: "%" },
    ];
  },
  draw(c, w, hh, s) {
    const r = calc(s);
    if (s.mode === 0) {
      const top = 40;
      rect(c, 120, 14, 300, 20, COL.grey, COL.ink, 3, 4);
      const n = s.n, hy = 150 + s.h * 40;
      // the moving pulley (below) carries the load; n strands in total: fixed pulley on top when n is even
      const px = 270;
      circle(c, px - 30, top + 40, 22, "#fff"); circle(c, px + 30, top + 40, 22, "#fff");
      const mv = 150 + s.h * -30 + 90;   // moving pulley height
      circle(c, px, mv, 26, "#fff");
      for (let i = 0; i < n; i++) { const x = px - 26 + (52 * i) / Math.max(1, n - 1); line(c, n === 1 ? px : x, top + 40 + 22 * 0, n === 1 ? px : x, mv, COL.ink, 3); }
      line(c, px, mv + 26, px, mv + 60, COL.ink, 4);
      rect(c, px - 30, mv + 60, 60, 40, "#9775fa", COL.ink, 4, 6); txt(c, "G", px, mv + 80, 22, "#fff");
      arrow(c, px + 60, top + 60, px + 60, top + 60 + Math.min(100, r.F * 4 + 20), COL.green, 6); txt(c, "F", px + 82, top + 90, 22, COL.green, "left");
      void hy;
    } else {
      const a = rad(s.alpha), L = 400, x0 = 60, y0 = 360;
      poly(c, [[x0, y0], [x0 + L * Math.cos(a), y0], [x0 + L * Math.cos(a), y0 - L * Math.sin(a)]], "#e5dbff", COL.ink, 4);
      c.save(); c.translate(x0, y0); c.rotate(-a);
      rect(c, 160, -44, 70, 44, "#9775fa", COL.ink, 4, 6); txt(c, "G", 195, -22, 22, "#fff");
      arrow(c, 236, -22, 236 + Math.min(120, r.F * 3 + 20), -22, COL.green, 6);
      c.restore();
      line(c, x0 + L * Math.cos(a) + 24, y0, x0 + L * Math.cos(a) + 24, y0 - L * Math.sin(a), COL.red, 3); txt(c, "h", x0 + L * Math.cos(a) + 44, y0 - (L * Math.sin(a)) / 2, 22, COL.red, "left");
      txt(c, `α = ${s.alpha}°`, 120, 340, 20, COL.grey);
    }
    // the efficiency bar
    rect(c, 470, 40, 40, 300, "#fff", COL.ink, 3, 6); const eh = 300 * Math.min(1, r.eta); rect(c, 470, 340 - eh, 40, eh, COL.green, COL.ink, 3, 6);
    txt(c, "η", 490, 358, 20, COL.ink); txt(c, `${fmt(r.eta * 100, 0)}%`, 560, 340 - eh, 22, COL.green, "left");
  },
  tasks: [
    { id: "third", text: "滑轮组：使 3 段绳子承担重物，动滑轮重 0、没有摩擦：拉力等于物重的三分之一", check: (s) => s.mode === 0 && s.n === 3 && s.Gm === 0 && s.fric === 0 },
    { id: "eta90", text: "滑轮组：使机械效率不低于 90%（增大物重、减小动滑轮重和摩擦）", check: (s) => s.mode === 0 && Mo.pulley(s.n, s.G, s.Gm, s.fric, s.h).eta >= 0.9 },
    { id: "half", text: "斜面：倾角 30°、没有摩擦：推力等于物重的一半", check: (s) => s.mode === 1 && s.alpha === 30 && s.mu === 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
