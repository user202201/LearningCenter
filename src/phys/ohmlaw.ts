import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-ohmlaw";
import { COL, axes, circle, curve, line, rect, txt } from "./draw";

export const meta = CATALOG.ohmlaw;
type S = Record<string, number>;
const R = (s: S) => Mo.RS[s.r];
const Uof = (s: S) => (s.mode === 0 ? s.U : Mo.U_FIXED);
const Iof = (s: S) => Mo.ammeter(Uof(s), R(s));
const rows = (s: S) => Array.from({ length: s.n }, (_, i) => [s[`x${i}`], s[`y${i}`]] as [number, number]);
const hidden: S = { n: 0 }; for (let i = 0; i < Mo.MAXROWS; i++) { hidden[`x${i}`] = 0; hidden[`y${i}`] = 0; }
const verdict = (s: S) => { const r = rows(s), xs = r.map((p) => p[0]), ys = r.map((p) => p[1]); return s.mode === 0 ? Mo.proportional(xs, ys) : Mo.inverse(xs, ys); };
export const def: SimDef = {
  meta,
  lesson: [
    "探究电流与电压的关系：保持电阻不变，用滑动变阻器改变定值电阻两端的电压，记下每次电压表和电流表的示数。画出电流 I 随电压 U 变化的图线，是一条过原点的直线，说明：电阻一定时，通过导体的电流与导体两端的电压成正比。",
    "探究电流与电阻的关系：保持定值电阻两端的电压不变（每换一个电阻，都要调节滑动变阻器），记下电阻和电流。电流 I 随电阻 R 增大而减小，I 与 R 的乘积不变，说明：电压一定时，通过导体的电流与导体的电阻成反比。",
    "两个实验都用到控制变量法。把这两个关系合起来，就是欧姆定律：I = U / R。实验时要多测几组数据，数据多了，规律才可靠。点“记录这组数据”把现在的读数记进表中，最多记 6 组。",
  ],
  formulas: ["I=\\dfrac{U}{R}"],
  params: [{ id: "U", label: "定值电阻两端的电压", min: 0.5, max: 6, step: 0.5, value: 3, unit: "V", when: (s) => s.mode === 0 }],
  choices: [
    { id: "mode", label: "探究", value: 0, options: [[0, "电流与电压的关系"], [1, "电流与电阻的关系"]] },
    { id: "r", label: "定值电阻", value: 1, options: Mo.RS.map((v, i) => [i, `${v} Ω`] as [number, string]) },
  ],
  hidden,
  actions: [
    { id: "rec", label: "记录这组数据", run: (s) => { if (s.n >= Mo.MAXROWS) return; const x = s.mode === 0 ? s.U : R(s); for (let i = 0; i < s.n; i++) if (s[`x${i}`] === x) return; return { n: s.n + 1, [`x${s.n}`]: x, [`y${s.n}`]: Iof(s) }; } },
    { id: "clear", label: "清除记录", run: () => ({ n: 0 }) },
  ],
  derive: (s, ch) => { if (ch === "mode" || (ch === "r" && s.mode === 0)) s.n = 0; },
  aspect: 0.62,
  readouts: (s) => {
    const out: { label: string; value: string; unit?: string }[] = [{ label: s.mode === 0 ? "电压表的示数" : "电压表的示数（保持不变）", value: fmt(Uof(s), 1), unit: "V" }, { label: "电流表的示数", value: fmt(Iof(s), 2), unit: "A" }, { label: "定值电阻", value: fmt(R(s), 0), unit: "Ω" }];
    rows(s).forEach(([x, y], i) => out.push({ label: `第 ${i + 1} 组`, value: s.mode === 0 ? `U = ${fmt(x, 1)} V，I = ${fmt(y, 2)} A` : `R = ${fmt(x, 0)} Ω，I = ${fmt(y, 2)} A` }));
    if (s.n >= 4) out.push({ label: "数据的结论", value: verdict(s) ? (s.mode === 0 ? "电阻一定时，电流与电压成正比" : "电压一定时，电流与电阻成反比") : "数据不符合规律" });
    return out;
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    // the circuit
    rect(c, 30, 90, 250, 190, "#fff", COL.ink, 3, 10); rect(c, 50, 70, 40, 24, COL.yellow, COL.ink, 3, 4); txt(c, "E", 70, 82, 16, COL.ink); rect(c, 150, 70, 60, 24, "#e9ecef", COL.ink, 3, 4); txt(c, "RP", 180, 82, 16, COL.ink);
    rect(c, 105, 255, 70, 24, "#ffd8a8", COL.ink, 3, 4); txt(c, `${R(s)} ohm`, 140, 267, 15, COL.ink); circle(c, 230, 267, 16, "#fff", COL.ink, 3); txt(c, "A", 230, 267, 16, COL.blue); circle(c, 140, 200, 18, "#fff", COL.ink, 3); txt(c, "V", 140, 200, 16, COL.red);
    line(c, 140, 218, 140, 255, COL.ink, 2); line(c, 122, 200, 80, 200, COL.ink, 2);
    txt(c, `${fmt(Uof(s), 1)} V`, 90, 320, 22, COL.red); txt(c, `${fmt(Iof(s), 2)} A`, 220, 320, 22, COL.blue);
    // the graph
    const xm = s.mode === 0 ? 6 : 25, ym = s.mode === 0 ? 1.2 : 0.6;
    const P = axes(c, 360, 50, 250, 240, xm, ym, s.mode === 0 ? "U" : "R", "I", 0, 4);
    if (verdict(s) && s.mode === 0) line(c, P.X(0), P.Y(0), P.X(6), P.Y(6 / R(s)), "#ffa8a8", 3, [6, 5]);
    if (verdict(s) && s.mode === 1) curve(c, P, (x) => Math.min(ym, Mo.U_FIXED / Math.max(x, 1e-6)), "#ffa8a8", xm, 120, 3);
    for (const [x, y] of rows(s)) circle(c, P.X(x), P.Y(y), 6, COL.red, COL.ink, 2);
    circle(c, P.X(s.mode === 0 ? s.U : R(s)), P.Y(Iof(s)), 5, "rgba(0,0,0,0)", COL.blue, 3);
  },
  tasks: [
    { id: "dataU", text: "电流与电压：用同一个电阻，记录至少 4 组不同电压的数据", check: (s) => s.mode === 0 && s.n >= 4 },
    { id: "dataR", text: "电流与电阻：保持电压不变，换用不同的电阻，记录至少 4 组数据", check: (s) => s.mode === 1 && s.n >= 4 },
    { id: "five", text: "电流与电压：用 5 Ω 的电阻，记录下电压 3 V 时电流 0.6 A 这一组", check: (s) => s.mode === 0 && s.r === 0 && rows(s).some(([x, y]) => x === 3 && y === 0.6) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
