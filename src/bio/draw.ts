/** Drawing helpers of the biology lab: the physics lab's, plus text that is translated when it is drawn (the labels of a canvas are Chinese words of the course). */
import { tr } from "../i18n";
import { txt as ptxt, COL as PCOL, type C2 } from "../phys/draw";
export * from "../phys/draw";
export const COL = { ...PCOL, leaf: "#51cf66", leaf2: "#2f9e44", cyto: "#d3f9d8", nucleus: "#9775fa", wall: "#37b24d", blood: "#e03131", vein: "#4263eb", skin: "#ffd8a8", cream: "#fff9db" };
/** a label: translated by the page language at the moment it is drawn */
export const lab = (c: C2, zh: string, x: number, y: number, size = 20, color: string = COL.ink, align: CanvasTextAlign = "center", weight = 800) => ptxt(c, tr(zh), x, y, size, color, align, weight);
/** a rounded chip with a label */
export function chip(c: C2, zh: string, x: number, y: number, w: number, h: number, fill: string, stroke: string = COL.ink, size = 20, color: string = COL.ink) {
  c.beginPath(); c.roundRect(x, y, w, h, 12); c.fillStyle = fill; c.fill(); c.strokeStyle = stroke; c.lineWidth = 3; c.stroke();
  let s = size; c.font = `800 ${s}px system-ui, sans-serif`; const t = tr(zh);
  while (s > 11 && c.measureText(t).width > w - 10) { s -= 1; c.font = `800 ${s}px system-ui, sans-serif`; }
  ptxt(c, t, x + w / 2, y + h / 2 + 1, s, color);
}
export const ell = (c: C2, x: number, y: number, rx: number, ry: number, fill: string, stroke: string | null = COL.ink, lw = 3, rot = 0) => {
  c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
};
/** a slightly blurred look without ctx.filter (Safari): the same shape drawn at small offsets with a low alpha */
export function ghost(c: C2, amount: number, draw: () => void) {
  if (amount < 0.4) { draw(); return; }
  c.save(); c.globalAlpha = 0.28;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [0.7, 0.7]]) { c.save(); c.translate(dx * amount, dy * amount); draw(); c.restore(); }
  c.restore();
}
