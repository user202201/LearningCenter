import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-daphnia";
import { COL, lab, rect, circle, ell, axes, line } from "./draw";
export const meta = CATALOG.daphnia;
export const def: SimDef = {
  meta,
  lesson: [
    "水蚤是一种体型很小的水生动物，身体透明，在显微镜下可以看到心脏的跳动，常用来探究某些因素对心率的影响。实验时先在清水中数 10 s 内的心跳次数，再换用不同浓度的酒精溶液，用同样的方法数心跳；每种条件重复数 3 次取平均值。清水是对照，只有酒精的浓度不同。",
    "实验结果：酒精浓度越高，水蚤的心率越慢；浓度过高时，水蚤死亡，心脏停止跳动。这说明酒精对心脏有抑制作用。本实验的数据是教学数据，计数的误差为 ±1 次。",
  ],
  links: [{ text: "相关：血液循环", href: "#/science/bio/blood" }, { text: "相关：显微镜", href: "#/science/bio/microscope" }],
  params: [],
  choices: [{ id: "conc", label: "酒精的浓度", value: 0, options: Mo.CONC.map((v) => [v, v === 0 ? "清水（对照）" : `${v} %`] as [number, string]) }],
  hidden: { seed: 1 },
  actions: [{ id: "recount", label: "重新计数", run: (s) => ({ seed: s.seed + 1 }) }],
  readouts: (s) => {
    const k = Mo.counts(s.conc, s.seed), m = Mo.mean3(k);
    return [{ label: "三次计数（每次 10 s）", value: k.join(" / ") }, { label: "平均每 10 s", value: fmt(m, 1), unit: "次" }, { label: "换算成每分钟", value: fmt(Mo.perMinute(m), 0), unit: "次" },
      { label: "与清水相比", value: s.conc === 0 ? "—" : fmt(Mo.change(s.conc, s.seed), 0), unit: s.conc === 0 ? "" : "%" }, { label: "状态", value: s.conc === 20 ? "水蚤死亡" : "存活" }];
  },
  draw(c, w, h, s) {
    const m = Mo.mean3(Mo.counts(s.conc, s.seed)), dead = s.conc === 20;
    circle(c, 150, 190, 130, "#f8f9fa", COL.ink, 5); circle(c, 150, 190, 118, "#e7f5ff", "#74c0fc", 2);
    ell(c, 150, 200, 62, 46, dead ? "#ced4da" : "#fff9db", COL.ink, 4); circle(c, 190, 188, 7, COL.ink, null);
    c.beginPath(); c.moveTo(120, 160); c.quadraticCurveTo(150, 120, 195, 170); c.strokeStyle = COL.ink; c.lineWidth = 3; c.stroke();
    const r = 11 + (dead ? 0 : 5 * Math.abs(Math.sin(m * 0.9))); circle(c, 140, 188, r, dead ? "#adb5bd" : "#ffa8a8", COL.red, 3); lab(c, "心脏", 140, 232, 15, COL.grey);
    const P = axes(c, 340, 50, 270, 250, 20, 40, "% alcohol", "beats / 10 s", 0, 4);
    Mo.CONC.forEach((cc, i) => { const x = P.X(cc), y = P.Y(Mo.BASE[i]); rect(c, x - 9, y, 18, P.Y(0) - y, cc === s.conc ? COL.orange : "#a5d8ff", COL.ink, 2, 3); });
    line(c, P.X(s.conc), P.Y(0), P.X(s.conc), P.y0, COL.orange, 2, [5, 5]);
    lab(c, s.conc === 0 ? "clear water" : `${s.conc} %`, 475, 350, 20, COL.ink); lab(c, `${fmt(m, 1)} / 10 s`, 475, 392, 30, dead ? COL.red : COL.green);
  },
  tasks: [
    { id: "low", text: "观察 1 % 的酒精中水蚤的心率", check: (s) => s.conc === 1 },
    { id: "drop", text: "酒精浓度达到 10 % 以上，看到心率明显减慢", check: (s) => s.conc >= 10 && s.conc < 20 },
    { id: "dead", text: "酒精浓度为 20 % 时，水蚤死亡", check: (s) => s.conc === 20 },
  ],
  aspect: 0.7,
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
