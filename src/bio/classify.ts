import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-classify";
import { drawOrganism } from "./organisms";
import { mulberry32 } from "../phys/qtools";
import { dndInit, dndPointer, placedCount, type DndSpec } from "./dnd";
import { COL, lab, txt, rect, circle } from "./draw";
export const meta = CATALOG.classify;
type S = Record<string, number>;
const colX = (i: number) => 66 + 127 * i;
export const itemsOf = (s: S) => Mo.items(s.set, mulberry32(7000 + s.seed * 31 + s.set));
const slot = (i: number): [number, number] => [colX(i % 5), 262 + 84 * Math.floor(i / 5)];
export const specFor = (s: S): DndSpec => { const it = itemsOf(s); return { n: it.length, prefix: "cl", hit: [62, 40], at: (i) => slot(i), answer: (i) => Mo.SETS[s.set].of(Mo.ORGS[it[i]]), targets: () => Mo.SETS[s.set].classes.map((_, j) => ({ x: colX(j), y: 114, hw: 62, hh: 70 })) }; };
const specimen = (s: S) => Mo.ORGS.length ? Math.floor(mulberry32(500 + s.tseed * 17)() * Mo.ORGS.length) : 0;
export const target = (s: S) => specimen(s);
const nodeOf = (n: number) => Mo.TREE[n];
const wrap = (t: string, n: number) => (t.length <= n ? [t] : [t.slice(0, n), t.slice(n)]);
export const def: SimDef = {
  meta,
  lesson: [
    "生物分类是研究生物的一种基本方法：把形态结构、生理功能等方面相似程度高的生物归为一类。分类的基本单位从大到小：界、门、纲、目、科、属、种，种是最基本的单位。生物分为动物、植物、真菌、细菌等界，病毒没有细胞结构。",
    "检索表：每一步根据一个特征回答“是”或“否”，一步步缩小范围，直到只剩一种生物。分类游戏：把生物拖到所属的类群中（也可以先点生物，再点类群）。脊椎动物分为鱼类、两栖类、爬行类、鸟类和哺乳类；植物分为藻类、苔藓、蕨类、裸子和被子植物。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [],
  choices: [
    { id: "mode", label: "游戏", value: 0, options: [[0, "检索表鉴定"], [1, "分类游戏"]] },
    { id: "set", label: "分类的内容", value: 0, options: [[0, "脊椎动物五大类"], [1, "植物的类群"], [2, "五个界"]], when: (s) => s.mode === 1 },
    { id: "ans", label: "回答问题", value: -1, options: [[1, "是"], [0, "否"]], when: (s) => s.mode === 0 && s.fin === 0 },
  ],
  hidden: { ...dndInit(10, "cl"), seed: 1, tseed: 1, node: 0, qn: 0, fin: 0, ok: 0, found: -1, ident: 0, last: 0, a0: -1, a1: -1, a2: -1, a3: -1, a4: -1, a5: -1, a6: -1, a7: -1, a8: -1, a9: -1 },
  actions: [{ id: "next", label: "换一个", run: (s) => (s.mode === 0 ? { tseed: s.tseed + 1, node: 0, qn: 0, fin: 0, ok: 0, found: -1, a0: -1, a1: -1, a2: -1, a3: -1, a4: -1, a5: -1, a6: -1, a7: -1, a8: -1, a9: -1 } : { seed: s.seed + 1, h: -1, sel: -1, last: 0, ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`cl${i}`, 0])) }) }],
  drag: true,
  aspect: 0.66,
  derive: (s, ch) => {
    if (ch === "ans" && s.ans >= 0 && s.mode === 0 && !s.fin) {
      const nd = nodeOf(s.node), a = s.ans === 1;
      if (s.qn < 10) s[`a${s.qn}`] = a ? 1 : 0;
      s.qn += 1; s.node = (a ? nd.yes : nd.no)!;
      const nx = nodeOf(s.node);
      if (nx.leaf !== undefined) { s.fin = 1; s.found = nx.leaf; s.ok = nx.leaf === target(s) ? 1 : 0; if (s.ok) s.ident += 1; }
      s.ans = -1;
    }
    if (ch === "mode" || ch === "set") { s.h = -1; s.sel = -1; s.last = 0; for (let i = 0; i < 10; i++) s[`cl${i}`] = 0; if (ch === "set") s.seed = 1; }
  },
  pointer: (kind, x, y, s) => {
    if (s.mode !== 1) return;
    const sp = specFor(s), r = dndPointer(sp)(kind, x, y, s);
    if (r) for (let i = 0; i < sp.n; i++) if (r[`cl${i}`] === 1) r.last = i + 1;
    return r;
  },
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "已提出的问题", value: String(s.qn) }, { label: "已正确鉴定", value: String(s.ident), unit: "种" }, { label: "鉴定结果", value: s.fin ? (s.ok ? "鉴定正确" : "鉴定有误：与标本不符") : "—" }];
    const n = specFor(s).n; return [{ label: "已放对", value: `${placedCount(s, n, "cl")} / ${n}` }, { label: "失误", value: String(s.miss), unit: "次" }, { label: "最后放对", value: s.last ? Mo.ORGS[itemsOf(s)[s.last - 1]].name : "—" }];
  },
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const t = target(s), nd = nodeOf(s.node);
      rect(c, 14, 40, 236, 250, "#f8f9fa", COL.ink, 3, 18); drawOrganism(c, t, 132, 160, 190);
      lab(c, "标本", 20, 22, 18, COL.grey, "left");
      if (s.fin) {
        const f = Mo.ORGS[s.found];
        lab(c, s.ok ? "鉴定正确" : "鉴定有误：与标本不符", 270, 70, 22, s.ok ? COL.green : COL.red, "left"); lab(c, `检索结果：${f.name}`, 270, 110, 22, COL.ink, "left");
        lab(c, `标本：${Mo.ORGS[t].name}`, 270, 146, 20, COL.purple, "left");
      } else {
        lab(c, `问题 ${s.qn + 1}`, 270, 60, 18, COL.grey, "left");
        wrap(Mo.TAGQ[nd.tag!], 14).forEach((ln, i) => lab(c, ln, 270, 100 + i * 34, 26, COL.ink, "left"));
      }
      lab(c, "已回答：", 270, 196, 15, COL.grey, "left");
      for (let i = 0; i < Math.min(s.qn, 10); i++) { let n = 0; const path = Mo.identify((tag) => Mo.ORGS[t].tags.has(tag)).path; void n; const q = path[i]; const a = s[`a${i}`]; if (q) { lab(c, `${Mo.TAGQ[q[0]]}`, 270 + (i % 2) * 180, 218 + Math.floor(i / 2) * 20, 12, COL.grey, "left"); txt(c, a === 1 ? "Y" : "N", 270 + (i % 2) * 180 + 170, 218 + Math.floor(i / 2) * 20, 12, a === 1 ? COL.green : COL.red, "right"); } }
      return;
    }
    const sp = specFor(s), cls = Mo.SETS[s.set].classes, it = itemsOf(s);
    cls.forEach((nm, j) => {
      rect(c, colX(j) - 62, 44, 124, 140, "#f3f0ff", COL.grey, 2, 14); lab(c, nm, colX(j), 62, 18, COL.purple);
      let k = 0; for (let i = 0; i < sp.n; i++) if (s[`cl${i}`] && sp.answer(i, s) === j) { drawOrganism(c, it[i], colX(j) - 24 + (k % 2) * 48, 112 + Math.floor(k / 2) * 34, 44); k++; }
    });
    for (let i = 0; i < sp.n; i++) {
      if (s[`cl${i}`] || s.h === i) continue;
      const [x, y] = slot(i), sel = s.sel === i;
      rect(c, x - 58, y - 38, 116, 76, sel ? "#fff3bf" : "#fff", sel ? COL.orange : COL.nucleus, 3, 12); drawOrganism(c, it[i], x, y - 8, 56); lab(c, Mo.ORGS[it[i]].name, x, y + 28, 15);
    }
    if (s.h >= 0) { rect(c, s.hx - 58, s.hy - 38, 116, 76, "#ffe8cc", COL.orange, 4, 12); drawOrganism(c, it[s.h], s.hx, s.hy - 8, 56); lab(c, Mo.ORGS[it[s.h]].name, s.hx, s.hy + 28, 15); }
    void circle;
  },
  tasks: [
    { id: "key", text: "用检索表正确鉴定 3 个标本", check: (s) => s.ident >= 3 },
    { id: "vert", text: "分类游戏：把 10 个动物全部放进正确的类群（脊椎动物五大类）", check: (s) => s.mode === 1 && s.set === 0 && placedCount(s, 10, "cl") === 10 },
    { id: "plant", text: "分类游戏：把 6 种植物全部放进正确的类群", check: (s) => s.mode === 1 && s.set === 1 && placedCount(s, 6, "cl") === 6 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
