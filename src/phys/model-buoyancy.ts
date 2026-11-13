/** 浮力 (pure): Archimedes' principle and the conditions for floating, suspending and sinking. Densities in kg/m³, volumes in cm³. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const g = 9.8;
export type State = "float" | "suspend" | "sink";
export interface Buoy { G: number; F: number; Vdisp: number; frac: number; state: State; Tscale: number; Gdisp: number; bottomN: number }
/** mode 0: the block is held and lowered by hand until a share `frac` of it is under the liquid (spring scale reading T = G - F). mode 1: it is let go. */
export function solve(rhoB: number, rhoL: number, V: number, mode: number, frac: number): Buoy {
  const Vm = V * 1e-6, G = rhoB * Vm * g;
  let fr = frac, state: State;
  if (mode === 1) {
    if (Math.abs(rhoB - rhoL) < 0.5) { fr = 1; state = "suspend"; } else if (rhoB < rhoL) { fr = rhoB / rhoL; state = "float"; } else { fr = 1; state = "sink"; }
  } else state = rhoB < rhoL ? "float" : Math.abs(rhoB - rhoL) < 0.5 ? "suspend" : "sink";
  const F = rhoL * g * Vm * fr;
  return { G, F, Vdisp: V * fr, frac: fr, state, Tscale: mode === 0 ? G - F : 0, Gdisp: F, bottomN: mode === 1 && state === "sink" ? G - F : 0 };
}
export const SOLVE_LIQ: [number, string, number][] = [[0.8, "酒精", 800], [1, "水", 1000], [1.2, "盐水", 1200], [1.4, "浓盐水", 1400]];
export function quiz(rng: () => number): Q[] {
  const V1 = pick(rng, [100, 200, 500, 1000]);
  const G2 = pick(rng, [2, 3, 4, 5]), T2 = pick(rng, [0.5, 1, 1.5, 2]);
  const rb = pick(rng, [0.2, 0.4, 0.5, 0.6, 0.8]);
  const m4 = pick(rng, [0.1, 0.2, 0.5, 1, 2]);
  const [rb5, rl5] = pick(rng, [[0.6, 1], [1.5, 1], [1, 1], [2.7, 1], [0.8, 1.2], [1.2, 1.2], [1.8, 1.2], [0.5, 0.8], [1, 0.8]]);
  const st = rb5 < rl5 ? "float" : rb5 === rl5 ? "suspend" : "sink";
  const names = { float: "上浮，最后漂浮在液面上", suspend: "悬浮在液体中", sink: "下沉到容器底部" };
  return [
    numQ(rng, "arch", [V1], `体积 ${V1} cm³ 的物体浸没在水中（密度 1000 kg/m³），受到的浮力是多少？（g = 9.8 N/kg）`, 1000 * g * V1 * 1e-6, "N", 2, "F浮 = ρ液gV排。"),
    numQ(rng, "weigh", [G2, T2], `物体挂在弹簧测力计下，示数是 ${G2} N；浸没在水中后示数变为 ${T2} N，物体受到的浮力是多少？`, G2 - T2, "N", 1, "称重法：F浮 = G − F示。"),
    numQ(rng, "share", [rb], `密度为 ${rb} g/cm³ 的木块漂浮在水面上，木块浸入水中的体积占它总体积的百分之几？`, rb * 100, "%", 0, "漂浮时 F浮 = G，ρ液 V排 = ρ物 V物。"),
    numQ(rng, "floatF", [m4], `质量 ${m4} kg 的物体漂浮在水面上，受到的浮力是多少？（g = 9.8 N/kg）`, m4 * g, "N", 2, "漂浮时 F浮 = G = mg。"),
    makeQ(rng, "state", [rb5, rl5], `物体的密度是 ${rb5} g/cm³，放入密度为 ${rl5} g/cm³ 的液体中（浸没后松手），物体将：`, names[st], Object.entries(names).filter(([k]) => k !== st).map(([, v]) => v).concat(["先上浮再下沉"]), "ρ物 < ρ液 漂浮；ρ物 = ρ液 悬浮；ρ物 > ρ液 下沉。"),
  ];
}
