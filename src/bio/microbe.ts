import { mountBio, type SimDef, type PhysCtx, fmt, mulberry32 } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-microbe";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, leaders, type DMode } from "./match";
import { COL, lab, ell, rect, circle, line } from "./draw";
export const meta = CATALOG.microbe;
type S = Record<string, number>;
export const BACT_MARKS: [number, number][] = [[230, 130], [230, 352], [150, 352], [310, 352], [60, 200], [430, 150]];
export const BACT_PTS: [number, number][] = [[230, 210], [230, 290], [150, 262], [250, 256], [72, 236], [420, 196]];
export const YEAST_MARKS: [number, number][] = [[190, 130], [50, 250], [110, 352], [200, 352], [300, 352], [390, 150]];
export const YEAST_PTS: [number, number][] = [[190, 174], [108, 250], [160, 240], [236, 234], [225, 282], [330, 206]];
export const MODES: (DMode | null)[] = [null,
  { kind: "label", prefix: "b", items: Mo.BACT.map((x) => x.name), marks: BACT_MARKS, fn: Mo.BACT.map((x) => x.fn) },
  { kind: "label", prefix: "y", items: Mo.YEAST.map((x) => x.name), marks: YEAST_MARKS, fn: Mo.YEAST.map((x) => x.fn) }, null];
const PFX = ["b", "y"];
const modeOf = (s: S) => MODES[s.mode];
export const mu = (s: S) => Mo.expected(s.c0, s.dil, s.vol);
export const nCol = (s: S) => Mo.colonies(mu(s), s.seed + s.dil * 31 + Math.round(s.c0 * 10));
export const def: SimDef = {
  meta,
  lesson: [
    "培养细菌和真菌时，把菌液逐级稀释（每次稀释 10 倍），取一定体积涂在培养基上，每个活的细菌或孢子会长成一个肉眼可见的菌落。数出菌落数，就能估算原菌液中的细菌数：每毫升的细菌数 = 菌落数 ÷ 涂布体积 × 稀释倍数。菌落数在 30–300 个之间的平板最适合计数。",
    "细菌没有成形的细胞核，只有 DNA 集中的区域，属于原核生物；酵母菌等真菌有成形的细胞核。抗生素只能杀死细菌，对病毒无效；不必要或不按疗程用药，会使耐药细菌在群体中的比例越来越大。（耐药模型是简化的教学模型。）",
  ],
  links: [{ text: "相关：微生物与发酵", href: "#/science/bio/ferment" }, { text: "相关：生物的分类", href: "#/science/bio/classify" }],
  params: [
    { id: "c0", label: "原菌液浓度（10 的次方，个/mL）", min: 3, max: 9, step: 1, value: 7, when: (s) => s.mode === 0 },
    { id: "dil", label: "稀释次数（每次 10 倍）", min: 0, max: 8, step: 1, value: 0, when: (s) => s.mode === 0 },
    { id: "courses", label: "用药次数", min: 0, max: 6, step: 1, value: 0, when: (s) => s.mode === 3 },
    { id: "kill", label: "每次杀死的敏感菌", min: 50, max: 99, step: 1, value: 90, unit: "%", when: (s) => s.mode === 3 },
    { id: "r0", label: "开始时耐药菌所占比例", min: 1, max: 50, step: 1, value: 1, unit: "‰", when: (s) => s.mode === 3 },
  ],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "菌落计数"], [1, "细菌的结构"], [2, "酵母菌的结构"], [3, "抗生素与耐药"]] },
    { id: "vol", label: "涂布体积", value: 0.1, options: [[0.1, "0.1 mL"], [0.5, "0.5 mL"], [1, "1 mL"]], when: (s) => s.mode === 0 },
    { id: "inf", label: "感染类型", value: 0, options: [[0, "细菌感染"], [1, "病毒感染（流感）"]], when: (s) => s.mode === 3 },
  ],
  hidden: { ...dndFlags(PFX), seed: 1 },
  actions: [{ id: "replate", label: "重新涂布", run: (s) => (s.mode === 0 ? { seed: s.seed + 1 } : undefined) }],
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => {
    if (s.mode === 0) { const n = nCol(s), st = Mo.plateState(mu(s), n);
      return [{ label: "总稀释倍数", value: Mo.pow10(s.dil) }, { label: "平板上的菌落数", value: st === 0 ? "> 300" : String(n) }, { label: "计数结论", value: Mo.PLATE_TEXT[st] },
        { label: "估算原菌液浓度", value: st === 1 ? Mo.sci(Mo.estimate(n, s.dil, s.vol)) : "—", unit: st === 1 ? "/mL" : "" }, { label: "设定的实际浓度", value: Mo.pow10(s.c0), unit: "/mL" }]; }
    if (s.mode === 3) { const R = Mo.resistFrac(s.r0 / 1000, s.kill / 100, s.courses), virus = s.inf === 1;
      return [{ label: "用药次数", value: String(s.courses) }, { label: "耐药菌所占比例", value: fmt(R * 100, 1), unit: "%" }, { label: "敏感菌所占比例", value: fmt((1 - R) * 100, 1), unit: "%" },
        { label: "抗生素对病原体", value: virus ? "无效（病毒没有细胞结构）" : "有效（杀死敏感菌）" }]; }
    return dndReadouts(s, modeOf(s)!);
  },
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const n = nCol(s), m = mu(s), st = Mo.plateState(m, n);
      circle(c, 175, 215, 135, "#fff9db", COL.ink, 4); circle(c, 175, 215, 122, "#fff3bf", "#e8c55a", 2);
      const r = mulberry32(5 + s.seed * 13 + s.dil), k = st === 0 ? 700 : Math.min(n, 300);
      for (let i = 0; i < k; i++) { const a = r() * 6.283, d = Math.sqrt(r()) * 112; circle(c, 175 + d * Math.cos(a), 215 + d * Math.sin(a), st === 0 ? 4 : 3.4, "#fff", "#c9a227", 1.2); }
      lab(c, st === 0 ? "无法计数" : `${n}`, 175, 215, st === 0 ? 20 : 34, st === 0 ? COL.red : "rgba(45,34,48,0.7)");
      lab(c, "培养皿", 175, 372, 16, COL.grey);
      for (let i = 0; i <= Math.min(s.dil, 8); i++) {
        const x = 340 + 36 * i;
        rect(c, x - 11, 70, 22, 90, `rgba(116,192,252,${Math.max(0.15, 0.95 - 0.11 * i)})`, COL.ink, 3, 8); lab(c, Mo.pow10(s.c0 - i), x, 56, 11, COL.grey);
      }
      lab(c, `${s.vol} mL`, 470, 220, 18, COL.ink); line(c, 340 + 36 * Math.min(s.dil, 8), 165, 300, 260, COL.grey, 3, [6, 6]);
      lab(c, "逐级稀释", 470, 22, 16, COL.grey);
      return;
    }
    if (s.mode === 1) {
      rect(c, 70, 190, 320, 120, "#fff3bf", "#e8c55a", 3, 60); rect(c, 86, 206, 288, 88, "#ffd8a8", COL.ink, 4, 44); rect(c, 94, 214, 272, 72, "#d3f9d8", "#2b8a3e", 3, 36);
      c.beginPath(); c.moveTo(205, 250); c.bezierCurveTo(215, 232, 235, 270, 245, 250); c.bezierCurveTo(255, 236, 240, 266, 262, 256); c.strokeStyle = COL.purple; c.lineWidth = 4; c.stroke();
      c.beginPath(); c.moveTo(390, 250); c.bezierCurveTo(420, 230, 400, 210, 430, 196); c.bezierCurveTo(450, 180, 430, 170, 440, 160); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
      leaders(c, BACT_MARKS, BACT_PTS);
      lab(c, "细菌（示意图）", 20, 22, 17, COL.grey, "left");
    } else if (s.mode === 2) {
      ell(c, 190, 250, 90, 76, "#ffe8cc", COL.ink, 6); ell(c, 190, 250, 82, 68, "#fff9db", "#f08c00", 3); ell(c, 330, 205, 40, 34, "#fff9db", COL.ink, 4);
      circle(c, 160, 240, 22, COL.nucleus, COL.ink, 3); circle(c, 225, 272, 22, "#d0ebff", "#4dabf7", 3);
      leaders(c, YEAST_MARKS, YEAST_PTS);
      lab(c, "酵母菌（示意图）", 20, 22, 17, COL.grey, "left");
    } else {
      const R = Mo.resistFrac(s.r0 / 1000, s.kill / 100, s.courses), n = 200, r = mulberry32(3);
      rect(c, 40, 50, 560, 250, "#f8f9fa", COL.grey, 3, 16);
      const nr = Math.max(s.r0 > 0 ? 1 : 0, Math.round(R * n));
      for (let i = 0; i < n; i++) { const res = i < nr; circle(c, 60 + r() * 520, 70 + r() * 210, 7, res ? COL.red : "#69db7c", COL.ink, 1.5); }
      lab(c, "敏感菌", 120, 330, 18, COL.green); circle(c, 70, 330, 8, "#69db7c", COL.ink, 1.5); lab(c, "耐药菌", 290, 330, 18, COL.red); circle(c, 240, 330, 8, COL.red, COL.ink, 1.5);
      lab(c, `${fmt(R * 100, 1)} %`, 480, 332, 28, COL.red);
    }
    if (s.mode === 1 || s.mode === 2) drawDnd(c, s, modeOf(s)!);
  },
  tasks: [
    { id: "valid", text: "稀释并涂布，使平板上的菌落数在 30–300 个之间（适合计数）", check: (s) => s.mode === 0 && Mo.plateState(mu(s), nCol(s)) === 1 },
    { id: "bact", text: "给细菌的 6 个结构全部放对位置", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
    { id: "yeast", text: "给酵母菌的 6 个结构全部放对位置", check: (s) => s.mode === 2 && allPlaced(s, MODES[2]!) },
    { id: "resist", text: "用 90 % 的杀菌效果连续用药 4 次，使耐药菌占 50 % 以上", check: (s) => s.mode === 3 && s.inf === 0 && Mo.resistFrac(s.r0 / 1000, s.kill / 100, s.courses) >= 0.5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
