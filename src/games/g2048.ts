import type { GameCtx } from "./ctx";
import "./g2048.css";
import { newGame, play, cloneGrid, canMove, type Dir, type G48State, type Grid, type Trace } from "./g2048-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><rect x="18" y="18" width="40" height="40" rx="12" fill="#96f2d7" stroke="#0ca678" stroke-width="4"/><text x="38" y="46" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="22" fill="#087f5b">2</text><rect x="62" y="18" width="40" height="40" rx="12" fill="#ffd8a8" stroke="#e8590c" stroke-width="4"/><text x="82" y="46" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="22" fill="#d9480f">4</text><rect x="18" y="62" width="40" height="40" rx="12" fill="#e6fcf5" stroke="#96f2d7" stroke-width="4"/><rect x="62" y="62" width="40" height="40" rx="12" fill="#ffd43b" stroke="#f08c00" stroke-width="4"/><circle cx="74" cy="78" r="3.6" fill="#3a2e39"/><circle cx="90" cy="78" r="3.6" fill="#3a2e39"/><path d="M73 88 Q82 97 91 88" fill="none" stroke="#3a2e39" stroke-width="3.5" stroke-linecap="round"/></svg>`;

interface Tile { id: number; v: number; r: number; c: number; el: HTMLElement }
const SIZES = [4, 5, 3];
const GAP_RATIO = 0.035;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let n = SIZES.includes(ctx.store.get<number>("size", 4)) ? ctx.store.get<number>("size", 4) : 4;
  const bestKey = () => `best-${n}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);

  const scoreEl = h("span", { class: "g48-stat", id: "g48-score" }, "");
  const bestEl = h("span", { class: "g48-stat best", id: "g48-best" }, "");
  const undoBtn = h("button", { class: "mopt", id: "g48-undo", onclick: () => undo() }, "撤销");
  const sizeBtn = h("button", { class: "mopt", id: "g48-size", onclick: () => { n = SIZES[(SIZES.indexOf(n) + 1) % SIZES.length]; ctx.store.set("size", n); ctx.sfx("tap"); reset(); } }, "");
  const newBtn = h("button", { class: "mopt", id: "g48-new", onclick: () => { ctx.sfx("tap"); reset(); } }, "新游戏");
  const hud = h("div", { class: "g48-hud" }, scoreEl, bestEl, undoBtn, sizeBtn, newBtn);

  const grid = h("div", { class: "g48-grid", id: "g48-grid" });
  const tilesEl = h("div", { class: "g48-tiles" });
  const title = h("h2", {}, ""), msg = h("p", {}, "");
  const keepBtn = h("button", { class: "primary", id: "g48-keep", onclick: () => { ctx.sfx("tap"); setOvl(false); } }, "继续玩");
  const againBtn = h("button", { class: "primary", id: "g48-again", onclick: () => { ctx.sfx("tap"); reset(); } }, "");
  const ovl = h("div", { class: "g48-ovl", id: "g48-ovl" }, title, msg, h("div", { class: "g48-ovl-btns" }, keepBtn, againBtn));
  ovl.hidden = true;
  const board = h("div", { class: "g48-board", id: "g48-board" }, grid, tilesEl, ovl);
  const area = h("div", { class: "g48-area" }, board);
  root.append(h("div", { class: "g48-wrap" }, hud, area));

  let s!: G48State, snap: { grid: Grid; score: number; won: boolean; keep: boolean } | null = null;
  let tiles: Tile[] = [], nextId = 1, size = 200, keep = false, ovlKind: "" | "win" | "over" = "";
  const timers: number[] = [];

  const setOvl = (show: boolean, kind: "" | "win" | "over" = "") => { ovl.hidden = !show; ovlKind = show ? kind : ""; };
  const refreshHud = () => {
    scoreEl.textContent = `得分：${s.score}`; bestEl.textContent = `最高：${Math.max(best(), s.score)}`;
    sizeBtn.textContent = `大小：${n}×${n}`; sizeBtn.classList.toggle("on", n !== 4);
    undoBtn.disabled = !snap;
  };

  // ---- tiles ----
  const gap = () => Math.max(4, Math.round(size * GAP_RATIO));
  const cellPx = () => (size - gap() * (n + 1)) / n;
  const place = (t: Tile) => { const c = cellPx(), g = gap(); t.el.style.transform = `translate(${g + t.c * (c + g)}px, ${g + t.r * (c + g)}px)`; };
  const paintTile = (t: Tile) => {
    t.el.dataset.v = String(t.v); t.el.dataset.r = String(t.r); t.el.dataset.c = String(t.c);
    t.el.className = `g48-tile v${Math.min(t.v, 4096)}${t.v >= 8 ? " face" : ""}${String(t.v).length >= 4 ? " d4" : String(t.v).length === 3 ? " d3" : ""}`;
  };
  function makeTile(v: number, r: number, c: number, cls = ""): Tile {
    const el = h("div", { class: "g48-tile" }, h("span", { class: "g48-face" }, h("b", {}), h("b", {}), h("u", {})), h("span", { class: "g48-num" }, String(v)));
    const t: Tile = { id: nextId++, v, r, c, el };
    paintTile(t); if (cls) el.classList.add(cls);
    el.style.width = el.style.height = `${cellPx()}px`; place(t);
    tilesEl.append(el); return t;
  }
  const setValue = (t: Tile, v: number) => { t.v = v; (t.el.querySelector(".g48-num") as HTMLElement).textContent = String(v); paintTile(t); };
  const at = (r: number, c: number) => tiles.find((t) => t.r === r && t.c === c && !t.el.classList.contains("g48-dead"));
  function rebuild() {
    tilesEl.textContent = ""; tiles = [];
    s.grid.forEach((row, r) => row.forEach((v, c) => { if (v) tiles.push(makeTile(v, r, c)); }));
  }
  function layout() {
    const w = area.clientWidth, hh = area.clientHeight;
    size = Math.max(150, Math.floor(Math.min(w - 8, hh - 10)));
    board.style.width = board.style.height = `${size}px`;
    board.style.setProperty("--g48-cell", `${cellPx()}px`);
    board.style.setProperty("--g48-gap", `${gap()}px`);
    board.style.setProperty("--g48-font", `${Math.round(cellPx() * 0.42)}px`);
    grid.textContent = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const d = h("div", { class: "g48-hole" }); const cp = cellPx(), g = gap();
      d.style.cssText = `width:${cp}px;height:${cp}px;transform:translate(${g + c * (cp + g)}px,${g + r * (cp + g)}px)`; grid.append(d);
    }
    for (const t of tiles) { t.el.style.width = t.el.style.height = `${cellPx()}px`; place(t); }
  }

  function reset() {
    timers.splice(0).forEach(clearTimeout);
    s = newGame(n); snap = null; keep = false; setOvl(false);
    layout(); rebuild(); refreshHud();
  }
  function undo() {
    if (!snap) return;
    timers.splice(0).forEach(clearTimeout);
    s.grid = cloneGrid(snap.grid); s.score = snap.score; s.won = snap.won; s.over = false; keep = snap.keep; snap = null;
    setOvl(false); rebuild(); refreshHud(); ctx.sfx("swap");
  }

  function animate(trace: Trace[], merges: [number, number][], spawned: { r: number; c: number; v: number } | null) {
    // every tile slides; a pair that merges slides onto the same cell, then the pair is replaced by one bigger tile
    const dying: Tile[] = [], survivors: Tile[] = [];
    for (const tr of trace) {
      const t = at(tr.from[0], tr.from[1]); if (!t) continue;
      t.r = tr.to[0]; t.c = tr.to[1]; place(t);
      (tr.merged ? dying : survivors).push(t);
    }
    const pairs = new Map<string, Tile[]>();
    for (const t of dying) { const k = t.r + "," + t.c; pairs.set(k, [...(pairs.get(k) || []), t]); }
    for (const [, [a, b]] of pairs) {
      b.el.classList.add("g48-dead"); a.el.classList.add("g48-dead");
      const m = makeTile(a.v * 2, a.r, a.c, "g48-hidden"); tiles.push(m);
      timers.push(window.setTimeout(() => { a.el.remove(); b.el.remove(); tiles = tiles.filter((x) => x !== a && x !== b); m.el.classList.remove("g48-hidden"); m.el.classList.add("g48-merge"); }, 110));
    }
    if (spawned) tiles.push(makeTile(spawned.v, spawned.r, spawned.c, "g48-born"));
    void merges;
  }

  function move(d: Dir) {
    if (s.over || !ovl.hidden) return;
    const before = { grid: cloneGrid(s.grid), score: s.score, won: s.won, keep };
    const r = play(s, d);
    if (!r.moved) { board.classList.remove("g48-nudge"); void board.offsetWidth; board.classList.add("g48-nudge"); return; }
    snap = before;
    animate(r.trace, r.merges, r.spawned);
    ctx.sfx(r.merges.length ? (r.gained >= 128 ? "good" : "pop") : "move");
    const old = best(); if (s.score > old) ctx.store.set(bestKey(), s.score);
    refreshHud();
    if (r.reached && !keep) {
      keep = true; ctx.sfx("win");
      timers.push(window.setTimeout(() => { title.textContent = "太棒了！"; msg.textContent = `你合成了 ${s.target}！`; againBtn.textContent = "新游戏"; keepBtn.hidden = false; setOvl(true, "win"); }, 450));
    } else if (s.over) {
      const newBest = s.score > old && s.score > 0;
      ctx.sfx("lose");
      timers.push(window.setTimeout(() => { title.textContent = "游戏结束"; msg.textContent = newBest ? `新纪录：${s.score}` : `得分：${s.score}`; againBtn.textContent = "再玩一次"; keepBtn.hidden = true; setOvl(true, "over"); }, 650));
    }
  }

  // ---- input ----
  const KEYS: Record<string, Dir> = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R", w: "U", W: "U", s: "D", S: "D", a: "L", A: "L", d: "R", D: "R" };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const d = KEYS[e.key];
    if (d) { e.preventDefault(); move(d); return; }
    if (e.key === "z" || e.key === "Z" || e.key === "Backspace") { e.preventDefault(); undo(); }
    else if (e.key === "Enter" && !ovl.hidden) { e.preventDefault(); if (ovlKind === "win") { setOvl(false); } else reset(); }
    else if (e.key === "n" || e.key === "N") reset();
  };
  let sx = 0, sy = 0, sid = -1;
  const onDown = (e: PointerEvent) => { if (e.target instanceof HTMLButtonElement) return; sid = e.pointerId; sx = e.clientX; sy = e.clientY; try { board.setPointerCapture(e.pointerId); } catch { /* ok */ } };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== sid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) < Math.max(18, size * 0.07) && Math.abs(dy) < Math.max(18, size * 0.07)) return;
    sid = -1; move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U"));
  };
  const onUp = (e: PointerEvent) => { if (e.pointerId === sid) sid = -1; };
  document.addEventListener("keydown", onKey);
  board.addEventListener("pointerdown", onDown); board.addEventListener("pointermove", onMove); board.addEventListener("pointerup", onUp); board.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(area);

  reset();
  (window as unknown as Record<string, unknown>).__g2048 = { state: () => s, canMove: () => canMove(s.grid), size: () => size, move, setGrid: (g: Grid) => { s.grid = cloneGrid(g); s.over = !canMove(s.grid); rebuild(); refreshHud(); } };
  return () => {
    timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__g2048;
  };
}
