import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-internal";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.internal;
type S = Record<string, number>;
const work = (s: S) => Mo.dT(s.action, s.W, s.mg, Mo.SUBS[s.sub][1]);
const flow = (s: S) => Mo.exchange(Mo.SUBS[s.subA][1], s.mA, s.TA, Mo.SUBS[s.subB][1], s.mB, s.TB);
const SUBOPT = Mo.SUBS.map(([n], i) => [i, n] as [number, string]);
export const def: SimDef = {
  meta,
  lesson: [
    "物体内部所有分子热运动的动能和分子势能的总和叫内能。一切物体都有内能。物体的温度升高，内能增大；温度降低，内能减小。改变物体内能的方式有两种：做功和热传递，它们对改变物体的内能是等效的。",
    "做功：对物体做功，物体的内能增大（如搓手取暖、压缩气体、钻木取火）；物体对外做功，物体的内能减小（如气体膨胀推动活塞、瓶塞冲出时瓶内出现白雾）。做功改变内能的实质是其他形式的能与内能的相互转化。热传递：热量从高温物体传到低温物体（或从物体的高温部分传到低温部分），实质是内能的转移。",
    "要分清三个量：温度表示物体的冷热程度；热量是热传递过程中传递的内能的多少，是过程量，只能说“吸收”或“放出”，不能说“含有”；内能是物体具有的能，是状态量。热量总是从温度高的物体传向温度低的物体，与哪个物体的内能多无关。",
  ],
  formulas: ["Q=cm\\Delta t"],
  params: [
    { id: "W", label: "做功的多少", min: 0, max: 500, step: 10, value: 100, unit: "J", when: (s) => s.mode === 0 },
    { id: "mg", label: "物体的质量", min: 5, max: 500, step: 5, value: 100, unit: "g", when: (s) => s.mode === 0 },
    { id: "mA", label: "物体 A 的质量", min: 50, max: 1000, step: 50, value: 200, unit: "g", when: (s) => s.mode === 1 },
    { id: "TA", label: "物体 A 的温度", min: 0, max: 100, step: 5, value: 80, unit: "℃", when: (s) => s.mode === 1 },
    { id: "mB", label: "物体 B 的质量", min: 50, max: 1000, step: 50, value: 200, unit: "g", when: (s) => s.mode === 1 },
    { id: "TB", label: "物体 B 的温度", min: 0, max: 100, step: 5, value: 20, unit: "℃", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "做功"], [1, "热传递"]] },
    { id: "action", label: "做功的方式", value: 0, options: Mo.ACTIONS.map((n, i) => [i, n] as [number, string]), when: (s) => s.mode === 0 },
    { id: "sub", label: "物质", value: 3, options: SUBOPT, when: (s) => s.mode === 0 },
    { id: "subA", label: "物体 A 的物质", value: 0, options: SUBOPT, when: (s) => s.mode === 1 },
    { id: "subB", label: "物体 B 的物质", value: 0, options: SUBOPT, when: (s) => s.mode === 1 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "内能的变化", value: `${Mo.dU(s.action, s.W) >= 0 ? "+" : "−"}${fmt(Math.abs(Mo.dU(s.action, s.W)), 0)}`, unit: "J" }, { label: "温度的变化", value: `${work(s) >= 0 ? "+" : "−"}${fmt(Math.abs(work(s)), 1)}`, unit: "℃" }, { label: "末温", value: fmt(Mo.T0 + work(s), 1), unit: "℃" }, { label: "能量的转化", value: s.action === 2 ? "内能转化为机械能" : "机械能转化为内能" }];
    const f = flow(s), cA = Mo.SUBS[s.subA][1], cB = Mo.SUBS[s.subB][1];
    return [{ label: "热量传递的方向", value: f.dir === "AB" ? "从 A 传向 B" : f.dir === "BA" ? "从 B 传向 A" : "没有热传递（温度相同）" }, { label: "达到的共同温度", value: fmt(f.Tf, 1), unit: "℃" }, { label: "传递的热量", value: fmt(Math.abs(f.Q), 0), unit: "J" }, { label: "A 的内能（相对于 0 ℃）", value: fmt(Mo.relEnergy(cA, s.mA, s.TA), 0), unit: "J" }, { label: "B 的内能（相对于 0 ℃）", value: fmt(Mo.relEnergy(cB, s.mB, s.TB), 0), unit: "J" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const dt = work(s), col = dt > 0 ? COL.red : dt < 0 ? COL.blue : COL.grey;
      rect(c, 240, 180, 160, 120, "#ffe3e3", COL.ink, 5, 16); rect(c, 240, 180, 160, 120, "rgba(0,0,0,0)", col, 8, 16);
      const n = Math.min(7, Math.round(Math.abs(s.W) / 70));
      for (let i = 0; i < n; i++) arrow(c, s.action === 2 ? 330 : 120, 220 + (i % 3) * 30, s.action === 2 ? 440 : 230, 220 + (i % 3) * 30, COL.orange, 4);
      if (s.action === 2) for (let i = 0; i < n; i++) arrow(c, 410, 210 + (i % 3) * 30, 520, 210 + (i % 3) * 30, COL.blue, 4);
      txt(c, `${fmt(Mo.T0 + dt, 1)} C`, 320, 120, 36, col); txt(c, `${s.W} J`, 100, 60, 26, COL.orange);
    } else {
      const f = flow(s);
      rect(c, 80, 150, 180, 140, "#ffc9c9", COL.ink, 5, 16); rect(c, 380, 150, 180, 140, "#a5d8ff", COL.ink, 5, 16);
      txt(c, "A", 170, 210, 40, COL.ink); txt(c, "B", 470, 210, 40, COL.ink); txt(c, `${s.TA} C`, 170, 260, 26, COL.red); txt(c, `${s.TB} C`, 470, 260, 26, COL.blue);
      if (f.dir === "AB") arrow(c, 270, 220, 370, 220, COL.red, 8); else if (f.dir === "BA") arrow(c, 370, 220, 270, 220, COL.red, 8);
      txt(c, `${fmt(f.Tf, 1)} C`, 320, 80, 30, COL.green); line(c, 80, 310, 560, 310, COL.grey, 2);
      circle(c, 320, 330, 6, COL.green, null);
    }
  },
  tasks: [
    { id: "compress", text: "做功：压缩气体，使气体的温度升高 20 ℃ 以上", check: (s) => s.mode === 0 && s.action === 1 && work(s) >= 20 },
    { id: "expand", text: "做功：气体膨胀对外做功，使气体的温度降低 5 ℃ 以上", check: (s) => s.mode === 0 && s.action === 2 && work(s) <= -5 },
    { id: "reverse", text: "热传递：使热量从 B 传向 A", check: (s) => s.mode === 1 && flow(s).dir === "BA" },
    { id: "none", text: "热传递：使两个物体之间没有热传递", check: (s) => s.mode === 1 && flow(s).dir === "none" },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
