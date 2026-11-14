/** 温度计 (pure): a laboratory thermometer (1 ℃ divisions), the clinical thermometer with its narrow neck, and how the bulb is placed when taking a water temperature. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export const LAB_MIN = -20, LAB_MAX = 110, CLIN_MIN = 35, CLIN_MAX = 42, AIR = 20;
export const readLab = (T: number) => Math.max(LAB_MIN, Math.min(LAB_MAX, Math.round(T)));
const r1 = (x: number) => Math.round(x * 10) / 10;
/** the clinical thermometer: the mercury goes up with the body temperature and stays at its highest value (the narrow neck) until it is shaken down */
export const clinical = (prev: number, now: number, shaken: number) => r1(shaken === 1 ? now : Math.max(prev, now));
export const PLACES = ["玻璃泡全部浸没在水中，不碰容器底和壁", "玻璃泡碰到正在加热的容器底", "玻璃泡只有一部分浸在水中", "把温度计拿出水面再读数"];
/** the reading for each way of holding the thermometer (illustrative size of the errors; the direction is what the textbook states) */
export const placed = (T: number, place: number) => (place === 0 ? T : place === 1 ? T + 0.08 * (T - AIR) : place === 2 ? T - 0.2 * (T - AIR) : AIR + 0.35 * (T - AIR));
export const verdict = (T: number, place: number) => { const d = placed(T, place) - T; return Math.abs(d) < 0.05 ? "准确" : d > 0 ? "偏高" : "偏低"; };
export function quiz(rng: () => number): Q[] {
  const d = pick(rng, [1, 2, 0.5]), k = pick(rng, [3, 4, 5, 6, 7, 8]);
  const n = pick(rng, [20, 25, 40, 50, 100]);
  const prev = pick(rng, [38, 38.5, 39, 39.5]), now = pick(rng, [36.5, 36.8, 37, 39.8, 40.2]);
  return [
    numQ(rng, "read", [d, k], `温度计的分度值是 ${d} ℃，液面在 0 ℃ 刻度线下方第 ${k} 格处，读数是多少？`, -d * k, "℃", 1, "0 ℃ 以下的温度是负值：读数 = −（格数 × 分度值）。"),
    numQ(rng, "division", [n], `一支温度计的 0 ℃ 刻度线和 100 ℃ 刻度线之间共有 ${n} 格，它的分度值是多少？`, 100 / n, "℃", 1, "分度值 = 量程 ÷ 格数。"),
    numQ(rng, "clinical", [prev, now], `体温计的示数停在 ${prev} ℃，没有甩就去测一位体温为 ${now} ℃ 的同学，示数是多少？`, Math.max(prev, now), "℃", 1, "体温计有缩口，水银柱只升不降，所以示数是较高的那个温度。"),
    makeQ(rng, "neck", [], "体温计可以离开人体读数，是因为它的玻璃泡上方有：", "一段很细的缩口", ["很粗的管子", "一层真空", "一个小气泡"], "水银遇冷收缩时在缩口处断开，水银柱不会自己退回玻璃泡。"),
    makeQ(rng, "method", [], "用温度计测量烧杯中热水的温度，下列做法正确的是：", "玻璃泡全部浸没在水中，不碰容器底和壁，稍候再读数", ["玻璃泡碰到烧杯底部", "玻璃泡只浸入一半", "把温度计拿出水面再读数"], "玻璃泡要浸没在被测液体中，不碰容器；等示数稳定后，在温度计仍留在液体中时读数。"),
  ];
}
