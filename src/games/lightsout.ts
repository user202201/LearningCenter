import type { GameCtx } from "./ctx";
import "./lightsout.css";
import { SIZES, makeRng, generate, press, isSolved, solve, hint, stars, rangeFor, type Level, type Board } from "./lightsout-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#dbe4ff"/><rect x="10" y="10" width="100" height="100" rx="26" fill="none" stroke="#748ffc" stroke-width="4"/><g><rect x="20" y="20" width="38" height="38" rx="11" fill="#fff3bf" stroke="#fcc419" stroke-width="3.5"/><circle cx="39" cy="38" r="12" fill="#ffd43b" stroke="#e67700" stroke-width="3"/><path d="M33 36 q3 -4 6 0 M40 36 q3 -4 6 0" fill="none" stroke="#3a2e39" stroke-width="2.4" stroke-linecap="round"/><path d="M34 42 q5 6 10 0" fill="none" stroke="#3a2e39" stroke-width="2.4" stroke-linecap="round"/><rect x="34" y="50" width="10" height="5" rx="2" fill="#adb5bd"/></g><g><rect x="62" y="62" width="38" height="38" rx="11" fill="#fff3bf" stroke="#fcc419" stroke-width="3.5"/><circle cx="81" cy="80" r="12" fill="#ffd43b" stroke="#e67700" stroke-width="3"/><path d="M75 78 q3 -4 6 0 M82 78 q3 -4 6 0" fill="none" stroke="#3a2e39" stroke-width="2.4" stroke-linecap="round"/><path d="M76 84 q5 6 10 0" fill="none" stroke="#3a2e39" stroke-width="2.4" stroke-linecap="round"/><rect x="76" y="92" width="10" height="5" rx="2" fill="#adb5bd"/></g><g><rect x="62" y="20" width="38" height="38" rx="11" fill="#4a587a" stroke="#364260" stroke-width="3.5"/><circle cx="81" cy="38" r="12" fill="#6c7b9c" stroke="#2f3b57" stroke-width="3"/><path d="M75 37 q3 3 6 0 M82 37 q3 3 6 0" fill="none" stroke="#1e2740" stroke-width="2.4" stroke-linecap="round"/><path d="M78 43 h6" fill="none" stroke="#1e2740" stroke-width="2.4" stroke-linecap="round"/><rect x="76" y="50" width="10" height="5" rx="2" fill="#adb5bd"/></g><g><rect x="20" y="62" width="38" height="38" rx="11" fill="#4a587a" stroke="#364260" stroke-width="3.5"/><circle cx="39" cy="80" r="12" fill="#6c7b9c" stroke="#2f3b57" stroke-width="3"/><path d="M33 79 q3 3 6 0 M40 79 q3 3 6 0" fill="none" stroke="#1e2740" stroke-width="2.4" stroke-linecap="round"/><path d="M36 85 h6" fill="none" stroke="#1e2740" stroke-width="2.4" stroke-linecap="round"/><rect x="34" y="92" width="10" height="5" rx="2" fill="#adb5bd"/></g><path d="M100 14 v10 M95 19 h10" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/></svg>`;

const LAMP = `<svg viewBox="0 0 100 100" aria-hidden="true"><path class="lo-body" d="M50 10 C71 10 82 26 82 42 C82 54 75 60 70 67 L70 72 L30 72 L30 67 C25 60 18 54 18 42 C18 26 29 10 50 10 Z"/><ellipse class="lo-shine" cx="34" cy="28" rx="7" ry="11" transform="rotate(25 34 28)"/><rect class="lo-base" x="31" y="72" width="38" height="18" rx="6"/><path class="lo-groove" d="M35 79 h30 M38 85 h24"/><g class="lo-on-face"><path class="lo-face" d="M33 42 q6 -9 12 0 M55 42 q6 -9 12 0"/><path class="lo-face" d="M40 51 q10 11 20 0"/><circle class="lo-cheek" cx="29" cy="52" r="5"/><circle class="lo-cheek" cx="71" cy="52" r="5"/></g><g class="lo-off-face"><path class="lo-face" d="M33 42 q6 6 12 0 M55 42 q6 6 12 0"/><path class="lo-face" d="M44 54 q6 3 12 0"/></g></svg>`;

type Phase = "play" | "won";
const LEVEL_NAMES = ["简单", "普通", "困难"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let n = SIZES.includes(ctx.store.get<number>("size", 5)) ? ctx.store.get<number>("size", 5) : 5;
  let level = Math.max(0, Math.min(2, ctx.store.get<number>("level", 1))) as Level;
  let challenge = ctx.store.get<boolean>("challenge", false);
  const bestKey = () => `best-${n}-${level}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);

  const pressEl = h("span", { class: "lo-stat", id: "lo-presses" }, "");
  const minEl = h("span", { class: "lo-stat", id: "lo-min" }, "");
  const timeEl = h("span", { class: "lo-stat", id: "lo-time" }, "");
  const bestEl = h("span", { class: "lo-stat best", id: "lo-best" }, "");
  const hud = h("div", { class: "lo-hud" }, pressEl, minEl, timeEl, bestEl);

  const sizeBtns = SIZES.map((k) => h("button", { class: "mopt", id: `lo-size-${k}`, "data-n": k, onclick: () => { ctx.sfx("tap"); setSize(k); } }, `${k}×${k}`));
  const lvBtns = LEVEL_NAMES.map((t, i) => h("button", { class: "mopt", id: `lo-lv-${i}`, "data-lv": i, onclick: () => { ctx.sfx("tap"); setLevel(i as Level); } }, t));
  const chBtn = h("button", { class: "mopt", id: "lo-challenge", onclick: () => { challenge = !challenge; ctx.store.set("challenge", challenge); ctx.sfx("tap"); refreshHud(); } }, "");
  const opt = h("div", { class: "lo-opt" }, ...sizeBtns, ...lvBtns, chBtn);

  const hintBtn = h("button", { class: "mopt", id: "lo-hint", onclick: () => showHint() }, "提示");
  const undoBtn = h("button", { class: "mopt", id: "lo-undo", onclick: () => undo() }, "撤销");
  const restartBtn = h("button", { class: "mopt", id: "lo-restart", onclick: () => restart() }, "重来");
  const newBtn = h("button", { class: "mopt", id: "lo-new", onclick: () => { ctx.sfx("tap"); newPuzzle(); } }, "新题");
  const demoBtn = h("button", { class: "mopt", id: "lo-demo", onclick: () => startDemo() }, "自动演示");
  const act = h("div", { class: "lo-act" }, hintBtn, undoBtn, restartBtn, newBtn, demoBtn);

  const grid = h("div", { class: "lo-grid", id: "lo-grid" });
  const starsEl = h("div", { class: "lo-stars", id: "lo-stars" });
  const title = h("h2", {}, "已完成。"), msg = h("p", { id: "lo-msg" }, "");
  const again = h("button", { class: "primary", id: "lo-again", onclick: () => { ctx.sfx("tap"); newPuzzle(); } }, "再来一局");
  const next = h("button", { class: "lo-next", id: "lo-next", onclick: () => { ctx.sfx("tap"); setSize(Math.min(SIZES[SIZES.length - 1], n + 1)); } }, "下一级");
  const ovl = h("div", { class: "lo-ovl", id: "lo-ovl" }, title, starsEl, msg, h("div", { class: "lo-ovl-btns" }, again, next));
  ovl.hidden = true;
  const field = h("div", { class: "lo-field", id: "lo-field" }, grid, ovl);
  const board = h("div", { class: "lo-board" }, field);
  const wrap = h("div", { class: "lo-wrap" }, hud, opt, board, act);
  root.append(wrap);

  let cells: HTMLElement[] = [];
  let startBoard: Board = [], cur: Board = [], minimum = 0;
  let history: number[] = [];
  let phase: Phase = "play";
  let t0 = 0, elapsed = 0, assisted = false, hintCell = -1, cursor = 0;
  let demoTimer = 0, demoStep = 0, swallow = false;
  let seedUsed = 0;
  const timers: number[] = [];
  const reduced = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  function refreshHud() {
    pressEl.textContent = `步数：${history.length}`;
    minEl.textContent = challenge ? `最少：?` : `最少：${minimum}`;
    timeEl.textContent = `时间：${fmt(Math.floor(elapsed))}`;
    const b = best();
    bestEl.textContent = b ? `最佳：${b}` : `最佳：—`;
    sizeBtns.forEach((e, i) => e.classList.toggle("on", SIZES[i] === n));
    lvBtns.forEach((e, i) => e.classList.toggle("on", i === level));
    chBtn.textContent = challenge ? "挑战：开" : "挑战：关"; chBtn.classList.toggle("on", challenge);
    undoBtn.disabled = phase !== "play" || history.length === 0;
    restartBtn.disabled = history.length === 0 && phase === "play";
    hintBtn.disabled = phase !== "play";
    demoBtn.textContent = demoTimer ? "停止演示" : "自动演示"; demoBtn.classList.toggle("on", !!demoTimer);
    demoBtn.disabled = phase !== "play";
  }
  function paint(prevBoard?: Board) {
    cells.forEach((c, i) => {
      const on = cur[i] === 1;
      c.classList.toggle("on", on);
      c.classList.toggle("hint", i === hintCell);
      c.classList.toggle("cur", i === cursor);
      c.setAttribute("aria-pressed", on ? "true" : "false");
      if (prevBoard && prevBoard[i] !== cur[i] && !reduced()) {
        c.classList.remove("pop"); void c.offsetWidth; c.classList.add("pop");
      }
    });
  }
  function build() {
    grid.textContent = ""; cells = [];
    grid.style.gridTemplateColumns = `repeat(${n}, minmax(0, 1fr))`; grid.style.gridTemplateRows = `repeat(${n}, minmax(0, 1fr))`;
    grid.style.setProperty("--lo-gap", n >= 6 ? "3px" : "5px"); grid.style.setProperty("--lo-pad", n >= 6 ? "4px" : "6px");
    for (let i = 0; i < n * n; i++) {
      const c = h("div", { class: "lo-cell", role: "button", "data-i": i, "aria-label": `${Math.floor(i / n) + 1},${(i % n) + 1}` });
      c.innerHTML = LAMP;
      c.style.setProperty("--x", String(i % n)); c.style.setProperty("--y", String(Math.floor(i / n)));
      c.addEventListener("animationend", (e) => { if (e.animationName === "lo-pop") c.classList.remove("pop"); });
      grid.append(c); cells.push(c);
    }
  }

  // ---- the game ----
  function stopTimers() { stopDemo(); }
  function load(cellsIn: Board, min: number) {
    startBoard = cellsIn.slice(); cur = cellsIn.slice(); minimum = min;
    history = []; phase = "play"; t0 = 0; elapsed = 0; assisted = false; hintCell = -1; cursor = Math.floor((n * n) / 2);
    ovl.hidden = true; field.classList.remove("win"); field.querySelectorAll(".lo-spark").forEach((e) => e.remove());
    paint(); refreshHud();
  }
  function newPuzzle(seed?: number) {
    stopTimers();
    seedUsed = seed ?? Math.floor(Math.random() * 4294967296);
    const lastKey = `last-${n}-${level}`;
    const p = generate(n, level, makeRng(seedUsed), ctx.store.get<string>(lastKey, ""));
    ctx.store.set(lastKey, p.cells.join(""));
    load(p.cells, p.min);
  }
  function setSize(k: number) { n = k; ctx.store.set("size", n); build(); layout(); newPuzzle(); }
  function setLevel(l: Level) { level = l; ctx.store.set("level", level); newPuzzle(); }
  function restart() {
    if (phase === "play" && history.length === 0) return;
    ctx.sfx("move"); stopTimers(); load(startBoard, minimum);
  }
  function doPress(i: number, fromDemo = false) {
    if (phase !== "play" || i < 0 || i >= n * n) return;
    if (!fromDemo && history.length && history[history.length - 1] === i) { undo(); return; }   // the same lamp again takes the press back
    const before = cur;
    hintCell = -1;
    if (!t0) t0 = performance.now();
    cur = press(n, cur, i); history.push(i);
    ctx.sfx("tap");
    paint(before); refreshHud();
    if (isSolved(cur)) win();
  }
  function undo() {
    if (phase !== "play" || !history.length) return;
    stopDemo();
    const i = history.pop() as number, before = cur;
    cur = press(n, cur, i); hintCell = -1;
    ctx.sfx("move"); paint(before); refreshHud();
  }
  function showHint() {
    if (phase !== "play") return;
    stopDemo();
    hintCell = hint(n, cur); ctx.sfx("good"); paint(); refreshHud();
    if (hintCell >= 0) cursor = hintCell;
  }
  function win() {
    phase = "won"; elapsed = t0 ? (performance.now() - t0) / 1000 : 0; hintCell = -1; stopDemo();
    const presses = history.length, s = stars(presses, minimum);
    const old = best(), newBest = !assisted && (!old || presses < old);
    if (newBest) ctx.store.set(bestKey(), presses);
    ctx.sfx("win"); refreshHud(); paint();
    field.classList.add("win");
    if (!reduced()) {
      const fw = field.clientWidth, fh = field.clientHeight;
      for (let k = 0; k < 14; k++) {
        const sp = h("span", { class: "lo-spark" });
        sp.style.left = `${Math.round(Math.random() * (fw - 16))}px`; sp.style.top = `${Math.round(Math.random() * (fh - 16))}px`; sp.style.animationDelay = `${Math.round(Math.random() * 500)}ms`;
        sp.style.color = ["#ffd43b", "#fff", "#96f2d7", "#ffa8a8"][k % 4];
        field.append(sp);
      }
    }
    starsEl.textContent = ""; starsEl.dataset.stars = String(s);
    for (let k = 1; k <= 3; k++) starsEl.append(h("span", { class: k <= s ? "" : "off" }, "★"));
    msg.textContent = assisted ? "已由自动演示完成，成绩不计入。" : newBest ? `新纪录：${presses} 步` : `共用 ${presses} 步，最少需要 ${minimum} 步。`;
    next.hidden = n >= SIZES[SIZES.length - 1];
    if (newBest) ctx.toast(`新纪录：${presses} 步`, 1800);
    timers.push(window.setTimeout(() => { if (phase === "won") { ovl.hidden = false; } }, reduced() ? 250 : 900));
  }

  // ---- demo ----
  function stopDemo() {
    if (!demoTimer) return;
    clearTimeout(demoTimer); demoTimer = 0; cells.forEach((c) => c.classList.remove("demo"));
    refreshHud();
  }
  function startDemo() {
    if (phase !== "play") return;
    if (demoTimer) { stopDemo(); return; }
    const sol = solve(n, cur);
    if (!sol || !sol.length) return;
    assisted = true; hintCell = -1; demoStep = 0; paint();
    ctx.sfx("tap");
    const run = () => {
      if (phase !== "play" || demoStep >= sol.length) { demoTimer = 0; refreshHud(); return; }
      const i = sol[demoStep++], c = cells[i];
      c.classList.add("demo");
      demoTimer = window.setTimeout(() => {
        c.classList.remove("demo"); doPress(i, true);
        if (phase !== "play") { demoTimer = 0; refreshHud(); return; }
        demoTimer = window.setTimeout(run, 320);
      }, 380);
    };
    demoTimer = 1; run(); refreshHud();
  }

  // ---- input ----
  grid.addEventListener("click", (e) => {
    if (swallow) { swallow = false; return; }
    const c = (e.target as HTMLElement).closest(".lo-cell") as HTMLElement | null;
    if (!c) return;
    field.classList.remove("kb");
    cursor = Number(c.dataset.i); doPress(cursor);
  });
  wrap.addEventListener("pointerdown", () => { if (demoTimer) { stopDemo(); swallow = true; } else swallow = false; }, true);
  wrap.addEventListener("click", (e) => {
    if (swallow && !(e.target as HTMLElement).closest(".lo-cell")) { swallow = false; e.stopPropagation(); e.preventDefault(); return; }
    (e.target as HTMLElement).closest("button")?.blur();
  }, true);
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = (e.target as HTMLElement | null)?.closest?.("button");
    const k = e.key;
    const move: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] };
    if (move[k]) {
      e.preventDefault(); if (phase !== "play") return;
      stopDemo(); field.classList.add("kb");
      const [dx, dy] = move[k], x = Math.max(0, Math.min(n - 1, (cursor % n) + dx)), y = Math.max(0, Math.min(n - 1, Math.floor(cursor / n) + dy));
      cursor = y * n + x; paint(); return;
    }
    if (k === " " || k === "Enter") {
      if (onButton) return;
      e.preventDefault();
      if (phase === "won") { if (!ovl.hidden && k === "Enter") newPuzzle(); return; }
      if (demoTimer) { stopDemo(); return; }
      field.classList.add("kb"); doPress(cursor); return;
    }
    if (onButton && k !== "h" && k !== "H") return;
    if (k === "h" || k === "H") { e.preventDefault(); showHint(); }
    else if (k === "u" || k === "U" || k === "z" || k === "Z" || k === "Backspace") { e.preventDefault(); undo(); }
    else if (k === "r" || k === "R") { e.preventDefault(); restart(); }
    else if (k === "n" || k === "N") { e.preventDefault(); newPuzzle(); }
  };
  document.addEventListener("keydown", onKey);

  // ---- layout ----
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    const size = Math.max(90, Math.floor(Math.min(w - 12, hh - 14)));
    field.style.width = `${size}px`; field.style.height = `${size}px`;
  }
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);
  const tick = window.setInterval(() => { if (phase === "play" && t0) { elapsed = (performance.now() - t0) / 1000; timeEl.textContent = `时间：${fmt(Math.floor(elapsed))}`; } }, 250);

  build(); layout(); newPuzzle();
  void rangeFor;
  (window as unknown as Record<string, unknown>).__lo = {
    state: () => ({ n, level, board: cur.slice(), start: startBoard.slice(), min: minimum, presses: history.length, history: history.slice(), phase, cursor, hint: hintCell, assisted, demo: !!demoTimer, seed: seedUsed, challenge, lit: cur.reduce((a, v) => a + v, 0) }),
    press: (i: number) => doPress(i),
    newGame: (seed?: number) => newPuzzle(seed),
    setBoard: (b: Board, min: number) => load(b, min),
    cell: () => (cells[0] ? cells[0].getBoundingClientRect().width : 0),
  };
  return () => {
    clearInterval(tick); timers.forEach(clearTimeout); stopDemo(); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__lo;
  };
}
