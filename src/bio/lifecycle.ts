import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-lifecycle";
import { COL, lab, txt, ell, rect, circle, arrow } from "./draw";
export const meta = CATALOG.lifecycle;
export const def: SimDef = {
  meta,
  lesson: [
    "昆虫的发育：完全变态经过受精卵、幼虫、蛹、成虫四个时期，幼虫与成虫的形态差别很大（如家蚕、蝴蝶）；不完全变态经过受精卵、若虫、成虫三个时期，若虫与成虫相似（如蝗虫）。",
    "青蛙在水中体外受精，幼体蝌蚪用鳃呼吸，经过变态发育成用肺呼吸的成蛙；鸟类体内受精，卵外有卵壳，胚盘发育成雏鸟，属于不变态。",
  ],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [{ id: "stage", label: "发育阶段", min: 0, max: 3, step: 1, value: 0 }],
  choices: [{ id: "c", label: "动物", value: 0, options: Mo.CYCLES.map((x, i) => [i, x.name] as [number, string]) }],
  play: { param: "stage", rate: 0.7 },
  aspect: 0.5,
  readouts: (s) => { const x = Mo.CYCLES[s.c], st = Mo.stageAt(s.c, s.stage); return [
    { label: "阶段", value: st[0] }, { label: "该阶段的时间", value: String(st[1]), unit: "天" }, { label: "发育方式", value: x.kind }, { label: "受精方式", value: x.fert }]; },
  draw(c, w, h, s) {
    const x = Mo.CYCLES[s.c], n = x.stages.length;
    x.stages.forEach((st, i) => {
      const cx = 70 + i * (500 / (n - 1)), cur = Math.min(s.stage, n - 1) === i;
      rect(c, cx - 62, 60, 124, 150, cur ? "#fff3bf" : "#f8f9fa", cur ? COL.orange : COL.grey, cur ? 5 : 2, 16);
      const col = ["#ffe066", "#8ce99a", "#d9a066", "#74c0fc"][i];
      if (st[0] === "受精卵") circle(c, cx, 130, 18, "#fff9db", COL.ink, 3);
      else if (st[0] === "蛹") ell(c, cx, 130, 16, 34, "#a9815a", COL.ink, 3);
      else if (st[0] === "蝌蚪") { ell(c, cx - 6, 130, 22, 14, "#495057", COL.ink, 3); c.beginPath(); c.moveTo(cx + 16, 130); c.quadraticCurveTo(cx + 34, 118, cx + 44, 132); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke(); }
      else { ell(c, cx, 130, 14 + i * 7, 10 + i * 4, col, COL.ink, 3); }
      lab(c, st[0], cx, 188, 18, COL.ink); txt(c, `${st[1]}`, cx, 228, 16, COL.grey);
      if (i < n - 1) arrow(c, cx + 64, 135, cx + 500 / (n - 1) - 66, 135, COL.grey, 3);
    });
    lab(c, x.kind, 20, 24, 20, COL.purple, "left");
  },
  tasks: [
    { id: "pupa", text: "选择家蚕，找到不吃不动的蛹期", check: (s) => s.c === 1 && s.stage === 2 },
    { id: "nymph", text: "选择蝗虫，找到与成虫相似的若虫期", check: (s) => s.c === 0 && s.stage === 1 },
    { id: "tadpole", text: "选择青蛙，找到用鳃呼吸的蝌蚪期", check: (s) => s.c === 2 && s.stage === 1 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
