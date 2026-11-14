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

let ruler: SVGTextElement | null = null;
/** the width of a label as the drawings write it (bold, 700): measured on a hidden SVG text, estimated where there is no layout */
function textWidth(txt: string, size: number): number {
  try {
    if (!ruler) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("style", "position:absolute;left:-9999px;top:0;width:0;height:0;visibility:hidden");
      svg.setAttribute("aria-hidden", "true");
      ruler = document.createElementNS("http://www.w3.org/2000/svg", "text");
      ruler.setAttribute("font-weight", "700");
      ruler.setAttribute("font-family", "system-ui, 'Times New Roman', serif");
      svg.append(ruler);
      document.body.append(svg);
    }
    ruler.setAttribute("font-size", String(size));
    ruler.textContent = txt;
    const w = ruler.getComputedTextLength();
    if (w > 0) return w + 1;
  } catch { /* no layout */ }
  return [...txt].length * size * 0.62;
}

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
    const fit = (txt: string, avail: number, size0: number) => { const w = textWidth(txt, size0); return w > avail ? size0 * avail / w : size0; };
    let fs = fit(out, avail, size);
    if (fs < Math.min(size, 7.5) && out.includes(" ")) {
      // too long for one line even when small: two lines, split at the space nearest the middle
      const spaces = [...out].map((c, i) => (c === " " ? i : -1)).filter((i) => i >= 0);
      const mid = spaces.reduce((best, i) => (Math.abs(i - out.length / 2) < Math.abs(best - out.length / 2) ? i : best), spaces[0]);
      const l1 = out.slice(0, mid), l2 = out.slice(mid + 1);
      fs = Math.max(fit(l1, avail, size), 0) < fit(l2, avail, size) ? fit(l1, avail, size) : fit(l2, avail, size);
      fs = Math.min(size, fs);
      const y = parseFloat(el.getAttribute("y") ?? "0") || 0;
      el.textContent = "";
      for (const [i, line] of [l1, l2].entries()) {
        const sp = el.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "tspan");
        sp.setAttribute("x", String(x));
        sp.setAttribute("dy", i === 0 ? "0" : "1.05em");
        sp.textContent = line;
        el.append(sp);
      }
      el.setAttribute("y", String(+(y - fs * 0.45).toFixed(2)));
    }
    if (fs < size) el.setAttribute("font-size", String(Math.max(5.5, +fs.toFixed(2))));
  }
}
