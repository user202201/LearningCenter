import type { GameCtx } from "./ctx";
import "./snake.css";
import { newSnake, turn, step, interval, VEC, type Dir, type SnakeState, type Pt } from "./snake-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><path d="M22 86 C22 62 50 74 56 54 C62 34 90 44 88 66" fill="none" stroke="#2b8a3e" stroke-width="22" stroke-linecap="round"/><path d="M22 86 C22 62 50 74 56 54 C62 34 90 44 88 66" fill="none" stroke="#69db7c" stroke-width="15" stroke-linecap="round"/><circle cx="88" cy="68" r="15" fill="#51cf66" stroke="#2b8a3e" stroke-width="4"/><circle cx="83" cy="63" r="4.5" fill="#fff"/><circle cx="95" cy="63" r="4.5" fill="#fff"/><circle cx="84" cy="64" r="2.2" fill="#222"/><circle cx="96" cy="64" r="2.2" fill="#222"/><path d="M82 73 Q89 80 96 73" fill="none" stroke="#222" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="30" r="12" fill="#fa5252"/><path d="M30 19 q2 -9 9 -8" fill="none" stroke="#2f9e44" stroke-width="4" stroke-linecap="round"/><circle cx="26" cy="26" r="3" fill="#fff" opacity=".7"/></svg>`;

type Phase = "ready" | "play" | "pause" | "dead" | "won";
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
const FRUIT = [["#fa5252", "#c92a2a"], ["#ff922b", "#d9480f"], ["#f06595", "#c2255c"], ["#be4bdb", "#862e9c"]];
const GRID_NORMAL = 16, GRID_EASY = 10;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let easy = ctx.store.get<boolean>("easy", false);
  let wrap = ctx.store.get<boolean>("wrap", false);
  let level = Math.max(1, Math.min(5, ctx.store.get<number>("level", 2)));
  const bestKey = () => (easy ? "best-easy" : "best-normal");
  const best = () => ctx.store.get<number>(bestKey(), 0);

  const scoreEl = h("span", { class: "snake-stat", id: "snake-score" }, "");
  const bestEl = h("span", { class: "snake-stat best", id: "snake-best" }, "");
  const pauseBtn = h("button", { class: "mopt", id: "snake-pause", onclick: () => togglePause() }, "暂停");
  const wrapBtn = h("button", { class: "mopt", id: "snake-wrap", onclick: () => { wrap = !wrap; ctx.store.set("wrap", wrap); ctx.sfx("tap"); reset(); } }, "");
  const levelBtn = h("button", { class: "mopt", id: "snake-level", onclick: () => { level = (level % 5) + 1; ctx.store.set("level", level); ctx.sfx("tap"); reset(); } }, "");
  const modeBtn = h("button", { class: "mopt", id: "snake-mode", onclick: () => { easy = !easy; ctx.store.set("easy", easy); if (easy && !ctx.store.get("easyTouched", false)) { wrap = true; ctx.store.set("wrap", true); } ctx.store.set("easyTouched", true); ctx.sfx("tap"); reset(); } }, "");
  const hud = h("div", { class: "snake-hud" }, scoreEl, bestEl, pauseBtn, wrapBtn, levelBtn, modeBtn);

  const canvas = h("canvas", { id: "snake-canvas" });
  const title = h("h2", {}, ""), msg = h("p", {}, ""), again = h("button", { class: "primary", id: "snake-start", onclick: () => { ctx.sfx("tap"); if (phase === "pause") togglePause(); else if (phase === "ready") begin(); else { reset(); begin(); } } }, "开始");
  const ovl = h("div", { class: "snake-ovl", id: "snake-ovl" }, title, msg, again);
  const field = h("div", { class: "snake-field", id: "snake-field" }, canvas, ovl);
  const board = h("div", { class: "snake-board" }, field);
  const padBtn = (d: Dir, t: string) => h("button", {
    "data-d": d, "aria-label": d, class: "snake-arrow",
    onpointerdown: (e: Event) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("down"); input(d); },
    onpointerup: (e: Event) => (e.currentTarget as HTMLElement).classList.remove("down"),
    onpointerleave: (e: Event) => (e.currentTarget as HTMLElement).classList.remove("down"),
  }, t);
  const pad = h("div", { class: "snake-pad" }, padBtn("U", "▲"), padBtn("L", "◀"), padBtn("D", "▼"), padBtn("R", "▶"));
  root.append(h("div", { class: "snake-wrap" }, hud, board, pad));

  let s!: SnakeState, phase: Phase = "ready";
  let prev: Pt[] = [], acc = 0, squish = 0, flash = 0, dieAt = 0, faceHappy = 0, last = 0, raf = 0, tongue = 0, now = 0, deadShown = 0;
  let parts: Particle[] = [];
  let N = GRID_NORMAL, cell = 20, dpr = 1;

  const setOvl = (t: string, m: string, b: string, show: boolean) => { title.textContent = t; msg.textContent = m; again.textContent = b; ovl.hidden = !show; };
  const refreshHud = () => {
    scoreEl.textContent = `得分：${s.score}`; bestEl.textContent = `最高：${Math.max(best(), s.score)}`;
    wrapBtn.textContent = wrap ? "穿墙：开" : "穿墙：关"; wrapBtn.classList.toggle("on", wrap);
    levelBtn.textContent = `速度：${level}`;
    modeBtn.textContent = easy ? "模式：简单" : "模式：普通"; modeBtn.classList.toggle("on", easy);
    pauseBtn.textContent = phase === "pause" ? "继续" : "暂停"; pauseBtn.disabled = phase !== "play" && phase !== "pause";
  };
  function reset() {
    N = easy ? GRID_EASY : GRID_NORMAL;
    s = newSnake(N, N, wrap);
    prev = s.snake.map((p) => ({ ...p })); acc = 0; squish = 0; flash = 0; parts = []; faceHappy = 0; deadShown = 0;
    phase = "ready";
    setOvl("贪吃蛇", "点一下开始，用手指滑动或按方向键转弯。", "开始", true);
    layout(); refreshHud();
  }
  function begin() { if (phase !== "ready") return; phase = "play"; setOvl("", "", "", false); last = performance.now(); acc = 0; refreshHud(); }
  function togglePause() {
    if (phase === "play") { phase = "pause"; setOvl("暂停", "点一下继续。", "继续", true); }
    else if (phase === "pause") { phase = "play"; setOvl("", "", "", false); last = performance.now(); }
    refreshHud();
  }
  function input(d: Dir) {
    if (phase === "ready") { if (d !== "L") { turn(s, d); } begin(); return; }
    if (phase === "pause") { togglePause(); }
    if (phase !== "play") return;
    if (turn(s, d)) ctx.sfx("move");
  }

  function doStep() {
    if (phase !== "play") return;
    const before = s.snake.map((p) => ({ ...p }));
    const r = step(s);
    if (r.moved) prev = before;
    if (r.ate) {
      ctx.sfx("eat"); squish = 1; faceHappy = 1;
      burst(before[0].x + VEC[s.dir].x, before[0].y + VEC[s.dir].y, FRUIT[(s.eaten - 1) % FRUIT.length][0]);
      refreshHud();
    }
    if (r.died || r.won) finish(r.won);
  }
  function finish(won: boolean) {
    phase = won ? "won" : "dead"; dieAt = now; flash = 1;
    const sc = s.score, old = best(), newBest = sc > old;
    if (newBest) ctx.store.set(bestKey(), sc);
    ctx.sfx(won ? "win" : "lose"); refreshHud();
    for (let i = 0; i < s.snake.length; i++) burstSoft(s.snake[i].x, s.snake[i].y);
    const show = () => { if (phase === "dead" || phase === "won") setOvl(won ? "太棒了！" : "游戏结束", newBest && sc > 0 ? `新纪录：${sc}` : `得分：${sc}`, "再玩一次", true); deadShown = 1; };
    timers.push(window.setTimeout(show, won ? 400 : 900));
    if (!won) ctx.toast(newBest && sc > 0 ? `新纪录：${sc}` : `得分：${sc}`, 1500);
  }
  const timers: number[] = [];

  const burst = (x: number, y: number, color: string) => {
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + Math.random() * 0.4, v = 2.2 + Math.random() * 3; parts.push({ x: x + 0.5, y: y + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.45 + Math.random() * 0.2, color: i % 3 ? color : "#ffe066", r: 0.12 + Math.random() * 0.1 }); }
  };
  const burstSoft = (x: number, y: number) => {
    for (let i = 0; i < 3; i++) parts.push({ x: x + 0.5, y: y + 0.5, vx: (Math.random() - 0.5) * 3, vy: (Math.random() - 0.5) * 3 - 1, life: 0, max: 0.6 + Math.random() * 0.3, color: i % 2 ? "#ced4da" : "#ffa8a8", r: 0.14 + Math.random() * 0.1 });
  };

  // ---- drawing ----
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    const size = Math.max(60, Math.floor(Math.min(w - 8, hh - 10) / N) * N);
    cell = size / N; dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr); canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`;
    field.style.width = `${size}px`; field.style.height = `${size}px`;
    draw();
  }
  const ease = (t: number) => t * t * (3 - 2 * t);
  function draw() {
    const g = canvas.getContext("2d"); if (!g) return;
    const c = cell; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { g.fillStyle = (x + y) % 2 ? "#c0eb75" : "#d8f5a2"; g.fillRect(x * c, y * c, c, c); }
    if (wrap) { g.strokeStyle = "#12b886"; g.lineWidth = 4; g.setLineDash([c * 0.4, c * 0.3]); g.strokeRect(2, 2, N * c - 4, N * c - 4); g.setLineDash([]); }
    // fruit
    if (s.food) {
      const [fc, fd] = FRUIT[s.eaten % FRUIT.length], bob = Math.sin(now / 260) * c * 0.03, cx = (s.food.x + 0.5) * c, cy = (s.food.y + 0.55) * c + bob, r = c * 0.36;
      g.fillStyle = "rgba(0,0,0,.12)"; g.beginPath(); g.ellipse(cx, (s.food.y + 0.92) * c, r * 0.8, r * 0.25, 0, 0, 7); g.fill();
      g.fillStyle = fc; g.strokeStyle = fd; g.lineWidth = Math.max(2, c * 0.07);
      g.beginPath(); g.arc(cx - r * 0.3, cy, r * 0.75, 0, 7); g.arc(cx + r * 0.3, cy, r * 0.75, 0, 7); g.fill(); g.stroke();
      g.beginPath(); g.arc(cx - r * 0.3, cy, r * 0.72, 0, 7); g.arc(cx + r * 0.3, cy, r * 0.72, 0, 7); g.fill();
      g.strokeStyle = "#5c3d1e"; g.lineWidth = Math.max(2, c * 0.07); g.beginPath(); g.moveTo(cx, cy - r * 0.6); g.quadraticCurveTo(cx + r * 0.1, cy - r * 1.1, cx + r * 0.35, cy - r * 1.2); g.stroke();
      g.fillStyle = "#37b24d"; g.beginPath(); g.ellipse(cx + r * 0.55, cy - r * 1.1, r * 0.4, r * 0.18, -0.5, 0, 7); g.fill();
      g.fillStyle = "rgba(255,255,255,.65)"; g.beginPath(); g.ellipse(cx - r * 0.55, cy - r * 0.2, r * 0.18, r * 0.3, 0.4, 0, 7); g.fill();
    }
    // snake body
    const t = phase === "play" ? Math.min(1, acc / interval(level, s.eaten, easy)) : 1, tt = ease(t);
    const n = s.snake.length;
    const dying = phase === "dead" || phase === "won";
    const visible = dying && phase === "dead" ? Math.max(0, n - Math.floor(Math.max(0, now - dieAt - 250) / 45)) : n;
    const pts: Pt[] = s.snake.map((p, i) => {
      const from = prev[i] ?? prev[prev.length - 1] ?? p;
      return Math.abs(from.x - p.x) > 1.5 || Math.abs(from.y - p.y) > 1.5 ? p : { x: from.x + (p.x - from.x) * tt, y: from.y + (p.y - from.y) * tt };
    });
    const shake = phase === "dead" && now - dieAt < 400 ? Math.sin((now - dieAt) / 25) * c * 0.06 : 0;
    const R = c * 0.43;
    const body = flash > 0 && phase === "dead" && Math.floor(now / 90) % 2 ? ["#ff8787", "#fa5252"] : ["#8ce99a", "#40c057"];
    const radiusAt = (i: number) => {
      let r = R * (1 - 0.18 * (i / Math.max(1, n)));
      if (squish > 0) { const pos = (1 - squish) * (n + 2), d = i - pos; r *= 1 + 0.38 * Math.exp(-d * d / 1.6) * squish; }
      return r;
    };
    // draw tail to head so the head is on top; fill gaps between segments with extra circles
    for (let i = visible - 1; i >= 0; i--) {
      const p = pts[i], q = pts[i + 1];
      const steps = q && Math.abs(q.x - p.x) <= 1.5 && Math.abs(q.y - p.y) <= 1.5 ? 4 : 1;
      for (let k = 0; k < steps; k++) {
        const f = k / steps, x = (q && steps > 1 ? q.x + (p.x - q.x) * (f + 1 / steps) : p.x) + 0.5, y = (q && steps > 1 ? q.y + (p.y - q.y) * (f + 1 / steps) : p.y) + 0.5;
        const r = radiusAt(i);
        g.fillStyle = "#2b8a3e"; g.beginPath(); g.arc(x * c + shake, y * c, r + Math.max(2, c * 0.06), 0, 7); g.fill();
      }
    }
    for (let i = visible - 1; i >= 0; i--) {
      const p = pts[i], q = pts[i + 1];
      const steps = q && Math.abs(q.x - p.x) <= 1.5 && Math.abs(q.y - p.y) <= 1.5 ? 4 : 1;
      for (let k = 0; k < steps; k++) {
        const f = k / steps, x = (q && steps > 1 ? q.x + (p.x - q.x) * (f + 1 / steps) : p.x) + 0.5, y = (q && steps > 1 ? q.y + (p.y - q.y) * (f + 1 / steps) : p.y) + 0.5;
        g.fillStyle = i % 2 ? body[0] : body[1]; g.beginPath(); g.arc(x * c + shake, y * c, radiusAt(i), 0, 7); g.fill();
      }
      if (i > 0) { g.fillStyle = "rgba(255,255,255,.45)"; g.beginPath(); g.arc((p.x + 0.5) * c - c * 0.1 + shake, (p.y + 0.5) * c - c * 0.12, radiusAt(i) * 0.28, 0, 7); g.fill(); }
    }
    // head
    if (visible > 0) {
      const p = pts[0], hr = radiusAt(0) * 1.16 * (1 + (squish > 0 ? 0.12 * Math.sin(squish * Math.PI) : 0));
      const ang = Math.atan2(VEC[s.dir].y, VEC[s.dir].x);
      g.save(); g.translate((p.x + 0.5) * c + shake, (p.y + 0.5) * c); g.rotate(ang);
      if (tongue > 0 && phase === "play") { g.strokeStyle = "#e03131"; g.lineWidth = Math.max(2, c * 0.07); g.lineCap = "round"; g.beginPath(); g.moveTo(hr * 0.8, 0); g.lineTo(hr * 1.45, 0); g.moveTo(hr * 1.45, 0); g.lineTo(hr * 1.7, -hr * 0.2); g.moveTo(hr * 1.45, 0); g.lineTo(hr * 1.7, hr * 0.2); g.stroke(); }
      g.fillStyle = "#2b8a3e"; g.beginPath(); g.arc(0, 0, hr + Math.max(2, c * 0.06), 0, 7); g.fill();
      g.fillStyle = dying && phase === "dead" && flash > 0 && Math.floor(now / 90) % 2 ? "#ff8787" : "#69db7c"; g.beginPath(); g.arc(0, 0, hr, 0, 7); g.fill();
      g.fillStyle = "rgba(255,120,150,.55)"; for (const sy of [-1, 1]) { g.beginPath(); g.arc(-hr * 0.15, sy * hr * 0.62, hr * 0.17, 0, 7); g.fill(); }
      const ex = hr * 0.28, ey = hr * 0.42, er = hr * 0.27;
      for (const sy of [-1, 1]) {
        if (phase === "dead") {
          g.strokeStyle = "#222"; g.lineWidth = Math.max(2, c * 0.08); g.lineCap = "round"; g.beginPath(); g.moveTo(ex - er * 0.7, sy * ey - er * 0.7); g.lineTo(ex + er * 0.7, sy * ey + er * 0.7); g.moveTo(ex + er * 0.7, sy * ey - er * 0.7); g.lineTo(ex - er * 0.7, sy * ey + er * 0.7); g.stroke();
        } else {
          g.fillStyle = "#fff"; g.strokeStyle = "#222"; g.lineWidth = Math.max(1.5, c * 0.04); g.beginPath(); g.arc(ex, sy * ey, er, 0, 7); g.fill(); g.stroke();
          g.fillStyle = "#222"; g.beginPath(); g.arc(ex + er * 0.3, sy * ey, er * 0.5, 0, 7); g.fill();
          g.fillStyle = "#fff"; g.beginPath(); g.arc(ex + er * 0.45, sy * ey - er * 0.2, er * 0.17, 0, 7); g.fill();
        }
      }
      g.strokeStyle = "#222"; g.fillStyle = "#c92a2a"; g.lineWidth = Math.max(2, c * 0.07); g.lineCap = "round";
      if (phase === "dead") { g.beginPath(); g.arc(hr * 0.5, 0, hr * 0.2, Math.PI * 0.9, Math.PI * 2.1); g.stroke(); }
      else if (faceHappy > 0 || phase === "won") { g.beginPath(); g.ellipse(hr * 0.5, 0, hr * 0.26, hr * 0.32, 0, 0, 7); g.fill(); g.stroke(); }
      else { g.beginPath(); g.arc(hr * 0.12, 0, hr * 0.5, -0.75, 0.75); g.stroke(); }
      g.restore();
    }
    // particles
    for (const q of parts) { const a = 1 - q.life / q.max; g.globalAlpha = Math.max(0, a); g.fillStyle = q.color; g.beginPath(); g.arc(q.x * c, q.y * c, q.r * c * (0.5 + a), 0, 7); g.fill(); }
    g.globalAlpha = 1;
    if (phase === "dead" && flash > 0) { g.fillStyle = `rgba(250,82,82,${0.25 * flash})`; g.fillRect(0, 0, N * c, N * c); }
  }

  function frame(ts: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, ts - (last || ts)); last = ts; now = ts;
    if (phase === "play") {
      acc += dt;
      const iv = interval(level, s.eaten, easy);
      let guard = 0;
      while (phase === "play" && acc >= iv && guard++ < 4) { acc -= iv; doStep(); }
      tongue = Math.floor(ts / 1100) % 2 === 0 && ts % 1100 < 260 ? 1 : 0;
    }
    const sec = dt / 1000;
    if (squish > 0) squish = Math.max(0, squish - sec / 0.45);
    if (faceHappy > 0) faceHappy = Math.max(0, faceHappy - sec / 0.5);
    if (flash > 0 && phase === "dead") flash = Math.max(0, flash - sec / 0.9);
    for (const q of parts) { q.life += sec; q.x += q.vx * sec; q.y += q.vy * sec; q.vy += 4 * sec; }
    parts = parts.filter((q) => q.life < q.max);
    draw();
  }

  // ---- input ----
  const KEYS: Record<string, Dir> = { ArrowUp: "U", ArrowDown: "D", ArrowLeft: "L", ArrowRight: "R", w: "U", W: "U", s: "D", S: "D", a: "L", A: "L", d: "R", D: "R" };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const d = KEYS[e.key];
    if (d) { e.preventDefault(); input(d); return; }
    if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") {
      e.preventDefault();
      if (phase === "play" || phase === "pause") togglePause();
      else if (phase === "ready") begin();
      else if (phase === "dead" || phase === "won") { reset(); begin(); }
    } else if (e.key === "Enter" && (phase === "dead" || phase === "won")) { reset(); begin(); }
  };
  let sx = 0, sy = 0, sid = -1;
  const onDown = (e: PointerEvent) => { if (e.target instanceof HTMLButtonElement) return; sid = e.pointerId; sx = e.clientX; sy = e.clientY; try { field.setPointerCapture(e.pointerId); } catch { /* ok */ } };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== sid) return;
    const dx = e.clientX - sx, dy = e.clientY - sy, th = Math.max(14, cell * 0.8);
    if (Math.abs(dx) < th && Math.abs(dy) < th) return;
    input(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "R" : "L") : (dy > 0 ? "D" : "U"));
    sx = e.clientX; sy = e.clientY;
  };
  const onUp = (e: PointerEvent) => { if (e.pointerId === sid) sid = -1; };
  const onVis = () => { if (document.hidden && phase === "play") togglePause(); };
  document.addEventListener("keydown", onKey);
  field.addEventListener("pointerdown", onDown); field.addEventListener("pointermove", onMove); field.addEventListener("pointerup", onUp); field.addEventListener("pointercancel", onUp);
  document.addEventListener("visibilitychange", onVis);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  reset();
  raf = requestAnimationFrame(frame);
  (window as unknown as Record<string, unknown>).__snake = { state: () => s, phase: () => phase, tick: () => doStep(), cell: () => cell, grid: () => N, finished: () => deadShown };
  return () => {
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__snake;
  };
}
