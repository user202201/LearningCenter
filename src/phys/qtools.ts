/** Pure helpers shared by the models of the physics lab: random numbers, number text and the quiz question maker (no DOM). */
/** one quiz question; `kind` + `p` say how it was made (the tests recompute the right answer from them), `ans` is the right choice's text */
export interface Q { q: string; choices: string[]; a: number; ans: string; kind: string; p: number[]; why?: string }
// ---------- small tools ----------
export const mulberry32 = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
export const pick = <T,>(rng: () => number, a: readonly T[]): T => a[Math.floor(rng() * a.length)];
export const shuffle = <T,>(rng: () => number, a: readonly T[]): T[] => { const r = a.slice(); for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; } return r; };
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const rad = (d: number) => (d * Math.PI) / 180;
export const deg = (r: number) => (r * 180) / Math.PI;
/** a number as text with at most `dec` decimals, no trailing zeros, a real minus sign */
export const fmt = (v: number, dec = 1): string => { const s = (Math.abs(v) < 0.5 * 10 ** -dec ? 0 : v).toFixed(dec); return (s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s).replace("-", "−"); };
/** the choices of a question: the right one among the wrong ones, in a random place (`wrong` may hold duplicates / the right one: they are removed) */
export function makeQ(rng: () => number, kind: string, p: number[], q: string, ans: string, wrong: string[], why?: string): Q {
  const w = [...new Set(wrong)].filter((x) => x !== ans);
  if (w.length < 3) throw new Error(`question ${kind}: only ${w.length} different wrong choices`);
  const all = shuffle(rng, [ans, ...shuffle(rng, w).slice(0, 3)]);
  return { q, choices: all, a: all.indexOf(ans), ans, kind, p, why };
}
/** a numeric question: wrong choices are the usual mistakes (twice, half, off by one step ...) */
export function numQ(rng: () => number, kind: string, p: number[], q: string, v: number, unit: string, dec = 1, why?: string): Q {
  const f = (x: number) => `${fmt(x, dec)} ${unit}`.trim();
  const step = 10 ** -dec;
  const cands = [v * 2, v / 2, v * 10, v / 10, v + step * 5, v - step * 5, v * 1.5, v * 0.75, v + 10 * step, v + 1, v - 1, v * 3, v / 3].filter((x) => x > 0 || v <= 0);
  return makeQ(rng, kind, p, q, f(v), cands.map(f), why);
}

