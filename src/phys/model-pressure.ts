/** 压强 (pure): p = F/S, liquid pressure p = rho g h, atmospheric pressure and the mercury column. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const g = 10;
export const LIQUIDS: [number, string, number][] = [[0, "清水", 1000], [1, "盐水", 1200], [2, "酒精", 800], [3, "水银", 13600]];
export const rhoOf = (i: number) => LIQUIDS[i][2];
export const P0 = 101325;
export const liquidP = (rho: number, h: number) => rho * g * h;
export const solidP = (F: number, S_cm2: number) => F / (S_cm2 * 1e-4);
/** atmospheric pressure at an altitude (m): the isothermal approximation with a scale height of 8434 m */
export const atmAt = (alt: number) => P0 * Math.exp(-alt / 8434);
/** the vertical height of the mercury column (mm): the standard atmosphere is DEFINED with the standard gravity 9.80665 m/s², so 101325 Pa = 760 mm (not with the g = 10 used elsewhere) */
export const G_STD = 9.80665;
export const mercuryMm = (p: number) => (p / (13600 * G_STD)) * 1000;
export function quiz(rng: () => number): Q[] {
  const h1 = pick(rng, [0.1, 0.2, 0.5, 1, 2, 5, 10]);
  const F2 = pick(rng, [20, 50, 100, 200, 500]), S2 = pick(rng, [4, 10, 20, 25, 50]);
  const hd = pick(rng, [2, 5, 10, 20]);
  const k = pick(rng, [2, 4]);
  return [
    numQ(rng, "liquid", [h1], `水（密度 1000 kg/m³）中深度 ${h1} m 处，液体产生的压强是多少？（g = 10 N/kg）`, liquidP(1000, h1) / 1000, "kPa", 2, "p = ρgh。"),
    numQ(rng, "solid", [F2, S2], `${F2} N 的压力作用在 ${S2} cm² 的面积上，压强是多少？`, solidP(F2, S2) / 1000, "kPa", 1, "p = F / S（注意 1 cm² = 10⁻⁴ m²）。"),
    numQ(rng, "water_col", [], "标准大气压约为 1.013×10⁵ Pa，它能支持多高的水柱？（水的密度 1000 kg/m³，g = 10 N/kg）", P0 / (1000 * g), "m", 1, "h = p / (ρg)，水柱约 10 m 高。"),
    numQ(rng, "depth", [hd], `水中某处液体压强为 ${fmtK(liquidP(1000, hd))} kPa，该处的深度是多少？（g = 10 N/kg）`, hd, "m", 0, "h = p / (ρg)。"),
    makeQ(rng, "pratio", [k], `压力不变，受力面积变为原来的 1/${k}，压强变为原来的：`, `${k} 倍`, [`1/${k} 倍`, "不变", `${k * 2} 倍`, `${k + 1} 倍`], "p = F / S，压力不变时压强与受力面积成反比。"),
  ];
}
const fmtK = (v: number) => String(Math.round(v / 100) / 10);
