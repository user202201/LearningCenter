import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-engine";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.engine;
const CONV = ["没有能量转化（靠飞轮的惯性）", "机械能转化为内能", "内能转化为机械能", "没有能量转化（靠飞轮的惯性）"];
export const def: SimDef = {
  meta,
  lesson: [
    "热机是把内能转化为机械能的机器。四冲程内燃机（汽油机、柴油机）的一个工作循环有四个冲程，曲轴转 2 圈，活塞往复 2 次，只有做功冲程对外做功：吸气冲程（进气门开）、压缩冲程（机械能转化为内能，气体温度升高）、做功冲程（点火后高温高压燃气推动活塞，内能转化为机械能）、排气冲程（排气门开）。汽油机用火花塞点火，柴油机靠压缩使空气升温后喷油自燃。",
    "热机的效率：用来做有用功的那部分能量与燃料完全燃烧放出的热量之比，η = W有 / Q放。燃料燃烧放出的能量中，废气带走一大部分，还有冷却水带走的热量和摩擦损失，所以热机的效率总小于 100%（汽油机约 25% 到 30%，柴油机约 30% 到 40%）。燃料放出的热量 Q = qm。",
    "能量守恒定律：能量既不会凭空消灭，也不会凭空产生，它只会从一种形式转化为其他形式，或者从一个物体转移到别的物体，在转化和转移的过程中，能量的总量保持不变。所以永动机是不可能制成的。",
  ],
  formulas: ["Q=qm", "\\eta=\\dfrac{W_{\\text{有}}}{Q_{\\text{放}}}\\times100\\%"],
  params: [
    { id: "th", label: "曲轴转过的角度", min: 0, max: 719, step: 1, value: 45, unit: "°", when: (s) => s.mode === 0 },
    { id: "m", label: "燃料的质量", min: 0.1, max: 2, step: 0.1, value: 1, unit: "kg", when: (s) => s.mode === 1 },
    { id: "ex", label: "废气带走的热量", min: 10, max: 50, step: 1, value: 33, unit: "%", when: (s) => s.mode === 1 },
    { id: "co", label: "冷却水带走的热量", min: 10, max: 40, step: 1, value: 30, unit: "%", when: (s) => s.mode === 1 },
    { id: "fr", label: "摩擦和辐射损失", min: 0, max: 20, step: 1, value: 7, unit: "%", when: (s) => s.mode === 1 },
    { id: "W", label: "声称得到的有用功", min: 0, max: 150, step: 5, value: 80, unit: "J", when: (s) => s.mode === 2 },
    { id: "Qh", label: "声称散失的热量", min: 0, max: 100, step: 5, value: 40, unit: "J", when: (s) => s.mode === 2 },
    { id: "Qo", label: "声称损失的声能和其他", min: 0, max: 50, step: 5, value: 10, unit: "J", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "四冲程"], [1, "热机的效率"], [2, "能量守恒"]] },
    { id: "fuel", label: "燃料", value: 0, options: Mo.FUELS.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 1 },
  ],
  play: { param: "th", rate: 90, loop: true },
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const k = Mo.stroke(s.th); return [{ label: "冲程", value: Mo.STROKES[k] }, { label: "活塞", value: Mo.down(s.th) ? "向下运动" : "向上运动" }, { label: "进气门", value: Mo.intakeOpen(s.th) ? "开" : "关" }, { label: "排气门", value: Mo.exhaustOpen(s.th) ? "开" : "关" }, { label: "能量的转化", value: CONV[k] }, { label: "缸内的气压（相对值）", value: fmt(Mo.pressure(s.th), 1) }]; }
    if (s.mode === 1) { const Q = Mo.heat(Mo.FUELS[s.fuel][1], s.m), eta = Mo.efficiency(s.ex, s.co, s.fr); return [{ label: "放出的热量", value: fmt(Q / 1e6, 1), unit: "MJ" }, { label: "有用功", value: fmt(Mo.work(Q, eta) / 1e6, 1), unit: "MJ" }, { label: "热机的效率", value: fmt(eta, 0), unit: "%" }]; }
    const b = Mo.balance(100, s.W, s.Qh, s.Qo);
    return [{ label: "输入的能量", value: "100", unit: "J" }, { label: "输出的能量之和", value: fmt(s.W + s.Qh + s.Qo, 0), unit: "J" }, { label: "判断", value: b === "ok" ? "符合能量守恒" : b === "more" ? "能量凭空增加，不可能" : "能量凭空消失，不可能" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const k = Mo.stroke(s.th), top = 120, Hc = 160, p = Mo.piston(s.th), py = top + 18 + p * 90;
      rect(c, 220, top - 20, 160, Hc + 60, "#e9ecef", COL.ink, 5, 8);
      const gas = ["#a5d8ff", "#ffe066", "#ff8787", "#ced4da"][k];
      rect(c, 226, top + 10, 148, py - top - 10, gas, null, 0, 0);
      rect(c, 226, py, 148, 26, COL.metal, COL.ink, 4, 4);
      line(c, 300, py + 26, 300, 290, COL.ink, 8);
      const a = (s.th * Math.PI) / 180; circle(c, 300, 330, 38, "#fff", COL.ink, 4); const cx = 300 + 22 * Math.sin(a), cy = 330 - 22 * Math.cos(a); line(c, 300, 330, cx, cy, COL.red, 5); circle(c, cx, cy, 7, COL.red);
      rect(c, 248, top - 36, 24, 20, Mo.intakeOpen(s.th) ? "#fff" : COL.green, COL.ink, 3, 3); rect(c, 328, top - 36, 24, 20, Mo.exhaustOpen(s.th) ? "#fff" : COL.red, COL.ink, 3, 3);
      txt(c, "in", 260, top - 52, 16, COL.green); txt(c, "out", 340, top - 52, 16, COL.red);
      if (k === 0) arrow(c, 190, top - 70, 250, top - 36, COL.blue, 5); if (k === 3) arrow(c, 340, top - 20, 420, top - 70, COL.grey, 5);
      if (k === 2 && s.th > 365) circle(c, 300, top + 30, 12 + (540 - s.th) * 0.1, COL.yellow, COL.orange, 3);
      if (k === 1 && s.th > 340) txt(c, "spark", 300, top - 6, 16, COL.orange);
      const P = Mo.pressure(s.th), bw = Math.min(180, 20 + (P / 70) * 160); rect(c, 420, 150, 180, 22, "#fff", COL.ink, 3, 4); rect(c, 420, 150, bw, 22, COL.red, null, 0, 4); txt(c, "p", 400, 161, 18, COL.ink);
      return;
    }
    if (s.mode === 1) {
      const eta = Mo.efficiency(s.ex, s.co, s.fr), parts: [string, number, string][] = [["W", eta, COL.green], ["exhaust", s.ex, COL.grey], ["water", s.co, COL.blue], ["friction", s.fr, COL.orange]];
      let y = 40; rect(c, 40, 40, 90, 300, "#ffe8cc", COL.ink, 4, 6); txt(c, "100%", 85, 190, 22, COL.ink);
      for (const [n, v, col] of parts) { const hgt = (v / 100) * 300; rect(c, 330, y, 130, Math.max(0, hgt), col, COL.ink, 3, 3); if (hgt > 16) txt(c, `${fmt(v, 0)}%`, 395, y + hgt / 2, 18, "#fff"); line(c, 130, 190, 330, y + hgt / 2, col, 3); txt(c, n, 480, y + hgt / 2, 17, COL.ink, "left"); y += hgt; }
      return;
    }
    const b = Mo.balance(100, s.W, s.Qh, s.Qo), tot = s.W + s.Qh + s.Qo;
    rect(c, 60, 60, 120, 260, "#ffe8cc", COL.ink, 4, 6); txt(c, "100 J", 120, 190, 24, COL.ink);
    let y = 60; for (const [v, col] of [[s.W, COL.green], [s.Qh, COL.red], [s.Qo, COL.blue]] as [number, string][]) { const hgt = (v / 100) * 260; rect(c, 330, y, 120, hgt, col, COL.ink, 3, 3); y += hgt; }
    txt(c, `${fmt(tot, 0)} J`, 540, 190, 30, b === "ok" ? COL.green : COL.red);
    txt(c, b === "ok" ? "=" : b === "more" ? ">" : "<", 255, 190, 60, b === "ok" ? COL.green : COL.red);
  },
  tasks: [
    { id: "power", text: "四冲程：把曲轴转到做功冲程，观察内能转化为机械能", check: (s) => s.mode === 0 && Mo.stroke(s.th) === 2 },
    { id: "exhaust", text: "四冲程：使排气门打开（排气冲程）", check: (s) => s.mode === 0 && Mo.exhaustOpen(s.th) },
    { id: "eta", text: "热机的效率：减少各项损失，使效率达到 40% 以上", check: (s) => s.mode === 1 && Mo.efficiency(s.ex, s.co, s.fr) >= 40 },
    { id: "conserve", text: "能量守恒：使输出的能量之和等于 100 J，其中有用功不少于 40 J", check: (s) => s.mode === 2 && Mo.balance(100, s.W, s.Qh, s.Qo) === "ok" && s.W >= 40 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
