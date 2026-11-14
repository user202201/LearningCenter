/**
 * 质量与密度 (pure): rho = m / V, the two required measurements of 人教版 八年级上册 第六章
 * (a solid: balance + water displacement in a measuring cylinder; a liquid: balance + measuring cylinder) and the error of a wrong order of steps.
 * Masses in g, volumes in cm³ (= mL), densities in kg/m³ unless a name says g/cm³.
 */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const SOLIDS: [number, string, number][] = [[0, "铝块", 2700], [1, "铁块", 7900], [2, "铜块", 8900], [3, "玻璃块", 2500], [4, "铅块", 11300], [5, "石蜡块", 900]];
export const LIQUIDS: [number, string, number][] = [[0, "酒精", 800], [1, "植物油", 900], [2, "清水", 1000], [3, "盐水", 1200], [4, "蜂蜜", 1400]];
/** the density table used to name a metal (kg/m³) */
export const METALS: [string, number][] = [["铝块", 2700], ["铁块", 7900], ["铜块", 8900], ["银块", 10500], ["铅块", 11300]];
export const WET_G = 1.5;       // g of water that stays on a solid taken out of the cylinder
export const RESIDUE_ML = 2;    // mL of liquid that stays on the wall of a beaker after pouring
export const BEAKER_G = 50;     // mass of the empty beaker
export const LIQ_TOTAL = 100;   // mL of liquid in the beaker at the start (right order)
export const CYL_MAX = 100;     // mL, the measuring cylinder
const r1 = (x: number) => Math.round(x * 10) / 10;
export const massOf = (rho: number, V: number) => (rho / 1000) * V;   // g
export const densityOf = (m: number, V: number) => m / V;             // g/cm³ for g and cm³

export interface SolidRes { m: number; V1: number; V2: number; V: number; rho: number; rhoTrue: number; errPct: number; floats: boolean }
/** a solid: order 0 = mass first, then the volume; order 1 = the volume first, the wet solid is weighed afterwards */
export function solid(rho: number, V: number, V1: number, order: number): SolidRes {
  const m = r1(massOf(rho, V) + (order === 1 ? WET_G : 0));
  const V2 = V1 + V, Vm = V2 - V1, rhoM = m / Vm, rhoTrue = rho / 1000;
  return { m, V1, V2, V: Vm, rho: rhoM, rhoTrue, errPct: (rhoM / rhoTrue - 1) * 100, floats: rho < 1000 };
}
export interface LiquidRes { a: number; b: number; m: number; V: number; rho: number; rhoTrue: number; errPct: number }
/** a liquid: order 0 = weigh beaker + liquid (a), pour V mL into the cylinder, weigh the rest (b), rho = (a - b) / V;
 *  order 1 = weigh the empty beaker (a), pour V mL of liquid in and weigh (b), pour all of it into the cylinder: RESIDUE_ML stays on the wall, the volume read is smaller */
export function liquid(rho: number, V: number, order: number): LiquidRes {
  const rhoTrue = rho / 1000;
  if (order === 0) {
    const a = r1(BEAKER_G + massOf(rho, LIQ_TOTAL)), b = r1(BEAKER_G + massOf(rho, LIQ_TOTAL - V)), m = r1(a - b), rhoM = m / V;
    return { a, b, m, V, rho: rhoM, rhoTrue, errPct: (rhoM / rhoTrue - 1) * 100 };
  }
  const a = r1(BEAKER_G), b = r1(BEAKER_G + massOf(rho, V)), m = r1(b - a), Vr = V - RESIDUE_ML, rhoM = m / Vr;
  return { a, b, m, V: Vr, rho: rhoM, rhoTrue, errPct: (rhoM / rhoTrue - 1) * 100 };
}
/** the metal of the table whose density is within 4 % of `rho` (g/cm³), or null */
export function nameMetal(rhoGcm3: number): string | null {
  let best: string | null = null, bd = 0.04;
  for (const [n, d] of METALS) { const e = Math.abs(rhoGcm3 * 1000 - d) / d; if (e < bd) { bd = e; best = n; } }
  return best;
}
/** a body let go in a liquid (both densities in any equal unit) */
export const behaviour = (rhoBody: number, rhoLiquid: number): "float" | "suspend" | "sink" => (Math.abs(rhoBody - rhoLiquid) < 1e-9 ? "suspend" : rhoBody < rhoLiquid ? "float" : "sink");
const FLOAT_NAMES = { float: "上浮，最后漂浮在液面上", suspend: "悬浮在液体中", sink: "下沉到容器底部" };
const ORDER_Q: [string, string][] = [
  ["测量固体的密度时，先把石块放入量筒测体积，再用天平称它的质量，测得的密度比真实值：", "偏大"],
  ["测量液体的密度时，先称空烧杯的质量，再倒入液体称总质量，最后把液体全部倒入量筒读体积（烧杯壁上有残留），测得的密度比真实值：", "偏大"],
  ["测量液体的密度时，先用量筒量出液体的体积，再把它全部倒入烧杯称质量（量筒壁上有残留），测得的密度比真实值：", "偏小"],
];
export function quiz(rng: () => number): Q[] {
  const rho = pick(rng, [2.7, 7.9, 8.9, 11.3, 0.9, 1.2]), V = pick(rng, [10, 20, 25, 50]), m = r1(rho * V);
  const V1 = pick(rng, [30, 40, 50, 60]), dV = pick(rng, [8, 12, 15, 20, 25, 30]);
  const mi = Math.floor(rng() * METALS.length), mV = pick(rng, [10, 20, 40]), mm = r1((METALS[mi][1] / 1000) * mV);
  const [a, b] = pick(rng, [[0.6, 1], [1.5, 1], [1, 1], [2.7, 1], [0.8, 1.2], [1.2, 1.2], [1.8, 1.2], [0.5, 0.8], [1, 0.8]]);
  const st = behaviour(a, b), oi = Math.floor(rng() * ORDER_Q.length);
  return [
    numQ(rng, "rho", [m, V], `一块物质的质量是 ${m} g，体积是 ${V} cm³，它的密度是多少？`, m / V, "g/cm³", 1, "ρ = m / V。"),
    numQ(rng, "displace", [V1, V1 + dV], `量筒中盛有 ${V1} mL 的水，放入一块石块（完全浸没）后，水面升到 ${V1 + dV} mL，石块的体积是多少？`, dV, "cm³", 0, "石块的体积 V = V₂ − V₁（1 mL = 1 cm³）。"),
    makeQ(rng, "ident", [mi, mV], `用天平和量筒测得一个金属块的质量是 ${mm} g，体积是 ${mV} cm³。对照密度表（铝 2.7、铁 7.9、铜 8.9、银 10.5、铅 11.3，单位 g/cm³），它最可能是：`, METALS[mi][0], METALS.map((x) => x[0]).filter((x) => x !== METALS[mi][0]), "先由 ρ = m / V 算出密度，再与密度表比较。"),
    makeQ(rng, "float", [a, b], `实心物体的密度是 ${a} g/cm³，把它浸没在密度是 ${b} g/cm³ 的液体中后松手，静止时它将：`, FLOAT_NAMES[st], Object.entries(FLOAT_NAMES).filter(([k]) => k !== st).map(([, v]) => v).concat(["先下沉再上浮"]), "ρ物 < ρ液 上浮并漂浮；ρ物 = ρ液 悬浮；ρ物 > ρ液 下沉。"),
    makeQ(rng, "order", [oi], ORDER_Q[oi][0], ORDER_Q[oi][1], ["偏大", "偏小", "没有影响", "无法判断"], oi === 0 ? "石块沾了水，测得的质量偏大，体积不变，所以密度偏大。" : oi === 1 ? "残留使测得的体积偏小，质量不变，所以密度偏大。" : "残留使测得的质量偏小，体积不变，所以密度偏小。"),
  ];
}
