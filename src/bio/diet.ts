import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-diet";
import { COL, lab, txt, rect } from "./draw";
export const meta = CATALOG.diet;
const params = Mo.GROUPS.map((g, i) => ({ id: `g${i}`, label: g[0], min: 0, max: i === 5 ? 100 : 600, step: i === 5 ? 5 : 25, value: [300, 100, 250, 150, 300, 25][i], unit: "g" }));
export const def: SimDef = {
  meta,
  lesson: [
    "合理营养是指全面而平衡的营养：营养物质的种类齐全、数量合适、比例合适。糖类是主要的供能物质，脂肪是备用能源，蛋白质是细胞生长和修复的基本物质，还需要水、无机盐和维生素。食物多样，谷类为主，多吃蔬菜水果，适量吃肉、蛋、鱼、奶，少油少盐。",
    "按“平衡膳食宝塔”调节每类食物的量：使六类食物都在推荐范围内，总能量接近自己的需要（约 2000 kcal）。缺乏某种营养物质会引起相应的疾病，如夜盲症、坏血病、佝偻病、脚气病、贫血、地方性甲状腺肿。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [...params, { id: "need", label: "一天需要的能量", min: 1600, max: 2600, step: 100, value: 2000, unit: "kcal" }],
  aspect: 0.6,
  readouts: (s) => { const g = Mo.amounts(s); return [
    { label: "总能量", value: fmt(Mo.energy(g), 0), unit: "kcal" }, { label: "蛋白质", value: fmt(Mo.nutrient(g, 2), 0), unit: "g" }, { label: "脂肪提供的能量占", value: fmt(Mo.fatShare(g) * 100, 0), unit: "%" },
    { label: "在推荐范围内的食物类别", value: `${Mo.inRange(g)} / 6` }, { label: "评价", value: Mo.balanced(g, s.need) ? "膳食平衡" : "需要调整" }]; },
  draw(c, w, h, s) {
    const g = Mo.amounts(s);
    Mo.GROUPS.forEach((gr, i) => {
      const y = 40 + i * 52, mx = i === 5 ? 100 : 600, r = gr[5], ok = g[i] >= r[0] && g[i] <= r[1];
      lab(c, gr[0], 20, y + 14, 16, COL.ink, "left"); rect(c, 170, y, 440, 28, "#f1f3f5", COL.grey, 2, 8);
      rect(c, 170 + (r[0] / mx) * 440, y, ((r[1] - r[0]) / mx) * 440, 28, "rgba(81,207,102,0.35)", null, 0, 0); rect(c, 170, y + 6, Math.max(2, (g[i] / mx) * 440), 16, ok ? COL.green : COL.orange, null, 0, 6);
      txt(c, `${g[i]} g`, 616, y + 14, 14, COL.grey, "right");
    });
    txt(c, `${fmt(Mo.energy(g), 0)} / ${s.need} kcal`, 20, 372, 22, Mo.balanced(g, s.need) ? COL.green : COL.purple, "left");
  },
  tasks: [
    { id: "balanced", text: "调整六类食物：全部在推荐范围内，总能量与需要相差不超过 10 %", check: (s) => Mo.balanced(Mo.amounts(s), s.need) },
    { id: "oil", text: "油吃到 80 g：脂肪提供的能量超过总能量的 35 %", check: (s) => Mo.fatShare(Mo.amounts(s)) > 0.35 },
    { id: "veg", text: "不吃蔬菜和水果（都为 0），谷类减到 200 g 以下：总能量低于 1500 kcal", check: (s) => s.g1 === 0 && s.g2 === 0 && s.g0 <= 200 && Mo.energy(Mo.amounts(s)) < 1500 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
