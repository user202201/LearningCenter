import type { GameCtx } from "./ctx";
import "./maze.css";
import {
  generateMaze, fitDim, SIZES, drawSegment, stepDir, touchTarget, undoCells, hintCells, starsFor, fmtTime, solve, cellAt, MAX_HINTS, DIRS,
  type Maze, type SizeKey, type Algo,
} from "./maze-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><path d="M24 32 H96 V88 H40 V58 H72" fill="none" stroke="#087f5b" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="M24 32 H96 V88 H40 V58 H72" fill="none" stroke="#12b886" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 45 H84 V73 H54" fill="none" stroke="#e8590c" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M32 45 H84 V73 H54" fill="none" stroke="#ffa94d" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="32" cy="45" r="11" fill="#ffd43b" stroke="#e67700" stroke-width="3.5"/><circle cx="28.5" cy="43" r="2.2" fill="#3a2e39"/><circle cx="35.5" cy="43" r="2.2" fill="#3a2e39"/><path d="M28 48.5 Q32 52 36 48.5" fill="none" stroke="#3a2e39" stroke-width="2" stroke-linecap="round"/><path d="M54 74 V58 L66 63 L54 68" fill="#fa5252" stroke="#c92a2a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;

interface Theme { floor: string; wall: string; wallDark: string; line: string; lineDark: string }
/** the colour themes: one is chosen at random for every maze (the first is the app's mint) */
const THEMES: Theme[] = [
  { floor: "#f1fff8", wall: "#12b886", wallDark: "#087f5b", line: "#ff922b", lineDark: "#d9480f" },
  { floor: "#fff4e6", wall: "#f76707", wallDark: "#a63d00", line: "#339af0", lineDark: "#1864ab" },
  { floor: "#edf6ff", wall: "#339af0", wallDark: "#1864ab", line: "#fa5252", lineDark: "#c92a2a" },
  { floor: "#f8f0fc", wall: "#9c36b5", wallDark: "#5f1f73", line: "#fcc419", lineDark: "#d9840a" },
  { floor: "#fff9db", wall: "#e8a600", wallDark: "#8a5a00", line: "#7048e8", lineDark: "#4527a0" },
  { floor: "#fff0f6", wall: "#e64980", wallDark: "#a61e4d", line: "#20c997", lineDark: "#087f5b" },
  { floor: "#e6fcf5", wall: "#0b7285", wallDark: "#053f4b", line: "#ff6b6b", lineDark: "#c92a2a" },
  { floor: "#f4fce3", wall: "#5c940d", wallDark: "#33530a", line: "#f06595", lineDark: "#a61e4d" },
];
const GOLD = { line: "#fcc419", lineDark: "#e8890c" };
type Phase = "play" | "won";
type Art = "flag" | "star" | "house";
const ARTS: Art[] = ["flag", "star", "house"];
interface Particle { x: number; y: number; vx: number; vy: number; life: number; max: number; color: string; r: number }

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let sizeKey = ctx.store.get<SizeKey>("size", "normal");
  if (!SIZES.some((s) => s.key === sizeKey)) sizeKey = "normal";
  const bestKey = () => `best-${sizeKey}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);

  const timeEl = h("span", { class: "mz-stat", id: "mz-time" }, "");
  const bestEl = h("span", { class: "mz-stat best", id: "mz-best" }, "");
  const hintsEl = h("span", { class: "mz-stat", id: "mz-hints" }, "");
  const sizeEl = h("span", { class: "mz-stat", id: "mz-sizelabel" }, "");
  const hud = h("div", { class: "mz-hud" }, timeEl, bestEl, hintsEl, sizeEl);

  const canvas = h("canvas", { id: "mz-canvas", "aria-label": "迷宫", role: "img" }) as HTMLCanvasElement;
  const title = h("h2", {}, ""), msg = h("p", {}, ""), starsEl = h("p", { class: "mz-stars", id: "mz-stars" }, ""), note = h("p", { id: "mz-note" }, "");
  const again = h("button", { class: "primary", id: "mz-next", onclick: () => { ctx.sfx("tap"); newMaze(); } }, "再来一个");
  const ovl = h("div", { class: "mz-ovl", id: "mz-ovl" }, title, msg, starsEl, note, again) as HTMLElement;
  ovl.hidden = true;
  const field = h("div", { class: "mz-field", id: "mz-field" }, canvas, ovl) as HTMLElement;
  const board = h("div", { class: "mz-board" }, field) as HTMLElement;
  const undoBtn = h("button", { class: "mopt", id: "mz-undo", onclick: () => { ctx.sfx("tap"); undo(); } }, "撤销") as HTMLButtonElement;
  const resetBtn = h("button", { class: "mopt", id: "mz-reset", onclick: () => { ctx.sfx("tap"); clearLine(); } }, "擦除重来") as HTMLButtonElement;
  const hintBtn = h("button", { class: "mopt", id: "mz-hint", onclick: () => { ctx.sfx("tap"); hint(); } }, "提示") as HTMLButtonElement;
  const answerBtn = h("button", { class: "mopt", id: "mz-answer", onclick: () => { ctx.sfx("tap"); toggleAnswer(); } }, "显示答案") as HTMLButtonElement;
  const newBtn = h("button", { class: "mopt", id: "mz-new", onclick: () => { ctx.sfx("tap"); newMaze(); } }, "新迷宫") as HTMLButtonElement;
  const sizeBtn = h("button", { class: "mopt", id: "mz-size", onclick: () => { ctx.sfx("tap"); const i = SIZES.findIndex((s) => s.key === sizeKey); sizeKey = SIZES[(i + 1) % SIZES.length].key; ctx.store.set("size", sizeKey); newMaze(); } }, "换大小") as HTMLButtonElement;
  const pad = h("div", { class: "mz-pad" }, undoBtn, resetBtn, hintBtn, answerBtn, newBtn, sizeBtn);
  root.append(h("div", { class: "mz-wrap" }, hud, board, pad));

  let m!: Maze, theme = THEMES[0], themeIdx = 0, art: Art = "flag";
  let path: number[] = [], phase: Phase = "play";
  let hintsUsed = 0, hintShown: number[] = [], answer: number[] | null = null, cheated = false;
  let t0 = 0, tEnd = 0, winAt = 0, face = 1, dpr = 1, cell = 20, pd = 3, cw = 0, last = 0;
  let parts: Particle[] = [], dirty = true, raf = 0, now = 0, lastBad = 0, newRecord = false;
  const base = document.createElement("canvas");
  const timers: number[] = [];

  const elapsed = () => (t0 ? (phase === "won" ? tEnd : performance.now()) - t0 : 0);
  const refreshHud = () => {
    timeEl.textContent = `时间：${fmtTime(elapsed())}`;
    const b = best();
    bestEl.textContent = `最快：${b ? fmtTime(b) : "-"}`;
    hintsEl.textContent = `提示：${hintsUsed} / ${MAX_HINTS}`;
    const name = { easy: "简单", normal: "普通", hard: "困难", expert: "专家" }[sizeKey];
    sizeEl.textContent = `${name} ${m.w}×${m.h}`;
    hintBtn.disabled = phase !== "play" || hintsUsed >= MAX_HINTS;
    undoBtn.disabled = phase !== "play" || path.length < 2;
    resetBtn.disabled = phase !== "play" || path.length < 2;
    answerBtn.textContent = answer ? "隐藏答案" : "显示答案";
    answerBtn.classList.toggle("on", !!answer);
    answerBtn.disabled = phase !== "play";
  };

  // ---- geometry ----
  const avail = () => {
    const w = board.clientWidth || 300, hh = board.clientHeight || 300;
    return Math.max(80, Math.min(w - 8, hh - 10));
  };
  const wallW = (c: number) => Math.max(3, Math.round(c * 0.2));
  function layout() {
    const a = avail(), n = Math.max(m.w, m.h);
    let c = Math.max(4, Math.floor(a / n));
    pd = Math.ceil(wallW(c) / 2) + 2;
    c = Math.max(4, Math.floor((a - 2 * pd) / n));
    pd = Math.ceil(wallW(c) / 2) + 2;
    cell = c; dpr = Math.min(3, window.devicePixelRatio || 1);
    cw = c * m.w + 2 * pd;
    const chh = c * m.h + 2 * pd;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(chh * dpr);
    canvas.style.width = `${cw}px`; canvas.style.height = `${chh}px`;
    field.style.width = `${cw}px`; field.style.height = `${chh}px`;
    base.width = canvas.width; base.height = canvas.height;
    drawBase(); dirty = true;
  }

  // ---- state changes ----
  function newMaze(seed?: number) {
    const nominal = SIZES.find((s) => s.key === sizeKey)!.n, d = fitDim(nominal, avail() - 12);
    build(d, d, seed ?? Math.floor(Math.random() * 4294967296));
  }
  function build(w: number, hh: number, seed: number, algo?: Algo) {
    m = generateMaze(w, hh, seed, algo);
    let ti = Math.floor(Math.random() * THEMES.length); if (ti === themeIdx) ti = (ti + 1) % THEMES.length;
    themeIdx = ti; theme = THEMES[ti]; art = ARTS[Math.floor(Math.random() * ARTS.length)];
    path = [m.start]; phase = "play"; hintsUsed = 0; hintShown = []; answer = null; cheated = false; t0 = 0; tEnd = 0; parts = []; winAt = 0; newRecord = false;
    ovl.hidden = true; face = 1;
    layout(); refreshHud();
  }
  const setPath = (p: number[]) => { path = p; hintShown = []; dirty = true; };
  function startClock() { if (!t0) t0 = performance.now(); }
  function undo() { if (phase !== "play" || path.length < 2) return; setPath(undoCells(path)); refreshHud(); }
  function clearLine() { if (phase !== "play" || path.length < 2) return; setPath([m.start]); refreshHud(); }
  function hint() {
    if (phase !== "play" || hintsUsed >= MAX_HINTS) return;
    hintsUsed++; hintShown = hintCells(m, path); dirty = true; startClock(); refreshHud();
  }
  function toggleAnswer() {
    if (phase !== "play") return;
    if (answer) answer = null; else { answer = solve(m, m.start, m.exit); if (!cheated) ctx.toast("答案已显示，本次不计成绩。", 1800); cheated = true; startClock(); }
    dirty = true; refreshHud();
  }
  function apply(res: { path: number[]; moved: boolean; blocked: boolean; won: boolean }) {
    if (res.moved) {
      const dh = res.path.length - path.length;
      const a = res.path[res.path.length - 1], b = res.path[Math.max(0, res.path.length - 2)];
      if (a !== b) { const dx = (a % m.w) - (b % m.w); face = dx > 0 ? 1 : dx < 0 ? -1 : face; }
      setPath(res.path); startClock();
      if (dh > 0 && res.path.length % 4 === 0) ctx.sfx("move");
      refreshHud();
    }
    if (res.blocked && now - lastBad > 350) { lastBad = now; ctx.sfx("bad"); }
    if (res.won && phase === "play") win();
  }
  function win() {
    phase = "won"; tEnd = performance.now(); winAt = now || tEnd; dirty = true;
    const ms = tEnd - t0, old = best();
    if (!cheated && (old === 0 || ms < old)) { ctx.store.set(bestKey(), Math.round(ms)); newRecord = true; }
    ctx.sfx("win"); confetti(); refreshHud();
    const stars = starsFor(hintsUsed, cheated);
    timers.push(window.setTimeout(() => {
      if (phase !== "won") return;
      title.textContent = "迷宫完成。"; msg.textContent = `用时 ${fmtTime(ms)}`;
      starsEl.textContent = "★".repeat(stars) + "☆".repeat(3 - stars); starsEl.dataset.stars = String(stars);
      note.textContent = newRecord ? "新纪录。" : ""; note.hidden = !newRecord;
      ovl.hidden = false;
    }, 800));
  }
  function confetti() {
    const cols = ["#fa5252", "#fcc419", "#12b886", "#339af0", "#be4bdb", "#ff922b"], ex = (m.exit % m.w + 0.5) * cell, ey = (Math.floor(m.exit / m.w) + 0.5) * cell;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 190;
      parts.push({ x: ex, y: ey, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 90, life: 0, max: 0.9 + Math.random() * 0.7, color: cols[i % cols.length], r: 2.5 + Math.random() * 2.5 });
    }
  }

  // ---- drawing ----
  const cx = (c: number) => pd + ((c % m.w) + 0.5) * cell;
  const cy = (c: number) => pd + (Math.floor(c / m.w) + 0.5) * cell;
  function drawBase() {
    const g = base.getContext("2d"); if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = theme.floor; g.fillRect(0, 0, cw, cell * m.h + 2 * pd);
    // start pad and exit pad
    for (const [c, col] of [[m.start, theme.line], [m.exit, "#fcc419"]] as [number, string][]) {
      g.globalAlpha = 0.28; g.fillStyle = col; g.beginPath(); g.arc(cx(c), cy(c), cell * 0.44, 0, 7); g.fill(); g.globalAlpha = 1;
    }
    const segs = new Path2D(), lw = wallW(cell);
    const X = (x: number) => pd + x * cell, Y = (y: number) => pd + y * cell;
    const gapN = (c: number, side: number) => (c === m.start && m.startSide === side) || (c === m.exit && m.exitSide === side);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const c = y * m.w + x, o = m.open[c];
      if (!(o & DIRS[0].bit) && !(y === 0 && gapN(c, 0))) { segs.moveTo(X(x), Y(y)); segs.lineTo(X(x + 1), Y(y)); }
      if (!(o & DIRS[3].bit) && !(x === 0 && gapN(c, 3))) { segs.moveTo(X(x), Y(y)); segs.lineTo(X(x), Y(y + 1)); }
      if (x === m.w - 1 && !gapN(c, 1)) { segs.moveTo(X(x + 1), Y(y)); segs.lineTo(X(x + 1), Y(y + 1)); }
      if (y === m.h - 1 && !gapN(c, 2)) { segs.moveTo(X(x), Y(y + 1)); segs.lineTo(X(x + 1), Y(y + 1)); }
    }
    g.lineCap = "round"; g.lineJoin = "round";
    g.save(); g.translate(0, Math.max(1.5, lw * 0.35)); g.strokeStyle = theme.wallDark; g.lineWidth = lw + 1; g.stroke(segs); g.restore();
    g.strokeStyle = theme.wall; g.lineWidth = lw; g.stroke(segs);
    g.strokeStyle = "rgba(255,255,255,.35)"; g.lineWidth = Math.max(1, lw * 0.28); g.save(); g.translate(0, -lw * 0.22); g.stroke(segs); g.restore();
    drawExit(g);
  }
  function drawExit(g: CanvasRenderingContext2D) {
    const x = cx(m.exit), y = cy(m.exit), r = cell * 0.4;
    g.lineJoin = "round"; g.lineCap = "round"; g.lineWidth = Math.max(1.5, cell * 0.07); g.strokeStyle = "#3a2e39";
    if (art === "flag") {
      g.beginPath(); g.moveTo(x - r * 0.55, y + r); g.lineTo(x - r * 0.55, y - r); g.stroke();
      g.fillStyle = "#fa5252"; g.beginPath(); g.moveTo(x - r * 0.55, y - r); g.lineTo(x + r * 0.95, y - r * 0.4); g.lineTo(x - r * 0.55, y + r * 0.2); g.closePath(); g.fill(); g.stroke();
    } else if (art === "star") {
      g.fillStyle = "#ffd43b"; g.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r * 1.05; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
      g.closePath(); g.fill(); g.stroke();
    } else {
      g.fillStyle = "#ffa94d"; g.beginPath(); g.rect(x - r * 0.8, y - r * 0.15, r * 1.6, r * 1.05); g.fill(); g.stroke();
      g.fillStyle = "#fa5252"; g.beginPath(); g.moveTo(x - r * 1.0, y - r * 0.1); g.lineTo(x, y - r * 1.0); g.lineTo(x + r * 1.0, y - r * 0.1); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#fff3bf"; g.beginPath(); g.rect(x - r * 0.18, y + r * 0.25, r * 0.36, r * 0.65); g.fill();
    }
  }
  function polyline(g: CanvasRenderingContext2D, cells: number[], from = 0) {
    g.beginPath();
    for (let i = from; i < cells.length; i++) { if (i === from) g.moveTo(cx(cells[i]), cy(cells[i])); else g.lineTo(cx(cells[i]), cy(cells[i])); }
  }
  function character(g: CanvasRenderingContext2D, x: number, y: number, r: number, jump: number) {
    const sq = jump > 0 ? 1 : 1;
    g.save(); g.translate(x, y - jump); g.scale(sq, sq);
    g.fillStyle = "rgba(0,0,0,.15)"; g.beginPath(); g.ellipse(0, r * 0.95 + jump, r * 0.8, r * 0.22, 0, 0, 7); g.fill();
    g.lineWidth = Math.max(1.5, r * 0.16); g.strokeStyle = "#e67700"; g.fillStyle = "#ffd43b";
    g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke();
    g.fillStyle = "rgba(255,120,150,.55)"; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * r * 0.58, r * 0.28, r * 0.17, 0, 7); g.fill(); }
    const ex = r * 0.34, ey = -r * 0.1, er = r * 0.25;
    for (const s of [-1, 1]) {
      g.fillStyle = "#fff"; g.strokeStyle = "#3a2e39"; g.lineWidth = Math.max(1, r * 0.08); g.beginPath(); g.arc(s * ex, ey, er, 0, 7); g.fill(); g.stroke();
      g.fillStyle = "#3a2e39"; g.beginPath(); g.arc(s * ex + face * er * 0.3, ey, er * 0.52, 0, 7); g.fill();
    }
    g.strokeStyle = "#3a2e39"; g.lineWidth = Math.max(1.5, r * 0.12); g.lineCap = "round";
    g.beginPath(); if (phase === "won") g.arc(0, r * 0.2, r * 0.34, 0.1, Math.PI - 0.1); else g.arc(0, r * 0.12, r * 0.28, 0.25, Math.PI - 0.25); g.stroke();
    g.restore();
  }
  function draw() {
    const g = canvas.getContext("2d"); if (!g) return;
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(base, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.lineCap = "round"; g.lineJoin = "round";
    const lw = Math.max(4, cell * 0.46), won = phase === "won";
    const col = won ? GOLD.line : theme.line, dark = won ? GOLD.lineDark : theme.lineDark;
    if (answer) {
      g.save(); g.setLineDash([cell * 0.35, cell * 0.45]); g.strokeStyle = "#e8590c"; g.lineWidth = Math.max(3, cell * 0.3); polyline(g, answer); g.stroke(); g.restore();
    }
    if (path.length > 0) {
      polyline(g, path);
      if (path.length === 1) { g.beginPath(); g.moveTo(cx(path[0]), cy(path[0])); g.lineTo(cx(path[0]) + 0.01, cy(path[0])); }
      g.strokeStyle = dark; g.lineWidth = lw + Math.max(2, cell * 0.14); g.stroke();
      g.strokeStyle = col; g.lineWidth = lw; g.stroke();
      g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = Math.max(1.5, lw * 0.22); g.save(); g.translate(0, -lw * 0.14); g.stroke(); g.restore();
    }
    if (hintShown.length) {
      for (let i = 0; i < hintShown.length; i++) {
        const c = hintShown[i], r = Math.max(2.5, cell * (0.2 - i * 0.012));
        g.fillStyle = "#fff"; g.strokeStyle = "#e8590c"; g.lineWidth = Math.max(1.5, cell * 0.07);
        g.beginPath(); g.arc(cx(c), cy(c), r, 0, 7); g.fill(); g.stroke();
      }
    }
    // the exit art again on top of the line, then the little character at the end of the line
    drawExitTop(g);
    const head = path[path.length - 1], r = Math.max(5, cell * 0.4);
    const jump = won ? Math.abs(Math.sin(Math.max(0, now - winAt) / 170)) * cell * 0.7 * Math.max(0, 1 - (now - winAt) / 2600) : 0;
    character(g, cx(head), cy(head), r, jump);
    for (const q of parts) { const a = 1 - q.life / q.max; g.globalAlpha = Math.max(0, a); g.fillStyle = q.color; g.beginPath(); g.arc(q.x + pd, q.y + pd, q.r, 0, 7); g.fill(); }
    g.globalAlpha = 1;
  }
  function drawExitTop(g: CanvasRenderingContext2D) { if (path[path.length - 1] !== m.exit) { g.save(); g.translate(0, 0); drawExit(g); g.restore(); } }

  function frame(ts: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(100, ts - (last || ts)); last = ts; now = ts;
    const sec = dt / 1000;
    for (const q of parts) { q.life += sec; q.x += q.vx * sec; q.y += q.vy * sec; q.vy += 260 * sec; }
    if (parts.length) { parts = parts.filter((q) => q.life < q.max); dirty = true; }
    if (phase === "won" && now - winAt < 2700) dirty = true;
    if (dirty) { dirty = false; draw(); }
  }
  const tickTimer = window.setInterval(() => { if (phase === "play" && t0) timeEl.textContent = `时间：${fmtTime(elapsed())}`; }, 250);

  // ---- input: one finger / the mouse on the line ----
  let pid = -1, lx = 0, ly = 0;
  const toCell = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left - pd) / cell, y: (e.clientY - r.top - pd) / cell }; };
  const onDown = (e: PointerEvent) => {
    if (phase !== "play" || pid !== -1 || (e.pointerType === "mouse" && e.button !== 0)) return;
    const p = toCell(e), tg = touchTarget(m, path, p.x, p.y);
    if (!tg) return;
    e.preventDefault();
    if (tg === "start" && path.length > 1) { setPath([m.start]); refreshHud(); ctx.sfx("tap"); }
    pid = e.pointerId; lx = p.x; ly = p.y;
    try { field.setPointerCapture(e.pointerId); } catch { /* no capture */ }
  };
  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== pid || phase !== "play") return;
    const evs = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e]) {
      const p = toCell(ev);
      apply(drawSegment(m, path, lx, ly, p.x, p.y));
      lx = p.x; ly = p.y;
      if (phase !== "play") break;
    }
  };
  const onUp = (e: PointerEvent) => { if (e.pointerId === pid) pid = -1; };
  const KEYS: Record<string, number> = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, W: 0, d: 1, D: 1, s: 2, S: 2, a: 3, A: 3 };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const d = KEYS[e.key];
    if (d !== undefined) { e.preventDefault(); if (phase === "play") apply(stepDir(m, path, d)); return; }
    if ((e.key === "Enter" || e.key === " ") && phase === "won") { e.preventDefault(); newMaze(); }
    else if (e.key === "n" || e.key === "N") newMaze();
    else if (e.key === "u" || e.key === "U" || e.key === "Backspace") { e.preventDefault(); undo(); }
  };
  document.addEventListener("keydown", onKey);
  field.addEventListener("pointerdown", onDown); field.addEventListener("pointermove", onMove); field.addEventListener("pointerup", onUp); field.addEventListener("pointercancel", onUp);
  const onResize = () => {
    if (path.length === 1 && !t0 && phase === "play" && !answer) {   // nothing drawn yet: the maze may follow a change of the screen (turning the device)
      const nominal = SIZES.find((s) => s.key === sizeKey)!.n, d = fitDim(nominal, avail() - 12);
      if (d !== m.w) { build(d, d, m.seed, m.algo); return; }
    }
    layout();
  };
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => onResize()) : null;
  ro?.observe(board);

  newMaze();
  raf = requestAnimationFrame(frame);
  (window as unknown as Record<string, unknown>).__maze = {
    maze: () => m, path: () => path.slice(), phase: () => phase, cell: () => cell, pad: () => pd, hints: () => hintShown.slice(), hintsUsed: () => hintsUsed,
    answer: () => (answer ? answer.slice() : null), cheated: () => cheated, theme: () => themeIdx, themes: THEMES.length, art: () => art, size: () => sizeKey,
    load: (w: number, hh: number, seed: number, algo?: Algo) => build(w, hh, seed, algo), cellAt: (x: number, y: number) => cellAt(m, x, y),
  };
  return () => {
    cancelAnimationFrame(raf); clearInterval(tickTimer); timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize);
    delete (window as unknown as Record<string, unknown>).__maze;
  };
}
