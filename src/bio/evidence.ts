import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-evidence";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, leaders, type DMode } from "./match";
import { COL, lab, rect, circle, ell, line } from "./draw";
export const meta = CATALOG.evidence;
const X0 = 30, YM = 250;
/** the centres of the five bone groups of a limb drawn from left to right, the marks above / below them */
export const limbPts = (an: number): [number, number][] => { let x = X0; return Mo.LIMBS[an][2].map((l) => { const p: [number, number] = [x + l / 2, YM]; x += l; return p; }); };
export const limbMarks = (an: number): [number, number][] => limbPts(an).map(([x], i) => [Math.min(430, Math.max(30, x)) + (i === 1 ? 0 : 0), i % 2 ? 372 : 140]);
export const HOM: DMode[] = [0, 1, 2].map((an) => ({ kind: "label", prefix: "h", items: Mo.BONES, marks: limbMarks(an), fn: Mo.BONE_FN }) as DMode);
const PFX = ["h"];
const modeOf = (s: Record<string, number>) => (s.mode === 0 ? HOM[s.an] : null);
function limb(c: CanvasRenderingContext2D, an: number) {
  const L = Mo.LIMBS[an][2]; let x = X0;
  const col = ["#fff", "#f1f3f5", "#fff9db", "#fff", "#fff"];
  // outline of the soft parts
  if (an === 1) { c.beginPath(); c.moveTo(X0 + L[0], YM - 10); c.lineTo(X0 + L[0] + L[1] + L[2] + L[3], YM - 6); c.lineTo(X0 + L[0] + L[1] + L[2] + L[3] + L[4] * 0.9, YM + 70); c.lineTo(X0 + L[0] + L[1] + L[2] + L[3] + L[4] * 0.9, YM - 70); c.closePath(); c.fillStyle = "#e7dcc9"; c.fill(); }
  if (an === 2) ell(c, X0 + 150, YM, 140, 56, "#a5d8ff", COL.ink, 3);
  rect(c, x, YM - 10, L[0], 20, col[0], COL.ink, 3, 10); x += L[0];
  rect(c, x, YM - 14, L[1], 11, col[1], COL.ink, 3, 5); rect(c, x, YM + 3, L[1], 11, col[1], COL.ink, 3, 5); x += L[1];
  for (let i = 0; i < 4; i++) rect(c, x + 2, YM - 18 + i * 9, L[2] - 4, 8, col[2], COL.ink, 2, 3); x += L[2];
  const nf = 5, fan = an === 1 ? 0.9 : an === 2 ? 0.3 : 0.5;
  for (let i = 0; i < nf; i++) { const a = (i - 2) * fan / 2, y0 = YM + (i - 2) * 8; line(c, x, y0, x + L[3], y0 + Math.sin(a) * L[3] * 0.5, COL.ink, 4); }
  for (let i = 0; i < nf; i++) { const a = (i - 2) * fan / 2, y0 = YM + (i - 2) * 8 + Math.sin(a) * L[3] * 0.5, x1 = x + L[3]; line(c, x1, y0, x1 + L[4] * Math.cos(a), y0 + Math.sin(a * 1.6) * L[4] * (an === 1 ? 0.85 : 0.5), COL.ink, 3.5); }
}
function embryo(c: CanvasRenderingContext2D, x: number, y: number, stage: number, d: number, name: string) {
  const early = Math.max(0, 1 - stage / 70);
  c.beginPath(); c.arc(x, y, 60, 0.4, Math.PI * 1.55); c.strokeStyle = "#ffc9a0"; c.lineWidth = 34 - 8 * (stage / 100); c.lineCap = "round"; c.stroke();
  circle(c, x - 28, y - 46, 26 + 6 * (stage / 100) * d, "#ffd8a8", COL.ink, 3);
  c.globalAlpha = early; for (let k = 0; k < 3; k++) line(c, x - 40 + k * 8, y - 28 + k * 4, x - 28 + k * 8, y - 18 + k * 4, COL.red, 3);
  c.beginPath(); c.moveTo(x + 40, y + 48); c.quadraticCurveTo(x + 76, y + 78, x + 100, y + 56 - 20 * stage / 100); c.strokeStyle = "#ffc9a0"; c.lineWidth = 12 * early + 3; c.stroke(); c.globalAlpha = 1;
  lab(c, name, x, y + 120, 18, COL.ink);
  void d;
}
export const def: SimDef = {
  meta,
  lesson: [
    "除化石外，进化还有其他证据。比较解剖学：蝙蝠的翼、鲸的鳍和人的上肢，骨骼的结构基本相同（肱骨、尺骨和桡骨、腕骨、掌骨、指骨），功能却不同，这样的器官叫同源器官，说明它们起源于共同的祖先。胚胎学：脊椎动物的早期胚胎都有鳃裂和尾，越到后期差异越大，说明它们可能有共同的祖先。",
    "分子生物学：不同生物的同一种蛋白质（如细胞色素 c）氨基酸序列差异越小，亲缘关系越近（属于拓展内容，数据是取整的参考值）。进化树表示生物之间的亲缘关系：两条谱系分开得越晚，亲缘关系越近。把骨的名称拖到图中的标记处；调节胚胎的发育程度，选择生物比较分子差异，在进化树中选择两种生物，看它们的共同祖先。",
  ],
  links: [{ text: "相关：化石与进化的证据", href: "#/science/bio/fossils" }, { text: "相关：自然选择", href: "#/science/bio/selection" }],
  params: [{ id: "stage", label: "胚胎的发育程度", min: 0, max: 100, step: 5, value: 100, unit: "%", when: (s) => s.mode === 1 }],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "比较解剖学"], [1, "胚胎的比较"], [2, "分子证据（拓展）"], [3, "进化树"]] },
    { id: "an", label: "肢体", value: 0, options: Mo.LIMBS.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 0 },
    { id: "esp", label: "与人的胚胎比较的生物", value: 0, options: Mo.EMBRYOS.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 1 },
    { id: "csp", label: "与人比较的生物", value: 7, options: Mo.CYT.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 2 },
    { id: "a", label: "生物甲", value: 0, options: Mo.TREE_SP.map((x, i) => [i, x] as [number, string]), when: (s) => s.mode === 3 },
    { id: "b", label: "生物乙", value: 4, options: Mo.TREE_SP.map((x, i) => [i, x] as [number, string]), when: (s) => s.mode === 3 },
  ],
  hidden: dndFlags(PFX),
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode" || ch === "an") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => {
    if (s.mode === 0) return [...dndReadouts(s, HOM[s.an]), { label: "这个肢体的功能", value: Mo.LIMBS[s.an][1] }];
    if (s.mode === 1) { const sim = Mo.similarity(s.esp, s.stage); return [{ label: "生物", value: Mo.EMBRYOS[s.esp][0] }, { label: "发育程度", value: String(s.stage), unit: "%" }, { label: "与人的胚胎的相似程度", value: fmt(sim * 100, 0), unit: "%" }, { label: "鳃裂和尾", value: s.stage < 40 ? "明显" : s.stage < 70 ? "逐渐消失" : "基本消失" }]; }
    if (s.mode === 2) return [{ label: "生物", value: Mo.CYT[s.csp][0] }, { label: "与人不同的氨基酸", value: String(Mo.CYT[s.csp][1]), unit: "/ 104" }, { label: "相同的氨基酸", value: fmt(Mo.identical(s.csp), 1), unit: "%" }, { label: "亲缘关系", value: Mo.CYT[s.csp][1] <= 1 ? "最近" : Mo.CYT[s.csp][1] <= 15 ? "较近" : "较远" }];
    const t = Mo.mrca(s.a, s.b); return [{ label: "生物甲", value: Mo.TREE_SP[s.a] }, { label: "生物乙", value: Mo.TREE_SP[s.b] }, { label: "最近共同祖先", value: s.a === s.b ? "（同一种生物）" : `约 ${t}`, unit: s.a === s.b ? "" : "百万年前" }];
  },
  draw(c, w, h, s) {
    if (s.mode === 0) { limb(c, s.an); leaders(c, limbMarks(s.an), limbPts(s.an)); lab(c, Mo.LIMBS[s.an][0], 20, 22, 17, COL.grey, "left"); drawDnd(c, s, HOM[s.an]); return; }
    if (s.mode === 1) {
      rect(c, 20, 40, 600, 330, "#fff9f0", COL.grey, 2, 16); embryo(c, 140, 160, s.stage, 0.2, "人"); embryo(c, 390, 160, s.stage, Mo.EMBRYOS[s.esp][1], Mo.EMBRYOS[s.esp][0]);
      const sim = Mo.similarity(s.esp, s.stage); rect(c, 40, 400, 540, 22, "#f1f3f5", COL.ink, 2, 11); rect(c, 40, 400, Math.max(4, 540 * sim), 22, sim > 0.7 ? COL.green : COL.orange, COL.ink, 2, 11); lab(c, `${fmt(sim * 100, 0)} %`, 310, 448, 24, COL.ink);
      return;
    }
    if (s.mode === 2) {
      Mo.CYT.forEach(([nm, d], i) => { const y = 50 + 44 * i, on = i === s.csp; lab(c, nm, 130, y + 16, 17, on ? COL.orange : COL.ink, "right"); rect(c, 146, y, 440, 32, "#f1f3f5", on ? COL.orange : COL.grey, on ? 4 : 2, 8); rect(c, 146, y, Math.max(3, (d / 44) * 440), 32, on ? COL.orange : "#a5d8ff", null, 0, 8); lab(c, String(d), 600, y + 16, 16, COL.ink); });
      lab(c, "amino acids different from the human", 340, 22, 15, COL.grey);
      return;
    }
    const X = (t: number) => 460 - 4.2 * t, Y = (i: number) => 60 + 62 * i;
    Mo.TREE_SP.forEach((nm, i) => { const on = i === s.a || i === s.b; line(c, 460, Y(i), X(Mo.JOIN[i]), Y(i), on ? COL.orange : COL.ink, on ? 5 : 3); lab(c, nm, 470, Y(i), 17, on ? COL.orange : COL.ink, "left"); });
    line(c, X(7), Y(0), X(7), Y(1), COL.ink, 3); line(c, X(7), Y(0.5), X(9), Y(0.5), COL.ink, 3); line(c, X(9), Y(0.5), X(9), Y(2), COL.ink, 3);
    line(c, X(9), Y(1.25), X(14), Y(1.25), COL.ink, 3); line(c, X(14), Y(1.25), X(14), Y(3), COL.ink, 3); line(c, X(14), Y(2.125), X(28), Y(2.125), COL.ink, 3);
    line(c, X(28), Y(2.125), X(28), Y(4), COL.ink, 3); line(c, X(28), Y(3.06), X(90), Y(3.06), COL.ink, 3); line(c, X(90), Y(3.06), X(90), Y(5), COL.ink, 3);
    if (s.a !== s.b) { const t = Mo.mrca(s.a, s.b); line(c, X(t), 28, X(t), 400, COL.orange, 3, [8, 6]); lab(c, `${t} Ma`, X(t), 416, 18, COL.orange); }
    line(c, 40, 430, 460, 430, COL.grey, 2); for (const t of [0, 20, 40, 60, 80, 100]) { line(c, X(t), 424, X(t), 436, COL.grey, 2); lab(c, String(t), X(t), 452, 13, COL.grey); }
    lab(c, "Ma (million years ago)", 250, 22, 14, COL.grey);
  },
  tasks: [
    { id: "homol", text: "给蝙蝠的翼的 5 组骨全部放对位置", check: (s) => s.mode === 0 && s.an === 1 && allPlaced(s, HOM[1]) },
    { id: "embryo", text: "在发育早期（发育程度不超过 20 %），看到各种脊椎动物的胚胎相似度达到 90 % 以上", check: (s) => s.mode === 1 && s.stage <= 20 && Mo.similarity(s.esp, s.stage) >= 0.9 },
    { id: "cyt", text: "找出与人的细胞色素 c 完全相同的生物", check: (s) => s.mode === 2 && Mo.CYT[s.csp][1] === 0 },
    { id: "tree", text: "在进化树中找出与人亲缘关系最近的生物（黑猩猩）", check: (s) => s.mode === 3 && s.a === 0 && s.b === 1 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
