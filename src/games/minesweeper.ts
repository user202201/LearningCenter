/** 扫雷 (minesweeper): tap opens, long press / flag button / right click plants a flag, tap on a number with enough flags opens its neighbours. Rules: minesweeper-logic.ts. */
import type { GameCtx } from "./ctx";
import "./minesweeper.css";
import * as M from "./minesweeper-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/>
<g stroke="#0ca678" stroke-width="4"><rect x="18" y="18" width="38" height="38" rx="9" fill="#63e6be"/><rect x="64" y="18" width="38" height="38" rx="9" fill="#fff6e5"/><rect x="18" y="64" width="38" height="38" rx="9" fill="#63e6be"/></g>
<text x="83" y="47" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="900" fill="#1c7ed6">1</text>
<path d="M37 72 V92" stroke="#5c3d1e" stroke-width="4" stroke-linecap="round"/><path d="M37 72 L52 78 L37 85Z" fill="#fa5252" stroke="#c92a2a" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M88 66 q4 -8 11 -6" fill="none" stroke="#5c3d1e" stroke-width="3.5" stroke-linecap="round"/><circle cx="101" cy="59" r="3.5" fill="#ffd43b"/>
<circle cx="82" cy="85" r="19" fill="#495057" stroke="#212529" stroke-width="4"/><ellipse cx="74" cy="77" rx="5" ry="3" fill="#fff" opacity=".4" transform="rotate(-30 74 77)"/>
<circle cx="76" cy="84" r="4.5" fill="#fff"/><circle cx="89" cy="84" r="4.5" fill="#fff"/><circle cx="77" cy="85" r="2.2" fill="#222"/><circle cx="90" cy="85" r="2.2" fill="#222"/><path d="M76 92 Q82.5 98 89 92" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;

const NUM = ["", "#1c7ed6", "#2f9e44", "#e03131", "#7048e8", "#e8590c", "#0ca678", "#3a2e39", "#868e96"];
type Phase = "play" | "won" | "lost";
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let level = Math.max(0, Math.min(2, ctx.store.get<number>("level", 0)));
  let flagMode = false;
  const bestKey = () => `best-${level}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;

  const minesEl = h("span", { class: "ms-stat", id: "ms-mines" }, "");
  const timeEl = h("span", { class: "ms-stat", id: "ms-time" }, "");
  const bestEl = h("span", { class: "ms-stat best", id: "ms-best" }, "");
  const flagBtn = h("button", { class: "mopt", id: "ms-flagmode", onclick: () => { flagMode = !flagMode; ctx.sfx("tap"); refreshHud(); } }, "");
  const levelBtn = h("button", { class: "mopt", id: "ms-level", onclick: () => { level = (level + 1) % 3; ctx.store.set("level", level); ctx.sfx("tap"); reset(); } }, "");
  const hud = h("div", { class: "ms-hud" }, minesEl, timeEl, bestEl, flagBtn, levelBtn);

  const canvas = h("canvas", { id: "ms-canvas" });
  const title = h("h2", {}, ""), msg = h("p", {}, "");
  const again = h("button", { class: "primary", id: "ms-start", onclick: () => { ctx.sfx("tap"); reset(); } }, "再玩一次");
  const ovl = h("div", { class: "ms-ovl", id: "ms-ovl" }, title, msg, again);
  ovl.hidden = true;
  const field = h("div", { class: "ms-field", id: "ms-field" }, canvas, ovl);
  const board = h("div", { class: "ms-board" }, field);
  root.append(h("div", { class: "ms-wrap" }, hud, board));

  let s!: M.MineState, phase: Phase = "play";
  let cell = 30, dpr = 1, cols = 8, rows = 8;
  let t0 = 0, elapsed = 0, ticking = false, now = 0, raf = 0, dirty = true, doneShown = 0;
  let cursor = 0, kbd = false;
  let pop = new Map<number, number>(), sparks: Spark[] = [], loseAt = 0;
  const timers: number[] = [];
  let tick = 0;

  const refreshHud = () => {
    minesEl.textContent = `雷：${M.minesLeft(s)}`;
    timeEl.textContent = `时间：${fmt(elapsed)}`;
    const b = best();
    bestEl.textContent = `最快：${b ? fmt(b) : "--"}`;
    flagBtn.textContent = flagMode ? "插旗：开" : "插旗：关"; flagBtn.classList.toggle("on", flagMode);
    levelBtn.textContent = ["大小：简单", "大小：普通", "大小：困难"][level];
  };
  function reset() {
    const wide = board.clientWidth > board.clientHeight * 1.1;
    const d = M.levelDims(level, wide);
    cols = d.cols; rows = d.rows;
    s = M.newBoard(cols, rows, d.mines);
    phase = "play"; elapsed = 0; ticking = false; pop = new Map(); sparks = []; doneShown = 0; loseAt = 0;
    timers.forEach(clearTimeout); timers.length = 0;
    cursor = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    ovl.hidden = true;
    layout(); refreshHud();
  }
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    cell = Math.max(14, Math.min(64, Math.floor(Math.min((w - 8) / cols, (hh - 10) / rows))));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = cell * cols, H = cell * rows;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    for (const el of [canvas, field]) { el.style.width = `${W}px`; el.style.height = `${H}px`; }
    dirty = true;
  }

  // ---- actions ----
  function afterOpen(r: M.OpenResult, i: number) {
    if (r.first) { t0 = performance.now(); ticking = true; }
    for (const j of r.opened) pop.set(j, now);
    if (r.boom) return lose();
    if (r.won) return win();
    if (r.opened.length) ctx.sfx(r.opened.length > 3 ? "good" : "tap");
    refreshHud(); dirty = true;
    void i;
  }
  function doOpen(i: number) {
    if (phase !== "play") return;
    if (s.st[i] === M.FLAG) return;
    if (s.st[i] === M.OPEN) {
      const r = M.chord(s, i);
      if (!r.opened.length && !r.boom) { if (s.count[i]) ctx.sfx("bad"); return; }
      afterOpen(r, i); return;
    }
    afterOpen(M.open(s, i), i);
  }
  function doFlag(i: number) {
    if (phase !== "play") return;
    if (!M.toggleFlag(s, i)) return;
    ctx.sfx("place"); refreshHud(); dirty = true;
  }
  function stopClock() { if (ticking) { elapsed = Math.max(1, Math.round((performance.now() - t0) / 1000)); ticking = false; } }
  function lose() {
    stopClock(); phase = "lost"; loseAt = now || performance.now(); ctx.sfx("lose");
    for (let i = 0; i < s.mine.length; i++) if (s.mine[i]) { const x = i % cols, y = (i - x) / cols; for (let k = 0; k < 5; k++) sparks.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.7) * 4, life: 0, max: 0.5 + Math.random() * 0.4, color: k % 2 ? "#ffa94d" : "#ffe066", r: 0.1 }); }
    refreshHud(); dirty = true;
    timers.push(window.setTimeout(() => { if (phase === "lost") { show("哎呀，踩到雷了！", "再来一次吧。"); } }, 1400));
    ctx.toast("踩到雷了", 1200);
  }
  function win() {
    stopClock(); phase = "won"; ctx.sfx("win");
    const old = best(), nb = old === 0 || elapsed < old;
    if (nb) ctx.store.set(bestKey(), elapsed);
    for (let i = 0; i < 40; i++) sparks.push({ x: Math.random() * cols, y: Math.random() * rows, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 3, life: 0, max: 0.8 + Math.random() * 0.5, color: ["#ffd43b", "#ff6b6b", "#51cf66", "#4dabf7"][i % 4], r: 0.12 });
    refreshHud(); dirty = true;
    timers.push(window.setTimeout(() => { if (phase === "won") show("太棒了！", nb ? `新纪录：${fmt(elapsed)}` : `用时：${fmt(elapsed)}`); }, 700));
  }
  function show(t: string, m: string) { title.textContent = t; msg.textContent = m; ovl.hidden = false; doneShown = 1; }

  // ---- drawing ----
  const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + hh, r); g.arcTo(x + w, y + hh, x, y + hh, r); g.arcTo(x, y + hh, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function flagArt(g: CanvasRenderingContext2D, x: number, y: number, c: number, wrong: boolean) {
    const lw = Math.max(2, c * 0.07);
    g.lineCap = "round"; g.lineJoin = "round";
    g.fillStyle = "rgba(0,0,0,.14)"; g.beginPath(); g.ellipse(x + c * 0.5, y + c * 0.8, c * 0.24, c * 0.07, 0, 0, 7); g.fill();
    g.strokeStyle = "#5c3d1e"; g.lineWidth = lw * 1.3; g.beginPath(); g.moveTo(x + c * 0.4, y + c * 0.2); g.lineTo(x + c * 0.4, y + c * 0.8); g.stroke();
    g.fillStyle = "#fa5252"; g.strokeStyle = "#c92a2a"; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x + c * 0.4, y + c * 0.2); g.lineTo(x + c * 0.76, y + c * 0.35); g.lineTo(x + c * 0.4, y + c * 0.5); g.closePath(); g.fill(); g.stroke();
    if (wrong) { g.strokeStyle = "#212529"; g.lineWidth = lw * 1.4; g.beginPath(); g.moveTo(x + c * 0.2, y + c * 0.2); g.lineTo(x + c * 0.8, y + c * 0.8); g.moveTo(x + c * 0.8, y + c * 0.2); g.lineTo(x + c * 0.2, y + c * 0.8); g.stroke(); }
  }
  function bombArt(g: CanvasRenderingContext2D, x: number, y: number, c: number, boom: boolean) {
    const cx = x + c * 0.5, cy = y + c * 0.55, r = c * 0.3, lw = Math.max(2, c * 0.07);
    g.lineCap = "round";
    g.strokeStyle = "#212529"; g.lineWidth = lw * 1.2;
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2 + 0.4; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); g.lineTo(cx + Math.cos(a) * r * 1.3, cy + Math.sin(a) * r * 1.3); g.stroke(); }
    g.fillStyle = "#495057"; g.strokeStyle = "#212529"; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke();
    g.strokeStyle = "#5c3d1e"; g.beginPath(); g.moveTo(cx + r * 0.3, cy - r * 0.9); g.quadraticCurveTo(cx + r * 0.5, cy - r * 1.5, cx + r * 0.9, cy - r * 1.5); g.stroke();
    g.fillStyle = Math.floor(now / 160) % 2 && !boom ? "#ffd43b" : "#ff922b"; g.beginPath(); g.arc(cx + r * 1.0, cy - r * 1.5, r * 0.22, 0, 7); g.fill();
    g.fillStyle = "rgba(255,255,255,.4)"; g.beginPath(); g.ellipse(cx - r * 0.4, cy - r * 0.45, r * 0.3, r * 0.18, -0.5, 0, 7); g.fill();
    const ex = r * 0.36, ey = -r * 0.1, er = r * 0.26;
    g.fillStyle = "#fff"; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * ex, cy + ey, er, 0, 7); g.fill(); }
    g.fillStyle = "#222"; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * ex + er * 0.15, cy + ey + er * 0.1, er * 0.5, 0, 7); g.fill(); }
    g.strokeStyle = "#fff"; g.lineWidth = lw * 0.9;
    g.beginPath(); if (boom) g.ellipse(cx, cy + r * 0.45, r * 0.18, r * 0.2, 0, 0, 7); else g.arc(cx, cy + r * 0.28, r * 0.28, 0.2, Math.PI - 0.2); g.stroke();
  }
  function draw() {
    const g = canvas.getContext("2d"); if (!g) return;
    const c = cell; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const shake = phase === "lost" && now - loseAt < 350 ? Math.sin((now - loseAt) / 22) * c * 0.08 : 0;
    g.save(); g.translate(shake, 0);
    g.fillStyle = "#fff6e5"; g.fillRect(-10, -10, cols * c + 20, rows * c + 20);
    const lost = phase === "lost";
    for (let i = 0; i < s.st.length; i++) {
      const x = (i % cols) * c, y = Math.floor(i / cols) * c, st = s.st[i];
      const showMine = (lost && s.mine[i] && st !== M.FLAG) || (lost && i === s.boom);
      if (st === M.OPEN && !s.mine[i]) {
        const p = pop.get(i), k = p === undefined ? 1 : Math.min(1, (now - p) / 160), sc = 0.7 + 0.3 * k * (2 - k);
        g.fillStyle = ((i % cols) + Math.floor(i / cols)) % 2 ? "#fff0d4" : "#ffe8c2"; g.fillRect(x, y, c, c);
        if (s.count[i]) {
          g.fillStyle = NUM[s.count[i]]; g.font = `900 ${Math.round(c * 0.62 * sc)}px "Arial Rounded MT Bold", Nunito, Arial, sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
          g.fillText(String(s.count[i]), x + c / 2, y + c / 2 + c * 0.04);
        }
      } else if (showMine) {
        g.fillStyle = i === s.boom ? "#ffa8a8" : "#ffe8c2"; g.fillRect(x, y, c, c); bombArt(g, x, y, c, i === s.boom);
      } else {
        const pad = Math.max(1.5, c * 0.05), hl = kbd && i === cursor;
        g.fillStyle = "#ffe8c2"; g.fillRect(x, y, c, c);
        g.fillStyle = "#0ca678"; rr(g, x + pad, y + pad + c * 0.06, c - pad * 2, c - pad * 2, c * 0.2); g.fill();
        g.fillStyle = hl ? "#96f2d7" : "#38d9a9"; rr(g, x + pad, y + pad, c - pad * 2, c - pad * 2 - c * 0.07, c * 0.2); g.fill();
        g.fillStyle = "rgba(255,255,255,.35)"; rr(g, x + c * 0.2, y + c * 0.17, c * 0.4, c * 0.1, c * 0.05); g.fill();
        if (st === M.FLAG) flagArt(g, x, y, c, lost && M.wrongFlag(s, i));
      }
    }
    if (kbd && phase === "play") { const x = (cursor % cols) * c, y = Math.floor(cursor / cols) * c; g.strokeStyle = "#e8590c"; g.lineWidth = Math.max(3, c * 0.1); rr(g, x + 2, y + 2, c - 4, c - 4, c * 0.2); g.stroke(); }
    for (const q of sparks) { const a = 1 - q.life / q.max; g.globalAlpha = Math.max(0, a); g.fillStyle = q.color; g.beginPath(); g.arc(q.x * c, q.y * c, q.r * c * (0.5 + a) * 1.6, 0, 7); g.fill(); }
    g.globalAlpha = 1; g.restore();
  }
  let last = 0;
  function frame(ts: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, ts - (last || ts)); last = ts; now = ts;
    if (ticking) {
      const e = Math.max(0, Math.floor((performance.now() - t0) / 1000));
      if (e !== elapsed) { elapsed = e; timeEl.textContent = `时间：${fmt(elapsed)}`; }
    }
    const sec = dt / 1000;
    for (const q of sparks) { q.life += sec; q.x += q.vx * sec; q.y += q.vy * sec; q.vy += 6 * sec; }
    if (sparks.length) { sparks = sparks.filter((q) => q.life < q.max); dirty = true; }
    for (const [k, v] of pop) if (now - v > 200) pop.delete(k); else dirty = true;
    if ((phase === "lost" && now - loseAt < 400) || ((phase === "play") && ++tick % 8 === 0)) dirty = true;
    if (dirty) { dirty = false; draw(); }
  }

  // ---- input ----
  const cellAt = (e: PointerEvent): number => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / cell), y = Math.floor((e.clientY - r.top) / cell);
    return x < 0 || y < 0 || x >= cols || y >= rows ? -1 : y * cols + x;
  };
  let pid = -1, pi = -1, px = 0, py = 0, pt = 0, long = false;
  const clearPress = () => { if (pt) clearTimeout(pt); pt = 0; pid = -1; };
  const onDown = (e: PointerEvent) => {
    if (e.target instanceof HTMLButtonElement) return;
    kbd = false;
    const i = cellAt(e); if (i < 0 || phase !== "play") return;
    if (e.pointerType === "mouse" && e.button === 2) { doFlag(i); return; }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    clearPress(); pid = e.pointerId; pi = i; px = e.clientX; py = e.clientY; long = false;
    pt = window.setTimeout(() => { pt = 0; long = true; if (s.st[pi] !== M.OPEN) { doFlag(pi); if (navigator.vibrate) try { navigator.vibrate(20); } catch { /* ok */ } } }, 500);
  };
  const onMove = (e: PointerEvent) => { if (e.pointerId === pid && Math.hypot(e.clientX - px, e.clientY - py) > Math.max(10, cell * 0.4)) { clearPress(); pi = -1; } };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    const was = long, i = pi; clearPress();
    if (was || i < 0) return;
    if (flagMode && s.st[i] !== M.OPEN) doFlag(i); else doOpen(i);
  };
  const onCancel = (e: PointerEvent) => { if (e.pointerId === pid) { clearPress(); pi = -1; } };
  const onCtx = (e: Event) => e.preventDefault();
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    const mv: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (mv[k]) {
      e.preventDefault(); kbd = true; dirty = true;
      const x = Math.max(0, Math.min(cols - 1, (cursor % cols) + mv[k][0])), y = Math.max(0, Math.min(rows - 1, Math.floor(cursor / cols) + mv[k][1]));
      cursor = y * cols + x; return;
    }
    if (phase !== "play") { if (k === "Enter" || k === " " || k === "r" || k === "R") { e.preventDefault(); reset(); } return; }
    if (k === " " || k === "Enter") { e.preventDefault(); kbd = true; doOpen(cursor); }
    else if (k === "f" || k === "F") { e.preventDefault(); kbd = true; doFlag(cursor); }
    else if (k === "r" || k === "R") { reset(); }
  };
  field.addEventListener("pointerdown", onDown); field.addEventListener("pointermove", onMove); field.addEventListener("pointerup", onUp); field.addEventListener("pointercancel", onCancel);
  field.addEventListener("contextmenu", onCtx);
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  reset();
  raf = requestAnimationFrame(frame);
  (window as unknown as Record<string, unknown>).__mines = {
    state: () => s, phase: () => phase, cursor: () => cursor, cell: () => cell, dims: () => ({ cols, rows }), finished: () => doneShown,
    open: (i: number) => doOpen(i), flag: (i: number) => doFlag(i), refresh: () => { refreshHud(); dirty = true; },
  };
  return () => {
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); clearPress(); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__mines;
  };
}
