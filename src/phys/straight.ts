import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-straight";
import { COL, arrow, circle, line, poly, rect, txt } from "./draw";

export const meta = CATALOG.straight;
type S = Record<string, number>;
const sh = (s: S) => Mo.shadow(s.D, s.src, s.a, s.b);
const ecl = (s: S) => Mo.eclipse(s.phase, s.beta);
const K = 3.5;
export const def: SimDef = {
  meta,
  lesson: [
    "光在同种均匀介质中沿直线传播。影子、小孔成像、日食和月食都是光的直线传播形成的；激光准直、排队看齐也利用了光的直线传播。光在真空中的传播速度最大，c = 3×10⁸ m/s；光在空气中的速度几乎与它相同，在水和玻璃中比较小。",
    "小孔成像：物体上每一点发出的光，沿直线穿过小孔，在光屏上形成倒立的实像。像的大小由物到小孔的距离和屏到小孔的距离决定：像高 ÷ 物高 = 像距 ÷ 物距；这个像与小孔的形状无关，孔太大时，像就变得模糊。",
    "光源很小（点光源）时，物体后面只有一片黑暗的影；光源较大时，影的中间是完全没有光的本影，周围是只有一部分光的半影。日食是月球挡住太阳光，月球的影落在地球上；月食是地球挡住太阳光，月球进入地球的影。因为月球的轨道面与地球的轨道面有夹角，所以并不是每个月都发生日食或月食。",
  ],
  formulas: ["\\dfrac{h'}{h}=\\dfrac{v}{u}", "t=\\dfrac{s}{c}"],
  params: [
    { id: "h", label: "蜡烛的高度", min: 2, max: 20, step: 1, value: 8, unit: "cm", when: (s) => s.mode === 0 },
    { id: "u", label: "蜡烛到小孔的距离", min: 10, max: 60, step: 1, value: 30, unit: "cm", when: (s) => s.mode === 0 },
    { id: "v", label: "小孔到光屏的距离", min: 5, max: 60, step: 1, value: 20, unit: "cm", when: (s) => s.mode === 0 },
    { id: "d", label: "小孔的直径", min: 1, max: 20, step: 1, value: 6, unit: "mm", when: (s) => s.mode === 0 },
    { id: "D", label: "挡板的宽度", min: 4, max: 20, step: 1, value: 10, unit: "cm", when: (s) => s.mode === 1 },
    { id: "src", label: "光源的宽度（0 为点光源）", min: 0, max: 30, step: 1, value: 6, unit: "cm", when: (s) => s.mode === 1 },
    { id: "a", label: "光源到挡板的距离", min: 20, max: 100, step: 5, value: 40, unit: "cm", when: (s) => s.mode === 1 },
    { id: "b", label: "挡板到光屏的距离", min: 10, max: 100, step: 5, value: 40, unit: "cm", when: (s) => s.mode === 1 },
    { id: "phase", label: "月球的位置（0° 为新月）", min: 0, max: 360, step: 1, value: 90, unit: "°", when: (s) => s.mode === 2 },
    { id: "beta", label: "月球偏离地球轨道面的角度", min: -6, max: 6, step: 0.1, value: 3, unit: "°", when: (s) => s.mode === 2 },
  ],
  choices: [{ id: "mode", label: "实验", value: 0, options: [[0, "小孔成像"], [1, "影与半影"], [2, "日食与月食"]] }],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const bl = Mo.blurMm(s.d, s.u, s.v); return [{ label: "像的高度", value: fmt(Mo.pinholeHeight(s.h, s.u, s.v), 1), unit: "cm" }, { label: "像的性质", value: "倒立的实像" }, { label: "光斑的宽度", value: fmt(bl, 1), unit: "mm" }, { label: "像是否清晰", value: bl <= Mo.SHARP_MM ? "清晰" : "模糊（孔太大）" }]; }
    if (s.mode === 1) { const r = sh(s); return [{ label: "本影的宽度", value: r.umbra > 0 ? fmt(r.umbra, 1) : "没有本影", unit: r.umbra > 0 ? "cm" : "" }, { label: "影的总宽度", value: fmt(r.whole, 1), unit: "cm" }, { label: "半影", value: r.penumbra ? "有" : "没有（点光源）" }]; }
    const e = ecl(s); return [{ label: "月球的位置", value: Mo.MOON_AT(s.phase) }, { label: "是否发生", value: e === "solar" ? "日食" : e === "lunar" ? "月食" : "没有日食或月食" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const bx = 70 + K * s.u, sx = bx + K * s.v, cy = 200, oh = s.h * K, ih = Mo.pinholeHeight(s.h, s.u, s.v) * K;
      rect(c, bx - 6, 40, 12, 320, "#868e96", COL.ink, 3, 3); rect(c, bx - 8, cy - Math.max(2, s.d * 0.9), 16, Math.max(4, s.d * 1.8), "#f8f9fa", null, 0, 2);
      rect(c, sx - 4, 60, 8, 280, "#fff", COL.ink, 3, 3);
      arrow(c, 70, cy + oh / 2, 70, cy - oh / 2, COL.orange, 6);
      line(c, 70, cy - oh / 2, sx, cy + ih / 2, COL.orange, 2); line(c, 70, cy + oh / 2, sx, cy - ih / 2, COL.orange, 2);
      arrow(c, sx, cy - ih / 2, sx, cy + ih / 2, COL.red, 6);
    } else if (s.mode === 1) {
      const r = sh(s), x0 = 40, xo = 40 + s.a * 3, xs = xo + s.b * 3 > 600 ? 600 : xo + s.b * 3, cy = 200, k = 2.4;
      const half = (v: number) => (v * k) / 2;
      // penumbra and umbra on the screen
      rect(c, xs - 4, cy - half(r.whole) - 2, 8, half(r.whole) * 2 + 4, "#ced4da", null, 0, 2);
      if (r.umbra > 0) rect(c, xs - 4, cy - half(r.umbra), 8, half(r.umbra) * 2, "#343a40", null, 0, 2);
      poly(c, [[x0, cy - half(s.src)], [xs, cy - half(r.whole)], [xs, cy + half(r.whole)], [x0, cy + half(s.src)]], "rgba(252,196,25,0.15)", null);
      rect(c, x0 - 8, cy - Math.max(3, half(s.src)), 16, Math.max(6, half(s.src) * 2), COL.yellow, COL.ink, 3, 6);
      rect(c, xo - 5, cy - half(s.D), 10, half(s.D) * 2, COL.metal, COL.ink, 3, 3);
      line(c, x0, cy - half(s.src), xo, cy - half(s.D), COL.orange, 2); line(c, x0, cy + half(s.src), xo, cy + half(s.D), COL.orange, 2);
      txt(c, `${fmt(r.whole, 1)} cm`, xs - 16, 40, 22, COL.ink, "right");
    } else {
      const e = ecl(s), cx = 360, cy = 200, rad = (s.phase * Math.PI) / 180, mx = cx - 130 * Math.cos(rad), my = cy - s.beta * 12;
      circle(c, 80, cy, 56, "#ffd43b", COL.orange, 4); circle(c, cx, cy, 30, COL.water2, COL.ink, 4); circle(c, mx, my, 12, "#dee2e6", COL.ink, 3);
      line(c, 140, cy, cx + 150, cy, COL.grey, 1.5, [6, 6]);
      if (e === "solar") poly(c, [[mx, my - 10], [cx - 6, cy - 6], [cx - 6, cy + 6], [mx, my + 10]], "rgba(52,58,64,0.5)", null);
      if (e === "lunar") poly(c, [[cx, cy - 30], [cx + 150, cy - 10], [cx + 150, cy + 10], [cx, cy + 30]], "rgba(52,58,64,0.35)", null);
      txt(c, e === "solar" ? "SOLAR" : e === "lunar" ? "LUNAR" : "NO ECLIPSE", 480, 60, 28, e === "none" ? COL.grey : COL.red);
    }
  },
  tasks: [
    { id: "equal", text: "小孔成像：使光屏上的像和蜡烛一样高", check: (s) => s.mode === 0 && Mo.pinholeHeight(s.h, s.u, s.v) === s.h },
    { id: "sharp", text: "小孔成像：使光斑的宽度不超过 2 mm，像清晰", check: (s) => s.mode === 0 && Mo.blurMm(s.d, s.u, s.v) <= Mo.SHARP_MM },
    { id: "point", text: "影：换成点光源，使影只有本影、没有半影", check: (s) => s.mode === 1 && s.src === 0 },
    { id: "eclipse", text: "日食与月食：使月球的位置和高度恰好发生一次日食或月食", check: (s) => s.mode === 2 && ecl(s) !== "none" },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
