/**
 * Science, part 1: knowledge cards for fun, not for rote learning, and NEW EVERY DAY. A day of a child has 6 NEW cards (src/data/science-cards.json: a question,
 * the right answer, three wrong ones, a short "did you know" sentence, a topic; the four fields nature / life / history / geography take turns so that a week is
 * balanced). The grade is the child's HIGHEST level: about 70 % of the new cards are for his grade, the rest comes from the lower grades (consolidation).
 * Cards he has seen come back by the memory curve (the game's boxes: asked again after 1, 3, 7, 14, 30 days; a wrong answer comes back the next day) and
 * can be looked at again in "Recorded". The ids of a day's cards are kept in `science/<kid>.json` (same shape as the words: `weeks[].chars`, here with the
 * DATE of the day as `start`); boxes and results in `science/<kid>.review.json`. No screens, no storage.
 */
import type { KidData } from "./model";
import type { Q } from "./mathgen";
import * as G from "./game";
import * as MM from "./mathmodel";

export interface Card { id: string; g: number; /** the highest grade the card is for (a card can serve several grades) */ gx?: number; t: string; q: string; a: string; w: string[]; /** the "did you know" sentence shown after the answer */ e: string }
export interface Element { n: number; sym: string; en: string; zh: string; mass: number; cat: string; row: number; col: number; junior: boolean }
export interface Library { topics: Record<string, string>; domains: [string, string[]][]; cards: Card[]; byId: Map<string, Card>; elements: Element[] }

/** new cards a day; how many old cards at most come back in a game; the share of the new cards that is of the LOWER grades */
export const NEW_PER_DAY = 6;
export const REVIEW_MAX = 10;
export const LOWER_SHARE = 0.3;
export const sciencePath = (kidId: string): string => `science/${kidId}.json`;
export const scienceReviewPath = (kidId: string): string => `science/${kidId}.review.json`;
/** the results file: the math game's results + the boxes of the cards */
export interface ScienceReview extends MM.MathReview { cards?: Record<string, G.Card> }

const shuffle = <T,>(l: readonly T[]): T[] => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

let cache: Library | null = null;
/** the library: part of the program (compiled in, works offline) */
export async function loadScience(): Promise<Library> {
  if (cache) return cache;
  const lib = (await import("./data/science-cards.json")).default as unknown as { topics: Record<string, string>; domains: Record<string, string[]>; cards: Card[] };
  const elements = (await import("./data/periodic.json")).default.elements as Element[];
  cache = { topics: lib.topics, domains: Object.entries(lib.domains), cards: lib.cards, byId: new Map(lib.cards.map((c) => [c.id, c])), elements };
  return cache;
}

/** a small seeded random generator (so that the order of the cards is different for every child but does not change from one run to the next) */
function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** is the card made for this grade? */
export const inGrade = (c: Card, grade: number): boolean => c.g <= grade && grade <= (c.gx ?? c.g);
/** is the card of a grade the child has already outgrown (its highest grade is below his)? */
export const isLower = (c: Card, grade: number): boolean => (c.gx ?? c.g) < grade;

/**
 * The new cards of a day for a child whose highest level is `grade`: never a card he had; 6 cards, the four fields taking turns (one each, and two more
 * fields chosen by the day), about 30 % of them of the lower grades, one topic after the other inside a field. When he has had everything that exists for him
 * (a long time) a new round starts with the cards he got wrong. `day` is the date (YYYY-MM-DD).
 */
export function pickDaily(lib: Pick<Library, "cards" | "domains">, kid: KidData, grade: number, day: string, wrong: (id: string) => boolean = () => false, seed = "", n = NEW_PER_DAY): string[] {
  const rnd = seeded(`${seed}:${grade}:${day}`);
  const mix = <T,>(l: T[]): T[] => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const used = new Set(kid.weeks.flatMap((w) => w.chars));
  const fresh = lib.cards.filter((c) => !used.has(c.id) && (inGrade(c, grade) || isLower(c, grade)));
  const own = mix(fresh.filter((c) => inGrade(c, grade)));
  const lower = mix(fresh.filter((c) => isLower(c, grade)));
  const dayNo = Math.floor(Date.parse(`${day}T00:00:00Z`) / 86400000) || 0;
  const k = lib.domains.length;
  const quota = lib.domains.map((_, i) => 1 + (i === dayNo % k ? 1 : 0) + (i === (dayNo + 1) % k ? 1 : 0)).slice(0, k);
  const out: Card[] = [];
  const picked = new Set<string>(), topics = new Set<string>();
  const take = (pool: Card[], domainTopics: string[] | null): Card | undefined => {
    const ok = (c: Card) => !picked.has(c.id) && (!domainTopics || domainTopics.includes(c.t));
    return pool.find((c) => ok(c) && !topics.has(c.t)) ?? pool.find(ok);
  };
  const push = (c: Card | undefined) => { if (c) { out.push(c); picked.add(c.id); topics.add(c.t); } };
  for (let i = 0; i < k && out.length < n; i++) {
    const dt = lib.domains[i][1];
    for (let j = 0; j < quota[i] && out.length < n; j++) {
      const wantLower = grade > 1 && rnd() < LOWER_SHARE;
      push(take(wantLower ? lower : own, dt) ?? take(wantLower ? own : lower, dt));
    }
  }
  while (out.length < n) {                                   // a field had nothing new left: the others make up the day
    const c = take(rnd() < LOWER_SHARE ? lower : own, null) ?? take(own, null) ?? take(lower, null);
    if (!c) break;
    push(c);
  }
  if (out.length < n) {                                      // everything was had: a new round, the cards he got wrong first
    const old = lib.cards.filter((c) => used.has(c.id) && (inGrade(c, grade) || isLower(c, grade)) && !picked.has(c.id));
    const rest = [...mix(old.filter((c) => wrong(c.id))), ...mix(old.filter((c) => !wrong(c.id)))];
    for (const c of rest) { if (out.length >= n) break; push(c); }
  }
  return out.map((c) => c.id);
}

/** a card as a game question (the four choices are shuffled; `chk` is not used for cards) */
export const cardToQ = (c: Card): Q => ({ topic: c.t, q: c.q, a: c.a, choices: shuffle([c.a, ...c.w]), chk: "true" });

/** the cards that come back today by the memory curve (due first, the ones he got wrong first; then cards of earlier days never asked, the newest first) */
export function reviewIds(kid: KidData, review: ScienceReview, today: string, max = REVIEW_MAX): string[] {
  return G.pickReview(kid, { cards: review.cards ?? {} }, today, today, max).map((q) => q.ch);
}

/** the game of the day: today's new cards + the old ones that are due; `fresh` is how many of them are new */
export function buildGame(lib: Library, kid: KidData, review: ScienceReview, today: string): { questions: Q[]; fresh: number; again: number } {
  const todayIds = kid.weeks.find((w) => w.start === today)?.chars ?? [];
  const again = reviewIds(kid, review, today).filter((id) => !todayIds.includes(id));
  const pick = (ids: string[]) => ids.map((id) => lib.byId.get(id)).filter((c): c is Card => !!c);
  const cards = pick([...todayIds, ...again]);
  return { questions: shuffle(cards).map(cardToQ), fresh: pick(todayIds).length, again: pick(again).length };
}

/** adds the answers of a game: the counts and the errors book (math results) and the memory boxes of the cards (right = one box up, wrong = asked again tomorrow) */
export function applyScience(r: ScienceReview, answers: MM.Answer[], byQ: Map<string, Card>, today: string, summary?: { score: number; total: number; seconds: number }): ScienceReview {
  const base = MM.applyMath(r, answers, today, summary) as ScienceReview;
  const cards = { ...(r.cards ?? {}) };
  for (const a of answers) {
    const id = a.q ? byQ.get(a.q.q)?.id : undefined;
    if (id) cards[id] = G.applyOutcome(cards[id], a.right, false, today);
  }
  return { ...base, cards };
}
