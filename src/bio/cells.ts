import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-cells";
import { dndInit, dndPointer, placedCount, type DndSpec } from "./dnd";
import { COL, lab, txt, rect, circle, ell, line } from "./draw";
export const meta = CATALOG.cells;
// where each structure is marked on the drawing: [plant markers][animal markers]  (indexes follow Mo.listFor)
export const MARK: [number, number][][] = [
  [[230, 56], [398, 150], [70, 215], [120, 150], [180, 300], [290, 215], [195, 190]],
  [[230, 66], [320, 200], [180, 190], [150, 265]],
];
const TRAY_X = 548, TRAY_Y = 34, TRAY_DY = 56;
export const specFor = (kind: number): DndSpec => ({
  n: Mo.listFor(kind).length, prefix: kind === 0 ? "pa" : "an", hit: [88, 26],
  at: (i) => [TRAY_X, TRAY_Y + 14 + TRAY_DY * i], answer: (i) => i,
  targets: () => MARK[kind].map(([x, y]) => ({ x, y, hw: 26, hh: 26 })),
});
const flag = (s: Record<string, number>, kind: number, i: number) => s[`${kind === 0 ? "pa" : "an"}${i}`] === 1;
function plantCell(c: CanvasRenderingContext2D) {
  rect(c, 30, 50, 380, 330, COL.wall, COL.ink, 3, 36); rect(c, 44, 64, 352, 302, COL.cyto, "#2b8a3e", 4, 28);
  ell(c, 290, 215, 95, 70, "#d0ebff", "#74c0fc", 3);
  for (const [x, y] of [[95, 260], [180, 300], [330, 95], [240, 92]]) ell(c, x, y, 26, 14, "#2f9e44", "#1b5e20", 2, 0.3);
  ell(c, 195, 190, 14, 8, "#ffa94d", "#e8590c", 2, -0.5);
  circle(c, 120, 150, 36, COL.nucleus, COL.ink, 3); circle(c, 128, 144, 10, "#7048e8", null);
}
function animalCell(c: CanvasRenderingContext2D) {
  ell(c, 230, 215, 190, 150, "#ffe3e3", "#e03131", 5);
  for (const [x, y] of [[150, 265], [300, 160], [310, 270]]) ell(c, x, y, 22, 11, "#ffa94d", "#e8590c", 2, 0.5);
  circle(c, 180, 190, 38, COL.nucleus, COL.ink, 3); circle(c, 188, 184, 11, "#7048e8", null);
}
export const def: SimDef = {
  meta,
  lesson: [
    "植物细胞和动物细胞都有细胞膜、细胞质、细胞核和线粒体。植物细胞还有细胞壁、叶绿体和液泡。叶绿体只存在于植物的绿色部分，根的细胞没有叶绿体。",
    "把右侧的名称拖到细胞上的标记处（也可以先点名称，再点标记）。放对后会显示该结构的功能；放错会计一次失误。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [],
  choices: [{ id: "kind", label: "细胞类型", value: 0, options: [[0, "植物细胞"], [1, "动物细胞"]] }],
  hidden: { ...dndInit(7, "pa"), an0: 0, an1: 0, an2: 0, an3: 0, last: 0 },
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "kind") { s.h = -1; s.sel = -1; s.last = 0; } },
  pointer: (kind, x, y, s) => {
    const sp = specFor(s.kind), r = dndPointer(sp)(kind, x, y, s);
    if (r) for (let i = 0; i < sp.n; i++) if (r[`${sp.prefix}${i}`] === 1) r.last = i + 1;
    return r;
  },
  readouts: (s) => {
    const L = Mo.listFor(s.kind), n = placedCount(s, L.length, s.kind === 0 ? "pa" : "an"), st = s.last ? L[s.last - 1] : null;
    return [{ label: "已放对", value: `${n} / ${L.length}` }, { label: "失误", value: String(s.miss), unit: "次" }, { label: "最后放对的结构", value: st ? st.name : "—" }, { label: "功能", value: st ? st.fn : "—" }];
  },
  draw(c, w, h, s) {
    const L = Mo.listFor(s.kind), sp = specFor(s.kind);
    if (s.kind === 0) plantCell(c); else animalCell(c);
    lab(c, s.kind === 0 ? "植物细胞" : "动物细胞", 20, 22, 20, COL.grey, "left");
    L.forEach((st, i) => {
      const [mx, my] = MARK[s.kind][i], done = flag(s, s.kind, i);
      circle(c, mx, my, 15, done ? "#b2f2bb" : "#fff", done ? COL.green : COL.ink, 3);
      txt(c, String(i + 1), mx, my + 1, 17, COL.ink);
      if (done) { c.save(); c.globalAlpha = 0.95; const t = st.name; rect(c, mx - 4, my + 20, 8 + 22 * t.length, 28, "#fff", COL.green, 2, 9); lab(c, t, mx + 4 + 11 * t.length - 4, my + 35, 17, "#1b7a32"); c.restore(); }
      if (!done) { const [tx, ty] = sp.at(i, s); const sel = s.sel === i, held = s.h === i;
        if (!held) { rect(c, tx - 88, ty - 22, 176, 44, sel ? "#fff3bf" : "#f3f0ff", sel ? COL.orange : COL.nucleus, 3, 12); lab(c, st.name, tx, ty, 19); }
      }
    });
    if (s.h >= 0) { rect(c, s.hx - 88, s.hy - 22, 176, 44, "#ffe8cc", COL.orange, 4, 12); lab(c, L[s.h].name, s.hx, s.hy, 19); }
    if (s.sel >= 0) lab(c, "再点细胞上的标记", 548, 440, 16, COL.orange);
    void line;
  },
  tasks: [
    { id: "plant", text: "给植物细胞的 7 个结构全部放对位置", check: (s) => placedCount(s, 7, "pa") === 7 },
    { id: "animal", text: "给动物细胞的 4 个结构全部放对位置", check: (s) => placedCount(s, 4, "an") === 4 },
    { id: "clean", text: "一次失误也没有，完成植物细胞", check: (s) => placedCount(s, 7, "pa") === 7 && s.miss === 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
