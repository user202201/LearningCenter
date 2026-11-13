import type { GameCtx } from "./ctx";
import "./linkup.css";
import * as L from "./linkup-logic";
import { PICTURES, spriteSvg } from "./linkup-art";

const tileFace = (x: number, y: number, fill: string) => `<rect x="${x}" y="${y}" width="34" height="34" rx="10" fill="#fff" stroke="#96f2d7" stroke-width="3"/><circle cx="${x + 17}" cy="${y + 17}" r="11" fill="${fill}"/><circle cx="${x + 13}" cy="${y + 15}" r="2" fill="#2d2230"/><circle cx="${x + 21}" cy="${y + 15}" r="2" fill="#2d2230"/><path d="M${x + 13} ${y + 21}q4 4 8 0" fill="none" stroke="#2d2230" stroke-width="1.800" stroke-linecap="round"/>`;
export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><path d="M33 46V24h54v22" fill="none" stroke="#f76707" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>${tileFace(16, 40, "#ffc98b")}${tileFace(70, 40, "#ffc98b")}<g fill="#fff" stroke="#96f2d7" stroke-width="3"><rect x="16" y="78" width="30" height="26" rx="9"/><rect x="74" y="78" width="30" height="26" rx="9"/></g><circle cx="31" cy="91" r="7" fill="#ffe066"/><circle cx="89" cy="91" r="7" fill="#74c0fc"/><path d="M96 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#ffd43b"/></svg>`;

type Phase = "ready" | "play" | "pause" | "won" | "lost";
const NS = "http://www.w3.org/2000/svg";

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let diffIdx = Math.max(0, Math.min(2, ctx.store.get<number>("diff", 1)));
  let timed = ctx.store.get<boolean>("timed", true);
  const bestKey = () => `best-${L.DIFFS[diffIdx].id}${timed ? "" : "-relaxed"}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);
  const DIFF_NAMES = ["简单", "普通", "困难"];

  root.insertAdjacentHTML("afterbegin", spriteSvg());
  const scoreEl = h("span", { class: "lk-stat", id: "lk-score" }, "");
  const bestEl = h("span", { class: "lk-stat best", id: "lk-best" }, "");
  const timeEl = h("span", { class: "lk-stat", id: "lk-time" }, "");
  const comboEl = h("span", { class: "lk-stat combo", id: "lk-combo" }, "");
  const barFill = h("i", {});
  const bar = h("div", { class: "lk-bar", id: "lk-bar" }, barFill);
  const btn = (id: string, fn: () => void) => h("button", { class: "mopt", id, onclick: (e: Event) => { fn(); (e.currentTarget as HTMLElement).blur(); } }, "");
  const hintBtn = btn("lk-hint", () => hint());
  const shuffleBtn = btn("lk-shuffle", () => manualShuffle());
  const pauseBtn = btn("lk-pause", () => togglePause());
  const diffBtn = btn("lk-diff", () => { diffIdx = (diffIdx + 1) % 3; ctx.store.set("diff", diffIdx); ctx.sfx("tap"); reset(); });
  const timedBtn = btn("lk-timed", () => { timed = !timed; ctx.store.set("timed", timed); ctx.sfx("tap"); reset(); });
  const hud = h("div", { class: "lk-hud" }, scoreEl, bestEl, timeEl, comboEl, bar, hintBtn, shuffleBtn, pauseBtn, diffBtn, timedBtn);

  const grid = h("div", { class: "lk-grid", id: "lk-grid" });
  const lines = document.createElementNS(NS, "svg");
  lines.setAttribute("class", "lk-lines");
  const title = h("h2", {}, ""), msg = h("p", {}, "");
  const startBtn = h("button", { class: "primary", id: "lk-start", onclick: () => { ctx.sfx("tap"); if (phase === "pause") togglePause(); else if (phase === "ready") begin(); else { reset(); begin(); } } }, "开始");
  const ovl = h("div", { class: "lk-ovl", id: "lk-ovl" }, title, msg, startBtn);
  const field = h("div", { class: "lk-field", id: "lk-field" }, grid, lines, ovl);
  const area = h("div", { class: "lk-board" }, field);
  root.append(h("div", { class: "lk-wrap" }, hud, area));

  let b!: L.Board, art: number[] = [], phase: Phase = "ready";
  let sel: L.Pt | null = null, cur: L.Pt = { r: 1, c: 1 };
  let score = 0, combo = 0, lastMatchT = -1e9, gameT = 0, remMs = 0, totMs = 0, hints = 0, shuffles = 0, size = 30, autoShuffles = 0, matches = 0;
  let hintMove: L.Move | null = null;
  let els: HTMLElement[][] = [];
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };
  let lastNow = performance.now();
  const loop = window.setInterval(() => { const n = performance.now(); const dt = Math.min(500, n - lastNow); lastNow = n; if (phase === "play") tick(dt); }, 100);

  // ---------- geometry ----------
  const xOf = (c: number) => (c === 0 ? size / 4 : c === b.cols + 1 ? size / 2 + b.cols * size + size / 4 : size / 2 + (c - 0.5) * size);
  const yOf = (r: number) => (r === 0 ? size / 4 : r === b.rows + 1 ? size / 2 + b.rows * size + size / 4 : size / 2 + (r - 0.5) * size);
  const fit = () => {
    if (!b) return;
    const W = area.clientWidth, H = area.clientHeight;
    if (W < 20 || H < 20) return;
    size = Math.max(14, Math.floor(Math.min((W - 8 - 2) / (b.cols + 1), (H - 8 - 8) / (b.rows + 1))));
    field.style.setProperty("--s", `${size}px`);
    field.style.setProperty("--r", String(b.rows)); field.style.setProperty("--c", String(b.cols));
    field.style.width = `${(b.cols + 1) * size}px`; field.style.height = `${(b.rows + 1) * size}px`;
    lines.setAttribute("width", String((b.cols + 1) * size)); lines.setAttribute("height", String((b.rows + 1) * size));
    lines.setAttribute("viewBox", `0 0 ${(b.cols + 1) * size} ${(b.rows + 1) * size}`);
    redrawHint();
  };
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => fit()) : null;
  ro?.observe(area);

  // ---------- drawing ----------
  const tileEl = (r: number, c: number) => els[r]?.[c];
  function paint() {
    for (let r = 1; r <= b.rows; r++) for (let c = 1; c <= b.cols; c++) {
      const e = els[r][c], k = b.g[r][c];
      const href = k ? `#lk-${art[k]}` : "";
      if (e.dataset.k !== String(k)) {
        e.dataset.k = String(k);
        if (k) { e.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><use href="${href}"/></svg>`; e.classList.remove("gone"); e.dataset.name = PICTURES[art[k]].name; }
        else { e.classList.add("gone"); e.removeAttribute("data-name"); later(() => { if (e.dataset.k === "0") e.innerHTML = ""; }, 300); }
      }
      e.classList.toggle("sel", !!sel && sel.r === r && sel.c === c);
      e.classList.toggle("cur", cur.r === r && cur.c === c && phase === "play");
      e.classList.toggle("hint", !!hintMove && ((hintMove.a.r === r && hintMove.a.c === c) || (hintMove.b.r === r && hintMove.b.c === c)));
    }
  }
  function buildTiles() {
    grid.textContent = "";
    els = Array.from({ length: b.rows + 2 }, () => []);
    for (let r = 1; r <= b.rows; r++) for (let c = 1; c <= b.cols; c++) {
      const e = h("div", { class: "lk-tile", "data-r": String(r), "data-c": String(c), role: "button" }) as HTMLElement;
      e.style.gridRow = String(r + 1); e.style.gridColumn = String(c + 1);
      els[r][c] = e; grid.append(e);
    }
    paint();
  }
  const center = (p: L.Pt) => ({ x: xOf(p.c), y: yOf(p.r) });
  function drawLine(path: L.Pt[], hintLine = false) {
    const pts = path.map(center);
    const poly = document.createElementNS(NS, "polyline");
    poly.setAttribute("points", pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" "));
    poly.setAttribute("class", "lk-line" + (hintLine ? " hintline" : ""));
    poly.setAttribute("stroke-width", String(Math.max(4, Math.round(size * 0.16))));
    let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (hintLine) poly.setAttribute("stroke-dasharray", `${Math.round(size * 0.3)} ${Math.round(size * 0.22)}`);
    else { poly.setAttribute("stroke-dasharray", String(len + 2)); poly.setAttribute("stroke-dashoffset", String(len + 2)); }
    lines.append(poly);
    if (!hintLine) {
      requestAnimationFrame(() => requestAnimationFrame(() => poly.setAttribute("stroke-dashoffset", "0")));
      later(() => poly.classList.add("fade"), 330);
      later(() => poly.remove(), 560);
    }
    return poly;
  }
  function sparkle(p: L.Pt) {
    const { x, y } = center(p);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.6, d = size * (0.5 + Math.random() * 0.5);
      const sp = h("i", { class: "lk-spark " + ["", "b", "c"][i % 3] }) as HTMLElement;
      sp.style.left = `${x}px`; sp.style.top = `${y}px`;
      sp.style.setProperty("--dx", `${Math.cos(a) * d}px`); sp.style.setProperty("--dy", `${Math.sin(a) * d}px`);
      field.append(sp); later(() => sp.remove(), 600);
    }
  }
  function clearHint() {
    hintMove = null;
    lines.querySelectorAll(".hintline").forEach((n) => n.remove());
  }
  function redrawHint() {
    lines.querySelectorAll(".hintline").forEach((n) => n.remove());
    if (hintMove) drawLine(hintMove.path, true);
  }

  // ---------- hud ----------
  const secLeft = () => Math.max(0, Math.ceil(remMs / 1000));
  function refreshHud() {
    scoreEl.textContent = `得分：${score}`;
    bestEl.textContent = `最高：${Math.max(best(), score)}`;
    timeEl.textContent = timed ? `时间：${secLeft()}` : "时间：不限";
    comboEl.textContent = `连击：${combo}`;
    comboEl.classList.toggle("hot", combo >= 2);
    bar.classList.toggle("off", !timed);
    const f = timed && totMs ? Math.max(0, Math.min(1, remMs / totMs)) : 1;
    barFill.style.width = `${(f * 100).toFixed(1)}%`;
    barFill.style.background = barColour(f);
    hintBtn.textContent = `提示：${hints}`; hintBtn.disabled = phase !== "play" || hints <= 0;
    shuffleBtn.textContent = `洗牌：${shuffles}`; shuffleBtn.disabled = phase !== "play" || shuffles <= 0;
    pauseBtn.textContent = phase === "pause" ? "继续" : "暂停"; pauseBtn.disabled = phase !== "play" && phase !== "pause";
    diffBtn.textContent = `难度：${DIFF_NAMES[diffIdx]}`;
    timedBtn.textContent = timed ? "计时：开" : "计时：关"; timedBtn.classList.toggle("on", timed);
  }
  const barColour = (f: number) => {
    // green (18,184,134) -> orange (255,146,43) -> red (250,82,82)
    const mix = (a: number[], c: number[], t: number) => a.map((v, i) => Math.round(v + (c[i] - v) * t));
    const col = f > 0.5 ? mix([255, 146, 43], [18, 184, 134], (f - 0.5) * 2) : mix([250, 82, 82], [255, 146, 43], f * 2);
    return `rgb(${col.join(",")})`;
  };
  const setOvl = (t: string, m: string, bt: string, show: boolean) => { title.textContent = t; msg.textContent = m; startBtn.textContent = bt; ovl.hidden = !show; if (show) startBtn.focus?.({ preventScroll: true } as FocusOptions); };

  // ---------- the game ----------
  function reset() {
    clearHint(); lines.textContent = "";
    const d = L.DIFFS[diffIdx];
    const W = area.clientWidth, H = area.clientHeight;
    const wide = W > 0 && H > 0 && W > H * 1.15;   // a landscape screen gets the board turned
    const rows = wide ? d.cols : d.rows, cols = wide ? d.rows : d.cols;
    b = L.makeBoard(rows, cols, d.kinds);
    const ids = Array.from({ length: PICTURES.length }, (_, i) => i);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    art = [-1, ...ids.slice(0, d.kinds)];
    sel = null; cur = { r: Math.ceil(rows / 2), c: Math.ceil(cols / 2) };
    score = 0; combo = 0; lastMatchT = -1e9; gameT = 0; matches = 0; autoShuffles = 0;
    totMs = L.totalMs(rows, cols); remMs = totMs; hints = L.MAX_HINTS; shuffles = L.MAX_SHUFFLES;
    phase = "ready";
    buildTiles(); fit(); refreshHud();
    setOvl("连连看", "用不超过两个拐弯的线连接相同的图案。", "开始", true);
  }
  function begin() { phase = "play"; lastNow = performance.now(); setOvl("", "", "", false); paint(); refreshHud(); }
  function togglePause() {
    if (phase === "play") { phase = "pause"; setOvl("已暂停", "点击继续。", "继续", true); }
    else if (phase === "pause") { phase = "play"; lastNow = performance.now(); setOvl("", "", "", false); }
    paint(); refreshHud();
  }
  function saveBest() { if (score > best()) ctx.store.set(bestKey(), score); }
  function finish(win: boolean) {
    phase = win ? "won" : "lost";
    if (win && timed) score += L.finishBonus(remMs);
    saveBest(); sel = null; clearHint(); paint(); refreshHud();
    ctx.sfx(win ? "win" : "lose");
    later(() => {
      if (phase !== (win ? "won" : "lost")) return;
      if (win) setOvl("全部消除。", `得分：${score}，最高：${Math.max(best(), score)}`, "再玩一次", true);
      else setOvl("时间到。", `得分：${score}，剩余图案：${L.remaining(b)}`, "重试", true);
    }, win ? 500 : 150);
  }
  function tick(dt: number) {
    if (phase !== "play") return;
    gameT += dt;
    if (combo > 0 && gameT - lastMatchT > L.COMBO_WINDOW_MS) combo = 0;
    if (timed) { remMs -= dt; if (remMs <= 0) { remMs = 0; refreshHud(); finish(false); return; } }
    refreshHud();
  }
  function match(a: L.Pt, c: L.Pt, path: L.Pt[]) {
    L.removePair(b, a, c);
    matches++;
    combo = L.nextCombo(combo, gameT - lastMatchT < 1e8 ? gameT - lastMatchT : null);
    lastMatchT = gameT;
    score += L.pairScore(combo);
    if (timed) remMs = Math.min(totMs, remMs + L.timeBonusSec(combo) * 1000);
    sel = null; clearHint();
    drawLine(path); sparkle(a); sparkle(c);
    for (const p of [a, c]) { const e = tileEl(p.r, p.c); e.classList.add("gone"); }
    ctx.sfx(combo >= 3 ? "good" : "pop");
    const st = L.status(b);
    paint(); refreshHud();
    if (st === "won") { finish(true); return; }
    if (st === "stuck") { autoShuffle(); }
  }
  function autoShuffle() {
    L.shuffle(b); autoShuffles++;
    clearHint(); sel = null; paint(); ctx.sfx("swap");
    ctx.toast("无可连接的图案，已自动洗牌。", 2000);
  }
  function manualShuffle() {
    if (phase !== "play" || shuffles <= 0) return;
    shuffles--; L.shuffle(b); sel = null; clearHint(); paint(); refreshHud(); ctx.sfx("swap");
    ctx.toast("已洗牌。", 1500);
  }
  function hint() {
    if (phase !== "play" || hints <= 0) return;
    const mv = L.pickMove(b); if (!mv) return;
    hints--; sel = null; hintMove = mv; paint(); redrawHint(); refreshHud(); ctx.sfx("move");
  }
  function pick(p: L.Pt) {
    if (phase !== "play" || !L.inField(b, p) || !L.kindAt(b, p)) return;
    cur = p;
    if (hintMove) { clearHint(); }
    if (!sel) { sel = p; ctx.sfx("tap"); paint(); return; }
    if (sel.r === p.r && sel.c === p.c) { sel = null; ctx.sfx("tap"); paint(); return; }
    const path = L.canLink(b, sel, p);
    if (path) { match(sel, p, path); return; }
    const same = L.kindAt(b, sel) === L.kindAt(b, p);
    ctx.sfx(same ? "bad" : "tap");
    sel = p; paint();
    if (same) { const e = tileEl(p.r, p.c); e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); later(() => e.classList.remove("shake"), 320); }
  }

  // ---------- input ----------
  const cellAt = (cx: number, cy: number): L.Pt | null => {
    const g = grid.getBoundingClientRect();
    const x = cx - g.left, y = cy - g.top, half = size / 2;
    if (x < half || y < half) return null;
    const c = Math.floor((x - half) / size) + 1, r = Math.floor((y - half) / size) + 1;
    return r >= 1 && r <= b.rows && c >= 1 && c <= b.cols ? { r, c } : null;
  };
  field.addEventListener("pointerdown", (e) => { if (phase !== "play" || (e.target as HTMLElement).closest(".lk-ovl")) return; const p = cellAt(e.clientX, e.clientY); if (p) { e.preventDefault(); pick(p); } });
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key, onBtn = (e.target as HTMLElement | null)?.tagName === "BUTTON";
    const arrows: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (k in arrows && phase === "play") {
      e.preventDefault();
      cur = { r: Math.max(1, Math.min(b.rows, cur.r + arrows[k][0])), c: Math.max(1, Math.min(b.cols, cur.c + arrows[k][1])) };
      ctx.sfx("move"); paint();
    } else if ((k === " " || k === "Enter") && !onBtn) {
      e.preventDefault();
      if (phase === "ready") { begin(); } else if (phase === "play") pick(cur); else if (phase === "pause") togglePause(); else if (phase === "won" || phase === "lost") { reset(); begin(); }
    } else if (k === "h" || k === "H") hint();
    else if (k === "s" || k === "S") manualShuffle();
    else if (k === "p" || k === "P") togglePause();
  };
  document.addEventListener("keydown", onKey);

  reset();
  (window as any).__linkup = {
    state: () => ({ phase, score, combo, remMs, totMs, hints, shuffles, rows: b.rows, cols: b.cols, left: L.remaining(b), sel, cur, diff: L.DIFFS[diffIdx].id, timed, autoShuffles, matches, hint: hintMove, kinds: new Set(b.g.flat().filter(Boolean)).size, art }),
    board: () => b, tick, refresh: () => { paint(); refreshHud(); }, size: () => size, pick,
  };
  return () => {
    clearInterval(loop); timers.forEach((t) => clearTimeout(t)); timers.clear();
    document.removeEventListener("keydown", onKey); ro?.disconnect();
    delete (window as any).__linkup;
  };
}
