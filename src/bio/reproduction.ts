import { mountBio, type SimDef, type PhysCtx } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-reproduction";
import { dndFlags, dndClear, dndPtr, dndReadouts, drawDnd, allPlaced, type DMode } from "./match";
import { COL, lab, ell, poly, line, rect } from "./draw";
export const meta = CATALOG.reproduction;
export const FEMALE_MARKS: [number, number][] = [[88, 126], [138, 152], [235, 250], [235, 378]];
export const MALE_MARKS: [number, number][] = [[150, 352], [104, 300], [176, 252], [306, 214]];
export const SLOT_MARKS: [number, number][] = [0, 1, 2, 3, 4].map((i) => [40, 66 + 84 * i]);
export const MODES: DMode[] = [
  { kind: "label", prefix: "f", items: Mo.FEMALE.map((o) => o.name), marks: FEMALE_MARKS, fn: Mo.FEMALE.map((o) => o.fn) },
  { kind: "label", prefix: "m", items: Mo.MALE.map((o) => o.name), marks: MALE_MARKS, fn: Mo.MALE.map((o) => o.fn) },
  { kind: "label", prefix: "e", items: Mo.EVENTS.map((e) => e[0]), marks: FEMALE_MARKS, fn: Mo.EVENTS.map((e) => Mo.FEMALE[e[1]].name) },
  { kind: "label", prefix: "o", items: Mo.STAGES, marks: SLOT_MARKS, fn: Mo.STAGE_FN, place: "right" },
];
const PFX = ["f", "m", "e", "o"];
const modeOf = (s: Record<string, number>) => MODES[s.mode];
function female(c: CanvasRenderingContext2D) {
  c.beginPath(); c.moveTo(178, 214); c.quadraticCurveTo(130, 150, 92, 176); c.moveTo(292, 214); c.quadraticCurveTo(340, 150, 378, 176); c.strokeStyle = "#f783ac"; c.lineWidth = 9; c.lineCap = "round"; c.stroke();
  ell(c, 88, 176, 30, 20, "#ffd8a8", COL.ink, 3.5); ell(c, 382, 176, 30, 20, "#ffd8a8", COL.ink, 3.5);
  poly(c, [[170, 206], [300, 206], [272, 318], [198, 318]], "#ffc9d9", COL.ink, 4);
  rect(c, 222, 316, 26, 88, "#ffd8e4", COL.ink, 3.5, 8);
  ell(c, 235, 262, 26, 36, "#fff", null);
}
function male(c: CanvasRenderingContext2D) {
  for (const sx of [1, -1]) {
    const X = (x: number) => (sx === 1 ? x : 470 - x);
    ell(c, X(150), 345, 34, 44, "#ffd8a8", COL.ink, 3.5);
    c.beginPath(); c.arc(X(150), 345, 50, sx === 1 ? Math.PI * 1.1 : Math.PI * 1.5, sx === 1 ? Math.PI * 1.5 : Math.PI * 1.9); c.strokeStyle = "#fa8c16"; c.lineWidth = 9; c.stroke();
    c.beginPath(); c.moveTo(X(172), 304); c.quadraticCurveTo(X(190), 230, X(235), 196); c.strokeStyle = "#adb5bd"; c.lineWidth = 8; c.stroke();
    ell(c, X(270), 226, 18, 30, "#ffec99", COL.ink, 3);
  }
  rect(c, 227, 196, 16, 100, "#e9ecef", COL.ink, 3, 6);
}
export const def: SimDef = {
  meta,
  lesson: [
    "这是教科书中的内容（七年级下册“人的由来”），只用简图说明器官的名称和功能。男性的睾丸产生精子并分泌雄性激素，女性的卵巢产生卵细胞并分泌雌性激素；输卵管是受精的场所，子宫是胚胎和胎儿发育的场所，阴道是胎儿产出的通道。",
    "受精卵形成后一边分裂一边移动，形成胚泡，植入子宫内膜后怀孕；约 8 周发育成胎儿，胎儿通过胎盘和脐带从母体获得营养和氧，约 38 周后分娩。把名称或事件拖到图中的标记（或编号位置）上，也可以先点名称再点标记。",
  ],
  links: [{ text: "相关：人的由来与青春期", href: "#/science/bio/development" }],
  params: [],
  choices: [{ id: "mode", label: "内容", value: 0, options: [[0, "女性生殖系统"], [1, "男性生殖系统"], [2, "什么发生在哪里"], [3, "从受精到分娩"]] }],
  hidden: dndFlags(PFX),
  drag: true,
  aspect: 0.75,
  derive: (s, ch) => { if (ch === "mode") dndClear(s, PFX); },
  pointer: dndPtr(modeOf),
  readouts: (s) => dndReadouts(s, modeOf(s)),
  draw(c, w, h, s) {
    if (s.mode === 1) male(c); else if (s.mode !== 3) female(c);
    else { line(c, 40, 66, 40, 402, "#ced4da", 4); }
    lab(c, ["女性生殖系统（示意图）", "男性生殖系统（示意图）", "女性生殖系统（示意图）", "从受精到分娩"][s.mode], 20, 22, 17, COL.grey, "left");
    drawDnd(c, s, modeOf(s));
  },
  tasks: [
    { id: "female", text: "给女性生殖系统的 4 个器官全部放对位置", check: (s) => s.mode === 0 && allPlaced(s, MODES[0]) },
    { id: "male", text: "给男性生殖系统的 4 个器官全部放对位置", check: (s) => s.mode === 1 && allPlaced(s, MODES[1]) },
    { id: "events", text: "把 4 个事件放到发生它们的器官上", check: (s) => s.mode === 2 && allPlaced(s, MODES[2]) },
    { id: "order", text: "把受精到分娩的 5 个阶段按顺序放好，没有失误", check: (s) => s.mode === 3 && allPlaced(s, MODES[3]) && s.miss === 0 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountBio(def, root, ctx);
