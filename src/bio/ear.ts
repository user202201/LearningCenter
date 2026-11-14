import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-ear";
import { COL, lab, txt, circle, ell, rect, arrow, axes, curve } from "./draw";
export const meta = CATALOG.ear;
export const def: SimDef = {
  meta,
  lesson: [
    "声波经外耳道传到鼓膜，引起鼓膜振动；振动通过听小骨传到内耳，刺激耳蜗内的听觉感受器，产生神经冲动；神经冲动经听神经传到大脑皮层的听觉中枢，形成听觉。前庭和半规管与身体平衡有关；咽鼓管连通鼓室和咽部。",
    "人耳能听到约 20 Hz–20 kHz 的声音，随年龄增长高频听力会下降。长时间接触过强的声音会损伤听觉：声音每增加 3 dB，安全的聆听时间减半。保护听力：不长时间戴耳机、音量不要过大、不用尖锐的东西掏耳朵。",
  ],
  links: [{ text: "相关：物理实验室·声音的三要素", href: "#/science/physics/sound" }, { text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "age", label: "年龄", min: 5, max: 70, step: 5, value: 10, unit: "岁", when: (s) => s.mode === 0 },
    { id: "f", label: "声音的频率", min: 100, max: 20000, step: 100, value: 1000, unit: "Hz", when: (s) => s.mode === 0 },
    { id: "db", label: "声音的强度", min: 40, max: 120, step: 1, value: 70, unit: "dB", when: (s) => s.mode === 0 },
    { id: "part", label: "声音传到的部位", min: 0, max: 5, step: 1, value: 0, when: (s) => s.mode === 1 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "听力范围与保护"], [1, "声音在耳中的传导"]] }],
  play: { param: "part", rate: 0.9 },
  aspect: 0.55,
  readouts: (s) => s.mode === 0 ? [
    { label: "能否听到", value: Mo.audible(s.f, s.age) ? "能" : "不能" }, { label: "此年龄听到的最高频率", value: fmt(Mo.upperLimit(s.age), 0), unit: "Hz" },
    { label: "每天安全聆听时间", value: fmt(Mo.safeHours(s.db), 2), unit: "小时" }] : [
    { label: "部位", value: Mo.PATH[s.part][0] }, { label: "此处的形式", value: Mo.PATH[s.part][1] }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const P = axes(c, 60, 40, 540, 250, 20000, 1, "Hz", "ok", 0, 4);
      rect(c, P.X(20), P.Y(1), P.X(Mo.upperLimit(s.age)) - P.X(20), P.h, "rgba(81,207,102,0.3)", null, 0, 0);
      c.beginPath(); c.moveTo(P.X(s.f), P.Y(0)); c.lineTo(P.X(s.f), P.Y(1)); c.strokeStyle = Mo.audible(s.f, s.age) ? COL.green : COL.red; c.lineWidth = 5; c.stroke();
      lab(c, Mo.audible(s.f, s.age) ? "能听到" : "听不到", 330, 320, 22, Mo.audible(s.f, s.age) ? COL.green : COL.red);
      rect(c, 60, 340, 540, 20, "#f1f3f5", COL.grey, 2, 8); rect(c, 62, 342, Math.min(536, (Mo.safeHours(s.db) / 8) * 536), 16, s.db > 100 ? COL.red : COL.orange, null, 0, 6);
      lab(c, "安全聆听时间", 60, 330, 14, COL.grey, "left");
    } else {
      Mo.PATH.forEach(([nm], i) => {
        const x = 20 + i * 100, cur = s.part === i;
        rect(c, x, 120, 90, 90, cur ? "#fff3bf" : "#f8f9fa", cur ? COL.orange : COL.grey, cur ? 5 : 2, 14); lab(c, nm, x + 45, 165, nm.length > 5 ? 12 : 16);
        if (i < 5) arrow(c, x + 90, 165, x + 100, 165, COL.grey, 3);
      });
      lab(c, Mo.PATH[s.part][1], 320, 270, 20, COL.purple); txt(c, "", 0, 0, 1, COL.ink);
    }
  },
  tasks: [
    { id: "mosquito", text: "年龄 50 岁，频率 17000 Hz：听不到（高频听力下降）", check: (s) => s.mode === 0 && s.age >= 50 && s.f >= 17000 && !Mo.audible(s.f, s.age) },
    { id: "loud", text: "声音强度调到 100 dB：每天安全聆听时间不到半小时", check: (s) => s.mode === 0 && s.db >= 100 && Mo.safeHours(s.db) < 0.5 },
    { id: "cochlea", text: "找到听觉感受器所在的部位：耳蜗", check: (s) => s.mode === 1 && s.part === 3 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
