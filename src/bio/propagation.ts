import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-propagation";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, type DMode } from "./match";
import { COL, lab, rect, circle, ell, poly, line } from "./draw";
export const meta = CATALOG.propagation;
export const MODES: (DMode | null)[] = [null,
  { kind: "bucket", prefix: "m", items: Mo.METHOD_ITEMS.map((x) => x[0]), answers: Mo.METHOD_ITEMS.map((x) => x[1]), buckets: Mo.METHODS },
  { kind: "bucket", prefix: "k", items: Mo.COMPARE.map((x) => x[0]), answers: Mo.COMPARE.map((x) => x[1]), buckets: Mo.KINDS }];
const PFX = ["m", "k"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
const FRUIT = ["#e03131", "#ffe066", "#ff8787"];
export const def: SimDef = {
  meta,
  lesson: [
    "没有经过两性生殖细胞的结合，由母体的一部分直接产生新个体的生殖方式叫无性生殖。植物常见的无性繁殖方法有扦插、嫁接、压条和组织培养。后代只具有母体的遗传特性，能保持优良性状，繁殖速度较快；而有性生殖的后代具有双亲的遗传特性，变异较多，适应环境变化的能力较强。",
    "嫁接是把一种植物的枝条或芽（接穗）接到另一种植物的茎（砧木）上，使它们愈合成一个完整的植株。嫁接成活的关键是接穗和砧木的形成层紧密结合，而且两者亲缘关系要近；接穗上结出的果实保持接穗的性状，根系则是砧木的。（形成层对齐 70 % 以上才能成活，是教学模型的设定。）",
  ],
  links: [{ text: "相关：花与果实", href: "#/science/bio/flower" }, { text: "相关：动物的生殖和发育", href: "#/science/bio/lifecycle" }],
  params: [{ id: "align", label: "形成层对齐的程度", min: 0, max: 100, step: 10, value: 40, unit: "%", when: (s) => s.mode === 0 }],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "嫁接"], [1, "无性繁殖的方法"], [2, "有性生殖与无性生殖"]] },
    { id: "scion", label: "接穗（上面的枝条）", value: 0, options: Mo.SCIONS.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 0 },
    { id: "stock", label: "砧木（下面的植株）", value: 0, options: Mo.STOCKS.map((x, i) => [i, x[2]] as [number, string]), when: (s) => s.mode === 0 },
  ],
  hidden: dndFlags(PFX),
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => {
    if (s.mode > 0) return dndReadouts(s, modeOf(s)!);
    const r = Mo.graftResult(s.scion, s.stock, s.align), ok = r === 0;
    return [{ label: "接穗", value: Mo.SCIONS[s.scion][0] }, { label: "砧木", value: Mo.STOCKS[s.stock][2] }, { label: "亲缘关系", value: Mo.compatible(s.scion, s.stock) ? "近（亲和）" : "远（不亲和）" },
      { label: "形成层对齐", value: fmt(s.align, 0), unit: "%" }, { label: "结果", value: Mo.GRAFT_TEXT[r] }, { label: "接穗上结出的果实", value: ok ? Mo.SCIONS[s.scion][1] : "—" }];
  },
  draw(c, w, h, s) {
    if (s.mode > 0) { drawDnd(c, s, modeOf(s)!); return; }
    const ok = Mo.takes(s.scion, s.stock, s.align), off = ((100 - s.align) / 100) * 26;
    rect(c, 20, 380, 600, 60, "#d9a066", COL.ink, 3, 10); lab(c, "土壤", 580, 410, 16, COL.ink);
    rect(c, 180, 230, 40, 150, "#a9815a", COL.ink, 4, 8); line(c, 200, 380, 140, 430, "#8d6e63", 6); line(c, 200, 380, 260, 430, "#8d6e63", 6); line(c, 200, 380, 200, 438, "#8d6e63", 6);
    lab(c, "砧木", 120, 300, 17, COL.grey); lab(c, "根系属于砧木", 200, 462, 16, COL.grey);
    c.save(); c.translate(off, 0); poly(c, [[186, 230], [214, 230], [236, 120], [210, 110]], "#51cf66", COL.ink, 4); c.restore();
    line(c, 170, 230, 230, 230, ok ? COL.green : COL.red, 3, [6, 5]);
    lab(c, "形成层", 120, 232, 15, COL.orange);
    for (const [fx, fy] of [[258, 126], [190, 96], [270, 170]]) { circle(c, fx + (ok ? 0 : 0), fy, 15, ok ? FRUIT[Mo.SCIONS[s.scion][2]] : "#dee2e6", COL.ink, 3); ell(c, fx + 4, fy - 17, 8, 4, "#37b24d", COL.ink, 2, 0.4); }
    lab(c, ok ? "成活" : "不成活", 420, 130, 34, ok ? COL.green : COL.red);
    lab(c, "接穗", 300, 100, 17, COL.grey);
    lab(c, ok ? `果实：${Mo.SCIONS[s.scion][1]}` : "—", 420, 190, 20, COL.ink);
  },
  tasks: [
    { id: "graft", text: "把红富士苹果接到野生山荆子上，并使它成活", check: (s) => s.mode === 0 && s.scion === 0 && s.stock === 0 && Mo.takes(0, 0, s.align) },
    { id: "mismatch", text: "把红富士苹果接到杜梨上：即使形成层对齐，也不成活", check: (s) => s.mode === 0 && s.scion === 0 && s.stock === 1 && s.align === 100 && !Mo.takes(0, 1, 100) },
    { id: "methods", text: "把 6 种做法放进正确的无性繁殖方法", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
    { id: "compare", text: "把 8 条描述放进有性生殖或无性生殖", check: (s) => s.mode === 2 && allPlaced(s, MODES[2]!) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
