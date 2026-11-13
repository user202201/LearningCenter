/**
 * The scratch paper (演草纸) of the math game: a squared sheet the child writes on with a finger, a pencil (Apple Pencil) or the mouse, to work a sum out. Pen,
 * eraser, undo, clear; the paper is cleared by the game for every new question. Strokes are kept as points so that the sheet is redrawn crisply when the screen
 * size changes. With a pencil, fingers (palms) are ignored. Nothing is saved or sent.
 */
import { h } from "./ui";

interface Stroke { erase: boolean; color: string; width: number; pts: [number, number, number][] }
const COLORS = ["#1c3d7a", "#c92a2a"];

export interface Pad { el: HTMLElement; clear(): void; dispose(): void }

export function createPad(): Pad {
  const canvas = h("canvas", { class: "pad-canvas", id: "pad-canvas", "aria-label": "演草纸" }) as HTMLCanvasElement;
  let strokes: Stroke[] = [];
  let cur: Stroke | null = null;
  let tool: "pen" | "eraser" = "pen", color = COLORS[0];
  let penSeen = false, active: number | null = null;
  const ctx2d = () => canvas.getContext("2d")!;

  const size = () => {
    const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * dpr)), hh = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    redraw();
  };
  const line = (c: CanvasRenderingContext2D, s: Stroke, dpr: number) => {
    c.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    c.strokeStyle = s.erase ? "#000" : s.color; c.fillStyle = c.strokeStyle; c.lineCap = "round"; c.lineJoin = "round";
    const p = s.pts;
    if (p.length === 1) { c.beginPath(); c.arc(p[0][0] * dpr, p[0][1] * dpr, (s.width * (0.4 + p[0][2])) * dpr / 2, 0, Math.PI * 2); c.fill(); return; }
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      c.lineWidth = s.width * (0.45 + (a[2] + b[2]) / 2) * dpr;
      c.beginPath();
      const pm = i > 1 ? [(p[i - 2][0] + a[0]) / 2, (p[i - 2][1] + a[1]) / 2] : [a[0], a[1]];
      c.moveTo(pm[0] * dpr, pm[1] * dpr); c.quadraticCurveTo(a[0] * dpr, a[1] * dpr, m[0] * dpr, m[1] * dpr);
      c.stroke();
    }
  };
  const redraw = () => {
    const c = ctx2d(), dpr = window.devicePixelRatio || 1;
    c.globalCompositeOperation = "source-over"; c.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => line(c, s, dpr));
    if (cur) line(c, cur, dpr);
    canvas.dataset.strokes = String(strokes.length + (cur ? 1 : 0));
  };
  const pos = (e: PointerEvent): [number, number, number] => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top, e.pointerType === "pen" && e.pressure > 0 ? e.pressure : 0.5]; };
  canvas.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "pen") penSeen = true;
    if (active !== null || (penSeen && e.pointerType === "touch") || (e.pointerType === "mouse" && e.button !== 0)) return;   // one finger / pencil at a time; palms are ignored once a pencil was used
    e.preventDefault(); active = e.pointerId;
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic */ }
    cur = { erase: tool === "eraser", color, width: tool === "eraser" ? 26 : 3.4, pts: [pos(e)] };
    redraw();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!cur || e.pointerId !== active) return;
    const evs = (e as PointerEvent & { getCoalescedEvents?: () => PointerEvent[] }).getCoalescedEvents?.() ?? [e];
    for (const ev of evs.length ? evs : [e]) cur.pts.push(pos(ev));
    redraw();
  });
  const end = (e: PointerEvent) => { if (e.pointerId !== active) return; active = null; if (cur) { strokes.push(cur); cur = null; } redraw(); };
  for (const t of ["pointerup", "pointercancel", "lostpointercapture"]) canvas.addEventListener(t, (e) => end(e as PointerEvent));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());

  const btn = (label: string, id: string, on: () => void) => h("button", { class: "pad-btn", id, onclick: on }, label);
  const penBtn = btn("画笔", "pad-pen", () => set("pen")), eraserBtn = btn("橡皮", "pad-eraser", () => set("eraser"));
  const colorBtns = COLORS.map((c, i) => h("button", { class: "pad-color" + (i === 0 ? " on" : ""), id: `pad-color-${i}`, style: `background:${c}`, "aria-label": c, onclick: () => { color = c; set("pen"); } }));
  const set = (t: "pen" | "eraser") => { tool = t; penBtn.classList.toggle("on", t === "pen"); eraserBtn.classList.toggle("on", t === "eraser"); colorBtns.forEach((b, i) => b.classList.toggle("on", t === "pen" && COLORS[i] === color)); };
  set("pen");
  const undo = btn("撤销", "pad-undo", () => { strokes.pop(); redraw(); });
  const clearBtn = btn("清空", "pad-clear", () => clear());
  const clear = () => { strokes = []; cur = null; active = null; redraw(); };
  const el = h("div", { class: "pad", id: "pad" },
    h("div", { class: "pad-bar" }, h("b", { class: "pad-title" }, "演草纸"), penBtn, ...colorBtns, eraserBtn, undo, clearBtn),
    h("div", { class: "pad-sheet" }, canvas));
  const ro = new ResizeObserver(() => size());
  ro.observe(canvas);
  window.requestAnimationFrame(size);
  return { el, clear, dispose() { ro.disconnect(); } };
}
