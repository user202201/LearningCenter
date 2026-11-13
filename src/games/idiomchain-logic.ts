/** 成语接龙: the pure rules (no DOM). The library is `src/data/chengyu.json`; the pinyin comes from the caller (one function that gives the four syllables of an idiom). */
export interface Entry { w: string; e: string; l: number; syl: string[]; key: string[] }
export interface Lib {
  list: Entry[];
  byWord: Map<string, Entry>;
  byFirst: Map<string, Entry[]>;
  /** idioms by the toneless pinyin of their first character */
  byFirstPy: Map<string, Entry[]>;
}
export type Raw = [string, string, number];
export type Fail = "empty" | "notfound" | "first" | "used";
export type Rng = () => number;

const TONES = /[̀́̄̌]/g;
/** toneless syllable: "yī" -> "yi", "lǜ" -> "lü" */
export const toneless = (s: string): string => s.normalize("NFD").replace(TONES, "").normalize("NFC");

export function buildLib(items: Raw[], sylOf: (word: string) => string[]): Lib {
  const list: Entry[] = [], byWord = new Map<string, Entry>(), byFirst = new Map<string, Entry[]>(), byFirstPy = new Map<string, Entry[]>();
  for (const [w, e, l] of items) {
    if (byWord.has(w)) continue;
    const syl = sylOf(w);
    const en: Entry = { w, e, l, syl, key: syl.map(toneless) };
    list.push(en); byWord.set(w, en);
    (byFirst.get(w[0]) ?? byFirst.set(w[0], []).get(w[0])!).push(en);
    const k = en.key[0] || w[0];
    (byFirstPy.get(k) ?? byFirstPy.set(k, []).get(k)!).push(en);
  }
  return { list, byWord, byFirst, byFirstPy };
}

/** what the next idiom has to start with: the last character of the idiom (and its toneless pinyin) */
export interface Need { ch: string; key: string }
export const needOf = (e: Entry): Need => ({ ch: e.w[3], key: e.key[3] || e.w[3] });

/** does the idiom `e` start the way `need` asks? (the same character; with `homo` also another character with the same pinyin, tones ignored) */
export const startsRight = (e: Entry, need: Need, homo: boolean): boolean => e.w[0] === need.ch || (homo && (e.key[0] || e.w[0]) === need.key);

/** all idioms that can follow (used ones excluded when `used` is given) */
export function follow(lib: Lib, need: Need, homo: boolean, used?: Set<string>): Entry[] {
  const out: Entry[] = [], seen = new Set<string>();
  const add = (a: Entry[] | undefined) => { for (const e of a ?? []) if (!seen.has(e.w) && !(used && used.has(e.w))) { seen.add(e.w); out.push(e); } };
  add(lib.byFirst.get(need.ch));
  if (homo) add(lib.byFirstPy.get(need.key));
  return out;
}

/** checks what a player typed; returns the idiom or the reason it is refused */
export function validate(lib: Lib, input: string, need: Need, homo: boolean, used: Set<string>): { ok: true; entry: Entry } | { ok: false; why: Fail } {
  const w = input.replace(/[\s　，。、,.]/g, "");
  if (!w) return { ok: false, why: "empty" };
  const en = lib.byWord.get(w);
  if (!en) return { ok: false, why: "notfound" };
  if (!startsRight(en, need, homo)) return { ok: false, why: "first" };
  if (used.has(en.w)) return { ok: false, why: "used" };
  return { ok: true, entry: en };
}

const shuffle = <T,>(a: T[], rng: Rng): T[] => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };

/** four chips: one or two valid answers among distractors that do NOT start with the needed character (nor its homophone when `homo`) */
export function candidates(lib: Lib, need: Need, homo: boolean, used: Set<string>, rng: Rng, easy = true): Entry[] {
  const valid = follow(lib, need, homo, used);
  if (!valid.length) return [];
  const pool = easy ? valid.filter((e) => e.l === 1) : valid;
  const from = pool.length ? pool : valid;
  const nValid = Math.min(from.length, rng() < 0.35 ? 2 : 1);
  // the first valid chip is one the computer cannot easily trap (the player is not forced into a dead end)
  const alive = (e: Entry) => follow(lib, needOf(e), homo, used).some((x) => x !== e && follow(lib, needOf(x), homo, used).length > 0);
  const sh = shuffle(from, rng), lead = sh.find(alive) ?? sh[0];
  const good = [lead, ...sh.filter((e) => e !== lead)].slice(0, nValid);
  const bad: Entry[] = [], seen = new Set(good.map((e) => e.w));
  let tries = 0;
  while (bad.length < 4 - nValid && tries++ < 400) {
    const e = lib.list[Math.floor(rng() * lib.list.length)];
    if (seen.has(e.w) || startsRight(e, need, homo) || used.has(e.w)) continue;
    if (easy && e.l > 1 && tries < 300) continue;
    seen.add(e.w); bad.push(e);
  }
  return shuffle([...good, ...bad], rng);
}

/** weights by level: the choose mode (children) keeps to the very common idioms, the typing mode also uses the harder ones */
const WEIGHTS: Record<"easy" | "hard", number[]> = { easy: [0, 12, 1, 0.1], hard: [0, 3, 3, 1.5] };
/** the computer's answer: a random valid idiom (level-weighted), never a used one; null = it has none (it loses) */
export function computerMove(lib: Lib, need: Need, homo: boolean, used: Set<string>, rng: Rng, easy = true): Entry | null {
  const all = follow(lib, need, homo, used);
  if (!all.length) return null;
  // the computer does not play into a dead end for the player when it has another choice
  const open = all.filter((e) => follow(lib, needOf(e), homo, used).some((x) => x !== e));
  const valid = open.length ? open : all;
  const wt = WEIGHTS[easy ? "easy" : "hard"];
  let total = 0; for (const e of valid) total += wt[e.l] ?? 1;
  let r = rng() * total;
  for (const e of valid) { r -= wt[e.l] ?? 1; if (r <= 0) return e; }
  return valid[valid.length - 1];
}

/** the computer opens: a very common idiom that the player can answer (with `homo` counted) */
export function openingMove(lib: Lib, homo: boolean, rng: Rng, easy = true): Entry {
  const level1 = lib.list.filter((e) => (!easy || e.l === 1) && follow(lib, needOf(e), homo).length >= 2);
  const pool = level1.length ? level1 : lib.list;
  return pool[Math.floor(rng() * pool.length)];
}

/** the first two characters of one valid answer, for the hint (null = none) */
export function hintFor(lib: Lib, need: Need, homo: boolean, used: Set<string>, rng: Rng): { entry: Entry; prefix: string } | null {
  const v = follow(lib, need, homo, used);
  if (!v.length) return null;
  const entry = v[Math.floor(rng() * v.length)];
  return { entry, prefix: entry.w.slice(0, 2) };
}

/** library statistics (the suite checks them) */
export function stats(lib: Lib) {
  const dead = lib.list.filter((e) => !lib.byFirst.has(e.w[3])).length;
  return { total: lib.list.length, dead, level1: lib.list.filter((e) => e.l === 1).length };
}
