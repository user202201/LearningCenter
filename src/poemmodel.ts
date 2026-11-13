/**
 * Classical poems (古诗词), no screens, no storage. The library `src/data/poems.json` (poems / 词 / 曲 / short classical prose of the required reading of
 * primary school and junior high, written from memory: to be proofread by a teacher) is part of the program. A child gets ONE new poem a day
 * (`POEMS_PER_DAY`; "learn one more" adds more), seeded by child + day, never one he had; the grade is his HIGHEST level, so about 30 % of the new poems are of
 * lower grades. The ids of a day's poems are kept in `poems/<kid>.json` (same shape as the words: `weeks[].chars`, `start` = the DATE of the day); the memory
 * boxes (game.ts: asked again after 1 / 3 / 7 / 14 / 30 days) are in `poems/<kid>.review.json`. Old poems come back (at most `REVIEW_MAX` a day).
 * The practice questions are made on the spot by pure, seeded generators (`makeRound`): the right answer is always among the choices and no wrong choice
 * is also right (checked by the generator itself and by the tests).
 */
import type { KidData } from "./model";
import * as G from "./game";

export interface Note { w: string; x: string }
export interface Poem { id: string; title: string; author: string; dynasty: string; grade: number; form: string; lines: string[]; notes: Note[]; gist: string; theme: string; excerpt?: boolean; check?: boolean }
export interface Dynasty { n: string; years: string }
/** `dynasties` are in time order; `cluster` = dynasties that blur into each other; `anonymous` = the "author" of the poems nobody knows the poet of */
export interface Library { poems: Poem[]; byId: Map<string, Poem>; /** every line of every poem (the pool of wrong choices) */ allLines: string[]; /** the same lines without punctuation (to see at once whether a text is a real line) */ bareLines: Set<string>; dynasties: Dynasty[]; cluster: string[]; anonymous: string }

export const POEMS_PER_DAY = 1;
export const REVIEW_MAX = 3;
export const LOWER_SHARE = 0.3;
export const ROUND = 5;
export const poemsPath = (kidId: string): string => `poems/${kidId}.json`;
export const poemsReviewPath = (kidId: string): string => `poems/${kidId}.review.json`;

/** the results file: the memory boxes of the poems + how many questions of each kind were right / wrong */
export interface PoemReview extends G.Review { stats?: Record<string, { right: number; wrong: number }> }
export const EMPTY_POEM_REVIEW: PoemReview = { cards: {} };


let cache: Library | null = null;
/** the library: part of the program (compiled in, works offline) */
export async function loadPoems(): Promise<Library> {
  if (cache) return cache;
  const raw = (await import("./data/poems.json")).default as unknown as { poems: Poem[]; dynasties: Dynasty[]; cluster: string[]; anonymous: string };
  cache = makeLibrary(raw.poems, raw.dynasties, raw.cluster, raw.anonymous);
  return cache;
}
export const makeLibrary = (poems: Poem[], dynasties: Dynasty[], cluster: string[], anonymous: string): Library => ({ poems, byId: new Map(poems.map((p) => [p.id, p])), allLines: poems.flatMap((p) => p.lines), bareLines: new Set(poems.flatMap((p) => p.lines.map((l) => hanOf(l).join("")))), dynasties, cluster, anonymous });

// ---------- small helpers ----------
const HAN = /[一-鿿]/;
export const isHan = (c: string): boolean => HAN.test(c);
/** the Chinese characters of a text (no punctuation) */
export const hanOf = (s: string): string[] => [...s].filter(isHan);
export const hanLen = (s: string): number => hanOf(s).length;
export const textOf = (p: Poem): string => p.lines.join("");
/** the whole poem for reading aloud */
export const speechText = (p: Poem): string => p.lines.join("").replace(/[“”]/g, "");

export function seeded(seed: string): () => number {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffleWith<T>(l: readonly T[], rnd: () => number): T[] {
  const a = l.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------- the daily pick ----------
/** all poems the child has met (ids of every day) */
export const allIds = (kid: KidData): string[] => [...new Set(kid.weeks.slice().reverse().flatMap((w) => w.chars))];

/**
 * The new poems of a day for a child whose highest level is `grade`: never one he had; `n` poems (default 1); about 30 % of the picks (`LOWER_SHARE`) of the
 * lower grades (when there are some), never a poem of a higher grade. When he has had everything that exists for him a new round starts, the poems he got
 * wrong first. `day` is the date; `seed` is the child's id (the same child and day always give the same poem).
 */
export function pickDaily(lib: Pick<Library, "poems">, kid: KidData, grade: number, day: string, wrong: (id: string) => boolean = () => false, seed = "", n = POEMS_PER_DAY): string[] {
  const rnd = seeded(`${seed}:${grade}:${day}:${kid.weeks.find((w) => w.start === day)?.chars.length ?? 0}`);
  const mix = <T,>(l: T[]): T[] => shuffleWith(l, rnd);
  const used = new Set(kid.weeks.flatMap((w) => w.chars));
  const fresh = lib.poems.filter((p) => !used.has(p.id) && p.grade <= grade);
  const own = mix(fresh.filter((p) => p.grade === grade));
  const lower = mix(fresh.filter((p) => p.grade < grade));
  // (a grade with no poem of its own left: the highest lower grade counts as "own", the rest is "lower")
  const top = lower.length && !own.length ? Math.max(...lower.map((p) => p.grade)) : 0;
  const ownPool = top ? lower.filter((p) => p.grade === top) : own;
  const lowPool = top ? lower.filter((p) => p.grade < top) : lower;
  const out: Poem[] = [];
  const has = (p: Poem) => out.some((x) => x.id === p.id);
  for (let i = 0; i < n; i++) {
    const wantLower = grade > 1 && rnd() < LOWER_SHARE;
    const pool = (wantLower ? [lowPool, ownPool] : [ownPool, lowPool]);
    const p = pool[0].find((x) => !has(x)) ?? pool[1].find((x) => !has(x));
    if (p) out.push(p);
  }
  if (out.length < n) {                                      // everything was had: a new round, the poems he got wrong first
    const old = lib.poems.filter((p) => used.has(p.id) && p.grade <= grade && !has(p) && !(kid.weeks.find((w) => w.start === day)?.chars.includes(p.id)));
    for (const p of [...mix(old.filter((x) => wrong(x.id))), ...mix(old.filter((x) => !wrong(x.id)))]) { if (out.length >= n) break; out.push(p); }
  }
  return out.map((p) => p.id);
}

/** puts poems into a day (a day that has some gets more: "learn one more") */
export function addToDay(kid: KidData, day: string, ids: string[]): { data: KidData; added: number } {
  const cur = kid.weeks.find((w) => w.start === day)?.chars ?? [];
  const add = ids.filter((i) => !cur.includes(i));
  if (!add.length) return { data: kid, added: 0 };
  const weeks = [...kid.weeks.filter((w) => w.start !== day), { start: day, chars: [...cur, ...add] }].sort((a, b) => (a.start < b.start ? -1 : 1));
  return { data: { weeks }, added: add.length };
}

/** the poems that come back today by the memory curve (due first, the ones he got wrong first; then poems of earlier days never asked, the newest first) */
export function reviewIds(kid: KidData, review: PoemReview, today: string, max = REVIEW_MAX): string[] {
  return G.pickReview(kid, { cards: review.cards ?? {} }, today, today, max).map((q) => q.ch);
}

/** how well a poem is known: -1 = never practised, 0 = failed last time, 1..5 = the box */
export const levelOf = (review: PoemReview, id: string): number => review.cards?.[id]?.box ?? -1;

// ---------- the practice questions ----------
export type Mode = "fill" | "next" | "prev" | "order" | "match" | "key";
export const MODES: Mode[] = ["fill", "next", "prev", "order", "match", "key"];
export type Ask = "fill" | "next" | "prev" | "order" | "author" | "dynasty" | "title" | "word" | "gist";
/** a question with four choices (next / prev / match / key) */
export interface ChoiceQ { kind: "choice"; mode: Mode; ask: Ask; poem: string; subject: string; /** the line a word is in (word questions) */ context?: string; choices: string[]; answer: number; explain: string; key: string }
/** a line with 1-3 missing characters, each asked with four character choices, one after the other */
export interface FillQ { kind: "fill"; mode: "fill"; ask: "fill"; poem: string; line: string; blanks: number[]; answers: string[]; choices: string[][]; explain: string; key: string }
/** shuffled lines to put in order; `solution` is the right order (the lines are all different, so the order is unique) */
export interface OrderQ { kind: "order"; mode: "order"; ask: "order"; poem: string; items: string[]; solution: string[]; explain: string; key: string }
export type Question = ChoiceQ | FillQ | OrderQ;

/** two dynasties that follow each other (or blur into each other): never used as the wrong choice for each other */
export const closeDynasties = (lib: Pick<Library, "dynasties" | "cluster">, a: string, b: string): boolean => {
  const names = lib.dynasties.map((d) => d.n);
  return a === b || Math.abs(names.indexOf(a) - names.indexOf(b)) <= 1 || (lib.cluster.includes(a) && lib.cluster.includes(b));
};
const lineHan = (l: string): number => hanLen(l);
const MIN_LINE = 4;
const bare = (l: string): string => hanOf(l).join("");

/** the lines (of the whole library) that FOLLOW a line with this text (a line like "鱼戏莲叶东" can occur more than once) */
function neighbours(lib: Library, line: string, dir: 1 | -1): Set<string> {
  const out = new Set<string>();
  for (const p of lib.poems) p.lines.forEach((l, i) => { if (bare(l) === bare(line) && p.lines[i + dir]) out.add(bare(p.lines[i + dir])); });
  return out;
}

/** three wrong lines of the same length (a little different if there are not enough), none of them a right answer */
function wrongLines(lib: Library, right: string, notAnswers: Set<string>, rnd: () => number): string[] | null {
  const len = lineHan(right);
  const pool = [...new Set(lib.allLines)].filter((l) => !notAnswers.has(bare(l)) && bare(l) !== bare(right) && lineHan(l) >= 3);
  for (const spread of [0, 1, 2, 3]) {
    const cand = shuffleWith(pool.filter((l) => Math.abs(lineHan(l) - len) <= spread), rnd);
    const out: string[] = [];
    for (const l of cand) if (!out.some((o) => bare(o) === bare(l))) out.push(l);
    if (out.length >= 3) return out.slice(0, 3);
  }
  return null;
}
const placeAnswer = <T,>(right: T, wrong: T[], rnd: () => number): { choices: T[]; answer: number } => {
  const choices = shuffleWith([right, ...wrong], rnd);
  return { choices, answer: choices.indexOf(right) };
};

/** a single question of one kind about one poem (null when this poem cannot give one of that kind) */
export function makeQuestion(lib: Library, mode: Mode, poem: Poem, rnd: () => number, level = 1, used: Set<string> = new Set()): Question | null {
  const eligible = poem.lines.map((l, i) => i).filter((i) => lineHan(poem.lines[i]) >= MIN_LINE);
  const fresh = (key: string) => !used.has(key);
  const pickIdx = (cands: number[], keyOf: (i: number) => string): number | null => { const c = shuffleWith(cands.filter((i) => fresh(keyOf(i))), rnd); return c.length ? c[0] : null; };

  if (mode === "fill") {
    const k = Math.max(1, Math.min(3, level));
    for (let attempt = 0; attempt < 30 && eligible.length; attempt++) {
      const li = eligible[Math.floor(rnd() * eligible.length)];
      const line = poem.lines[li];
      const pos = [...line].map((c, i) => (isHan(c) ? i : -1)).filter((i) => i >= 0);
      const nb = Math.min(k, pos.length - 2);
      const blanks = shuffleWith(pos, rnd).slice(0, nb).sort((a, b) => a - b);
      const key = `fill:${poem.id}:${li}:${blanks.join(",")}`;
      if (!fresh(key)) continue;
      const answers = blanks.map((b) => line[b]);
      const choices: string[][] = [];
      let ok = true;
      for (let bi = 0; bi < blanks.length && ok; bi++) {
        const right = answers[bi];
        const others = [...new Set(hanOf(textOf(poem)))].filter((c) => c !== right);
        const far = shuffleWith([...new Set(shuffleWith(lib.poems, rnd).slice(0, 8).flatMap((p) => hanOf(textOf(p))))], rnd);
        const cand = [...shuffleWith(others, rnd), ...far];
        const wrong: string[] = [];
        for (const c of cand) {
          if (c === right || wrong.includes(c)) continue;
          const changed = [...line]; changed[blanks[bi]] = c;
          if (lib.bareLines.has(bare(changed.join("")))) continue;     // that would be a real line of some poem: also right
          wrong.push(c);
          if (wrong.length === 3) break;
        }
        if (wrong.length < 3) { ok = false; break; }
        choices.push(placeAnswer(right, wrong, rnd).choices);
      }
      if (!ok) continue;
      return { kind: "fill", mode: "fill", ask: "fill", poem: poem.id, line, blanks, answers, choices, explain: line, key };
    }
    return null;
  }

  if (mode === "next" || mode === "prev") {
    const dir = mode === "next" ? 1 : -1;
    const cands = eligible.filter((i) => poem.lines[i + dir] && lineHan(poem.lines[i + dir]) >= MIN_LINE);
    const i = pickIdx(cands, (j) => `${mode}:${poem.id}:${j}`);
    if (i === null) return null;
    const subject = poem.lines[i], right = poem.lines[i + dir];
    const wrong = wrongLines(lib, right, neighbours(lib, subject, dir), rnd);
    if (!wrong) return null;
    const { choices, answer } = placeAnswer(right, wrong, rnd);
    return { kind: "choice", mode, ask: mode, poem: poem.id, subject, choices, answer, explain: mode === "next" ? `${subject}${right}` : `${right}${subject}`, key: `${mode}:${poem.id}:${i}` };
  }

  if (mode === "order") {
    const wins: { s: number; n: number }[] = [];
    for (const n of [4, 3]) for (let s = 0; s + n <= poem.lines.length; s++) {
      const w = poem.lines.slice(s, s + n);
      if (w.every((l) => lineHan(l) >= MIN_LINE) && new Set(w.map(bare)).size === n) wins.push({ s, n });
    }
    const c = shuffleWith(wins.filter((x) => fresh(`order:${poem.id}:${x.s}:${x.n}`)), rnd);
    if (!c.length) return null;
    const { s, n } = c[0];
    const solution = poem.lines.slice(s, s + n);
    let items = shuffleWith(solution, rnd);
    for (let t = 0; t < 20 && items.every((l, i) => l === solution[i]); t++) items = shuffleWith(solution, rnd);
    return { kind: "order", mode: "order", ask: "order", poem: poem.id, items, solution, explain: solution.join(""), key: `order:${poem.id}:${s}:${n}` };
  }

  if (mode === "match") {
    const types: Ask[] = shuffleWith(["author", "dynasty", "title"] as Ask[], rnd);
    for (const ask of types) {
      if (ask === "author") {
        const key = `match:author:${poem.id}`;
        if (!fresh(key)) continue;
        const authors = [...new Set(lib.poems.map((p) => p.author))].filter((a) => a !== poem.author && a !== lib.anonymous);
        if (poem.author === lib.anonymous || authors.length < 3) continue;
        // (someone who wrote a poem with this very title cannot be a wrong choice: a title is shared only by the same poem)
        const wrong = shuffleWith(authors, rnd).slice(0, 3);
        const { choices, answer } = placeAnswer(poem.author, wrong, rnd);
        return { kind: "choice", mode, ask, poem: poem.id, subject: poem.title, choices, answer, explain: `${poem.title} | ${poem.dynasty} | ${poem.author}`, key };
      }
      if (ask === "dynasty") {
        const key = `match:dynasty:${poem.id}`;
        if (!fresh(key) || poem.author === lib.anonymous) continue;
        // (a poet of a neighbouring dynasty could belong to either: only far-away dynasties are wrong choices; 汉 / 三国 / 魏晋 / 南北朝 shade into each other)
        const wrong = shuffleWith(lib.dynasties.filter((d) => d.years).map((d) => d.n).filter((d) => !closeDynasties(lib, poem.dynasty, d)), rnd).slice(0, 3);
        const { choices, answer } = placeAnswer(poem.dynasty, wrong, rnd);
        return { kind: "choice", mode, ask, poem: poem.id, subject: poem.author, choices, answer, explain: `${poem.author} | ${poem.dynasty}`, key };
      }
      const i = pickIdx(eligible, (j) => `match:title:${poem.id}:${j}`);
      if (i === null) continue;
      const line = poem.lines[i];
      // (a title is wrong only if its poem does not also contain this line)
      const wrong = shuffleWith(lib.poems.filter((p) => p.id !== poem.id && !p.lines.some((l) => bare(l) === bare(line))), rnd).slice(0, 3).map((p) => p.title);
      if (wrong.length < 3) continue;
      const { choices, answer } = placeAnswer(poem.title, wrong, rnd);
      return { kind: "choice", mode, ask: "title", poem: poem.id, subject: line, choices, answer, explain: `${line} | ${poem.title} | ${poem.author}`, key: `match:title:${poem.id}:${i}` };
    }
    return null;
  }

  // key: the meaning of a word of the notes, or the sentence that says what the poem is about
  const kinds: Ask[] = shuffleWith(["word", "gist"] as Ask[], rnd);
  for (const ask of kinds) {
    if (ask === "word") {
      const ni = pickIdx(poem.notes.map((_, i) => i), (j) => `key:word:${poem.id}:${j}`);
      if (ni === null) continue;
      const note = poem.notes[ni];
      const others = lib.poems.filter((p) => p.id !== poem.id).flatMap((p) => p.notes).filter((n) => n.x !== note.x && n.w !== note.w);
      const wrong: string[] = [];
      for (const n of shuffleWith(others, rnd)) if (!wrong.includes(n.x) && !n.x.includes(note.w)) { wrong.push(n.x); if (wrong.length === 3) break; }
      if (wrong.length < 3) continue;
      const { choices, answer } = placeAnswer(note.x, wrong, rnd);
      const ctx = poem.lines.find((l) => l.includes(note.w));
      return { kind: "choice", mode, ask, poem: poem.id, subject: note.w, context: ctx, choices, answer, explain: `${note.w}: ${note.x}`, key: `key:word:${poem.id}:${ni}` };
    }
    const key = `key:gist:${poem.id}`;
    if (!fresh(key)) continue;
    const others = lib.poems.filter((p) => p.id !== poem.id && p.theme !== poem.theme && p.gist !== poem.gist);
    const wrong: string[] = [];
    for (const p of shuffleWith(others, rnd)) if (!wrong.includes(p.gist)) { wrong.push(p.gist); if (wrong.length === 3) break; }
    if (wrong.length < 3) continue;
    const { choices, answer } = placeAnswer(poem.gist, wrong, rnd);
    return { kind: "choice", mode, ask, poem: poem.id, subject: poem.title, choices, answer, explain: poem.gist, key };
  }
  return null;
}

/**
 * A round of (at most) `ROUND` questions of one kind: first about the chosen poem; when it cannot give enough different ones, about other poems the child
 * has met (`pool`), one question each. The result may be shorter than five when there is not enough to ask.
 */
export function makeRound(lib: Library, mode: Mode, poemId: string, pool: string[], rnd: () => number = Math.random, level = 1, n = ROUND): Question[] {
  const target = lib.byId.get(poemId);
  const used = new Set<string>();
  const out: Question[] = [];
  const add = (p: Poem) => { const q = makeQuestion(lib, mode, p, rnd, level, used); if (q) { used.add(q.key); out.push(q); return true; } return false; };
  if (target) for (let i = 0; i < n * 3 && out.length < n; i++) if (!add(target)) break;
  const others = shuffleWith(pool.filter((i) => i !== poemId).map((i) => lib.byId.get(i)).filter((p): p is Poem => !!p), rnd);
  for (const p of others) { if (out.length >= n) break; add(p); }
  return out;
}

/** is a choice question answered right? / a fill question (one character per blank) / an order question */
export const fillRight = (q: FillQ, picked: string[]): boolean => picked.length === q.answers.length && picked.every((c, i) => c === q.answers[i]);
export const orderRight = (q: OrderQ, items: string[]): boolean => items.length === q.solution.length && items.every((l, i) => l === q.solution[i]);

// ---------- results ----------
export interface Outcome { poem: string; mode: Mode; right: boolean }
/** a poem passed a round when at most one fifth of its questions were wrong (one of five) */
export const passed = (n: number, wrong: number): boolean => wrong * 5 <= n;

/** the memory boxes after a round: per poem, right at the first try = one box up (once a day), otherwise box 0; plus the counts per kind of question */
export function applyRound(r: PoemReview, outcomes: Outcome[], today: string, summary?: { score: number; total: number }): PoemReview {
  const per = new Map<string, { n: number; wrong: number }>();
  const stats = { ...(r.stats ?? {}) };
  for (const o of outcomes) {
    const p = per.get(o.poem) ?? { n: 0, wrong: 0 };
    p.n++; if (!o.right) p.wrong++;
    per.set(o.poem, p);
    const s = stats[o.mode] ?? { right: 0, wrong: 0 };
    stats[o.mode] = { right: s.right + (o.right ? 1 : 0), wrong: s.wrong + (o.right ? 0 : 1) };
  }
  const cards = { ...r.cards };
  for (const [id, p] of per) cards[id] = G.applyOutcome(cards[id], passed(p.n, p.wrong), false, today);
  return { ...r, cards, stats, plays: (r.plays ?? 0) + 1, last: summary ? { date: today, score: summary.score, total: summary.total, stars: G.starsFor(summary.score, summary.total) } : r.last };
}
/** "recited it" / "did not remember" (the grown-up taps) */
export function applyRecite(r: PoemReview, id: string, remembered: boolean, today: string): PoemReview {
  return { ...r, cards: { ...r.cards, [id]: G.applyOutcome(r.cards[id], remembered, false, today) } };
}

// ---------- the poets ----------
export interface PoetEntry { author: string; poems: Poem[] }
/** the poets of a dynasty (a poet with poems in several dynasties, like 佚名, is listed in each) */
export function poetsOf(lib: Library, dynasty: string): PoetEntry[] {
  const by = new Map<string, Poem[]>();
  for (const p of lib.poems) if (p.dynasty === dynasty) by.set(p.author, [...(by.get(p.author) ?? []), p]);
  return [...by.entries()].map(([author, poems]) => ({ author, poems })).sort((a, b) => b.poems.length - a.poems.length || (a.author < b.author ? -1 : 1));
}
