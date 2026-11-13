/**
 * 汉字笔画 — the rules, pure (no DOM). A character is a list of strokes (Make Me a Hanzi outlines, 1024 box, y up, in writing order).
 * Mode "order": the child must put the strokes on the board in WRITING ORDER (a wrong one counts a mistake).
 * Mode "assemble": the strokes are scattered; the child drops each one on its place (any order, snapping within a tolerance).
 */
import CHARS_JSON from "./hanzipuzzle-chars.json";

export type Level = "easy" | "normal" | "hard";
export type Mode = "order" | "assemble";
export const LEVELS: Level[] = ["easy", "normal", "hard"];
export const MODES: Mode[] = ["order", "assemble"];
/** the number of strokes of the characters of a level: easy up to 6, normal 7-10, hard 11-14 */
export const RANGE: Record<Level, [number, number]> = { easy: [2, 6], normal: [7, 10], hard: [11, 14] };
export const ROUND = 5;
export const CHARS: Record<Level, string[]> = { easy: [...CHARS_JSON.easy], normal: [...CHARS_JSON.normal], hard: [...CHARS_JSON.hard] };
export const ALL_CHARS = [...CHARS.easy, ...CHARS.normal, ...CHARS.hard];
/** the colour of the n-th stroke (every stroke of a character has its own) */
export const COLORS = ["#fa5252", "#ff922b", "#fab005", "#82c91e", "#20c997", "#22b8cf", "#339af0", "#5c7cfa", "#7950f2", "#e64980", "#8d5524", "#2f9e44", "#d6336c", "#1971c2"];
export const SIZE = 1024;

export const levelOf = (strokes: number): Level | null => LEVELS.find((l) => strokes >= RANGE[l][0] && strokes <= RANGE[l][1]) ?? null;
export const inLevel = (level: Level, strokes: number) => strokes >= RANGE[level][0] && strokes <= RANGE[level][1];

type Rng = () => number;
export function shuffle<T>(a: T[], rng: Rng = Math.random): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
/** `count` different characters of the level */
export function pickRound(level: Level, rng: Rng = Math.random, count = ROUND, exclude: string[] = []): string[] {
  const pool = CHARS[level].filter((c) => !exclude.includes(c));
  const from = pool.length >= count ? pool : CHARS[level];
  return shuffle(from, rng).slice(0, count);
}
/** the order of the tiles in the tray: a permutation of 0..n-1 that is never the writing order (when n > 1) */
export function scramble(n: number, rng: Rng = Math.random): number[] {
  const id = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return id;
  let p = shuffle(id, rng);
  let guard = 0;
  while (p.every((v, i) => v === i) && guard++ < 20) p = shuffle(id, rng);
  if (p.every((v, i) => v === i)) p = id.slice(1).concat(id[0]);
  return p;
}

/* ---------- geometry (screen coordinates of the 1024 box: y down, the glyph is drawn with translate(0 900) scale(1 -1)) ---------- */
export interface Box { x0: number; y0: number; x1: number; y1: number }
/** the box of a stroke outline (all points of the path, absolute M / L / Q / C / Z), in screen coordinates */
export function pathBox(d: string): Box {
  const nums = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i], y = 900 - nums[i + 1];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x0 === Infinity ? { x0: 0, y0: 0, x1: 0, y1: 0 } : { x0, y0, x1, y1 };
}
export const centerOf = (b: Box) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 });
/** how close (in 1024 units) the centre of a dropped stroke must be to its place: bigger strokes may be a little further away */
export const tolerance = (b: Box) => Math.max(95, Math.min(170, 0.2 * Math.max(b.x1 - b.x0, b.y1 - b.y0)));
export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
export const snaps = (target: Box, drop: { x: number; y: number }) => dist(centerOf(target), drop) <= tolerance(target);
/** two strokes that look the same (a child may put either on either place) */
export const similar = (a: Box, b: Box) => Math.abs((a.x1 - a.x0) - (b.x1 - b.x0)) <= 40 && Math.abs((a.y1 - a.y0) - (b.y1 - b.y0)) <= 40;

/* ---------- mode 1: writing order ---------- */
export interface OrderState { n: number; next: number; placed: boolean[]; mistakes: number }
export const newOrder = (n: number): OrderState => ({ n, next: 0, placed: Array(n).fill(false), mistakes: 0 });
/** the child puts stroke `i` on the board: right only when it is the next one in writing order */
export function tryOrder(s: OrderState, i: number): "ok" | "wrong" | "ignored" {
  if (s.next >= s.n || i < 0 || i >= s.n || s.placed[i]) return "ignored";
  if (i === s.next) { s.placed[i] = true; s.next++; return "ok"; }
  s.mistakes++;
  return "wrong";
}

/* ---------- mode 2: assemble ---------- */
export interface AssembleState { n: number; homeOf: number[]; used: boolean[]; filled: boolean[]; mistakes: number }
export const newAssemble = (n: number): AssembleState => ({ n, homeOf: Array.from({ length: n }, (_, i) => i), used: Array(n).fill(false), filled: Array(n).fill(false), mistakes: 0 });
/**
 * Tile `i` is dropped at `drop` (1024 coordinates, the centre of the stroke) or outside the board (`null`: nothing happens, no mistake).
 * Right when it is within the tolerance of its own place, or of the place of an unplaced stroke that looks the same (the two then swap places).
 * `boxes[k]` = the box of stroke k's place.
 */
export function tryAssemble(s: AssembleState, i: number, drop: { x: number; y: number } | null, boxes: Box[]): { r: "ok" | "wrong" | "ignored"; home?: number } {
  if (i < 0 || i >= s.n || s.used[i] || drop === null) return { r: "ignored" };
  const own = s.homeOf[i];
  let home = snaps(boxes[own], drop) ? own : -1;
  if (home < 0) for (let k = 0; k < s.n; k++) if (!s.filled[k] && k !== own && similar(boxes[k], boxes[own]) && snaps(boxes[k], drop)) { home = k; break; }
  if (home < 0) { s.mistakes++; return { r: "wrong" }; }
  if (home !== own) { const j = s.homeOf.findIndex((h, t) => h === home && t !== i && !s.used[t]); if (j >= 0) s.homeOf[j] = own; s.homeOf[i] = home; }
  s.used[i] = true; s.filled[home] = true;
  return { r: "ok", home };
}
export const isDone = (s: OrderState | AssembleState) => ("next" in s ? s.next >= s.n : s.filled.every(Boolean));

/* ---------- the round ---------- */
export const stars = (mistakes: number[]) => mistakes.filter((m) => m === 0).length;
export const isBest = (score: number, old: number) => score > old;
