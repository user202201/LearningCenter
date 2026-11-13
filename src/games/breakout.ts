import type { GameCtx } from "./ctx";
import "./breakout.css";
import { W, H, PY, PH, BR, LEVEL_COUNT, WIDE_TIME, SLOW_TIME, MAXLIVES, START_LIVES, newLevel, step, launch, paddleW, type State, type Ev, type PowerKind } from "./breakout-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#c5f6fa"/><rect x="20" y="24" width="24" height="12" rx="4" fill="#fa5252" stroke="#c92a2a" stroke-width="3"/><rect x="48" y="24" width="24" height="12" rx="4" fill="#fcc419" stroke="#e67700" stroke-width="3"/><rect x="76" y="24" width="24" height="12" rx="4" fill="#51cf66" stroke="#2b8a3e" stroke-width="3"/><rect x="20" y="40" width="24" height="12" rx="4" fill="#4dabf7" stroke="#1971c2" stroke-width="3"/><rect x="48" y="40" width="24" height="12" rx="4" fill="#ffd43b" stroke="#e67700" stroke-width="3"/><path d="M80 41 L84 46 L81 51" fill="none" stroke="#862e9c" stroke-width="2.5" stroke-linecap="round"/><rect x="76" y="40" width="24" height="12" rx="4" fill="#cc5de8" stroke="#862e9c" stroke-width="3"/><circle cx="64" cy="70" r="9" fill="#fff" stroke="#087f5b" stroke-width="3.5"/><circle cx="61" cy="68" r="1.8" fill="#3a2e39"/><circle cx="67" cy="68" r="1.8" fill="#3a2e39"/><path d="M60.5 72 Q64 75 67.5 72" fill="none" stroke="#3a2e39" stroke-width="1.8" stroke-linecap="round"/><rect x="36" y="88" width="48" height="12" rx="6" fill="#12b886" stroke="#087f5b" stroke-width="3.5"/><circle cx="52" cy="94" r="1.8" fill="#fff"/><circle cx="68" cy="94" r="1.8" fill="#fff"/></svg>`;

type Phase = "ready" | "play" | "pause" | "clear" | "over" | "won";
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }
const BRICK: [string, string][] = [["#868e96", "#495057"], ["#fa5252", "#c92a2a"], ["#ff922b", "#d9480f"], ["#fcc419", "#e67700"], ["#51cf66", "#2b8a3e"], ["#4dabf7", "#1971c2"], ["#cc5de8", "#862e9c"]];
const CAPCOL: Record<PowerKind, [string, string]> = { wide: ["#51cf66", "#2b8a3e"], slow: ["#4dabf7", "#1971c2"], multi: ["#cc5de8", "#862e9c"], life: ["#fa5252", "#c92a2a"], sticky: ["#ff922b", "#d9480f"] };
const HEART = "M9 15 C2 10 1 6 3 3.5 C5 1.5 8 2 9 4.5 C10 2 13 1.5 15 3.5 C17 6 16 10 9 15 Z";
const STEP = 1 / 120;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let reached = Math.max(1, Math.min(LEVEL_COUNT, ctx.store.get<number>("level", 1)));
  let selLevel = reached;
  const best = () => ctx.store.get<number>("best", 0);

  const levelBtn = h("button", { class: "mopt", id: "bo-level", onclick: () => { if (phase !== "ready") return; selLevel = (selLevel % reached) + 1; ctx.sfx("tap"); setup(selLevel, 0); } }, "");
  const scoreEl = h("span", { class: "bo-stat", id: "bo-score" }, "");
  const bestEl = h("span", { class: "bo-stat best", id: "bo-best" }, "");
  const livesEl = h("span", { class: "bo-stat", id: "bo-lives" });
  const pauseBtn = h("button", { class: "mopt", id: "bo-pause", onclick: () => togglePause() }, "暂停");
  root.append(h("div", { class: "bo-wrap" }, h("div", { class: "bo-hud" }, levelBtn, scoreEl, bestEl, livesEl, pauseBtn)));
  const canvas = h("canvas", { id: "bo-canvas" });
  const title = h("h2", {}, ""), msg = h("p", {}, "");
  const action = h("button", { class: "primary", id: "bo-start", onclick: () => { ctx.sfx("tap"); primary(); } }, "开始");
  const ovl = h("div", { class: "bo-ovl", id: "bo-ovl" }, title, msg, action);
  const field = h("div", { class: "bo-field", id: "bo-field" }, canvas, ovl);
  const board = h("div", { class: "bo-board" }, field);
  root.querySelector(".bo-wrap")!.append(board);

  let s!: State, phase: Phase = "ready", levelStartScore = 0;
  let target = W / 2, px = W / 2, keyDir = 0, manual = false, last = 0, acc = 0, raf = 0, now = 0, squish = 0, shake = 0, blink = 0;
  let parts: Particle[] = [], cw = 300, ch = 400, dpr = 1;

  const setOvl = (t: string, m: string, b: string, show: boolean) => { title.textContent = t; msg.textContent = m; action.textContent = b; ovl.hidden = !show; };
  const hearts = () => { livesEl.replaceChildren(); for (let i = 0; i < MAXLIVES; i++) { if (i >= Math.max(START_LIVES, s.lives)) break; livesEl.insertAdjacentHTML("beforeend", `<svg class="bo-heart${i < s.lives ? " on" : ""}" viewBox="0 0 18 17"><path d="${HEART}"/></svg>`); } livesEl.dataset.lives = String(s.lives); };
  const refreshHud = () => {
    levelBtn.textContent = `关卡：${s.level}`; levelBtn.disabled = phase !== "ready" || reached < 2; levelBtn.classList.toggle("on", false);
    scoreEl.textContent = `得分：${s.score}`; bestEl.textContent = `最高：${Math.max(best(), s.score)}`; hearts();
    pauseBtn.textContent = phase === "pause" ? "继续" : "暂停"; pauseBtn.disabled = phase !== "play" && phase !== "pause";
  };
  function setup(level: number, score: number) {
    s = newLevel(level, START_LIVES, score); levelStartScore = score; px = target = W / 2; parts = []; squish = 0; shake = 0; phase = "ready";
    setOvl("打砖块", "拖动手指移动挡板，轻点发球。", "开始", true); refreshHud(); layout();
  }
  function begin() { if (phase !== "ready") return; phase = "play"; setOvl("", "", "", false); last = performance.now(); acc = 0; refreshHud(); }
  function togglePause() {
    if (phase === "play") { phase = "pause"; setOvl("暂停", "点击继续。", "继续", true); }
    else if (phase === "pause") { phase = "play"; setOvl("", "", "", false); last = performance.now(); acc = 0; }
    refreshHud();
  }
  function primary() {
    if (phase === "ready") begin();
    else if (phase === "pause") togglePause();
    else if (phase === "clear") { selLevel = s.level + 1; setup(selLevel, s.score); begin(); }
    else if (phase === "won") { selLevel = 1; setup(1, 0); begin(); }
    else if (phase === "over") { setup(s.level, levelStartScore); begin(); }
  }
  function saveBest() { if (s && s.score > best()) ctx.store.set("best", s.score); }
  function doLaunch() { if (phase !== "play") return; const e = launch(s); if (e.length) ctx.sfx("swap"); }

  const pop = (x: number, y: number, color: string, n = 10) => {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, v = 40 + Math.random() * 140; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40, life: 0, max: 0.4 + Math.random() * 0.3, color, r: 2 + Math.random() * 3 }); }
  };
  function handle(evs: Ev[]) {
    const kinds = new Set<string>();
    for (const e of evs) {
      if (e.t === "paddle") { squish = 1; kinds.add("tap"); }
      else if (e.t === "hit") { kinds.add("tap"); pop(e.x, e.y, BRICK[e.color][0], 4); }
      else if (e.t === "break") { kinds.add("pop"); pop(e.x, e.y, BRICK[e.color][0], 12); refreshHud(); }
      else if (e.t === "gold") kinds.add("place");
      else if (e.t === "catch") { kinds.add("good"); refreshHud(); }
      else if (e.t === "launch") kinds.add("swap");
      else if (e.t === "lost") { kinds.add("bad"); shake = 1; refreshHud(); }
      else if (e.t === "clear") onClear();
      else if (e.t === "over") onOver();
    }
    if (s.cleared || s.over) kinds.clear();
    kinds.forEach((k) => ctx.sfx(k as never));
  }
  function onClear() {
    phase = s.level >= LEVEL_COUNT ? "won" : "clear"; reached = Math.max(reached, Math.min(LEVEL_COUNT, s.level + 1)); ctx.store.set("level", reached);
    const rec = s.score > best(); saveBest(); ctx.sfx("win"); refreshHud();
    const m = rec ? `新纪录：${s.score}` : `得分：${s.score}`;
    setOvl(phase === "won" ? "全部通关。" : "已通关。", m, phase === "won" ? "再玩一次" : "下一关", true);
    for (let i = 0; i < 40; i++) pop(Math.random() * W, 80 + Math.random() * 200, BRICK[1 + (i % 6)][0], 1);
  }
  function onOver() {
    phase = "over"; const rec = s.score > best(); saveBest(); ctx.sfx("lose"); refreshHud();
    setOvl("游戏结束", "本关未完成，可重试。", "重试", true);
    ctx.toast(rec && s.score > 0 ? `新纪录：${s.score}` : `得分：${s.score}`, 1500);
  }

  function advance(dt: number) {
    if (phase !== "play") return;
    target = Math.max(0, Math.min(W, target + keyDir * 640 * dt));
    px += (target - px) * (1 - Math.exp(-dt * 30));
    handle(step(s, dt, px)); px = s.px;
    const sec = dt;
    if (squish > 0) squish = Math.max(0, squish - sec / 0.25);
    if (shake > 0) shake = Math.max(0, shake - sec / 0.4);
  }

  // ---- drawing ----
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    cw = Math.max(120, Math.floor(Math.min(w - 8, ((hh - 10) * 3) / 4))); ch = Math.round((cw * 4) / 3); dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = `${cw}px`; canvas.style.height = `${ch}px`; field.style.width = `${cw}px`; field.style.height = `${ch}px`;
    draw();
  }
  function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, hgt: number, r: number) { g.beginPath(); g.roundRect(x, y, w, hgt, r); }
  function capsule(g: CanvasRenderingContext2D, x: number, y: number, kind: PowerKind, k = 1) {
    const [f, d] = CAPCOL[kind], w = 38 * k, hh = 24 * k;
    g.save(); g.translate(x, y);
    g.fillStyle = f; g.strokeStyle = d; g.lineWidth = 3 * k; rr(g, -w / 2, -hh / 2, w, hh, hh / 2); g.fill(); g.stroke();
    g.fillStyle = "rgba(255,255,255,.4)"; rr(g, -w / 2 + 6 * k, -hh / 2 + 3 * k, w - 12 * k, 4 * k, 2 * k); g.fill();
    g.strokeStyle = "#fff"; g.fillStyle = "#fff"; g.lineWidth = 2.4 * k; g.lineCap = "round"; g.lineJoin = "round";
    if (kind === "wide") { g.beginPath(); g.moveTo(-9 * k, 2 * k); g.lineTo(9 * k, 2 * k); g.moveTo(-5 * k, -2 * k); g.lineTo(-9 * k, 2 * k); g.lineTo(-5 * k, 6 * k); g.moveTo(5 * k, -2 * k); g.lineTo(9 * k, 2 * k); g.lineTo(5 * k, 6 * k); g.stroke(); }
    else if (kind === "slow") { g.beginPath(); g.arc(0, 2 * k, 6.5 * k, 0, 7); g.moveTo(0, 2 * k); g.lineTo(0, -2 * k); g.moveTo(0, 2 * k); g.lineTo(3 * k, 3 * k); g.stroke(); }
    else if (kind === "multi") { for (const [ax, ay] of [[-8, 3], [0, 3], [8, 3]] as const) { g.beginPath(); g.arc(ax * k, ay * k, 3.2 * k, 0, 7); g.fill(); } }
    else if (kind === "life") { g.save(); g.translate(-7 * k, -6 * k); g.scale(0.78 * k, 0.78 * k); g.beginPath(); g.fill(new Path2D(HEART)); g.restore(); }
    else { g.beginPath(); g.moveTo(-9 * k, 3 * k); g.quadraticCurveTo(-4 * k, -4 * k, 0, 3 * k); g.quadraticCurveTo(4 * k, 8 * k, 9 * k, -1 * k); g.stroke(); }
    g.restore();
  }
  function ball(g: CanvasRenderingContext2D, x: number, y: number, vx: number, happy: boolean) {
    g.fillStyle = "rgba(0,0,0,.12)"; g.beginPath(); g.ellipse(x + 2, y + 5, BR * 0.9, BR * 0.55, 0, 0, 7); g.fill();
    g.fillStyle = "#fff"; g.strokeStyle = "#087f5b"; g.lineWidth = 3; g.beginPath(); g.arc(x, y, BR - 1, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "#3a2e39"; const ex = Math.max(-1.5, Math.min(1.5, vx * 2));
    g.beginPath(); g.arc(x - 3 + ex, y - 2, 1.5, 0, 7); g.arc(x + 3 + ex, y - 2, 1.5, 0, 7); g.fill();
    g.strokeStyle = "#3a2e39"; g.lineWidth = 1.5; g.lineCap = "round"; g.beginPath(); if (happy) g.arc(x + ex, y + 1.5, 3.2, 0.1 * Math.PI, 0.9 * Math.PI); else g.arc(x + ex, y + 2, 2.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  function draw() {
    const g = canvas.getContext("2d"); if (!g || !s) return;
    const k = (cw * dpr) / W; g.setTransform(k, 0, 0, k, 0, 0);
    const sx = shake > 0 ? Math.sin(now / 30) * 4 * shake : 0; g.translate(sx, 0);
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#e6fcf5"); bg.addColorStop(1, "#c3fae8"); g.fillStyle = bg; g.fillRect(-8, 0, W + 16, H);
    g.fillStyle = "rgba(18,184,134,.07)"; for (let i = 0; i < 8; i++) g.fillRect(0, i * 80 + 40, W, 40);
    // bricks
    for (const b of s.bricks) {
      const [f, d] = BRICK[b.color];
      if (b.gold) {
        const gr = g.createLinearGradient(b.x, b.y, b.x, b.y + b.h); gr.addColorStop(0, "#ffec99"); gr.addColorStop(1, "#fcc419");
        g.fillStyle = gr; g.strokeStyle = "#e67700"; g.lineWidth = 3; rr(g, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 6); g.fill(); g.stroke();
        g.fillStyle = "rgba(255,255,255,.7)"; rr(g, b.x + 6, b.y + 5, b.w - 20, 3, 1.5); g.fill();
        g.fillStyle = "#e67700"; for (const ax of [8, b.w - 8]) { g.beginPath(); g.arc(b.x + ax, b.y + b.h / 2 + 2, 2, 0, 7); g.fill(); }
        continue;
      }
      g.fillStyle = f; g.strokeStyle = b.maxhp === 2 && b.hp === 2 ? "#3a2e39" : d; g.lineWidth = b.maxhp === 2 && b.hp === 2 ? 4 : 3; rr(g, b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3, 6); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.4)"; rr(g, b.x + 7, b.y + 6, b.w - 18, 3.5, 1.75); g.fill();
      if (b.maxhp === 2 && b.hp === 1) { g.strokeStyle = d; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.moveTo(b.x + b.w * 0.45, b.y + 2); g.lineTo(b.x + b.w * 0.38, b.y + b.h * 0.4); g.lineTo(b.x + b.w * 0.52, b.y + b.h * 0.6); g.lineTo(b.x + b.w * 0.44, b.y + b.h - 2); g.stroke(); }
      if (b.power) { g.fillStyle = "rgba(255,255,255,.9)"; g.beginPath(); g.arc(b.x + b.w - 9, b.y + b.h / 2, 3, 0, 7); g.fill(); }
    }
    // active effects
    let ex = 22;
    const eff: [PowerKind, number][] = []; if (s.wideT > 0) eff.push(["wide", s.wideT / WIDE_TIME]); if (s.slowT > 0) eff.push(["slow", s.slowT / SLOW_TIME]); if (s.sticky > 0) eff.push(["sticky", 1]);
    for (const [kind, fr] of eff) { capsule(g, ex + 14, 28, kind, 0.75); g.fillStyle = "rgba(8,127,91,.25)"; rr(g, ex - 1, 42, 30, 4, 2); g.fill(); g.fillStyle = "#12b886"; rr(g, ex - 1, 42, 30 * fr, 4, 2); g.fill(); ex += 46; }
    // capsules
    for (const c of s.caps) capsule(g, c.x, c.y, c.kind);
    // paddle
    const pw = paddleW(s), sq = Math.sin(squish * Math.PI) * 0.18, pxx = s.px - pw / 2, pyy = PY + sq * PH * 0.5, phh = PH * (1 - sq);
    g.fillStyle = "rgba(0,0,0,.12)"; rr(g, pxx + 2, PY + 6, pw, PH, 10); g.fill();
    g.fillStyle = s.sticky > 0 ? "#ffa94d" : "#12b886"; g.strokeStyle = s.sticky > 0 ? "#d9480f" : "#087f5b"; g.lineWidth = 4; rr(g, pxx + 2, pyy + 2, pw - 4, phh - 4, 9); g.fill(); g.stroke();
    g.fillStyle = "rgba(255,255,255,.4)"; rr(g, pxx + 12, pyy + 5, pw - 24, 3, 1.5); g.fill();
    const look = s.balls.find((b) => !b.stuck) ?? s.balls[0], lx = look ? Math.max(-1.5, Math.min(1.5, (look.x - s.px) / 40)) : 0;
    g.fillStyle = "#fff"; for (const e of [-10, 10]) { g.beginPath(); g.arc(s.px + e, pyy + phh / 2 + 1, 3.2, 0, 7); g.fill(); }
    g.fillStyle = "#3a2e39"; for (const e of [-10, 10]) { g.beginPath(); g.arc(s.px + e + lx, pyy + phh / 2 + 1, 1.7, 0, 7); g.fill(); }
    g.strokeStyle = "#fff"; g.lineWidth = 1.6; g.lineCap = "round"; g.beginPath(); g.arc(s.px, pyy + phh / 2 - 1, 3.5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    // balls
    for (const b of s.balls) ball(g, b.x, b.y, b.dx, squish > 0 || b.stuck || phase === "clear");
    // aiming hint while the ball waits
    const st = s.balls.find((b) => b.stuck);
    if (st && phase === "play" && !st.sticky) { g.strokeStyle = "rgba(8,127,91,.45)"; g.lineWidth = 3; g.setLineDash([4, 8]); g.beginPath(); g.moveTo(st.x, st.y - 16); g.lineTo(st.x + Math.sin(0.18) * 70, st.y - 16 - Math.cos(0.18) * 70); g.stroke(); g.setLineDash([]); }
    // particles
    for (const q of parts) { g.globalAlpha = Math.max(0, 1 - q.life / q.max); g.fillStyle = q.color; g.fillRect(q.x - q.r / 2, q.y - q.r / 2, q.r, q.r); }
    g.globalAlpha = 1; void blink;
  }
  function frame(ts: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, ts - (last || ts)); last = ts; now = ts;
    if (!manual && phase === "play") { acc += dt / 1000; let guard = 0; while (acc >= STEP && guard++ < 12 && phase === "play") { acc -= STEP; advance(STEP); } }
    const sec = dt / 1000;
    for (const q of parts) { q.life += sec; q.x += q.vx * sec; q.y += q.vy * sec; q.vy += 520 * sec; }
    parts = parts.filter((q) => q.life < q.max);
    draw();
  }

  // ---- input ----
  const toBoard = (clientX: number) => { const r = canvas.getBoundingClientRect(); return ((clientX - r.left) / r.width) * W; };
  let pid = -1, downX = 0, downY = 0, downT = 0, moved = 0;
  const onDown = (e: PointerEvent) => {
    if (e.target instanceof HTMLButtonElement) return;
    if (pid !== -1) return;   // one finger
    pid = e.pointerId; downX = e.clientX; downY = e.clientY; downT = performance.now(); moved = 0;
    try { field.setPointerCapture(e.pointerId); } catch { /* ok */ }
    if (phase === "play") target = Math.max(0, Math.min(W, toBoard(e.clientX)));
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pid && !(e.pointerType === "mouse" && pid === -1)) return;
    if (e.pointerId === pid) moved = Math.max(moved, Math.hypot(e.clientX - downX, e.clientY - downY));
    if (phase === "play") target = Math.max(0, Math.min(W, toBoard(e.clientX)));
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = -1;
    if (e.type === "pointerup" && moved < 12 && performance.now() - downT < 500) doLaunch();
  };
  const KEYMAP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, a: -1, A: -1, d: 1, D: 1 };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key in KEYMAP) { e.preventDefault(); keyDir = KEYMAP[e.key]; return; }
    if (e.key === "p" || e.key === "P" || e.key === "Escape") { e.preventDefault(); if (phase === "play" || phase === "pause") togglePause(); return; }
    if (e.key === " " || e.key === "Enter") {
      if (e.target instanceof HTMLButtonElement && e.key === "Enter") return;
      e.preventDefault();
      if (phase === "play") doLaunch(); else primary();
    }
  };
  const onKeyUp = (e: KeyboardEvent) => { const d = KEYMAP[e.key]; if (d !== undefined && keyDir === d) keyDir = 0; };
  const onVis = () => { if (document.hidden && phase === "play") togglePause(); };
  document.addEventListener("keydown", onKey); document.addEventListener("keyup", onKeyUp); document.addEventListener("visibilitychange", onVis);
  field.addEventListener("pointerdown", onDown); field.addEventListener("pointermove", onMove); field.addEventListener("pointerup", onUp); field.addEventListener("pointercancel", onUp);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null; ro?.observe(board);

  setup(selLevel, 0);
  raf = requestAnimationFrame(frame);
  const hook = {
    state: () => s, phase: () => phase, px: () => px, target: () => target, cw: () => cw, ch: () => ch, particles: () => parts.length,
    manual: (on: boolean) => { manual = on; },
    /** advance n fixed steps (1/120 s) by hand */
    step: (n = 1) => { for (let i = 0; i < n; i++) advance(STEP); },
    setLevel: (l: number, score = 0) => { selLevel = l; setup(l, score); },
  };
  (window as unknown as Record<string, unknown>).__breakout = hook;
  return () => {
    saveBest(); cancelAnimationFrame(raf); ro?.disconnect();
    document.removeEventListener("keydown", onKey); document.removeEventListener("keyup", onKeyUp); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__breakout;
  };
}
