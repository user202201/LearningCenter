/** 算24点: the pure rules. Exact rational numbers (never floats), a solver, a hand generator that only deals solvable hands, and the merge-two-cards game state. */
export interface Frac { n: number; d: number }
export type Op = "+" | "-" | "*" | "/";
export const OPS: Op[] = ["+", "-", "*", "/"];
export const OP_SYMBOL: Record<Op, string> = { "+": "+", "-": "−", "*": "×", "/": "÷" };
/** level 0 = easy (1-6), 1 = normal (1-10), 2 = challenge (1-13, J = 11, Q = 12, K = 13) */
export const LEVEL_MAX = [6, 10, 13];
export const TARGET = 24;

const gcd = (a: number, b: number): number => { while (b) { [a, b] = [b, a % b]; } return Math.abs(a); };
export const fr = (n: number, d = 1): Frac => {
  if (d === 0) throw new Error("zero denominator");
  if (d < 0) { n = -n; d = -d; }
  const g = gcd(n, d) || 1;
  return { n: n / g, d: d / g };
};
export const eq = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;
export const isInt = (a: Frac) => a.d === 1;
export const is24 = (a: Frac) => a.n === TARGET && a.d === 1;
export const fracStr = (a: Frac) => (a.d === 1 ? String(a.n) : `${a.n}/${a.d}`);
/** a op b exactly; null for a division by zero */
export function apply(a: Frac, op: Op, b: Frac): Frac | null {
  switch (op) {
    case "+": return fr(a.n * b.d + b.n * a.d, a.d * b.d);
    case "-": return fr(a.n * b.d - b.n * a.d, a.d * b.d);
    case "*": return fr(a.n * b.n, a.d * b.d);
    case "/": return b.n === 0 ? null : fr(a.n * b.d, a.d * b.n);
  }
}
export const rankLabel = (r: number) => (r === 1 ? "A" : r === 11 ? "J" : r === 12 ? "Q" : r === 13 ? "K" : String(r));

/** one step: cards[i] op cards[j]; the result takes the place of the lower position, the higher one is removed */
export interface Step { i: number; j: number; op: Op; a: Frac; b: Frac; r: Frac }
const replaced = <T>(list: T[], i: number, j: number, r: T): T[] => {
  const lo = Math.min(i, j), hi = Math.max(i, j), out: T[] = [];
  for (let k = 0; k < list.length; k++) { if (k === hi) continue; out.push(k === lo ? r : list[k]); }
  return out;
};

/** the first solution found (a list of steps), or null; intOnly = every intermediate result is a whole number */
export function solveFrom(vals: Frac[], intOnly = false): Step[] | null {
  if (vals.length === 1) return is24(vals[0]) ? [] : null;
  for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals.length; j++) {
    if (i === j) continue;
    for (const op of OPS) {
      if ((op === "+" || op === "*") && i > j) continue;
      const r = apply(vals[i], op, vals[j]);
      if (!r || (intOnly && !isInt(r))) continue;
      const rest = solveFrom(replaced(vals, i, j, r), intOnly);
      if (rest) return [{ i, j, op, a: vals[i], b: vals[j], r }, ...rest];
    }
  }
  return null;
}
export const solve = (ranks: number[], intOnly = false) => solveFrom(ranks.map((r) => fr(r)), intOnly);
export const solvable = (ranks: number[]) => solve(ranks) !== null;
/** solvable, but only with a fraction on the way (3 3 8 8: 8 / (3 - 8 / 3)) */
export const needsFraction = (ranks: number[]) => solvable(ranks) && solve(ranks, true) === null;

// ---------- the hand generator ----------
const pools: { all: number[][]; frac: number[][] }[] = [];
/** every solvable multiset of ranks of a level (sorted), and those of them that need a fraction */
export function pool(level: number) {
  if (!pools[level]) {
    const max = LEVEL_MAX[level], all: number[][] = [], frac: number[][] = [];
    for (let a = 1; a <= max; a++) for (let b = a; b <= max; b++) for (let c = b; c <= max; c++) for (let d = c; d <= max; d++) {
      const hand = [a, b, c, d];
      if (!solvable(hand)) continue;
      all.push(hand);
      if (needsFraction(hand)) frac.push(hand);
    }
    pools[level] = { all, frac };
  }
  return pools[level];
}
/** a random solvable hand of the level (shuffled); about `fracShare` of them need a fraction step; never the hand `avoid` again */
export function deal(level: number, rng: () => number = Math.random, fracShare = 0.2, avoid?: number[]): number[] {
  const p = pool(level);
  const list = p.frac.length && rng() < fracShare ? p.frac : p.all;
  let pick = list[Math.floor(rng() * list.length)];
  for (let t = 0; t < 5 && avoid && sameMulti(pick, avoid); t++) pick = list[Math.floor(rng() * list.length)];
  const hand = pick.slice();
  for (let i = hand.length - 1; i > 0; i--) { const k = Math.floor(rng() * (i + 1)); [hand[i], hand[k]] = [hand[k], hand[i]]; }
  return hand;
}
const sameMulti = (a: number[], b: number[]) => a.slice().sort((x, y) => x - y).join() === b.slice().sort((x, y) => x - y).join();

// ---------- the game state ----------
/** src = the expression written so far with only the brackets it needs; prec 3 = a number, 2 = × ÷, 1 = + − */
export interface Card { v: Frac; src: string; prec: number; rank?: number }
export interface Hand { ranks: number[]; cards: Card[]; hist: Card[][] }
export type Status = "play" | "won" | "failed";
export const newHand = (ranks: number[]): Hand => ({ ranks: ranks.slice(), cards: ranks.map((r) => ({ v: fr(r), src: String(r), prec: 3, rank: r })), hist: [] });
export const resetHand = (h: Hand): Hand => newHand(h.ranks);
/** merge cards[i] op cards[j] into one card; "div0" = refused (the hand is unchanged), "same" = the same card twice */
export function combine(h: Hand, i: number, op: Op, j: number): Hand | "div0" | "same" {
  if (i === j || i < 0 || j < 0 || i >= h.cards.length || j >= h.cards.length) return "same";
  const a = h.cards[i], b = h.cards[j], r = apply(a.v, op, b.v);
  if (!r) return "div0";
  const wrap = (c: Card, need: boolean) => (need ? `(${c.src})` : c.src);
  const mul = op === "*" || op === "/";
  const left = wrap(a, mul ? a.prec < 2 : false), right = wrap(b, op === "+" ? false : op === "-" ? b.prec <= 1 : op === "*" ? b.prec < 2 : b.prec < 3);
  const card: Card = { v: r, src: `${left}${OP_SYMBOL[op]}${right}`, prec: mul ? 2 : 1 };
  return { ranks: h.ranks, cards: replaced(h.cards, i, j, card), hist: [...h.hist, h.cards] };
}
export const undo = (h: Hand): Hand => (h.hist.length ? { ranks: h.ranks, cards: h.hist[h.hist.length - 1], hist: h.hist.slice(0, -1) } : h);
export const status = (h: Hand): Status => (h.cards.length > 1 ? "play" : is24(h.cards[0].v) ? "won" : "failed");
/** the next step towards 24 from where the hand is now (null: this position can not reach 24, undo first) */
export const hint = (h: Hand): Step | null => { if (h.cards.length < 2) return null; const s = solveFrom(h.cards.map((c) => c.v)); return s && s.length ? s[0] : null; };
/** the whole solution of a hand as text, e.g. "8 ÷ (3 − 8 ÷ 3)" (null when unsolvable) */
export function solutionText(ranks: number[]): string | null {
  const steps = solve(ranks);
  if (!steps) return null;
  let h = newHand(ranks);
  for (const s of steps) { const n = combine(h, s.i, s.op, s.j); if (typeof n === "string") return null; h = n; }
  return h.cards[0].src.replace(/([+−×÷])/g, " $1 ");
}
