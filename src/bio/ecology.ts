import { mountBio, type SimDef, type PhysCtx, fmt, mulberry32 } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-ecology";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, type DMode } from "./match";
import { COL, lab, rect, ell, circle, axes, curve, line } from "./draw";
export const meta = CATALOG.ecology;
export const MODES: (DMode | null)[] = [null, { kind: "bucket", prefix: "e", items: Mo.ECO_ITEMS.map((x) => x[0]), answers: Mo.ECO_ITEMS.map((x) => x[1]), buckets: Mo.ECOS }, null];
const PFX = ["e"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
export const def: SimDef = {
  meta,
  lesson: [
    "环境中影响生物生活的因素分为非生物因素（光、温度、水、空气、土壤等）和生物因素（其他生物）。探究鼠妇的分布：在一个盒子的两半设置不同的条件（如明亮与阴暗），把鼠妇放在中间，过一段时间数各侧的数量。对照实验只能有一个变量，其他条件相同；用较多的鼠妇并重复几次，可以减少偶然性。",
    "地球上有森林、草原、湿地、海洋、农田和城市等生态系统。生态系统具有一定的自我调节能力：物种越多、营养结构越复杂，自我调节能力越强，越能从干扰中恢复；但这种能力有一定限度，超过限度就难以恢复。（第三种模式是教学模型：能恢复的最大干扰 = 80 × 物种数 ÷ (物种数 + 8) %。）",
  ],
  links: [{ text: "相关：食物链与食物网", href: "#/science/bio/foodweb" }, { text: "相关：种群与生态平衡", href: "#/science/bio/population" }],
  params: [
    { id: "n", label: "鼠妇的数量", min: 4, max: 40, step: 2, value: 10, unit: "只", when: (s) => s.mode === 0 },
    { id: "div", label: "物种数", min: 2, max: 40, step: 2, value: 10, when: (s) => s.mode === 2 },
    { id: "dist", label: "干扰的强度（失去的生物量）", min: 0, max: 100, step: 5, value: 40, unit: "%", when: (s) => s.mode === 2 },
    { id: "t", label: "干扰后的时间", min: 0, max: 30, step: 1, value: 0, when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "鼠妇的分布"], [1, "生态系统的类型"], [2, "生态系统的稳定性"]] },
    { id: "factor", label: "探究的因素", value: 0, options: Mo.FACTORS.map((f, i) => [i, f[0]] as [number, string]), when: (s) => s.mode === 0 },
  ],
  play: { param: "t", rate: 4 },
  hidden: { ...dndFlags(PFX), seed: 1 },
  actions: [{ id: "again", label: "重新放入鼠妇", run: (s) => (s.mode === 0 ? { seed: s.seed + 1 } : undefined) }],
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => {
    if (s.mode === 1) return dndReadouts(s, MODES[1]!);
    if (s.mode === 2) { const cap = Mo.capacity(s.div), ok = Mo.recovers(s.div, s.dist); return [{ label: "能恢复的最大干扰", value: fmt(cap, 1), unit: "%" }, { label: "这次干扰", value: String(s.dist), unit: "%" }, { label: "结果", value: ok ? "能够恢复" : "难以恢复，生态系统退化" }, { label: "此刻的生物量", value: fmt(Mo.biomass(s.div, s.dist, s.t) * 100, 0), unit: "%" }]; }
    const f = Mo.FACTORS[s.factor], k = Mo.onRight(s.n, s.factor, s.seed);
    return [{ label: "探究的因素", value: f[0] }, { label: f[1], value: String(s.n - k), unit: "只" }, { label: f[2], value: String(k), unit: "只" }, { label: "结论", value: k > s.n - k ? `多数鼠妇聚集在“${f[2]}”的一侧` : k < s.n - k ? `多数鼠妇聚集在“${f[1]}”的一侧` : "两侧一样多" }];
  },
  draw(c, w, h, s) {
    if (s.mode === 1) { drawDnd(c, s, MODES[1]!); return; }
    if (s.mode === 2) {
      const P = axes(c, 60, 50, 380, 300, 30, 100, "t", "biomass %", 0, 5);
      curve(c, P, (t) => Mo.biomass(s.div, s.dist, t) * 100, Mo.recovers(s.div, s.dist) ? COL.green : COL.red, 30, 120, 5);
      line(c, P.X(0), P.Y(100), P.X(30), P.Y(100), COL.grey, 2, [6, 6]); circle(c, P.X(s.t), P.Y(Mo.biomass(s.div, s.dist, s.t) * 100), 9, COL.orange, COL.ink, 3);
      const r = mulberry32(11); for (let i = 0; i < s.div; i++) circle(c, 480 + (i % 5) * 28, 60 + Math.floor(i / 5) * 30, 9, ["#69db7c", "#ffd43b", "#74c0fc", "#ff8787", "#b197fc"][i % 5], COL.ink, 2); void r;
      lab(c, `${s.div}`, 550, 330, 40, COL.purple); lab(c, "species", 550, 366, 15, COL.grey);
      return;
    }
    const f = Mo.FACTORS[s.factor], k = Mo.onRight(s.n, s.factor, s.seed), r = mulberry32(21 + s.seed + s.n);
    rect(c, 40, 60, 560, 300, "#fff", COL.ink, 4, 14);
    const fillA = ["#fff3bf", "#ffe8cc", "#ffd8a8"][s.factor], fillB = ["#868e96", "#a5d8ff", "#a5d8ff"][s.factor];
    c.save(); c.beginPath(); c.roundRect(40, 60, 280, 300, [14, 0, 0, 14]); c.fillStyle = fillA; c.fill(); c.beginPath(); c.roundRect(320, 60, 280, 300, [0, 14, 14, 0]); c.fillStyle = fillB; c.fill(); c.restore();
    line(c, 320, 60, 320, 360, COL.ink, 3, [8, 6]); rect(c, 40, 60, 560, 300, "", COL.ink, 4, 14);
    lab(c, f[1], 180, 86, 20, COL.ink); lab(c, f[2], 460, 86, 20, s.factor === 0 ? "#fff" : COL.ink);
    for (let i = 0; i < s.n; i++) { const right = i < k, x = (right ? 340 : 60) + r() * 240, y = 120 + r() * 220; ell(c, x, y, 11, 6, "#6c757d", COL.ink, 2, r() * 3); }
    lab(c, `${s.n - k}`, 180, 392, 34, COL.ink); lab(c, `${k}`, 460, 392, 34, COL.ink);
  },
  tasks: [
    { id: "dark", text: "用 20 只以上的鼠妇探究光的影响，看到多数鼠妇聚集在阴暗处", check: (s) => s.mode === 0 && s.factor === 0 && s.n >= 20 && Mo.onRight(s.n, 0, s.seed) > s.n / 2 },
    { id: "types", text: "把 8 条描述放进正确的生态系统类型", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
    { id: "resil", text: "物种数 30 以上、干扰 60 % 以上，生态系统仍能恢复", check: (s) => s.mode === 2 && s.div >= 30 && s.dist >= 60 && Mo.recovers(s.div, s.dist) },
    { id: "fragile", text: "物种数不超过 4、干扰 30 % 以上，生态系统难以恢复", check: (s) => s.mode === 2 && s.div <= 4 && s.dist >= 30 && !Mo.recovers(s.div, s.dist) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
