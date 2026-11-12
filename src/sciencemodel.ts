/**
 * Science, part 1: knowledge cards for fun, not for rote learning. A week of a child has 8 CARDS of his grade (src/data/science-cards.json: a question, the
 * right answer, three wrong ones, a short "did you know" sentence, a topic; the week has 2 cards each of nature, life, history and geography; primary school is general science literacy: matter, life, earth and space, technology, geography, history and culture, nature and
 * environment, health and safety; junior high: physics, chemistry, biology). For grade 9 the element-symbol cards made from the periodic table are added.
 * The ids of the week's cards are kept in `science/<kid>.json` (same shape as the words: `weeks[].chars`); results use the math game's review file
 * shape in `science/<kid>.review.json`. No screens, no storage.
 */
import type { KidData } from "./model";
import type { Q } from "./mathgen";

export interface Card { id: string; g: number; t: string; q: string; a: string; w: string[]; /** the "did you know" sentence shown after the answer */ e: string }
export interface Element { n: number; sym: string; en: string; zh: string; mass: number; cat: string; row: number; col: number; junior: boolean }
export interface Library { topics: Record<string, string>; domains: [string, string[]][]; cards: Card[]; byId: Map<string, Card>; elements: Element[] }

/** cards a week, and how many cards of last week join the game */
export const WEEKLY_CARDS = 8;
export const GAME_PREVIOUS = 6;
/** seconds per question: the total time of a game is this times the number of questions */
export const SEC_PER_QUESTION = 20;
export const sciencePath = (kidId: string): string => `science/${kidId}.json`;
export const scienceReviewPath = (kidId: string): string => `science/${kidId}.review.json`;

const shuffle = <T,>(l: readonly T[]): T[] => { const a = l.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/** the element cards of the junior-high chemistry course: symbol -> name and name -> symbol */
export function elementCards(elements: Element[]): Card[] {
  const jr = elements.filter((e) => e.junior);
  const out: Card[] = [];
  for (const e of jr) {
    const others = jr.filter((x) => x.n !== e.n);
    const pick = (f: (x: Element) => string) => shuffle(others).slice(0, 3).map(f);
    const fact = `${e.zh}（${e.en}）：原子序数 ${e.n}，相对原子质量约 ${e.mass}。`;
    out.push({ id: `el-name-${e.n}`, g: 9, t: "chem", q: `元素符号 ${e.sym} 表示的元素是？`, a: e.zh, w: pick((x) => x.zh), e: fact });
    out.push({ id: `el-sym-${e.n}`, g: 9, t: "chem", q: `${e.zh}的元素符号是？`, a: e.sym, w: pick((x) => x.sym), e: fact });
  }
  return out;
}

let cache: Library | null = null;
/** the library: part of the program (compiled in, works offline) */
export async function loadScience(): Promise<Library> {
  if (cache) return cache;
  const lib = (await import("./data/science-cards.json")).default as { topics: Record<string, string>; domains: Record<string, string[]>; cards: Card[] };
  const elements = (await import("./data/periodic.json")).default.elements as Element[];
  const cards = [...lib.cards, ...elementCards(elements)];
  cache = { topics: lib.topics, domains: Object.entries(lib.domains), cards, byId: new Map(cards.map((c) => [c.id, c])), elements };
  return cache;
}

/**
 * The cards of a new week for a child of `grade`: cards of his grade he has not had, 2 from each of the four fields (nature, life, history, geography),
 * inside a field one of each topic in turn; a field that has no new card left is made up from the other fields; when he has had them all, a new round
 * starts with the cards he got wrong, then the rest.
 */
export function pickCards(lib: Pick<Library, "cards" | "domains">, kid: KidData, grade: number, wrong: (id: string) => boolean = () => false, n = WEEKLY_CARDS): string[] {
  const list = lib.cards.filter((c) => c.g === grade);
  const used = new Set(kid.weeks.flatMap((w) => w.chars));
  const spread = (cards: Card[], k: number): string[] => {
    const groups = new Map<string, Card[]>();
    for (const c of cards) groups.set(c.t, [...(groups.get(c.t) ?? []), c]);
    const out: string[] = [];
    while (out.length < k && [...groups.values()].some((g) => g.length)) for (const g of groups.values()) { const c = g.shift(); if (c && out.length < k) out.push(c.id); }
    return out;
  };
  const fresh = list.filter((c) => !used.has(c.id));
  const quota = Math.floor(n / lib.domains.length);
  const out: string[] = [];
  for (const [, topics] of lib.domains) out.push(...spread(fresh.filter((c) => topics.includes(c.t)), quota));
  if (out.length < n) out.push(...spread(fresh.filter((c) => !out.includes(c.id)), n - out.length));
  if (out.length < n) {
    const rest = list.filter((c) => !out.includes(c.id));
    out.push(...spread([...rest.filter((c) => wrong(c.id)), ...rest.filter((c) => !wrong(c.id))], n - out.length));
  }
  return out;
}

/** a card as a game question (the four choices are shuffled; `chk` is not used for cards) */
export const cardToQ = (c: Card): Q => ({ topic: c.t, q: c.q, a: c.a, choices: shuffle([c.a, ...c.w]), chk: "true" });

/** the game: all of this week's cards + a few random ones of last week's (none = the first week) */
export function buildGame(lib: Library, thisWeek: string[], previous: string[]): { questions: Q[]; seconds: number } {
  const ids = [...thisWeek, ...shuffle(previous).slice(0, previous.length ? GAME_PREVIOUS : 0)];
  const questions = shuffle(ids.map((id) => lib.byId.get(id)).filter((c): c is Card => !!c)).map(cardToQ);
  return { questions, seconds: questions.length * SEC_PER_QUESTION };
}
