/** 种子萌发的条件 (pure): a controlled experiment. */
import { makeQ, numQ, pick, shuffle, type Q } from "../phys/qtools";
export const OPT = 27, N = 20;
export const tempFactor = (T: number) => Math.max(0, 1 - ((T - OPT) / 22) ** 2);   // 0 at 5 and 49 degrees
const S = (d: number, d50: number) => 1 / (1 + Math.exp(-(d - d50) / 0.6));
/** the share of the seeds that have germinated on `day` (0..1) */
export function germRate(day: number, water: number, air: number, T: number, viable: number): number {
  if (!water || !air || !viable) return 0;
  const tf = tempFactor(T);
  if (tf <= 0) return 0;
  const d50 = 2 + 4 * (1 - tf);
  return (0.95 * tf * (S(day, d50) - S(0, d50))) / (1 - S(0, d50));
}
export const germCount = (rate: number) => Math.round(N * rate);
export const germinates = (water: number, air: number, T: number, viable: number) => !!water && !!air && !!viable && tempFactor(T) > 0;
export function quiz(rng: () => number): Q[] {
  const w = pick(rng, [0, 1]), a = pick(rng, [0, 1]), T = pick(rng, [0, 4, 10, 20, 25, 30, 40, 50]), v = pick(rng, [1, 1, 0]);
  const yn = (x: number, t: string) => (x ? `${t}` : `没有${t}`);
  const total = pick(rng, [50, 100, 200]), pct = pick(rng, [60, 70, 80, 90]);
  const k = pick(rng, [12, 14, 15, 16, 18, 19]);
  return [
    makeQ(rng, "germ", [w, a, T, v], `把种子放在下面的条件中：${yn(w, "水")}、${yn(a, "空气")}、温度 ${T} °C、${v ? "种子完整且有活力" : "种子已煮熟"}。种子会萌发吗？`, germinates(w, a, T, v) ? "萌发" : "不萌发", ["萌发", "不萌发", "只长出胚芽", "无法判断"], "种子萌发需要适宜的温度、一定的水分和充足的空气，并且胚是完整的、有活力的。"),
    numQ(rng, "rate", [k], `${N} 粒种子中有 ${k} 粒萌发，种子的萌发率是多少？`, (k / N) * 100, "%", 0, "萌发率 = 萌发的种子数 / 供试种子数 × 100%。"),
    numQ(rng, "count", [total, pct], `播种 ${total} 粒种子，萌发率为 ${pct}%，萌发的种子大约有多少粒？`, (total * pct) / 100, "粒", 0, "萌发的种子数 = 种子数 × 萌发率。"),
    makeQ(rng, "inner", [], "种子萌发的自身条件是：", "胚是完整的、有活力的，并且已度过休眠期", shuffle(rng, ["种子越大越好", "种子的颜色必须为白色", "种子必须有光照", "种子表面必须有水膜"]), "还要有适宜的外界条件：温度、水分、空气。"),
    makeQ(rng, "first", [], "种子萌发时，最先突破种皮的结构是：", "胚根", ["胚芽", "子叶", "胚轴", "种皮"], "胚根发育成根，胚芽发育成茎和叶。"),
  ];
}
