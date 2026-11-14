import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-animalgroups";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, para, type DMode } from "./match";
import { drawOrganism } from "./organisms";
import { COL, lab, rect } from "./draw";
export const meta = CATALOG.animalgroups;
export const MODES: (DMode | null)[] = [
  { kind: "bucket", prefix: "o", items: Mo.ORG_ITEMS.map((x) => x[0]), answers: Mo.ORG_ITEMS.map((x) => x[1]), buckets: Mo.GROUPS },
  { kind: "bucket", prefix: "f", items: Mo.FEATURE_ITEMS.map((x) => x[0]), answers: Mo.FEATURE_ITEMS.map((x) => x[1]), buckets: Mo.GROUPS }, null];
const PFX = ["o", "f"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
export const def: SimDef = {
  meta,
  lesson: [
    "无脊椎动物体内没有脊柱，主要类群有：腔肠动物（水螅、海蜇，辐射对称，有刺细胞）、扁形动物（涡虫、华枝睾吸虫，背腹扁平，有口无肛门）、线形动物（蛔虫，圆柱形，体表有角质层）、环节动物（蚯蚓，由许多体节组成）、软体动物（河蚌、蜗牛，柔软，有外套膜和贝壳）和节肢动物（蝗虫、虾、蜘蛛，有外骨骼，身体和附肢分节）。",
    "脊椎动物体内有脊柱，分为鱼类、两栖动物、爬行动物、鸟类和哺乳动物。把动物或特征拖到所属的类群中（也可以先点再点类群）；在“脊椎动物”中比较五个类群的体表、呼吸器官、体温和生殖方式。",
  ],
  links: [{ text: "相关：生物的分类", href: "#/science/bio/classify" }, { text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "动物所属的类群"], [1, "类群的特征"], [2, "脊椎动物的五类"]] },
    { id: "grp", label: "脊椎动物的类群", value: 0, options: Mo.VERTS.map((x, i) => [i, x] as [number, string]), when: (s) => s.mode === 2 },
  ],
  hidden: dndFlags(PFX),
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => s.mode < 2 ? dndReadouts(s, modeOf(s)!) : Mo.VFEATS.map((f, i) => ({ label: f, value: Mo.VERT_TABLE[s.grp][i] })),
  draw(c, w, h, s) {
    if (s.mode < 2) { drawDnd(c, s, modeOf(s)!); return; }
    Mo.VERTS.forEach((nm, i) => { const on = i === s.grp, x = 20 + 120 * i; rect(c, x, 40, 112, 120, on ? "#fff3bf" : "#f8f9fa", on ? COL.orange : COL.grey, on ? 4 : 2, 14); drawOrganism(c, Mo.VERT_ORG[i], x + 56, 90, 70); lab(c, nm, x + 56, 144, 15, on ? COL.orange : COL.ink); });
    Mo.VFEATS.forEach((f, i) => { const y = 190 + 62 * i; rect(c, 30, y, 580, 52, "#fff", COL.grey, 2, 12); lab(c, f, 50, y + 26, 18, COL.purple, "left"); para(c, Mo.VERT_TABLE[s.grp][i], 410, y + 26, 340, 18, COL.ink); });
  },
  tasks: [
    { id: "org", text: "把 8 种动物放进它们所属的无脊椎动物类群", check: (s) => s.mode === 0 && allPlaced(s, MODES[0]!) },
    { id: "feat", text: "把 8 条特征放进对应的类群", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
    { id: "bird", text: "在脊椎动物中找出体温恒定、体表有羽毛的类群（鸟类）", check: (s) => s.mode === 2 && s.grp === 3 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
