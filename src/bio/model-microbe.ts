/** 细菌和真菌 (pure, 八上): counting colonies after serial dilution, the structure of a bacterium and of a yeast, and antibiotic resistance as a population model. */
import { makeQ, numQ, pick, mulberry32, type Q } from "../phys/qtools";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const sup = (n: number) => String(Math.abs(n)).split("").map((d) => SUP[Number(d)]).join("") ;
export const pow10 = (n: number) => `10${n < 0 ? "⁻" : ""}${sup(n)}`;
/** colonies expected on a plate: bacteria per mL of the original = 10^c0, diluted 10^dil times, `vol` mL spread */
export const expected = (c0: number, dil: number, vol: number) => 10 ** (c0 - dil) * vol;
/** the colonies counted: the expected number plus a random scatter of one standard deviation sqrt(mu) (seeded) */
export function colonies(mu: number, seed: number): number {
  const r = mulberry32(seed * 7919 + 13); const u = Math.max(1e-9, r()), v = r();
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(0, Math.round(mu + Math.sqrt(mu) * z));
}
/** 0 = too many to count (more than 300), 1 = a countable plate (30-300), 2 = too few (under 30) */
export const plateState = (mu: number, n: number): 0 | 1 | 2 => (mu > 300 ? 0 : n >= 30 ? 1 : 2);
export const PLATE_TEXT = ["菌落太多，连成一片，无法计数", "菌落数在 30–300 之间，适合计数", "菌落太少（少于 30），计数误差大"];
/** bacteria per mL of the original suspension estimated from N colonies */
export const estimate = (n: number, dil: number, vol: number) => n / (vol * 10 ** -dil);
export const sci = (v: number): string => { if (v <= 0) return "0"; const e = Math.floor(Math.log10(v)); const m = v / 10 ** e; return `${(Math.round(m * 10) / 10).toFixed(1)} × ${pow10(e)}`; };
/** share of the resistant bacteria after n courses of an antibiotic that kills the share `kill` of the susceptible ones; the survivors then grow back to the same total */
export function resistFrac(r0: number, kill: number, n: number): number {
  let R = r0, S = 1 - r0;
  for (let i = 0; i < n; i++) { S *= 1 - kill; const T = R + S; R /= T; S /= T; }
  return R;
}
/** what is left of the bacteria right after one course (a share of the total before it) */
export const residual = (r: number, kill: number) => r + (1 - r) * (1 - kill);
export const BACT: { name: string; fn: string }[] = [
  { name: "细胞壁", fn: "保护和支持细胞" }, { name: "细胞膜", fn: "控制物质进出细胞" }, { name: "细胞质", fn: "含有核糖体等，是生命活动的场所" },
  { name: "DNA 集中的区域", fn: "没有成形的细胞核，只有 DNA 集中的区域" }, { name: "荚膜", fn: "保护细菌，有的细菌才有" }, { name: "鞭毛", fn: "使细菌能够运动，有的细菌才有" },
];
export const YEAST: { name: string; fn: string }[] = [
  { name: "细胞壁", fn: "保护和支持细胞" }, { name: "细胞膜", fn: "控制物质进出细胞" }, { name: "细胞核", fn: "有成形的细胞核，含遗传物质" },
  { name: "细胞质", fn: "含有线粒体等，是生命活动的场所" }, { name: "液泡", fn: "储存水分和营养物质" }, { name: "芽体", fn: "酵母菌出芽生殖形成的新个体" },
];
export function quiz(rng: () => number): Q[] {
  const n = pick(rng, [42, 65, 88, 120, 150, 210, 260]), dil = pick(rng, [5, 6, 7]), vol = pick(rng, [0.1, 0.5, 1]);
  const r0 = pick(rng, [1, 2, 5, 10]), kill = pick(rng, [60, 80, 90, 99]), k = pick(rng, [1, 2, 3, 4]);
  const kk = pick(rng, [2, 3, 4, 5, 6]);
  const est = estimate(n, dil, vol) / 1e6;
  return [
    numQ(rng, "estimate", [n, dil, vol], `把菌液稀释 10${sup(dil)} 倍，取 ${vol} mL 涂布，平板上长出 ${n} 个菌落，原菌液每毫升约含多少个细菌？`, est, "×10⁶ /mL", 1, "菌落数 ÷ 涂布体积 × 稀释倍数 = 每毫升原菌液的细菌数。"),
    makeQ(rng, "fold", [kk], `把 1 mL 菌液加入 9 mL 无菌水（稀释 10 倍），这样连续稀释 ${kk} 次，总稀释倍数是：`, pow10(kk), [pow10(kk - 1), pow10(kk + 1), pow10(2 * kk), `${kk * 10}`], "每稀释一次，浓度变为原来的十分之一。"),
    makeQ(rng, "range", [], "计数菌落时，通常选择菌落数在哪个范围内的平板？", "30–300 个", ["1–10 个", "3–30 个", "300–3000 个"], "菌落太多会连成一片，太少则误差大。"),
    numQ(rng, "resist", [r0, kill, k], `开始时耐药菌占 ${r0} ‰，每次用药杀死 ${kill} % 的敏感菌，存活的细菌再繁殖回到原来的总数。连续用药 ${k} 次后，耐药菌约占多少？`, resistFrac(r0 / 1000, kill / 100, k) * 100, "%", 1, "用药把敏感菌清除，耐药菌因此在群体中的比例越来越大。"),
    makeQ(rng, "struct", [], "细菌与酵母菌在结构上最主要的区别是：", "细菌没有成形的细胞核", ["细菌没有细胞壁", "细菌没有细胞膜", "细菌没有细胞质", "细菌没有遗传物质"], "细菌属于原核生物，酵母菌属于真菌，有成形的细胞核。"),
  ];
}
