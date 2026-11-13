import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-foodweb";
import { COL, lab, txt, circle, line, arrow, rect, ell } from "./draw";
export const meta = CATALOG.foodweb;
export const POS: [number, number][] = [[320, 375], [90, 300], [270, 300], [470, 300], [90, 205], [230, 170], [540, 205], [320, 50]];
const FILL = ["#8ce99a", "#ffe066", "#ffd8a8", "#ced4da", "#b2f2bb", "#74c0fc", "#ffa94d", "#e599f7"];
const R = 30;
type S = Record<string, number>;
const built = (s: S) => Mo.LINKS.map((_, k) => k).filter((k) => s[`l${k}`]);
const removed = (s: S) => Mo.SPECIES.map((_, i) => i).filter((i) => s[`rm${i}`]);
const full = (s: S) => built(s).length === Mo.LINKS.length;
const hidden: S = { h: -1, hx: 0, hy: 0, mv: 0, miss: 0 };
for (let k = 0; k < Mo.LINKS.length; k++) hidden[`l${k}`] = 0;
for (let i = 0; i < Mo.SPECIES.length; i++) hidden[`rm${i}`] = 0;
const near = (x: number, y: number) => POS.findIndex(([px, py]) => Math.hypot(x - px, y - py) <= R + 10);
export const def: SimDef = {
  meta,
  lesson: [
    "生态系统由非生物部分（阳光、空气、水、土壤等）和生物部分组成。生物部分包括生产者（绿色植物）、消费者（动物）和分解者（细菌、真菌）。食物链从生产者开始，箭头指向捕食者；多条食物链交错成食物网。",
    "能量沿食物链单向流动、逐级递减，传递效率约为 10%–20%，所以食物链一般不超过 5 个营养级。有毒物质（如 DDT）在生物体内难以分解，会沿食物链逐级积累，营养级越高，浓度越大。物质循环则是反复利用的。",
    "“食物网”：从被吃的生物拖到吃它的生物，连上箭头；点一下某个生物，把它从网中移走，看哪些生物受到影响。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "E0", label: "生产者固定的能量", min: 1000, max: 100000, step: 1000, value: 10000, unit: "kJ", when: (s) => s.mode === 1 },
    { id: "eta", label: "能量传递效率", min: 5, max: 20, step: 1, value: 10, unit: "%", when: (s) => s.mode === 1 },
    { id: "c0", label: "生产者体内的毒物浓度", min: 0.01, max: 0.1, step: 0.01, value: 0.02, unit: "ppm", dec: 2, when: (s) => s.mode === 2 },
    { id: "f", label: "每升高一个营养级浓度增大", min: 2, max: 10, step: 1, value: 5, unit: "倍", when: (s) => s.mode === 2 },
    { id: "lv", label: "营养级数", min: 2, max: 5, step: 1, value: 4, when: (s) => s.mode > 0 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "食物网"], [1, "能量流动"], [2, "有毒物质积累"]] }],
  hidden,
  drag: true,
  aspect: 0.66,
  derive: () => undefined,
  pointer: (kind, x, y, s) => {
    if (s.mode !== 0) return;
    if (kind === "down") { const i = near(x, y); return i >= 0 ? { h: i, hx: x, hy: y, mv: 0 } : undefined; }
    if (kind === "move") return s.h >= 0 ? { hx: x, hy: y, mv: 1 } : undefined;
    if (s.h < 0) return;
    const i = s.h, j = near(x, y);
    if (j < 0) return { h: -1, mv: 0 };
    if (j === i) return { h: -1, mv: 0, [`rm${i}`]: s[`rm${i}`] ? 0 : 1 };
    const k = Mo.LINKS.findIndex(([a, b]) => a === i && b === j);
    return { h: -1, mv: 0, ...(k >= 0 ? { [`l${k}`]: 1 } : { miss: s.miss + 1 }) };
  },
  readouts: (s) => {
    if (s.mode === 0) { const rm = Mo.removal(removed(s)); return [
      { label: "已连好的捕食关系", value: `${built(s).length} / ${Mo.LINKS.length}` }, { label: "已连成的食物链", value: String(Mo.chains(built(s)).length), unit: "条" },
      { label: "失误", value: String(s.miss), unit: "次" }, { label: "数量减少 / 增加的物种", value: `${rm.down.length} / ${rm.up.length}` }]; }
    if (s.mode === 1) return [{ label: "最高营养级的能量", value: fmt(Mo.energyAt(s.E0, s.eta, s.lv), 1), unit: "kJ" }, { label: "占生产者能量的", value: fmt(Mo.energyAt(100, s.eta, s.lv), 3), unit: "%" }];
    return [{ label: "最高营养级的浓度", value: fmt(Mo.concAt(s.c0, s.f, s.lv), 2), unit: "ppm" }, { label: "是生产者的", value: fmt(s.f ** (s.lv - 1), 0), unit: "倍" }];
  },
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const rm = new Set(removed(s)), ef = Mo.removal(removed(s));
      for (const k of built(s)) { const [a, b] = Mo.LINKS[k]; const [ax, ay] = POS[a], [bx, by] = POS[b], d = Math.hypot(bx - ax, by - ay); arrow(c, ax + ((bx - ax) / d) * R, ay + ((by - ay) / d) * R, bx - ((bx - ax) / d) * (R + 4), by - ((by - ay) / d) * (R + 4), rm.has(a) || rm.has(b) ? "#ced4da" : COL.grey, 3); }
      Mo.SPECIES.forEach((nm, i) => {
        const [x, y] = POS[i], gone = rm.has(i);
        circle(c, x, y, R, gone ? "#f1f3f5" : FILL[i], s.h === i ? COL.orange : gone ? "#ced4da" : COL.ink, s.h === i ? 5 : 3); lab(c, nm, x, y, 20, gone ? "#adb5bd" : COL.ink);
        if (ef.down.includes(i)) txt(c, "↓", x + R - 2, y - R + 4, 24, COL.red); if (ef.up.includes(i)) txt(c, "↑", x + R - 2, y - R + 4, 24, COL.green);
      });
      if (s.h >= 0 && s.mv) { const [x, y] = POS[s.h]; line(c, x, y, s.hx, s.hy, COL.orange, 3, [6, 5]); }
      lab(c, full(s) ? "点一下生物：移走它" : "拖动：从被吃的生物到吃它的生物", 16, 20, 17, COL.grey, "left");
    } else {
      const n = s.lv, w0 = 420;
      for (let k = 1; k <= n; k++) {
        const wk = w0 * (1 - (k - 1) / (n + 0.5)), y = 330 - (k - 1) * (260 / n), hh = 260 / n - 6;
        const val = s.mode === 1 ? `${fmt(Mo.energyAt(s.E0, s.eta, k), 1)} kJ` : `${fmt(Mo.concAt(s.c0, s.f, k), 2)} ppm`;
        rect(c, 320 - wk / 2, y - hh, wk, hh, s.mode === 1 ? `hsl(${130 - k * 22} 60% 70%)` : `hsl(${30 - k * 6} 80% ${75 - k * 6}%)`, COL.ink, 3, 8); txt(c, val, 320, y - hh / 2, 18, COL.ink);
        txt(c, `L${k}`, 320 - wk / 2 - 24, y - hh / 2, 16, COL.grey);
      }
      lab(c, s.mode === 1 ? "能量沿食物链逐级递减" : "毒物沿食物链逐级积累", 320, 24, 20, COL.purple); void ell;
    }
  },
  tasks: [
    { id: "web", text: "连好食物网中全部 11 条捕食关系", check: (s) => s.mode === 0 && full(s) },
    { id: "snake", text: "连好整个食物网后，点一下“蛇”把它移走：蛙的数量会增加", check: (s) => s.mode === 0 && full(s) && s.rm5 === 1 && Mo.removal(removed(s)).up.includes(4) },
    { id: "pyr", text: "营养级数设为 5，传递效率 10%：最高营养级只得到生产者能量的 0.01%", check: (s) => s.mode === 1 && s.lv === 5 && s.eta === 10 },
    { id: "ddt", text: "毒物积累：使最高营养级的浓度达到生产者的 1000 倍以上", check: (s) => s.mode === 2 && s.f ** (s.lv - 1) >= 1000 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
