import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-noise";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.noise;
type S = Record<string, number>;
const final = (s: S) => Mo.controlled(s.L0, [s.m0, s.m1, s.m2]);
const v = (s: S) => Mo.MEDIA[s.med][1];
const delay = (s: S) => Mo.echoDelay(s.d, v(s));
/** a bar from 0 to 140 dB with the three limits and a marker */
function dbBar(c: CanvasRenderingContext2D, y: number, L: number, label: string) {
  const X = (l: number) => 60 + (l / 140) * 520;
  const g = c.createLinearGradient(60, 0, 580, 0); g.addColorStop(0, "#69db7c"); g.addColorStop(0.5, "#ffd43b"); g.addColorStop(1, "#fa5252"); rect(c, 60, y, 520, 26, "#fff", COL.ink, 3, 13); c.fillStyle = g; c.beginPath(); c.roundRect(62, y + 2, 516, 22, 11); c.fill();
  for (const l of [50, 70, 90]) { line(c, X(l), y - 6, X(l), y + 32, COL.ink, 2); txt(c, String(l), X(l), y + 46, 16, COL.grey); }
  const x = X(Math.min(140, L)); circle(c, x, y + 13, 14, "#fff", COL.ink, 4); txt(c, `${fmt(L, 0)} dB`, x, y - 22, 22, COL.ink); void label;
}
export const def: SimDef = {
  meta,
  lesson: [
    "声音的强弱用分贝（dB）表示。0 dB 是人刚能听到的最微弱的声音。从物理学角度看，噪声是发声体做无规则振动时发出的声音；从环境保护角度看，凡是妨碍人们正常休息、学习和工作的声音，以及对人们要听的声音产生干扰的声音，都属于噪声。为了保护听力，应控制噪声不超过 90 dB；为了保证工作和学习，应控制噪声不超过 70 dB；为了保证休息和睡眠，应控制噪声不超过 50 dB。",
    "控制噪声有三条途径：在声源处减弱（如安装消声器、禁止鸣笛），在传播过程中减弱（如设置隔声板、植树造林），在人耳处减弱（如戴防噪声耳罩、耳塞）。本实验里各种措施减弱的分贝数只是示例。",
    "声音遇到障碍物会被反射回来，反射回来的声音叫回声。回声到达人耳比原声晚 0.1 s 以上，人才能把回声和原声区分开；在空气中（340 m/s）障碍物至少要在 17 m 以外。利用回声可以测距：s = vt / 2，其中 t 是声音往返的时间。声呐利用超声波在海水中的回声测量海水的深度。",
  ],
  formulas: ["s=\\dfrac{vt}{2}"],
  params: [
    { id: "L", label: "声音的强弱", min: 0, max: 140, step: 5, value: 40, unit: "dB", when: (s) => s.mode === 0 },
    { id: "L0", label: "原来的噪声", min: 60, max: 120, step: 5, value: 85, unit: "dB", when: (s) => s.mode === 1 },
    { id: "d", label: "人到障碍物的距离", min: 1, max: 400, step: 1, value: 5, unit: "m", when: (s) => s.mode === 2 },
    { id: "ts", label: "超声波往返的时间", min: 0, max: 10, step: 0.1, value: 2, unit: "s", when: (s) => s.mode === 3 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "声音的强弱"], [1, "控制噪声"], [2, "回声"], [3, "声呐测深"]] },
    ...Mo.MEASURES.map(([n], i) => ({ id: `m${i}`, label: n, value: 0, options: [[0, "不采取"], [1, "采取"]] as [number, string][], when: (s: S) => s.mode === 1 })),
    { id: "med", label: "声音传播的介质", value: 0, options: Mo.MEDIA.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 2 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "相当于", value: Mo.example(s.L) }, { label: "对人的影响", value: Mo.effect(s.L) }];
    if (s.mode === 1) return [{ label: "采取措施后的噪声", value: fmt(final(s), 0), unit: "dB" }, { label: "对人的影响", value: Mo.effect(final(s)) }, { label: "是否适合休息和睡眠", value: final(s) <= Mo.LIMIT_SLEEP ? "是" : "否" }];
    if (s.mode === 2) return [{ label: "声速", value: fmt(v(s), 0), unit: "m/s" }, { label: "回声比原声晚", value: fmt(delay(s), 3), unit: "s" }, { label: "能否区分回声和原声", value: delay(s) >= Mo.MIN_GAP ? "能（相隔 0.1 s 以上）" : "不能（相隔不到 0.1 s）" }, { label: "至少需要的距离", value: fmt(Mo.minDistance(v(s)), 1), unit: "m" }];
    return [{ label: "海水中的声速", value: fmt(Mo.SEA, 0), unit: "m/s" }, { label: "海水的深度", value: fmt(Mo.depth(s.ts), 0), unit: "m" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) { dbBar(c, 150, s.L, ""); for (let i = 0; i < Math.min(6, Math.ceil(s.L / 25)); i++) { c.beginPath(); c.arc(90, 300, 20 + i * 14, -0.9, 0.9); c.strokeStyle = COL.purple; c.lineWidth = 4; c.stroke(); } rect(c, 60, 285, 20, 30, COL.grey, COL.ink, 3, 4); }
    else if (s.mode === 1) { dbBar(c, 90, s.L0, ""); dbBar(c, 220, final(s), ""); txt(c, "BEFORE", 320, 56, 18, COL.grey); txt(c, "AFTER", 320, 186, 18, COL.grey); for (let i = 0; i < 3; i++) { rect(c, 70 + i * 180, 320, 150, 40, s[`m${i}`] ? "#b2f2bb" : "#fff", COL.ink, 3, 10); txt(c, String(i + 1), 145 + i * 180, 340, 22, COL.ink); } }
    else if (s.mode === 2) {
      const X = 80 + (s.d / 400) * 440;
      circle(c, 70, 220, 18, "#ffd8a8", COL.ink, 4); line(c, 70, 238, 70, 300, COL.ink, 5); rect(c, X, 140, 20, 170, COL.metal, COL.ink, 4, 4);
      arrow(c, 96, 200, X - 6, 200, COL.blue, 5); arrow(c, X - 6, 240, 96, 240, COL.orange, 5);
      txt(c, `${s.d} m`, (70 + X) / 2, 280, 24, COL.ink); txt(c, `${fmt(delay(s), 3)} s`, 540, 60, 30, delay(s) >= 0.1 ? COL.green : COL.red);
    } else {
      const bottom = 140 + (Mo.depth(s.ts) / 7500) * 190;
      rect(c, 0, 110, 640, 287, "#a5d8ff", null, 0, 0); rect(c, 0, 340, 640, 57, "#c9a66b", null, 0, 0);
      rect(c, 250, 90, 120, 34, "#e03131", COL.ink, 4, 10); arrow(c, 310, 126, 310, Math.min(335, bottom), COL.blue, 5); arrow(c, 340, Math.min(335, bottom), 340, 126, COL.orange, 5);
      txt(c, `${fmt(Mo.depth(s.ts), 0)} m`, 500, 230, 30, COL.ink);
    }
  },
  tasks: [
    { id: "loud", text: "声音的强弱：找一个会损害听力的声音（90 dB 以上）", check: (s) => s.mode === 0 && s.L >= 90 },
    { id: "quiet", text: "控制噪声：采取措施，使噪声降到适合休息和睡眠的 50 dB 以下", check: (s) => s.mode === 1 && final(s) <= Mo.LIMIT_SLEEP },
    { id: "echo", text: "回声：在空气中，使人能把回声和原声区分开", check: (s) => s.mode === 2 && s.med === 0 && delay(s) >= Mo.MIN_GAP },
    { id: "sonar", text: "声呐测深：使测得的海水深度恰好是 3000 m", check: (s) => s.mode === 3 && Math.abs(Mo.depth(s.ts) - 3000) < 0.5 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
