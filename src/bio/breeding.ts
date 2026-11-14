import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-breeding";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, type DMode } from "./match";
import { COL, lab, rect, circle, ell, line } from "./draw";
export const meta = CATALOG.breeding;
export const MODES: (DMode | null)[] = [null, { kind: "bucket", prefix: "t", items: Mo.TECH_ITEMS.map((x) => x[0]), answers: Mo.TECH_ITEMS.map((x) => x[1]), buckets: Mo.TECHS }, null];
const PFX = ["t"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
function sheep(c: CanvasRenderingContext2D, x: number, y: number, face: number, name: string, role: string) {
  ell(c, x, y + 20, 38, 26, "#fff", COL.ink, 3); ell(c, x + 30, y - 2, 18, 20, Mo.FACE_COLORS[face], COL.ink, 3); circle(c, x + 36, y - 6, 2.5, face === 1 ? "#fff" : COL.ink, null);
  line(c, x - 20, y + 44, x - 20, y + 62, COL.ink, 4); line(c, x + 14, y + 44, x + 14, y + 62, COL.ink, 4);
  lab(c, name, x, y + 84, 16); if (role) lab(c, role, x, y - 36, 14, COL.grey);
}
export const def: SimDef = {
  meta,
  lesson: [
    "杂交育种：让不同品种的生物杂交，从后代中选出具有优良性状的新品种，如杂交水稻。诱变育种：用射线、药物处理或太空环境（太空育种）使生物的遗传物质发生改变，再从变异的后代中选育新品种。转基因技术：把一种生物的基因转入另一种生物体内，使它获得新的性状，如抗虫棉。克隆技术：用体细胞的细胞核培育出遗传物质与供核个体基本相同的个体，如多莉羊。",
    "在杂交育种模型中，高产（A）对低产（a）、抗病（B）对感病（b）都是显性。纯种高产感病（AAbb）与纯种低产抗病（aaBB）杂交，F1 都是 AaBb，表现为高产抗病；F1 自交，F2 出现四种表现型，比例约 9 : 3 : 3 : 1，其中只有 AABB（1/16）的高产抗病植株能稳定遗传。克隆模型中，克隆羊的性状主要像提供细胞核的羊。",
  ],
  links: [{ text: "相关：遗传", href: "#/science/bio/genetics" }, { text: "相关：遗传病与优生", href: "#/science/bio/eugenics" }],
  params: [{ id: "n", label: "F2 的植株数", min: 16, max: 1600, step: 16, value: 160, unit: "株", when: (s) => s.mode === 0 }],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "杂交育种"], [1, "育种与生物技术分类"], [2, "克隆羊"]] },
    { id: "gen", label: "子代", value: 0, options: [[0, "F1（子一代）"], [1, "F2（子二代）"]], when: (s) => s.mode === 0 },
    { id: "nuc", label: "提供细胞核的羊", value: 1, options: Mo.SHEEP.map((x, i) => [i, `${x[0]}（${x[1]}）`] as [number, string]), when: (s) => s.mode === 2 },
    { id: "egg", label: "提供卵细胞的羊", value: 1, options: Mo.SHEEP.map((x, i) => [i, `${x[0]}（${x[1]}）`] as [number, string]), when: (s) => s.mode === 2 },
    { id: "sur", label: "代孕的羊", value: 1, options: Mo.SHEEP.map((x, i) => [i, `${x[0]}（${x[1]}）`] as [number, string]), when: (s) => s.mode === 2 },
  ],
  hidden: dndFlags(PFX),
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => {
    if (s.mode === 1) return dndReadouts(s, MODES[1]!);
    if (s.mode === 2) { const f = Mo.faceOf(s.nuc, s.egg, s.sur); return [{ label: "克隆羊的脸色", value: Mo.SHEEP[f][1] }, { label: "遗传物质主要来自", value: Mo.SHEEP[s.nuc][0] }, { label: "胚胎发育的场所", value: `${Mo.SHEEP[s.sur][0]}的子宫` }]; }
    if (s.gen === 0) return [{ label: "亲本", value: "AAbb × aaBB" }, { label: "F1 的基因型", value: "AaBb" }, { label: "F1 的表现型", value: "全部高产抗病" }, { label: "F1 的植株数", value: String(s.n), unit: "株" }];
    return [...Mo.F2.map((f, i) => ({ label: f[0], value: fmt(Mo.f2count(s.n, i), 1), unit: "株" })), { label: "能稳定遗传的 AABB", value: fmt(Mo.pureTarget(s.n), 1), unit: "株" }];
  },
  draw(c, w, h, s) {
    if (s.mode === 1) { drawDnd(c, s, MODES[1]!); return; }
    if (s.mode === 2) {
      const f = Mo.faceOf(s.nuc, s.egg, s.sur);
      sheep(c, 90, 90, s.nuc, Mo.SHEEP[s.nuc][0], "细胞核"); sheep(c, 90, 270, s.egg, Mo.SHEEP[s.egg][0], "去核的卵细胞");
      line(c, 150, 150, 240, 210, COL.grey, 3); line(c, 150, 310, 240, 240, COL.grey, 3); circle(c, 270, 225, 28, "#fff9db", COL.ink, 4); circle(c, 270, 225, 10, COL.purple, COL.ink, 2);
      line(c, 298, 225, 360, 225, COL.grey, 3); sheep(c, 410, 100, f, "克隆羊", ""); sheep(c, 410, 290, s.sur, Mo.SHEEP[s.sur][0], "代孕"); line(c, 410, 172, 410, 238, COL.grey, 3, [6, 5]);
      return;
    }
    const cells = (x: number, y: number, a: string, col: string, name: string) => { rect(c, x, y, 96, 52, col, COL.ink, 3, 12); lab(c, a, x + 48, y + 22, 18); lab(c, name, x + 48, y + 68, 14, COL.grey); };
    cells(60, 50, "AAbb", "#ffe3e3", "高产感病"); cells(190, 50, "aaBB", "#e3fafc", "低产抗病");
    line(c, 108, 104, 160, 150, COL.grey, 3); line(c, 238, 104, 190, 150, COL.grey, 3);
    cells(125, 150, "AaBb", "#e5dbff", "F1 高产抗病");
    if (s.gen === 1) {
      Mo.F2.forEach((f, i) => { const x = 350 + (i % 2) * 140, y = 70 + Math.floor(i / 2) * 120; rect(c, x, y, 124, 96, ["#d3f9d8", "#fff3bf", "#d0ebff", "#f1f3f5"][i], COL.ink, 3, 12); lab(c, `${f[1]} / 16`, x + 62, y + 30, 22); lab(c, fmt(Mo.f2count(s.n, i), 0), x + 62, y + 66, 26, COL.purple); });
      line(c, 190, 180, 340, 180, COL.grey, 3); lab(c, "F2", 320, 150, 18, COL.grey);
      lab(c, `AABB: ${fmt(Mo.pureTarget(s.n), 0)}`, 320, 340, 24, COL.green);
    } else lab(c, "F1", 320, 330, 30, COL.purple);
  },
  tasks: [
    { id: "f2", text: "F2 的植株数达到 160 株以上，看到能稳定遗传的 AABB 至少有 10 株", check: (s) => s.mode === 0 && s.gen === 1 && Mo.pureTarget(s.n) >= 10 },
    { id: "tech", text: "把 8 种做法放进正确的育种或生物技术", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
    { id: "dolly", text: "让克隆羊长成白脸：提供细胞核的是白脸的甲羊", check: (s) => s.mode === 2 && Mo.faceOf(s.nuc, s.egg, s.sur) === 0 && s.egg !== 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
