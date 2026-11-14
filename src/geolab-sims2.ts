/** The geography lab's modules, part 2: climate, population, development, the earth's layers and rocks, energy, China (extent, steps, regions) and the generic fact explorers
 *  (continents, regions of the world, China's nature and economy). Each is a `SimDef` of the physics lab's kit; the content is `data/geolab.json`. */
import { h } from "./ui";
import { tr } from "./i18n";
import { type SimDef, type St, type Readout, fmt } from "./phys/kit";
import { type GeoId } from "./geolab-catalog";
import * as M from "./geolab-model";
import { base } from "./geolab-sims1";
import { COL, arrow, circle, frame, line, poly, rect, txt, drawWorld, pin, box } from "./geolab-draw";

/** a sim whose page also shows a card of `user` content that follows the state (the card element `#gl-card` is made by the page after the sim is mounted) */
export function withCard(def: SimDef, key: (s: St) => string, fill: (el: HTMLElement, s: St) => void): SimDef {
  const orig = def.draw; let last = "";
  return { ...def, draw(c, w, hh, s) { orig(c, w, hh, s); const el = document.getElementById("gl-card"); if (!el) return; const k = key(s); if (k !== last || !el.childElementCount) { last = k; fill(el, s); } } };
}
const U = (t: string, tag: "span" | "b" = "span") => h(tag, {}, tr(t));   // (rule 66: card texts are translated)

// ---------- climate ----------
export function climate(D: M.GeoData): SimDef {
  const S = D.stations;
  return withCard({
    ...base(D, "climate"), aspect: 0.6, params: [],
    choices: [{ id: "st", label: "观测站", options: S.map((x, i) => [i, x.n] as [number, string]), value: 0 }, { id: "ans", label: "气候类型", options: [[0, "隐藏"], [1, "显示"]], value: 0 }],
    readouts: (s): Readout[] => { const x = S[s.st], q = M.chartStats(x); return [{ label: "最冷月均温", value: fmt(q.tmin, 1), unit: "℃" }, { label: "最热月均温", value: fmt(q.tmax, 1), unit: "℃" }, { label: "气温年较差", value: fmt(q.tmax - q.tmin, 1), unit: "℃" },
      { label: "年降水量", value: fmt(q.ptot, 0), unit: "mm" }, { label: "暖半年降水占", value: String(q.share), unit: "%" }, { label: "所在半球", value: x.lat >= 0 ? "北半球" : "南半球" }, ...(s.ans ? [{ label: "气候类型", value: M.climateOf(q) }] : [])]; },
    draw(c, w, hh, s: St) {
      const x = S[s.st], q = M.chartStats(x);
      rect(c, 0, 0, w, hh, "#fff", null, 0, 0);
      const px = 70, py = 40, pw = 500, ph = 280;
      const tlo = Math.min(0, Math.floor(q.tmin / 10) * 10), thi = Math.max(30, Math.ceil(q.tmax / 10) * 10), pmax = Math.max(100, Math.ceil(Math.max(...x.p) / 100) * 100);
      const TY = (t: number) => py + ph - ((t - tlo) / (thi - tlo)) * ph, PY = (p: number) => py + ph - (p / pmax) * ph;
      rect(c, px, py, pw, ph, "#f8f9fa", COL.ink, 3, 0);
      for (let t = tlo; t <= thi; t += 10) { line(c, px, TY(t), px + pw, TY(t), t === 0 ? COL.grey : "#e9ecef", t === 0 ? 2 : 1); txt(c, String(t), px - 14, TY(t), 13, COL.red); }
      for (let p = 0; p <= pmax; p += pmax / 5) txt(c, String(Math.round(p)), px + pw + 22, PY(p), 13, COL.blue);
      const bw = pw / 12;
      x.p.forEach((p, i) => { c.fillStyle = "#74c0fc"; c.fillRect(px + i * bw + 8, PY(p), bw - 16, py + ph - PY(p)); txt(c, String(i + 1), px + i * bw + bw / 2, py + ph + 16, 14, COL.ink); });
      c.beginPath(); x.t.forEach((t, i) => (i ? c.lineTo(px + i * bw + bw / 2, TY(t)) : c.moveTo(px + i * bw + bw / 2, TY(t)))); c.strokeStyle = COL.red; c.lineWidth = 4; c.stroke();
      x.t.forEach((t, i) => circle(c, px + i * bw + bw / 2, TY(t), 4, COL.red, "#fff", 2));
      txt(c, "C", px - 14, py - 14, 14, COL.red); txt(c, "mm", px + pw + 22, py - 14, 14, COL.blue);
    },
    tasks: [
      { id: "beijing", text: "选择北京并显示气候类型，看雨热同期", check: (s) => S[s.st].n === "北京" && s.ans === 1 },
      { id: "south", text: "选择一个南半球的观测站，注意最热月在 12 月至 2 月", check: (s) => S[s.st].lat < 0 },
      { id: "winter", text: "找到降水集中在冬半年的观测站（暖半年降水不足 40%）", check: (s) => M.chartStats(S[s.st]).share < 40 }],
  }, (s) => String(s.st), (el, s) => { const x = S[s.st]; el.replaceChildren(h("h3", {}, "观测站资料"), h("p", { class: "gl-line" }, U(x.n, "b"), h("span", {}, " "), h("span", { class: "muted small" }, `${M.latStr(x.lat)}, ${x.alt} m`)), h("p", { class: "muted small" }, "资料为约数，仅供练习。")); });
}

// ---------- population ----------
export function population(D: M.GeoData): SimDef {
  const P0 = 100;
  return {
    ...base(D, "population"), aspect: 0.55,
    params: [{ id: "b", label: "出生率", min: 5, max: 45, step: 1, value: 20, unit: "‰" }, { id: "d", label: "死亡率", min: 3, max: 20, step: 1, value: 8, unit: "‰" }, { id: "y", label: "经过的年数", min: 0, max: 100, step: 5, value: 0, unit: "年" }],
    play: { param: "y", rate: 10, loop: true },
    readouts: (s) => { const r = M.growthRate(s.b, s.d); return [{ label: "自然增长率", value: fmt(r, 1), unit: "%" }, { label: "人口类型", value: M.pyramidOf(r) }, { label: "人口倍增时间", value: r > 0 ? fmt(M.doubling(r), 0) : "—", unit: r > 0 ? "年" : "" }, { label: "起始人口 100 百万人，现在", value: fmt(M.popAfter(P0, r, s.y), 1), unit: "百万人" }]; },
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#fff", null, 0, 0);
      const r = M.growthRate(s.b, s.d), px = 50, py = 30, pw = 330, ph = 250, ymax = 800;
      line(c, px, py + ph, px + pw, py + ph, COL.ink, 3); line(c, px, py, px, py + ph, COL.ink, 3);
      c.beginPath(); for (let i = 0; i <= 100; i += 2) { const v = Math.min(ymax, M.popAfter(P0, r, i)); const X = px + (i / 100) * pw, Y = py + ph - (v / ymax) * ph; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.strokeStyle = COL.purple; c.lineWidth = 4; c.stroke();
      const v = Math.min(ymax, M.popAfter(P0, r, s.y)); circle(c, px + (s.y / 100) * pw, py + ph - (v / ymax) * ph, 8, COL.red, "#fff", 3);
      txt(c, "100", px - 18, py + ph - (100 / ymax) * ph, 13, COL.grey); txt(c, "0", px, py + ph + 16, 13, COL.grey); txt(c, "100", px + pw, py + ph + 16, 13, COL.grey);
      // three population pyramids; the one that fits is lit
      const kinds = ["增长型", "稳定型", "衰退型"], cur = M.pyramidOf(r);
      kinds.forEach((k, i) => {
        const cx = 500, cy = 70 + i * 100, on = k === cur;
        const wd = (j: number) => (i === 0 ? 50 - j * 9 : i === 1 ? 32 - Math.abs(j - 2) * 2 : 14 + j * 7);
        for (let j = 0; j < 5; j++) { const half = wd(j); rect(c, cx - half, cy + 40 - j * 16, half * 2, 14, on ? "#ffa94d" : "#dee2e6", on ? COL.ink : "#adb5bd", 2, 3); }
      });
    },
    tasks: [
      { id: "fast", text: "使人口自然增长率超过 2.5%", check: (s) => M.growthRate(s.b, s.d) > 2.5 },
      { id: "decline", text: "使人口呈负增长（衰退型）", check: (s) => M.pyramidOf(M.growthRate(s.b, s.d)) === "衰退型" },
      { id: "double", text: "使 50 年后的人口超过起始人口的 2 倍", check: (s) => s.y >= 50 && M.popAfter(P0, M.growthRate(s.b, s.d), s.y) > 200 }],
  };
}

// ---------- development ----------
export function development(D: M.GeoData): SimDef {
  const C = D.development.countries;
  const above = (s: St) => C.filter((c) => c.gdp > s.thr * 1000);
  const avg = (l: M.Country[]) => (l.length ? l.reduce((a, b) => a + b.birth, 0) / l.length : NaN);
  const px = 60, pw = 540, py = 24, ph = 300, lo = Math.log(800), hi = Math.log(90000);
  const X = (g: number) => px + ((Math.log(g) - lo) / (hi - lo)) * pw, Y = (b: number) => py + ph - (b / 40) * ph;
  return {
    ...base(D, "development"), aspect: 0.62,
    params: [{ id: "thr", label: "人均国内生产总值分界线", min: 0.5, max: 80, step: 0.5, value: 3, unit: "千美元" }],
    pointer: (kind, x) => ({ thr: Math.max(0.5, Math.min(80, Math.round((Math.exp(lo + ((x - px) / pw) * (hi - lo)) / 1000) * 2) / 2)) }),
    readouts: (s) => { const a = above(s), b = C.filter((c) => !a.includes(c)); return [{ label: "分界线以上的国家", value: String(a.length) }, { label: "其中发达国家", value: String(a.filter((c) => c.dev === 1).length) }, { label: "以上的平均出生率", value: isNaN(avg(a)) ? "—" : fmt(avg(a), 1), unit: "‰" }, { label: "以下的平均出生率", value: isNaN(avg(b)) ? "—" : fmt(avg(b), 1), unit: "‰" }]; },
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#fff", null, 0, 0);
      rect(c, px, py, pw, ph, "#f8f9fa", COL.ink, 3, 0);
      for (const g of [1000, 3000, 10000, 30000]) { line(c, X(g), py, X(g), py + ph, "#e9ecef", 1); txt(c, String(g / 1000), X(g), py + ph + 16, 13, COL.grey); }
      for (let b = 0; b <= 40; b += 10) { line(c, px, Y(b), px + pw, Y(b), "#e9ecef", 1); txt(c, String(b), px - 16, Y(b), 13, COL.grey); }
      line(c, X(s.thr * 1000), py, X(s.thr * 1000), py + ph, COL.red, 4, [8, 5]);
      for (const k of C) { const x = X(k.gdp), y = Y(k.birth); circle(c, x, y, 7, k.dev ? COL.blue : COL.orange, COL.ink, 2); txt(c, k.iso, x, y - 15, 12, COL.ink); }
      txt(c, "1000 USD", px + pw - 40, py + ph + 36, 14, COL.grey);
    },
    tasks: [
      { id: "split", text: "把分界线调到恰好把发达国家与发展中国家分开", check: (s) => above(s).length > 0 && above(s).every((c) => c.dev === 1) && C.filter((c) => c.dev === 1).every((c) => above(s).includes(c)) },
      { id: "all", text: "把分界线调到最左，使所有国家都在分界线以上", check: (s) => above(s).length === C.length },
      { id: "birth", text: "使分界线以上国家的平均出生率低于 10‰", check: (s) => above(s).length > 0 && avg(above(s)) < 10 }],
  };
}

// ---------- the earth's layers and the rock cycle ----------
const PROC: [string, string, string][] = [["冷却凝固", "岩浆岩（如花岗岩）", "内力"], ["风化、侵蚀、搬运与沉积", "沉积岩（如石灰岩）", "外力"], ["变质作用", "变质岩（如大理岩）", "内力"], ["重熔再生", "岩浆", "内力"]];
export function rocks(D: M.GeoData): SimDef {
  const is0 = (s: St) => s.mode === 0, is1 = (s: St) => s.mode === 1;
  return {
    ...base(D, "rocks"), aspect: 0.6,
    choices: [{ id: "mode", label: "内容", options: [[0, "地球的圈层"], [1, "岩石循环"]], value: 0 }, { id: "proc", label: "过程", options: PROC.map(([n], i) => [i, n] as [number, string]), value: 0, when: is1 }],
    params: [{ id: "depth", label: "深度", min: 0, max: 6370, step: 10, value: 1000, unit: "km", when: is0 }],
    readouts: (s) => s.mode === 0 ? [{ label: "圈层", value: M.layerOf(s.depth) }, ...(s.depth > 6 && s.depth < 33 ? [{ label: "说明", value: "大陆地壳（海洋地壳只有约 6～7 千米厚）" }] : []), { label: "物质状态", value: M.LAYERS.find((l) => l[0] === M.layerOf(s.depth))![3] }, { label: "距地心", value: fmt(6371 - s.depth, 0), unit: "km" }]
      : [{ label: "过程", value: PROC[s.proc][0] }, { label: "形成", value: PROC[s.proc][1] }, { label: "动力", value: PROC[s.proc][2] }],
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#fff", null, 0, 0);
      if (s.mode === 0) {
        const cx = 190, cy = 215, R = 170, rr = (km: number) => (km / 6371) * R;
        circle(c, cx, cy, R, "#8ce99a", COL.ink, 4); circle(c, cx, cy, R - 9, "#ffa94d", null, 0); circle(c, cx, cy, rr(3480), "#fa5252", COL.ink, 3); circle(c, cx, cy, rr(1221), "#ffe066", COL.ink, 3);
        const r = rr(6371 - s.depth); line(c, cx, cy, cx + r * Math.cos(-0.7), cy + r * Math.sin(-0.7), COL.ink, 3); circle(c, cx + r * Math.cos(-0.7), cy + r * Math.sin(-0.7), 8, COL.purple, "#fff", 3);
        const bx = 420, by = 30, bh = 360, Y = (d: number) => by + (d / 6371) * bh;
        const cols = ["#8ce99a", "#ffa94d", "#fa5252", "#ffe066"];
        M.LAYERS.forEach(([, a, b], i) => { c.fillStyle = cols[i]; c.fillRect(bx, Y(a), 60, Math.max(4, Y(b) - Y(a))); });
        rect(c, bx, by, 60, bh, "", COL.ink, 3, 0); line(c, bx - 14, Y(s.depth), bx + 74, Y(s.depth), COL.purple, 4); txt(c, String(s.depth), bx + 120, Y(s.depth), 15, COL.purple);
        for (const d of [33, 2900, 5100]) txt(c, String(d), bx - 30, Y(d), 12, COL.grey);
        return;
      }
      const rocksAt: [number, number, string, string][] = [[320, 70, "#ff8787", "MAGMA"], [120, 300, "#ffa94d", "IGNEOUS"], [520, 300, "#d9a066", "SEDIMENTS"], [320, 200, "#b197fc", "METAMORPHIC"]];
      arrow(c, 280, 100, 160, 250, s.proc === 0 ? COL.red : COL.grey, s.proc === 0 ? 8 : 4);
      arrow(c, 180, 300, 450, 300, s.proc === 1 ? COL.red : COL.grey, s.proc === 1 ? 8 : 4);
      arrow(c, 450, 270, 360, 225, s.proc === 2 ? COL.red : COL.grey, s.proc === 2 ? 8 : 4);
      arrow(c, 320, 170, 320, 105, s.proc === 3 ? COL.red : COL.grey, s.proc === 3 ? 8 : 4);
      for (const [x, y, f, t] of rocksAt) { rect(c, x - 70, y - 22, 140, 44, f, COL.ink, 3, 14); txt(c, t, x, y, 14, COL.ink); }
      txt(c, ["1", "2", "3", "4"][s.proc], 320, 360, 26, COL.red);
    },
    tasks: [
      { id: "outer", text: "找到液态的外核", check: (s) => s.mode === 0 && M.layerOf(s.depth) === "外核" },
      { id: "inner", text: "找到地球中心的固态内核", check: (s) => s.mode === 0 && M.layerOf(s.depth) === "内核" },
      { id: "meta", text: "在岩石循环中选择“变质作用”", check: (s) => s.mode === 1 && s.proc === 2 }],
  };
}

// ---------- energy mix ----------
export function sustain(D: M.GeoData): SimDef {
  const clean = (s: St) => Math.max(0, 100 - s.coal - s.oil - s.gas);
  return {
    ...base(D, "sustain"), aspect: 0.5,
    params: [{ id: "coal", label: "煤", min: 0, max: 100, step: 5, value: 55, unit: "%" }, { id: "oil", label: "石油", min: 0, max: 100, step: 5, value: 20, unit: "%" }, { id: "gas", label: "天然气", min: 0, max: 100, step: 5, value: 10, unit: "%" }],
    derive: (s, ch) => { const rest = 100 - s.coal - s.oil - s.gas; if (rest < 0) s[ch] += rest; },
    readouts: (s) => { const idx = M.co2Index(s.coal, s.oil, s.gas, clean(s)); return [{ label: "清洁能源", value: fmt(clean(s), 0), unit: "%" }, { label: "二氧化碳排放指数", value: fmt(idx, 1) }, { label: "与基准（73）相比", value: fmt(((idx - 73.05) / 73.05) * 100, 0), unit: "%" }]; },
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#fff", null, 0, 0);
      const parts: [number, string][] = [[s.coal, "#495057"], [s.oil, "#e8590c"], [s.gas, "#fcc419"], [clean(s), "#51cf66"]];
      let x = 40; for (const [v, col] of parts) { const wd = (v / 100) * 560; c.fillStyle = col; c.fillRect(x, 40, wd, 60); if (v >= 8) txt(c, String(v), x + wd / 2, 70, 18, "#fff"); x += wd; }
      rect(c, 40, 40, 560, 60, "", COL.ink, 3, 0);
      const idx = M.co2Index(s.coal, s.oil, s.gas, clean(s)), cx = 320, cy = 290, R = 130;
      c.beginPath(); c.arc(cx, cy, R, Math.PI, 2 * Math.PI); c.lineWidth = 26; const g = c.createLinearGradient(cx - R, 0, cx + R, 0); g.addColorStop(0, "#51cf66"); g.addColorStop(0.5, "#fcc419"); g.addColorStop(1, "#e03131"); c.strokeStyle = g; c.stroke();
      const a = Math.PI + (idx / 95) * Math.PI; line(c, cx, cy, cx + (R - 10) * Math.cos(a), cy + (R - 10) * Math.sin(a), COL.ink, 6); circle(c, cx, cy, 10, COL.ink, null, 0);
      txt(c, "0", cx - R, cy + 22, 14, COL.grey); txt(c, "95", cx + R, cy + 22, 14, COL.grey); txt(c, fmt(idx, 1), cx, cy + 46, 22, COL.ink);
    },
    tasks: [
      { id: "low", text: "使二氧化碳排放指数降到 40 以下", check: (s) => M.co2Index(s.coal, s.oil, s.gas, clean(s)) < 40 },
      { id: "clean", text: "使清洁能源的份额达到 50% 以上", check: (s) => clean(s) >= 50 },
      { id: "coal", text: "使煤的份额降到 10% 以下", check: (s) => s.coal <= 10 }],
  };
}

// ---------- China: extent and local time ----------
const CITY: [string, number, number][] = [["北京", 39.9, 116.4], ["上海", 31.2, 121.5], ["广州", 23.1, 113.3], ["乌鲁木齐", 43.8, 87.6], ["拉萨", 29.7, 91.1], ["哈尔滨", 45.8, 126.6], ["三亚", 18.3, 109.5], ["漠河", 53.5, 122.4]];
export function chinabasic(D: M.GeoData): SimDef {
  const F = frame(60, 14, 480, 384, 70, 140, 0, 56);
  const idxU = CITY.findIndex((x) => x[0] === "乌鲁木齐") + 1;
  return {
    ...base(D, "chinabasic"), aspect: 0.68, drag: true,
    params: [{ id: "lat", label: "纬度", min: 0, max: 56, step: 0.1, value: 35, unit: "°N" }, { id: "lon", label: "经度", min: 70, max: 140, step: 0.1, value: 105, unit: "°E" }],
    choices: [{ id: "city", label: "城市", options: [[0, "自定义"], ...CITY.map(([n], i) => [i + 1, n] as [number, string])], value: 0 }],
    derive: (s, ch) => { if (ch === "city" && s.city > 0) { s.lat = CITY[s.city - 1][1]; s.lon = CITY[s.city - 1][2]; } else if (ch === "lat" || ch === "lon") s.city = 0; },
    pointer: (kind, x, y) => (x >= F.x0 - 4 && x <= F.x0 + F.w + 4 && y >= F.y0 - 4 && y <= F.y0 + F.h + 4 ? { lat: Math.round(Math.max(0, Math.min(56, F.lat(y))) * 10) / 10, lon: Math.round(Math.max(70, Math.min(140, F.lon(x))) * 10) / 10 } : undefined),
    readouts: (s) => [{ label: "纬度", value: M.latStr(Math.round(s.lat * 10) / 10) }, { label: "经度", value: M.lonStr(Math.round(s.lon * 10) / 10) }, { label: "与我国范围的关系", value: M.inChinaBox(s.lat, s.lon) ? "在范围内" : "不在范围内" }, { label: "温度带", value: M.zoneOfLat(s.lat) }, { label: "北京时间 12:00 时，当地的地方时", value: M.solarClock(12, s.lon) }],
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#fff", null, 0, 0);
      drawWorld(c, F, { zones: true, step: 10 });
      line(c, F.x0, F.Y(23.5), F.x0 + F.w, F.Y(23.5), COL.orange, 3, [8, 5]);
      box(c, F, [M.CHINA_BOX.latS, M.CHINA_BOX.latN, M.CHINA_BOX.lonW, M.CHINA_BOX.lonE], COL.red);
      line(c, F.X(120), F.y0, F.X(120), F.y0 + F.h, COL.purple, 3, [10, 6]);
      for (const [, la, lo] of CITY) circle(c, F.X(lo), F.Y(la), 4, COL.ink, "#fff", 2);
      pin(c, F.X(s.lon), F.Y(s.lat));
    },
    tasks: [
      { id: "urumqi", text: "选择乌鲁木齐，比较它的地方时与北京时间", check: (s) => s.city === idxU },
      { id: "north", text: "把图钉放到最北端附近（北纬 52° 以上）", check: (s) => s.lat >= 52 },
      { id: "tropic", text: "把图钉放到我国范围内的热带（北纬 23.5° 以南）", check: (s) => s.lat < 23.5 && M.inChinaBox(s.lat, s.lon) }],
    links: [{ text: "相关：地图（中国、世界）", href: "#/science/map" }],
  };
}

// ---------- China: the three steps ----------
export function chinaterrain(D: M.GeoData): SimDef {
  const X = (lon: number) => 40 + ((lon - 73) / (122 - 73)) * 560, Y = (a: number) => 330 - (a / 5200) * 250;
  return withCard({
    ...base(D, "chinaterrain"), aspect: 0.6,
    params: [{ id: "lon", label: "经度（东经）", min: 73, max: 122, step: 1, value: 76, unit: "°" }],
    pointer: (kind, x) => ({ lon: Math.max(73, Math.min(122, Math.round(73 + ((x - 40) / 560) * 49))) }),
    readouts: (s) => [{ label: "示意剖面", value: "沿北纬 35° 附近" }, { label: "经度", value: M.lonStr(s.lon) }, { label: "海拔（示意）", value: fmt(Math.round(M.altAt(s.lon) / 50) * 50, 0), unit: "m" }, { label: "所在阶梯", value: ["第一级阶梯", "第二级阶梯", "第三级阶梯"][M.stepOf(s.lon) - 1] }],
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#f1fbff", null, 0, 0);
      const cols = ["#ffe066", "#d8f5a2", "#b2f2bb"], bounds = [73, 102.5, 111, 122];
      for (let k = 0; k < 3; k++) { const pts: [number, number][] = []; for (let l = bounds[k]; l <= bounds[k + 1]; l += 0.5) pts.push([X(l), Y(M.altAt(l))]); poly(c, [[X(bounds[k]), 330], ...pts, [X(bounds[k + 1]), 330]], cols[k], COL.ink, 3); }
      line(c, 30, 330, 610, 330, COL.blue, 5); for (const [i, l] of [[1, 88], [2, 107], [3, 117]] as [number, number][]) txt(c, String(i), X(l), 350, 22, COL.ink);
      for (const a of [500, 1000, 2000, 4000]) { line(c, 30, Y(a), 610, Y(a), "#adb5bd", 1, [4, 5]); txt(c, String(a), 18, Y(a) - 8, 11, COL.grey); }
      arrow(c, X(104), Y(1700) - 40, X(118), Y(100) - 40, COL.blue, 5);
      const mx = X(s.lon), my = Y(M.altAt(s.lon)); line(c, mx, 60, mx, 330, COL.red, 3, [6, 5]); circle(c, mx, my, 9, COL.red, "#fff", 3);
    },
    tasks: [
      { id: "third", text: "把标记拖到第三级阶梯上", check: (s) => M.stepOf(s.lon) === 3 },
      { id: "second", text: "把标记拖到第二级阶梯上", check: (s) => M.stepOf(s.lon) === 2 },
      { id: "high", text: "找到海拔最高处（示意海拔 4500 米以上）", check: (s) => M.altAt(s.lon) >= 4500 }],
  }, (s) => String(M.stepOf(s.lon)), (el, s) => { const t = M.STEPS[M.stepOf(s.lon) - 1]; el.replaceChildren(h("h3", {}, "这一级阶梯"), h("p", { class: "gl-line" }, h("b", {}, "海拔"), U(t.alt)), h("p", { class: "gl-line" }, h("b", {}, "主要地形"), U(t.form)), h("p", { class: "gl-line" }, h("b", {}, "范围"), U(t.range))); });
}

// ---------- the fact explorers ----------
export function facts(D: M.GeoData, id: GeoId, world: boolean, start: number, tasks: [string, string][]): SimDef {
  const mod = D.facts[id], E = mod.entries;
  const F = world ? frame(50, 24, 540, 270, -180, 180, -90, 90) : frame(60, 14, 480, 384, 70, 140, 0, 56);
  const idx = (n: string) => E.findIndex((e) => e.n === n);
  return withCard({
    ...base(D, id), aspect: world ? 0.55 : 0.68, params: [],
    choices: [{ id: "e", label: "条目", options: E.map((e, i) => [i, e.n] as [number, string]), value: start }],
    readouts: (s): Readout[] => { const b = E[s.e].box; return [{ label: "类别", value: E[s.e].g ?? "" }, ...(b ? [{ label: "纬度范围", value: `${M.latStr(b[0])} – ${M.latStr(b[1])}` }, { label: "经度范围", value: `${M.lonStr(b[2])} – ${M.lonStr(b[3])}` }] : [])]; },
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#fff", null, 0, 0);
      drawWorld(c, F, { zones: false, step: world ? 30 : 10 });
      if (!world) box(c, F, [M.CHINA_BOX.latS, M.CHINA_BOX.latN, M.CHINA_BOX.lonW, M.CHINA_BOX.lonE], COL.grey);
      const b = E[s.e].box; if (b) box(c, F, b, COL.red);
    },
    tasks: tasks.map(([n, text]) => ({ id: n, text, check: (s: St) => s.e === idx(n) })),
    links: [{ text: "相关：地图（中国、世界）", href: "#/science/map" }],
  }, (s) => String(s.e), (el, s) => {
    const e = E[s.e];
    el.replaceChildren(h("h3", {}, tr(e.n)), ...Object.entries(mod.fields).filter(([f]) => e.f[f] !== undefined).map(([f, d]) => h("p", { class: "gl-line" }, h("b", {}, d.label), U(e.f[f]))), ...(e.check ? [h("p", { class: "muted small" }, "此条内容请对照资料核对。")] : []));
  });
}

// ---------- China: the regions on the province map ----------
export const REG4: Record<string, string> = { bj: "北方地区", tj: "北方地区", he: "北方地区", sx: "北方地区", ln: "北方地区", jl: "北方地区", hl: "北方地区", sd: "北方地区", ha: "北方地区", sn: "北方地区",
  sh: "南方地区", js: "南方地区", zj: "南方地区", ah: "南方地区", fj: "南方地区", jx: "南方地区", hb: "南方地区", hn: "南方地区", gd: "南方地区", gx: "南方地区", hi: "南方地区", cq: "南方地区", sc: "南方地区", gz: "南方地区", yn: "南方地区",
  nm: "西北地区", gs: "西北地区", nx: "西北地区", xj: "西北地区", qh: "青藏地区", xz: "青藏地区", hk: "港澳台", mo: "港澳台", tw: "港澳台" };
const REGCOL: Record<string, string> = { 北方地区: "#ffd8a8", 南方地区: "#b2f2bb", 西北地区: "#fff3bf", 青藏地区: "#a5d8ff", 港澳台: "#fcc2d7" };
export interface GeoMapProv { id: string; n: string; d: string; area: number }
export function chinaregions(D: M.GeoData, provs: GeoMapProv[]): SimDef {
  const S = 640 / 2000, paths = provs.map((p) => new Path2D(p.d));
  const hit = document.createElement("canvas").getContext("2d")!;
  const byName = new Map(D.facts.chinaregions.entries.map((e) => [e.n, e]));
  const idx = (id: string) => provs.findIndex((p) => p.id === id);
  return withCard({
    ...base(D, "chinaregions"), aspect: 1853 / 2000,
    choices: [{ id: "view", label: "显示方式", options: [[0, "四大区域着色"], [1, "只突出选中的省区"]], value: 0 }],
    params: [{ id: "p", label: "省级行政区序号", min: 0, max: provs.length - 1, step: 1, value: 0 }],
    actions: [{ id: "prev", label: "上一个", run: (s) => ({ p: (s.p + provs.length - 1) % provs.length }) }, { id: "next", label: "下一个", run: (s) => ({ p: (s.p + 1) % provs.length }) }],
    pointer: (kind, x, y) => { if (kind !== "down") return; let best = -1; paths.forEach((pa, i) => { if (hit.isPointInPath(pa, x / S, y / S) && (best < 0 || provs[i].area < provs[best].area)) best = i; }); return best >= 0 ? { p: best } : undefined; },
    readouts: (s) => [{ label: "序号", value: `${s.p + 1} / ${provs.length}` }, { label: "所属区域", value: REG4[provs[s.p].id] }],
    draw(c, w, hh, s: St) {
      rect(c, 0, 0, w, hh, "#f1fbff", null, 0, 0);
      c.save(); c.scale(S, S);
      provs.forEach((p, i) => { const on = i === s.p; c.fillStyle = s.view === 0 ? REGCOL[REG4[p.id]] : on ? "#ff8787" : "#e9ecef"; c.fill(paths[i]); c.strokeStyle = "#fff"; c.lineWidth = 5; c.stroke(paths[i]); });
      c.strokeStyle = COL.red; c.lineWidth = 12; c.stroke(paths[s.p]);
      c.restore();
    },
    tasks: [
      { id: "view", text: "切换到“只突出选中的省区”", check: (s) => s.view === 1 },
      { id: "taiwan", text: "选中台湾，看它属于哪个区域", check: (s) => s.p === idx("tw") },
      { id: "tibet", text: "选中西藏，看它属于哪个区域", check: (s) => s.p === idx("xz") },
      { id: "mongolia", text: "按四大区域着色，选中内蒙古，比较它与邻近省区的区域", check: (s) => s.view === 0 && s.p === idx("nm") }],
    links: [{ text: "相关：地图（中国、世界）", href: "#/science/map" }],
  }, (s) => String(s.p), (el, s) => {
    const pv = provs[s.p], e = byName.get(pv.n), rg = byName.get(REG4[pv.id]);
    el.replaceChildren(h("h3", {}, tr(pv.n)), ...(e ? Object.entries(D.facts.chinaregions.fields).filter(([f]) => e.f[f] !== undefined && ["ab", "cap", "feat"].includes(f)).map(([f, d]) => h("p", { class: "gl-line" }, h("b", {}, d.label), U(e.f[f]))) : []),
      ...(rg ? [h("h3", {}, "所属区域"), h("p", { class: "gl-line" }, U(rg.n, "b")), ...Object.entries(D.facts.chinaregions.fields).filter(([f]) => rg.f[f] !== undefined).map(([f, d]) => h("p", { class: "gl-line" }, h("b", {}, d.label), U(rg.f[f])))] : [h("p", { class: "muted small" }, "香港、澳门、台湾是三个特殊的区域。")]), h("p", { class: "muted small" }, "四大区域按省区近似着色，边界省区只作示意。"));
  });
}
