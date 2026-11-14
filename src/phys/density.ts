import { mountSim, type SimDef, type PhysCtx, type St, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-density";
import { COL, line, rect, txt, poly } from "./draw";

export const meta = CATALOG.density;
const solidRho = (s: St) => Mo.SOLIDS[s.mat][2];
const liquidRho = (s: St) => Mo.LIQUIDS[s.liq][2];
const sol = (s: St) => Mo.solid(solidRho(s), s.V, s.V1, s.order);
const liq = (s: St) => Mo.liquid(liquidRho(s), s.VL, s.order);
const verdict = (e: number) => (Math.abs(e) < 1 ? "基本准确" : e > 0 ? "偏大" : "偏小");
export const def: SimDef = {
  meta,
  lesson: [
    "质量是物体所含物质的多少，不随物体的形状、状态和位置而改变。实验室里用天平测质量：物体放在左盘，砝码放在右盘，用镊子加减砝码并移动游码，天平平衡时，物体的质量等于砝码的总质量加游码在标尺上所对的刻度值。",
    "某种物质组成的物体的质量与它的体积之比叫做这种物质的密度：ρ = m / V。密度是物质的一种特性，与物体的质量和体积的大小无关。国际单位是 kg/m³，常用单位是 g/cm³，1 g/cm³ = 1×10³ kg/m³；水的密度是 1.0×10³ kg/m³。",
    "测量固体的密度：用天平测出固体的质量 m；在量筒里装适量的水，读出体积 V₁；用细线系住固体，使它浸没在水中，读出总体积 V₂；固体的体积 V = V₂ − V₁，密度 ρ = m / (V₂ − V₁)。要先测质量、后测体积：先放入水中再称，固体沾水，质量测得偏大。密度比水小的固体（如石蜡）会漂浮，可用细针把它压入水中。",
    "测量液体的密度：先称出烧杯和液体的总质量 m₁；把一部分液体倒入量筒，读出体积 V；再称出烧杯和剩余液体的质量 m₂；ρ = (m₁ − m₂) / V。这样量筒里的液体全部是被称过质量的液体，烧杯壁上的残留液体不影响结果。若把液体全部倒入量筒，烧杯壁上的残留会使体积测得偏小，密度偏大。",
  ],
  formulas: ["\\rho=\\dfrac{m}{V}", "V=V_2-V_1"],
  params: [
    { id: "V", label: "物体的体积", min: 5, max: 50, step: 1, value: 20, unit: "cm³", when: (s) => s.mode === 0 },
    { id: "V1", label: "量筒中原有水的体积", min: 30, max: 50, step: 1, value: 40, unit: "mL", when: (s) => s.mode === 0 },
    { id: "VL", label: "液体的体积", min: 20, max: 80, step: 5, value: 40, unit: "mL", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "被测的物质", value: 0, options: [[0, "固体"], [1, "液体"]] },
    { id: "mat", label: "固体", value: 0, options: Mo.SOLIDS.map(([i, n]) => [i, n] as [number, string]), when: (s) => s.mode === 0 },
    { id: "liq", label: "液体", value: 2, options: Mo.LIQUIDS.map(([i, n]) => [i, n] as [number, string]), when: (s) => s.mode === 1 },
    { id: "order", label: "操作的顺序", value: 0, options: [[0, "正确的顺序"], [1, "错误的顺序"]] },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) {
      const r = sol(s), name = Mo.nameMetal(r.rho);
      return [
        { label: "天平的读数（质量 m）", value: fmt(r.m, 1), unit: "g" }, { label: "量筒的读数 V₁", value: fmt(r.V1, 0), unit: "mL" },
        { label: "量筒的读数 V₂", value: fmt(r.V2, 0), unit: "mL" }, { label: "物体的体积 V = V₂ − V₁", value: fmt(r.V, 0), unit: "cm³" },
        { label: "测得的密度 ρ = m / V", value: fmt(r.rho, 2), unit: "g/cm³" }, { label: "合", value: fmt(r.rho * 1000, 0), unit: "kg/m³" },
        { label: "对照密度表", value: name ?? "表中没有相近的金属" }, { label: "放入水中", value: r.floats ? "漂浮（要用细针压入水中）" : "下沉" },
        { label: "测量结果与真实值相比", value: verdict(r.errPct) },
      ];
    }
    const r = liq(s);
    const first = s.order === 0 ? "烧杯和液体的总质量 m₁" : "空烧杯的质量 m₀", second = s.order === 0 ? "烧杯和剩余液体的质量 m₂" : "烧杯和液体的总质量 m₁";
    return [
      { label: first, value: fmt(r.a, 1), unit: "g" }, { label: second, value: fmt(r.b, 1), unit: "g" },
      { label: "液体的质量 m", value: fmt(r.m, 1), unit: "g" }, { label: "量筒的读数 V", value: fmt(r.V, 0), unit: "mL" },
      { label: "测得的密度 ρ = m / V", value: fmt(r.rho, 2), unit: "g/cm³" }, { label: "合", value: fmt(r.rho * 1000, 0), unit: "kg/m³" },
      { label: "测量结果与真实值相比", value: verdict(r.errPct) },
    ];
  },
  draw(c, w, hh, s) {
    const bx = 150, by = 150;   // the balance
    poly(c, [[bx, by + 20], [bx - 30, by + 170], [bx + 30, by + 170]], COL.yellow, COL.ink, 4);
    line(c, bx - 130, by + 20, bx + 130, by + 20, COL.ink, 5);
    for (const sg of [-1, 1]) { line(c, bx + sg * 120, by + 20, bx + sg * 120, by + 62, COL.ink, 3); rect(c, bx + sg * 120 - 46, by + 62, 92, 10, COL.grey, COL.ink, 3, 4); }
    const m = s.mode === 0 ? sol(s).m : liq(s).m;
    if (s.mode === 0) rect(c, bx - 120 - 22, by + 62 - 40, 44, 40, "#ffa94d", COL.ink, 4, 6);
    else { rect(c, bx - 120 - 26, by + 62 - 46, 52, 46, "#fff", COL.ink, 4, 6); rect(c, bx - 120 - 22, by + 62 - 30, 44, 26, ["#ffe8cc", "#ffe066", "#a5d8ff", "#99e9f2", "#fcc419"][s.liq], null, 0, 4); }
    const nW = Math.min(5, 1 + Math.floor(m / 60));
    for (let i = 0; i < nW; i++) rect(c, bx + 120 - 14 + (i % 2) * 10, by + 62 - 14 - i * 11, 28, 12, COL.grey, COL.ink, 3, 3);
    txt(c, `${fmt(m, 1)} g`, bx, by + 196, 24, COL.ink);
    // the measuring cylinder
    const cx = 430, top = 60, bot = 380, sc = (bot - top) / CYL_SCALE;
    rect(c, cx - 50, top, 100, bot - top, "#fff", COL.ink, 4, 8);
    for (let v = 0; v <= CYL_SCALE; v += 10) { const y = bot - v * sc; line(c, cx + 20, y, cx + 50, y, COL.ink, v % 50 === 0 ? 3 : 2); if (v % 50 === 0) txt(c, String(v), cx + 78, y, 16, COL.grey); }
    if (s.mode === 0) {
      const r = sol(s), y1 = bot - r.V1 * sc, y2 = bot - r.V2 * sc;
      rect(c, cx - 47, y2, 94, bot - y2 - 3, "#a5d8ff", null, 0, 4); line(c, cx - 47, y2, cx + 47, y2, "#1c7ed6", 3);
      line(c, cx - 62, y1, cx - 47, y1, COL.red, 3, [4, 4]); txt(c, "V1", cx - 78, y1, 15, COL.red, "right"); txt(c, "V2", cx - 78, y2, 15, COL.blue, "right");
      rect(c, cx - 18, Math.max(y2 + 8, bot - 3 - 30 - r.V * sc * 0.4), 36, Math.min(60, 12 + r.V * sc * 0.8), "#ffa94d", COL.ink, 3, 5);
    } else {
      const r = liq(s), y = bot - r.V * sc;
      rect(c, cx - 47, y, 94, bot - y - 3, ["#ffe8cc", "#ffe066", "#a5d8ff", "#99e9f2", "#fcc419"][s.liq], null, 0, 4); line(c, cx - 47, y, cx + 47, y, COL.ink, 3);
    }
    txt(c, "mL", cx, top - 20, 18, COL.grey);
  },
  tasks: [
    { id: "copper", text: "固体：选择铜块、正确的顺序、体积不小于 10 cm³，测得的密度与 8.9 g/cm³ 相差不超过 5 %", check: (s) => s.mode === 0 && s.mat === 2 && s.order === 0 && s.V >= 10 && Math.abs(sol(s).rho - 8.9) <= 0.05 * 8.9 },
    { id: "wrongorder", text: "固体：选择错误的顺序（先测体积、后测质量），使测得的密度比真实值大 2 % 以上", check: (s) => s.mode === 0 && s.order === 1 && sol(s).errPct > 2 },
    { id: "alcohol", text: "液体：选择酒精、正确的顺序，测得的密度与 0.8 g/cm³ 相差不超过 5 %", check: (s) => s.mode === 1 && s.liq === 0 && s.order === 0 && Math.abs(liq(s).rho - 0.8) <= 0.04 },
    { id: "wax", text: "固体：选择石蜡块，观察它的密度小于水，放入水中会漂浮", check: (s) => s.mode === 0 && s.mat === 5 && sol(s).floats },
  ],
  quiz: Mo.quiz,
};
const CYL_SCALE = 100;
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
