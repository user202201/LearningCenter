/**
 * PK, the rules of a face-to-face game for two players (pure: no DOM, no clock of its own, no randomness except the seeded one in the item makers).
 * The game is two lists of items { prompt, choices, answers }, one per side (each child plays with his OWN characters): in round n side 0 sees item n of the first
 * list and side 1 item n of the second; the first player who taps a RIGHT choice of his own item wins the round. The time is passed in (`advance(state, now)` / `tap(state, side, index, at)`, milliseconds on any one clock), so the rules can
 * be played in a test without waiting. The first subject that makes items is the Chinese pinyin quiz (`pk-chinese.ts`); other subjects can reuse everything here.
 *
 * Phases: countdown (3, 2, 1, GO) -> intro (both names) -> for every round: prep (the round is announced, nothing can be tapped) -> question -> result -> ... -> final.
 * Side 0 is player 1, side 1 is player 2.
 */
export interface Item { prompt: string; choices: string[]; answers: number[] }
export interface Config { rounds: number; stepMs: number; goMs: number; introMs: number; prepMs: number; limitMs: number; resultMs: number; stealMs: number }
export const DEFAULTS: Config = { rounds: 10, stepMs: 1000, goMs: 700, introMs: 1500, prepMs: 900, limitMs: 12000, resultMs: 1400, stealMs: 100 };
export type Phase = "countdown" | "intro" | "prep" | "question" | "result" | "final";
export type Side = 0 | 1;
export type Outcome = "win" | "lose" | "tie";

export interface State {
  cfg: Config;
  /** the items of side 0 and of side 1 (one per round each) */
  items: [Item[], Item[]];
  /** number of rounds really played: min(cfg.rounds, length of the shorter list) */
  total: number;
  phase: Phase;
  phaseStart: number;
  /** when the phase ends by itself (Infinity in the final) */
  phaseEnd: number;
  /** the countdown number: 3, 2, 1, then 0 = GO */
  count: number;
  round: number;
  scores: [number, number];
  /** a side that tapped a wrong choice in this round cannot tap again in it */
  locked: [boolean, boolean];
  /** the wrong choice each side tapped in this round (-1 = none) */
  wrongPick: [number, number];
  /** winner of the round that is shown (-1 = nobody) */
  winner: -1 | 0 | 1;
  winAt: number;
  questionStart: number;
  /** the newest time the state has seen */
  now: number;
  /** winners of the rounds that are over */
  results: (-1 | 0 | 1)[];
  /** only in the final: how it went for side 0 and side 1 */
  outcome: [Outcome, Outcome] | null;
  /** "play again" pressed by each side (in the final) */
  again: [boolean, boolean];
}

export type TapEvent =
  | { type: "ignored"; why: "phase" | "early" | "locked" | "index" | "late" }
  | { type: "wrong"; side: Side; both: boolean }
  | { type: "win"; side: Side }
  | { type: "steal"; side: Side };

/** a small seeded random generator (mulberry32); the same seed gives the same sequence */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** a shuffled copy (Fisher-Yates) with the given random function */
export function shuffled<T>(a: readonly T[], rnd: () => number): T[] {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

export function create(items: [Item[], Item[]], start = 0, cfg: Partial<Config> = {}): State {
  const c = { ...DEFAULTS, ...cfg };
  return {
    cfg: c, items, total: Math.min(c.rounds, items[0].length, items[1].length), phase: "countdown", phaseStart: start, phaseEnd: start + c.stepMs, count: 3,
    round: 0, scores: [0, 0], locked: [false, false], wrongPick: [-1, -1], winner: -1, winAt: 0, questionStart: 0, now: start, results: [], outcome: null, again: [false, false],
  };
}

const startPrep = (s: State, t: number) => {
  s.phase = "prep"; s.phaseStart = t; s.phaseEnd = t + s.cfg.prepMs;
  s.locked = [false, false]; s.wrongPick = [-1, -1]; s.winner = -1; s.winAt = 0;
};
const toResult = (s: State, t: number, winner: -1 | 0 | 1) => {
  s.phase = "result"; s.phaseStart = t; s.phaseEnd = t + s.cfg.resultMs; s.winner = winner; s.results[s.round] = winner;
};
const toFinal = (s: State, t: number) => {
  s.phase = "final"; s.phaseStart = t; s.phaseEnd = Infinity;
  const [a, b] = s.scores;
  s.outcome = a === b ? ["tie", "tie"] : a > b ? ["win", "lose"] : ["lose", "win"];
};

/** moves the clock to `now`: every phase that has ended by then is left (in order, at its exact end time) */
export function advance(s: State, now: number): void {
  if (now > s.now) s.now = now;
  while (s.phase !== "final" && now >= s.phaseEnd) {
    const t = s.phaseEnd;
    if (s.phase === "countdown") {
      if (s.count > 0) { s.count--; s.phaseStart = t; s.phaseEnd = t + (s.count === 0 ? s.cfg.goMs : s.cfg.stepMs); }
      else { s.phase = "intro"; s.phaseStart = t; s.phaseEnd = t + s.cfg.introMs; }
    } else if (s.phase === "intro") {
      if (s.total === 0) toFinal(s, t); else startPrep(s, t);
    } else if (s.phase === "prep") {
      s.phase = "question"; s.phaseStart = t; s.questionStart = t; s.phaseEnd = t + s.cfg.limitMs;
    } else if (s.phase === "question") {
      toResult(s, t, -1);   // time is up: nobody scores
    } else if (s.phase === "result") {
      if (s.round + 1 < s.total) { s.round++; startPrep(s, t); } else toFinal(s, t);
    }
  }
}

/** the item of `side` in the round that is on (the last one in the final) */
export const current = (s: State, side: Side): Item => s.items[side][Math.min(s.round, Math.max(0, s.total - 1))];

/**
 * A tap of `side` on choice `index`, made at time `at` (the time of the touch, which may be a little earlier than the newest time the state has seen).
 * The first RIGHT tap wins the round. A wrong tap locks that side for the rest of the round. A tap before the question is shown does nothing.
 * Two taps at the very same time: the one that arrives first wins. A right tap that arrives just after the other side's win but carries an EARLIER time
 * (at most `stealMs` before it) takes the win: the touch screen may report two near-simultaneous fingers in the wrong order.
 */
export function tap(s: State, side: Side, index: number, at: number): TapEvent {
  if (at > s.now) advance(s, at);
  const item = current(s, side);
  if (!item || !Number.isInteger(index) || index < 0 || index >= item.choices.length) return { type: "ignored", why: "index" };
  const right = item.answers.includes(index);
  if (s.phase === "result") {
    // the other side won by a hair: an earlier right tap takes the win
    if (right && s.winner === (1 - side) && !s.locked[side] && at < s.winAt && s.winAt - at <= s.cfg.stealMs && at >= s.questionStart) {
      s.scores[1 - side]--; s.scores[side]++; s.winner = side; s.winAt = at; s.results[s.round] = side;
      return { type: "steal", side };
    }
    return { type: "ignored", why: "phase" };
  }
  if (s.phase !== "question") return { type: "ignored", why: "phase" };
  if (at < s.questionStart) return { type: "ignored", why: "early" };
  if (s.locked[side]) return { type: "ignored", why: "locked" };
  if (right) {
    s.scores[side]++; s.winAt = at;
    toResult(s, Math.max(at, s.now), side);
    return { type: "win", side };
  }
  s.locked[side] = true; s.wrongPick[side] = index;
  const both = s.locked[0] && s.locked[1];
  if (both) toResult(s, Math.max(at, s.now), -1);
  return { type: "wrong", side, both };
}

/** a side presses "play again"; true when both sides have */
export function pressAgain(s: State, side: Side): boolean {
  if (s.phase === "final") s.again[side] = true;
  return s.again[0] && s.again[1];
}

/** how it ended for each side (null until the final) */
export const outcomeOf = (s: State, side: Side): Outcome | null => (s.outcome ? s.outcome[side] : null);
/** a copy of what a screen / test may look at (no items) */
export function snapshot(s: State) {
  return { phase: s.phase, round: s.round, total: s.total, count: s.count, scores: [...s.scores] as [number, number], locked: [...s.locked] as [boolean, boolean], wrongPick: [...s.wrongPick] as [number, number], winner: s.winner, results: [...s.results], outcome: s.outcome ? ([...s.outcome] as [Outcome, Outcome]) : null, again: [...s.again] as [boolean, boolean], phaseStart: s.phaseStart, phaseEnd: s.phaseEnd, questionStart: s.questionStart };
}
