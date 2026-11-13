/**
 * Flags drawn in code (inline SVG, no image files; viewBox 90 x 60). Simplified: the coats of arms and the fine details are left out or reduced to a plain
 * shape. Stripes are `<rect class="s">`, so a test can count them and read their colours in order. Written from memory: a teacher must check the colours.
 */
const RED = "#D62027", WHITE = "#FFFFFF", BLUE = "#1F4E9C", GREEN = "#1B8A4B", YELLOW = "#FDCB2D", BLACK = "#1A1A1A", ORANGE = "#F2882B", SKY = "#6CB4EE", NAVY = "#0B2A6B";
const r = (x: number, y: number, w: number, h: number, f: string, cls = "") => `<rect${cls ? ` class="${cls}"` : ""} x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`;
const circ = (cx: number, cy: number, rad: number, f: string, extra = "") => `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${f}"${extra ? " " + extra : ""}/>`;
const poly = (pts: number[][], f: string, extra = "") => `<polygon points="${pts.map((p) => p.map((n) => +n.toFixed(2)).join(",")).join(" ")}" fill="${f}"${extra ? " " + extra : ""}/>`;
/** a star with `n` points */
const star = (cx: number, cy: number, R: number, f: string, rot = -90, n = 5, inner = n === 5 ? 0.382 : 0.5) => {
  const pts: number[][] = [];
  for (let i = 0; i < n * 2; i++) { const a = ((rot + (i * 180) / n) * Math.PI) / 180, rr = i % 2 ? R * inner : R; pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]); }
  return poly(pts, f);
};
/** a crescent opening to the right (the horn tips point right) */
const crescent = (cx: number, cy: number, R: number, f: string, bg: string, shift = R * 0.3, rr = R * 0.82) => `${circ(cx, cy, R, f)}${circ(cx + shift + R * 0.2, cy, rr, bg)}`;
/** equal (or weighted) stripes: horizontal "h" or vertical "v" */
const stripes = (dir: "h" | "v", cols: string[], wt?: number[], x = 0, y = 0, w = 90, h = 60) => {
  const ws = wt ?? cols.map(() => 1), tot = ws.reduce((a, b) => a + b, 0);
  let p = 0, o = "";
  cols.forEach((c, i) => { const len = ((dir === "h" ? h : w) * ws[i]) / tot; o += dir === "h" ? r(x, y + p, w, len + 0.2, c, "s") : r(x + p, y, len + 0.2, h, c, "s"); p += len; });
  return o;
};
const H = (cols: string[], wt?: number[]) => stripes("h", cols, wt);
const V = (cols: string[], wt?: number[]) => stripes("v", cols, wt);
/** the Union Jack in a box (x, y, w, h) */
const jack = (x: number, y: number, w: number, h: number) => {
  const id = `uj${x}${y}${w}`;
  const cx = x + w / 2, cy = y + h / 2;
  return `<g><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><g clip-path="url(#${id})">${r(x, y, w, h, NAVY)}`
    + `<path d="M${x} ${y}L${x + w} ${y + h}M${x + w} ${y}L${x} ${y + h}" stroke="${WHITE}" stroke-width="${h * 0.2}"/>`
    + `<path d="M${x} ${y}L${x + w} ${y + h}M${x + w} ${y}L${x} ${y + h}" stroke="${RED}" stroke-width="${h * 0.07}"/>`
    + `<path d="M${cx} ${y}V${y + h}M${x} ${cy}H${x + w}" stroke="${WHITE}" stroke-width="${h * 0.33}"/>`
    + `<path d="M${cx} ${y}V${y + h}M${x} ${cy}H${x + w}" stroke="${RED}" stroke-width="${h * 0.2}"/></g></g>`;
};
const nordic = (bg: string, cross: string, inner?: string) => `${r(0, 0, 90, 60, bg)}${r(24, 0, 14, 60, cross)}${r(0, 23, 90, 14, cross)}${inner ? r(28, 0, 6, 60, inner) + r(0, 27, 90, 6, inner) : ""}`;

const FLAGS: Record<string, string> = {
  cn: r(0, 0, 90, 60, RED) + star(15, 15, 9, YELLOW) + star(30, 6, 3, YELLOW, -20) + star(36, 12, 3, YELLOW, 10) + star(36, 21, 3, YELLOW, 30) + star(30, 27, 3, YELLOW, 55),
  us: H([RED, WHITE, RED, WHITE, RED, WHITE, RED, WHITE, RED, WHITE, RED, WHITE, RED]) + r(0, 0, 38, 32.3, NAVY)
    + [0, 1, 2, 3].flatMap((i) => [0, 1, 2, 3, 4].map((j) => circ(4.5 + j * 7.4 + (i % 2 ? 3.7 : 0), 4.5 + i * 7.8, 1.6, WHITE))).join(""),
  ru: H([WHITE, BLUE, RED]),
  jp: r(0, 0, 90, 60, WHITE) + circ(45, 30, 18, RED),
  gb: jack(0, 0, 90, 60),
  fr: V(["#0055A4", WHITE, "#EF4135"]),
  de: H([BLACK, "#DD0000", "#FFCE00"]),
  in: H([ORANGE, WHITE, GREEN]) + circ(45, 30, 6.5, "none", `stroke="${NAVY}" stroke-width="1.2"`) + circ(45, 30, 1.3, NAVY),
  br: r(0, 0, 90, 60, "#009C3B") + poly([[45, 5], [84, 30], [45, 55], [6, 30]], "#FFDF00") + circ(45, 30, 13.5, "#002776") + `<path d="M32 28Q46 24 58 33" stroke="${WHITE}" stroke-width="2" fill="none"/>`,
  au: r(0, 0, 90, 60, NAVY) + jack(0, 0, 45, 30) + star(22.5, 45, 7, WHITE, -90, 7, 0.45) + star(67, 47, 3, WHITE) + star(58, 33, 3, WHITE) + star(76, 28, 3, WHITE) + star(67, 12, 3, WHITE) + star(70, 36, 1.8, WHITE),
  ca: V([RED, WHITE, RED], [1, 2, 1]) + poly([[45, 12], [48, 21], [54, 19], [52, 27], [58, 24], [56, 33], [60, 35], [47, 41], [47, 49], [43, 49], [43, 41], [30, 35], [34, 33], [32, 24], [38, 27], [36, 19], [42, 21]], RED),
  eg: H([RED, WHITE, BLACK]) + circ(45, 30, 4.5, "#C09300"),
  kr: r(0, 0, 90, 60, WHITE) + `<path d="M31 30a14 14 0 0 1 28 0z" fill="${RED}"/><path d="M31 30a14 14 0 0 0 28 0z" fill="#0047A0"/>`
    + [[10, 8], [80, 8], [10, 52], [80, 52]].map(([x, y]) => `<g transform="translate(${x} ${y}) rotate(${x < 40 ? (y < 30 ? -34 : 34) : y < 30 ? 34 : -34})">${r(-6, -5, 12, 2, BLACK)}${r(-6, -1, 12, 2, BLACK)}${r(-6, 3, 12, 2, BLACK)}</g>`).join(""),
  kp: H([BLUE, WHITE, RED, WHITE, BLUE], [1, 0.2, 4.6, 0.2, 1]) + circ(30, 30, 11, WHITE) + star(30, 30, 9.5, RED),
  mn: V([RED, "#0066B3", RED]) + circ(15, 18, 3, YELLOW) + r(12, 22, 6, 14, YELLOW) + r(10, 38, 10, 2, YELLOW),
  th: H([RED, WHITE, "#2D2A4A", WHITE, RED], [1, 1, 2, 1, 1]),
  vn: r(0, 0, 90, 60, "#DA251D") + star(45, 31, 17, YELLOW),
  it: V(["#009246", WHITE, "#CE2B37"]),
  es: H(["#AA151B", "#F1BF00", "#AA151B"], [1, 2, 1]),
  za: `<clipPath id="za"><rect width="90" height="60"/></clipPath><g clip-path="url(#za)">${r(0, 0, 90, 30, "#E03C31")}${r(0, 30, 90, 30, "#001489")}`
    + `<path d="M0 0L36 30L0 60M36 30H90" stroke="${WHITE}" stroke-width="16" fill="none"/><path d="M0 0L36 30L0 60M36 30H90" stroke="#007749" stroke-width="10" fill="none"/>`
    + poly([[0, 8], [20, 30], [0, 52]], BLACK, "") + poly([[0, 3], [27, 30], [0, 57], [0, 52], [20, 30], [0, 8]], YELLOW) + `</g>`,
  mx: V(["#006847", WHITE, "#CE1126"]) + circ(45, 30, 8, "#8C6D3F") + circ(45, 30, 5, "#CBAA6B"),
  ar: H(["#74ACDF", WHITE, "#74ACDF"]) + circ(45, 30, 5.5, "#F6B40E"),
  id: H(["#CE1126", WHITE]),
  nz: r(0, 0, 90, 60, NAVY) + jack(0, 0, 45, 30) + [[68, 15], [60, 27], [76, 24], [68, 46]].map(([x, y]) => star(x, y, 4.2, RED) + star(x, y, 3, RED)).join(""),
  kz: r(0, 0, 90, 60, "#00AFCA") + circ(48, 26, 8, YELLOW) + `<path d="M26 44Q48 52 70 44" stroke="${YELLOW}" stroke-width="3" fill="none"/>` + r(8, 8, 3, 44, YELLOW),
  pk: r(0, 0, 90, 60, "#01411C") + r(0, 0, 22.5, 60, WHITE) + crescent(56, 30, 14, WHITE, "#01411C") + star(64, 24, 5, WHITE, -50),
  ph: H(["#0038A8", "#CE1126"]) + poly([[0, 0], [52, 30], [0, 60]], WHITE) + circ(14, 30, 5, YELLOW) + star(5, 8, 3, YELLOW) + star(5, 52, 3, YELLOW) + star(40, 30, 3, YELLOW),
  my: H([RED, WHITE, RED, WHITE, RED, WHITE, RED, WHITE, RED, WHITE, RED, WHITE, RED, WHITE]) + r(0, 0, 45, 32.2, "#010066") + crescent(17, 16, 9, YELLOW, "#010066") + star(26, 16, 6, YELLOW, -90, 14, 0.5),
  mm: H([YELLOW, GREEN, "#EA2839"]) + star(45, 32, 19, WHITE),
  np: r(0, 0, 90, 60, WHITE) + poly([[26, 2], [66, 28], [48, 28], [66, 58], [26, 58]], "#003893") + poly([[29.5, 7], [58, 26.5], [42, 26.5], [58, 53], [29.5, 53]], "#DC143C") + circ(38, 20, 3.5, WHITE) + circ(38, 42, 4.5, WHITE),
  ir: H(["#239F40", WHITE, "#DA0000"]) + circ(45, 30, 5, "#DA0000") + r(44, 24, 2, 12, "#DA0000"),
  sa: r(0, 0, 90, 60, "#006C35") + r(22, 17, 46, 3, WHITE) + r(26, 24, 38, 2, WHITE) + r(22, 41, 46, 2, WHITE) + poly([[24, 38], [66, 38], [66, 41], [24, 41]], WHITE),
  tr: r(0, 0, 90, 60, "#E30A17") + crescent(34, 30, 14, WHITE, "#E30A17") + star(51, 30, 6, WHITE, -90),
  et: H([GREEN, YELLOW, RED]) + circ(45, 30, 12, "#0F47AF") + star(45, 30, 8, YELLOW),
  ng: V([GREEN, WHITE, GREEN]),
  ke: H([BLACK, WHITE, RED, WHITE, GREEN], [6, 1, 6, 1, 6]) + `<ellipse cx="45" cy="30" rx="6" ry="13" fill="${RED}" stroke="${WHITE}" stroke-width="1"/>` + r(44.4, 14, 1.2, 32, BLACK),
  nl: H(["#AE1C28", WHITE, "#21468B"]),
  se: nordic("#006AA7", "#FECC02"),
  no: nordic("#BA0C2F", WHITE, "#00205B"),
  pl: H([WHITE, "#DC143C"]),
  ua: H(["#0057B7", "#FFD700"]),
  cl: H([WHITE, "#D52B1E"]) + r(0, 0, 30, 30, "#0039A6") + star(15, 15, 8, WHITE),
  pe: V(["#D91023", WHITE, "#D91023"]),
  co: H([YELLOW, "#003893", "#CE1126"], [2, 1, 1]),
  la: H(["#CE1126", "#002868", "#CE1126"], [1, 2, 1]) + circ(45, 30, 10, WHITE),
  bt: r(0, 0, 90, 60, YELLOW) + poly([[0, 60], [90, 0], [90, 60]], "#FF4E12") + `<path d="M26 40Q40 22 60 32Q50 44 36 46Z" fill="${WHITE}"/>`,
  af: V([BLACK, "#BE0000", "#007A36"]) + circ(45, 30, 8, WHITE),
  tj: H(["#CC0000", WHITE, "#006600"], [2, 3, 2]) + star(45, 30, 7, "#F8C300", -90, 7, 0.45),
  kg: r(0, 0, 90, 60, "#E8112D") + circ(45, 30, 13, YELLOW) + circ(45, 30, 9, "#E8112D") + star(45, 30, 18, YELLOW, -90, 40, 0.88) + circ(45, 30, 8.4, "#E8112D"),
  bd: r(0, 0, 90, 60, "#006A4E") + circ(40, 30, 16, "#F42A41"),
  kh: H([NAVY, "#E00025", NAVY], [1, 2, 1]) + r(30, 22, 30, 4, WHITE) + poly([[34, 22], [38, 14], [45, 10], [52, 14], [56, 22]], WHITE),
  iq: H(["#CE1126", WHITE, BLACK]) + r(34, 26, 22, 6, "#007A3D"),
  ae: H(["#00732F", WHITE, BLACK]) + r(0, 0, 22, 60, "#FF0000"),
  dz: V([GREEN, WHITE]) + crescent(46, 30, 14, "#D21034", WHITE) + star(50, 30, 5, "#D21034", -90),
  cd: r(0, 0, 90, 60, "#007FFF") + `<path d="M0 60L90 0" stroke="${YELLOW}" stroke-width="14"/><path d="M0 60L90 0" stroke="#CE1021" stroke-width="9"/>` + star(14, 12, 7, YELLOW),
  sd: H(["#D21034", WHITE, BLACK]) + poly([[0, 0], [30, 30], [0, 60]], "#007229"),
  ly: H([RED, BLACK, GREEN], [1, 2, 1]) + crescent(45, 30, 8, WHITE, BLACK) + star(50, 30, 3, WHITE),
  tz: r(0, 0, 90, 60, "#1EB53A") + poly([[0, 60], [90, 60], [90, 0]], "#00A3DD") + `<path d="M0 60L90 0" stroke="${YELLOW}" stroke-width="22"/><path d="M0 60L90 0" stroke="${BLACK}" stroke-width="16"/>`,
  ma: r(0, 0, 90, 60, "#C1272D") + star(45, 31, 14, "none").replace('fill="none"', `fill="none" stroke="#006233" stroke-width="2"`),
  ao: H(["#CC092F", BLACK]) + circ(45, 30, 10, YELLOW) + star(45, 30, 5, "#CC092F"),
  gh: H(["#CE1126", YELLOW, "#006B3F"]) + star(45, 30, 9, BLACK),
  ve: H([YELLOW, "#00247D", "#CF142B"]) + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => star(45 - 17 * Math.cos((Math.PI * i) / 7), 38 - 10 * Math.sin((Math.PI * i) / 7), 2.2, WHITE)).join(""),
  ec: H([YELLOW, "#034EA2", "#ED1C24"], [2, 1, 1]) + circ(45, 30, 6, "#8C6D3F"),
  cu: H([NAVY, WHITE, NAVY, WHITE, NAVY]) + poly([[0, 0], [39, 30], [0, 60]], "#CF142B") + star(12, 30, 7, WHITE),
  pt: V([GREEN, "#FF0000"], [2, 3]) + circ(36, 30, 10, YELLOW) + circ(36, 30, 6, "#FF0000") + circ(36, 30, 3.5, WHITE),
  gr: H(["#0D5EAF", WHITE, "#0D5EAF", WHITE, "#0D5EAF", WHITE, "#0D5EAF", WHITE, "#0D5EAF"]) + r(0, 0, 33.3, 33.4, "#0D5EAF") + r(13.3, 0, 6.7, 33.4, WHITE) + r(0, 13.3, 33.3, 6.7, WHITE),
  ch: `<rect width="90" height="60" fill="${WHITE}"/>` + r(15, 0, 60, 60, "#DA291C") + r(40, 12, 10, 36, WHITE) + r(27, 25, 36, 10, WHITE),
  fi: nordic(WHITE, "#003580"),
  pg: r(0, 0, 90, 60, BLACK) + poly([[0, 0], [90, 0], [90, 60]], "#CE1126") + [[22, 14], [14, 30], [30, 30], [22, 46], [12, 52]].map(([x, y]) => star(x, y, 3.6, WHITE)).join(""),
  uz: H(["#0099B5", "#CE1126", WHITE, "#CE1126", "#1EB53A"], [10, 0.5, 9, 0.5, 10]) + crescent(12, 9, 5, WHITE, "#0099B5"),
  mg: r(0, 0, 90, 60, WHITE) + r(30, 0, 60, 30, "#FC3D32") + r(30, 30, 60, 30, "#007E3A"),
  ro: V(["#002B7F", "#FCD116", "#CE1126"]),
};
/** the nordic flags and some others need an outline; the white parts get a thin border */
export const FLAG_IDS = Object.keys(FLAGS);
/** the inline SVG of a country's flag (empty when there is none) */
export function flagSvg(id: string): string {
  const body = FLAGS[id];
  if (!body) return "";
  const square = id === "ch";
  return `<svg class="gm-flag" data-flag="${id}" viewBox="0 0 90 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">${body}<rect x="0.5" y="0.5" width="89" height="59" fill="none" stroke="rgba(0,0,0,.28)" stroke-width="1"${square ? ' display="none"' : ""}/></svg>`;
}
