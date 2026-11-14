import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-resistance";
import { COL, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.resistance;
type S = Record<string, number>;
const pr = (s: S) => Mo.pair(s.mode, s.LB, s.SB, s.matB, s.TB);
const matColor = (m: number) => ["#e8590c", "#ced4da", "#868e96", "#d9a066", "#495057"][m];
const bigger = (p: Mo.Pair) => (Math.abs(p.RB / p.RA - 1) < 0.005 ? "两根导线的电阻相等" : p.RB > p.RA ? "B 的电阻比 A 大" : "A 的电阻比 B 大");
export const def: SimDef = {
  meta,
  lesson: [
    "电阻表示导体对电流阻碍作用的大小。导体的电阻是导体本身的一种性质，它的大小跟导体的材料、长度、横截面积有关，还跟温度有关，与导体两端的电压、通过的电流无关。",
    "用控制变量法探究：把两根导线先后接入同一个电路，电源电压和另一个电阻不变，电流表的示数越小，说明接入的导线电阻越大。材料、横截面积相同时，导线越长，电阻越大；材料、长度相同时，导线越粗（横截面积越大），电阻越小；长度和横截面积相同时，不同材料的导线电阻不同；大多数金属的电阻随温度升高而增大。",
    "在这个实验中，A 是参照的导线，B 每次只改变一个因素。注意：电流表的示数与电阻的关系是反的：电阻越大，电流越小。",
  ],
  params: [
    { id: "LB", label: "导线 B 的长度", min: 0.5, max: 4, step: 0.5, value: 1, unit: "m", when: (s) => s.mode === 0 },
    { id: "SB", label: "导线 B 的横截面积", min: 0.1, max: 2, step: 0.1, value: 0.5, unit: "mm²", when: (s) => s.mode === 1 },
    { id: "TB", label: "导线 B 的温度", min: 20, max: 300, step: 20, value: 20, unit: "℃", when: (s) => s.mode === 3 },
  ],
  choices: [
    { id: "mode", label: "探究的因素", value: 0, options: [[0, "长度"], [1, "横截面积"], [2, "材料"], [3, "温度"]] },
    { id: "matB", label: "导线 B 的材料", value: 4, options: Mo.MATS.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 2 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    const p = pr(s);
    return [{ label: "导线 A 的电阻", value: fmt(p.RA, 2), unit: "Ω" }, { label: "导线 B 的电阻", value: fmt(p.RB, 2), unit: "Ω" }, { label: "接 A 时电流表的示数", value: fmt(p.IA, 2), unit: "A" }, { label: "接 B 时电流表的示数", value: fmt(p.IB, 2), unit: "A" }, { label: "比较", value: bigger(p) }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    const [m, L, S] = Mo.REF[s.mode];
    const mb = s.mode === 2 ? s.matB : m, LB = s.mode === 0 ? s.LB : L, SB = s.mode === 1 ? s.SB : S, p = pr(s);
    const wire = (y: number, mat: number, len: number, area: number, label: string) => { const wd = 150 * len / 4 + 60, th = 6 + Math.sqrt(area) * 14; rect(c, 120, y - th / 2, wd, th, matColor(mat), COL.ink, 3, th / 2); txt(c, label, 70, y, 30, COL.ink); };
    wire(110, m, L, S, "A"); wire(220, mb, LB, SB, "B");
    if (s.mode === 3 && s.TB > 20) for (let i = 0; i < 5; i++) { line(c, 160 + i * 30, 262, 168 + i * 30, 250 - (s.TB / 300) * 18, COL.orange, 4); }
    circle(c, 520, 110, 36, "#fff", COL.ink, 4); txt(c, "A", 520, 98, 20, COL.ink); txt(c, fmt(p.IA, 2), 520, 124, 22, COL.blue);
    circle(c, 520, 220, 36, "#fff", COL.ink, 4); txt(c, "A", 520, 208, 20, COL.ink); txt(c, fmt(p.IB, 2), 520, 234, 22, COL.blue);
    txt(c, "3 V + 5 ohm", 320, 340, 24, COL.grey);
  },
  tasks: [
    { id: "len", text: "长度：使导线 B 的电阻是导线 A 的 2 倍", check: (s) => s.mode === 0 && Math.abs(pr(s).RB / pr(s).RA - 2) < 1e-9 },
    { id: "area", text: "横截面积：使导线 B 的电阻是导线 A 的一半", check: (s) => s.mode === 1 && Math.abs(pr(s).RB / pr(s).RA - 0.5) < 1e-9 },
    { id: "mat", text: "材料：选一种电阻比导线 A（镍铬合金）小的材料", check: (s) => s.mode === 2 && pr(s).RB < pr(s).RA },
    { id: "temp", text: "温度：加热导线 B，使它的电阻增大到原来的 1.2 倍以上", check: (s) => s.mode === 3 && pr(s).RB / pr(s).RA >= 1.2 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
