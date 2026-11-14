/**
 * Drawings of the chemistry modes of part 2, made in code (inline SVG, only digits and Latin letters inside): solubility curves, atom structure
 * pictures, a cell of the periodic table, ten laboratory apparatus and flowcharts. Every drawing carries data-* attributes with the numbers it shows,
 * so that the tests can read the figure back.
 */
import * as L from "./chemlogic";
import type { Spec, FlowRow } from "./chemlogic";

const INK = "#364152", GRID = "#e5dbff", COLS = ["#d6336c", "#1971c2", "#2f9e44", "#e8590c"];
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

// ---------- solubility curves ----------
const niceMax = (m: number): { top: number; step: number } => (m <= 60 ? { top: 60, step: 10 } : m <= 120 ? { top: 120, step: 20 } : m <= 260 ? { top: 260, step: 50 } : { top: Math.ceil(m / 50) * 50, step: 50 });
export function curveSvg(subs: string[], marks: { T: number; S: number; n: string }[]): string {
  const D = L.data().solub, T = D.T;
  const rows = subs.map((f) => D.d.find((d) => d.f === f)!);
  const peak = Math.max(...rows.flatMap((r) => r.v), ...marks.map((m) => m.S));
  const { top, step } = niceMax(peak);
  const x0 = 42, x1 = 302, y0 = 188, y1 = 18;
  const X = (t: number) => x0 + (t / 100) * (x1 - x0), Y = (s: number) => y0 - (s / top) * (y0 - y1);
  let g = "";
  for (let s = 0; s <= top; s += step) g += `<line x1="${x0}" y1="${Y(s).toFixed(1)}" x2="${x1}" y2="${Y(s).toFixed(1)}" stroke="${GRID}" stroke-width="1"/><text x="${x0 - 5}" y="${(Y(s) + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="${INK}">${s}</text>`;
  for (const t of T) g += `<line x1="${X(t)}" y1="${y0}" x2="${X(t)}" y2="${y1}" stroke="${GRID}" stroke-width="1"/><text x="${X(t)}" y="${y0 + 12}" font-size="9" text-anchor="middle" fill="${INK}">${t}</text>`;
  g += `<line x1="${x0}" y1="${y0}" x2="${x1 + 4}" y2="${y0}" stroke="${INK}" stroke-width="1.6"/><line x1="${x0}" y1="${y0}" x2="${x0}" y2="${y1 - 4}" stroke="${INK}" stroke-width="1.6"/>`;
  g += `<text x="${x1 + 2}" y="${y0 + 12}" font-size="9" text-anchor="end" fill="${INK}"></text><text x="${(x0 + x1) / 2}" y="${y0 + 25}" font-size="10" text-anchor="middle" fill="${INK}">t / ℃</text><text x="4" y="12" font-size="10" fill="${INK}">S / g</text>`;
  rows.forEach((r, i) => {
    const P = r.v.map((v, k) => [X(T[k]), Y(v)]);
    let d = `M${P[0][0]} ${P[0][1].toFixed(1)}`;
    for (let k = 0; k < P.length - 1; k++) {
      const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    const col = COLS[i % COLS.length];
    g += `<path class="cv-line" data-sub="${r.f}" data-pts="${T.map((t, k) => `${t}:${r.v[k]}`).join(",")}" d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round"/>`;
    g += `<g class="cv-leg"><line x1="${58 + i * 80}" y1="9" x2="${74 + i * 80}" y2="9" stroke="${col}" stroke-width="3"/><text x="${78 + i * 80}" y="12" font-size="10" font-weight="700" fill="${col}">${esc(L.sub(r.f))}</text></g>`;
  });
  for (const m of marks) {
    if (!m.n) { g += `<line class="cv-guide" data-t="${m.T}" x1="${X(m.T)}" y1="${y0}" x2="${X(m.T)}" y2="${y1}" stroke="${INK}" stroke-width="1.4" stroke-dasharray="4 3"/>`; continue; }
    g += `<line x1="${x0}" y1="${Y(m.S).toFixed(1)}" x2="${X(m.T).toFixed(1)}" y2="${Y(m.S).toFixed(1)}" stroke="${INK}" stroke-dasharray="3 3" stroke-width="1"/><line x1="${X(m.T).toFixed(1)}" y1="${y0}" x2="${X(m.T).toFixed(1)}" y2="${Y(m.S).toFixed(1)}" stroke="${INK}" stroke-dasharray="3 3" stroke-width="1"/>`;
    g += `<circle class="cv-mark" data-mark="${m.n}" data-t="${m.T}" data-s="${m.S}" cx="${X(m.T).toFixed(1)}" cy="${Y(m.S).toFixed(1)}" r="4.5" fill="#fff" stroke="${INK}" stroke-width="2"/><text x="${(X(m.T) + 8).toFixed(1)}" y="${(Y(m.S) - 6).toFixed(1)}" font-size="12" font-weight="800" fill="${INK}">${m.n}</text>`;
  }
  return `<svg viewBox="0 0 316 218" class="chem-curve" role="img" aria-label="solubility curves" data-top="${top}">${g}</svg>`;
}

// ---------- atoms ----------
export function atomSvg(z: number, e: number): string {
  const sh = shellsOf(e), cx = 80, cy = 80;
  let g = "";
  sh.forEach((n, i) => {
    const R = 28 + i * 14;
    g += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#9775fa" stroke-width="1.4"/>`;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 - Math.PI / 2; g += `<circle class="at-e" cx="${(cx + R * Math.cos(a)).toFixed(1)}" cy="${(cy + R * Math.sin(a)).toFixed(1)}" r="3.3" fill="#d6336c"/>`; }
  });
  g += `<circle cx="${cx}" cy="${cy}" r="19" fill="#fff3bf" stroke="${INK}" stroke-width="2"/><text x="${cx}" y="${cy + 5}" font-size="14" font-weight="800" text-anchor="middle" fill="${INK}">+${z}</text>`;
  return `<svg viewBox="0 0 160 160" class="chem-atom" role="img" aria-label="atom" data-z="${z}" data-e="${e}" data-shells="${sh.join(",")}">${g}</svg>`;
}
const shellsOf = (e: number): number[] => { const out: number[] = []; let left = e; for (const c of [2, 8, 8, 8]) { if (left <= 0) break; out.push(Math.min(c, left)); left -= c; } return out; };
export function cellSvg(z: number): string {
  const a = L.data().more.atoms.find((x) => x[0] === z)!;
  return `<svg viewBox="0 0 120 120" class="chem-cell" role="img" aria-label="element cell" data-z="${z}" data-sym="${a[1]}" data-ar="${a[3]}"><rect x="10" y="10" width="100" height="100" rx="8" fill="#f3f0ff" stroke="#7048e8" stroke-width="3"/><text x="20" y="32" font-size="18" font-weight="800" fill="${INK}">${z}</text><text x="60" y="76" font-size="38" font-weight="800" text-anchor="middle" fill="#5430b8">${a[1]}</text><text x="60" y="100" font-size="15" text-anchor="middle" fill="${INK}">${a[3]}</text></svg>`;
}

// ---------- laboratory apparatus ----------
const GL = `fill="#e7f5ff" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`;
const LIQ = `fill="#74c0fc" opacity=".6"`;
const APP: Record<string, string> = {
  beaker: `<path d="M30 22 H90 V98 a9 9 0 0 1 -9 9 H39 a9 9 0 0 1 -9 -9 Z" ${GL}/><path d="M30 60 H90 V98 a9 9 0 0 1 -9 9 H39 a9 9 0 0 1 -9 -9 Z" ${LIQ}/><path d="M30 22 L24 18" stroke="${INK}" stroke-width="2.4"/><path d="M40 40 h10 M40 55 h10 M40 70 h10" stroke="${INK}" stroke-width="1.4"/>`,
  flask: `<path d="M50 14 H70 V44 L102 98 a8 8 0 0 1 -7 11 H25 a8 8 0 0 1 -7 -11 L50 44 Z" ${GL}/><path d="M36 78 H84 L102 98 a8 8 0 0 1 -7 11 H25 a8 8 0 0 1 -7 -11 Z" ${LIQ}/><rect x="46" y="10" width="28" height="6" rx="2" fill="${INK}"/>`,
  tube: `<path d="M46 14 V92 a14 14 0 0 0 28 0 V14" ${GL}/><path d="M46 62 V92 a14 14 0 0 0 28 0 V62 Z" ${LIQ}/><rect x="42" y="10" width="36" height="6" rx="3" fill="#adb5bd" stroke="${INK}" stroke-width="2"/>`,
  dish: `<path d="M12 56 H108 A48 44 0 0 1 12 56 Z" ${GL}/><path d="M26 74 H94 A40 30 0 0 1 26 74 Z" ${LIQ}/><path d="M40 108 H80" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  funnel: `<path d="M16 22 H104 L66 68 V108 H54 V68 Z" ${GL}/><path d="M30 38 H90" stroke="${INK}" stroke-width="1.4" stroke-dasharray="3 3"/>`,
  lamp: `<path d="M34 70 H86 L98 104 a6 6 0 0 1 -6 6 H28 a6 6 0 0 1 -6 -6 Z" ${GL}/><path d="M50 70 V58 H70 V70" ${GL}/><rect x="56" y="38" width="8" height="22" fill="#b08968" stroke="${INK}" stroke-width="2"/><path d="M60 8 q-10 14 0 28 q10 -14 0 -28 Z" fill="#ff922b"/><path d="M42 90 H78" stroke="${INK}" stroke-width="1.4"/>`,
  cyl: `<path d="M42 10 V98 H78 V10 Z" ${GL}/><path d="M42 54 H78 V98 H42 Z" ${LIQ}/><path d="M42 20 h10 M42 30 h8 M42 40 h10 M42 50 h8 M42 60 h10 M42 70 h8 M42 80 h10" stroke="${INK}" stroke-width="1.4"/><rect x="30" y="98" width="60" height="9" rx="4" fill="#adb5bd" stroke="${INK}" stroke-width="2"/><path d="M42 10 L36 6" stroke="${INK}" stroke-width="2.4"/>`,
  drop: `<path d="M60 10 a16 20 0 0 1 16 22 H44 a16 20 0 0 1 16 -22 Z" fill="#e03131" stroke="${INK}" stroke-width="2.4"/><rect x="40" y="32" width="40" height="8" rx="3" fill="#adb5bd" stroke="${INK}" stroke-width="2"/><path d="M50 40 V84 L60 108 L70 84 V40 Z" ${GL}/>`,
  sep: `<rect x="52" y="6" width="16" height="8" rx="2" fill="#b08968" stroke="${INK}" stroke-width="2"/><path d="M56 14 H64 V20 q30 6 30 36 q0 22 -34 22 q-34 0 -34 -22 q0 -30 30 -36 Z" ${GL}/><path d="M60 78 V96" stroke="${INK}" stroke-width="3"/><rect x="48" y="86" width="24" height="6" rx="3" fill="#fab005" stroke="${INK}" stroke-width="2"/><path d="M60 96 V112" stroke="${INK}" stroke-width="3"/>`,
  jar: `<path d="M38 24 H82 V30 H92 V100 a8 8 0 0 1 -8 8 H36 a8 8 0 0 1 -8 -8 V30 H38 Z" ${GL}/><rect x="30" y="14" width="60" height="8" rx="3" fill="#dee2e6" stroke="${INK}" stroke-width="2"/>`,
};
export const appSvg = (id: string): string => `<svg viewBox="0 0 120 120" class="chem-appfig" role="img" aria-label="apparatus" data-app="${id}">${APP[id] ?? ""}</svg>`;
export const APP_IDS = Object.keys(APP);

// ---------- flowcharts ----------
export function flowSvg(rows: FlowRow[]): string {
  const W = 300, cx = 100;
  let y = 8, g = "";
  const arrow = (x: number, y1: number, y2: number) => `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 4}" stroke="${INK}" stroke-width="1.8"/><path d="M${x - 4} ${y2 - 6} L${x} ${y2} L${x + 4} ${y2 - 6}" fill="${INK}"/>`;
  rows.forEach((r, i) => {
    if (i > 0) { g += arrow(cx, y, y + 14); y += 14; }
    if (r.k === "box") {
      const txt = L.sub(r.t), w = Math.min(196, Math.max(56, txt.length * 6.4 + 18)), h = 26;
      g += `<g class="fl-box" data-t="${esc(r.t)}"${r.side ? ` data-side="${r.side}"` : ""}><rect x="${cx - w / 2}" y="${y}" width="${w}" height="${h}" rx="7" fill="#fff" stroke="${INK}" stroke-width="2"/><text x="${cx}" y="${y + 17}" font-size="11" font-weight="700" text-anchor="middle" fill="${INK}">${esc(txt)}</text>`;
      if (r.side) g += `<line x1="${cx + w / 2}" y1="${y + 13}" x2="${W - 56}" y2="${y + 13}" stroke="${INK}" stroke-width="1.8"/><path d="M${W - 62} ${y + 9} L${W - 56} ${y + 13} L${W - 62} ${y + 17}" fill="${INK}"/><rect x="${W - 56}" y="${y}" width="44" height="26" rx="7" fill="#fff3bf" stroke="${INK}" stroke-width="2"/><text x="${W - 34}" y="${y + 18}" font-size="13" font-weight="800" text-anchor="middle" fill="${INK}">${esc(r.side)}</text>`;
      g += `</g>`;
      y += h;
    } else {
      const txt = r.t ? L.sub(r.t) : "", w = Math.max(54, 34 + txt.length * 6.4);
      g += `<g class="fl-step" data-n="${r.n}"${r.t ? ` data-t="${esc(r.t)}"` : ""}><rect x="${cx - w / 2}" y="${y}" width="${w}" height="24" rx="12" fill="#f3f0ff" stroke="#7048e8" stroke-width="2"/><circle cx="${cx - w / 2 + 13}" cy="${y + 12}" r="9" fill="#7048e8"/><text x="${cx - w / 2 + 13}" y="${y + 16}" font-size="11" font-weight="800" text-anchor="middle" fill="#fff">${r.n}</text>${txt ? `<text x="${cx - w / 2 + 28}" y="${y + 16}" font-size="11" font-weight="700" fill="#5430b8">${esc(txt)}</text>` : ""}</g>`;
      y += 24;
    }
  });
  return `<svg viewBox="0 0 ${W} ${Math.ceil(y + 10)}" class="chem-flow" role="img" aria-label="flowchart" data-rows="${rows.length}">${g}</svg>`;
}

/** the drawing of a question */
export function specSvg(s: Spec): string {
  if (s.k === "curve") return curveSvg(s.subs, s.marks);
  if (s.k === "atom") return atomSvg(s.z, s.e);
  if (s.k === "cell") return cellSvg(s.z);
  if (s.k === "app") return appSvg(s.id);
  return flowSvg(s.rows);
}
