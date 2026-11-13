/**
 * 编程 worlds 14-16: the content (src/data/coding-info.json, written by a model from memory by scripts/make-coding-info.py; a 信息科技 teacher must proofread).
 * Loaded when first needed (a lazy import, compiled into the build: works offline). Texts that are content (lessons, scenarios, cards) are shown in `user` boxes.
 */
import { getLang } from "./i18n";

export type Tri = [string, string, string];
export interface InfoAct {
  id: string; world: number; no: number; title: Tri; lesson: string; kind: string;
  spec: Record<string, any>;
  /** the task (the quiz kind takes the prompt of each generator from `genPrompts`) */
  prompt?: Tri; hints?: string[]; boss?: boolean;
}
export interface InfoLesson { title: Tri; steps: { t: string; d: { k: string; [key: string]: unknown } }[] }
export interface DevText { title: Tri; goal: Tri; lesson: string; hints: string[]; msgs: string[]; scenarios?: string[] }
export interface InfoContent {
  worlds: Record<string, { name: Tri; lesson: string }>;
  lessons: Record<string, InfoLesson>;
  acts: InfoAct[];
  genPrompts: Record<string, Tri>;
  kindHints: Record<string, string[]>;
  labels: Record<string, Tri>;
  dev: Record<string, DevText>;
  projects: Record<string, { name: Tri; text: string }>;
}
let cache: InfoContent | null = null;
export async function loadContent(): Promise<InfoContent> {
  if (!cache) cache = ((await import("./data/coding-info.json")) as unknown as { default: InfoContent }).default;
  return cache;
}
export const contentNow = (): InfoContent | null => cache;
export const langIndex = (): number => { const l = getLang(); return l === "zh" ? 0 : l === "en" ? 1 : 2; };
/** a text in the language of the screen (a triple Chinese / English / French) */
export const L = (t: Tri | string | undefined): string => (t === undefined ? "" : typeof t === "string" ? t : t[langIndex()] ?? t[0]);
export const WORLD_IDS = [14, 15, 16] as const;
export const actsOf = (c: InfoContent, world: number): InfoAct[] => c.acts.filter((a) => a.world === world).sort((a, b) => a.no - b.no);
/** the filled template "... {0} ... {1}" */
export const fill = (t: string, args: (string | number)[]): string => t.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? ""));
