import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-seedlab";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, leaders, type DMode } from "./match";
import { COL, lab, rect, circle, ell } from "./draw";
import { mulberry32 } from "../phys/qtools";
export const meta = CATALOG.seedlab;
export const BEAN_MARKS: [number, number][] = [[50, 160], [300, 410], [400, 300], [330, 130], [400, 200]];
export const BEAN_PTS: [number, number][] = [[86, 255], [230, 338], [230, 300], [232, 210], [300, 250]];
export const MAIZE_MARKS: [number, number][] = [[330, 100], [400, 250], [330, 400], [60, 200], [60, 290], [60, 380]];
export const MAIZE_PTS: [number, number][] = [[290, 129], [280, 230], [205, 305], [166, 236], [164, 292], [166, 345]];
export const MODES: (DMode | null)[] = [
  { kind: "label", prefix: "b", items: Mo.BEAN.map((x) => x.name), marks: BEAN_MARKS, fn: Mo.BEAN.map((x) => x.fn) },
  { kind: "label", prefix: "m", items: Mo.MAIZE.map((x) => x.name), marks: MAIZE_MARKS, fn: Mo.MAIZE.map((x) => x.fn) }, null, null];
const PFX = ["b", "m"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
export const def: SimDef = {
  meta,
  lesson: [
    "菜豆种子（双子叶植物）由种皮和胚组成，胚包括胚芽、胚轴、胚根和两片子叶，营养物质储存在子叶里；玉米种子（单子叶植物）由果皮和种皮、胚和胚乳组成，胚中只有一片子叶，营养物质储存在胚乳里。淀粉遇碘变成蓝色，可以检验营养物质的储存部位。",
    "种子的萌发率 = 萌发的种子数 ÷ 供试种子数 × 100 %。测定时要随机取样，每组种子数量要足够多，并重复做几组取平均值，才能减小误差。本模型每组种子是否萌发由这批种子的真实萌发率决定。（以 90 % 作为合格线，是教学假设。）",
  ],
  links: [{ text: "相关：种子萌发的条件", href: "#/science/bio/seed" }],
  params: [
    { id: "n", label: "每组种子数", min: 10, max: 200, step: 10, value: 20, unit: "粒", when: (s) => s.mode === 3 },
    { id: "lot", label: "这批种子的真实萌发率", min: 50, max: 100, step: 5, value: 90, unit: "%", when: (s) => s.mode === 3 },
  ],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "菜豆种子的结构"], [1, "玉米种子的结构"], [2, "碘液检验淀粉"], [3, "测定萌发率"]] },
    { id: "seed", label: "种子", value: 0, options: [[0, "菜豆种子"], [1, "玉米种子"]], when: (s) => s.mode === 2 },
    { id: "part", label: "滴碘液的部位", value: 0, options: [[0, "外面的种皮"], [1, "储存营养的部分"], [2, "胚"]], when: (s) => s.mode === 2 },
  ],
  hidden: { ...dndFlags(PFX), seed2: 1 },
  actions: [{ id: "resample", label: "重新取样", run: (s) => (s.mode === 3 ? { seed2: s.seed2 + 1 } : undefined) }],
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => {
    if (s.mode === 2) { const b = Mo.blue(s.seed, s.part); return [{ label: "种子", value: Mo.SEEDS[s.seed] }, { label: "滴碘液的部位", value: Mo.PARTS[s.seed][s.part] }, { label: "现象", value: Mo.IODINE_TEXT[b ? 1 : 0] }]; }
    if (s.mode === 3) { const ks = Mo.groups(s.n, s.lot, s.seed2), avg = Mo.average(ks, s.n);
      return [{ label: "三组萌发的种子数", value: ks.join(" / ") }, { label: "平均萌发率", value: fmt(avg, 1), unit: "%" }, { label: "这批种子的真实萌发率", value: String(s.lot), unit: "%" }, { label: "误差", value: fmt(Math.abs(avg - s.lot), 1), unit: "%" }, { label: "判断", value: avg >= Mo.PASS ? "合格（不低于 90 %）" : "不合格（低于 90 %）" }]; }
    return dndReadouts(s, modeOf(s)!);
  },
  draw(c, w, h, s) {
    if (s.mode === 0) {
      ell(c, 230, 255, 152, 100, "#d9a066", COL.ink, 4); ell(c, 160, 255, 70, 82, "#ffe8a3", COL.ink, 3); ell(c, 300, 255, 70, 82, "#ffe8a3", COL.ink, 3);
      rect(c, 225, 288, 10, 46, "#ffa94d", COL.ink, 2, 4); ell(c, 230, 342, 9, 14, "#d9a066", COL.ink, 2.5); ell(c, 232, 214, 12, 26, "#51cf66", COL.ink, 2.5);
      leaders(c, BEAN_MARKS, BEAN_PTS); lab(c, "菜豆种子（打开）", 20, 22, 17, COL.grey, "left");
    } else if (s.mode === 1) {
      ell(c, 230, 250, 120, 140, "#ffe066", COL.ink, 4); ell(c, 255, 235, 78, 112, "#fff9db", "#f08c00", 3); ell(c, 172, 296, 38, 62, "#ffd43b", COL.ink, 3);
      ell(c, 166, 246, 8, 18, "#51cf66", COL.ink, 2.5); rect(c, 160, 270, 8, 50, "#ffa94d", COL.ink, 2, 3); ell(c, 166, 342, 9, 16, "#d9a066", COL.ink, 2.5);
      leaders(c, MAIZE_MARKS, MAIZE_PTS); lab(c, "玉米种子（纵切面）", 20, 22, 17, COL.grey, "left");
    } else if (s.mode === 2) {
      const b = Mo.blue(s.seed, s.part);
      rect(c, 60, 70, 340, 250, "#f8f9fa", COL.grey, 3, 20);
      Mo.PARTS[s.seed].forEach((nm, i) => { const x = 130 + 110 * i, sel = i === s.part, col = sel && b ? "#3b2f6b" : ["#d9a066", "#ffe8a3", "#8ce99a"][i]; rect(c, x - 44, 140, 88, 100, col, sel ? COL.orange : COL.ink, sel ? 5 : 3, 16); lab(c, nm, x, 270, 16, sel ? COL.orange : COL.ink); });
      const dx = 130 + 110 * s.part; c.beginPath(); c.moveTo(dx, 104); c.bezierCurveTo(dx - 10, 124, dx - 12, 134, dx, 134); c.bezierCurveTo(dx + 12, 134, dx + 10, 124, dx, 104); c.fillStyle = "#c2255c"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 3; c.stroke();
      lab(c, b ? "变蓝" : "不变蓝", 230, 350, 30, b ? COL.purple : COL.grey);
      lab(c, Mo.SEEDS[s.seed], 20, 22, 17, COL.grey, "left");
    } else {
      const ks = Mo.groups(s.n, s.lot, s.seed2), avg = Mo.average(ks, s.n);
      ks.forEach((k, g) => {
        const x0 = 24 + 200 * g; rect(c, x0, 44, 190, 190, "#fff9db", COL.ink, 3, 14);
        const per = Math.max(1, Math.ceil(Math.sqrt(s.n))), step = 160 / per;
        for (let i = 0; i < s.n; i++) circle(c, x0 + 15 + step * (i % per) + step / 2, 59 + step * Math.floor(i / per) + step / 2, Math.min(7, step * 0.34), i < k ? "#69db7c" : "#d9a066", COL.ink, 1.2);
        lab(c, `${k} / ${s.n}`, x0 + 95, 258, 20);
      });
      lab(c, `${fmt(avg, 1)} %`, 320, 340, 48, avg >= Mo.PASS ? COL.green : COL.red); lab(c, "平均萌发率", 320, 392, 18, COL.grey);
      circle(c, 40, 440, 7, "#69db7c", COL.ink, 1.2); lab(c, "已萌发", 62, 440, 15, COL.grey, "left"); circle(c, 170, 440, 7, "#d9a066", COL.ink, 1.2); lab(c, "未萌发", 192, 440, 15, COL.grey, "left");
      void mulberry32; return;
    }
    if (s.mode < 2) drawDnd(c, s, modeOf(s)!);
  },
  tasks: [
    { id: "bean", text: "给菜豆种子的 5 个结构全部放对位置", check: (s) => s.mode === 0 && allPlaced(s, MODES[0]!) },
    { id: "maize", text: "给玉米种子的 6 个结构全部放对位置", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
    { id: "iodine", text: "在玉米种子的胚乳上滴碘液，看到变蓝", check: (s) => s.mode === 2 && s.seed === 1 && s.part === 1 },
    { id: "sample", text: "每组取 100 粒以上的种子测定萌发率", check: (s) => s.mode === 3 && s.n >= 100 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
