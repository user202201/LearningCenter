import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-digest";
import { COL, lab, txt, circle, ell, rect, line, axes, curve } from "./draw";
export const meta = CATALOG.digest;
export const def: SimDef = {
  meta,
  lesson: [
    "食物中的淀粉、蛋白质、脂肪是大分子，要消化成小分子才能被吸收：淀粉 → 葡萄糖，蛋白质 → 氨基酸，脂肪 → 甘油和脂肪酸。消化酶的活性受温度和 pH 影响，有各自的最适温度和最适 pH。",
    "口腔消化淀粉，胃初步消化蛋白质，小肠是消化和吸收的主要场所（肠液、胰液和胆汁）。滴碘液检验：淀粉遇碘变蓝，蓝色消失说明淀粉已被水解。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "T", label: "水浴温度", min: 0, max: 80, step: 1, value: 25, unit: "°C", when: (s) => s.mode === 0 },
    { id: "pH", label: "pH", min: 1, max: 12, step: 0.5, value: 7, when: (s) => s.mode === 0 },
    { id: "min", label: "反应时间", min: 0, max: 10, step: 0.5, value: 0, unit: "分钟", when: (s) => s.mode === 0 },
    { id: "organ", label: "食物所在器官", min: 0, max: 4, step: 1, value: 0, when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "唾液淀粉酶"], [1, "消化道之旅"]] },
    { id: "food", label: "食物", value: 0, options: Mo.FOODS.map((f, i) => [i, f] as [number, string]), when: (s) => s.mode === 1 },
  ],
  play: { param: "min", rate: 1 },
  aspect: 0.6,
  readouts: (s) => s.mode === 0 ? [
    { label: "酶的相对活性", value: fmt(Mo.activity(s.T, s.pH) * 100, 0), unit: "%" },
    { label: "剩余淀粉", value: fmt(Mo.remaining(s.T, s.pH, s.min) * 100, 0), unit: "%" },
    { label: "滴加碘液", value: Mo.remaining(s.T, s.pH, s.min) > 0.25 ? "蓝色" : "蓝色消失（棕黄色）" }] : [
    { label: "器官", value: Mo.ORGANS[s.organ] },
    { label: "该器官的消化作用", value: Mo.ENZ[s.food][s.organ] },
    { label: "已消化的程度", value: fmt(Mo.PROGRESS[s.food][s.organ] * 100, 0), unit: "%" },
    { label: "最终产物", value: Mo.PROGRESS[s.food][s.organ] >= 1 ? Mo.FINAL[s.food] : "—" }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      rect(c, 30, 160, 130, 180, "#e7f5ff", COL.ink, 4, 14); line(c, 168, 60, 168, 250, COL.grey, 4);
      txt(c, `${fmt(s.T, 0)}°C`, 168, 40, 20, COL.red);
      const rem = Mo.remaining(s.T, s.pH, s.min), col = `rgb(${Math.round(40 + 160 * (1 - rem))},${Math.round(60 + 90 * (1 - rem))},${Math.round(190 - 130 * (1 - rem))})`;
      rect(c, 56, 100, 56, 150, col, COL.ink, 4, 10); txt(c, `pH ${fmt(s.pH, 1)}`, 84, 280, 18, COL.ink);
      const P = axes(c, 250, 40, 360, 120, 80, 1, "T (C)", "act", 0, 4); curve(c, P, (x) => Mo.actT(x) * Mo.actPH(s.pH), COL.red, 80, 100); circle(c, P.X(s.T), P.Y(Mo.activity(s.T, s.pH)), 7, COL.orange, COL.ink, 3);
      const Q = axes(c, 250, 215, 360, 120, 12, 1, "pH", "act", 0, 4); curve(c, Q, (x) => Mo.actT(s.T) * Mo.actPH(x), COL.blue, 12, 100); circle(c, Q.X(s.pH), Q.Y(Mo.activity(s.T, s.pH)), 7, COL.orange, COL.ink, 3);
    } else {
      const hl = (i: number) => (s.organ === i ? COL.orange : COL.ink);
      ell(c, 90, 46, 44, 30, "#ffc9c9", hl(0), s.organ === 0 ? 6 : 3); lab(c, "口腔", 90, 46, 17);
      line(c, 90, 76, 90, 130, hl(1), s.organ === 1 ? 9 : 5); lab(c, "食道", 138, 104, 15, COL.grey, "left");
      ell(c, 100, 168, 52, 36, "#ffd8a8", hl(2), s.organ === 2 ? 6 : 3, 0.3); lab(c, "胃", 100, 168, 17);
      c.beginPath(); c.moveTo(60, 230); for (let i = 0; i < 4; i++) { c.lineTo(150, 244 + i * 30); c.lineTo(60, 258 + i * 30); } c.strokeStyle = hl(3); c.lineWidth = s.organ === 3 ? 12 : 8; c.stroke(); lab(c, "小肠", 168, 276, 16, COL.grey, "left");
      rect(c, 20, 224, 28, 160, "", hl(4), s.organ === 4 ? 7 : 4, 8); lab(c, "大肠", 30, 395, 15, COL.grey, "left");
      const p = Mo.PROGRESS[s.food][s.organ];
      rect(c, 300, 90, 300, 30, "#f1f3f5", COL.grey, 2, 10); rect(c, 302, 92, 296 * p, 26, [COL.orange, COL.red, COL.purple][s.food], null, 0, 8);
      lab(c, Mo.FOODS[s.food], 300, 66, 20, COL.ink, "left");
      lab(c, Mo.ORGANS[s.organ], 300, 160, 22, COL.purple, "left");
    }
  },
  tasks: [
    { id: "opt", text: "找到最适条件（约 37 °C、pH 约 7）并反应 5 分钟以上，淀粉几乎全部水解", check: (s) => s.mode === 0 && Math.abs(s.T - 37) <= 1 && Math.abs(s.pH - 6.8) <= 0.5 && s.min >= 5 && Mo.remaining(s.T, s.pH, s.min) < 0.02 },
    { id: "hot", text: "把水浴温度升到 70 °C 以上：反应 5 分钟后仍几乎没有水解（酶已失活）", check: (s) => s.mode === 0 && s.T >= 70 && s.min >= 5 && Mo.remaining(s.T, s.pH, s.min) > 0.9 },
    { id: "acid", text: "把 pH 调到 2（相当于胃液），温度 37 °C：唾液淀粉酶的活性低于 5%", check: (s) => s.mode === 0 && s.pH <= 2 && Math.abs(s.T - 37) <= 1 && Mo.activity(s.T, s.pH) < 0.05 },
    { id: "fat", text: "让脂肪来到小肠：脂肪在这里被彻底消化", check: (s) => s.mode === 1 && s.food === 2 && s.organ === 3 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
