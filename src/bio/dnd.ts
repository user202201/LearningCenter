/**
 * Pure logic of the drag-and-drop simulations (labels onto a cell, items onto levels, organisms onto groups): items are picked up by a finger / the mouse and dropped on a target.
 * State keys (all numbers, so that the tests can set them): `h` the item held (-1 none), `hx` `hy` where it is, `sel` the item selected by a tap (-1 none),
 * `ok<i>` = 1 when item i is placed on its right target, `miss` = the number of wrong drops, `mv` = 1 once the held item has moved (a tap is a press without moving).
 * A wrong drop does not place anything: the item goes back and `miss` grows. A tap on an item and then a tap on a target does the same as a drag.
 */
import type { St } from "../phys/kit";
export interface DndSpec {
  n: number;
  /** where item i rests (drawing units) and the half size of its hit box */
  at(i: number, s: St): [number, number];
  hit: [number, number];
  /** the target boxes: centre and half size */
  targets(s: St): { x: number; y: number; hw: number; hh: number }[];
  /** the right target of item i */
  answer(i: number, s: St): number;
  /** keys of the placed flags: `${prefix}${i}` */
  prefix: string;
}
export const dndInit = (n: number, prefix: string): St => { const o: St = { h: -1, hx: 0, hy: 0, sel: -1, miss: 0, mv: 0 }; for (let i = 0; i < n; i++) o[`${prefix}${i}`] = 0; return o; };
export const placedCount = (s: St, n: number, prefix: string) => { let c = 0; for (let i = 0; i < n; i++) c += s[`${prefix}${i}`] ? 1 : 0; return c; };
const inBox = (x: number, y: number, b: { x: number; y: number; hw: number; hh: number }) => Math.abs(x - b.x) <= b.hw && Math.abs(y - b.y) <= b.hh;
export const targetAt = (spec: DndSpec, s: St, x: number, y: number): number => spec.targets(s).findIndex((b) => inBox(x, y, b));
export const itemAt = (spec: DndSpec, s: St, x: number, y: number): number => {
  for (let i = spec.n - 1; i >= 0; i--) { if (s[`${spec.prefix}${i}`]) continue; const [cx, cy] = spec.at(i, s); if (Math.abs(x - cx) <= spec.hit[0] && Math.abs(y - cy) <= spec.hit[1]) return i; }
  return -1;
};
/** drop item i on target t: right = placed, wrong = counted */
export function drop(spec: DndSpec, s: St, i: number, t: number): Partial<St> {
  if (t < 0) return {};
  if (spec.answer(i, s) === t) return { [`${spec.prefix}${i}`]: 1, sel: -1 };
  return { miss: s.miss + 1, sel: -1 };
}
export function dndPointer(spec: DndSpec) {
  return (kind: "down" | "move" | "up", x: number, y: number, s: St): Partial<St> | void => {
    if (kind === "down") {
      const i = itemAt(spec, s, x, y);
      if (i >= 0) return { h: i, hx: x, hy: y, mv: 0 };
      if (s.sel >= 0) { const t = targetAt(spec, s, x, y); if (t >= 0) return drop(spec, s, s.sel, t); }
      return { sel: -1 };
    }
    if (kind === "move") { if (s.h < 0) return; return { hx: x, hy: y, mv: 1 }; }
    if (s.h < 0) return;
    const i = s.h, t = targetAt(spec, s, x, y);
    if (!s.mv && t < 0) return { h: -1, sel: s.sel === i ? -1 : i };   // a tap: select (or unselect)
    return { h: -1, mv: 0, ...drop(spec, s, i, t) };
  };
}
