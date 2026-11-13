/** Drawing helpers of the physics lab (canvas, flat cartoon style, only Latin letters and digits as text). */
export const COL = { ink: "#2d2230", blue: "#1c7ed6", red: "#e03131", green: "#2f9e44", orange: "#f76707", purple: "#7048e8", teal: "#0ca678", yellow: "#fcc419", grey: "#868e96", pale: "#f3f0ff", water: "#a5d8ff", water2: "#74c0fc", wood: "#d9a066", metal: "#adb5bd", paper: "#fff8db", pink: "#f06595" };
export type C2 = CanvasRenderingContext2D;
const FONT = "ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
export function txt(c: C2, s: string, x: number, y: number, size = 22, color = COL.ink, align: CanvasTextAlign = "center", weight = 800) {
  c.font = `${weight} ${size}px ${FONT}`; c.fillStyle = color; c.textAlign = align; c.textBaseline = "middle"; c.fillText(s, x, y);
}
export function line(c: C2, x1: number, y1: number, x2: number, y2: number, color = COL.ink, w = 3, dash: number[] = []) {
  c.beginPath(); c.setLineDash(dash); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = w; c.stroke(); c.setLineDash([]);
}
export function arrow(c: C2, x1: number, y1: number, x2: number, y2: number, color = COL.red, w = 4) {
  const len = Math.hypot(x2 - x1, y2 - y1); if (len < 2) return;
  const a = Math.atan2(y2 - y1, x2 - x1), s = Math.min(14, len * 0.5);
  const bx = x2 - s * 0.8 * Math.cos(a), by = y2 - s * 0.8 * Math.sin(a);
  line(c, x1, y1, bx, by, color, w);
  c.beginPath(); c.moveTo(x2, y2); c.lineTo(x2 - s * Math.cos(a - 0.5), y2 - s * Math.sin(a - 0.5)); c.lineTo(x2 - s * Math.cos(a + 0.5), y2 - s * Math.sin(a + 0.5)); c.closePath(); c.fillStyle = color; c.fill();
}
export function rect(c: C2, x: number, y: number, w: number, h: number, fill: string, stroke: string | null = COL.ink, lw = 3, r = 6) {
  c.beginPath(); c.roundRect(x, y, w, h, r); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
export function circle(c: C2, x: number, y: number, r: number, fill: string, stroke: string | null = COL.ink, lw = 3) {
  c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
export function poly(c: C2, pts: [number, number][], fill: string, stroke: string | null = COL.ink, lw = 3) {
  c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
/** a plot box with axes, ticks and labels; returns the mapping from data to drawing units */
export interface Plot { x0: number; y0: number; w: number; h: number; xmax: number; ymin: number; ymax: number; X(v: number): number; Y(v: number): number }
export function axes(c: C2, x0: number, y0: number, w: number, h: number, xmax: number, ymax: number, xl: string, yl: string, ymin = 0, ticks = 4): Plot {
  const P: Plot = { x0, y0, w, h, xmax, ymin, ymax, X: (v) => x0 + (v / xmax) * w, Y: (v) => y0 + h - ((v - ymin) / (ymax - ymin)) * h };
  rect(c, x0, y0, w, h, "#fff", "#d0bfff", 2, 4);
  c.font = `700 16px ${FONT}`;
  for (let i = 0; i <= ticks; i++) {
    const gx = x0 + (w * i) / ticks, gy = y0 + (h * i) / ticks;
    line(c, gx, y0, gx, y0 + h, "#ece6ff", 1.5); line(c, x0, gy, x0 + w, gy, "#ece6ff", 1.5);
    txt(c, trim(xmax * i / ticks), gx, y0 + h + 14, 15, COL.grey);
    txt(c, trim(ymin + (ymax - ymin) * (ticks - i) / ticks), x0 - 6, gy, 15, COL.grey, "right");
  }
  if (ymin < 0) line(c, x0, P.Y(0), x0 + w, P.Y(0), COL.grey, 2);
  txt(c, xl, x0 + w, y0 + h + 32, 17, COL.ink, "right"); txt(c, yl, x0, y0 - 11, 17, COL.ink, "left");
  return P;
}
const trim = (v: number) => (Math.abs(v) >= 100 ? v.toFixed(0) : String(Math.round(v * 10) / 10));
export function curve(c: C2, P: Plot, f: (x: number) => number, color: string, xmax = P.xmax, n = 160, w = 4) {
  c.beginPath(); let first = true;
  for (let i = 0; i <= n; i++) { const x = (xmax * i) / n; const y = f(x); const px = P.X(x), py = Math.min(P.y0 + P.h + 4, Math.max(P.y0 - 4, P.Y(y))); if (first) { c.moveTo(px, py); first = false; } else c.lineTo(px, py); }
  c.strokeStyle = color; c.lineWidth = w; c.stroke();
}
/** a coil spring between two heights (vertical) */
export function spring(c: C2, x: number, y1: number, y2: number, coils = 10, amp = 14, color = COL.grey) {
  c.beginPath(); c.moveTo(x, y1);
  const n = coils * 2;
  for (let i = 1; i < n; i++) c.lineTo(x + (i % 2 ? amp : -amp), y1 + ((y2 - y1) * i) / n);
  c.lineTo(x, y2); c.strokeStyle = color; c.lineWidth = 4; c.stroke();
}
export const skyBg = (c: C2, w: number, h: number, a = "#e7f5ff", b = "#fff") => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); c.fillStyle = g; c.fillRect(0, 0, w, h); };
