import type { GameCtx } from "./ctx";
import "./tetris.css";
import { newTetris, move, rotate, softDrop, hardDrop, holdPiece, gravity, grounded, ghostY, cellsOf, shape, nextKinds, dropMs, KINDS, COLS, ROWS, type Kind, type TetrisState, type LockResult } from "./tetris-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#e7f5ff"/><g stroke="#fff" stroke-width="3"><rect x="22" y="70" width="22" height="22" rx="6" fill="#ff6b6b"/><rect x="44" y="70" width="22" height="22" rx="6" fill="#ff6b6b"/><rect x="44" y="48" width="22" height="22" rx="6" fill="#ffd43b"/><rect x="66" y="70" width="22" height="22" rx="6" fill="#69db7c"/><rect x="66" y="48" width="22" height="22" rx="6" fill="#ffd43b"/><rect x="88" y="70" width="12" height="22" rx="6" fill="#5c7cfa"/><rect x="66" y="26" width="22" height="22" rx="6" fill="#cc5de8"/></g><circle cx="52" cy="55" r="2.6" fill="#222"/><circle cx="60" cy="55" r="2.6" fill="#222"/><path d="M52 61 Q56 65 60 61" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><circle cx="72" cy="77" r="2.6" fill="#222"/><circle cx="80" cy="77" r="2.6" fill="#222"/><path d="M72 83 Q76 87 80 83" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const COLOR: Record<Kind, [string, string]> = { I: ["#66d9e8", "#15aabf"], O: ["#ffe066", "#f59f00"], T: ["#e599f7", "#ae3ec9"], S: ["#8ce99a", "#2f9e44"], Z: ["#ff8787", "#e03131"], J: ["#91a7ff", "#4c6ef5"], L: ["#ffc078", "#f76707"] };
type Phase = "ready" | "play" | "pause" | "over";
interface Spark { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
interface Pop { text: string; y: number; t: number }

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const best = () => ctx.store.get<number>("best", 0);
  const wide = () => window.matchMedia("(min-aspect-ratio: 5/4) and (max-height: 700px)").matches;

  const scoreEl = h("div", {}, ""), linesEl = h("div", {}, ""), levelEl = h("div", {}, ""), bestEl = h("div", { class: "best" }, "");
  scoreEl.id = "tetris-score"; linesEl.id = "tetris-lines"; levelEl.id = "tetris-level"; bestEl.id = "tetris-best";
  const holdCv = h("canvas", { id: "tetris-hold" }), nextCv = h("canvas", { id: "tetris-next" });
  const holdBox = h("div", { class: "tetris-box" }, h("small", {}, "暂存"), holdCv);
  const nextBox = h("div", { class: "tetris-box" }, h("small", {}, "下一个"), nextCv);
  const pauseBtn = h("button", { class: "mopt", id: "tetris-pause", onclick: () => togglePause() }, "暂停");
  const newBtn = h("button", { class: "mopt", id: "tetris-new", onclick: () => { ctx.sfx("tap"); reset(); begin(); } }, "重新开始");
  const stats = h("div", { class: "tetris-stats" }, scoreEl, linesEl, levelEl, bestEl);
  const btns = h("div", { class: "tetris-btns" }, pauseBtn, newBtn);

  const cv = h("canvas", { id: "tetris-canvas" });
  const title = h("h2", {}, ""), msg = h("p", {}, "");
  const startBtn = h("button", { class: "primary", id: "tetris-start", onclick: () => { ctx.sfx("tap"); if (phase === "pause") togglePause(); else if (phase === "ready") begin(); else { reset(); begin(); } } }, "开始");
  const ovl = h("div", { class: "tetris-ovl", id: "tetris-ovl" }, title, msg, startBtn);
  const field = h("div", { class: "tetris-field", id: "tetris-field" }, cv, ovl);
  const board = h("div", { class: "tetris-board" }, field);

  // on-screen keys (with auto repeat for the ones that repeat)
  const repeaters = new Map<HTMLElement, { t1: number; t2: number }>();
  const key = (id: string, label: string, act: () => void, rep: boolean, cls = "") => {
    const b = h("button", { class: `tetris-key ${cls}`.trim(), id: `tetris-${id}`, "aria-label": id }, label);
    const stopRep = () => { b.classList.remove("down"); const r = repeaters.get(b); if (r) { clearTimeout(r.t1); clearInterval(r.t2); repeaters.delete(b); } };
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault(); b.classList.add("down"); act();
      if (rep) { const r = { t1: 0, t2: 0 }; r.t1 = window.setTimeout(() => { r.t2 = window.setInterval(act, 55); }, 190); repeaters.set(b, r); }
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, stopRep);
    return b;
  };
  const cl = h("div", { class: "tetris-cl" }, key("left", "◀", () => act("left"), true), key("down", "▼", () => act("soft"), true), key("right", "▶", () => act("right"), true));
  const cr = h("div", { class: "tetris-cr" }, key("hold", "暂存", () => act("hold"), false, "hold"), key("rot", "↻", () => act("rot"), false, "alt"), key("drop", "⤓", () => act("hard"), false, "alt"));
  root.append(h("div", { class: "tetris-wrap" }, stats, holdBox, btns, nextBox, board, cl, cr));

  let s!: TetrisState, phase: Phase = "ready";
  let acc = 0, lockT = 0, lockResets = 0, last = 0, raf = 0, now = 0, cell = 20, dpr = 1, trail: { x: number; y0: number; y1: number; t: number; color: string }[] = [];
  let sparks: Spark[] = [], pops: Pop[] = [], clearFx: { rows: number[]; t: number } | null = null, shakeT = 0, lastGroundY = -1;
  const timers: number[] = [];

  const setOvl = (t: string, m: string, b: string, show: boolean) => { title.textContent = t; msg.textContent = m; startBtn.textContent = b; ovl.hidden = !show; };
  const refresh = () => {
    scoreEl.textContent = `得分：${s.score}`; linesEl.textContent = `行数：${s.lines}`; levelEl.textContent = `等级：${s.level}`; bestEl.textContent = `最高：${Math.max(best(), s.score)}`;
    pauseBtn.textContent = phase === "pause" ? "继续" : "暂停"; pauseBtn.disabled = phase !== "play" && phase !== "pause";
    drawSide();
  };
  function reset() {
    s = newTetris(); phase = "ready"; acc = 0; lockT = 0; lockResets = 0; sparks = []; pops = []; clearFx = null; trail = [];
    setOvl("俄罗斯方块", "点击“开始”。方向键移动，上方向键或 X 旋转，空格键直接落下，C 暂存。", "开始", true);
    layout(); refresh();
  }
  function begin() { if (phase !== "ready") return; phase = "play"; setOvl("", "", "", false); last = performance.now(); acc = 0; refresh(); }
  function togglePause() {
    if (phase === "play") { phase = "pause"; setOvl("暂停", "点击继续。", "继续", true); }
    else if (phase === "pause") { phase = "play"; setOvl("", "", "", false); last = performance.now(); }
    refresh();
  }

  function afterLock(r: LockResult, hard = false) {
    lockT = 0; lockResets = 0; acc = 0; lastGroundY = -1;
    if (r.cleared.length) {
      clearFx = { rows: r.cleared, t: now }; ctx.sfx("line");
      const colors = ["#ffe066", "#ff8787", "#8ce99a", "#74c0fc", "#e599f7"];
      for (const row of r.cleared) for (let i = 0; i < 18; i++) sparks.push({ x: Math.random() * COLS, y: row + 0.5, vx: (Math.random() - 0.5) * 8, vy: -2 - Math.random() * 4, life: 0, max: 0.5 + Math.random() * 0.4, color: colors[i % colors.length], r: 0.12 + Math.random() * 0.14 });
      pops.push({ text: `+${r.points}`, y: r.cleared[0], t: now });
      if (r.cleared.length === 4) shakeT = now;
    } else ctx.sfx(hard ? "drop" : "place");
    if (r.levelUp) { ctx.toast(`升级，等级 ${s.level}`, 1400); }
    refresh();
    if (r.over || s.over) gameOver();
  }
  function gameOver() {
    phase = "over"; ctx.sfx("lose");
    const nb = s.score > best() && s.score > 0;
    if (nb) ctx.store.set("best", s.score);
    refresh();
    timers.push(window.setTimeout(() => { if (phase === "over") setOvl("游戏结束", nb ? `新纪录：${s.score}` : `得分：${s.score}`, "再玩一次", true); }, 600));
    ctx.toast(nb ? `新纪录：${s.score}` : `得分：${s.score}`, 1500);
  }
  const resetGround = () => { if (grounded(s) && lockResets < 15) { lockT = 0; lockResets++; } };
  type Act = "left" | "right" | "rot" | "rotccw" | "soft" | "hard" | "hold";
  function act(a: Act): boolean {
    if (phase !== "play" || s.over) return false;
    let okm = false;
    switch (a) {
      case "left": okm = move(s, -1); if (okm) { ctx.sfx("move"); resetGround(); } break;
      case "right": okm = move(s, 1); if (okm) { ctx.sfx("move"); resetGround(); } break;
      case "rot": case "rotccw": okm = rotate(s, a === "rot" ? 1 : -1); if (okm) { ctx.sfx("rotate"); resetGround(); } break;
      case "soft": okm = softDrop(s); if (okm) { acc = 0; refresh(); } break;
      case "hard": {
        if (!s.cur) break;
        const c = s.cur, gy = ghostY(s);
        for (const [x] of cellsOf(c)) trail.push({ x, y0: c.y, y1: gy, t: now, color: COLOR[c.t][0] });
        afterLock(hardDrop(s), true); okm = true; break;
      }
      case "hold": okm = holdPiece(s); if (okm) { ctx.sfx("swap"); lockT = 0; lockResets = 0; acc = 0; refresh(); } break;
    }
    return okm;
  }

  // ---- drawing ----
  const hash = (x: number, y: number, k: number) => ((x * 7 + y * 13 + k * 5) % 6 + 6) % 6 === 0;
  function block(g: CanvasRenderingContext2D, px: number, py: number, c: number, k: Kind, face: boolean, alpha = 1) {
    const [a, b] = COLOR[k], pad = Math.max(1, c * 0.06), r = c * 0.28;
    g.globalAlpha = alpha;
    g.fillStyle = b; g.beginPath(); g.roundRect(px + pad, py + pad + c * 0.06, c - pad * 2, c - pad * 2, r); g.fill();
    g.fillStyle = a; g.beginPath(); g.roundRect(px + pad, py + pad, c - pad * 2, c - pad * 2 - c * 0.08, r); g.fill();
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.roundRect(px + c * 0.2, py + c * 0.16, c * 0.34, c * 0.12, c * 0.06); g.fill();
    if (face && c >= 11) {
      g.fillStyle = "#3a2e39"; const ey = py + c * 0.5, ex = c * 0.17; g.beginPath(); g.arc(px + c / 2 - ex, ey, c * 0.07, 0, 7); g.arc(px + c / 2 + ex, ey, c * 0.07, 0, 7); g.fill();
      g.strokeStyle = "#3a2e39"; g.lineWidth = Math.max(1, c * 0.06); g.lineCap = "round"; g.beginPath(); g.arc(px + c / 2, py + c * 0.56, c * 0.15, 0.25, Math.PI - 0.25); g.stroke();
    }
    g.globalAlpha = 1;
  }
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    cell = Math.max(8, Math.floor(Math.min((w - 8) / COLS, (hh - 12) / ROWS)));
    dpr = Math.min(3, window.devicePixelRatio || 1);
    const W = cell * COLS, H = cell * ROWS;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = `${W}px`; cv.style.height = `${H}px`; field.style.width = `${W}px`; field.style.height = `${H}px`;
    const mc = Math.max(9, Math.min(20, Math.round(cell * 0.62)));
    holdCv.style.width = `${4 * mc}px`; holdCv.style.height = `${3 * mc}px`; holdCv.width = Math.round(4 * mc * dpr); holdCv.height = Math.round(3 * mc * dpr);
    const vertical = wide(), nw = vertical ? 4 * mc : 3 * 4 * mc * 0.75, nh = vertical ? 3 * 3 * mc : 3 * mc;
    nextCv.style.width = `${nw}px`; nextCv.style.height = `${nh}px`; nextCv.width = Math.round(nw * dpr); nextCv.height = Math.round(nh * dpr);
    (holdCv as HTMLCanvasElement).dataset.mc = String(mc); (nextCv as HTMLCanvasElement).dataset.mc = String(mc);
    drawSide(); draw();
  }
  function mini(cvs: HTMLCanvasElement, kinds: Kind[], horizontal: boolean, dim = false) {
    const g = cvs.getContext("2d"); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); const W = cvs.width / dpr, H = cvs.height / dpr; g.clearRect(0, 0, W, H);
    const n = kinds.length || 1;
    const mc = horizontal ? Math.min(W / n / 4, H / 2.6) : Math.min(W / 4, H / (n * 3));
    kinds.forEach((k, i) => {
      const cells = shape(k, 0), minx = Math.min(...cells.map((c) => c[0])), maxx = Math.max(...cells.map((c) => c[0])), miny = Math.min(...cells.map((c) => c[1])), maxy = Math.max(...cells.map((c) => c[1]));
      const pw = (maxx - minx + 1) * mc, ph = (maxy - miny + 1) * mc;
      const ox = horizontal ? (W / n) * i + (W / n - pw) / 2 : (W - pw) / 2, oy = horizontal ? (H - ph) / 2 : (H / n) * i + (H / n - ph) / 2;
      for (const [x, y] of cells) block(g, ox + (x - minx) * mc, oy + (y - miny) * mc, mc, k, false, dim ? 0.45 : 1);
    });
  }
  function drawSide() {
    if (!s) return;
    mini(holdCv, s.hold ? [s.hold] : [], true, !s.canHold);
    mini(nextCv, nextKinds(s, 3), !wide());
  }
  function draw() {
    const g = cv.getContext("2d"); if (!g || !s) return;
    const c = cell, W = c * COLS, H = c * ROWS;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sh = now - shakeT < 300 ? Math.sin((now - shakeT) / 20) * c * 0.12 : 0;
    g.translate(sh, 0);
    g.fillStyle = "#fffdf7"; g.fillRect(-4, 0, W + 8, H);
    g.fillStyle = "#fff0d6"; for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if ((x + y) % 2 === 0) g.fillRect(x * c, y * c, c, c);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const v = s.board[y][x]; if (v) block(g, x * c, y * c, c, KINDS[v - 1], hash(x, y, v)); }
    if (s.cur && !s.over) {
      const gy = ghostY(s), p = s.cur;
      g.strokeStyle = COLOR[p.t][1]; g.lineWidth = Math.max(2, c * 0.1); g.globalAlpha = 0.55;
      for (const [x, y] of cellsOf({ ...p, y: gy })) { g.beginPath(); g.roundRect(x * c + c * 0.12, y * c + c * 0.12, c * 0.76, c * 0.76, c * 0.22); g.stroke(); }
      g.globalAlpha = 1;
    }
    for (const t of trail) { const a = 1 - (now - t.t) / 260; if (a > 0) { g.globalAlpha = a * 0.5; g.fillStyle = t.color; g.fillRect(t.x * c + c * 0.25, t.y0 * c, c * 0.5, (t.y1 - t.y0) * c); } }
    g.globalAlpha = 1;
    if (s.cur) {
      const p = s.cur;
      cellsOf(p).forEach(([x, y], i) => { if (y >= 0) block(g, x * c, y * c, c, p.t, i === 1); });
    }
    if (clearFx) {
      const a = 1 - (now - clearFx.t) / 380;
      if (a > 0) for (const row of clearFx.rows) { g.fillStyle = `rgba(255,255,255,${a * 0.9})`; g.fillRect(0, row * c, W, c); g.fillStyle = `rgba(255,224,102,${a})`; for (let i = 0; i < 5; i++) { const sx = ((i * 2 + 1) / 10 + (1 - a) * 0.1) * W; star(g, sx, (row + 0.5) * c, c * (0.4 + (1 - a) * 0.5)); } }
    }
    for (const q of sparks) { const a = 1 - q.life / q.max; g.globalAlpha = Math.max(0, a); g.fillStyle = q.color; g.beginPath(); g.arc(q.x * c, q.y * c, q.r * c * (0.6 + a), 0, 7); g.fill(); }
    g.globalAlpha = 1;
    for (const p of pops) { const a = 1 - (now - p.t) / 900; if (a > 0) { g.globalAlpha = a; g.font = `900 ${Math.round(c * 1.1)}px system-ui, sans-serif`; g.textAlign = "center"; g.lineWidth = 4; g.strokeStyle = "#fff"; g.fillStyle = "#e8590c"; const yy = (p.y + 0.8) * c - (1 - a) * c * 2; g.strokeText(p.text, W / 2, yy); g.fillText(p.text, W / 2, yy); } }
    g.globalAlpha = 1;
  }
  function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.4 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }

  function frame(ts: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, ts - (last || ts)); last = ts; now = ts;
    if (phase === "play" && !s.over) {
      if (grounded(s)) {
        if (lastGroundY !== s.cur!.y) { lastGroundY = s.cur!.y; lockT = 0; }
        lockT += dt;
        if (lockT >= 500) afterLock(gravity(s) ?? { cleared: [], points: 0, levelUp: false, over: false });
      } else {
        lastGroundY = -1; lockT = 0; acc += dt;
        const ms = dropMs(s.level);
        let guard = 0;
        while (acc >= ms && guard++ < 5 && !grounded(s)) { acc -= ms; gravity(s); }
      }
    }
    const sec = dt / 1000;
    for (const q of sparks) { q.life += sec; q.x += q.vx * sec; q.y += q.vy * sec; q.vy += 12 * sec; }
    sparks = sparks.filter((q) => q.life < q.max);
    trail = trail.filter((t) => now - t.t < 260); pops = pops.filter((p) => now - p.t < 900);
    if (clearFx && now - clearFx.t > 380) clearFx = null;
    draw();
  }

  // ---- input ----
  const KEYMAP: Record<string, Act> = { ArrowLeft: "left", ArrowRight: "right", ArrowDown: "soft", ArrowUp: "rot", x: "rot", X: "rot", z: "rotccw", Z: "rotccw", " ": "hard", c: "hold", C: "hold", Shift: "hold", a: "left", A: "left", d: "right", D: "right", s: "soft", S: "soft", w: "rot", W: "rot" };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "p" || e.key === "P" || e.key === "Escape") { e.preventDefault(); if (phase === "play" || phase === "pause") togglePause(); return; }
    if (phase === "ready" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); begin(); return; }
    if (phase === "over" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); reset(); begin(); return; }
    const a = KEYMAP[e.key];
    if (!a) return;
    e.preventDefault();
    if (phase === "pause" && e.key !== "Shift") return;
    if (e.repeat && (a === "hard" || a === "hold" || a === "rot" || a === "rotccw")) return;
    act(a);
  };
  // touch / mouse on the board: drag sideways = move, drag down = soft drop, quick flick down = hard drop, tap = rotate
  let pid = -1, px = 0, py = 0, p0x = 0, p0y = 0, pt = 0, moved = false;
  const onDown = (e: PointerEvent) => { if (e.target instanceof HTMLButtonElement) return; pid = e.pointerId; px = p0x = e.clientX; py = p0y = e.clientY; pt = performance.now(); moved = false; try { field.setPointerCapture(e.pointerId); } catch { /* ok */ } };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pid || phase !== "play") return;
    const step = Math.max(12, cell * 0.9);
    while (e.clientX - px >= step) { act("right"); px += step; moved = true; }
    while (px - e.clientX >= step) { act("left"); px -= step; moved = true; }
    while (e.clientY - py >= step) { act("soft"); py += step; moved = true; }
    if (Math.abs(e.clientX - p0x) > 8 || Math.abs(e.clientY - p0y) > 8) moved = true;
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pid) return; pid = -1;
    const dt = performance.now() - pt, dy = e.clientY - p0y, dx = e.clientX - p0x;
    if (phase === "play") {
      if (!moved && dt < 350) act("rot");
      else if (dy > cell * 4 && dt < 260 && Math.abs(dx) < dy * 0.5) act("hard");
    }
  };
  const onVis = () => { if (document.hidden && phase === "play") togglePause(); };
  document.addEventListener("keydown", onKey);
  field.addEventListener("pointerdown", onDown); field.addEventListener("pointermove", onMove); field.addEventListener("pointerup", onUp); field.addEventListener("pointercancel", () => { pid = -1; });
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  reset();
  raf = requestAnimationFrame(frame);
  (window as unknown as Record<string, unknown>).__tetris = { state: () => s, phase: () => phase, cell: () => cell, act, gravityTick: () => { if (phase === "play") { const r = gravity(s); if (r) afterLock(r); } } };
  return () => {
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro?.disconnect();
    for (const r of repeaters.values()) { clearTimeout(r.t1); clearInterval(r.t2); }
    repeaters.clear();
    document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__tetris;
  };
}
