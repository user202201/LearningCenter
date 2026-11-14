import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-fossils";
import { dndInit, dndPointer, placedCount, type DndSpec } from "./dnd";
import { COL, lab, txt, circle, rect, axes, curve } from "./draw";
export const meta = CATALOG.fossils;
const slot = (i: number): [number, number] => [80 + 160 * (i % 4), 296 + 62 * Math.floor(i / 4)];
const ty = (j: number) => 50 + j * 46;
export const spec: DndSpec = { n: 8, prefix: "fo", hit: [70, 28], at: (i) => slot(i), answer: (i) => Mo.FOSSILS[i][1], targets: () => Mo.LAYERS.map((_, j) => ({ x: 320, y: ty(j) + 20, hw: 300, hh: 22 })) };
const big = (y: number) => (y >= 1e6 ? `${fmt(y / 1e6, 2)} Ma` : fmt(y, 0));
export const def: SimDef = {
  meta,
  lesson: [
    "化石是保存在岩层中的古生物遗体、遗物或生活痕迹，是研究生物进化最直接、最重要的证据。越古老的地层中化石越简单、越低等，越新的地层中化石越复杂、越高等，说明生物是由简单到复杂、由低等到高等、由水生到陆生逐渐进化的。始祖鸟化石兼有爬行类和鸟类的特征。",
    "放射性同位素每过一个半衰期，剩下的量就减半，由此可以推算岩石和化石的年龄：年龄 = 半衰期 × log₂(1 / 剩余比例)。",
  ],
  formulas: ["t = T_{1/2}\\, \\log_2 \\dfrac{1}{f}"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [{ id: "f", label: "样品中同位素剩下的比例", min: 1, max: 100, step: 1, value: 100, unit: "%", when: (s) => s.mode === 0 }],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "放射性测定年龄"], [1, "地层与化石"]] }, { id: "iso", label: "同位素", value: 0, options: Mo.ISOTOPES.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 0 }],
  hidden: { ...dndInit(8, "fo") },
  drag: true,
  aspect: 0.66,
  pointer: (kind, x, y, s) => (s.mode === 1 ? dndPointer(spec)(kind, x, y, s) : undefined),
  derive: (s, ch) => { if (ch === "mode") { s.h = -1; s.sel = -1; } },
  readouts: (s) => s.mode === 0 ? [
    { label: "同位素的半衰期", value: big(Mo.ISOTOPES[s.iso][1]), unit: Mo.ISOTOPES[s.iso][1] >= 1e6 ? "" : "年" }, { label: "样品的年龄", value: big(Mo.age(s.f / 100, Mo.ISOTOPES[s.iso][1])), unit: Mo.age(s.f / 100, Mo.ISOTOPES[s.iso][1]) >= 1e6 ? "" : "年" },
    { label: "经过的半衰期数", value: fmt(Math.log2(100 / s.f), 2) }] : [
    { label: "已放对", value: `${placedCount(s, 8, "fo")} / 8` }, { label: "失误", value: String(s.miss), unit: "次" }, { label: "地层数", value: "5" }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const half = Mo.ISOTOPES[s.iso][1], P = axes(c, 60, 40, 540, 290, 5, 100, "half-lives", "%", 0, 5);
      curve(c, P, (x) => 100 * 0.5 ** x, COL.blue, 5, 100); const n = Math.log2(100 / s.f);
      circle(c, P.X(Math.min(5, n)), P.Y(s.f), 8, COL.red, COL.ink, 3); txt(c, `${fmt(n, 2)} T½`, 330, 30, 20, COL.purple); void half;
    } else {
      Mo.LAYERS.forEach((nm, j) => { rect(c, 20, ty(j), 600, 40, ["#e9ecef", "#dee2e6", "#d0bfa8", "#e6d3b3", "#f1e6c8"][j], COL.grey, 2, 4); lab(c, nm, 28, ty(j) + 10, 14, COL.grey, "left"); let k = 0; for (let i = 0; i < 8; i++) if (s[`fo${i}`] && Mo.FOSSILS[i][1] === j) { lab(c, Mo.FOSSILS[i][0], 380 + k * 100, ty(j) + 24, 15, "#1b7a32"); k++; } });
      for (let i = 0; i < 8; i++) { if (s[`fo${i}`] || s.h === i) continue; const [x, y] = slot(i); rect(c, x - 66, y - 26, 132, 52, s.sel === i ? "#fff3bf" : "#fff", s.sel === i ? COL.orange : COL.nucleus, 3, 12); lab(c, Mo.FOSSILS[i][0], x, y, 16); }
      if (s.h >= 0) { rect(c, s.hx - 66, s.hy - 26, 132, 52, "#ffe8cc", COL.orange, 4, 12); lab(c, Mo.FOSSILS[s.h][0], s.hx, s.hy, 16); }
    }
  },
  tasks: [
    { id: "c14", text: "碳-14 只剩 25 %：样品的年龄约 11460 年（两个半衰期）", check: (s) => s.mode === 0 && s.iso === 0 && s.f === 25 },
    { id: "u238", text: "铀-238 剩 50 %：岩石的年龄约 44.7 亿年", check: (s) => s.mode === 0 && s.iso === 2 && s.f === 50 },
    { id: "layers", text: "把 8 种化石全部放进它们最早大量出现的地层", check: (s) => s.mode === 1 && placedCount(s, 8, "fo") === 8 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
