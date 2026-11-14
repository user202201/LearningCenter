/** 电路搭建 (pure): three resistors that can each be left out, put in the series chain or in the parallel group; the group is in series with the chain. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const RES = [10, 20, 30];
export const NAME = ["A", "B", "C"];
export type Kind = "open" | "series" | "parallel" | "mixed";
export interface Part { R: number; I: number; U: number; place: "off" | "series" | "parallel" }
export interface Built { R: number; I: number; kind: Kind; parts: Part[]; Upar: number }
/** m[i]: 0 = not connected, 1 = in the series chain, 2 = in the parallel group (a lone resistor in the group is just part of the chain); `closed` = the switch */
export function build(U: number, closed: boolean, m: number[]): Built {
  const place = m.map((v) => (v === 1 ? "series" : v === 2 ? "parallel" : "off")) as Part["place"][];
  if (place.filter((p) => p === "parallel").length === 1) { const i = place.indexOf("parallel"); place[i] = "series"; }
  const S = RES.filter((_, i) => place[i] === "series"), Pr = RES.filter((_, i) => place[i] === "parallel");
  const Rs = S.reduce((a, b) => a + b, 0), Rp = Pr.length ? 1 / Pr.reduce((a, b) => a + 1 / b, 0) : 0, R = Rs + Rp;
  const kind: Kind = !S.length && !Pr.length ? "open" : Pr.length && S.length ? "mixed" : Pr.length ? "parallel" : "series";
  const I = kind === "open" || !closed ? 0 : U / R, Upar = I * Rp;
  const parts: Part[] = RES.map((r, i) => place[i] === "off" ? { R: r, I: 0, U: 0, place: "off" } : place[i] === "series" ? { R: r, I, U: I * r, place: "series" } : { R: r, I: Upar / r, U: Upar, place: "parallel" });
  return { R: kind === "open" ? Infinity : R, I, kind, parts, Upar };
}
export function quiz(rng: () => number): Q[] {
  const [a, b] = pick(rng, [[10, 20], [15, 30], [20, 40], [12, 24], [30, 60]]);
  const [c, d] = pick(rng, [[20, 30], [10, 40], [30, 60], [12, 6], [40, 40]]);
  const [e, f, g] = pick(rng, [[10, 20, 30], [10, 30, 60], [20, 20, 20], [15, 30, 60]]);
  const [U, r1, r2] = pick(rng, [[6, 10, 20], [12, 20, 30], [9, 30, 30], [12, 10, 40]]);
  return [
    numQ(rng, "Rs", [a, b], `把 ${a} Ω 和 ${b} Ω 的电阻串联，总电阻是多少？`, a + b, "Ω", 1, "串联：R = R₁ + R₂。"),
    numQ(rng, "Rp", [c, d], `把 ${c} Ω 和 ${d} Ω 的电阻并联，总电阻是多少？`, (c * d) / (c + d), "Ω", 1, "并联：1/R = 1/R₁ + 1/R₂。"),
    numQ(rng, "Rm", [e, f, g], `${e} Ω 的电阻与 ${f} Ω、${g} Ω 两个电阻的并联组合串联，总电阻是多少？`, e + (f * g) / (f + g), "Ω", 1, "先求并联部分的等效电阻，再与串联部分相加。"),
    numQ(rng, "I_br", [U, r1, r2], `${r1} Ω 与 ${r2} Ω 的电阻并联在 ${U} V 的电源两端，通过 ${r1} Ω 电阻的电流是多少？`, U / r1, "A", 2, "并联电路各支路两端的电压都等于电源电压：I = U / R。"),
    makeQ(rng, "home", [], "家庭电路中各用电器之间是并联的，这是因为：", "并联时各用电器互不影响，都能在额定电压下工作", ["并联时总电阻最大", "并联时通过各用电器的电流相等", "串联时用电器的电压都是 220 V"], "并联的各支路两端电压相等，一个用电器断开，其他用电器仍能工作。"),
  ];
}
