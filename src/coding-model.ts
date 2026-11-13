/**
 * 编程: what is remembered. Per child `coding/<kid>.json` (in the data repository, through api.update): the best stars of every level, the fewest blocks
 * used, the number of random challenges solved. Two devices are merged by the larger star count (sync.ts `mergeDocs`, rule here too: `mergeCoding`).
 * On this device only (`learn.coding.v1`): the mini-lessons already seen, the speed, the pseudo-code switch and the saved free drawings.
 */
import { LEVELS, levelsOf, WORLDS } from "./coding-levels";
import type { Program } from "./coding-ast";

export interface CodingDoc { stars: Record<string, number>; blocks: Record<string, number>; challenges: number }
export const EMPTY_CODING: CodingDoc = { stars: {}, blocks: {}, challenges: 0 };
export const codingPath = (kidId: string): string => `coding/${kidId}.json`;

/** a result: keeps the larger star count and the smaller block count */
export function applyResult(doc: CodingDoc, levelId: string, stars: number, blocks: number): CodingDoc {
  const prev = doc.stars?.[levelId] ?? 0;
  const pb = doc.blocks?.[levelId];
  const best = stars > prev || pb === undefined ? blocks : stars === prev ? Math.min(pb, blocks) : pb;
  return { ...doc, stars: { ...(doc.stars ?? {}), [levelId]: Math.max(prev, stars) }, blocks: { ...(doc.blocks ?? {}), [levelId]: best }, challenges: doc.challenges ?? 0 };
}
export const addChallenge = (doc: CodingDoc): CodingDoc => ({ ...doc, stars: doc.stars ?? {}, blocks: doc.blocks ?? {}, challenges: (doc.challenges ?? 0) + 1 });
/** two copies of a progress file: nothing earned on either side is lost */
export function mergeCoding(a: CodingDoc, b: CodingDoc): CodingDoc {
  const stars: Record<string, number> = { ...(b.stars ?? {}) }, blocks: Record<string, number> = { ...(b.blocks ?? {}) };
  for (const [k, v] of Object.entries(a.stars ?? {})) stars[k] = Math.max(stars[k] ?? 0, v);
  for (const [k, v] of Object.entries(a.blocks ?? {})) blocks[k] = blocks[k] === undefined ? v : Math.min(blocks[k], v);
  return { ...b, ...a, stars, blocks, challenges: Math.max(a.challenges ?? 0, b.challenges ?? 0) };
}

export interface WorldStat { world: number; stars: number; max: number; solved: number; total: number; done: boolean }
export function worldStat(doc: CodingDoc, world: number): WorldStat {
  const ls = levelsOf(world);
  const stars = ls.reduce((n, l) => n + (doc.stars?.[l.id] ?? 0), 0);
  const solved = ls.filter((l) => (doc.stars?.[l.id] ?? 0) > 0).length;
  return { world, stars, max: ls.length * 3, solved, total: ls.length, done: solved === ls.length };
}
export const totalStars = (doc: CodingDoc): number => LEVELS.reduce((n, l) => n + (doc.stars?.[l.id] ?? 0), 0);
/** the world to glow: the first one that is not finished; with no progress at all the child's grade decides (grades 1-4 world 1, 5-6 world 2, 7-9 world 3) */
export function recommendedWorld(doc: CodingDoc, grade: number | null): number {
  const any = totalStars(doc) > 0;
  if (!any && grade !== null) return grade <= 4 ? 1 : grade <= 6 ? 2 : 3;
  for (const w of WORLDS) if (!worldStat(doc, w.id).done) return w.id;
  return 0;
}
/** the next level after `id` in the same world (null at the end) */
export function nextLevelId(id: string): string | null {
  const i = LEVELS.findIndex((l) => l.id === id);
  return i >= 0 && LEVELS[i + 1] && LEVELS[i + 1].world === LEVELS[i].world ? LEVELS[i + 1].id : null;
}

// ---------- this device ----------
export interface Drawing { id: string; date: string; prog: Program }
export interface Local { seen: string[]; speed: "slow" | "normal" | "fast"; /** the pseudo-code panel: null = not chosen yet (shown from world 3 on wide screens) */ code: boolean | null; drawings: Record<string, Drawing[]> }
const KEY = "learn.coding.v1";
export const MAX_DRAWINGS = 12;
export function loadLocal(): Local {
  try {
    const j = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return { seen: Array.isArray(j.seen) ? j.seen : [], speed: j.speed === "slow" || j.speed === "fast" ? j.speed : "normal", code: typeof j.code === "boolean" ? j.code : null, drawings: j.drawings && typeof j.drawings === "object" ? j.drawings : {} };
  } catch { return { seen: [], speed: "normal", code: null, drawings: {} }; }
}
export function saveLocal(l: Local): void { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private window: forgotten on reload */ } }
export function patchLocal(f: (l: Local) => void): Local { const l = loadLocal(); f(l); saveLocal(l); return l; }
