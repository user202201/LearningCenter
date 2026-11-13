/**
 * Pictures of 天文, all made in code: a cartoon-realistic texture for every planet, dwarf planet and moon (gradients, bands, craters, continent blobs, clouds), mapped on a
 * sphere pixel by pixel (the lookup is made once per size, so a turning planet only shifts the texture), rings, the moon phase, constellations, the icon of the science
 * home. No image file, nothing fetched.
 */
import type { Const } from "./spacemodel";

const TW = 512, TH = 256;
const mkRng = (seed: number) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (s: string): number => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const canvas = (w: number, h: number): HTMLCanvasElement => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

// ---------- textures ----------
type Ctx = CanvasRenderingContext2D;
/** draws `fn` three times (shifted by one texture width) so that the picture is seamless where the texture wraps round */
const wrap = (c: Ctx, fn: (dx: number) => void) => { for (const dx of [-TW, 0, TW]) fn(dx); };
const blob = (c: Ctx, x: number, y: number, rx: number, ry: number, rnd: () => number, fill: string, n = 14) => {
  c.fillStyle = fill; c.beginPath();
  for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI * 2, k = 0.7 + rnd() * 0.5; const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k; i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.closePath(); c.fill();
};
const craters = (c: Ctx, n: number, rmin: number, rmax: number, rnd: () => number, dark = "rgba(0,0,0,.28)", light = "rgba(255,255,255,.22)") => {
  for (let i = 0; i < n; i++) {
    const x = rnd() * TW, y = TH * 0.06 + rnd() * TH * 0.88, r = rmin + Math.pow(rnd(), 2.2) * (rmax - rmin);
    wrap(c, (dx) => { c.beginPath(); c.arc(x + dx + r * 0.12, y + r * 0.12, r, 0, 7); c.fillStyle = light; c.fill(); c.beginPath(); c.arc(x + dx, y, r * 0.9, 0, 7); c.fillStyle = dark; c.fill(); });
  }
};
const specks = (c: Ctx, n: number, rnd: () => number, a = 0.12) => { for (let i = 0; i < n; i++) { c.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`; const s = 1 + rnd() * 3; c.fillRect(rnd() * TW, rnd() * TH, s, s); } };
const bands = (c: Ctx, cols: string[], rnd: () => number, wob = 3, edgeTop = 0, edgeBot = TH) => {
  const n = cols.length, h = (edgeBot - edgeTop) / n;
  cols.forEach((col, i) => {
    c.fillStyle = col; c.beginPath(); const y0 = edgeTop + i * h, y1 = edgeTop + (i + 1) * h + 2, ph = rnd() * 6, f = 2 + Math.floor(rnd() * 4);
    c.moveTo(0, y0);
    for (let x = 0; x <= TW; x += 8) c.lineTo(x, y0 + Math.sin((x / TW) * Math.PI * 2 * f + ph) * wob);
    for (let x = TW; x >= 0; x -= 8) c.lineTo(x, y1 + Math.sin((x / TW) * Math.PI * 2 * f + ph + 1) * wob);
    c.closePath(); c.fill();
  });
};
const swirls = (c: Ctx, n: number, rnd: () => number, cols: string[], wmin: number, wmax: number) => {
  for (let i = 0; i < n; i++) {
    const y = rnd() * TH, w = wmin + rnd() * (wmax - wmin), x0 = rnd() * TW, amp = 3 + rnd() * 10, len = 80 + rnd() * 200;
    c.strokeStyle = cols[Math.floor(rnd() * cols.length)]; c.lineWidth = w; c.lineCap = "round";
    wrap(c, (dx) => { c.beginPath(); for (let t = 0; t <= len; t += 6) { const x = x0 + t + dx, yy = y + Math.sin(t / 22) * amp; t ? c.lineTo(x, yy) : c.moveTo(x, yy); } c.stroke(); });
  }
};
const cap = (c: Ctx, top: number, bot: number, col: string) => {
  let g = c.createLinearGradient(0, 0, 0, top); g.addColorStop(0, col); g.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = g; c.fillRect(0, 0, TW, top);
  g = c.createLinearGradient(0, TH - bot, 0, TH); g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(1, col); c.fillStyle = g; c.fillRect(0, TH - bot, TW, bot);
};
const base = (c: Ctx, a: string, b: string) => { const g = c.createLinearGradient(0, 0, 0, TH); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a); c.fillStyle = g; c.fillRect(0, 0, TW, TH); };

function paint(id: string, c: Ctx) {
  const rnd = mkRng(hash(id));
  switch (id) {
    case "mercury": base(c, "#8a8782", "#a8a39a"); specks(c, 900, rnd, 0.1); craters(c, 170, 2, 16, rnd); break;
    case "venus": base(c, "#d9b878", "#eed39b"); swirls(c, 70, rnd, ["rgba(255,244,214,.35)", "rgba(190,140,70,.28)", "rgba(255,226,160,.3)"], 6, 18); break;
    case "earth": {
      base(c, "#1b5db0", "#2a7bd6");
      const land = (u: number, v: number, rx: number, ry: number, col: string) => wrap(c, (dx) => blob(c, u * TW + dx, v * TH, rx * TW, ry * TH, rnd, col));
      for (const [u, v, rx, ry, col] of [[0.2, 0.3, 0.075, 0.12, "#4f9a49"], [0.17, 0.26, 0.05, 0.06, "#8fb15a"], [0.28, 0.58, 0.04, 0.14, "#3f8d4a"], [0.6, 0.27, 0.17, 0.11, "#59a24c"], [0.66, 0.24, 0.06, 0.05, "#c9b878"], [0.53, 0.52, 0.065, 0.14, "#b9ab6a"], [0.52, 0.44, 0.04, 0.05, "#d6c27a"], [0.82, 0.67, 0.055, 0.045, "#c98f55"], [0.33, 0.13, 0.025, 0.05, "#e8eef0"], [0.76, 0.43, 0.03, 0.03, "#4d9a52"]] as [number, number, number, number, string][]) land(u, v, rx, ry, col);
      cap(c, TH * 0.1, TH * 0.1, "#f4f8fb");
      swirls(c, 90, rnd, ["rgba(255,255,255,.55)", "rgba(255,255,255,.35)"], 3, 9);
      break;
    }
    case "mars": {
      base(c, "#b95a34", "#cc6c42");
      for (let i = 0; i < 40; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, TH * 0.15 + rnd() * TH * 0.7, 8 + rnd() * 34, 5 + rnd() * 16, rnd, i % 3 ? "rgba(110,50,25,.38)" : "rgba(235,170,110,.28)"));
      c.strokeStyle = "rgba(80,30,15,.7)"; c.lineWidth = 3; c.beginPath(); c.moveTo(TW * 0.2, TH * 0.54); c.quadraticCurveTo(TW * 0.27, TH * 0.5, TW * 0.36, TH * 0.55); c.stroke();
      craters(c, 40, 2, 9, rnd, "rgba(70,30,15,.25)", "rgba(255,230,200,.15)");
      cap(c, TH * 0.07, TH * 0.07, "#fbfbfb"); break;
    }
    case "jupiter": {
      bands(c, ["#e8d7bb", "#c6976a", "#f0e2cb", "#b06f3e", "#ecdcc2", "#a5663a", "#e1cba8", "#c79e76", "#f0e3cb", "#b98a5e", "#d9c3a0", "#a98262"], rnd, 3);
      swirls(c, 120, rnd, ["rgba(255,255,255,.3)", "rgba(120,70,40,.3)", "rgba(240,210,170,.35)"], 2, 6);
      wrap(c, (dx) => { const x = TW * 0.36 + dx, y = TH * 0.64; c.fillStyle = "rgba(235,190,160,.9)"; c.beginPath(); c.ellipse(x, y, 34, 19, 0, 0, 7); c.fill(); c.fillStyle = "#c4442b"; c.beginPath(); c.ellipse(x, y, 28, 14, 0, 0, 7); c.fill(); c.fillStyle = "#a83422"; c.beginPath(); c.ellipse(x + 3, y, 14, 7, 0, 0, 7); c.fill(); });
      break;
    }
    case "saturn": bands(c, ["#ead9a4", "#d8c088", "#f0e0b0", "#cbab6f", "#e8d49c", "#dac28b", "#efdfae", "#d3b97e"], rnd, 2); swirls(c, 40, rnd, ["rgba(255,255,255,.18)", "rgba(150,110,50,.18)"], 3, 8); break;
    case "uranus": base(c, "#9fe2e8", "#b9f0f2"); bands(c, ["rgba(160,225,235,.35)", "rgba(200,245,248,.3)", "rgba(150,215,228,.3)", "rgba(210,248,250,.3)"], rnd, 1.5); break;
    case "neptune": {
      base(c, "#2f50c8", "#4064da"); bands(c, ["rgba(30,50,160,.3)", "rgba(110,150,255,.2)", "rgba(25,45,150,.3)", "rgba(100,140,250,.2)"], rnd, 3);
      swirls(c, 25, rnd, ["rgba(235,245,255,.7)"], 1.5, 3.5);
      wrap(c, (dx) => { c.fillStyle = "rgba(15,30,110,.85)"; c.beginPath(); c.ellipse(TW * 0.4 + dx, TH * 0.42, 26, 14, -0.1, 0, 7); c.fill(); }); break;
    }
    case "pluto": {
      base(c, "#b99b7c", "#cfb394"); for (let i = 0; i < 26; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, TH * 0.2 + rnd() * TH * 0.6, 10 + rnd() * 26, 8 + rnd() * 16, rnd, "rgba(100,60,45,.4)"));
      wrap(c, (dx) => { blob(c, TW * 0.46 + dx, TH * 0.5, 34, 30, rnd, "rgba(246,238,224,.95)"); blob(c, TW * 0.54 + dx, TH * 0.46, 30, 30, rnd, "rgba(246,238,224,.95)"); }); break;
    }
    case "ceres": base(c, "#85827e", "#9b9892"); specks(c, 500, rnd, 0.1); craters(c, 130, 2, 14, rnd); wrap(c, (dx) => { c.fillStyle = "rgba(255,255,250,.95)"; c.beginPath(); c.arc(TW * 0.3 + dx, TH * 0.4, 5, 0, 7); c.arc(TW * 0.31 + dx, TH * 0.44, 3, 0, 7); c.fill(); }); break;
    case "eris": base(c, "#d3d3d3", "#ececec"); for (let i = 0; i < 18; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, rnd() * TH, 20 + rnd() * 30, 10 + rnd() * 20, rnd, "rgba(150,150,155,.22)")); break;
    case "makemake": base(c, "#a5623b", "#bb7a4e"); for (let i = 0; i < 30; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, rnd() * TH, 14 + rnd() * 30, 8 + rnd() * 18, rnd, rnd() < 0.5 ? "rgba(90,40,25,.3)" : "rgba(235,200,160,.25)")); break;
    case "haumea": base(c, "#d2d2d2", "#ececec"); wrap(c, (dx) => blob(c, TW * 0.42 + dx, TH * 0.5, 22, 14, rnd, "rgba(170,85,60,.75)")); specks(c, 200, rnd, 0.06); break;
    case "moon": {
      base(c, "#a3a3a3", "#bdbdbd"); specks(c, 700, rnd, 0.08);
      for (const [u, v, rx, ry] of [[0.35, 0.35, 0.09, 0.11], [0.52, 0.3, 0.07, 0.07], [0.42, 0.55, 0.07, 0.06], [0.6, 0.48, 0.05, 0.07], [0.28, 0.5, 0.04, 0.05]]) wrap(c, (dx) => blob(c, u * TW + dx, v * TH, rx * TW, ry * TH, rnd, "rgba(70,70,75,.5)"));
      craters(c, 130, 2, 16, rnd); break;
    }
    case "phobos": base(c, "#6f6a64", "#857f77"); craters(c, 120, 2, 12, rnd); wrap(c, (dx) => { c.fillStyle = "rgba(0,0,0,.3)"; c.beginPath(); c.arc(TW * 0.6 + dx, TH * 0.5, 38, 0, 7); c.fill(); }); break;
    case "deimos": base(c, "#8a7d6d", "#a39482"); craters(c, 50, 3, 12, rnd, "rgba(0,0,0,.18)", "rgba(255,255,255,.18)"); break;
    case "io": {
      base(c, "#e6d36a", "#f1e18a");
      for (let i = 0; i < 70; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, rnd() * TH, 5 + rnd() * 18, 4 + rnd() * 12, rnd, ["rgba(215,130,40,.6)", "rgba(250,250,215,.55)", "rgba(190,100,30,.5)"][i % 3]));
      for (let i = 0; i < 14; i++) wrap(c, (dx) => { const x = rnd() * TW + dx, y = rnd() * TH; c.fillStyle = "rgba(200,70,30,.7)"; c.beginPath(); c.arc(x, y, 9, 0, 7); c.fill(); c.fillStyle = "#2a2522"; c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); }); break;
    }
    case "europa": {
      base(c, "#e7e0cf", "#f3eee1"); for (let i = 0; i < 18; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, rnd() * TH, 16 + rnd() * 30, 8 + rnd() * 14, rnd, "rgba(170,125,90,.22)"));
      for (let i = 0; i < 90; i++) { const x = rnd() * TW, y = rnd() * TH, len = 40 + rnd() * 120, a = rnd() * 3.14; c.strokeStyle = "rgba(140,90,60,.55)"; c.lineWidth = 0.8 + rnd() * 1.8; wrap(c, (dx) => { c.beginPath(); c.moveTo(x + dx, y); c.quadraticCurveTo(x + dx + Math.cos(a) * len * 0.5 + 10, y + Math.sin(a) * len * 0.5 - 8, x + dx + Math.cos(a) * len, y + Math.sin(a) * len); c.stroke(); }); } break;
    }
    case "ganymede": base(c, "#8d8579", "#a29a8c"); for (let i = 0; i < 24; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, rnd() * TH, 20 + rnd() * 40, 10 + rnd() * 26, rnd, "rgba(205,198,184,.35)")); craters(c, 80, 2, 11, rnd, "rgba(60,55,50,.25)", "rgba(255,255,255,.35)"); break;
    case "callisto": base(c, "#5f5a52", "#6e695f"); specks(c, 500, rnd, 0.08); craters(c, 230, 1.5, 9, rnd, "rgba(30,28,24,.3)", "rgba(235,230,215,.45)"); break;
    case "titan": base(c, "#d89a40", "#e6ab52"); bands(c, ["rgba(190,110,30,.28)", "rgba(250,200,110,.25)", "rgba(180,100,30,.3)", "rgba(240,190,100,.25)"], rnd, 2); break;
    case "enceladus": base(c, "#f2f6fa", "#fbfdff"); for (let i = 0; i < 5; i++) { c.strokeStyle = "rgba(120,180,225,.65)"; c.lineWidth = 2.2; wrap(c, (dx) => { c.beginPath(); c.moveTo(TW * (0.12 + i * 0.18) + dx, TH * 0.78); c.lineTo(TW * (0.13 + i * 0.18) + dx, TH * 0.97); c.stroke(); }); } craters(c, 40, 2, 10, rnd, "rgba(120,140,170,.15)", "rgba(255,255,255,.3)"); break;
    case "mimas": base(c, "#a3a3a3", "#b6b6b6"); craters(c, 120, 2, 10, rnd); wrap(c, (dx) => { c.fillStyle = "rgba(255,255,255,.18)"; c.beginPath(); c.arc(TW * 0.3 + dx + 4, TH * 0.5 + 4, 46, 0, 7); c.fill(); c.fillStyle = "rgba(40,40,45,.45)"; c.beginPath(); c.arc(TW * 0.3 + dx, TH * 0.5, 42, 0, 7); c.fill(); c.fillStyle = "rgba(190,190,190,.9)"; c.beginPath(); c.arc(TW * 0.3 + dx, TH * 0.5, 8, 0, 7); c.fill(); }); break;
    case "tethys": base(c, "#cfcfcf", "#e3e3e3"); craters(c, 90, 2, 11, rnd, "rgba(90,90,100,.2)", "rgba(255,255,255,.3)"); wrap(c, (dx) => { c.strokeStyle = "rgba(80,80,90,.4)"; c.lineWidth = 7; c.beginPath(); c.moveTo(TW * 0.1 + dx, TH * 0.2); c.quadraticCurveTo(TW * 0.4 + dx, TH * 0.5, TW * 0.2 + dx, TH * 0.9); c.stroke(); }); break;
    case "dione": base(c, "#c3c3c3", "#d7d7d7"); craters(c, 100, 2, 12, rnd); swirls(c, 25, rnd, ["rgba(255,255,255,.55)"], 2, 6); break;
    case "rhea": base(c, "#b4b4b4", "#cbcbcb"); craters(c, 150, 2, 13, rnd); specks(c, 300, rnd, 0.08); break;
    case "iapetus": { const g = c.createLinearGradient(TW * 0.2, 0, TW * 0.8, 0); g.addColorStop(0, "#2f2822"); g.addColorStop(0.42, "#3a3029"); g.addColorStop(0.58, "#e4dfd6"); g.addColorStop(1, "#f1ede6"); c.fillStyle = g; c.fillRect(0, 0, TW, TH); c.fillStyle = "#2f2822"; c.fillRect(0, 0, TW * 0.2, TH); craters(c, 80, 2, 10, rnd, "rgba(0,0,0,.2)", "rgba(255,255,255,.15)"); c.fillStyle = "rgba(255,255,255,.2)"; c.fillRect(0, TH * 0.47, TW, 4); break; }
    case "miranda": base(c, "#9a9a9a", "#b2b2b2"); for (let i = 0; i < 28; i++) wrap(c, (dx) => blob(c, rnd() * TW + dx, rnd() * TH, 14 + rnd() * 30, 12 + rnd() * 22, rnd, rnd() < 0.5 ? "rgba(60,60,65,.3)" : "rgba(240,240,240,.28)", 7)); craters(c, 40, 2, 9, rnd); break;
    case "ariel": base(c, "#c0c0c0", "#d4d4d4"); craters(c, 70, 2, 10, rnd, "rgba(60,60,65,.18)", "rgba(255,255,255,.35)"); for (let i = 0; i < 16; i++) { c.strokeStyle = "rgba(70,70,75,.35)"; c.lineWidth = 2; const x = rnd() * TW, y = rnd() * TH; wrap(c, (dx) => { c.beginPath(); c.moveTo(x + dx, y); c.lineTo(x + dx + 60 + rnd() * 80, y + (rnd() - 0.5) * 30); c.stroke(); }); } break;
    case "umbriel": base(c, "#585858", "#6a6a6a"); craters(c, 90, 2, 9, rnd, "rgba(0,0,0,.25)", "rgba(255,255,255,.12)"); wrap(c, (dx) => { c.strokeStyle = "rgba(235,235,225,.85)"; c.lineWidth = 6; c.beginPath(); c.arc(TW * 0.62 + dx, TH * 0.18, 9, 0, 7); c.stroke(); }); break;
    case "titania": case "oberon": base(c, "#948c82", "#aaa297"); craters(c, id === "oberon" ? 150 : 100, 2, 14, rnd); specks(c, 300, rnd, 0.07); break;
    case "triton": base(c, "#dcc9c0", "#eddcd3"); cap(c, TH * 0.12, TH * 0.28, "#f6dfd8"); for (let i = 0; i < 60; i++) { c.strokeStyle = "rgba(60,45,45,.55)"; c.lineWidth = 1.2; const x = rnd() * TW, y = TH * 0.55 + rnd() * TH * 0.4; wrap(c, (dx) => { c.beginPath(); c.moveTo(x + dx, y); c.lineTo(x + dx + 10 + rnd() * 18, y - 3); c.stroke(); }); } craters(c, 25, 2, 8, rnd, "rgba(80,60,60,.18)", "rgba(255,255,255,.2)"); break;
    case "charon": base(c, "#9a9a9a", "#b0b0b0"); craters(c, 70, 2, 11, rnd); cap(c, TH * 0.22, 0, "rgba(140,60,45,.85)"); break;
    default: base(c, "#9a9a9a", "#b3b3b3"); specks(c, 300, rnd, 0.1); craters(c, 60, 2, 10, rnd);
  }
}
const texCache = new Map<string, Uint8ClampedArray>();
export function textureData(id: string): Uint8ClampedArray {
  let d = texCache.get(id);
  if (!d) { const cv = canvas(TW, TH); const c = cv.getContext("2d", { willReadFrequently: true })!; paint(id, c); d = c.getImageData(0, 0, TW, TH).data; texCache.set(id, d); }
  return d;
}

// ---------- the sphere ----------
interface Look { n: number; mask: Uint8Array; lon: Float32Array; row: Uint16Array; shade: Uint8Array }
const looks = new Map<string, Look>();
/** the lookup of a sphere of `px` pixels seen with the north pole tilted by `elev` degrees towards the viewer */
function lookup(px: number, elev: number, lit: boolean): Look {
  const key = `${px}|${elev}|${lit ? 1 : 0}`;
  let l = looks.get(key);
  if (l) return l;
  const n = px * px, mask = new Uint8Array(n), lon = new Float32Array(n), row = new Uint16Array(n), shade = new Uint8Array(n);
  const cs = Math.cos(elev * Math.PI / 180), sn = Math.sin(elev * Math.PI / 180);
  const L = [-0.45, -0.35, 0.82], ln = Math.hypot(L[0], L[1], L[2]);
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) {
    const x = ((i + 0.5) / px) * 2 - 1, y = ((j + 0.5) / px) * 2 - 1, r2 = x * x + y * y, k = j * px + i;
    if (r2 > 1) continue;
    const z = Math.sqrt(1 - r2);
    mask[k] = 255;
    const lat = Math.asin(Math.max(-1, Math.min(1, -y * cs + z * sn)));
    const p3 = y * sn + z * cs;
    lon[k] = (Math.atan2(x, p3) / (2 * Math.PI) + 1) % 1;
    row[k] = Math.max(0, Math.min(TH - 1, Math.floor((0.5 - lat / Math.PI) * TH)));
    const dot = (x * L[0] + y * L[1] + z * L[2]) / ln;
    shade[k] = lit ? Math.round(255 * Math.max(0.1, Math.min(1, 0.14 + 0.98 * Math.max(0, dot)))) : Math.round(255 * (0.6 + 0.4 * z));
    // soft edge
    if (r2 > 0.97) mask[k] = Math.round(255 * Math.max(0, (1 - r2) / 0.03));
  }
  l = { n, mask, lon, row, shade };
  looks.set(key, l);
  return l;
}
/** draws the planet `id` into a canvas of px x px (the whole canvas is the sphere); `spin` 0..1 = the turn of the planet */
export function renderSphereInto(cv: HTMLCanvasElement, id: string, spin: number, elev: number, lit = true): void {
  const px = cv.width, l = lookup(px, elev, lit), tex = textureData(id);
  const c = cv.getContext("2d")!;
  const img = c.createImageData(px, px), o = img.data;
  const off = ((spin % 1) + 1) % 1;
  for (let k = 0; k < l.n; k++) {
    const m = l.mask[k];
    if (!m) continue;
    const u = Math.floor(((l.lon[k] + off) % 1) * TW), t = (l.row[k] * TW + u) * 4, s = l.shade[k] / 255;
    o[k * 4] = tex[t] * s; o[k * 4 + 1] = tex[t + 1] * s; o[k * 4 + 2] = tex[t + 2] * s; o[k * 4 + 3] = m;
  }
  c.putImageData(img, 0, 0);
}
const spriteCache = new Map<string, HTMLCanvasElement>();
export const RING_PAD = 2.6;
/** a small still picture of a world (with its ring when it has a bright one); cached. The sphere's diameter is `px`; the canvas is RING_PAD times larger when there is a ring */
export function sprite(id: string, px: number, ring = false, lit = true): HTMLCanvasElement {
  const key = `${id}|${px}|${ring ? 1 : 0}|${lit ? 1 : 0}`;
  let s = spriteCache.get(key);
  if (s) return s;
  const sph = canvas(px, px);
  renderSphereInto(sph, id, 0.3, ring ? 22 : 0, lit);
  if (!ring) { s = sph; } else {
    const W = Math.round(px * RING_PAD); s = canvas(W, W);
    const c = s.getContext("2d")!;
    drawRings(c, W / 2, W / 2, px / 2, 22, "saturn", "back");
    c.drawImage(sph, (W - px) / 2, (W - px) / 2);
    drawRings(c, W / 2, W / 2, px / 2, 22, "saturn", "front");
  }
  spriteCache.set(key, s);
  return s;
}
/** the rings of a planet seen from `elev` degrees above its ring plane; "back" = the half behind the planet, "front" = the half in front */
export function drawRings(c: Ctx, cx: number, cy: number, R: number, elev: number, kind: string, part: "back" | "front"): void {
  const k = Math.sin(elev * Math.PI / 180);
  const sets: [number, number, string][] = kind === "saturn"
    ? [[1.24, 1.52, "rgba(150,130,100,.45)"], [1.53, 1.94, "rgba(226,206,160,.95)"], [1.95, 2.03, "rgba(30,25,20,.35)"], [2.03, 2.27, "rgba(205,186,146,.85)"], [2.3, 2.33, "rgba(220,200,160,.5)"]]
    : [[1.6, 1.64, "rgba(210,225,235,.6)"], [1.8, 1.84, "rgba(210,225,235,.5)"], [2.0, 2.03, "rgba(210,225,235,.4)"]];
  c.save();
  c.beginPath(); if (part === "back") c.rect(cx - R * 3, cy - R * 3, R * 6, R * 3); else c.rect(cx - R * 3, cy, R * 6, R * 3); c.clip();
  for (const [a, b, col] of sets) {
    c.beginPath(); c.ellipse(cx, cy, R * b, R * b * k, 0, 0, Math.PI * 2); c.ellipse(cx, cy, R * a, R * a * k, 0, 0, Math.PI * 2, true);
    c.fillStyle = col; c.fill("evenodd");
  }
  c.restore();
}

// ---------- the Moon's phase ----------
/** the Moon's disc with its lit part for the angle E between Moon and Sun (northern hemisphere: the right side is lit while the Moon waxes) */
export function drawPhase(c: Ctx, cx: number, cy: number, r: number, E: number, id = "moon"): void {
  const e = ((E % 360) + 360) % 360, k = Math.cos(e * Math.PI / 180), waxing = e < 180;
  c.save();
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.fillStyle = "#1c2038"; c.fill();
  c.beginPath();
  c.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing);                       // the lit half circle (right when waxing)
  // the terminator back from the bottom to the top: crescent -> on the lit side, gibbous -> on the dark side
  const rx = Math.max(0.01, Math.abs(k) * r), onRight = (k > 0) === waxing;
  c.ellipse(cx, cy, rx, r, 0, Math.PI / 2, -Math.PI / 2, onRight ? true : false);
  c.closePath(); c.clip();
  c.drawImage(sprite(id, Math.max(32, Math.round(r * 2 * 2)), false, false), cx - r, cy - r, r * 2, r * 2);
  c.restore();
  c.beginPath(); c.arc(cx, cy, r, 0, 7); c.strokeStyle = "rgba(255,255,255,.25)"; c.lineWidth = 1; c.stroke();
}

// ---------- constellations ----------
const stars = (seed: number, n: number): string => { const r = mkRng(seed); let s = ""; for (let i = 0; i < n; i++) s += `<circle cx="${(r() * 100).toFixed(1)}" cy="${(r() * 100).toFixed(1)}" r="${(0.3 + r() * 0.5).toFixed(2)}" fill="#fff" opacity="${(0.25 + r() * 0.4).toFixed(2)}"/>`; return s; };
/** the dots and lines of a constellation in a square night-sky picture (no names, so that it can be asked about) */
export function constSvg(c: Const, withNames = false): string {
  const lines = c.lines.map(([a, b]) => `<line x1="${c.stars[a][0]}" y1="${c.stars[a][1]}" x2="${c.stars[b][0]}" y2="${c.stars[b][1]}" stroke="#a5b4fc" stroke-width=".9" stroke-linecap="round"/>`).join("");
  const dots = c.stars.map(([x, y, r, n]) => `<circle cx="${x}" cy="${y}" r="${r * 2.4}" fill="#fff" opacity=".18"/><circle cx="${x}" cy="${y}" r="${(0.9 + r * 0.55).toFixed(2)}" fill="${r >= 4 ? "#ffd8a8" : "#fff"}"/>${withNames && n ? `<text x="${x + 3}" y="${y - 3}" font-size="4.5" fill="#dbe4ff">${n}</text>` : ""}`).join("");
  return `<svg viewBox="-4 -4 108 108" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${c.zh}" data-const="${c.id}"><rect x="-4" y="-4" width="108" height="108" rx="10" fill="#171a3c"/>${stars(hash(c.id), 40)}${lines}${dots}</svg>`;
}
/** how to find the Pole Star: the two pointer stars of the Big Dipper, five times their distance, and the W of Cassiopeia on the other side */
export function finderSvg(bear: Const): string {
  const s = 0.8, dx = 12.4, dy = 56.2, P = (i: number): [number, number] => [bear.stars[i][0] * s + dx, bear.stars[i][1] * s + dy];
  const dub = P(0), mer = P(1), pol: [number, number] = [mer[0] + 5.2 * (dub[0] - mer[0]), mer[1] + 5.2 * (dub[1] - mer[1])];
  const lines = bear.lines.map(([a, b]) => `<line x1="${P(a)[0]}" y1="${P(a)[1]}" x2="${P(b)[0]}" y2="${P(b)[1]}" stroke="#a5b4fc" stroke-width=".9"/>`).join("");
  const dots = bear.stars.map((_, i) => `<circle cx="${P(i)[0]}" cy="${P(i)[1]}" r="2" fill="#fff"/>`).join("");
  const w = [[6, 10], [14, 22], [22, 12], [30, 24], [38, 10]];
  return `<svg viewBox="0 0 100 115" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Polaris" data-finder="1"><rect width="100" height="115" rx="10" fill="#171a3c"/>${stars(77, 36)}${lines}${dots}
  <line x1="${mer[0]}" y1="${mer[1]}" x2="${pol[0]}" y2="${pol[1]}" stroke="#ffd43b" stroke-width="1" stroke-dasharray="3 2"/>
  <circle cx="${pol[0]}" cy="${pol[1]}" r="5" fill="#ffd43b" opacity=".3"/><circle cx="${pol[0]}" cy="${pol[1]}" r="2.6" fill="#ffd43b"/>
  ${w.slice(1).map((p, i) => `<line x1="${w[i][0]}" y1="${w[i][1]}" x2="${p[0]}" y2="${p[1]}" stroke="#a5b4fc" stroke-width=".9"/>`).join("")}${w.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="1.8" fill="#fff"/>`).join("")}
  <line x1="${w[2][0]}" y1="${w[2][1]}" x2="${pol[0]}" y2="${pol[1]}" stroke="#ffd43b" stroke-width=".8" stroke-dasharray="2 2" opacity=".7"/></svg>`;
}

// ---------- the icon of the science home ----------
export const spaceIcon = (): SVGSVGElement => {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 64 64"); s.setAttribute("aria-hidden", "true"); s.setAttribute("focusable", "false"); s.setAttribute("class", "sp-ico");
  s.innerHTML = `<defs><radialGradient id="spg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ffd8a8"/><stop offset="1" stop-color="#f08c00"/></radialGradient></defs>
  <circle cx="32" cy="32" r="30" fill="#2b2f6b"/><circle cx="14" cy="14" r="1.6" fill="#fff"/><circle cx="50" cy="12" r="1.2" fill="#fff"/><circle cx="54" cy="44" r="1.6" fill="#fff"/><circle cx="10" cy="46" r="1.2" fill="#fff"/><circle cx="44" cy="54" r="1" fill="#fff"/>
  <ellipse cx="32" cy="34" rx="25" ry="7" fill="none" stroke="#ffe066" stroke-width="3" transform="rotate(-18 32 34)" opacity=".9"/>
  <circle cx="32" cy="32" r="12" fill="url(#spg)"/><path d="M21 31c8 3 16 3 22 0M22 37c6 2 14 2 19-1" stroke="#e8590c" stroke-width="1.6" fill="none" opacity=".55" stroke-linecap="round"/>
  <path d="M10 41 Q32 51 54 27" fill="none" stroke="#ffe066" stroke-width="3" stroke-linecap="round" transform="rotate(-18 32 34)" opacity="0"/>
  <path d="M5 38 Q32 52 59 26" fill="none" stroke="none"/>
  <circle cx="50" cy="20" r="4" fill="#dee2e6"/><circle cx="49" cy="19" r="1" fill="#adb5bd"/>`;
  return s;
};
