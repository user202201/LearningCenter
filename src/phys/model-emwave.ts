/** 电磁波 (pure): c = lambda f, the electromagnetic spectrum, how long a signal needs to travel. */
import { makeQ, numQ, pick, shuffle, type Q } from "./qtools";
export const C = 3e8;
/** bands of the electromagnetic spectrum: lower limit of the frequency (Hz), name, examples (school-level boundaries) */
export const BANDS: { lo: number; name: string; use: string }[] = [
  { lo: 0, name: "无线电波", use: "广播、电视、手机通信、雷达" },
  { lo: 3e11, name: "红外线", use: "遥控器、红外测温、夜视仪" },
  { lo: 4e14, name: "可见光", use: "人眼能看见的光" },
  { lo: 7.5e14, name: "紫外线", use: "杀菌消毒、验钞" },
  { lo: 3e16, name: "X 射线", use: "医院的透视和拍片" },
  { lo: 3e19, name: "γ 射线", use: "放射治疗、金属探伤" },
];
export const band = (f: number) => { let k = 0; BANDS.forEach((b, i) => { if (f >= b.lo) k = i; }); return k; };
export const freq = (lf: number) => 10 ** lf;
export const wavelength = (f: number, v = C) => v / f;
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => (n < 0 ? "⁻" : "") + String(Math.abs(n)).split("").map((d) => SUP[Number(d)]).join("");
/** a number in scientific notation with one decimal, e.g. 3×10⁸ (the mantissa 1.0 is written 1×10ⁿ) */
export function sci(v: number): string {
  if (v === 0) return "0";
  let e = Math.floor(Math.log10(v)), m = Math.round((v / 10 ** e) * 10) / 10;
  if (m >= 10) { m = 1; e++; }
  return `${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}×10${sup(e)}`;
}
export const DESTS: [string, number][] = [["北京到上海", 1200], ["北京到纽约", 11000], ["地球到同步卫星", 35786], ["地球到月球", 384400]];
export const MEDIA: [string, number][] = [["电磁波（真空或空气）", C], ["光纤中的光信号", 2e8], ["声音（空气中）", 340]];
/** one-way travel time in seconds over d km at speed v m/s */
export const delay = (dKm: number, v: number) => (dKm * 1000) / v;
export function quiz(rng: () => number): Q[] {
  const fm = pick(rng, [30, 100, 300, 900, 1500]), wl = pick(rng, [0.1, 0.3, 1, 3, 10, 30]);
  const dk = pick(rng, [384400, 35786, 149600000, 1000000]);
  const idx = shuffle(rng, [0, 1, 2, 3, 4, 5]).slice(0, 4), top = Math.max(...idx);
  return [
    numQ(rng, "wavelength", [fm], `一个无线电台的频率是 ${fm} MHz，它发射的电磁波的波长是多少？（电磁波的速度 3×10⁸ m/s）`, 300 / fm, "m", 2, "λ = c / f；3×10⁸ m/s ÷ 10⁶ Hz = 300 m·MHz。"),
    numQ(rng, "freq", [wl], `电磁波的波长是 ${wl} m，它的频率是多少？（电磁波的速度 3×10⁸ m/s）`, 300 / wl, "MHz", 1, "f = c / λ。"),
    numQ(rng, "delay", [dk], `无线电信号从发射到接收经过 ${dk} km，传播时间约是多少？（速度 3×10⁸ m/s）`, delay(dk, C), "s", 3, "t = s / v。"),
    makeQ(rng, "vac", [], "电磁波的传播：", "不需要介质，可以在真空中传播", ["需要介质，不能在真空中传播", "在真空中的速度比在空气中的小得多", "只能在空气中传播"], "电磁波在真空中的速度是 3×10⁸ m/s，声波则不能在真空中传播。"),
    makeQ(rng, "band", [...idx], `下列电磁波中，频率最高的是：`, BANDS[top].name, idx.filter((i) => i !== top).map((i) => BANDS[i].name), "频率从低到高：无线电波、红外线、可见光、紫外线、X 射线、γ 射线。"),
  ];
}
