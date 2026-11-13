/**
 * Finger writing (写字): the judge of one drawn stroke, with no screen (rule 51). The stroke the child draws is compared with the centre line ("median") of the
 * stroke that is expected next, by a TOLERANT matcher (children write roughly): both lines are resampled to N points and must start and end near each other,
 * run in the same direction (start -> end within about 50 degrees; a stroke drawn the wrong way is refused) and have a small mean distance. A stroke that
 * fits a LATER stroke of the character instead is reported as a wrong order; a very short mark is a tap (ignored) unless a dot is expected.
 * Coordinates: the stroke data's own (Make Me a Hanzi: 1024 x 1024, y upwards, the character's box is about 0..1024 x -124..900).
 */
export type Pt = [number, number];
export const BOARD = 1024;
/** points both lines are resampled to */
export const N = 24;
/** a mark shorter than this (path length) is a tap */
export const TAP_LEN = 40;
/** a stroke whose centre line is shorter than this is a dot (点): direction does not matter, a tap near it is enough */
export const DOT_LEN = 100;
/** mean distance between the drawn line and the expected one (1024 = the whole board) */
export const TOL = 150;
/** the start and the end may be this far from the expected ones */
export const END_TOL = 230;
/** largest turn of the direction (start -> end) in degrees */
export const ANGLE_TOL = 50;
/** the size of the drawn line (the diagonal of its box) may be this much smaller / bigger than the expected one's (the path length is not used: a trembling finger makes it much longer) */
export const LEN_MIN = 0.4, LEN_MAX = 2.6;
/** a dot: the centre of the mark must be this near the dot */
export const DOT_TOL = 150;

export const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
export function pathLength(p: Pt[]): number {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += dist(p[i - 1], p[i]);
  return s;
}
/** `n` points spread evenly along the line (a line without length gives n copies of its point) */
export function resample(p: Pt[], n = N): Pt[] {
  if (!p.length) return [];
  const total = pathLength(p);
  if (total === 0 || p.length === 1) return Array.from({ length: n }, () => [p[0][0], p[0][1]] as Pt);
  const out: Pt[] = [[p[0][0], p[0][1]]];
  let seg = 1, acc = 0;
  for (let k = 1; k < n - 1; k++) {
    const target = (total * k) / (n - 1);
    while (seg < p.length - 1 && acc + dist(p[seg - 1], p[seg]) < target) { acc += dist(p[seg - 1], p[seg]); seg++; }
    const l = dist(p[seg - 1], p[seg]) || 1, t = Math.min(1, Math.max(0, (target - acc) / l));
    out.push([p[seg - 1][0] + (p[seg][0] - p[seg - 1][0]) * t, p[seg - 1][1] + (p[seg][1] - p[seg - 1][1]) * t]);
  }
  out.push([p[p.length - 1][0], p[p.length - 1][1]]);
  return out;
}
/** mean distance of equally spaced points (forward direction) */
export function meanDist(a: Pt[], b: Pt[]): number {
  const x = resample(a), y = resample(b);
  let s = 0;
  for (let i = 0; i < N; i++) s += dist(x[i], y[i]);
  return s / N;
}
/** diagonal of the box round a line */
export function extent(p: Pt[]): number {
  const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}
export const centre = (p: Pt[]): Pt => [p.reduce((s, q) => s + q[0], 0) / p.length, p.reduce((s, q) => s + q[1], 0) / p.length];
export const isDot = (med: Pt[]): boolean => pathLength(med) < DOT_LEN;
/** angle in degrees between two vectors (0 when one has no length) */
function turn(a: Pt, b: Pt): number {
  const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
  if (!la || !lb) return 0;
  return (Math.acos(Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1]) / (la * lb)))) * 180) / Math.PI;
}
const vec = (p: Pt[]): Pt => [p[p.length - 1][0] - p[0][0], p[p.length - 1][1] - p[0][1]];

/** does the drawn line fit this centre line (in this direction)? */
export function fits(drawn: Pt[], med: Pt[]): boolean {
  if (drawn.length < 1 || med.length < 2) return false;
  const ld = pathLength(drawn), lm = pathLength(med);
  if (lm < DOT_LEN) {
    // a dot: a short mark (or a tap) near it, whatever its direction
    return ld <= Math.max(lm * 3, 160) && dist(centre(drawn), centre(med)) < DOT_TOL;
  }
  if (ld < TAP_LEN) return false;
  const ed = extent(drawn), em = extent(med);
  if (ed < em * LEN_MIN || ed > em * LEN_MAX) return false;
  if (dist(drawn[0], med[0]) > END_TOL || dist(drawn[drawn.length - 1], med[med.length - 1]) > END_TOL) return false;
  if (turn(vec(drawn), vec(med)) > ANGLE_TOL && Math.hypot(...vec(med)) > 60) return false;
  return meanDist(drawn, med) < TOL;
}

export type Verdict =
  | { kind: "ok" }
  | { kind: "tap" }
  /** the stroke is right but belongs to a later place: "笔顺不对" (index of the stroke it fits) */
  | { kind: "order"; index: number }
  /** the right place and shape, drawn the wrong way round */
  | { kind: "direction" }
  | { kind: "miss" };

/**
 * Judges a drawn stroke: `medians` are the centre lines of the whole character, `done` the strokes already written, `expected` the next one.
 * Only an unwritten stroke can be matched as a wrong order.
 */
export function judge(drawn: Pt[], medians: Pt[][], done: ReadonlySet<number>, expected: number): Verdict {
  const med = medians[expected];
  if (!med || !drawn.length) return { kind: "tap" };
  if (pathLength(drawn) < TAP_LEN && !(isDot(med) && fits(drawn, med))) {
    // a tap: ignored; but a dot of a later place is still a wrong order only when it was clearly drawn there (a tap is never counted)
    return { kind: "tap" };
  }
  if (fits(drawn, med)) return { kind: "ok" };
  if (!isDot(med) && fits([...drawn].reverse(), med)) return { kind: "direction" };
  let best = -1, bestCost = Infinity;
  for (let j = 0; j < medians.length; j++) {
    if (j === expected || done.has(j) || !fits(drawn, medians[j])) continue;
    const c = isDot(medians[j]) ? dist(centre(drawn), centre(medians[j])) : meanDist(drawn, medians[j]);
    if (c < bestCost) { bestCost = c; best = j; }
  }
  if (best >= 0) return { kind: "order", index: best };
  return { kind: "miss" };
}

/** stars for a finished character: no mistake 3, up to two 2, more 1 */
export const starsFor = (mistakes: number): number => (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1);

/** progress of a child: the best stars of each character written (`write/<kid>.json`) */
export interface Written { stars: number; n: number; last: string }
export interface WriteDoc { written: Record<string, Written> }
export const EMPTY_WRITE: WriteDoc = { written: {} };
export function addResult(doc: WriteDoc, ch: string, stars: number, today: string): WriteDoc {
  const cur = doc.written[ch];
  return { ...doc, written: { ...doc.written, [ch]: { stars: Math.max(cur?.stars ?? 0, stars), n: (cur?.n ?? 0) + 1, last: today } } };
}
