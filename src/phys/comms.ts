import { mountSim, type SimDef, type PhysCtx, fmt } from "./kit";
import { CATALOG } from "./catalog";
import * as Mo from "./model-comms";
import { COL, arrow, circle, line, rect, txt } from "./draw";

export const meta = CATALOG.comms;
type S = Record<string, number>;
const fc = (s: S) => (s.band === 0 ? s.fcA * 1e3 : s.fcF * 1e6);
const got = (s: S) => (s.band === 0 ? s.fcA === s.ftA : s.fcF === s.ftF);
function signal(c: CanvasRenderingContext2D, s: S) {
  const X = (i: number) => 60 + (i + 0.5) * 65, n = s.noise;
  txt(c, "DIGITAL", 70, 40, 18, COL.grey, "left"); txt(c, "ANALOG", 70, 215, 18, COL.grey, "left");
  rect(c, 50, 55, 540, 120, "#fff", "#d0bfff", 2, 6); line(c, 50, 115, 590, 115, COL.grey, 1.5);
  const bad = Mo.wrongBits(n);
  Mo.BITS.forEach((b, i) => { const sg = b === 1 ? 1 : -1, y = 115 - 40 * sg; line(c, X(i) - 32, y, X(i) + 32, y, "#adb5bd", 5); circle(c, X(i), Math.max(58, Math.min(172, 115 - 40 * (sg + n * Mo.SAMPLE[i]))), 8, bad[i] ? COL.red : COL.green, COL.ink, 2); txt(c, String(b), X(i), 190, 16, COL.grey); });
  rect(c, 50, 235, 540, 120, "#fff", "#d0bfff", 2, 6); line(c, 50, 295, 590, 295, COL.grey, 1.5);
  c.beginPath(); for (let i = 0; i <= 260; i++) { const x = 50 + i * 2.08, a = Math.sin((i / 260) * Math.PI * 4); i ? c.lineTo(x, 295 - 45 * a) : c.moveTo(x, 295 - 45 * a); } c.strokeStyle = "#adb5bd"; c.lineWidth = 5; c.stroke();
  c.beginPath(); for (let i = 0; i <= 260; i++) { const x = 50 + i * 2.08, a = Math.sin((i / 260) * Math.PI * 4) + n * Mo.SAMPLE[Math.floor((i / 261) * 8)] * Math.sin(i * 0.9); i ? c.lineTo(x, 295 - 45 * a) : c.moveTo(x, 295 - 45 * a); } c.strokeStyle = COL.blue; c.lineWidth = 3; c.stroke();
}
export const def: SimDef = {
  meta,
  lesson: [
    "电话把声音变成变化的电流，再把电流还原成声音。随声音的强弱和高低连续变化的电信号叫模拟信号；用不连续变化的“0”和“1”两种状态的组合表示的信号叫数字信号。信号在传输中会混进噪声：模拟信号的波形会被改变，噪声越大失真越大，而且无法消除；数字信号只要噪声不使“0”和“1”判断错误，接收端就能完全恢复原来的信号，所以抗干扰能力强，便于加工、存储和处理。",
    "无线电广播把声音信号加载到高频的载波上（调制），用电磁波发射出去，收音机的调谐器选出与电台频率相同的电磁波，再把声音信号取出来。电磁波在真空中的速度是 c = 3×10⁸ m/s，波长、频率和波速的关系是 c = λf。中波广播的频率约为 540 kHz ~ 1600 kHz，调频（FM）广播约为 88 MHz ~ 108 MHz。",
    "光纤通信利用激光在光导纤维中的全反射传递信息。光纤的芯比外层的折射率大，光射到芯与外层的分界面上的入射角大于临界角时发生全反射，光就沿着光纤一直传下去，几乎没有损耗。光纤通信的容量大、损耗小、不受电磁干扰。",
  ],
  formulas: ["c=\\lambda f"],
  params: [
    { id: "noise", label: "噪声的大小（与信号相比）", min: 0, max: 1.5, step: 0.05, value: 0.3, when: (s) => s.mode === 0 },
    { id: "fcA", label: "电台的频率", min: 540, max: 1600, step: 10, value: 900, unit: "kHz", when: (s) => s.mode === 1 && s.band === 0 },
    { id: "ftA", label: "收音机调到的频率", min: 540, max: 1600, step: 10, value: 700, unit: "kHz", when: (s) => s.mode === 1 && s.band === 0 },
    { id: "fcF", label: "电台的频率", min: 88, max: 108, step: 0.1, value: 95, unit: "MHz", when: (s) => s.mode === 1 && s.band === 1 },
    { id: "ftF", label: "收音机调到的频率", min: 88, max: 108, step: 0.1, value: 100, unit: "MHz", when: (s) => s.mode === 1 && s.band === 1 },
    { id: "th", label: "光射到光纤管壁的入射角", min: 50, max: 89, step: 1, value: 70, unit: "°", when: (s) => s.mode === 2 },
  ],
  choices: [
    { id: "mode", label: "实验", value: 0, options: [[0, "模拟信号与数字信号"], [1, "收音机的调谐"], [2, "光纤通信"]] },
    { id: "band", label: "波段", value: 0, options: [[0, "中波（kHz）"], [1, "调频 FM（MHz）"]], when: (s) => s.mode === 1 },
  ],
  aspect: 0.62,
  readouts: (s) => {
    if (s.mode === 0) return [{ label: "数字信号判断错的位数", value: `${Mo.bitErrors(s.noise)} / 8` }, { label: "模拟信号的失真（噪声的有效值）", value: fmt(Mo.analogDistortion(s.noise), 0), unit: "%" }, { label: "数字信号", value: Mo.bitErrors(s.noise) === 0 ? "完全恢复" : "有错误" }];
    if (s.mode === 1) return [{ label: "电磁波的波长", value: fmt(Mo.wavelength(fc(s)), 1), unit: "m" }, { label: "收音机", value: got(s) ? "收到这个电台（频率相同）" : "没有收到（频率不同）" }];
    return [{ label: "光射到管壁的入射角", value: fmt(s.th, 0), unit: "°" }, { label: "临界角", value: fmt(Mo.critical(), 1), unit: "°" }, { label: "结果", value: Mo.totalReflection(s.th) ? "发生全反射，光沿光纤传下去" : "不发生全反射，有一部分光折射出管壁" }];
  },
  draw(c, w, hh, s) {
    rect(c, 0, 0, 640, 397, "#f8f9fa", null, 0, 0);
    if (s.mode === 0) signal(c, s);
    else if (s.mode === 1) {
      const lo = s.band === 0 ? 540 : 88, hi = s.band === 0 ? 1600 : 108, cc = s.band === 0 ? s.fcA : s.fcF, tt = s.band === 0 ? s.ftA : s.ftF, X = (v: number) => 70 + ((v - lo) / (hi - lo)) * 500;
      rect(c, 50, 120, 540, 110, "#fff", COL.ink, 4, 14); line(c, 70, 190, 570, 190, COL.ink, 3);
      for (let i = 0; i <= 10; i++) line(c, 70 + i * 50, 190, 70 + i * 50, 200, COL.ink, 2);
      arrow(c, X(cc), 150, X(cc), 186, COL.red, 5); txt(c, "STATION", X(cc), 138, 16, COL.red); line(c, X(tt), 130, X(tt), 215, COL.blue, 5); txt(c, got(s) ? "OK" : "-", 320, 280, 44, got(s) ? COL.green : COL.grey);
    } else {
      const ok = Mo.totalReflection(s.th), t = (s.th * Math.PI) / 180, slope = 55 * Math.tan(t);
      rect(c, 40, 140, 560, 110, "#d0ebff", COL.ink, 4, 4);
      let x = 60, y = 195, top = true;
      for (let i = 0; i < 14 && x < 600; i++) {
        const nx = x + (i === 0 ? slope : 2 * slope), ny = top ? 140 : 250, f = nx > 600 ? (600 - x) / (nx - x) : 1;
        line(c, x, y, x + (nx - x) * f, y + (ny - y) * f, COL.orange, 4);
        if (f < 1) break;
        if (!ok) { arrow(c, nx, ny, nx + 50, ny - 60, COL.red, 4); break; }
        x = nx; y = ny; top = !top;
      }
      txt(c, ok ? "TIR" : "LEAK", 320, 310, 36, ok ? COL.green : COL.red);
    }
  },
  tasks: [
    { id: "bad", text: "模拟信号与数字信号：使噪声大到让数字信号也出现错误", check: (s) => s.mode === 0 && Mo.bitErrors(s.noise) > 0 },
    { id: "clean", text: "模拟信号与数字信号：使数字信号完全正确，而模拟信号失真达到 40 % 以上", check: (s) => s.mode === 0 && Mo.bitErrors(s.noise) === 0 && Mo.analogDistortion(s.noise) >= 40 },
    { id: "tune", text: "收音机的调谐：把收音机调到与电台相同的频率，收到这个电台", check: (s) => s.mode === 1 && got(s) },
    { id: "fiber", text: "光纤通信：使光在光纤管壁上发生全反射", check: (s) => s.mode === 2 && Mo.totalReflection(s.th) },
  ],
  quiz: Mo.quiz,
};
export const mount = (root: HTMLElement, ctx: PhysCtx) => mountSim(def, root, ctx);
