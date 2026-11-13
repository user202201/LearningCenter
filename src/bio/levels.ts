import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-levels";
import { dndInit, dndPointer, placedCount, type DndSpec } from "./dnd";
import { COL, lab, rect, line } from "./draw";
export const meta = CATALOG.levels;
const PERM = [[5, 0, 8, 3, 6, 1, 9, 4, 7, 2], [3, 6, 0, 5, 1, 7, 4, 2]];
const colX = (kind: number, i: number) => (kind === 0 ? 66 + 127 * i : 80 + 160 * i);
const slot = (kind: number, i: number): [number, number] => { const p = PERM[kind][i], per = kind === 0 ? 5 : 4; return [colX(kind, p % per), 268 + 76 * Math.floor(p / per)]; };
export const specFor = (kind: number): DndSpec => ({
  n: Mo.ITEMS[kind].length, prefix: "lv", hit: [kind === 0 ? 60 : 72, 28],
  at: (i) => slot(kind, i), answer: (i) => Mo.ITEMS[kind][i][1],
  targets: () => Mo.LEVELS[kind].map((_, j) => ({ x: colX(kind, j), y: 128, hw: kind === 0 ? 62 : 76, hh: 78 })),
});
export const def: SimDef = {
  meta,
  lesson: [
    "多细胞生物体的结构层次：细胞是基本的结构和功能单位；形态、结构、功能相似的细胞联合形成组织；几种组织构成器官；动物的几个器官构成系统，系统构成动物体。植物体没有“系统”这一层次：细胞 → 组织 → 器官 → 植物体。",
    "把下方的名称拖到它所属的层次中，也可以先点名称再点层次。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [],
  choices: [{ id: "kind", label: "生物类型", value: 0, options: [[0, "动物体"], [1, "植物体"]] }],
  hidden: { ...dndInit(10, "lv"), last: 0 },
  drag: true,
  aspect: 0.66,
  derive: (s, ch) => { if (ch === "kind") { s.h = -1; s.sel = -1; s.last = 0; for (let i = 0; i < 10; i++) s[`lv${i}`] = 0; } },
  pointer: (kind, x, y, s) => {
    const r = dndPointer(specFor(s.kind))(kind, x, y, s);
    if (r) for (let i = 0; i < 10; i++) if (r[`lv${i}`] === 1) r.last = i + 1;
    return r;
  },
  readouts: (s) => { const n = Mo.ITEMS[s.kind].length, it = s.last ? Mo.ITEMS[s.kind][s.last - 1] : null; return [
    { label: "已放对", value: `${placedCount(s, n, "lv")} / ${n}` }, { label: "失误", value: String(s.miss), unit: "次" },
    { label: "最后放对", value: it ? `${it[0]} → ${Mo.LEVELS[s.kind][it[1]]}` : "—" }]; },
  draw(c, w, h, s) {
    const kind = s.kind, sp = specFor(kind), L = Mo.LEVELS[kind], n = sp.n;
    L.forEach((name, j) => {
      const x = colX(kind, j), hw = kind === 0 ? 62 : 76;
      rect(c, x - hw, 52, 2 * hw, 156, ["#fff0f6", "#fff4e6", "#f4fce3", "#e7f5ff", "#f3f0ff"][j], COL.grey, 2, 16);
      lab(c, name, x, 74, 22, COL.purple);
      let k = 0; for (let i = 0; i < n; i++) if (s[`lv${i}`] && Mo.ITEMS[kind][i][1] === j) { lab(c, Mo.ITEMS[kind][i][0], x, 112 + 32 * k, 18, "#1b7a32"); k++; }
      if (j < L.length - 1) line(c, x + hw + 2, 128, colX(kind, j + 1) - hw - 2, 128, COL.grey, 3);
    });
    for (let i = 0; i < n; i++) {
      if (s[`lv${i}`] || s.h === i) continue;
      const [x, y] = slot(kind, i), sel = s.sel === i;
      rect(c, x - sp.hit[0] + 4, y - 24, 2 * sp.hit[0] - 8, 48, sel ? "#fff3bf" : "#f8f9fa", sel ? COL.orange : COL.nucleus, 3, 12); lab(c, Mo.ITEMS[kind][i][0], x, y, 19);
    }
    if (s.h >= 0) { rect(c, s.hx - 56, s.hy - 24, 112, 48, "#ffe8cc", COL.orange, 4, 12); lab(c, Mo.ITEMS[kind][s.h][0], s.hx, s.hy, 19); }
  },
  tasks: [
    { id: "animal", text: "把 10 个动物体的例子放进正确的层次", check: (s) => s.kind === 0 && placedCount(s, 10, "lv") === 10 },
    { id: "plant", text: "把 8 个植物体的例子放进正确的层次", check: (s) => s.kind === 1 && placedCount(s, 8, "lv") === 8 },
    { id: "clean", text: "不出一次错，完成一种生物的全部分类", check: (s) => s.miss === 0 && placedCount(s, Mo.ITEMS[s.kind].length, "lv") === Mo.ITEMS[s.kind].length },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
