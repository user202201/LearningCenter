/**
 * 地理实验室 (`#/science/geo`), the pure part: latitude / longitude, time zones, the Sun's height, scale, contour lines, terrain types, climate classification, weather tables,
 * population, plates and quake waves, the water balance, the earth's layers, energy mix, the question generators of every module, the generic fact-question maker and the
 * memory boxes of the practice page. No DOM, no storage except the progress of this device (`learn.geolab.v1`, written by `geolab.ts`). The content (lessons, banks, facts,
 * climate stations) is `src/data/geolab.json`, written from memory by a model: a teacher must proofread it. Questions are made on the spot from a seed.
 */
import { makeQ, numQ, shuffle, pick, fmt, clamp, type Q } from "./phys/qtools";
import * as SM from "./spacemodel";
import * as G from "./game";

export type Rng = () => number;
export interface BankQ { q: string; a: string; w: string[]; e: string; check?: boolean }
export interface Fact { n: string; box?: [number, number, number, number]; f: Record<string, string>; g?: string; e?: string; check?: boolean }
export interface FactMod { fields: Record<string, { label: string; q: string; rev?: string }>; entries: Fact[] }
export interface Station { n: string; lat: number; alt: number; t: number[]; p: number[]; type: string; check?: boolean }
export interface Country { n: string; iso: string; gdp: number; birth: number; dev: number }
export interface GeoData { lessons: Record<string, string[]>; banks: Record<string, BankQ[]>; facts: Record<string, FactMod>; stations: Station[]; development: { countries: Country[] } }
let cache: GeoData | null = null;
export async function loadGeo(): Promise<GeoData> { if (!cache) { cache = (await import("./data/geolab.json")).default as unknown as GeoData; setDevData(cache.development.countries); } return cache; }

// ---------- globe ----------
export const ZONES = ["热带", "北温带", "北寒带", "南温带", "南寒带"];
export const TROPIC = 23.5, CIRCLE = 66.5;
export function zoneOfLat(lat: number): string { const a = Math.abs(lat); if (a < TROPIC) return "热带"; const n = lat > 0; return a < CIRCLE ? (n ? "北温带" : "南温带") : (n ? "北寒带" : "南寒带"); }
export const hemiNS = (lat: number): string => (lat >= 0 ? "北半球" : "南半球");
export const hemiEW = (lon: number): string => (lon > -20 && lon < 160 ? "东半球" : "西半球");
export const latBand = (lat: number): string => { const a = Math.abs(lat); return a < 30 ? "低纬度" : a < 60 ? "中纬度" : "高纬度"; };
export const latStr = (lat: number): string => (lat === 0 ? "0°" : `${fmt(Math.abs(lat), 1)}°${lat > 0 ? "N" : "S"}`);
export const lonStr = (lon: number): string => (lon === 0 || Math.abs(lon) === 180 ? `${Math.abs(lon)}°` : `${fmt(Math.abs(lon), 1)}°${lon > 0 ? "E" : "W"}`);
/** the direction of B seen from A (both in the same hemisphere pair, |dlon| < 180) */
export function directionOf(a: { lat: number; lon: number }, b: { lat: number; lon: number }): string {
  const dy = Math.sign(b.lat - a.lat), dx = Math.sign(b.lon - a.lon);
  const names: Record<string, string> = { "1,0": "正北", "1,1": "东北", "0,1": "正东", "-1,1": "东南", "-1,0": "正南", "-1,-1": "西南", "0,-1": "正西", "1,-1": "西北" };
  return names[`${dy},${dx}`] ?? "原地";
}
export const DIRS8 = ["正北", "东北", "正东", "东南", "正南", "西南", "正西", "西北"];
export const KM_PER_DEG = 111;
export const parallelRatio = (lat: number): number => Math.cos((lat * Math.PI) / 180);

// ---------- time zones ----------
const CN = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"];
export function zoneOfLon(lon: number): number { const z = Math.round(lon / 15); return z === -12 ? 12 : z; }
export const zoneName = (z: number): string => (z === 0 ? "中时区" : z > 0 ? `东${CN[z]}区` : `西${CN[-z]}区`);
const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
export function monthDay(doy: number): string {
  let d = ((doy - 1) % 365 + 365) % 365 + 1, m = 0;
  while (d > MDAYS[m]) { d -= MDAYS[m]; m++; }
  return `${m + 1}月${d}日`;
}
/** the zone-time `dh` hours later (day numbered 1..365, wrapping) */
export function shiftTime(day: number, hour: number, dh: number): { day: number; hour: number } {
  const t = day * 24 + hour + dh;
  const d = Math.floor(t / 24);
  return { day: ((d - 1) % 365 + 365) % 365 + 1, hour: t - d * 24 };
}
export const clock = (hour: number): string => `${Math.floor(hour)}:${String(Math.round((hour % 1) * 60)).padStart(2, "0")}`;
/** the local time (day offset from the UTC day, hour) of a zone when it is `utc` o'clock in zone 0 */
export function localAt(utc: number, zone: number): { off: number; hour: number } { const t = utc + zone; const off = Math.floor(t / 24); return { off, hour: t - off * 24 }; }
/** the longitude where it is noon when it is `utc` o'clock in zone 0 */
export function noonLon(utc: number): number { let l = (12 - utc) * 15; while (l > 180) l -= 360; while (l <= -180) l += 360; return l; }

// ---------- the Sun, scale, contours ----------
export const SUN_DEC = { 春分: 0, 夏至: 23.5, 秋分: 0, 冬至: -23.5 } as Record<string, number>;
export const noonHeight = (lat: number, dec: number): number => SM.noonElevation(lat, dec);
export const realKm = (cm: number, den: number): number => (cm * den) / 100000;
export interface Hill { x: number; y: number; h: number; s: number }
/** the map is the unit square; a second small hill is fixed so that saddles and valleys exist */
export function heightAt(x: number, y: number, hill: Hill): number {
  const g = (cx: number, cy: number, s: number) => Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s));
  return 20 + hill.h * g(hill.x, hill.y, hill.s) + 220 * g(0.78, 0.7, 0.14);
}
export interface Seg { level: number; x1: number; y1: number; x2: number; y2: number }
/** contour segments by marching squares over an n x n grid of a function on the unit square */
export function contours(f: (x: number, y: number) => number, levels: number[], n = 48): Seg[] {
  const out: Seg[] = [], v: number[][] = [];
  for (let j = 0; j <= n; j++) { v.push([]); for (let i = 0; i <= n; i++) v[j].push(f(i / n, j / n)); }
  for (const L of levels) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const c = [v[j][i], v[j][i + 1], v[j + 1][i + 1], v[j + 1][i]], px = [i, i + 1, i + 1, i], py = [j, j, j + 1, j + 1];
    const pts: [number, number][] = [];
    for (let k = 0; k < 4; k++) {
      const a = c[k], b = c[(k + 1) % 4];
      if ((a < L) !== (b < L)) { const t = (L - a) / (b - a); pts.push([(px[k] + (px[(k + 1) % 4] - px[k]) * t) / n, (py[k] + (py[(k + 1) % 4] - py[k]) * t) / n]); }
    }
    if (pts.length === 2) out.push({ level: L, x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1] });
    else if (pts.length === 4) { out.push({ level: L, x1: pts[0][0], y1: pts[0][1], x2: pts[1][0], y2: pts[1][1] }); out.push({ level: L, x1: pts[2][0], y1: pts[2][1], x2: pts[3][0], y2: pts[3][1] }); }
  }
  return out;
}
export const tempAt = (t0: number, dh: number): number => t0 - (0.6 * dh) / 100;
export const LOWLAND = "海拔 200～500 米的平坦地（教材不单列）";
export function terrainType(alt: number, relief: number, feat: number): string {
  if (feat === 3) return "盆地";
  if (feat === 0) return alt >= 500 ? "高原" : alt < 200 ? "平原" : LOWLAND;   // plain: below about 200 m (as the lesson says); flat land at 200-500 m has no textbook name
  if (feat === 1) return alt >= 500 ? "高原" : relief <= 200 ? "丘陵" : "山地";   // hills: below 500 m AND a relative height of at most 200 m
  return alt >= 500 || relief >= 200 ? "山地" : "丘陵";
}
export const FEATS = ["地面平坦", "坡度和缓", "起伏很大、坡度陡", "四周高、中间低"];
export const TERRAINS = ["平原", "高原", "山地", "丘陵", "盆地"];

// ---------- climate ----------
export interface ClimateIn { tmin: number; tmax: number; ptot: number; pmin: number; share: number; alt: number }
export const CLIMATES = ["热带雨林气候", "热带季风气候", "热带草原气候", "热带沙漠气候", "亚热带季风气候", "温带季风气候", "温带大陆性气候", "温带海洋性气候", "地中海气候", "极地气候", "高原山地气候"];
export function climateOf(c: ClimateIn): string {
  if (c.tmax < 10) return "极地气候";
  if (c.alt >= 3000) return "高原山地气候";
  if (c.tmin >= 18) { if (c.ptot < 500) return "热带沙漠气候"; if (c.pmin >= 60) return "热带雨林气候"; return c.ptot >= 1900 ? "热带季风气候" : "热带草原气候"; }
  if (c.ptot < 250 && c.tmin >= 10) return "热带沙漠气候";
  if (c.tmin >= 0) { if (c.share < 40 && c.ptot < 1000) return "地中海气候"; return c.tmax < 22 ? "温带海洋性气候" : "亚热带季风气候"; }
  return c.ptot < 400 ? "温带大陆性气候" : "温带季风气候";
}
/** the numbers a climate chart shows; `share` = percent of the year's rain in the warm half-year (May-Oct north, Nov-Apr south) */
export function chartStats(s: Pick<Station, "t" | "p" | "lat" | "alt">): ClimateIn {
  const warm = s.lat >= 0 ? [4, 5, 6, 7, 8, 9] : [10, 11, 0, 1, 2, 3];
  const ptot = s.p.reduce((a, b) => a + b, 0);
  return { tmin: Math.min(...s.t), tmax: Math.max(...s.t), ptot, pmin: Math.min(...s.p), share: Math.round((100 * warm.reduce((a, i) => a + s.p[i], 0)) / ptot), alt: s.alt };
}
const ARCH: Record<string, [number, number][]> = {   // tmin, tmax, ptot, pmin, share, alt ranges
  热带雨林气候: [[24, 26], [26, 29], [2000, 3000], [100, 200], [45, 55], [0, 300]],
  热带季风气候: [[20, 24], [28, 32], [2000, 3000], [0, 30], [80, 90], [0, 300]],
  热带草原气候: [[20, 24], [27, 32], [700, 1500], [0, 20], [75, 90], [0, 800]],
  热带沙漠气候: [[12, 20], [28, 38], [10, 150], [0, 3], [30, 60], [0, 500]],
  亚热带季风气候: [[2, 12], [26, 30], [1000, 1800], [20, 50], [65, 80], [0, 500]],
  温带季风气候: [[-15, -3], [22, 28], [450, 800], [2, 10], [80, 92], [0, 800]],
  温带大陆性气候: [[-20, -8], [20, 26], [100, 350], [5, 15], [55, 70], [0, 1500]],
  温带海洋性气候: [[2, 6], [15, 20], [700, 1300], [40, 70], [45, 55], [0, 400]],
  地中海气候: [[6, 11], [22, 27], [400, 800], [5, 20], [15, 33], [0, 400]],
  极地气候: [[-40, -20], [-5, 8], [20, 200], [0, 10], [40, 60], [0, 3500]],
  高原山地气候: [[-10, 0], [12, 18], [300, 600], [2, 10], [60, 80], [3000, 4500]],
};
export function climateQ(r: Rng, type?: string): Q {
  for (let k = 0; k < 200; k++) {
    const ty = type ?? pick(r, CLIMATES), a = ARCH[ty];
    const rnd = ([lo, hi]: [number, number]) => Math.round(lo + r() * (hi - lo));
    const c: ClimateIn = { tmin: rnd(a[0]), tmax: rnd(a[1]), ptot: Math.round(rnd(a[2]) / 10) * 10, pmin: rnd(a[3]), share: rnd(a[4]), alt: Math.round(rnd(a[5]) / 100) * 100 };
    if (c.tmax <= c.tmin || climateOf(c) !== ty) continue;
    const south = ty === "地中海气候" ? r() < 0.5 : false;
    const months = south ? "11～4 月" : "5～10 月";
    const m = (v: number) => fmt(v, 0);
    const text = `某地最冷月均温 ${m(c.tmin)}℃，最热月均温 ${m(c.tmax)}℃，年降水量 ${c.ptot} 毫米，降水最少的月份 ${c.pmin} 毫米，${months}的降水占全年的 ${c.share}%，海拔 ${c.alt} 米。该地的气候类型是？`;
    return makeQ(r, "climate", [c.tmin, c.tmax, c.ptot, c.pmin, c.share, c.alt], text, ty, CLIMATES, "按各项数字对照：海拔 3000 米以上为高原山地；最热月低于 10℃ 为极地；最冷月 18℃ 以上为热带（降水少为沙漠，各月多雨为雨林，有旱季时年降水约 1900 毫米以上为季风、否则为草原）；冬季温和而夏季少雨为地中海；温和而夏季不热为海洋性，否则亚热带季风；冬冷则降水少为大陆性，降水多为季风。");
  }
  throw new Error("climateQ");
}

// ---------- weather ----------
export const BEAUFORT: [number, number][] = [[0, 0.2], [0.3, 1.5], [1.6, 3.3], [3.4, 5.4], [5.5, 7.9], [8.0, 10.7], [10.8, 13.8], [13.9, 17.1], [17.2, 20.7], [20.8, 24.4], [24.5, 28.4], [28.5, 32.6], [32.7, 36.9]];
export const beaufortText = (n: number): string => `${BEAUFORT[n][0].toFixed(1)}～${BEAUFORT[n][1].toFixed(1)} 米∕秒`;
export const RAIN = [["小雨", 0, 10], ["中雨", 10, 25], ["大雨", 25, 50], ["暴雨", 50, 100], ["大暴雨", 100, 250], ["特大暴雨", 250, 1e9]] as [string, number, number][];
export const rainClass = (mm: number): string => RAIN.find(([, a, b]) => mm >= a && mm < b)![0];
export const WINDS = ["北风", "东北风", "东风", "东南风", "南风", "西南风", "西风", "西北风"];

// ---------- population ----------
export const growthRate = (b: number, d: number): number => (b - d) / 10;
export const popAfter = (p0: number, r: number, years: number): number => p0 * Math.pow(1 + r / 100, years);
export const doubling = (r: number): number => 70 / r;
/** the three textbook types of the age structure (this exercise's dividing lines: growth >= 1 % expanding, <= -0.5 % declining, in between stable) */
export const pyramidOf = (r: number): string => (r >= 1 ? "增长型" : r <= -0.5 ? "衰退型" : "稳定型");

// ---------- plates, quakes ----------
export const VP = 6, VS = 3.5;
export const kmMoved = (cmPerYear: number, myr: number): number => cmPerYear * myr * 10;
export const waveGap = (d: number): number => d / VS - d / VP;
export const distFromGap = (dt: number): number => (dt * VP * VS) / (VP - VS);
export const energyRatio = (dm: number): number => Math.pow(10, 1.5 * dm);

// ---------- water, earth, energy ----------
export const runoff = (p: number, e: number): number => p - e;
export const LAYERS: [string, number, number, string][] = [["地壳", 0, 33, "固态"], ["地幔", 33, 2900, "固态为主（可缓慢流动）"], ["外核", 2900, 5100, "液态"], ["内核", 5100, 6371, "固态"]];
export const layerOf = (depth: number): string => LAYERS.find(([, a, b]) => depth >= a && depth < b)?.[0] ?? "内核";
export const groundTemp = (zKm: number): number => 15 + 30 * zKm;
export const FUELS: [string, number][] = [["煤", 0.95], ["石油", 0.75], ["天然气", 0.55], ["清洁能源", 0.02]];
export const co2Index = (coal: number, oil: number, gas: number, clean: number): number => coal * 0.95 + oil * 0.75 + gas * 0.55 + clean * 0.02;

// ---------- China ----------
export const CHINA_BOX = { latS: 4, latN: 53.5, lonW: 73, lonE: 135 };
export const inChinaBox = (lat: number, lon: number): boolean => lat >= CHINA_BOX.latS && lat <= CHINA_BOX.latN && lon >= CHINA_BOX.lonW && lon <= CHINA_BOX.lonE;
export function solarClock(beijingHour: number, lon: number): string { const m = (((beijingHour * 60 + (lon - 120) * 4) % 1440) + 1440) % 1440; return `${Math.floor(m / 60)}:${String(Math.round(m % 60)).padStart(2, "0")}`; }
export const STEP_PTS: [number, number][] = [[73, 3800], [80, 4800], [90, 5000], [98, 4500], [102, 3800], [103, 1800], [106, 1300], [110, 1200], [111, 700], [113, 300], [116, 60], [122, 0]];
export function altAt(lon: number): number {
  const p = STEP_PTS;
  if (lon <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (lon <= p[i][0]) { const [x0, y0] = p[i - 1], [x1, y1] = p[i]; return y0 + ((y1 - y0) * (lon - x0)) / (x1 - x0); }
  return p[p.length - 1][1];
}
/** the step of the schematic profile along about 35 degrees north (a longitude alone has no step: at 80 degrees east the Tibetan plateau is the first step, but the Tarim basin, farther north, is the second) */
export const stepOf = (lon: number): number => (lon < 102.5 ? 1 : lon < 111 ? 2 : 3);
export const PROFILE_LAT = 35;
export const STEPS = [
  { n: 1, alt: "平均海拔 4000 米以上", form: "青藏高原", range: "昆仑山—阿尔金山—祁连山—横断山以西" },
  { n: 2, alt: "海拔 1000～2000 米", form: "内蒙古高原、黄土高原、云贵高原；塔里木盆地、准噶尔盆地、四川盆地", range: "介于两条分界线之间" },
  { n: 3, alt: "海拔多在 500 米以下", form: "东北平原、华北平原、长江中下游平原、东南丘陵", range: "大兴安岭—太行山—巫山—雪峰山以东" }];
/** named places and their step (人教版 / 湘教版) */
export const STEP_PLACES: [string, number][] = [["青藏高原", 1], ["内蒙古高原", 2], ["黄土高原", 2], ["云贵高原", 2], ["塔里木盆地", 2], ["准噶尔盆地", 2], ["四川盆地", 2], ["东北平原", 3], ["华北平原", 3], ["长江中下游平原", 3], ["东南丘陵", 3]];

// ---------- the dates and the question helpers ----------
export const monthOfStart = (doy: number): number => { let d = doy, m = 0; while (d > MDAYS[m]) { d -= MDAYS[m]; m++; } return m + 1; };
const intIn = (r: Rng, a: number, b: number, step = 1): number => a + step * Math.floor(r() * (Math.floor((b - a) / step) + 1));

type Gen = (r: Rng) => Q;
const GEN: Record<string, Record<string, Gen>> = {};
GEN.globe = {
  zone: (r) => { const lat = pick(r, [intIn(r, -88, -68), intIn(r, -64, -26), intIn(r, -20, 20), intIn(r, 26, 64), intIn(r, 68, 88)]); const ans = zoneOfLat(lat);
    return makeQ(r, "zone", [lat], `某地的纬度是 ${latStr(lat)}，它位于哪个温度带？`, ans, ZONES, "以南北回归线（约 23.5°）和南北极圈（约 66.5°）为界划分五带。"); },
  hemi: (r) => { const lat = pick(r, [-1, 1]) * intIn(r, 5, 80, 5), lon = pick(r, [intIn(r, -170, -30, 10), intIn(r, 10, 150, 10)]); const ans = `${hemiNS(lat)}、${hemiEW(lon)}`;
    const all = ["南半球", "北半球"].flatMap((a) => ["东半球", "西半球"].map((b) => `${a}、${b}`));
    return makeQ(r, "hemi", [lat, lon], `某地的位置是 ${latStr(lat)}，${lonStr(lon)}，它位于哪个半球？`, ans, all, "赤道分南北半球；20°W 和 160°E 组成的经线圈分东西半球。"); },
  dlat: (r) => { const a = intIn(r, 5, 40, 5), d = intIn(r, 10, 50, 5); return numQ(r, "dlat", [a, a + d], `沿同一条经线，从北纬 ${a}° 到北纬 ${a + d}° 的距离约是多少（纬度相差 1° 约 ${KM_PER_DEG} 千米）？`, d * KM_PER_DEG, "千米", 0, `相差 ${d}°，${d} × ${KM_PER_DEG} = ${d * KM_PER_DEG} 千米。`); },
  parallel: (r) => { const lat = pick(r, [30, 60]); const v = Math.round(parallelRatio(lat) * 100) / 100;
    return makeQ(r, "parallel", [lat], `纬度 ${lat}° 的纬线长度约是赤道长度的多少倍？`, fmt(v, 2), ["1", "0.87", "0.5", "0.25", "0.75", "2"], "纬线长度 = 赤道长度 × cos 纬度，纬度越高越短。"); },
  dir: (r) => { for (;;) { const a = { lat: intIn(r, 10, 60, 10), lon: intIn(r, 70, 150, 10) }, b = { lat: a.lat + pick(r, [-10, 10]), lon: a.lon + pick(r, [-20, -10, 10, 20]) }; const ans = directionOf(a, b);
    return makeQ(r, "dir", [a.lat, a.lon, b.lat, b.lon], `A 地位于 ${latStr(a.lat)}，${lonStr(a.lon)}；B 地位于 ${latStr(b.lat)}，${lonStr(b.lon)}。B 地在 A 地的什么方向？`, ans, DIRS8, "北纬度数越大越靠北，东经度数越大越靠东。"); } },
};
GEN.timezone = {
  convert: (r) => { const z1 = pick(r, [8, 8, 0, 9, 1]), z2 = pick(r, [-5, -8, 0, 3, -3, 2].filter((z) => z !== z1)), day = intIn(r, 10, 350), hr = intIn(r, 0, 23, 1);
    const f = (t: { day: number; hour: number }) => `${monthDay(t.day)} ${t.hour}:00`;
    const ans = f(shiftTime(day, hr, z2 - z1));
    const wrong = [f(shiftTime(day, hr, z1 - z2)), f(shiftTime(day, hr, z2 - z1 + 1)), f(shiftTime(day, hr, z2 - z1 - 1)), f(shiftTime(day, hr, 12)), f(shiftTime(day, hr, z2 - z1 + 24)), f(shiftTime(day, hr, z2 - z1 - 24)), f(shiftTime(day, hr, z2 + z1))];
    return makeQ(r, "convert", [z1, z2, day, hr], `${zoneName(z1)}的时间是 ${monthDay(day)} ${hr}:00 时，${zoneName(z2)}的时间是？（${zoneName(z1)}与${zoneName(z2)}相差 ${Math.abs(z1 - z2)} 个时区）`, ans, wrong, "区时：东加西减，每个时区相差 1 小时；注意日期的变化。"); },
  zoneOf: (r) => { const lon = pick(r, [-1, 1]) * pick(r, [5, 20, 35, 50, 65, 80, 95, 110, 125, 140, 155, 170]); const z = zoneOfLon(lon);
    return makeQ(r, "zoneOf", [lon], `${lonStr(lon)}位于哪个时区？`, zoneName(z), [-12, ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap((k) => [k, -k])].map(zoneName), "每个时区跨经度 15°，时区号 = 经度 ÷ 15 取整（四舍五入）。"); },
  diff: (r) => { const a = intIn(r, 1, 9), b = intIn(r, 1, 10); return numQ(r, "diff", [a, b], `东${CN[a]}区与西${CN[b]}区的时差是多少小时？`, a + b, "小时", 0, "东、西两侧的时区相加。"); },
};
GEN.seasons = {
  noon: (r) => { const ev = pick(r, ["春分", "夏至", "秋分", "冬至"]), lat = pick(r, [-1, 1]) * intIn(r, 5, 60, 5), dec = SUN_DEC[ev]; const v = noonHeight(lat, dec);
    return numQ(r, "noon", [lat, dec], `${ev}日，${latStr(lat)}的正午太阳高度是多少度（太阳直射点纬度 ${dec === 0 ? "0°" : latStr(dec)}）？`, v, "°", 1, "正午太阳高度 = 90° − |当地纬度 − 直射点纬度|。"); },
  fromNoon: (r) => { const lat = intIn(r, 10, 70, 5); return numQ(r, "fromNoon", [90 - lat], `春分日，某地（北半球）的正午太阳高度是 ${90 - lat}°，该地的纬度是北纬多少度？`, lat, "°", 0, "春分日直射赤道，H = 90° − 纬度。"); },
  zone: (r) => { const ev = pick(r, ["夏至", "冬至", "春分", "秋分"]); const ans = ev === "夏至" ? "北回归线（23.5°N）" : ev === "冬至" ? "南回归线（23.5°S）" : "赤道（0°）";
    return makeQ(r, "zone", [["夏至", "冬至", "春分", "秋分"].indexOf(ev)], `${ev}日，太阳直射的纬线是？`, ans, ["北回归线（23.5°N）", "南回归线（23.5°S）", "赤道（0°）", "北极圈（66.5°N）", "南极圈（66.5°S）"], "直射点在南北回归线之间往返移动。"); },
};
GEN.scale = {
  real: (r) => { const den = pick(r, [10000, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000]), cm = intIn(r, 2, 12, 1) / 2; const km = realKm(cm, den);
    return numQ(r, "real", [cm, den], `在比例尺为 1∶${den} 的地图上，两地的图上距离是 ${cm} 厘米，它们的实地距离约是多少千米？`, km, "千米", km < 1 ? 2 : 1, "实地距离 = 图上距离 × 比例尺的分母。"); },
  map: (r) => { const den = pick(r, [100000, 500000, 1000000, 5000000]), cm = intIn(r, 2, 12, 1); const km = realKm(cm, den);
    return numQ(r, "map", [km, den], `两地的实地距离是 ${fmt(km, 1)} 千米，在比例尺为 1∶${den} 的地图上，图上距离是多少厘米？`, cm, "厘米", 0, "图上距离 = 实地距离 ÷ 比例尺的分母。"); },
  den: (r) => { const km = pick(r, [1, 2, 5, 10, 20, 50]); const den = km * 100000;
    return makeQ(r, "den", [km], `图上 1 厘米代表实地 ${km} 千米，这幅地图的比例尺是？`, `1∶${den}`, [`1∶${den * 10}`, `1∶${den / 10}`, `1∶${km * 1000}`, `1∶${km * 10000}`, `1∶${den * 2}`, `1∶${km}`], "1 千米 = 100000 厘米，1 厘米代表 k 千米，则分母 = k × 100000。"); },
};
GEN.contour = {
  rel: (r) => { const top = intIn(r, 800, 3000, 100), base = intIn(r, 100, 600, 100); return numQ(r, "rel", [top, base], `某山顶的海拔是 ${top} 米，山脚的海拔是 ${base} 米，两地的相对高度是多少米？`, top - base, "米", 0, "相对高度 = 较高点海拔 − 较低点海拔。"); },
  temp: (r) => tempQ(r, intIn(r, 14, 30), intIn(r, 5, 30) * 100),
  slope: (r) => { const den = pick(r, [10000, 25000, 50000]), cm = pick(r, [2, 4, 5]), dh = pick(r, [20, 40, 50, 100]); const dist = (cm * den) / 100; const v = (dh / dist) * 100;
    return numQ(r, "slope", [den, cm, dh], `在比例尺 1∶${den} 的地形图上，两点图上距离 ${cm} 厘米，高差 ${dh} 米，两点间的平均坡度（高差 ÷ 水平距离）约是多少％？`, v, "%", 1, `水平距离 = ${cm} × ${den} ÷ 100 = ${dist} 米，坡度 = ${dh} ÷ ${dist}。`); },
};
function tempQ(r: Rng, t0: number, dh: number): Q { const v = tempAt(t0, dh); const f = (x: number) => `${fmt(x, 1)} ℃`; return makeQ(r, "temp", [t0, dh], `山脚的气温是 ${t0}℃，海拔每升高 100 米，气温下降 0.6℃。山顶比山脚高 ${dh} 米，山顶的气温约是多少℃？`, f(v), [f(t0 + 0.6 * dh / 100), f(t0 - dh / 100), f(t0 - 0.6 * dh / 10), f(v + 3), f(v - 3), f(t0 - 6)], "气温递减率约 0.6℃∕100 米。"); }
GEN.terrain = {
  type: (r) => {
    const t = pick(r, TERRAINS); let alt: number, rel: number, feat: number;
    if (t === "平原") { alt = intIn(r, 0, 190, 10); rel = intIn(r, 0, 40, 10); feat = 0; }
    else if (t === "高原") { alt = intIn(r, 800, 4500, 100); rel = intIn(r, 100, 600, 50); feat = 0; }
    else if (t === "山地") { alt = intIn(r, 800, 5000, 100); rel = intIn(r, 400, 3000, 100); feat = 2; }
    else if (t === "丘陵") { alt = intIn(r, 100, 450, 10); rel = intIn(r, 50, 190, 10); feat = 1; }
    else { alt = intIn(r, 200, 1500, 100); rel = intIn(r, 300, 2000, 100); feat = 3; }
    return makeQ(r, "type", [alt, rel, feat], `某地海拔约 ${alt} 米，相对高度约 ${rel} 米，${FEATS[feat]}。这种地形属于哪一类？`, terrainType(alt, rel, feat), TERRAINS, "平原低而平，高原高而顶平，山地高而陡，丘陵低而缓，盆地四周高中间低。"); },
};
GEN.climate = {
  type: (r) => climateQ(r),
  range: (r) => { const a = intIn(r, 20, 35), b = intIn(r, -20, 15); return numQ(r, "range", [a, b], `某地最热月均温 ${a}℃，最冷月均温 ${fmt(b, 0)}℃，气温的年较差是多少℃？`, a - b, "℃", 0, "年较差 = 最热月均温 − 最冷月均温。"); },
};
GEN.weather = {
  beaufort: (r) => { const n = intIn(r, 1, 12); return makeQ(r, "beaufort", [n], `风力 ${n} 级的风速大约是多少？`, beaufortText(n), [-3, -2, -1, 1, 2, 3].map((k) => beaufortText(clamp(n + k, 0, 12))), "风力等级越高，风速越大。"); },
  rain: (r) => { const mm = pick(r, [3, 8, 12, 20, 30, 45, 60, 90, 120, 200, 260, 320]); return makeQ(r, "rain", [mm], `某地 24 小时降水量为 ${mm} 毫米，这属于什么等级的降水？`, rainClass(mm), RAIN.map((x) => x[0]), "小雨 <10，中雨 10～24.9，大雨 25～49.9，暴雨 50～99.9，大暴雨 100～249.9，特大暴雨 ≥250（毫米∕24 小时）。"); },
  wind: (r) => { const i = intIn(r, 0, 7); return makeQ(r, "wind", [i], `风向标的箭头指向${["北", "东北", "东", "东南", "南", "西南", "西", "西北"][i]}方，这是什么风？`, WINDS[i], WINDS, "风向标箭头指向风吹来的方向，风向以来向命名。"); },
  range: (r) => { const hi = intIn(r, 15, 35), lo = intIn(r, 0, 14); return numQ(r, "drange", [hi, lo], `某天最高气温 ${hi}℃，最低气温 ${lo}℃，气温日较差是多少℃？`, hi - lo, "℃", 0, "日较差 = 最高气温 − 最低气温。"); },
};
GEN.population = {
  rate: (r) => { const b = intIn(r, 12, 40), d = intIn(r, 4, 11); return numQ(r, "rate", [b, d], `某国出生率 ${b}‰，死亡率 ${d}‰，人口自然增长率是多少？`, growthRate(b, d), "%", 1, "自然增长率 = 出生率 − 死亡率，‰ 换成 % 要除以 10。"); },
  after: (r) => { const p0 = intIn(r, 10, 100, 10), rt = pick(r, [1, 2, 3]), y = pick(r, [10, 20, 30]); return numQ(r, "after", [p0, rt, y], `某地人口 ${p0} 万人，年增长率 ${rt}%，按此速度，${y} 年后人口约是多少万人（保留一位小数）？`, popAfter(p0, rt, y), "万人", 1, "按复利计算：P × (1 + r)ⁿ。"); },
  density: (r) => { const a = pick(r, [10, 20, 40, 50, 80]), p = pick(r, [200, 500, 1000, 2000, 4000]); return numQ(r, "density", [a, p], `某地面积 ${a} 万平方千米，人口 ${p} 万人，人口密度约是多少人∕平方千米？`, p / a, "人∕平方千米", 1, "人口密度 = 人口 ÷ 面积。"); },
  pyramid: (r) => { const kind = pick(r, ["增长型", "稳定型", "衰退型"]); const [b, d] = kind === "增长型" ? [intIn(r, 28, 40), intIn(r, 5, 12)] : kind === "稳定型" ? (() => { const b = intIn(r, 9, 14); return [b, b + intIn(r, -3, 3)]; })() : (() => { const b = intIn(r, 6, 8); return [b, intIn(r, b + 6, 14)]; })();
    const rt = growthRate(b, d); const ans = pyramidOf(rt); return makeQ(r, "pyramid", [b, d], `某国出生率 ${b}‰，死亡率 ${d}‰，其人口结构最可能属于哪一类型？`, ans, ["增长型", "稳定型", "衰退型", "无法判断"], "自然增长率 ≥ 1% 为增长型；接近 0 为稳定型；为较明显的负增长为衰退型。"); },
};
GEN.plates = {
  move: (r) => { const v = pick(r, [2, 3, 5, 8]), t = pick(r, [5, 10, 20, 50]); return numQ(r, "move", [v, t], `一块板块每年移动 ${v} 厘米，${t} 百万年约移动多少千米？`, kmMoved(v, t), "千米", 0, "1 厘米∕年 = 10 千米∕百万年。"); },
  gap: (r) => { const d = pick(r, [60, 120, 240, 420, 600]); return numQ(r, "gap", [d], `纵波速度 6 千米∕秒，横波速度 3.5 千米∕秒。震中距 ${d} 千米的地方，横波比纵波晚到约多少秒？`, waveGap(d), "秒", 0, "晚到时间 = d ÷ 3.5 − d ÷ 6。"); },
  dist: (r) => { const dt = pick(r, [5, 10, 15, 25, 40]); return numQ(r, "dist", [dt], `纵波速度 6 千米∕秒，横波速度 3.5 千米∕秒。某地测得横波比纵波晚到 ${dt} 秒，震中距约是多少千米？`, distFromGap(dt), "千米", 0, "d = Δt × 6 × 3.5 ÷ (6 − 3.5) = 8.4 Δt。"); },
  energy: (r) => { const dm = pick(r, [1, 2]); const v = Math.round(energyRatio(dm)); return makeQ(r, "energy", [dm], `地震的震级每增加 1 级，释放的能量约增加 32 倍。震级相差 ${dm} 级，释放的能量约相差多少倍？`, `${v} 倍`, ["2 倍", "10 倍", "32 倍", "100 倍", "1000 倍", "3200 倍"].filter((x) => x !== `${v} 倍`), `32^${dm} ≈ ${v}。`); },
};
GEN.watercycle = {
  balance: (r) => { const p = intIn(r, 6, 20, 1) * 100, e = intIn(r, 2, 5, 1) * 100; return numQ(r, "balance", [p, e], `某封闭流域一年的降水量 ${p} 毫米，蒸发量 ${e} 毫米，若地下水储量不变，径流量约是多少毫米？`, runoff(p, e), "毫米", 0, "水量平衡：降水 = 蒸发 + 径流。"); },
};
GEN.rocks = {
  layer: (r) => { const depth = pick(r, [intIn(r, 2, 6), intIn(r, 8, 30), intIn(r, 100, 2500, 100), intIn(r, 3000, 5000, 100), intIn(r, 5200, 6300, 100)]);
    // the crust is about 33 km thick under the continents but only 6-7 km under the oceans: a depth between 7 and 32 km is only asked for a place on land
    const land = depth > 6 && depth < 33;
    return makeQ(r, "layer", [depth], land ? `在大陆上某地，地下 ${depth} 千米深处属于地球内部的哪一层？` : `地下 ${depth} 千米深处属于地球内部的哪一层？`, layerOf(depth), ["地壳", "地幔", "外核", "内核"], "地壳全球平均厚度约 17 千米（大陆约 33 千米，海洋约 6～7 千米）；地幔至约 2900 千米，外核至约 5100 千米，以下是内核。"); },
  heat: (r) => { const z = intIn(r, 1, 5); return numQ(r, "heat", [z], `地表温度约 15℃，地温梯度约每深 100 米升高 3℃。地下 ${z} 千米深处的温度约是多少℃？`, groundTemp(z), "℃", 0, "15 + 30 × 深度（千米）。"); },
};
GEN.sustain = {
  percap: (r) => { const t = pick(r, [2000, 2800, 6000, 9000]), p = pick(r, [4, 8, 14]); return numQ(r, "percap", [t, p], `某资源总量 ${t} 亿吨，人口 ${p} 亿，人均占有量约是多少吨？`, t / p, "吨", 1, "人均占有量 = 总量 ÷ 人口。"); },
  forest: (r) => { const a = pick(r, [100, 200, 500, 960]), f = pick(r, [10, 20, 30, 50]); return numQ(r, "forest", [a, f], `某地面积 ${a} 万公顷，森林面积 ${f} 万公顷，森林覆盖率是多少％？`, (f / a) * 100, "%", 1, "森林覆盖率 = 森林面积 ÷ 土地面积。"); },
  co2: (r) => { const coal = intIn(r, 10, 60, 10), oil = intIn(r, 10, 30, 10), gas = intIn(r, 10, 20, 10), clean = 100 - coal - oil - gas; if (clean < 0) return GEN.sustain.co2(r);
    return numQ(r, "co2", [coal, oil, gas, clean], `某地能源结构：煤 ${coal}%，石油 ${oil}%，天然气 ${gas}%，清洁能源 ${clean}%。按排放系数煤 0.95、石油 0.75、天然气 0.55、清洁能源 0.02 计算，二氧化碳排放指数是多少（保留一位小数）？`, co2Index(coal, oil, gas, clean), "", 1, "指数 = 各能源份额 × 排放系数 之和。"); },
};
GEN.chinabasic = {
  solar: (r) => { const lon = pick(r, [75, 82.5, 90, 97.5, 105, 112.5, 127.5, 135]), h = pick(r, [8, 12, 15, 20]); const ans = solarClock(h, lon);
    return makeQ(r, "solar", [lon, h], `北京时间（120°E 的地方时）是 ${h}:00 时，东经 ${lon}° 的地方时是？`, ans, [solarClock(h, 120 + (120 - lon)), solarClock(h, lon + 15), solarClock(h, lon - 15), solarClock(h, 120), solarClock(h + 12, lon), solarClock(h, lon + 7.5)], "经度每相差 15°，地方时相差 1 小时，每相差 1° 相差 4 分钟；西边的时间晚。"); },
  span: (r) => { const a = pick(r, [75, 80, 90]), b = pick(r, [120, 135]); return numQ(r, "span", [a, b], `我国最西端约 ${a}°E，某地约 ${b}°E，两地地方时相差约多少小时？`, (b - a) / 15, "小时", 1, "时差 = 经度差 ÷ 15。"); },
};
GEN.chinaterrain = {
  step: (r) => { const lon = intIn(r, 75, 120, 5); const ans = `第${["一", "二", "三"][stepOf(lon) - 1]}级阶梯`; return makeQ(r, "step", [lon], `按图中沿北纬 35° 附近的示意剖面，东经 ${lon}° 附近大致处在我国地势的哪一级阶梯？`, ans, ["第一级阶梯", "第二级阶梯", "第三级阶梯", "第四级阶梯"], "沿北纬 35° 附近，第一、二级以约 102°E 为界，第二、三级以约 111°E 为界（示意）。"); },
  place: (r) => { const i = Math.floor(r() * STEP_PLACES.length); const [name, n] = STEP_PLACES[i]; const ans = `第${["一", "二", "三"][n - 1]}级阶梯`; return makeQ(r, "place", [i], `${name}属于我国地势的哪一级阶梯？`, ans, ["第一级阶梯", "第二级阶梯", "第三级阶梯", "第四级阶梯"], "第一级：青藏高原；第二级：内蒙古高原、黄土高原、云贵高原、塔里木盆地、准噶尔盆地、四川盆地；第三级：东北平原、华北平原、长江中下游平原、东南丘陵。"); },
};
GEN.development = {
  max: (r) => { const D = DEV_CACHE; const four = shuffle(r, D).slice(0, 4); const best = four.reduce((a, b) => (b.gdp > a.gdp ? b : a)); const names = four.map((c) => c.n); if (new Set(four.map((c) => c.gdp)).size < 4) return GEN.development.max(r);
    const q = makeQ(r, "max", four.map((c) => D.indexOf(c)), `下列国家中，人均国内生产总值最高的是？（数据为约数）`, best.n, names, `${best.n}约 ${best.gdp} 美元。`); return q; },
};
let DEV_CACHE: Country[] = [];
export function setDevData(c: Country[]): void { DEV_CACHE = c; }
/** which generators each module has (the practice page and the quizzes use them) */
export const genKinds = (id: string): string[] => Object.keys(GEN[id] ?? {});
export const genQ = (id: string, kind: string, r: Rng): Q => GEN[id][kind](r);

// ---------- facts and banks ----------
/** the fields that can make a question: at least four different values (three wrong choices that are not the right one) */
export const usableFields = (mod: FactMod): string[] => Object.keys(mod.fields).filter((f) => new Set(mod.entries.filter((e) => e.f[f] !== undefined).map((e) => e.f[f])).size >= 4);
export function factQ(r: Rng, modId: string, mod: FactMod, field?: string, entryName?: string): Q {
  const fields = usableFields(mod);
  for (let k = 0; k < 300; k++) {
    const fld = field ?? pick(r, fields);
    const pool0 = mod.entries.filter((e) => e.f[fld] !== undefined);
    if (!pool0.length) continue;
    const entry = entryName ? pool0.find((e) => e.n === entryName) : pick(r, pool0);
    if (!entry) continue;
    const grp = pool0.filter((e) => e.g === entry.g);
    const distinct = (l: Fact[]) => new Set(l.map((e) => e.f[fld])).size;
    const pool = distinct(grp) >= 4 ? grp : pool0;
    const a = entry.f[fld], def = mod.fields[fld];
    const idx = mod.entries.indexOf(entry);
    const uniq = pool0.filter((e) => e.f[fld] === a).length === 1;
    const rev = !!def.rev && uniq && r() < 0.5;
    try {
      if (rev) {
        const wrong = pool.filter((e) => e !== entry && e.f[fld] !== a).map((e) => e.n);
        return makeQ(r, `fact:${modId}:${fld}`, [idx, 1], def.rev!.replace("{v}", a), entry.n, wrong, `${entry.n}：${a}。${entry.e ?? ""}`.trim());
      }
      const wrong = pool.filter((e) => e !== entry).map((e) => e.f[fld]).filter((v) => v !== a);
      return makeQ(r, `fact:${modId}:${fld}`, [idx, 0], def.q.replace("{n}", entry.n), a, wrong, `${entry.n}：${a}。${entry.e ?? ""}`.trim());
    } catch { /* too few different wrong choices: another field / entry */ }
  }
  throw new Error(`factQ ${modId}`);
}
export const bankQ = (r: Rng, id: string, b: BankQ, i: number): Q => makeQ(r, `bank:${id}`, [i], b.q, b.a, b.w, b.e);

/** the five questions of a module's quiz: up to three from the generators, the rest from the bank / the facts, no question text twice */
export function quizOf(D: GeoData, id: string, r: Rng): Q[] {
  const kinds = genKinds(id), banks = D.banks[id] ?? [], mod = D.facts[id];
  const out: Q[] = [];
  const have = (q: Q) => out.some((x) => x.q === q.q);
  const gens = shuffle(r, kinds);
  const nGen = mod ? Math.min(gens.length, 1) : Math.min(gens.length, 3);
  for (const k of gens.slice(0, nGen)) { for (let t = 0; t < 30; t++) { const q = genQ(id, k, r); if (!have(q)) { out.push(q); break; } } }
  let guard = 0;
  while (out.length < 5 && guard++ < 400) {
    let q: Q;
    const useFact = mod && (!banks.length || r() < 0.7);
    if (useFact) q = factQ(r, id, mod);
    else if (banks.length) { const i = Math.floor(r() * banks.length); q = bankQ(r, id, banks[i], i); }
    else if (gens.length) q = genQ(id, pick(r, gens), r);
    else throw new Error(`no questions for ${id}`);
    if (!have(q)) out.push(q);
  }
  return shuffle(r, out);
}

// ---------- practice: every question item has a key, the memory boxes choose what is asked ----------
export interface Item { key: string; mod: string; kind: "bank" | "fact" | "gen"; ref: string; extra?: string }
export function itemsOf(D: GeoData, mods?: string[]): Item[] {
  const list: Item[] = [];
  for (const id of Object.keys(D.lessons)) {
    if (mods && !mods.includes(id)) continue;
    (D.banks[id] ?? []).forEach((_, i) => list.push({ key: `${id}:bank:${i}`, mod: id, kind: "bank", ref: String(i) }));
    const m = D.facts[id];
    if (m) for (const e of m.entries) for (const f of usableFields(m)) if (e.f[f] !== undefined) list.push({ key: `${id}:fact:${f}:${e.n}`, mod: id, kind: "fact", ref: f, extra: e.n });
    for (const k of genKinds(id)) list.push({ key: `${id}:gen:${k}`, mod: id, kind: "gen", ref: k });
  }
  return list;
}
export function questionOf(D: GeoData, it: Item, r: Rng): Q {
  if (it.kind === "bank") { const i = Number(it.ref); return bankQ(r, it.mod, D.banks[it.mod][i], i); }
  if (it.kind === "fact") return factQ(r, it.mod, D.facts[it.mod], it.ref, it.extra);
  return genQ(it.mod, it.ref, r);
}
export interface Progress { cards: Record<string, G.Card>; plays: number; last?: { date: string; score: number; total: number } }
export const STORE_KEY = "learn.geolab.practice.v1";
/** the practice progress has its own device key: the kit of the lab rewrites `learn.geolab.v1` (tasks, best quiz scores) as a whole */
export function loadProgress(): Progress {
  try { const o = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}"); return { cards: o.cards ?? {}, plays: o.plays ?? 0, last: o.last }; } catch { return { cards: {}, plays: 0 }; }
}
export function saveProgress(p: Progress): void {
  try { const o = JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}"); localStorage.setItem(STORE_KEY, JSON.stringify({ ...o, cards: p.cards, plays: p.plays, last: p.last })); } catch { /* no storage */ }
}
export function applyAnswers(p: Progress, answers: { key: string; right: boolean }[], today: string, summary?: { score: number; total: number }): Progress {
  const cards = { ...p.cards };
  for (const a of answers) cards[a.key] = G.applyOutcome(cards[a.key], a.right, false, today);
  return { cards, plays: p.plays + (summary ? 1 : 0), last: summary ? { date: today, ...summary } : p.last };
}
/** due first (lowest box first), then never asked, then the known ones; a round of `n` */
export function selectItems(items: Item[], p: Progress, today: string, n: number, r: Rng): Item[] {
  const card = (i: Item) => p.cards[i.key];
  const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const due = items.filter((i) => card(i) && card(i).due <= today).sort((a, b) => card(a).box - card(b).box || cmp(card(a).due, card(b).due) || r() - 0.5);
  const fresh = shuffle(r, items.filter((i) => !card(i)));
  const known = items.filter((i) => card(i) && card(i).due > today).sort((a, b) => card(a).box - card(b).box || r() - 0.5);
  return shuffle(r, [...due, ...fresh, ...known].slice(0, n));
}

// ---------- the water cycle (relative units, steady state) ----------
export function cycle(sun: number, forest: number): { oceanEvap: number; landEvap: number; transp: number; vapor: number; precipLand: number; runoff: number; infil: number; surface: number; under: number } {
  const oceanEvap = sun, landEvap = 0.15 * sun, transp = (0.25 * sun * forest) / 100, vapor = 0.3 * oceanEvap;
  const runoff = vapor, infil = runoff * (0.2 + (0.5 * forest) / 100);
  return { oceanEvap, landEvap, transp, vapor, precipLand: vapor + landEvap + transp, runoff, infil, surface: runoff - infil, under: infil };
}
