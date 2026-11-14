import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-bloodpressure";
import { COL, lab, rect, circle, line, axes, curve, ell, arrow } from "./draw";
export const meta = CATALOG.bloodpressure;
type S = Record<string, number>;
export const pressures = (s: S) => { const dia = Mo.diastolic(s.sv, s.hr, s.r, s.el), sys = Mo.systolic(s.sv, s.hr, s.r, s.el); return { sys, dia }; };
/** the pressure inside the artery at the phase `ph` (0..1) of a heartbeat: a quick rise to the systolic value, then a slow fall */
const wave = (ph: number, dia: number, sys: number) => dia + (sys - dia) * (ph < 0.2 ? ph / 0.2 : Math.exp(-(ph - 0.2) * 3.2));
export const def: SimDef = {
  meta,
  lesson: [
    "血压是血液在血管内向前流动时对血管壁的侧压力，通常指体循环中动脉的压力。心脏收缩时血压最高，叫收缩压；心脏舒张时血压最低，叫舒张压。健康成年人的收缩压约为 12–18.7 kPa（90–140 mmHg），舒张压约为 8–12 kPa（60–90 mmHg）；1 kPa 约等于 7.5 mmHg。",
    "本模型：血压的高低取决于心输出量（每搏输出量 × 心率）、血管的阻力和动脉壁的弹性；动脉变窄或变硬，血压会升高。测量血压时，袖带压力高于收缩压，血流被阻断；袖带压力降到收缩压时开始听到脉搏声，降到舒张压时声音消失。脉搏是动脉随心脏跳动而产生的搏动，在手腕处可摸到，次数与心率相同。（这是教学模型，不是诊断工具。）",
  ],
  links: [{ text: "相关：血液循环", href: "#/science/bio/blood" }, { text: "相关：血管与血液", href: "#/science/bio/vessels" }],
  params: [
    { id: "sv", label: "每搏输出量", min: 40, max: 110, step: 5, value: 70, unit: "mL", when: (s) => s.mode === 0 },
    { id: "hr", label: "心率", min: 40, max: 180, step: 5, value: 75, unit: "次/分钟", when: (s) => s.mode !== 1 },
    { id: "r", label: "血管阻力（变窄为大）", min: 50, max: 200, step: 5, value: 100, unit: "%", when: (s) => s.mode === 0 },
    { id: "el", label: "动脉壁弹性", min: 50, max: 150, step: 10, value: 100, unit: "%", when: (s) => s.mode === 0 },
    { id: "cuff", label: "袖带压力", min: 0, max: 200, step: 1, value: 180, unit: "mmHg", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "血压的模型"], [1, "用袖带测血压"], [2, "脉搏"]] },
    { id: "person", label: "受测者", value: 0, options: Mo.PEOPLE.map((p, i) => [i, p[0]] as [number, string]), when: (s) => s.mode === 1 },
    { id: "secs", label: "数脉搏的时间", value: 15, options: [[10, "10 s"], [15, "15 s"], [30, "30 s"], [60, "60 s"]], when: (s) => s.mode === 2 },
  ],
  readouts: (s) => {
    if (s.mode === 0) { const { sys, dia } = pressures(s); return [
      { label: "心输出量", value: fmt(Mo.output(s.sv, s.hr), 2), unit: "L/min" }, { label: "收缩压", value: fmt(sys, 0), unit: "mmHg" }, { label: "舒张压", value: fmt(dia, 0), unit: "mmHg" },
      { label: "脉压差", value: fmt(sys - dia, 0), unit: "mmHg" }, { label: "血压（kPa）", value: `${fmt(Mo.kpa(sys), 1)} / ${fmt(Mo.kpa(dia), 1)}` }, { label: "判断", value: Mo.STATUS[Mo.status(sys, dia)] }]; }
    if (s.mode === 1) { const [, sy, di] = Mo.PEOPLE[s.person]; return [{ label: "受测者", value: Mo.PEOPLE[s.person][0] }, { label: "袖带压力", value: String(s.cuff), unit: "mmHg" }, { label: "听诊", value: Mo.SOUND_TEXT[Mo.sound(s.cuff, sy, di)] }]; }
    const n = Mo.counted(s.hr, s.secs);
    return [{ label: "心率", value: String(s.hr), unit: "次/分钟" }, { label: "数脉搏的时间", value: String(s.secs), unit: "s" }, { label: "数到的次数", value: String(n) }, { label: "换算成每分钟", value: fmt((n * 60) / s.secs, 0), unit: "次/分钟" }];
  },
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const { sys, dia } = pressures(s);
      circle(c, 62, 130, 40, "#ffa8a8", COL.ink, 4); lab(c, "心脏", 62, 130, 18);
      const th = Math.max(14, Math.min(70, 46 * 100 / s.r));
      rect(c, 106, 130 - th / 2, 170, th, "#ff8787", COL.ink, 4, th / 2); arrow(c, 120, 130, 255, 130, "#fff", 5);
      lab(c, "动脉", 190, 130 - th / 2 - 14, 17, COL.grey);
      const P = axes(c, 332, 40, 290, 250, 3, 200, "t (s)", "mmHg", 0, 5);
      const T = 60 / s.hr; curve(c, P, (t) => wave((t % T) / T, dia, sys) , COL.red, Math.min(3, 3), 240, 4);
      line(c, P.X(0), P.Y(140), P.X(3), P.Y(140), COL.orange, 2, [6, 6]); line(c, P.X(0), P.Y(90), P.X(3), P.Y(90), COL.orange, 2, [6, 6]);
      lab(c, "收缩压", P.X(3) - 4, P.Y(sys) - 14, 15, COL.red, "right"); lab(c, "舒张压", P.X(3) - 4, P.Y(dia) + 14, 15, COL.blue, "right");
      lab(c, `${fmt(sys, 0)} / ${fmt(dia, 0)}`, 190, 250, 30, Mo.status(sys, dia) === 0 ? COL.green : COL.red);
      lab(c, "mmHg", 190, 286, 18, COL.grey);
      return;
    }
    if (s.mode === 1) {
      const [, sy, di] = Mo.PEOPLE[s.person], snd = Mo.sound(s.cuff, sy, di);
      rect(c, 40, 130, 330, 54, "#ffd8a8", COL.ink, 4, 27); rect(c, 130, 118, 90, 78, snd === 0 ? "#ffc9c9" : "#d0ebff", COL.ink, 4, 10); lab(c, "袖带", 175, 157, 17);
      line(c, 220, 157, 300, 80, COL.grey, 5); circle(c, 330, 70, 36, "#fff", COL.ink, 4);
      const a = Math.PI * (0.8 + 1.4 * (s.cuff / 200)); line(c, 330, 70, 330 + 28 * Math.cos(a), 70 + 28 * Math.sin(a), COL.red, 4); lab(c, "0", 312, 122, 12, COL.grey); lab(c, "200", 350, 122, 12, COL.grey);
      rect(c, 480, 40, 36, 300, "#fff", COL.ink, 3, 8); const hgt = 300 * s.cuff / 200; rect(c, 484, 340 - hgt, 28, hgt, COL.red, null, 0, 4);
      for (const v of [0, 50, 100, 150, 200]) { line(c, 516, 340 - 300 * v / 200, 530, 340 - 300 * v / 200, COL.ink, 2); lab(c, String(v), 570, 340 - 300 * v / 200, 14, COL.grey); }
      circle(c, 250, 300, 30, snd === 1 ? "#ffe066" : "#f1f3f5", COL.ink, 4); lab(c, snd === 1 ? "♪" : "—", 250, 300, 26);
      if (snd === 1) { c.beginPath(); c.arc(250, 300, 44, -0.7, 0.7); c.strokeStyle = COL.orange; c.lineWidth = 4; c.stroke(); c.beginPath(); c.arc(250, 300, 56, -0.7, 0.7); c.stroke(); }
      lab(c, "听诊器", 250, 350, 16, COL.grey);
      return;
    }
    const n = Mo.counted(s.hr, s.secs);
    ell(c, 110, 150, 70, 36, "#ffd8a8", COL.ink, 4); rect(c, 80, 138, 90, 12, "#fa8c16", COL.ink, 2, 6); lab(c, "手腕", 110, 205, 16, COL.grey);
    line(c, 230, 150, 610, 150, COL.ink, 3);
    for (let k = 0; k <= 4; k++) { const x = 230 + (380 * k) / 4; line(c, x, 144, x, 160, COL.ink, 3); lab(c, fmt((s.secs * k) / 4, 1), x, 178, 14, COL.grey); }
    const period = 60 / s.hr; for (let t = period / 2, i = 0; t < s.secs && i < 400; t += period, i++) { const x = 230 + (380 * t) / s.secs; line(c, x, 110, x, 150, COL.red, s.hr > 120 ? 3 : 4); }
    lab(c, `${n}`, 420, 250, 56, COL.red); lab(c, `${fmt((n * 60) / s.secs, 0)} /min`, 420, 310, 26, COL.ink);
  },
  tasks: [
    { id: "high", text: "使血压偏高：收缩压超过 140 mmHg 或舒张压超过 90 mmHg", check: (s) => s.mode === 0 && Mo.status(pressures(s).sys, pressures(s).dia) === 1 },
    { id: "sys", text: "为受测者甲读出收缩压：袖带压力正好等于听到第一声脉搏声时的压力", check: (s) => s.mode === 1 && s.person === 0 && s.cuff === Mo.PEOPLE[0][1] },
    { id: "dia", text: "为受测者甲读出舒张压：袖带压力正好等于声音消失时的压力", check: (s) => s.mode === 1 && s.person === 0 && s.cuff === Mo.PEOPLE[0][2] },
    { id: "pulse", text: "用 15 s 数脉搏，心率 120 次/分钟时数到 30 次", check: (s) => s.mode === 2 && s.secs === 15 && s.hr === 120 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
