import type { GameCtx } from "./ctx";
import "./sokoban.css";
import { LEVELS, PER_GROUP, parseLevel, newGame, move, undo, won, stars, opposite, VEC, type Dir, type SokState } from "./sokoban-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#fff4dc"/><rect x="10" y="10" width="100" height="100" rx="26" fill="none" stroke="#ffd8a8" stroke-width="4"/><path d="M10 82 H46 V110 H36 Q10 110 10 84Z" fill="#f08c5a"/><path d="M10 92 H46 M28 82 V92 M20 92 V102" stroke="#fff0e0" stroke-width="2.5" fill="none"/><path d="M82 100 L86.5 108 L95 109.5 L88.5 115 L90.5 123 L82 119 L73.5 123 L75.5 115 L69 109.5 L77.5 108Z" fill="#ffd43b" stroke="#f59f00" stroke-width="2.5" stroke-linejoin="round" transform="translate(0 -22) scale(1)"/><rect x="58" y="38" width="42" height="42" rx="9" fill="#f0a43c" stroke="#a8641a" stroke-width="4"/><rect x="65" y="45" width="28" height="28" rx="5" fill="none" stroke="#c97c1e" stroke-width="3"/><path d="M65 45 L93 73 M93 45 L65 73" stroke="#c97c1e" stroke-width="3"/><circle cx="38" cy="56" r="21" fill="#ffe0bd" stroke="#8d5524" stroke-width="4"/><path d="M17 52 Q20 30 38 30 Q56 30 59 52 Z" fill="#12b886" stroke="#087f5b" stroke-width="4" stroke-linejoin="round"/><rect x="15" y="50" width="46" height="6" rx="3" fill="#0ca678" stroke="#087f5b" stroke-width="3"/><circle cx="31" cy="64" r="2.8" fill="#222"/><circle cx="46" cy="64" r="2.8" fill="#222"/><path d="M32 71 Q39 77 46 71" fill="none" stroke="#c92a2a" stroke-width="3" stroke-linecap="round"/><circle cx="25" cy="70" r="3.6" fill="#ff8787" opacity=".6"/><circle cx="52" cy="70" r="3.6" fill="#ff8787" opacity=".6"/></svg>`;

const GROUP_NAMES = ["入门", "进阶", "挑战"];
const KEYS: Record<string, Dir> = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R", w: "U", W: "U", s: "D", S: "D", a: "L", A: "L", d: "R", D: "R" };
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
const ANIM_MS = 120;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const bestMap = () => ctx.store.get<Record<string, number>>("best", {});
  let idx = Math.max(0, Math.min(LEVELS.length - 1, Math.floor(ctx.store.get<number>("level", 0)) || 0));
  let s!: SokState;
  let finished = false, pickerOpen = false;

  const levelEl = h("span", { class: "sk-stat", id: "sk-level" }, "");
  const movesEl = h("span", { class: "sk-stat", id: "sk-moves" }, "");
  const pushesEl = h("span", { class: "sk-stat", id: "sk-pushes" }, "");
  const bestEl = h("span", { class: "sk-stat best", id: "sk-best" }, "");
  const undoBtn = h("button", { class: "mopt", id: "sk-undo", onclick: () => doUndo() }, "撤销");
  const restartBtn = h("button", { class: "mopt", id: "sk-restart", onclick: () => { ctx.sfx("tap"); load(idx); } }, "重来");
  const levelsBtn = h("button", { class: "mopt", id: "sk-levels", onclick: () => { ctx.sfx("tap"); openPicker(); } }, "选关");
  const hud = h("div", { class: "sk-hud" }, levelEl, movesEl, pushesEl, bestEl, undoBtn, restartBtn, levelsBtn);

  const canvas = h("canvas", { id: "sk-canvas" });
  const title = h("h2", {}, ""), msg = h("p", {}, ""), starsEl = h("p", { class: "sk-stars", id: "sk-stars" }, "");
  const nextBtn = h("button", { class: "primary", id: "sk-next", onclick: () => { ctx.sfx("tap"); if (idx + 1 < LEVELS.length) load(idx + 1); else openPicker(); } }, "下一关");
  const ovl = h("div", { class: "sk-ovl", id: "sk-ovl", hidden: true }, title, starsEl, msg, nextBtn);
  const field = h("div", { class: "sk-field", id: "sk-field" }, canvas, ovl);
  const board = h("div", { class: "sk-board" }, field);
  const padBtn = (d: Dir, t: string) => h("button", {
    "data-d": d, "aria-label": d, class: "sk-arrow",
    onpointerdown: (e: Event) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("down"); act(d); },
    onpointerup: (e: Event) => (e.currentTarget as HTMLElement).classList.remove("down"),
    onpointerleave: (e: Event) => (e.currentTarget as HTMLElement).classList.remove("down"),
  }, t);
  const pad = h("div", { class: "sk-pad" }, padBtn("U", "▲"), padBtn("L", "◀"), padBtn("D", "▼"), padBtn("R", "▶"));
  const picker = h("div", { class: "sk-picker", id: "sk-picker", hidden: true });
  const wrap = h("div", { class: "sk-wrap" }, hud, board, pad, picker);
  root.append(wrap);

  let cell = 30, dpr = 1, raf = 0, now = 0;
  let anim: { t0: number; fromP: number; fromBoxes: number[]; pushed: boolean } | null = null;
  let sparks: Spark[] = [];
  let happy = 0;
  const timers: number[] = [];

  const bestOf = (i: number) => bestMap()[LEVELS[i].id];
  const refreshHud = () => {
    levelEl.textContent = `第 ${idx + 1} 关`;
    movesEl.textContent = `步数：${s.moves}`;
    pushesEl.textContent = `推动：${s.pushes}`;
    const b = bestOf(idx);
    bestEl.textContent = b ? `最佳：${b}` : "最佳：-";
    undoBtn.disabled = s.history.length === 0;
  };

  function load(i: number) {
    idx = Math.max(0, Math.min(LEVELS.length - 1, i));
    ctx.store.set("level", idx);
    s = newGame(parseLevel(LEVELS[idx].rows));
    finished = false; anim = null; sparks = []; happy = 0; ovl.hidden = true; closePicker();
    refreshHud(); layout();
  }

  function snapshot() { return { t0: now || performance.now(), fromP: s.player, fromBoxes: s.boxes.slice(), pushed: false }; }
  function act(d: Dir) {
    if (pickerOpen || finished) return;
    const snap = snapshot();
    const r = move(s, d);
    if (!r.moved) { if (r.boxHit) ctx.sfx("bad"); draw(); return; }
    snap.pushed = r.pushed; anim = snap;
    if (r.pushed && r.to !== undefined && s.level.goal[r.to]) { ctx.sfx("place"); spark(r.to); }
    else ctx.sfx("move");
    refreshHud();
    if (won(s)) win();
  }
  function doUndo() {
    if (pickerOpen || finished) return;
    const snap = snapshot();
    if (!undo(s)) return;
    snap.pushed = true; anim = snap; ctx.sfx("tap"); refreshHud();
  }
  function win() {
    finished = true; happy = 1;
    const map = bestMap(), old = map[LEVELS[idx].id], isBest = !old || s.moves < old;
    if (isBest) { map[LEVELS[idx].id] = s.moves; ctx.store.set("best", map); }
    if (idx + 1 < LEVELS.length) ctx.store.set("level", idx + 1);
    refreshHud();
    ctx.sfx("win");
    for (const b of s.boxes) spark(b);
    const n = stars(Math.min(s.moves, map[LEVELS[idx].id] ?? s.moves), LEVELS[idx].opt);
    const last = idx + 1 >= LEVELS.length && Object.keys(map).length >= LEVELS.length;
    timers.push(window.setTimeout(() => {
      if (!finished) return;
      title.textContent = last ? "全部通关！" : "过关！";
      starsEl.textContent = "★".repeat(n) + "☆".repeat(3 - n);
      msg.textContent = isBest && old ? `新纪录：${s.moves} 步` : `${s.moves} 步，推了 ${s.pushes} 次`;
      nextBtn.textContent = idx + 1 < LEVELS.length ? "下一关" : "选关";
      ovl.hidden = false;
    }, 450));
  }
  function spark(cellIdx: number) {
    const x = (cellIdx % s.level.w) + 0.5, y = Math.floor(cellIdx / s.level.w) + 0.5;
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5, v = 1.6 + Math.random() * 2.4; sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.4 + Math.random() * 0.25, color: i % 2 ? "#ffd43b" : "#69db7c", r: 0.08 + Math.random() * 0.06 }); }
  }

  // ---- the level picker ----
  function renderPicker() {
    picker.replaceChildren();
    picker.append(h("h2", {}, "选择关卡"));
    const map = bestMap();
    for (let g = 0; g < Math.ceil(LEVELS.length / PER_GROUP); g++) {
      const row = h("div", { class: "sk-levels" });
      for (let i = g * PER_GROUP; i < Math.min(LEVELS.length, (g + 1) * PER_GROUP); i++) {
        const b = map[LEVELS[i].id], n = b ? stars(b, LEVELS[i].opt) : 0;
        const btn = h("button", { class: "sk-lvl" + (b ? " done" : "") + (i === idx ? " cur" : ""), "data-i": String(i), "data-stars": String(n), onclick: () => { ctx.sfx("tap"); load(i); } }, String(i + 1));
        if (b) btn.append(h("span", { class: "st" }, "★".repeat(n)));
        row.append(btn);
      }
      picker.append(h("div", { class: "sk-group" }, h("h3", {}, GROUP_NAMES[g] ?? ""), row));
    }
    picker.append(h("button", { class: "primary sk-close", id: "sk-close", onclick: () => { ctx.sfx("tap"); closePicker(); } }, "关闭"));
  }
  function openPicker() { renderPicker(); pickerOpen = true; picker.hidden = false; }
  function closePicker() { pickerOpen = false; picker.hidden = true; }

  // ---- drawing ----
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight, L = s.level;
    cell = Math.max(14, Math.min(64, Math.floor(Math.min(w - 8, hh - 10) / Math.max(L.w, L.h))));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const cw = cell * L.w, ch = cell * L.h;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`;
    field.style.width = `${cw}px`; field.style.height = `${ch}px`;
    draw();
  }
  const ease = (t: number) => t * t * (3 - 2 * t);
  const rr = (g: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, hh, r); };
  function star(g: CanvasRenderingContext2D, cx: number, cy: number, R: number) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? R * 0.46 : R; g[i ? "lineTo" : "moveTo"](cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
    g.closePath();
  }
  function drawWall(g: CanvasRenderingContext2D, x: number, y: number, c: number) {
    g.fillStyle = "#f08c5a"; g.fillRect(x, y, c, c);
    g.strokeStyle = "#fff0e0"; g.lineWidth = Math.max(1.5, c * 0.06);
    g.beginPath();
    g.moveTo(x, y + c / 2); g.lineTo(x + c, y + c / 2);
    g.moveTo(x + c * 0.5, y); g.lineTo(x + c * 0.5, y + c / 2);
    g.moveTo(x + c * 0.25, y + c / 2); g.lineTo(x + c * 0.25, y + c);
    g.moveTo(x + c * 0.75, y + c / 2); g.lineTo(x + c * 0.75, y + c);
    g.stroke();
    g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(x, y, c, Math.max(2, c * 0.08));
    g.fillStyle = "rgba(160,50,10,.25)"; g.fillRect(x, y + c - Math.max(2, c * 0.08), c, Math.max(2, c * 0.08));
  }
  function drawBox(g: CanvasRenderingContext2D, px: number, py: number, c: number, on: boolean) {
    const m = c * 0.08, x = px * c + m, y = py * c + m, w = c - m * 2, lw = Math.max(2, c * 0.07);
    g.fillStyle = "rgba(0,0,0,.14)"; rr(g, x + 1, y + c * 0.07, w, w, c * 0.16); g.fill();
    g.fillStyle = on ? "#8ce99a" : "#f0a43c"; g.strokeStyle = on ? "#2b8a3e" : "#a8641a"; g.lineWidth = lw;
    rr(g, x, y, w, w, c * 0.16); g.fill(); g.stroke();
    g.strokeStyle = on ? "#51cf66" : "#c97c1e"; g.lineWidth = Math.max(1.5, c * 0.05);
    rr(g, x + w * 0.16, y + w * 0.16, w * 0.68, w * 0.68, c * 0.08); g.stroke();
    if (!on) { g.beginPath(); g.moveTo(x + w * 0.16, y + w * 0.16); g.lineTo(x + w * 0.84, y + w * 0.84); g.moveTo(x + w * 0.84, y + w * 0.16); g.lineTo(x + w * 0.16, y + w * 0.84); g.stroke(); }
    else {
      const cx = x + w / 2, cy = y + w / 2;
      g.fillStyle = "#222"; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * w * 0.17, cy - w * 0.06, Math.max(1.6, w * 0.065), 0, 7); g.fill(); }
      g.strokeStyle = "#c92a2a"; g.lineWidth = Math.max(1.8, c * 0.06); g.lineCap = "round"; g.beginPath(); g.arc(cx, cy + w * 0.04, w * 0.17, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.fillStyle = "rgba(255,120,150,.6)"; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * w * 0.3, cy + w * 0.08, w * 0.06, 0, 7); g.fill(); }
    }
  }
  function drawPusher(g: CanvasRenderingContext2D, px: number, py: number, c: number, face: Dir, moving: boolean) {
    const cx = (px + 0.5) * c, cy = (py + 0.52) * c, r = c * 0.4, lw = Math.max(2, c * 0.07);
    const v = VEC[face];
    g.fillStyle = "rgba(0,0,0,.14)"; g.beginPath(); g.ellipse(cx, (py + 0.93) * c, r * 0.8, r * 0.22, 0, 0, 7); g.fill();
    g.fillStyle = "#ffe0bd"; g.strokeStyle = "#8d5524"; g.lineWidth = lw; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); g.stroke();
    // cap: a green half-circle on the top, its brim points the way he looks
    g.save(); g.beginPath(); g.arc(cx, cy, r - lw / 2, 0, 7); g.clip();
    g.fillStyle = "#12b886"; g.fillRect(cx - r, cy - r, r * 2, r * 0.78 + v.y * r * 0.18);
    g.restore();
    g.strokeStyle = "#087f5b"; g.lineWidth = lw; g.beginPath(); g.moveTo(cx - r * 0.93, cy - r * 0.2 + v.y * r * 0.18); g.lineTo(cx + r * 0.93, cy - r * 0.2 + v.y * r * 0.18); g.stroke();
    g.fillStyle = "#0ca678"; g.beginPath(); g.arc(cx, cy - r, r * 0.13, 0, 7); g.fill();
    // face: eyes and mouth shift to the direction
    const ox = v.x * r * 0.26, oy = v.y * r * 0.16, ey = cy + r * 0.16 + oy;
    const ex = face === "L" || face === "R" ? [-0.2, 0.34] : [-0.3, 0.3];
    g.fillStyle = "#222";
    for (const k of ex) {
      const x = cx + k * r + ox;
      if (happy > 0) { g.strokeStyle = "#222"; g.lineWidth = Math.max(1.6, c * 0.055); g.beginPath(); g.arc(x, ey + r * 0.04, r * 0.11, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      else { g.beginPath(); g.arc(x, ey, Math.max(1.8, r * 0.12), 0, 7); g.fill(); }
    }
    g.fillStyle = "rgba(255,120,150,.55)"; for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * r * 0.62 + ox * 0.6, ey + r * 0.28, r * 0.12, 0, 7); g.fill(); }
    g.strokeStyle = "#c92a2a"; g.fillStyle = "#c92a2a"; g.lineWidth = Math.max(1.8, c * 0.06); g.lineCap = "round";
    const mx = cx + ox * 0.9, my = ey + r * 0.4;
    if (moving && !happy) { g.beginPath(); g.ellipse(mx, my, r * 0.1, r * 0.12, 0, 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(mx, my - r * 0.14, r * 0.2, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
    // little hands on the sides
    g.fillStyle = "#ffe0bd"; g.strokeStyle = "#8d5524"; g.lineWidth = Math.max(1.5, c * 0.05);
    for (const sx of [-1, 1]) { g.beginPath(); g.arc(cx + sx * (r + c * 0.01) + v.x * r * 0.35, cy + r * 0.5 + v.y * r * 0.5, c * 0.07, 0, 7); g.fill(); g.stroke(); }
  }
  function draw() {
    const g = canvas.getContext("2d"); if (!g || !s) return;
    const L = s.level, c = cell; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = anim ? Math.min(1, (now - anim.t0) / ANIM_MS) : 1, tt = ease(Math.max(0, t));
    for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x;
      if (L.wall[i]) { drawWall(g, x * c, y * c, c); continue; }
      g.fillStyle = (x + y) % 2 ? "#ffecc4" : "#fff4dc"; g.fillRect(x * c, y * c, c, c);
      if (L.goal[i]) {
        g.fillStyle = "rgba(255,212,59,.28)"; g.beginPath(); g.arc((x + 0.5) * c, (y + 0.5) * c, c * 0.34, 0, 7); g.fill();
        const pulse = 1 + Math.sin(now / 300) * 0.05;
        g.fillStyle = "#ffd43b"; g.strokeStyle = "#f59f00"; g.lineWidth = Math.max(1.5, c * 0.05); g.lineJoin = "round";
        star(g, (x + 0.5) * c, (y + 0.52) * c, c * 0.28 * pulse); g.fill(); g.stroke();
      }
    }
    const lerp = (a: number, b: number) => { const ax = a % L.w, ay = Math.floor(a / L.w), bx = b % L.w, by = Math.floor(b / L.w); return { x: ax + (bx - ax) * tt, y: ay + (by - ay) * tt }; };
    s.boxes.forEach((b, k) => { const p = anim ? lerp(anim.fromBoxes[k] ?? b, b) : lerp(b, b); drawBox(g, p.x, p.y, c, L.goal[b] && (t >= 1 || anim?.fromBoxes[k] === b)); });
    const pp = anim ? lerp(anim.fromP, s.player) : lerp(s.player, s.player);
    const bounce = anim && t < 1 ? Math.sin(t * Math.PI) * 0.06 : 0;
    drawPusher(g, pp.x, pp.y - bounce, c, s.facing, !!anim && t < 1 && anim.pushed);
    for (const q of sparks) { const a = 1 - q.life / q.max; g.globalAlpha = Math.max(0, a); g.fillStyle = q.color; g.beginPath(); g.arc(q.x * c, q.y * c, q.r * c * (0.6 + a), 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
  let last = 0;
  function frame(ts: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, ts - (last || ts)); last = ts; now = ts;
    const sec = dt / 1000;
    for (const q of sparks) { q.life += sec; q.x += q.vx * sec; q.y += q.vy * sec; q.vy += 3 * sec; }
    sparks = sparks.filter((q) => q.life < q.max);
    if (anim && now - anim.t0 > ANIM_MS) anim = null;
    draw();
  }

  // ---- input ----
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (pickerOpen) { if (e.key === "Escape") { e.preventDefault(); closePicker(); } return; }
    const d = KEYS[e.key];
    if (d) { e.preventDefault(); act(d); return; }
    if (e.key === "z" || e.key === "Z" || e.key === "Backspace") { e.preventDefault(); doUndo(); }
    else if (e.key === "r" || e.key === "R") { e.preventDefault(); load(idx); }
    else if ((e.key === "Enter" || e.key === " ") && finished && !ovl.hidden) { e.preventDefault(); nextBtn.click(); }
  };
  let sx = 0, sy = 0, sid = -1;
  const onDown = (e: PointerEvent) => { if (e.target instanceof HTMLButtonElement) return; sid = e.pointerId; sx = e.clientX; sy = e.clientY; try { field.setPointerCapture(e.pointerId); } catch { /* ok */ } };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== sid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, th = Math.max(16, cell * 0.7);
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    act(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U"));
    sx = e.clientX; sy = e.clientY;
  };
  const onUp = (e: PointerEvent) => { if (e.pointerId === sid) sid = -1; };
  document.addEventListener("keydown", onKey);
  field.addEventListener("pointerdown", onDown); field.addEventListener("pointermove", onMove); field.addEventListener("pointerup", onUp); field.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  load(idx);
  raf = requestAnimationFrame(frame);
  (window as unknown as Record<string, unknown>).__sokoban = { state: () => s, level: () => idx, cell: () => cell, finished: () => finished, picker: () => pickerOpen, anim: () => !!anim, opposite };
  return () => {
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__sokoban;
  };
}
