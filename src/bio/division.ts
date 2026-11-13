import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-division";
import { COL, lab, txt, ell, line, circle } from "./draw";
export const meta = CATALOG.division;
type C = CanvasRenderingContext2D;
const colorOf = (i: number) => (i % 2 ? "#4263eb" : "#e03131");
function chromatid(c: C, x: number, y: number, ang: number, len: number, col: string, w = 7) {
  c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(0, -len / 2); c.lineTo(0, len / 2); c.strokeStyle = col; c.lineWidth = w; c.lineCap = "round"; c.stroke(); c.restore();
}
function xShape(c: C, x: number, y: number, ang: number, col: string) { chromatid(c, x - 4, y, ang, 38, col); chromatid(c, x + 4, y, ang, 38, col); circle(c, x, y, 3.5, "#fff", COL.ink, 2); }
const rodAt = (c: C, x: number, y: number, ang: number, col: string) => chromatid(c, x, y, ang, 36, col);
export const def: SimDef = {
  meta,
  lesson: [
    "细胞分裂使细胞数目增多。分裂前，细胞核中的染色体先复制（间期），每条染色体含有两条相同的染色单体；分裂时，染色体平均分配到两个新细胞中，所以子细胞与母细胞的染色体数目相同。",
    "各时期：前期染色体变得清晰；中期染色体排列在细胞中央；后期每条染色体分成两条，分别移向两极，染色体数目暂时加倍；末期形成两个新细胞（植物细胞中央形成新的细胞壁）。",
  ],
  formulas: ["2N \\to 2N", "N \\to \\tfrac{N}{2}\\ \\text{(生殖细胞)}"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [{ id: "stage", label: "分裂时期", min: 0, max: 5, step: 1, value: 0 }],
  choices: [{ id: "N", label: "体细胞的染色体数", value: 4, options: [[4, "4 条"], [6, "6 条"], [8, "8 条"]] }],
  play: { param: "stage", rate: 0.7 },
  aspect: 0.56,
  readouts: (s) => { const k = Mo.counts(s.N, s.stage); return [
    { label: "时期", value: Mo.STAGES[s.stage] },
    { label: s.stage === 5 ? "每个细胞的染色体" : "染色体", value: String(k.chrom), unit: "条" },
    { label: "染色单体", value: k.chromatids ? String(k.chromatids) : "0", unit: "条" },
    { label: s.stage === 5 ? "每个细胞的 DNA" : "DNA 分子", value: String(k.dna), unit: "个" },
    { label: "细胞数", value: String(k.cells) }]; },
  draw(c, w, h, s) {
    const N = s.N, st = s.stage, cx = 320, cy = 170;
    lab(c, Mo.STAGES[st], 18, 22, 22, COL.purple, "left");
    if (st <= 2) {
      ell(c, cx, cy, 190, 130, "#fff5f5", COL.ink, 4);
      if (st === 0) { circle(c, cx, cy, 78, "#f3f0ff", COL.nucleus, 3); for (let i = 0; i < N; i++) { const a = (i / N) * 6.283, r = 38 + (i % 2) * 14; chromatid(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, a + 1, 28, colorOf(i), 4); chromatid(c, cx + Math.cos(a) * r + 6, cy + Math.sin(a) * r + 3, a + 1, 28, colorOf(i), 4); } }
      else if (st === 1) { circle(c, cx, cy, 98, "", COL.nucleus, 2); c.setLineDash([6, 6]); c.stroke(); c.setLineDash([]); for (let i = 0; i < N; i++) { const a = (i / N) * 6.283 + 0.4, r = 46 + (i % 2) * 30; xShape(c, cx + Math.cos(a) * r, cy + Math.sin(a) * r, a * 1.7, colorOf(i)); } }
      else { line(c, cx, cy - 120, cx, cy + 120, COL.grey, 2, [4, 6]); for (let i = 0; i < N; i++) xShape(c, cx, cy - 96 + (i * 192) / (N - 1), 0.2 * (i % 3), colorOf(i)); line(c, cx - 170, cy, cx - 12, cy - 30, COL.grey, 1.5); line(c, cx + 170, cy, cx + 12, cy - 30, COL.grey, 1.5); }
    } else if (st === 3) {
      ell(c, cx, cy, 200, 125, "#fff5f5", COL.ink, 4);
      for (let i = 0; i < N; i++) for (const sd of [-1, 1]) { const y = cy - 90 + (i * 180) / (N - 1); rodAt(c, cx + sd * 78, y, 0, colorOf(i)); line(c, cx + sd * 78, y, cx + sd * 175, cy, "#adb5bd", 1.2); }
      lab(c, "染色体数目加倍", cx, cy + 148, 18, COL.red);
    } else if (st === 4) {
      c.beginPath(); c.ellipse(cx - 100, cy, 120, 118, 0, 0, 6.283); c.ellipse(cx + 100, cy, 120, 118, 0, 0, 6.283); c.fillStyle = "#fff5f5"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
      line(c, cx, cy - 60, cx, cy + 60, COL.green, 5);
      for (const sd of [-1, 1]) { circle(c, cx + sd * 118, cy, 62, "#f3f0ff", COL.nucleus, 3); for (let i = 0; i < N; i++) { const a = (i / N) * 6.283; chromatid(c, cx + sd * 118 + Math.cos(a) * 30, cy + Math.sin(a) * 30, a + 1, 22, colorOf(i), 4.5); } }
    } else {
      for (const sd of [-1, 1]) { ell(c, cx + sd * 158, cy, 148, 118, "#fff5f5", COL.ink, 4); circle(c, cx + sd * 158, cy, 62, "#f3f0ff", COL.nucleus, 3); for (let i = 0; i < N; i++) { const a = (i / N) * 6.283; chromatid(c, cx + sd * 158 + Math.cos(a) * 30, cy + Math.sin(a) * 30, a + 1, 22, colorOf(i), 4.5); } }
    }
    txt(c, `2n = ${N}`, 600, 22, 20, COL.grey, "right");
    void txt;
  },
  tasks: [
    { id: "ana", text: "找到后期：染色体数目暂时加倍", check: (s) => s.stage === 3 },
    { id: "meta", text: "找到中期：每条染色体含有两条染色单体", check: (s) => s.stage === 2 },
    { id: "eight", text: "把体细胞染色体设为 8 条，观察分裂完成后每个子细胞也是 8 条", check: (s) => s.N === 8 && s.stage === 5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
