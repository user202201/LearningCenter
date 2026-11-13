import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-refraction";
import { COL, arrow, line, rect, txt } from "./draw";

export const meta = CATALOG.refraction;
const PAIRS: [number, number][] = [[Mo.N.air, Mo.N.water], [Mo.N.air, Mo.N.glass], [Mo.N.water, Mo.N.air], [Mo.N.glass, Mo.N.air], [Mo.N.water, Mo.N.glass]];
const fill = (n: number) => (n < 1.2 ? "#f8f9fa" : n < 1.4 ? "#c5e8ff" : "#b2f2bb");
export const def: SimDef = {
  meta,
  lesson: [
    "光从一种介质斜射入另一种介质时，传播方向一般会发生偏折，这叫光的折射。光从空气斜射入水或玻璃中，折射角小于入射角；从水或玻璃斜射入空气中，折射角大于入射角；垂直入射时，传播方向不变。",
    "折射定律：n₁ sin θ₁ = n₂ sin θ₂。光从光密介质射向光疏介质，入射角增大到某一角度（临界角）时，折射角达到 90°；入射角再增大，折射光线消失，光全部被反射回来，这叫全反射。",
  ],
  formulas: ["n_1\\sin\\theta_1=n_2\\sin\\theta_2", "\\sin C=\\dfrac{n_2}{n_1}", "v=\\dfrac{c}{n}"],
  params: [{ id: "ti", label: "入射角", min: 0, max: 85, step: 1, value: 30, unit: "°" }],
  choices: [{ id: "pair", label: "光的传播方向", value: 0, options: [[0, "空气→水"], [1, "空气→玻璃"], [2, "水→空气"], [3, "玻璃→空气"], [4, "水→玻璃"]] }],
  aspect: 0.62,
  readouts: (s) => {
    const [n1, n2] = PAIRS[s.pair], r = Mo.refract(n1, n2, s.ti), crit = Mo.critical(n1, n2);
    return [
      { label: "入射角", value: fmt(s.ti, 0), unit: "°" },
      { label: "折射角", value: r.tir ? "—" : fmt(r.thetaT, 1), unit: r.tir ? "" : "°" },
      { label: "现象", value: r.tir ? "全反射" : "折射" },
      { label: "临界角", value: crit === null ? "—" : fmt(crit, 1), unit: crit === null ? "" : "°" },
      { label: "上方介质中的光速", value: fmt(Mo.speedIn(n1) / 1e8, 2), unit: "×10⁸ m/s" },
      { label: "下方介质中的光速", value: fmt(Mo.speedIn(n2) / 1e8, 2), unit: "×10⁸ m/s" },
    ];
  },
  draw(c, w, hh, s) {
    const [n1, n2] = PAIRS[s.pair], r = Mo.refract(n1, n2, s.ti);
    const cx = 320, cy = 200, L = 190;
    rect(c, 10, 10, 620, 190, fill(n1), null, 0, 0); rect(c, 10, 200, 620, 190, fill(n2), null, 0, 0);
    txt(c, `n = ${fmt(n1, 2)}`, 600, 30, 20, COL.grey, "right"); txt(c, `n = ${fmt(n2, 2)}`, 600, 372, 20, COL.grey, "right");
    line(c, 10, cy, 630, cy, COL.ink, 4); line(c, cx, 20, cx, 380, COL.grey, 2.5, [8, 7]);
    const si = Math.sin(rad(s.ti)), co = Math.cos(rad(s.ti));
    arrow(c, cx - si * L, cy - co * L, cx - si * 4, cy - co * 4, COL.orange, 5);
    if (r.tir) arrow(c, cx + si * 4, cy - co * 4, cx + si * L, cy - co * L, COL.red, 5);
    else { const st = Math.sin(rad(r.thetaT)), ct = Math.cos(rad(r.thetaT)); arrow(c, cx + st * 4, cy + ct * 4, cx + st * L, cy + ct * L, COL.red, 5); if (s.ti > 0) line(c, cx + si * 4, cy - co * 4, cx + si * 60, cy - co * 60, "#ff8787", 2, [5, 5]); }
    txt(c, "i", cx - si * 100 - 18, cy - co * 100, 22, COL.orange);
    if (!r.tir) txt(c, "r", cx + Math.sin(rad(r.thetaT)) * 110 + 16, cy + Math.cos(rad(r.thetaT)) * 110, 22, COL.red);
  },
  tasks: [
    { id: "aw45", text: "空气→水：使入射角为 45°，读出折射角约 32°", check: (s) => s.pair === 0 && s.ti === 45 },
    { id: "tir", text: "水→空气：使入射角超过临界角（约 49°），观察全反射", check: (s) => s.pair === 2 && Mo.refract(1.33, 1, s.ti).tir },
    { id: "normal", text: "任选一种光的传播方向，使入射角为 0°：光线垂直入射，方向不变", check: (s) => s.ti === 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
