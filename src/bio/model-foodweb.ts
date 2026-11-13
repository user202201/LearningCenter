/** 食物链与食物网 (pure): the web of a grassland, chains, the energy pyramid and accumulation of a poison. */
import { makeQ, numQ, pick, type Q } from "../phys/qtools";
export const SPECIES = ["草", "蝗虫", "兔", "鼠", "蛙", "蛇", "狐", "鹰"];
/** [food, eater] */
export const LINKS: [number, number][] = [[0, 1], [0, 2], [0, 3], [1, 4], [4, 5], [3, 5], [5, 7], [3, 7], [2, 7], [2, 6], [3, 6]];
export const isProducer = (i: number) => i === 0;
/** every chain from a producer to a species nobody eats, built from the given links (indexes into LINKS) */
export function chains(have: number[] = LINKS.map((_, i) => i)): number[][] {
  const L = have.map((k) => LINKS[k]), out: number[][] = [];
  const eaten = (i: number) => L.some(([a]) => a === i);
  const go = (path: number[]) => { const last = path[path.length - 1]; const nx = L.filter(([a]) => a === last).map(([, b]) => b); if (!nx.length) { if (path.length > 1) out.push(path); return; } for (const b of nx) go([...path, b]); };
  for (let i = 0; i < SPECIES.length; i++) if (isProducer(i) && eaten(i)) go([i]);
  return out;
}
/** trophic level = the length of the longest chain from the producer to it */
export function level(i: number): number { let m = 1; for (const ch of chains()) { const k = ch.indexOf(i); if (k >= 0) m = Math.max(m, k + 1); } return m; }
/** after removing species: eaters that lose all their food starve; food whose eaters have all gone increases */
export function removal(removed: number[]): { down: number[]; up: number[] } {
  const rm = new Set(removed), down: number[] = [], up: number[] = [];
  for (let i = 0; i < SPECIES.length; i++) {
    if (rm.has(i)) continue;
    const food = LINKS.filter(([, b]) => b === i).map(([a]) => a), eaters = LINKS.filter(([a]) => a === i).map(([, b]) => b);
    if (food.length && food.every((a) => rm.has(a))) down.push(i);
    else if (eaters.length && eaters.every((b) => rm.has(b))) up.push(i);
  }
  return { down, up };
}
export const energyAt = (E0: number, eta: number, n: number) => E0 * (eta / 100) ** (n - 1);
export const concAt = (c0: number, f: number, n: number) => c0 * f ** (n - 1);
export const ROLES: [string, string][] = [["青草", "生产者"], ["蝗虫", "初级消费者"], ["吃蝗虫的蛙", "次级消费者"], ["吃蛙的蛇", "三级消费者"], ["腐生细菌", "分解者"], ["阳光和空气", "非生物部分"]];
export function quiz(rng: () => number): Q[] {
  const E0 = pick(rng, [1000, 5000, 10000, 20000, 100000]), n = pick(rng, [2, 3, 4, 5]);
  const E1 = pick(rng, [500, 1000, 2000, 5000]);
  const c0 = pick(rng, [0.01, 0.02, 0.05]), f = pick(rng, [3, 5, 10]), n2 = pick(rng, [3, 4, 5]);
  const r = pick(rng, ROLES);
  return [
    numQ(rng, "energy", [E0, n], `生产者固定的能量为 ${E0} kJ，能量传递效率为 10%。第 ${n} 营养级最多获得多少 kJ？`, energyAt(E0, 10, n), "kJ", 1, "每升高一个营养级，能量约减少为原来的 10%。"),
    numQ(rng, "maxget", [E1], `一个营养级同化了 ${E1} kJ 的能量，按能量传递效率最高 20% 计算，下一营养级最多获得多少 kJ？`, E1 * 0.2, "kJ", 0, "能量传递效率约为 10%–20%。"),
    numQ(rng, "chains", [], "图中的草原食物网（草、蝗虫、兔、鼠、蛙、蛇、狐、鹰 共 11 条捕食关系）一共有几条食物链？", chains().length, "条", 0, "食物链从生产者开始，到不被其他生物捕食的消费者结束。"),
    numQ(rng, "conc", [c0, f, n2], `某种有毒物质在生产者体内的浓度为 ${c0} ppm，沿食物链每升高一个营养级浓度增大为原来的 ${f} 倍。第 ${n2} 营养级的生物体内浓度是多少 ppm？`, concAt(c0, f, n2), "ppm", 2, "有毒物质难以分解，沿食物链逐级积累。"),
    makeQ(rng, "role", [ROLES.indexOf(r)], `在生态系统中，“${r[0]}”属于：`, r[1], ROLES.map((x) => x[1]).filter((x) => x !== r[1]), "生态系统由非生物部分和生物部分（生产者、消费者、分解者）组成。"),
  ];
}
