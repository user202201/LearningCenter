/** 声现象: pitch (frequency), loudness (amplitude) and timbre (waveform = which harmonics) (pure). */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const SOUND_SPEED = 340;
/** sine coefficients b_n of sin(n x) for the four timbres: 0 pure tone, 1 square, 2 sawtooth, 3 triangle */
export function harmonics(timbre: number): number[] {
  const b: number[] = [0];
  for (let n = 1; n <= 15; n++) {
    if (timbre === 0) b.push(n === 1 ? 1 : 0);
    else if (timbre === 1) b.push(n % 2 ? 1 / n : 0);
    else if (timbre === 2) b.push(n <= 12 ? 1 / n : 0);
    else b.push(n % 2 ? ((n - 1) / 2 % 2 ? -1 : 1) / (n * n) : 0);
  }
  return b;
}
const peaks: number[] = [];
/** the largest |sum| of a timbre over one period (so that the amplitude slider is the real peak) */
export function peakOf(timbre: number): number {
  if (peaks[timbre] === undefined) { const b = harmonics(timbre); let m = 0; for (let i = 0; i < 2048; i++) { const x = (2 * Math.PI * i) / 2048; let s = 0; for (let n = 1; n < b.length; n++) s += b[n] * Math.sin(n * x); m = Math.max(m, Math.abs(s)); } peaks[timbre] = m; }
  return peaks[timbre];
}
/** the air pressure deviation (what an oscilloscope shows) at time t seconds */
export function wave(timbre: number, f: number, A: number, t: number): number {
  const b = harmonics(timbre); let s = 0;
  for (let n = 1; n < b.length; n++) if (b[n]) s += b[n] * Math.sin(2 * Math.PI * n * f * t);
  return (A * s) / peakOf(timbre);
}
export const period = (f: number) => 1 / f;
export const wavelength = (f: number, v = SOUND_SPEED) => v / f;
/** loudness level in dB relative to amplitude 1 = 60 dB (a tenfold amplitude = +20 dB) */
export const levelDb = (A: number) => 60 + 20 * Math.log10(A);
export const midi = (f: number) => 69 + 12 * Math.log2(f / 440);
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
/** the nearest equal-tempered note (A4 = 440 Hz) and how far off it is in cents */
export function nearestNote(f: number): { name: string; cents: number } {
  const m = midi(f), r = Math.round(m);
  return { name: `${NAMES[((r % 12) + 12) % 12]}${Math.floor(r / 12) - 1}`, cents: Math.round((m - r) * 100) };
}
export const audible = (f: number) => f >= 20 && f <= 20000;
export function quiz(rng: () => number): Q[] {
  const f1 = pick(rng, [100, 125, 200, 250, 400, 500, 1000]);
  const f2 = pick(rng, [170, 340, 425, 500, 680, 850]);
  const k = pick(rng, [2, 10, 100]);
  const f3 = pick(rng, [220, 262, 330, 440]), n = pick(rng, [1, 2, 3]);
  return [
    numQ(rng, "period", [f1], `一个声源每秒振动 ${f1} 次，它的周期是多少？`, 1000 / f1, "ms", 1, "T = 1 / f。"),
    numQ(rng, "wavelength", [f2], `声音在空气中的速度取 340 m/s，频率 ${f2} Hz 的声音波长是多少？`, SOUND_SPEED / f2, "m", 2, "λ = v / f。"),
    numQ(rng, "db", [k], `其他条件不变，声源的振幅变为原来的 ${k} 倍，声音强弱大约增加多少 dB？`, Math.round(20 * Math.log10(k)), "dB", 0, "每 10 倍的振幅增加 20 dB。"),
    numQ(rng, "octave", [f3, n], `比 ${f3} Hz 高 ${n} 个八度的声音，频率是多少？`, f3 * 2 ** n, "Hz", 0, "高一个八度，频率变为原来的 2 倍。"),
    makeQ(rng, "concept", [], "声音的音调高低由什么决定？", "声源振动的频率", ["声源振动的振幅", "声源离听者的距离", "声音传播的速度", "声源的材料"], "频率越高，音调越高。"),
  ];
}
