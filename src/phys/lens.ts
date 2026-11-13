import { mountSim, type SimDef, type PhysCtx, fmt, clamp } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-lens";
import { COL, arrow, line, txt } from "./draw";

export const meta = CATALOG.lens;
const SC = 5.5, LX = 330, AY = 175, OBJ_H = 4;   // drawing units per cm, lens position, axis height, object height (cm)
export const def: SimDef = {
  meta,
  lesson: [
    "凸透镜对光有会聚作用：平行于主光轴的光会聚于焦点；通过光心的光传播方向不变；经过焦点的光折射后平行于主光轴。",
    "成像规律：u > 2f，成倒立、缩小的实像（照相机）；u = 2f，成倒立、等大的实像；f < u < 2f，成倒立、放大的实像（投影仪），像距 v > 2f；u = f，不成像；u < f，成正立、放大的虚像（放大镜）。实像可以用光屏接收，虚像不能。",
    "凹透镜对光有发散作用，总是成正立、缩小的虚像。拖动画面中的蜡烛也可以改变物距。",
  ],
  formulas: ["\\dfrac{1}{u}+\\dfrac{1}{v}=\\dfrac{1}{f}", "m=\\dfrac{v}{u}"],
  params: [
    { id: "f", label: "焦距", min: 5, max: 20, step: 1, value: 10, unit: "cm" },
    { id: "u", label: "物距", min: 2, max: 50, step: 0.5, value: 20, unit: "cm" },
  ],
  choices: [{ id: "type", label: "透镜", value: 0, options: [[0, "凸透镜"], [1, "凹透镜"]] }],
  aspect: 0.55,
  pointer: (kind, x, y, s) => ({ u: clamp((LX - x) / SC, 2, 50) }),
  readouts: (s) => {
    const im = Mo.image(s.f, s.u, s.type);
    return [
      { label: "物距", value: fmt(s.u, 1), unit: "cm" },
      { label: "像距", value: im.none ? "—" : fmt(Math.abs(im.v), 1), unit: im.none ? "" : "cm" },
      { label: "放大倍数", value: im.none ? "—" : fmt(im.m, 2) },
      { label: "像的性质", value: im.nature },
    ];
  },
  draw(c, w, hh, s) {
    const im = Mo.image(s.f, s.u, s.type);
    const X = (x: number) => LX + x * SC, Y = (y: number) => AY - y * SC;
    line(c, 8, AY, 632, AY, COL.grey, 2.5);
    // lens
    const sgn = s.type === 0 ? 1 : -1;
    c.beginPath(); c.moveTo(LX, 18);
    c.quadraticCurveTo(LX + sgn * 34, AY, LX, 332); c.quadraticCurveTo(LX - sgn * 34, AY, LX, 18);
    c.fillStyle = "rgba(99,230,226,0.45)"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
    // focal points and 2f
    for (const k of [-2, -1, 1, 2]) { const fx = X(k * s.f); line(c, fx, AY - 6, fx, AY + 6, COL.ink, 3); txt(c, Math.abs(k) === 1 ? "F" : "2F", fx, AY + 22, 17, COL.grey); }
    // object (a candle) and its image
    const tipY = OBJ_H;
    arrow(c, X(-s.u), Y(0), X(-s.u), Y(tipY), COL.green, 6); txt(c, "P", X(-s.u), Y(tipY) - 14, 18, COL.green);
    if (!im.none) {
      const ix = X(im.v), iy = -(im.v / s.u) * tipY;
      c.globalAlpha = im.real ? 1 : 0.65;
      c.setLineDash(im.real ? [] : [7, 6]); arrow(c, ix, Y(0), ix, Y(iy), COL.red, 6); c.setLineDash([]); c.globalAlpha = 1;
      txt(c, "P'", ix, Y(iy) + (iy >= 0 ? -14 : 16), 18, COL.red);
      // three rays: through lens points (0, y1) (0, 0) (0, y3); outgoing directions (convex / concave)
      const fs = s.type === 0 ? s.f : -s.f;
      const y1 = tipY, y3 = s.type === 0 ? (-tipY * s.f) / (s.u - s.f) : (tipY * s.f) / (s.u + s.f);
      const seg = (y0: number, slope: number, color: string) => {   // lens point (0, y0), outgoing slope (dy/dx in cm)
        const xe = 300 / SC;
        line(c, X(0), Y(y0), X(xe), Y(y0 + slope * xe), color, 2.5);
        if (!im.real) { line(c, X(0), Y(y0), X(im.v), Y(iy), color, 2, [6, 6]); }
      };
      const col = [COL.orange, COL.purple, COL.blue];
      // incoming halves: tip -> lens point
      line(c, X(-s.u), Y(tipY), X(0), Y(y1), col[0], 2.5); line(c, X(-s.u), Y(tipY), X(0), Y(0), col[1], 2.5); line(c, X(-s.u), Y(tipY), X(0), Y(y3), col[2], 2.5);
      seg(y1, s.type === 0 ? -y1 / fs : y1 / s.f, col[0]);   // parallel ray: through F' (convex) / as if from F (concave)
      seg(0, -tipY / s.u, col[1]);                        // through the centre: straight
      seg(y3, 0, col[2]);                                 // through F: parallel
    } else {
      line(c, X(-s.u), Y(OBJ_H), X(0), Y(OBJ_H), COL.orange, 2.5);
    }
  },
  tasks: [
    { id: "camera", text: "使物体成倒立、缩小的实像（照相机）", check: (s) => s.type === 0 && Mo.image(s.f, s.u, 0).tool === "照相机" },
    { id: "projector", text: "使物体成倒立、放大的实像（投影仪）", check: (s) => s.type === 0 && Mo.image(s.f, s.u, 0).tool === "投影仪" },
    { id: "magnifier", text: "使物体成正立、放大的虚像（放大镜）", check: (s) => s.type === 0 && Mo.image(s.f, s.u, 0).tool === "放大镜" },
    { id: "nofocus", text: "使物距等于焦距，此时不成像", check: (s) => s.type === 0 && Mo.image(s.f, s.u, 0).none },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
