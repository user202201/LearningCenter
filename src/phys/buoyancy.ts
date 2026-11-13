import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-buoyancy";
import { COL, arrow, line, rect, spring, txt } from "./draw";

export const meta = CATALOG.buoyancy;
const rhoL = (s: { liq: number }) => Mo.SOLVE_LIQ[s.liq][2];
export const def: SimDef = {
  meta,
  lesson: [
    "浸在液体（或气体）中的物体受到向上的浮力。阿基米德原理：浸在液体中的物体受到的浮力，大小等于它排开的液体所受的重力：F浮 = G排 = ρ液 g V排。",
    "称重法：F浮 = G − F示。浮沉条件：物体浸没时，F浮 > G（ρ液 > ρ物）上浮，最后漂浮，漂浮时 F浮 = G；F浮 = G（ρ液 = ρ物）悬浮；F浮 < G（ρ液 < ρ物）下沉。",
    "用“手动浸入”慢慢放下物体，观察浮力和排开液体的重力总是相等；用“自由释放”观察物体最后的状态。",
  ],
  formulas: ["F_{\\text{浮}}=G_{\\text{排}}=\\rho_{\\text{液}}gV_{\\text{排}}", "F_{\\text{浮}}=G-F"],
  params: [
    { id: "rb", label: "物体的密度", min: 0.2, max: 3, step: 0.05, value: 0.6, unit: "g/cm³" },
    { id: "V", label: "物体的体积", min: 50, max: 200, step: 10, value: 100, unit: "cm³" },
    { id: "frac", label: "浸入液体的体积占比", min: 0, max: 1, step: 0.05, value: 0, when: (s) => s.mode === 0 },
  ],
  choices: [
    { id: "liq", label: "液体", value: 1, options: Mo.SOLVE_LIQ.map(([, n], i) => [i, n] as [number, string]) },
    { id: "mode", label: "操作", value: 0, options: [[0, "手动浸入"], [1, "自由释放"]] },
  ],
  aspect: 0.66,
  readouts: (s) => {
    const r = Mo.solve(s.rb * 1000, rhoL(s), s.V, s.mode, s.frac);
    return [
      { label: "物体的重力 G", value: fmt(r.G, 3), unit: "N" }, { label: "浮力 F浮", value: fmt(r.F, 3), unit: "N" },
      { label: "排开液体的体积", value: fmt(r.Vdisp, 0), unit: "cm³" }, { label: "排开液体的重力 G排", value: fmt(r.Gdisp, 3), unit: "N" },
      s.mode === 0 ? { label: "弹簧测力计的示数", value: fmt(Math.max(0, r.Tscale), 3), unit: "N" } : { label: "容器底部的支持力", value: fmt(r.bottomN, 3), unit: "N" },
      { label: "物体的状态", value: r.state === "float" ? "漂浮" : r.state === "suspend" ? "悬浮" : "沉底（或下沉）" },
    ];
  },
  draw(c, w, hh, s) {
    const r = Mo.solve(s.rb * 1000, rhoL(s), s.V, s.mode, s.frac);
    const lx = 300, lw = 300, top = 90, bottom = 400, water = 160;
    const col = ["#ffe8cc", "#a5d8ff", "#99e9f2", "#d0ebff"][s.liq];
    const side = 40 + Math.cbrt(s.V) * 8;   // 100 cm³ -> ~77 units
    // block position: the share under water decides
    const waterY = water;
    let by: number;
    if (s.mode === 0) by = waterY - side + r.frac * side + 0;   // frac of its height below the surface
    else if (r.state === "float") by = waterY - side + r.frac * side;
    else if (r.state === "suspend") by = (waterY + bottom) / 2 - side / 2;
    else by = bottom - side - 4;
    rect(c, lx, top, lw, bottom - top, "#fff", COL.ink, 4, 8);
    rect(c, lx + 3, waterY, lw - 6, bottom - waterY - 3, col, null, 0, 6); line(c, lx + 3, waterY, lx + lw - 3, waterY, "#4dabf7", 3);
    const bx = lx + lw / 2 - side / 2;
    if (s.mode === 0) {   // hung from a spring scale
      rect(c, bx + side / 2 - 40, 8, 80, 22, COL.grey, COL.ink, 3, 6); spring(c, bx + side / 2, 30, by - 10, 8, 10, COL.grey); line(c, bx + side / 2, by - 10, bx + side / 2, by, COL.ink, 3);
    }
    rect(c, bx, by, side, side, "#ffa94d", COL.ink, 4, 6); txt(c, "ρ", bx + side / 2, by + side / 2, 22, COL.ink);
    arrow(c, bx + side + 14, by + side / 2, bx + side + 14, by + side / 2 - Math.min(60, r.F * 40 + 8), COL.blue, 5); txt(c, "F", bx + side + 32, by + side / 2 - 30, 20, COL.blue, "left");
    arrow(c, bx - 14, by + side / 2, bx - 14, by + side / 2 + Math.min(60, r.G * 40 + 8), COL.red, 5); txt(c, "G", bx - 32, by + side / 2 + 30, 20, COL.red, "right");
    // the measuring cup: the displaced liquid
    rect(c, 40, 190, 100, 210, "#fff", COL.ink, 4, 8);
    const hDisp = Math.min(200, (r.Vdisp / 200) * 200);
    rect(c, 43, 400 - 3 - hDisp, 94, hDisp, col, null, 0, 4);
    txt(c, "V", 90, 170, 20, COL.grey); txt(c, `${fmt(r.Vdisp, 0)} cm³`, 90, 418, 18, COL.grey);
    // two bars: G and F
    const bar = (x: number, v: number, color: string, label: string) => { const hgt = Math.min(130, v * 120); rect(c, x, 150 - hgt, 36, hgt, color, COL.ink, 3, 4); txt(c, label, x + 18, 166, 17, COL.ink); };
    bar(150, r.G, COL.red, "G"); bar(200, r.F, COL.blue, "F");
  },
  tasks: [
    { id: "suspend", text: "选择“自由释放”，使物体悬浮：物体的密度等于液体的密度", check: (s) => s.mode === 1 && Math.abs(s.rb * 1000 - rhoL(s)) < 0.5 },
    { id: "half", text: "选择“手动浸入”，使物体浸入一半（占比 0.5），读出 F浮 与 G排 相等", check: (s) => s.mode === 0 && s.frac === 0.5 },
    { id: "float", text: "选择“自由释放”，使物体漂浮，且露出液面的部分超过一半", check: (s) => s.mode === 1 && s.rb * 1000 < 0.5 * rhoL(s) },
    { id: "sink", text: "选择“自由释放”，使物体下沉到底部：浮力小于重力", check: (s) => s.mode === 1 && Mo.solve(s.rb * 1000, rhoL(s), s.V, 1, 0).state === "sink" },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
