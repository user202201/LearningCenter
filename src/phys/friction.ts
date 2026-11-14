import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-friction";
import { COL, arrow, line, poly, rect, txt } from "./draw";

export const meta = CATALOG.friction;
export const def: SimDef = {
  meta,
  lesson: [
    "两个相互接触的物体，有相对运动或相对运动趋势时，接触面上会产生阻碍相对运动的力，叫摩擦力。滑动摩擦力的大小与压力的大小和接触面的粗糙程度有关：f = μN，与接触面积、速度无关。本实验室取 g = 10 N/kg。",
    "物体没有被拉动时，受到的是静摩擦力，大小等于拉力，最大静摩擦力略大于滑动摩擦力。物体做匀速直线运动时，拉力等于滑动摩擦力。在斜面上，压力 N = mg cos α，重力沿斜面向下的分力是 mg sin α。",
  ],
  formulas: ["f=\\mu N", "N=mg\\cos\\alpha", "F_{\\parallel}=mg\\sin\\alpha"],
  params: [
    { id: "m", label: "物体的质量", min: 1, max: 20, step: 1, value: 5, unit: "kg" },
    { id: "F", label: "沿斜面向上的拉力", min: 0, max: 100, step: 1, value: 0, unit: "N" },
    { id: "alpha", label: "斜面的倾角（0° 为水平面）", min: 0, max: 45, step: 5, value: 0, unit: "°" },
  ],
  choices: [
    { id: "surface", label: "接触面", value: 1, options: Mo.SURFACES },
    { id: "moving", label: "物体的初始运动状态", value: 0, options: [[0, "静止"], [1, "已在向上运动"]] },
  ],
  aspect: 0.62,
  readouts: (s) => {
    const r = Mo.solve(s.m, s.F, s.alpha, s.surface, s.moving);
    return [
      { label: "压力 N", value: fmt(r.N, 1), unit: "N" }, { label: "重力沿斜面向下的分力", value: fmt(r.gDown, 1), unit: "N" },
      { label: "摩擦力", value: fmt(Math.abs(r.f), 1), unit: "N" }, { label: "摩擦的种类", value: r.kind === "static" ? "静摩擦" : "滑动摩擦" },
      { label: "最大静摩擦力", value: fmt(r.fMax, 1), unit: "N" }, { label: "加速度", value: fmt(r.a, 2), unit: "m/s²" },
      { label: "运动状态", value: r.state === "rest" ? "保持静止" : r.state === "up" ? (Math.abs(r.a) < 0.05 ? "匀速向上运动" : r.a > 0 ? "向上加速" : "向上减速") : "向下滑动" },
    ];
  },
  draw(c, w, hh, s) {
    const r = Mo.solve(s.m, s.F, s.alpha, s.surface, s.moving);
    const px = 90, py = 300, len = 460;   // the lower end of the plane
    c.save(); c.translate(px, py); c.rotate(-rad(s.alpha));
    poly(c, [[0, 0], [len, 0], [len, 18], [0, 18]], ["#e5dbff", "#d9a066", "#495057"][s.surface], COL.ink, 3);
    // the block on the plane
    const bx = 200, bw = 70 + s.m * 2, bh = 46 + s.m;
    rect(c, bx, -bh, bw, bh, "#ffa94d", COL.ink, 4, 8); txt(c, "m", bx + bw / 2, -bh / 2, 22, COL.ink);
    const k = 3.2, cap = (v: number) => Math.min(170, Math.max(10, v * k));
    const cxm = bx + bw / 2, cym = -bh / 2;
    if (s.F > 0) { arrow(c, bx + bw, cym - 10, bx + bw + cap(s.F), cym - 10, COL.green, 5); txt(c, "F", bx + bw + cap(s.F) + 14, cym - 10, 20, COL.green, "left"); }
    const f = r.f; if (Math.abs(f) > 0.05) { const d = f > 0 ? 1 : -1; arrow(c, cxm, 4, cxm + d * cap(Math.abs(f)), 4, COL.red, 5); txt(c, "f", cxm + d * cap(Math.abs(f)) + d * 14, 18, 20, COL.red, d > 0 ? "left" : "right"); }
    arrow(c, cxm, cym - bh / 2 - 2, cxm, cym - bh / 2 - 2 - cap(r.N * 0.5), COL.blue, 5); txt(c, "N", cxm + 16, cym - bh / 2 - cap(r.N * 0.5) / 2, 20, COL.blue, "left");
    c.restore();
    // gravity, vertical in the picture
    const gcx = 200 + (70 + s.m * 2) / 2, gcy = -(46 + s.m) / 2;
    const gx = px + gcx * Math.cos(rad(s.alpha)) + gcy * Math.sin(rad(s.alpha)), gy = py - gcx * Math.sin(rad(s.alpha)) + gcy * Math.cos(rad(s.alpha));
    arrow(c, gx, gy, gx, gy + Math.min(120, s.m * 6 + 40), "#7048e8", 5); txt(c, "G", gx + 16, gy + 60, 20, "#7048e8", "left");
    line(c, px - 30, py + 18, px + len + 30, py + 18, "#ced4da", 2, [6, 6]);
    if (s.alpha > 0) txt(c, `α = ${s.alpha}°`, px + 120, py + 40, 20, COL.grey);
  },
  tasks: [
    { id: "uniform", text: "水平面（0°）上，物体已在向上运动：调节拉力，使物体做匀速直线运动（加速度接近 0）", check: (s) => s.alpha === 0 && s.moving === 1 && Math.abs(Mo.solve(s.m, s.F, 0, s.surface, 1).a) < 0.05 },
    { id: "static", text: "水平面上，物体静止：增大拉力，但物体仍保持静止（摩擦力等于拉力，且拉力不为 0）", check: (s) => s.alpha === 0 && s.moving === 0 && s.F > 0 && Mo.solve(s.m, s.F, 0, s.surface, 0).state === "rest" && Math.abs(Mo.solve(s.m, s.F, 0, s.surface, 0).f + s.F) < 1e-9 && s.F >= 5 },
    { id: "slide", text: "选择冰面，倾角 30°，拉力为 0：物体向下滑动", check: (s) => s.surface === 0 && s.alpha === 30 && s.F === 0 && s.moving === 0 && Mo.solve(s.m, 0, 30, 0, 0).state === "down" },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
