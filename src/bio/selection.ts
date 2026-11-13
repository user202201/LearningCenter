import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-selection";
import { COL, lab, txt, circle, ell, rect, axes, curve } from "./draw";
export const meta = CATALOG.selection;
const tr = (s: Record<string, number>) => Mo.trajectory(s.p0, s.e, s.s, 50);
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * t)).join(",")})`;
export const def: SimDef = {
  meta,
  lesson: [
    "生物普遍具有变异，变异是不定向的；在生存斗争中，具有有利变异的个体容易生存并留下后代，不利变异的个体被淘汰，这就是自然选择，结果是适者生存。桦尺蛾的体色就是一个例子：树干被煤烟熏黑后，深色蛾不易被鸟发现，数量增多。",
    "拖动“世代”滑块观察深色蛾的比例；调节树皮的污染程度和捕食压力。这是一个简化模型：存活率不同 → 下一代比例改变。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "e", label: "捕食压力", min: 0, max: 0.9, step: 0.05, value: 0.5, dec: 2 },
    { id: "s", label: "树皮的污染程度（0 = 洁净，1 = 全黑）", min: 0, max: 1, step: 0.1, value: 0.5, dec: 1 },
    { id: "p0", label: "起初深色蛾所占比例", min: 0.01, max: 0.5, step: 0.01, value: 0.05, dec: 2 },
    { id: "gen", label: "世代", min: 0, max: 50, step: 1, value: 0 },
  ],
  play: { param: "gen", rate: 8 },
  aspect: 0.6,
  readouts: (s) => { const f = Mo.fitness(s.e, s.s), t = tr(s); return [
    { label: "深色蛾所占比例", value: fmt(t[s.gen] * 100, 1), unit: "%" }, { label: "浅色蛾所占比例", value: fmt((1 - t[s.gen]) * 100, 1), unit: "%" },
    { label: "深色型的存活率", value: fmt(f.wD * 100, 0), unit: "%" }, { label: "浅色型的存活率", value: fmt(f.wL * 100, 0), unit: "%" }]; },
  draw(c, w, h, s) {
    const p = tr(s)[s.gen];
    rect(c, 16, 30, 290, 330, mix([245, 240, 225], [70, 62, 58], s.s), COL.ink, 4, 18);
    for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(40 + i * 48, 36); c.lineTo(48 + i * 48, 356); c.strokeStyle = mix([205, 196, 176], [40, 36, 34], s.s); c.lineWidth = 3; c.stroke(); }
    const n = 36;
    for (let i = 0; i < n; i++) {
      const x = 38 + ((i * 53) % 250), y = 52 + ((i * 97) % 290), dark = (i + 0.5) / n < p;
      ell(c, x, y, 13, 7, dark ? "#3b3532" : "#f1ece0", COL.ink, 1.5, ((i * 7) % 9) * 0.3); ell(c, x - 5, y - 1, 7, 4, dark ? "#2a2523" : "#e3dccb", null, 0, 0.6);
    }
    const P = axes(c, 360, 50, 260, 240, 50, 100, "gen", "dark %", 0, 5);
    curve(c, P, (x) => tr(s)[Math.min(50, Math.round(x))] * 100, COL.ink, 50, 50, 4);
    circle(c, P.X(s.gen), P.Y(p * 100), 8, COL.red, COL.ink, 3);
    lab(c, "深色蛾所占比例", 360, 30, 16, COL.grey, "left");
    txt(c, "", 0, 0, 1, "#fff");
  },
  tasks: [
    { id: "soot", text: "树皮被污染（污染程度 0.8 以上）、捕食压力 0.5 以上：30 代后深色蛾超过 80%", check: (s) => s.s >= 0.8 && s.e >= 0.5 && s.gen >= 30 && tr(s)[s.gen] > 0.8 },
    { id: "clean", text: "树皮洁净（污染程度 0.2 以下）、捕食压力 0.5 以上：30 代后深色蛾不到 2%", check: (s) => s.s <= 0.2 && s.e >= 0.5 && s.gen >= 30 && tr(s)[s.gen] < 0.02 },
    { id: "nopred", text: "捕食压力为 0：经过 10 代以上，两种蛾的比例不变", check: (s) => s.e === 0 && s.gen >= 10 && Math.abs(tr(s)[s.gen] - s.p0) < 1e-12 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
