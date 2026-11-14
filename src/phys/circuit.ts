import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-circuit";
import { COL, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.circuit;
const OPT: [number, string][] = [[0, "不接入"], [1, "串联"], [2, "并联"]];
const built = (s: Record<string, number>) => Mo.build(s.U, s.sw === 1, [s.a, s.b, s.c]);
export const def: SimDef = {
  meta,
  lesson: [
    "自己搭电路：三个电阻 A（10 Ω）、B（20 Ω）、C（30 Ω）可以不接入，或接入串联的一路，或接入并联的一组；并联的一组再与串联的部分首尾相接，这样可以搭出串联、并联和混联电路（只有一个电阻选“并联”时，它和串联的电阻没有区别）。",
    "串联电路：电流处处相等，总电阻等于各电阻之和，电压与电阻成正比。并联电路：各支路两端的电压相等，干路电流等于各支路电流之和，总电阻的倒数等于各电阻倒数之和，总电阻比任何一个支路的电阻都小，电流与电阻成反比。混联电路先化简并联部分，再按串联计算。",
  ],
  formulas: ["R=R_1+R_2+\\cdots", "\\dfrac{1}{R}=\\dfrac{1}{R_1}+\\dfrac{1}{R_2}+\\cdots"],
  params: [{ id: "U", label: "电源电压", min: 3, max: 12, step: 1, value: 6, unit: "V" }],
  choices: [
    { id: "a", label: "电阻 A（10 Ω）", value: 1, options: OPT }, { id: "b", label: "电阻 B（20 Ω）", value: 1, options: OPT }, { id: "c", label: "电阻 C（30 Ω）", value: 0, options: OPT },
    { id: "sw", label: "开关", value: 1, options: [[1, "闭合"], [0, "断开"]] },
  ],
  aspect: 0.62,
  readouts: (s) => {
    const b = built(s), label = { open: "没有接入电阻", series: "串联电路", parallel: "并联电路", mixed: "混联电路" }[b.kind];
    const cur = (i: number) => (b.parts[i].place === "off" ? { value: "—", unit: "" } : { value: fmt(b.parts[i].I, 3), unit: "A" });
    return [
      { label: "电路", value: label }, { label: "总电阻", value: b.R === Infinity ? "—" : fmt(b.R, 2), unit: b.R === Infinity ? "" : "Ω" }, { label: "总电流", value: fmt(b.I, 3), unit: "A" },
      { label: "通过 A 的电流", ...cur(0) }, { label: "通过 B 的电流", ...cur(1) }, { label: "通过 C 的电流", ...cur(2) },
    ];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    const b = built(s), top = 70, bot = 330, bx0 = 330, bx1 = 590;
    const par = b.parts.map((p, i) => [p, i] as const).filter(([p]) => p.place === "parallel"), ser = b.parts.map((p, i) => [p, i] as const).filter(([p]) => p.place === "series");
    line(c, 60, top, bx0, top, COL.ink, 4); line(c, 60, top, 60, bot, COL.ink, 4); line(c, 60, bot, bx1, bot, COL.ink, 4);
    const res = (x: number, y: number, i: number, vertical = false) => { const p = b.parts[i]; if (vertical) return; rect(c, x - 30, y - 14, 60, 28, "#fff3bf", COL.ink, 3, 4); txt(c, `${Mo.NAME[i]} ${p.R}`, x, y, 15, COL.ink); };
    ser.forEach(([, i], k) => { res(130 + k * 80, top, i); });
    if (par.length) {
      line(c, bx0, top, bx0, bot, COL.ink, 4); line(c, bx1, top, bx1, bot, COL.ink, 4); line(c, bx0, top, bx1, top, COL.ink, 4);
      par.forEach(([, i], k) => { const y = top + 70 + k * 80; line(c, bx0, y, bx1, y, COL.ink, 3); res((bx0 + bx1) / 2, y, i); });
    } else line(c, bx0, top, bx1, top, COL.ink, 4), line(c, bx1, top, bx1, bot, COL.ink, 4);
    // battery (left) and switch (bottom)
    rect(c, 36, 150, 48, 100, "#f8f9fa", null, 0, 0); line(c, 40, 190, 80, 190, COL.ink, 6); line(c, 50, 210, 70, 210, COL.ink, 3);
    line(c, 200, bot, 230, bot, "#f8f9fa", 8); line(c, 200, bot, 232, s.sw === 1 ? bot : bot - 26, COL.red, 5); circle(c, 200, bot, 5, COL.ink); circle(c, 232, bot, 5, COL.ink);
    txt(c, `${s.U} V`, 60, 130, 20, COL.blue);
    if (b.I > 0) txt(c, `I = ${fmt(b.I, 2)} A`, 200, top + 44, 20, COL.red);
  },
  tasks: [
    { id: "series3", text: "把 A、B、C 三个电阻全部串联，总电阻为 60 Ω", check: (s) => { const b = built(s); return s.sw === 1 && b.kind === "series" && Math.abs(b.R - 60) < 1e-9; } },
    { id: "par3", text: "把 A、B、C 三个电阻全部并联，使总电阻小于 6 Ω", check: (s) => { const b = built(s); return s.sw === 1 && b.kind === "parallel" && b.R < 6; } },
    { id: "mixed", text: "搭一个混联电路：至少一个电阻串联，另外两个并联", check: (s) => s.sw === 1 && built(s).kind === "mixed" },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
