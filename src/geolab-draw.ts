/** Drawing helpers of the geography lab: a latitude / longitude frame (equirectangular), rough continents, region boxes. Canvas text is Latin / digits only. */
import { COL, line, txt, rect, poly, type C2 } from "./phys/draw";
export { COL, line, txt, rect, poly, circle, arrow } from "./phys/draw";
export type { C2 } from "./phys/draw";
export interface Frame { x0: number; y0: number; w: number; h: number; lonW: number; lonE: number; latS: number; latN: number; X(lon: number): number; Y(lat: number): number; lon(x: number): number; lat(y: number): number }
export function frame(x0: number, y0: number, w: number, h: number, lonW: number, lonE: number, latS: number, latN: number): Frame {
  return { x0, y0, w, h, lonW, lonE, latS, latN, X: (l) => x0 + ((l - lonW) / (lonE - lonW)) * w, Y: (l) => y0 + ((latN - l) / (latN - latS)) * h, lon: (x) => lonW + ((x - x0) / w) * (lonE - lonW), lat: (y) => latN - ((y - y0) / h) * (latN - latS) };
}
/** rough outlines in [lon, lat] (schematic: for finding places, not for borders) */
export const CONT: [number, number][][] = [
  [[-168, 66], [-140, 70], [-125, 70], [-95, 72], [-80, 68], [-62, 60], [-55, 50], [-66, 44], [-76, 35], [-81, 25], [-88, 30], [-97, 26], [-97, 18], [-87, 15], [-80, 8], [-92, 14], [-105, 20], [-117, 32], [-124, 40], [-125, 49], [-135, 58], [-152, 60], [-165, 62]],
  [[-80, 9], [-62, 11], [-50, 0], [-35, -6], [-40, -22], [-58, -38], [-66, -55], [-73, -50], [-72, -30], [-81, -5]],
  [[-55, 60], [-45, 60], [-20, 70], [-20, 82], [-60, 82], [-70, 76]],
  [[-10, 36], [-9, 43], [-4, 48], [8, 54], [10, 58], [22, 70], [40, 68], [60, 70], [80, 74], [110, 77], [140, 72], [170, 69], [180, 66], [160, 58], [140, 52], [128, 40], [122, 38], [122, 30], [110, 20], [106, 10], [100, 2], [98, 10], [92, 22], [80, 14], [75, 8], [68, 22], [57, 25], [58, 17], [44, 12], [35, 28], [35, 36], [27, 37], [22, 36], [18, 40], [12, 44], [8, 44], [3, 43], [-6, 36]],
  [[-17, 15], [-10, 30], [-6, 36], [10, 37], [32, 31], [35, 28], [43, 12], [51, 12], [40, -5], [40, -15], [35, -25], [20, -35], [15, -25], [12, -15], [9, 0], [8, 4], [-8, 4], [-17, 14]],
  [[114, -22], [122, -18], [131, -12], [142, -11], [146, -19], [153, -27], [150, -37], [140, -38], [130, -32], [115, -34]],
  [[-180, -70], [180, -70], [180, -90], [-180, -90]],
];
export function drawWorld(c: C2, f: Frame, opts: { zones?: boolean; step?: number; labels?: boolean } = {}): void {
  rect(c, f.x0, f.y0, f.w, f.h, "#d0ebff", COL.ink, 3, 0);
  if (opts.zones) {
    const band = (a: number, b: number, col: string) => { c.fillStyle = col; c.fillRect(f.x0, f.Y(Math.min(b, f.latN)), f.w, f.Y(Math.max(a, f.latS)) - f.Y(Math.min(b, f.latN))); };
    band(-23.5, 23.5, "#ffe8cc"); band(23.5, 66.5, "#e6fcf5"); band(-66.5, -23.5, "#e6fcf5"); band(66.5, 90, "#e7f5ff"); band(-90, -66.5, "#e7f5ff");
  }
  c.save(); c.beginPath(); c.rect(f.x0, f.y0, f.w, f.h); c.clip();
  for (const poly0 of CONT) { c.beginPath(); poly0.forEach(([lo, la], i) => (i ? c.lineTo(f.X(lo), f.Y(la)) : c.moveTo(f.X(lo), f.Y(la)))); c.closePath(); c.fillStyle = "#b2f2bb"; c.fill(); c.strokeStyle = "#2f9e44"; c.lineWidth = 2; c.stroke(); }
  c.restore();
  const st = opts.step ?? 30;
  for (let lo = Math.ceil(f.lonW / st) * st; lo <= f.lonE; lo += st) { line(c, f.X(lo), f.y0, f.X(lo), f.y0 + f.h, "#74c0fc", lo === 0 ? 3 : 1.5); if (opts.labels !== false) txt(c, String(Math.abs(lo)), f.X(lo), f.y0 + f.h + 11, 13, COL.grey); }
  for (let la = Math.ceil(f.latS / st) * st; la <= f.latN; la += st) { line(c, f.x0, f.Y(la), f.x0 + f.w, f.Y(la), "#74c0fc", la === 0 ? 3 : 1.5); if (opts.labels !== false) txt(c, String(Math.abs(la)), f.x0 - 12, f.Y(la), 13, COL.grey); }
}
export function box(c: C2, f: Frame, b: [number, number, number, number], col = COL.red): void {
  let x1 = f.X(b[2]), x2 = f.X(b[3]), y1 = f.Y(b[1]), y2 = f.Y(b[0]);
  if (x2 - x1 < 12) { const m = (x1 + x2) / 2; x1 = m - 6; x2 = m + 6; }
  if (y2 - y1 < 12) { const m = (y1 + y2) / 2; y1 = m - 6; y2 = m + 6; }
  c.fillStyle = col + "33"; c.fillRect(x1, y1, x2 - x1, y2 - y1); c.strokeStyle = col; c.lineWidth = 4; c.strokeRect(x1, y1, x2 - x1, y2 - y1);
}
export function pin(c: C2, x: number, y: number, col = COL.red): void {
  c.beginPath(); c.arc(x, y, 9, 0, Math.PI * 2); c.fillStyle = col; c.fill(); c.strokeStyle = "#fff"; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.arc(x, y, 14, 0, Math.PI * 2); c.strokeStyle = col; c.lineWidth = 2; c.stroke();
}
