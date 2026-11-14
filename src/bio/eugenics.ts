import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-eugenics";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, type DMode } from "./match";
import { COL, lab, rect, circle, line } from "./draw";
export const meta = CATALOG.eugenics;
export const MODES: (DMode | null)[] = [null, { kind: "bucket", prefix: "e", items: Mo.MEASURE_ITEMS.map((x) => x[0]), answers: Mo.MEASURE_ITEMS.map((x) => x[1]), buckets: Mo.MEASURES }];
const PFX = ["e"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
export const def: SimDef = {
  meta,
  lesson: [
    "隐性遗传病只有当一个人从父母双方各得到一个致病基因（aa）时才会发病。携带者（Aa）本人表现正常，但会把致病基因传给后代。近亲（有共同祖先的亲属）带有同一致病基因的可能性大得多，所以近亲结婚的后代患隐性遗传病的机会大大增加。我国法律禁止直系血亲和三代以内的旁系血亲结婚。",
    "优生优育的措施有：禁止近亲结婚、遗传咨询、产前诊断和适龄生育。本模型是简化的教学计算：设每 N 人中有 1 位携带者，无亲缘关系的夫妻双方都是携带者的概率约 1/N²；亲属中一方是携带者时，另一方带有同一基因的概率取共有基因的比例（表兄妹 1/8，同胞兄妹 1/2）；孩子患病的概率再乘 1/4。数值只用来说明道理。",
  ],
  links: [{ text: "相关：遗传", href: "#/science/bio/genetics" }, { text: "相关：人的由来与青春期", href: "#/science/bio/development" }],
  params: [{ id: "N", label: "携带者约占：每 N 人中有 1 位", min: 10, max: 200, step: 10, value: 50, unit: "人", when: (s) => s.mode === 0 }],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "近亲结婚的风险"], [1, "优生措施"]] },
    { id: "rel", label: "夫妻的关系", value: 0, options: Mo.REL.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 0 },
  ],
  hidden: dndFlags(PFX),
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => s.mode === 1 ? dndReadouts(s, MODES[1]!) : [
    { label: "携带者所占比例", value: `1 / ${s.N}` }, { label: "双方携带同一致病基因的概率", value: fmt(Mo.per10000(Mo.bothCarry(s.N, s.rel)), 1), unit: "/10000" },
    { label: "孩子患病的概率", value: fmt(Mo.per10000(Mo.risk(s.N, s.rel)), 2), unit: "/10000" }, { label: "是无亲缘关系的", value: fmt(Mo.fold(s.N, s.rel), 1), unit: "×" }],
  draw(c, w, h, s) {
    if (s.mode === 1) { drawDnd(c, s, MODES[1]!); return; }
    const a = Mo.risk(s.N, 0), b = Mo.risk(s.N, s.rel), mx = Math.max(a, Mo.risk(s.N, 2));
    lab(c, "孩子患病的概率（每一万个孩子）", 320, 30, 17, COL.grey);
    for (const [i, nm, v, col] of [[0, "没有亲缘关系", a, COL.green], [1, "所选关系", b, COL.red]] as [number, string, number, string][]) {
      const y = 70 + i * 100; lab(c, nm, 30, y + 20, 18, COL.ink, "left"); rect(c, 30, y + 40, 580, 30, "#f1f3f5", COL.ink, 2, 10); rect(c, 30, y + 40, Math.max(4, (580 * v) / mx), 30, col, COL.ink, 2, 10); lab(c, fmt(Mo.per10000(v), 2), 600, y + 20, 20, COL.ink, "right");
    }
    for (let i = 0; i < 2; i++) { const x = 120 + i * 80; circle(c, x, 330, 22, i ? "#ffd6e7" : "#d0ebff", COL.ink, 3); } line(c, 142, 330, 178, 330, COL.ink, 3);
    lab(c, "夫妻", 160, 378, 16, COL.grey); lab(c, `${fmt(Mo.fold(s.N, s.rel), 1)} ×`, 440, 340, 44, s.rel === 0 ? COL.green : COL.red);
  },
  tasks: [
    { id: "cousin", text: "选择表兄妹：双方带有同一致病基因的概率是无亲缘关系时的 5 倍以上", check: (s) => s.mode === 0 && s.rel === 1 && Mo.fold(s.N, 1) >= 5 },
    { id: "sibling", text: "选择同胞兄妹：双方带有同一致病基因的概率是无亲缘关系时的 20 倍以上", check: (s) => s.mode === 0 && s.rel === 2 && Mo.fold(s.N, 2) >= 20 },
    { id: "eugen", text: "把 8 条说明放进正确的优生措施", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
