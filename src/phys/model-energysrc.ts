/** 能源与可持续发展 (pure): kinds of energy sources, conversion chains of power plants with their efficiencies, an electricity mix and its carbon emission. */
import { makeQ, numQ, pick, type Q } from "./qtools";
export interface Source { name: string; renew: boolean | null; primary: boolean; from: string }
export const SOURCES: Source[] = [
  { name: "煤炭", renew: false, primary: true, from: "古代植物的遗体经过漫长年代形成（化石能源）" },
  { name: "石油", renew: false, primary: true, from: "古代生物的遗体经过漫长年代形成（化石能源）" },
  { name: "天然气", renew: false, primary: true, from: "古代生物的遗体经过漫长年代形成（化石能源）" },
  { name: "核能", renew: false, primary: true, from: "铀等重原子核的裂变（或轻核的聚变）" },
  { name: "太阳能", renew: true, primary: true, from: "太阳内部的核聚变" },
  { name: "风能", renew: true, primary: true, from: "太阳照射使空气受热不均而流动" },
  { name: "水能", renew: true, primary: true, from: "太阳照射使水循环，水从高处流向低处" },
  { name: "生物质能", renew: true, primary: true, from: "植物通过光合作用储存的太阳能" },
  { name: "地热能", renew: true, primary: true, from: "地球内部的热" },
  { name: "电能", renew: null, primary: false, from: "由一次能源转化而来（二次能源）" },
  { name: "氢能", renew: null, primary: false, from: "由其他能源制取（二次能源），燃烧只生成水" },
];
export interface Plant { name: string; chain: string; steps: [string, number][] }
export const PLANTS: Plant[] = [
  { name: "火力发电", chain: "化学能 → 内能 → 机械能 → 电能", steps: [["锅炉", 0.9], ["汽轮机", 0.45], ["发电机", 0.98]] },
  { name: "水力发电", chain: "水的机械能 → 机械能 → 电能", steps: [["水轮机", 0.9], ["发电机", 0.98]] },
  { name: "风力发电", chain: "风的动能 → 机械能 → 电能", steps: [["风力机叶片", 0.45], ["发电机", 0.95]] },
  { name: "核能发电", chain: "核能 → 内能 → 机械能 → 电能", steps: [["反应堆", 0.99], ["汽轮机", 0.35], ["发电机", 0.98]] },
  { name: "太阳能光伏发电", chain: "光能 → 直流电能 → 交流电能", steps: [["太阳能电池板", 0.2], ["逆变器", 0.97]] },
  { name: "地热发电", chain: "内能 → 机械能 → 电能", steps: [["汽轮机", 0.15], ["发电机", 0.98]] },
];
/** the weakest step is improved by `boost` percentage points; returns the efficiency of every step */
export function steps(plant: number, boost: number): number[] {
  const e = PLANTS[plant].steps.map((s) => s[1]), w = e.indexOf(Math.min(...e));
  e[w] = Math.min(1, e[w] + boost / 100); return e;
}
export const total = (plant: number, boost: number) => steps(plant, boost).reduce((a, b) => a * b, 1);
export const weakest = (plant: number) => { const e = PLANTS[plant].steps.map((s) => s[1]); return PLANTS[plant].steps[e.indexOf(Math.min(...e))][0]; };
export const MJ_PER_KWH = 3.6;
/** the electricity mix: shares in percent of coal, hydro, nuclear (the rest is wind + solar; if they add up to more than 100 they are scaled down) */
export const CO2 = { coal: 0.9, hydro: 0.02, nuclear: 0.015, wind: 0.03 };   // kg CO2 per kWh over the whole life cycle (rounded)
export function mix(coal: number, hydro: number, nuclear: number) {
  const sum = coal + hydro + nuclear, k = sum > 100 ? 100 / sum : 1;
  const c = coal * k, h = hydro * k, n = nuclear * k, w = Math.max(0, 100 - c - h - n);
  return { coal: c, hydro: h, nuclear: n, wind: w, renew: h + w, co2: (c * CO2.coal + h * CO2.hydro + n * CO2.nuclear + w * CO2.wind) / 100 };
}
export function quiz(rng: () => number): Q[] {
  const ri = Math.floor(rng() * 9), pi = Math.floor(rng() * 9);
  const [a, b] = pick(rng, [[40, 90], [45, 98], [35, 95], [20, 97], [90, 98]]);
  const MJ = pick(rng, [36, 72, 18, 7.2, 108]), N = pick(rng, [10, 100, 250, 1000]);
  return [
    makeQ(rng, "renew", [ri], `${SOURCES[ri].name}是：`, SOURCES[ri].renew ? "可再生能源" : "不可再生能源", ["可再生能源", "不可再生能源", "既是可再生能源，又是不可再生能源", "不是能源"].filter((x) => x !== (SOURCES[ri].renew ? "可再生能源" : "不可再生能源")), "可以从自然界源源不断地得到的是可再生能源，如太阳能、风能、水能；化石能源和核燃料用了就少，是不可再生能源。"),
    makeQ(rng, "primary", [pi], `${SOURCES[pi].name}是：`, SOURCES[pi].primary ? "一次能源" : "二次能源", ["一次能源", "二次能源", "既是一次能源，又是二次能源", "不是能源"].filter((x) => x !== (SOURCES[pi].primary ? "一次能源" : "二次能源")), "可以直接从自然界获得的是一次能源；由一次能源加工转化得到的（如电能、氢能）是二次能源。"),
    numQ(rng, "chain", [a, b], `某装置分两步转化能量，第一步的效率是 ${a}%，第二步的效率是 ${b}%，整个装置的效率是多少？`, (a * b) / 100, "%", 1, "总效率等于各步效率的乘积。"),
    numQ(rng, "kwh", [MJ], `${MJ} MJ 的电能合多少千瓦时（度）？（1 kW·h = 3.6 MJ）`, MJ / MJ_PER_KWH, "kW·h", 1, "1 kW·h = 1000 W × 3600 s = 3.6×10⁶ J。"),
    numQ(rng, "co2", [N], `用煤发电，每发 1 kW·h 的电约排放 ${CO2.coal} kg 二氧化碳，发 ${N} kW·h 的电约排放多少千克？`, N * CO2.coal, "kg", 1, "排放量 = 每度电的排放量 × 电量。"),
  ];
}
