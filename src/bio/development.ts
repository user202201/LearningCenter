import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-development";
import { COL, lab, txt, circle, ell, axes, curve } from "./draw";
export const meta = CATALOG.development;
export const def: SimDef = {
  meta,
  lesson: [
    "人的生命从受精卵开始：精子与卵细胞在输卵管内结合形成受精卵，受精卵分裂形成胚泡，移动到子宫内壁着床；约 8 周后称为胎儿。胎儿通过胎盘和脐带从母体获得营养物质和氧气，并排出废物。怀孕约 40 周（280 天，孕周从末次月经算起），胎儿从母体产出，叫分娩。图表中 12 周以前的身长是头臀长，之后是身长（头到脚跟）。",
    "青春期是身体发育的重要时期：身高和体重迅速增加，神经系统、心脏和肺等器官的功能明显增强，出现第二性征，性器官迅速发育。身高突增是青春期最明显的特点：女孩一般约从 9～10 岁开始，男孩约从 11～12 岁开始，男孩比女孩晚约两年，每年可长高 6～8 厘米。图中的身高是按各年龄的平均值画出的示意曲线，每个人的情况不同。要保持健康的心态，正确对待身体和心理的变化，合理营养、规律作息。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "week", label: "怀孕的周数", min: 0, max: 40, step: 1, value: 0, unit: "周", when: (s) => s.mode === 0 },
    { id: "age", label: "年龄", min: 0, max: 18, step: 0.5, value: 6, unit: "岁", when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "从受精卵到出生"], [1, "青春期的生长"]] }, { id: "sex", label: "性别", value: 0, options: [[0, "女孩"], [1, "男孩"]], when: (s) => s.mode === 1 }],
  play: { param: "week", rate: 6 },
  aspect: 0.6,
  readouts: (s) => s.mode === 0 ? [
    { label: "阶段", value: Mo.phase(s.week) }, { label: "身长", value: fmt(Mo.lengthAt(s.week), 0), unit: "mm" }, { label: "质量", value: fmt(Mo.massAt(s.week), 0), unit: "g" }] : [
    { label: "身高", value: fmt(Mo.height(s.age, s.sex), 0), unit: "cm" }, { label: "每年长高", value: fmt(Mo.velocity(s.age, s.sex), 1), unit: "cm" }, { label: "是否处于突增期", value: Mo.inSpurt(s.age, s.sex) ? "是" : "否" }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const r = 8 + Math.cbrt(Mo.massAt(s.week)) * 9;
      ell(c, 170, 200, 130, 150, "#fff0f6", COL.ink, 4); ell(c, 170, 200, 100, 120, "#d0ebff", "#74c0fc", 3);
      ell(c, 170, 200, Math.max(4, r * 0.6), r, s.week < 8 ? "#ffa8a8" : "#ffd8a8", COL.ink, 3);
      if (s.week >= 8) { c.beginPath(); c.moveTo(170, 200 + r); c.quadraticCurveTo(230, 270, 250, 280); c.strokeStyle = COL.red; c.lineWidth = 4; c.stroke(); lab(c, "脐带", 262, 282, 16, COL.red, "left"); }
      lab(c, "子宫", 170, 60, 18, COL.grey); lab(c, Mo.phase(s.week), 20, 24, 20, COL.purple, "left");
      const P = axes(c, 350, 50, 260, 240, 40, 3500, "wk", "g", 0, 4); curve(c, P, (x) => Mo.massAt(x), COL.red, 40, 80); circle(c, P.X(s.week), P.Y(Mo.massAt(s.week)), 8, COL.orange, COL.ink, 3);
    } else {
      const P = axes(c, 60, 40, 540, 290, 18, 190, "age", "cm", 40, 5); curve(c, P, (x) => Mo.height(x, s.sex), COL.blue, 18, 60);
      const P2 = (x: number) => Mo.height(x, 1 - s.sex); c.setLineDash([6, 6]); curve(c, P, P2, COL.grey, 18, 60, 2); c.setLineDash([]);
      circle(c, P.X(s.age), P.Y(Mo.height(s.age, s.sex)), 8, COL.red, COL.ink, 3); txt(c, "", 0, 0, 1, COL.ink);
    }
  },
  tasks: [
    { id: "birth", text: "怀孕满 40 周：胎儿的质量达到 3000 g 以上", check: (s) => s.mode === 0 && Mo.massAt(s.week) >= 3000 },
    { id: "fetus", text: "找到胚胎发育为胎儿的时间（怀孕第 8 周）", check: (s) => s.mode === 0 && s.week === 8 },
    { id: "spurt", text: "选择女孩，找到身高突增最快的年龄（约 11 岁）", check: (s) => s.mode === 1 && s.sex === 0 && Math.abs(s.age - 11) <= 0.5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
