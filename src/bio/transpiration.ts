import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-transpiration";
import { COL, lab, txt, ell, rect, line, arrow } from "./draw";
export const meta = CATALOG.transpiration;
const L = (s: Record<string, number>) => Mo.loss(s.area, Mo.opening(s.light, s.soil), Mo.vpd(s.T, s.RH), s.wind);
const BASE = Mo.loss(100, 1, Mo.vpd(25, 50), 2);
export const def: SimDef = {
  meta,
  lesson: [
    "蒸腾作用：水分以水蒸气的形式从叶片的气孔散失到空气中。蒸腾拉动水分和无机盐在植物体内向上运输，还能降低叶片温度、增加空气湿度。",
    "保卫细胞吸水膨胀，气孔张开；失水收缩，气孔关闭。光照强、空气干燥、温度高、有风，蒸腾作用增强；叶面积越大，失水越多。气孔多分布在叶的下表皮。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "light", label: "光照", min: 0, max: 100, step: 5, value: 80, unit: "%" },
    { id: "RH", label: "空气相对湿度", min: 10, max: 100, step: 5, value: 50, unit: "%" },
    { id: "wind", label: "风速", min: 0, max: 10, step: 1, value: 2, unit: "m/s" },
    { id: "T", label: "气温", min: 10, max: 40, step: 1, value: 25, unit: "°C" },
    { id: "area", label: "叶面积", min: 50, max: 300, step: 10, value: 100, unit: "cm²" },
  ],
  choices: [{ id: "soil", label: "土壤", value: 1, options: [[1, "水分充足"], [0, "干旱"]] }],
  aspect: 0.6,
  readouts: (s) => [
    { label: "气孔开度", value: fmt(Mo.opening(s.light, s.soil) * 100, 0), unit: "%" },
    { label: "空气饱和差", value: fmt(Mo.vpd(s.T, s.RH), 2), unit: "kPa" },
    { label: "失水量", value: fmt(L(s), 2), unit: "g/h" },
    { label: "与初始状态相比", value: fmt((L(s) / BASE) * 100, 0), unit: "%" }],
  draw(c, w, h, s) {
    const o = Mo.opening(s.light, s.soil), gap = 3 + 22 * o;
    // the leaf in section
    rect(c, 20, 60, 360, 28, "#b2f2bb", COL.leaf2, 3, 6); rect(c, 20, 90, 360, 120, "#8ce99a", null, 0, 0);
    for (let i = 0; i < 9; i++) ell(c, 45 + i * 38, 150, 15, 40, "#69db7c", COL.leaf2, 2);
    rect(c, 20, 212, 360, 28, "#b2f2bb", COL.leaf2, 3, 6);
    line(c, 20, 150, 380, 150, "#fff", 0.1);
    // stomata in the lower epidermis
    for (const x of [110, 290]) {
      ell(c, x - 22 - gap / 2, 226, 14, 20, "#5c940d", COL.ink, 3); ell(c, x + 22 + gap / 2, 226, 14, 20, "#5c940d", COL.ink, 3);
      const n = Math.round(L(s) / BASE * 3 * Math.min(1, o + 0.1));
      for (let k = 0; k < Math.min(6, n); k++) arrow(c, x - 16 + (k % 3) * 16, 250 + (k % 2) * 6, x - 20 + (k % 3) * 20, 300 + (k % 2) * 20, "#4dabf7", 3);
    }
    lab(c, "气孔", 200, 272, 18, COL.ink); lab(c, "下表皮", 60, 262, 16, COL.grey, "left"); lab(c, "叶肉", 60, 128, 16, COL.grey, "left");
    // the stomata from above
    ell(c, 520, 120, 40 + gap / 2, 62, "#d8f5a2", COL.ink, 3);
    ell(c, 520 - 10 - gap / 2, 120, 14, 50, "#74b816", COL.ink, 3); ell(c, 520 + 10 + gap / 2, 120, 14, 50, "#74b816", COL.ink, 3);
    lab(c, "保卫细胞", 520, 205, 18, COL.ink);
    // a gauge of the water lost
    rect(c, 430, 250, 190, 28, "#f1f3f5", COL.grey, 2, 8); rect(c, 432, 252, Math.min(186, (L(s) / 4) * 186), 24, L(s) > 2 ? COL.red : COL.blue, null, 0, 6);
    lab(c, "失水量", 430, 300, 17, COL.grey, "left"); txt(c, `${fmt(L(s), 2)} g/h`, 620, 300, 18, COL.ink, "right");
  },
  tasks: [
    { id: "dark", text: "把光照调到 0：气孔几乎关闭（开度不到 10%）", check: (s) => Mo.opening(s.light, s.soil) < 0.1 },
    { id: "hot", text: "炎热、干燥、有风：使失水量达到初始状态的 2 倍以上", check: (s) => s.T >= 35 && s.RH <= 30 && s.wind >= 5 && L(s) >= 2 * BASE },
    { id: "humid", text: "在光照充足时（光照 50% 以上），把空气相对湿度调到 90% 以上：失水量降到初始状态的 25% 以下", check: (s) => s.light >= 50 && s.RH >= 90 && s.soil === 1 && L(s) <= 0.25 * BASE },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
