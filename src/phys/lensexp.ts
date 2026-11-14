import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-lensexp";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.lensexp;
type S = Record<string, number>;
const f = (s: S) => Mo.FS[s.lens];
const sc = (s: S) => Mo.onScreen(f(s), s.u, s.v);
const SC = 5, LX = 270, AY = 190;
const rowKeys = Array.from({ length: Mo.MAXROWS }, (_, i) => i);
const hidden: S = { n: 0 }; for (const i of rowKeys) { hidden[`ru${i}`] = 0; hidden[`rv${i}`] = 0; hidden[`rk${i}`] = 0; }
export const def: SimDef = {
  meta,
  lesson: [
    "实验器材：光具座、凸透镜、蜡烛、光屏。先让平行光（如太阳光）通过凸透镜，移动光屏，当光屏上的光斑最小最亮时，光屏到透镜的距离就是焦距 f。实验时要调整烛焰、透镜和光屏的中心大致在同一高度，使像成在光屏的中央。",
    "把蜡烛放在不同的位置（物距 u），移动光屏，直到光屏上的像最清晰，记下物距和像距。u > 2f，成倒立、缩小的实像，f < v < 2f；u = 2f，成倒立、等大的实像，v = 2f；f < u < 2f，成倒立、放大的实像，v > 2f；u = f，不成像；u < f，成正立、放大的虚像，光屏上接收不到。",
    "成实像时，物距减小，像距增大，像变大（物近像远像变大）。换一个焦距不同的凸透镜，各个位置也随之改变。记录的数据越多，规律就越明显。",
  ],
  formulas: ["\\dfrac{1}{u}+\\dfrac{1}{v}=\\dfrac{1}{f}"],
  params: [
    { id: "u", label: "蜡烛到透镜的距离（物距）", min: 5, max: 45, step: 0.5, value: 30, unit: "cm", when: (s) => s.mode === 1 },
    { id: "v", label: "光屏到透镜的距离", min: 5, max: 70, step: 0.5, value: 40, unit: "cm" },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "测量焦距"], [1, "探究成像规律"]] },
    { id: "lens", label: "凸透镜", value: 0, options: [[0, "透镜甲"], [1, "透镜乙"], [2, "透镜丙"]] },
  ],
  hidden,
  actions: [
    { id: "rec", label: "记录这组数据", run: (s) => { const o = sc(s); if (s.mode !== 1 || !o.sharp || s.n >= Mo.MAXROWS) return; for (let i = 0; i < s.n; i++) if (s[`ru${i}`] === s.u) return; const i = s.n; return { n: s.n + 1, [`ru${i}`]: s.u, [`rv${i}`]: s.v, [`rk${i}`]: o.kind }; } },
    { id: "clear", label: "清除记录", run: () => ({ n: 0 }) },
  ],
  derive: (s, changed) => { if (changed === "lens" || changed === "mode") s.n = 0; },
  aspect: 0.62,
  readouts: (s) => {
    const o = sc(s), out: { label: string; value: string; unit?: string }[] = [];
    if (s.mode === 0) out.push({ label: "光屏到透镜的距离", value: fmt(s.v, 1), unit: "cm" }, { label: "光斑的宽度", value: fmt(Mo.spot(f(s), s.v), 1), unit: "cm" }, { label: "光斑", value: Mo.spot(f(s), s.v) <= Mo.SHARP_CM ? "最小最亮：光屏在焦点上" : "还不是最小" });
    else out.push({ label: "物距", value: fmt(s.u, 1), unit: "cm" }, { label: "屏上的像", value: o.none ? "光屏上没有像" : o.sharp ? "清晰" : "模糊" }, { label: "像的性质", value: o.sharp ? Mo.KINDS[o.kind] : "—" });
    for (let i = 0; i < s.n; i++) out.push({ label: `第 ${i + 1} 组`, value: `u = ${fmt(s[`ru${i}`], 1)} cm，v = ${fmt(s[`rv${i}`], 1)} cm，${Mo.KINDS[s[`rk${i}`]]}` });
    return out;
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    const F = f(s), o = sc(s), sx = LX + SC * s.v;
    rect(c, 10, 330, 620, 22, "#e9ecef", COL.ink, 3, 4); for (let k = 0; k <= 120; k += 10) { const x = LX + (k - 50) * SC; if (x > 10 && x < 630) line(c, x, 330, x, 340, COL.ink, 1.5); }
    line(c, 8, AY, 632, AY, COL.grey, 2);
    c.beginPath(); c.moveTo(LX, 70); c.quadraticCurveTo(LX + 32, AY, LX, 310); c.quadraticCurveTo(LX - 32, AY, LX, 70); c.fillStyle = "rgba(99,230,226,0.45)"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
    for (const k of [-2, -1, 1, 2]) { line(c, LX + k * F * SC, AY - 6, LX + k * F * SC, AY + 6, COL.ink, 3); txt(c, Math.abs(k) === 1 ? "F" : "2F", LX + k * F * SC, AY + 22, 16, COL.grey); }
    rect(c, sx - 3, AY - 70, 6, 140, "#fff", COL.ink, 3, 3);
    if (s.mode === 0) {
      for (const y of [-40, -20, 20, 40]) { line(c, 10, AY + y, LX, AY + y, COL.orange, 2); line(c, LX, AY + y, sx, AY + y * (1 - (sx - LX) / (F * SC)), COL.orange, 2); }
      const wd = Mo.spot(F, s.v) * SC * 2; rect(c, sx - 4, AY - Math.max(2, wd), 8, Math.max(4, wd * 2), "#ffe066", null, 0, 3);
    } else {
      const hx = LX - SC * s.u; arrow(c, hx, AY, hx, AY - 40, COL.green, 6); circle(c, hx, AY - 46, 7, COL.orange, null);
      if (!o.none) { line(c, hx, AY - 40, LX, AY - 40, COL.orange, 1.5); line(c, hx, AY - 40, LX, AY, COL.purple, 1.5); }
      if (o.sharp) { arrow(c, sx, AY, sx, AY + 40 * o.m, COL.red, 6); } else if (!o.none) { const bw = Math.min(60, o.blur * SC * 2); circle(c, sx, AY + 20, Math.max(3, bw), "rgba(224,49,49,0.25)", null); }
    }
  },
  tasks: [
    { id: "focus", text: "测量焦距：移动光屏，使平行光的光斑最小最亮", check: (s) => s.mode === 0 && Mo.spot(f(s), s.v) <= Mo.SHARP_CM },
    { id: "big", text: "成像规律：在光屏上得到倒立、放大的清晰实像", check: (s) => s.mode === 1 && sc(s).sharp && sc(s).kind === 2 },
    { id: "small", text: "成像规律：在光屏上得到倒立、缩小的清晰实像", check: (s) => s.mode === 1 && sc(s).sharp && sc(s).kind === 0 },
    { id: "rows", text: "记录数据：记下至少 3 组清晰成像时的物距和像距", check: (s) => s.mode === 1 && s.n >= 3 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
