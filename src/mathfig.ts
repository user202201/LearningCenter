/**
 * Figures of the math questions (rule 52): inline SVG strings made in code, no image files. Inside a drawing only digits and Latin letters are written (no
 * Chinese text: names go into the question text), so a figure never needs a translation. `mountFig` puts a figure on the screen after cleaning it (a figure kept in
 * the errors book comes from the data repository, so it is parsed as SVG and stripped of anything active before it is shown).
 */
export const INK = "#2d2230";
export const f = (n: number): string => String(Math.round(n * 100) / 100);
type Pt = [number, number];

export const svg = (w: number, h: number, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" aria-hidden="true" focusable="false" font-family="system-ui, sans-serif" font-weight="700">${body}</svg>`;
const T = (x: number, y: number, s: string | number, size = 12, fill = INK, extra = ""): string =>
  `<text x="${f(x)}" y="${f(y)}" font-size="${size}" text-anchor="middle" dominant-baseline="central" fill="${fill}"${extra}>${s}</text>`;
const L = (x1: number, y1: number, x2: number, y2: number, stroke = INK, w = 2, extra = ""): string =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"${extra}/>`;
const pts = (l: Pt[]): string => l.map(([x, y]) => `${f(x)},${f(y)}`).join(" ");
const rad = (deg: number) => (deg * Math.PI) / 180;

/** shows a figure (the markup is parsed as SVG and cleaned); `--ar` = width / height lets the stylesheet size it */
export function mountFig(box: HTMLElement, markup: string): void {
  box.replaceChildren();
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName !== "svg" || doc.querySelector("parsererror")) return;
  root.querySelectorAll("script, foreignObject, style, image, a, use, iframe").forEach((e) => e.remove());
  for (const el of [root, ...Array.from(root.querySelectorAll("*"))]) for (const a of Array.from(el.attributes)) if (/^on/i.test(a.name) || /href/i.test(a.name)) el.removeAttribute(a.name);
  const vb = (root.getAttribute("viewBox") ?? "0 0 100 100").split(/\s+/).map(Number);
  box.style.setProperty("--ar", String(Math.round((vb[2] / vb[3]) * 1000) / 1000));
  box.append(document.importNode(root, true));
}

// ------------------------------------------------------------------ clocks
/** the hands of a clock at h:m, drawn pointing up and then turned by `rotate(angle cx cy)` (the angles are what the tests read back) */
export const hourAngle = (h: number, m: number): number => (h % 12) * 30 + m * 0.5;
export const minuteAngle = (m: number): number => m * 6;
export function clockBody(h: number, m: number, cx: number, cy: number, r: number, minuteTicks = true): string {
  let hourT = "", minT = "", nums = "";
  for (let i = 0; i < 12; i++) {
    const a = rad(i * 30);
    hourT += `M${f(cx + r * 0.84 * Math.sin(a))} ${f(cy - r * 0.84 * Math.cos(a))}L${f(cx + r * 0.94 * Math.sin(a))} ${f(cy - r * 0.94 * Math.cos(a))}`;
    const n = i === 0 ? 12 : i, b = rad(i * 30);
    nums += T(cx + r * 0.67 * Math.sin(b), cy - r * 0.67 * Math.cos(b), n, r * 0.2);
  }
  if (minuteTicks) for (let i = 0; i < 60; i++) if (i % 5) { const a = rad(i * 6); minT += `M${f(cx + r * 0.9 * Math.sin(a))} ${f(cy - r * 0.9 * Math.cos(a))}L${f(cx + r * 0.94 * Math.sin(a))} ${f(cy - r * 0.94 * Math.cos(a))}`; }
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="#fff" stroke="${INK}" stroke-width="3"/>`
    + `<path d="${hourT}" stroke="${INK}" stroke-width="2.2" fill="none"/>` + (minT ? `<path d="${minT}" stroke="${INK}" stroke-width="1" fill="none"/>` : "") + nums
    + L(cx, cy, cx, cy - r * 0.45, INK, 4.5, ` class="hh" transform="rotate(${f(hourAngle(h, m))} ${f(cx)} ${f(cy)})"`)
    + L(cx, cy, cx, cy - r * 0.72, "#e03131", 3, ` class="mh" transform="rotate(${f(minuteAngle(m))} ${f(cx)} ${f(cy)})"`)
    + `<circle cx="${f(cx)}" cy="${f(cy)}" r="3" fill="${INK}"/>`;
}
export const clockFig = (h: number, m: number): string => svg(120, 120, clockBody(h, m, 60, 60, 54));
/** four clocks in a row, named A B C D */
export function clocksFig(times: [number, number][]): string {
  return svg(400, 128, times.map(([h, m], i) => `<g id="clock${"ABCD"[i]}">${clockBody(h, m, 50 + 100 * i, 50, 44, false)}${T(50 + 100 * i, 115, "ABCD"[i], 16, "#1c7ed6")}</g>`).join(""));
}

// ------------------------------------------------------------------ money
const RMB: Record<number, string> = { 1: "#f2c94c", 5: "#b197fc", 10: "#4dabf7", 20: "#d9a066", 50: "#69db7c", 100: "#ff8787" };
/** notes and coins (the value of each is in data-v); 1 is a coin, the rest are notes */
export function rmbFig(vals: number[]): string {
  const sorted = [...vals].sort((a, b) => b - a), per = 4;
  const rows = Math.ceil(sorted.length / per), w = Math.min(sorted.length, per) * 72 + 8, hh = rows * 44 + 8;
  let body = "";
  sorted.forEach((v, i) => {
    const x = 8 + (i % per) * 72, y = 8 + Math.floor(i / per) * 44;
    body += v === 1
      ? `<g class="rmb" data-v="1"><circle cx="${x + 32}" cy="${y + 18}" r="17" fill="${RMB[1]}" stroke="${INK}" stroke-width="2"/>${T(x + 32, y + 18, 1, 16)}</g>`
      : `<g class="rmb" data-v="${v}"><rect x="${x}" y="${y}" width="64" height="36" rx="5" fill="${RMB[v]}" stroke="${INK}" stroke-width="2"/>${T(x + 32, y + 18, v, 17)}${T(x + 9, y + 8, "¥", 8)}</g>`;
  });
  return svg(w, hh, body);
}

// ------------------------------------------------------------------ solids and flat shapes
export const FLAT = ["square", "rectangle", "triangle", "circle"] as const;
export const SOLID = ["cube", "cuboid", "cylinder", "sphere"] as const;
export function shapeFig(kind: string): string {
  const s = `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  let b = "";
  if (kind === "square") b = `<rect x="35" y="15" width="80" height="80" fill="#ffd43b" ${s}/>`;
  else if (kind === "rectangle") b = `<rect x="20" y="28" width="110" height="56" fill="#74c0fc" ${s}/>`;
  else if (kind === "triangle") b = `<polygon points="75,12 125,96 25,96" fill="#69db7c" ${s}/>`;
  else if (kind === "circle") b = `<circle cx="75" cy="55" r="44" fill="#ff8787" ${s}/>`;
  else if (kind === "cube") b = `<polygon points="30,45 55,22 115,22 90,45" fill="#ffe066" ${s}/><polygon points="30,45 90,45 90,105 30,105" fill="#fcc419" ${s}/><polygon points="90,45 115,22 115,82 90,105" fill="#f59f00" ${s}/>`;
  else if (kind === "cuboid") b = `<polygon points="14,52 42,26 140,26 112,52" fill="#a5d8ff" ${s}/><polygon points="14,52 112,52 112,100 14,100" fill="#74c0fc" ${s}/><polygon points="112,52 140,26 140,74 112,100" fill="#4dabf7" ${s}/>`;
  else if (kind === "cylinder") b = `<path d="M30 32V86A45 15 0 0 0 120 86V32" fill="#b2f2bb" ${s}/><ellipse cx="75" cy="32" rx="45" ry="15" fill="#8ce99a" ${s}/>`;
  else b = `<circle cx="75" cy="55" r="46" fill="#ffa94d" ${s}/><ellipse cx="58" cy="36" rx="10" ry="6" fill="#fff" opacity=".7" transform="rotate(-30 58 36)"/>`;
  return svg(150, 112, b);
}

/** flat shapes with straight sides (unit square 0..100); `axes` = how many axes of symmetry the shape has */
const reg = (n: number, r = 44, start = -90): Pt[] => Array.from({ length: n }, (_, i) => [50 + r * Math.cos(rad(start + (360 * i) / n)), 50 + r * Math.sin(rad(start + (360 * i) / n))] as Pt);
export const POLYS: Record<string, { pts: Pt[]; axes: number; sides: number }> = {
  equilateral: { pts: reg(3, 46), axes: 3, sides: 3 },
  isosceles: { pts: [[50, 10], [15, 90], [85, 90]], axes: 1, sides: 3 },
  scalene: { pts: [[20, 85], [90, 85], [35, 15]], axes: 0, sides: 3 },
  square: { pts: [[20, 20], [80, 20], [80, 80], [20, 80]], axes: 4, sides: 4 },
  rect: { pts: [[10, 28], [90, 28], [90, 72], [10, 72]], axes: 2, sides: 4 },
  rhombus: { pts: [[50, 8], [88, 50], [50, 92], [12, 50]], axes: 2, sides: 4 },
  parallelogram: { pts: [[25, 25], [90, 25], [75, 75], [10, 75]], axes: 0, sides: 4 },
  isotrap: { pts: [[30, 25], [70, 25], [92, 75], [8, 75]], axes: 1, sides: 4 },
  righttrap: { pts: [[20, 25], [60, 25], [85, 75], [20, 75]], axes: 0, sides: 4 },
  kite: { pts: [[50, 8], [82, 38], [50, 92], [18, 38]], axes: 1, sides: 4 },
  pentagon: { pts: reg(5), axes: 5, sides: 5 },
  hexagon: { pts: reg(6, 44, 0), axes: 6, sides: 6 },
};
const COLORS = ["#ffd43b", "#74c0fc", "#69db7c", "#ff8787", "#da77f2", "#ffa94d"];
export const COLOR_COUNT = COLORS.length;
/** a polygon of POLYS turned by `rot` degrees round its centre (the polygon element keeps the real points: the tests read them) */
export function polyFig(key: string, color: number, rot: number): string {
  const p = POLYS[key].pts.map(([x, y]): Pt => { const a = rad(rot), dx = x - 50, dy = y - 50; return [50 + dx * Math.cos(a) - dy * Math.sin(a), 50 + dx * Math.sin(a) + dy * Math.cos(a)]; });
  return svg(120, 120, `<polygon points="${pts(p.map(([x, y]) => [x + 10, y + 10] as Pt))}" fill="${COLORS[color % COLORS.length]}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`);
}

/** shapes with a measured size: unit coordinates (y downward) scaled to fit; dimensions are written as plain numbers */
function planar(units: Pt[], W: number, H: number, extra: (P: (x: number, y: number) => Pt, s: number) => string, fill = "#ffe8a3"): string {
  const s = Math.min(150 / W, 92 / H), ox = 28, oy = 18;
  const P = (x: number, y: number): Pt => [ox + x * s, oy + y * s];
  return svg(ox * 2 + W * s, oy * 2 + H * s, `<polygon class="shape" data-s="${f(s)}" points="${pts(units.map(([x, y]) => P(x, y)))}" fill="${fill}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>` + extra(P, s));
}
const dimTxt = (x: number, y: number, v: number | string, role: string) => T(x, y, v, 14, "#c92a2a", ` class="dim" data-d="${role}"`);
/** a number beside the middle of the side p-q, on the outside of the shape */
function edgeLabel(P: (x: number, y: number) => Pt, p: Pt, q: Pt, c: Pt, v: number, role: string, off = 12): string {
  const [x1, y1] = P(...p), [x2, y2] = P(...q), [cx, cy] = P(...c);
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  let nx = -(y2 - y1), ny = x2 - x1; const len = Math.hypot(nx, ny) || 1; nx /= len; ny /= len;
  if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
  return dimTxt(mx + nx * off, my + ny * off, v, role);
}
const rightMark = (P: (x: number, y: number) => Pt, x: number, y: number, dx: number, dy: number, s: number): string => {
  const k = Math.min(0.9, 7 / s), a = P(x + dx * k, y), b = P(x + dx * k, y + dy * k), c = P(x, y + dy * k);
  return `<polyline points="${pts([a, b, c])}" fill="none" stroke="${INK}" stroke-width="1.5"/>`;
};
export function rectFig(l: number, w: number): string {
  const sq = l === w;
  return planar([[0, 0], [l, 0], [l, w], [0, w]], l, w, (P) => edgeLabel(P, [0, w], [l, w], [l / 2, w / 2], l, "l") + (sq ? "" : edgeLabel(P, [l, 0], [l, w], [l / 2, w / 2], w, "w")), "#a5d8ff");
}
/** a triangle from its three sides (base b along the bottom); the numbers are the three sides */
export function triSidesFig(a: number, b: number, c: number): string {
  const xA = (c * c - a * a + b * b) / (2 * b), H = Math.sqrt(Math.max(0.01, c * c - xA * xA));
  const U: Pt[] = [[0, H], [b, H], [xA, 0]], ctr: Pt = [(xA + b) / 3, (2 * H) / 3];
  return planar(U, Math.max(b, xA, 1), H, (P) => edgeLabel(P, U[0], U[1], ctr, b, "b") + edgeLabel(P, U[1], U[2], ctr, a, "a") + edgeLabel(P, U[2], U[0], ctr, c, "c"), "#b2f2bb");
}
export function paraFig(b: number, h: number, off: number): string {
  const U: Pt[] = [[off, 0], [off + b, 0], [b, h], [0, h]];
  return planar(U, off + b, h, (P, s) => `<line x1="${f(P(off, 0)[0])}" y1="${f(P(off, 0)[1])}" x2="${f(P(off, h)[0])}" y2="${f(P(off, h)[1])}" stroke="#c92a2a" stroke-width="2" stroke-dasharray="5 4"/>`
    + rightMark(P, off, h, 1, -1, s) + dimTxt((P(0, h)[0] + P(b, h)[0]) / 2, P(0, h)[1] + 12, b, "b") + dimTxt(P(off, h / 2)[0] + 11, P(off, h / 2)[1], h, "h"), "#ffd8a8");
}
export function triFig(b: number, h: number, xA: number): string {
  const U: Pt[] = [[xA, 0], [b, h], [0, h]];
  return planar(U, b, h, (P, s) => `<line x1="${f(P(xA, 0)[0])}" y1="${f(P(xA, 0)[1])}" x2="${f(P(xA, h)[0])}" y2="${f(P(xA, h)[1])}" stroke="#c92a2a" stroke-width="2" stroke-dasharray="5 4"/>`
    + rightMark(P, xA, h, 1, -1, s) + dimTxt((P(0, h)[0] + P(b, h)[0]) / 2, P(0, h)[1] + 12, b, "b") + dimTxt(P(xA, h / 2)[0] + 11, P(xA, h / 2)[1], h, "h"), "#d0bfff");
}
export function trapFig(a: number, B: number, h: number, off: number): string {
  const U: Pt[] = [[off, 0], [off + a, 0], [B, h], [0, h]];
  return planar(U, B, h, (P, s) => `<line x1="${f(P(off, 0)[0])}" y1="${f(P(off, 0)[1])}" x2="${f(P(off, h)[0])}" y2="${f(P(off, h)[1])}" stroke="#c92a2a" stroke-width="2" stroke-dasharray="5 4"/>`
    + rightMark(P, off, h, 1, -1, s) + dimTxt((P(off, 0)[0] + P(off + a, 0)[0]) / 2, P(0, 0)[1] - 12, a, "a") + dimTxt((P(0, h)[0] + P(B, h)[0]) / 2, P(0, h)[1] + 12, B, "b") + dimTxt(P(off, h / 2)[0] + 11, P(off, h / 2)[1], h, "h"), "#fcc2d7");
}
/** an L-shape: a W x H rectangle with a nw x nh piece cut from the top right corner */
export function lshapeFig(W: number, H: number, nw: number, nh: number): string {
  const U: Pt[] = [[0, 0], [W - nw, 0], [W - nw, nh], [W, nh], [W, H], [0, H]], ctr: Pt = [W / 2, H / 2];
  return planar(U, W, H, (P) => edgeLabel(P, U[4], U[5], ctr, W, "W") + edgeLabel(P, U[5], U[0], ctr, H, "H") + edgeLabel(P, U[2], U[3], ctr, nw, "nw", 10) + edgeLabel(P, U[1], U[2], ctr, nh, "nh", 10), "#c3fae8");
}
/** a cuboid (or cube: l = w = h) drawn in oblique view; the numbers are its length, width and height */
export function cuboidFig(l: number, w: number, h: number): string {
  const m = Math.max(l, w, h), fw = 30 + (60 * l) / m, fh = 22 + (50 * h) / m, dx = 14 + (26 * w) / m, dy = -(10 + (18 * w) / m);
  const x0 = 24, y0 = 24 - dy;
  const A: Pt = [x0, y0], B: Pt = [x0 + fw, y0], C: Pt = [x0 + fw, y0 + fh], D: Pt = [x0, y0 + fh];
  const A2: Pt = [A[0] + dx, A[1] + dy], B2: Pt = [B[0] + dx, B[1] + dy], C2: Pt = [C[0] + dx, C[1] + dy];
  const st = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  return svg(x0 + fw + dx + 30, y0 + fh + 34,
    `<polygon points="${pts([A, A2, B2, B])}" fill="#ffe066" ${st}/><polygon points="${pts([A, B, C, D])}" fill="#a5d8ff" ${st}/><polygon points="${pts([B, B2, C2, C])}" fill="#74c0fc" ${st}/>`
    + dimTxt(x0 + fw / 2, y0 + fh + 13, l, "l") + dimTxt(x0 - 12, y0 + fh / 2, h, "h") + dimTxt(B[0] + dx / 2 + 12, B[1] + dy / 2 - 6, w, "w"));
}
/** a cylinder (or a cone) with its radius and height written */
export function cylFig(r: number, h: number, cone: boolean): string {
  const st = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`, rx = 44, ry = 14, cx = 80, top = 26, bottom = 112;
  const body = cone
    ? `<path d="M${cx - rx} ${bottom}L${cx} ${top - 6}L${cx + rx} ${bottom}A${rx} ${ry} 0 0 1 ${cx - rx} ${bottom}Z" fill="#ffc9c9" ${st}/>`
    : `<path d="M${cx - rx} ${top}V${bottom}A${rx} ${ry} 0 0 0 ${cx + rx} ${bottom}V${top}" fill="#b2f2bb" ${st}/><ellipse cx="${cx}" cy="${top}" rx="${rx}" ry="${ry}" fill="#8ce99a" ${st}/>`;
  const cy = cone ? bottom : top;
  return svg(190, 146, body + L(cx, cy, cx + rx, cy, "#c92a2a", 2, ' stroke-dasharray="4 3"') + dimTxt(cx + rx / 2, cy - 11, r, "r")
    + L(cx + rx + 16, (cone ? top - 6 : top), cx + rx + 16, bottom, "#c92a2a", 2, ' stroke-dasharray="4 3"') + dimTxt(cx + rx + 28, (top + bottom) / 2, h, "h"));
}
/** a circle with its radius or its diameter written */
export function circFig(v: number, kind: "r" | "d"): string {
  const R = 46, cx = 70, cy = 58;
  const line = kind === "r" ? L(cx, cy, cx + R, cy, "#c92a2a", 2.5, ' class="seg" data-kind="r"') : L(cx - R, cy, cx + R, cy, "#c92a2a", 2.5, ' class="seg" data-kind="d"');
  return svg(140, 116, `<circle cx="${cx}" cy="${cy}" r="${R}" fill="#d0ebff" stroke="${INK}" stroke-width="3"/>${line}<circle cx="${cx}" cy="${cy}" r="3" fill="${INK}"/>` + dimTxt(kind === "r" ? cx + R / 2 : cx, cy - 11, v, kind));
}

// ------------------------------------------------------------------ fractions, charts, patterns
/** n equal parts, the first k shaded (bar or pie); every part is marked data-on */
export function fracFig(n: number, k: number, pie: boolean): string {
  let body = "";
  const st = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  for (let i = 0; i < n; i++) {
    const on = i < k, fill = on ? "#ffa94d" : "#fff";
    if (pie) {
      const a1 = rad(-90 + (360 * i) / n), a2 = rad(-90 + (360 * (i + 1)) / n), cx = 60, cy = 60, R = 52;
      body += `<path class="part" data-on="${on ? 1 : 0}" d="M${cx} ${cy}L${f(cx + R * Math.cos(a1))} ${f(cy + R * Math.sin(a1))}A${R} ${R} 0 0 1 ${f(cx + R * Math.cos(a2))} ${f(cy + R * Math.sin(a2))}Z" fill="${fill}" ${st}/>`;
    } else body += `<rect class="part" data-on="${on ? 1 : 0}" x="${f(10 + (i * 220) / n)}" y="14" width="${f(220 / n)}" height="40" fill="${fill}" ${st}/>`;
  }
  return pie ? svg(120, 120, body) : svg(240, 68, body);
}
const BAR_COLORS = ["#ff8787", "#74c0fc", "#69db7c", "#ffd43b", "#da77f2", "#ffa94d"];
/** a bar chart: bars named A, B, C ..., the scale on the left; every bar has its value in data-v and its real height (value x data-u) */
export function barFig(vals: number[], step: number): string {
  const n = vals.length, ymax = Math.max(Math.ceil(Math.max(...vals) / step) * step, step * 2), plotH = 100, base = 122, x0 = 34, W = 230, u = plotH / ymax, slot = W / n;
  let g = "";
  for (let v = 0; v <= ymax; v += step) g += L(x0, base - v * u, x0 + W, base - v * u, "#ced4da", 1) + T(x0 - 9, base - v * u, v, 9, "#495057");
  const bars = vals.map((v, i) => `<rect class="b" data-k="${"ABCDEFGH"[i]}" data-v="${v}" x="${f(x0 + i * slot + slot * 0.2)}" y="${f(base - v * u)}" width="${f(slot * 0.6)}" height="${f(v * u)}" fill="${BAR_COLORS[i % 6]}" stroke="${INK}" stroke-width="1.5"/>${T(x0 + i * slot + slot / 2, base + 12, "ABCDEFGH"[i], 12)}`).join("");
  return svg(x0 + W + 10, base + 26, `<g id="plot" data-u="${f(u)}" data-base="${base}">${g}${L(x0, base, x0 + W, base, INK, 2)}${L(x0, base - ymax * u, x0, base, INK, 2)}${bars}</g>`);
}
export const PAT_SYMBOLS = ["○", "△", "□", "☆"];
/** a row of shapes that follows a rule, then a "?" box (type 0 circle, 1 triangle, 2 square, 3 star: data-t) */
export function patFig(seq: number[]): string {
  const cell = 40, st = `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`, fills = ["#ff8787", "#69db7c", "#74c0fc", "#ffd43b"];
  let b = "";
  seq.forEach((t, i) => {
    const cx = 24 + i * cell, cy = 26, fill = fills[t];
    b += t === 0 ? `<circle class="s" data-t="0" cx="${cx}" cy="${cy}" r="14" fill="${fill}" ${st}/>`
      : t === 1 ? `<polygon class="s" data-t="1" points="${pts([[cx, cy - 15], [cx + 15, cy + 12], [cx - 15, cy + 12]])}" fill="${fill}" ${st}/>`
      : t === 2 ? `<rect class="s" data-t="2" x="${cx - 13}" y="${cy - 13}" width="26" height="26" fill="${fill}" ${st}/>`
      : `<polygon class="s" data-t="3" points="${pts(Array.from({ length: 10 }, (_, k) => [cx + (k % 2 ? 6 : 15) * Math.sin(rad(k * 36)), cy - (k % 2 ? 6 : 15) * Math.cos(rad(k * 36))] as Pt))}" fill="${fill}" ${st}/>`;
  });
  const qx = 24 + seq.length * cell;
  b += `<rect x="${qx - 15}" y="11" width="30" height="30" rx="6" fill="#fff" stroke="#868e96" stroke-width="2" stroke-dasharray="4 3"/>${T(qx, 26, "?", 18, "#868e96")}`;
  return svg(qx + 24, 52, b);
}
/** the first three figures of a growing row made of sticks: n squares (3n+1 sticks) or n triangles (2n+1 sticks); every stick is a <line> inside <g data-n> */
export function stickFig(kind: "sq" | "tri"): string {
  let body = "", x = 8;
  const S = 20;
  for (let n = 1; n <= 3; n++) {
    let g = "";
    if (kind === "sq") {
      for (let i = 0; i <= n; i++) g += L(x + i * S, 8, x + i * S, 8 + S, INK, 3);
      for (let i = 0; i < n; i++) g += L(x + i * S, 8, x + (i + 1) * S, 8, INK, 3) + L(x + i * S, 8 + S, x + (i + 1) * S, 8 + S, INK, 3);
    } else {
      const p = (i: number): Pt => [x + (i * S) / 2, i % 2 ? 8 : 8 + S];
      for (let i = 0; i <= n; i++) { const a = p(i), b = p(i + 1); g += L(a[0], a[1], b[0], b[1], INK, 3); }
      for (let i = 0; i < n; i++) { const a = p(i), b = p(i + 2); g += L(a[0], a[1], b[0], b[1], INK, 3); }
    }
    const w = kind === "sq" ? n * S : ((n + 1) * S) / 2;
    body += `<g data-n="${n}">${g}</g>${T(x + w / 2, 8 + S + 14, n, 12, "#1c7ed6")}`;
    x += w + 22;
  }
  return svg(x, 64, body);
}

// ------------------------------------------------------------------ angles, the number line, the plane
/** a protractor (the scale 0..180 starts at the baseline ray) and the angle's second ray; `mirror` = the scale starts on the left */
export function protractorFig(theta: number, mirror: boolean): string {
  const cx = 110, cy = 104, R = 96, X = (x: number) => (mirror ? 2 * cx - x : x);
  const at = (a: number, r: number): Pt => [X(cx + r * Math.cos(rad(a))), cy - r * Math.sin(rad(a))];
  let t = "", nums = "";
  for (let a = 0; a <= 180; a += 5) { const p = at(a, R), q = at(a, R - (a % 10 === 0 ? 9 : 5)); t += `M${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`; }
  for (let a = 0; a <= 180; a += 10) { const p = at(a, R - 20); nums += T(p[0], p[1], a, 7.5, "#495057"); }
  const e1 = at(0, R + 12), e2 = at(theta, R + 12);
  return svg(220, 118, `<path d="M${X(cx - R)} ${cy}A${R} ${R} 0 0 ${mirror ? 0 : 1} ${X(cx + R)} ${cy}Z" fill="#e7f5ff" stroke="#495057" stroke-width="2"/>`
    + `<path d="${t}" stroke="#495057" stroke-width="1" fill="none"/>${nums}`
    + L(X(cx - R - 8), cy, X(cx + R + 12), cy, "#adb5bd", 1.5) + L(cx, cy, e1[0], e1[1], INK, 3, ' class="r1"') + L(cx, cy, e2[0], e2[1], "#e03131", 3, ' class="r2"') + `<circle cx="${cx}" cy="${cy}" r="3" fill="${INK}"/>`);
}
/** an angle of `theta` degrees with its arc, the first ray pointing `rot` degrees round (no scale) */
export function angleFig(theta: number, rot: number): string {
  const cx = 60, cy = 62, len = 48;
  const dir = (a: number, r: number): Pt => [cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a))];
  const e1 = dir(rot, len), e2 = dir(rot + theta, len), a1 = dir(rot, 20), a2 = dir(rot + theta, 20);
  const mark = theta === 90
    ? `<polyline points="${pts([dir(rot, 14), [dir(rot, 14)[0] + dir(rot + 90, 14)[0] - cx, dir(rot, 14)[1] + dir(rot + 90, 14)[1] - cy], dir(rot + 90, 14)])}" fill="none" stroke="#e03131" stroke-width="2"/>`
    : theta === 180 ? "" : `<path d="M${f(a1[0])} ${f(a1[1])}A20 20 0 0 0 ${f(a2[0])} ${f(a2[1])}" fill="none" stroke="#e03131" stroke-width="2"/>`;
  return svg(120, 120, L(cx, cy, e1[0], e1[1], INK, 3.5, ' class="r1"') + L(cx, cy, e2[0], e2[1], INK, 3.5, ' class="r2"') + mark + `<circle cx="${cx}" cy="${cy}" r="3" fill="${INK}"/>`);
}
/** two crossing lines: the horizontal one and one turned by theta; the four angles are named 1 2 3 4 (1 = between the right end and the upper end of the second line, going round) */
export function crossFig(theta: number): string {
  const cx = 70, cy = 66, R = 56, d = (a: number, r: number): Pt => [cx + r * Math.cos(rad(a)), cy - r * Math.sin(rad(a))];
  const lab = [theta / 2, theta + (180 - theta) / 2, 180 + theta / 2, 180 + theta + (180 - theta) / 2];
  return svg(140, 132, L(cx - R, cy, cx + R, cy, INK, 3, ' class="ln" data-l="1"') + L(...d(theta + 180, R), ...d(theta, R), INK, 3, ' class="ln" data-l="2"')
    + lab.map((a, i) => { const p = d(a, theta < 45 || theta > 135 ? 40 : 26); return T(p[0], p[1], i + 1, 13, "#1c7ed6", ` class="ang" data-k="${i + 1}"`); }).join(""));
}
/** the number line from -7 to 7 with a point A (value v; data-s pixels a unit, data-zero the x of 0) */
export function numlineFig(v: number): string {
  const s = 20, zero = 150, y = 34;
  let t = "";
  for (let k = -7; k <= 7; k++) t += L(zero + k * s, y - 5, zero + k * s, y + 5, INK, 1.5) + T(zero + k * s, y + 17, k < 0 ? `−${-k}` : k, 9, "#495057");
  return svg(300, 66, `<g id="nl" data-s="${s}" data-zero="${zero}">${L(8, y, 292, y, INK, 2)}${t}<circle class="pt" cx="${zero + v * s}" cy="${y}" r="5.5" fill="#e03131" stroke="#fff" stroke-width="1.5"/>${T(zero + v * s, y - 15, "A", 13, "#e03131")}</g>`);
}
/** the plane with a point P (x, y): data-s pixels a unit, data-ox / data-oy the pixel of the origin */
export function coordFig(px: number, py: number): string {
  const s = 14, ox = 100, oy = 100;
  let g = "";
  for (let k = -6; k <= 6; k++) g += L(ox + k * s, oy - 6 * s, ox + k * s, oy + 6 * s, "#dee2e6", 1) + L(ox - 6 * s, oy + k * s, ox + 6 * s, oy + k * s, "#dee2e6", 1);
  let lab = "";
  for (let k = -6; k <= 6; k += 2) if (k) { lab += T(ox + k * s, oy + 9, k < 0 ? `−${-k}` : k, 8, "#495057"); lab += T(ox - 9, oy - k * s, k < 0 ? `−${-k}` : k, 8, "#495057"); }
  return svg(200, 200, `<g id="plane" data-s="${s}" data-ox="${ox}" data-oy="${oy}">${g}${L(ox - 6.6 * s, oy, ox + 6.6 * s, oy, INK, 2)}${L(ox, oy + 6.6 * s, ox, oy - 6.6 * s, INK, 2)}${T(ox + 6.9 * s, oy + 8, "x", 10)}${T(ox + 8, oy - 6.9 * s, "y", 10)}${lab}`
    + `<circle class="pt" cx="${ox + px * s}" cy="${oy - py * s}" r="4.5" fill="#e03131" stroke="#fff" stroke-width="1.2"/>${T(ox + px * s + 9, oy - py * s - 8, "P", 12, "#e03131")}</g>`);
}
