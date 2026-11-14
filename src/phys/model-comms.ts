/** 信息的传递 (pure): analog and digital signals with noise, tuning a radio (c = λf), light in an optical fibre (total internal reflection). */
import { makeQ, numQ, pick, shuffle, type Q } from "./qtools";
export const BITS = [1, 0, 1, 1, 0, 0, 1, 0];
export const SAMPLE = [0.4, -0.9, 0.6, -0.7, 0.8, 0.5, -0.95, 0.3];     // fixed "noise" samples, one per bit (relative to a signal of size 1)
const sgn = (b: number) => (b === 1 ? 1 : -1);
/** a digital receiver decides each bit by the sign of the received value: a bit is wrong only when the noise pushes it across zero */
export const bitErrors = (noise: number) => BITS.reduce((n, b, i) => n + (Math.sign(sgn(b) + noise * SAMPLE[i]) !== sgn(b) ? 1 : 0), 0);
export const wrongBits = (noise: number) => BITS.map((b, i) => Math.sign(sgn(b) + noise * SAMPLE[i]) !== sgn(b));
/** an analog signal carries the noise along: the received wave differs from the sent one by noise x sample (rms, in percent of the signal) */
export const analogDistortion = (noise: number) => 100 * noise * Math.sqrt(SAMPLE.reduce((a, x) => a + x * x, 0) / SAMPLE.length);
export const C = 3e8;
export const wavelength = (fHz: number) => C / fHz;
export const NCORE = 1.5, NCLAD = 1.46;
export const critical = () => (Math.asin(NCLAD / NCORE) * 180) / Math.PI;
export const totalReflection = (theta: number) => theta >= critical();
export function quiz(rng: () => number): Q[] {
  const f = pick(rng, [100, 150, 60, 30, 200, 75]), lam = pick(rng, [3, 2, 6, 1.5, 10, 30]);
  const [S, R] = pick(rng, [[10, 8], [20, 40], [50, 40], [100, 80], [100, 100], [50, 100]]);
  const dig = pick(rng, [
    ["与模拟信号相比，数字信号的优点是：", "抗干扰能力强，便于加工和存储", ["传输速度比光速还快", "不需要电磁波就能传播", "波形与声音的波形完全相同"]],
    ["数字信号是用什么来表示信息的？", "不连续变化的“0”和“1”的组合", ["连续变化的电流", "连续变化的声波", "光的颜色"]],
  ] as [string, string, string[]][]);
  const fib = pick(rng, [
    ["光纤通信是利用光在光导纤维中不断发生什么来传递信息的？", "全反射", ["折射", "色散", "漫反射"]],
    ["光纤通信的优点是：", "容量大、损耗小、不受电磁干扰", ["容量小、损耗大", "只能传输模拟信号", "必须靠无线电波传播"]],
  ] as [string, string, string[]][]);
  return [
    numQ(rng, "lambda", [f], `某广播电台的发射频率是 ${f} MHz，电磁波在真空中的传播速度取 3×10⁸ m/s，它的波长是多少米？`, 300 / f, "m", 1, "c = λf，λ = c / f；1 MHz = 10⁶ Hz。"),
    numQ(rng, "freq", [lam], `一束电磁波的波长是 ${lam} m，它的频率是多少兆赫？（电磁波在真空中的传播速度取 3×10⁸ m/s）`, 300 / lam, "MHz", 0, "f = c / λ。"),
    numQ(rng, "rate", [S, R], `用网络下载一个 ${S} MB 的文件，网速是 ${R} Mbit/s（1 字节 = 8 位），下载需要多少秒？`, (8 * S) / R, "s", 1, "文件的位数 = 字节数 × 8，时间 = 位数 ÷ 速率。"),
    makeQ(rng, "digital", [], dig[0], dig[1], dig[2], "数字信号只有“有”和“无”两种状态，噪声不太大时接收端仍能完全恢复，所以抗干扰能力强。"),
    makeQ(rng, "fiber", [], fib[0], fib[1], shuffle(rng, fib[2]), "光信号在光导纤维中发生全反射，沿着光纤传到远处，几乎没有损耗，容量很大。"),
  ];
}
