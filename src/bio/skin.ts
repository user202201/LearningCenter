import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-skin";
import { COL, lab, txt, circle, rect, arrow } from "./draw";
export const meta = CATALOG.skin;
export const def: SimDef = {
  meta,
  lesson: [
    "皮肤由表皮、真皮和皮下组织构成，具有保护、排泄（汗液）、调节体温和感受外界刺激的功能。人体产热与散热保持平衡，体温维持在约 37 °C：热的时候皮肤血管舒张、汗腺分泌汗液，汗液蒸发带走热量；冷的时候皮肤血管收缩、减少散热，必要时战栗产热。",
    "模型：产热取决于活动，皮肤散热 = 8 ×（1 − 0.1 × 衣服层数）×（34 − 气温）W，汗液蒸发每毫升带走 2.43 kJ。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "ta", label: "气温", min: 0, max: 45, step: 1, value: 22, unit: "°C" },
    { id: "cl", label: "衣服层数", min: 0, max: 5, step: 1, value: 2 },
  ],
  choices: [{ id: "a", label: "活动", value: 0, options: Mo.ACTIVITY.map((x, i) => [i, x[0]] as [number, string]) }],
  aspect: 0.55,
  readouts: (s) => { const M = Mo.ACTIVITY[s.a][1]; return [
    { label: "产热", value: String(M), unit: "W" }, { label: "皮肤散热", value: fmt(Mo.dryLoss(s.ta, s.cl), 0), unit: "W" }, { label: "需要排汗", value: fmt(Mo.sweat(M, s.ta, s.cl), 0), unit: "mL/h" }, { label: "身体的反应", value: Mo.state(M, s.ta, s.cl) }]; },
  draw(c, w, h, s) {
    const M = Mo.ACTIVITY[s.a][1], d = Mo.dryLoss(s.ta, s.cl), sw = Mo.sweat(M, s.ta, s.cl), st = Mo.state(M, s.ta, s.cl);
    rect(c, 40, 40, 200, 280, "#ffe3d0", COL.ink, 4, 24); rect(c, 40, 40, 200, 40, "#ffc9a0", null, 0, 24); lab(c, "表皮", 140, 60, 16, COL.grey); lab(c, "真皮", 140, 130, 16, COL.grey); lab(c, "皮下组织", 140, 270, 16, COL.grey);
    for (let i = 0; i < Math.min(8, Math.round(sw / 60)); i++) circle(c, 70 + i * 22, 36 - (i % 2) * 8, 5, "#74c0fc", COL.ink, 2);
    rect(c, 90, 150, 100, 20 + (sw > 0 ? 14 : st.startsWith("战栗") ? -10 : 0), COL.red, null, 0, 8);
    arrow(c, 260, 180, 260 + Math.max(10, Math.min(120, d / 4)), 180, COL.orange, 5); txt(c, `${fmt(d, 0)} W`, 330, 150, 20, COL.orange, "left"); lab(c, st, 280, 250, 20, COL.purple, "left");
  },
  tasks: [
    { id: "run", text: "在 30 °C 的气温下跑步：每小时需要排汗 300 mL 以上", check: (s) => s.a === 2 && s.ta >= 30 && Mo.sweat(600, s.ta, s.cl) > 300 },
    { id: "cold", text: "静坐在 0 °C 的环境里，只穿 1 层衣服以下：身体开始战栗", check: (s) => s.a === 0 && s.ta <= 0 && s.cl <= 1 && Mo.state(80, s.ta, s.cl).startsWith("战栗") },
    { id: "ok", text: "静坐在 20–24 °C 的气温下（穿 2–3 层衣服）：体温平衡，不需要排汗", check: (s) => s.a === 0 && s.ta >= 20 && s.ta <= 24 && s.cl >= 2 && s.cl <= 3 && Mo.sweat(80, s.ta, s.cl) === 0 && !Mo.state(80, s.ta, s.cl).startsWith("战栗") },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
