import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-reflection";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.reflection;
const OBJ_H = 6;   // cm
export const def: SimDef = {
  meta,
  lesson: [
    "光的反射定律：反射光线、入射光线和法线在同一平面内；反射光线和入射光线分别位于法线两侧；反射角等于入射角。光路是可逆的。",
    "平面镜成像：像和物的大小相等；像到镜面的距离等于物到镜面的距离；像和物的连线与镜面垂直；平面镜成的是正立的虚像（不能用光屏接收）。",
    "镜面转过 α 角，入射光线不动，反射光线转过 2α 角。",
  ],
  formulas: ["\\angle r=\\angle i", "u=v"],
  params: [
    { id: "theta0", label: "入射光线与法线的夹角", min: 0, max: 70, step: 5, value: 35, unit: "°", when: (s) => s.mode === 0 },
    { id: "alpha", label: "镜面转过的角度", min: -20, max: 20, step: 5, value: 0, unit: "°", when: (s) => s.mode === 0 },
    { id: "d", label: "物体到平面镜的距离", min: 2, max: 30, step: 1, value: 10, unit: "cm", when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "实验", value: 0, options: [[0, "光的反射"], [1, "平面镜成像"]] }],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 1) { const im = Mo.planeImage(s.d, OBJ_H); return [
      { label: "物距", value: fmt(im.objDist, 0), unit: "cm" }, { label: "像距", value: fmt(im.imgDist, 0), unit: "cm" },
      { label: "物与像的距离", value: fmt(im.sep, 0), unit: "cm" }, { label: "物高", value: fmt(OBJ_H, 0), unit: "cm" }, { label: "像高", value: fmt(im.imgH, 0), unit: "cm" },
      { label: "像的性质", value: "正立、等大的虚像" }]; }
    const r = Mo.reflection(s.theta0, s.alpha);
    return [{ label: "入射角", value: fmt(r.thetaI, 0), unit: "°" }, { label: "反射角", value: r.hit ? fmt(r.thetaR, 0) : "—", unit: r.hit ? "°" : "" },
      { label: "入射光线与反射光线的夹角", value: r.hit ? fmt(r.thetaI + r.thetaR, 0) : "—", unit: r.hit ? "°" : "" }];
  },
  draw(c, w, hh, s) {
    if (s.mode === 0) {
      const cx = 320, cy = 250, L = 190;
      const r = Mo.reflection(s.theta0, s.alpha);
      // normal of the mirror (rotated with it) and the mirror
      const nx = Math.sin(rad(s.alpha)), ny = -Math.cos(rad(s.alpha));
      line(c, cx - nx * 20, cy - ny * 20, cx + nx * 210, cy + ny * 210, COL.grey, 2.5, [8, 7]);
      c.save(); c.translate(cx, cy); c.rotate(rad(s.alpha));
      rect(c, -190, 0, 380, 14, "#74c0fc", COL.ink, 3, 4);
      for (let x = -180; x < 190; x += 22) line(c, x, 14, x - 12, 30, COL.ink, 2.5);
      c.restore();
      const dir = (a: number) => [Math.sin(rad(a)), -Math.cos(rad(a))];
      const [sx, sy] = dir(-s.theta0);
      arrow(c, cx + sx * L, cy + sy * L, cx + sx * 6, cy + sy * 6, COL.orange, 5);
      if (r.hit) { const [rx, ry] = dir(r.outDir); arrow(c, cx + rx * 6, cy + ry * 6, cx + rx * L, cy + ry * L, COL.red, 5); }
      circle(c, cx, cy, 6, COL.ink);
      circle(c, cx + sx * (L + 26), cy + sy * (L + 26), 18, COL.yellow);   // the lamp
      txt(c, "N", cx + nx * 222, cy + ny * 222, 20, COL.grey);
      txt(c, `i = ${Math.round(r.thetaI)}°`, 90, 40, 24, COL.orange, "left");
      txt(c, r.hit ? `r = ${Math.round(r.thetaR)}°` : "r = —", 90, 74, 24, COL.red, "left");
      return;
    }
    // plane mirror image: the mirror is the vertical line x = 320, the object on its left
    const sc = 9, mx = 320, base = 270;
    rect(c, mx, 40, 12, 260, "#74c0fc", COL.ink, 3, 4);
    for (let y = 56; y < 300; y += 22) line(c, mx + 12, y, mx + 28, y - 12, COL.ink, 2.5);
    const ox = mx - s.d * sc, ix = mx + s.d * sc, tip = base - OBJ_H * sc;
    line(c, 20, base, 620, base, "#dee2e6", 2);
    const obj = (x: number, color: string, dash: number[]) => { c.setLineDash(dash); arrow(c, x, base, x, tip, color, 6); c.setLineDash([]); circle(c, x, tip - 12, 11, color === COL.green ? COL.green : "#ffe066"); };
    obj(ox, COL.green, []);
    c.globalAlpha = 0.7; obj(ix, COL.green, [6, 6]); c.globalAlpha = 1;
    // eye and the ray that makes the image
    const ex = 50, ey = 250, u = (mx - ex) / (ix - ex), hy = ey + u * (tip - ey);
    line(c, ox, tip, mx, hy, COL.orange, 3); arrow(c, mx, hy, ex + 20, ey + (hy - ey) * (20 / (mx - ex)), COL.orange, 3);
    line(c, mx, hy, ix, tip, COL.orange, 2.5, [6, 6]);
    circle(c, ex, ey, 14, "#fff"); circle(c, ex + 3, ey, 6, COL.ink);
    line(c, ox, base + 14, mx, base + 14, COL.grey, 2); txt(c, `u = ${s.d} cm`, (ox + mx) / 2, base + 32, 18, COL.grey);
    line(c, mx, base + 14, ix, base + 14, COL.grey, 2); txt(c, `v = ${s.d} cm`, (ix + mx) / 2, base + 32, 18, COL.grey);
  },
  tasks: [
    { id: "r30", text: "使入射角为 30°，观察反射角也是 30°", check: (s) => s.mode === 0 && Mo.reflection(s.theta0, s.alpha).thetaI === 30 },
    { id: "rot", text: "保持入射光线与法线的夹角为 35°，使镜面转过 10°，观察反射光线转过 20°", check: (s) => s.mode === 0 && s.theta0 === 35 && s.alpha === 10 },
    { id: "u12", text: "平面镜成像：使物体到镜面的距离为 12 cm，读出物与像的距离 24 cm", check: (s) => s.mode === 1 && s.d === 12 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
