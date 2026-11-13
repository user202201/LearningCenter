import { mountSim, type SimDef, type PhysCtx, fmt, rad } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-em";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.em;
export const def: SimDef = {
  meta,
  lesson: [
    "电磁铁：通电螺线管插入铁芯后磁性大大增强。电磁铁的磁性强弱与电流大小、线圈匝数、有无铁芯有关：电流越大、匝数越多、有铁芯，磁性越强。电流方向改变，磁极也改变（右手螺旋定则）。",
    "电动机：通电导线在磁场中受到力的作用，受力方向与电流方向和磁场方向有关（左手定则）；换向器使线圈持续转动，改变电流方向或对调磁极，转动方向改变。F = BIL。",
    "电磁感应：闭合电路的一部分导体在磁场中做切割磁感线运动，或穿过线圈的磁通量变化时，电路中产生感应电流（发电机的原理）。磁铁移动越快、线圈匝数越多，感应电动势越大；磁铁不动时没有感应电流；插入与拔出时电流方向相反。",
  ],
  formulas: ["F=BIL", "\\varepsilon=-N\\dfrac{\\Delta\\Phi}{\\Delta t}"],
  params: [
    { id: "N", label: "线圈匝数", min: 10, max: 200, step: 10, value: 100, when: (s) => s.mode !== 1 },
    { id: "I", label: "电流", min: 0, max: 3, step: 0.1, value: 1, unit: "A", when: (s) => s.mode === 0 },
    { id: "Im", label: "电流", min: 0, max: 5, step: 0.5, value: 2, unit: "A", when: (s) => s.mode === 1 },
    { id: "B", label: "磁感应强度", min: 0.1, max: 1, step: 0.1, value: 0.5, unit: "T", when: (s) => s.mode === 1 },
    { id: "v", label: "磁铁的速度（正为向右）", min: -30, max: 30, step: 5, value: 10, unit: "cm/s", when: (s) => s.mode === 2 },
    { id: "x0", label: "磁铁的起始位置", min: -15, max: 15, step: 1, value: -8, unit: "cm", when: (s) => s.mode === 2 },
    { id: "t", label: "时间", min: 0, max: 2, step: 0.02, value: 0, unit: "s", when: (s) => s.mode === 1 || s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "电磁铁"], [1, "电动机"], [2, "电磁感应（发电机）"]] },
    { id: "core", label: "铁芯", value: 0, options: [[0, "没有铁芯"], [1, "插入铁芯"]], when: (s) => s.mode === 0 },
    { id: "dirI", label: "电流方向", value: 1, options: [[1, "正向"], [-1, "反向"]], when: (s) => s.mode < 2 },
    { id: "pole", label: "左边的磁极", value: 1, options: [[1, "N 极"], [0, "S 极"]], when: (s) => s.mode === 1 },
  ],
  play: { param: "t", rate: 0.5 },
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "磁性强弱（相对值）", value: fmt(Mo.strength(s.N, s.I, s.core), 0) }, { label: "吸起的回形针", value: fmt(Mo.clips(s.N, s.I, s.core), 0), unit: "" }, { label: "右端的磁极", value: s.I === 0 ? "—" : s.dirI > 0 ? "N 极" : "S 极" }];
    if (s.mode === 1) { const d = Mo.motorDir(s.Im, s.dirI, s.pole); return [{ label: "导线受到的力", value: fmt(Mo.motorForce(s.B, s.Im), 3), unit: "N" }, { label: "转动方向", value: d === 0 ? "不转动" : d > 0 ? "顺时针" : "逆时针" }]; }
    const x = Mo.position(s.x0, s.v, s.t), e = Mo.emf(s.N, x, s.v);
    return [{ label: "磁铁的位置", value: fmt(x, 1), unit: "cm" }, { label: "穿过线圈的磁通量", value: fmt(Mo.flux(x) * 1000, 3), unit: "mWb" }, { label: "感应电动势", value: fmt(e * 1000, 1), unit: "mV" }, { label: "电流表指针", value: Math.abs(e) < 1e-4 ? "不偏转" : e > 0 ? "向右偏转" : "向左偏转" }];
  },
  draw(c, w, hh, s) {
    if (s.mode === 0) {
      const k = Mo.clips(s.N, s.I, s.core);
      const x0 = 140, x1 = 400, y = 150;
      rect(c, x0 - 10, y - 38, x1 - x0 + 20, 76, s.core ? "#adb5bd" : "#f1f3f5", COL.ink, 4, 8);
      for (let i = 0; i < Math.min(14, 4 + Math.round(s.N / 16)); i++) { const cx = x0 + 10 + (i * (x1 - x0 - 20)) / Math.min(13, 3 + Math.round(s.N / 16)); c.beginPath(); c.ellipse(cx, y, 12, 48, 0, 0, Math.PI * 2); c.strokeStyle = "#c2751b"; c.lineWidth = 5; c.stroke(); }
      txt(c, s.dirI > 0 ? "S" : "N", x0 - 26, y, 26, COL.blue, "right"); txt(c, s.dirI > 0 ? "N" : "S", x1 + 26, y, 26, COL.red, "left");
      line(c, x0, y + 52, x0, 270, COL.ink, 4); line(c, x1, y + 52, x1, 270, COL.ink, 4); line(c, x0, 270, 270, 270, COL.ink, 4); line(c, x1, 270, 330, 270, COL.ink, 4);
      rect(c, 270, 252, 60, 36, "#fff", COL.ink, 4, 4); txt(c, `${fmt(s.I, 1)} A`, 300, 270, 18, COL.ink);
      // paper clips below the right end
      for (let i = 0; i < k; i++) { const cx = x1 + 6 - (i % 5) * 18 + (Math.floor(i / 5) % 2) * 8, cy = y + 68 + Math.floor(i / 5) * 20; rect(c, cx - 6, cy - 7, 12, 22, "", "#868e96", 3, 6); }
      return;
    }
    if (s.mode === 1) {
      const d = Mo.motorDir(s.Im, s.dirI, s.pole), ang = d * (s.Im / 5) * 360 * 1.2 * s.t;
      rect(c, 40, 100, 90, 200, s.pole ? "#ff8787" : "#74c0fc", COL.ink, 4, 8); txt(c, s.pole ? "N" : "S", 85, 200, 40, COL.ink);
      rect(c, 510, 100, 90, 200, s.pole ? "#74c0fc" : "#ff8787", COL.ink, 4, 8); txt(c, s.pole ? "S" : "N", 555, 200, 40, COL.ink);
      c.save(); c.translate(320, 200); c.rotate(rad(ang));
      rect(c, -90, -50, 180, 100, "rgba(255,244,230,0.5)", "#c2751b", 7, 6);
      circle(c, -90, 0, 10, COL.ink); circle(c, 90, 0, 10, COL.ink);
      arrow(c, -90, 0, -90, d > 0 ? -50 : 50, COL.red, 5); arrow(c, 90, 0, 90, d > 0 ? 50 : -50, COL.red, 5);
      c.restore();
      txt(c, `F = ${fmt(Mo.motorForce(s.B, s.Im), 3)} N`, 320, 340, 22, COL.red);
      if (d !== 0) { c.beginPath(); c.arc(320, 200, 130, -2.2, -0.9); c.strokeStyle = COL.orange; c.lineWidth = 5; c.stroke(); const a = d > 0 ? -0.9 : -2.2; arrow(c, 320 + 130 * Math.cos(a - d * 0.05), 200 + 130 * Math.sin(a - d * 0.05), 320 + 130 * Math.cos(a + d * 0.1), 200 + 130 * Math.sin(a + d * 0.1), COL.orange, 5); }
      return;
    }
    // induction: a coil in the middle, a magnet moving along the axis, a galvanometer
    const x = Mo.position(s.x0, s.v, s.t), e = Mo.emf(s.N, x, s.v);
    const X = (cm: number) => 320 + cm * 14;
    const turns = 3 + Math.round(s.N / 40);
    rect(c, 300, 120, 40, 80, "#e9ecef", null, 0, 6);
    for (let i = 0; i < turns; i++) { c.beginPath(); c.ellipse(304 + (i * 32) / turns, 160, 10, 44, 0, 0, Math.PI * 2); c.strokeStyle = "#c2751b"; c.lineWidth = 5; c.stroke(); }
    const mx = X(x);
    rect(c, mx - 50, 135, 50, 50, "#74c0fc", COL.ink, 4, 6); rect(c, mx, 135, 50, 50, "#ff8787", COL.ink, 4, 6); txt(c, "S", mx - 25, 160, 26, COL.ink); txt(c, "N", mx + 25, 160, 26, COL.ink);
    if (Math.abs(s.v) > 0) arrow(c, mx, 110, mx + Math.sign(s.v) * Math.min(80, Math.abs(s.v) * 3 + 20), 110, COL.green, 5);
    line(c, 320, 204, 320, 270, COL.ink, 4); line(c, 320, 270, 200, 270, COL.ink, 4); line(c, 320, 120, 320, 70, COL.ink, 4); line(c, 320, 70, 440, 70, COL.ink, 4); line(c, 440, 70, 440, 270, COL.ink, 4); line(c, 440, 270, 330, 270, COL.ink, 0);
    // galvanometer
    circle(c, 520, 250, 70, "#fff"); c.beginPath(); c.arc(520, 250, 56, Math.PI * 1.2, Math.PI * 1.8); c.strokeStyle = COL.grey; c.lineWidth = 3; c.stroke();
    const na = rad(Math.max(-55, Math.min(55, (e / 0.12) * 55))) - Math.PI / 2;
    line(c, 520, 250, 520 + 54 * Math.cos(na), 250 + 54 * Math.sin(na), COL.red, 5); circle(c, 520, 250, 6, COL.ink); txt(c, "G", 520, 285, 22, COL.ink);
    line(c, 440, 270, 470, 250, COL.ink, 4);
    // the flux curve
    const gx = (xx: number) => 20 + ((xx + 20) / 40) * 280;
    c.beginPath(); for (let i = 0; i <= 80; i++) { const xx = -20 + i / 2; const px = gx(xx), py = 380 - Mo.flux(xx) * 1.2e6 * 0.6; (i ? c.lineTo : c.moveTo).call(c, px, py); }
    c.strokeStyle = COL.purple; c.lineWidth = 3; c.stroke(); circle(c, gx(Math.max(-20, Math.min(20, x))), 380 - Mo.flux(x) * 1.2e6 * 0.6, 7, COL.red);
    txt(c, "Φ", 24, 280, 22, COL.purple, "left"); txt(c, "x", 300, 392, 18, COL.grey, "right");
  },
  tasks: [
    { id: "clips", text: "电磁铁：插入铁芯，使它吸起至少 5 个回形针", check: (s) => s.mode === 0 && s.core === 1 && Mo.clips(s.N, s.I, 1) >= 5 },
    { id: "noCore", text: "电磁铁：不插铁芯，通过增大匝数和电流，吸起至少 3 个回形针", check: (s) => s.mode === 0 && s.core === 0 && Mo.clips(s.N, s.I, 0) >= 3 },
    { id: "reverse", text: "电动机：改变电流方向或对调磁极，使线圈逆时针转动", check: (s) => s.mode === 1 && Mo.motorDir(s.Im, s.dirI, s.pole) < 0 },
    { id: "emf", text: "电磁感应：使感应电动势的大小超过 100 mV", check: (s) => s.mode === 2 && Math.abs(Mo.emf(s.N, Mo.position(s.x0, s.v, s.t), s.v)) > 0.1 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
