// Makes src/data/geomap-china.json and src/data/geomap-world.json: the simplified maps of the 地图 page (#/science/map).
//
// Source data (all public domain / permissive, downloaded once into a temp folder, NOT committed):
//   Natural Earth (https://www.naturalearthdata.com, public domain) through https://github.com/nvkelso/natural-earth-vector
//     ne_10m_admin_0_countries_chn   countries drawn from the CHINESE point of view (Taiwan, Hong Kong, Macao, South Tibet, the South China Sea islands are China)
//     ne_10m_admin_1_states_provinces provinces of China (the 31 mainland ones, the counties of Taiwan, Hong Kong's districts)
//     ne_10m_rivers_lake_centerlines, ne_10m_lakes
// Needs `npm i --no-save polygon-clipping` (MIT) run once in a folder whose path is given in the environment variable NM (default: ./node_modules) and
// `pinyin-pro` from the project.
// Run:  NM=/some/dir/node_modules node scripts/make-geomap.mjs [cacheDir]
// What is hand-written (provinces, capitals, rivers that are not in the source, mountains, plateaus ...) is in scripts/geomap/tables.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { pinyin } from "pinyin-pro";
import * as T from "./geomap/tables.mjs";

const NM = process.env.NM ? path.resolve(process.env.NM) : path.resolve("node_modules");
const pc = createRequire(NM.endsWith("/") ? NM : NM + "/")("polygon-clipping");
const cache = process.argv[2] ?? path.join(os.tmpdir(), "geomap-ne");
fs.mkdirSync(cache, { recursive: true });
const BASE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/";
async function load(name) {
  const f = path.join(cache, name + ".geojson");
  if (!fs.existsSync(f)) {
    const r = await fetch(BASE + name + ".geojson");
    if (!r.ok) throw new Error(name + " " + r.status);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  return JSON.parse(fs.readFileSync(f, "utf8"));
}

// ---------- geometry helpers (coordinates as [x, y]) ----------
const mp = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);   // a (multi)polygon as a list of polygons (list of rings)
const ringArea = (r) => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s / 2; };
/** Douglas-Peucker on an open polyline */
function dp(pts, eps) {
  const n = pts.length; if (n < 3) return pts.slice();
  const keep = new Uint8Array(n); keep[0] = keep[n - 1] = 1;
  const st = [[0, n - 1]];
  while (st.length) {
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b]; const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const d = L === 0 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + bx * ay - by * ax) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/** a closed ring: the ring is cut at its two farthest-apart-ish points so that Douglas-Peucker does not collapse it */
function dpRing(r, eps) {
  const pts = r.slice(0, -1); if (pts.length < 4) return r;
  let far = 0, fd = -1; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; far = i; } }
  const a = dp(pts.slice(0, far + 1), eps), b = dp([...pts.slice(far), pts[0]], eps);
  const out = [...a, ...b.slice(1, -1)]; out.push(out[0]); return out;
}
const round = (p) => [Math.round(p[0]), Math.round(p[1])];
/** polygons (lists of rings, projected) -> simplified integer rings; tiny rings are dropped (min = area in square units) */
function simplifyPolys(polys, eps, min) {
  const out = [];
  for (const poly of polys) {
    const rings = [];
    poly.forEach((ring, i) => {
      let r = dpRing(ring.map(round), eps);
      const dedup = [r[0]]; for (const p of r.slice(1)) { const q = dedup[dedup.length - 1]; if (p[0] !== q[0] || p[1] !== q[1]) dedup.push(p); }
      r = dedup; if (r.length < 4) return;
      const a = Math.abs(ringArea(r)); if (a < (i === 0 ? min : min * 2)) return;
      rings.push(r);
    });
    if (rings.length && Math.abs(ringArea(rings[0])) >= min) out.push(rings);
  }
  return out;
}
/** relative path: "M x,y l dx,dy dx,dy z" per ring (integers) */
function encode(polys) {
  let d = "";
  for (const poly of polys) for (const r of poly) {
    d += `M${r[0][0]},${r[0][1]}l`;
    const parts = []; for (let i = 1; i < r.length - 1; i++) parts.push(`${r[i][0] - r[i - 1][0]},${r[i][1] - r[i - 1][1]}`);
    d += parts.join(" ") + "z";
  }
  return d;
}
const encodeLine = (pts) => `M${pts[0][0]},${pts[0][1]}l` + pts.slice(1).map((p, i) => `${p[0] - pts[i][0]},${p[1] - pts[i][1]}`).join(" ");
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > y) !== (r[j][1] > y) && x < ((r[j][0] - r[i][0]) * (y - r[i][1])) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; return c; };
const segDist = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const t = dx || dy ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy))) : 0; return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); };
/** signed distance from a point to a polygon (positive inside) */
function polyDist(x, y, poly) {
  let inside = false, d = Infinity;
  poly.forEach((r, k) => { if (inRing(x, y, r)) inside = k === 0 ? !inside || inside : !inside; for (let i = 0; i < r.length - 1; i++) d = Math.min(d, segDist(x, y, r[i], r[i + 1])); });
  let ins = inRing(x, y, poly[0]); for (const h of poly.slice(1)) if (inRing(x, y, h)) ins = !ins;
  return ins ? d : -d;
}
/** the point inside the polygon that is farthest from its edge (the "label point"): a coarse grid, then refined round the best cell */
function labelPoint(poly) {
  const xs = poly[0].map((p) => p[0]), ys = poly[0].map((p) => p[1]);
  let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  let best = { x: poly[0][0][0], y: poly[0][0][1], d: -Infinity };
  let step = Math.max(x1 - x0, y1 - y0) / 24;
  for (let pass = 0; pass < 5; pass++) {
    for (let x = x0; x <= x1; x += step) for (let y = y0; y <= y1; y += step) { const d = polyDist(x, y, poly); if (d > best.d) best = { x, y, d }; }
    x0 = best.x - step; x1 = best.x + step; y0 = best.y - step; y1 = best.y + step; step /= 4;
  }
  return [Math.round(best.x), Math.round(best.y)];
}
const unionAll = (list) => (list.length === 1 ? list[0] : pc.union(list[0], ...list.slice(1)));
/** pre-simplification in degrees (so that clipping is fast) */
const preSimplify = (polys, eps) => polys.map((poly) => { const rs = poly.map((r) => dpRing(r, eps)); return rs[0].length >= 4 ? [rs[0], ...rs.slice(1).filter((r) => r.length >= 4)] : null; }).filter(Boolean);
const clipBox = (polys, x0, y0, x1, y1) => pc.intersection(polys, [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]]);
const pyName = (s) => { const w = pinyin(s, { toneType: "symbol", type: "array" }); const j = w.join(""); return j[0].toUpperCase() + j.slice(1); };

// ---------- projections ----------
const rad = Math.PI / 180;
function albers(lat1, lat2, lat0, lon0) {
  const n = (Math.sin(lat1 * rad) + Math.sin(lat2 * rad)) / 2, C = Math.cos(lat1 * rad) ** 2 + 2 * n * Math.sin(lat1 * rad);
  const rho = (la) => Math.sqrt(C - 2 * n * Math.sin(la * rad)) / n, r0 = rho(lat0);
  return ([lo, la]) => { const th = n * (lo - lon0) * rad; return [rho(la) * Math.sin(th), -(r0 - rho(la) * Math.cos(th))]; };   // y down
}
/** Natural Earth projection (Savric) */
function naturalEarth([lo, la]) {
  const l = lo * rad, p = la * rad, p2 = p * p, p4 = p2 * p2;
  return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))), -p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
};

const out = {};
const cn0 = await load("ne_10m_admin_0_countries_chn");
const a1 = await load("ne_10m_admin_1_states_provinces");

// =====================================================================================================  CHINA
{
  const proj0 = albers(25, 47, 0, 105);
  const geoOf = {};   // id -> polygons in lon/lat (before simplification)
  for (const f of a1.features) {
    if (f.properties.adm0_a3 !== "CHN") continue;
    const row = T.PROVINCES.find((p) => p[1] === f.properties.name);
    if (row) geoOf[row[0]] = mp(f.geometry);
  }
  geoOf.tw = unionAll(a1.features.filter((f) => f.properties.adm0_a3 === "TWN").map((f) => mp(f.geometry)));
  geoOf.hk = mp(cn0.features.find((f) => f.properties.ADM0_A3 === "HKG").geometry);
  geoOf.mo = mp(cn0.features.find((f) => f.properties.ADM0_A3 === "MAC").geometry);
  // South Tibet (藏南): the country outline of the Chinese map minus every province is mostly this one piece; it belongs to 西藏 on a Chinese map
  const chn = mp(cn0.features.find((f) => f.properties.ADM0_A3 === "CHN").geometry);
  const covered = unionAll([...Object.values(geoOf)]);
  const left = pc.difference(chn, covered).filter((p) => Math.abs(ringArea(p[0])) > 3);
  console.log("South Tibet pieces:", left.length, left.map((p) => Math.round(ringArea(p[0]) * 100) / 100));
  geoOf.xz = unionAll([geoOf.xz, ...left]);
  // true neighbours (from the full-resolution lines): two regions share a border when they share at least 3 vertices
  const key = (p) => p[0].toFixed(3) + "," + p[1].toFixed(3);
  const vset = {}; for (const [id, polys] of Object.entries(geoOf)) vset[id] = new Set(polys.flatMap((poly) => poly.flatMap((r) => r.map(key))));
  const nb = Object.fromEntries(T.PROVINCES.map((p) => [p[0], new Set()]));
  const ids = T.PROVINCES.map((p) => p[0]);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { let n = 0; for (const k of vset[ids[i]]) if (vset[ids[j]].has(k)) n++; if (n >= 3) { nb[ids[i]].add(ids[j]); nb[ids[j]].add(ids[i]); } }
  for (const [a, b] of T.NB_ADD) { nb[a].add(b); nb[b].add(a); }
  // the map frame: the mainland + Taiwan (the islands of the South China Sea are in the inset)
  const project = (polys) => polys.map((poly) => poly.map((r) => r.map(proj0)));
  let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
  for (const polys of Object.values(geoOf)) for (const poly of polys) for (const p of poly[0]) { const q = proj0(p); bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
  const W = 2000, pad = 0.035;
  const scale = (W * (1 - 2 * pad)) / (bx1 - bx0);
  const ox = -bx0 * scale + W * pad, oy = -by0 * scale + W * pad;
  const P = (ll) => { const q = proj0(ll); return [q[0] * scale + ox, q[1] * scale + oy]; };
  const Pall = (polys) => polys.map((poly) => poly.map((r) => r.map(P)));
  const H = Math.round((by1 - by0) * scale + 2 * W * pad + 150);   // 150 units of room for the inset under Taiwan / Guangdong
  const EPS = 1.1, MIN = 6;
  const provinces = [];
  for (const row of T.PROVINCES) {
    const [id, , n, full, ab, cap, ct, type, reg, lv, clon, clat] = row;
    const polys = simplifyPolys(Pall(geoOf[id]), EPS, id === "hk" || id === "mo" ? 0.5 : MIN);
    // the label point is taken in the largest piece
    const big = polys.slice().sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])))[0];
    const area = polys.reduce((s, p) => s + Math.abs(ringArea(p[0])) - p.slice(1).reduce((t, r) => t + Math.abs(ringArea(r)), 0), 0);
    if (!polys.length) throw new Error("no geometry for " + id);
    provinces.push({ id, n, full, ab, cap, ct, type, reg, py: pyName(n), lv, d: encode(polys), lp: labelPoint(big), area: Math.round(area), cp: P([clon, clat]).map(Math.round), nb: [...nb[id]].sort() });
  }
  // inset: 南海诸岛 box in the lower right
  const boxW = 330, boxH = 380, bxL = W - boxW - 28, bxT = H - boxH - 28;
  const lon0 = 105.5, lon1 = 124.5, lat0 = 1.5, lat1 = 22.5;
  const insetP = ([lo, la]) => [bxL + ((lo - lon0) / (lon1 - lon0)) * boxW, bxT + ((lat1 - la) / (lat1 - lat0)) * boxH];
  const landBox = clipBox(preSimplify(cn0.features.flatMap((f) => mp(f.geometry)), 0.03), lon0 - 0.5, lat0 - 0.5, lon1 + 0.5, lat1 + 0.5);
  // (the inset land: the coast of China, Viet Nam, the Philippines, Malaysia ...; the islands of the groups are drawn as dots)
  const insetLand = simplifyPolys(landBox.map((poly) => poly.map((r) => r.map(insetP))), 0.9, 1).map((poly) => poly.map((r) => r.map((p) => [Math.max(bxL, Math.min(bxL + boxW, p[0])), Math.max(bxT, Math.min(bxT + boxH, p[1]))])));
  const inset = {
    box: [Math.round(bxL), Math.round(bxT), boxW, boxH], land: encode(insetLand),
    islands: T.ISLANDS.map(([n, lo, la]) => ({ n, p: insetP([lo, la]).map(Math.round) })),
    dashes: T.DASHES.map((seg) => { const [a, b] = seg.map((ll) => insetP(ll)); const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; return encodeLine([[m[0] + (a[0] - m[0]) * 1.5, m[1] + (a[1] - m[1]) * 1.5], [m[0] + (b[0] - m[0]) * 1.5, m[1] + (b[1] - m[1]) * 1.5]].map((p) => p.map(Math.round))); }),
  };
  // neighbouring countries as a quiet background (clipped to the frame, heavily simplified); the names of the big ones are labelled
  const wantN = ["RUS", "MNG", "KAZ", "KGZ", "TJK", "AFG", "PAK", "IND", "NPL", "BTN", "BGD", "MMR", "LAO", "VNM", "PRK", "KOR", "JPN", "THA", "PHL", "TWN", "UZB", "BRN", "MYS", "KHM"];
  const nbrs = [];
  for (const f of cn0.features) {
    const a3 = f.properties.ADM0_A3; if (!wantN.includes(a3)) continue;
    const row = T.COUNTRIES.find((c) => c[1] === a3);
    const polys = clipBox(preSimplify(mp(f.geometry), 0.04), 55, 2, 150, 62);
    if (!polys.length) continue;
    const s = simplifyPolys(Pall(polys), 1.6, 40);
    if (s.length) nbrs.push({ id: row ? row[0] : a3.toLowerCase(), n: row ? row[2] : "", d: encode(s), lp: labelPoint(s.slice().sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])))[0]) });
  }
  // overlays
  const ne = { rivers: await load("ne_10m_rivers_lake_centerlines"), lakes: await load("ne_10m_lakes") };
  const inChina = (c) => c[0] > 70 && c[0] < 136 && c[1] > 17 && c[1] < 54;
  const rivers = [];
  for (const [id, n, names, lv] of T.RIVERS) {
    const parts = [];
    for (const f of ne.rivers.features) if (names.includes(f.properties.name)) for (const line of f.geometry.type === "LineString" ? [f.geometry.coordinates] : f.geometry.coordinates) {
      // only the part inside the China frame (cut where it leaves); names like "Xi" exist elsewhere, so a line must have a point in the frame
      if (!line.some(inChina)) continue;
      const near = line.filter(inChina); if (near.length < 2) continue;
      parts.push(line.filter(inChina));
    }
    if (!parts.length) { console.warn("river without data:", n); continue; }
    const lines = parts.map((l) => dp(l.map(P), 1.4).map(round)).filter((l) => l.length >= 2);
    const longest = lines.slice().sort((a, b) => b.length - a.length)[0];
    rivers.push({ id, n, lv, d: lines.map(encodeLine).join(""), lp: longest[Math.floor(longest.length / 2)] });
  }
  for (const [id, n, pts, lv] of T.RIVERS_HAND) { const l = pts.map(P).map(round); rivers.push({ id, n, lv, d: encodeLine(l), lp: l[Math.floor(l.length / 2)] }); }
  const mountains = T.MOUNTAINS.map(([id, n, pts, lv]) => { const l = pts.map(P).map(round); return { id, n, lv, d: encodeLine(l), lp: l[Math.floor(l.length / 2)] }; });
  const lakes = [];
  for (const [id, n, nen, lv] of T.LAKES) {
    const f = ne.lakes.features.find((x) => x.properties.name === nen);
    if (!f) { console.warn("lake without data:", n); continue; }
    const polys = simplifyPolys(Pall(mp(f.geometry)), 0.7, 1.5);
    if (!polys.length) { console.warn("lake too small:", n); continue; }
    lakes.push({ id, n, lv, d: encode(polys), lp: labelPoint(polys.slice().sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])))[0]) });
  }
  const chinaAll = unionAll(Object.values(geoOf));
  const areas = T.AREAS.map(([id, n, kind, pts, lv]) => {
    const ring = pts.slice(); ring.push(ring[0]);
    const clipped = pc.intersection([[ring]], chinaAll);   // (only the part inside China)
    const polys = simplifyPolys(Pall(clipped), 1, 20);
    return { id, n, kind, lv, d: encode(polys), lp: labelPoint(polys.slice().sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])))[0]) };
  });
  const cities = [
    ...T.PROVINCES.filter((p) => p[0] !== "mo").map((p) => ({ id: p[0], n: p[5], cap: 1, p: P([p[10], p[11]]).map(Math.round) })),
    ...T.CITIES.map(([id, n, lo, la]) => ({ id, n, p: P([lo, la]).map(Math.round) })),
  ];
  const seas = T.SEAS.map(([n, lo, la]) => ({ n, p: P([lo, la]).map(Math.round) }));
  const points = T.POINTS.map(([id, n, lo, la]) => ({ id, n, p: P([lo, la]).map(Math.round) }));
  out.china = { vb: [0, 0, W, H], regions: T.REGIONS, provinces, inset, nbrs, rivers, mountains, lakes, areas, cities, seas, points };
}

// =====================================================================================================  WORLD
{
  const W = 2000;
  const pr = (ll) => naturalEarth(ll);
  // frame from -180..180 x -58..84 (Antarctica is cut at -62 to keep the page compact; it is a strip at the bottom)
  const LATMIN = -78, LATMAX = 84;
  const [fx0, fy0] = pr([-180, LATMAX]), [fx1, fy1] = pr([180, LATMIN]);
  const sc = W / (fx1 - fx0);
  const P = (ll) => { const q = pr([Math.max(-180, Math.min(180, ll[0])), Math.max(-90, Math.min(90, ll[1]))]); return [(q[0] - fx0) * sc, (q[1] - fy0) * sc]; };
  const H = Math.round((fy1 - fy0) * sc);
  const Pall = (polys) => polys.map((poly) => poly.map((r) => r.map(P)));
  const rows = new Map(T.COUNTRIES.map((c) => [c[1], c]));
  const countries = [], landBy = {}, geoOf = {};
  const urals = [];
  const clipAsia = (polys) => pc.intersection(polys, [[[60, -90], [200, -90], [200, 90], [60, 90], [60, -90]]]);
  const clipEu = (polys) => pc.intersection(polys, [[[-200, -90], [60, -90], [60, 90], [-200, 90], [-200, -90]]]);
  for (const f of cn0.features) {
    const a3 = f.properties.ADM0_A3;
    let polys = mp(f.geometry);
    if (a3 === "FRA") polys = polys.filter((poly) => poly[0].some((p) => p[0] > -6 && p[0] < 10 && p[1] > 41 && p[1] < 52));   // metropolitan France (not French Guiana ...)
    if (a3 === "NLD") polys = polys.filter((poly) => poly[0].some((p) => p[0] > 3 && p[0] < 8 && p[1] > 50));
    if (a3 === "PRT") polys = polys.filter((poly) => poly[0].some((p) => p[0] > -10 && p[0] < -6 && p[1] > 36));
    if (a3 === "ESP") polys = polys.filter((poly) => poly[0].some((p) => p[0] > -10 && p[0] < 5 && p[1] > 35));
    if (a3 === "USA") polys = polys.filter((poly) => poly[0].some((p) => p[0] < -60 && p[1] > 18));
    polys = preSimplify(polys, 0.02);
    const row = rows.get(a3);
    const cont = row ? row[4] : a3 === "ATA" ? "an" : CONT(a3, f.properties.CONTINENT);
    if (!cont) continue;   // open-sea islands
    if (a3 === "ATA") polys = polys.map((poly) => poly.map((r) => r.map((p) => [p[0], Math.max(p[1], LATMIN - 0.5)])));
    if (row) {
      geoOf[row[0]] = { row, polys, cont };
      if (a3 === "RUS") { // the Ural line (lon 60) as a polyline, to say on which side of it a tap is
        for (let la = 50; la <= 70; la += 2) urals.push(P([60, la]).map(Math.round));
      }
    } else {
      (landBy[cont] ??= []).push(...polys);
    }
  }
  const pieces = (polys) => simplifyPolys(Pall(polys), 0.9, 4);
  // continents: the land that is not one of the listed countries, merged per continent (Russia west of the Urals is Europe: clipped)
  const land = {};
  for (const [c, polys] of Object.entries(landBy)) land[c] = encode(pieces(polys));
  const rus = geoOf.ru;
  const rusEu = pieces(clipEu(rus.polys)), rusAs = pieces(clipAsia(rus.polys));
  land.ruEu = encode(rusEu); land.ruAs = encode(rusAs);   // (kept apart: the continent of a tap on Russia depends on the side)
  // listed countries
  const nbSets = {};
  const key = (p) => p[0].toFixed(2) + "," + p[1].toFixed(2);
  for (const [id, g] of Object.entries(geoOf)) nbSets[id] = new Set(g.polys.flatMap((poly) => poly.flatMap((r) => r.map(key))));
  const allVert = {};   // all countries (also the ones not listed), to know the real neighbours of a listed country
  const nbOf = Object.fromEntries(Object.keys(geoOf).map((id) => [id, new Set()]));
  const ids = Object.keys(geoOf);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { let n = 0; for (const k of nbSets[ids[i]]) if (nbSets[ids[j]].has(k)) n++; if (n >= 3) { nbOf[ids[i]].add(ids[j]); nbOf[ids[j]].add(ids[i]); } }
  for (const [a, b] of T.CNB_ADD) { nbOf[a].add(b); nbOf[b].add(a); }
  for (const [a, b] of T.CNB_DEL) { nbOf[a].delete(b); nbOf[b].delete(a); }
  for (const [id, g] of Object.entries(geoOf)) {
    const [, a3, n, cap, cont, lv, tc] = g.row;
    const polys = pieces(g.polys);
    const big = polys.slice().sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])))[0];
    const area = polys.reduce((s, p) => s + Math.abs(ringArea(p[0])), 0);
    countries.push({ id, a3, n, py: pyName(n), cap, cont, lv, tc: tc ? 1 : 0, d: encode(polys), lp: labelPoint(big), area: Math.round(area), nb: [...nbOf[id]].sort() });
  }
  const oceans = T.OCEANS.map(([id, n, rings]) => {
    const polys = rings.map((r) => { const rr = r.slice(); const dense = []; for (let i = 0; i < rr.length; i++) { const a = rr[i], b = rr[(i + 1) % rr.length]; const k = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8)); for (let s = 0; s < k; s++) dense.push([a[0] + ((b[0] - a[0]) * s) / k, a[1] + ((b[1] - a[1]) * s) / k]); } dense.push(dense[0]); return [dense.map(P)]; });
    const s = simplifyPolys(polys, 0.5, 4);
    return { id, n, d: encode(s), lp: labelPoint(s.slice().sort((a, b) => Math.abs(ringArea(b[0])) - Math.abs(ringArea(a[0])))[0]) };
  });
  // fixed label spots for the oceans (in the middle of open water, which the rough outlines do not always give)
  const spot = { pacific: [[-150, 8], [165, 5]], atlantic: [[-35, 25]], indian: [[78, -22]], arctic: [[-100, 80]] };
  for (const o of oceans) o.lps = spot[o.id].map((ll) => P(ll).map(Math.round));
  out.world = { vb: [0, 0, W, H], continents: T.CONTINENTS.map(([id, n]) => ({ id, n, py: pyName(n) })), land, ural: urals, countries, oceans };
  function CONT(a3, nec) { return T.CONT_OVERRIDE[a3] ?? T.NE_CONT[nec] ?? null; }
}

fs.writeFileSync("src/data/geomap-china.json", JSON.stringify(out.china));
fs.writeFileSync("src/data/geomap-world.json", JSON.stringify(out.world));
console.log("china", fs.statSync("src/data/geomap-china.json").size, "world", fs.statSync("src/data/geomap-world.json").size);
