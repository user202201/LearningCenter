import { mountBio, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-genetics";
import { mulberry32 } from "../phys/qtools";
import { tr } from "../i18n";
const tl = (t: string) => t.replace(/显性|隐性|女孩|男孩/g, (m) => tr(m));
import { COL, lab, txt, circle, rect } from "./draw";
export const meta = CATALOG.genetics;
type S = Record<string, number>;
const pair = (s: S): [string, string] => (s.mode === 0 ? [Mo.MONO[s.p1], Mo.MONO[s.p2]] : s.mode === 1 ? [Mo.ABO_G[s.b1], Mo.ABO_G[s.b2]] : ["XX", "XY"]);
export const cells = (s: S) => Mo.punnett(pair(s)[0], pair(s)[1], s.mode);
export const sampleOf = (s: S) => Mo.sample(mulberry32(1000 + s.seed), cells(s), s.mode, s.N);
const COLORS: Record<string, string> = { 显性: "#9775fa", 隐性: "#fff", A: "#ff8787", B: "#74c0fc", AB: "#b197fc", O: "#ffe066", 女孩: "#f783ac", 男孩: "#4dabf7" };
export const def: SimDef = {
  meta,
  lesson: [
    "性状由基因控制，基因在染色体上成对存在。显性基因（A）控制显性性状，隐性基因（a）控制隐性性状；只有 aa 才表现隐性性状，AA 和 Aa 都表现显性性状。亲代形成生殖细胞时成对的基因分开，各进入一个生殖细胞；受精时雌雄配子随机结合。",
    "用遗传图解（棋盘）列出 4 种组合：Aa × Aa 的后代基因型比为 1AA : 2Aa : 1aa，表现型比为显性 : 隐性 = 3 : 1。样本越大，实际比例越接近理论比例。人的性别由性染色体决定：女性 XX，男性 XY，生男生女的机会均等。ABO 血型由 I^A、I^B、i 三个基因决定。",
  ],
  formulas: ["Aa \\times Aa \\to 1AA : 2Aa : 1aa"],
  links: [{ text: "相关：知识总结（生物）", href: "#/science/notes" }],
  params: [{ id: "N", label: "后代样本数", min: 10, max: 500, step: 10, value: 40 }],
  choices: [
    { id: "mode", label: "内容", value: 0, options: [[0, "一对基因的杂交"], [1, "ABO 血型"], [2, "性别决定"]] },
    { id: "p1", label: "亲本 1", value: 0, options: [[0, "AA"], [1, "Aa"], [2, "aa"]], when: (s) => s.mode === 0 },
    { id: "p2", label: "亲本 2", value: 2, options: [[0, "AA"], [1, "Aa"], [2, "aa"]], when: (s) => s.mode === 0 },
    { id: "b1", label: "父亲的血型基因", value: 1, options: Mo.ABO_G.map((g, i) => [i, `${Mo.abid(g)}（${Mo.phenotype(g, 1)} 型）`] as [number, string]), when: (s) => s.mode === 1 },
    { id: "b2", label: "母亲的血型基因", value: 3, options: Mo.ABO_G.map((g, i) => [i, `${Mo.abid(g)}（${Mo.phenotype(g, 1)} 型）`] as [number, string]), when: (s) => s.mode === 1 },
  ],
  hidden: { seed: 1 },
  actions: [{ id: "resample", label: "重新抽样", run: (s) => ({ seed: s.seed + 1 }) }],
  aspect: 0.66,
  readouts: (s) => {
    const cs = cells(s), ks = Mo.classes(s.mode), sm = sampleOf(s), p = Mo.probs(cs, s.mode);
    return [
      { label: "子代基因型的比", value: Mo.ratioText(cs, s.mode === 0 ? Mo.MONO : s.mode === 2 ? Mo.SEX : ["AA", "Ao", "BB", "Bo", "AB", "oo"]) },
      { label: "子代表现型的比（理论）", value: tl(Mo.phenoRatioText(cs, s.mode)) },
      { label: "样本中的实际数量", value: ks.map((k, i) => `${tl(k)} ${sm[i]}`).join(" / ") },
      { label: "χ² 偏差值", value: fmt(Mo.chiSquare(sm, p), 2) }];
  },
  draw(c, w, h, s) {
    const [g1, g2] = pair(s), cs = cells(s), ks = Mo.classes(s.mode), sm = sampleOf(s), p = Mo.probs(cs, s.mode);
    const ox = 60, oy = 66, cw = 96;
    txt(c, `${g1} x ${g2}`, 20, 22, 20, COL.purple, "left");
    [...g2].forEach((a, j) => txt(c, a, ox + cw * (j + 0.5), oy - 18, 22, COL.ink)); [...g1].forEach((a, i) => txt(c, a, ox - 22, oy + cw * (i + 0.5), 22, COL.ink));
    cs.forEach((g, k) => { const i = Math.floor(k / 2), j = k % 2, x = ox + cw * j, y = oy + cw * i; rect(c, x, y, cw, cw, COLORS[Mo.phenotype(g, s.mode)] ?? "#fff", COL.ink, 3, 10); txt(c, g, x + cw / 2, y + cw / 2, 24, COL.ink); });
    // expected and sampled shares per class
    const bx = 300, by = 80, bw = 300, n = ks.length;
    ks.forEach((k, i) => {
      const x = bx + (bw / n) * i + 10, bwid = bw / n - 20, hgt = 150;
      rect(c, x, by + hgt - hgt * p[i], bwid / 2 - 2, hgt * p[i], "#fff", COL.ink, 3, 4);
      const f = s.N ? sm[i] / s.N : 0; rect(c, x + bwid / 2, by + hgt - hgt * f, bwid / 2 - 2, Math.max(0.1, hgt * f), COLORS[k] === "#fff" ? "#ced4da" : COLORS[k], COL.ink, 3, 4);
      lab(c, k, x + bwid / 2, by + hgt + 18, 15, COL.ink); txt(c, `${sm[i]}`, x + bwid * 0.75, by + hgt - hgt * f - 10, 15, COL.ink);
    });
    lab(c, "理论比例（左）与样本（右）", bx, by - 20, 15, COL.grey, "left");
    // the sample as dots
    const cols = 40;
    let idx = 0; for (let i = 0; i < ks.length; i++) for (let j = 0; j < sm[i]; j++, idx++) circle(c, 22 + (idx % cols) * 15, 330 + Math.floor(idx / cols) * 13, 5, COLORS[ks[i]], COL.ink, 1.5);
  },
  tasks: [
    { id: "r31", text: "选择 Aa × Aa：表现型比为 显性 : 隐性 = 3 : 1", check: (s) => s.mode === 0 && s.p1 === 1 && s.p2 === 1 },
    { id: "test", text: "选择 Aa × aa（测交）：后代显性与隐性各占一半", check: (s) => s.mode === 0 && ((s.p1 === 1 && s.p2 === 2) || (s.p1 === 2 && s.p2 === 1)) },
    { id: "abo4", text: "选择 I^A i × I^B i：后代有 A、B、AB、O 四种血型", check: (s) => s.mode === 1 && new Set(cells(s).map((g) => Mo.phenotype(g, 1))).size === 4 },
    { id: "big", text: "Aa × Aa：把样本增加到 300 以上，观察实际比例接近 3 : 1", check: (s) => s.mode === 0 && s.p1 === 1 && s.p2 === 1 && s.N >= 300 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
