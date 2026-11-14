import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-spring";
import { COL, arrow, circle, line, rect, spring, txt } from "./draw";

export const meta = CATALOG.spring;
export const def: SimDef = {
  meta,
  lesson: [
    "物体发生弹性形变时产生的力叫弹力。在弹性限度内，弹簧的伸长量与所受的拉力成正比：F = kx。弹簧测力计就是根据这一原理制成的；超过弹性限度，弹簧不能恢复原长。",
    "重力是由于地球的吸引而使物体受到的力，方向竖直向下，大小 G = mg。地球上 g = 9.8 N/kg，粗略计算时取 10 N/kg，本实验室取 g = 10 N/kg；月球上的 g 约为地球上的六分之一。质量是物体所含物质的多少，不随位置改变；重力会随位置改变。",
  ],
  formulas: ["F=kx", "G=mg"],
  params: [
    { id: "m", label: "挂钩码的质量", min: 0, max: 1.5, step: 0.05, value: 0.3, unit: "kg" },
    { id: "k", label: "弹簧的劲度系数", min: 10, max: 100, step: 5, value: 40, unit: "N/m" },
  ],
  choices: [{ id: "planet", label: "所在的星球", value: 0, options: Mo.PLANETS }],
  aspect: 0.62,
  readouts: (s) => {
    const G = Mo.weight(s.m, Mo.GRAV[s.planet]), x = Mo.extension(G, s.k);
    return [
      { label: "质量", value: fmt(s.m, 2), unit: "kg" }, { label: "重力加速度 g", value: fmt(Mo.GRAV[s.planet], 1), unit: "N/kg" },
      { label: "重力 / 弹簧测力计示数", value: fmt(G, 2), unit: "N" }, { label: "弹簧的伸长量", value: fmt(x * 100, 1), unit: "cm" },
      { label: "弹性限度", value: Mo.beyondLimit(x) ? "已超出" : "在限度内" },
    ];
  },
  draw(c, w, hh, s) {
    const G = Mo.weight(s.m, Mo.GRAV[s.planet]), x = Mo.extension(G, s.k);
    rect(c, 130, 14, 140, 18, COL.grey, COL.ink, 3, 6);
    const y0 = 60, ylen = 50 + Math.min(x, 0.5) * 300;
    spring(c, 200, y0 - 28, y0 + ylen, 11, 18, COL.grey); line(c, 200, 32, 200, y0 - 28, COL.ink, 4);
    // the scale beside it: 0..15 N over 260 units
    rect(c, 250, 60, 36, 270, "#fff", COL.ink, 2, 4);
    for (let i = 0; i <= 15; i++) { const y = 66 + (i / 15) * 258; line(c, 250, y, i % 5 === 0 ? 270 : 262, y, COL.ink, 2); if (i % 5 === 0) txt(c, String(i), 304, y, 16, COL.grey, "left"); }
    const py = 66 + Math.min(1, G / 15) * 258; line(c, 246, py, 290, py, COL.red, 4);
    // the mass
    const bw = 40 + Math.min(1.5, s.m) * 30;
    rect(c, 200 - bw / 2, y0 + ylen, bw, 38 + s.m * 24, "#74c0fc", COL.ink, 4, 8); txt(c, "m", 200, y0 + ylen + (38 + s.m * 24) / 2, 22, COL.ink);
    arrow(c, 200, y0 + ylen + 38 + s.m * 24, 200, Math.min(hh - 6, y0 + ylen + 38 + s.m * 24 + 20 + Math.min(70, G * 4)), COL.red, 5);
    txt(c, "G", 224, y0 + ylen + 38 + s.m * 24 + 20, 20, COL.red, "left");
    // a planet
    const col = ["#4dabf7", "#ced4da", "#ff8787", "#ffd8a8"][s.planet];
    circle(c, 520, 110, 70, col); circle(c, 495, 85, 14, "rgba(0,0,0,0.12)", null); circle(c, 545, 130, 10, "rgba(0,0,0,0.12)", null);
    txt(c, `g = ${Mo.GRAV[s.planet]}`, 520, 210, 22, COL.ink);
    if (Mo.beyondLimit(x)) txt(c, "x > limit", 200, hh - 8, 20, COL.red);
  },
  tasks: [
    { id: "newton10", text: "在地球上使弹簧测力计的示数约为 5 N", check: (s) => s.planet === 0 && Math.abs(Mo.weight(s.m, 10) - 5) < 0.01 },
    { id: "moon", text: "把同样质量的物体放到月球上：先在地球上选质量 1 kg，再选月球，读出示数约为 1.6 N", check: (s) => s.planet === 1 && s.m === 1 },
    { id: "limit", text: "使弹簧的伸长量超过弹性限度（0.3 m），观察提示", check: (s) => Mo.beyondLimit(Mo.extension(Mo.weight(s.m, Mo.GRAV[s.planet]), s.k)) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
