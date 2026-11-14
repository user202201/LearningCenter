/** The geography lab's modules, part 1: earth and maps (seasons, terrain, water cycle, weather, plates, globe, time zones, scale, contours). Each is a `SimDef` of the physics lab's kit. */
import { type SimDef, type St, fmt } from "./phys/kit";
import { CATALOG, type GeoId } from "./geolab-catalog";
import * as M from "./geolab-model";
import * as SM from "./spacemodel";
import { COL, arrow, circle, frame, line, poly, rect, txt, drawWorld, pin } from "./geolab-draw";

export const KEY = "learn.geolab.v1";
export const base = (D: M.GeoData, id: GeoId): Pick<SimDef, "meta" | "lesson" | "quiz" | "storeKey" | "handle"> => ({ meta: CATALOG[id], lesson: D.lessons[id], quiz: (r) => M.quizOf(D, id, r), storeKey: KEY, handle: "__geo" });
const RAD = Math.PI / 180;
const MAPLINK = { text: "相关：地图（中国、世界）", href: "#/science/map" };

export function seasons(D: M.GeoData): SimDef {
  return {
    ...base(D, "seasons"), aspect: 0.62,
    params: [{ id: "day", label: "日期（一年中的第几天）", min: 1, max: 365, step: 1, value: 80 }, { id: "lat", label: "观测地的纬度", min: -90, max: 90, step: 5, value: 40, unit: "°" }],
    play: { param: "day", rate: 30, loop: true },
    readouts: (s) => { const dec = SM.declination(s.day); return [
      { label: "日期", value: M.monthDay(s.day) }, { label: "太阳直射点纬度", value: M.latStr(Math.round(dec * 10) / 10) },
      { label: "正午太阳高度", value: fmt(SM.noonElevation(s.lat, dec), 1), unit: "°" }, { label: "昼长", value: fmt(SM.dayLength(s.lat, dec), 1), unit: "小时" }]; },
    draw(c, w, h, s: St) {
      const dec = SM.declination(s.day);
      // the orbit seen from above: the axis keeps its direction
      const cx = 160, cy = 200, rx = 120, ry = 90, phi = ((s.day - 172) / 365.25) * 2 * Math.PI;
      c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.strokeStyle = COL.grey; c.lineWidth = 2; c.setLineDash([5, 6]); c.stroke(); c.setLineDash([]);
      circle(c, cx, cy, 18, COL.yellow, COL.orange, 3);
      const ex = cx - rx * Math.cos(phi), ey = cy - ry * Math.sin(phi);
      circle(c, ex, ey, 14, COL.water2, COL.ink, 3);
      arrow(c, ex, ey, ex + 34 * Math.sin(23.5 * RAD), ey - 34 * Math.cos(23.5 * RAD), COL.red, 3); txt(c, "N", ex + 46 * Math.sin(23.5 * RAD), ey - 46 * Math.cos(23.5 * RAD), 14, COL.red);
      for (const [d, lx, ly] of [[172, cx - rx - 14, cy + 24], [355, cx + rx + 14, cy + 24], [80, cx, cy + ry + 26], [264, cx, cy - ry - 22]] as [number, number, number][]) txt(c, M.monthDay(d), lx, ly, 13, COL.grey);
      // the side view at noon: parallel rays, the Earth tilted so that the direct point is at the declination
      const R = 105, ox = 480, oy = 205;
      for (let k = -4; k <= 4; k++) { const y = oy + k * 24; if (Math.abs(k * 24) < R) { const dx = Math.sqrt(R * R - (k * 24) ** 2); arrow(c, 335, y, ox - dx - 4, y, COL.yellow, 3); } else line(c, 335, y, ox, y, COL.yellow, 2); }
      c.beginPath(); c.arc(ox, oy, R, 0, 7); c.fillStyle = "#a5d8ff"; c.fill();
      c.save(); c.beginPath(); c.arc(ox, oy, R, -Math.PI / 2, Math.PI / 2); c.closePath(); c.fillStyle = "rgba(45,34,48,.25)"; c.fill(); c.restore();
      c.save(); c.translate(ox, oy); c.rotate(-dec * RAD);
      line(c, -R, 0, R, 0, COL.red, 3, [8, 6]); line(c, 0, -R * 1.3, 0, R * 1.3, COL.ink, 3); txt(c, "N", 0, -R * 1.3 - 12, 15, COL.ink);
      c.restore();
      c.beginPath(); c.arc(ox, oy, R, 0, 7); c.strokeStyle = COL.ink; c.lineWidth = 4; c.stroke();
      const a = -dec * RAD, pt = (p: number): [number, number] => { const x = -R * Math.cos(p * RAD), y = -R * Math.sin(p * RAD); return [ox + x * Math.cos(a) - y * Math.sin(a), oy + x * Math.sin(a) + y * Math.cos(a)]; };
      const [sx, sy] = pt(dec); circle(c, sx, sy, 6, COL.yellow, COL.orange, 2);
      const [px, py] = pt(s.lat); circle(c, px, py, 8, COL.red, "#fff", 3);
      line(c, 335, py, px - 10, py, COL.red, 3);
      txt(c, `${fmt(SM.noonElevation(s.lat, dec), 0)}°`, px + 30, py - 14, 17, COL.red);
    },
    tasks: [
      { id: "summer", text: "找到夏至：让太阳直射点到达北回归线附近（纬度 23° 以上）", check: (s) => SM.declination(s.day) > 23 },
      { id: "south", text: "让南纬 30° 的正午太阳高度大于 80°", check: (s) => s.lat <= -25 && s.lat >= -35 && SM.noonElevation(s.lat, SM.declination(s.day)) > 80 },
      { id: "short", text: "找到北半球中纬度（北纬 30°～50°）昼长不足 10 小时的日期", check: (s) => s.lat >= 30 && s.lat <= 50 && SM.dayLength(s.lat, SM.declination(s.day)) < 10 }],
    links: [{ text: "相关：天文实验室", href: "#/science/space" }],
  };
}

const feat = ["地面平坦", "坡度和缓", "起伏很大", "四周高中间低"];
export function terrain(D: M.GeoData): SimDef {
  return {
    ...base(D, "terrain"), aspect: 0.55,
    params: [{ id: "alt", label: "海拔", min: 0, max: 6000, step: 100, value: 300, unit: "m" }, { id: "rel", label: "相对高度", min: 0, max: 3000, step: 50, value: 100, unit: "m" }],
    choices: [{ id: "feat", label: "地表特征", options: feat.map((f, i) => [i, f] as [number, string]), value: 0 }],
    readouts: (s) => [{ label: "海拔", value: fmt(s.alt, 0), unit: "m" }, { label: "相对高度", value: fmt(s.rel, 0), unit: "m" }, { label: "地形类型", value: M.terrainType(s.alt, s.rel, s.feat) }],
    draw(c, w, h, s: St) {
      const y0 = 330, k = 250 / 6000, Y = (m: number) => y0 - Math.max(m, 2) * k, X0 = 40, X1 = 600;
      rect(c, 0, 0, w, h, "#f1fbff", null, 0, 0);
      c.fillStyle = "#74c0fc"; c.fillRect(0, y0, w, h - y0); line(c, 0, y0, w, y0, COL.blue, 4);
      for (const [m, col] of [[200, "#2f9e44"], [500, COL.orange]] as [number, string][]) { line(c, X0, Y(m), X1, Y(m), col, 2, [6, 6]); txt(c, String(m), X1 + 14, Y(m), 13, col); }
      const pts: [number, number][] = [];
      const t = M.terrainType(s.alt, s.rel, s.feat);
      if (s.feat === 3) { const rim = s.alt + s.rel; pts.push([X0, Y(rim)], [180, Y(rim)], [260, Y(s.alt)], [420, Y(s.alt)], [500, Y(rim)], [X1, Y(rim)]); }
      else if (s.feat === 2) { const lo = Math.max(0, s.alt - s.rel); for (let i = 0; i <= 8; i++) pts.push([X0 + (i * (X1 - X0)) / 8, Y(i % 2 ? lo : s.alt + (i === 4 ? s.rel * 0.3 : 0))]); }
      else if (s.feat === 1) { for (let i = 0; i <= 40; i++) pts.push([X0 + (i * (X1 - X0)) / 40, Y(s.alt + (s.rel / 2) * Math.sin(i * 0.9))]); }
      else if (s.alt >= 500) pts.push([X0, Y(Math.max(0, s.alt - s.rel))], [150, Y(s.alt)], [490, Y(s.alt)], [X1, Y(Math.max(0, s.alt - s.rel))]);
      else pts.push([X0, Y(s.alt)], [X1, Y(s.alt)]);
      poly(c, [[X0, y0], ...pts, [X1, y0]], t === "平原" ? "#b2f2bb" : t === "丘陵" ? "#d8f5a2" : t === "高原" ? "#ffe066" : t === "盆地" ? "#ffd8a8" : "#d9a066", COL.ink, 4);
      txt(c, t === "平原" ? "PLAIN" : t === "丘陵" ? "HILLS" : t === "高原" ? "PLATEAU" : t === "盆地" ? "BASIN" : "MOUNTAINS", w / 2, 40, 24, COL.ink);
    },
    tasks: [
      { id: "plateau", text: "做出一个高原：海拔 500 米以上、顶面平坦", check: (s) => M.terrainType(s.alt, s.rel, s.feat) === "高原" },
      { id: "basin", text: "做出一个盆地：四周高、中间低", check: (s) => M.terrainType(s.alt, s.rel, s.feat) === "盆地" },
      { id: "hills", text: "做出丘陵：海拔 500 米以下、相对高度不超过 200 米、坡度和缓", check: (s) => M.terrainType(s.alt, s.rel, s.feat) === "丘陵" && s.rel <= 200 }],
  };
}

const LINKS = ["蒸发", "水汽输送", "降水", "地表径流", "下渗", "地下径流", "蒸腾"];
export function watercycle(D: M.GeoData): SimDef {
  return {
    ...base(D, "watercycle"), aspect: 0.62,
    params: [{ id: "sun", label: "太阳辐射", min: 20, max: 100, step: 5, value: 60 }, { id: "forest", label: "森林覆盖率", min: 0, max: 100, step: 5, value: 40, unit: "%" }],
    choices: [{ id: "link", label: "环节", options: LINKS.map((n, i) => [i, n] as [number, string]), value: 0 }],
    readouts: (s) => { const q = M.cycle(s.sun, s.forest); return [{ label: "当前环节", value: LINKS[s.link] }, { label: "陆地降水", value: fmt(q.precipLand, 1) }, { label: "蒸发与蒸腾", value: fmt(q.landEvap + q.transp, 1) }, { label: "地表径流", value: fmt(q.surface, 1) }, { label: "地下径流", value: fmt(q.under, 1) }]; },
    draw(c, w, h, s: St) {
      const q = M.cycle(s.sun, s.forest);
      rect(c, 0, 0, w, h, "#e7f5ff", null, 0, 0);
      poly(c, [[0, 300], [250, 300], [300, 280], [330, 300], [330, 395], [0, 395]], "#74c0fc", null, 0);
      poly(c, [[300, 285], [380, 250], [440, 200], [500, 250], [640, 270], [640, 395], [300, 395]], "#b2f2bb", COL.ink, 4);
      poly(c, [[300, 340], [640, 340], [640, 395], [300, 395]], "#d9a066", null, 0);
      c.beginPath(); c.ellipse(150, 90, 80, 30, 0, 0, 7); c.ellipse(210, 100, 60, 26, 0, 0, 7); c.fillStyle = "#fff"; c.fill();
      c.beginPath(); c.ellipse(450, 70, 70, 28, 0, 0, 7); c.ellipse(500, 82, 56, 24, 0, 0, 7); c.fillStyle = "#fff"; c.fill();
      circle(c, 590, 40, 22, COL.yellow, COL.orange, 3);
      for (const x of [520, 560, 600]) { line(c, x, 270, x, 250, "#2b8a3e", 6); circle(c, x, 240, 14, "#51cf66", "#2b8a3e", 3); }
      const wd = (v: number, on: boolean) => (3 + Math.min(10, v / 10)) * (on ? 1.6 : 1);
      const items: [number, string, number, number][] = [[0, "E", 70, 220], [1, "V", 300, 44], [2, "P", 462, 150], [3, "R", 330, 268], [4, "I", 398, 322], [5, "G", 310, 384], [6, "T", 580, 160]];
      const col = (i: number, d: string) => (s.link === i ? COL.red : d);
      arrow(c, 90, 290, 90, 140, col(0, COL.blue), wd(q.oceanEvap, s.link === 0));
      arrow(c, 190, 60, 420, 60, col(1, COL.blue), wd(q.vapor, s.link === 1));
      arrow(c, 440, 110, 440, 190, col(2, COL.blue), wd(q.precipLand, s.link === 2));
      arrow(c, 380, 262, 270, 295, col(3, COL.teal), wd(q.surface, s.link === 3));
      arrow(c, 380, 300, 380, 345, col(4, COL.teal), wd(q.infil, s.link === 4));
      arrow(c, 380, 368, 245, 368, col(5, COL.teal), wd(q.under, s.link === 5));
      arrow(c, 560, 220, 540, 130, col(6, COL.green), wd(q.transp, s.link === 6));
      for (const [, l, x, y] of items) txt(c, l, x, y, 18, COL.ink);
    },
    tasks: [
      { id: "vapor", text: "选择“水汽输送”这个环节，看它把海上的水汽送到陆地", check: (s) => s.link === 1 },
      { id: "forest", text: "把森林覆盖率调到 80% 以上，看地下径流的变化", check: (s) => s.forest >= 80 },
      { id: "sun", text: "把太阳辐射降到 30 以下，看降水减少", check: (s) => s.sun <= 30 }],
  };
}

const SKY = ["晴天", "多云", "阴天"];
export function weather(D: M.GeoData): SimDef {
  const nameOf = (s: St) => (s.rain > 0 ? (s.tmax <= 0 ? "下雪" : M.rainClass(s.rain)) : s.cloud < 25 ? SKY[0] : s.cloud < 65 ? SKY[1] : SKY[2]);
  return {
    ...base(D, "weather"), aspect: 0.55,
    params: [{ id: "cloud", label: "云量", min: 0, max: 100, step: 5, value: 20, unit: "%" }, { id: "rain", label: "24 小时降水量", min: 0, max: 300, step: 5, value: 0, unit: "mm" },
      { id: "force", label: "风力（级）", min: 0, max: 12, step: 1, value: 2 }, { id: "tmax", label: "最高气温", min: -20, max: 40, step: 1, value: 22, unit: "℃" }, { id: "tmin", label: "最低气温", min: -30, max: 30, step: 1, value: 12, unit: "℃" }],
    choices: [{ id: "dir", label: "风向", options: M.WINDS.map((n, i) => [i, n] as [number, string]), value: 0 }],
    derive: (s, ch) => { if (s.tmin > s.tmax) { if (ch === "tmin") s.tmax = s.tmin; else s.tmin = s.tmax; } },
    readouts: (s) => [{ label: "天气", value: nameOf(s) }, { label: "风向", value: M.WINDS[s.dir] }, { label: "风速", value: M.beaufortText(s.force) }, { label: "气温日较差", value: fmt(s.tmax - s.tmin, 0), unit: "℃" }],
    draw(c, w, h, s: St) {
      rect(c, 0, 0, w, h, s.cloud < 25 ? "#d0ebff" : s.cloud < 65 ? "#e7f5ff" : "#dee2e6", null, 0, 0);
      if (s.cloud < 65 && s.rain === 0) circle(c, 150, 120, 44, COL.yellow, COL.orange, 4);
      if (s.cloud >= 25 || s.rain > 0) { c.beginPath(); c.ellipse(160, 140, 90, 40, 0, 0, 7); c.ellipse(220, 150, 70, 34, 0, 0, 7); c.ellipse(110, 150, 60, 30, 0, 0, 7); c.fillStyle = s.cloud >= 65 ? "#adb5bd" : "#fff"; c.fill(); c.strokeStyle = COL.ink; c.lineWidth = 3; c.stroke(); }
      const n = Math.min(14, Math.round(s.rain / 20) + (s.rain > 0 ? 3 : 0));
      for (let i = 0; i < n; i++) { const x = 90 + ((i * 37) % 160), y = 200 + ((i * 23) % 70); if (s.tmax <= 0) circle(c, x, y, 5, "#fff", COL.blue, 2); else line(c, x, y, x - 6, y + 20, COL.blue, 3); }
      // wind vane: the arrow head points to where the wind comes from
      const vx = 440, vy = 150, ang = (s.dir * 45 - 90) * RAD;
      circle(c, vx, vy, 80, "#fff", COL.ink, 3);
      txt(c, "N", vx, vy - 66, 15); txt(c, "S", vx, vy + 66, 15); txt(c, "E", vx + 66, vy, 15); txt(c, "W", vx - 66, vy, 15);
      arrow(c, vx - Math.cos(ang) * 40, vy - Math.sin(ang) * 40, vx + Math.cos(ang) * 52, vy + Math.sin(ang) * 52, COL.red, 6);
      txt(c, `F${s.force}`, vx, vy + 105, 22, COL.purple);
      const T = (t: number) => 345 - ((t + 30) / 70) * 100;
      rect(c, 40, 245, 20, 100, "#fff", COL.ink, 2, 6); rect(c, 40, T(s.tmax), 20, 345 - T(s.tmax), COL.red, null, 0, 6);
      rect(c, 80, 245, 20, 100, "#fff", COL.ink, 2, 6); rect(c, 80, T(s.tmin), 20, 345 - T(s.tmin), COL.blue, null, 0, 6);
      txt(c, `${s.tmax}`, 50, 232, 16, COL.red); txt(c, `${s.tmin}`, 90, 232, 16, COL.blue);
    },
    tasks: [
      { id: "storm", text: "让天气成为暴雨（24 小时降水量 50 毫米以上）", check: (s) => s.rain >= 50 },
      { id: "gale", text: "把风力调到 8 级以上（大风）", check: (s) => s.force >= 8 },
      { id: "range", text: "使气温日较差大于 15℃", check: (s) => s.tmax - s.tmin > 15 }],
  };
}

const BOUND = ["张裂", "碰撞", "俯冲"];
const PHEN = ["裂谷和海岭（如东非大裂谷、红海）", "褶皱山脉（如喜马拉雅山脉）", "海沟、岛弧和火山（如日本、安第斯山脉）"];
export function plates(D: M.GeoData): SimDef {
  const is0 = (s: St) => s.mode === 0, is1 = (s: St) => s.mode === 1;
  return {
    ...base(D, "plates"), aspect: 0.6,
    choices: [{ id: "mode", label: "内容", options: [[0, "板块边界"], [1, "地震波"]], value: 0 }, { id: "b", label: "边界类型", options: BOUND.map((n, i) => [i, n] as [number, string]), value: 0, when: is0 }],
    params: [{ id: "v", label: "板块速度", min: 1, max: 10, step: 1, value: 5, unit: "cm/年", when: is0 }, { id: "t", label: "经过的时间", min: 0, max: 100, step: 5, value: 10, unit: "百万年", when: is0 },
      { id: "d", label: "震中距", min: 20, max: 800, step: 20, value: 200, unit: "km", when: is1 }, { id: "mag", label: "震级", min: 3, max: 9, step: 0.5, value: 5, when: is1 }],
    play: { param: "t", rate: 8, loop: true },
    readouts: (s) => s.mode === 0 ? [{ label: "移动距离", value: fmt(M.kmMoved(s.v, s.t), 0), unit: "km" }, { label: "边界类型", value: BOUND[s.b] }, { label: "形成的地貌", value: PHEN[s.b] }]
      : [{ label: "纵波到达", value: fmt(s.d / M.VP, 0), unit: "秒" }, { label: "横波到达", value: fmt(s.d / M.VS, 0), unit: "秒" }, { label: "时间差", value: fmt(M.waveGap(s.d), 0), unit: "秒" }, { label: "能量约为 5 级的", value: fmt(M.energyRatio(s.mag - 5), 1), unit: "倍" }],
    draw(c, w, h, s: St) {
      rect(c, 0, 0, w, h, "#fff9db", null, 0, 0);
      if (s.mode === 1) {
        rect(c, 30, 40, w - 60, 130, "#f8f9fa", COL.ink, 3, 10);
        const X = (t: number) => 50 + (t / 260) * (w - 100);
        line(c, 50, 105, w - 50, 105, COL.grey, 2);
        const tp = s.d / M.VP, ts = s.d / M.VS;
        for (let x = 50; x < w - 50; x += 3) { const t = ((x - 50) / (w - 100)) * 260; let a = 0; if (t > tp) a += 18 * Math.exp(-(t - tp) / 40) * Math.sin(t * 2.2); if (t > ts) a += 40 * Math.exp(-(t - ts) / 50) * Math.sin(t * 1.1) * Math.min(1, s.mag / 6); line(c, x, 105, x, 105 - a, COL.ink, 2); }
        line(c, X(tp), 50, X(tp), 160, COL.blue, 3); txt(c, "P", X(tp), 36, 16, COL.blue);
        line(c, X(ts), 50, X(ts), 160, COL.red, 3); txt(c, "S", X(ts), 36, 16, COL.red);
        txt(c, `${fmt(M.waveGap(s.d), 0)} s`, (X(tp) + X(ts)) / 2, 182, 18, COL.purple);
        circle(c, 120, 300, 10, COL.red, COL.ink, 3);
        for (let k = 1; k <= 4; k++) { c.beginPath(); c.arc(120, 300, k * 30, 0, 7); c.strokeStyle = k % 2 ? COL.blue : COL.red; c.lineWidth = 2; c.stroke(); }
        const sx = 120 + Math.min(440, (s.d / 800) * 440); circle(c, sx, 300, 9, COL.green, COL.ink, 3); line(c, 130, 340, sx, 340, COL.ink, 2); txt(c, `${s.d} km`, (130 + sx) / 2, 358, 16);
        return;
      }
      const sep = Math.min(130, (M.kmMoved(s.v, s.t) / 1200) * 130), top = 230, bot = 360;
      c.fillStyle = "#ffa8a8"; c.fillRect(0, bot, w, h - bot);
      if (s.b === 0) {
        rect(c, 10, top, 300 - sep, bot - top, "#d9a066", COL.ink, 4, 4); rect(c, 330 + sep, top, 300 - sep, bot - top, "#d9a066", COL.ink, 4, 4);
        c.fillStyle = "#ff6b6b"; c.fillRect(310 - sep, top + 30, 20 + 2 * sep, bot - top - 30);
        arrow(c, 250 - sep, 150, 130, 150, COL.red, 6); arrow(c, 390 + sep, 150, 510, 150, COL.red, 6);
      } else if (s.b === 1) {
        rect(c, 10, top, 300, bot - top, "#d9a066", COL.ink, 4, 4); rect(c, 330, top, 300, bot - top, "#c08552", COL.ink, 4, 4);
        const mh = 10 + sep * 1.1; poly(c, [[250, top], [320 - sep * 0.2, top - mh], [390, top]], "#adb5bd", COL.ink, 4);
        arrow(c, 120, 150, 230, 150, COL.red, 6); arrow(c, 520, 150, 410, 150, COL.red, 6);
      } else {
        rect(c, 330, top - 20, 300, bot - top + 20, "#c08552", COL.ink, 4, 4);
        poly(c, [[10, top + 30], [300, top + 30], [440, bot], [10, bot]], "#4dabf7", COL.ink, 4);
        const vh = 10 + sep * 0.7; poly(c, [[470, top - 20], [500, top - 20 - vh], [530, top - 20]], "#e8590c", COL.ink, 4);
        for (let k = 0; k < 5; k++) circle(c, 330 + k * 22, top + 40 + k * 22, 5, COL.red, "#fff", 2);
        arrow(c, 100, 150, 230, 175, COL.red, 6);
      }
    },
    tasks: [
      { id: "himalaya", text: "让两个板块碰撞 50 百万年以上，看山脉隆起", check: (s) => s.mode === 0 && s.b === 1 && s.t >= 50 },
      { id: "gap", text: "把震中距调到 260 千米以上，使横波比纵波晚到 30 秒以上", check: (s) => s.mode === 1 && M.waveGap(s.d) >= 30 },
      { id: "mag", text: "把震级调到 7 级以上，看能量比 5 级大多少倍", check: (s) => s.mode === 1 && s.mag >= 7 }],
  };
}

export function globe(D: M.GeoData): SimDef {
  const F = frame(50, 24, 540, 270, -180, 180, -90, 90);
  const clampLat = (v: number) => Math.round(Math.max(-90, Math.min(90, v))), clampLon = (v: number) => Math.round(Math.max(-180, Math.min(180, v)));
  return {
    ...base(D, "globe"), aspect: 0.55, drag: true,
    params: [{ id: "lat", label: "纬度（北为正）", min: -90, max: 90, step: 1, value: 30, unit: "°" }, { id: "lon", label: "经度（东为正）", min: -180, max: 180, step: 1, value: 60, unit: "°" }],
    pointer: (kind, x, y) => (x >= F.x0 - 6 && x <= F.x0 + F.w + 6 && y >= F.y0 - 6 && y <= F.y0 + F.h + 6 ? { lat: clampLat(F.lat(y)), lon: clampLon(F.lon(x)) } : undefined),
    readouts: (s) => [{ label: "纬度", value: M.latStr(s.lat) }, { label: "经度", value: M.lonStr(s.lon) }, { label: "半球", value: `${M.hemiNS(s.lat)}、${M.hemiEW(s.lon)}` }, { label: "温度带", value: M.zoneOfLat(s.lat) }, { label: "纬度带", value: M.latBand(s.lat) }],
    draw(c, w, h, s: St) {
      rect(c, 0, 0, w, h, "#fff", null, 0, 0);
      drawWorld(c, F, { zones: true });
      for (const [la, col] of [[0, COL.red], [23.5, COL.orange], [-23.5, COL.orange], [66.5, COL.purple], [-66.5, COL.purple]] as [number, string][]) line(c, F.x0, F.Y(la), F.x0 + F.w, F.Y(la), col, la === 0 ? 3 : 2, [8, 5]);
      for (const lo of [-20, 160]) line(c, F.X(lo), F.y0, F.X(lo), F.y0 + F.h, COL.purple, 3, [10, 6]);
      line(c, F.x0, F.Y(s.lat), F.X(s.lon), F.Y(s.lat), COL.red, 2, [4, 4]); line(c, F.X(s.lon), F.y0 + F.h, F.X(s.lon), F.Y(s.lat), COL.red, 2, [4, 4]);
      pin(c, F.X(s.lon), F.Y(s.lat));
      txt(c, "S", F.x0 - 30, F.y0 + F.h - 4, 14, COL.grey); txt(c, "N", F.x0 - 30, F.y0 + 4, 14, COL.grey); txt(c, "W", F.x0 + 4, F.y0 + F.h + 28, 14, COL.grey); txt(c, "E", F.x0 + F.w - 4, F.y0 + F.h + 28, 14, COL.grey);
    },
    tasks: [
      { id: "beijing", text: "把图钉放到北京附近（约 40°N，116°E）", check: (s) => Math.abs(s.lat - 40) <= 3 && Math.abs(s.lon - 116) <= 4 },
      { id: "south", text: "把图钉放到南半球热带的西半球", check: (s) => s.lat < 0 && s.lat > -23.5 && M.hemiEW(s.lon) === "西半球" },
      { id: "polar", text: "把图钉放到北寒带", check: (s) => M.zoneOfLat(s.lat) === "北寒带" },
      { id: "origin", text: "找到赤道与本初子午线的交点", check: (s) => Math.abs(s.lat) <= 1 && Math.abs(s.lon) <= 1 }],
    links: [MAPLINK],
  };
}

const CITIES: [string, number, string][] = [["伦敦", 0, "LON"], ["北京", 8, "BJ"], ["纽约", -5, "NY"], ["悉尼", 10, "SYD"]];
export function timezone(D: M.GeoData): SimDef {
  const X = (z: number) => 30 + ((z + 12.5) / 25) * 580;
  return {
    ...base(D, "timezone"), aspect: 0.5,
    params: [{ id: "utc", label: "零时区（中时区）的时刻", min: 0, max: 24, step: 0.25, value: 6, unit: "时" }],
    play: { param: "utc", rate: 2, loop: true },
    pointer: (kind, x) => { const nz = ((x - 30) / 580) * 25 - 12.5; return { utc: Math.max(0, Math.min(24, Math.round((12 - nz) * 4) / 4)) }; },
    readouts: (s) => CITIES.map(([n, z]) => { const l = M.localAt(s.utc, z); return { label: n, value: M.clock(l.hour), unit: l.off === 0 ? "" : l.off > 0 ? "次日" : "前一日" }; }),
    draw(c, w, h, s: St) {
      rect(c, 0, 0, w, h, "#fff", null, 0, 0);
      const top = 60, hh = 160;
      for (let z = -12; z <= 12; z++) {
        const l = M.localAt(s.utc, z), x0 = Math.max(30, X(z - 0.5)), x1 = Math.min(610, X(z + 0.5));
        c.fillStyle = l.off === 0 ? "#d3f9d8" : l.off > 0 ? "#ffe3e3" : "#e7f5ff"; c.fillRect(x0, top, x1 - x0, hh);
        if (l.hour < 6 || l.hour >= 18) { c.fillStyle = "rgba(45,34,48,.28)"; c.fillRect(x0, top, x1 - x0, hh); }
        line(c, x0, top, x0, top + hh, "#fff", 2);
        txt(c, (z > 0 ? "+" : "") + z, X(z), top - 14, 13, COL.grey); txt(c, String(Math.floor(l.hour)), X(z), top + hh + 16, 14, COL.ink);
      }
      rect(c, 30, top, 580, hh, "", COL.ink, 3, 0);
      const nz = M.noonLon(s.utc) / 15, nx = X(nz); circle(c, nx, top + 30, 20, COL.yellow, COL.orange, 3); line(c, nx, top + 50, nx, top + hh, COL.orange, 4, [8, 5]);
      const mz = nz > 0 ? nz - 12 : nz + 12; line(c, X(mz), top, X(mz), top + hh, COL.purple, 3, [8, 5]);
      line(c, 30, top - 24, 30, top + hh + 4, COL.red, 4); line(c, 610, top - 24, 610, top + hh + 4, COL.red, 4);
      for (const [, z, id] of CITIES) { circle(c, X(z), top + hh - 30, 8, COL.red, COL.ink, 3); txt(c, id, X(z), top + hh - 52, 14, COL.ink); }
      txt(c, "180", 30, top + hh + 38, 14, COL.red); txt(c, "180", 610, top + hh + 38, 14, COL.red); txt(c, "0", X(0), top + hh + 38, 14, COL.blue);
    },
    tasks: [
      { id: "noon", text: "使北京时间为 12:00（这时伦敦是 4:00）", check: (s) => Math.abs(M.localAt(s.utc, 8).hour - 12) < 0.01 },
      { id: "date", text: "使纽约与北京不在同一天", check: (s) => M.localAt(s.utc, -5).off !== M.localAt(s.utc, 8).off },
      { id: "line", text: "使正午太阳线位于日界线（180° 经线）上", check: (s) => s.utc === 0 || s.utc === 24 }],
  };
}

export const DENS = [10000, 100000, 500000, 1000000, 5000000];
export function scale(D: M.GeoData): SimDef {
  return {
    ...base(D, "scale"), aspect: 0.5,
    params: [{ id: "cm", label: "图上距离", min: 0.5, max: 14, step: 0.5, value: 4, unit: "cm" }],
    choices: [{ id: "den", label: "比例尺", options: DENS.map((d, i) => [i, `1∶${d}`] as [number, string]), value: 1 }],
    pointer: (kind, x) => ({ cm: Math.max(0.5, Math.min(14, Math.round(((x - 50) / 40) * 2) / 2)) }),
    readouts: (s) => [{ label: "图上距离", value: fmt(s.cm, 1), unit: "cm" }, { label: "比例尺", value: `1∶${DENS[s.den]}` }, { label: "实地距离", value: fmt(M.realKm(s.cm, DENS[s.den]), 2), unit: "km" }, { label: "图上 1 厘米代表", value: fmt(M.realKm(1, DENS[s.den]), 2), unit: "km" }],
    draw(c, w, h, s: St) {
      rect(c, 0, 0, w, h, "#fff", null, 0, 0);
      rect(c, 30, 40, 580, 200, "#fff9db", COL.ink, 3, 10);
      for (let i = 0; i <= 14; i++) { const x = 50 + i * 40; line(c, x, 40, x, i % 5 === 0 ? 70 : 58, COL.ink, 2); if (i % 2 === 0) txt(c, String(i), x, 84, 13, COL.grey); }
      line(c, 50, 40, 610, 40, COL.ink, 3);
      const ax = 50, bx = 50 + s.cm * 40, y = 170;
      line(c, ax, y, bx, y, COL.red, 4, [8, 6]); circle(c, ax, y, 9, COL.blue, COL.ink, 3); circle(c, bx, y, 9, COL.red, COL.ink, 3); txt(c, "A", ax, y - 22, 18, COL.blue); txt(c, "B", bx, y - 22, 18, COL.red);
      line(c, 60, 120, 140, 215, "#4dabf7", 5); poly(c, [[470, 200], [490, 160], [510, 200]], "#d9a066", COL.ink, 3); line(c, 350, 215, 560, 125, COL.grey, 4, [10, 5]);
      const k = 40; for (let i = 0; i < 4; i++) rect(c, 60 + i * k, 270, k, 12, i % 2 ? "#fff" : COL.ink, COL.ink, 2, 0);
      for (let i = 0; i <= 4; i++) txt(c, fmt(M.realKm(i, DENS[s.den]), 1), 60 + i * k, 300, 13, COL.ink);
      arrow(c, 560, 300, 560, 255, COL.ink, 4); txt(c, "N", 560, 240, 18, COL.ink);
    },
    tasks: [
      { id: "sixty", text: "把比例尺调到 1∶1000000，量得图上 6 厘米，读出实地距离", check: (s) => DENS[s.den] === 1000000 && s.cm === 6 },
      { id: "far", text: "使实地距离超过 500 千米", check: (s) => M.realKm(s.cm, DENS[s.den]) >= 500 },
      { id: "large", text: "选择最大的比例尺 1∶10000", check: (s) => DENS[s.den] === 10000 }],
  };
}

export const INTV = [50, 100, 200];
export const hillOf = (s: St): M.Hill => ({ x: s.hx, y: s.hy, h: s.h, s: s.s });
export function contourStats(s: St): { max: number; slope: number; n: number } {
  const hl = hillOf(s), n = 40; let max = 0, grad = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const z = M.heightAt(i / n, j / n, hl); max = Math.max(max, z); if (i < n && j < n) { const dx = M.heightAt((i + 1) / n, j / n, hl) - z, dy = M.heightAt(i / n, (j + 1) / n, hl) - z; grad = Math.max(grad, Math.hypot(dx, dy) * n); } }
  const iv = INTV[s.iv], levels: number[] = []; for (let L = iv; L <= max; L += iv) levels.push(L);
  return { max, slope: (grad / 20000) * 100, n: levels.length };
}
export function contour(D: M.GeoData): SimDef {
  const MAP = { x: 20, y: 20, s: 280 };
  return {
    ...base(D, "contour"), aspect: 0.55, drag: true,
    params: [{ id: "h", label: "山峰高度", min: 0, max: 900, step: 50, value: 400, unit: "m" }, { id: "s", label: "山体宽度", min: 0.06, max: 0.25, step: 0.01, value: 0.12 },
      { id: "hx", label: "山峰位置（东西）", min: 0.1, max: 0.9, step: 0.02, value: 0.3 }, { id: "hy", label: "山峰位置（南北）", min: 0.1, max: 0.9, step: 0.02, value: 0.35 }, { id: "ys", label: "剖面线位置", min: 0.1, max: 0.9, step: 0.02, value: 0.6 }],
    choices: [{ id: "iv", label: "等高距", options: INTV.map((v, i) => [i, `${v} m`] as [number, string]), value: 1 }],
    pointer: (kind, x, y) => { if (x < MAP.x || x > MAP.x + MAP.s || y < MAP.y || y > MAP.y + MAP.s) return; return { hx: Math.round(Math.max(0.1, Math.min(0.9, (x - MAP.x) / MAP.s)) * 50) / 50, hy: Math.round(Math.max(0.1, Math.min(0.9, (y - MAP.y) / MAP.s)) * 50) / 50 }; },
    readouts: (s) => { const q = contourStats(s); return [{ label: "最高点海拔", value: fmt(q.max, 0), unit: "m" }, { label: "等高线条数", value: String(q.n) }, { label: "最大坡度", value: fmt(q.slope, 1), unit: "%" }]; },
    draw(c, w, h, s: St) {
      rect(c, 0, 0, w, h, "#fff", null, 0, 0);
      const hl = hillOf(s), n = 28, cs = MAP.s / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const z = M.heightAt((i + 0.5) / n, (j + 0.5) / n, hl); const t = Math.min(1, z / 700); c.fillStyle = `hsl(${110 - t * 85},55%,${78 - t * 28}%)`; c.fillRect(MAP.x + i * cs, MAP.y + j * cs, cs + 0.6, cs + 0.6); }
      const iv = INTV[s.iv], levels: number[] = []; for (let L = iv; L <= 1200; L += iv) levels.push(L);
      const segs = M.contours((x, y) => M.heightAt(x, y, hl), levels, 56);
      for (const sg of segs) line(c, MAP.x + sg.x1 * MAP.s, MAP.y + sg.y1 * MAP.s, MAP.x + sg.x2 * MAP.s, MAP.y + sg.y2 * MAP.s, sg.level % (iv * 2) === 0 ? "#8a4b08" : "#b5651d", sg.level % (iv * 2) === 0 ? 2.5 : 1.5);
      for (const L of levels) { if (L % (iv * 2) !== 0) continue; const sg = segs.find((q) => q.level === L && q.y1 > 0.5 && q.x1 > 0.12 && q.x1 < 0.88); if (sg) txt(c, String(L), MAP.x + sg.x1 * MAP.s, MAP.y + sg.y1 * MAP.s, 11, "#5c3a00"); }
      rect(c, MAP.x, MAP.y, MAP.s, MAP.s, "", COL.ink, 3, 0);
      pin(c, MAP.x + hl.x * MAP.s, MAP.y + hl.y * MAP.s, COL.red);
      const yy = MAP.y + s.ys * MAP.s; line(c, MAP.x, yy, MAP.x + MAP.s, yy, COL.purple, 3, [8, 6]); txt(c, "A", MAP.x - 10, yy, 14, COL.purple); txt(c, "B", MAP.x + MAP.s + 10, yy, 14, COL.purple);
      const px = 340, pw = 280, py = 300, ph = 230, zmax = 900;
      line(c, px, py, px + pw, py, COL.ink, 3); line(c, px, py, px, py - ph, COL.ink, 3);
      const pts: [number, number][] = []; for (let i = 0; i <= 80; i++) pts.push([px + (i / 80) * pw, py - (M.heightAt(i / 80, s.ys, hl) / zmax) * ph]);
      poly(c, [[px, py], ...pts, [px + pw, py]], "#d9a066", COL.ink, 3);
      for (const L of levels.filter((q) => q <= zmax)) line(c, px - 4, py - (L / zmax) * ph, px + 4, py - (L / zmax) * ph, COL.ink, 2);
      txt(c, "A", px, py + 16, 14, COL.purple); txt(c, "B", px + pw, py + 16, 14, COL.purple); txt(c, "m", px - 14, py - ph - 8, 13, COL.grey);
    },
    tasks: [
      { id: "high", text: "使山顶海拔高于 600 米", check: (s) => contourStats(s).max > 600 },
      { id: "steep", text: "使山坡变陡：最大坡度超过 20%", check: (s) => contourStats(s).slope > 20 },
      { id: "section", text: "把剖面线拉到经过山顶", check: (s) => Math.abs(s.ys - s.hy) <= 0.03 },
      { id: "interval", text: "把等高距改为 200 米，看等高线变少", check: (s) => s.iv === 2 }],
  };
}
