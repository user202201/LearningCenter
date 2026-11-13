import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-photo";
import { COL, lab, txt, circle, ell, rect, line, axes, curve } from "./draw";
export const meta = CATALOG.photo;
export const def: SimDef = {
  meta,
  lesson: [
    "光合作用：绿色植物利用光能，在叶绿体中把二氧化碳和水转化成储存能量的有机物（淀粉等），并释放氧气。水草放出氧气的气泡越多，光合作用越强。",
    "光照越强速率越大，但到一定程度后不再增加（饱和）；这时二氧化碳浓度或温度成为限制因素。温度太高或太低，酶的活性都会降低。淀粉遇碘液变成蓝黑色，可用来检验叶片是否进行了光合作用。",
  ],
  formulas: ["\\text{二氧化碳 + 水} \\xrightarrow[\\text{叶绿体}]{\\text{光}} \\text{有机物 + 氧气}"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "I", label: "光照强度", min: 0, max: 80, step: 1, value: 30, unit: "klx" },
    { id: "C", label: "二氧化碳浓度", min: 0, max: 0.2, step: 0.01, value: 0.04, unit: "%", dec: 2 },
    { id: "T", label: "温度", min: 0, max: 50, step: 1, value: 25, unit: "°C" },
    { id: "hours", label: "光照时间", min: 1, max: 6, step: 1, value: 3, unit: "小时", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "水草放氧气"], [1, "淀粉检验"]] },
    { id: "cover", label: "叶片", value: 0, options: [[0, "不遮光"], [1, "锡箔遮住左半"]], when: (s) => s.mode === 1 },
  ],
  aspect: 0.6,
  readouts: (s) => s.mode === 0 ? [
    { label: "氧气气泡", value: fmt(Mo.rate(s.I, s.C, s.T), 1), unit: "个/分钟" },
    { label: "此条件下的上限", value: fmt(Mo.limit(s.C, s.T), 1), unit: "个/分钟" },
    { label: "限制因素", value: Mo.limiting(s.I, s.C, s.T) }] : [
    { label: "未遮光部分的淀粉", value: fmt(Mo.starch(Mo.rate(s.I, s.C, s.T), s.hours) * 100, 0), unit: "%" },
    { label: "遮光部分的淀粉", value: fmt(s.cover ? 0 : Mo.starch(Mo.rate(s.I, s.C, s.T), s.hours) * 100, 0), unit: "%" },
    { label: "限制因素", value: Mo.limiting(s.I, s.C, s.T) }],
  draw(c, w, h, s) {
    const r = Mo.rate(s.I, s.C, s.T);
    if (s.mode === 0) {
      rect(c, 30, 130, 220, 220, "#e7f5ff", COL.ink, 4, 18);
      line(c, 140, 345, 140, 205, COL.leaf2, 6);
      for (const [dx, dy, a] of [[-40, 240, 0.4], [40, 260, -0.4], [-35, 300, 0.5], [38, 215, -0.5], [0, 190, 0]]) { ell(c, 140 + dx, dy, 34, 11, COL.leaf, COL.leaf2, 3, a); }
      rect(c, 100, 60, 80, 70, "#fff", COL.ink, 3, 6);   // inverted funnel / test tube
      const nb = Math.round(Math.min(12, r / 3.4));
      for (let i = 0; i < nb; i++) { circle(c, 128 + ((i * 37) % 22), 330 - ((i * 53) % 120) - 20, 4 + (i % 3), "#fff", "#4dabf7", 2); }
      txt(c, "O2", 140, 100, 24, COL.blue);
      if (s.I > 0) { circle(c, 70, 40, 18 + s.I / 10, "#ffe066", COL.orange, 3); } else { lab(c, "黑暗", 70, 40, 18, COL.grey); }
      const P = axes(c, 340, 50, 280, 240, 80, 40, "I (klx)", "O2 / min", 0, 4);
      c.setLineDash([6, 6]); line(c, P.X(0), P.Y(Mo.limit(s.C, s.T)), P.X(80), P.Y(Mo.limit(s.C, s.T)), COL.orange, 2); c.setLineDash([]);
      curve(c, P, (x) => Mo.rate(x, s.C, s.T), COL.green, 80, 120);
      circle(c, P.X(s.I), P.Y(r), 8, COL.red, COL.ink, 3);
    } else {
      const a = Mo.starch(r, s.hours), mix = (t: number) => `rgb(${Math.round(201 - 170 * t)},${Math.round(150 - 108 * t)},${Math.round(60 + 47 * t)})`;
      ell(c, 320, 190, 250, 140, COL.leaf, COL.leaf2, 5);
      line(c, 70, 190, 570, 190, "#8ce99a", 8);
      c.save(); c.beginPath(); c.rect(0, 0, 320, 400); c.clip(); ell(c, 320, 190, 250, 140, mix(s.cover ? 0 : a), COL.leaf2, 5); c.restore();
      c.save(); c.beginPath(); c.rect(320, 0, 320, 400); c.clip(); ell(c, 320, 190, 250, 140, mix(a), COL.leaf2, 5); c.restore();
      if (s.cover) { rect(c, 66, 76, 254, 228, "rgba(173,181,189,0.35)", COL.grey, 3, 10); lab(c, "锡箔", 190, 330, 18, COL.grey); }
      lab(c, "碘液检验", 320, 28, 20, COL.purple); txt(c, `${s.hours} h`, 600, 28, 18, COL.grey, "right");
    }
  },
  tasks: [
    { id: "dark", text: "把光照强度调到 0：没有氧气放出", check: (s) => s.mode === 0 && s.I === 0 },
    { id: "sat", text: "加强光照，使速率达到此条件下上限的 90% 以上", check: (s) => s.mode === 0 && Mo.limit(s.C, s.T) > 0 && Mo.rate(s.I, s.C, s.T) >= 0.9 * Mo.limit(s.C, s.T) },
    { id: "co2", text: "强光（60 klx 以上）下，把二氧化碳浓度提高到 0.1% 以上，速率比空气（0.04%）中高 40% 以上", check: (s) => s.mode === 0 && s.I >= 60 && s.C >= 0.1 && Mo.rate(s.I, s.C, s.T) >= 1.4 * Mo.rate(s.I, 0.04, s.T) },
    { id: "starch", text: "做淀粉检验：遮住左半，光照 3 小时以上，未遮光部分明显变蓝", check: (s) => s.mode === 1 && s.cover === 1 && s.hours >= 3 && Mo.starch(Mo.rate(s.I, s.C, s.T), s.hours) > 0.6 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
