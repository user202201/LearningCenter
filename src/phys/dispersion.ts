import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-dispersion";
import { COL, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.dispersion;
const AX = 300, AY = 36, H = 250, SX = 596;
const hex = (v: number[]) => `rgb(${v.map((x) => Math.round(Math.min(255, Math.max(0, x * 2.55)))).join(",")})`;
export const def: SimDef = {
  meta,
  lesson: [
    "白光通过三棱镜，会分解成红、橙、黄、绿、蓝、靛、紫七种色光，这种现象叫光的色散。不同颜色的光通过同一种玻璃时折射率不同：红光最小，紫光最大，所以紫光偏折得最多，红光偏折得最少。为了看得清楚，本实验使用色散较强的玻璃（真实的玻璃色散要弱得多）。",
    "色光的三原色是红、绿、蓝：红加绿得黄，绿加蓝得青，红加蓝得品红，三种色光等量混合得白光。不透明物体的颜色由它反射的色光决定：红色物体只反射红光，在绿光下看起来是黑色的。注意：色光的混合与颜料的混合不同。颜料的三原色是品红、黄、青（美术中常说红、黄、蓝）。",
  ],
  formulas: ["n=\\dfrac{c}{v}", "n_{\\text{紫}}>n_{\\text{红}}"],
  params: [
    { id: "A", label: "三棱镜的顶角", min: 30, max: 70, step: 5, value: 60, unit: "°", when: (s) => s.mode === 0 },
    { id: "th", label: "入射角", min: 20, max: 80, step: 1, value: 50, unit: "°", when: (s) => s.mode === 0 },
    { id: "r", label: "红光的亮度", min: 0, max: 100, step: 10, value: 100, unit: "%", when: (s) => s.mode === 1 },
    { id: "g", label: "绿光的亮度", min: 0, max: 100, step: 10, value: 0, unit: "%", when: (s) => s.mode === 1 },
    { id: "b", label: "蓝光的亮度", min: 0, max: 100, step: 10, value: 0, unit: "%", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "三棱镜色散"], [1, "色光的混合"], [2, "物体的颜色"]] },
    { id: "obj", label: "物体", value: 1, options: Mo.OBJECTS.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 2 },
    { id: "lamp", label: "照明的光", value: 0, options: Mo.LAMPS.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 2 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) {
      const a = Mo.prism(s.A, s.th, 0.65), b = Mo.prism(s.A, s.th, 0.42), sp = Mo.spread(s.A, s.th);
      return [
        { label: "红光的偏折角", value: a.tir ? "—" : fmt(a.dev, 1), unit: a.tir ? "" : "°" },
        { label: "紫光的偏折角", value: b.tir ? "—" : fmt(b.dev, 1), unit: b.tir ? "" : "°" },
        { label: "色散角（紫与红之差）", value: sp === null ? "—" : fmt(sp, 2), unit: sp === null ? "" : "°" },
        { label: "偏折最大的色光", value: sp === null ? "全反射" : "紫光" },
      ];
    }
    if (s.mode === 1) return [{ label: "红光", value: fmt(s.r, 0), unit: "%" }, { label: "绿光", value: fmt(s.g, 0), unit: "%" }, { label: "蓝光", value: fmt(s.b, 0), unit: "%" }, { label: "合成的颜色", value: Mo.mixName(s.r, s.g, s.b) }];
    return [{ label: "光源", value: Mo.LAMPS[s.lamp][0] }, { label: "物体", value: Mo.OBJECTS[s.obj][0] }, { label: "看到的颜色", value: Mo.seenName(s.obj, s.lamp) }];
  },
  draw(c, w, hh, s) {
    if (s.mode === 0) {
      rect(c, 0, 0, 640, 397, "#f1f3f5", null, 0, 0);
      const h = rad(s.A / 2), ex = H * Math.tan(h);
      const P1 = [AX - ex / 2, AY + H / 2], rf = [AX + ex, AY + H];
      c.beginPath(); c.moveTo(AX, AY); c.lineTo(AX - ex, AY + H); c.lineTo(AX + ex, AY + H); c.closePath(); c.fillStyle = "rgba(165,216,255,0.55)"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
      const pw = Mo.prism(s.A, s.th, 0.575), phi = h - rad(s.th);
      line(c, P1[0] - 190 * Math.cos(phi), P1[1] - 190 * Math.sin(phi), P1[0], P1[1], COL.grey, 8); line(c, P1[0] - 190 * Math.cos(phi), P1[1] - 190 * Math.sin(phi), P1[0], P1[1], "#fff", 4);
      rect(c, SX, 0, 14, 397, "#dee2e6", COL.grey, 2, 0);
      for (const wv of Mo.WAVES) {
        const p = Mo.prism(s.A, s.th, wv.l);
        const psi = h - rad(p.r1), dx = Math.cos(psi), dy = Math.sin(psi), ux = Math.sin(h), uy = Math.cos(h);
        // P1 + t (dx, dy) = apex + u (ux, uy)
        const det = dx * -uy - dy * -ux, t = ((AX - P1[0]) * -uy - (AY - P1[1]) * -ux) / det;
        const P2 = [P1[0] + t * dx, P1[1] + t * dy];
        line(c, P1[0], P1[1], P2[0], P2[1], wv.c, 3);
        if (p.tir) { txt(c, "TIR", P2[0] + 30, P2[1], 16, COL.red); continue; }
        const out = -h + rad(p.theta2), len = (SX - P2[0]) / Math.cos(out), Y = P2[1] + len * Math.sin(out);
        line(c, P2[0], P2[1], SX, Y, wv.c, 3); circle(c, SX + 7, Y, 6, wv.c, null);
      }
      void pw; void rf;
      txt(c, "R", 625, 20, 16, "#e03131"); txt(c, "V", 625, 377, 16, "#7048e8");
      return;
    }
    if (s.mode === 1) {
      rect(c, 0, 0, 640, 397, "#212529", null, 0, 0);
      c.save(); c.globalCompositeOperation = "lighter";
      for (const [x, y, v, col] of [[250, 140, s.r, [255, 0, 0]], [390, 140, s.g, [0, 255, 0]], [320, 250, s.b, [0, 0, 255]]] as [number, number, number, number[]][]) {
        c.beginPath(); c.arc(x, y, 105, 0, Math.PI * 2); c.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${v / 100})`; c.fill();
      }
      c.restore();
      txt(c, "R", 190, 100, 24, "#fff"); txt(c, "G", 450, 100, 24, "#fff"); txt(c, "B", 320, 345, 24, "#fff");
      rect(c, 520, 40, 90, 90, hex([s.r, s.g, s.b]), "#fff", 4, 12);
      return;
    }
    const lamp = Mo.LAMPS[s.lamp][1].map((v) => v * 100), obj = Mo.OBJECTS[s.obj][1].map((v) => v * 255), sn = Mo.seen(s.obj, s.lamp);
    rect(c, 0, 0, 640, 397, "#f1f3f5", null, 0, 0);
    circle(c, 100, 200, 46, hex(lamp), COL.ink, 4); txt(c, "Lamp", 100, 275, 20, COL.ink);
    line(c, 150, 200, 280, 200, hex(lamp), 10);
    rect(c, 290, 130, 120, 140, `rgb(${obj.join(",")})`, COL.ink, 4, 10); txt(c, "Object", 350, 295, 20, COL.ink);
    line(c, 415, 200, 520, 200, hex(sn), 10);
    circle(c, 560, 200, 40, hex(sn), COL.ink, 4); txt(c, "Eye", 560, 270, 20, COL.ink);
  },
  tasks: [
    { id: "spread", text: "三棱镜：使红光与紫光之间的色散角超过 8°", check: (s) => s.mode === 0 && (Mo.spread(s.A, s.th) ?? 0) > 8 },
    { id: "yellow", text: "色光的混合：使红光和绿光混合得到黄色（蓝光熄灭）", check: (s) => s.mode === 1 && Mo.mixName(s.r, s.g, s.b) === "黄色" && s.b === 0 },
    { id: "white", text: "色光的混合：用红、绿、蓝三种色光得到白色", check: (s) => s.mode === 1 && Mo.mixName(s.r, s.g, s.b) === "白色" },
    { id: "black", text: "物体的颜色：使一个红色物体看起来是黑色的", check: (s) => s.mode === 2 && s.obj === 1 && Mo.seenName(s.obj, s.lamp) === "黑色" },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
