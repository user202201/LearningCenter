/** Water sort: the rules as pure functions (no DOM). A tube is a list of colour numbers, bottom first, at most CAP units. */
export const CAP = 4;
export const LEVELS = 30;
export const MAX_COLORS = 10;
export type Tubes = number[][];
export type Move = [number, number];

export const cloneTubes = (t: Tubes): Tubes => t.map((x) => x.slice());
/** how many colours level n (1..30) has: 3 growing to 10 */
export const colorsOf = (level: number): number => 3 + Math.round(((Math.max(1, Math.min(LEVELS, level)) - 1) * (MAX_COLORS - 3)) / (LEVELS - 1));

/** the colour on top of a tube, -1 when empty */
export const topColor = (t: number[]): number => (t.length ? t[t.length - 1] : -1);
/** how many units of the top colour lie on top of each other */
export function topRun(t: number[]): number {
  if (!t.length) return 0;
  const c = t[t.length - 1]; let n = 0;
  for (let i = t.length - 1; i >= 0 && t[i] === c; i--) n++;
  return n;
}
/** how many units a pour from a to b would move (0 = not allowed) */
export function pourAmount(tubes: Tubes, a: number, b: number): number {
  if (a === b || a < 0 || b < 0 || a >= tubes.length || b >= tubes.length) return 0;
  const A = tubes[a], B = tubes[b];
  if (!A.length || B.length >= CAP) return 0;
  if (B.length && topColor(B) !== topColor(A)) return 0;
  return Math.min(topRun(A), CAP - B.length);
}
/** pours a into b (changes `tubes`); returns the number of units moved, 0 when not allowed (nothing changes) */
export function pour(tubes: Tubes, a: number, b: number): number {
  const k = pourAmount(tubes, a, b);
  if (!k) return 0;
  const c = topColor(tubes[a]);
  for (let i = 0; i < k; i++) { tubes[a].pop(); tubes[b].push(c); }
  return k;
}
const isFullUniform = (t: number[]) => t.length === CAP && t.every((x) => x === t[0]);
/** won = every tube is empty or full of ONE colour */
export const isWon = (tubes: Tubes): boolean => tubes.every((t) => t.length === 0 || isFullUniform(t));
/** all pours that are allowed */
export function legalMoves(tubes: Tubes): Move[] {
  const r: Move[] = [];
  for (let a = 0; a < tubes.length; a++) for (let b = 0; b < tubes.length; b++) if (pourAmount(tubes, a, b)) r.push([a, b]);
  return r;
}
/** sanity of a position: every colour has exactly CAP units in total and no tube is over full */
export function validTubes(tubes: Tubes, colors?: number): boolean {
  const count = new Map<number, number>();
  for (const t of tubes) { if (t.length > CAP) return false; for (const c of t) count.set(c, (count.get(c) || 0) + 1); }
  if (colors !== undefined && count.size !== colors) return false;
  for (const n of count.values()) if (n !== CAP) return false;
  return true;
}

/** a solution (list of pours) or null when none was found within `limit` positions. Depth-first with a set of visited positions (tube order does not matter). */
export function solve(start: Tubes, limit = 120000): Move[] | null {
  const seen = new Set<string>();
  const key = (t: Tubes) => t.map((x) => x.join("")).sort().join("|");
  let nodes = 0;
  const path: Move[] = [];
  const t = cloneTubes(start);
  const dfs = (): boolean => {
    if (isWon(t)) return true;
    const k = key(t);
    if (seen.has(k)) return false;
    seen.add(k);
    if (++nodes > limit) return false;
    const cand: { m: Move; score: number }[] = [];
    for (let a = 0; a < t.length; a++) {
      const A = t[a];
      if (!A.length || isFullUniform(A)) continue;
      const uniform = A.every((x) => x === A[0]);
      for (let b = 0; b < t.length; b++) {
        const n = pourAmount(t, a, b);
        if (!n) continue;
        const B = t[b];
        if (!B.length && uniform) continue; // moving a whole single colour into an empty tube changes nothing
        // prefer: finishing a tube, pouring onto the same colour, freeing a tube; empty targets last
        let score = B.length ? 10 + n : 0;
        if (B.length && B.length + n === CAP) score += 20;
        if (A.length === n) score += 6;
        cand.push({ m: [a, b], score });
      }
    }
    cand.sort((x, y) => y.score - x.score);
    for (const { m } of cand) {
      const [a, b] = m, before = [t[a].slice(), t[b].slice()];
      pour(t, a, b); path.push(m);
      if (dfs()) return true;
      path.pop(); t[a] = before[0]; t[b] = before[1];
      if (nodes > limit) return false;
    }
    return false;
  };
  return dfs() ? path.slice() : null;
}

/** a small seeded random generator (the same seed gives the same numbers on every device) */
export function rngOf(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const cache = new Map<number, Tubes>();
/** the start position of level n (1..30): the same every time. A seeded shuffle that is checked with the solver (reshuffled with the next numbers of the same generator until it can be solved). */
export function levelTubes(level: number): Tubes {
  const lv = Math.max(1, Math.min(LEVELS, Math.floor(level) || 1));
  const hit = cache.get(lv);
  if (hit) return cloneTubes(hit);
  const n = colorsOf(lv), rng = rngOf(lv * 7919 + 13);
  let result: Tubes | null = null;
  for (let attempt = 0; attempt < 60 && !result; attempt++) {
    const units: number[] = [];
    for (let c = 0; c < n; c++) for (let i = 0; i < CAP; i++) units.push(c);
    for (let i = units.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [units[i], units[j]] = [units[j], units[i]]; }
    const tubes: Tubes = [];
    for (let i = 0; i < n; i++) tubes.push(units.slice(i * CAP, (i + 1) * CAP));
    tubes.push([], []);
    if (tubes.some(isFullUniform)) continue;
    if (solve(tubes, 40000)) result = tubes;
  }
  if (!result) { // never happens in practice: a safe fallback that is trivially solvable (one pour away from sorted tubes)
    result = [];
    for (let c = 0; c < n; c++) result.push([c, c, c, c]);
    result[0] = [0, 0, 0, 1]; result[1] = [1, 1, 1, 0]; result.push([], []);
  }
  cache.set(lv, cloneTubes(result));
  return result;
}
