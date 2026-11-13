/**
 * 天文 (`#/science/space`): the pure rules, no screen. Orbits (Kepler), light time, weight and age on the planets, the Moon's phase, eclipses, the seasons, the tides,
 * and the quiz (questions made from the data, memory boxes of game.ts, kept on this device in `learn.space.v1`). The data is `data/space.json` (written from memory:
 * to be checked by a teacher / astronomer), imported lazily.
 */
import * as G from "./game";
import { getLang, tr, type Lang } from "./i18n";

export interface Names { zh: string; en: string; fr: string }
export interface Body extends Names {
  id: string; kind: "rock" | "gas" | "ice" | "dwarf"; a: number; e: number; L0: number; varpi: number; P: number; rot: number; sday: number; tilt: number | null; d: number; mass: number; g: number; dens: number;
  tmin: number; tmax: number; tnote?: string; atm: string; moons: number; moonsCheck?: boolean; ring: 0 | 1 | 2; color: string; intro: string; facts: string[]; check?: boolean;
}
export interface Moon extends Names { id: string; planet: string; alias: string; d: number; a: number; P: number; by: string; yr: string; fact: string; q: string; check?: boolean }
export interface Const extends Names { id: string; season: string; story: string; tip: string; stars: [number, number, number, string][]; lines: [number, number][] }
export interface Space {
  planets: Body[]; dwarfs: Body[]; moons: Moon[]; constellations: Const[];
  timeline: { date: string; zh: string; text: string; cn: boolean; check?: boolean }[];
  sun: { stats: [string, string][]; layers: { id: string; zh: string; r: number; color: string; text: string }[] };
  life: { id: string; zh: string; text: string; path: "both" | "small" | "big" }[];
  ladder: { id: string; zh: string; m: number; text: string; light: string; check?: boolean }[];
  supers: { q: string; a: string; e: string }[];
  mcq: { q: string; a: string; w: string[]; e: string }[];
}
let cached: Space | null = null;
export async function loadSpace(): Promise<Space> { return (cached ??= (await import("./data/space.json")).default as unknown as Space); }
export const allBodies = (s: Space): Body[] => [...s.planets, ...s.dwarfs];
export const bodyById = (s: Space, id: string): Body | undefined => allBodies(s).find((b) => b.id === id);

/** a name in the language of the screen (the names are part of the data, in the three languages) */
export const nameOf = (n: Names, lang: Lang = getLang()): string => (lang === "zh" ? n.zh : lang === "en" ? n.en : n.fr);
export const paren = (a: string, b: string): string => `${a}${String.fromCharCode(0xff08)}${b}${String.fromCharCode(0xff09)}`;
export const moonName = (m: Moon, lang: Lang = getLang()): string => (lang === "zh" ? (m.alias ? paren(m.zh, m.alias) : m.zh) : lang === "en" ? m.en : m.fr);
/** the Moon of the Earth and the other worlds as "bodies for the weight scale" */
export const MOON_G = 1.62;
export const G_EARTH = 9.80665;

// ---------- orbits ----------
const RAD = Math.PI / 180;
/** days since J2000 (2000-01-01 12:00) of a date 'YYYY-MM-DD' (noon UTC) */
export const dayOfDate = (iso: string): number => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), 12) - Date.UTC(2000, 0, 1, 12)) / 86400000;
export const dateOfDay = (d: number): string => new Date(Date.UTC(2000, 0, 1, 12) + Math.round(d) * 86400000).toISOString().slice(0, 10);
/** Kepler's equation M = E - e sin E (Newton) */
export function solveKepler(M: number, e: number): number {
  M = ((M % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 40; i++) { const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); E -= dE; if (Math.abs(dE) < 1e-12) break; }
  return E;
}
export interface Pos { x: number; y: number; r: number; lon: number }
/** where a body is (AU, the plane of the orbit, seen from the north) `d` days after J2000: elliptic orbit, mean motion from the sidereal period */
export function position(b: Pick<Body, "a" | "e" | "L0" | "varpi" | "P">, d: number): Pos {
  const M = (b.L0 - b.varpi + (360 * d) / b.P) * RAD;
  const E = solveKepler(M, b.e);
  const nu = 2 * Math.atan2(Math.sqrt(1 + b.e) * Math.sin(E / 2), Math.sqrt(1 - b.e) * Math.cos(E / 2));
  const r = b.a * (1 - b.e * Math.cos(E));
  const lon = nu + b.varpi * RAD;
  return { x: r * Math.cos(lon), y: r * Math.sin(lon), r, lon };
}
/** Kepler's third law: the period in days from the distance in AU */
export const keplerDays = (aAU: number): number => 365.256 * Math.pow(aAU, 1.5);
export const normDeg = (x: number): number => ((x % 360) + 360) % 360;
/** the speeds of the time lapse (days of the model per second of the screen); 0 = paused */
export const SPEEDS = [0, 1, 10, 30, 91.3125, 365.25, 1826.25];
/** the light needs this many seconds for `km` kilometres */
export const lightSeconds = (km: number): number => km / 299792.458;
export const AU_KM = 149597870.7;
export function lightParts(sec: number): { h: number; m: number; s: number } { const t = Math.round(sec); return { h: Math.floor(t / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 }; }

// ---------- weight and age ----------
/** the weight on a world: mass x (g there / g on the Earth) */
export const weightOn = (kg: number, g: number): number => (kg * g) / G_EARTH;
/** the age in the years of a world (a year = its orbital period) */
export const ageOn = (years: number, periodDays: number): number => (years * 365.256) / periodDays;
export const surfaceSpeedKmh = (b: Pick<Body, "d" | "rot">): number => (Math.PI * b.d) / Math.abs(b.rot);
export const sizeVsEarth = (b: Pick<Body, "d">): number => b.d / 12742;
export const gravityFromMass = (b: Pick<Body, "mass" | "d">): number => (G_EARTH * b.mass) / Math.pow(b.d / 12742, 2);

// ---------- the Moon ----------
export const SYNODIC = 29.530588853;
export const PHASES = ["新月", "蛾眉月", "上弦月", "盈凸月", "满月", "亏凸月", "下弦月", "残月"];
/** the share of the Moon's disc that is lit, from its angle E to the Sun as seen from the Earth (0 = new, 180 = full) */
export const illumination = (E: number): number => (1 - Math.cos(E * RAD)) / 2;
export const phaseIndex = (E: number): number => Math.round(normDeg(E) / 45) % 8;
export const phaseName = (E: number): string => PHASES[phaseIndex(E)];
export const moonAge = (E: number): number => (normDeg(E) / 360) * SYNODIC;
/** the Chinese lunar day name: 初一 ... 三十 */
const cp = (...c: number[]): string => String.fromCodePoint(...c);
const DIGITS = [0x4e00, 0x4e8c, 0x4e09, 0x56db, 0x4e94, 0x516d, 0x4e03, 0x516b, 0x4e5d, 0x5341].map((c) => cp(c));
export function lunarDayName(n: number): string {
  const d = Math.max(1, Math.min(30, Math.round(n)));
  const CHU = cp(0x521d), TEN = cp(0x5341), TWENTY = cp(0x5eff);   // 初 十 廿 (written as code points: these are the calendar's own letters, not UI texts)
  if (d <= 10) return d === 10 ? CHU + TEN : CHU + DIGITS[d - 1];
  if (d < 20) return TEN + DIGITS[d - 11];
  if (d === 20) return DIGITS[1] + TEN;
  if (d < 30) return TWENTY + DIGITS[d - 21];
  return DIGITS[2] + TEN;
}
export const lunarDayOf = (E: number): string => lunarDayName(Math.floor(moonAge(E)) + 1);
const NEW_MOON_J2000 = 5.26; // 2000-01-06 18:14 UTC, days after J2000
/** the Moon's angle to the Sun on a date (a mean value: the real Moon is up to about half a day ahead or behind) */
export const elongationOfDay = (d: number): number => normDeg(((d - NEW_MOON_J2000) / SYNODIC) * 360);
// ---------- eclipses ----------
/** the Moon's orbit is tilted by this angle to the Earth's orbit plane */
export const MOON_TILT = 5.145;
/** the angle between the Moon and the Sun (solar) or the Moon and the centre of the Earth's shadow (lunar), degrees */
export const separation = (offset: number, beta: number): number => Math.hypot(offset, beta);
export type SolarKind = "none" | "partial" | "central";
export type LunarKind = "none" | "penumbral" | "partial" | "total";
/** a solar eclipse is seen somewhere on the Earth when the Moon is within about 1.5 degrees of the Sun; the Moon's shadow touches the Earth's middle within about 0.9 */
export const solarKind = (s: number): SolarKind => (s < 0.9 ? "central" : s < 1.5 ? "partial" : "none");
/** the Earth's shadow at the Moon: umbra about 0.7 degrees, penumbra about 1.25 degrees (radius as seen from the Earth), the Moon's own radius 0.26 */
export const lunarKind = (s: number): LunarKind => (s < 0.7 - 0.26 ? "total" : s < 0.7 + 0.26 ? "partial" : s < 1.25 + 0.26 ? "penumbral" : "none");
/** the latitude of the Moon above the Earth's orbit plane, from its place on its orbit (the angle from the node) */
export const moonLatitude = (fromNode: number): number => MOON_TILT * Math.sin(fromNode * RAD);

// ---------- the seasons ----------
export const OBLIQUITY = 23.44;
/** the declination of the Sun (the latitude of the point where it is overhead at noon), degrees, for day of the year 1..366 */
export const declination = (n: number): number => -Math.asin(Math.sin(OBLIQUITY * RAD) * Math.cos((2 * Math.PI / 365.24) * (n + 10) + 2 * 0.0167 * Math.sin((2 * Math.PI / 365.24) * (n - 2)))) / RAD;
/** the hours of daylight at a latitude (degrees) when the Sun's declination is `dec` */
export function dayLength(lat: number, dec: number): number {
  const c = -Math.tan(lat * RAD) * Math.tan(dec * RAD);
  if (c >= 1) return 0;
  if (c <= -1) return 24;
  return (2 * Math.acos(c) / RAD) / 15;
}
export const noonElevation = (lat: number, dec: number): number => 90 - Math.abs(lat - dec);
/** the distance Earth - Sun in AU on a day of the year (closest in early January) */
export const earthDistance = (n: number): number => 1 - 0.0167 * Math.cos((2 * Math.PI * (n - 3)) / 365.256);
export const dayOfYear = (iso: string): number => Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(+iso.slice(0, 4), 0, 0)) / 86400000);
export const SEASON_DAYS = [["春分", 79], ["夏至", 172], ["秋分", 266], ["冬至", 356]] as const;

// ---------- the tides ----------
/** how strong the tide is, with the Sun's pull as 0.46 of the Moon's: spring tides at new and full moon, neap tides at the quarters */
export const tideFactor = (E: number): number => 1 + 0.46 * Math.cos(2 * E * RAD);
export const tideName = (E: number): "大潮" | "小潮" | "中潮" => { const f = tideFactor(E); return f > 1.3 ? "大潮" : f < 0.7 ? "小潮" : "中潮"; };
/** the tide height at hour t (a lunar day is 24.84 hours, so the high water comes every 12.42 hours) */
export const tideHeight = (E: number, t: number): number => tideFactor(E) * Math.cos((2 * Math.PI * t) / 12.4206);

// ---------- the quiz ----------
export interface SpaceDoc { cards: Record<string, G.Card>; plays?: number; last?: { date: string; score: number; total: number; stars: number }; tab?: string }
export const EMPTY_DOC: SpaceDoc = { cards: {} };
export const ROUND = 10;
export const STORE = "learn.space.v1";
export function loadDoc(): SpaceDoc {
  try { const p = JSON.parse(localStorage.getItem(STORE) ?? "{}"); return { cards: p.cards && typeof p.cards === "object" ? p.cards : {}, plays: p.plays, last: p.last, tab: typeof p.tab === "string" ? p.tab : undefined }; } catch { return { cards: {} }; }
}
export const saveDoc = (d: SpaceDoc): void => { try { localStorage.setItem(STORE, JSON.stringify(d)); } catch { /* private mode: nothing is remembered */ } };
export function applyAnswers(doc: SpaceDoc, answers: { key: string; right: boolean }[], today: string, summary?: { score: number; total: number }): SpaceDoc {
  const cards = { ...doc.cards };
  for (const a of answers) cards[a.key] = G.applyOutcome(cards[a.key], a.right, false, today);
  return { ...doc, cards, plays: (doc.plays ?? 0) + 1, last: summary ? { date: today, score: summary.score, total: summary.total, stars: G.starsFor(summary.score, summary.total) } : doc.last };
}
export interface Text { tpl: string; args: string[] }
export interface Choice { k: string; t: string }
export interface Question {
  key: string; kind: string; stem: Text; fig?: { t: "planet" | "moon" | "phase" | "const"; id: string; E?: number };
  choices: Choice[]; answer: string; explain: { text?: string; tpl?: string; args?: string[] }; user?: boolean;
}
const KINDS = { pp: "行星图", pd: "矮行星图", pm: "卫星图", or: "顺序", sp: "之最", mf: "卫星特征", mo: "卫星归属", ph: "月相", cs: "星座", mq: "知识", wt: "体重" };
export const kindName = (k: string): string => KINDS[k as keyof typeof KINDS] ?? k;
export function allKeys(s: Space): string[] {
  return [
    ...s.planets.map((p) => `pp:${p.id}`), ...s.dwarfs.map((p) => `pd:${p.id}`), ...s.moons.map((m) => `pm:${m.id}`),
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `or:${n}`), ...s.supers.map((_, i) => `sp:${i}`),
    ...s.moons.map((m) => `mf:${m.id}`), ...s.moons.map((m) => `mo:${m.id}`), ...PHASES.map((_, i) => `ph:${i}`),
    ...s.constellations.map((c) => `cs:${c.id}`), ...s.mcq.map((_, i) => `mq:${i}`), ...["moon", ...s.planets.map((p) => p.id)].map((id) => `wt:${id}`),
  ];
}
const pickSome = <T>(list: T[], n: number, rnd: () => number): T[] => G.shuffle(list, rnd).slice(0, n);
/** the weights the questions use */
export const WEIGHTS = [30, 35, 40, 45, 50];
const fmtKg = (x: number): string => String(Math.round(x * 10) / 10);

export function makeQuestion(s: Space, key: string, rnd: () => number = Math.random, lang: Lang = getLang()): Question {
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  const sh = <T>(l: T[]) => G.shuffle(l, rnd);
  const nm = (n: Names) => nameOf(n, lang);
  const four = (ans: string, pool: { k: string; t: string }[]): Choice[] => sh([pool.find((c) => c.k === ans)!, ...pickSome(pool.filter((c) => c.k !== ans), 3, rnd)]);
  const planetPool = s.planets.map((p) => ({ k: p.id, t: nm(p) }));
  const moonPool = s.moons.map((m) => ({ k: m.id, t: moonName(m, lang) }));
  const hosts = [...s.planets, ...s.dwarfs].filter((p) => s.moons.some((m) => m.planet === p.id));
  switch (kind) {
    case "pp": { const p = s.planets.find((x) => x.id === id)!; return { key, kind, stem: { tpl: "这是哪颗行星？", args: [] }, fig: { t: "planet", id }, choices: four(id, planetPool), answer: id, explain: { text: p.intro } }; }
    case "pd": { const p = s.dwarfs.find((x) => x.id === id)!; return { key, kind, stem: { tpl: "这是哪颗矮行星？", args: [] }, fig: { t: "planet", id }, choices: four(id, s.dwarfs.map((d) => ({ k: d.id, t: nm(d) }))), answer: id, explain: { text: p.intro } }; }
    case "pm": { const m = s.moons.find((x) => x.id === id)!; const near = moonPool.filter((c) => s.moons.find((x) => x.id === c.k)!.planet === m.planet || rnd() < 0.5); return { key, kind, stem: { tpl: "这是哪颗卫星？", args: [] }, fig: { t: "moon", id }, choices: four(id, near.length >= 4 ? near : moonPool), answer: id, explain: { text: m.fact } }; }
    case "or": { const n = +id; const p = s.planets[n - 1]; return { key, kind, stem: { tpl: "从太阳向外数，第 {0} 颗行星是？", args: [String(n)] }, choices: four(p.id, planetPool), answer: p.id, explain: { text: p.intro } }; }
    case "sp": { const x = s.supers[+id]; return { key, kind, stem: { tpl: "哪颗行星{0}？", args: [x.q] }, choices: four(x.a, planetPool), answer: x.a, explain: { text: x.e } }; }
    case "mf": { const m = s.moons.find((x) => x.id === id)!; const near = moonPool.filter((c) => s.moons.find((x) => x.id === c.k)!.planet === m.planet || rnd() < 0.5); return { key, kind, stem: { tpl: "哪颗卫星{0}？", args: [m.q] }, choices: four(id, near.length >= 4 ? near : moonPool), answer: id, explain: { text: m.fact } }; }
    case "mo": { const m = s.moons.find((x) => x.id === id)!; const pool = hosts.map((p) => ({ k: p.id, t: nm(p) })); const extra = [...s.planets.filter((p) => !hosts.includes(p))].map((p) => ({ k: p.id, t: nm(p) })); return { key, kind, stem: { tpl: "{0}是哪颗行星（或矮行星）的卫星？", args: [moonName(m, lang)] }, choices: four(m.planet, [...pool, ...extra.slice(0, 2)]), answer: m.planet, explain: { text: m.fact } }; }
    case "ph": { const i = +id; const E = i * 45; const pool = PHASES.map((_, j) => ({ k: String(j), t: lang === "zh" ? PHASES[j] : tr(PHASES[j], lang) })); return { key, kind, stem: { tpl: "图中是什么月相？", args: [] }, fig: { t: "phase", id, E }, choices: four(String(i), pool), answer: String(i), explain: { tpl: "这是{0}，农历约{1}。", args: [PHASES[i], lunarDayOf(E)] } }; }
    case "cs": { const c = s.constellations.find((x) => x.id === id)!; return { key, kind, stem: { tpl: "这是哪个星座？", args: [] }, fig: { t: "const", id }, choices: four(id, s.constellations.map((x) => ({ k: x.id, t: nm(x) }))), answer: id, explain: { text: c.story } }; }
    case "mq": { const x = s.mcq[+id]; const all = sh([x.a, ...x.w]); return { key, kind, stem: { tpl: "{0}", args: [x.q] }, choices: all.map((t, i) => ({ k: String(i), t })), answer: String(all.indexOf(x.a)), explain: { text: x.e }, user: true }; }
    case "wt": {
      const kg = WEIGHTS[Math.floor(rnd() * WEIGHTS.length)];
      const body = id === "moon" ? { g: MOON_G, ...({ zh: "月球", en: "Moon", fr: "Lune" } as Names) } : s.planets.find((x) => x.id === id)!;
      const ans = fmtKg(weightOn(kg, body.g));
      const wrong = [...new Set(["moon", ...s.planets.map((p) => p.id)].filter((o) => o !== id).map((o) => fmtKg(weightOn(kg, o === "moon" ? MOON_G : s.planets.find((p) => p.id === o)!.g))).filter((v) => v !== ans))];
      const pick = sh([ans, ...pickSome(wrong, 3, rnd)]);
      return { key, kind, stem: { tpl: "体重 {0} 千克的人，在{1}上称出的体重约是多少千克？", args: [String(kg), nm(body)] }, choices: pick.map((t) => ({ k: t, t })), answer: ans, explain: { tpl: "{0} × {1} ÷ 9.81 ≈ {2}（千克）。", args: [String(kg), fmtKg(body.g), ans] }, user: true };
    }
  }
  throw new Error("unknown question " + key);
}
/** the questions of one round: what is due first, then what was never asked, then the rest; at most 3 of one kind in a round */
export function selectKeys(s: Space, doc: SpaceDoc, today: string, n = ROUND, rnd: () => number = Math.random): string[] {
  const keys = allKeys(s);
  const card = (k: string) => doc.cards[k];
  const due = keys.filter((k) => card(k) && card(k).due <= today).sort((a, b) => card(a).box - card(b).box || rnd() - 0.5);
  const fresh = G.shuffle(keys.filter((k) => !card(k)), rnd);
  const rest = keys.filter((k) => card(k) && card(k).due > today).sort((a, b) => card(a).box - card(b).box || rnd() - 0.5);
  const out: string[] = []; const count: Record<string, number> = {};
  for (const pass of [3, 99]) for (const k of [...due, ...fresh, ...rest]) {
    if (out.length >= n || out.includes(k)) continue;
    const kind = k.slice(0, 2);
    if ((count[kind] ?? 0) >= pass) continue;
    out.push(k); count[kind] = (count[kind] ?? 0) + 1;
  }
  return G.shuffle(out, rnd);
}
export const buildRound = (s: Space, doc: SpaceDoc, today: string, rnd: () => number = Math.random, lang: Lang = getLang()): Question[] => selectKeys(s, doc, today, ROUND, rnd).map((k) => makeQuestion(s, k, rnd, lang));
