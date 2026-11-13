/**
 * Drawings of the chemistry page, made in code (inline SVG, Latin letters and digits only): the balance scale of an element, the apparatus of the gas
 * preparation (A, B = generators; C, D, E = ways to collect), the cross-method picture and the card icon.
 */
import { sub } from "./chemlogic";

const GREEN = "#2f9e44", ORANGE = "#e8590c", INK = "#364152";

/** one scale: the beam turns toward the heavier side (left = atoms of the reactants); green when both sides are equal */
export function scaleSvg(e: string, l: number, r: number): string {
  const eq = l === r;
  const ang = Math.max(-18, Math.min(18, (l - r) * 4)) * Math.PI / 180;   // positive: the left side is heavier (goes down)
  const cx = 50, cy = 22, len = 36;
  const lx = cx - len * Math.cos(ang), ly = cy + len * Math.sin(ang), rx = cx + len * Math.cos(ang), ry = cy - len * Math.sin(ang);
  const col = eq ? GREEN : ORANGE;
  const pan = (x: number, y: number, n: number) => `<line x1="${x}" y1="${y}" x2="${x - 11}" y2="${y + 15}" stroke="${INK}" stroke-width="1.4"/><line x1="${x}" y1="${y}" x2="${x + 11}" y2="${y + 15}" stroke="${INK}" stroke-width="1.4"/><path d="M${x - 14} ${y + 15} h28 a14 14 0 0 1 -28 0z" fill="${col}" stroke="${INK}" stroke-width="1.2"/><text x="${x}" y="${y + 28}" font-size="14" font-weight="800" text-anchor="middle" fill="#fff">${n}</text>`;
  return `<svg viewBox="0 0 100 94" role="img" aria-label="${e} ${l} ${r}"><path d="M42 74 L50 24 L58 74z" fill="#d0bfff"/><rect x="34" y="72" width="32" height="5" rx="2.5" fill="#9775fa"/>` +
    `<line x1="${lx.toFixed(1)}" y1="${ly.toFixed(1)}" x2="${rx.toFixed(1)}" y2="${ry.toFixed(1)}" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="4" fill="${col}"/>` +
    pan(+lx.toFixed(1), +ly.toFixed(1), l) + pan(+rx.toFixed(1), +ry.toFixed(1), r) + `<text x="50" y="91" font-size="15" font-weight="800" text-anchor="middle" fill="${col}">${e}</text></svg>`;
}

const FRAME = (id: string, body: string) => `<svg viewBox="0 0 130 112" class="chem-app" data-app="${id}" role="img" aria-label="${id}">${body}<text x="6" y="16" font-size="15" font-weight="800" fill="#5430b8">${id}</text></svg>`;
const glass = `fill="#e7f5ff" stroke="${INK}" stroke-width="2"`;
const lamp = `<rect x="38" y="90" width="26" height="14" rx="4" fill="#ffd8a8" stroke="${INK}" stroke-width="1.6"/><rect x="49" y="84" width="4" height="7" fill="${INK}"/><path d="M51 66 q-6 10 0 17 q6 -7 0 -17z" fill="#ff922b"/>`;
const tube = (d: string) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
const APPS: Record<string, string> = {
  // A: a test tube (slightly slanted, mouth down) with a solid, heated by a lamp
  A: FRAME("A", `<g transform="rotate(-12 60 60)"><rect x="24" y="48" width="56" height="20" rx="10" ${glass}/><rect x="30" y="58" width="20" height="8" rx="4" fill="#9c36b5" opacity=".75"/><rect x="76" y="52" width="9" height="12" rx="2" fill="#b08968"/></g>` + tube("M84 51 L98 47 L108 47 L108 22 L116 22") + lamp),
  // B: a flask with a funnel (liquid added from above), no heating
  B: FRAME("B", `<path d="M50 38 h24 l2 8 l22 44 q4 10 -8 10 h-52 q-12 0 -8 -10 l22 -44z" ${glass}/><path d="M34 82 h60 l6 8 q4 10 -8 10 h-56 q-12 0 -8 -10z" fill="#74c0fc" opacity=".6"/><rect x="48" y="30" width="28" height="8" rx="3" fill="#b08968"/><path d="M58 8 h12 l-3 14 h-6z" fill="#e7f5ff" stroke="${INK}" stroke-width="1.6"/><line x1="64" y1="22" x2="64" y2="84" stroke="${INK}" stroke-width="2"/><circle cx="46" cy="86" r="3" fill="#868e96"/><circle cx="56" cy="92" r="2.5" fill="#868e96"/>` + tube("M76 34 L94 34 L112 34 L112 56")),
  // C: over water: a bottle full of water upside down in a trough
  C: FRAME("C", `<rect x="14" y="66" width="100" height="40" rx="6" ${glass}/><rect x="16" y="76" width="96" height="28" rx="4" fill="#74c0fc" opacity=".6"/><rect x="52" y="22" width="30" height="62" rx="4" ${glass}/><rect x="54" y="38" width="26" height="44" fill="#74c0fc" opacity=".6"/><rect x="56" y="16" width="22" height="8" rx="2" fill="#b08968"/>` + tube("M118 40 L118 96 L67 96 L67 82") + `<circle cx="67" cy="62" r="2.5" fill="#fff"/><circle cx="72" cy="52" r="2" fill="#fff"/>`),
  // D: upward displacement of air: an upright jar, the tube reaches the bottom
  D: FRAME("D", `<rect x="40" y="36" width="50" height="68" rx="5" ${glass}/><rect x="36" y="32" width="58" height="6" rx="2" fill="#adb5bd"/>` + tube("M118 20 L72 20 L72 98") + `<path d="M95 60 l-6 -8 M95 60 l6 -8" stroke="${INK}" stroke-width="1.5"/><text x="104" y="76" font-size="10" fill="#5430b8">air</text>`),
  // E: downward displacement of air: the jar is upside down, the tube reaches the closed end (top)
  E: FRAME("E", `<rect x="40" y="26" width="50" height="68" rx="5" ${glass}/><rect x="36" y="92" width="58" height="6" rx="2" fill="#adb5bd"/>` + tube("M118 100 L72 100 L72 36") + `<path d="M95 70 l-6 8 M95 70 l6 8" stroke="${INK}" stroke-width="1.5"/><text x="104" y="56" font-size="10" fill="#5430b8">air</text>`),
};
export const apparatus = (id: string): string => APPS[id] ?? "";
export const apparatusRow = (ids: string): string => `<div class="chem-apps">${[...ids].map((i) => apparatus(i)).join("")}</div>`;

/** the cross method: valences cross over to become subscripts */
export function crossSvg(cat: string, cc: number, an: string, ac: number): string {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
  const d = g(cc, -ac), a = -ac / d, b = cc / d;
  const w = (s: string) => Math.max(1, s.replace(/\d/g, "").length) * 11;
  const x1 = 22, x2 = 118;
  return `<svg viewBox="0 0 160 84" class="chem-cross" role="img" aria-label="cross"><text x="${x1}" y="30" font-size="20" font-weight="800" text-anchor="middle" fill="${INK}">${sub(cat)}</text><text x="${x2}" y="30" font-size="20" font-weight="800" text-anchor="middle" fill="${INK}">${sub(an)}</text>` +
    `<text x="${x1 + w(cat) / 2 + 2}" y="16" font-size="11" font-weight="800" fill="#d6336c">${Math.abs(cc)}+</text><text x="${x2 + w(an) / 2 + 2}" y="16" font-size="11" font-weight="800" fill="#1971c2">${Math.abs(ac)}-</text>` +
    `<line x1="${x1 + w(cat) / 2 + 8}" y1="19" x2="${x2 + 2}" y2="58" stroke="#d6336c" stroke-width="1.8" stroke-dasharray="4 3"/><line x1="${x2 + w(an) / 2 + 8}" y1="19" x2="${x1 + 2}" y2="58" stroke="#1971c2" stroke-width="1.8" stroke-dasharray="4 3"/>` +
    `<text x="${x1}" y="70" font-size="20" font-weight="800" text-anchor="middle" fill="${INK}">${a > 1 && /[A-Z].*[A-Z]/.test(cat) ? "(" + sub(cat) + ")" : sub(cat)}</text><text x="${x1 + w(cat) / 2 + 6}" y="78" font-size="12" font-weight="800" fill="#1971c2">${a === 1 ? "" : a}</text>` +
    `<text x="${x2}" y="70" font-size="20" font-weight="800" text-anchor="middle" fill="${INK}">${b > 1 && /[A-Z].*[A-Z]/.test(an) ? "(" + sub(an) + ")" : sub(an)}</text><text x="${x2 + w(an) / 2 + 6}" y="78" font-size="12" font-weight="800" fill="#d6336c">${b === 1 ? "" : b}</text></svg>`;
}

/** the card icon of the science home: a cartoon flask with a face and bubbles */
export const chemIcon = (): string => `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M26 6 h12 v4 h-2 v14 l16 28 q5 9 -5 9 h-30 q-10 0 -5 -9 l16 -28 v-14 h-2z" fill="#f3f0ff" stroke="#5430b8" stroke-width="3" stroke-linejoin="round"/><path d="M17 44 h30 l5 8 q5 9 -5 9 h-30 q-10 0 -5 -9z" fill="#69db7c" stroke="#5430b8" stroke-width="3" stroke-linejoin="round"/><circle cx="26" cy="51" r="2" fill="#2b2b2b"/><circle cx="38" cy="51" r="2" fill="#2b2b2b"/><path d="M28 56 q4 3 8 0" fill="none" stroke="#2b2b2b" stroke-width="2" stroke-linecap="round"/><circle cx="40" cy="32" r="3" fill="#b197fc"/><circle cx="35" cy="22" r="2.4" fill="#b197fc"/><circle cx="43" cy="14" r="2" fill="#b197fc"/></svg>`;
