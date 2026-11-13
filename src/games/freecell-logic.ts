/** 空当接龙 (FreeCell): the pure rules. A card is rank * 4 + suit (rank 0 = Ace .. 12 = King; suit 0 clubs, 1 diamonds, 2 hearts, 3 spades). No DOM in here. */

export type Card = number;
export const rankOf = (c: Card): number => c >> 2;
export const suitOf = (c: Card): number => c & 3;
export const isRed = (c: Card): boolean => { const s = c & 3; return s === 1 || s === 2; };
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
/** "JD", "TS" ... (T = ten): the notation of the classic deal lists */
export const cardName = (c: Card): string => "A23456789TJQK"[rankOf(c)] + "CDHS"[suitOf(c)];

export interface Loc { t: "col" | "cell" | "found"; i: number }
export interface Move { from: Loc; to: Loc; n: number; a?: boolean }
export interface State { cols: Card[][]; cells: number[]; found: number[] }

export const NCOLS = 8;
export const NCELLS = 4;

/** the classic Microsoft FreeCell shuffle: deal number 1..32000 (any positive number works) */
export function dealDeck(seed: number): Card[] {
  let s = seed;
  const rand = (): number => { s = (s * 214013 + 2531011) % 2147483648; return s >> 16; };
  const deck: Card[] = [];
  for (let i = 0; i < 52; i++) deck.push(i);
  for (let i = 0; i < 52; i++) {
    const j = rand() % (52 - i);
    const k = 51 - i;
    const tmp = deck[j]; deck[j] = deck[k]; deck[k] = tmp;
  }
  return deck;
}
export function deal(seed: number): State {
  const deck = dealDeck(seed);
  const cols: Card[][] = Array.from({ length: NCOLS }, () => []);
  for (let k = 0; k < 52; k++) cols[k % NCOLS].push(deck[51 - k]);
  return { cols, cells: [-1, -1, -1, -1], found: [0, 0, 0, 0] };
}

export const clone = (s: State): State => ({ cols: s.cols.map((c) => c.slice()), cells: s.cells.slice(), found: s.found.slice() });
export const sameState = (a: State, b: State): boolean => JSON.stringify(a) === JSON.stringify(b);
export const emptyCols = (s: State): number => s.cols.filter((c) => c.length === 0).length;
export const freeCells = (s: State): number => s.cells.filter((c) => c < 0).length;
export const foundCount = (s: State): number => s.found[0] + s.found[1] + s.found[2] + s.found[3];
export const isWon = (s: State): boolean => foundCount(s) === 52;
export const cardsOnTable = (s: State): number => s.cols.reduce((n, c) => n + c.length, 0) + s.cells.filter((c) => c >= 0).length + foundCount(s);

/** how many cards one move may carry: (free cells + 1) * 2 ^ (empty columns, not counting the target when that is empty) */
export const maxSeq = (freeCellsN: number, emptyColsN: number, targetEmpty: boolean): number =>
  (freeCellsN + 1) * 2 ** Math.max(0, emptyColsN - (targetEmpty ? 1 : 0));

/** can `a` be laid on `b` in a cascade (one lower, other colour) */
export const canStack = (a: Card, b: Card): boolean => rankOf(a) === rankOf(b) - 1 && isRed(a) !== isRed(b);
/** are these cards a descending, alternating run */
export const isRun = (cards: Card[]): boolean => { for (let i = 1; i < cards.length; i++) if (!canStack(cards[i], cards[i - 1])) return false; return true; };
/** length of the run that ends at the bottom of a cascade */
export function runLength(col: Card[]): number {
  let n = col.length ? 1 : 0;
  while (n < col.length && canStack(col[col.length - n], col[col.length - n - 1])) n++;
  return n;
}

/** the cards a move would carry, or null when the source does not hold them */
export function carried(s: State, from: Loc, n: number): Card[] | null {
  if (from.t === "col") { const c = s.cols[from.i]; if (!c || n < 1 || n > c.length) return null; return c.slice(c.length - n); }
  if (from.t === "cell") { const c = s.cells[from.i]; return c !== undefined && c >= 0 && n === 1 ? [c] : null; }
  return null;
}

/** why a move is not allowed ("" = allowed) */
export function why(s: State, m: Move): string {
  const cards = carried(s, m.from, m.n);
  if (!cards) return "source";
  if (!isRun(cards)) return "run";
  const head = cards[0];
  const fc = freeCells(s), ec = emptyCols(s);
  if (m.to.t === "col") {
    const dest = s.cols[m.to.i];
    if (!dest) return "target";
    if (m.from.t === "col" && m.from.i === m.to.i) return "same";
    const empty = dest.length === 0;
    if (m.n > maxSeq(fc, ec, empty)) return "limit";
    if (!empty && !canStack(head, dest[dest.length - 1])) return "stack";
    return "";
  }
  if (m.to.t === "cell") {
    if (m.n !== 1 || m.from.t === "cell") return "cell";
    return s.cells[m.to.i] === -1 ? "" : "full";
  }
  if (m.n !== 1) return "found";
  if (m.to.i !== suitOf(head) || s.found[m.to.i] !== rankOf(head)) return "found";
  return "";
}
export const isLegal = (s: State, m: Move): boolean => why(s, m) === "";

/** applies a move that is known to be legal */
export function applyMove(s: State, m: Move): State {
  const r = clone(s);
  let cards: Card[];
  if (m.from.t === "col") { const c = r.cols[m.from.i]; cards = c.splice(c.length - m.n, m.n); }
  else { cards = [r.cells[m.from.i]]; r.cells[m.from.i] = -1; }
  if (m.to.t === "col") r.cols[m.to.i].push(...cards);
  else if (m.to.t === "cell") r.cells[m.to.i] = cards[0];
  else r.found[m.to.i]++;
  return r;
}
/** a legal move gives the new state, an illegal one null */
export const tryMove = (s: State, m: Move): State | null => (isLegal(s, m) ? applyMove(s, m) : null);
export const replay = (base: State, moves: Move[]): State => moves.reduce((st, m) => applyMove(st, m), base);

const col = (i: number): Loc => ({ t: "col", i });
const cell = (i: number): Loc => ({ t: "cell", i });
const fnd = (i: number): Loc => ({ t: "found", i });

/** every legal move of the card(s) at `from` (n = 0: the longest run is not assumed, n is given). Equal empty targets are listed once (the first one). */
export function movesFrom(s: State, from: Loc, n: number): Move[] {
  const cards = carried(s, from, n);
  if (!cards || !isRun(cards)) return [];
  const out: Move[] = [];
  const add = (to: Loc) => { const m: Move = { from, to, n }; if (isLegal(s, m)) out.push(m); };
  if (n === 1) add(fnd(suitOf(cards[0])));
  let emptyDone = false;
  for (let j = 0; j < NCOLS; j++) {
    if (s.cols[j].length === 0) {
      if (emptyDone) continue;
      emptyDone = true;
      if (from.t === "col" && s.cols[from.i].length === n) continue; // a whole column to an empty one changes nothing
    }
    add(col(j));
  }
  if (n === 1 && from.t === "col") { const e = s.cells.indexOf(-1); if (e >= 0) add(cell(e)); }
  return out;
}

/** every legal move of the position (the cards of a column in runs of 1..n) */
export function legalMoves(s: State): Move[] {
  const out: Move[] = [];
  for (let i = 0; i < NCOLS; i++) {
    const rl = runLength(s.cols[i]);
    for (let n = 1; n <= rl; n++) out.push(...movesFrom(s, col(i), n));
  }
  for (let i = 0; i < NCELLS; i++) if (s.cells[i] >= 0) out.push(...movesFrom(s, cell(i), 1));
  return out;
}

/** can this card go to the foundation without ever being needed on the table: Aces and 2s always, others when both cards one lower of the other colour are up */
export function isSafe(s: State, c: Card): boolean {
  const r = rankOf(c);
  if (s.found[suitOf(c)] !== r) return false;
  if (r <= 1) return true;
  const red = isRed(c);
  for (let q = 0; q < 4; q++) if (isRed(q) !== red && s.found[q] < r) return false;
  return true;
}
/** the next card that is safe to send up (a move), or null */
export function safeMove(s: State): Move | null {
  for (let i = 0; i < NCELLS; i++) { const c = s.cells[i]; if (c >= 0 && isSafe(s, c)) return { from: cell(i), to: fnd(suitOf(c)), n: 1, a: true }; }
  for (let i = 0; i < NCOLS; i++) { const c = s.cols[i]; if (c.length && isSafe(s, c[c.length - 1])) return { from: col(i), to: fnd(suitOf(c[c.length - 1])), n: 1, a: true }; }
  return null;
}
/** any card that can go up right now (not only the safe ones), lowest rank first: for "自动完成" */
export function upMove(s: State): Move | null {
  let best: Move | null = null, br = 99;
  const look = (from: Loc, c: Card) => { if (s.found[suitOf(c)] === rankOf(c) && rankOf(c) < br) { br = rankOf(c); best = { from, to: fnd(suitOf(c)), n: 1, a: true }; } };
  for (let i = 0; i < NCELLS; i++) if (s.cells[i] >= 0) look(cell(i), s.cells[i]);
  for (let i = 0; i < NCOLS; i++) { const c = s.cols[i]; if (c.length) look(col(i), c[c.length - 1]); }
  return best;
}
/** every safe card sent up, as many as there are */
export function collectSafe(s: State): { s: State; moves: Move[] } {
  const moves: Move[] = [];
  let cur = s;
  for (;;) { const m = safeMove(cur); if (!m) break; moves.push(m); cur = applyMove(cur, m); }
  return { s: cur, moves };
}

/** "trivially won": every cascade is in descending order, so the rest is just sending cards up (the smallest card left is always free) */
export function isTrivial(s: State): boolean {
  if (isWon(s)) return false;
  for (const c of s.cols) for (let i = 1; i < c.length; i++) if (rankOf(c[i]) >= rankOf(c[i - 1])) return false;
  return true;
}

/** no move at all */
export const isStuck = (s: State): boolean => !isWon(s) && legalMoves(s).length === 0;

// ---------------------------------------------------------------- search

/** same position whatever the order of the columns / cells */
export function keyOf(s: State): string {
  return s.cols.map((c) => c.join(",")).sort().join("|") + "#" + s.cells.filter((c) => c >= 0).sort((a, b) => a - b).join(",") + "#" + s.found.join("");
}
/** the lower the better */
export function heuristic(s: State): number {
  let h = (52 - foundCount(s)) * 6;
  for (const c of s.cols) {
    // a card with a higher card below it (nearer the bottom) is buried: that card has to move first
    let maxBelow = -1;
    for (let i = c.length - 1; i >= 0; i--) {
      const r = rankOf(c[i]);
      if (r < maxBelow) h += 3;
      if (r > maxBelow) maxBelow = r;
    }
    if (c.length === 0) h -= 4;
  }
  h += (4 - freeCells(s)) * 2;
  // the next card of every suit: how deep is it
  for (let q = 0; q < 4; q++) {
    const need = s.found[q] * 4 + q;
    if (s.found[q] >= 13) continue;
    for (const c of s.cols) { const i = c.indexOf(need); if (i >= 0) h += (c.length - 1 - i) * 2; }
  }
  return h;
}

interface Node { s: State; parent: Node | null; moves: Move[]; g: number; f: number }

/** best-first search (autos after every move are folded in). path = every move incl. the safe ones, from the position given. */
export function solve(start: State, budget = 20000): { path: Move[] | null; exhausted: boolean; nodes: number } {
  const heap: Node[] = [];
  const push = (n: Node) => { heap.push(n); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = (): Node => {
    const top = heap[0], last = heap.pop() as Node;
    if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } }
    return top;
  };
  const seen = new Set<string>([keyOf(start)]);
  push({ s: start, parent: null, moves: [], g: 0, f: heuristic(start) });
  let nodes = 0;
  const build = (n: Node): Move[] => { const out: Move[][] = []; for (let x: Node | null = n; x; x = x.parent) out.push(x.moves); return out.reverse().flat(); };
  if (isWon(start)) return { path: [], exhausted: false, nodes: 0 };
  while (heap.length) {
    if (nodes >= budget) return { path: null, exhausted: false, nodes };
    const n = pop();
    nodes++;
    for (const m of legalMoves(n.s)) {
      const first = applyMove(n.s, m);
      const col = collectSafe(first);
      const k = keyOf(col.s);
      if (seen.has(k)) continue;
      seen.add(k);
      const node: Node = { s: col.s, parent: n, moves: [m, ...col.moves], g: n.g + 1, f: heuristic(col.s) + (n.g + 1) * 0.35 };
      if (isWon(col.s)) return { path: build(node), exhausted: false, nodes };
      push(node);
    }
  }
  return { path: null, exhausted: true, nodes };
}

/** a good legal move for the player: the first step of a solution when the search finds one, otherwise the move that leaves the best looking position */
export function hints(s: State, budget = 12000): { move: Move | null; solved: boolean; unsolvable: boolean } {
  if (isWon(s)) return { move: null, solved: false, unsolvable: false };
  const r = solve(s, budget);
  if (r.path && r.path.length) return { move: { ...r.path[0], a: false }, solved: true, unsolvable: false };
  const all = legalMoves(s);
  if (!all.length) return { move: null, solved: false, unsolvable: true };
  let best = all[0], bh = Infinity;
  for (const m of all) { const h = heuristic(collectSafe(applyMove(s, m)).s) + (m.to.t === "cell" ? 3 : 0); if (h < bh) { bh = h; best = m; } }
  return { move: best, solved: false, unsolvable: r.exhausted };
}

/** the whole game from a deal: moves are replayed from the numbered deal */
export const MIN_DEAL = 1;
export const MAX_DEAL = 32000;
