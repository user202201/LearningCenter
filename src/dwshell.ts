/**
 * What the dictation (听写) and finger writing (写字) screens share (rule 51): the hooks into the app shell (main.ts gives them in `initDictWrite`), the
 * settings of this device, the page frame with the hero band, the icons and the voice (the device's own `speechSynthesis`, offline).
 */
import { h } from "./ui";
import type * as M from "./model";
import type { Ctx } from "./english";

/** the shell of the app plus the idioms (shared by every child) */
export interface DwCtx extends Ctx { idioms(): M.IdiomsFile }
export let X!: DwCtx;
export const initDictWrite = (c: DwCtx) => { X = c; };

export const errText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** the week the child's page was showing when a button was pressed (the Chinese week page keeps it in main.ts) */
let week = "";
export const setWeek = (start: string): void => { week = start; };
export const weekOr = (fallback: string): string => week || fallback;
export const clearWeek = (): void => { week = ""; };

// ---------- settings of this device (conveniences only: a private window just forgets them) ----------
const KEY = "learn.dictwrite.v1";
export interface DwSettings { pause: number; idioms: boolean; last: boolean; screen: boolean; mode: "trace" | "recite" }
const DEFAULTS: DwSettings = { pause: 5, idioms: false, last: false, screen: false, mode: "trace" };
export function loadSettings(): DwSettings {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || "{}") as Partial<DwSettings>;
    return { ...DEFAULTS, ...s, pause: [3, 5, 8, 10].includes(s.pause ?? 0) ? s.pause! : DEFAULTS.pause, mode: s.mode === "recite" ? "recite" : "trace" };
  } catch { return { ...DEFAULTS }; }
}
export function saveSettings(patch: Partial<DwSettings>): DwSettings {
  const next = { ...loadSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* no storage: the choice lasts until the page is closed */ }
  return next;
}

export const reduced = (): boolean => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ---------- the voice ----------
/**
 * Says `text` with the device's voice in `lang` ("zh-CN", "en-US", "fr-FR") and calls `done` when it has been said. Without a voice, or when the voice never
 * reports its end, `done` is still called (after a short while), so a dictation never waits for a speech that does not come.
 */
export function say(text: string, lang: string, done: () => void, rate = 0.8): () => void {
  let called = false, fallback = 0;
  const finish = () => { if (called) return; called = true; window.clearTimeout(fallback); done(); };
  try {
    const s = window.speechSynthesis;
    if (!s) { fallback = window.setTimeout(finish, 1200); return () => { called = true; window.clearTimeout(fallback); }; }
    s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang; u.rate = rate;
    u.onend = finish; u.onerror = finish;
    s.speak(u);
    fallback = window.setTimeout(finish, 12000);
  } catch { fallback = window.setTimeout(finish, 1200); }
  return () => { called = true; window.clearTimeout(fallback); try { window.speechSynthesis?.cancel(); } catch { /* nothing to cancel */ } };
}
export const stopSpeech = (): void => { try { window.speechSynthesis?.cancel(); } catch { /* no speech here */ } };

// ---------- icons ----------
const SVG = "http://www.w3.org/2000/svg";
export function icon(name: "prev" | "next" | "pause" | "play" | "repeat" | "speaker" | "tick" | "cross" | "star", cls = ""): SVGSVGElement {
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", "0 0 48 48"); s.setAttribute("aria-hidden", "true"); if (cls) s.setAttribute("class", cls);
  const body: Record<string, string> = {
    prev: '<path d="M14 10v28M38 10L18 24l20 14z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>',
    next: '<path d="M34 10v28M10 10l20 14-20 14z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>',
    pause: '<path d="M15 10v28M33 10v28" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>',
    play: '<path d="M14 8l26 16-26 16z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>',
    repeat: '<path d="M38 24a14 14 0 1 1-5-10.7M38 6v9h-9" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
    speaker: '<path d="M6 18h8l10-8v28l-10-8H6z" fill="currentColor"/><path d="M31 17a10 10 0 0 1 0 14M36 11a18 18 0 0 1 0 26" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>',
    tick: '<path d="M9 25l10 10L39 13" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>',
    cross: '<path d="M12 12l24 24M36 12L12 36" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>',
    star: '<path d="M24 4l6 13 14 2-10 10 3 14-13-7-13 7 3-14L4 19l14-2z" stroke-width="2" stroke-linejoin="round"/>',
  };
  s.innerHTML = body[name];
  return s;
}

/** the page frame of the new screens: the hero band (back, title) in the child's colour, the body below */
export function frame(k: M.Kid, title: string, backTo: string, body: HTMLElement, extra = ""): HTMLElement {
  return h("div", { class: `page dw-page ${extra}`.trim(), style: `--kid:${k.color}` },
    h("header", { class: "top hero kid-hero dw-hero" }, X.back(backTo, "返回"), h("h1", {}, title), h("span", { class: "slot" })),
    body);
}
/** a ring (the countdown): a circle that drains; `set(ratio)` moves it */
export function ring(): { el: SVGSVGElement; set(ratio: number): void } {
  const R = 46, C = 2 * Math.PI * R;
  const s = document.createElementNS(SVG, "svg");
  s.setAttribute("viewBox", "0 0 100 100"); s.setAttribute("class", "dw-ring"); s.setAttribute("aria-hidden", "true");
  const bg = document.createElementNS(SVG, "circle"), fg = document.createElementNS(SVG, "circle");
  for (const c of [bg, fg]) { c.setAttribute("cx", "50"); c.setAttribute("cy", "50"); c.setAttribute("r", String(R)); }
  bg.setAttribute("class", "bg"); fg.setAttribute("class", "fg");
  (fg as SVGCircleElement).style.strokeDasharray = String(C);
  s.append(bg, fg);
  return { el: s, set: (ratio) => { (fg as SVGCircleElement).style.strokeDashoffset = String(C * (1 - Math.max(0, Math.min(1, ratio)))); } };
}
