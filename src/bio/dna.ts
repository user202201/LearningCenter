import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-dna";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, leaders, type DMode } from "./match";
import { COL, lab, rect, circle, ell, line } from "./draw";
export const meta = CATALOG.dna;
export const MARKS: [number, number][] = [[60, 330], [60, 100], [240, 415], [400, 415], [330, 130]];
export const PTS: [number, number][] = [[150, 240], [200, 150], [300, 340], [372, 335], [226, 196]];
export const MODES: (DMode | null)[] = [{ kind: "label", prefix: "c", items: Mo.PARTS.map((x) => x.name), marks: MARKS, fn: Mo.PARTS.map((x) => x.fn) }, null, null, null];
const PFX = ["c"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
const COLB: Record<string, string> = { A: "#ffa8a8", T: "#a5d8ff", C: "#b2f2bb", G: "#ffe066" };
function helix(c: CanvasRenderingContext2D, x0: number, y0: number, w: number, geneFrom: number, geneTo: number) {
  for (let i = 0; i <= 40; i++) { const t = i / 40, x = x0 + w * t, a = Math.sin(t * Math.PI * 4) * 28; if (i % 2 === 0) line(c, x, y0 - a, x, y0 + a, "#adb5bd", 3); }
  for (const ph of [0, Math.PI]) { c.beginPath(); for (let i = 0; i <= 120; i++) { const t = i / 120, x = x0 + w * t, y = y0 + Math.sin(t * Math.PI * 4 + ph) * 28; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.strokeStyle = ph ? COL.blue : COL.purple; c.lineWidth = 5; c.stroke(); }
  c.beginPath(); for (let i = 0; i <= 40; i++) { const t = geneFrom + (geneTo - geneFrom) * (i / 40), x = x0 + w * t, y = y0 + Math.sin(t * Math.PI * 4) * 28; if (i) c.lineTo(x, y); else c.moveTo(x, y); } c.strokeStyle = COL.red; c.lineWidth = 8; c.stroke();
}
export const def: SimDef = {
  meta,
  lesson: [
    "细胞核中有染色体，染色体由 DNA 和蛋白质组成；DNA 是主要的遗传物质，呈规则的双螺旋结构；基因是 DNA 上具有特定遗传信息的片段，控制生物的性状。一个 DNA 分子上有许多个基因。",
    "每种生物的体细胞中染色体的数目是一定的，成对存在，如人有 23 对（46 条）。生殖细胞（精子和卵细胞）中的染色体数目减半，受精卵恢复到 46 条。人的性别由性染色体决定：女性是 XX，男性是 XY；精子有 X 或 Y 两种，卵细胞只有 X，所以男女比例接近 1:1。碱基互补配对（A–T，C–G）属于拓展内容，教科书只要求知道 DNA 是双螺旋结构。",
  ],
  links: [{ text: "相关：遗传", href: "#/science/bio/genetics" }, { text: "相关：细胞分裂", href: "#/science/bio/division" }],
  params: [{ id: "N", label: "抽样的新生儿数", min: 10, max: 1000, step: 10, value: 100, unit: "人", when: (s) => s.mode === 3 }],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "染色体、DNA 和基因"], [1, "碱基配对（拓展）"], [2, "染色体的数目"], [3, "性别与性染色体"]] },
    { id: "pick", label: "选择下一个碱基", value: -1, options: Mo.BASES.map((b, i) => [i, b] as [number, string]), when: (s) => s.mode === 1 && s.k < 8 },
    { id: "sp", label: "生物", value: 0, options: Mo.SPECIES.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 2 },
    { id: "cell", label: "细胞", value: 0, options: Mo.CELLS.map((x, i) => [i, x] as [number, string]), when: (s) => s.mode === 2 },
  ],
  hidden: { ...dndFlags(PFX), k: 0, seed: 1 },
  actions: [{ id: "resample", label: "重新抽样", run: (s) => (s.mode === 3 ? { seed: s.seed + 1 } : undefined) }],
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => {
    if (ch === "mode") { dndClear(s, PFX); s.k = 0; s.pick = -1; }
    if (ch === "pick" && s.pick >= 0 && s.mode === 1 && s.k < 8) { if (Mo.BASES[s.pick] === Mo.partner(Mo.STRAND[s.k])) s.k += 1; else s.miss += 1; s.pick = -1; }
  },
  pointer: dndPtr(modeOf),
  readouts: (s) => {
    if (s.mode === 1) return [{ label: "已配对", value: `${s.k} / 8` }, { label: "失误", value: String(s.miss), unit: "次" }, { label: "规则", value: "A 与 T，C 与 G" }];
    if (s.mode === 2) { const n = Mo.chromosomes(s.sp, s.cell); return [{ label: "生物", value: Mo.SPECIES[s.sp][0] }, { label: "细胞", value: Mo.CELLS[s.cell] }, { label: "染色体数目", value: `${n}`, unit: "条" }, { label: "染色体对数", value: s.cell === 1 ? "0（不成对）" : `${n / 2}`, unit: s.cell === 1 ? "" : "对" }]; }
    if (s.mode === 3) { const b = Mo.boys(s.N, s.seed); return [{ label: "男孩", value: String(b), unit: "人" }, { label: "女孩", value: String(s.N - b), unit: "人" }, { label: "男孩所占比例", value: fmt((b / s.N) * 100, 1), unit: "%" }, { label: "理论比例", value: "50", unit: "%" }]; }
    return dndReadouts(s, MODES[0]!);
  },
  draw(c, w, h, s) {
    if (s.mode === 0) {
      ell(c, 200, 245, 190, 215, "#fff5f5", "#e03131", 4); circle(c, 200, 180, 92, "#e5dbff", COL.purple, 4);
      for (const a of [-0.55, 0.55]) { c.save(); c.translate(200, 160); c.rotate(a); rect(c, -48, -9, 96, 18, "#e64980", COL.ink, 2.5, 9); c.restore(); }
      for (const [bx, by] of [[226, 196], [170, 196], [168, 124], [232, 124], [200, 160]]) circle(c, bx, by, 5, "#4dabf7", COL.ink, 1.5);
      line(c, 232, 166, 290, 310, "#adb5bd", 2, [6, 5]); line(c, 232, 190, 300, 360, "#adb5bd", 2, [6, 5]);
      rect(c, 262, 290, 190, 100, "#fff", COL.grey, 2, 12); helix(c, 275, 340, 164, 0.62, 0.8);
      leaders(c, MARKS, PTS); lab(c, "细胞（示意图）", 20, 22, 17, COL.grey, "left");
      drawDnd(c, s, MODES[0]!);
    } else if (s.mode === 1) {
      lab(c, "DNA 的一条链（已知）", 320, 60, 17, COL.grey);
      for (let i = 0; i < 8; i++) { const x = 70 + 66 * i; rect(c, x - 26, 90, 52, 52, COLB[Mo.STRAND[i]], COL.ink, 3, 10); lab(c, Mo.STRAND[i], x, 116, 26);
        line(c, x, 144, x, 192, "#adb5bd", 3, i < s.k ? [] : [4, 5]);
        if (i < s.k) { rect(c, x - 26, 194, 52, 52, COLB[Mo.partner(Mo.STRAND[i])], COL.green, 3, 10); lab(c, Mo.partner(Mo.STRAND[i]), x, 220, 26); } else rect(c, x - 26, 194, 52, 52, "#f8f9fa", COL.grey, 2, 10); }
      lab(c, "要配上的另一条链", 320, 282, 17, COL.grey);
      lab(c, s.k >= 8 ? "配对完成" : `下一个：与 ${Mo.STRAND[s.k]} 配对的是？`, 320, 340, 22, s.k >= 8 ? COL.green : COL.ink);
    } else if (s.mode === 2) {
      const n = Mo.chromosomes(s.sp, s.cell);
      ell(c, 250, 230, 200, 170, s.cell === 1 ? "#fff3bf" : "#e5dbff", COL.ink, 4);
      const per = 12; for (let i = 0; i < n; i++) { const x = 110 + 28 * (i % per), y = 160 + 34 * Math.floor(i / per), pair = s.cell !== 1 ? i >> 1 : i; rect(c, x - 6, y - 12, 12, 24, ["#e64980", "#4263eb", "#2f9e44", "#f08c00"][pair % 4], COL.ink, 1.5, 6); }
      lab(c, `${n}`, 250, 380, 56, COL.purple);
    } else {
      const b = Mo.boys(s.N, s.seed);
      rect(c, 40, 100, 120, 110, "#fff", null); lab(c, "精子", 260, 40, 16, COL.grey); lab(c, "卵细胞", 100, 90, 16, COL.grey);
      ["X", "Y"].forEach((sp, j) => { rect(c, 190 + 90 * j, 56, 80, 50, "#d0ebff", COL.ink, 3, 10); lab(c, sp, 230 + 90 * j, 82, 26); });
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { rect(c, 190 + 90 * j, 110 + 54 * i, 80, 50, j === 0 ? "#ffd6e7" : "#d0ebff", COL.ink, 3, 10); lab(c, j === 0 ? "XX" : "XY", 230 + 90 * j, 135 + 54 * i, 24); }
      lab(c, "X", 130, 135, 26); lab(c, "X", 130, 189, 26);
      rect(c, 20, 280, 600, 120, "#f8f9fa", COL.grey, 2, 12); rect(c, 40, 296, Math.max(2, 560 * b / s.N), 36, "#74c0fc", COL.ink, 2, 6); rect(c, 40, 346, Math.max(2, 560 * (s.N - b) / s.N), 36, "#faa2c1", COL.ink, 2, 6);
      line(c, 320, 290, 320, 392, COL.grey, 2, [5, 5]); lab(c, `${b}`, 60, 314, 20, COL.ink, "left"); lab(c, `${s.N - b}`, 60, 364, 20, COL.ink, "left");
    }
  },
  tasks: [
    { id: "chrom", text: "给细胞核、染色体、DNA、基因和蛋白质全部放对位置", check: (s) => s.mode === 0 && allPlaced(s, MODES[0]!) },
    { id: "pair", text: "为 DNA 的一条链配上互补的另一条链（8 个碱基）", check: (s) => s.mode === 1 && s.k === 8 },
    { id: "gamete", text: "找出人的生殖细胞中的染色体数目（23 条）", check: (s) => s.mode === 2 && s.sp === 0 && s.cell === 1 },
    { id: "sexratio", text: "抽样 500 人以上，男女比例接近 1:1（相差不到 10 %）", check: (s) => s.mode === 3 && s.N >= 500 && Math.abs(2 * Mo.boys(s.N, s.seed) - s.N) / s.N < 0.1 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
