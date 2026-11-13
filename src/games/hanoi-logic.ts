/** Tower of Hanoi: the rules as pure functions (no DOM). Discs are numbered 0 (smallest) .. n-1 (largest); `pegs[p]` lists a peg bottom -> top. */
export interface HState { n: number; pegs: number[][] }
export interface HMove { from: number; to: number; disc: number }
export const GOAL = 2;
export const MIN_DISCS = 3, MAX_DISCS = 8;

export const minMoves = (n: number): number => 2 ** n - 1;
export function newHanoi(n: number, startPeg = 0): HState {
  const pegs: number[][] = [[], [], []];
  for (let d = n - 1; d >= 0; d--) pegs[startPeg].push(d);
  return { n, pegs };
}
export const cloneState = (s: HState): HState => ({ n: s.n, pegs: s.pegs.map((p) => p.slice()) });
export const topOf = (s: HState, p: number): number => (s.pegs[p].length ? s.pegs[p][s.pegs[p].length - 1] : -1);
export function canMove(s: HState, from: number, to: number): boolean {
  if (from === to || from < 0 || from > 2 || to < 0 || to > 2) return false;
  const a = topOf(s, from);
  if (a < 0) return false;
  const b = topOf(s, to);
  return b < 0 || a < b;
}
export function move(s: HState, from: number, to: number): HMove | null {
  if (!canMove(s, from, to)) return null;
  const disc = s.pegs[from].pop() as number;
  s.pegs[to].push(disc);
  return { from, to, disc };
}
export function undoMove(s: HState, m: HMove): void { s.pegs[m.to].pop(); s.pegs[m.from].push(m.disc); }
export const isWon = (s: HState, goal = GOAL): boolean => s.pegs[goal].length === s.n;
export function pegOfDisc(s: HState): number[] {
  const of = new Array<number>(s.n).fill(-1);
  s.pegs.forEach((p, i) => p.forEach((d) => { of[d] = i; }));
  return of;
}
/** null when the state is a legal Hanoi position (every disc once, every peg sorted large -> small) */
export function validate(s: HState): string | null {
  const seen = new Set<number>();
  for (const p of s.pegs) {
    for (let i = 0; i < p.length; i++) {
      if (p[i] < 0 || p[i] >= s.n || seen.has(p[i])) return "bad or repeated disc";
      seen.add(p[i]);
      if (i > 0 && p[i] > p[i - 1]) return "larger disc on a smaller one";
    }
  }
  return seen.size === s.n ? null : "a disc is missing";
}
/** the state as a number 0 .. 3^n-1 (base 3, the peg of every disc) */
export function encode(s: HState): number {
  const of = pegOfDisc(s);
  let v = 0;
  for (let d = s.n - 1; d >= 0; d--) v = v * 3 + of[d];
  return v;
}
export function stateOf(n: number, code: number): HState {
  const pegs: number[][] = [[], [], []];
  const of: number[] = [];
  for (let d = 0; d < n; d++) { of.push(code % 3); code = Math.floor(code / 3); }
  for (let d = n - 1; d >= 0; d--) pegs[of[d]].push(d);
  return { n, pegs };
}
export const allStates = (n: number): HState[] => Array.from({ length: 3 ** n }, (_, c) => stateOf(n, c));

/**
 * The shortest solution from ANY legal state to "all discs on `goal`": look at the largest disc that is not yet on the goal peg; the discs smaller than it must first go to the
 * third peg, then it moves, then the smaller ones follow onto the goal (the same rule inside). The discs larger than it are already on the goal and never move.
 */
export function solve(s: HState, goal = GOAL): HMove[] {
  const of = pegOfDisc(s), out: HMove[] = [];
  const go = (k: number, target: number): void => {
    if (k < 0) return;
    if (of[k] === target) { go(k - 1, target); return; }
    const other = 3 - of[k] - target;
    go(k - 1, other);
    out.push({ from: of[k], to: target, disc: k });
    of[k] = target;
    go(k - 1, target);
  };
  go(s.n - 1, goal);
  return out;
}
export const hint = (s: HState, goal = GOAL): HMove | null => solve(s, goal)[0] ?? null;
/** 3 stars = the fewest moves, 2 = at most 1.5 times that, otherwise 1 */
export function starsFor(moves: number, n: number): number {
  const m = minMoves(n);
  return moves <= m ? 3 : moves <= m * 1.5 ? 2 : 1;
}
