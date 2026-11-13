/** Whack-a-mole: the rules as pure functions (no DOM, no clock of its own: the caller moves the game clock with `step`). */
export type Kind = "mole" | "helmet" | "golden" | "bomb" | "bunny";
export interface LevelDef { cols: number; rows: number; cap: number; slow: number; fast: number }
/** 3x3 easy (1-2 at once), 3x4 normal (up to 3), 4x4 hard (up to 4); slow / fast scale the appear time / the spawn gap */
export const LEVELS: LevelDef[] = [
  { cols: 3, rows: 3, cap: 2, slow: 1.25, fast: 1.3 },
  { cols: 3, rows: 4, cap: 3, slow: 1, fast: 1 },
  { cols: 4, rows: 4, cap: 4, slow: 0.9, fast: 0.85 },
];
export const DURATION = 45000;
export const BOMB_PENALTY = 5000;
export const POINTS: Record<"mole" | "helmet" | "golden", number> = { mole: 10, helmet: 25, golden: 50 };
export const BOMB_SCORE = -20;
export const BUNNY_SCORE = -10;
export const STAR_AT: number[][] = [[120, 240], [150, 300], [180, 360]];
export const GOOD: Kind[] = ["mole", "helmet", "golden"];
export const isGood = (k: Kind) => k === "mole" || k === "helmet" || k === "golden";

export interface Critter { kind: Kind; born: number; life: number; hp: number }
export interface State {
  level: number; cols: number; rows: number; cap: number;
  /** the game clock in ms (only `step` moves it) */
  t: number;
  /** ms taken off the round by bombs */
  penalty: number;
  holes: (Critter | null)[];
  score: number; combo: number; bestCombo: number;
  /** taps of every kind while playing, and the ones that were right (a mole, a dent in a helmet) */
  taps: number; hits: number; kills: number; misses: number; bombHits: number; bunnyHits: number;
  spawned: number; left: number;
  nextSpawn: number; rs: number; over: boolean;
  /** false = the scheduler does not spawn (tests place characters by hand) */
  auto: boolean;
}
export type TapEv =
  | { t: "none" }
  | { t: "miss"; hole: number }
  | { t: "dent"; hole: number; kind: Kind }
  | { t: "kill"; hole: number; kind: Kind; pts: number; mult: number }
  | { t: "bomb"; hole: number; pts: number }
  | { t: "bunny"; hole: number; pts: number };

export function rnd(s: { rs: number }): number {
  s.rs = (s.rs + 0x6d2b79f5) >>> 0;
  let t = s.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function newGame(level: number, seed = 1): State {
  const L = LEVELS[Math.max(0, Math.min(2, level))];
  return { level, cols: L.cols, rows: L.rows, cap: L.cap, t: 0, penalty: 0, holes: new Array(L.cols * L.rows).fill(null), score: 0, combo: 0, bestCombo: 0, taps: 0, hits: 0, kills: 0, misses: 0, bombHits: 0, bunnyHits: 0, spawned: 0, left: 0, nextSpawn: 400, rs: seed >>> 0, over: false, auto: true };
}
export const mult = (combo: number) => (combo >= 10 ? 3 : combo >= 5 ? 2 : 1);
/** the progress of the round, 0 .. 1 (by the game clock) */
export const progress = (t: number) => Math.max(0, Math.min(1, t / DURATION));
/** how long a normal character stays: about 1.2 s at the start, 0.6 s at the end (scaled by the level) */
export const appearTime = (p: number, level: number) => Math.round((1200 - 600 * Math.max(0, Math.min(1, p))) * LEVELS[level].slow);
/** gap between two spawn attempts: 1 s -> 0.5 s */
export const spawnGap = (p: number, level: number) => Math.round((1000 - 500 * Math.max(0, Math.min(1, p))) * LEVELS[level].fast);
export const lifeOf = (kind: Kind, p: number, level: number) => {
  const a = appearTime(p, level);
  return kind === "golden" ? Math.round(a * 0.6) : kind === "helmet" ? Math.round(a * 1.3) : a;
};
export const remaining = (s: State) => Math.max(0, DURATION - s.t - s.penalty);

export function pickKind(s: State): Kind {
  const p = progress(s.t);
  const w: [Kind, number][] = [["mole", 60], ["helmet", p >= 0.1 ? 12 + 10 * p : 0], ["golden", 4], ["bomb", 10 + 10 * p], ["bunny", 8]];
  let sum = 0; for (const [, x] of w) sum += x;
  let r = rnd(s) * sum;
  for (const [k, x] of w) { if (r < x) return k; r -= x; }
  return "mole";
}
export function critterCount(s: State) { let n = 0; for (const c of s.holes) if (c) n++; return n; }
/** put a character in a hole by hand (tests / scripted starts); false when the hole is taken */
export function spawnAt(s: State, hole: number, kind: Kind, life?: number): boolean {
  if (s.over || hole < 0 || hole >= s.holes.length || s.holes[hole]) return false;
  s.holes[hole] = { kind, born: s.t, life: life ?? lifeOf(kind, progress(s.t), s.level), hp: kind === "helmet" ? 2 : 1 };
  s.spawned++;
  return true;
}
function trySpawn(s: State) {
  if (critterCount(s) >= s.cap) return;
  const free: number[] = [];
  for (let i = 0; i < s.holes.length; i++) if (!s.holes[i]) free.push(i);
  if (!free.length) return;
  const hole = free[Math.floor(rnd(s) * free.length)];
  spawnAt(s, hole, pickKind(s));
}
const CHUNK = 20;
/** move the game clock by `ms`: characters whose time is up leave, the scheduler spawns, the round ends when the time is gone */
export function step(s: State, ms: number): void {
  let left = ms;
  while (left > 0 && !s.over) {
    const c = Math.min(CHUNK, left); left -= c; s.t += c;
    for (let i = 0; i < s.holes.length; i++) { const k = s.holes[i]; if (k && s.t >= k.born + k.life) { s.holes[i] = null; if (isGood(k.kind)) s.left++; } }
    if (s.auto) while (s.nextSpawn <= s.t) {
      const p = progress(s.nextSpawn);
      trySpawn(s);
      // normal and hard sometimes bring a second (and on hard a third) character at once: the limit of the level is really used
      const q = s.level === 0 ? 0 : (s.level === 1 ? 0.25 : 0.4) + 0.3 * p;
      if (q > 0 && rnd(s) < q) { trySpawn(s); if (s.level === 2 && rnd(s) < q) trySpawn(s); }
      s.nextSpawn += spawnGap(p, s.level);
    }
    if (s.t + s.penalty >= DURATION) { s.over = true; s.holes.fill(null); }
  }
}
/** a tap on a hole (a finger, a key) */
export function tap(s: State, hole: number): TapEv {
  if (s.over || hole < 0 || hole >= s.holes.length) return { t: "none" };
  s.taps++;
  const c = s.holes[hole];
  if (!c) { s.misses++; s.combo = 0; return { t: "miss", hole }; }
  if (c.kind === "bomb") {
    s.holes[hole] = null; s.bombHits++; s.combo = 0; s.penalty += BOMB_PENALTY;
    s.score = Math.max(0, s.score + BOMB_SCORE);
    if (s.t + s.penalty >= DURATION) { s.over = true; s.holes.fill(null); }
    return { t: "bomb", hole, pts: BOMB_SCORE };
  }
  if (c.kind === "bunny") { s.holes[hole] = null; s.bunnyHits++; s.combo = 0; s.score = Math.max(0, s.score + BUNNY_SCORE); return { t: "bunny", hole, pts: BUNNY_SCORE }; }
  s.hits++;
  if (c.hp > 1) { c.hp--; return { t: "dent", hole, kind: c.kind }; }
  s.holes[hole] = null; s.kills++; s.combo++; if (s.combo > s.bestCombo) s.bestCombo = s.combo;
  const m = mult(s.combo), pts = POINTS[c.kind as "mole" | "helmet" | "golden"] * m;
  s.score += pts;
  return { t: "kill", hole, kind: c.kind, pts, mult: m };
}
export const accuracy = (s: State) => (s.taps ? Math.round((s.hits / s.taps) * 100) : 0);
/** 1 star for finishing, 2 and 3 for the score thresholds of the level */
export const stars = (score: number, level: number) => 1 + (score >= STAR_AT[level][0] ? 1 : 0) + (score >= STAR_AT[level][1] ? 1 : 0);
/** key -> hole: digits 1-9 in reading order; letters by the shape of the grid (Q W E (R) / A S D (F) / Z X C (V) / H J K (L)) */
export const KEY_ROWS = ["qwer", "asdf", "zxcv", "hjkl"];
export function keyHole(key: string, cols: number, rows: number): number {
  const k = key.toLowerCase();
  if (/^[1-9]$/.test(k)) { const i = Number(k) - 1; return i < cols * rows ? i : -1; }
  for (let r = 0; r < rows; r++) { const c = KEY_ROWS[r].indexOf(k); if (c >= 0 && c < cols) return r * cols + c; }
  return -1;
}
export const holeLabel = (i: number, cols: number) => KEY_ROWS[Math.floor(i / cols)][i % cols].toUpperCase();
