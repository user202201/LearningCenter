import { mountSim, type SimDef, type PhysCtx, type St, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-motion";
import { COL, arrow, axes, circle, curve, line, rect, txt } from "./draw";

export const meta = CATALOG.motion;
const TMAX = 10;
export const def: SimDef = {
  meta,
  lesson: [
    "物体的位置随时间的变化叫机械运动。快慢用速度表示：速度等于路程与时间的比，v = s / t。",
    "匀速直线运动的 s-t 图是一条过原点的直线，直线越陡，速度越大；v-t 图是一条水平线，图线与时间轴围成的面积等于路程。",
    "匀加速运动的速度均匀增大，v-t 图是一条斜线，s-t 图是一条曲线。打点计时器每隔相等的时间打一个点：点间距相等是匀速，点间距越来越大是加速。",
  ],
  formulas: ["v=\\dfrac{s}{t}", "v=v_0+at", "s=v_0t+\\dfrac{1}{2}at^2"],
  params: [
    { id: "v0", label: "初速度", min: 0, max: 10, step: 0.5, value: 4, unit: "m/s" },
    { id: "a", label: "加速度", min: 0, max: 4, step: 0.5, value: 0, unit: "m/s²" },
    { id: "t", label: "时间", min: 0, max: TMAX, step: 0.1, value: 3, unit: "s" },
  ],
  play: { param: "t", rate: 1, loop: false },
  aspect: 0.66,
  readouts: (s) => [
    { label: "时间", value: fmt(s.t, 1), unit: "s" },
    { label: "路程", value: fmt(Mo.pos(s.v0, s.a, s.t), 1), unit: "m" },
    { label: "瞬时速度", value: fmt(Mo.vel(s.v0, s.a, s.t), 1), unit: "m/s" },
    { label: "平均速度", value: fmt(Mo.avgSpeed(s.v0, s.a, s.t), 1), unit: "m/s" },
    { label: "速度", value: fmt(Mo.toKmh(Mo.vel(s.v0, s.a, s.t)), 1), unit: "km/h" },
  ],
  draw(c, w, hh, s: St) {
    // road: 0..300 m over 520 units
    const sx = (m: number) => 50 + (520 * Math.min(m, 300)) / 300;
    rect(c, 20, 96, 600, 24, "#868e96", null, 0, 4);
    for (let m = 0; m <= 300; m += 50) { line(c, sx(m), 96, sx(m), 128, "#fff", 3); txt(c, String(m), sx(m), 140, 15, COL.grey); }
    txt(c, "m", 612, 140, 15, COL.grey, "right");
    const x = sx(Mo.pos(s.v0, s.a, s.t));
    rect(c, x - 30, 62, 60, 26, COL.orange, COL.ink, 3, 8); rect(c, x - 14, 44, 30, 22, "#ffd8a8", COL.ink, 3, 6);
    circle(c, x - 17, 92, 9, COL.ink, null); circle(c, x + 17, 92, 9, COL.ink, null);
    const v = Mo.vel(s.v0, s.a, s.t); if (v > 0.2) arrow(c, x + 34, 70, x + 34 + Math.min(70, v * 5), 70, COL.red, 4);
    // ticker tape: a dot every 0.5 s
    rect(c, 20, 158, 600, 34, "#fff8db", COL.ink, 2, 4);
    const smax = Math.max(1, Mo.pos(s.v0, s.a, TMAX));
    for (const d of Mo.tape(s.v0, s.a, s.t, 0.5)) circle(c, 36 + (560 * d) / smax, 175, 4.5, COL.ink, null);
    txt(c, "0.5 s", 600, 208, 15, COL.grey, "right");
    // graphs
    const vmax = Math.max(5, Mo.vel(s.v0, s.a, TMAX)), sm = Math.max(10, smax);
    const nice = (v: number) => (v <= 10 ? 10 : v <= 20 ? 20 : v <= 50 ? 50 : v <= 100 ? 100 : v <= 200 ? 200 : 300);
    const P1 = axes(c, 50, 250, 250, 175, TMAX, nice(sm), "t/s", "s/m");
    curve(c, P1, (t) => Mo.pos(s.v0, s.a, t), COL.blue, TMAX, 80);
    circle(c, P1.X(s.t), P1.Y(Mo.pos(s.v0, s.a, s.t)), 7, COL.red);
    const vm = vmax <= 10 ? 10 : vmax <= 20 ? 20 : vmax <= 50 ? 50 : 100;
    const P2 = axes(c, 370, 250, 250, 175, TMAX, vm, "t/s", "v/(m/s)");
    curve(c, P2, (t) => Mo.vel(s.v0, s.a, t), COL.green, TMAX, 40);
    circle(c, P2.X(s.t), P2.Y(Mo.vel(s.v0, s.a, s.t)), 7, COL.red);
    line(c, P2.X(s.t), P2.Y(0), P2.X(s.t), P2.Y(Mo.vel(s.v0, s.a, s.t)), COL.red, 2, [5, 4]);
  },
  tasks: [
    { id: "uniform", text: "使小车做匀速直线运动，速度不小于 5 m/s（加速度为 0）", check: (s) => s.a === 0 && s.v0 >= 5 },
    { id: "s50", text: "使小车在 5 s 时通过的路程为 50 m（误差不超过 1 m）", check: (s) => Math.abs(s.t - 5) < 0.01 && Math.abs(Mo.pos(s.v0, s.a, s.t) - 50) <= 1 },
    { id: "acc", text: "使小车做匀加速运动，5 s 末的速度不小于 15 m/s，且加速度不超过 2 m/s²", check: (s) => Math.abs(s.t - 5) < 0.01 && s.a > 0 && s.a <= 2 && Mo.vel(s.v0, s.a, s.t) >= 15 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
