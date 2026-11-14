/**
 * Drag-to-label and sort-into-groups modes shared by the simulations of the biology lab's third pass (a mode of a simulation = one `DMode`).
 * - `label`: names (items) are dragged from a tray at the right onto numbered marks of a drawing (or onto numbered slots: `place: "right"` = an order task);
 * - `bucket`: statements / names are dragged from a grid at the bottom into the groups (buckets) along the top.
 * State: the flags `<prefix><i>` (1 = placed, up to 10 items per mode), `miss`, `last` (= index + 1 of the item placed last) and the held / selected item of `dnd.ts`.
 * The pure parts (`specOf`, `count`) are tested in 89-biolab; `drawDnd` only draws.
 */
import type { St } from "../phys/kit";
import { tr } from "../i18n";
import { dndPointer, placedCount, type DndSpec } from "./dnd";
import { COL, lab, rect, circle, txt, type C2 } from "./draw";

export type DMode =
  | { kind: "label"; prefix: string; items: string[]; marks: [number, number][]; fn?: string[]; place?: "below" | "right" }
  | { kind: "bucket"; prefix: string; items: string[]; answers: number[]; buckets: string[]; fn?: string[] };

export const TRAY_X = 548;
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** the order in which the items rest in the tray / grid: a fixed shuffle (a step coprime to n) so that the order never gives the answer away */
export const trayIndex = (i: number, n: number): number => { const step = [3, 5, 7, 1].find((k) => gcd(k, n) === 1)!; return (i * step + 1) % n; };
const trayPos = (i: number, n: number): [number, number] => [TRAY_X, 46 + trayIndex(i, n) * Math.min(56, 400 / n)];
const BCOLS = 4;
const bucketBox = (m: Extract<DMode, { kind: "bucket" }>, j: number) => { const nb = m.buckets.length, w = 640 / nb; return { x: w * j + w / 2, y: 140, hw: w / 2 - 5, hh: 92 }; };
const gridPos = (m: Extract<DMode, { kind: "bucket" }>, i: number): [number, number] => { const k = trayIndex(i, m.items.length); return [84 + 157 * (k % BCOLS), 308 + 74 * Math.floor(k / BCOLS)]; };

export const specOf = (m: DMode): DndSpec =>
  m.kind === "label"
    ? { n: m.items.length, prefix: m.prefix, hit: [88, 24], at: (i) => trayPos(i, m.items.length), answer: (i) => i, targets: () => m.marks.map(([x, y]) => ({ x, y, hw: 26, hh: 26 })) }
    : { n: m.items.length, prefix: m.prefix, hit: [76, 32], at: (i) => gridPos(m, i), answer: (i) => m.answers[i], targets: () => m.buckets.map((_, j) => bucketBox(m, j)) };

export const dndFlags = (prefixes: string[]): St => { const o: St = { h: -1, hx: 0, hy: 0, sel: -1, miss: 0, mv: 0, last: 0 }; for (const p of prefixes) for (let i = 0; i < 10; i++) o[`${p}${i}`] = 0; return o; };
export const dndClear = (s: St, prefixes: string[]) => { s.h = -1; s.sel = -1; s.mv = 0; s.last = 0; s.miss = 0; for (const p of prefixes) for (let i = 0; i < 10; i++) s[`${p}${i}`] = 0; };
export const count = (s: St, m: DMode | null) => (m ? placedCount(s, m.items.length, m.prefix) : 0);
export const allPlaced = (s: St, m: DMode) => count(s, m) === m.items.length;
/** the pointer handler of a simulation whose current mode may be a drag mode (null = this mode has none) */
export const dndPtr = (modeOf: (s: St) => DMode | null) => (kind: "down" | "move" | "up", x: number, y: number, s: St): Partial<St> | void => {
  const m = modeOf(s); if (!m) return;
  const sp = specOf(m), r = dndPointer(sp)(kind, x, y, s);
  if (r) for (let i = 0; i < sp.n; i++) if (r[`${m.prefix}${i}`] === 1) r.last = i + 1;
  return r;
};
/** readouts of a drag mode */
export const dndReadouts = (s: St, m: DMode) => {
  const it = s.last ? s.last - 1 : -1;
  const name = it < 0 ? "—" : m.kind === "bucket" ? m.buckets[m.answers[it]] : m.items[it];
  const rows = [{ label: "已放对", value: `${count(s, m)} / ${m.items.length}` }, { label: "失误", value: String(s.miss), unit: "次" }, { label: "最后放对", value: name }];
  if (m.fn && it >= 0) rows.push({ label: "说明", value: m.fn[it] });
  return rows;
};

/** a paragraph translated and wrapped (by words where the language has spaces, else by characters) */
export function para(c: C2, zh: string, x: number, y: number, maxW: number, size: number, color: string = COL.ink, align: CanvasTextAlign = "center", lineH = size * 1.15, weight = 800): number {
  const t = tr(zh); c.font = `${weight} ${size}px system-ui, sans-serif`;
  const cjk = /[\u3000-\u9fff\uff00-\uffef]/.test(t), words = cjk ? [...t] : t.split(/\s+/), sep = cjk ? "" : " ";
  const lines: string[] = []; let cur = "";
  for (const w of words) { const test = cur ? cur + sep + w : w; if (cur && c.measureText(test).width > maxW) { lines.push(cur); cur = w; } else cur = test; }
  if (cur) lines.push(cur);
  const top = y - ((lines.length - 1) * lineH) / 2;
  lines.forEach((ln, i) => txt(c, ln, x, top + i * lineH, size, color, align, weight));
  return lines.length;
}
/** a rounded chip holding a wrapped label; the type size shrinks until the label fits */
export function chipP(c: C2, zh: string, x: number, y: number, w: number, h: number, fill: string, stroke: string = COL.ink, size = 17, color: string = COL.ink) {
  rect(c, x, y, w, h, fill, stroke, 3, 12);
  const t = tr(zh);
  for (let s = size; s >= 9; s--) {
    c.font = `800 ${s}px system-ui, sans-serif`; const cjk = /[\u3000-\u9fff\uff00-\uffef]/.test(t), words = cjk ? [...t] : t.split(/\s+/), sep = cjk ? "" : " ";
    let n = 1, cur = "";
    for (const wd of words) { const test = cur ? cur + sep + wd : wd; if (cur && c.measureText(test).width > w - 12) { n++; cur = wd; } else cur = test; }
    if (n * s * 1.15 <= h - 6 || s === 9) { para(c, zh, x + w / 2, y + h / 2 + 1, w - 12, s, color); return; }
  }
}

/** the marks / the tray / the buckets of a mode (the background drawing is the simulation's own) */
export function drawDnd(c: C2, s: St, m: DMode) {
  const sp = specOf(m), n = m.items.length;
  if (m.kind === "label") {
    const right = m.place === "right";
    m.marks.forEach(([mx, my], i) => {
      const done = s[`${m.prefix}${i}`] === 1;
      circle(c, mx, my, 15, done ? "#b2f2bb" : "#fff", done ? COL.green : COL.ink, 3); txt(c, String(i + 1), mx, my + 1, 17, COL.ink);
      if (done) {
        const t = tr(m.items[i]);
        if (right) chipP(c, m.items[i], mx + 24, my - 22, 292, 44, "#ebfbee", COL.green, 16, "#1b7a32");
        else { const w = Math.min(190, 24 + 11 * t.length); rect(c, mx - w / 2, my + 20, w, 28, "#fff", COL.green, 2, 9); lab(c, m.items[i], mx, my + 35, 15, "#1b7a32"); }
      }
    });
    for (let i = 0; i < n; i++) {
      if (s[`${m.prefix}${i}`] || s.h === i) continue;
      const [tx, ty] = sp.at(i, s), sel = s.sel === i; chipP(c, m.items[i], tx - 88, ty - 22, 176, 44, sel ? "#fff3bf" : "#f3f0ff", sel ? COL.orange : COL.nucleus, 18);
    }
    if (s.h >= 0) chipP(c, m.items[s.h], s.hx - 88, s.hy - 22, 176, 44, "#ffe8cc", COL.orange, 18);
    if (s.sel >= 0) lab(c, "再点图中的标记", TRAY_X, 462, 15, COL.orange);
    return;
  }
  const fills = ["#fff0f6", "#fff4e6", "#f4fce3", "#e7f5ff", "#f3f0ff", "#e6fcf5"];
  m.buckets.forEach((nm, j) => {
    const b = sp.targets(s)[j], got = m.answers.map((a, i) => (a === j && s[`${m.prefix}${i}`] ? i : -1)).filter((i) => i >= 0);
    rect(c, b.x - b.hw, b.y - b.hh, 2 * b.hw, 2 * b.hh, fills[j % 6], COL.grey, 2, 14);
    para(c, nm, b.x, b.y - b.hh + 24, 2 * b.hw - 8, 17, COL.purple);
    got.forEach((_, k) => circle(c, b.x - b.hw + 22 + 24 * (k % Math.max(1, Math.floor((2 * b.hw - 20) / 24))), b.y - 8 + 28 * Math.floor(k / Math.max(1, Math.floor((2 * b.hw - 20) / 24))), 10, "#b2f2bb", COL.green, 2.5));
  });
  for (let i = 0; i < n; i++) {
    if (s[`${m.prefix}${i}`] || s.h === i) continue;
    const [x, y] = sp.at(i, s), sel = s.sel === i; chipP(c, m.items[i], x - 76, y - 32, 152, 64, sel ? "#fff3bf" : "#fff", sel ? COL.orange : COL.nucleus, 15);
  }
  if (s.h >= 0) chipP(c, m.items[s.h], s.hx - 76, s.hy - 32, 152, 64, "#ffe8cc", COL.orange, 15);
  if (s.sel >= 0) lab(c, "再点上方的类别", 320, 466, 15, COL.orange);
}
/** thin leader lines from the numbered marks to the part of the drawing they point at (a small dot marks the part) */
export function leaders(c: C2, marks: [number, number][], pts: [number, number][]) {
  marks.forEach(([mx, my], i) => {
    const [px, py] = pts[i], d = Math.hypot(px - mx, py - my) || 1;
    c.beginPath(); c.moveTo(mx + ((px - mx) / d) * 15, my + ((py - my) / d) * 15); c.lineTo(px, py); c.strokeStyle = "#868e96"; c.lineWidth = 2; c.stroke();
    circle(c, px, py, 3.5, "#495057", null);
  });
}
