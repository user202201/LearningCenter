/**
 * PK, the second subject: "听单词" (the Languages subject). The device SPEAKS a word (English words on the Chinese and the French screen, French words on the
 * English screen: `studyLang`), both players see the SAME four options in the same order and the first right tap wins. Two modes: 听音选词 (the options are
 * written words) and 听音选义 (the options are meanings). The words of a game come from the two children's RECORDED words: drawn alternately from the first and
 * the second child's list (a word recorded by both counts once), `ROUNDS` = 15 of them (8 from one child, 7 from the other, the one with 8 chosen by the seed).
 * Everything the rules need is pure and seeded; the adapter at the end plugs it into the shell (pk.ts).
 */
import { h } from "./ui";
import * as api from "./api";
import * as M from "./model";
import * as W from "./words";
import { getLang } from "./i18n";
import { canSpeakNow } from "./speech";
import { subjectArt } from "./hub";
import { rng, shuffled, type Item } from "./pklogic";
import type { PkAdapter } from "./pkadapter";

export const ROUNDS = 15;
export const MIN_WORDS = 4;
export type EMode = "word" | "meaning";

// ---------- spelling pieces ----------
const ARTICLE = /^(le |la |l'|l’|les |un |une |des |du |de la |de l'|to )/;
/** the word without its article ("le chat" -> "chat") */
export const baseOf = (w: string): string => w.toLowerCase().replace(ARTICLE, "").trim();
/** words that sound the same: two of them are never offered together (the voice could not tell them apart) */
const HOMO: string[][] = [
  ["to", "two", "too"], ["there", "their", "they're"], ["write", "right"], ["see", "sea"], ["son", "sun"], ["no", "know"], ["buy", "by", "bye"], ["hear", "here"], ["one", "won"], ["be", "bee"],
  ["meet", "meat"], ["week", "weak"], ["wait", "weight"], ["where", "wear"], ["whole", "hole"], ["which", "witch"], ["flower", "flour"], ["hour", "our"], ["for", "four", "fore"], ["eight", "ate"],
  ["new", "knew"], ["night", "knight"], ["red", "read"], ["blue", "blew"], ["tail", "tale"], ["road", "rode"], ["pair", "pear"], ["peace", "piece"], ["plane", "plain"], ["sail", "sale"],
  ["wood", "would"], ["your", "you're"], ["its", "it's"], ["break", "brake"], ["bear", "bare"], ["deer", "dear"], ["fair", "fare"], ["mail", "male"], ["nose", "knows"], ["poor", "pour"],
  ["some", "sum"], ["way", "weigh"], ["hi", "high"], ["i", "eye"], ["for", "four"], ["tea", "tee"], ["sweet", "suite"], ["steal", "steel"], ["toe", "tow"], ["mind", "mined"],
  ["vert", "ver", "verre", "vers"], ["mer", "mère", "maire"], ["sang", "cent", "sans"], ["saint", "sain", "sein"], ["ou", "où"], ["a", "à"], ["et", "est"], ["son", "sont"], ["ces", "ses", "c'est", "s'est"],
  ["mon", "mont"], ["pain", "pin"], ["cour", "cours", "court"], ["tente", "tante"], ["vingt", "vin", "vain"], ["fois", "foie", "foi"], ["poids", "pois"], ["mais", "mes", "met", "mets"], ["la", "là"],
  ["cinq", "saint"], ["père", "paire", "pair"], ["thé", "tes", "tais"], ["ver", "vers"], ["lait", "les", "laid"], ["pot", "peau", "po"], ["chaud", "show"], ["bon", "bond"], ["nous", "nu"], ["tu", "tue"],
];
const HOMO_ID = new Map<string, number>();
HOMO.forEach((g, i) => g.forEach((x) => { if (!HOMO_ID.has(x)) HOMO_ID.set(x, i); }));
/** do the two words (or phrases) sound the same? */
export const homophones = (a: string, b: string): boolean => {
  const x = baseOf(a), y = baseOf(b);
  if (x === y) return true;
  const i = HOMO_ID.get(x), j = HOMO_ID.get(y);
  if (i !== undefined && j !== undefined && i === j) return true;
  return HOMO.some((g) => g.includes(x) && g.includes(y));
};
export function edit(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** how much a word looks like the target: the same first letter, the same length, few edits, the same kind of word */
export function likeness(t: W.Word, c: W.Word): number {
  const a = baseOf(t.w), b = baseOf(c.w);
  return (a[0] === b[0] ? 3 : 0) + (a.length === b.length ? 2 : Math.abs(a.length - b.length) === 1 ? 1 : 0) + (t.pos === c.pos ? 1 : 0) - edit(a, b) * 0.6 + (a.slice(-2) === b.slice(-2) ? 1 : 0);
}

// ---------- meanings ----------
/** the meaning of a word in the language of the screen ("" when the library has none) */
export function meaningIn(x: W.Word, lang: string = getLang()): string { return (lang === "en" ? x.en : lang === "fr" ? x.fr : x.zh) ?? ""; }
const STOP = new Set(["le", "la", "les", "l'", "un", "une", "des", "de", "du", "d'", "en", "to", "the", "a", "an"]);
/** the senses a meaning text is made of ("大的，非常的，主要的" -> 大, 非常, 主要; "to run" -> run) */
export function senses(m: string): string[] {
  return m.toLowerCase().split(/[；;,，、/（）()\s]+/).map((x) => x.replace(/的$/, "").replace(/^l['’]/, "")).filter((x) => x && !STOP.has(x) && !/^[的地得]$/.test(x));
}

// ---------- the items ----------
/** one question: the word is spoken; the four options are written words or meanings; exactly one is right */
export function makeWordItem(target: W.Word, lib: readonly W.Word[], mode: EMode, rnd: () => number, lang: string = getLang()): Item | null {
  const tk = target.w.toLowerCase();
  if (mode === "word") {
    const cands = lib.filter((c) => c.w.toLowerCase() !== tk && !homophones(c.w, target.w)).map((c) => ({ c, s: likeness(target, c) + rnd() * 0.5 })).sort((a, b) => b.s - a.s).slice(0, 14);
    const chosen: W.Word[] = [];
    for (const { c } of shuffled(cands, rnd)) {
      if (chosen.length === 3) break;
      if (chosen.some((o) => o.w.toLowerCase() === c.w.toLowerCase() || homophones(o.w, c.w))) continue;
      chosen.push(c);
    }
    if (chosen.length < 3) return null;
    const all = shuffled([{ t: target.w, ok: true }, ...chosen.map((c) => ({ t: c.w, ok: false }))], rnd);
    return { prompt: target.w, choices: all.map((x) => x.t), answers: all.flatMap((x, i) => (x.ok ? [i] : [])) };
  }
  const m = meaningIn(target, lang);
  if (!m) return null;
  const ts = new Set(senses(m));
  // every sense that is right for the spoken word: its own meanings, and those of every word that shares a sense with it (a synonym)
  const valid = new Set(ts);
  for (const e of lib) { const em = meaningIn(e, lang); if (!em) continue; const es = senses(em); if (e.w.toLowerCase() === tk || es.some((x) => ts.has(x))) es.forEach((x) => valid.add(x)); }
  const cands = lib.filter((c) => { const cm = meaningIn(c, lang); return cm && cm !== m && c.w.toLowerCase() !== tk && !senses(cm).some((x) => valid.has(x)); })
    .map((c) => ({ c, s: (c.pos === target.pos ? 2 : 0) - Math.abs(meaningIn(c, lang).length - m.length) * 0.15 + (Math.abs(c.g - target.g) <= 1 ? 1 : 0) + rnd() * 1.5 })).sort((a, b) => b.s - a.s).slice(0, 16);
  const chosen: string[] = [];
  for (const { c } of shuffled(cands, rnd)) {
    if (chosen.length === 3) break;
    const cm = meaningIn(c, lang), cs = senses(cm);
    if (chosen.some((o) => o === cm || senses(o).some((x) => cs.includes(x)))) continue;
    chosen.push(cm);
  }
  if (chosen.length < 3) return null;
  const all = shuffled([{ t: m, ok: true }, ...chosen.map((t) => ({ t, ok: false }))], rnd);
  return { prompt: target.w, choices: all.map((x) => x.t), answers: all.flatMap((x, i) => (x.ok ? [i] : [])) };
}

/**
 * The words of one game: drawn ALTERNATELY from the first and the second list (random inside each list, no repeats, a word in both lists counts once). The side that
 * gives the extra word when the number is odd is chosen by the generator. When a list runs out the other one gives the rest. `n` words at most.
 */
export function pickWords(a: readonly W.Word[], b: readonly W.Word[], rnd: () => number, n = ROUNDS): W.Word[] {
  const lists = [shuffled(a, rnd), shuffled(b, rnd)];
  const at = [0, 0], taken = new Set<string>(), out: W.Word[] = [];
  let side = rnd() < 0.5 ? 0 : 1;
  const take = (s: number): boolean => {
    while (at[s] < lists[s].length) { const x = lists[s][at[s]++]; if (!taken.has(x.w.toLowerCase())) { taken.add(x.w.toLowerCase()); out.push(x); return true; } }
    return false;
  };
  while (out.length < n) {
    if (!take(side) && !take(1 - side)) break;
    side = 1 - side;
  }
  return out;
}
/** the library words a child has recorded (spelled as in the library; words that are not in the library, or have no meaning in the mode, are left out) */
export function recordedOf(rec: readonly string[], map: ReadonlyMap<string, W.Word>, mode: EMode, lang: string = getLang()): W.Word[] {
  const seen = new Set<string>(), out: W.Word[] = [];
  for (const r of rec) { const x = map.get(W.wordKey(r)); if (x && !seen.has(W.wordKey(x.w)) && (mode === "word" || meaningIn(x, lang))) { seen.add(W.wordKey(x.w)); out.push(x); } }
  return out;
}
/** the items of a game (the same list for both sides), or null when fewer than MIN_WORDS words exist */
export function makeEnglishGame(recA: readonly string[], recB: readonly string[], lib: readonly W.Word[], mode: EMode, seed: number, lang: string = getLang(), n = ROUNDS): [Item[], Item[]] | null {
  const map = new Map(lib.map((x) => [W.wordKey(x.w), x] as const));
  const rnd = rng(seed);
  const words = pickWords(recordedOf(recA, map, mode, lang), recordedOf(recB, map, mode, lang), rnd, n);
  if (words.length < MIN_WORDS) return null;
  const items: Item[] = [];
  for (const w of words) { const it = makeWordItem(w, lib, mode, rnd, lang); if (it) items.push(it); }
  return items.length < MIN_WORDS ? null : [items, items];
}

// ---------- voice ----------
export const voiceLang = (): string => (W.studyLang() === "fr" ? "fr-FR" : "en-US");
/** can this device say the words? (no speech API, or voices that are all of another language = no) */
export function voiceAvailable(lang: string = voiceLang()): boolean { return canSpeakNow(lang); }

// ---------- the adapter ----------
interface EData { lib: W.Word[]; rec: Map<string, string[]> }
const CARD = `<svg viewBox="0 0 120 80" aria-hidden="true">
  <g transform="rotate(-6 32 40)"><path d="M8 12h50a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8H30l-12 12V56H8a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8z" fill="#fff" stroke="#2f9e44" stroke-width="4" transform="translate(4 -2) scale(.92)"/>
    <path d="M20 34h6l8-7v22l-8-7h-6z" fill="#2f9e44"/><path d="M40 30q6 5 0 10M45 26q10 9 0 18" fill="none" stroke="#2f9e44" stroke-width="3.500" stroke-linecap="round"/></g>
  <g transform="rotate(6 88 40)"><path d="M62 12h50a8 8 0 0 1 8 8v28a8 8 0 0 1-8 8h-8v12l-12-12H62a8 8 0 0 1-8-8V20a8 8 0 0 1 8-8z" fill="#fff" stroke="#1c7ed6" stroke-width="4" transform="translate(-4 -2) scale(.92 .92) translate(8 0)"/>
    <text x="88" y="42" text-anchor="middle" font-family="ui-rounded, system-ui, sans-serif" font-weight="900" font-size="22" fill="#1c7ed6">abc</text></g>
  <circle cx="60" cy="40" r="15" fill="#ffd43b" stroke="#e67700" stroke-width="3"/><text x="60" y="46" text-anchor="middle" font-family="ui-rounded, system-ui, sans-serif" font-weight="900" font-size="16" fill="#c92a2a">VS</text></svg>`;

export const englishAdapter: PkAdapter<EData> = {
  id: "english",
  title: () => "PK听单词",
  sub: () => "听读音，抢先选出答案",
  color: "#2f9e44",
  setupRoute: "#/english/pk", playRoute: "#/english/pk/play", backRoute: "#/subject/english",
  cardId: "open-pk-en", cardArt: CARD,
  heroIcon: () => h("span", { class: "subj-ico" }, subjectArt("english")),
  recordKey: () => `english:${W.studyLang()}`,
  rounds: ROUNDS, present: "speech", sameItems: true,
  modes: [{ id: "word", label: "听音选词" }, { id: "meaning", label: "听音选义" }],
  speech: { lang: voiceLang, available: () => voiceAvailable() },
  async load(kids) {
    const lib = await W.loadWords();
    const rec = new Map<string, string[]>();
    await Promise.all(kids.map(async (k) => { rec.set(k.id, M.allChars((await api.readJson<M.KidData>(W.wordsPath(k.id))) ?? M.EMPTY_KID)); }));
    return { lib, rec };
  },
  check(d, a, b, mode) {
    const map = new Map(d.lib.map((x) => [W.wordKey(x.w), x] as const));
    const m = mode === "meaning" ? "meaning" : "word";
    const union = new Set([...recordedOf(d.rec.get(a.id) ?? [], map, m), ...recordedOf(d.rec.get(b.id) ?? [], map, m)].map((x) => W.wordKey(x.w))).size;
    const msgs: HTMLElement[] = [];
    if (union < MIN_WORDS) {
      msgs.push(h("p", { class: "pk-msg pk-warn" }, h("span", { class: "user" }, a.name), " · ", h("span", { class: "user" }, b.name), " 已入库的单词合计太少，至少需要 4 个。"));
      return { ok: false, msgs };
    }
    if (union < ROUNDS) msgs.push(h("p", { class: "pk-msg pk-note" }, `词量不足 ${ROUNDS} 个，本局共 ${union} 题。`));
    return { ok: true, msgs };
  },
  make: (d, a, b, seed, mode) => makeEnglishGame(d.rec.get(a.id) ?? [], d.rec.get(b.id) ?? [], d.lib, mode === "meaning" ? "meaning" : "word", seed),
  info() {
    const out = [h("p", { class: "pk-msg pk-rule", id: "pk-rule" }, "单词取自两位选手各自已入库的单词。")];
    if (!voiceAvailable()) out.push(h("p", { class: "pk-msg pk-novoice", id: "pk-novoice" }, "本设备没有语音，将显示单词。"));
    return out;
  },
};
