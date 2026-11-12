/**
 * The English word library and the weekly pick (no screens, no storage). `src/data/english-words.json` holds the words in learning order
 * (grade 1 first), each with its Chinese meaning, phonetics and part of speech. A child's recorded words are kept in `english/<kid>.json` in the SAME
 * shape as the characters of the Chinese part (`weeks[].chars` holds the words), so the game's rules (game.ts) are shared as they are.
 */
import type { KidData } from "./model";

export interface Word { w: string; zh: string; ph: string; pos: string; g: number; t?: string }
/** words a week: the week page offers exactly this many new words */
export const WEEKLY_WORDS = 20;
/** the game asks all of this week's words plus this many random words of the week before (none if there was no week before: then it is "the first week") */
export const REVIEW_WORDS = 10;
/** the Recorded tab shows this many random words out of all the recorded ones */
export const RECORDED_SAMPLE = 30;

let cache: Word[] | null = null;
/** the whole library: part of the app itself (src/data/english-words.json is compiled into the program: no network request, works offline and in a packaged app) */
export async function loadWords(): Promise<Word[]> {
  if (cache) return cache;
  cache = (await import("./data/english-words.json")).default.words as Word[];
  return cache;
}
export const wordKey = (w: string): string => w.toLowerCase();
export const wordMap = (all: Word[]): Map<string, Word> => new Map(all.map((x) => [wordKey(x.w), x]));

/** every recorded word of a child, by key */
export const recordedWords = (kid: KidData): Set<string> => new Set(kid.weeks.flatMap((w) => w.chars.map(wordKey)));

/**
 * The next `n` words for a child of `grade`: from the first word of that grade on, in the library's order, skipping the ones already recorded
 * (in any week); when the end of the library is reached, the words of lower grades that are still unrecorded follow (newest grade first).
 */
export function pickWords(all: Word[], kid: KidData, grade: number, n = WEEKLY_WORDS): string[] {
  const used = recordedWords(kid);
  const from = Math.max(0, all.findIndex((x) => x.g >= grade));
  const order = [...all.slice(from), ...all.slice(0, from).reverse()];
  return order.filter((x) => !used.has(wordKey(x.w))).slice(0, n).map((x) => x.w);
}

/** adds the words to a week (a week that already has words is left alone: a week is generated once) */
export function addWeek(kid: KidData, start: string, words: string[]): { data: KidData; added: number } {
  if (kid.weeks.some((w) => w.start === start && w.chars.length)) return { data: kid, added: 0 };
  const weeks = [...kid.weeks.filter((w) => w.start !== start), { start, chars: words }].sort((a, b) => (a.start < b.start ? -1 : 1));
  return { data: { weeks }, added: words.length };
}
/** the child's grade changed: this week's and next week's words were picked for the OLD grade, so they are dropped (and picked again for the new one when the week is opened); past weeks stay */
export const dropFromWeek = (kid: KidData, thisWeek: string): KidData => ({ weeks: kid.weeks.filter((w) => w.start < thisWeek) });
export const wordsPath = (kidId: string): string => `english/${kidId}.json`;
export const wordsReviewPath = (kidId: string): string => `english/${kidId}.review.json`;

/** says a word aloud with the device's own voice (offline; silently nothing where the device has no speech) */
export function speak(w: string): void {
  try {
    const s = window.speechSynthesis;
    if (!s) return;
    s.cancel();
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "en-US";
    u.rate = 0.85;
    s.speak(u);
  } catch { /* no speech on this device */ }
}
