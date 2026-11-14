/** 经典纸牌 (Klondike solitaire): the pure rules. No DOM in here. A card is rank * 4 + suit (rank 0 = Ace .. 12 = King; suit 0 clubs, 1 diamonds, 2 hearts, 3 spades). */

export type Card = number;
export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;
export const isRed = (c: Card): boolean => { const s = c & 3; return s === 1 || s === 2; };
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
export const NPILES = 7;

export type Loc = { t: "tab"; i: number } | { t: "waste" } | { t: "found"; i: number };
export type Move = { k: "draw" } | { k: "move"; from: Loc; to: Loc; n: number };

export interface State {
  /** the seven piles, bottom to top; the first `down[i]` cards of a pile are face down, the rest face up */
  tab: Card[][];
  down: number[];
  /** the stock and the waste: the top card is the last one */
  stock: Card[];
  waste: Card[];
  /** cards on each suit's foundation (the top card has rank found - 1) */
  found: number[];
  /** cards drawn at a time: 1 or 3 */
  draw: 1 | 3;
  /** how many times the waste was turned over into the stock */
  recycles: number;
  score: number;
  moves: number;
  /** how many waste cards are fanned out (draw 3 shows up to three; only the top one can be played) */
  fan: number;
}

/** a seeded shuffle (mulberry32 + Fisher-Yates): the same number always gives the same deal */
export function dealDeck(seed: number): Card[] {
  let a = (seed >>> 0) || 1;
  const rand = (): number => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const deck: Card[] = [];
  for (let i = 0; i < 52; i++) deck.push(i);
  for (let i = 51; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const x = deck[i]; deck[i] = deck[j]; deck[j] = x; }
  return deck;
}
/** the deal: pile i gets i + 1 cards (only the last one face up), the other 24 form the stock */
export function deal(seed: number, draw: 1 | 3 = 1): State {
  const deck = dealDeck(seed);
  const tab: Card[][] = [];
  let k = 0;
  for (let i = 0; i < NPILES; i++) { tab.push(deck.slice(k, k + i + 1)); k += i + 1; }
  return { tab, down: [0, 1, 2, 3, 4, 5, 6], stock: deck.slice(k), waste: [], found: [0, 0, 0, 0], draw, recycles: 0, score: 0, moves: 0, fan: 0 };
}

export const clone = (s: State): State => ({ ...s, tab: s.tab.map((p) => p.slice()), down: s.down.slice(), stock: s.stock.slice(), waste: s.waste.slice(), found: s.found.slice() });
export const isWon = (s: State): boolean => s.found[0] + s.found[1] + s.found[2] + s.found[3] === 52;
export const allFaceUp = (s: State): boolean => s.down.every((d) => d === 0);
export const foundCard = (s: State, suit: number): Card => (s.found[suit] > 0 ? (s.found[suit] - 1) * 4 + suit : -1);
/** the face-up cards of a pile */
export const upCount = (s: State, i: number): number => s.tab[i].length - s.down[i];
export const canPlace = (c: Card, onto: Card): boolean => rankOf(onto) === rankOf(c) + 1 && isRed(onto) !== isRed(c);
export const canFound = (s: State, c: Card): boolean => s.found[suitOf(c)] === rankOf(c);

/** the cards a move would carry (null when the source does not exist) */
export function carried(s: State, from: Loc, n: number): Card[] | null {
  if (from.t === "waste") return n === 1 && s.waste.length ? [s.waste[s.waste.length - 1]] : null;
  if (from.t === "found") { const c = foundCard(s, from.i); return n === 1 && c >= 0 ? [c] : null; }
  const p = s.tab[from.i];
  if (!p || n < 1 || n > p.length - s.down[from.i]) return null;
  return p.slice(p.length - n);
}
export function isLegal(s: State, m: Move): boolean {
  if (m.k === "draw") return s.stock.length > 0 || s.waste.length > 0;
  const cs = carried(s, m.from, m.n);
  if (!cs) return false;
  const first = cs[0];
  if (m.to.t === "found") return cs.length === 1 && suitOf(first) === m.to.i && canFound(s, first) && m.from.t !== "found";
  if (m.to.t === "waste") return false;
  if (m.from.t === "tab" && m.from.i === m.to.i) return false;
  const dest = s.tab[m.to.i];
  if (!dest) return false;
  if (dest.length === 0) return rankOf(first) === 12;
  return canPlace(first, dest[dest.length - 1]);
}

const clampScore = (v: number): number => Math.max(0, v);
/** draws in place: one step of the stock (or the turning over of the waste when the stock is empty) */
function drawIn(s: State): void {
  if (s.stock.length) {
    const n = Math.min(s.draw, s.stock.length);
    for (let i = 0; i < n; i++) s.waste.push(s.stock.pop() as Card);
    s.fan = n;
  } else {
    s.stock = s.waste.reverse(); s.waste = []; s.fan = 0; s.recycles++;
    if (s.draw === 1) s.score = clampScore(s.score - 100);
    else if (s.recycles >= 3) s.score = clampScore(s.score - 20);
  }
}
/** applies a move in place; false (and nothing changed) when it is illegal */
export function applyIn(s: State, m: Move): boolean {
  if (!isLegal(s, m)) return false;
  s.moves++;
  if (m.k === "draw") { drawIn(s); return true; }
  const cs = carried(s, m.from, m.n) as Card[];
  let delta = 0;
  if (m.from.t === "waste") { s.waste.pop(); s.fan = !s.waste.length ? 0 : s.draw === 1 ? 1 : Math.max(1, s.fan - 1); delta += m.to.t === "found" ? 10 : 5; }
  else if (m.from.t === "found") { s.found[m.from.i]--; delta -= 15; }
  else {
    const i = m.from.i;
    s.tab[i].length -= m.n;
    if (s.tab[i].length > 0 && s.down[i] === s.tab[i].length) { s.down[i]--; delta += 5; }
    if (m.to.t === "found") delta += 10;
  }
  if (m.to.t === "found") s.found[m.to.i]++;
  else if (m.to.t === "tab") s.tab[m.to.i].push(...cs);
  s.score = clampScore(s.score + delta);
  return true;
}
export function apply(s: State, m: Move): State | null {
  if (!isLegal(s, m)) return null;
  const ns = clone(s);
  applyIn(ns, m);
  return ns;
}

/** every legal move (a King move to each empty pile is listed once per pile) */
export function legalMoves(s: State): Move[] {
  const out: Move[] = [];
  const dests = (from: Loc, n: number) => {
    const cs = carried(s, from, n);
    if (!cs) return;
    if (n === 1) { const f: Move = { k: "move", from, to: { t: "found", i: suitOf(cs[0]) }, n }; if (isLegal(s, f)) out.push(f); }
    for (let j = 0; j < NPILES; j++) { const m: Move = { k: "move", from, to: { t: "tab", i: j }, n }; if (isLegal(s, m)) out.push(m); }
  };
  if (isLegal(s, { k: "draw" })) out.push({ k: "draw" });
  dests({ t: "waste" }, 1);
  for (let i = 0; i < NPILES; i++) for (let n = 1; n <= upCount(s, i); n++) dests({ t: "tab", i }, n);
  for (let i = 0; i < 4; i++) dests({ t: "found", i }, 1);
  return out;
}

/** a King run that already stands at the bottom of its pile gains nothing by moving to an empty pile */
export function isPointless(s: State, m: Move): boolean {
  if (m.k !== "move" || m.from.t !== "tab" || m.to.t !== "tab") return false;
  const p = s.tab[m.from.i];
  return s.down[m.from.i] === 0 && p.length === m.n && s.tab[m.to.i].length === 0;
}

/** the move a tap on a card makes: the foundation when that is possible, otherwise the best pile (one with cards before an empty one) */
export function tapMove(s: State, from: Loc, n: number): Move | null {
  const cs = carried(s, from, n);
  if (!cs) return null;
  if (n === 1 && from.t !== "found") { const f: Move = { k: "move", from, to: { t: "found", i: suitOf(cs[0]) }, n }; if (isLegal(s, f)) return f; }
  let empty: Move | null = null;
  for (let j = 0; j < NPILES; j++) {
    const m: Move = { k: "move", from, to: { t: "tab", i: j }, n };
    if (!isLegal(s, m)) continue;
    if (s.tab[j].length) return m;
    if (!empty && !isPointless(s, m)) empty = m;
  }
  return empty;
}

/** would drawing from the stock (turning the waste over when needed) bring a playable card to the top of the waste? The tableau stays as it is. */
export function drawUseful(s: State): boolean {
  if (!s.stock.length && !s.waste.length) return false;
  const t = clone(s);
  t.recycles = 0;
  const playable = (): boolean => {
    if (!t.waste.length) return false;
    const c = t.waste[t.waste.length - 1];
    if (canFound(t, c)) return true;
    for (let j = 0; j < NPILES; j++) { const p = t.tab[j]; if (p.length === 0 ? rankOf(c) === 12 : canPlace(c, p[p.length - 1])) return true; }
    return false;
  };
  const seen = new Set<string>();
  for (let i = 0; i < 120; i++) {
    drawIn(t);
    if (playable()) return true;
    const key = t.stock.join(",") + "|" + t.waste.join(",");
    if (seen.has(key)) return false;
    seen.add(key);
  }
  return false;
}

export type HintKind = "reveal" | "found" | "space" | "tab" | "draw" | "recycle";
export interface Hint { move: Move; kind: HintKind }
/** a useful move: one that turns over a face-down card, then a foundation move, then one that empties a pile, then a waste card onto a pile, then the stock; null when nothing is left */
export function hint(s: State): Hint | null {
  const ms = legalMoves(s).filter((m) => !isPointless(s, m));
  const pick = (f: (m: Extract<Move, { k: "move" }>) => boolean): Move | undefined => ms.find((m) => m.k === "move" && f(m));
  const tt = (m: Extract<Move, { k: "move" }>) => m.from.t === "tab" && m.to.t === "tab";
  const whole = (m: Extract<Move, { k: "move" }>) => m.from.t === "tab" && s.tab[m.from.i].length === m.n + s.down[m.from.i];
  let m = pick((x) => tt(x) && whole(x) && s.down[(x.from as { i: number }).i] > 0);
  if (m) return { move: m, kind: "reveal" };
  m = pick((x) => x.to.t === "found" && x.from.t !== "found");
  if (m) return { move: m, kind: "found" };
  m = pick((x) => tt(x) && whole(x) && s.down[(x.from as { i: number }).i] === 0);
  if (m) return { move: m, kind: "space" };
  m = pick((x) => x.from.t === "waste" && x.to.t === "tab");
  if (m) return { move: m, kind: "tab" };
  // a partial run that lets the card under it go to the foundation
  m = pick((x) => {
    if (!tt(x) || whole(x)) return false;
    const p = s.tab[(x.from as { i: number }).i];
    return canFound(s, p[p.length - x.n - 1]);
  });
  if (m) return { move: m, kind: "tab" };
  if (drawUseful(s)) return { move: { k: "draw" }, kind: s.stock.length ? "draw" : "recycle" };
  return null;
}

/** the next foundation move for the automatic finish: the lowest card that can go up (a pile's top or the waste's top) */
export function autoStep(s: State): Move | null {
  let best: Move | null = null, bestRank = 99;
  const consider = (from: Loc, c: Card) => { if (canFound(s, c) && rankOf(c) < bestRank) { bestRank = rankOf(c); best = { k: "move", from, to: { t: "found", i: suitOf(c) }, n: 1 }; } };
  if (s.waste.length) consider({ t: "waste" }, s.waste[s.waste.length - 1]);
  for (let i = 0; i < NPILES; i++) if (s.tab[i].length && upCount(s, i) > 0) consider({ t: "tab", i }, s.tab[i][s.tab[i].length - 1]);
  return best;
}
/** the moves that finish the game by themselves (foundation moves and draws), or null when that does not work; only tried when every pile card is face up */
export function autoPlan(s: State): Move[] | null {
  if (!allFaceUp(s) || isWon(s)) return null;
  const t = clone(s), plan: Move[] = [];
  let idle = 0;
  for (let guard = 0; guard < 600; guard++) {
    if (isWon(t)) return plan;
    const m = autoStep(t);
    if (m) { applyIn(t, m); plan.push(m); idle = 0; continue; }
    if (idle > 60 || (!t.stock.length && !t.waste.length)) return null;
    const d: Move = { k: "draw" };
    applyIn(t, d); plan.push(d); idle++;
  }
  return null;
}

/** the time bonus of a won game (Windows style): 700000 / seconds when the game took longer than 30 seconds */
export const timeBonus = (ms: number): number => { const sec = Math.round(ms / 1000); return sec > 30 ? Math.floor(700000 / sec) : 0; };

/** is the position consistent? (for tests and loading): returns the first problem or "" */
export function validate(s: State): string {
  const seen = new Array(52).fill(0);
  const add = (c: Card) => { if (!Number.isInteger(c) || c < 0 || c > 51) return false; seen[c]++; return true; };
  for (let i = 0; i < NPILES; i++) {
    const p = s.tab[i];
    if (s.down[i] < 0 || s.down[i] > p.length) return "down count of pile " + i;
    if (p.length > 0 && s.down[i] === p.length) return "top card of pile " + i + " face down";
    for (let k = 0; k < p.length; k++) {
      if (!add(p[k])) return "bad card";
      if (k > s.down[i] && !canPlace(p[k], p[k - 1])) return "face-up run of pile " + i + " is not descending / alternating";
    }
  }
  for (const c of s.stock) if (!add(c)) return "bad card";
  for (const c of s.waste) if (!add(c)) return "bad card";
  for (let su = 0; su < 4; su++) for (let r = 0; r < s.found[su]; r++) add(r * 4 + su);
  for (let c = 0; c < 52; c++) if (seen[c] !== 1) return "card " + c + " seen " + seen[c] + " times";
  if (s.score < 0) return "negative score";
  return "";
}
