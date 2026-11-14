/**
 * The Earth - Moon - Sun lab: five small models drawn on canvases. 月相 (move the Moon round the Earth: the phase from space and from the Earth, names and lunar days),
 * 日食和月食 (alignment sliders, umbra / penumbra, why not every month), 昼夜与四季 (the Earth's tilt, a date slider, day length, noon height, why seasons),
 * 潮汐 (spring and neap tides), 地球自转公转 (a day and a year). The rules are in spacemodel.ts.
 */
import { h } from "./ui";
import { tr } from "./i18n";
import { fit, Loop, reducedMotion, fmt, user, sig, chips } from "./spaceui";
import { sprite, drawPhase } from "./spaceart";
import * as SM from "./spacemodel";
import { todayLocal } from "./model";

const slider = (id: string, label: string, min: number, max: number, step: number, value: number, on: (v: number) => void): { row: HTMLElement; input: HTMLInputElement } => {
  const input = h("input", { type: "range", min: String(min), max: String(max), step: String(step), value: String(value), id, "aria-label": tr(label) }) as HTMLInputElement;
  input.addEventListener("input", () => on(+input.value));
  return { row: h("label", { class: "sp-slider" }, h("span", {}, label), input), input };
};
const canvasBox = (id: string, cls = ""): HTMLCanvasElement => h("canvas", { class: "sp-lab-cv " + cls, id, role: "img", "aria-label": tr("示意图") });
const sunGlow = (c: CanvasRenderingContext2D, x: number, y: number, r: number) => { const g = c.createRadialGradient(x, y, 0, x, y, r * 2.4); g.addColorStop(0, "rgba(255,225,110,1)"); g.addColorStop(0.4, "rgba(255,170,40,.55)"); g.addColorStop(1, "rgba(255,120,0,0)"); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 2.4, 0, 7); c.fill(); c.fillStyle = "#ffd43b"; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
const night = (c: CanvasRenderingContext2D, w: number, hh: number) => { const g = c.createLinearGradient(0, 0, w, hh); g.addColorStop(0, "#14173f"); g.addColorStop(1, "#0b0d26"); c.fillStyle = g; c.fillRect(0, 0, w, hh); for (let i = 0; i < 40; i++) { const k = (i * 7919) % 1000; c.fillStyle = `rgba(255,255,255,${0.15 + (k % 5) * 0.08})`; c.fillRect(((k * 37) % 1000) / 1000 * w, ((k * 91) % 1000) / 1000 * hh, 1.2, 1.2); } };
const arrow = (c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col = "rgba(255,230,120,.8)") => { c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); const a = Math.atan2(y1 - y0, x1 - x0); c.beginPath(); c.moveTo(x1, y1); c.lineTo(x1 - 7 * Math.cos(a - 0.4), y1 - 7 * Math.sin(a - 0.4)); c.lineTo(x1 - 7 * Math.cos(a + 0.4), y1 - 7 * Math.sin(a + 0.4)); c.fill(); };
const text = (c: CanvasRenderingContext2D, s: string, x: number, y: number, col = "#dbe4ff", size = 12, align: CanvasTextAlign = "center") => { c.fillStyle = col; c.font = `600 ${size}px system-ui, sans-serif`; c.textAlign = align; c.fillText(tr(s), x, y); };
const RAD = Math.PI / 180;

export interface Lab { id: string; title: string; mount(): HTMLElement }

// ---------- 1. phases ----------
function phaseLab(): HTMLElement {
  let E = Math.round(SM.elongationOfDay(SM.dayOfDate(todayLocal())));
  const space = canvasBox("sp-phase-space"), sky = canvasBox("sp-phase-sky");
  const out = h("div", { class: "sp-readout", id: "sp-phase-out" });
  const sl = slider("sp-phase-slider", "月球在轨道上的位置", 0, 359, 1, E, (v) => { E = v; draw(); });
  const draw = () => {
    {
      const { c, w, h: hh } = fit(space); night(c, w, hh);
      const cx = w * 0.56, cy = hh / 2, R = Math.min(w * 0.34, hh * 0.36), er = Math.min(R * 0.36, 22);
      sunGlow(c, 0, cy, Math.min(hh * 0.16, 34));
      for (const k of [-0.3, 0, 0.3]) arrow(c, w * 0.17, cy + k * hh * 0.55, w * 0.3, cy + k * hh * 0.55);
      text(c, "太阳光", w * 0.24, cy - hh * 0.2, "#ffe8a3", 11);
      c.strokeStyle = "rgba(180,190,255,.45)"; c.setLineDash([4, 4]); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke(); c.setLineDash([]);
      // the Earth: the half towards the Sun is bright
      c.save(); c.beginPath(); c.arc(cx, cy, er, 0, 7); c.clip(); c.drawImage(sprite("earth", 64, false, false), cx - er, cy - er, er * 2, er * 2); c.fillStyle = "rgba(8,10,30,.72)"; c.fillRect(cx, cy - er, er, er * 2); c.restore();
      const th = (180 + E) * RAD, mr = Math.min(11, er * 0.5), mx = cx + R * Math.cos(th), my = cy - R * Math.sin(th);
      c.strokeStyle = "rgba(255,255,255,.28)"; c.beginPath(); c.moveTo(cx, cy); c.lineTo(mx, my); c.stroke();
      c.save(); c.beginPath(); c.arc(mx, my, mr, 0, 7); c.clip(); c.drawImage(sprite("moon", 48, false, false), mx - mr, my - mr, mr * 2, mr * 2); c.fillStyle = "rgba(8,10,30,.78)"; c.fillRect(mx, my - mr, mr, mr * 2); c.restore();
      c.strokeStyle = "#ffe066"; c.lineWidth = 1.5; c.beginPath(); c.arc(mx, my, mr + 3, 0, 7); c.stroke();
      text(c, "地球", cx, cy + er + 14, "#a5d8ff", 11); text(c, "从太空看（北极上方）", w / 2, 16, "#dbe4ff", 12);
    }
    {
      const { c, w, h: hh } = fit(sky); night(c, w, hh);
      const r = Math.min(w, hh) * 0.36; drawPhase(c, w / 2, hh / 2 + 6, r, E);
      text(c, "从地球看", w / 2, 16, "#dbe4ff", 12);
    }
    const age = SM.moonAge(E), ph = SM.phaseName(E), day = SM.lunarDayOf(E);
    out.replaceChildren(
      h("div", { class: "sp-big", id: "sp-phase-name" }, tr(ph)),
      h("div", {}, ...fmt("农历{0}前后", [day])), h("div", {}, ...fmt("月龄 {0} 天", [sig(age, 3)])),
      h("div", {}, ...fmt("被照亮的部分：{0}%", [String(Math.round(SM.illumination(E) * 100))])),
      h("div", { class: "muted small", id: "sp-phase-wax" }, E === 0 ? "月球在地球和太阳之间，暗面朝向地球。" : E < 180 ? "月亮正在变圆（盈），亮的一侧在右边。" : E === 180 ? "地球在月球和太阳之间，整个朝向地球的一面都被照亮。" : "月亮正在变缺（亏），亮的一侧在左边。"));
    sl.input.value = String(E);
    out.dataset.e = String(E);
  };
  const jump = (id: string, label: string, e: number) => ({ id, label, on: false, click: () => { E = e; draw(); } });
  const jumps = chips([jump("sp-ph-0", "新月", 0), jump("sp-ph-90", "上弦月", 90), jump("sp-ph-180", "满月", 180), jump("sp-ph-270", "下弦月", 270)]);
  let play = false; const playBtn = h("button", { class: "mopt", id: "sp-phase-play", onclick: () => { play = !play; playBtn.classList.toggle("on", play); playBtn.textContent = tr(play ? "暂停" : "播放一个月"); if (play) loop.start(); } }, "播放一个月");
  const root = h("div", { class: "sp-lab", id: "sp-lab-phase" },
    h("p", { class: "muted" }, "月球绕地球一圈约 29.5 天（农历的一个月）。月球自己不发光，总有一半被太阳照亮；我们看到的月相，是这被照亮的一半有多少朝向地球。"),
    h("div", { class: "sp-cvrow" }, space, sky), sl.row, h("div", { class: "sp-lab-btns" }, jumps.el, playBtn), out);
  const loop = new Loop(root, (dt) => { if (!play) return; E = (E + dt * 36) % 360; draw(); });
  // the eight phases
  const row = h("div", { class: "sp-phases", id: "sp-phases" });
  SM.PHASES.forEach((name, i) => {
    const cv = h("canvas", { width: 128, height: 128, class: "sp-ph-cv" }); const c = cv.getContext("2d")!; c.fillStyle = "#0b0d26"; c.fillRect(0, 0, 128, 128); drawPhase(c, 64, 64, 52, i * 45);
    row.append(h("button", { class: "sp-ph", "data-i": String(i), onclick: () => { E = i * 45; draw(); } }, cv, h("b", {}, name), h("small", {}, ...fmt("农历{0}", [SM.lunarDayOf(i * 45)]))));
  });
  root.append(h("h3", { class: "sp-h3" }, "八种月相"), row);
  queueMicrotask(() => requestAnimationFrame(() => { if (root.isConnected) draw(); }));
  new ResizeObserver(() => root.isConnected && draw()).observe(space);
  return root;
}

// ---------- 2. eclipses ----------
function eclipseLab(): HTMLElement {
  let mode: "solar" | "lunar" = "solar", off = 0.4, lat = 1.2;
  const sky = canvasBox("sp-ecl-sky"), side = canvasBox("sp-ecl-side");
  const out = h("div", { class: "sp-readout", id: "sp-ecl-out" });
  const so = slider("sp-ecl-off", "沿轨道的偏离（度）", -4, 4, 0.05, off, (v) => { off = v; draw(); });
  const sl = slider("sp-ecl-lat", "离开地球轨道面的高度（度）", -5.2, 5.2, 0.05, lat, (v) => { lat = v; draw(); });
  const draw = () => {
    const s = SM.separation(off, lat);
    const kind = mode === "solar" ? SM.solarKind(s) : SM.lunarKind(s);
    {
      const { c, w, h: hh } = fit(sky); c.fillStyle = mode === "solar" ? "#3b5ca8" : "#0b0d26"; c.fillRect(0, 0, w, hh);
      const ppd = Math.min(w / 6.4, hh / 5.2), cx = w / 2, cy = hh / 2;   // pixels per degree
      if (mode === "solar") {
        c.fillStyle = "#ffd43b"; c.beginPath(); c.arc(cx, cy, 0.265 * ppd, 0, 7); c.fill();
        c.fillStyle = "#2d2d3a"; c.beginPath(); c.arc(cx + off * ppd, cy - lat * ppd, 0.26 * ppd, 0, 7); c.fill();
        c.strokeStyle = "rgba(255,255,255,.4)"; c.setLineDash([4, 4]); c.beginPath(); c.arc(cx, cy, 1.5 * ppd, 0, 7); c.stroke(); c.beginPath(); c.arc(cx, cy, 0.9 * ppd, 0, 7); c.stroke(); c.setLineDash([]);
        text(c, "太阳和月球的位置（从地球看）", w / 2, 16, "#fff", 12);
      } else {
        const pg = c.createRadialGradient(cx, cy, 0.7 * ppd, cx, cy, 1.25 * ppd); pg.addColorStop(0, "rgba(120,120,150,.55)"); pg.addColorStop(1, "rgba(120,120,150,.12)"); c.fillStyle = pg; c.beginPath(); c.arc(cx, cy, 1.25 * ppd, 0, 7); c.fill();
        c.fillStyle = "rgba(50,40,60,.85)"; c.beginPath(); c.arc(cx, cy, 0.7 * ppd, 0, 7); c.fill();
        const mx = cx + off * ppd, my = cy - lat * ppd, mr = 0.26 * ppd, inU = s < 0.7 - 0.26;
        c.fillStyle = inU ? "#a4472f" : "#e9e4d2"; c.beginPath(); c.arc(mx, my, mr, 0, 7); c.fill();
        text(c, "地球的影子和月球的位置", w / 2, 16, "#dbe4ff", 12);
        text(c, "本影", cx, cy + 0.7 * ppd + 12, "#ced4da", 10); text(c, "半影", cx, cy + 1.25 * ppd + 12, "#adb5bd", 10);
      }
    }
    {
      const { c, w, h: hh } = fit(side); night(c, w, hh);
      const cy = hh / 2, sx = 22, ex = w * 0.62, mx = mode === "solar" ? w * 0.38 : w * 0.88, ey = cy, my = cy - lat * (hh * 0.06) * 1.0;
      sunGlow(c, sx, cy, 16);
      c.strokeStyle = "rgba(255,255,255,.2)"; c.setLineDash([3, 5]); c.beginPath(); c.moveTo(0, cy); c.lineTo(w, cy); c.stroke(); c.setLineDash([]);
      if (mode === "lunar") {
        c.fillStyle = "rgba(60,60,90,.45)"; c.beginPath(); c.moveTo(ex, cy - 14); c.lineTo(w, cy - 34); c.lineTo(w, cy + 34); c.lineTo(ex, cy + 14); c.fill();
        c.fillStyle = "rgba(20,20,40,.7)"; c.beginPath(); c.moveTo(ex, cy - 13); c.lineTo(w * 0.8, cy); c.lineTo(ex, cy + 13); c.fill();
      } else {
        c.fillStyle = "rgba(60,60,90,.4)"; c.beginPath(); c.moveTo(mx, my - 6); c.lineTo(ex, my - 30); c.lineTo(ex, my + 30); c.lineTo(mx, my + 6); c.fill();
        c.fillStyle = "rgba(20,20,40,.7)"; c.beginPath(); c.moveTo(mx, my - 5); c.lineTo(ex, my); c.lineTo(mx, my + 5); c.fill();
      }
      c.drawImage(sprite("earth", 64, false, true), ex - 15, ey - 15, 30, 30);
      c.drawImage(sprite("moon", 48, false, true), mx - 8, my - 8, 16, 16);
      text(c, "太阳", sx, hh - 10, "#ffe8a3", 11); text(c, "地球", ex, ey + 30, "#a5d8ff", 11); text(c, "月球", mx, my - 14, "#dee2e6", 11);
      text(c, "侧面示意图（高度已放大）", w / 2, 14, "#dbe4ff", 11);
    }
    const names = mode === "solar" ? { none: "没有日食", partial: "日偏食", central: "日全食或日环食" } : { none: "没有月食", penumbral: "半影月食", partial: "月偏食", total: "月全食" };
    const label = (names as unknown as Record<string, string>)[kind];
    out.replaceChildren(h("div", { class: "sp-big", id: "sp-ecl-result", "data-kind": kind }, label), h("div", {}, ...fmt("月球与{0}的夹角：{1}°", [tr(mode === "solar" ? "太阳" : "地球的影子中心"), sig(s, 3)])),
      h("p", { class: "muted small" }, mode === "solar" ? "日食只发生在新月（农历初一）；月球的影子很小，只扫过地球上的一条窄带。" : "月食只发生在满月（农历十五、十六）；整个夜晚半球的人都能看到。"));
    so.input.value = String(off); sl.input.value = String(lat);
  };
  const c1 = chips([{ id: "sp-ecl-solar", label: "日食", on: true, click: () => { mode = "solar"; c1.set("sp-ecl-solar"); draw(); } }, { id: "sp-ecl-lunar", label: "月食", on: false, click: () => { mode = "lunar"; c1.set("sp-ecl-lunar"); draw(); } }]);
  const root = h("div", { class: "sp-lab", id: "sp-lab-eclipse" },
    h("p", { class: "muted" }, "每个月都有一次新月和一次满月，为什么不是每个月都有日食和月食？因为月球的轨道和地球绕太阳的轨道平面相差约 5°，大多数时候月球从太阳（或地球的影子）的上方或下方经过。"),
    c1.el, h("div", { class: "sp-cvrow" }, sky, side), so.row, sl.row, out);
  queueMicrotask(() => requestAnimationFrame(() => { if (root.isConnected) draw(); }));
  new ResizeObserver(() => root.isConnected && draw()).observe(sky);
  return root;
}

// ---------- 3. day, night and seasons ----------
const monthDay = (n: number): string => { const d = new Date(Date.UTC(2023, 0, n)); return `${d.getUTCMonth() + 1}-${String(d.getUTCDate()).padStart(2, "0")}`; };
const seasonOf = (n: number): string => (n >= 79 && n < 172 ? "春季" : n >= 172 && n < 266 ? "夏季" : n >= 266 && n < 356 ? "秋季" : "冬季");
const SOUTH: Record<string, string> = { 春季: "秋季", 夏季: "冬季", 秋季: "春季", 冬季: "夏季" };
function seasonLab(): HTMLElement {
  let n = SM.dayOfYear(todayLocal());
  const earth = canvasBox("sp-season-earth"), orbit = canvasBox("sp-season-orbit");
  const out = h("div", { class: "sp-readout", id: "sp-season-out" });
  const sl = slider("sp-season-day", "日期（一年中的第几天）", 1, 365, 1, n, (v) => { n = v; draw(); });
  const draw = () => {
    const dec = SM.declination(n);
    {
      const { c, w, h: hh } = fit(earth); night(c, w, hh);
      const cx = w * 0.58, cy = hh / 2, R = Math.min(w * 0.3, hh * 0.34);
      sunGlow(c, 0, cy, Math.min(hh * 0.16, 30));
      for (const k of [-0.28, 0, 0.28]) arrow(c, w * 0.12, cy + k * hh, w * 0.3, cy + k * hh);
      c.save(); c.translate(cx, cy); c.rotate(-dec * RAD);   // the axis leans towards the Sun when the declination is positive
      const sp = sprite("earth", 160, false, false);
      c.save(); c.beginPath(); c.arc(0, 0, R, 0, 7); c.clip(); c.drawImage(sp, -R, -R, R * 2, R * 2); c.restore();
      c.strokeStyle = "rgba(255,255,255,.8)"; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -R * 1.35); c.lineTo(0, R * 1.35); c.stroke();
      c.strokeStyle = "rgba(255,255,255,.5)"; c.lineWidth = 1;
      for (const la of [0, 23.44, -23.44, 66.56, -66.56]) { const y = -R * Math.sin(la * RAD), hw = R * Math.cos(la * RAD); c.setLineDash(la === 0 ? [] : [3, 3]); c.beginPath(); c.moveTo(-hw, y); c.lineTo(hw, y); c.stroke(); }
      c.setLineDash([]);
      c.fillStyle = "#ff6b6b"; c.beginPath(); c.arc(0, -R * 1.35, 4, 0, 7); c.fill();
      c.restore();
      // night side + the point where the Sun is overhead
      c.save(); c.beginPath(); c.arc(cx, cy, R, 0, 7); c.clip(); c.fillStyle = "rgba(6,8,28,.72)"; c.fillRect(cx, cy - R, R, R * 2); c.restore();
      const oy = cy - R * Math.sin(dec * RAD); c.fillStyle = "#fff3a0"; c.strokeStyle = "#f08c00"; c.lineWidth = 2; c.beginPath(); c.arc(cx - R * Math.cos(dec * RAD), oy, 4.5, 0, 7); c.fill(); c.stroke();
      text(c, "太阳直射点", cx - R * Math.cos(dec * RAD) + 6, oy - 10, "#ffe8a3", 11, "left");
      text(c, "北极", cx - Math.sin(dec * RAD) * R * 1.35 + 16, cy - R * 1.35 * Math.cos(dec * RAD) + 4, "#ffa8a8", 11, "left");
      text(c, "地轴倾斜 23.4°，方向不变", w / 2, 16, "#dbe4ff", 12);
    }
    {
      const { c, w, h: hh } = fit(orbit); night(c, w, hh);
      const cx = w / 2, cy = hh / 2, rx = w * 0.36, ry = hh * 0.3;
      sunGlow(c, cx, cy, 14);
      c.strokeStyle = "rgba(180,190,255,.45)"; c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, 0, 7); c.stroke();
      const posAt = (day: number): [number, number] => { const a = ((day - 172) / 365.24) * 2 * Math.PI; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a) * -1]; };
      for (const [name, d] of SM.SEASON_DAYS) {
        const [x, y] = posAt(d); c.drawImage(sprite("earth", 48, false, true), x - 9, y - 9, 18, 18);
        c.strokeStyle = "#ff6b6b"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 5 * Math.sin(23.44 * RAD) * 2.2, y - 14 * Math.cos(23.44 * RAD)); c.lineTo(x + 5 * Math.sin(23.44 * RAD) * 2.2, y + 14 * Math.cos(23.44 * RAD)); c.stroke();
        text(c, name, x, y + (y > cy ? 28 : -20), "#dbe4ff", 11);
      }
      const [x, y] = posAt(n); c.strokeStyle = "#ffe066"; c.lineWidth = 2.5; c.beginPath(); c.arc(x, y, 12, 0, 7); c.stroke();
      text(c, "地球公转（从北极上方看）", w / 2, 14, "#dbe4ff", 11);
    }
    const lat = (name: string, l: number, southern: boolean) => h("div", { class: "sp-city", "data-city": name },
      h("b", {}, tr(name)), h("span", {}, ...fmt("正午太阳高度 {0}°", [sig(SM.noonElevation(l, dec), 3)])), h("span", {}, ...fmt("白昼 {0} 小时", [sig(SM.dayLength(l, dec), 3)])), h("span", {}, tr(southern ? SOUTH[seasonOf(n)] : seasonOf(n))));
    out.replaceChildren(
      h("div", { class: "sp-big", id: "sp-season-date" }, `${monthDay(n)}`, " ", h("small", {}, tr(seasonOf(n)), ` (${tr("北半球")})`)),
      h("div", { id: "sp-season-dec" }, ...fmt("太阳直射纬度：{0}°", [sig(dec, 3)])),
      h("div", { id: "sp-season-dist" }, ...fmt("日地距离：{0} 百万千米", [sig(SM.earthDistance(n) * 149.598, 4)])),
      h("div", { class: "sp-cities" }, lat("北京", 39.9, false), lat("悉尼", -33.9, true)),
      h("p", { class: "muted small" }, "四季的原因是地轴倾斜，不是离太阳的远近：1 月初地球离太阳最近，北半球却是冬天。"));
    sl.input.value = String(n);
  };
  const jump = SM.SEASON_DAYS.map(([name, d]) => ({ id: `sp-sd-${d}`, label: name, on: false, click: () => { n = d; draw(); } }));
  const jc = chips(jump);
  const root = h("div", { class: "sp-lab", id: "sp-lab-season" },
    h("p", { class: "muted" }, "地球一边自转，一边绕太阳公转，地轴始终指向同一个方向（北极星附近）。太阳光直射的位置因此在南北回归线之间来回移动。"),
    h("div", { class: "sp-cvrow" }, earth, orbit), sl.row, jc.el, out);
  queueMicrotask(() => requestAnimationFrame(() => { if (root.isConnected) draw(); }));
  new ResizeObserver(() => root.isConnected && draw()).observe(earth);
  return root;
}

// ---------- 4. tides ----------
function tideLab(): HTMLElement {
  let E = 0;
  const top = canvasBox("sp-tide-top"), chart = canvasBox("sp-tide-chart");
  const out = h("div", { class: "sp-readout", id: "sp-tide-out" });
  const sl = slider("sp-tide-phase", "月球在轨道上的位置", 0, 359, 1, E, (v) => { E = v; draw(); });
  const draw = () => {
    const f = SM.tideFactor(E);
    {
      const { c, w, h: hh } = fit(top); night(c, w, hh);
      const cx = w * 0.56, cy = hh / 2, R = Math.min(w * 0.2, hh * 0.24), orbitR = Math.min(w * 0.34, hh * 0.44);
      sunGlow(c, 0, cy, Math.min(hh * 0.15, 30)); for (const k of [-0.25, 0.25]) arrow(c, w * 0.15, cy + k * hh, w * 0.28, cy + k * hh);
      const th = (180 + E) * RAD;
      c.strokeStyle = "rgba(180,190,255,.35)"; c.setLineDash([4, 4]); c.beginPath(); c.arc(cx, cy, orbitR, 0, 7); c.stroke(); c.setLineDash([]);
      // the ocean: a shell that bulges towards the Moon and away from it
      const amp = 0.1 * f;
      c.fillStyle = "#4dabf7"; c.beginPath();
      for (let i = 0; i <= 90; i++) { const a = (i / 90) * 2 * Math.PI, r = R * (1.12 + amp * Math.cos(2 * (a - th))); const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.fill();
      c.drawImage(sprite("earth", 96, false, false), cx - R, cy - R, R * 2, R * 2);
      const mx = cx + orbitR * Math.cos(th), my = cy - orbitR * Math.sin(th), mr = 9;
      c.drawImage(sprite("moon", 48, false, true), mx - mr, my - mr, mr * 2, mr * 2);
      text(c, "高潮", cx + (R * 1.5) * Math.cos(th), cy - R * 1.5 * Math.sin(th) + 4, "#a5d8ff", 11);
      text(c, "高潮", cx - (R * 1.5) * Math.cos(th), cy + R * 1.5 * Math.sin(th) + 4, "#a5d8ff", 11);
      text(c, "海水的隆起（已放大）", w / 2, 16, "#dbe4ff", 12);
    }
    {
      const { c, w, h: hh } = fit(chart); c.fillStyle = "#f8f9ff"; c.fillRect(0, 0, w, hh);
      const l = 28, r = w - 8, t = 22, b = hh - 22, mid = (t + b) / 2;
      c.strokeStyle = "#ced4da"; c.lineWidth = 1; c.beginPath(); c.moveTo(l, mid); c.lineTo(r, mid); c.stroke();
      c.strokeStyle = "#1c7ed6"; c.lineWidth = 2.5; c.beginPath();
      for (let i = 0; i <= 96; i++) { const hr = (i / 96) * 48, y = mid - (SM.tideHeight(E, hr) / 1.5) * ((b - t) / 2), x = l + (hr / 48) * (r - l); i ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke();
      text(c, "两天内的潮汐（小时）", w / 2, 13, "#495057", 11);
      for (const hr of [0, 12, 24, 36, 48]) text(c, String(hr), l + (hr / 48) * (r - l), b + 15, "#868e96", 10);
    }
    out.replaceChildren(h("div", { class: "sp-big", id: "sp-tide-name" }, tr(SM.tideName(E))), h("div", {}, ...fmt("潮汐强度：{0} ×", [sig(f, 3)])), h("div", {}, ...fmt("月相：{0}", [tr(SM.phaseName(E))])),
      h("p", { class: "muted small" }, "月球和太阳的引力把海水拉起来，每天约涨落两次，间隔约 12 小时 25 分。新月和满月时太阳、地球、月球在一条直线上，潮最大（大潮，农历初一、十五前后）；上弦和下弦时最小（小潮）。"));
    sl.input.value = String(E);
  };
  const jc = chips([0, 90, 180, 270].map((e) => ({ id: `sp-td-${e}`, label: SM.PHASES[e / 45], on: false, click: () => { E = e; draw(); } })));
  const root = h("div", { class: "sp-lab", id: "sp-lab-tide" }, h("p", { class: "muted" }, "海水为什么会涨落？移动月球，看看潮的大小怎样变化。"), h("div", { class: "sp-cvrow" }, top, chart), sl.row, jc.el, out);
  queueMicrotask(() => requestAnimationFrame(() => { if (root.isConnected) draw(); }));
  new ResizeObserver(() => root.isConnected && draw()).observe(top);
  return root;
}

// ---------- 5. rotation and revolution ----------
const SPIN_PER_DAY = 366.256 / 365.256;
function dayYearLab(): HTMLElement {
  let day = 0, speed = 10;
  const cv = canvasBox("sp-dy-cv", "sp-dy");
  const out = h("div", { class: "sp-readout", id: "sp-dy-out" });
  const sl = slider("sp-dy-day", "已过的天数", 0, 730, 1, day, (v) => { day = v; draw(); });
  const draw = () => {
    const { c, w, h: hh } = fit(cv); night(c, w, hh);
    const cx = w / 2, cy = hh / 2, R = Math.min(w, hh) * 0.36;
    sunGlow(c, cx, cy, Math.min(R * 0.2, 24));
    c.strokeStyle = "rgba(180,190,255,.4)"; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
    const a = (day / 365.256) * 2 * Math.PI, ex = cx + R * Math.cos(-a - Math.PI / 2), ey = cy + R * Math.sin(-a - Math.PI / 2), er = Math.min(R * 0.2, 20);
    c.save(); c.translate(ex, ey);
    c.save(); c.beginPath(); c.arc(0, 0, er, 0, 7); c.clip(); c.drawImage(sprite("earth", 96, false, false), -er, -er, er * 2, er * 2);
    const sunAng = Math.atan2(cy - ey, cx - ex);   // the Sun's direction: the half that faces it is bright
    c.rotate(sunAng + Math.PI); c.fillStyle = "rgba(6,8,28,.74)"; c.fillRect(0, -er, er, er * 2); c.restore();
    const spin = day * SPIN_PER_DAY * 2 * Math.PI, mx = Math.cos(spin) * er * 0.7, my = -Math.sin(spin) * er * 0.7;   // a flag on the surface
    c.fillStyle = "#ff6b6b"; c.beginPath(); c.arc(mx, my, 3.2, 0, 7); c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 1; c.stroke();
    c.restore();
    text(c, "地球公转（从北极上方看）", w / 2, 15, "#dbe4ff", 12);
    out.replaceChildren(h("div", { class: "sp-big", id: "sp-dy-days" }, ...fmt("第 {0} 天", [String(Math.floor(day))])),
      h("div", {}, ...fmt("公转：{0}° （{1} 圈）", [sig((day / 365.256 * 360) % 360, 3), sig(day / 365.256, 3)])),
      h("div", { id: "sp-dy-spins" }, ...fmt("自转：{0} 圈", [sig(day * SPIN_PER_DAY, 4)])),
      h("p", { class: "muted small" }, "地球绕太阳转一圈约 365.24 天，这段时间里自转约 366.24 圈，比昼夜的次数多一圈。红点是地面上的一个标记。"));
    sl.input.value = String(Math.min(730, Math.floor(day)));
  };
  const sc = chips([{ id: "sp-dy-0", label: "暂停", on: false, click: () => { speed = 0; sc.set("sp-dy-0"); } }, { id: "sp-dy-1", label: "1 天 / 秒", on: false, click: () => { speed = 1; sc.set("sp-dy-1"); loop.start(); } }, { id: "sp-dy-10", label: "10 天 / 秒", on: true, click: () => { speed = 10; sc.set("sp-dy-10"); loop.start(); } }, { id: "sp-dy-30", label: "30 天 / 秒", on: false, click: () => { speed = 30; sc.set("sp-dy-30"); loop.start(); } }]);
  const root = h("div", { class: "sp-lab", id: "sp-lab-dayyear" }, h("p", { class: "muted" }, "自转产生昼夜交替，公转产生一年。拖动日期，看地面上的标记转了多少圈。"), cv, sl.row, sc.el, out);
  const loop = new Loop(root, (dt) => { if (speed <= 0) return; day = (day + speed * dt) % 730; draw(); });
  queueMicrotask(() => requestAnimationFrame(() => { if (root.isConnected) { draw(); loop.start(); } }));
  new ResizeObserver(() => root.isConnected && draw()).observe(cv);
  void reducedMotion;
  return root;
}

export const LABS: Lab[] = [
  { id: "phase", title: "月相", mount: phaseLab },
  { id: "eclipse", title: "日食和月食", mount: eclipseLab },
  { id: "season", title: "昼夜与四季", mount: seasonLab },
  { id: "tide", title: "潮汐", mount: tideLab },
  { id: "dayyear", title: "自转和公转", mount: dayYearLab },
];
export const mountLabs = (): HTMLElement => {
  let cur = "phase";
  const body = h("div", { id: "sp-lab-body" });
  const show = (id: string) => { cur = id; body.replaceChildren(LABS.find((l) => l.id === id)!.mount()); tabs.set(`sp-labtab-${id}`); try { sessionStorage.setItem("learn.space.lab", id); } catch { /* ignore */ } };
  try { const s = sessionStorage.getItem("learn.space.lab"); if (s && LABS.some((l) => l.id === s)) cur = s; } catch { /* ignore */ }
  const tabs = chips(LABS.map((l) => ({ id: `sp-labtab-${l.id}`, label: l.title, on: l.id === cur, click: () => show(l.id) })));
  const root = h("div", { class: "sp-labs", id: "sp-labs" }, tabs.el, body);
  show(cur);
  void user;
  return root;
};
