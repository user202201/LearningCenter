/** 探究酒精对水蚤心率的影响 (pure, 七下 · 物质的运输): heartbeats of a water flea counted for 10 s in alcohol of different concentrations (teaching values, seeded counting noise of +-1). */
import { makeQ, numQ, pick, mulberry32, type Q } from "../phys/qtools";
export const CONC = [0, 1, 5, 8, 10, 15, 20];   // % alcohol
export const BASE = [33, 32, 28, 25, 22, 15, 0];   // heartbeats per 10 s
export const baseOf = (conc: number) => BASE[CONC.indexOf(conc)];
/** three counts of 10 s each, with a scatter of +-1 (never above zero once the water flea has died) */
export function counts(conc: number, seed: number): number[] {
  const b = baseOf(conc);
  return [0, 1, 2].map((k) => (b === 0 ? 0 : Math.max(1, b + Math.round(mulberry32(seed * 53 + conc * 7 + k * 19 + 3)() * 2 - 1))));
}
export const mean3 = (a: number[]) => (a[0] + a[1] + a[2]) / 3;
export const perMinute = (per10: number) => per10 * 6;
export const change = (conc: number, seed: number) => ((mean3(counts(conc, seed)) - mean3(counts(0, seed))) / mean3(counts(0, seed))) * 100;
export function quiz(rng: () => number): Q[] {
  const n = pick(rng, [24, 28, 30, 33, 36]), a = pick(rng, [30, 32, 33, 35]), b = pick(rng, [18, 20, 22, 25]);
  const x = pick(rng, [20, 21, 23]), y = pick(rng, [22, 24, 25]), z = pick(rng, [26, 27, 29]);
  return [
    numQ(rng, "pmin", [n], `数水蚤的心跳：10 s 内数到 ${n} 次，每分钟约跳多少次？`, perMinute(n), "/min", 0, "每分钟的心跳次数 = 10 s 的次数 × 6。"),
    numQ(rng, "drop", [a, b], `清水中水蚤 10 s 心跳 ${a} 次，在某浓度的酒精中心跳 ${b} 次，心率比清水中减少了百分之几？`, ((a - b) / a) * 100, "%", 0, "减少的百分数 = (清水中的次数 − 酒精中的次数) ÷ 清水中的次数 × 100 %。"),
    numQ(rng, "avg", [x, y, z], `同一只水蚤三次计数的结果分别是 ${x}、${y}、${z} 次（每次 10 s），平均每 10 s 心跳多少次？`, (x + y + z) / 3, "", 1, "重复计数取平均值，可以减小误差。"),
    makeQ(rng, "ctrl", [], "本实验中，在清水里观察水蚤的心率，其作用是：", "作对照，与酒精中的心率比较", ["作为实验变量", "杀死水蚤", "增加酒精的浓度", "使水蚤停止运动"], "对照实验中，只有酒精的浓度这一个条件不同。"),
    makeQ(rng, "high", [], "酒精浓度较高（如 20 %）时，水蚤的心率会：", "停止跳动，水蚤死亡", ["明显加快", "保持不变", "略微加快后恢复", "跳动得更有力"], "酒精对心脏有抑制作用，浓度越高，心率越慢；酒精浓度过高时，水蚤会死亡。"),
  ];
}
