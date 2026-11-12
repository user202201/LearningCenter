/**
 * Typeset maths: fractions stacked over each other, exponents and subscripts, roots, arrows with the condition over them, italic letters - the way a book prints
 * them. Done with KaTeX (MIT; compiled into the app with only the fonts it needs, so it works offline). KaTeX is loaded the first time a formula is shown;
 * until then (and when it cannot be loaded) the plain text is shown, so nothing ever depends on it.
 *
 * Three ways in:
 *  - `$...$` inside a text is TeX (the formulas of the data files are written like that);
 *  - `whole: true`: the whole text is a formula written in plain characters (the math game: "3/4 + 5/6 = ?", "x²+5x+6"): it is converted to TeX;
 *  - otherwise (a sentence with Chinese / English words): only the fractions, roots and exponents inside the sentence are typeset.
 */
import "./katex-lite.css";

type Katex = { renderToString(tex: string, opts?: Record<string, unknown>): string };
let katexP: Promise<Katex> | null = null;
/** KaTeX, loaded on first use */
export const loadKatex = (): Promise<Katex> => (katexP ??= import("katex").then((m) => ((m as unknown as { default?: Katex }).default ?? (m as unknown as Katex))));

const SUP: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const SUB: Record<string, string> = { "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9" };
const CJK = /[　-〿一-鿿＀-￯]/;
/** a text that is only maths written in plain characters */
const MATHY = /^[0-9A-Za-z\s+\-−×÷=<>(),.:?%√²³⁴⁵⁶⁷⁸⁹⁰¹₀₁₂₃₄₅₆₇₈₉○°π/*^·]+$/;
export const isMathy = (t: string): boolean => MATHY.test(t) && /[\d=+\-−×÷<>/√²³]/.test(t);

/** plain characters -> TeX (for a whole formula) */
export function toTeX(t: string, big = false): string {
  let s = t;
  s = s.replace(/(\d*)√(\d+)/g, (_m, k, n) => `${k}\\sqrt{${n}}`);
  const operand = "(?:\\d*\\\\sqrt\\{\\d+\\}|\\d+(?:\\.\\d+)?|[a-zA-Z])";
  s = s.replace(new RegExp(`(${operand})\\/(${operand})`, "g"), (_m, a, b) => `\\${big ? "dfrac" : "frac"}{${a}}{${b}}`);
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^{${[...m].map((c) => SUP[c]).join("")}}`);
  s = s.replace(/[₀₁₂₃₄₅₆₇₈₉]+/g, (m) => `_{${[...m].map((c) => SUB[c]).join("")}}`);
  return s.replace(/×/g, "\\times ").replace(/÷/g, "\\div ").replace(/−/g, "-").replace(/○/g, "\\bigcirc ").replace(/°/g, "^{\\circ}").replace(/π/g, "\\pi ").replace(/·/g, "\\cdot ").replace(/%/g, "\\%").replace(/\*/g, "\\ast ");
}

/** the fractions, roots and exponents inside a sentence marked as `$...$` pieces (a sentence is never made a formula as a whole) */
export function markTokens(t: string): string {
  if (t.includes("$")) return t;
  const re = /(?<![\d.])(-?−?\d*√\d+|-?−?\d+\/\d+(?![\d/])|-?−?\d+\/[a-z](?![a-zA-Z])|(?:\([^()]*\)|[0-9a-zA-Z.]+)[²³⁴⁵⁶⁷⁸⁹]+)/g;
  return t.replace(re, (m) => `$${toTeX(m)}$`);
}

/** the pieces of a text: plain text and TeX */
export function pieces(text: string, whole: boolean): { tex: boolean; s: string }[] {
  if (whole && !text.includes("$") && isMathy(text)) return [{ tex: true, s: toTeX(text, true) }];
  const marked = markTokens(text);
  const out: { tex: boolean; s: string }[] = [];
  marked.split("$").forEach((s, i) => { if (s) out.push({ tex: i % 2 === 1, s }); });
  return out;
}
/** the text without the `$` marks (what is tested / shown if KaTeX is not there) */
export const plain = (text: string): string => text.replace(/\$/g, "");

/**
 * Shows `text` in `el`: the plain text at once, the typeset version as soon as KaTeX is there. `whole` = the text is a formula in plain characters.
 * The plain text stays in `data-plain` (tests, and the check of an answer, read that). Texts with nothing to typeset are left alone.
 */
export function renderRich(el: HTMLElement, text: string, whole = false): void {
  el.dataset.plain = plain(text);
  const parts = pieces(text, whole && !CJK.test(text));
  el.textContent = plain(text);
  if (!parts.some((p) => p.tex)) return;
  void loadKatex().then((k) => {
    if (el.dataset.plain !== plain(text)) return;   // (something else was put there meanwhile)
    const nodes = parts.map((p) => {
      if (!p.tex) return document.createTextNode(p.s);
      const span = document.createElement("span");
      span.className = "mx";
      span.setAttribute("role", "math");
      span.setAttribute("aria-label", p.s);
      span.innerHTML = k.renderToString(p.s, { throwOnError: false, output: "html", strict: "ignore" });
      return span;
    });
    el.replaceChildren(...nodes);
    el.dispatchEvent(new CustomEvent("mx-rendered", { bubbles: true }));
  }).catch(() => { /* the plain text stays */ });
}

/** one formula of the formulas page: the TeX typeset; the plain text is shown until KaTeX is there */
export function renderTeX(el: HTMLElement, tex: string, fallback = tex): void {
  el.textContent = fallback;
  el.dataset.plain = fallback;
  void loadKatex().then((k) => { el.innerHTML = k.renderToString(tex, { throwOnError: false, output: "html", displayMode: false, strict: "ignore" }); el.classList.add("mx"); }).catch(() => { /* plain */ });
}
