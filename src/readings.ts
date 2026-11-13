/**
 * The weekly English reading (no screens, no storage): `src/data/english-readings.json` holds 52 short passages for each grade 1-9 (week 1 ... 52 of the year),
 * each with a few glossed words (Chinese and French) and three comprehension questions. The passage of a week is chosen by the date of the week, so every device
 * shows the same one and nothing needs to be saved. Original texts and adaptations of public-domain works (see `src`); nothing is fetched.
 */
export interface Gloss { w: string; zh: string; fr: string }
export interface ReadQ { q: string; a: string; w: string[] }
export interface Reading { w: number; t: string; text: string; src: string; gl: Gloss[]; q: ReadQ[] }

let cache: Record<string, Reading[]> | null = null;
export async function loadReadings(): Promise<Record<string, Reading[]>> {
  if (cache) return cache;
  cache = (await import("./data/english-readings.json")).default.grades as unknown as Record<string, Reading[]>;
  return cache;
}
/** the number (1-52) of the week of the year a Sunday (YYYY-MM-DD) belongs to */
export function weekOfYear(sunday: string): number {
  const d = Date.parse(`${sunday}T00:00:00Z`), y0 = Date.UTC(new Date(d).getUTCFullYear(), 0, 1);
  return Math.min(52, Math.floor((d - y0) / (7 * 86400000)) + 1);
}
/** the passage of a grade for a week (grades without passages: none) */
export const readingFor = (all: Record<string, Reading[]>, grade: number, sunday: string): Reading | undefined => {
  const list = all[String(grade)];
  if (!list?.length) return undefined;
  const w = weekOfYear(sunday);
  return list.find((r) => r.w === w) ?? list[(w - 1) % list.length];
};
/** the glossary entry of a word as it stands in the text (plural / -ed / -ing forms of a glossed word count) */
export function glossOf(gl: Gloss[], word: string): Gloss | undefined {
  const x = word.toLowerCase().replace(/’/g, "'");
  return gl.find((g) => { const b = g.w.toLowerCase(); return x === b || (b.length >= 4 && x.startsWith(b.slice(0, Math.max(4, b.length - 2)))); });
}
