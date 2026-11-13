/**
 * PK, the first item maker: the Chinese pinyin quiz. Every contestant plays with his OWN recorded characters ("已入库"), ten rounds: in each round a character
 * of his list is shown with four pinyin choices. A character with several readings accepts ALL of them (a second reading may be among the choices, then both
 * are right); no wrong choice is ever a reading of the character. Wrong choices are plausible: the same syllable with other tones, the same initial with
 * another final, the same final with another initial. The rules of the game itself are in pklogic.ts (they only see items), so another subject can make its own.
 */
import { rng, shuffled, type Item } from "./pklogic";
import { SYLLABLES } from "./pk-syllables";
import { h } from "./ui";
import { mascot } from "./art";
import * as api from "./api";
import * as M from "./model";
import type { PkAdapter } from "./pkadapter";

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

// ---------- the adapter: the first subject of the PK shell ----------
interface ChData { lists: Map<string, string[]>; readings: Readings }
const CARD = `<svg viewBox="0 0 120 80" aria-hidden="true">
  <g transform="rotate(-9 32 44)"><rect x="6" y="14" width="52" height="52" rx="10" fill="#fff" stroke="#f76707" stroke-width="4"/><path d="M32 16v48M8 40h48" stroke="#ffd8a8" stroke-width="2" stroke-dasharray="4 3"/>
    <circle cx="24" cy="36" r="4" fill="#2d2230"/><circle cx="40" cy="36" r="4" fill="#2d2230"/><path d="M23 49q9 8 18 0" fill="none" stroke="#2d2230" stroke-width="3.500" stroke-linecap="round"/></g>
  <g transform="rotate(9 88 44)"><rect x="62" y="14" width="52" height="52" rx="10" fill="#fff" stroke="#1c7ed6" stroke-width="4"/><path d="M88 16v48M64 40h48" stroke="#a5d8ff" stroke-width="2" stroke-dasharray="4 3"/>
    <circle cx="80" cy="36" r="4" fill="#2d2230"/><circle cx="96" cy="36" r="4" fill="#2d2230"/><path d="M79 49q9 8 18 0" fill="none" stroke="#2d2230" stroke-width="3.500" stroke-linecap="round"/></g>
  <circle cx="60" cy="40" r="15" fill="#ffd43b" stroke="#e67700" stroke-width="3"/><text x="60" y="46" text-anchor="middle" font-family="ui-rounded, system-ui, sans-serif" font-weight="900" font-size="16" fill="#c92a2a">VS</text></svg>`;
export const chineseAdapter: PkAdapter<ChData> = {
  id: "chinese",
  title: () => "PK认字",
  sub: () => "两人面对面比赛",
  color: "#f76707",
  setupRoute: "#/chinese/pk", playRoute: "#/chinese/pk/play", backRoute: "#/chinese",
  cardId: "open-pk", cardArt: CARD,
  heroIcon: () => h("span", { class: "mascot" }, mascot()),
  recordKey: () => "chinese",
  rounds: ROUNDS, present: "char", sameItems: false,
  async load(kids) {
    const readings = await loadReadings();
    const lists = new Map<string, string[]>();
    await Promise.all(kids.map(async (k) => { lists.set(k.id, M.allChars((await api.readJson<M.KidData>(`kids/${k.id}.json`)) ?? M.EMPTY_KID)); }));
    return { lists, readings };
  },
  check(d, a, b) {
    const msgs: HTMLElement[] = [];
    let ok = true, short = false;
    for (const k of [a, b]) {
      const n = usableChars(d.lists.get(k.id) ?? [], d.readings).length;
      if (n < MIN_CHARS) { ok = false; msgs.push(h("p", { class: "pk-msg pk-warn" }, h("span", { class: "user" }, k.name), " 已入库的字太少，至少需要 4 个。")); }
      else if (n < ROUNDS) short = true;
    }
    if (ok && short) msgs.push(h("p", { class: "pk-msg pk-note" }, "已入库的字不足 10 个时，字会重复出现，本局仍为 10 题。"));
    return { ok, msgs };
  },
  make: (d, a, b, seed) => makeGame([d.lists.get(a.id) ?? [], d.lists.get(b.id) ?? []], d.readings, seed),
};
