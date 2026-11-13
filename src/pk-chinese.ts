/**
 * PK, the first item maker: the Chinese pinyin quiz. Every contestant plays with his OWN recorded characters ("已入库"), ten rounds: in each round a character
 * of his list is shown with four pinyin choices. A character with several readings accepts ALL of them (a second reading may be among the choices, then both
 * are right); no wrong choice is ever a reading of the character. Wrong choices are plausible: the same syllable with other tones, the same initial with
 * another final, the same final with another initial. The rules of the game itself are in pklogic.ts (they only see items), so another subject can make its own.
 */
import { rng, shuffled, type Item } from "./pklogic";
import { SYLLABLES } from "./pk-syllables";

export const ROUNDS = 10;
export const MIN_CHARS = 4;
export type Readings = (ch: string) => string[];

// ---------- pinyin pieces ----------
const MARKS: Record<string, [string, number]> = {};
const VOWELS = ["a", "e", "i", "o", "u", "ü"];
const TONED = ["āáǎà", "ēéěè", "īíǐì", "ōóǒò", "ūúǔù", "ǖǘǚǜ"];
VOWELS.forEach((v, i) => [...TONED[i]].forEach((m, k) => { MARKS[m] = [v, k + 1]; }));
const INITIALS = /^(zh|ch|sh|[bpmfdtnlgkhjqxrzcsyw])/;

/** a syllable with a tone mark -> its plain letters and the tone (0 = none) */
export function splitSyllable(syl: string): { base: string; tone: number } {
  let tone = 0;
  const base = [...syl.toLowerCase()].map((c) => { const m = MARKS[c]; if (m) { tone = m[1]; return m[0]; } return c; }).join("");
  return { base, tone };
}
/** plain letters + tone 1-4 (0 = none) -> the syllable with its tone mark on the right vowel */
export function markSyllable(base: string, tone: number): string {
  if (tone < 1 || tone > 4) return base;
  const at = base.includes("a") ? base.indexOf("a") : base.includes("e") ? base.indexOf("e") : base.includes("ou") ? base.indexOf("o") : Math.max(...VOWELS.map((v) => base.lastIndexOf(v)));
  const v = base[at];
  return base.slice(0, at) + TONED[VOWELS.indexOf(v)][tone - 1] + base.slice(at + 1);
}
const initialOf = (base: string) => INITIALS.exec(base)?.[1] ?? "";

/** the readings of a character from pinyin-pro (all of them, with tone marks, no duplicates); loaded the first time it is needed */
let readingsFn: Readings | null = null;
export async function loadReadings(): Promise<Readings> {
  if (readingsFn) return readingsFn;
  const m = await import("pinyin-pro");
  readingsFn = (ch) => !isHan(ch) ? [] : [...new Set(m.pinyin(ch, { multiple: true }).split(/\s+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[a-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜü]+$/.test(x)))];
  return readingsFn;
}

function isHan(c: string) { return /^\p{Script=Han}$/u.test(c); }
/** the usable characters of a list: Chinese characters with a known reading, each once, in the list's order */
export const usableChars = (list: readonly string[], readings: Readings): string[] => [...new Set(list.filter((c) => [...c].length === 1 && isHan(c) && readings(c).length > 0))];

/**
 * The characters of one side for `n` rounds: from his own list only; a list of n or more gives n different characters, a shorter one is used completely
 * and then again in a new random order as often as needed (never the same character twice in a row).
 */
export function sideChars(pool: readonly string[], rnd: () => number, n = ROUNDS): string[] {
  if (!pool.length) return [];
  const seq: string[] = [];
  while (seq.length < n) {
    const perm = shuffled(pool, rnd);
    if (pool.length > 1 && seq.length && perm[0] === seq[seq.length - 1]) [perm[0], perm[1]] = [perm[1], perm[0]];
    seq.push(...perm);
  }
  return seq.slice(0, n);
}

/** one question: the character, four different choices, the indexes of the right ones */
export function makeItem(ch: string, readings: Readings, rnd: () => number): Item {
  const valid = readings(ch);
  const validSet = new Set(valid);
  const primary = valid[0];
  const right = [primary];
  if (valid.length > 1 && rnd() < 0.5) right.push(valid[1 + Math.floor(rnd() * (valid.length - 1))]);
  const { base, tone } = splitSyllable(primary);
  const ini = initialOf(base), fin = base.slice(ini.length);
  const seen = new Set<string>([...validSet]);
  const mk = (b: string, t: number) => markSyllable(b, t);
  const pickFrom = (cands: string[]): string | null => {
    for (const c of shuffled(cands, rnd)) if (!seen.has(c)) return c;
    return null;
  };
  const tones = [1, 2, 3, 4];
  const sameBase = tones.map((t) => mk(base, t));
  const sameIni = ini ? SYLLABLES.filter((b) => b !== base && initialOf(b) === ini && b.slice(ini.length) !== fin).flatMap((b) => [mk(b, tone || 1), mk(b, tones[Math.floor(rnd() * 4)])]) : [];
  const sameFin = fin ? SYLLABLES.filter((b) => b !== base && b.endsWith(fin) && initialOf(b) !== ini && b.slice(initialOf(b).length) === fin).flatMap((b) => [mk(b, tone || 1), mk(b, tones[Math.floor(rnd() * 4)])]) : [];
  const any = SYLLABLES.filter((b) => b !== base).map((b) => mk(b, tones[Math.floor(rnd() * 4)]));
  const need = 4 - right.length;
  const wrong: string[] = [];
  const take = (cands: string[]) => { const c = wrong.length < need ? pickFrom(cands) : null; if (c) { wrong.push(c); seen.add(c); } };
  take(sameBase); take(sameIni); take(sameFin);
  for (const cands of [sameBase, sameIni, sameFin, any, any]) while (wrong.length < need) { const before = wrong.length; take(cands); if (wrong.length === before) break; }
  const all = shuffled([...right.map((r) => ({ r, ok: true })), ...wrong.map((r) => ({ r, ok: false }))], rnd);
  return { prompt: ch, choices: all.map((x) => x.r), answers: all.flatMap((x, i) => (x.ok ? [i] : [])) };
}

/** the items of one child for ten rounds (null when the list has fewer than MIN_CHARS usable characters) */
export function makeSideItems(list: readonly string[], readings: Readings, seed: number, n = ROUNDS): Item[] | null {
  const pool = usableChars(list, readings);
  if (pool.length < MIN_CHARS) return null;
  const rnd = rng(seed);
  return sideChars(pool, rnd, n).map((ch) => makeItem(ch, readings, rnd));
}
/** the items of both contestants; each side from its own list only (side 0 = player 1) */
export function makeGame(lists: [readonly string[], readonly string[]], readings: Readings, seed: number, n = ROUNDS): [Item[], Item[]] | null {
  const a = makeSideItems(lists[0], readings, seed * 2 + 1, n), b = makeSideItems(lists[1], readings, seed * 2 + 2, n);
  return a && b ? [a, b] : null;
}
