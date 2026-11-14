import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-impact";
import { COL, lab, txt, circle, axes, curve, rect } from "./draw";
export const meta = CATALOG.impact;
export const def: SimDef = {
  meta,
  lesson: [
    "生物多样性包括物种多样性、遗传多样性和生态系统多样性。威胁生物多样性的主要原因：栖息地的破坏和丧失、过度利用、外来物种入侵、环境污染和气候变化。保护措施：就地保护（建立自然保护区，最有效）、迁地保护（动物园、植物园）、建立濒危物种的基因库、加强法制管理和宣传教育。",
    "人类活动改变环境：燃烧化石燃料排放二氧化碳，使大气中的温室气体增多，全球变暖；砍伐森林使栖息地缩小，物种减少。保护环境要从节约资源、减少污染、植树造林做起。模型为简化的教学模型。",
  ],
  formulas: ["S = c\\, A^{0.25}"],
  links: [{ text: "相关：知识总结（生物 · 地理）", href: "#/science/notes" }],
  params: [
    { id: "lost", label: "被破坏的栖息地", min: 0, max: 95, step: 5, value: 0, unit: "%", when: (s) => s.mode === 0 },
    { id: "emit", label: "每年排放的碳", min: 0, max: 12, step: 1, value: 9, unit: "GtC", when: (s) => s.mode === 1 },
    { id: "years", label: "经过的年数", min: 0, max: 100, step: 5, value: 0, unit: "年", when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "栖息地与物种"], [1, "二氧化碳与气温"]] }],
  play: { param: "years", rate: 20 },
  aspect: 0.6,
  readouts: (s) => s.mode === 0 ? [
    { label: "剩下的物种", value: fmt(Mo.speciesLeft(s.lost / 100) * 100, 0), unit: "%" }, { label: "消失的物种", value: fmt(100 - Mo.speciesLeft(s.lost / 100) * 100, 0), unit: "%" }, { label: "保留的栖息地", value: String(100 - s.lost), unit: "%" }] : [
    { label: "大气 CO₂", value: fmt(Mo.co2(s.emit, s.years), 0), unit: "ppm" }, { label: "比工业化前升高", value: fmt(Mo.warming(Mo.co2(s.emit, s.years)), 2), unit: "°C" }, { label: "累计排放的碳", value: String(s.emit * s.years), unit: "GtC" }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const P = axes(c, 60, 40, 540, 290, 100, 100, "lost %", "species %", 0, 5); curve(c, P, (x) => Mo.speciesLeft(x / 100) * 100, COL.green, 100, 100); circle(c, P.X(s.lost), P.Y(Mo.speciesLeft(s.lost / 100) * 100), 8, COL.red, COL.ink, 3);
    } else {
      const P = axes(c, 60, 40, 540, 290, 100, 1000, "year", "ppm", 300, 5); curve(c, P, (x) => Mo.co2(s.emit, x), COL.red, 100, 100); circle(c, P.X(s.years), P.Y(Mo.co2(s.emit, s.years)), 8, COL.orange, COL.ink, 3);
      rect(c, 70, 330, 520, 0.1, "", null, 0, 0); txt(c, "", 0, 0, 1, COL.ink); lab(c, "二氧化碳浓度", 66, 24, 16, COL.grey, "left");
    }
  },
  tasks: [
    { id: "habitat", text: "栖息地被破坏 90 % 以上：物种减少到原来的 60 % 以下", check: (s) => s.mode === 0 && s.lost >= 90 && Mo.speciesLeft(s.lost / 100) < 0.6 },
    { id: "emit", text: "每年排放 9 GtC 以上，经过 100 年：CO₂ 超过 600 ppm", check: (s) => s.mode === 1 && s.emit >= 9 && s.years >= 100 && Mo.co2(s.emit, s.years) > 600 },
    { id: "cut", text: "把排放减到 0：无论经过多少年，CO₂ 都保持 420 ppm", check: (s) => s.mode === 1 && s.emit === 0 && s.years >= 50 && Mo.co2(0, s.years) === 420 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
