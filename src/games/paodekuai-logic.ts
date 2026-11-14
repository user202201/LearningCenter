/**
 * 跑得快 (Run Fast): the rules, pure (no DOM). The common 3-player, 16-card version.
 *
 * DECK: 48 cards = a 52-card deck without the jokers, without the three 2s of diamonds / clubs / hearts and without the ace of spades (so three aces and ONE two, the 2 of spades).
 * A card is a number 0..51: `rank * 4 + suit`; ranks 0..12 = 3 4 5 6 7 8 9 10 J Q K A 2 (2 is the highest); suits 0 diamonds, 1 clubs, 2 hearts, 3 spades. Card 0 = the 3 of diamonds.
 * The holder of the 3 of diamonds leads and the first play must contain it.
 * COMBINATIONS: single, pair, straight (5 or more consecutive ranks, 3..A, no 2), pairs (2 or more consecutive pairs, 3..A), triple (3 + 2 any other cards;
 * 2 or more consecutive triples + 2 cards each = airplane; on the LAST play a hand may take fewer wing cards), bomb (four of a kind: beats everything except a bigger bomb).
 * A reply has the same type and the same number of cards and a higher rank (a short last play may be smaller); a player who can reply must (a bomb is always optional) -
 * otherwise passes. After two passes the player who played last leads again. When the next player has ONE card, a single card must be the highest single of the hand.
 * First to empty the hand wins. Score: every loser loses one point per card left (double when he never played a card); doubled once more when any bomb was played.
 */
export const RANK_LABELS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];
export const rankOf = (c: number): number => c >> 2;
export const suitOf = (c: number): number => c & 3;
export const LEAD_CARD = 0;
export const HAND = 16;
export type Rng = () => number;
export const mulberry = (seed: number): Rng => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

export type Type = "single" | "pair" | "straight" | "pairs" | "triple" | "bomb";
/** n cards; k = length of the run (straight: cards, pairs: pairs, triple: triples); rank = the highest rank of the run; short = a last play with fewer wing cards */
export interface Combo { type: Type; n: number; k: number; rank: number; short: boolean }
export interface Play { cards: number[]; combo: Combo }

export function makeDeck(): number[] {
  const d: number[] = [];
  for (let c = 0; c < 52; c++) {
    const r = rankOf(c), s = suitOf(c);
    if (r === 12 && s !== 3) continue;   // only the 2 of spades stays
    if (r === 11 && s === 3) continue;   // no ace of spades
    d.push(c);
  }
  return d;
}
export const sortCards = (a: number[]): number[] => a.slice().sort((x, y) => x - y);
export function shuffle<T>(a: T[], rng: Rng): T[] { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
export function rankCounts(cards: number[]): number[] { const c = new Array(13).fill(0); for (const x of cards) c[rankOf(x)]++; return c; }

/** every way a set of cards can be read as one combination (best first: more triples, higher rank); `last` = these are all the cards of the hand */
export function interpretations(cards: number[], last: boolean): Combo[] {
  const n = cards.length, cnt = rankCounts(cards), out: Combo[] = [];
  if (n === 0) return out;
  const ranks: number[] = []; for (let r = 0; r < 13; r++) if (cnt[r]) ranks.push(r);
  const consecutive = (rs: number[]) => rs.every((r, i) => i === 0 || r === rs[i - 1] + 1);
  if (n === 1) out.push({ type: "single", n, k: 1, rank: ranks[0], short: false });
  if (n === 2 && ranks.length === 1) out.push({ type: "pair", n, k: 1, rank: ranks[0], short: false });
  if (n === 4 && ranks.length === 1) out.push({ type: "bomb", n, k: 1, rank: ranks[0], short: false });
  if (n >= 5 && ranks.length === n && consecutive(ranks) && ranks[n - 1] <= 11) out.push({ type: "straight", n, k: n, rank: ranks[n - 1], short: false });
  if (n >= 4 && n % 2 === 0 && ranks.length === n / 2 && ranks.every((r) => cnt[r] === 2) && consecutive(ranks) && ranks[ranks.length - 1] <= 11) out.push({ type: "pairs", n, k: n / 2, rank: ranks[ranks.length - 1], short: false });
  const tri: Combo[] = [];
  for (let k = Math.ceil(n / 5); k <= Math.floor(n / 3); k++) {
    if (!last && n !== 5 * k) continue;
    for (let s = 0; s + k - 1 <= 11; s++) {
      let okRun = true;
      for (let r = s; r < s + k; r++) if (cnt[r] !== 3) { okRun = false; break; }
      if (okRun) tri.push({ type: "triple", n, k, rank: s + k - 1, short: n < 5 * k });
    }
  }
  tri.sort((a, b) => b.k - a.k || b.rank - a.rank);
  return out.concat(tri);
}
export function classify(cards: number[], last: boolean): Combo | null { return interpretations(cards, last)[0] ?? null; }

/** does `c` beat the combination on the table? */
export function beatsCombo(prev: Combo, c: Combo): boolean {
  if (c.type === "bomb") return prev.type !== "bomb" || c.rank > prev.rank;
  if (prev.type === "bomb" || prev.type !== c.type || prev.k !== c.k || c.rank <= prev.rank) return false;
  return c.n === prev.n || (c.short && c.n < prev.n);
}

// ---------- the list of plays of a hand ----------
function multisets(rem: number[], w: number): number[][] {
  const res: number[][] = [], cur: number[] = [];
  const rec = (r: number, left: number) => {
    if (left === 0) { res.push(cur.slice()); return; }
    if (r >= 13) return;
    for (let t = Math.min(left, rem[r]); t >= 0; t--) {
      for (let i = 0; i < t; i++) cur.push(r);
      rec(r + 1, left - t);
      for (let i = 0; i < t; i++) cur.pop();
    }
  };
  rec(0, w);
  return res;
}
/** all rank multisets (sorted arrays of ranks) that could be a combination from a hand with these counts; `N` = the hand size (decides the short last plays) */
function rankSets(cnt: number[], N: number): number[][] {
  const out: number[][] = [], seen = new Set<string>();
  const add = (rs: number[]) => { rs.sort((a, b) => a - b); const k = rs.join(","); if (!seen.has(k)) { seen.add(k); out.push(rs); } };
  for (let r = 0; r < 13; r++) {
    if (cnt[r] >= 1) add([r]);
    if (cnt[r] >= 2) add([r, r]);
    if (cnt[r] === 4) add([r, r, r, r]);
  }
  for (let s = 0; s <= 11; s++) {
    for (let e = s; e <= 11 && cnt[e] >= 1; e++) if (e - s + 1 >= 5) { const rs: number[] = []; for (let r = s; r <= e; r++) rs.push(r); add(rs); }
    for (let e = s; e <= 11 && cnt[e] >= 2; e++) if (e - s + 1 >= 2) { const rs: number[] = []; for (let r = s; r <= e; r++) rs.push(r, r); add(rs); }
  }
  for (let k = 1; 3 * k <= N; k++) {
    for (let s = 0; s + k - 1 <= 11; s++) {
      let run = true;   // a rank held four times gives three cards to the run; the fourth can not be a wing (see interpretations)
      for (let r = s; r < s + k; r++) if (cnt[r] < 3) { run = false; break; }
      if (!run) continue;
      const base: number[] = []; for (let r = s; r < s + k; r++) base.push(r, r, r);
      const rem = cnt.slice(); for (let r = s; r < s + k; r++) rem[r] = 0;   // wings never come from a run rank
      const wl = new Set<number>(); if (N >= 5 * k) wl.add(2 * k); if (N >= 3 * k && N < 5 * k) wl.add(N - 3 * k);
      for (const w of wl) for (const m of multisets(rem, w)) add(base.concat(m));
    }
  }
  return out;
}
/** real cards for a rank multiset; `must` (a card id) is taken first when its rank is used */
function realize(hand: number[], ranks: number[], must: number | null): number[] {
  const by: number[][] = Array.from({ length: 13 }, () => []);
  for (const c of hand) by[rankOf(c)].push(c);
  if (must !== null) { const r = rankOf(must), i = by[r].indexOf(must); if (i > 0) { by[r].splice(i, 1); by[r].unshift(must); } }
  const use = new Array(13).fill(0), out: number[] = [];
  for (const r of ranks) out.push(by[r][use[r]++]);
  return out;
}

export interface PlayOpts { prev?: Combo | null; must?: number | null; nextOne?: boolean }
/** every legal play of `hand` (one per distinct rank multiset, with the first card of each rank taken; `must` first) */
export function enumeratePlays(hand: number[], o: PlayOpts = {}): Play[] {
  const N = hand.length, cnt = rankCounts(hand), res: Play[] = [];
  const maxRank = hand.reduce((m, c) => Math.max(m, rankOf(c)), -1);
  const must = o.must ?? null;
  for (const rs of rankSets(cnt, N)) {
    const cards = realize(hand, rs, must);
    if (must !== null && !cards.includes(must)) continue;
    const ints = interpretations(cards, cards.length === N);
    const combo = o.prev ? ints.find((c) => beatsCombo(o.prev as Combo, c)) : ints[0];
    if (!combo) continue;
    if (o.nextOne && combo.type === "single" && combo.rank !== maxRank) continue;
    res.push({ cards, combo });
  }
  return res;
}

// ---------- the game ----------
export type Shown = null | "pass" | Play;
export interface Game {
  hands: number[][]; turn: number; table: { player: number; cards: number[]; combo: Combo } | null; passes: number;
  plays: number[]; bombs: number; winner: number; firstPlay: boolean; shown: Shown[]; started: number;
}
export function newGame(rng: Rng): Game {
  const d = shuffle(makeDeck(), rng), hands = [0, 1, 2].map((i) => sortCards(d.slice(i * HAND, (i + 1) * HAND)));
  const turn = hands.findIndex((h) => h.includes(LEAD_CARD));
  return { hands, turn, table: null, passes: 0, plays: [0, 0, 0], bombs: 0, winner: -1, firstPlay: true, shown: [null, null, null], started: turn };
}
export const nextOf = (p: number): number => (p + 1) % 3;
const optsOf = (g: Game, p: number): PlayOpts => ({ prev: g.table?.combo ?? null, must: g.firstPlay ? LEAD_CARD : null, nextOne: g.hands[nextOf(p)].length === 1 });
export function legalPlays(g: Game, p: number): Play[] { return g.winner >= 0 ? [] : enumeratePlays(g.hands[p], optsOf(g, p)); }
/** may this player pass now? (not when leading, and not when a reply other than a bomb exists) */
export function canPass(g: Game, p: number): boolean {
  if (g.winner >= 0 || p !== g.turn || !g.table) return false;
  return !legalPlays(g, p).some((pl) => pl.combo.type !== "bomb");
}
export type Why = "over" | "turn" | "invalid" | "first" | "cannotbeat" | "biggest";
export function check(g: Game, p: number, cards: number[]): { ok: true; combo: Combo } | { ok: false; why: Why } {
  if (g.winner >= 0) return { ok: false, why: "over" };
  if (p !== g.turn) return { ok: false, why: "turn" };
  const hand = g.hands[p];
  if (cards.length === 0 || new Set(cards).size !== cards.length || cards.some((c) => !hand.includes(c))) return { ok: false, why: "invalid" };
  const ints = interpretations(cards, cards.length === hand.length);
  if (!ints.length) return { ok: false, why: "invalid" };
  if (g.firstPlay && !cards.includes(LEAD_CARD)) return { ok: false, why: "first" };
  let pool = ints;
  if (g.table) { const t = g.table.combo; pool = ints.filter((c) => beatsCombo(t, c)); if (!pool.length) return { ok: false, why: "cannotbeat" }; }
  if (g.hands[nextOf(p)].length === 1) {
    const maxRank = hand.reduce((m, c) => Math.max(m, rankOf(c)), -1);
    pool = pool.filter((c) => c.type !== "single" || c.rank === maxRank);
    if (!pool.length) return { ok: false, why: "biggest" };
  }
  return { ok: true, combo: pool[0] };
}
export function play(g: Game, p: number, cards: number[]): { ok: boolean; why?: Why; combo?: Combo } {
  const r = check(g, p, cards);
  if (!r.ok) return r;
  g.hands[p] = g.hands[p].filter((c) => !cards.includes(c));
  const pl: Play = { cards: sortCards(cards), combo: r.combo };
  g.table = { player: p, cards: pl.cards, combo: r.combo };
  g.shown[p] = pl; g.passes = 0; g.plays[p]++; g.firstPlay = false;
  if (r.combo.type === "bomb") g.bombs++;
  if (g.hands[p].length === 0) g.winner = p; else g.turn = nextOf(p);
  return { ok: true, combo: r.combo };
}
export function pass(g: Game, p: number): boolean {
  if (!canPass(g, p)) return false;
  g.shown[p] = "pass"; g.passes++;
  g.turn = nextOf(p);
  if (g.passes >= 2) { g.table = null; g.passes = 0; g.shown = [null, null, null]; }
  return true;
}
/** points of a finished game for the three players */
export function scoreGame(g: Game): number[] {
  const f = g.bombs > 0 ? 2 : 1, d = [0, 0, 0];
  for (let i = 0; i < 3; i++) if (i !== g.winner) { const loss = g.hands[i].length * (g.plays[i] === 0 ? 2 : 1) * f; d[i] = -loss; d[g.winner] += loss; }
  return d;
}

// ---------- the computer player ----------
export type Level = 0 | 1 | 2;
/** a rough number of plays needed to get rid of these cards (fewer is better) */
export function planCount(cards: number[]): number {
  const cnt = rankCounts(cards); let m = 0;
  for (let r = 0; r < 13; r++) if (cnt[r] === 4) { m++; cnt[r] = 0; }
  const runs = (min: number, len: number, take: number) => {
    for (;;) {
      let best: [number, number] | null = null;
      for (let s = 0; s <= 11; s++) { let e = s; while (e <= 11 && cnt[e] === min) e++; if (e - s >= len && (!best || e - s > best[1] - best[0])) best = [s, e]; }
      if (!best) return;
      for (let r = best[0]; r < best[1]; r++) cnt[r] -= take;
      m++;
    }
  };
  runs(2, 3, 2); runs(1, 5, 1);
  let singles = 0, pairs = 0, triples = 0;
  for (let r = 0; r < 13; r++) { if (cnt[r] === 1) singles++; else if (cnt[r] === 2) pairs++; else if (cnt[r] === 3) triples++; }
  const loose = singles + pairs;
  return m + triples + Math.max(0, loose - 2 * triples);
}
const rest = (hand: number[], cards: number[]): number[] => hand.filter((c) => !cards.includes(c));
/** the move of the computer: cards to play, or null = pass */
export function aiChoose(g: Game, p: number, level: Level, rng: Rng): number[] | null {
  const hand = g.hands[p], plays = legalPlays(g, p);
  const lead = !g.table;
  if (!plays.length) return null;
  const finish = plays.find((pl) => pl.cards.length === hand.length);
  if (finish && level > 0) return finish.cards;
  const opp = [nextOf(p), nextOf(nextOf(p))].map((i) => g.hands[i].length);
  const minOpp = Math.min(...opp);
  const nonBomb = plays.filter((pl) => pl.combo.type !== "bomb");
  if (level === 0) {
    if (lead) { const pool = nonBomb.length ? nonBomb : plays; return pool[Math.floor(rng() * pool.length)].cards; }
    if (nonBomb.length) return rng() < 0.15 && canPass(g, p) ? null : nonBomb[Math.floor(rng() * nonBomb.length)].cards;
    return rng() < 0.5 ? null : plays[Math.floor(rng() * plays.length)].cards;
  }
  const cost = (pl: Play): number => {
    const left = rest(hand, pl.cards), pc = planCount(left);
    const high = pl.combo.rank >= 11 ? 3 : 0;   // keep aces and the two for later
    return level === 2 ? pc * 100 + pl.combo.rank * 4 - pl.combo.n * 3 + high : pl.combo.rank * 4 - pl.combo.n * 3 + high;
  };
  if (lead) {
    let pool = nonBomb.length ? nonBomb : plays;
    if (level === 2 && minOpp <= 2) {   // an opponent is nearly out: lead what he can not easily answer, big groups first
      const multi = pool.filter((pl) => pl.combo.n >= 2 && !(minOpp === 2 && pl.combo.type === "pair"));
      if (multi.length) pool = multi;
    }
    return pool.slice().sort((a, b) => cost(a) - cost(b))[0].cards;
  }
  const owner = g.table!.player, ownerLeft = g.hands[owner].length;
  if (nonBomb.length) {
    const pick = nonBomb.slice().sort((a, b) => cost(a) - cost(b))[0];
    return pick.cards;
  }
  const bombs = plays.filter((pl) => pl.combo.type === "bomb").sort((a, b) => a.combo.rank - b.combo.rank);
  const useBomb = bombs.length && (ownerLeft <= 3 || (level === 2 && planCount(rest(hand, bombs[0].cards)) <= 2) || (level === 1 && ownerLeft <= 4));
  return useBomb ? bombs[0].cards : null;
}
