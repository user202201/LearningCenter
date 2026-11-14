import { mountSim, type SimDef, type PhysCtx, fmt, clamp } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-magfield";
import { COL, arrow, circle, line, poly, rect, txt } from "./draw";

export const meta = CATALOG.magfield;
const ns = (s: Record<string, number>) => (s.src === 0 ? s.pol : s.cur);
const needle = (c: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number, L = 26) => {
  const m = Math.hypot(dx, dy) || 1, ux = dx / m, uy = dy / m, px = -uy, py = ux;
  poly(c, [[x + ux * L, y + uy * L], [x + px * 6, y + py * 6], [x - px * 6, y - py * 6]], COL.red, COL.ink, 2);
  poly(c, [[x - ux * L, y - uy * L], [x + px * 6, y + py * 6], [x - px * 6, y - py * 6]], COL.blue, COL.ink, 2);
  circle(c, x, y, 3, "#fff", COL.ink, 1.5);
};
export const def: SimDef = {
  meta,
  lesson: [
    "磁体周围存在磁场，磁场对放入其中的磁体有力的作用。小磁针静止时 N 极所指的方向就是该点的磁场方向。为了形象地描述磁场，画出磁感线：在磁体外部，磁感线从 N 极出发回到 S 极；磁感线越密的地方磁场越强（两极附近最强）；磁感线不会相交，它不是真实存在的线。把画面里的小磁针拖到不同的位置，看它怎样指向。",
    "奥斯特实验：把通电直导线放在小磁针上方（导线沿南北方向），小磁针发生偏转，说明电流周围存在磁场；改变电流方向，小磁针偏转的方向也改变；电流越大、离导线越近，磁场越强，偏转越大（小磁针同时受到地磁场的作用）。通电螺线管外部的磁场与条形磁铁相似，极性由右手螺旋定则判断：用右手握住螺线管，四指弯曲的方向是电流的方向，大拇指所指的那端是 N 极。",
    "地球是一个巨大的磁体，周围存在地磁场：地磁的两极在地理两极附近，但并不重合（存在磁偏角，沈括最早记载）。地磁的北极在地理南极附近，地磁的南极在地理北极附近，所以小磁针的 N 极总指向地理的北方。地磁场磁感线与地面的夹角叫磁倾角：赤道附近磁针水平，磁极附近磁针接近竖直。",
  ],
  formulas: ["B=\\dfrac{\\mu_0 I}{2\\pi d}", "\\tan\\varphi=\\dfrac{B_{\\text{线}}}{B_{\\text{地}}}"],
  params: [
    { id: "I", label: "导线中的电流", min: 0, max: 5, step: 0.5, value: 0, unit: "A", when: (s) => s.mode === 1 },
    { id: "d", label: "小磁针到导线的距离", min: 1, max: 10, step: 1, value: 4, unit: "cm", when: (s) => s.mode === 1 },
    { id: "lat", label: "所在的纬度（北纬为正）", min: -90, max: 90, step: 5, value: 40, unit: "°", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "磁感线"], [1, "奥斯特实验"], [2, "地磁场"]] },
    { id: "src", label: "磁场的来源", value: 0, options: [[0, "条形磁铁"], [1, "通电螺线管"]], when: (s) => s.mode === 0 },
    { id: "pol", label: "磁铁的 N 极在", value: 1, options: [[1, "右边"], [-1, "左边"]], when: (s) => s.mode === 0 && s.src === 0 },
    { id: "cur", label: "螺线管中的电流", value: -1, options: [[1, "从右端看是逆时针"], [-1, "从右端看是顺时针"]], when: (s) => s.mode === 0 && s.src === 1 },
    { id: "dirI", label: "导线中电流的方向", value: 1, options: [[1, "向北"], [-1, "向南"]], when: (s) => s.mode === 1 },
  ],
  hidden: { cx: 520, cy: 330 },
  drag: true,
  pointer: (kind, x, y, s) => { if (s.mode !== 0 || kind === "up") return; return { cx: clamp(x, 20, 620), cy: clamp(y, 20, 380) }; },
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) {
      const a = Mo.needleAngle(s.cx, s.cy, ns(s)), P = Mo.poles(ns(s)), dN = Math.hypot(s.cx - P.N[0], s.cy - P.N[1]), dS = Math.hypot(s.cx - P.S[0], s.cy - P.S[1]);
      return [{ label: "小磁针 N 极所指的方向", value: fmt(a, 0), unit: "°" }, { label: "磁场的强弱（相对值）", value: fmt(Mo.strength(s.cx, s.cy, ns(s)), 1) }, { label: "离哪个磁极更近", value: Math.abs(dN - dS) < 1 ? "一样近" : dN < dS ? "N 极" : "S 极" }, { label: "右端的磁极", value: ns(s) > 0 ? "N 极" : "S 极" }];
    }
    if (s.mode === 1) { const f = Mo.deflection(s.I, s.d, s.dirI); return [{ label: "电流产生的磁场", value: fmt(Mo.wireB(s.I, s.d), 1), unit: "μT" }, { label: "地磁场（水平分量）", value: fmt(Mo.BE, 0), unit: "μT" }, { label: "小磁针的偏转角", value: fmt(Math.abs(f), 1), unit: "°" }, { label: "偏转的方向", value: s.I === 0 ? "不偏转" : f > 0 ? "向东偏" : "向西偏" }]; }
    const d = Mo.dip(s.lat);
    return [{ label: "磁倾角", value: fmt(Math.abs(d), 1), unit: "°" }, { label: "磁针 N 极", value: Math.abs(d) < 0.5 ? "水平" : d > 0 ? "向下倾斜" : "向上倾斜" }, { label: "磁场的强弱（相对赤道）", value: fmt(Mo.earthB(s.lat), 2) }, { label: "水平分量（相对赤道）", value: fmt(Mo.earthH(s.lat), 2) }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const n = ns(s), P = Mo.poles(n);
      for (const ln of Mo.lines(n)) { c.beginPath(); ln.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.strokeStyle = "rgba(112,72,232,0.55)"; c.lineWidth = 2.5; c.stroke(); const k = Math.floor(ln.length / 2); if (ln.length > 4) { const [x1, y1] = ln[k], [x2, y2] = ln[k + 1]; arrow(c, x1, y1, x2 + (x2 - x1) * 3, y2 + (y2 - y1) * 3, "rgba(112,72,232,0.9)", 2.5); } }
      if (s.src === 0) { rect(c, Mo.CX - 100, Mo.CY - 22, 100, 44, n > 0 ? "#74c0fc" : "#ff8787", COL.ink, 4, 4); rect(c, Mo.CX, Mo.CY - 22, 100, 44, n > 0 ? "#ff8787" : "#74c0fc", COL.ink, 4, 4); txt(c, n > 0 ? "S" : "N", Mo.CX - 50, Mo.CY, 26, COL.ink); txt(c, n > 0 ? "N" : "S", Mo.CX + 50, Mo.CY, 26, COL.ink); }
      else { rect(c, Mo.CX - 100, Mo.CY - 26, 200, 52, "#fff3bf", COL.ink, 4, 4); for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(Mo.CX - 80 + i * 20, Mo.CY, 6, 26, 0, 0, Math.PI * 2); c.strokeStyle = "#c2751b"; c.lineWidth = 3; c.stroke(); } txt(c, P.S[0] < Mo.CX ? "S" : "N", Mo.CX - 120, Mo.CY, 22, P.S[0] < Mo.CX ? COL.blue : COL.red); txt(c, P.N[0] > Mo.CX ? "N" : "S", Mo.CX + 120, Mo.CY, 22, P.N[0] > Mo.CX ? COL.red : COL.blue); }
      const [bx, by] = Mo.field(s.cx, s.cy, n); needle(c, s.cx, s.cy, bx, by);
      return;
    }
    if (s.mode === 1) {
      circle(c, 320, 200, 100, "#fff", COL.ink, 4); txt(c, "N", 320, 120, 22, COL.ink); txt(c, "S", 320, 280, 22, COL.ink); txt(c, "W", 240, 200, 20, COL.grey); txt(c, "E", 400, 200, 20, COL.grey);
      const f = Mo.deflection(s.I, s.d, s.dirI), a = (f * Math.PI) / 180;
      needle(c, 320, 200, Math.sin(a), -Math.cos(a), 70);
      line(c, 320, 20, 320, 380, COL.orange, 10); line(c, 320, 20, 320, 380, "#ffd8a8", 4); if (s.I > 0) arrow(c, 320, s.dirI > 0 ? 130 : 270, 320, s.dirI > 0 ? 60 : 340, COL.red, 6);
      txt(c, `${fmt(Math.abs(f), 1)}°`, 480, 200, 30, COL.purple);
      return;
    }
    const R = 120, cx = 320, cy = 200, l = (s.lat * Math.PI) / 180;
    circle(c, cx, cy, R, "#d0ebff", COL.ink, 5);
    for (const L of [1.3, 1.8, 2.5]) { const lm = Math.acos(Math.sqrt(1 / L)); for (const sg of [1, -1]) { c.beginPath(); for (let i = 0; i <= 60; i++) { const t = -lm + (2 * lm * i) / 60, r = R * L * Math.cos(t) ** 2; const X = cx + sg * r * Math.cos(t), Y = cy - r * Math.sin(t); (i ? c.lineTo : c.moveTo).call(c, X, Y); } c.strokeStyle = "rgba(112,72,232,0.4)"; c.lineWidth = 2.5; c.stroke(); } }
    txt(c, "N", cx, cy - R - 16, 22, COL.ink); txt(c, "S", cx, cy + R + 16, 22, COL.ink);
    txt(c, "S-pole", cx - 78, cy - R + 14, 14, COL.blue); txt(c, "N-pole", cx - 78, cy + R - 14, 14, COL.red);
    const px = cx + R * Math.cos(l), py = cy - R * Math.sin(l);
    const bx = -3 * Math.sin(l) * Math.cos(l), by = -(Math.cos(l) ** 2) + 2 * Math.sin(l) ** 2;
    circle(c, px, py, 5, COL.ink); needle(c, px + Math.cos(l) * 34, py - Math.sin(l) * 34, bx, by, 24);
    txt(c, `${s.lat}°`, 560, 200, 28, COL.purple);
  },
  tasks: [
    { id: "near", text: "磁感线：把小磁针拖到 N 极附近，观察它的 N 极指向远离磁铁的方向", check: (s) => { if (s.mode !== 0) return false; const n = ns(s), P = Mo.poles(n), d = Math.hypot(s.cx - P.N[0], s.cy - P.N[1]); if (d > 70) return false; const [bx, by] = Mo.field(s.cx, s.cy, n), rx = s.cx - P.N[0], ry = s.cy - P.N[1]; return (bx * rx + by * ry) / (Math.hypot(bx, by) * Math.hypot(rx, ry)) > 0.85; } },
    { id: "solenoid", text: "通电螺线管：改变电流方向，使螺线管的右端是 N 极", check: (s) => s.mode === 0 && s.src === 1 && Mo.solenoidRightPole(s.cur) === "N" },
    { id: "oersted", text: "奥斯特实验：使电流方向向南，并使小磁针偏转 45° 以上", check: (s) => s.mode === 1 && s.dirI === -1 && Math.abs(Mo.deflection(s.I, s.d, s.dirI)) >= 45 },
    { id: "dip", text: "地磁场：移到接近磁极的纬度，使磁倾角达到 80° 以上", check: (s) => s.mode === 2 && Math.abs(Mo.dip(s.lat)) >= 80 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
