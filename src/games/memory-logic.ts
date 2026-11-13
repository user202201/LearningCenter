/** Memory: the pure rules (no screen, no timer). Cards are numbers (the animal on them); every animal is on exactly two cards. */
export type Rng = () => number;
export interface Size { id: string; rows: number; cols: number }
/** the four sizes, easy to hard; rows <= cols here (the screen may turn the grid by a quarter) */
export const SIZES: Size[] = [
  { id: "3x4", rows: 3, cols: 4 },
  { id: "4x4", rows: 4, cols: 4 },
  { id: "4x5", rows: 4, cols: 5 },
  { id: "5x6", rows: 5, cols: 6 },
];
export const ANIMAL_TOTAL = 18;
export const MISS_MS = 800;

/** a small seeded random generator (for tests and repeatable deals) */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export interface MemState {
  size: Size;
  /** the animal of every card, row by row */
  cards: number[];
  /** card is turned up (matched or waiting) */
  up: boolean[];
  matched: boolean[];
  /** the cards turned up and not decided yet (0, 1 or 2 indexes) */
  pending: number[];
  moves: number;
  pairs: number;
  won: boolean;
}
export interface FlipResult { kind: "ignored" | "first" | "match" | "miss"; /** the two cards turned back first because a third one was tapped */ resolved?: number[] }

export function deal(size: Size, rng: Rng = Math.random): MemState {
  const n = size.rows * size.cols;
  if (n % 2 || n / 2 > ANIMAL_TOTAL) throw new Error("bad size");
  const all = Array.from({ length: ANIMAL_TOTAL }, (_, i) => i);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const cards: number[] = [];
  for (const a of all.slice(0, n / 2)) cards.push(a, a);
  for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  return { size, cards, up: cards.map(() => false), matched: cards.map(() => false), pending: [], moves: 0, pairs: 0, won: false };
}

/** turn the two waiting cards of a miss back down (a no-op otherwise); returns the cards that went down */
export function resolve(s: MemState): number[] {
  if (s.pending.length !== 2) return [];
  const [a, b] = s.pending;
  if (s.cards[a] === s.cards[b]) return [];
  s.up[a] = false; s.up[b] = false; s.pending = [];
  return [a, b];
}

export function flip(s: MemState, i: number): FlipResult {
  if (s.won || i < 0 || i >= s.cards.length) return { kind: "ignored" };
  if (s.matched[i] || s.up[i]) return { kind: "ignored" };
  const resolved = resolve(s);
  s.up[i] = true; s.pending.push(i);
  const res = (kind: FlipResult["kind"]): FlipResult => (resolved.length ? { kind, resolved } : { kind });
  if (s.pending.length === 1) return res("first");
  s.moves++;
  const [a, b] = s.pending;
  if (s.cards[a] === s.cards[b]) {
    s.matched[a] = true; s.matched[b] = true; s.pending = []; s.pairs++;
    if (s.pairs === s.cards.length / 2) s.won = true;
    return res("match");
  }
  return res("miss");
}

/** 3 stars for (nearly) perfect play, 2 for a good game, 1 for finishing */
export function stars(moves: number, pairs: number): 1 | 2 | 3 {
  if (moves <= Math.ceil(pairs * 1.6)) return 3;
  if (moves <= Math.ceil(pairs * 2.6)) return 2;
  return 1;
}
export const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
