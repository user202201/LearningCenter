import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-emwave";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.emwave;
const SEG = ["#adb5bd", "#e03131", "#fcc419", "#7048e8", "#1c7ed6", "#2d2230"];
const LF0 = 3, LF1 = 21, X0 = 40, X1 = 600;
const lx = (lf: number) => X0 + ((lf - LF0) / (LF1 - LF0)) * (X1 - X0);
const tm = (s: Record<string, number>) => Mo.delay(Mo.DESTS[s.dest][1], Mo.MEDIA[s.med][1]);
export const def: SimDef = {
  meta,
  lesson: [
    "电磁波：变化的电流（迅速变化的电流）会在周围空间产生电磁波，无线电波、红外线、可见光、紫外线、X 射线、γ 射线都是电磁波，它们按频率由低到高排成电磁波谱。电磁波可以在真空中传播，在真空中的速度 c = 3×10⁸ m/s（也是光速）；波速、波长和频率的关系：c = λf，频率越高，波长越短。",
    "无线电波用于广播、电视和移动通信，手机用微波传递信息；红外线用于遥控和红外测温；紫外线能杀菌；X 射线用于医学透视；γ 射线用于治疗和探伤。光纤通信用激光在光纤中传递信息，光信号在光纤里的速度约为真空中的三分之二。声波不是电磁波，不能在真空中传播，速度也比电磁波小得多。",
  ],
  formulas: ["c=\\lambda f", "t=\\dfrac{s}{v}"],
  params: [{ id: "lf", label: "频率（10 的几次方 Hz）", min: LF0, max: LF1, step: 0.1, value: 6, unit: "", when: (s) => s.mode === 0 }],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "电磁波谱"], [1, "信号传播的时间"]] },
    { id: "dest", label: "路程", value: 0, options: Mo.DESTS.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 1 },
    { id: "med", label: "传播的信号", value: 0, options: Mo.MEDIA.map(([n], i) => [i, n] as [number, string]), when: (s) => s.mode === 1 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) { const f = Mo.freq(s.lf), b = Mo.BANDS[Mo.band(f)]; return [{ label: "频率", value: Mo.sci(f), unit: "Hz" }, { label: "波长", value: Mo.sci(Mo.wavelength(f)), unit: "m" }, { label: "波段", value: b.name }, { label: "应用", value: b.use }]; }
    const t = tm(s), ms = t < 1;
    return [{ label: "路程", value: fmt(Mo.DESTS[s.dest][1], 0), unit: "km" }, { label: "传播的速度", value: Mo.sci(Mo.MEDIA[s.med][1]), unit: "m/s" }, { label: "单程的时间", value: ms ? fmt(t * 1000, 1) : fmt(t, 2), unit: ms ? "ms" : "s" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) {
      const lo = [LF0, Math.log10(3e11), Math.log10(4e14), Math.log10(7.5e14), Math.log10(3e16), Math.log10(3e19), LF1];
      for (let i = 0; i < 6; i++) rect(c, lx(lo[i]), 60, lx(lo[i + 1]) - lx(lo[i]), 50, SEG[i], null, 0, 0);
      const g = c.createLinearGradient(lx(lo[2]), 0, lx(lo[3]), 0); for (const [o, col] of [[0, "#e03131"], [0.25, "#fcc419"], [0.5, "#2f9e44"], [0.75, "#1c7ed6"], [1, "#7048e8"]] as [number, string][]) g.addColorStop(o, col); c.fillStyle = g; c.fillRect(lx(lo[2]), 60, lx(lo[3]) - lx(lo[2]), 50);
      rect(c, X0, 60, X1 - X0, 50, "", COL.ink, 3, 0);
      for (let e = 4; e <= 20; e += 4) { line(c, lx(e), 110, lx(e), 120, COL.ink, 2); txt(c, `10^${e}`, lx(e), 134, 14, COL.grey); }
      const mx = lx(s.lf); arrow(c, mx, 24, mx, 58, COL.red, 5);
      // a wave: three crests whose spacing follows the wavelength on a log scale
      const f = Mo.freq(s.lf), wl = Math.log10(Mo.wavelength(f)), cyc = 6 - (wl + 12) / 18 * 5.4;   // lg(lambda) from -12 to 5 -> 0.6..6 cycles
      c.beginPath(); for (let x = 40; x <= 600; x += 2) { const y = 270 - 60 * Math.sin(((x - 40) / 560) * Math.PI * 2 * Math.max(0.6, cyc)); (x === 40 ? c.moveTo(x, y) : c.lineTo(x, y)); } c.strokeStyle = COL.purple; c.lineWidth = 4; c.stroke();
      line(c, 40, 270, 600, 270, COL.grey, 2, [6, 6]); txt(c, "lambda", 320, 350, 20, COL.grey);
      return;
    }
    const t = tm(s), d = Mo.DESTS[s.dest][1];
    circle(c, 80, 200, 40, "#74c0fc", COL.ink, 4); const ratio = Math.log10(d) / Math.log10(400000), X = 160 + ratio * 380; circle(c, X, 200, d > 100000 ? 24 : 30, d > 100000 ? "#ced4da" : "#d3f9d8", COL.ink, 4);
    arrow(c, 130, 200, X - 40, 200, s.med === 2 ? COL.grey : COL.red, 5); txt(c, t < 1 ? `${fmt(t * 1000, 1)} ms` : `${fmt(t, 2)} s`, (130 + X) / 2, 150, 28, COL.purple);
    txt(c, s.med === 0 ? "c" : s.med === 1 ? "2c/3" : "340 m/s", (130 + X) / 2, 250, 22, COL.grey);
  },
  tasks: [
    { id: "visible", text: "电磁波谱：使频率落在可见光的范围内", check: (s) => s.mode === 0 && Mo.band(Mo.freq(s.lf)) === 2 },
    { id: "fm", text: "电磁波谱：调到调频广播的频率，约 100 MHz，波长约 3 m", check: (s) => s.mode === 0 && Math.abs(s.lf - 8) < 0.05 },
    { id: "moon", text: "信号传播：用电磁波传到月球，单程时间超过 1 s", check: (s) => s.mode === 1 && s.dest === 3 && s.med === 0 && tm(s) > 1 },
    { id: "fiber", text: "信号传播：通过光纤从北京传到纽约，单程时间超过 50 ms", check: (s) => s.mode === 1 && s.dest === 1 && s.med === 1 && tm(s) > 0.05 },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
