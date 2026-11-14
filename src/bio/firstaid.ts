import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-firstaid";
import { dndInit, dndPointer, placedCount, type DndSpec } from "./dnd";
import { COL, lab, txt, circle, rect, line } from "./draw";
export const meta = CATALOG.firstaid;
const slot = (i: number): [number, number] => [[80, 320, 560, 200, 440][i] ?? 80, [260, 330, 260, 330, 300][i] ?? 260];
const ox = (j: number) => 60 + j * 130;
export const spec: DndSpec = { n: 5, prefix: "ba", hit: [100, 26], at: (i) => [320, 150 + 0 * i], answer: (i) => i, targets: () => [] };
const SLOTS: [number, number][] = [320, 320, 320, 320, 320].map((x, i) => [x, 60 + i * 56] as [number, number]);
const ITEM_AT = (i: number, s: Record<string, number>): [number, number] => [200 + (((i * 3 + (s.seed ?? 0)) % 5) * 0) + 440, 60 + (((i * 2 + 1) % 5)) * 56];
export const burnSpec: DndSpec = { n: 5, prefix: "ba", hit: [110, 24], at: (i, s) => ITEM_AT(i, s), answer: (i) => i, targets: () => SLOTS.map(([x, y]) => ({ x: x - 100, y, hw: 100, hh: 24 })) };
void spec; void slot; void ox;
export const def: SimDef = {
  meta,
  lesson: [
    "心肺复苏（CPR）：发现无反应、无呼吸的人，先呼救并拨打 120，让人取来自动体外除颤器（AED）；成人按压部位在胸骨下半部，深度约 5–6 cm，频率每分钟 100–120 次，按压 30 次、吹气 2 次为一个循环。",
    "安全用药：服药前阅读说明书，按剂量（常按体重计算）和时间服用，不随意加量，有疑问时咨询医生或药师；本页的“示例药”和它的最大日剂量是为计算练习假设的，每种药的限量都不同，不能当作真实用药的依据；过期的药不能吃；非处方药（OTC）也要谨慎；药物有副作用。烧烫伤的处理：冲、脱、泡、盖、送。",
  ],
  links: [{ text: "相关：知识总结（安全 · 急救）", href: "#/science/notes" }],
  params: [
    { id: "rate", label: "按压频率", min: 60, max: 160, step: 5, value: 80, unit: "次/分钟", when: (s) => s.mode === 0 },
    { id: "depth", label: "按压深度", min: 2, max: 8, step: 0.5, value: 3, unit: "cm", dec: 1, when: (s) => s.mode === 0 },
    { id: "kg", label: "体重", min: 15, max: 60, step: 5, value: 30, unit: "kg", when: (s) => s.mode === 1 },
    { id: "mgkg", label: "每次每千克体重的剂量", min: 2.5, max: 15, step: 2.5, value: 5, unit: "mg", dec: 1, when: (s) => s.mode === 1 },
    { id: "times", label: "一天服药次数", min: 1, max: 6, step: 1, value: 3, unit: "次", when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "心肺复苏"], [1, "安全用药"], [2, "烧烫伤的处理"]] }],
  hidden: { ...dndInit(5, "ba") },
  drag: true,
  aspect: 0.6,
  pointer: (kind, x, y, s) => (s.mode === 2 ? dndPointer(burnSpec)(kind, x, y, s) : undefined),
  derive: (s, ch) => { if (ch === "mode") { s.h = -1; s.sel = -1; } },
  readouts: (s) => s.mode === 0 ? [
    { label: "评价", value: Mo.cprText(s.rate, s.depth) }, { label: "2 分钟的按压次数", value: String(Mo.compressions(s.rate, 2)), unit: "次" }, { label: "按压深度", value: fmt(s.depth, 1), unit: "cm" }] : s.mode === 1 ? [
    { label: "每次的剂量", value: fmt(Mo.dose(s.kg, s.mgkg), 1), unit: "mg" }, { label: "一天的总量", value: fmt(Mo.daily(s.kg, s.mgkg, s.times), 1), unit: "mg" }, { label: "示例药的最大日剂量（假设值）", value: fmt(s.kg * Mo.MAX_MGKG, 0), unit: "mg" },
    { label: "与示例值比较", value: Mo.safeDaily(s.kg, s.mgkg, s.times, Mo.MAX_MGKG) ? "未超过示例值" : "超过示例值" }, { label: "真实用药", value: "按说明书，或咨询医生、药师" }] : [
    { label: "已放对", value: `${placedCount(s, 5, "ba")} / 5` }, { label: "失误", value: String(s.miss), unit: "次" }, { label: "步骤数", value: "5" }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const ok = Mo.effectiveCpr(s.rate, s.depth);
      rect(c, 60, 200, 300, 60, "#ffd8a8", COL.ink, 4, 20); rect(c, 110 - 0, 150 + s.depth * 6, 60, 40, "#74c0fc", COL.ink, 4, 10); lab(c, "胸部", 90, 280, 16, COL.grey, "left");
      line(c, 140, 60, 140, 150 + s.depth * 6, COL.red, 6);
      for (let i = 0; i < 8; i++) circle(c, 420 + (i % 4) * 50, 120 + Math.floor(i / 4) * 40, 12, ok ? COL.green : COL.orange, COL.ink, 3);
      lab(c, Mo.cprText(s.rate, s.depth), 480, 250, 30, ok ? COL.green : COL.red); txt(c, "30 : 2", 480, 320, 28, COL.purple);
    } else if (s.mode === 1) {
      const safe = Mo.safeDaily(s.kg, s.mgkg, s.times, Mo.MAX_MGKG), mx = s.kg * Mo.MAX_MGKG * 1.6;
      rect(c, 60, 140, 520, 40, "#f1f3f5", COL.grey, 2, 12); rect(c, 62, 142, Math.min(516, (Mo.daily(s.kg, s.mgkg, s.times) / mx) * 516), 36, safe ? COL.blue : COL.red, null, 0, 10);
      line(c, 60 + (s.kg * Mo.MAX_MGKG / mx) * 520, 120, 60 + (s.kg * Mo.MAX_MGKG / mx) * 520, 200, COL.ink, 4); lab(c, safe ? "未超过示例值" : "超过示例值", 320, 240, 26, safe ? COL.ink : COL.red); lab(c, "示例药：真实用药按说明书或咨询医生、药师", 320, 290, 16, COL.grey);
    } else {
      SLOTS.forEach(([x, y], i) => { rect(c, x - 200, y - 24, 200, 48, s[`ba${i}`] ? "#d3f9d8" : "#f8f9fa", COL.grey, 2, 10); txt(c, String(i + 1), x - 216, y, 18, COL.grey); if (s[`ba${i}`]) lab(c, Mo.BURN[i], x - 100, y, 14, "#1b7a32"); });
      for (let i = 0; i < 5; i++) { if (s[`ba${i}`] || s.h === i) continue; const [x, y] = ITEM_AT(i, s); rect(c, x - 110, y - 24, 220, 48, s.sel === i ? "#fff3bf" : "#fff", s.sel === i ? COL.orange : COL.nucleus, 3, 12); lab(c, Mo.BURN[i], x, y, 14); }
      if (s.h >= 0) { rect(c, s.hx - 110, s.hy - 24, 220, 48, "#ffe8cc", COL.orange, 4, 12); lab(c, Mo.BURN[s.h], s.hx, s.hy, 14); }
    }
  },
  tasks: [
    { id: "cpr", text: "调到有效的心肺复苏：每分钟 100–120 次，深度 5–6 cm", check: (s) => s.mode === 0 && Mo.effectiveCpr(s.rate, s.depth) },
    { id: "overdose", text: "找到一天总量超过示例最大日剂量的情况（真实用药必须按说明书，或咨询医生、药师）", check: (s) => s.mode === 1 && !Mo.safeDaily(s.kg, s.mgkg, s.times, Mo.MAX_MGKG) },
    { id: "burn", text: "把烧烫伤处理的五个步骤按“冲、脱、泡、盖、送”的顺序放好", check: (s) => s.mode === 2 && placedCount(s, 5, "ba") === 5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
