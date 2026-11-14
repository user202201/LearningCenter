/** Small helpers shared by the 天文 screens: canvases measured by LAYOUT size, one animation loop that stops when the page is left, number and time texts, sentences with names. */
import { h } from "./ui";
import { tr } from "./i18n";
import { allBodies, type Space, type Body, lightParts } from "./spacemodel";

export const reducedMotion = (): boolean => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
/** sizes a canvas to its LAYOUT size (offsetWidth / offsetHeight: never getBoundingClientRect, a scale animation would change it) times the device pixel ratio; returns the context in CSS pixels */
export function fit(cv: HTMLCanvasElement): { c: CanvasRenderingContext2D; w: number; h: number } {
  const w = Math.max(1, cv.offsetWidth), hh = Math.max(1, cv.offsetHeight), dpr = Math.min(3, window.devicePixelRatio || 1);
  const W = Math.round(w * dpr), H = Math.round(hh * dpr);
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext("2d")!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, w, h: hh };
}
/** an animation loop that ends by itself when `root` is no longer in the page; `step(dtSeconds)` returns true when something must be drawn */
export class Loop {
  private raf = 0; private last = 0; private dead = false;
  constructor(private root: HTMLElement, private step: (dt: number) => void, private always = false) {}
  start(): void { if (this.raf || this.dead || reducedMotion()) return; this.last = performance.now(); const tick = (t: number) => { this.raf = 0; if (this.dead) return; if (!this.root.isConnected) return this.stop(); const dt = Math.min(0.1, (t - this.last) / 1000); this.last = t; this.step(dt); this.raf = requestAnimationFrame(tick); }; this.raf = requestAnimationFrame(tick); }
  stop(): void { this.dead = true; if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }
  get running(): boolean { return !!this.raf; }
}
export const big = (x: number): string => Math.round(x).toLocaleString("en-US");
/** a number with `digits` significant digits (no trailing zeros) */
export const sig = (x: number, digits = 3): string => { const s = Number(x.toPrecision(digits)); return Math.abs(s) >= 1e6 ? big(s) : String(s); };
/** a distance in kilometres: "149.6 百万千米" / "4879 千米" (the texts are translated as patterns) */
export const kmText = (km: number): string => (km >= 1e6 ? `${sig(km / 1e6, 4)} 百万千米` : `${big(km)} 千米`);
/** a duration in days: days, or Earth years from two years on */
export const durText = (days: number): string => (Math.abs(days) >= 730 ? `${sig(Math.abs(days) / 365.256, 3)} 地球年` : `${sig(Math.abs(days), 4)} 地球日`);
export const hoursText = (hours: number): string => { const x = Math.abs(hours); return x >= 48 ? `${sig(x / 24, 4)} 地球日` : `${sig(x, 4)} 小时`; };
export const lightText = (sec: number): string => {
  const { h: hh, m, s } = lightParts(sec);
  if (sec < 60) return `${sig(sec, 3)} 秒`;
  if (hh) return `${hh} 小时 ${m} 分`;
  return `${m} 分 ${s} 秒`;
};
export const tempText = (b: Body): string => `${b.tmin} ~ ${b.tmax} ℃`;
/** a sentence with {0} {1} ...: the sentence is translated, the names in it are the user's own texts (never translated) */
export function fmt(tpl: string, args: string[]): (Node | string)[] {
  const s = tr(tpl), out: (Node | string)[] = [];
  let last = 0;
  for (const m of s.matchAll(/\{(\d+)\}/g)) { out.push(s.slice(last, m.index)); out.push(h("span", { class: "user" }, args[Number(m[1])] ?? "")); last = (m.index ?? 0) + m[0].length; }
  out.push(s.slice(last));
  return out.filter((x) => x !== "");
}
export const user = (text: string, tag: "span" | "p" | "div" | "b" = "span", cls = ""): HTMLElement => h(tag, { class: ("user " + cls).trim() }, text);
/** a text of the course content (rule 66): translated into the screen language like the UI, not a `user` text */
export const con = (text: string, tag: "span" | "p" | "div" | "b" = "span", cls = ""): HTMLElement => h(tag, cls ? { class: cls } : {}, tr(text));
/** the position of a body for a tap test: the nearest of `list` (each with x, y, r) within r + slack */
export function nearest<T extends { x: number; y: number; r: number }>(list: T[], x: number, y: number, slack = 12): T | null {
  let best: T | null = null, bd = Infinity;
  for (const b of list) { const d = Math.hypot(b.x - x, b.y - y); if (d <= b.r + slack && d < bd) { best = b; bd = d; } }
  return best;
}
export const planetsAndDwarfs = (s: Space): Body[] => allBodies(s);
export const chips = (opts: { id: string; label: string; on: boolean; click: () => void }[]): { el: HTMLElement; set: (id: string) => void } => {
  const els = opts.map((o) => h("button", { class: "mopt" + (o.on ? " on" : ""), id: o.id, "data-v": o.id, onclick: () => { o.click(); } }, o.label));
  return { el: h("div", { class: "mset-opts sp-chips" }, ...els), set: (id: string) => els.forEach((e) => e.classList.toggle("on", e.id === id)) };
};
