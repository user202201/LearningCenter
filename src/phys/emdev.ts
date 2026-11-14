import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-emdev";
import { COL, arrow, circle, line, poly, rect, txt } from "./draw";

export const meta = CATALOG.emdev;
type S = Record<string, number>;
const Ic = (s: S) => Mo.coilCurrent(s.U1, s.s1);
const on = (s: S) => Mo.engaged(Ic(s));
const cur = (s: S) => Mo.wave(s.A, s.f, s.tm);
const emf = (s: S) => Mo.emfPercent(s.A, s.f);
function trace(c: CanvasRenderingContext2D, s: S, y0: number, color: string) {
  rect(c, 60, y0 - 60, 520, 120, "#fff", "#d0bfff", 2, 6); line(c, 60, y0, 580, y0, COL.grey, 1.5);
  c.beginPath(); for (let i = 0; i <= 260; i++) { const t = (i / 260) * 10, y = y0 - 55 * Mo.wave(s.A, s.f, t); i ? c.lineTo(60 + i * 2, y) : c.moveTo(60, y); } c.strokeStyle = color; c.lineWidth = 4; c.stroke();
  const x = 60 + (s.tm / 10) * 520; circle(c, x, y0 - 55 * Mo.wave(s.A, s.f, s.tm), 8, COL.red, COL.ink, 3);
}
export const def: SimDef = {
  meta,
  lesson: [
    "电磁继电器是由电磁铁控制的开关。电磁铁通电时吸引衔铁，使工作电路的触点接通；断电时弹簧把衔铁拉回，触点断开。这样用低电压、弱电流的控制电路，就可以控制高电压、强电流的工作电路，还能实现远距离操作和自动控制（如温度自动报警器：温度升高到设定值时，水银柱把控制电路接通，电铃响起来）。",
    "扬声器把变化的电流变成声音：线圈中通过随声音变化的电流，通电线圈在永磁体的磁场中受力，受力的方向随电流方向改变，带动纸盆来回振动，发出声音。电流越大，纸盆振幅越大，声音越响；电流变化越快，声音的音调越高。",
    "话筒把声音变成变化的电流：声波使膜片和线圈一起振动，线圈在磁场中做切割磁感线的运动，产生感应电流（电磁感应现象）。声音越响、音调越高，线圈运动越快，感应电流越大。扬声器与话筒的作用相反，原理也不同。",
  ],
  params: [
    { id: "U1", label: "控制电路的电源电压", min: 0, max: 12, step: 0.5, value: 6, unit: "V", when: (s) => s.mode === 0 },
    { id: "T", label: "环境温度", min: 20, max: 100, step: 5, value: 20, unit: "℃", when: (s) => s.mode === 1 },
    { id: "Tset", label: "报警温度（金属丝的位置）", min: 30, max: 90, step: 5, value: 60, unit: "℃", when: (s) => s.mode === 1 },
    { id: "A", label: "电流（声音）的大小", min: 0.1, max: 1, step: 0.05, value: 0.4, when: (s) => s.mode >= 2 },
    { id: "f", label: "频率", min: 100, max: 1000, step: 10, value: 300, unit: "Hz", when: (s) => s.mode >= 2 },
    { id: "tm", label: "时间", min: 0, max: 10, step: 0.1, value: 0, unit: "ms", when: (s) => s.mode >= 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "电磁继电器"], [1, "温度自动报警器"], [2, "扬声器"], [3, "话筒"]] },
    { id: "s1", label: "控制电路的开关", value: 0, options: [[0, "断开"], [1, "闭合"]], when: (s) => s.mode === 0 },
    { id: "load", label: "工作电路中的用电器", value: 0, options: Mo.LOADS.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 0 },
  ],
  play: { param: "tm", rate: 3, loop: true },
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "控制电路的电流", value: fmt(Ic(s) * 1000, 1), unit: "mA" }, { label: "吸合所需的电流", value: fmt(Mo.I_PULL * 1000, 0), unit: "mA" }, { label: "衔铁", value: on(s) ? "被吸下（吸合）" : "被弹簧拉起（释放）" }, { label: "工作电路（220 V）", value: on(s) ? "接通" : "断开" }, { label: "工作电路的电流", value: on(s) ? fmt(Mo.loadCurrent(Mo.LOADS[s.load][1]), 2) : "0", unit: "A" }];
    if (s.mode === 1) return [{ label: "环境温度", value: fmt(s.T, 0), unit: "℃" }, { label: "控制电路", value: Mo.alarmOn(s.T, s.Tset) ? "水银柱接通了金属丝" : "没有接通" }, { label: "电铃", value: Mo.alarmOn(s.T, s.Tset) ? "响（报警）" : "不响" }];
    if (s.mode === 2) return [{ label: "线圈中电流的方向", value: ["向左", "没有电流", "向右"][Mo.direction(cur(s)) + 1] }, { label: "线圈受力的方向", value: ["向左", "不受力", "向右"][Mo.direction(cur(s)) + 1] }, { label: "纸盆偏离中间的位置", value: fmt(cur(s) * 100, 0), unit: "%" }, { label: "声音", value: `音调：${fmt(s.f, 0)} Hz；响度由电流大小决定` }];
    return [{ label: "声音的频率", value: fmt(s.f, 0), unit: "Hz" }, { label: "线圈的运动", value: Mo.direction(cur(s)) === 0 ? "在最远处，瞬间不动" : "切割磁感线" }, { label: "感应电流的大小（相对值）", value: fmt(emf(s), 0), unit: "%" }, { label: "电流的频率", value: `与声音的频率相同，${fmt(s.f, 0)} Hz` }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      rect(c, 30, 90, 240, 200, "rgba(0,0,0,0)", COL.ink, 3, 10); rect(c, 50, 74, 40, 30, COL.yellow, COL.ink, 3, 4); txt(c, "E", 70, 89, 18, COL.ink);
      rect(c, 140, 160, 70, 50, "#ffd8a8", COL.ink, 3, 4); for (let i = 0; i < 5; i++) line(c, 146 + i * 14, 160, 146 + i * 14, 210, COL.orange, 3);
      line(c, 95, 90, 120, s.s1 ? 90 : 70, COL.ink, 4);
      rect(c, 300, 130, 24, 100, COL.metal, COL.ink, 3, 4); const by = on(s) ? 170 : 150;
      line(c, 330, by, 440, on(s) ? 215 : 175, COL.ink, 8); line(c, 440, 215, 440, 270, COL.ink, 6);
      rect(c, 360, 90, 220, 200, "rgba(0,0,0,0)", COL.red, 3, 10); circle(c, 540, 200, 36, on(s) ? "#ffe066" : "#fff", COL.ink, 4); txt(c, "220V", 470, 80, 20, COL.red);
      if (on(s)) { poly(c, [[440, 210], [450, 220], [440, 230]], COL.ink, null); line(c, 440, 225, 504, 225, COL.orange, 4); }
    } else if (s.mode === 1) {
      const lit = Mo.alarmOn(s.T, s.Tset), Y = (t: number) => 320 - ((t - 20) / 80) * 220;
      rect(c, 150, 90, 24, 240, "#fff", COL.ink, 4, 12); circle(c, 162, 340, 22, COL.red, COL.ink, 4); rect(c, 156, Y(s.T), 12, 336 - Y(s.T), COL.red, null, 0, 3);
      line(c, 174, Y(s.Tset), 260, Y(s.Tset), COL.ink, 4); circle(c, 162, Y(s.Tset), 7, COL.blue, COL.ink, 2);
      rect(c, 260, 90, 120, 90, lit ? "#ffe066" : "#fff", COL.ink, 4, 10); txt(c, "BELL", 320, 135, 24, lit ? COL.red : COL.grey); if (lit) for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(320, 135, 70 + i * 14, -0.6, 0.6); c.strokeStyle = COL.orange; c.lineWidth = 4; c.stroke(); }
      txt(c, `${s.T} C`, 480, 250, 40, lit ? COL.red : COL.blue); txt(c, `${s.Tset} C`, 330, Y(s.Tset), 22, COL.blue);
    } else {
      const x = cur(s), dir = Mo.direction(x);
      rect(c, 150, 70, 60, 70, COL.red, COL.ink, 4, 6); rect(c, 210, 70, 60, 70, COL.blue, COL.ink, 4, 6); txt(c, "N", 180, 105, 26, "#fff"); txt(c, "S", 240, 105, 26, "#fff");
      rect(c, 205 + x * 18, 100, 12, 40, "#ffd8a8", COL.ink, 3, 3); poly(c, [[218 + x * 18, 90], [330 + x * 18, 40], [330 + x * 18, 170], [218 + x * 18, 150]], "#dee2e6", COL.ink, 4);
      if (s.mode === 2 && dir !== 0) arrow(c, 300, 230, 300 + dir * 70, 230, COL.red, 7);
      trace(c, s, 310, s.mode === 2 ? COL.blue : COL.green);
    }
  },
  tasks: [
    { id: "relay", text: "电磁继电器：闭合控制电路的开关，使衔铁被吸下，接通工作电路", check: (s) => s.mode === 0 && on(s) },
    { id: "alarm", text: "温度自动报警器：使温度升高到报警温度，电铃响起来", check: (s) => s.mode === 1 && Mo.alarmOn(s.T, s.Tset) },
    { id: "speaker", text: "扬声器：使线圈中电流的最大值达到最大，纸盆的振幅最大", check: (s) => s.mode === 2 && s.A >= 0.95 },
    { id: "mic", text: "话筒：使声音更响、音调更高，使感应电流达到最大值的一半以上", check: (s) => s.mode === 3 && emf(s) >= 50 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
