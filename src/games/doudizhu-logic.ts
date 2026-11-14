/**
 * Dou Dizhu (斗地主): the pure rules. 54 cards (id 0..51 = 13 ranks x 4 suits, 52 = small joker, 53 = big joker), 3 players (seat 0 = the human, 1 = right, 2 = left),
 * bidding, the combinations, the enumeration of legal plays, scoring and the computer players. No DOM, no timers: the random numbers are passed in.
 */
export type Rng = () => number;
export const SMALL_JOKER = 52, BIG_JOKER = 53;
/** rank value: 3..10 = 3..10, J 11, Q 12, K 13, A 14, 2 = 15, small joker 16, big joker 17 */
export const rankOf = (c: number): number => (c < 52 ? 3 + (c % 13) : 16 + (c - 52));
/** 0..3 = the four suits, 4 = joker */
export const suitOf = (c: number): number => (c < 52 ? Math.floor(c / 13) : 4);
export const RANK_LABEL: Record<number, string> = { 3: "3", 4: "4", 5: "5", 6: "6", 7: "7", 8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K", 14: "A", 15: "2", 16: "JK", 17: "JK" };

export type ComboType = "single" | "pair" | "triple" | "triple1" | "triple2" | "straight" | "pairs" | "plane" | "plane1" | "plane2" | "four2" | "four22" | "bomb" | "rocket";
/** `rank` = the deciding rank (lowest rank of a run), `len` = the number of ranks of a run (straight length, pairs, planes), `n` = number of cards */
export interface Combo { type: ComboType; rank: number; len: number; n: number }

export function mulberry(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const sortCards = (cs: number[]): number[] => cs.slice().sort((a, b) => rankOf(b) - rankOf(a) || a - b);

export function countsOf(cards: number[]): number[] {
  const c = new Array(18).fill(0);
  for (const x of cards) c[rankOf(x)]++;
  return c;
}
const isRun = (ranks: number[]): boolean => { for (let i = 1; i < ranks.length; i++) if (ranks[i] !== ranks[i - 1] + 1) return false; return true; };

/** what a set of cards is (a legal combination) or null. */
export function classify(cards: number[]): Combo | null {
  const n = cards.length;
  if (!n) return null;
  const cnt = countsOf(cards);
  const ranks: number[] = [];
  let maxc = 0;
  for (let r = 3; r <= 17; r++) if (cnt[r]) { ranks.push(r); maxc = Math.max(maxc, cnt[r]); }
  if (n === 2 && cnt[16] && cnt[17]) return { type: "rocket", rank: 17, len: 1, n };
  if (ranks.length === 1) {
    const r = ranks[0];
    if (n === 1) return { type: "single", rank: r, len: 1, n };
    if (n === 2) return { type: "pair", rank: r, len: 1, n };
    if (n === 3) return { type: "triple", rank: r, len: 1, n };
    if (n === 4) return { type: "bomb", rank: r, len: 1, n };
    return null;
  }
  if (n === 4 && maxc === 3) return { type: "triple1", rank: ranks.find((r) => cnt[r] === 3)!, len: 1, n };
  if (n === 5 && maxc === 3 && ranks.length === 2) return { type: "triple2", rank: ranks.find((r) => cnt[r] === 3)!, len: 1, n };
  const top = ranks[ranks.length - 1];
  if (n >= 5 && maxc === 1 && isRun(ranks) && top <= 14) return { type: "straight", rank: ranks[0], len: n, n };
  if (n >= 6 && n % 2 === 0 && maxc === 2 && ranks.length === n / 2 && isRun(ranks) && top <= 14) return { type: "pairs", rank: ranks[0], len: n / 2, n };
  const quad = ranks.find((r) => cnt[r] === 4);
  if (quad !== undefined) {
    if (n === 6 && !(cnt[16] && cnt[17])) return { type: "four2", rank: quad, len: 1, n };
    if (n === 8) {
      const rest = ranks.filter((r) => r !== quad);
      if (rest.length === 2 && rest.every((r) => cnt[r] === 2)) return { type: "four22", rank: quad, len: 1, n };
    }
  }
  for (let k = Math.floor(n / 3); k >= 2; k--) {
    for (let s = 3; s + k - 1 <= 14; s++) {
      let okRun = true;
      for (let r = s; r < s + k; r++) if (cnt[r] < 3) { okRun = false; break; }
      if (!okRun) continue;
      const left = cnt.slice();
      for (let r = s; r < s + k; r++) left[r] -= 3;
      const tot = n - 3 * k;
      if (tot === 0) return { type: "plane", rank: s, len: k, n };
      if (tot === k && !(left[16] && left[17])) return { type: "plane1", rank: s, len: k, n };
      if (tot === 2 * k) {
        let good = true;
        for (let r = 3; r <= 17; r++) if (left[r] !== 0 && left[r] !== 2) good = false;
        if (good) return { type: "plane2", rank: s, len: k, n };
      }
    }
  }
  return null;
}

/** does combination `a` beat `b` (the one on the table; null = free lead)? */
export function beats(a: Combo, b: Combo | null): boolean {
  if (!b) return true;
  if (a.type === "rocket") return true;
  if (b.type === "rocket") return false;
  if (a.type === "bomb") return b.type !== "bomb" || a.rank > b.rank;
  if (b.type === "bomb") return false;
  return a.type === b.type && a.len === b.len && a.n === b.n && a.rank > b.rank;
}

/** concrete cards of a rank-count vector, taken from a hand (lowest ids first) */
function cardsOf(byRank: number[][], need: number[]): number[] {
  const out: number[] = [];
  for (let r = 3; r <= 17; r++) for (let i = 0; i < need[r]; i++) out.push(byRank[r][i]);
  return out;
}
const groupByRank = (hand: number[]): number[][] => { const g: number[][] = Array.from({ length: 18 }, () => []); for (const c of hand) g[rankOf(c)].push(c); return g; };

/** all multisets of `k` singles out of the availability vector `avail`; `joker` pairs excluded; callback gets a vector */
function eachSingles(avail: number[], k: number, cb: (w: number[]) => void, lowOnly: boolean): void {
  const w = new Array(18).fill(0);
  if (lowOnly) {
    // the k "cheapest" cards: ranks with the fewest copies first, then the lowest rank
    const order: number[] = [];
    for (let r = 3; r <= 17; r++) if (avail[r] > 0) order.push(r);
    order.sort((a, b) => avail[a] - avail[b] || a - b);
    let left = k;
    for (const r of order) { if (!left) break; const t = Math.min(avail[r], left); w[r] = t; left -= t; }
    if (!left && !(w[16] && w[17])) cb(w);
    return;
  }
  const rec = (r: number, left: number): void => {
    if (left === 0) { if (!(w[16] && w[17])) cb(w.slice()); return; }
    if (r > 17) return;
    for (let t = Math.min(avail[r], left); t >= 0; t--) { w[r] = t; rec(r + 1, left - t); }
    w[r] = 0;
  };
  rec(3, k);
}
function eachPairs(avail: number[], k: number, cb: (w: number[]) => void, lowOnly: boolean): void {
  const ranks: number[] = [];
  for (let r = 3; r <= 17; r++) if (avail[r] >= 2) ranks.push(r);
  if (ranks.length < k) return;
  if (lowOnly) {
    ranks.sort((a, b) => avail[a] - avail[b] || a - b);
    const w = new Array(18).fill(0);
    for (let i = 0; i < k; i++) w[ranks[i]] = 2;
    cb(w);
    return;
  }
  const pick = (i: number, left: number, w: number[]): void => {
    if (left === 0) { cb(w.slice()); return; }
    if (ranks.length - i < left) return;
    w[ranks[i]] = 2; pick(i + 1, left - 1, w); w[ranks[i]] = 0; pick(i + 1, left, w);
  };
  pick(0, k, new Array(18).fill(0));
}

export interface PlaysOpts { lowWings?: boolean; only?: ComboType }
/**
 * Every legal play of `hand` against `table` (null = free lead): card id arrays, the lowest ids of each rank. `lowWings` keeps only the cheapest wing choice of every
 * core (what the computer and the hint use); without it every choice of wings is listed (used to check a play and in the tests).
 */
export function plays(hand: number[], table: Combo | null, opts: PlaysOpts = {}): number[][] {
  const by = groupByRank(hand);
  const cnt = countsOf(hand);
  const low = !!opts.lowWings;
  const out: number[][] = [];
  const seen = new Set<string>();
  const want = (t: ComboType): boolean => {
    if (opts.only && opts.only !== t) return false;
    if (!table) return true;
    if (table.type === "rocket") return false;
    if (table.type === "bomb") return t === "bomb" || t === "rocket";
    return t === table.type || t === "bomb" || t === "rocket";
  };
  const add = (need: number[]): void => {
    const key = need.join(",");
    if (seen.has(key)) return;
    seen.add(key);
    const cards = cardsOf(by, need);
    const cb = classify(cards);
    if (cb && beats(cb, table)) out.push(cards);
  };
  const v = (): number[] => new Array(18).fill(0);
  for (let r = 3; r <= 17; r++) {
    if (cnt[r] >= 1 && want("single")) { const n = v(); n[r] = 1; add(n); }
    if (cnt[r] >= 2 && r <= 15 && want("pair")) { const n = v(); n[r] = 2; add(n); }
    if (cnt[r] >= 3 && r <= 15 && want("triple")) { const n = v(); n[r] = 3; add(n); }
    if (cnt[r] === 4 && want("bomb")) { const n = v(); n[r] = 4; add(n); }
  }
  if (cnt[16] && cnt[17] && want("rocket")) { const n = v(); n[16] = 1; n[17] = 1; add(n); }
  // triple + wing
  for (let r = 3; r <= 15; r++) {
    if (cnt[r] < 3) continue;
    const avail = cnt.slice(); avail[r] -= 3;
    if (want("triple1")) {
      const order: number[] = [];
      for (let w = 3; w <= 17; w++) if (w !== r && avail[w] >= 1) order.push(w);
      if (low) order.sort((a, b) => avail[a] - avail[b] || a - b);
      for (const w of low ? order.slice(0, 1) : order) { const n = v(); n[r] = 3; n[w] = 1; add(n); }
    }
    if (want("triple2")) {
      const order: number[] = [];
      for (let w = 3; w <= 15; w++) if (w !== r && avail[w] >= 2) order.push(w);
      if (low) order.sort((a, b) => avail[a] - avail[b] || a - b);
      for (const w of low ? order.slice(0, 1) : order) { const n = v(); n[r] = 3; n[w] = 2; add(n); }
    }
  }
  // straights
  const wantRun = (t: ComboType, minLen: number, per: number): void => {
    if (!want(t)) return;
    for (let s = 3; s <= 14; s++) {
      for (let e = s; e <= 14; e++) {
        const len = e - s + 1;
        if (cnt[e] < per) break;
        if (len < minLen) continue;
        if (table && (table.type !== t || table.len !== len)) { if (!(table && (t === "bomb"))) continue; }
        const n = v();
        for (let r = s; r <= e; r++) n[r] = per;
        add(n);
      }
    }
  };
  wantRun("straight", 5, 1);
  wantRun("pairs", 3, 2);
  // planes
  const planeTypes: ComboType[] = ["plane", "plane1", "plane2"];
  if (planeTypes.some(want)) {
    for (let s = 3; s <= 14; s++) {
      for (let e = s + 1; e <= 14; e++) {
        if (cnt[e] < 3) break;
        const k = e - s + 1;
        if (table && planeTypes.includes(table.type) && table.len !== k) continue;
        if (table && !planeTypes.includes(table.type)) continue;
        const core = v();
        for (let r = s; r <= e; r++) core[r] = 3;
        const avail = cnt.slice();
        for (let r = s; r <= e; r++) avail[r] -= 3;
        if (want("plane")) add(core);
        if (want("plane1")) eachSingles(avail, k, (w) => { const n = core.slice(); for (let r = 3; r <= 17; r++) n[r] += w[r]; add(n); }, low);
        if (want("plane2")) eachPairs(avail, k, (w) => { const n = core.slice(); for (let r = 3; r <= 17; r++) n[r] += w[r]; add(n); }, low);
      }
    }
  }
  // four + wings
  for (let r = 3; r <= 15; r++) {
    if (cnt[r] !== 4) continue;
    const avail = cnt.slice(); avail[r] = 0;
    if (want("four2")) eachSingles(avail, 2, (w) => { const n = w.slice(); n[r] = 4; add(n); }, low);
    if (want("four22")) eachPairs(avail, 2, (w) => { const n = w.slice(); n[r] = 4; add(n); }, low);
  }
  return out;
}

// ---------------------------------------------------------------- the game
export interface Played { cards: number[]; combo: Combo }
export interface TableCards { by: number; combo: Combo; cards: number[] }
export interface DZState {
  hands: number[][]; bottom: number[]; phase: "bid" | "play" | "over";
  first: number; turn: number; bids: (number | null)[]; high: number; highBy: number;
  landlord: number; table: TableCards | null; passes: number;
  last: (Played | "pass" | null)[];
  bombs: number; plays: number[]; winner: number; spring: 0 | 1 | 2; moves: number;
}
export const NEXT = (seat: number): number => (seat + 1) % 3;

export function shuffled(rng: Rng): number[] {
  const d = Array.from({ length: 54 }, (_, i) => i);
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}
export function newDeal(rng: Rng, first = Math.floor(rng() * 3)): DZState {
  const d = shuffled(rng);
  return {
    hands: [sortCards(d.slice(0, 17)), sortCards(d.slice(17, 34)), sortCards(d.slice(34, 51))], bottom: sortCards(d.slice(51)), phase: "bid",
    first, turn: first, bids: [null, null, null], high: 0, highBy: -1, landlord: -1, table: null, passes: 0, last: [null, null, null],
    bombs: 0, plays: [0, 0, 0], winner: -1, spring: 0, moves: 0,
  };
}
export type BidResult = "ok" | "redeal" | "landlord" | "illegal";
export function canBid(s: DZState, seat: number, v: number): boolean {
  return s.phase === "bid" && seat === s.turn && (v === 0 || (v >= 1 && v <= 3 && v > s.high));
}
export function bid(s: DZState, seat: number, v: number): BidResult {
  if (!canBid(s, seat, v)) return "illegal";
  s.bids[seat] = v;
  if (v > 0) { s.high = v; s.highBy = seat; }
  const done = v === 3 || s.bids.every((b) => b !== null);
  if (!done) { s.turn = NEXT(seat); return "ok"; }
  if (s.high === 0) return "redeal";
  s.landlord = s.highBy;
  s.hands[s.landlord] = sortCards(s.hands[s.landlord].concat(s.bottom));
  s.phase = "play"; s.turn = s.landlord; s.table = null; s.passes = 0; s.last = [null, null, null];
  return "landlord";
}
export type PlayResult = { ok: true; combo: Combo; over: boolean } | { ok: false; why: "turn" | "cards" | "shape" | "weak" };
/** validates a play without changing anything */
export function checkPlay(s: DZState, seat: number, cards: number[]): PlayResult {
  if (s.phase !== "play" || seat !== s.turn) return { ok: false, why: "turn" };
  const mine = new Set(s.hands[seat]);
  const uniq = new Set(cards);
  if (!cards.length || uniq.size !== cards.length || cards.some((c) => !mine.has(c))) return { ok: false, why: "cards" };
  const combo = classify(cards);
  if (!combo) return { ok: false, why: "shape" };
  if (s.table && s.table.by !== seat && !beats(combo, s.table.combo)) return { ok: false, why: "weak" };
  return { ok: true, combo, over: cards.length === s.hands[seat].length };
}
export function play(s: DZState, seat: number, cards: number[]): PlayResult {
  const r = checkPlay(s, seat, cards);
  if (!r.ok) return r;
  if (!s.table) s.last = [null, null, null];
  const gone = new Set(cards);
  s.hands[seat] = s.hands[seat].filter((c) => !gone.has(c));
  const sorted = sortCards(cards);
  s.table = { by: seat, combo: r.combo, cards: sorted };
  s.last[seat] = { cards: sorted, combo: r.combo };
  s.passes = 0; s.plays[seat]++; s.moves++;
  if (r.combo.type === "bomb" || r.combo.type === "rocket") s.bombs++;
  if (!s.hands[seat].length) {
    s.phase = "over"; s.winner = seat;
    const l = s.landlord;
    if (seat === l) s.spring = s.plays[(l + 1) % 3] === 0 && s.plays[(l + 2) % 3] === 0 ? 1 : 0;
    else s.spring = s.plays[l] === 1 ? 2 : 0;
  } else s.turn = NEXT(seat);
  return r;
}
export function canPass(s: DZState, seat: number): boolean { return s.phase === "play" && seat === s.turn && !!s.table && s.table.by !== seat; }
export function pass(s: DZState, seat: number): boolean {
  if (!canPass(s, seat)) return false;
  s.passes++; s.moves++; s.last[seat] = "pass";
  if (s.passes >= 2) { s.table = null; s.passes = 0; }
  s.turn = NEXT(seat);
  return true;
}
/** multiplier: 2 per bomb / rocket, x2 for a spring or an anti-spring */
export const multiplier = (s: DZState): number => Math.pow(2, s.bombs) * (s.spring ? 2 : 1);
export const baseScore = (s: DZState): number => Math.max(1, s.high);
export const finalScore = (s: DZState): number => baseScore(s) * multiplier(s);
/** the landlord's side wins when the landlord went out */
export const landlordWon = (s: DZState): boolean => s.phase === "over" && s.winner === s.landlord;
export const sideWon = (s: DZState, seat: number): boolean => s.phase === "over" && (seat === s.landlord ? landlordWon(s) : !landlordWon(s));

// ---------------------------------------------------------------- the computer players
export type Level = 1 | 2 | 3;
/** a rough strength of a hand for bidding */
export function handStrength(hand: number[]): number {
  const cnt = countsOf(hand);
  let s = 0;
  s += cnt[15] * 1;
  if (cnt[16]) s += 1.5;
  if (cnt[17]) s += 2;
  if (cnt[16] && cnt[17]) s += 2;
  for (let r = 3; r <= 15; r++) if (cnt[r] === 4) s += 3;
  s += cnt[14] * 0.5;
  // long straights
  let run = 0, bestRun = 0;
  for (let r = 3; r <= 14; r++) { if (cnt[r]) { run++; bestRun = Math.max(bestRun, run); } else run = 0; }
  if (bestRun >= 7) s += 1;
  if (bestRun >= 9) s += 1;
  for (let r = 3; r <= 13; r++) if (cnt[r] >= 3 && cnt[r + 1] >= 3) { s += 1; break; }
  return s;
}
export function aiBid(hand: number[], high: number, level: Level, rng: Rng): number {
  const st = handStrength(hand) + (level === 1 ? (rng() - 0.5) * 4 : 0);
  const want = st >= 7 ? 3 : st >= 5 ? 2 : st >= 3.5 ? 1 : 0;
  return want > high ? want : 0;
}

function baseTurns(c: number[]): number {
  let triples = 0, pairs = 0, singles = 0;
  for (let r = 3; r <= 17; r++) { if (c[r] === 3) triples++; else if (c[r] === 2) pairs++; else if (c[r] === 1) singles++; }
  const lone = singles + pairs;
  return triples + lone - Math.min(triples, lone);
}
/** a quick upper estimate of the number of turns needed to play a hand out (bombs, rocket, runs and wings taken into account) */
export function estTurns(cnt: number[], depth = 0): number {
  const c = cnt.slice();
  let t = 0;
  if (c[16] && c[17]) { c[16] = c[17] = 0; t++; }
  for (let r = 3; r <= 15; r++) if (c[r] === 4) { c[r] = 0; t++; }
  let best = baseTurns(c);
  if (depth < 3) {
    for (const [per, minLen] of [[1, 5], [2, 3], [3, 2]] as const) {
      let r = 3;
      while (r <= 14) {
        if (c[r] < per) { r++; continue; }
        let e = r;
        while (e + 1 <= 14 && c[e + 1] >= per) e++;
        if (e - r + 1 >= minLen) {
          const d = c.slice();
          for (let x = r; x <= e; x++) d[x] -= per;
          best = Math.min(best, 1 + estTurns(d, depth + 1));
        }
        r = e + 1;
      }
    }
  }
  return t + best;
}
const without = (cnt: number[], cards: number[]): number[] => { const c = cnt.slice(); for (const x of cards) c[rankOf(x)]--; return c; };
const isBombLike = (cb: Combo): boolean => cb.type === "bomb" || cb.type === "rocket";
const cls = (cards: number[]): Combo => classify(cards)!;
const mate = (s: DZState, a: number, b: number): boolean => a !== s.landlord && b !== s.landlord && a !== b;

/** which cards the computer plays now (null = pass); the result is always legal */
export function aiPlay(s: DZState, seat: number, level: Level, rng: Rng): number[] | null {
  const hand = s.hands[seat];
  const cnt = countsOf(hand);
  const table = s.table && s.table.by !== seat ? s.table : null;
  const cands = plays(hand, table ? table.combo : null, { lowWings: true });
  const out = cands.find((c) => c.length === hand.length);
  if (out) return out;                                        // going out wins at once
  const opp = [0, 1, 2].filter((p) => p !== seat && !mate(s, seat, p));
  const oppMin = Math.min(...opp.map((p) => s.hands[p].length));
  if (!table) {
    // ---- a free lead
    let pool = cands;
    const calm = pool.filter((c) => !isBombLike(cls(c)));
    if (calm.length) pool = calm;
    if (level === 1) {
      const sorted = pool.slice().sort((a, b) => cls(a).rank - cls(b).rank);
      return sorted[Math.floor(rng() * Math.min(3, sorted.length))];
    }
    // do not lead singles into an opponent who has one card left
    if (opp.some((p) => s.hands[p].length === 1)) {
      const notSingle = pool.filter((c) => cls(c).type !== "single");
      if (notSingle.length) pool = notSingle;
      else return pool.slice().sort((a, b) => cls(b).rank - cls(a).rank)[0];
    }
    if (level === 2) {
      // never break a bomb, keep the big cards: the lowest rank first, longer plays first
      const keep = pool.filter((c) => { const cb = cls(c); return !c.some((x) => cnt[rankOf(x)] === 4 && cb.type !== "bomb") && !(cb.rank >= 15 && cb.n <= 2); });
      const use = keep.length ? keep : pool;
      return use.slice().sort((a, b) => cls(a).rank - cls(b).rank || b.length - a.length)[0];
    }
    let best: number[] = pool[0], bv = Infinity, br = Infinity;
    for (const c of pool) {
      const cb = cls(c);
      const v = estTurns(without(cnt, c)) + (cb.type === "single" || cb.type === "pair" ? 0.01 * cb.rank : 0);
      if (v < bv - 1e-9 || (Math.abs(v - bv) < 1e-9 && cb.rank < br)) { best = c; bv = v; br = cb.rank; }
    }
    return best;
  }
  // ---- following the table
  const byMate = mate(s, seat, table.by);
  if (byMate) return null;                                      // let the partner have it (going out was handled above)
  const calm = cands.filter((c) => !isBombLike(cls(c)));
  const bombs = cands.filter((c) => isBombLike(cls(c)));
  const tableSmall = oppMin;
  if (level === 1) {
    if (!calm.length || rng() < 0.45) return null;
    return calm.slice().sort((a, b) => cls(a).rank - cls(b).rank)[0];
  }
  const bombOk = (c: number[]): boolean => {
    if (level === 2) return tableSmall <= 2;
    const rest = without(cnt, c);
    return tableSmall <= 4 || estTurns(rest) <= 2;
  };
  if (calm.length) {
    let best: number[] = calm[0], bv = Infinity, br = Infinity;
    for (const c of calm) {
      const cb = cls(c);
      const v = level === 2 ? 0 : estTurns(without(cnt, c));
      if (v < bv - 1e-9 || (Math.abs(v - bv) < 1e-9 && cb.rank < br)) { best = c; bv = v; br = cb.rank; }
    }
    const cb = cls(best);
    if (level === 2) {
      const big = cb.rank >= 15 && cb.n <= 2;
      if (big && tableSmall > 4) return bombs.length && bombOk(bombs[0]) ? bombs[0] : null;
      return best;
    }
    const after = estTurns(without(cnt, best)), before = estTurns(cnt);
    if (after <= before || tableSmall <= 5) return best;
    return bombs.length && bombOk(bombs[0]) ? bombs[0] : null;
  }
  if (bombs.length) {
    const sorted = bombs.slice().sort((a, b) => cls(a).rank - cls(b).rank);
    const pick = sorted.find((c) => cls(c).type === "bomb") ?? sorted[0];
    if (bombOk(pick)) return pick;
  }
  return null;
}

/** what the hint shows: the smallest play that beats the table (a bomb only when nothing else does) or, on a free lead, what the computer would lead; `skip` cycles */
export function hintPlays(s: DZState, seat: number, rng: Rng): number[][] {
  const hand = s.hands[seat];
  const table = s.table && s.table.by !== seat ? s.table.combo : null;
  const all = plays(hand, table, { lowWings: true });
  const calm = all.filter((c) => !isBombLike(cls(c)));
  const list = (calm.length ? calm : all).slice().sort((a, b) => cls(a).rank - cls(b).rank || a.length - b.length);
  if (!table && list.length) {
    const lead = aiPlay(s, seat, 2, rng);
    if (lead) { const key = lead.join(","); return [lead].concat(list.filter((c) => c.join(",") !== key)); }
  }
  return list;
}
