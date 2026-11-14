import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-fluid";
import { COL, arrow, line, rect, txt } from "./draw";

export const meta = CATALOG.fluid;
const LCOL = ["#74c0fc", "#d0ebff", "#ffe066", "#a9e34b"];
export const def: SimDef = {
  meta,
  lesson: [
    "连通器：上端开口、下端相连通的容器。连通器里装同一种液体，液体不流动时，各容器中的液面保持相平，与容器的粗细、形状无关（茶壶、锅炉水位计、船闸）。若装两种不同的液体，交界面处两边压强相等：ρ₁h₁ = ρ₂h₂，密度小的液体柱更高。本实验室取 g = 10 N/kg。",
    "流体压强与流速：在流动的液体或气体中，流速越大的地方压强越小（伯努利原理，p + ½ρv² = 常数）。水平管子变窄处，水流变快，压强变小；两张纸中间吹气，中间空气流速大、压强小，纸被外面的大气压压到一起；飞机的机翼上凸下平，上方空气流速大，压强小，产生升力。",
  ],
  formulas: ["\\rho_1 h_1=\\rho_2 h_2", "v=\\dfrac{Q}{S}", "p+\\tfrac12\\rho v^2=\\text{常数}"],
  params: [
    { id: "h1", label: "左管水柱的高度（交界面以上）", min: 5, max: 20, step: 1, value: 10, unit: "cm", when: (s) => s.mode === 0 },
    { id: "Q", label: "水的流量", min: 0.5, max: 3, step: 0.1, value: 1, unit: "L/s", when: (s) => s.mode === 1 },
    { id: "A2", label: "窄处的横截面积", min: 2, max: 10, step: 1, value: 10, unit: "cm²", when: (s) => s.mode === 1 },
    { id: "va", label: "吹气的速度", min: 0, max: 20, step: 1, value: 0, unit: "m/s", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "连通器"], [1, "管子里的水流"], [2, "两张纸中间吹气"]] },
    { id: "liq", label: "右管的液体", value: 1, options: Mo.LIQ.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 0 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) {
      const rho = Mo.LIQ[s.liq][1], h2 = Mo.hRight(s.h1, rho), d = h2 - s.h1;
      return [{ label: "左管水柱的高度", value: fmt(s.h1, 1), unit: "cm" }, { label: "右管液柱的高度", value: fmt(h2, 1), unit: "cm" }, { label: "交界面处的压强", value: fmt(Mo.liquidP(1000, s.h1) / 1000, 2), unit: "kPa" }, { label: "液面", value: Math.abs(d) < 1e-9 ? "液面相平" : d > 0 ? "右边更高" : "左边更高" }];
    }
    if (s.mode === 1) return [{ label: "宽处的流速", value: fmt(Mo.speed(s.Q, Mo.A1), 2), unit: "m/s" }, { label: "窄处的流速", value: fmt(Mo.speed(s.Q, s.A2), 2), unit: "m/s" }, { label: "宽处的压强", value: fmt(Mo.P_IN, 1), unit: "kPa" }, { label: "窄处的压强", value: fmt(Mo.narrowP(s.Q, s.A2), 1), unit: "kPa" }];
    return [{ label: "吹气的速度", value: fmt(s.va, 0), unit: "m/s" }, { label: "两张纸之间的气压比外面低", value: fmt(Mo.airDrop(s.va), 1), unit: "Pa" }, { label: "纸片", value: Mo.closes(s.va) ? "靠拢" : "不动" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const rho = Mo.LIQ[s.liq][1], h2 = Mo.hRight(s.h1, rho), k = 8, ref = 270;
      rect(c, 200, ref - s.h1 * k, 50, 312 - ref + s.h1 * k, LCOL[0], null, 0, 0); rect(c, 250, 275, 130, 37, LCOL[0], null, 0, 0); rect(c, 380, ref, 90, 312 - ref, LCOL[0], null, 0, 0); rect(c, 380, ref - h2 * k, 90, h2 * k, LCOL[s.liq], null, 0, 0);
      rect(c, 200, 60, 50, 252, "", COL.ink, 5, 4); rect(c, 380, 60, 90, 252, "", COL.ink, 5, 4); line(c, 250, 312, 380, 312, COL.ink, 5); line(c, 250, 275, 380, 275, COL.ink, 5);
      line(c, 150, ref, 520, ref, COL.grey, 2, [6, 6]); line(c, 170, ref - s.h1 * k, 520, ref - s.h1 * k, COL.blue, 2, [4, 5]); line(c, 170, ref - h2 * k, 520, ref - h2 * k, COL.red, 2, [4, 5]);
      txt(c, `${fmt(s.h1, 1)} cm`, 130, ref - s.h1 * k, 18, COL.blue); txt(c, `${fmt(h2, 1)} cm`, 560, ref - h2 * k, 18, COL.red);
      return;
    }
    if (s.mode === 1) {
      const nar = 40 + (s.A2 / Mo.A1) * 60, y0 = 300;
      c.beginPath(); c.moveTo(20, y0 - 50); c.lineTo(200, y0 - 50); c.lineTo(260, y0 - nar / 2); c.lineTo(380, y0 - nar / 2); c.lineTo(440, y0 - 50); c.lineTo(620, y0 - 50); c.lineTo(620, y0 + 50); c.lineTo(440, y0 + 50); c.lineTo(380, y0 + nar / 2); c.lineTo(260, y0 + nar / 2); c.lineTo(200, y0 + 50); c.lineTo(20, y0 + 50); c.closePath();
      c.fillStyle = COL.water; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 5; c.stroke();
      const p2 = Math.max(0, Mo.narrowP(s.Q, s.A2));
      for (const [x, p, top] of [[110, Mo.P_IN, y0 - 50], [320, p2, y0 - nar / 2], [530, Mo.P_IN, y0 - 50]] as [number, number, number][]) {
        const hgt = p * 1.15; rect(c, x - 12, top - 170, 24, 170, "", COL.ink, 4, 3); rect(c, x - 10, top - hgt, 20, hgt, COL.water2, null, 0, 0); txt(c, fmt(p, 0), x, top - 184, 17, COL.ink);
      }
      arrow(c, 30, y0, 30 + Mo.speed(s.Q, Mo.A1) * 14, y0, COL.red, 5); arrow(c, 290, y0, 290 + Math.min(100, Mo.speed(s.Q, s.A2) * 14), y0, COL.red, 5);
      return;
    }
    const close = Math.min(1, Mo.airDrop(s.va) / 40), gap = 90 * (1 - 0.8 * (Mo.closes(s.va) ? Math.max(close, 0.6) : close * 0.5));
    for (const sgn of [-1, 1]) { c.beginPath(); c.moveTo(320 + sgn * 100, 40); c.quadraticCurveTo(320 + sgn * 100, 200, 320 + sgn * gap * 0.55, 330); c.strokeStyle = COL.ink; c.lineWidth = 8; c.stroke(); c.strokeStyle = "#fff3bf"; c.lineWidth = 5; c.stroke(); }
    if (s.va > 0) for (let i = 0; i < 4; i++) arrow(c, 320, 90 + i * 60, 320, 90 + i * 60 + 20 + s.va * 1.5, COL.blue, 4);
    arrow(c, 80, 200, 150, 200, COL.red, 5); arrow(c, 560, 200, 490, 200, COL.red, 5); txt(c, "p0", 70, 170, 20, COL.red); txt(c, "p0", 570, 170, 20, COL.red);
  },
  tasks: [
    { id: "level", text: "连通器：在右管倒入水，使两管液面相平", check: (s) => s.mode === 0 && s.liq === 0 },
    { id: "tall", text: "连通器：右管换成酒精，使右管酒精柱高达 15 cm 以上", check: (s) => s.mode === 0 && s.liq === 1 && Mo.hRight(s.h1, 800) >= 15 },
    { id: "low", text: "水流：使窄处的压强低于 60 kPa", check: (s) => s.mode === 1 && Mo.narrowP(s.Q, s.A2) < 60 },
    { id: "paper", text: "吹纸：使两张纸靠拢", check: (s) => s.mode === 2 && Mo.closes(s.va) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
