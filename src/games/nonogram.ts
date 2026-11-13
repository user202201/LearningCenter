import type { GameCtx } from "./ctx";
import "./nonogram.css";
import { SIZES, MAX_HINTS, generate, cluesOf, makeRng, lineRight, isSolved, wrongCells, nextState, hintCell, stars, fmtTime, strokeCells, type Size } from "./nonogram-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><rect x="38" y="38" width="64" height="64" rx="10" fill="#fff" stroke="#0ca678" stroke-width="5"/><g fill="#12b886" stroke="#0ca678" stroke-width="2"><rect x="41.5" y="41.5" width="12" height="12" rx="3.5"/><rect x="56.5" y="41.5" width="12" height="12" rx="3.5"/><rect x="56.5" y="56.5" width="12" height="12" rx="3.5"/><rect x="86.5" y="56.5" width="12" height="12" rx="3.5"/><rect x="41.5" y="71.5" width="12" height="12" rx="3.5"/><rect x="56.5" y="71.5" width="12" height="12" rx="3.5"/><rect x="71.5" y="71.5" width="12" height="12" rx="3.5"/><rect x="86.5" y="71.5" width="12" height="12" rx="3.5"/><rect x="56.5" y="86.5" width="12" height="12" rx="3.5"/><rect x="71.5" y="86.5" width="12" height="12" rx="3.5"/></g><g fill="#087f5b" font-family="sans-serif" font-weight="900" font-size="12" text-anchor="middle"><text x="25" y="53">1</text><text x="25" y="68">2</text><text x="25" y="83">4</text><text x="25" y="98">2</text><text x="48" y="32">1</text><text x="63" y="32">3</text><text x="78" y="32">2</text><text x="93" y="32">2</text></g><path d="M92 14 l2.6 5.2 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#ffd43b" stroke="#e8590c" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const STAR = "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z";
const starsSvg = (k: number) => `<svg viewBox="0 0 84 28" class="nng-stars" aria-hidden="true">${[0, 1, 2].map((i) => `<g transform="translate(${i * 28} 0) scale(1.1)"><path d="${STAR}" fill="${i < k ? "#ffd43b" : "#e9ecef"}" stroke="${i < k ? "#e8590c" : "#ced4da"}" stroke-width="1.6" stroke-linejoin="round"/></g>`).join("")}</svg>`;
/** cartoon colours (fill, darker edge) for the finished picture */
const PALETTE: [string, string][] = [["#ff6b6b", "#c92a2a"], ["#ffa94d", "#d9480f"], ["#ffd43b", "#e67700"], ["#69db7c", "#2b8a3e"], ["#38d9a9", "#087f5b"], ["#4dabf7", "#1864ab"], ["#9775fa", "#5f3dc4"], ["#f783ac", "#c2255c"]];

interface Saved { pic: string; cells: string; locked: string; secs: number; hints: number; checks: number }
type Phase = "play" | "won";
const SIZE_TEXT: Record<Size, string> = { 5: "5×5 简单", 10: "10×10 普通", 15: "15×15 困难" };

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let N = ctx.store.get<number>("size", 10) as Size; if (!SIZES.includes(N)) N = 10;
  let pic: number[] = [], rows: number[][] = [], cols: number[][] = [], cells: number[] = [], locked: number[] = [];
  let hist: number[][] = [];
  let mode: "fill" | "cross" = "fill", secs = 0, hints = 0, checks = 0, phase: Phase = "play", newRecord = false, cur = -1, shown = 0, cellPx = 24;
  let bad = new Set<number>();
  let palette: [string, string][] = PALETTE.slice(0, 4);
  const bestKey = () => `best-${N}`;
  const saveKey = () => `save-${N}`;
  const timers: number[] = [];
  const rng = makeRng((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0);

  const timeEl = h("span", { class: "nng-stat", id: "nng-time" }, "");
  const hintsEl = h("span", { class: "nng-stat", id: "nng-hints" }, "");
  const bestEl = h("span", { class: "nng-stat best", id: "nng-best" }, "");
  const sizeBtns = SIZES.map((n) => h("button", { class: "mopt", id: `nng-size-${n}`, onclick: () => { if (n !== N) { ctx.sfx("tap"); persist(); N = n; ctx.store.set("size", n); begin(false); } } }, SIZE_TEXT[n]));
  const newBtn = h("button", { class: "mopt", id: "nng-new", onclick: () => { ctx.sfx("tap"); ctx.store.set(saveKey(), null); begin(true); } }, "新题目");
  const hud = h("div", { class: "nng-hud" }, timeEl, hintsEl, bestEl, ...sizeBtns, newBtn);

  const corner = h("div", { class: "nng-corner" });
  const colBox = h("div", { class: "nng-cols", id: "nng-cols" });
  const rowBox = h("div", { class: "nng-rows", id: "nng-rows" });
  const grid = h("div", { class: "nng-grid", id: "nng-grid" });
  const title = h("h2", {}, ""), stars$ = h("div", { class: "nng-stars-wrap" }), msg = h("p", {}, "");
  const ovlBtn = h("button", { class: "primary", id: "nng-ovl-btn", onclick: () => { ctx.sfx("tap"); begin(true); } }, "新题目");
  const ovl = h("div", { class: "nng-ovl", id: "nng-ovl" }, title, stars$, msg, ovlBtn);
  ovl.hidden = true;
  const field = h("div", { class: "nng-field", id: "nng-field" }, corner, colBox, rowBox, grid, ovl);
  const board = h("div", { class: "nng-board" }, field);

  const fillBtn = h("button", { class: "nng-tool on", id: "nng-mode-fill", onclick: () => setMode("fill") }, "涂色");
  const crossBtn = h("button", { class: "nng-tool", id: "nng-mode-cross", onclick: () => setMode("cross") }, "打叉");
  const undoBtn = h("button", { class: "nng-tool", id: "nng-undo", onclick: () => undo() }, "撤销");
  const hintBtn = h("button", { class: "nng-tool", id: "nng-hint", onclick: () => hint() }, "提示");
  const checkBtn = h("button", { class: "nng-tool", id: "nng-check", onclick: () => check() }, "检查");
  const pad = h("div", { class: "nng-pad" }, fillBtn, crossBtn, undoBtn, hintBtn, checkBtn);
  root.append(h("div", { class: "nng-wrap" }, hud, board, pad));

  let cellEls: HTMLElement[] = [], rowEls: HTMLElement[] = [], colEls: HTMLElement[] = [];

  // ---------- building ----------
  const bin = (a: number[], keep = (v: number) => v) => a.map((v) => String(keep(v))).join("");
  function persist() {
    if (phase !== "play" || !pic.length) return;
    const s: Saved = { pic: bin(pic), cells: bin(cells), locked: bin(locked), secs, hints, checks };
    ctx.store.set(saveKey(), s);
  }
  function loadSaved(): boolean {
    const s = ctx.store.get<Saved | null>(saveKey(), null);
    if (!s || typeof s.pic !== "string" || s.pic.length !== N * N || s.cells?.length !== N * N || s.locked?.length !== N * N) return false;
    if (!/^[01]+$/.test(s.pic) || !/^[012]+$/.test(s.cells) || !/^[01]+$/.test(s.locked)) return false;
    pic = [...s.pic].map(Number); cells = [...s.cells].map(Number); locked = [...s.locked].map(Number);
    secs = Math.max(0, Math.floor(Number(s.secs) || 0)); hints = Math.max(0, Math.min(MAX_HINTS, Math.floor(Number(s.hints) || 0))); checks = Math.max(0, Math.floor(Number(s.checks) || 0));
    const p = cluesOf(pic, N); rows = p.rows; cols = p.cols;
    return true;
  }
  function begin(fresh: boolean) {
    timers.forEach((t) => clearTimeout(t)); timers.length = 0;
    phase = "play"; hist = []; bad = new Set(); cur = -1; newRecord = false; shown = 0; ovl.hidden = true; field.classList.remove("cover", "won");
    if (!(fresh === false && loadSaved())) {
      const before = pic.join("");
      let p = generate(N, Math.floor(rng() * 4294967296));
      for (let k = 0; k < 5 && p.n === N && p.pic.join("") === before; k++) p = generate(N, Math.floor(rng() * 4294967296));
      pic = p.pic; rows = p.rows; cols = p.cols; cells = new Array(N * N).fill(0); locked = new Array(N * N).fill(0);
      secs = 0; hints = 0; checks = 0;
      persist();
    }
    palette = pickPalette();
    build(); layout(); refreshAll(); refreshHud();
    if (isSolved(cells, pic)) win();
  }
  const pickPalette = () => { const a = PALETTE.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 4); };

  function build() {
    field.style.setProperty("--n", String(N));
    cellEls = []; rowEls = []; colEls = [];
    grid.replaceChildren(); colBox.replaceChildren(); rowBox.replaceChildren();
    for (let i = 0; i < N * N; i++) {
      const r = Math.floor(i / N), c = i % N;
      const el = h("div", { class: "nng-cell" + (c % 5 === 4 && c !== N - 1 ? " br" : "") + (r % 5 === 4 && r !== N - 1 ? " bb" : "") + (c === N - 1 ? " el" : "") + (r === N - 1 ? " eb" : ""), "data-i": i });
      cellEls.push(el); grid.append(el);
    }
    for (let c = 0; c < N; c++) {
      const el = h("div", { class: "nng-cc" + (c % 5 === 4 && c !== N - 1 ? " br" : ""), "data-c": c }, ...cols[c].map((v) => h("span", {}, String(v))));
      colEls.push(el); colBox.append(el);
    }
    for (let r = 0; r < N; r++) {
      const el = h("div", { class: "nng-rc" + (r % 5 === 4 && r !== N - 1 ? " bb" : ""), "data-r": r }, ...rows[r].map((v) => h("span", {}, String(v))));
      rowEls.push(el); rowBox.append(el);
    }
  }

  // ---------- drawing ----------
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    const kr = Math.max(1, ...rows.map((x) => x.length)), kc = Math.max(1, ...cols.map((x) => x.length));
    const cw = (N + 0.6 * kr), chh = (N + 0.56 * kc);
    let c = Math.floor(Math.min((w - 8 - 6 - 4) / cw, (hh - 8 - 6 - 6) / chh));
    c = Math.max(12, Math.min(N === 5 ? 56 : 44, c));
    cellPx = c;
    field.style.setProperty("--c", `${c}px`);
    field.style.setProperty("--cw", `${Math.ceil(kr * 0.6 * c) + 6}px`);
    field.style.setProperty("--ch", `${Math.ceil(kc * 0.56 * c) + 6}px`);
  }
  function cellClass(i: number) {
    const base: string[] = cellEls[i].className.split(" ").filter((k) => k === "nng-cell" || k === "br" || k === "bb" || k === "el" || k === "eb");
    if (cells[i] === 1) base.push("f"); else if (cells[i] === 2) base.push("x");
    if (locked[i]) base.push("lk"); if (bad.has(i)) base.push("bad"); if (i === cur) base.push("cur");
    return base.join(" ");
  }
  const refreshCell = (i: number) => { const k = cellClass(i); if (cellEls[i].className !== k) cellEls[i].className = k; };
  function refreshClues() {
    for (let r = 0; r < N; r++) rowEls[r].classList.toggle("done", lineRight(cells, N, "row", r, rows[r]));
    for (let c = 0; c < N; c++) colEls[c].classList.toggle("done", lineRight(cells, N, "col", c, cols[c]));
  }
  function refreshAll() { for (let i = 0; i < N * N; i++) refreshCell(i); refreshClues(); }
  function refreshHud() {
    timeEl.textContent = `用时：${fmtTime(secs)}`;
    hintsEl.textContent = `剩余提示：${MAX_HINTS - hints}`;
    const b = ctx.store.get<number>(bestKey(), 0);
    bestEl.textContent = b > 0 ? `最佳用时：${fmtTime(b)}` : "最佳用时：暂无";
    sizeBtns.forEach((btn, i) => btn.classList.toggle("on", SIZES[i] === N));
    fillBtn.classList.toggle("on", mode === "fill"); crossBtn.classList.toggle("on", mode === "cross");
    const play = phase === "play";
    undoBtn.disabled = !play || !hist.length;
    hintBtn.disabled = !play || hints >= MAX_HINTS;
    checkBtn.disabled = !play;
  }

  // ---------- changes ----------
  function setMode(m: "fill" | "cross") { if (mode === m) return; mode = m; ctx.sfx("tap"); refreshHud(); }
  function forceLocked() { for (let i = 0; i < cells.length; i++) if (locked[i]) cells[i] = pic[i] === 1 ? 1 : 2; }
  function clearBad() { if (bad.size) { const old = [...bad]; bad = new Set(); old.forEach(refreshCell); } }
  /** apply states to cells (index -> state); returns whether anything changed */
  function apply(list: number[], v: number): boolean {
    let any = false;
    for (const i of list) { if (locked[i] || cells[i] === v) continue; cells[i] = v; any = true; refreshCell(i); }
    return any;
  }
  function afterChange(sound: boolean, v: number) {
    clearBad(); refreshClues(); refreshHud(); persist();
    if (sound) ctx.sfx(v === 1 ? "place" : "tap");
    if (isSolved(cells, pic)) win();
  }
  function undo() {
    if (phase !== "play" || !hist.length) return;
    cells = hist.pop() as number[]; forceLocked(); clearBad(); refreshAll(); refreshHud(); persist(); ctx.sfx("tap");
  }
  function hint() {
    if (phase !== "play" || hints >= MAX_HINTS) return;
    const hc = hintCell(cells, pic, locked, rng);
    if (!hc) { ctx.toast("目前没有可提示的格子。", 1500); return; }
    hints++; locked[hc.i] = 1; cells[hc.i] = hc.v; clearBad(); refreshCell(hc.i); refreshClues(); refreshHud(); persist(); ctx.sfx("good");
    cellEls[hc.i].classList.add("pulse"); timers.push(window.setTimeout(() => cellEls[hc.i]?.classList.remove("pulse"), 700));
    if (isSolved(cells, pic)) win();
  }
  function check() {
    if (phase !== "play") return;
    checks++;
    const w = wrongCells(cells, pic);
    bad = new Set(w); w.forEach(refreshCell); persist();
    if (w.length) { ctx.sfx("bad"); ctx.toast(`有 ${w.length} 格错误。`, 1600); } else { ctx.sfx("good"); ctx.toast("目前没有错误。", 1600); }
  }

  // ---------- finishing ----------
  function win() {
    if (phase === "won") return;
    phase = "won"; shown = 0;
    const k = stars(hints, checks), old = ctx.store.get<number>(bestKey(), 0);
    newRecord = old === 0 || secs < old;
    if (newRecord) ctx.store.set(bestKey(), secs);
    ctx.store.set(saveKey(), null);
    bad = new Set(); cur = -1;
    for (let i = 0; i < N * N; i++) {
      const el = cellEls[i]; refreshCell(i);
      if (pic[i] === 1) { const [bg, bd] = palette[Math.floor(rng() * palette.length)]; el.style.setProperty("--bg", bg); el.style.setProperty("--bd", bd); el.style.animationDelay = `${Math.floor(rng() * 500)}ms`; }
    }
    field.classList.add("won"); refreshHud(); ctx.sfx("win");
    title.textContent = "你已完成。"; stars$.innerHTML = starsSvg(k); (stars$ as HTMLElement).dataset.stars = String(k);
    msg.textContent = newRecord ? `新纪录：${fmtTime(secs)}` : `用时 ${fmtTime(secs)}，提示 ${hints} 次，检查 ${checks} 次。`;
    timers.push(window.setTimeout(() => { if (phase === "won") { ovl.hidden = false; shown = 1; } }, 1100));
  }

  // ---------- pointer: tap and drag ----------
  interface Stroke { id: number; start: number; last: number; from: number; to: number; axis: "h" | "v" | null; before: number[]; changed: boolean }
  let stroke: Stroke | null = null;
  function cellAt(e: PointerEvent): number {
    const r = grid.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left) / (r.width / N)), rr = Math.floor((e.clientY - r.top) / (r.height / N));
    return c < 0 || rr < 0 || c >= N || rr >= N ? -1 : rr * N + c;
  }
  grid.addEventListener("pointerdown", (e) => {
    if (phase !== "play" || stroke || (e.pointerType === "mouse" && e.button !== 0)) return;
    const i = cellAt(e); if (i < 0) return;
    e.preventDefault();
    try { grid.setPointerCapture(e.pointerId); } catch { /* not supported */ }
    cur = -1;
    const from = cells[i], to = nextState(from, mode);
    stroke = { id: e.pointerId, start: i, last: i, from, to, axis: null, before: cells.slice(), changed: false };
    if (apply([i], to)) { stroke.changed = true; ctx.sfx(to === 1 ? "place" : "tap"); clearBad(); refreshClues(); }
    else if (locked[i]) ctx.sfx("bad");
  });
  grid.addEventListener("pointermove", (e) => {
    const s = stroke; if (!s || e.pointerId !== s.id || phase !== "play") return;
    let i = cellAt(e); if (i < 0 || i === s.last) return;
    const sr = Math.floor(s.start / N), sc = s.start % N, r = Math.floor(i / N), c = i % N;
    if (!s.axis) s.axis = Math.abs(c - sc) >= Math.abs(r - sr) ? "h" : "v";
    i = s.axis === "h" ? sr * N + c : r * N + sc;
    if (i === s.last) return;
    // only cells that still hold what the first cell held are changed (a stroke never overwrites other marks)
    const list = strokeCells(N, s.last, i, s.axis).filter((x) => cells[x] === s.from);
    s.last = i;
    if (apply(list, s.to)) { s.changed = true; clearBad(); refreshClues(); refreshHud(); persist(); if (isSolved(cells, pic)) win(); }
  });
  const endStroke = (e: PointerEvent) => {
    const s = stroke; if (!s || e.pointerId !== s.id) return;
    stroke = null;
    try { grid.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (s.changed) { hist.push(s.before); if (hist.length > 200) hist.shift(); afterChange(false, s.to); }
  };
  grid.addEventListener("pointerup", endStroke);
  grid.addEventListener("pointercancel", endStroke);
  grid.addEventListener("contextmenu", (e) => e.preventDefault());

  // ---------- keyboard ----------
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null; if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
    const k = e.key;
    if (k === "z" || k === "Z") { e.preventDefault(); undo(); return; }
    if (phase !== "play") return;
    const move = (dr: number, dc: number) => {
      e.preventDefault();
      const old = cur; if (cur < 0) cur = 0; else { const r = Math.max(0, Math.min(N - 1, Math.floor(cur / N) + dr)), c = Math.max(0, Math.min(N - 1, (cur % N) + dc)); cur = r * N + c; }
      if (old >= 0) refreshCell(old); refreshCell(cur);
    };
    if (k === "ArrowUp") return move(-1, 0);
    if (k === "ArrowDown") return move(1, 0);
    if (k === "ArrowLeft") return move(0, -1);
    if (k === "ArrowRight") return move(0, 1);
    const act = (v: number) => {
      e.preventDefault(); if (cur < 0) { cur = 0; refreshCell(0); }
      if (locked[cur] || cells[cur] === v) { if (locked[cur]) ctx.sfx("bad"); return; }
      hist.push(cells.slice()); if (hist.length > 200) hist.shift();
      cells[cur] = v; refreshCell(cur); afterChange(true, v);
    };
    if (k === " " || k === "Spacebar") { if (t && t.tagName === "BUTTON") return; act(nextState(cur < 0 ? 0 : cells[cur], "fill")); return; }
    if (k === "x" || k === "X") { act(nextState(cur < 0 ? 0 : cells[cur], "cross")); return; }
    if (k === "Backspace" || k === "Delete") { act(0); return; }
  };
  window.addEventListener("keydown", onKey);

  // ---------- timer, resize ----------
  const iv = window.setInterval(() => { if (phase === "play" && !document.hidden) { secs++; timeEl.textContent = `用时：${fmtTime(secs)}`; if (secs % 5 === 0) persist(); } }, 1000);
  const onResize = () => { layout(); };
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null; ro?.observe(board);

  begin(false);

  const api = {
    state: () => ({ n: N, pic: pic.slice(), rows, cols, cells: cells.slice(), locked: locked.slice(), hints, checks, secs, mode, phase, bad: [...bad], hist: hist.length }),
    cell: () => cellPx, finished: () => shown, setSecs: (v: number) => { secs = v; refreshHud(); },
  };
  (window as unknown as Record<string, unknown>).__nng = api;
  return () => {
    persist();
    clearInterval(iv); timers.forEach((t) => clearTimeout(t)); window.removeEventListener("keydown", onKey); window.removeEventListener("resize", onResize); ro?.disconnect();
    delete (window as unknown as Record<string, unknown>).__nng;
  };
}
