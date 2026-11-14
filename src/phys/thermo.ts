import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-thermo";
import { COL, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.thermo;
type S = Record<string, number>;
const clin = (s: S) => Mo.clinical(s.prev, s.now, s.shaken);
const meas = (s: S) => Mo.placed(s.Tw, s.place);
/** a thermometer drawn with its scale; `v` = the column top in the scale's units */
function thermometer(c: CanvasRenderingContext2D, x: number, y0: number, y1: number, lo: number, hi: number, step: number, label: number, v: number, narrow = 0) {
  const Y = (t: number) => y1 - ((t - lo) / (hi - lo)) * (y1 - y0);
  rect(c, x - 14, y0 - 10, 28, y1 - y0 + 24, "#fff", COL.ink, 4, 14);
  circle(c, x, y1 + 30, 22, COL.red, COL.ink, 4);
  rect(c, x - 5, Y(Math.max(lo, Math.min(hi, v))), 10, y1 + 30 - Y(Math.max(lo, Math.min(hi, v))), COL.red, null, 0, 3);
  for (let t = lo; t <= hi + 1e-9; t += step) { const long = Math.abs(t / label - Math.round(t / label)) < 1e-6; line(c, x + 14, Y(t), x + (long ? 34 : 24), Y(t), COL.ink, long ? 3 : 1.5); if (long) txt(c, String(Math.round(t * 10) / 10), x + 40, Y(t), 15, COL.grey, "left"); }
  if (narrow) { rect(c, x - 9, y1 - 2, 18, 8, "#fff", COL.ink, 3, 3); rect(c, x - 3, y1 - 2, 6, 8, COL.red, null, 0, 1); }
}
export const def: SimDef = {
  meta,
  lesson: [
    "温度表示物体的冷热程度。常用温度计是根据液体热胀冷缩的性质制成的。摄氏温度规定：在标准大气压下，冰水混合物的温度为 0 ℃，沸水的温度为 100 ℃，在 0 ℃ 和 100 ℃ 之间分成 100 等份，每一份叫做 1 摄氏度。0 ℃ 以下的温度读作“零下”或在数字前加“−”。",
    "使用温度计时：先看清量程和分度值；玻璃泡要全部浸入被测液体中，不要碰到容器底或容器壁；浸入后要稍等一会儿，待示数稳定后再读数；读数时，玻璃泡要继续留在被测液体中，视线与温度计中液柱的上表面相平。",
    "体温计的量程是 35 ℃~42 ℃，分度值是 0.1 ℃。它的玻璃泡和直玻璃管之间有一段很细的缩口，水银柱上升后遇冷收缩时在缩口处断开，水银柱不会自己退回玻璃泡，所以体温计可以离开人体读数。每次使用前要用力甩几下，把水银甩回玻璃泡。",
  ],
  params: [
    { id: "T", label: "被测物体的温度", min: -20, max: 110, step: 0.5, value: 20, unit: "℃", when: (s) => s.mode === 0 },
    { id: "prev", label: "体温计原来的示数", min: 35, max: 42, step: 0.1, value: 38.5, unit: "℃", when: (s) => s.mode === 1 },
    { id: "now", label: "这次测量的人的体温", min: 35, max: 42, step: 0.1, value: 36.8, unit: "℃", when: (s) => s.mode === 1 },
    { id: "Tw", label: "烧杯中水的温度", min: 30, max: 100, step: 5, value: 50, unit: "℃", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "实验室温度计"], [1, "体温计"], [2, "测量水温的方法"]] },
    { id: "shaken", label: "使用前", value: 0, options: [[0, "没有甩"], [1, "用力甩过"]], when: (s) => s.mode === 1 },
    { id: "place", label: "温度计的放法", value: 2, options: Mo.PLACES.map((p, i) => [i, p] as [number, string]), when: (s) => s.mode === 2 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "量程", value: "−20 ℃ ~ 110 ℃" }, { label: "分度值", value: "1 ℃" }, { label: "读数", value: fmt(Mo.readLab(s.T), 0), unit: "℃" }];
    if (s.mode === 1) return [{ label: "量程", value: "35 ℃ ~ 42 ℃" }, { label: "分度值", value: "0.1 ℃" }, { label: "示数", value: fmt(clin(s), 1), unit: "℃" }, { label: "示数与这次体温相比", value: clin(s) === Math.round(s.now * 10) / 10 ? "相同" : "偏高（缩口使水银柱没有退回）" }];
    return [{ label: "水的实际温度", value: fmt(s.Tw, 0), unit: "℃" }, { label: "温度计的示数", value: fmt(meas(s), 1), unit: "℃" }, { label: "这种放法的结果", value: Mo.verdict(s.Tw, s.place) }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) { thermometer(c, 250, 30, 310, -20, 110, 5, 10, Mo.readLab(s.T)); txt(c, `${fmt(Mo.readLab(s.T), 0)} C`, 440, 190, 44, COL.red); }
    else if (s.mode === 1) { thermometer(c, 250, 30, 310, 35, 42, 0.1, 1, clin(s), 1); txt(c, `${fmt(clin(s), 1)} C`, 440, 190, 44, COL.red); }
    else {
      rect(c, 150, 170, 200, 170, "#e7f5ff", COL.ink, 5, 16); rect(c, 154, 220, 192, 116, COL.water2, null, 0, 12);
      const bottomHot = s.place === 1, out = s.place === 3, half = s.place === 2;
      const by = out ? 70 : bottomHot ? 316 : half ? 215 : 290; rect(c, 245, by - 150, 12, 150, "#fff", COL.ink, 3, 5); circle(c, 251, by + 8, 14, COL.red, COL.ink, 3);
      if (bottomHot) for (let i = 0; i < 4; i++) line(c, 190 + i * 40, 372, 200 + i * 40, 352, COL.orange, 4);
      txt(c, `${fmt(meas(s), 1)} C`, 500, 130, 40, COL.red); txt(c, `${fmt(s.Tw, 0)} C`, 500, 220, 30, COL.blue);
    }
  },
  tasks: [
    { id: "cold", text: "实验室温度计：使读数为 −10 ℃（零下 10 摄氏度）", check: (s) => s.mode === 0 && Mo.readLab(s.T) === -10 },
    { id: "stay", text: "体温计：不甩，使示数仍是原来的较高示数（比这次体温高）", check: (s) => s.mode === 1 && s.prev > s.now && s.shaken === 0 && clin(s) === Math.round(s.prev * 10) / 10 },
    { id: "shake", text: "体温计：用力甩过以后，使示数等于这次测量的体温", check: (s) => s.mode === 1 && s.prev > s.now && s.shaken === 1 && clin(s) === Math.round(s.now * 10) / 10 },
    { id: "right", text: "测量水温：用正确的放法测量 60 ℃ 以上的热水，使示数准确", check: (s) => s.mode === 2 && s.place === 0 && s.Tw >= 60 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
