/**
 * Math: the topics of a week, what is asked in a game, and what is remembered (no screens). A week of a child has 3 TOPICS (knowledge points of his grade,
 * src/data/math-topics.json); they are kept in `math/<kid>.json` in the same shape as the words / characters (`weeks[].chars` holds the topic ids).
 * The questions themselves are made on the spot (mathgen.ts), never stored.
 */
import type { KidData } from "./model";
import { secOf, makeSet, type Q } from "./mathgen";

export interface Topic { id: string; name: string; domain: string; desc: string }
export interface MathData { topics: Topic[]; grades: Record<string, string[]> }
/** topics a week */
export const WEEKLY_TOPICS = 3;
/** questions of a game, and how many of them come from last week's topics (when there was a week before) */
export const GAME_QUESTIONS = 20;
export const GAME_PREVIOUS = 6;
/** questions of a quick practice of one topic */
export const PRACTICE_QUESTIONS = 10;

export const mathPath = (kidId: string): string => `math/${kidId}.json`;
export const mathReviewPath = (kidId: string): string => `math/${kidId}.review.json`;

let cache: MathData | null = null;
/** the topics of every grade: part of the app itself (src/data/math-topics.json is compiled into the program: no network request, works offline) */
export async function loadMath(): Promise<MathData> {
  if (cache) return cache;
  cache = (await import("./data/math-topics.json")).default as MathData;
  return cache;
}

/**
 * The topics of a new week for a child of `grade`: the topics of his grade in the list's order that he has not had yet; when fewer than 3 are left the
 * list starts again from its beginning (a new round, new numbers). Only topics that have a generator are used.
 */
export function pickTopics(data: MathData, kid: KidData, grade: number, known: (id: string) => boolean, n = WEEKLY_TOPICS, acc: (id: string) => number | null = () => null): string[] {
  const list = (data.grades[String(grade)] ?? []).filter(known);
  const used = new Set(kid.weeks.flatMap((w) => w.chars));
  // the grade is the child's HIGHEST level: one topic of every week comes from the lower grades (the nearest grade first, the ones he has not had first)
  const lowerList = Array.from({ length: Math.max(0, grade - 1) }, (_, i) => grade - 1 - i).flatMap((g) => (data.grades[String(g)] ?? []).filter(known));
  const lowerFresh = lowerList.filter((t) => !used.has(t));
  const lowerPick = grade > 1 && n >= 2 ? (lowerFresh[0] ?? lowerList.map((t) => ({ t, a: acc(t) ?? 50 })).sort((x, y) => x.a - y.a)[0]?.t) : undefined;
  const out = list.filter((t) => !used.has(t)).slice(0, lowerPick ? n - 1 : n);
  if (lowerPick) out.push(lowerPick);
  // a new round: the topics he answered worst come first (never asked = in the middle), ties keep the list's order
  const rest = list.filter((t) => !out.includes(t)).map((t, i) => ({ t, i, a: acc(t) ?? 50 })).sort((x, y) => x.a - y.a || x.i - y.i);
  for (const r of rest) { if (out.length >= n) break; out.push(r.t); }
  return out;
}

/** the topic of every question of a game: this week's topics, and (when there was a week before) a few of last week's */
export function gameTopics(thisWeek: string[], previous: string[], total = GAME_QUESTIONS, fromPrevious = GAME_PREVIOUS): string[] {
  if (!thisWeek.length) return [];
  const nPrev = previous.length ? Math.min(fromPrevious, total - thisWeek.length) : 0;
  const pick = (list: string[], n: number) => Array.from({ length: n }, (_, i) => list[i % list.length]);
  return [...pick(thisWeek, total - nPrev), ...(nPrev ? pick(previous, nPrev) : [])];
}
/** the questions of a game and its total time in seconds (the sum of the seconds each topic is given per question) */
export function buildGame(thisWeek: string[], previous: string[]): { questions: Q[]; seconds: number } {
  const topics = gameTopics(thisWeek, previous);
  const questions = makeSet(topics, topics.length);
  return { questions, seconds: questions.reduce((s, q) => s + secOf(q.topic), 0) };
}

export interface TopicStat { right: number; wrong: number; last?: string }
export interface MathReview { topics: Record<string, TopicStat>; mistakes?: Q[]; last?: { date: string; score: number; total: number; stars: number; seconds: number }; plays?: number }
export const EMPTY_MATH_REVIEW: MathReview = { topics: {} };
export interface Answer { topic: string; right: boolean; q?: Q }
/** the wrong questions kept in the errors book (newest first) */
export const MAX_MISTAKES = 50;

/** adds the answers of a game; `summary` (a finished game) is kept as "last time" */
export function applyMath(r: MathReview, answers: Answer[], today: string, summary?: { score: number; total: number; seconds: number }): MathReview {
  const topics = { ...r.topics };
  let mistakes = [...(r.mistakes ?? [])];
  for (const a of answers) {
    const c = topics[a.topic] ?? { right: 0, wrong: 0 };
    topics[a.topic] = { right: c.right + (a.right ? 1 : 0), wrong: c.wrong + (a.right ? 0 : 1), last: today };
    if (a.q) {
      mistakes = mistakes.filter((m) => m.q !== a.q!.q);   // (right now = out of the book; wrong = (again) at the top)
      if (!a.right) mistakes.unshift(a.q);
    }
  }
  mistakes = mistakes.slice(0, MAX_MISTAKES);
  const stars = !summary || !summary.total ? 0 : summary.score / summary.total >= 0.9 ? 3 : summary.score / summary.total >= 0.6 ? 2 : 1;
  return { topics, mistakes, plays: (r.plays ?? 0) + 1, last: summary ? { date: today, ...summary, stars } : r.last };
}
/** the share of right answers of a topic (null = never asked) */
export const accuracy = (s: TopicStat | undefined): number | null => (s && s.right + s.wrong > 0 ? Math.round((100 * s.right) / (s.right + s.wrong)) : null);
