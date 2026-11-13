/**
 * 编程: the drawing world. Judging a picture = comparing the drawn SEGMENTS with the segments of the reference solution (never pixels):
 * every point of one drawing (sampled every 2 units) must be within `tol` units of the other drawing and the other way round, so a different way of
 * drawing the same picture (another start corner, a line drawn in two pieces) is accepted, a different picture is not. Colours are compared when asked.
 */
import type { Seg } from "./coding-interp";

export const CANVAS = 200;          // the drawing area is -100 .. 100 in both directions
export const TOLERANCE = 3;

const distToSeg = (px: number, py: number, s: Seg): number => {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1, l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / l2));
  return Math.hypot(px - (s.x1 + t * dx), py - (s.y1 + t * dy));
};
export function samples(segs: Seg[], step = 2): { x: number; y: number; c: string }[] {
  const out: { x: number; y: number; c: string }[] = [];
  for (const s of segs) {
    const len = Math.hypot(s.x2 - s.x1, s.y2 - s.y1), n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) out.push({ x: s.x1 + ((s.x2 - s.x1) * i) / n, y: s.y1 + ((s.y2 - s.y1) * i) / n, c: s.c });
  }
  return out;
}
const covered = (from: Seg[], by: Seg[], tol: number, colors: boolean): boolean =>
  samples(from).every((p) => by.some((s) => (!colors || s.c === p.c) && distToSeg(p.x, p.y, s) <= tol));

/** do the two drawings show the same picture? (both empty = not a picture) */
export function sameDrawing(a: Seg[], b: Seg[], opts: { tol?: number; colors?: boolean } = {}): boolean {
  if (!a.length || !b.length) return false;
  const tol = opts.tol ?? TOLERANCE, colors = !!opts.colors;
  return covered(a, b, tol, colors) && covered(b, a, tol, colors);
}
export const totalLength = (segs: Seg[]): number => segs.reduce((n, s) => n + Math.hypot(s.x2 - s.x1, s.y2 - s.y1), 0);

export const COLORS: Record<string, string> = { black: "#2d2230", red: "#e03131", orange: "#f76707", yellow: "#f59f00", green: "#2f9e44", blue: "#1c7ed6", purple: "#7048e8" };
export const colorHex = (c: string): string => COLORS[c] ?? COLORS.black;

/** the segments as SVG path data per colour (viewBox -100 -100 200 200) */
export function pathsByColor(segs: Seg[]): { color: string; d: string }[] {
  const by = new Map<string, string>();
  const r = (v: number) => Math.round(v * 100) / 100;
  for (const s of segs) by.set(s.c, (by.get(s.c) ?? "") + `M${r(s.x1)} ${r(s.y1)}L${r(s.x2)} ${r(s.y2)}`);
  return [...by.entries()].map(([color, d]) => ({ color, d }));
}
