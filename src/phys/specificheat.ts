import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-specificheat";
import { COL, axes, circle, curve, rect, txt } from "./draw";

export const meta = CATALOG.specificheat;
const TMAX = 600;
export const def: SimDef = {
  meta,
  lesson: [
    "比热容表示物质吸热（放热）能力的强弱：单位质量的某种物质温度升高 1 °C 所吸收的热量，叫做这种物质的比热容。水的比热容较大，为 4.2×10³ J/(kg·°C)。",
    "Q = cmΔt。质量相等、吸收热量相同时，比热容大的物质温度升高得少。比热容是物质的一种特性，与质量、体积、温度的变化无关。水的比热容大，所以用水做冷却剂、暖气的传热物质，沿海地区的昼夜温差小。",
    "本实验用两个相同的加热器同时加热水和另一种物质，加热器功率相同，吸收的热量相同。水温升到 100 °C 后保持不变（沸腾）。",
  ],
  formulas: ["Q=cm\\Delta t", "\\Delta t=\\dfrac{Q}{cm}"],
  params: [
    { id: "P", label: "每个加热器的功率", min: 50, max: 300, step: 50, value: 100, unit: "W" },
    { id: "mw", label: "水的质量", min: 0.1, max: 1, step: 0.1, value: 0.2, unit: "kg" },
    { id: "mo", label: "另一种物质的质量", min: 0.1, max: 1, step: 0.1, value: 0.2, unit: "kg" },
    { id: "t", label: "加热时间", min: 0, max: TMAX, step: 10, value: 60, unit: "s" },
  ],
  choices: [{ id: "sub", label: "另一种物质", value: 0, options: Mo.SUBST.map(([i, n]) => [i, n] as [number, string]) }],
  play: { param: "t", rate: 30 },
  aspect: 0.6,
  readouts: (s) => {
    const Tw = Mo.tempWater(s.P, s.mw, s.t), To = Mo.tempOther(s.sub, s.P, s.mo, s.t);
    return [
      { label: "每个加热器吸收的热量", value: fmt((s.P * s.t) / 1000, 1), unit: "kJ" },
      { label: "水的温度", value: fmt(Tw, 1), unit: "°C" }, { label: "水升高的温度", value: fmt(Tw - Mo.T0, 1), unit: "°C" },
      { label: "另一种物质的温度", value: fmt(To, 1), unit: "°C" }, { label: "另一种物质升高的温度", value: fmt(To - Mo.T0, 1), unit: "°C" },
      { label: "另一种物质的比热容", value: fmt(Mo.cOf(s.sub), 0), unit: "J/(kg·°C)" },
    ];
  },
  draw(c, w, hh, s) {
    const Tw = Mo.tempWater(s.P, s.mw, s.t), To = Mo.tempOther(s.sub, s.P, s.mo, s.t);
    const beaker = (x: number, T: number, col: string, label: string, m: number) => {
      const lvl = 140 - m * 30;
      rect(c, x, 40, 110, 190, "#fff", COL.ink, 4, 10); rect(c, x + 3, lvl + 40, 104, 187 - lvl - 40 + 3, col, null, 0, 8);
      rect(c, x + 80, 30, 12, 170, "#fff", COL.ink, 2, 5); const th = Math.max(4, (T - 10) / 400 * 160); rect(c, x + 82, 196 - th, 8, th, COL.red, null, 0, 3);
      circle(c, x + 86, 205, 8, COL.red); txt(c, `${Math.round(T)}°`, x + 40, 90, 22, COL.red);
      txt(c, label, x + 55, 262, 24, COL.ink);
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 22 + i * 30, 300); c.quadraticCurveTo(x + 10 + i * 30, 282, x + 22 + i * 30, 270); c.quadraticCurveTo(x + 34 + i * 30, 282, x + 22 + i * 30, 300); c.fillStyle = i === 1 ? COL.yellow : COL.orange; c.fill(); }
    };
    beaker(20, Tw, "#a5d8ff", "W", s.mw); beaker(160, To, ["#ffe066", "#ffd43b", "#e5b97b", "#e8590c"][s.sub], "X", s.mo);
    const P = axes(c, 340, 40, 270, 240, TMAX, 400, "t/s", "T/°C", 0, 4);
    const T = (f: (t: number) => number) => (x: number) => f(x);
    curve(c, P, T((x) => Mo.tempWater(s.P, s.mw, x)), COL.blue, TMAX, 120, 4); curve(c, P, T((x) => Mo.tempOther(s.sub, s.P, s.mo, x)), COL.orange, TMAX, 120, 4);
    circle(c, P.X(s.t), P.Y(Tw), 7, COL.blue); circle(c, P.X(s.t), P.Y(To), 7, COL.orange);
  },
  tasks: [
    { id: "faster", text: "使水和另一种物质的质量相等，加热 300 s 以上：比热容小的物质升温更快", check: (s) => s.mw === s.mo && s.t >= 300 && Mo.tempOther(s.sub, s.P, s.mo, s.t) - Mo.T0 > Mo.tempWater(s.P, s.mw, s.t) - Mo.T0 },
    { id: "equal", text: "调节质量，使两者在加热 100 s 以上后升高的温度相同（相差不超过 1 °C，且至少升高 5 °C）", check: (s) => s.t >= 100 && Math.abs(Mo.tempWater(s.P, s.mw, s.t) - Mo.tempOther(s.sub, s.P, s.mo, s.t)) <= 1 && Mo.tempWater(s.P, s.mw, s.t) - Mo.T0 >= 5 && Mo.tempWater(s.P, s.mw, s.t) < 100 },
    { id: "copper", text: "选择铜块，两者质量相等，加热 60 s 以上：铜块升温最快", check: (s) => s.sub === 3 && s.mw === s.mo && s.t >= 60 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
