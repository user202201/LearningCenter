import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-flower";
import { COL, lab, txt, circle, ell, rect, line } from "./draw";
export const meta = CATALOG.flower;
const OVP: [number, number][] = [[228, 292], [252, 292], [228, 314], [252, 314], [228, 336], [252, 336]];
export const def: SimDef = {
  meta,
  lesson: [
    "一朵花的主要结构是雄蕊（花药和花丝）和雌蕊（柱头、花柱、子房）。花药里的花粉落到柱头上叫传粉（可借助风或昆虫）；花粉萌发出花粉管，精子与胚珠里的卵细胞结合形成受精卵，叫受精。",
    "受精后，花瓣、雄蕊等凋落，子房发育成果实，子房壁发育成果皮，胚珠发育成种子，珠被发育成种皮，受精卵发育成胚。没有传粉就不会结果；落在柱头上的花粉少于胚珠数，就会缺粒。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "stage", label: "发育阶段", min: 0, max: 5, step: 1, value: 0 },
    { id: "ov", label: "子房中的胚珠数", min: 1, max: 6, step: 1, value: 3 },
    { id: "pollen", label: "落到柱头上的花粉数", min: 0, max: 8, step: 1, value: 5 },
  ],
  choices: [{ id: "pol", label: "传粉", value: 1, options: [[1, "已传粉"], [0, "未传粉"]] }, { id: "agent", label: "传粉方式", value: 0, options: [[0, "昆虫传粉"], [1, "风力传粉"]] }],
  play: { param: "stage", rate: 0.6 },
  aspect: 0.62,
  readouts: (s) => [
    { label: "阶段", value: Mo.STAGES[s.stage] },
    { label: "受精的胚珠", value: `${Mo.fertilised(s.ov, s.pollen, s.pol)} / ${s.ov}` },
    { label: "种子数", value: s.stage >= 5 ? String(Mo.seeds(s.ov, s.pollen, s.pol)) : "—", unit: s.stage >= 5 ? "粒" : "" },
    { label: "果实", value: s.stage >= 4 ? (Mo.fruitForms(s.ov, s.pollen, s.pol) ? "形成" : "不形成（花凋落）") : "—" }],
  draw(c, w, h, s) {
    const st = s.stage, fert = Mo.fertilised(s.ov, s.pollen, s.pol), x = 240, wither = st >= 4;
    const fruit = st >= 5 && fert >= 1;
    rect(c, 232, 340, 16, 70, COL.leaf2, null, 0, 4);
    ell(c, 205, 345, 40, 12, COL.leaf, COL.leaf2, 3, -0.3); ell(c, 275, 345, 40, 12, COL.leaf, COL.leaf2, 3, 0.3);
    const pc = wither ? "#ced4da" : "#fcc2d7";
    ell(c, 165, 238, wither ? 26 : 34, wither ? 56 : 82, pc, COL.ink, 3, 0.35); ell(c, 315, 238, wither ? 26 : 34, wither ? 56 : 82, pc, COL.ink, 3, -0.35);
    for (const fx of [196, 284]) { line(c, fx, 305, fx, wither ? 225 : 195, wither ? "#adb5bd" : "#f08c00", 4); ell(c, fx, wither ? 220 : 190, 12, 8, wither ? "#adb5bd" : "#ffd43b", COL.ink, 3); }
    if (!wither && st <= 1) for (const fx of [196, 284]) for (let k = 0; k < 4; k++) circle(c, fx - 6 + k * 4, 188 + (k % 2) * 5, 2.4, "#ffd43b", "#e8a900", 1);
    // the pistil
    line(c, x, 296, x, 198, "#82c91e", 9);
    const sc = fruit ? 1.55 : st === 4 && fert >= 1 ? 1.2 : 1;
    ell(c, x, 314, 36 * sc, 40 * sc, fruit ? "#ffa94d" : "#b2f2bb", COL.ink, 3);
    ell(c, x, 192, 17, 8, wither ? "#adb5bd" : "#e64980", COL.ink, 3);
    OVP.slice(0, s.ov).forEach(([ox, oy], i) => {
      const f = i < fert && st >= 3, seed = fruit && i < fert, gone = fruit && i >= fert;
      if (gone) return;
      ell(c, x + (ox - x) * Math.min(sc, 1.25), 314 + (oy - 314) * Math.min(sc, 1.25), seed ? 8 : 6, seed ? 11 : 8, seed ? "#8d6e63" : f ? "#f783ac" : "#fff9db", COL.ink, 2);
    });
    // pollen and tubes
    if (st >= 1 && s.pol) for (let k = 0; k < s.pollen; k++) if (st < 4) circle(c, x - 14 + (k % 4) * 9, 184 - Math.floor(k / 4) * 8, 3, "#ffd43b", "#e8a900", 1);
    if (st >= 2 && st < 4 && s.pol) for (let i = 0; i < fert; i++) { const [ox, oy] = OVP[i]; line(c, x - 4 + (i % 3) * 4, 194, x + (ox - x) * 0.9, oy - 10, "#e8590c", 2); }
    if (st === 1 && s.pol) { if (s.agent === 0) { ell(c, x + 88, 120, 14, 9, "#ffd43b", COL.ink, 3); line(c, x + 78, 115, x + 98, 125, COL.ink, 3); ell(c, x + 84, 108, 9, 5, "#e7f5ff", COL.grey, 2, -0.5); } else { for (const k of [0, 1, 2]) line(c, x - 170, 130 + k * 14, x - 100, 130 + k * 14 - 6, "#74c0fc", 3); } }
    if (!s.pol && st >= 1 && st < 4) lab(c, "没有花粉落到柱头上", x, 126, 17, COL.red);
    if (st >= 4 && !fruit) lab(c, wither && !fert ? "没有受精：不结果" : "子房膨大", x, 440, 17, COL.red);
    if (st === 0) { for (const [t, tx, ty, lx, ly] of [["花瓣", 90, 150, 140, 200], ["花药", 90, 100, 190, 188], ["柱头", 400, 100, 258, 192], ["花柱", 400, 170, 246, 240], ["子房", 400, 240, 270, 300], ["胚珠", 400, 310, 256, 312]] as [string, number, number, number, number][]) { line(c, tx + (tx < 240 ? 36 : -36), ty, lx, ly, COL.grey, 2); lab(c, t, tx, ty, 19, COL.purple); } }
    lab(c, Mo.STAGES[st], 620, 24, 19, COL.purple, "right");
  },
  tasks: [
    { id: "full", text: "胚珠数不少于 4，花粉数不少于胚珠数，发育到果实阶段：每个胚珠都发育成种子", check: (s) => s.ov >= 4 && s.pollen >= s.ov && s.pol === 1 && s.stage === 5 },
    { id: "none", text: "把传粉设为“未传粉”，发育到果实阶段：不结果", check: (s) => s.pol === 0 && s.stage === 5 },
    { id: "partial", text: "花粉数少于胚珠数（至少 1 粒），发育到果实阶段：种子数少于胚珠数", check: (s) => s.pol === 1 && s.pollen >= 1 && s.pollen < s.ov && s.stage === 5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
