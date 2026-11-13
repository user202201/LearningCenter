/**
 * Spider Solitaire, the pure rules (no screen, no randomness except the `rng` given to `newGame`).
 * Cards are small integers: code = id * 2 + up (id 0..103, up 1 = face up). `State.f[id]` = suit * 16 + rank (rank 1 = ace .. 13 = king).
 * Two decks = 104 cards; suits 1 / 2 / 4 (suit index 0 spade, 1 heart, 2 club, 3 diamond).
 */
export type Suits = 1 | 2 | 4;
export interface Snap { cols: number[][]; stock: number[][]; found: number[]; moves: number; score: number }
export interface State extends Snap { suits: Suits; f: number[]; hist: Snap[] }
export interface Completed { col: number; suit: number; ids: number[] }
export interface MoveResult { ok: boolean; flipped: boolean; completed: Completed[] }
export interface Hint { from: number; idx: number; to: number; score: number }

export const COLS = 10, RUNS = 8, START_SCORE = 500, RUN_BONUS = 100;
export const mk = (id: number, up: number) => id * 2 + up;
export const idOf = (c: number) => c >> 1;
export const isUp = (c: number) => (c & 1) === 1;
export const rankOf = (s: State, c: number) => s.f[c >> 1] & 15;
export const suitOf = (s: State, c: number) => s.f[c >> 1] >> 4;

export function shuffle<T>(a: T[], rng: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export function newGame(suits: Suits, rng: () => number = Math.random): State {
  const f: number[] = [];
  for (let id = 0; id < 104; id++) { const set = Math.floor(id / 13); f.push((set % suits) * 16 + (id % 13) + 1); }
  const ids = shuffle(Array.from({ length: 104 }, (_, i) => i), rng);
  const cols: number[][] = Array.from({ length: COLS }, () => []);
  let k = 0;
  for (let c = 0; c < COLS; c++) {
    const n = c < 4 ? 6 : 5;
    for (let i = 0; i < n; i++) cols[c].push(mk(ids[k++], i === n - 1 ? 1 : 0));
  }
  const stock: number[][] = [];
  for (let d = 0; d < 5; d++) { const deal: number[] = []; for (let i = 0; i < COLS; i++) deal.push(mk(ids[k++], 1)); stock.push(deal); }
  return { suits, f, cols, stock, found: [], moves: 0, score: START_SCORE, hist: [] };
}

const snap = (s: State): Snap => ({ cols: s.cols.map((c) => c.slice()), stock: s.stock.map((d) => d.slice()), found: s.found.slice(), moves: s.moves, score: s.score });
export const cloneState = (s: State): State => ({ ...snap(s), suits: s.suits, f: s.f.slice(), hist: s.hist.map((h) => ({ cols: h.cols.map((c) => c.slice()), stock: h.stock.map((d) => d.slice()), found: h.found.slice(), moves: h.moves, score: h.score })) });

/** the card at the top of a column that can be picked up with everything below it: face up, same suit, descending by one */
export function pickable(s: State, col: number, idx: number): boolean {
  const c = s.cols[col];
  if (!c || idx < 0 || idx >= c.length || !isUp(c[idx])) return false;
  for (let i = idx; i < c.length - 1; i++) {
    if (suitOf(s, c[i]) !== suitOf(s, c[i + 1]) || rankOf(s, c[i]) !== rankOf(s, c[i + 1]) + 1 || !isUp(c[i + 1])) return false;
  }
  return true;
}
export function canDrop(s: State, from: number, idx: number, to: number): boolean {
  if (from === to || to < 0 || to >= COLS || !pickable(s, from, idx)) return false;
  const t = s.cols[to];
  if (t.length === 0) return true;
  return rankOf(s, t[t.length - 1]) === rankOf(s, s.cols[from][idx]) + 1;
}
/** index where the same-suit run that ends the column begins (the longest pickable run) */
export function runStart(s: State, col: number): number {
  const c = s.cols[col];
  if (!c.length) return 0;
  let i = c.length - 1;
  while (i > 0 && pickable(s, col, i - 1)) i--;
  return i;
}
export const canDeal = (s: State) => s.stock.length > 0 && s.cols.every((c) => c.length > 0);
export const won = (s: State) => s.found.length >= RUNS;

/** removes every complete K..A run of one suit from the ends of the given columns (and turns up what is uncovered) */
function sweep(s: State, cols: number[]): Completed[] {
  const out: Completed[] = [];
  for (const col of cols) {
    for (;;) {
      const c = s.cols[col];
      if (c.length < 13) break;
      const base = c.length - 13;
      if (!pickable(s, col, base) || rankOf(s, c[base]) !== 13 || rankOf(s, c[c.length - 1]) !== 1) break;
      const cut = c.splice(base);
      s.found.push(suitOf(s, cut[0]));
      s.score += RUN_BONUS;
      out.push({ col, suit: suitOf(s, cut[0]), ids: cut.map(idOf) });
      if (c.length && !isUp(c[c.length - 1])) c[c.length - 1] |= 1;
    }
  }
  return out;
}

export function move(s: State, from: number, idx: number, to: number): MoveResult {
  if (!canDrop(s, from, idx, to)) return { ok: false, flipped: false, completed: [] };
  s.hist.push(snap(s));
  const cut = s.cols[from].splice(idx);
  s.cols[to].push(...cut);
  let flipped = false;
  const src = s.cols[from];
  if (src.length && !isUp(src[src.length - 1])) { src[src.length - 1] |= 1; flipped = true; }
  s.moves++; s.score--;
  return { ok: true, flipped, completed: sweep(s, [to]) };
}

export function deal(s: State): MoveResult {
  if (!canDeal(s)) return { ok: false, flipped: false, completed: [] };
  s.hist.push(snap(s));
  const d = s.stock.pop() as number[];
  for (let i = 0; i < COLS; i++) s.cols[i].push(d[i] | 1);
  s.moves++; s.score--;
  return { ok: true, flipped: false, completed: sweep(s, Array.from({ length: COLS }, (_, i) => i)) };
}

export function undo(s: State): boolean {
  const p = s.hist.pop();
  if (!p) return false;
  s.cols = p.cols; s.stock = p.stock; s.found = p.found; s.moves = p.moves; s.score = p.score;
  return true;
}

/** the length of the same-suit descending face-up run at the end of a column */
function tailLen(s: State, col: number): number { const c = s.cols[col]; return c.length ? c.length - runStart(s, col) : 0; }

/** every sensible move, best first. A move that only shuffles (breaks a joined run, or moves a whole column to an empty one) is left out. */
export function hints(s: State): Hint[] {
  const out: Hint[] = [];
  for (let from = 0; from < COLS; from++) {
    const c = s.cols[from];
    for (let idx = 0; idx < c.length; idx++) {
      if (!pickable(s, from, idx)) continue;
      const first = c[idx], len = c.length - idx;
      const below = idx > 0 ? c[idx - 1] : 0;
      const joinedBelow = idx > 0 && isUp(below) && suitOf(s, below) === suitOf(s, first) && rankOf(s, below) === rankOf(s, first) + 1;
      if (joinedBelow) continue;
      for (let to = 0; to < COLS; to++) {
        if (!canDrop(s, from, idx, to)) continue;
        const t = s.cols[to];
        if (t.length === 0 && idx === 0) continue;
        let score = 0;
        if (idx > 0 && !isUp(below)) score += 50;               // uncovers a face-down card
        else if (idx === 0) score += 15;                        // empties a column
        if (t.length === 0) score += 5;
        else if (suitOf(s, t[t.length - 1]) === suitOf(s, first)) {
          score += 30;
          if (tailLen(s, to) + len >= 13) score += 100;         // completes a run
          score += tailLen(s, to) * 0.5;
        } else score += 2;
        score += len * 0.1;
        out.push({ from, idx, to, score });
      }
    }
  }
  return out.sort((a, b) => b.score - a.score);
}
/** the best move of one card (and what lies on it), or null (used by tap-to-move) */
export function bestTarget(s: State, from: number, idx: number): number | null {
  const l = hints(s).filter((m) => m.from === from && m.idx === idx);
  if (l.length) return l[0].to;
  // not "sensible" but legal: anything except an empty column of a whole column
  for (let to = 0; to < COLS; to++) if (canDrop(s, from, idx, to) && !(s.cols[to].length === 0 && idx === 0)) return to;
  return null;
}
/** what to suggest: a good move, else a deal, else any move */
export function suggest(s: State): { kind: "move"; hint: Hint } | { kind: "deal" } | null {
  const l = hints(s);
  if (l.length && l[0].score >= 5) return { kind: "move", hint: l[0] };
  if (canDeal(s)) return { kind: "deal" };
  if (l.length) return { kind: "move", hint: l[0] };
  return null;
}

/** null when the state is sound, else what is wrong (104 cards accounted for, tops face up, ...) */
export function audit(s: State): string | null {
  const seen = new Set<number>();
  let n = s.found.length * 13;
  const add = (c: number) => { const id = idOf(c); if (seen.has(id) || id < 0 || id > 103) return false; seen.add(id); n++; return true; };
  for (const c of s.cols) for (const x of c) if (!add(x)) return "duplicate or bad card";
  for (const d of s.stock) { if (d.length !== COLS) return "deal size"; for (const x of d) if (!add(x)) return "duplicate or bad card in stock"; }
  if (n !== 104) return `cards counted ${n}`;
  for (let i = 0; i < s.cols.length; i++) { const c = s.cols[i]; if (c.length && !isUp(c[c.length - 1])) return `column ${i} top face down`; }
  for (const d of s.stock) for (const x of d) if (!isUp(x)) return "stock card face up flag";
  if (s.found.length > RUNS) return "too many runs";
  const per: Record<number, number> = {};
  for (const id of seen) { const su = s.f[id] >> 4; per[su] = (per[su] ?? 0) + 1; }
  return null;
}
