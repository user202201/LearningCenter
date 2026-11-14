import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-bones";
import { COL, lab, txt, rect, ell, line } from "./draw";
export const meta = CATALOG.bones;
export const def: SimDef = {
  meta,
  lesson: [
    "骨由骨膜、骨质和骨髓组成；骨的成分有有机物（使骨有弹性）和无机物（使骨坚硬）。儿童的骨有机物多，柔韧、易变形；成年人的有机物和无机物约 1 : 2，既坚硬又有弹性；老年人的骨无机物多，脆、易骨折。",
    "实验：把骨放在酒精灯上煅烧，有机物被烧掉，骨变脆、一碰就碎；把骨浸在稀盐酸中，无机盐被溶解，骨变软、可以弯曲。关节由关节面、关节囊和关节腔组成。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [{ id: "age", label: "年龄", min: 5, max: 80, step: 5, value: 20, unit: "岁" }],
  choices: [{ id: "t", label: "处理", value: 0, options: Mo.TREAT.map((x, i) => [i, x] as [number, string]) }],
  aspect: 0.5,
  readouts: (s) => [
    { label: "有机物所占比例", value: fmt(Mo.organic(s.age) * 100, 0), unit: "%" }, { label: "无机物所占比例", value: fmt(100 - Mo.organic(s.age) * 100, 0), unit: "%" },
    { label: "骨的特点", value: Mo.RESULT[s.t === 0 ? 0 : s.t] }, { label: "弯曲程度", value: fmt(Mo.bend(s.age, s.t) * 100, 0), unit: "%" }],
  draw(c, w, h, s) {
    const o = Mo.organic(s.age), b = Mo.bend(s.age, s.t);
    rect(c, 60, 60, 220, 40, "#f1f3f5", COL.grey, 2, 10); rect(c, 62, 62, 216 * o, 36, "#ffa94d", null, 0, 8); lab(c, "有机物", 70, 80, 15, COL.ink, "left"); lab(c, "无机物", 270, 80, 15, COL.ink, "right");
    c.save(); c.translate(150, 230); c.rotate(-b * 0.5); rect(c, -110, -14, 220, 28, s.t === 1 ? "#e9ecef" : s.t === 2 ? "#ffe8cc" : "#fff3e0", COL.ink, 4, 14); ell(c, -118, 0, 20, 22, s.t === 1 ? "#e9ecef" : "#fff3e0", COL.ink, 4); ell(c, 118, 0, 20, 22, s.t === 1 ? "#e9ecef" : "#fff3e0", COL.ink, 4); c.restore();
    if (s.t === 1) { line(c, 130, 200, 120, 250, COL.red, 3); lab(c, "易碎", 330, 230, 22, COL.red, "left"); } else if (s.t === 2) lab(c, "可弯曲", 330, 230, 22, COL.green, "left"); else lab(c, "坚硬又有弹性", 330, 230, 20, COL.purple, "left");
    txt(c, "", 0, 0, 1, COL.ink);
  },
  tasks: [
    { id: "burn", text: "选择煅烧：骨变脆，一碰就碎", check: (s) => s.t === 1 },
    { id: "acid", text: "选择盐酸浸泡：骨变软，可以弯曲", check: (s) => s.t === 2 },
    { id: "young", text: "不处理，年龄调到 10 岁以下：有机物约占一半，骨弹性大", check: (s) => s.t === 0 && s.age <= 10 && Mo.organic(s.age) >= 0.5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
