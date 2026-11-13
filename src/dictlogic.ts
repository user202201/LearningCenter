/**
 * Dictation (听写): the rules, with no screen and no storage (rule 51). One list of things to dictate (this week's characters, optionally this week's idioms
 * and last week's), what the device says for each (a character is said as a common word that contains it, "朋友，朋友的朋"), the results kept in
 * `dictation/<kid>.json` and, for the English / French track, the letter-by-letter check of a typed spelling.
 */
import * as G from "./game.ts";
import { addDays } from "./model.ts";

/** the pauses (seconds) a grown-up can choose between two items */
export const PAUSES = [3, 5, 8, 10] as const;
export const DEFAULT_PAUSE = 5;
/** results kept per child */
export const MAX_SESSIONS = 60;
/** words of one English / French dictation round */
export const ROUND_WORDS = 10;
/** of them at most this many come from the week before */
export const LAST_WEEK_WORDS = 4;

export interface Item { id: string; kind: "char" | "idiom"; text: string }
export interface Session { id: string; date: string; week: string; kind: "zh" | "word"; items: string[]; wrong: string[]; again?: boolean }
export interface DictDoc { sessions: Session[] }
export const EMPTY_DICT: DictDoc = { sessions: [] };

export interface Source { chars: string[]; idioms: string[]; lastChars: string[]; lastIdioms: string[] }
export interface Options { idioms: boolean; last: boolean }

const isChar = (s: string) => [...s].length === 1;
/** the list for 识字: this week's characters, then (if on) this week's idioms, then (if on) last week's characters and idioms; nothing twice */
export function buildItems(src: Source, o: Options): Item[] {
  const out: Item[] = [], seen = new Set<string>();
  const add = (text: string) => {
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push({ id: (isChar(text) ? "c:" : "i:") + text, kind: isChar(text) ? "char" : "idiom", text });
  };
  src.chars.forEach(add);
  if (o.idioms) src.idioms.forEach(add);
  if (o.last) { src.lastChars.forEach(add); if (o.idioms) src.lastIdioms.forEach(add); }
  return out;
}
/** a dictation of exactly these items (the wrong ones of the last one) */
export const itemsOf = (texts: string[]): Item[] => buildItems({ chars: texts.filter(isChar), idioms: texts.filter((t) => !isChar(t)), lastChars: [], lastIdioms: [] }, { idioms: true, last: false });

/** what is said for an item: an idiom whole; a character as a word that holds it and then spelled by that word ("朋友，朋友的朋"); a character without a word only itself */
export function readingOf(it: Item, words: Record<string, string>): string {
  if (it.kind === "idiom") return it.text;
  const w = words[it.text];
  return w ? `${w}，${w}的${it.text}` : it.text;
}
/** the word shown to the grown-up beside the character in the check */
export const wordOf = (it: Item, words: Record<string, string>): string => (it.kind === "idiom" ? "" : words[it.text] ?? "");

/** the week a dictation is made for and the one before */
export const lastWeekOf = (start: string): string => addDays(start, -7);

/** the new list of results: the newest first, one per id, at most MAX_SESSIONS */
export function addSession(doc: DictDoc, s: Session): DictDoc {
  const sessions = [s, ...doc.sessions.filter((x) => x.id !== s.id)].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, MAX_SESSIONS);
  return { ...doc, sessions };
}
export const newSessionId = (date: string, rnd: () => number = Math.random): string => `${date}-${Math.floor(rnd() * 1e6).toString(36)}`;

/** the characters (not idioms) that were wrong go back to box 0 of the game: they are asked again; nothing else of the review changes (no "plays" count) */
export function feedReview(r: G.Review, wrong: string[], today: string): G.Review {
  const cards = { ...r.cards };
  for (const t of new Set(wrong)) cards[t] = G.applyOutcome(cards[t], false, false, today);
  return { ...r, cards };
}

// ---------- English / French spelling ----------
/** the text compared: accents are kept (é is not e), case and the kind of apostrophe / space are not */
export const norm = (s: string): string => s.normalize("NFC").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
export const isSpelledRight = (answer: string, typed: string): boolean => norm(answer) === norm(typed);
export interface Letter { ch: string; ok: boolean }
/** the typed letters one by one: right (same letter in the same place) or wrong; the extra letters beyond the answer are wrong */
export function diffLetters(answer: string, typed: string): Letter[] {
  const a = [...norm(answer)], t = [...typed.normalize("NFC").replace(/[’‘`´]/g, "'").replace(/\s+/g, " ").trimStart()];
  return t.map((ch, i) => ({ ch, ok: a[i] !== undefined && a[i] === ch.toLowerCase() }));
}
/** the first letter of an answer, as a hint */
export const firstLetter = (answer: string): string => [...answer.trim()][0] ?? "";

/** the words of one round: up to ROUND_WORDS, at most LAST_WEEK_WORDS of them from the week before, the rest from this week (the other side fills a missing one); shuffled */
export function pickRound(thisWeek: string[], lastWeek: string[], rnd: () => number = Math.random, n = ROUND_WORDS, fromLast = LAST_WEEK_WORDS): string[] {
  const a = G.shuffle([...new Set(thisWeek)], rnd), b = G.shuffle([...new Set(lastWeek)].filter((w) => !thisWeek.includes(w)), rnd);
  const takeLast = Math.min(b.length, Math.max(fromLast, n - a.length));
  const takeThis = Math.min(a.length, n - takeLast);
  return G.shuffle([...a.slice(0, takeThis), ...b.slice(0, Math.max(0, Math.min(takeLast, n - takeThis)))], rnd);
}
