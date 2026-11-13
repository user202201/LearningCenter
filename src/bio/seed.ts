import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-seed";
import { COL, lab, txt, circle, ell, rect } from "./draw";
export const meta = CATALOG.seed;
const CONTROL = { water: 1, air: 1, T: 27, viable: 1 };
type S = Record<string, number>;
const dishes = (s: S) => [
  { n: "A 对照", water: 1, air: 1, T: 27, viable: 1 }, { n: "B", water: 0, air: 1, T: 27, viable: 1 }, { n: "C", water: 1, air: 0, T: 27, viable: 1 }, { n: "D", water: 1, air: 1, T: 4, viable: 1 },
  { n: "E 你的", water: s.water, air: s.air, T: s.T, viable: s.viable },
];
const diff = (s: S) => (s.water !== 1 ? 1 : 0) + (s.air !== 1 ? 1 : 0) + (Math.abs(s.T - Mo.OPT) >= 1 ? 1 : 0) + (s.viable !== 1 ? 1 : 0);
const rate = (s: S, d = s) => Mo.germRate(s.day, d.water, d.air, d.T, d.viable);
export const def: SimDef = {
  meta,
  lesson: [
    "种子萌发需要的外界条件：适宜的温度、一定的水分和充足的空气；自身条件：胚是完整的、有活力的，并且已度过休眠期。光照对大多数种子的萌发没有影响。",
    "对照实验只改变一个条件（变量），其他条件相同。A 皿的条件都适宜，作为对照；B、C、D 各缺一个条件；E 皿由你设置。每皿 20 粒种子，用萌发的粒数比较。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "day", label: "培养时间", min: 0, max: 8, step: 0.5, value: 0, unit: "天" },
    { id: "T", label: "E 皿的温度", min: 0, max: 50, step: 1, value: 27, unit: "°C" },
  ],
  choices: [
    { id: "water", label: "E 皿的水分", value: 1, options: [[1, "有水"], [0, "没有水"]] },
    { id: "air", label: "E 皿的空气", value: 1, options: [[1, "有空气"], [0, "没有空气"]] },
    { id: "viable", label: "E 皿的种子", value: 1, options: [[1, "完整有活力"], [0, "煮熟的"]] },
  ],
  play: { param: "day", rate: 1.2 },
  aspect: 0.55,
  readouts: (s) => [
    { label: "对照组 A 萌发", value: `${Mo.germCount(rate(s, CONTROL))} / ${Mo.N}` },
    { label: "E 皿萌发", value: `${Mo.germCount(rate(s))} / ${Mo.N}` },
    { label: "E 皿与对照不同的条件数", value: String(diff(s)) },
    { label: "E 皿萌发率", value: fmt(rate(s) * 100, 0), unit: "%" }],
  draw(c, w, h, s) {
    dishes(s).forEach((d, i) => {
      const x = 64 + 128 * i, y = 118, n = Mo.germCount(Mo.germRate(s.day, d.water, d.air, d.T, d.viable));
      circle(c, x, y, 54, d.water ? "#e7f5ff" : "#fff9db", i === 4 ? COL.orange : COL.ink, i === 4 ? 5 : 3);
      for (let k = 0; k < Mo.N; k++) {
        const a = k * 2.399, r = 8 + 34 * Math.sqrt((k + 0.5) / Mo.N), px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
        if (k < n) { ell(c, px, py, 5, 3.5, "#f1e0b0", COL.ink, 1.5); c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 3, py - 8, px + 8, py - 12); c.strokeStyle = "#37b24d"; c.lineWidth = 3; c.stroke(); }
        else ell(c, px, py, 5, 3.5, d.viable ? "#d9a066" : "#a67c52", COL.ink, 1.5);
      }
      lab(c, d.n, x, 190, 16, COL.purple);
      txt(c, `${n}/${Mo.N}`, x, 214, 18, COL.green);
      [["水", d.water ? 1 : 0], ["空气", d.air ? 1 : 0], ["适温", Math.abs(d.T - Mo.OPT) < 6 ? 1 : 0], ["活胚", d.viable ? 1 : 0]].forEach(([nm, ok], j) => {
        lab(c, String(nm), x - 18, 244 + j * 25, 15, COL.grey, "right"); txt(c, ok ? "✓" : "✗", x + 8, 244 + j * 25, 18, ok ? COL.green : COL.red, "left");
      });
      txt(c, `${d.T}°C`, x, 348, 15, COL.grey);
    });
    rect(c, 8, 6, 624, 336, "", "#e9ecef", 2, 14);
  },
  tasks: [
    { id: "high", text: "培养到种子萌发率达到 90% 以上（E 皿条件都适宜）", check: (s) => diff(s) === 0 && rate(s) >= 0.9 },
    { id: "nowater", text: "E 皿只缺水（其他条件适宜），培养 6 天以上，种子不萌发", check: (s) => s.water === 0 && s.air === 1 && s.viable === 1 && s.T >= 20 && s.T <= 35 && s.day >= 6 },
    { id: "boiled", text: "E 皿放入煮熟的种子（其他条件适宜），培养 6 天以上，种子不萌发", check: (s) => s.viable === 0 && s.water === 1 && s.air === 1 && s.T >= 20 && s.T <= 35 && s.day >= 6 },
    { id: "cold", text: "E 皿温度降到 5 °C 以下（其他条件适宜），培养 6 天以上，种子不萌发", check: (s) => s.T <= 5 && s.water === 1 && s.air === 1 && s.viable === 1 && s.day >= 6 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
