import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-behaviour";
import { dndInit, dndPointer, placedCount, type DndSpec } from "./dnd";
import { COL, lab, txt, circle, rect, axes, curve } from "./draw";
export const meta = CATALOG.behaviour;
const colX = (j: number) => 110 + 210 * j;
const slot = (i: number): [number, number] => [66 + 127 * (i % 5), 262 + 70 * Math.floor(i / 5)];
export const spec: DndSpec = { n: 10, prefix: "bh", hit: [62, 30], at: (i) => slot(i), answer: (i) => Mo.ITEMS[i][1], targets: () => Mo.CLASSES.map((_, j) => ({ x: colX(j), y: 118, hw: 100, hh: 70 })) };
export const def: SimDef = {
  meta,
  lesson: [
    "动物的行为按获得的途径分为先天性行为（生来就有，由遗传物质决定，如蜘蛛结网）和学习行为（在遗传因素的基础上，通过生活经验和学习获得，如黑猩猩钓白蚁）。学习行为需要大脑皮层的参与，动物越高等，学习能力越强。",
    "社会行为：群体内形成一定的组织，成员间有明确分工，有的有等级次序（如蚂蚁、蜜蜂、狒狒），常靠动作、声音、气味等传递信息。把行为拖到所属的类别，再比较不同动物的学习曲线。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [{ id: "n", label: "练习的次数", min: 0, max: 200, step: 5, value: 0, when: (s) => s.mode === 1 }],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "行为分类"], [1, "学习曲线"]] }, { id: "a", label: "动物", value: 0, options: Mo.ANIMALS.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 1 }],
  hidden: { ...dndInit(10, "bh") },
  drag: true,
  play: { param: "n", rate: 40 },
  aspect: 0.66,
  pointer: (kind, x, y, s) => (s.mode === 0 ? dndPointer(spec)(kind, x, y, s) : undefined),
  derive: (s, ch) => { if (ch === "mode") { s.h = -1; s.sel = -1; } },
  readouts: (s) => s.mode === 0 ? [{ label: "已放对", value: `${placedCount(s, 10, "bh")} / 10` }, { label: "失误", value: String(s.miss), unit: "次" }, { label: "行为总数", value: "10" }] : [
    { label: "学习速度系数 k", value: String(Mo.ANIMALS[s.a][1]) },
    { label: "错误率", value: fmt(Mo.errors(s.n, Mo.ANIMALS[s.a][1]), 0), unit: "%" }, { label: "错误率降到 20 % 以下需要", value: String(Mo.trialsTo(Mo.ANIMALS[s.a][1], 20)), unit: "次" }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      Mo.CLASSES.forEach((nm, j) => { rect(c, colX(j) - 100, 48, 200, 140, "#f3f0ff", COL.grey, 2, 14); lab(c, nm, colX(j), 66, 18, COL.purple); let k = 0; for (let i = 0; i < 10; i++) if (s[`bh${i}`] && Mo.ITEMS[i][1] === j) { lab(c, Mo.ITEMS[i][0], colX(j), 94 + 22 * k, 14, "#1b7a32"); k++; } });
      for (let i = 0; i < 10; i++) { if (s[`bh${i}`] || s.h === i) continue; const [x, y] = slot(i); rect(c, x - 60, y - 28, 120, 56, s.sel === i ? "#fff3bf" : "#fff", s.sel === i ? COL.orange : COL.nucleus, 3, 12); lab(c, Mo.ITEMS[i][0], x, y, Mo.ITEMS[i][0].length > 7 ? 12 : 15); }
      if (s.h >= 0) { rect(c, s.hx - 60, s.hy - 28, 120, 56, "#ffe8cc", COL.orange, 4, 12); lab(c, Mo.ITEMS[s.h][0], s.hx, s.hy, 14); }
    } else {
      const P = axes(c, 60, 40, 540, 290, 200, 100, "trials", "err %", 0, 4);
      Mo.ANIMALS.forEach(([nm, k], i) => { curve(c, P, (x) => Mo.errors(x, k), [COL.green, COL.blue, COL.red][i], 200, 100, s.a === i ? 6 : 2); lab(c, nm, 540, 70 + i * 24, 16, [COL.green, COL.blue, COL.red][i], "right"); });
      circle(c, P.X(s.n), P.Y(Mo.errors(s.n, Mo.ANIMALS[s.a][1])), 8, COL.orange, COL.ink, 3); txt(c, "", 0, 0, 1, COL.ink);
    }
  },
  tasks: [
    { id: "sort", text: "把 10 种行为全部放进正确的类别", check: (s) => s.mode === 0 && placedCount(s, 10, "bh") === 10 },
    { id: "slow", text: "蚯蚓练习 60 次后，错误率仍高于 40 %", check: (s) => s.mode === 1 && s.a === 0 && s.n >= 60 && Mo.errors(s.n, 0.01) > 40 },
    { id: "fast", text: "黑猩猩只练习 20 次以内，错误率就降到 20 % 以下", check: (s) => s.mode === 1 && s.a === 2 && s.n > 0 && s.n <= 20 && Mo.errors(s.n, 0.2) < 20 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
