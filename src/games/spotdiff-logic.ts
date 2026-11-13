/**
 * 找不同 (spot the difference): the rules as pure functions, no DOM.
 * Every picture is GENERATED from a seed (`makeScene`): a themed backdrop and a number of round cartoon parts (a library of 30 kinds) placed without touching each
 * other. Picture A draws the parts as they are, picture B draws the same parts with the differences applied (a part missing, added, another colour / size /
 * pattern, moved, flipped). Both pictures come from one data structure, so the place of every difference is known exactly (`diffSpot`).
 */
export const SW = 200, SH = 150;
export const DIFFICULTIES = ["easy", "normal", "hard"] as const;
export const DIFF_COUNTS = [3, 5, 7];
export const PIECE_COUNTS = [8, 12, 16];
export const MAX_HINTS = 3;
export const MISTAKES_FOR_HINT = 3;
export const MIN_SPOT_R = 13, MAX_SPOT_R = 34;

export type DiffKind = "missing" | "added" | "colour" | "size" | "pattern" | "moved" | "flipped";
export interface Part { id: string; k: string; x: number; y: number; R: number; f: string; d: number; flip: number; rot: number }
export interface Diff { id: string; kind: DiffKind; p?: string; set?: Partial<Part>; add?: Part }
export interface Back { theme: string; sky: string; ground: string; gy: number }
export interface Scene { seed: number; difficulty: number; back: Back; parts: Part[]; diffs: Diff[] }
export interface Spot { x: number; y: number; r: number }

// ---------- random numbers ----------
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- colours ----------
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const colourDist = (a: string, b: string) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
const mix = (a: string, b: string, t: number) => { const x = rgb(a), y = rgb(b); return "#" + [0, 1, 2].map((i) => Math.round(x[i] + (y[i] - x[i]) * t).toString(16).padStart(2, "0")).join(""); };
const lum = (h: string) => { const x = rgb(h); return 0.3 * x[0] + 0.59 * x[1] + 0.11 * x[2]; };
const PALETTE = ["#fa5252", "#ff922b", "#fcc419", "#40c057", "#20c997", "#339af0", "#7048e8", "#be4bdb", "#f06595", "#e8590c", "#15aabf", "#82c91e"];
const SOFT = ["#ffffff", "#ffd8a8", "#ffc9c9", "#d0bfff", "#b2f2bb", "#a5d8ff"];
const INK = "#3a2e39";

// ---------- the library of parts: drawn in a unit circle (x, y from -1 to 1, y down) ----------
const face = (cx: number, cy: number, r: number) =>
  `<circle cx="${cx - r * 0.33}" cy="${cy - r * 0.1}" r="${r * 0.11}" fill="${INK}"/><circle cx="${cx + r * 0.33}" cy="${cy - r * 0.1}" r="${r * 0.11}" fill="${INK}"/>`
  + `<circle cx="${cx - r * 0.55}" cy="${cy + r * 0.22}" r="${r * 0.11}" fill="#ff8787" opacity=".55"/><circle cx="${cx + r * 0.55}" cy="${cy + r * 0.22}" r="${r * 0.11}" fill="#ff8787" opacity=".55"/>`
  + `<path d="M${cx - r * 0.22} ${cy + r * 0.2} Q${cx} ${cy + r * 0.46} ${cx + r * 0.22} ${cy + r * 0.2}" fill="none" stroke="${INK}" stroke-width="${r * 0.07}" stroke-linecap="round"/>`;
const circ = (x: number, y: number, r: number, f: string, extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}"${extra}/>`;
const ell = (x: number, y: number, rx: number, ry: number, f: string, extra = "") => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}"${extra}/>`;
const rect = (x: number, y: number, w: number, h: number, f: string, rx = 0.06) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"/>`;
const poly = (pts: string, f: string, extra = "") => `<polygon points="${pts}" fill="${f}" stroke-linejoin="round"${extra}/>`;
const OUT = (f: string) => ` stroke="${mix(f, "#000000", 0.28)}" stroke-width="0.05"`;
const starPts = (r: number, cx = 0, cy = 0) => Array.from({ length: 10 }, (_, i) => { const rr = i % 2 ? r * 0.45 : r, a = -Math.PI / 2 + (i * Math.PI) / 5; return `${cx + rr * Math.cos(a)},${cy + rr * Math.sin(a)}`; }).join(" ");

interface Kind { zone: "sky" | "ground"; asym?: boolean; pal?: string[]; draw: (f: string) => string }
export const KINDS: Record<string, Kind> = {
  sun: { zone: "sky", draw: (f) => [0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4; return `<line x1="${0.74 * Math.cos(a)}" y1="${0.74 * Math.sin(a)}" x2="${Math.cos(a)}" y2="${Math.sin(a)}" stroke="${f}" stroke-width="0.14" stroke-linecap="round"/>`; }).join("") + circ(0, 0, 0.62, f, OUT(f)) + face(0, 0, 0.62) },
  moon: { zone: "sky", asym: true, pal: ["#fff3bf", "#ffe066", "#e9ecef", "#ffd8a8"], draw: (f) => `<path d="M0.15 -0.9 A0.9 0.9 0 1 0 0.15 0.9 A0.62 0.62 0 1 1 0.15 -0.9Z" fill="${f}"${OUT(f)}/>` + circ(-0.5, -0.05, 0.07, INK) + `<path d="M-0.6 0.25 Q-0.45 0.4 -0.3 0.3" fill="none" stroke="${INK}" stroke-width="0.05" stroke-linecap="round"/>` },
  cloud: { zone: "sky", pal: SOFT, draw: (f) => { const o = ` stroke="#adb5bd" stroke-width="0.05"`; return ell(0, 0.28, 0.95, 0.42, f, o) + circ(-0.45, 0.02, 0.4, f, o) + circ(0.05, -0.22, 0.5, f, o) + circ(0.52, 0.06, 0.36, f, o) + ell(0, 0.28, 0.9, 0.38, f) + circ(0.05, -0.2, 0.46, f) + face(0.02, 0.1, 0.4); } },
  tree: { zone: "ground", draw: (f) => rect(-0.12, 0.2, 0.24, 0.8, "#a9713a") + circ(0, -0.3, 0.65, f, OUT(f)) + circ(-0.4, 0.0, 0.45, f, OUT(f)) + circ(0.4, 0.0, 0.45, f, OUT(f)) + circ(0, -0.1, 0.55, f) },
  pine: { zone: "ground", pal: ["#2f9e44", "#37b24d", "#099268", "#2b8a3e", "#0b7285"], draw: (f) => rect(-0.1, 0.65, 0.2, 0.35, "#a9713a") + poly("0,-1 0.62,-0.05 -0.62,-0.05", f, OUT(f)) + poly("0,-0.5 0.8,0.55 -0.8,0.55", f, OUT(f)) + circ(-0.2, 0.2, 0.07, "#fff3bf") + circ(0.25, 0.35, 0.07, "#fa5252") },
  house: { zone: "ground", draw: (f) => rect(-0.75, -0.1, 1.5, 1.0, f) + poly("-0.95,-0.05 0,-0.95 0.95,-0.05", mix(f, "#c92a2a", 0.75), OUT(f)) + rect(-0.15, 0.35, 0.3, 0.55, "#a9713a") + rect(0.3, 0.1, 0.3, 0.3, "#a5d8ff") + rect(-0.6, 0.1, 0.3, 0.3, "#a5d8ff") },
  flower: { zone: "ground", draw: (f) => rect(-0.05, 0.1, 0.1, 0.9, "#2f9e44") + ell(0.25, 0.65, 0.22, 0.1, "#40c057") + [0, 1, 2, 3, 4].map((i) => { const a = (i * 2 * Math.PI) / 5 - Math.PI / 2; return circ(0.4 * Math.cos(a), -0.4 + 0.4 * Math.sin(a), 0.26, f, OUT(f)); }).join("") + circ(0, -0.4, 0.2, "#ffd43b") },
  fish: { zone: "ground", asym: true, draw: (f) => poly("0.5,0 1,-0.45 1,0.45", f, OUT(f)) + ell(-0.1, 0, 0.7, 0.5, f, OUT(f)) + circ(-0.45, -0.1, 0.1, "#fff") + circ(-0.47, -0.1, 0.05, INK) + `<path d="M-0.6 0.15 Q-0.45 0.3 -0.3 0.15" fill="none" stroke="${INK}" stroke-width="0.05" stroke-linecap="round"/>` + ell(-0.05, 0.25, 0.2, 0.12, mix(f, "#ffffff", 0.35)) },
  bird: { zone: "sky", asym: true, draw: (f) => poly("0.5,0.1 0.98,-0.25 0.85,0.35", f, OUT(f)) + circ(0, 0.1, 0.6, f, OUT(f)) + poly("-0.5,-0.05 -1,0.08 -0.5,0.22", "#ff922b") + ell(0.15, 0.25, 0.34, 0.2, mix(f, "#000000", 0.2)) + circ(-0.22, -0.15, 0.13, "#fff") + circ(-0.25, -0.15, 0.07, INK) },
  star: { zone: "sky", draw: (f) => poly(starPts(1), f, OUT(f)) + face(0, 0.08, 0.5) },
  boat: { zone: "ground", asym: true, draw: (f) => `<path d="M-0.95 0.15 L0.95 0.15 L0.6 0.75 L-0.6 0.75Z" fill="#a9713a" stroke-linejoin="round"/>` + rect(-0.04, -0.85, 0.08, 1.0, "#5c3d2e", 0.02) + poly("0.07,-0.85 0.07,0.05 0.85,0.05", f, OUT(f)) + poly("-0.07,-0.6 -0.07,0.05 -0.6,0.05", mix(f, "#ffffff", 0.5)) + circ(-0.2, 0.42, 0.1, "#fff3bf") + circ(0.2, 0.42, 0.1, "#fff3bf") },
  car: { zone: "ground", asym: true, draw: (f) => rect(-0.95, 0, 1.9, 0.55, f, 0.15) + rect(-0.5, -0.5, 1.0, 0.55, f, 0.18) + rect(-0.38, -0.4, 0.76, 0.38, "#a5d8ff", 0.08) + circ(-0.5, 0.58, 0.24, "#343a40") + circ(0.5, 0.58, 0.24, "#343a40") + circ(-0.5, 0.58, 0.09, "#dee2e6") + circ(0.5, 0.58, 0.09, "#dee2e6") + circ(0.9, 0.2, 0.09, "#ffd43b") },
  balloon: { zone: "sky", draw: (f) => `<path d="M0 0.62 Q0.25 0.8 0 1" fill="none" stroke="#868e96" stroke-width="0.04"/>` + ell(0, -0.25, 0.65, 0.75, f, OUT(f)) + poly("0,0.48 -0.1,0.64 0.1,0.64", f) + circ(-0.25, -0.5, 0.12, "#ffffff", ` opacity=".55"`) },
  cat: { zone: "ground", draw: (f) => poly("-0.72,-0.1 -0.6,-0.95 -0.12,-0.5", f, OUT(f)) + poly("0.72,-0.1 0.6,-0.95 0.12,-0.5", f, OUT(f)) + circ(0, 0.1, 0.78, f, OUT(f)) + poly("-0.6,-0.25 -0.55,-0.7 -0.28,-0.45", "#ffa8a8") + poly("0.6,-0.25 0.55,-0.7 0.28,-0.45", "#ffa8a8") + face(0, 0.1, 0.78) + poly("-0.07,0.12 0.07,0.12 0,0.22", "#f06595") },
  dog: { zone: "ground", draw: (f) => ell(-0.72, 0.1, 0.26, 0.5, mix(f, "#000000", 0.3), OUT(f)) + ell(0.72, 0.1, 0.26, 0.5, mix(f, "#000000", 0.3), OUT(f)) + circ(0, 0.05, 0.68, f, OUT(f)) + ell(0, 0.3, 0.32, 0.24, "#fff3e6") + circ(-0.28, -0.12, 0.09, INK) + circ(0.28, -0.12, 0.09, INK) + ell(0, 0.2, 0.12, 0.08, INK) + `<path d="M-0.15 0.38 Q0 0.5 0.15 0.38" fill="none" stroke="${INK}" stroke-width="0.05" stroke-linecap="round"/>` },
  bunny: { zone: "ground", draw: (f) => ell(-0.3, -0.55, 0.19, 0.48, f, OUT(f)) + ell(0.3, -0.55, 0.19, 0.48, f, OUT(f)) + ell(-0.3, -0.55, 0.09, 0.34, "#ffa8a8") + ell(0.3, -0.55, 0.09, 0.34, "#ffa8a8") + circ(0, 0.38, 0.6, f, OUT(f)) + face(0, 0.38, 0.6) + circ(0, 0.4, 0.06, "#f06595") },
  mushroom: { zone: "ground", draw: (f) => rect(-0.25, 0.1, 0.5, 0.85, "#fff3bf", 0.2) + `<path d="M-0.97 0.2 A0.97 0.97 0 0 1 0.97 0.2Z" fill="${f}"${OUT(f)}/>` + circ(-0.45, -0.25, 0.15, "#fff") + circ(0.2, -0.5, 0.18, "#fff") + circ(0.55, -0.1, 0.12, "#fff") + circ(-0.07, 0.5, 0.05, INK) + circ(0.07, 0.5, 0.05, INK) },
  kite: { zone: "sky", asym: true, draw: (f) => `<path d="M0 0.5 Q-0.35 0.7 0.05 0.85 Q0.4 1 0.05 1" fill="none" stroke="#868e96" stroke-width="0.05"/>` + poly("0,-1 0.62,-0.1 0,0.5 -0.62,-0.1", f, OUT(f)) + `<path d="M0 -1 V0.5 M-0.62 -0.1 H0.62" stroke="${mix(f, "#ffffff", 0.55)}" stroke-width="0.06"/>` + poly("0,0.5 0.3,0.62 0.15,0.38", "#ffd43b") },
  ball: { zone: "ground", draw: (f) => circ(0, 0, 0.9, f, OUT(f)) + `<path d="M-0.9 0 Q0 0.45 0.9 0 M-0.55 -0.7 Q0 -0.3 0.55 -0.7" fill="none" stroke="#fff" stroke-width="0.12" stroke-linecap="round"/>` + circ(-0.35, -0.4, 0.14, "#fff", ` opacity=".5"`) },
  umbrella: { zone: "ground", asym: true, draw: (f) => `<path d="M0 0.1 V0.75 A0.15 0.15 0 0 1 -0.3 0.75" fill="none" stroke="#5c3d2e" stroke-width="0.07" stroke-linecap="round"/>` + `<path d="M-0.97 0.1 A0.97 0.97 0 0 1 0.97 0.1 Q0.5 0.32 0 0.1 Q-0.5 0.32 -0.97 0.1Z" fill="${f}"${OUT(f)}/>` + `<path d="M0 -0.87 V0.1 M-0.5 -0.7 Q-0.35 -0.3 -0.4 0.2 M0.5 -0.7 Q0.35 -0.3 0.4 0.2" fill="none" stroke="${mix(f, "#ffffff", 0.5)}" stroke-width="0.05"/>` },
  cake: { zone: "ground", draw: (f) => ell(0, 0.82, 0.95, 0.14, "#fff") + rect(-0.8, 0.05, 1.6, 0.75, f, 0.1) + `<path d="M-0.8 0.15 Q-0.6 0.4 -0.4 0.15 Q-0.2 0.4 0 0.15 Q0.2 0.4 0.4 0.15 Q0.6 0.4 0.8 0.15 V-0.1 Q0 -0.3 -0.8 -0.1Z" fill="#fff"/>` + circ(0, -0.2, 0.14, "#fa5252") + rect(-0.04, -0.7, 0.08, 0.35, "#4dabf7", 0.02) + circ(0, -0.8, 0.09, "#ffd43b") },
  apple: { zone: "ground", pal: ["#fa5252", "#f03e3e", "#82c91e", "#fcc419", "#ff922b"], draw: (f) => circ(-0.28, 0.12, 0.62, f, OUT(f)) + circ(0.28, 0.12, 0.62, f, OUT(f)) + circ(0, 0.18, 0.7, f) + rect(-0.04, -0.75, 0.08, 0.35, "#5c3d2e", 0.03) + ell(0.28, -0.6, 0.22, 0.1, "#40c057") + circ(-0.38, -0.05, 0.12, "#fff", ` opacity=".45"`) },
  butterfly: { zone: "sky", draw: (f) => circ(-0.5, -0.3, 0.45, f, OUT(f)) + circ(0.5, -0.3, 0.45, f, OUT(f)) + circ(-0.4, 0.38, 0.35, mix(f, "#ffffff", 0.3), OUT(f)) + circ(0.4, 0.38, 0.35, mix(f, "#ffffff", 0.3), OUT(f)) + circ(-0.5, -0.3, 0.14, "#fff", ` opacity=".6"`) + circ(0.5, -0.3, 0.14, "#fff", ` opacity=".6"`) + ell(0, 0.05, 0.1, 0.6, INK) + `<path d="M0 -0.5 L-0.2 -0.95 M0 -0.5 L0.2 -0.95" stroke="${INK}" stroke-width="0.05" stroke-linecap="round"/>` },
  duck: { zone: "ground", asym: true, pal: ["#ffd43b", "#fcc419", "#ffffff", "#ffa8a8", "#a5d8ff"], draw: (f) => ell(0.1, 0.4, 0.78, 0.5, f, OUT(f)) + circ(-0.35, -0.3, 0.42, f, OUT(f)) + poly("-0.74,-0.3 -1,-0.2 -0.74,-0.08", "#ff922b") + circ(-0.4, -0.42, 0.09, INK) + ell(0.2, 0.42, 0.4, 0.24, mix(f, "#000000", 0.16)) },
  rocket: { zone: "ground", pal: ["#fa5252", "#339af0", "#7048e8", "#40c057", "#ff922b"], draw: (f) => poly("-0.42,0.2 -0.85,0.85 -0.3,0.6", f, OUT(f)) + poly("0.42,0.2 0.85,0.85 0.3,0.6", f, OUT(f)) + ell(0, 0, 0.42, 0.85, "#f8f9fa", OUT("#f8f9fa")) + poly("-0.4,-0.5 0,-1 0.4,-0.5", f, OUT(f)) + circ(0, -0.12, 0.2, "#74c0fc", OUT("#74c0fc")) + ell(0, 0.95, 0.14, 0.2, "#ffa94d") },
  turtle: { zone: "ground", asym: true, draw: (f) => ell(-0.5, 0.65, 0.18, 0.15, "#8ce99a") + ell(0.45, 0.65, 0.18, 0.15, "#8ce99a") + circ(0.72, 0.1, 0.3, "#8ce99a", OUT("#8ce99a")) + `<path d="M-0.85 0.55 A0.85 0.85 0 0 1 0.85 0.55Z" fill="${f}"${OUT(f)}/>` + circ(0, 0.05, 0.2, mix(f, "#ffffff", 0.35)) + circ(-0.45, 0.25, 0.14, mix(f, "#ffffff", 0.35)) + circ(0.45, 0.25, 0.14, mix(f, "#ffffff", 0.35)) + circ(0.82, 0.05, 0.06, INK) },
  icecream: { zone: "ground", draw: (f) => poly("-0.42,0.1 0.42,0.1 0,1", "#e8c39e", OUT("#e8c39e")) + circ(0, -0.28, 0.58, f, OUT(f)) + circ(-0.4, 0.08, 0.2, f) + circ(0.4, 0.08, 0.2, f) + circ(0, -0.88, 0.1, "#fa5252") + face(0, -0.25, 0.5) },
  gift: { zone: "ground", draw: (f) => rect(-0.8, -0.15, 1.6, 1.0, f) + rect(-0.9, -0.45, 1.8, 0.35, mix(f, "#000000", 0.18)) + rect(-0.1, -0.45, 0.2, 1.3, "#fff", 0.02) + circ(-0.26, -0.62, 0.2, "none", ` stroke="#fff" stroke-width="0.1"`) + circ(0.26, -0.62, 0.2, "none", ` stroke="#fff" stroke-width="0.1"`) },
  owl: { zone: "ground", draw: (f) => poly("-0.6,-0.5 -0.75,-0.95 -0.25,-0.7", f, OUT(f)) + poly("0.6,-0.5 0.75,-0.95 0.25,-0.7", f, OUT(f)) + ell(0, 0.1, 0.8, 0.9, f, OUT(f)) + ell(0, 0.4, 0.5, 0.5, mix(f, "#ffffff", 0.5)) + circ(-0.32, -0.2, 0.3, "#fff") + circ(0.32, -0.2, 0.3, "#fff") + circ(-0.32, -0.2, 0.13, INK) + circ(0.32, -0.2, 0.13, INK) + poly("-0.1,0.0 0.1,0.0 0,0.2", "#ff922b") },
  penguin: { zone: "ground", pal: ["#fa5252", "#ff922b", "#fcc419", "#40c057", "#339af0", "#be4bdb"], draw: (f) => ell(-0.3, 0.95, 0.25, 0.1, "#ff922b") + ell(0.3, 0.95, 0.25, 0.1, "#ff922b") + ell(0, 0.1, 0.68, 0.88, "#343a40") + ell(0, 0.28, 0.46, 0.62, "#fff") + circ(-0.25, -0.25, 0.1, "#fff") + circ(0.25, -0.25, 0.1, "#fff") + circ(-0.25, -0.25, 0.05, INK) + circ(0.25, -0.25, 0.05, INK) + poly("-0.1,-0.1 0.1,-0.1 0,0.05", "#ff922b") + rect(-0.6, -0.02, 1.2, 0.2, f, 0.08) },
};
export const KIND_NAMES = Object.keys(KINDS);

/** a pattern laid over a part: 0 = none, 1 = dots, 2 = stripes */
function patternSvg(d: number, f: string): string {
  if (!d) return "";
  const col = lum(f) > 175 ? "rgba(58,46,57,.65)" : "rgba(255,255,255,.85)";
  if (d === 1) return [[-0.3, -0.25], [0.3, -0.3], [0, 0.1], [-0.35, 0.35], [0.35, 0.3]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.15" fill="${col}"/>`).join("");
  return [-0.4, 0, 0.4].map((y) => `<line x1="-0.55" y1="${y}" x2="0.55" y2="${y}" stroke="${col}" stroke-width="0.16" stroke-linecap="round"/>`).join("");
}
export function partSvg(p: Part): string {
  const k = KINDS[p.k];
  return `<g data-p="${p.id}" data-k="${p.k}" transform="translate(${r2(p.x)} ${r2(p.y)}) rotate(${r2(p.rot)}) scale(${r2(p.flip * p.R)} ${r2(p.R)})">${k.draw(p.f)}${patternSvg(p.d, p.f)}</g>`;
}
const r2 = (v: number) => Math.round(v * 100) / 100;

// ---------- the backdrops ----------
interface Theme { sky: string[]; skyKinds: string[]; groundKinds: string[]; pairs: [string, string][] }
const THEMES: Record<string, Theme> = {
  meadow: { pairs: [["#d0ebff", "#8ce99a"], ["#c5f6fa", "#69db7c"], ["#fff0f6", "#b2f2bb"]], sky: [], skyKinds: ["sun", "cloud", "bird", "balloon", "kite", "butterfly"], groundKinds: ["tree", "pine", "house", "flower", "mushroom", "cat", "dog", "bunny", "car", "ball", "umbrella", "apple", "duck", "turtle"] },
  sea: { pairs: [["#d0ebff", "#74c0fc"], ["#fff3bf", "#4dabf7"], ["#e5dbff", "#74c0fc"]], sky: [], skyKinds: ["sun", "cloud", "bird", "balloon", "kite"], groundKinds: ["fish", "boat", "duck", "turtle", "ball", "fish", "boat"] },
  night: { pairs: [["#2b2d5e", "#1b5e4b"], ["#1c2d5a", "#2b6b4f"], ["#3b2a63", "#1f5f5b"]], sky: [], skyKinds: ["moon", "star", "cloud", "star", "balloon"], groundKinds: ["house", "tree", "pine", "cat", "mushroom", "owl", "rocket", "car"] },
  room: { pairs: [["#ffe8cc", "#e8c39e"], ["#e5dbff", "#ffd8a8"], ["#d3f9d8", "#ffec99"]], sky: [], skyKinds: ["balloon", "star", "sun", "kite", "cloud"], groundKinds: ["cat", "dog", "bunny", "ball", "cake", "gift", "apple", "rocket", "icecream", "penguin", "duck", "turtle", "flower"] },
  snow: { pairs: [["#e7f5ff", "#f8f9fa"], ["#d0ebff", "#ffffff"], ["#e5dbff", "#f1f3f5"]], sky: [], skyKinds: ["sun", "cloud", "bird", "star", "balloon"], groundKinds: ["pine", "house", "penguin", "bunny", "cat", "dog", "gift", "car", "ball", "umbrella"] },
};
export const THEME_NAMES = Object.keys(THEMES);
export function backMarkup(b: Back): string {
  const wave = b.theme === "sea" ? [0, 1, 2].map((i) => `<path d="M${10 + i * 70} ${b.gy + 14 + i * 12} q10 -6 20 0 t20 0" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.6" stroke-linecap="round"/>`).join("") : "";
  return `<rect x="0" y="0" width="${SW}" height="${SH}" fill="${b.sky}"/><rect x="0" y="${b.gy}" width="${SW}" height="${SH - b.gy}" fill="${b.ground}"/><rect x="0" y="${b.gy}" width="${SW}" height="2" fill="${mix(b.ground, "#000000", 0.12)}" opacity=".5"/>${wave}`;
}

// ---------- geometry ----------
export interface Circle { x: number; y: number; r: number }
export const partCircle = (p: Part): Circle => ({ x: p.x, y: p.y, r: p.R });
const dist = (a: Circle, b: Circle) => Math.hypot(a.x - b.x, a.y - b.y);
function enclosing(a: Circle, b: Circle): Circle {
  const d = dist(a, b);
  if (d + b.r <= a.r) return a;
  if (d + a.r <= b.r) return b;
  const r = (d + a.r + b.r) / 2, t = (r - a.r) / d;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r };
}
export function applyDiffs(scene: Scene, diffs: Diff[]): Part[] {
  let list = scene.parts.map((p) => ({ ...p }));
  for (const d of diffs) {
    if (d.add) list.push({ ...d.add });
    else if (d.p && d.set) list = list.map((p) => (p.id === d.p ? { ...p, ...d.set } : p));
    else if (d.p) list = list.filter((p) => p.id !== d.p);
  }
  return list.sort((a, b) => a.y - b.y);
}
/** the inner markup of a picture: A = no differences, B = the differences of the scene */
export function sceneMarkup(scene: Scene, diffs: Diff[]): string { return backMarkup(scene.back) + applyDiffs(scene, diffs).map(partSvg).join(""); }
/** the area everything that changed covers (the part before and after) */
export function diffCircle(scene: Scene, d: Diff): Circle {
  if (d.add) return partCircle(d.add);
  const p = scene.parts.find((q) => q.id === d.p)!;
  const before = partCircle(p);
  return d.set ? enclosing(before, partCircle({ ...p, ...d.set })) : before;
}
export function diffSpot(scene: Scene, d: Diff): Spot {
  const c = diffCircle(scene, d);
  return { x: c.x, y: c.y, r: Math.max(MIN_SPOT_R, Math.min(MAX_SPOT_R, c.r + 3)) };
}

// ---------- the generator ----------
const M_EDGE = 4, GAP = 3, RESERVE = 1.3;
const RANGE: [number, number][] = [[15, 20], [13, 17], [11, 15]];
const pick = <T,>(rng: () => number, a: T[]): T => a[Math.min(a.length - 1, Math.floor(rng() * a.length))];
const between = (rng: () => number, a: number, b: number) => a + (b - a) * rng();

function zoneOk(b: Back, zone: "sky" | "ground", c: Circle): boolean {
  if (c.x - c.r < M_EDGE || c.x + c.r > SW - M_EDGE || c.y - c.r < M_EDGE || c.y + c.r > SH - M_EDGE) return false;
  return zone === "sky" ? c.y <= b.gy - c.r * 0.35 : c.y >= b.gy + c.r * 0.05;
}
/** a colour of the palette that shows on the backdrop where the part stands */
function pickColour(rng: () => number, kind: string, b: Back, y: number, not?: string, far = 0): string | null {
  const pal = KINDS[kind].pal ?? PALETTE, bg = y < b.gy ? b.sky : b.ground;
  const ok = pal.filter((c) => (kind === "cloud" || colourDist(c, bg) >= 85) && (!not || colourDist(c, not) >= far));
  return ok.length ? pick(rng, ok) : null;
}

/** one attempt; null when the pieces do not fit or the differences cannot be placed */
function attempt(seed: number, difficulty: number): Scene | null {
  const rng = prng(seed), N = DIFF_COUNTS[difficulty];
  const themeName = pick(rng, THEME_NAMES), th = THEMES[themeName], pair = pick(rng, th.pairs);
  const back: Back = { theme: themeName, sky: pair[0], ground: pair[1], gy: Math.round(between(rng, 72, 92)) };
  const want = PIECE_COUNTS[difficulty], parts: Part[] = [], used: Record<string, number> = {};
  const [r0, r1] = RANGE[difficulty];
  const place = (id: string, reserve: number, gap: number, others: Circle[], kindName?: string): Part | null => {
    for (let t = 0; t < 40; t++) {
      const kind = kindName ?? pick(rng, rng() < 0.4 ? th.skyKinds : th.groundKinds);
      const K = KINDS[kind]; if (!kindName && (used[kind] ?? 0) >= 2) continue;
      const zone = th.skyKinds.includes(kind) ? "sky" : "ground";
      const R = between(rng, r0, r1);
      for (let u = 0; u < 30; u++) {
        const x = between(rng, M_EDGE + R * reserve, SW - M_EDGE - R * reserve);
        const y = zone === "sky" ? between(rng, M_EDGE + R * reserve, back.gy - R * reserve * 0.35) : between(rng, back.gy + R * 0.05 + R * (reserve - 1), SH - M_EDGE - R * reserve);
        const big: Circle = { x, y, r: R * reserve };
        if (!zoneOk(back, zone, { x, y, r: R * reserve })) continue;
        if (others.some((o) => dist(o, big) < o.r + big.r + gap)) continue;
        const f = pickColour(rng, kind, back, y); if (!f) break;
        return { id, k: kind, x, y, R, f, d: rng() < 0.2 ? 1 + Math.floor(rng() * 2) : 0, flip: K.asym && rng() < 0.5 ? -1 : 1, rot: between(rng, -9, 9) };
      }
    }
    return null;
  };
  const reserved: Circle[] = [];
  for (let i = 0; i < want * 3 && parts.length < want; i++) {
    const p = place(`p${parts.length + 1}`, RESERVE, GAP, reserved);
    if (p) { parts.push(p); used[p.k] = (used[p.k] ?? 0) + 1; reserved.push({ x: p.x, y: p.y, r: p.R * RESERVE }); }
  }
  if (parts.length < Math.ceil(want * 0.8)) return null;
  // the differences
  const diffs: Diff[] = [], spots: Spot[] = [], kindsUsed: Record<string, number> = {}, taken = new Set<string>();
  const scene: Scene = { seed, difficulty, back, parts, diffs };
  const all: DiffKind[] = ["missing", "added", "colour", "size", "pattern", "moved", "flipped"];
  const cap = Math.ceil(N / 3) + 1;
  for (let t = 0; t < 400 && diffs.length < N; t++) {
    const kind = pick(rng, all); if ((kindsUsed[kind] ?? 0) >= cap) continue;
    const id = `d${diffs.length + 1}`;
    let diff: Diff | null = null;
    if (kind === "added") {
      const free = parts.map((p) => ({ x: p.x, y: p.y, r: p.R * 1.05 })).concat(diffs.filter((d) => d.add).map((d) => ({ x: d.add!.x, y: d.add!.y, r: d.add!.R })));
      const np = place(`a${diffs.length + 1}`, 1.05, 4, free); if (np) diff = { id, kind, add: np };
    } else {
      const p = pick(rng, parts); if (taken.has(p.id)) continue;
      if (kind === "missing") diff = { id, kind, p: p.id };
      else if (kind === "colour") { const f = pickColour(rng, p.k, back, p.y, p.f, 150); if (f && f !== p.f) diff = { id, kind, p: p.id, set: { f } }; }
      else if (kind === "size") diff = { id, kind, p: p.id, set: { R: p.R * (rng() < 0.5 ? 1.3 : 0.7) } };
      else if (kind === "pattern") { const d = [0, 1, 2].filter((v) => v !== p.d); diff = { id, kind, p: p.id, set: { d: p.d === 0 ? pick(rng, [1, 2]) : pick(rng, d) } }; }
      else if (kind === "flipped") { if (KINDS[p.k].asym) diff = { id, kind, p: p.id, set: { flip: -p.flip } }; }
      else if (kind === "moved") {
        const zone = th.skyKinds.includes(p.k) ? "sky" : "ground", m = p.R * between(rng, 1.0, 1.4), a0 = rng() * 6.283;
        for (let k = 0; k < 16 && !diff; k++) {
          const a = a0 + (k * 6.283) / 16, nx = p.x + Math.cos(a) * m, ny = p.y + Math.sin(a) * m, nc: Circle = { x: nx, y: ny, r: p.R };
          if (!zoneOk(back, zone, nc)) continue;
          if (parts.some((o) => o !== p && dist({ x: o.x, y: o.y, r: o.R }, nc) < o.R + p.R + GAP)) continue;
          if (diffs.some((d) => d.add && dist({ x: d.add.x, y: d.add.y, r: d.add.R }, nc) < d.add.R + p.R + GAP)) continue;
          diff = { id, kind, p: p.id, set: { x: nx, y: ny } };
        }
      }
    }
    if (!diff) continue;
    const s = diffSpot(scene, diff);
    if (s.x - s.r < 0 || s.y - s.r < 0 || s.x + s.r > SW || s.y + s.r > SH) continue;
    if (spots.some((o) => Math.hypot(o.x - s.x, o.y - s.y) < o.r + s.r + 2)) continue;
    diffs.push(diff); spots.push(s); kindsUsed[kind] = (kindsUsed[kind] ?? 0) + 1; if (diff.p) taken.add(diff.p);
  }
  if (diffs.length < N) return null;
  // a moved or resized part must not sit on top of something it was not near before: checked above; all done
  return scene;
}
/** a scene from a seed: the same seed always gives the same scene */
export function makeScene(seed: number, difficulty: number): Scene {
  for (let i = 0; i < 200; i++) { const s = attempt((seed + i * 7919) >>> 0, difficulty); if (s) { s.seed = seed; return s; } }
  throw new Error("scene generator failed");
}
export const randomSeed = (): number => Math.floor(Math.random() * 2147483647) + 1;
/** a seed whose scene differs from the one just shown (another seed AND other parts) */
export function nextSeed(prev: Scene | null, difficulty: number, rng: () => number = Math.random): number {
  for (let i = 0; i < 20; i++) {
    const seed = Math.floor(rng() * 2147483647) + 1;
    if (!prev || (seed !== prev.seed && sceneMarkup(makeScene(seed, difficulty), []) !== sceneMarkup(prev, []))) return seed;
  }
  return (prev ? prev.seed + 1 : 1);
}

// ---------- one game ----------
export interface Game { seed: number; difficulty: number; spots: Spot[]; found: boolean[]; mistakes: number; hintsUsed: number }
export type TapResult = { kind: "hit"; i: number } | { kind: "again"; i: number } | { kind: "miss" };
export function newGame(scene: Scene): Game {
  return { seed: scene.seed, difficulty: scene.difficulty, spots: scene.diffs.map((d) => diffSpot(scene, d)), found: scene.diffs.map(() => false), mistakes: 0, hintsUsed: 0 };
}
/** a tap at scene coordinates (`minR`: a smallest radius in scene units, so that a small screen still has a finger-sized target): the nearest difference within its radius is found (a found one is not counted twice); anything else is a mistake */
export function tap(g: Game, x: number, y: number, minR = 0): TapResult {
  let best = -1, bd = Infinity;
  g.spots.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - y); if (d <= Math.max(s.r, minR) && d < bd) { bd = d; best = i; } });
  if (best < 0) { g.mistakes++; return { kind: "miss" }; }
  if (g.found[best]) return { kind: "again", i: best };
  g.found[best] = true;
  return { kind: "hit", i: best };
}
export const foundCount = (g: Game) => g.found.filter(Boolean).length;
export const won = (g: Game) => g.found.every(Boolean);
export const hintsLeft = (g: Game) => MAX_HINTS - g.hintsUsed;
/** the hint button lights up after three mistakes (it can always be used while hints are left; three per picture) */
export const hintLit = (g: Game) => g.mistakes >= MISTAKES_FOR_HINT && hintsLeft(g) > 0 && !won(g);
/** a difference that is not found yet (the first one in the list), or -1 when there is none or the hints are used up */
export function hint(g: Game): number {
  if (hintsLeft(g) <= 0 || won(g)) return -1;
  const i = g.found.findIndex((f) => !f);
  if (i >= 0) g.hintsUsed++;
  return i;
}
/** 1-3 stars: fewer than 2 mistakes and a quick time are 3 */
export function stars(mistakes: number, seconds: number, n: number): number {
  let s = 3;
  if (mistakes > 1) s--;
  if (mistakes > 4) s--;
  if (seconds > n * 20) s--;
  return Math.max(1, s);
}
export function moveCursor(c: { x: number; y: number }, dx: number, dy: number, step = 10): { x: number; y: number } {
  return { x: Math.max(0, Math.min(SW, c.x + dx * step)), y: Math.max(0, Math.min(SH, c.y + dy * step)) };
}
export function fmtTime(sec: number): string { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
