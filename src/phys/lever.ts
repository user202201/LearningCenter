import { mountSim, type SimDef, type PhysCtx, fmt, clamp } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-lever";
import { COL, circle, line, poly, rect, txt } from "./draw";

export const meta = CATALOG.lever;
const CX = 320, K = 5.6;   // fulcrum x, units per cm; the beam is 100 cm long (50 each side)
export const def: SimDef = {
  meta,
  lesson: [
    "在力的作用下能绕固定点转动的硬棒叫杠杆。支点、动力、阻力、动力臂、阻力臂是杠杆的五要素；力臂是支点到力的作用线的距离。",
    "杠杆的平衡条件：动力 × 动力臂 = 阻力 × 阻力臂，即 F₁L₁ = F₂L₂。动力臂大于阻力臂的杠杆省力但费距离（撬棍、羊角锤）；动力臂小于阻力臂的杠杆费力但省距离（镊子、钓鱼竿）；两臂相等的是等臂杠杆（天平）。",
    "拖动画面中的钩码，或用滑块改变它们的位置和个数。左边为动力，右边为阻力。",
  ],
  formulas: ["F_1L_1=F_2L_2"],
  params: [
    { id: "n1", label: "左边钩码的个数（每个 0.5 N）", min: 0, max: 8, step: 1, value: 2 },
    { id: "L1", label: "左边钩码到支点的距离", min: 5, max: 50, step: 5, value: 20, unit: "cm" },
    { id: "n2", label: "右边钩码的个数（每个 0.5 N）", min: 0, max: 8, step: 1, value: 1 },
    { id: "L2", label: "右边钩码到支点的距离", min: 5, max: 50, step: 5, value: 10, unit: "cm" },
  ],
  aspect: 0.55,
  pointer: (kind, x, y, s) => {
    const L = clamp(Math.round(Math.abs(x - CX) / K / 5) * 5, 5, 50);
    return x < CX ? { L1: L } : { L2: L };
  },
  readouts: (s) => {
    const r = Mo.lever(s.n1, s.L1, s.n2, s.L2);
    return [
      { label: "动力 × 动力臂", value: fmt(r.t1, 2), unit: "N·cm" }, { label: "阻力 × 阻力臂", value: fmt(r.t2, 2), unit: "N·cm" },
      { label: "杠杆的状态", value: r.balanced ? "水平平衡" : r.tilt > 0 ? "左端下沉" : "右端下沉" }, { label: "杠杆的种类", value: r.kind },
    ];
  },
  draw(c, w, hh, s) {
    const r = Mo.lever(s.n1, s.L1, s.n2, s.L2), by = 160;
    poly(c, [[CX, by + 6], [CX - 36, by + 150], [CX + 36, by + 150]], COL.yellow, COL.ink, 4);
    line(c, 20, by + 150, 620, by + 150, COL.grey, 3);
    c.save(); c.translate(CX, by); c.rotate((r.tilt * Math.PI) / 180);
    rect(c, -290, -9, 580, 18, COL.wood, COL.ink, 3, 6);
    for (let cm = 5; cm <= 50; cm += 5) for (const sg of [-1, 1]) { line(c, sg * cm * K, -9, sg * cm * K, cm % 10 === 0 ? 4 : -2, COL.ink, 2); if (cm % 10 === 0) txt(c, String(cm), sg * cm * K, 24, 14, COL.grey); }
    const weights = (n: number, L: number, sg: number, col: string) => {
      const x = sg * L * K; line(c, x, 9, x, 34, COL.ink, 3);
      for (let i = 0; i < n; i++) rect(c, x - 20, 34 + i * 20, 40, 18, col, COL.ink, 3, 4);
      if (n > 0) txt(c, "F", x + sg * 34, 34 + (n * 20) / 2, 18, COL.ink, sg > 0 ? "left" : "right");
    };
    weights(s.n1, s.L1, -1, "#ff8787"); weights(s.n2, s.L2, 1, "#74c0fc");
    circle(c, 0, 0, 7, COL.ink);
    c.restore();
    txt(c, "O", CX, by + 172, 18, COL.ink);
    txt(c, `L1 = ${s.L1} cm`, 100, 40, 22, "#e03131"); txt(c, `L2 = ${s.L2} cm`, 540, 40, 22, COL.blue);
    txt(c, r.balanced ? "=" : r.tilt > 0 ? ">" : "<", CX, 40, 34, r.balanced ? COL.green : COL.orange);
  },
  tasks: [
    { id: "balance", text: "使杠杆在水平位置平衡（左右两边都挂有钩码）", check: (s) => s.n1 > 0 && s.n2 > 0 && Mo.lever(s.n1, s.L1, s.n2, s.L2).balanced },
    { id: "save", text: "使杠杆平衡，并且是省力杠杆（动力臂大于阻力臂）", check: (s) => s.n1 > 0 && s.n2 > 0 && Mo.lever(s.n1, s.L1, s.n2, s.L2).balanced && s.L1 > s.L2 },
    { id: "costly", text: "使杠杆平衡，并且是费力杠杆（动力臂小于阻力臂）", check: (s) => s.n1 > 0 && s.n2 > 0 && Mo.lever(s.n1, s.L1, s.n2, s.L2).balanced && s.L1 < s.L2 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
