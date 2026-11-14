/** 热机四冲程、热机效率、能量守恒 (pure): the crank-piston geometry and the four strokes of a petrol / diesel engine, the heat of the fuel, the efficiency, the energy balance. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const STROKES = ["吸气冲程", "压缩冲程", "做功冲程", "排气冲程"];
/** the crank angle (degrees, 0..720, 0 = the piston at the top at the start of the intake) -> the stroke 0..3 */
export const stroke = (theta: number) => Math.floor((((theta % 720) + 720) % 720) / 180) % 4;
const CR = 1, CL = 3.2;
const rad = (d: number) => (d * Math.PI) / 180;
/** 0 = piston at the top dead centre, 1 = at the bottom (slider-crank: crank radius 1, rod 3.2) */
export const piston = (theta: number) => { const a = rad(theta); return (CR + CL - (CR * Math.cos(a) + Math.sqrt(CL * CL - (CR * Math.sin(a)) ** 2))) / (2 * CR); };
export const COMPRESSION = 10;
/** cylinder volume relative to the swept volume */
export const volume = (theta: number) => 1 / (COMPRESSION - 1) + piston(theta);
export const intakeOpen = (theta: number) => stroke(theta) === 0;
export const exhaustOpen = (theta: number) => stroke(theta) === 3;
/** the piston moves down in the intake and power strokes, up in the other two */
export const down = (theta: number) => stroke(theta) % 2 === 0;
const VMAX = 1 + 1 / (COMPRESSION - 1), GAMMA = 1.35;
/** gas pressure relative to the air outside: ~1 in the intake, rising in the compression, a jump at the burn, falling in the power stroke, a little above 1 in the exhaust */
export function pressure(theta: number): number {
  const s = stroke(theta), V = volume(theta);
  if (s === 0) return 0.9;
  if (s === 1) return (VMAX / V) ** GAMMA;
  if (s === 2) return 3 * COMPRESSION ** GAMMA * (1 / (COMPRESSION - 1) / V) ** GAMMA;
  return 1.2;
}
export const FUELS: [string, number][] = [["汽油", 4.6e7], ["柴油", 4.3e7], ["酒精", 3e7], ["干木柴", 1.2e7]];
export const heat = (q: number, m: number) => q * m;
/** efficiency in percent: what is left after the exhaust, the cooling water and friction took their shares (each in percent of the fuel's heat) */
export const efficiency = (exhaust: number, cooling: number, friction: number) => Math.max(0, 100 - exhaust - cooling - friction);
export const work = (Q: number, eta: number) => (Q * eta) / 100;
export type Balance = "ok" | "more" | "less";
export const balance = (input: number, ...outs: number[]): Balance => { const t = outs.reduce((a, b) => a + b, 0); return Math.abs(t - input) < 0.5 ? "ok" : t > input ? "more" : "less"; };
export const worksPerSecond = (rpm: number) => rpm / 120;
export function quiz(rng: () => number): Q[] {
  const [fn, fq] = pick(rng, FUELS), m = pick(rng, [0.5, 1, 2, 0.2]);
  const [W, Q] = pick(rng, [[12, 40], [9, 30], [15, 50], [8, 32], [21, 60]]);
  const rpm = pick(rng, [1200, 2400, 3000, 3600, 6000]);
  const th = pick(rng, [90, 270, 450, 630]);
  return [
    numQ(rng, "Q", [fq / 1e7, m], `完全燃烧 ${m} kg ${fn}（热值 ${fq / 1e7}×10⁷ J/kg）放出的热量是多少？`, (fq * m) / 1e6, "MJ", 1, "Q = qm；1 MJ = 10⁶ J。"),
    numQ(rng, "eta", [W, Q], `一台热机燃料完全燃烧放出 ${Q} MJ 的热量，其中 ${W} MJ 转化为有用的机械能，热机的效率是多少？`, (W / Q) * 100, "%", 1, "η = W有 / Q放。"),
    numQ(rng, "rev", [rpm], `一台四冲程汽油机的飞轮转速是 ${rpm} r/min，它每秒钟做功多少次？`, worksPerSecond(rpm), "次", 1, "四个冲程飞轮转 2 圈，做功 1 次。"),
    makeQ(rng, "stroke", [th], `四冲程内燃机的曲轴转到 ${th}°（从吸气冲程开始时算起，转两圈共 720°），此时是哪个冲程？`, STROKES[stroke(th)], STROKES, "每 180° 一个冲程：吸气 0–180°，压缩 180–360°，做功 360–540°，排气 540–720°。"),
    makeQ(rng, "conv", [], "在四冲程内燃机的压缩冲程中，能量的转化是：", "机械能转化为内能", ["内能转化为机械能", "化学能转化为电能", "没有能量的转化"], "活塞压缩气体做功，气体的内能增加，温度升高；做功冲程才是内能转化为机械能。"),
  ];
}
