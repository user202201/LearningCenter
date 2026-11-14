/** 人类活动对环境的影响与生物多样性保护 (pure): species lost with habitat (species-area law S = c A^z) and carbon dioxide / temperature under a constant emission. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const Z = 0.25;
/** share of the species left when `lost` (0..1) of the habitat is destroyed */
export const speciesLeft = (lost: number) => (1 - lost) ** Z;
export const C0 = 420, AIRBORNE = 0.45, PPM_PER_GT = 2.13, SENS = 2;
/** CO2 in ppm after `years` of `emit` GtC per year (45 % stays in the air) */
export const co2 = (emit: number, years: number) => C0 + (AIRBORNE * emit * years) / PPM_PER_GT;
/** warming above the pre-industrial level (280 ppm): SENS degrees for every doubling */
export const warming = (c: number) => SENS * Math.log2(c / 280);
export const MEASURES: [string, string][] = [["建立自然保护区", "就地保护"], ["建立动物园和植物园", "迁地保护"], ["建立濒危物种的基因库", "离体保护"], ["颁布《野生动物保护法》", "法制管理"]];
export function quiz(rng: () => number): Q[] {
  const lost = pick(rng, [0.1, 0.3, 0.5, 0.75, 0.9]), e = pick(rng, [2, 5, 9, 10]), y = pick(rng, [10, 20, 30, 50]);
  const c = pick(rng, [420, 500, 560, 700, 840]), m = pick(rng, MEASURES);
  return [
    numQ(rng, "species", [lost], `按“物种—面积关系” S = c·A^0.25：栖息地被破坏 ${lost * 100} % 后，剩下的物种约占原来的百分之几？`, speciesLeft(lost) * 100, "%", 0, "栖息地丧失是生物多样性下降的主要原因。"),
    numQ(rng, "co2", [e, y], `大气 CO₂ 现为 420 ppm，每年排放 ${e} GtC，其中 45 % 留在大气中，每 2.13 GtC 使浓度升高 1 ppm。${y} 年后 CO₂ 浓度约是多少 ppm？`, co2(e, y), "ppm", 0, "浓度 = 420 + 0.45 × 排放量 × 年数 / 2.13。"),
    numQ(rng, "warm", [c], `按模型，比工业化前（280 ppm）每升高一倍 CO₂ 浓度，气温约升高 2 °C。浓度为 ${c} ppm 时，比工业化前约升高多少 °C？`, warming(c), "°C", 2, "升温 = 2 × log₂(浓度 / 280)。"),
    makeQ(rng, "protect", [MEASURES.indexOf(m)], `“${m[0]}”属于：`, m[1], MEASURES.map((x) => x[1]).filter((x) => x !== m[1]).concat(["迁出保护"]), "保护生物多样性最有效的措施是就地保护。"),
    makeQ(rng, "cause", [], "造成生物多样性面临威胁的主要原因不包括：", "光合作用增强", ["栖息地的破坏和丧失", "过度捕猎和采集", "外来物种入侵", "环境污染"], "此外还有气候变化等。"),
  ];
}
