import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-evap";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.evap;
type S = Record<string, number>;
const rate = (s: S) => Mo.evapRate(s.T, s.A, s.wind);
const left = (s: S) => Mo.waterLeft(rate(s), s.t);
const gs = (s: S) => Mo.gasState(s.gas, s.TG, s.pG);
const GAS_TXT = { gas: "气态", liquid: "液态", hot: "温度高于临界温度，压缩体积也不能使它液化" };
const triangle = (c: CanvasRenderingContext2D, active: number) => {
  const P: Record<string, [number, number]> = { S: [120, 300], L: [320, 90], G: [520, 300] };
  const arrows: [string, string, number][] = [["S", "L", 0], ["L", "S", 1], ["L", "G", 2], ["G", "L", 3], ["S", "G", 4], ["G", "S", 5]];
  arrows.forEach(([a, b, i]) => {
    const [x1, y1] = P[a], [x2, y2] = P[b]; const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, off = 14;
    const sx = x1 + (dx / len) * 44 + nx * off, sy = y1 + (dy / len) * 44 + ny * off, ex = x2 - (dx / len) * 44 + nx * off, ey = y2 - (dy / len) * 44 + ny * off;
    arrow(c, sx, sy, ex, ey, i === active ? (Mo.ABSORB[i] ? COL.red : COL.blue) : "#ced4da", i === active ? 7 : 3);
    txt(c, String(i + 1), (sx + ex) / 2 + nx * 18, (sy + ey) / 2 + ny * 18, 20, i === active ? COL.ink : COL.grey);
  });
  for (const [k, [x, y]] of Object.entries(P)) { circle(c, x, y, 36, "#fff", COL.ink, 4); txt(c, k, x, y, 30, COL.ink); }
};
export const def: SimDef = {
  meta,
  lesson: [
    "汽化是物质从液态变为气态的过程，吸热，有蒸发和沸腾两种方式。蒸发在任何温度下都能在液体表面发生。液体的温度越高、液体的表面积越大、液体表面上方的空气流动越快，蒸发就越快。蒸发要从液体或周围物体吸收热量，所以蒸发有致冷作用。",
    "液化是物质从气态变为液态的过程，放热。使气体液化的方法有两种：降低温度和压缩体积。在一定温度下，压缩体积可以使某些气体液化（如石油气）；但气体的温度高于它的临界温度时，只压缩体积不能使它液化，必须先降低温度。",
    "升华是物质从固态直接变为气态的过程，吸热；凝华是物质从气态直接变为固态的过程，放热。碘、干冰、樟脑都容易升华；霜、冰花和雾凇是水蒸气遇冷凝华形成的。熔化、汽化、升华吸热，凝固、液化、凝华放热。",
  ],
  params: [
    { id: "T", label: "水的温度（与周围相同）", min: 10, max: 80, step: 5, value: 25, unit: "℃", when: (s) => s.mode === 0 },
    { id: "A", label: "水面的面积", min: 5, max: 50, step: 5, value: 20, unit: "cm²", when: (s) => s.mode === 0 },
    { id: "t", label: "时间", min: 0, max: 60, step: 1, value: 30, unit: "min", when: (s) => s.mode === 0 },
    { id: "TG", label: "温度", min: -200, max: 150, step: 1, value: 120, unit: "℃", when: (s) => s.mode === 1 },
    { id: "pG", label: "压强", min: 1, max: 20, step: 0.5, value: 1, unit: "个标准大气压", when: (s) => s.mode === 1 },
    { id: "bath", label: "水浴的温度", min: 20, max: 100, step: 5, value: 60, unit: "℃", when: (s) => s.mode === 2 },
    { id: "ti", label: "加热的时间", min: 0, max: 30, step: 1, value: 10, unit: "min", when: (s) => s.mode === 2 },
    { id: "ph", label: "现象的编号", min: 1, max: 12, step: 1, value: 1, when: (s) => s.mode === 3 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "蒸发"], [1, "液化"], [2, "升华与凝华"], [3, "六种物态变化"]] },
    { id: "wind", label: "空气的流动", value: 0, options: Mo.WINDS.map((n, i) => [i, n] as [number, string]), when: (s) => s.mode === 0 },
    { id: "gas", label: "气体", value: 0, options: Mo.GASES.map((g, i) => [i, g.name] as [number, string]), when: (s) => s.mode === 1 },
    { id: "cold", label: "烧瓶上方的玻璃", value: 0, options: [[0, "不冷却"], [1, "用冰水冷却"]], when: (s) => s.mode === 2 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "蒸发的速度", value: fmt(rate(s), 2), unit: "g/min" }, { label: "剩下的水", value: fmt(left(s), 1), unit: "g" }, { label: "剩下的水比周围低", value: fmt(Mo.coolDrop(rate(s)), 1), unit: "℃" }];
    if (s.mode === 1) return [{ label: "这个压强下的沸点", value: fmt(Mo.boilingAt(s.gas, s.pG), 0), unit: "℃" }, { label: "状态", value: GAS_TXT[gs(s)] }, { label: "物态变化", value: gs(s) === "liquid" ? "液化（放热）" : "没有液化" }];
    if (s.mode === 2) { const v = Mo.vapour(s.bath, s.ti), k = Mo.crystals(s.bath, s.ti, s.cold); return [{ label: "碘蒸气的质量", value: fmt(v, 2), unit: "g" }, { label: "冷玻璃上的碘晶体", value: fmt(k, 2), unit: "g" }, { label: "碘有没有熔化", value: "没有（水浴的温度低于碘的熔点 113.7 ℃）" }, { label: "物态变化", value: s.cold === 1 && k > 0.005 ? "升华（吸热）和凝华（放热）" : v > 0.005 ? "升华（吸热）" : "还不明显" }]; }
    const [txtp, p] = Mo.PHEN[s.ph - 1];
    return [{ label: "现象", value: txtp }, { label: "物态变化", value: Mo.PROC[p] }, { label: "吸热还是放热", value: Mo.ABSORB[p] ? "吸热" : "放热" }, { label: "图中的箭头", value: String(p + 1) }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const wd = 70 + Math.sqrt(s.A) * 14, x0 = 320 - wd / 2, lv = (left(s) / Mo.M0) * 40;
      rect(c, x0, 250, wd, 50, "#fff", COL.ink, 4, 12); rect(c, x0 + 4, 300 - Math.max(2, lv + 4), wd - 8, Math.max(2, lv + 4) - 4, COL.water2, null, 0, 6);
      const n = Math.min(9, Math.round(rate(s) * 3));
      for (let i = 0; i < n; i++) { const x = x0 + 14 + ((wd - 28) * (i + 0.5)) / Math.max(1, n); arrow(c, x, 240, x + (s.wind > 0 ? 18 * s.wind : 0), 190 - (i % 3) * 14, COL.blue, 3); }
      if (s.wind > 0) for (let k = 0; k < s.wind; k++) arrow(c, 40, 200 + k * 20, 140, 200 + k * 20, COL.grey, 4);
      txt(c, `${fmt(left(s), 1)} g`, 320, 340, 26, COL.ink); txt(c, `${fmt(rate(s), 2)} g/min`, 320, 60, 26, COL.blue);
    } else if (s.mode === 1) {
      const st = gs(s), liq = st === "liquid";
      rect(c, 220, 60, 200, 250, "#fff", COL.ink, 5, 14);
      if (liq) rect(c, 224, 220, 192, 86, COL.water2, null, 0, 10);
      const dots = liq ? 6 : 26; let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < dots; i++) circle(c, 236 + rnd() * 168, (liq ? 228 : 80) + rnd() * (liq ? 70 : 220), 6, st === "hot" ? "#ffa8a8" : liq ? "#1c7ed6" : "#adb5bd", null);
      const plY = 60 + Math.max(0, 150 - s.pG * 7);
      rect(c, 216, plY - 14, 208, 14, COL.metal, COL.ink, 3, 4); line(c, 320, plY - 14, 320, 30, COL.ink, 6); txt(c, `${fmt(s.pG, 1)} atm`, 540, 120, 26, COL.purple); txt(c, `${s.TG} C`, 100, 120, 26, s.TG > 0 ? COL.red : COL.blue);
    } else if (s.mode === 2) {
      const v = Mo.vapour(s.bath, s.ti), k = Mo.crystals(s.bath, s.ti, s.cold);
      rect(c, 130, 260, 380, 100, COL.water, COL.ink, 4, 14); circle(c, 320, 210, 62, "#fff", COL.ink, 5); rect(c, 296, 108, 48, 56, "#fff", COL.ink, 5, 6);
      if (s.cold === 1) { rect(c, 280, 70, 80, 36, "#e3fafc", COL.ink, 4, 8); txt(c, "ICE", 320, 88, 18, COL.blue); }
      circle(c, 320, 244, 14, "#5f3dc4", COL.ink, 3);
      c.globalAlpha = Math.min(0.85, v / Mo.M_IODINE + 0.05); circle(c, 320, 205, 52, "#9c36b5", null); c.globalAlpha = 1;
      for (let i = 0; i < Math.round(k * 20); i++) circle(c, 300 + (i % 5) * 10, 118 + Math.floor(i / 5) * 8, 3.5, "#5f3dc4", null);
      txt(c, `${s.bath} C`, 560, 300, 24, COL.red); txt(c, `${fmt(v, 2)} g`, 90, 190, 24, "#9c36b5");
    } else triangle(c, Mo.PHEN[s.ph - 1][1]);
  },
  tasks: [
    { id: "dry", text: "蒸发：使杯里的水在规定的时间内全部蒸发", check: (s) => s.mode === 0 && left(s) === 0 },
    { id: "lpg", text: "液化：在 20 ℃ 的常温下，只靠压缩体积使石油气液化", check: (s) => s.mode === 1 && s.gas === 1 && s.TG === 20 && gs(s) === "liquid" },
    { id: "frost", text: "升华与凝华：用冰水冷却玻璃，使它上面出现碘晶体", check: (s) => s.mode === 2 && Mo.crystals(s.bath, s.ti, s.cold) > 0.05 },
    { id: "deposit", text: "六种物态变化：找出一个属于凝华的现象", check: (s) => s.mode === 3 && Mo.PHEN[s.ph - 1][1] === 5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
