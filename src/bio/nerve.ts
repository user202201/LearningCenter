import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-nerve";
import { COL, lab, txt, circle, ell, rect, line, arrow } from "./draw";
export const meta = CATALOG.nerve;
export const def: SimDef = {
  meta,
  lesson: [
    "神经调节的基本方式是反射，完成反射的结构是反射弧：感受器 → 传入神经 → 神经中枢 → 传出神经 → 效应器。反射弧不完整（任何一个环节受损），反射就不能完成。",
    "非条件反射（如膝跳反射、缩手反射）是生来就有的，神经中枢在脊髓等低级部位；条件反射（如谈虎色变）是后天学习得到的，需要大脑皮层参与，所以更慢。用尺子下落测反应时间：下落距离 d 与时间 t 的关系为 d = ½ g t²。",
  ],
  formulas: ["t = \\sqrt{2d/g}"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "v", label: "神经传导速度", min: 10, max: 100, step: 5, value: 60, unit: "m/s", when: (s) => s.mode === 0 },
    { id: "d", label: "尺子下落的距离", min: 2, max: 40, step: 1, value: 10, unit: "cm", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "反射弧"], [1, "反应时间（尺子）"]] },
    { id: "site", label: "反射", value: 0, options: Mo.SITES.map((x, i) => [i, x.name] as [number, string]), when: (s) => s.mode === 0 },
    { id: "cut", label: "损伤的部位", value: 0, options: [[0, "无"], ...Mo.PARTS.map((p, i) => [i + 1, p] as [number, string])], when: (s) => s.mode === 0 },
  ],
  aspect: 0.6,
  readouts: (s) => s.mode === 0 ? [
    { label: "反射类型", value: Mo.SITES[s.site].kind },
    { label: "反射弧的神经长度", value: fmt(Mo.SITES[s.site].din + Mo.SITES[s.site].dout, 2), unit: "m" },
    { label: "从刺激到反应", value: Mo.responds(s.cut) ? fmt(Mo.siteLatency(s.site, s.v), 0) : "—", unit: Mo.responds(s.cut) ? "ms" : "" },
    { label: "结果", value: Mo.responds(s.cut) ? "发生反射" : "不发生反射" }] : [
    { label: "反应时间", value: fmt(Mo.reaction(s.d), 0), unit: "ms" }, { label: "评价", value: Mo.rtText(Mo.reaction(s.d)) }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      const ok = Mo.responds(s.cut);
      Mo.PARTS.forEach((p, i) => {
        const x = 16 + i * 124, cutHere = s.cut === i + 1;
        rect(c, x, 80, 108, 70, cutHere ? "#ffe3e3" : "#e7f5ff", cutHere ? COL.red : COL.blue, 4, 14); lab(c, p, x + 54, 115, 18, cutHere ? COL.red : COL.ink);
        if (cutHere) txt(c, "X", x + 54, 60, 36, COL.red);
        if (i < 4) { const lit = ok || i + 1 < s.cut - 0; arrow(c, x + 108, 115, x + 124, 115, lit ? COL.green : COL.grey, 4); }
      });
      // a leg
      const ang = ok ? 0.7 : 0;
      circle(c, 320, 200, 12, COL.skin, COL.ink, 3); line(c, 320, 212, 320, 270, COL.ink, 14);
      c.save(); c.translate(320, 270); c.rotate(ang); line(c, 0, 0, 0, 80, COL.ink, 12); ell(c, 0, 88, 20, 8, COL.skin, COL.ink, 3); c.restore();
      ell(c, 270, 285, 30, 11, "#868e96", COL.ink, 3, -0.4); lab(c, Mo.SITES[s.site].name, 20, 28, 20, COL.purple, "left");
      txt(c, ok ? "OK" : "X", 560, 290, 44, ok ? COL.green : COL.red);
    } else {
      const d = s.d, sc = 8;
      rect(c, 120, 40, 60, 320, "#fff9db", COL.ink, 3, 6);
      for (let k = 0; k <= 40; k += 5) { line(c, 120, 40 + k * sc, 120 + (k % 10 ? 20 : 34), 40 + k * sc, COL.ink, 2); if (k % 10 === 0) txt(c, String(k), 205, 40 + k * sc, 15, COL.grey, "left"); }
      rect(c, 100, 40 + d * sc - 8, 100, 16, "rgba(224,49,49,0.4)", COL.red, 3, 5); txt(c, `${d} cm`, 330, 40 + d * sc, 22, COL.red, "left");
      ell(c, 470, 200, 54, 54, COL.skin, COL.ink, 4); lab(c, `${fmt(Mo.reaction(d), 0)} ms`, 470, 290, 24, COL.purple); lab(c, Mo.rtText(Mo.reaction(d)), 470, 325, 20, COL.grey);
    }
  },
  tasks: [
    { id: "cut", text: "损伤传入神经：刺激后不发生反射", check: (s) => s.mode === 0 && s.cut === 2 },
    { id: "slow", text: "把神经传导速度降到 30 m/s 以下：膝跳反射的潜伏期超过 40 ms", check: (s) => s.mode === 0 && s.site === 0 && s.cut === 0 && Mo.siteLatency(0, s.v) > 40 },
    { id: "ruler", text: "做尺子测试：下落 18–22 cm 时抓住，反应时间约 200 ms", check: (s) => s.mode === 1 && s.d >= 18 && s.d <= 22 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
