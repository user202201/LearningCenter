/**
 * The maps of the 地图 page: the data (src/data/geomap-china.json / geomap-world.json, made by scripts/make-geomap.mjs), the shapes they are made of and the hit
 * test (which region did the finger touch). Pure: no screen, no storage. Coordinates are the "view units" of each map's viewBox (2000 wide).
 */
export type Pt = [number, number];
export type Ring = Pt[];

export interface Prov { id: string; n: string; full: string; ab: string; cap: string; ct: string; type: string; reg: string; py: string; lv: number; d: string; lp: Pt; area: number; cp: Pt; nb: string[] }
export interface Feat { id: string; n: string; lv: number; d: string; lp: Pt; kind?: string }
export interface Place { id: string; n: string; p: Pt; cap?: number }
export interface ChinaData {
  vb: [number, number, number, number]; regions: string[]; provinces: Prov[];
  inset: { box: [number, number, number, number]; land: string; islands: { n: string; p: Pt }[]; dashes: string[] };
  nbrs: { id: string; n: string; d: string; lp: Pt }[];
  rivers: Feat[]; mountains: Feat[]; lakes: Feat[]; areas: Feat[]; cities: Place[]; seas: { n: string; p: Pt }[]; points: Place[];
}
export interface Country { id: string; a3: string; n: string; py: string; cap: string; cont: string; lv: number; tc: number; d: string; lp: Pt; area: number; nb: string[] }
export interface WorldData {
  vb: [number, number, number, number]; continents: { id: string; n: string; py: string }[]; land: Record<string, string>; ural: Pt[];
  countries: Country[]; oceans: { id: string; n: string; d: string; lp: Pt; lps: Pt[] }[];
}
export interface Geo { china: ChinaData; world: WorldData }

let cache: Geo | null = null;
/** both maps: part of the program (compiled in, works offline); loaded the first time the page is opened */
export async function loadGeo(): Promise<Geo> {
  if (cache) return cache;
  const [c, w] = await Promise.all([import("./data/geomap-china.json"), import("./data/geomap-world.json")]);
  cache = { china: c.default as unknown as ChinaData, world: w.default as unknown as WorldData };
  return cache;
}

// ---------- paths ----------
/** "Mx,y l dx,dy dx,dy z" (one or more parts) -> absolute points per part */
export function parseParts(d: string): Pt[][] {
  const out: Pt[][] = [];
  for (const part of d.split("M").slice(1)) {
    const [head, rest = ""] = part.split("l");
    const [x0, y0] = head.split(",").map(Number);
    const pts: Pt[] = [[x0, y0]];
    let x = x0, y = y0;
    for (const pair of rest.replace(/z\s*$/, "").trim().split(/\s+/)) {
      if (!pair) continue;
      const [dx, dy] = pair.split(",").map(Number);
      x += dx; y += dy; pts.push([x, y]);
    }
    out.push(pts);
  }
  return out;
}
/** closed rings (the first point is repeated at the end) */
export const parseRings = (d: string): Ring[] => parseParts(d).map((r) => (r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? [...r, r[0]] : r));

// ---------- shapes and the hit test ----------
export interface Shape {
  id: string; layer: string; line: boolean; rings: Ring[];
  bbox: [number, number, number, number]; area: number; lp: Pt;
  /** a magnified round target on screen (px) round `at`, for regions that are only a few pixels wide */
  dot?: boolean;
}
const ringArea = (r: Ring): number => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
export function makeShape(id: string, layer: string, d: string, lp: Pt, line = false, dot = false): Shape {
  const rings = line ? parseParts(d) : parseRings(d);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const area = line ? 0 : rings.reduce((s, r, i) => s + Math.abs(ringArea(r)) * (i === 0 || Math.sign(ringArea(r)) === Math.sign(ringArea(rings[0])) ? 1 : -1), 0);
  return { id, layer, line, rings, bbox: [x0, y0, x1, y1], area, lp, dot };
}
const inRing = (x: number, y: number, r: Ring): boolean => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
/** is the point inside the shape (even-odd over all its rings: holes work) */
export function inside(s: Shape, x: number, y: number): boolean {
  if (s.line || x < s.bbox[0] || x > s.bbox[2] || y < s.bbox[1] || y > s.bbox[3]) return false;
  let c = false;
  for (const r of s.rings) if (inRing(x, y, r)) c = !c;
  return c;
}
const segDist = (x: number, y: number, a: Pt, b: Pt): number => { const dx = b[0] - a[0], dy = b[1] - a[1]; const L = dx * dx + dy * dy; const t = L ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L)) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
/** distance from the point to the outline (or the line) of the shape */
export function edgeDist(s: Shape, x: number, y: number): number {
  let d = Infinity;
  for (const r of s.rings) for (let i = 0; i < r.length - 1; i++) d = Math.min(d, segDist(x, y, r[i], r[i + 1]));
  return d;
}
/** where the magnified dot of a small region sits on screen: round the region's label point, moved by a fixed number of pixels (so that two close regions do not overlap) */
export const DOT_OFFSET: Record<string, Pt> = { bj: [-30, -22], tj: [30, -10], sh: [34, 8], hk: [30, 22], mo: [-28, 26] };
/** the radius of a dot in pixels */
export const DOT_R = 13;
/** the point of the dot in view units, at `s` pixels per view unit */
export const dotAt = (s: Shape, scale: number): Pt => { const o = DOT_OFFSET[s.id] ?? [0, 0]; return [s.lp[0] + o[0] / scale, s.lp[1] + o[1] / scale]; };

export interface Hit { id: string; layer: string; via: "dot" | "inside" | "near" | "line" }
/**
 * The region under a touch at view point (x, y). `tol` = how far (view units) a touch may miss a region's edge or a line; `scale` = pixels per view unit
 * (the size of the dots). Order: a dot (small regions) -> the smallest region that contains the point -> a line that is near enough -> the nearest region edge within `tol`.
 * `layers` restricts what can be hit (e.g. only the provinces in a quiz).
 */
export function hitTest(shapes: Shape[], x: number, y: number, tol: number, scale: number, layers?: string[]): Hit | null {
  const list = layers ? shapes.filter((s) => layers.includes(s.layer)) : shapes;
  let best: Hit | null = null, bestD = Infinity;
  for (const s of list) if (s.dot) { const [dx, dy] = dotAt(s, scale); const d = Math.hypot(x - dx, y - dy); if (d <= DOT_R / scale && d < bestD) { bestD = d; best = { id: s.id, layer: s.layer, via: "dot" }; } }
  if (best) return best;
  let inArea = Infinity;
  for (const s of list) if (!s.line && inside(s, x, y) && s.area < inArea) { inArea = s.area; best = { id: s.id, layer: s.layer, via: "inside" }; }
  // lines (rivers, mountains) are thin: a line within `tol` wins over the plain area it crosses
  let lineD = Infinity, line: Hit | null = null;
  for (const s of list) if (s.line && x >= s.bbox[0] - tol && x <= s.bbox[2] + tol && y >= s.bbox[1] - tol && y <= s.bbox[3] + tol) { const d = edgeDist(s, x, y); if (d <= tol && d < lineD) { lineD = d; line = { id: s.id, layer: s.layer, via: "line" }; } }
  if (line) return line;
  if (best) return best;
  let nearD = tol;
  for (const s of list) if (!s.line && x >= s.bbox[0] - tol && x <= s.bbox[2] + tol && y >= s.bbox[1] - tol && y <= s.bbox[3] + tol) { const d = edgeDist(s, x, y); if (d <= nearD) { nearD = d; best = { id: s.id, layer: s.layer, via: "near" }; } }
  return best;
}

/** the shapes of the China map: provinces (small ones with a dot), then rivers / mountains (lines), lakes and the land forms (areas) */
export function chinaShapes(c: ChinaData): Shape[] {
  const out: Shape[] = [];
  for (const p of c.provinces) out.push(makeShape(p.id, "prov", p.d, p.lp, false, DOT_OFFSET[p.id] !== undefined));
  for (const r of c.rivers) out.push(makeShape(r.id, "river", r.d, r.lp, true));
  for (const m of c.mountains) out.push(makeShape(m.id, "mountain", m.d, m.lp, true));
  for (const l of c.lakes) out.push(makeShape(l.id, "lake", l.d, l.lp));
  for (const a of c.areas) out.push(makeShape(a.id, "area", a.d, a.lp));
  return out;
}
/** the shapes of the world map: the listed countries, the continents (land that is not a listed country, per continent) and the four oceans */
export function worldShapes(w: WorldData): Shape[] {
  const out: Shape[] = [];
  for (const c of w.countries) out.push(makeShape(c.id, "country", c.d, c.lp));
  for (const [k, d] of Object.entries(w.land)) out.push(makeShape(k, "land", d, [0, 0]));
  for (const o of w.oceans) out.push(makeShape(o.id, "ocean", o.d, o.lp));
  return out;
}
/** the continent of a hit on the world map: of the country, of the land piece (Russia: west or east of the Urals), or null */
export function continentOf(w: WorldData, hit: Hit | null, x: number): string | null {
  if (!hit) return null;
  if (hit.layer === "country") { if (hit.id === "ru") return urals(w, x) ? "eu" : "as"; return w.countries.find((c) => c.id === hit.id)?.cont ?? null; }
  if (hit.layer === "land") return hit.id === "ruEu" ? "eu" : hit.id === "ruAs" ? "as" : hit.id;
  return null;
}
/** is x (a view point of Russia) west of the Urals? (a straight test against the Ural line, which runs almost up-down) */
const urals = (w: WorldData, x: number): boolean => { const xs = w.ural.map((p) => p[0]); return x < xs.reduce((a, b) => a + b, 0) / xs.length; };

/** the provinces a line / area passes through (computed: sample points along it); for the page's "流经 / 位于" line */
export function provincesAlong(provs: Shape[], f: Shape): string[] {
  const hit = new Set<string>();
  const test = (x: number, y: number) => { for (const p of provs) if (inside(p, x, y)) { hit.add(p.id); break; } };
  if (f.line) {
    for (const part of f.rings) for (let i = 0; i < part.length - 1; i++) {
      const [a, b] = [part[i], part[i + 1]], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 6));
      for (let k = 0; k <= n; k++) test(a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n);
    }
  } else {
    for (let x = f.bbox[0]; x <= f.bbox[2]; x += 12) for (let y = f.bbox[1]; y <= f.bbox[3]; y += 12) if (inside(f, x, y)) test(x, y);
  }
  return [...hit];
}
