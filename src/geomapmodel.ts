/**
 * The 地图 page, the practice (no screens, no storage): which items exist (provinces, countries, flags, rivers ...), which are asked at which level, how a round of
 * 10 questions is chosen (what is due or new first, what the child knows well last), how a question and its four choices are made, and what is remembered (the
 * game's memory boxes: asked again after 1, 3, 7, 14, 30 days). A question is NEVER stored: it is made on the spot from the data.
 * Progress is one document per child, `geomap/<kid>.json` = { cards: { "<mode>:<item>": box }, plays, last } (the same shape as the other review files, so that
 * `mergeDocs` in sync.ts merges it: the later answer of a card wins).
 */
import * as G from "./game";
import type { Geo, Prov, Country } from "./geomapgeo";
import { FLAG_IDS } from "./geoflags";

export const geomapPath = (kidId: string): string => `geomap/${kidId}.json`;
export interface GeoDoc { cards: Record<string, G.Card>; plays?: number; last?: { date: string; score: number; total: number; stars: number } }
export const EMPTY_GEO: GeoDoc = { cards: {} };
export const ROUND = 10;

export type Tab = "china" | "world" | "flags";
/** the level (1-4) a child sees: the grade is his highest level; 1-2 -> the big ones, 7-9 -> everything. No grade (a guest) -> everything */
export const levelOfGrade = (g: number | null): number => (g === null ? 4 : g <= 2 ? 1 : g <= 4 ? 2 : g <= 6 ? 3 : 4);
export const LEVEL_NAMES = ["入门", "基础", "提高", "全部"];

export interface ModeDef { id: string; tab: Tab; name: string; sub: string; kind: "choose" | "tap" }
export const MODES: ModeDef[] = [
  { id: "cn-tap", tab: "china", name: "找位置", sub: "在地图上点出省级行政区", kind: "tap" },
  { id: "cn-name", tab: "china", name: "认名字", sub: "看地图，选出名称", kind: "choose" },
  { id: "cn-cap", tab: "china", name: "省会（首府）", sub: "省与省会、首府配对", kind: "choose" },
  { id: "cn-ab", tab: "china", name: "简称", sub: "京、沪、苏……是哪里", kind: "choose" },
  { id: "cn-reg", tab: "china", name: "地理区域", sub: "华北、华东、西南……", kind: "choose" },
  { id: "cn-feat", tab: "china", name: "山河与地形", sub: "点出河流、山脉、高原……", kind: "tap" },
  { id: "w-tap", tab: "world", name: "找位置", sub: "在地图上点出国家", kind: "tap" },
  { id: "w-name", tab: "world", name: "认名字", sub: "看地图，选出国家", kind: "choose" },
  { id: "w-cap", tab: "world", name: "首都", sub: "国家与首都配对", kind: "choose" },
  { id: "w-cont", tab: "world", name: "大洲", sub: "国家在哪个大洲", kind: "choose" },
  { id: "w-ktap", tab: "world", name: "大洲与大洋", sub: "点出七大洲和四大洋", kind: "tap" },
  { id: "f-name", tab: "flags", name: "看国旗，选国家", sub: "国旗是哪个国家的", kind: "choose" },
  { id: "f-flag", tab: "flags", name: "看国家，选国旗", sub: "哪一面是它的国旗", kind: "choose" },
];
export const modeById = (id: string): ModeDef => MODES.find((m) => m.id === id)!;

// ---------- items ----------
export interface Item { id: string; lv: number }
const provById = (g: Geo) => new Map(g.china.provinces.map((p) => [p.id, p]));
const countryById = (g: Geo) => new Map(g.world.countries.map((c) => [c.id, c]));
const hasCapital = (p: Prov) => p.type !== "直辖市" && p.type !== "特别行政区";
/** the items (id and level) a mode asks about; levels are cumulative (`level` 3 includes 1 and 2) */
export function pool(g: Geo, mode: string, level: number): Item[] {
  const lv = (list: { id: string; lv: number }[]) => list.filter((x) => x.lv <= level).map((x) => ({ id: x.id, lv: x.lv }));
  const c = g.china, w = g.world;
  switch (mode) {
    case "cn-tap": case "cn-name": case "cn-ab": case "cn-reg": return lv(c.provinces);
    case "cn-cap": return lv(c.provinces.filter(hasCapital));
    case "cn-feat": return lv([...c.rivers, ...c.mountains, ...c.lakes, ...c.areas]);
    case "w-tap": case "w-name": case "w-cap": case "f-name": case "f-flag": return lv(w.countries.filter((x) => mode.startsWith("f-") ? FLAG_IDS.includes(x.id) : true));
    case "w-cont": return lv(w.countries.filter((x) => !x.tc));
    case "w-ktap": return [...w.continents.map((k) => ({ id: k.id, lv: 1 })), ...w.oceans.map((o) => ({ id: o.id, lv: 2 }))].filter((x) => x.lv <= level);
    default: return [];
  }
}
export const cardKey = (mode: string, item: string): string => `${mode}:${item}`;

// ---------- the memory ----------
/** the box of a card (0 = not known / just failed; 1..5 = asked again after 1, 3, 7, 14, 30 days) */
export const boxOf = (doc: GeoDoc, mode: string, item: string): number => doc.cards[cardKey(mode, item)]?.box ?? -1;
/** knows it well: in box 3 (a week) or higher */
export const KNOWN_BOX = 3;
/** the share of a mode's items that are known well, for the little progress line on a mode card */
export function mastery(doc: GeoDoc, g: Geo, mode: string, level: number): { known: number; total: number } {
  const items = pool(g, mode, level);
  return { known: items.filter((i) => boxOf(doc, mode, i.id) >= KNOWN_BOX).length, total: items.length };
}
/**
 * Which items a round asks (at most 10): first what is DUE (box 0 and failed ones first, then the most overdue), then items never asked (random order), and only
 * then items that are known and not due yet (the least known first): what the child knows well moves to the bottom of the selection.
 */
export function selectItems(doc: GeoDoc, mode: string, items: Item[], today: string, n = ROUND, rnd: () => number = Math.random): string[] {
  const card = (i: Item) => doc.cards[cardKey(mode, i.id)];
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const due = items.filter((i) => card(i) && card(i).due <= today).sort((a, b) => card(a).box - card(b).box || cmp(card(a).due, card(b).due) || rnd() - 0.5);
  const fresh = G.shuffle(items.filter((i) => !card(i)), rnd);
  const known = items.filter((i) => card(i) && card(i).due > today).sort((a, b) => card(a).box - card(b).box || rnd() - 0.5);
  return G.shuffle([...due, ...fresh, ...known].slice(0, n), rnd).map((i) => i.id);
}
/** adds the answers of a round to the document: right at the one and only try -> one box up; wrong -> box 0 (asked again at once) */
export function applyAnswers(doc: GeoDoc, answers: { key: string; right: boolean }[], today: string, summary?: { score: number; total: number }): GeoDoc {
  const cards = { ...doc.cards };
  for (const a of answers) cards[a.key] = G.applyOutcome(cards[a.key], a.right, false, today);
  return { ...doc, cards, plays: (doc.plays ?? 0) + 1, last: summary ? { date: today, score: summary.score, total: summary.total, stars: G.starsFor(summary.score, summary.total) } : doc.last };
}

// ---------- questions ----------
/** a sentence with placeholders {0} {1} ... that the screen fills with the user-protected names (so that the sentence is translated and the names are not) */
export interface Text { tpl: string; args: string[] }
export interface Choice { k: string; t: string; flag?: string }
export interface Question {
  /** the name of the item asked about (the user's own text: shown in the list of what to review) */
  name: string;
  key: string; mode: string; item: string; type: "choose" | "tap";
  /** what is asked */
  prompt: Text;
  /** a flag shown as the question */
  flag?: string;
  /** the map: "china" | "world" | null, and what is lit on it */
  map: "china" | "world" | null; lit?: string;
  /** tap questions: the layers that can be hit; the id of the right answer */
  layers?: string[];
  choices: Choice[]; answer: string;
  explain: Text;
}
const tx = (tpl: string, ...args: string[]): Text => ({ tpl, args });
export const mulberry32 = (a: number) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** four choices: the answer and three others, preferably of the same group (same region / continent), preferably of the child's level, never the same label twice */
export function choicesFor<T extends { id: string; lv: number }>(answer: T, all: T[], level: number, label: (x: T) => string, group: (x: T) => string, rnd: () => number, flag = false): Choice[] {
  const used = new Set([label(answer)]);
  const out: T[] = [];
  const take = (list: T[]) => { for (const x of G.shuffle(list, rnd)) { if (out.length >= 3) return; if (x.id === answer.id || used.has(label(x))) continue; used.add(label(x)); out.push(x); } };
  const others = all.filter((x) => x.id !== answer.id);
  take(others.filter((x) => group(x) === group(answer) && x.lv <= level));
  take(others.filter((x) => group(x) === group(answer)));
  take(others.filter((x) => x.lv <= level));
  take(others);
  return G.shuffle([answer, ...out], rnd).map((x) => ({ k: x.id, t: label(x), ...(flag ? { flag: x.id } : {}) }));
}
/** one sentence about a province (the sentence is translated, the names are not) */
const provText = (p: Prov): Text => p.ct === "省会" ? tx("{0}，简称“{1}”，省会：{2}，属于{3}地区。", p.full, p.ab, p.cap, p.reg)
  : p.ct === "首府" ? tx("{0}，简称“{1}”，首府：{2}，属于{3}地区。", p.full, p.ab, p.cap, p.reg)
  : p.ct === "直辖市" ? tx("{0}，简称“{1}”，是直辖市，属于{2}地区。", p.full, p.ab, p.reg)
  : tx("{0}，简称“{1}”，是特别行政区，属于{2}地区。", p.full, p.ab, p.reg);
const FEAT_TPL: Record<string, string> = { 河流: "{0}是中国的一条河流。", 山脉: "{0}是中国的一列山脉。", 湖泊: "{0}是中国的一个湖泊。", 高原: "{0}是中国的一个高原。", 平原: "{0}是中国的一个平原。", 盆地: "{0}是中国的一个盆地。", 沙漠: "{0}是中国的一个沙漠。" };
const countryText = (c: Country, g: Geo): Text => tx("{0}，首都：{1}，位于{2}。", c.n, c.cap, g.world.continents.find((k) => k.id === c.cont)!.n);

/** the question for one item of a mode (the choices of the same level first); `rnd` is the random source */
export function makeQuestion(g: Geo, mode: string, item: string, level: number, rnd: () => number = Math.random): Question {
  const q = build(g, mode, item, level, rnd);
  const c = g.china, w = g.world;
  const name = c.provinces.find((p) => p.id === item)?.n ?? w.countries.find((x) => x.id === item)?.n ?? [...c.rivers, ...c.mountains, ...c.lakes, ...c.areas].find((f) => f.id === item)?.n ?? [...w.continents, ...w.oceans].find((x) => x.id === item)?.n ?? item;
  return { ...q, name };
}
function build(g: Geo, mode: string, item: string, level: number, rnd: () => number): Omit<Question, "name"> {
  const c = g.china, w = g.world;
  const P = provById(g), C = countryById(g);
  const base = { key: cardKey(mode, item), mode, item, type: modeById(mode).kind } as Pick<Question, "key" | "mode" | "item" | "type">;
  const provs = c.provinces, countries = w.countries;
  const contName = (id: string) => w.continents.find((k) => k.id === id)!.n;
  switch (mode) {
    case "cn-tap": { const p = P.get(item)!; return { ...base, prompt: tx("请在地图上点出：{0}", p.n), map: "china", layers: ["prov"], choices: [], answer: p.id, explain: provText(p) }; }
    case "cn-name": { const p = P.get(item)!; return { ...base, prompt: tx("图中亮起的是哪一个？"), map: "china", lit: p.id, choices: choicesFor(p, provs, level, (x) => x.n, (x) => x.reg, rnd), answer: p.id, explain: provText(p) }; }
    case "cn-cap": {
      const p = P.get(item)!, list = provs.filter(hasCapital);
      if (rnd() < 0.5) return { ...base, prompt: tx("{0}的省会（首府）是哪里？", p.n), map: null, choices: choicesFor(p, list, level, (x) => x.cap, (x) => x.reg, rnd), answer: p.id, explain: provText(p) };
      return { ...base, prompt: tx("{0}是哪个省级行政区的省会（首府）？", p.cap), map: null, choices: choicesFor(p, list, level, (x) => x.n, (x) => x.reg, rnd), answer: p.id, explain: provText(p) };
    }
    case "cn-ab": { const p = P.get(item)!; return { ...base, prompt: tx("“{0}”是哪个省级行政区的简称？", p.ab), map: null, choices: choicesFor(p, provs, level, (x) => x.n, (x) => x.reg, rnd), answer: p.id, explain: provText(p) }; }
    case "cn-reg": {
      const p = P.get(item)!;
      const regs = G.shuffle(c.regions.filter((r) => r !== p.reg), rnd).slice(0, 3);
      return { ...base, prompt: tx("{0}属于哪个地理区域？", p.n), map: null, choices: G.shuffle([p.reg, ...regs], rnd).map((r) => ({ k: r, t: r })), answer: p.reg, explain: provText(p) };
    }
    case "cn-feat": {
      const all = [...c.rivers.map((f) => ({ ...f, kind: "河流" })), ...c.mountains.map((f) => ({ ...f, kind: "山脉" })), ...c.lakes.map((f) => ({ ...f, kind: "湖泊" })), ...c.areas];
      const f = all.find((x) => x.id === item)!;
      return { ...base, prompt: tx("请在地图上点出：{0}", f.n), map: "china", layers: ["river", "mountain", "lake", "area"], choices: [], answer: f.id, explain: tx(FEAT_TPL[f.kind ?? ""], f.n) };
    }
    case "w-tap": { const k = C.get(item)!; return { ...base, prompt: tx("请在地图上点出：{0}", k.n), map: "world", layers: ["country"], choices: [], answer: k.id, explain: countryText(k, g) }; }
    case "w-name": { const k = C.get(item)!; return { ...base, prompt: tx("图中亮起的是哪一个？"), map: "world", lit: k.id, choices: choicesFor(k, countries, level, (x) => x.n, (x) => x.cont, rnd), answer: k.id, explain: countryText(k, g) }; }
    case "w-cap": {
      const k = C.get(item)!;
      if (rnd() < 0.5) return { ...base, prompt: tx("{0}的首都是哪里？", k.n), map: null, choices: choicesFor(k, countries, level, (x) => x.cap, (x) => x.cont, rnd), answer: k.id, explain: countryText(k, g) };
      return { ...base, prompt: tx("{0}是哪个国家的首都？", k.cap), map: null, choices: choicesFor(k, countries, level, (x) => x.n, (x) => x.cont, rnd), answer: k.id, explain: countryText(k, g) };
    }
    case "w-cont": {
      const k = C.get(item)!;
      const conts = G.shuffle(w.continents.filter((x) => x.id !== k.cont), rnd).slice(0, 3);
      return { ...base, prompt: tx("{0}位于哪个大洲？", k.n), map: null, choices: G.shuffle([k.cont, ...conts.map((x) => x.id)], rnd).map((id) => ({ k: id, t: contName(id) })), answer: k.cont, explain: countryText(k, g) };
    }
    case "w-ktap": {
      const k = w.continents.find((x) => x.id === item), o = w.oceans.find((x) => x.id === item);
      const name = (k ?? o)!.n;
      return { ...base, prompt: tx("请在地图上点出：{0}", name), map: "world", layers: k ? ["country", "land"] : ["ocean", "country", "land"], choices: [], answer: item, explain: tx("这里是{0}。", name) };
    }
    case "f-name": { const k = C.get(item)!; return { ...base, prompt: tx("这是哪个国家的国旗？"), map: null, flag: k.id, choices: choicesFor(k, countries.filter((x) => FLAG_IDS.includes(x.id)), level, (x) => x.n, (x) => x.cont, rnd), answer: k.id, explain: countryText(k, g) }; }
    case "f-flag": { const k = C.get(item)!; return { ...base, prompt: tx("{0}的国旗是哪一面？", k.n), map: null, choices: choicesFor(k, countries.filter((x) => FLAG_IDS.includes(x.id)), level, (x) => x.n, (x) => x.cont, rnd, true), answer: k.id, explain: countryText(k, g) }; }
  }
  throw new Error("unknown mode " + mode);
}

/** the questions of one round (10, or fewer when the mode has fewer items) */
export function buildRound(g: Geo, doc: GeoDoc, mode: string, level: number, today: string, rnd: () => number = Math.random): Question[] {
  const ids = selectItems(doc, mode, pool(g, mode, level), today, ROUND, rnd);
  return ids.map((id) => makeQuestion(g, mode, id, level, rnd));
}
