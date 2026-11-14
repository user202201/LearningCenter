/**
 * The English word library and the weekly pick (no screens, no storage). `src/data/english-words.json` holds the words in learning order
 * (grade 1 first), each with its Chinese meaning, phonetics and part of speech. A child's recorded words are kept in `english/<kid>.json` in the SAME
 * shape as the characters of the Chinese part (`weeks[].chars` holds the words), so the game's rules (game.ts) are shared as they are.
 */
import type { KidData } from "./model";
import { getLang } from "./i18n";
import { speakText } from "./speech";

export interface Word { w: string; zh: string; ph: string; pos: string; g: number; t?: string; /** the French meaning (English words, French UI) */ fr?: string; /** the English meaning (French words, English UI) */ en?: string }
/**
 * What the Languages subject teaches follows the language of the screen: Chinese screen -> English words (meaning in Chinese), French screen -> English words
 * (meaning in French), English screen -> FRENCH words (meaning in English). The French track has its own files (`french/<kid>.json`).
 */
export type Study = "en" | "fr";
export const studyLang = (): Study => (getLang() === "en" ? "fr" : "en");
/** words a week: the week page offers exactly this many new words */
export const WEEKLY_WORDS = 20;
/** the game asks all of this week's words plus this many random words of the week before (none if there was no week before: then it is "the first week") */
export const REVIEW_WORDS = 10;
/** the Recorded tab shows this many random words out of all the recorded ones */
export const RECORDED_SAMPLE = 30;

const cache: Partial<Record<Study, Word[]>> = {};
/** the whole library: part of the app itself (src/data/english-words.json / french-words.json are compiled into the program: no network request, works offline and in a packaged app) */
export async function loadWords(): Promise<Word[]> {
  const lang = studyLang();
  if (cache[lang]) return cache[lang]!;
  if (lang === "fr") {
    const f = (await import("./data/french-words.json")).default.words as { w: string; en: string; pos: string; g: number; t?: string }[];
    cache.fr = f.map((x) => ({ w: x.w, zh: "", en: x.en, ph: "", pos: x.pos, g: x.g, t: x.t }));
  } else cache.en = (await import("./data/english-words.json")).default.words as Word[];
  return cache[lang]!;
}
/** the meaning of a word in the language of the screen */
export const meaningOf = (x: Word | undefined): string => (!x ? "" : getLang() === "en" ? x.en ?? "" : getLang() === "fr" ? x.fr ?? x.zh : x.zh);
export const wordKey = (w: string): string => w.toLowerCase();
export const wordMap = (all: Word[]): Map<string, Word> => new Map(all.map((x) => [wordKey(x.w), x]));

/** every recorded word of a child, by key */
export const recordedWords = (kid: KidData): Set<string> => new Set(kid.weeks.flatMap((w) => w.chars.map(wordKey)));

/** of every week's new words this share is of the child's own grade; the rest is of the LOWER grades (the grade is his highest level: what is below it is consolidated) */
export const OWN_GRADE_SHARE = 0.6;
/**
 * The next `n` words for a child of `grade` (his highest level): about 60 % of his own grade, in the library's order, and the rest from the lower grades (the nearest
 * grade first), always skipping the words already recorded (in any week). When one of the two runs out the other fills the week; when both are used up the
 * words of the grades above follow.
 */
export function pickWords(all: Word[], kid: KidData, grade: number, n = WEEKLY_WORDS): string[] {
  const used = recordedWords(kid);
  const fresh = all.filter((x) => !used.has(wordKey(x.w)));
  const own = fresh.filter((x) => x.g === grade);
  const lower = fresh.filter((x) => x.g < grade).sort((a, b) => b.g - a.g);   // (stable: the library's order inside a grade)
  const above = fresh.filter((x) => x.g > grade);
  const wantOwn = grade <= 1 ? n : Math.round(n * OWN_GRADE_SHARE);
  const out = own.slice(0, wantOwn);
  out.push(...lower.slice(0, n - out.length));
  if (out.length < n) out.push(...own.slice(wantOwn, wantOwn + n - out.length));   // (the lower grades are used up: his own grade fills the week)
  if (out.length < n) out.push(...above.slice(0, n - out.length));
  return out.slice(0, n).map((x) => x.w);
}

/** adds the words to a week (a week that already has words is left alone: a week is generated once) */
export function addWeek(kid: KidData, start: string, words: string[]): { data: KidData; added: number } {
  if (kid.weeks.some((w) => w.start === start && w.chars.length)) return { data: kid, added: 0 };
  const weeks = [...kid.weeks.filter((w) => w.start !== start), { start, chars: words }].sort((a, b) => (a.start < b.start ? -1 : 1));
  return { data: { weeks }, added: words.length };
}
/** the child's grade changed: this week's and next week's words were picked for the OLD grade, so they are dropped (and picked again for the new one when the week is opened); past weeks stay */
export const dropFromWeek = (kid: KidData, thisWeek: string): KidData => ({ weeks: kid.weeks.filter((w) => w.start < thisWeek) });
export const wordsDir = (): string => (studyLang() === "fr" ? "french" : "english");
export const wordsPath = (kidId: string): string => `${wordsDir()}/${kidId}.json`;
export const wordsReviewPath = (kidId: string): string => `${wordsDir()}/${kidId}.review.json`;

/** says a word aloud with the device's own voice (offline; silently nothing where the device has no speech) */
export function speak(w: string): void {
  speakText(w, studyLang() === "fr" ? "fr-FR" : "en-US", { rate: 0.85 });
}
