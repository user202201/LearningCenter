/** 泡泡龙 (bubble shooter): aim by dragging, let go to shoot, bounce off the walls, 3+ of a colour pop, what hangs in the air falls. Rules: bubble-logic.ts. */
import "./bubble.css";
import type { GameCtx } from "./ctx";
import * as L from "./bubble-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="26" fill="#d0ebff"/>
<g stroke="#fff" stroke-width="3"><circle cx="30" cy="34" r="15" fill="#ff6b6b"/><circle cx="60" cy="34" r="15" fill="#ffd43b"/><circle cx="90" cy="34" r="15" fill="#51cf66"/><circle cx="45" cy="60" r="15" fill="#4dabf7"/><circle cx="75" cy="60" r="15" fill="#ff6b6b"/></g>
<g fill="#fff"><circle cx="25" cy="31" r="3.4"/><circle cx="35" cy="31" r="3.4"/><circle cx="55" cy="31" r="3.4"/><circle cx="65" cy="31" r="3.4"/><circle cx="85" cy="31" r="3.4"/><circle cx="95" cy="31" r="3.4"/><circle cx="40" cy="57" r="3.4"/><circle cx="50" cy="57" r="3.4"/><circle cx="70" cy="57" r="3.4"/><circle cx="80" cy="57" r="3.4"/></g>
<g fill="#343a40"><circle cx="25" cy="32" r="1.7"/><circle cx="35" cy="32" r="1.7"/><circle cx="55" cy="32" r="1.7"/><circle cx="65" cy="32" r="1.7"/><circle cx="85" cy="32" r="1.7"/><circle cx="95" cy="32" r="1.7"/><circle cx="40" cy="58" r="1.7"/><circle cx="50" cy="58" r="1.7"/><circle cx="70" cy="58" r="1.7"/><circle cx="80" cy="58" r="1.7"/></g>
<g fill="none" stroke="#343a40" stroke-width="2.4" stroke-linecap="round"><path d="M25 38q5 5 10 0"/><path d="M55 38q5 5 10 0"/><path d="M85 38q5 5 10 0"/><path d="M40 64q5 5 10 0"/><path d="M70 64q5 5 10 0"/></g>
<path d="M60 104V82" stroke="#868e96" stroke-width="5" stroke-dasharray="2 8" stroke-linecap="round"/><circle cx="60" cy="100" r="13" fill="#b197fc" stroke="#fff" stroke-width="3"/><circle cx="55" cy="98" r="3" fill="#fff"/><circle cx="65" cy="98" r="3" fill="#fff"/><circle cx="55" cy="99" r="1.5" fill="#343a40"/><circle cx="65" cy="99" r="1.5" fill="#343a40"/><path d="M55 104q5 4 10 0" fill="none" stroke="#343a40" stroke-width="2.2" stroke-linecap="round"/></svg>`;

const COLORS = ["", "#ff6b6b", "#ffa94d", "#ffd43b", "#51cf66", "#4dabf7", "#b197fc"];
const DARK = ["", "#e03131", "#e8590c", "#f08c00", "#2f9e44", "#1c7ed6", "#7048e8"];
const FH = 12.2, SX = L.COLS / 2, SY = 11.2;
const MIN_A = (10 * Math.PI) / 180, MAX_A = Math.PI - MIN_A;
const SPEED = 30;

type Fx =
  | { k: "ring"; x: number; y: number; c: number; t0: number }
  | { k: "bit"; x: number; y: number; vx: number; vy: number; c: number; t0: number }
  | { k: "pop"; x: number; y: number; c: number; t0: number }
  | { k: "fall"; x: number; y: number; vx: number; vy: number; c: number; t0: number }
  | { k: "text"; x: number; y: number; s: string; t0: number };

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const h = ctx.h;
  const timers = new Set<number>();
  const later = (f: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); };
  let raf = 0, alive = true, tick = 0;

  // ---- progress
  const stars = (): number[] => { const s = ctx.store.get<number[]>("stars", []); return L.LEVELS.map((_, i) => (typeof s[i] === "number" ? s[i] : 0)); };
  const bests = (): number[] => { const s = ctx.store.get<number[]>("best", []); return L.LEVELS.map((_, i) => (typeof s[i] === "number" ? s[i] : 0)); };

  // ---- state
  let view: "levels" | "play" = "levels";
  let level = 0, grid: L.Grid = L.emptyGrid(), cur = 1, nxt = 1, misses = 0, score = 0, shots = 0, parShots = 1;
  let over: "" | "won" | "lost" = "";
  let paused = false, angle = Math.PI / 2, dragging = false, swapCand = false, moved = false, aimOn = false;
  let flight: { pts: { x: number; y: number }[]; i: number; x: number; y: number; c: number } | null = null;
  let rng = L.mulberry32(1), runId = 0;
  let yOfs = 0, gt = 0, last = 0;
  let fx: Fx[] = [];
  let D = 20, dpr = 1;

  // ---- DOM
  const wrap = h("div", { class: "bubble-wrap" });
  root.append(wrap);
  const canvas = h("canvas", { id: "bubble-canvas" });
  const cx = canvas.getContext("2d")!;

  const sprites = new Map<string, HTMLCanvasElement>();
  function sprite(col: number, d: number): HTMLCanvasElement {
    const key = col + ":" + d;
    let s = sprites.get(key);
    if (s) return s;
    s = document.createElement("canvas");
    const px = Math.max(2, Math.round(d * dpr));
    s.width = s.height = px;
    const g = s.getContext("2d")!, r = px / 2;
    const grad = g.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r);
    grad.addColorStop(0, "#ffffff"); grad.addColorStop(0.25, COLORS[col]); grad.addColorStop(1, DARK[col]);
    g.beginPath(); g.arc(r, r, r - px * 0.04, 0, 7); g.fillStyle = grad; g.fill();
    g.lineWidth = px * 0.05; g.strokeStyle = "rgba(255,255,255,.9)"; g.stroke();
    g.fillStyle = "rgba(255,255,255,.55)"; g.beginPath(); g.ellipse(r * 0.58, r * 0.45, r * 0.2, r * 0.11, -0.6, 0, 7); g.fill();
    for (const sx of [-1, 1]) {
      g.fillStyle = "#fff"; g.beginPath(); g.ellipse(r + sx * r * 0.3, r * 0.92, r * 0.17, r * 0.21, 0, 0, 7); g.fill();
      g.fillStyle = "#343a40"; g.beginPath(); g.arc(r + sx * r * 0.3 + r * 0.02, r * 0.95, r * 0.09, 0, 7); g.fill();
      g.fillStyle = "rgba(255,120,150,.55)"; g.beginPath(); g.ellipse(r + sx * r * 0.52, r * 1.2, r * 0.12, r * 0.08, 0, 0, 7); g.fill();
    }
    g.strokeStyle = "#343a40"; g.lineWidth = px * 0.045; g.lineCap = "round"; g.beginPath(); g.arc(r, r * 1.12, r * 0.25, 0.25, Math.PI - 0.25); g.stroke();
    sprites.set(key, s);
    return s;
  }
  const bub = (x: number, y: number, col: number, scale = 1, alpha = 1) => {
    const d = D * scale;
    cx.globalAlpha = alpha;
    cx.drawImage(sprite(col, Math.round(D)), (x - 0.5 * scale) * D, (y - 0.5 * scale) * D, d, d);
    cx.globalAlpha = 1;
  };

  // ---- screens
  function showLevels() {
    view = "levels"; flight = null; wrap.className = "bubble-wrap"; wrap.textContent = "";
    const st = stars(), bs = bests();
    const total = st.reduce((a, b) => a + b, 0);
    const grid_ = h("div", { class: "bubble-lvgrid" });
    L.LEVELS.forEach((_, i) => {
      const locked = i > 0 && st[i - 1] === 0;
      const b = h("button", { class: "bubble-lv", "data-level": String(i + 1), disabled: locked, title: bs[i] ? `最高：${bs[i]}` : "", onclick: () => { ctx.sfx("tap"); startLevel(i); } },
        locked ? "🔒" : String(i + 1), h("small", {}, locked ? "" : "★".repeat(st[i]) + "☆".repeat(3 - st[i])));
      grid_.append(b);
    });
    wrap.append(h("div", { class: "bubble-levels" }, h("h2", {}, "泡泡龙：选择关卡"), h("span", { class: "bubble-chip", id: "bubble-total" }, `星星：${total} / ${L.LEVELS.length * 3}`), grid_));
  }

  let hudScore!: HTMLElement, hudBest!: HTMLElement, hudDots!: HTMLElement, hudLevel!: HTMLElement, hudShots!: HTMLElement, field!: HTMLElement, area!: HTMLElement;
  function buildPlay() {
    wrap.className = "bubble-wrap playing"; wrap.textContent = "";
    hudLevel = h("span", { class: "bubble-chip", id: "bubble-level" });
    hudScore = h("span", { class: "bubble-chip", id: "bubble-score" });
    hudBest = h("span", { class: "bubble-chip", id: "bubble-best" });
    hudShots = h("span", { class: "bubble-chip bubble-lab", id: "bubble-shots" });
    hudDots = h("span", { class: "bubble-dots", id: "bubble-dots" });
    const dotsChip = h("span", { class: "bubble-chip", title: "天花板" }, h("span", { class: "bubble-lab" }, "天花板"), hudDots);
    const btn = (id: string, txt: string, f: () => void, alt = true) => h("button", { class: "bubble-btn" + (alt ? " alt" : ""), id, onclick: () => { ctx.sfx("tap"); f(); } }, txt);
    const hud = h("div", { class: "bubble-hud" }, hudLevel, hudScore, hudBest, hudShots, dotsChip);
    const btns = h("div", { class: "bubble-btns" }, btn("bubble-swap", "交换", swap), btn("bubble-pause", "暂停", () => setPaused(true)), btn("bubble-restart", "重来", () => startLevel(level)), btn("bubble-levels-btn", "选关", showLevels));
    field = h("div", { class: "bubble-field", id: "bubble-field" }, canvas);
    area = h("div", { class: "bubble-area" }, field);
    wrap.append(hud, btns, area);
    fit();
  }

  function fit() {
    if (view !== "play" || !area) return;
    const side = window.matchMedia("(orientation: landscape) and (max-height: 520px)").matches;
    const aw = side ? wrap.clientWidth - 2 * 176 : wrap.clientWidth;
    const top = area.getBoundingClientRect().top + (document.scrollingElement?.scrollTop ?? 0);
    const ah = Math.max(80, Math.floor((window.visualViewport?.height ?? window.innerHeight) - top - 12));
    if (!aw) return;
    area.style.height = ah + "px"; area.style.flex = "none"; area.style.width = side ? aw + "px" : "";
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const d = Math.max(8, Math.floor(Math.min((aw - 8) / L.COLS, (ah - 8) / FH)));
    if (d !== D || canvas.width !== Math.round(L.COLS * d * dpr)) { D = d; sprites.clear(); }
    canvas.width = Math.round(L.COLS * D * dpr); canvas.height = Math.round(FH * D * dpr);
    canvas.style.width = L.COLS * D + "px"; canvas.style.height = FH * D + "px";
  }

  function hudUpdate() {
    hudLevel.textContent = `第${level + 1}关`;
    hudScore.textContent = `得分：${score}`;
    hudBest.textContent = `最高：${Math.max(score, bests()[level])}`;
    hudShots.textContent = `发射：${shots}`;
    const lim = L.LEVELS[level].misses;
    hudDots.textContent = "";
    for (let i = 0; i < lim; i++) hudDots.append(h("i", { class: i < misses ? "on" : "" }));
    hudDots.title = `${misses} / ${lim}`;
  }

  function startLevel(i: number) {
    level = i; view = "play"; runId++;
    const seed = (Date.now() & 0xffff) + i * 7919;
    const spec = L.LEVELS[i];
    grid = L.buildLevel(spec, seed);
    rng = L.mulberry32(seed + 1);
    parShots = L.par(grid);
    misses = 0; score = 0; shots = 0; over = ""; paused = false; flight = null; fx = []; yOfs = 0; angle = Math.PI / 2; aimOn = false;
    cur = L.nextColor(rng, grid, 1); nxt = L.nextColor(rng, grid, 1);
    buildPlay(); hudUpdate();
  }

  function setPaused(p: boolean) {
    if (over || view !== "play") return;
    paused = p;
    field.querySelector(".bubble-ov")?.remove();
    if (p) {
      field.append(h("div", { class: "bubble-ov", id: "bubble-paused" }, h("h2", {}, "已暂停"),
        h("button", { class: "bubble-btn", id: "bubble-resume", onclick: () => { ctx.sfx("tap"); setPaused(false); } }, "继续"),
        h("button", { class: "bubble-btn alt", onclick: showLevels }, "选关")));
    }
  }

  function swap() {
    if (flight || over || paused || view !== "play") return;
    const t = cur; cur = nxt; nxt = t; ctx.sfx("swap");
  }

  function shoot() {
    if (flight || over || paused || view !== "play") return;
    const t = L.trace(grid, SX, SY, angle);
    flight = { pts: [{ x: SX, y: SY }, ...t.points.slice(1)], i: 1, x: SX, y: SY, c: cur };
    (flight as any).cell = t.cell;
    shots++; ctx.sfx("tap");
    hudUpdate();
  }

  function land() {
    const f = flight as any; flight = null;
    const cell: L.Cell | null = f.cell;
    if (!cell) { advance(); return; }
    const res = L.place(grid, cell, f.c);
    const before = grid;
    grid = res.grid;
    const popAt = (r: number, c: number, col: number, delay: number) => {
      const p = L.cellPos(before, r, c);
      later(() => {
        if (!alive) return;
        fx.push({ k: "pop", x: p.x, y: p.y, c: col, t0: gt }, { k: "ring", x: p.x, y: p.y, c: col, t0: gt });
        for (let i = 0; i < 6; i++) { const a = rng() * 6.283, v = 2 + rng() * 3; fx.push({ k: "bit", x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 1, c: col, t0: gt }); }
      }, delay);
    };
    if (res.popped.length) {
      misses = 0; score += res.score;
      const g2 = L.cloneGrid(before); g2[cell[0]][cell[1]] = f.c;
      res.popped.forEach(([r, c], i) => popAt(r, c, f.c, i * 35));
      res.fell.forEach(([r, c]) => { const p = L.cellPos(before, r, c); fx.push({ k: "fall", x: p.x, y: p.y, vx: (rng() - 0.5) * 3, vy: -2 - rng() * 2, c: before[r][c], t0: gt }); });
      const mid = L.cellPos(before, cell[0], cell[1]);
      fx.push({ k: "text", x: mid.x, y: mid.y, s: "+" + L.popScore(res.popped.length), t0: gt });
      if (res.fell.length) fx.push({ k: "text", x: mid.x, y: mid.y + 1.4, s: "+" + L.fallScore(res.fell.length), t0: gt });
      ctx.sfx("pop"); if (res.fell.length) later(() => alive && ctx.sfx("drop"), 150);
    } else {
      const p = L.cellPos(grid, cell[0], cell[1]);
      fx.push({ k: "ring", x: p.x, y: p.y, c: f.c, t0: gt });
      misses++; ctx.sfx("place");
      if (misses >= L.LEVELS[level].misses) {
        grid = L.dropCeiling(grid, rng, L.colorsPresent(grid).length ? L.colorsPresent(grid) : [1]);
        misses = 0; yOfs = -L.ROWH; ctx.sfx("bad"); ctx.toast("天花板落下来了！", 1800);
      }
    }
    advance();
  }

  function advance() {
    const q = L.advanceQueue(rng, grid, nxt, cur); cur = q.cur; nxt = q.nxt;
    hudUpdate();
    if (L.count(grid) === 0) return finish("won");
    if (L.lowestRow(grid) >= L.LOSE_ROW) return finish("lost");
  }

  function finish(kind: "won" | "lost") {
    over = kind;
    const n = kind === "won" ? L.starsFor(shots, parShots) : 0;
    if (kind === "won") {
      // a cleared board is a bonus
      score += 100;
      const st = stars(); st[level] = Math.max(st[level], n); ctx.store.set("stars", st);
    }
    const bs = bests(); if (score > bs[level]) { bs[level] = score; ctx.store.set("best", bs); }
    ctx.store.set("last", level);
    hudUpdate();
    ctx.sfx(kind === "won" ? "win" : "lose");
    const my = runId;
    later(() => {
      if (!alive || view !== "play" || my !== runId) return;
      const isLast = level === L.LEVELS.length - 1;
      const btns = kind === "won"
        ? [!isLast && h("button", { class: "bubble-btn", id: "bubble-next", onclick: () => { ctx.sfx("tap"); startLevel(level + 1); } }, "下一关"),
          h("button", { class: "bubble-btn alt", id: "bubble-again", onclick: () => startLevel(level) }, "再玩一次"), h("button", { class: "bubble-btn alt", onclick: showLevels }, "选关")]
        : [h("button", { class: "bubble-btn", id: "bubble-again", onclick: () => { ctx.sfx("tap"); startLevel(level); } }, "再来一次"), h("button", { class: "bubble-btn alt", onclick: showLevels }, "选关")];
      field.append(h("div", { class: "bubble-ov", id: "bubble-over", "data-result": kind },
        h("h2", {}, kind === "won" ? (isLast ? "全部通关！你是泡泡大师！" : "过关啦！") : "泡泡碰到底线了，再试一次吧！"),
        kind === "won" ? h("div", { class: "bubble-stars", id: "bubble-stars" }, ...[0, 1, 2].map((i) => h("span", { class: i < n ? "on" : "off" }, "★"))) : null,
        h("p", {}, `得分：${score}`), ...btns));
    }, kind === "won" ? 900 : 700);
  }

  // ---- input
  const pt = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width) * L.COLS, y: ((e.clientY - r.top) / r.height) * FH }; };
  const aimAt = (p: { x: number; y: number }): boolean => {
    const a = Math.atan2(SY - p.y, p.x - SX);
    if (p.y > SY - 0.5) return false;
    angle = Math.min(MAX_A, Math.max(MIN_A, a)); aimOn = true;
    return true;
  };
  canvas.addEventListener("pointerdown", (e) => {
    if (over || paused) return;
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* ok */ }
    dragging = true; moved = false;
    const p = pt(e);
    swapCand = Math.hypot(p.x - SX, p.y - SY) < 0.9 || Math.hypot(p.x - 2.1, p.y - (SY + 0.1)) < 0.8;
    if (!swapCand) aimAt(p);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (over || paused) return;
    const p = pt(e);
    if (dragging) {
      if (swapCand && Math.hypot(p.x - SX, p.y - SY) > 1.2) { swapCand = false; }
      if (!swapCand) { moved = true; aimAt(p); }
    } else if (e.pointerType === "mouse") aimAt(p);
  });
  const up = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    if (over || paused) return;
    if (swapCand) { swapCand = false; swap(); return; }
    const p = pt(e);
    if (aimAt(p)) shoot();
  };
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", () => { dragging = false; swapCand = false; });
  const onKey = (e: KeyboardEvent) => {
    if (view !== "play" || over) return;
    if (e.key === "ArrowLeft") { angle = Math.min(MAX_A, angle + 0.04); aimOn = true; e.preventDefault(); }
    else if (e.key === "ArrowRight") { angle = Math.max(MIN_A, angle - 0.04); aimOn = true; e.preventDefault(); }
    else if (e.key === " " || e.key === "Enter" || e.key === "ArrowUp") { e.preventDefault(); shoot(); }
    else if (e.key === "s" || e.key === "S") swap();
    else if (e.key === "p" || e.key === "P") setPaused(!paused);
  };
  document.addEventListener("keydown", onKey);
  const onResize = () => fit();
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  // ---- drawing
  function draw() {
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.clearRect(0, 0, canvas.width, canvas.height);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = L.COLS * D, H = FH * D;
    const bg = cx.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#e7f5ff"); bg.addColorStop(1, "#fff5f5");
    cx.fillStyle = bg; cx.fillRect(0, 0, W, H);
    // ceiling
    cx.fillStyle = "#74c0fc"; cx.fillRect(0, 0, W, Math.max(2, D * 0.08));
    // lose line
    const ly = (0.5 + (L.LOSE_ROW - 0.5) * L.ROWH) * D;
    cx.setLineDash([D * 0.3, D * 0.25]); cx.strokeStyle = "rgba(240,62,62,.55)"; cx.lineWidth = Math.max(2, D * 0.07);
    cx.beginPath(); cx.moveTo(0, ly); cx.lineTo(W, ly); cx.stroke(); cx.setLineDash([]);
    // grid
    for (let r = 0; r < grid.length; r++) for (let c = 0; c < grid[r].length; c++) {
      const v = grid[r][c]; if (!v) continue;
      const p = L.cellPos(grid, r, c);
      bub(p.x, p.y + yOfs, v);
    }
    // aim line
    if (!over && !paused && !flight && aimOn) {
      const t = L.trace(grid, SX, SY, angle);
      cx.fillStyle = "rgba(73,80,87,.55)";
      let acc = 0.8, prev = t.points[0];
      for (let i = 1; i < t.points.length; i++) {
        const a = prev, b = t.points[i], len = Math.hypot(b.x - a.x, b.y - a.y);
        while (acc < len) { const k = acc / len; cx.beginPath(); cx.arc((a.x + (b.x - a.x) * k) * D, (a.y + (b.y - a.y) * k) * D, D * 0.08, 0, 7); cx.fill(); acc += 0.45; }
        acc -= len; prev = b;
      }
      cx.globalAlpha = 0.35; bub(t.end.x, t.end.y, cur); cx.globalAlpha = 1;
    }
    // flight
    if (flight) bub(flight.x, flight.y, flight.c);
    // shooter
    cx.save(); cx.translate(SX * D, SY * D); cx.rotate(Math.PI / 2 - angle);
    cx.fillStyle = "#868e96"; cx.strokeStyle = "#495057"; cx.lineWidth = D * 0.07;
    cx.beginPath(); cx.roundRect(-D * 0.22, -D * 1.15, D * 0.44, D * 0.9, D * 0.12); cx.fill(); cx.stroke();
    cx.restore();
    cx.fillStyle = "#adb5bd"; cx.strokeStyle = "#495057"; cx.beginPath(); cx.arc(SX * D, (SY + 0.55) * D, D * 0.95, Math.PI, 0); cx.fill(); cx.stroke();
    if (!flight) bub(SX, SY, cur);
    bub(2.1, SY + 0.1, nxt, 0.72);
    cx.fillStyle = "#495057"; cx.font = `800 ${Math.round(D * 0.38)}px sans-serif`; cx.textAlign = "center";
    cx.fillText("NEXT", 2.1 * D, (SY + 0.95) * D);
    // effects
    for (const f of fx) {
      const age = gt - f.t0;
      if (f.k === "pop") { const s = 1 + age * 3; bub(f.x, f.y + yOfs, f.c, Math.min(1.5, s), Math.max(0, 1 - age * 4)); }
      else if (f.k === "ring") { cx.strokeStyle = COLORS[f.c]; cx.globalAlpha = Math.max(0, 1 - age * 3); cx.lineWidth = D * 0.12; cx.beginPath(); cx.arc(f.x * D, f.y * D, D * (0.5 + age * 2.4), 0, 7); cx.stroke(); cx.globalAlpha = 1; }
      else if (f.k === "bit") { const x = f.x + f.vx * age, y = f.y + f.vy * age + 6 * age * age; cx.fillStyle = COLORS[f.c]; cx.globalAlpha = Math.max(0, 1 - age * 1.8); cx.beginPath(); cx.arc(x * D, y * D, D * 0.1, 0, 7); cx.fill(); cx.globalAlpha = 1; }
      else if (f.k === "fall") { bub(f.x + f.vx * age, f.y + f.vy * age + 14 * age * age, f.c, 1, Math.max(0, 1 - age * 0.6)); }
      else if (f.k === "text") { cx.fillStyle = "#e8590c"; cx.strokeStyle = "#fff"; cx.lineWidth = D * 0.12; cx.font = `900 ${Math.round(D * 0.7)}px sans-serif`; cx.globalAlpha = Math.max(0, 1 - age * 0.9); const y = (f.y - age * 1.2) * D; cx.strokeText(f.s, f.x * D, y); cx.fillText(f.s, f.x * D, y); cx.globalAlpha = 1; }
    }
  }

  function frame(now: number) {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    if (view !== "play" || !area) return;
    if (++tick % 15 === 0 || canvas.style.width === "") fit();
    if (!paused) {
      gt += dt;
      if (yOfs < 0) yOfs = Math.min(0, yOfs + dt * 4);
      if (flight) {
        let move = SPEED * dt;
        while (flight && move > 0) {
          const t = flight.pts[flight.i], d = Math.hypot(t.x - flight.x, t.y - flight.y);
          if (d <= move) { flight.x = t.x; flight.y = t.y; move -= d; flight.i++; if (flight.i >= flight.pts.length) { land(); break; } }
          else { flight.x += ((t.x - flight.x) / d) * move; flight.y += ((t.y - flight.y) / d) * move; move = 0; }
        }
      }
      fx = fx.filter((f) => gt - f.t0 < (f.k === "fall" ? 1.6 : f.k === "text" ? 1.1 : f.k === "pop" ? 0.3 : 0.7));
    }
    draw();
  }
  raf = requestAnimationFrame((t) => { last = t; frame(t); });

  // test / debug hook: the live state, and a way to set up an exact situation
  (window as any).__bubble = {
    get s() { return { view, level, score, shots, misses, over, paused, angle, flying: !!flight, cur, nxt, grid, parShots, fx: fx.length }; },
    load(g: L.Grid, c: number, n: number, lvl = level) { runId++; view = "play"; level = lvl; grid = g.map((r) => r.slice()); cur = c; nxt = n; misses = 0; score = 0; shots = 0; over = ""; paused = false; flight = null; fx = []; parShots = L.par(grid); if (!canvas.isConnected) buildPlay(); hudUpdate(); },
    aim(deg: number) { angle = (deg * Math.PI) / 180; aimOn = true; },
    shoot, swap,
    setMisses(n: number) { misses = n; hudUpdate(); },
  };

  showLevels();
  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    timers.forEach((t) => clearTimeout(t)); timers.clear();
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    try { delete (window as any).__bubble; } catch { /* ok */ }
  };
}
