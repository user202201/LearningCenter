import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-slide";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, type DMode } from "./match";
import { COL, lab, rect, circle, ell, line } from "./draw";
export const meta = CATALOG.slide;
const SLOTS: [number, number][] = [0, 1, 2, 3, 4, 5, 6].map((i) => [40, 52 + 58 * i]);
export const MODES: (DMode | null)[] = [
  { kind: "label", prefix: "o", items: Mo.ONION, marks: SLOTS, fn: Mo.ONION_FN, place: "right" },
  { kind: "label", prefix: "k", items: Mo.CHEEK, marks: SLOTS, fn: Mo.CHEEK_FN, place: "right" },
  null,
];
const PFX = ["o", "k"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
export const def: SimDef = {
  meta,
  lesson: [
    "临时装片的制作步骤可以记作“擦、滴、撕（刮）、展（涂）、盖、染、吸”。制作洋葱鳞片叶内表皮装片时滴清水；制作人的口腔上皮细胞装片时滴 0.9 % 的生理盐水，使细胞保持正常形态。盖盖玻片时，用镊子夹起盖玻片，使一侧先接触水滴，再缓缓放平，可避免产生气泡。",
    "把操作步骤拖到按顺序编号的位置上（也可以先点步骤，再点编号）。在“盖盖玻片”中，调整盖玻片放下时的角度和水滴的大小，看看气泡怎样变化。（气泡数是教学模型。）",
  ],
  links: [{ text: "相关：显微镜", href: "#/science/bio/microscope" }, { text: "相关：植物细胞与动物细胞", href: "#/science/bio/cells" }],
  params: [
    { id: "angle", label: "盖玻片放下时与载玻片的夹角", min: 0, max: 90, step: 5, value: 80, unit: "°", when: (s) => s.mode === 2 },
    { id: "water", label: "水滴的大小（1 太少，5 太多）", min: 1, max: 5, step: 1, value: 3, when: (s) => s.mode === 2 },
  ],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "洋葱表皮装片"], [1, "口腔上皮细胞装片"], [2, "盖盖玻片"]] }],
  hidden: dndFlags(PFX),
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => s.mode < 2 ? dndReadouts(s, modeOf(s)!) : [
    { label: "气泡数", value: String(Mo.bubbles(s.angle, s.water)), unit: "个" }, { label: "水滴", value: Mo.WATER[s.water - 1] }, { label: "结果", value: Mo.bubbles(s.angle, s.water) === 0 ? "没有气泡，可以观察" : "有气泡，会干扰观察" }],
  draw(c, w, h, s) {
    if (s.mode < 2) {
      line(c, 40, 52, 40, 52 + 58 * 6, "#ced4da", 4); lab(c, s.mode === 0 ? "洋葱表皮临时装片" : "口腔上皮细胞临时装片", 20, 22, 17, COL.grey, "left");
      drawDnd(c, s, modeOf(s)!);
      return;
    }
    const b = Mo.bubbles(s.angle, s.water), rx = 24 + 22 * s.water, a = (s.angle * Math.PI) / 180;
    rect(c, 50, 300, 400, 26, "#e7f5ff", COL.ink, 4, 4); lab(c, "载玻片", 250, 352, 16, COL.grey);
    ell(c, 250, 296, rx, 12 + 3 * s.water, "#a5d8ff", "#4dabf7", 3);
    const x0 = 250 - rx, L = 170;
    c.save(); c.translate(x0, 296); c.rotate(-a); rect(c, 0, -5, L, 6, "#dee2e6", COL.ink, 3, 2); c.restore();
    lab(c, "盖玻片", x0 + (L / 2) * Math.cos(a) + 14, 296 - (L / 2) * Math.sin(a) - 18, 15, COL.grey, "left");
    const span = Math.min(L * Math.cos(a), 2 * rx);
    for (let i = 0; i < b && i < 30; i++) circle(c, x0 + 10 + ((i * 37) % Math.max(20, span - 20)) , 288 + ((i * 11) % 9), 3 + (i % 3), "#fff", "#4dabf7", 1.5);
    if (s.water >= 5) { ell(c, 250, 316, 150, 8, "#a5d8ff", "#4dabf7", 2); lab(c, "水溢出", 250, 392, 16, COL.red); }
    lab(c, `${b}`, 540, 160, 56, b === 0 ? COL.green : COL.red); lab(c, "bubbles", 540, 206, 18, COL.grey);
    lab(c, "盖盖玻片（侧面示意图）", 20, 22, 17, COL.grey, "left");
  },
  tasks: [
    { id: "onion", text: "把洋葱表皮装片的 7 个步骤按顺序放好，没有失误", check: (s) => s.mode === 0 && allPlaced(s, MODES[0]!) && s.miss === 0 },
    { id: "cheek", text: "把口腔上皮细胞装片的 7 个步骤按顺序放好", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]!) },
    { id: "clean", text: "盖盖玻片时不产生气泡", check: (s) => s.mode === 2 && Mo.bubbles(s.angle, s.water) === 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
