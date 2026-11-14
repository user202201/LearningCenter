/** 分子热运动、扩散、分子间的作用力 (pure): a seeded random walk of two kinds of molecules in a box (diffusion), the force between two molecules, the three states of matter. */
import { makeQ, numQ, pick, mulberry32, type Q } from "./qtools";
export const NP = 80;                   // molecules of each kind
export const STEP = 0.05;              // the typical step at 20 degrees (box = 2 x 1 units, ten steps a second)
/** the size of one step at T degrees Celsius: proportional to the square root of the absolute temperature (mean speed) */
export const stepSize = (T: number) => STEP * Math.sqrt((T + 273) / 293);
export interface Cloud { rx: number[]; ry: number[]; bx: number[]; by: number[] }
const cache = new Map<string, Cloud>();
/** positions of the red (left at the start) and blue (right at the start) molecules after `steps` steps of a random walk, reflected at the walls of the box 2 x 1 */
export function walk(T: number, steps: number, seed = 7): Cloud {
  const key = `${T}|${steps}|${seed}`;
  const hit = cache.get(key); if (hit) return hit;
  const rng = mulberry32(seed), gauss = () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
  const rx: number[] = [], ry: number[] = [], bx: number[] = [], by: number[] = [];
  for (let i = 0; i < NP; i++) { rx.push(rng()); ry.push(rng()); bx.push(1 + rng()); by.push(rng()); }
  const sg = stepSize(T);
  const refl = (v: number, max: number) => { let x = v % (2 * max); if (x < 0) x += 2 * max; return x > max ? 2 * max - x : x; };
  for (let s = 0; s < steps; s++) for (const [xs, ys] of [[rx, ry], [bx, by]] as [number[], number[]][]) for (let i = 0; i < NP; i++) { xs[i] = refl(xs[i] + sg * gauss(), 2); ys[i] = refl(ys[i] + sg * gauss(), 1); }
  const out = { rx, ry, bx, by };
  if (cache.size > 400) cache.clear();
  cache.set(key, out); return out;
}
/** percent mixed: 0 = still separated, 100 = as many red on the right as on the left */
export function mixing(T: number, t: number, seed = 7): number {
  const c = walk(T, Math.round(t * 10), seed);
  const fr = c.rx.filter((x) => x > 1).length / NP, fb = c.bx.filter((x) => x < 1).length / NP;
  return Math.min(100, Math.round((fr + fb) * 100));
}
/** the force between two molecules at distance x = r / r0 (r0 = the distance where the force is zero), in units of the largest attraction; positive = repulsion */
const FMIN = Math.abs(1.109 ** -13 - 1.109 ** -7);
export const force = (x: number) => (x ** -13 - x ** -7) / FMIN;
export const kind = (x: number): "repel" | "attract" | "balance" => (Math.abs(x - 1) < 1e-9 ? "balance" : x < 1 ? "repel" : "attract");
export const STATES = ["固态", "液态", "气态"];
/** relative spacing / amplitude of the molecules in the three states (drawing only) */
export const spacing = [1, 1.15, 4];
export function quiz(rng: () => number): Q[] {
  const d = pick(rng, [0.1, 0.2, 0.25, 0.5]), L = pick(rng, [1, 2, 5, 10]);
  const x = pick(rng, [0.8, 0.9, 1, 1.5, 2]);
  const kinds = { repel: "斥力占主要，表现为互相排斥", attract: "引力占主要，表现为互相吸引", balance: "引力和斥力相等，合力为零" };
  return [
    numQ(rng, "count", [d, L], `分子的直径约 ${d} nm（1 nm = 10⁻⁹ m）。把分子一个挨一个排成一条线，${L} μm（1 μm = 10⁻⁶ m）长的线上能排多少个分子？`, (L * 1000) / d, "个", 0, "L / d；1 μm = 1000 nm。"),
    makeQ(rng, "gap", [], "把 50 mL 的水和 50 mL 的酒精混合，总体积小于 100 mL，这说明：", "分子之间有间隙", ["分子在不停地运动", "分子之间有引力", "分子很小"], "酒精分子和水分子彼此进入对方的间隙，所以总体积变小。"),
    makeQ(rng, "force_kind", [x * 100], `两个分子之间的距离是 r₀ 的 ${x} 倍（r₀ 是引力与斥力相等时的距离），它们之间的作用力：`, kinds[kind(x)], [...Object.values(kinds), "分子之间没有相互作用力"], "距离小于 r₀ 时斥力占主要，大于 r₀ 时引力占主要，等于 r₀ 时合力为零。"),
    makeQ(rng, "state", [], "下列关于物质三态中分子排列的说法，正确的是：", "气体的分子间距最大，分子间的作用力极小", ["固体的分子可以自由移动", "液体的分子排列整齐，位置固定", "气体的分子之间存在很大的引力"], "固体分子排列整齐，在平衡位置附近振动；液体分子排列较紧密而无规则；气体分子间距很大，作用力极小。"),
    makeQ(rng, "diffusion", [], "往一杯清水中滴一滴红墨水，整杯水逐渐变红，这是：", "扩散现象，温度越高越快", ["对流现象，与温度无关", "扩散现象，与温度无关", "水的流动，与分子运动无关"], "扩散说明分子在不停地做无规则运动；温度越高，分子运动越剧烈，扩散越快。"),
  ];
}
