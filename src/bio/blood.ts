import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-blood";
import { COL, lab, txt, circle, ell, rect, line, arrow } from "./draw";
export const meta = CATALOG.blood;
const RED = "#e03131", BLUE = "#4263eb";
const TOP = 70;
function heart(c: CanvasRenderingContext2D, s: Record<string, number>) {
  const st = Mo.stage(s.frac), v = Mo.valves(st);
  const ca = st === 0 ? 0.82 : 1, cv = st === 1 ? 0.8 : 1;
  const chamber = (x: number, y: number, w: number, h: number, k: number, col: string, name: string) => { const ww = w * k, hh = h * k; rect(c, x + (w - ww) / 2, y + (h - hh) / 2, ww, hh, col, COL.ink, 4, 26); lab(c, name, x + w / 2, y + h / 2, 18, "#fff"); };
  chamber(130, TOP + 60, 120, 90, ca, "#748ffc", "右心房"); chamber(280, TOP + 60, 120, 90, ca, "#ff8787", "左心房");
  chamber(120, TOP + 190, 130, 130, cv, "#4c6ef5", "右心室"); chamber(280, TOP + 190, 130, 130, cv, "#fa5252", "左心室");
  for (const x of [190, 340]) { if (v.av) { line(c, x - 22, TOP + 172, x - 8, TOP + 160, COL.ink, 5); line(c, x + 22, TOP + 172, x + 8, TOP + 160, COL.ink, 5); } else line(c, x - 28, TOP + 166, x + 28, TOP + 166, COL.ink, 7); }
  for (const x of [190, 340]) { if (v.artery) { line(c, x - 26, TOP + 188, x - 26, TOP + 205, COL.ink, 4); line(c, x + 26, TOP + 188, x + 26, TOP + 205, COL.ink, 4); } else { line(c, x - 26, TOP + 196, x + 26, TOP + 196, COL.ink, 0.1); } }
  lab(c, "房室瓣", 450, TOP + 166, 16, COL.grey, "left"); lab(c, v.av ? "打开" : "关闭", 450, TOP + 190, 16, v.av ? COL.green : COL.red, "left");
  lab(c, "动脉瓣", 450, TOP + 250, 16, COL.grey, "left"); lab(c, v.artery ? "打开" : "关闭", 450, TOP + 274, 16, v.artery ? COL.green : COL.red, "left");
  if (st === 0) { arrow(c, 190, TOP + 100, 190, TOP + 190, BLUE, 5); arrow(c, 340, TOP + 100, 340, TOP + 190, RED, 5); }
  if (st === 1) { arrow(c, 170, TOP + 200, 150, TOP + 20, BLUE, 5); arrow(c, 360, TOP + 200, 380, TOP + 20, RED, 5); lab(c, "肺动脉", 120, TOP + 12, 16, BLUE); lab(c, "主动脉", 400, TOP + 12, 16, RED); }
  if (st === 2) { arrow(c, 190, TOP + 6, 190, TOP + 58, BLUE, 4); arrow(c, 340, TOP + 6, 340, TOP + 58, RED, 4); }
  lab(c, Mo.STAGES[st], 20, 24, 20, COL.purple, "left");
}
// a closed loop for each circulation: the dots move round it
const loop = (c: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, ph: number, split: number, label: string, nameA: string, nameB: string) => {
  c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.strokeStyle = "#ced4da"; c.lineWidth = 12; c.stroke();
  const n = 14;
  for (let i = 0; i < n; i++) { const u = (i / n + ph) % 1, a = -Math.PI / 2 + u * 2 * Math.PI; circle(c, cx + rx * Math.cos(a), cy + ry * Math.sin(a), 6, u < split ? RED : BLUE, null); }
  lab(c, label, cx, cy, 18, COL.ink); lab(c, nameA, cx, cy - ry - 18, 16, RED); lab(c, nameB, cx, cy + ry + 18, 16, BLUE);
};
function abo(c: CanvasRenderingContext2D, s: Record<string, number>) {
  const ok = Mo.compatible(s.donor, s.recip);
  rect(c, 20, 60, 270, 260, "#fff5f5", COL.ink, 3, 18); lab(c, `供血者 ${Mo.TYPES[s.donor]} 型`, 155, 40, 20, COL.red);
  rect(c, 350, 60, 270, 260, "#fff9db", COL.ink, 3, 18); lab(c, `受血者 ${Mo.TYPES[s.recip]} 型`, 485, 40, 20, COL.orange);
  for (let i = 0; i < 8; i++) { const x = 70 + (i % 4) * 62, y = 120 + Math.floor(i / 4) * 80; circle(c, x, y, 24, "#ff8787", COL.ink, 3); if (s.donor & 1) txt(c, "A", x - 10, y - 10, 15, "#fff"); if (s.donor & 2) txt(c, "B", x + 10, y + 10, 15, "#fff"); }
  const ab = Mo.antibodies(s.recip);
  for (let i = 0; i < 4; i++) { const x = 400 + (i % 4) * 56, y = 250 + (i % 2) * 24; if (ab & 1) txt(c, "Y A", x, y, 15, COL.blue); if (ab & 2) txt(c, "Y B", x, y + 26, 15, COL.green); }
  for (let i = 0; i < 6; i++) { const x = ok ? 400 + (i % 3) * 70 : 440 + (i % 3) * 22, y = ok ? 110 + Math.floor(i / 3) * 70 : 140 + Math.floor(i / 3) * 18; circle(c, x, y, 21, "#ff8787", COL.ink, 3); }
  txt(c, ok ? "OK" : "X", 320, 190, 40, ok ? COL.green : COL.red);
  lab(c, ok ? "红细胞分散，可以输血" : "红细胞凝集成团，不能输血", 320, 352, 20, ok ? COL.green : COL.red);
}
export const def: SimDef = {
  meta,
  lesson: [
    "心脏有四个腔：左、右心房和左、右心室。心房与心室之间有房室瓣，心室与动脉之间有动脉瓣，使血液只能从心房流向心室、再流向动脉。心房收缩 → 心室收缩 → 全部舒张，构成一个心动周期。",
    "体循环：左心室 → 主动脉 → 各级动脉 → 毛细血管 → 各级静脉 → 上、下腔静脉 → 右心房，血液由动脉血变成静脉血；肺循环：右心室 → 肺动脉 → 肺部毛细血管 → 肺静脉 → 左心房，血液由静脉血变成动脉血。",
    "ABO 血型：红细胞表面有 A 或 B 抗原，血浆中有针对自己所缺抗原的抗体。输血时应输同型血；供血者红细胞上的抗原遇到受血者血浆中相应的抗体，红细胞会凝集。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "hr", label: "心率", min: 40, max: 180, step: 5, value: 75, unit: "次/分钟", when: (s) => s.mode < 2 },
    { id: "frac", label: "心动周期的位置", min: 0, max: 1, step: 0.025, value: 0.7, dec: 2, when: (s) => s.mode < 2 },
  ],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "心脏与瓣膜"], [1, "体循环与肺循环"], [2, "ABO 血型输血"]] },
    { id: "donor", label: "供血者", value: 1, options: Mo.TYPES.map((t, i) => [i, `${t} 型`] as [number, string]), when: (s) => s.mode === 2 },
    { id: "recip", label: "受血者", value: 1, options: Mo.TYPES.map((t, i) => [i, `${t} 型`] as [number, string]), when: (s) => s.mode === 2 },
  ],
  play: { param: "frac", rate: 0.8, loop: true },
  aspect: 0.62,
  readouts: (s) => s.mode === 2 ? [
    { label: "供血者红细胞", value: Mo.antigenText(s.donor) }, { label: "受血者血浆", value: Mo.antibodyText(s.recip) },
    { label: "结果", value: Mo.compatible(s.donor, s.recip) ? "不凝集，可以输血" : "凝集，不能输血" }] : [
    { label: "阶段", value: Mo.STAGES[Mo.stage(s.frac)] }, { label: "一个心动周期", value: fmt(Mo.period(s.hr), 2), unit: "s" },
    { label: "心输出量", value: fmt(Mo.output(s.hr), 1), unit: "L/分钟" }, { label: "瓣膜", value: Mo.valveText(Mo.stage(s.frac)) }],
  draw(c, w, h, s) {
    if (s.mode === 0) heart(c, s);
    else if (s.mode === 1) { loop(c, 160, 190, 120, 120, s.frac * 2, 0.5, "肺循环", "肺静脉（动脉血）", "肺动脉（静脉血）"); loop(c, 470, 190, 120, 120, s.frac * 2, 0.5, "体循环", "主动脉（动脉血）", "腔静脉（静脉血）"); }
    else abo(c, s);
  },
  tasks: [
    { id: "vsys", text: "找到心室收缩期：动脉瓣打开，房室瓣关闭", check: (s) => s.mode === 0 && Mo.stage(s.frac) === 1 },
    { id: "co", text: "提高心率，使心输出量达到 8 L/分钟以上", check: (s) => s.mode < 2 && Mo.output(s.hr) >= 8 },
    { id: "clump", text: "选择一种输血搭配，使红细胞发生凝集", check: (s) => s.mode === 2 && !Mo.compatible(s.donor, s.recip) },
    { id: "uni", text: "选择 O 型供血者和 AB 型受血者：可以输血", check: (s) => s.mode === 2 && s.donor === 0 && s.recip === 3 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
