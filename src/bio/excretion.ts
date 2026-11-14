import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-excretion";
import { COL, lab, txt, circle, ell, rect, line, arrow } from "./draw";
export const meta = CATALOG.excretion;
export const def: SimDef = {
  meta,
  lesson: [
    "人体排出废物的途径：呼吸（二氧化碳和少量水）、排汗（水、无机盐和尿素）、排尿（水、无机盐、尿素）。排尿是最主要的途径。泌尿系统由肾脏、输尿管、膀胱和尿道组成，肾脏是形成尿液的器官。",
    "每个肾单位由肾小球、肾小囊和肾小管组成。血液流经肾小球时，除血细胞和大分子蛋白质外，水、无机盐、葡萄糖、尿素等滤过到肾小囊中形成原尿；原尿流经肾小管时，全部葡萄糖、大部分水和部分无机盐被重吸收，剩下的形成尿液。一天形成原尿约 180 L，排出尿约 1.5 L。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "water", label: "一天喝水", min: 0.5, max: 4, step: 0.25, value: 2, unit: "L", dec: 2 },
    { id: "sweat", label: "一天出汗", min: 0, max: 3, step: 0.1, value: 0.5, unit: "L", dec: 1 },
    { id: "glu", label: "血糖浓度", min: 3, max: 20, step: 1, value: 5, unit: "mmol/L" },
  ],
  aspect: 0.6,
  readouts: (s) => { const u = Mo.urine(s.water, s.sweat); return [
    { label: "一天形成的原尿", value: fmt(Mo.filtered(), 0), unit: "L" }, { label: "一天的尿量", value: fmt(u, 2), unit: "L" },
    { label: "肾小管重吸收的水", value: fmt(Mo.reabsorbed(u) * 100, 1), unit: "%" }, { label: "尿中的尿素是血浆的", value: fmt(Mo.ureaFactor(u), 0), unit: "倍" },
    { label: "尿中是否有葡萄糖", value: Mo.glucoseInUrine(s.glu) > 0 ? "有（超过重吸收限度）" : "没有" }]; },
  draw(c, w, h, s) {
    const u = Mo.urine(s.water, s.sweat);
    circle(c, 110, 130, 46, "#ffa8a8", COL.ink, 4); lab(c, "肾小球", 110, 130, 17); ell(c, 110, 130, 70, 70, "", COL.ink, 3);
    lab(c, "肾小囊", 110, 222, 16, COL.grey);
    c.beginPath(); c.moveTo(180, 130); c.bezierCurveTo(260, 60, 300, 260, 380, 160); c.lineTo(520, 160); c.strokeStyle = COL.ink; c.lineWidth = 14; c.lineCap = "round"; c.stroke(); c.strokeStyle = "#ffe066"; c.lineWidth = 9; c.stroke();
    lab(c, "肾小管", 300, 270, 17, COL.grey); lab(c, "集合管", 470, 130, 17, COL.grey);
    arrow(c, 190, 100, 250, 80, COL.blue, 3); lab(c, "滤过", 230, 62, 16, COL.blue);
    arrow(c, 330, 200, 330, 250, COL.green, 3); lab(c, "重吸收", 400, 240, 16, COL.green);
    txt(c, `${fmt(Mo.filtered(), 0)} L`, 60, 40, 22, COL.blue, "left"); txt(c, `${fmt(u, 1)} L`, 560, 200, 24, COL.orange);
    if (Mo.glucoseInUrine(s.glu) > 0) { lab(c, "尿糖", 560, 240, 18, COL.red); }
  },
  tasks: [
    { id: "normal", text: "每天喝水 3 L 以上：尿量增加到 2 L 以上", check: (s) => s.water >= 3 && Mo.urine(s.water, s.sweat) > 2 },
    { id: "dehyd", text: "喝水很少、出汗很多：尿量降到最低（0.5 L），尿素被浓缩 100 倍以上", check: (s) => Mo.urine(s.water, s.sweat) === 0.5 && Mo.ureaFactor(0.5) >= 100 && s.sweat >= 1 },
    { id: "glu", text: "把血糖浓度升到 10 mmol/L 以上：尿中出现葡萄糖", check: (s) => Mo.glucoseInUrine(s.glu) > 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
