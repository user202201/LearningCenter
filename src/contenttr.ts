/**
 * Translated CONTENT (rule 65): the formulas (`data/formulas.json`) and the summaries (`data/notes.json`, with their drawings) are written in Chinese.
 * Their English / French texts live in flat files `data/trans/<lang>.json` = { exact Chinese source string -> translation } (made by
 * `scripts/make-trans.mjs` from the part files in `data/trans/parts/`), imported lazily (compiled into the build, so they work offline).
 * `ct(text)` returns the translation for the screen language (Chinese: the text itself; a text without a translation: the text itself).
 * A screen awaits `loadContentTr()` before it draws such content.
 */
import { getLang, type Lang } from "./i18n";

const maps: Partial<Record<Lang, Record<string, string>>> = {};
const cjk = /[一-鿿]/;

/** load the translation table of a language (nothing to load for Chinese) */
export async function loadContentTr(lang: Lang = getLang()): Promise<void> {
  if (lang === "zh" || maps[lang]) return;
  try {
    maps[lang] = ((lang === "en" ? await import("./data/trans/en.json") : await import("./data/trans/fr.json")) as { default: Record<string, string> }).default;
  } catch { maps[lang] = {}; }
}

/** the text in the language of the screen (Chinese source text in, unknown text unchanged) */
export function ct(text: string, lang: Lang = getLang()): string {
  if (lang === "zh" || !text || !cjk.test(text)) return text;
  return maps[lang]?.[text] ?? text;
}

/** is there a translation (tests and tools) */
export const hasCt = (text: string, lang: Lang = getLang()): boolean => lang === "zh" || !cjk.test(text) || !!maps[lang]?.[text];

/**
 * Translate the labels (`<text>`) of a drawing in place. A longer label is made smaller so that it stays inside its box (the rectangle it sits in)
 * and inside the drawing; the Chinese label stays in `data-zh`.
 */
export function translateFigure(root: Element, lang: Lang = getLang()): void {
  if (lang === "zh") return;
  const svg = root.querySelector("svg");
  const vb = (svg?.getAttribute("viewBox") ?? "0 0 240 150").split(/\s+/).map(Number);
  const vw = vb[2] || 240;
  for (const el of Array.from(root.querySelectorAll("text"))) {
    if (el.children.length) continue;
    const zh = el.textContent ?? "";
    if (!cjk.test(zh)) continue;
    const out = ct(zh, lang);
    if (out === zh) continue;
    el.setAttribute("data-zh", zh);
    el.textContent = out;
    const size = parseFloat(el.getAttribute("font-size") ?? "12") || 12;
    const x = parseFloat(el.getAttribute("x") ?? "0") || 0;
    const anchor = el.getAttribute("text-anchor") ?? "start";
    const prev = el.previousElementSibling;
    let avail = anchor === "middle" ? Math.min(x - 2, vw - 2 - x) * 2 : anchor === "end" ? x - 2 : vw - 2 - x;
    if (prev && prev.tagName.toLowerCase() === "rect") {
      const rx = parseFloat(prev.getAttribute("x") ?? "0"), rw = parseFloat(prev.getAttribute("width") ?? "0");
      if (rw > 0 && Math.abs(rx + rw / 2 - x) < 1.5 && anchor === "middle") avail = Math.min(avail, rw - 4);
    }
    const width = [...out].length * size * 0.6;
    if (width > avail && avail > 0) el.setAttribute("font-size", String(Math.max(5.5, +(size * avail / width).toFixed(2))));
  }
}
