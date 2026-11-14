import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-vessels";
import { COL, lab, txt, circle, ell, rect, line } from "./draw";
export const meta = CATALOG.vessels;
export const def: SimDef = {
  meta,
  lesson: [
    "血液由血浆和血细胞组成：血浆约占 55 %，运载血细胞、运输养料和废物；红细胞运输氧气（含血红蛋白，缺铁会贫血）；白细胞吞噬病菌、防御保护；血小板止血、凝血。",
    "血管分为动脉（把血液送出心脏，管壁厚、弹性大、血流快）、静脉（把血液送回心脏，管壁较薄，四肢静脉有瓣膜）和毛细血管（连通动脉和静脉，管壁极薄、数量多、血流最慢，利于物质交换）。血流速度 = 流量 / 总横截面积。脉搏的次数等于心率。",
  ],
  formulas: ["v = Q / A"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [
    { id: "kg", label: "体重", min: 20, max: 80, step: 5, value: 50, unit: "kg", when: (s) => s.mode === 0 },
    { id: "hct", label: "血细胞所占体积比", min: 25, max: 55, step: 1, value: 45, unit: "%", when: (s) => s.mode === 0 },
    { id: "hr", label: "心率（脉搏）", min: 40, max: 180, step: 5, value: 75, unit: "次/分钟", when: (s) => s.mode === 1 },
  ],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "血液的成分"], [1, "三种血管"], [2, "出血与止血"]] },
    { id: "v", label: "血管", value: 0, options: Mo.VESSELS.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 1 },
    { id: "b", label: "出血的类型", value: 0, options: Mo.BLEED.map((x, i) => [i, x[0]] as [number, string]), when: (s) => s.mode === 2 },
  ],
  aspect: 0.6,
  readouts: (s) => s.mode === 0 ? [
    { label: "全身血量", value: fmt(Mo.bloodVolume(s.kg), 2), unit: "L" }, { label: "血浆", value: fmt(Mo.plasmaVolume(s.kg, s.hct), 2), unit: "L" },
    { label: "每微升红细胞数", value: fmt(Mo.rbcPerUl(s.hct) / 1e6, 2), unit: "百万" }, { label: "判断", value: Mo.anaemic(s.hct) ? "偏低（贫血）" : "正常" }] : s.mode === 1 ? [
    { label: "血流速度", value: fmt(Mo.speed(s.hr, s.v), 3), unit: "cm/s" }, { label: "总横截面积", value: String(Mo.VESSELS[s.v][1]), unit: "cm²" },
    { label: "管壁", value: Mo.VESSELS[s.v][2] }, { label: "瓣膜", value: Mo.VESSELS[s.v][3] ? "有" : "无" }] : [
    { label: "血液的特点", value: Mo.BLEED[s.b][1] }, { label: "按压的位置", value: Mo.BLEED[s.b][2] }],
  draw(c, w, h, s) {
    if (s.mode === 0) {
      rect(c, 60, 50, 90, 290, "#fff", COL.ink, 4, 30);
      const hh = 290 * (s.hct / 100); rect(c, 62, 340 - hh, 86, hh, "#e03131", null, 0, 28); rect(c, 62, 340 - hh - 8, 86, 8, "#f8f9fa", null, 0, 0); rect(c, 62, 52, 86, 290 - hh - 10, "#ffe8a3", null, 0, 28);
      lab(c, "血浆", 170, 130, 18, COL.ink, "left"); lab(c, "白细胞和血小板", 170, 340 - hh - 4, 15, COL.grey, "left"); lab(c, "红细胞", 170, 340 - hh / 2, 18, COL.red, "left");
      for (let i = 0; i < 40; i++) circle(c, 330 + (i % 8) * 34 + ((i * 13) % 9), 90 + Math.floor(i / 8) * 40 + ((i * 7) % 8), 12, i % 13 === 0 ? "#fff" : "#fa5252", COL.ink, 2);
    } else if (s.mode === 1) {
      Mo.VESSELS.forEach(([nm], i) => {
        const y = 80 + i * 105, cur = s.v === i, th = [18, 3, 8][i], gap = [26, 8, 30][i];
        rect(c, 60, y - gap / 2 - th, 520, gap + 2 * th, "#ffc9c9", cur ? COL.orange : COL.ink, cur ? 5 : 3, 6); rect(c, 60, y - gap / 2, 520, gap, i === 2 ? "#91a7ff" : "#ff8787", null, 0, 0);
        lab(c, nm, 70, y - gap / 2 - th - 12, 16, COL.ink, "left");
        const sp = Math.min(60, 6 + Math.log10(1 + Mo.speed(s.hr, i)) * 40);
        for (let k = 0; k < 8; k++) circle(c, 80 + ((k * 70 + sp * 3) % 480), y, 5, "#c92a2a", null);
        if (i === 2) for (const x of [180, 340, 480]) line(c, x, y - gap / 2, x + 10, y, COL.ink, 3);
      });
    } else {
      rect(c, 40, 120, 560, 110, "#ffe3d0", COL.ink, 4, 30);
      const col = ["#ff2b2b", "#7a1f2b", "#ff8787"][s.b];
      if (s.b === 0) for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(320, 175); c.quadraticCurveTo(320 + 60 + k * 22, 60 - k * 6, 320 + 120 + k * 36, 140); c.strokeStyle = col; c.lineWidth = 5; c.stroke(); }
      else if (s.b === 1) { rect(c, 310, 175, 20, 120, col, null, 0, 8); } else for (let k = 0; k < 12; k++) circle(c, 220 + k * 18, 172 + (k % 3) * 8, 5, col, null);
      lab(c, Mo.BLEED[s.b][0], 20, 24, 20, COL.purple, "left"); lab(c, "心脏方向", 60, 300, 16, COL.grey, "left"); lab(c, Mo.BLEED[s.b][2], 320, 330, 20, COL.green);
    }
    txt(c, "", 0, 0, 1, COL.ink);
  },
  tasks: [
    { id: "capillary", text: "选择毛细血管：血流速度小于 0.05 cm/s（血流最慢）", check: (s) => s.mode === 1 && s.v === 1 && Mo.speed(s.hr, 1) < 0.05 },
    { id: "anaemia", text: "把血细胞所占体积比降到 36 % 以下：红细胞偏低（贫血）", check: (s) => s.mode === 0 && Mo.anaemic(s.hct) },
    { id: "artery", text: "选择动脉出血：应按压近心端", check: (s) => s.mode === 2 && s.b === 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
