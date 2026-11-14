/**
 * Languages: the app's texts are written in Chinese in the code. For the other languages they are translated at the
 * last moment, when they reach the screen (text nodes, title / placeholder attributes, confirm() boxes), using
 * the tables in i18n-data.ts. Texts with variable parts are stored as patterns like "上传中：{0}".
 * Choosing Chinese simply puts the original texts back.
 */
import { EN, FR } from "./i18n-data";
import CRAWL from "./i18n-extra/crawl.json";   // texts found by the crawl audit (97-no-chinese-crawl) and the lab texts not merged into i18n-data.ts yet: the table in i18n-data.ts wins

export type LangPref = "auto" | "zh" | "en" | "fr";
export type Lang = "zh" | "en" | "fr";
/** the languages of the interface, with their own names (the menu in Settings) */
export const LANGS: readonly (readonly [Exclude<LangPref, "auto">, string])[] = [["zh", "中文"], ["en", "English"], ["fr", "Français"]];

const cjk = /[　-〿一-鿿＀-￯]/;
let current: Lang = "zh";

export function resolveLang(pref: LangPref, nav: readonly string[] = navigator.languages?.length ? navigator.languages : [navigator.language || "en"]): Lang {
  if (pref !== "auto") return pref;
  for (const l of nav) {
    const p = l.toLowerCase();
    if (p.startsWith("zh")) return "zh";
    if (p.startsWith("fr")) return "fr";
    if (p.startsWith("en")) return "en";
  }
  return "en";
}

interface Pattern { re: RegExp; out: string; weight: number }
interface Table { exact: Map<string, string>; pats: Pattern[] }
const tables: Partial<Record<Lang, Table>> = {};

function buildTable(src: Record<string, string>): Table {
  const exact = new Map<string, string>();
  const pats: Pattern[] = [];
  for (const [k, v] of Object.entries(src)) {
    const key = k.trim();
    if (/\{\d+\}/.test(key)) {
      const lit = key.replace(/\{\d+\}/g, "");
      const re = new RegExp("^" + key.split(/\{\d+\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("([\\s\\S]*?)") + "$");
      pats.push({ re, out: v.trim(), weight: lit.length });
    } else exact.set(key, v.trim());
  }
  pats.sort((a, b) => b.weight - a.weight);
  return { exact, pats };
}
const late = (i: 0 | 1): Record<string, string> => Object.fromEntries(Object.entries(CRAWL as Record<string, string[]>).map(([k, v]) => [k, v[i]]));
const SOURCES: Record<Exclude<Lang, "zh">, Record<string, string>> = { en: { ...late(0), ...EN }, fr: { ...late(1), ...FR } };
const tableFor = (l: Lang): Table | null => (l === "zh" ? null : (tables[l] ??= buildTable(SOURCES[l])));

// ---------- context (one Chinese text, two meanings) ----------
// The tables are keyed by the Chinese text, so one text used with two meanings would get ONE translation. `cx(text, ctx)` gives the minority use its own key
// `text@ctx` (written like that in i18n-data.ts) WITHOUT changing what a Chinese reader sees: the context is appended as invisible characters
// (INVISIBLE SEPARATOR + the ASCII code of every letter of ctx as 8 zero-width bits), which stay in the DOM, so the choice survives a switch of language.
// `tr` looks up `text@ctx` first and falls back to the plain `text`. The marked text must be the whole text of its element / attribute.
const CX_MARK = "\u2063", CX_0 = "\u200b", CX_1 = "\u200c";
const CX_RE = new RegExp(`${CX_MARK}([${CX_0}${CX_1}]+)`, "g");
export function cx(text: string, ctx: string): string {
  let bits = "";
  for (const ch of ctx) bits += (ch.charCodeAt(0) & 255).toString(2).padStart(8, "0");
  return text + CX_MARK + bits.replace(/0/g, CX_0).replace(/1/g, CX_1);
}
/** the text without its context marks, and the context ("" when there is none) */
export function splitCx(s: string): { text: string; ctx: string } {
  if (!s.includes(CX_MARK)) return { text: s, ctx: "" };
  let ctx = "";
  const text = s.replace(CX_RE, (_, b: string) => {
    if (!ctx) { const bits = b.replace(new RegExp(CX_0, "g"), "0").replace(new RegExp(CX_1, "g"), "1"); for (let i = 0; i + 8 <= bits.length; i += 8) ctx += String.fromCharCode(parseInt(bits.slice(i, i + 8), 2)); }
    return "";
  });
  return { text, ctx };
}

/** translate one text (leading / trailing white space is kept). Unknown texts are returned unchanged. */
export function tr(s: string, lang: Lang = current): string {
  if (lang === "zh" || !s || !cjk.test(s)) return s;
  if (s.includes(CX_MARK)) {
    const { text, ctx } = splitCx(s);
    const withCtx = ctx ? tr(text.trimEnd() + "@" + ctx, lang) : text;
    // a text that has a translation of its own for this context; else the plain one (the marks never reach the screen)
    return ctx && withCtx !== text.trimEnd() + "@" + ctx ? withCtx + text.slice(text.trimEnd().length) : tr(text, lang);
  }
  const t = tableFor(lang)!;
  const core = s.trim();
  let out = t.exact.get(core);
  if (out === undefined) {
    for (const p of t.pats) {
      const m = p.re.exec(core);
      if (!m) continue;
      const args = m.slice(1).map((x) => tr(x, lang));
      out = p.out.replace(/\{(\d+)\}/g, (_, i) => args[Number(i)] ?? "");
      break;
    }
  }
  if (out === undefined) return s;
  return s.slice(0, s.length - s.trimStart().length) + out + s.slice(s.trimEnd().length);
}

/** the translation of a text that is a whole table entry (no patterns, nothing translated piece by piece); undefined when there is none */
export function trExact(s: string, lang: Lang = current): string | undefined {
  if (lang === "zh") return undefined;
  return tableFor(lang)!.exact.get(s.trim());
}

// ---------- DOM ----------
const ATTRS = ["title", "placeholder", "aria-label", "alt"];
const texts = new WeakMap<Text, { orig: string; shown: string }>();
const attrs = new WeakMap<Element, Record<string, { orig: string; shown: string }>>();
const SKIP = new Set(["SVG", "SCRIPT", "STYLE", "CANVAS"]); // (a TEXTAREA keeps its content, but its placeholder / title are translated)

/** the user's own texts (names, characters, idioms) are marked with these classes and are never translated */
const isUser = (n: Node) => !!(n.parentElement ?? (n as Element)).closest?.(".user, .user-title");

function doText(n: Text) {
  if (isUser(n)) return;
  const rec = texts.get(n);
  const base = rec && n.nodeValue === rec.shown ? rec.orig : (n.nodeValue ?? "");
  if (!rec && !cjk.test(base)) return;
  const shown = tr(base);
  if (shown !== n.nodeValue) n.nodeValue = shown;
  texts.set(n, { orig: base, shown });
}
function doAttr(el: Element, name: string) {
  const v = el.getAttribute(name);
  if (v === null) return;
  const all = attrs.get(el) ?? {};
  const rec = all[name];
  const base = rec && v === rec.shown ? rec.orig : v;
  if (!rec && !cjk.test(base)) return;
  const shown = tr(base);
  if (shown !== v) el.setAttribute(name, shown);
  all[name] = { orig: base, shown };
  attrs.set(el, all);
}
function walk(node: Node) {
  if (node.nodeType === Node.TEXT_NODE) return doText(node as Text);
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  for (const a of ATTRS) doAttr(el, a);   // (also on svg / canvas: their aria-label / title are read aloud; only their CHILDREN are left alone)
  if (SKIP.has(el.tagName.toUpperCase())) return;
  if (el.tagName.toUpperCase() === "TEXTAREA") return;
  for (let c = el.firstChild; c; c = c.nextSibling) walk(c);
}

let observer: MutationObserver | null = null;
function observe() {
  if (observer) return;
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "childList") m.addedNodes.forEach(walk);
      else if (m.type === "characterData") doText(m.target as Text);
      else if (m.type === "attributes" && m.attributeName) doAttr(m.target as Element, m.attributeName);
    }
  });
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

let patched = false;
function patchDialogs() {
  if (patched) return;
  patched = true;
  for (const k of ["confirm", "alert", "prompt"] as const) {
    const orig = window[k].bind(window) as (m?: string, d?: string) => unknown;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any)[k] = (m?: string, d?: string) => orig(m === undefined ? m : tr(String(m)), d);
  }
}

/** translates what is below `root` RIGHT NOW (the observer does it a moment later): for code that measures text, which must be measured as it will be shown */
export function translateNow(root: Node) { if (current !== "zh") walk(root); }

export const getLang = (): Lang => current;

/** Switch the language of everything on screen and of everything created from now on. */
export function setLang(pref: LangPref) {
  current = resolveLang(pref);
  document.documentElement.lang = current === "zh" ? "zh-CN" : current;
  document.title = tr("学习乐园", current);   // (the browser tab / home-screen name follows the language too)
  patchDialogs();
  observer?.disconnect();
  observer = null;
  walk(document.documentElement); // translate (or restore) what is already there
  if (current !== "zh") observe();
}
