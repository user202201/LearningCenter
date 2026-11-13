import type { GameCtx } from "./ctx";
import "./sudoku.css";
import { SPECS, SIZES, DIFFS, MAX_HINTS, generate, makeRng, conflicts, isSolved, digitCount, setDigit, eraseCell, toggleNote, noteList, hintCell, stars, fmtTime, peers, rowOf, colOf, boxOf, type Size, type Diff, type Spec } from "./sudoku-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><rect x="22" y="22" width="76" height="76" rx="12" fill="#fff" stroke="#0ca678" stroke-width="5"/><path d="M47.3 22V98M72.7 22V98M22 47.3H98M22 72.7H98" stroke="#96f2d7" stroke-width="3"/><path d="M47.3 22V98M72.7 22V98" stroke="#0ca678" stroke-width="0"/><g font-family="Arial,sans-serif" font-weight="900" font-size="22" text-anchor="middle"><text x="34.6" y="43" fill="#087f5b">1</text><text x="85.4" y="43" fill="#087f5b">3</text><text x="60" y="68" fill="#1971c2">2</text><text x="34.6" y="93" fill="#087f5b">3</text></g><circle cx="85.4" cy="85.4" r="10" fill="#ffd43b" stroke="#e8590c" stroke-width="3"/><circle cx="81.8" cy="83" r="1.9" fill="#222"/><circle cx="89" cy="83" r="1.9" fill="#222"/><path d="M80.6 88 Q85.4 93 90.2 88" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/></svg>`;

const STAR = "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z";
const starsSvg = (k: number) => `<svg viewBox="0 0 84 28" class="sdk-stars" aria-hidden="true">${[0, 1, 2].map((i) => `<g transform="translate(${i * 28} 0) scale(1.1)"><path d="${STAR}" fill="${i < k ? "#ffd43b" : "#e9ecef"}" stroke="${i < k ? "#e8590c" : "#ced4da"}" stroke-width="1.6" stroke-linejoin="round"/></g>`).join("")}</svg>`;

interface Saved { puzzle: number[]; solution: number[]; cells: number[]; notes: number[]; secs: number; hints: number; mistakes: number }
type Phase = "play" | "pause" | "won";
const DIFF_TEXT: Record<Diff, string> = { easy: "简单", normal: "普通", hard: "困难" };

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let N = ctx.store.get<number>("size", 9) as Size; if (!SIZES.includes(N)) N = 9;
  let diff = ctx.store.get<string>("diff", "normal") as Diff; if (!DIFFS.includes(diff)) diff = "normal";
  let spec: Spec = SPECS[N];
  let solution: number[] = [], given: number[] = [], cells: number[] = [], notes: number[] = [];
  let hist: { cells: number[]; notes: number[] }[] = [];
  let sel = -1, notesMode = false, secs = 0, hints = 0, mistakes = 0, phase: Phase = "play", newRecord = false;
  const bestKey = () => `best-${N}-${diff}`;
  const saveKey = () => `save-${N}-${diff}`;

  const timeEl = h("span", { class: "sdk-stat", id: "sdk-time" }, "");
  const hintsEl = h("span", { class: "sdk-stat", id: "sdk-hints" }, "");
  const missEl = h("span", { class: "sdk-stat", id: "sdk-miss" }, "");
  const bestEl = h("span", { class: "sdk-stat best", id: "sdk-best" }, "");
  const sizeBtns = SIZES.map((n) => h("button", { class: "mopt", id: `sdk-size-${n}`, onclick: () => { if (n !== N) { ctx.sfx("tap"); persist(); N = n; ctx.store.set("size", n); begin(); } } }, `${n}×${n}`));
  const diffBtns = DIFFS.map((d) => h("button", { class: "mopt", id: `sdk-diff-${d}`, onclick: () => { if (d !== diff) { ctx.sfx("tap"); persist(); diff = d; ctx.store.set("diff", d); begin(); } } }, DIFF_TEXT[d]));
  const pauseBtn = h("button", { class: "mopt", id: "sdk-pause", onclick: () => togglePause() }, "暂停");
  const newBtn = h("button", { class: "mopt", id: "sdk-new", onclick: () => { ctx.sfx("tap"); ctx.store.set(saveKey(), null); begin(true); } }, "新题目");
  const hud = h("div", { class: "sdk-hud" }, timeEl, hintsEl, missEl, bestEl, ...sizeBtns, ...diffBtns, pauseBtn, newBtn);

  const grid = h("div", { class: "sdk-grid", id: "sdk-grid" });
  const title = h("h2", {}, ""), stars$ = h("div", { class: "sdk-stars-wrap" }), msg = h("p", {}, "");
  const ovlBtn = h("button", { class: "primary", id: "sdk-ovl-btn", onclick: () => { ctx.sfx("tap"); if (phase === "pause") togglePause(); else begin(true); } }, "");
  const ovl = h("div", { class: "sdk-ovl", id: "sdk-ovl" }, title, stars$, msg, ovlBtn);
  ovl.hidden = true;
  const field = h("div", { class: "sdk-field", id: "sdk-field" }, grid, ovl);
  const board = h("div", { class: "sdk-board" }, field);

  const digits = h("div", { class: "sdk-digits", id: "sdk-digits" });
  const undoBtn = h("button", { class: "sdk-tool", id: "sdk-undo", onclick: () => undo() }, "撤销");
  const notesBtn = h("button", { class: "sdk-tool", id: "sdk-notes", onclick: () => toggleNotes() }, "笔记");
  const eraseBtn = h("button", { class: "sdk-tool", id: "sdk-erase", onclick: () => erase() }, "擦除");
  const hintBtn = h("button", { class: "sdk-tool", id: "sdk-hint", onclick: () => hint() }, "");
  const tools = h("div", { class: "sdk-tools" }, undoBtn, notesBtn, eraseBtn, hintBtn);
  const pad = h("div", { class: "sdk-pad" }, digits, tools);
  root.append(h("div", { class: "sdk-wrap" }, hud, board, pad));

  let cellEls: HTMLElement[] = [], digitEls: HTMLElement[] = [];
  const sigs: string[] = [];

  /** the classes that draw the box borders (thick between boxes, none at the outer edge) */
  function edge(i: number) {
    const r = rowOf(spec, i), c = colOf(spec, i), k = ["sdk-cell"];
    if (c === N - 1) k.push("el"); else if ((c + 1) % spec.bc === 0) k.push("br");
    if (r === N - 1) k.push("eb"); else if ((r + 1) % spec.br === 0) k.push("bb");
    return k.join(" ");
  }
  function buildBoard() {
    grid.textContent = ""; cellEls = []; sigs.length = 0;
    field.style.setProperty("--n", String(N));
    for (let i = 0; i < N * N; i++) {
      const el = h("div", { class: "sdk-cell", "data-i": String(i), role: "button", onclick: () => select(i) });
      el.className = edge(i);
      cellEls.push(el); grid.append(el);
    }
    digits.textContent = ""; digits.dataset.n = String(N);
    digitEls = [];
    for (let d = 1; d <= N; d++) { const b = h("button", { class: "sdk-digit", id: `sdk-d${d}`, onclick: () => press(d) }, String(d)); digitEls.push(b); digits.append(b); }
    padCols();
  }
  function padCols() {
    const w = pad.clientWidth || 300;
    digits.style.setProperty("--cols", String(N * 52 + (N - 1) * 6 <= w ? N : Math.ceil(N / 2)));
  }

  function paint() {
    const bad = conflicts(spec, cells);
    const pr = sel >= 0 ? new Set(peers(spec, sel)) : new Set<number>();
    const sv = sel >= 0 ? cells[sel] : 0;
    for (let i = 0; i < cells.length; i++) {
      const el = cellEls[i], v = cells[i];
      const cls = [edge(i)];
      if (given[i]) cls.push("given");
      if (pr.has(i)) cls.push("peer");
      if (sv && v === sv && i !== sel) cls.push("same");
      if (bad.has(i)) cls.push("bad");
      if (i === sel) cls.push("sel");
      const sig = cls.join(" ") + "|" + v + "|" + notes[i];
      if (sigs[i] === sig) continue;
      sigs[i] = sig; el.className = cls.join(" ");
      el.textContent = "";
      if (v) el.append(h("span", { class: "sdk-v" }, String(v)));
      else if (notes[i]) {
        const nt = h("span", { class: "sdk-nt" });
        const on = new Set(noteList(notes[i], N));
        for (let d = 1; d <= N; d++) nt.append(h("i", { class: on.has(d) ? "on" : "" }, on.has(d) ? String(d) : ""));
        el.append(nt);
      }
    }
    digitEls.forEach((b, k) => b.classList.toggle("done", digitCount(cells, solution, k + 1) === N));
    const left = MAX_HINTS - hints;
    const bestV = ctx.store.get<number>(bestKey(), 0);
    timeEl.textContent = `用时：${fmtTime(secs)}`;
    hintsEl.textContent = `剩余提示：${left}`;
    missEl.textContent = `错误：${mistakes}`;
    bestEl.textContent = bestV ? `最佳用时：${fmtTime(bestV)}` : "最佳用时：暂无";
    hintBtn.textContent = `提示 ${left}`; hintBtn.disabled = left <= 0 || phase !== "play";
    undoBtn.disabled = !hist.length || phase !== "play";
    eraseBtn.disabled = phase !== "play";
    notesBtn.classList.toggle("on", notesMode);
    sizeBtns.forEach((b, k) => b.classList.toggle("on", SIZES[k] === N));
    diffBtns.forEach((b, k) => b.classList.toggle("on", DIFFS[k] === diff));
    pauseBtn.textContent = phase === "pause" ? "继续" : "暂停"; pauseBtn.disabled = phase === "won";
    field.classList.toggle("cover", phase !== "play");
  }

  function persist() {
    if (phase === "won" || !solution.length) return;
    ctx.store.set(saveKey(), { puzzle: given, solution, cells, notes, secs, hints, mistakes } satisfies Saved);
  }
  function load(): boolean {
    const sv = ctx.store.get<Saved | null>(saveKey(), null), t = N * N;
    if (!sv || ![sv.puzzle, sv.solution, sv.cells, sv.notes].every((a) => Array.isArray(a) && a.length === t) || isSolved(sv.cells, sv.solution)) return false;
    given = sv.puzzle; solution = sv.solution; cells = sv.cells; notes = sv.notes; secs = sv.secs | 0; hints = sv.hints | 0; mistakes = sv.mistakes | 0;
    return true;
  }
  /** a new game of the chosen size / difficulty: the unfinished one of it when there is one, else a new puzzle */
  function begin(fresh = false, seed?: number) {
    spec = SPECS[N]; phase = "play"; newRecord = false; ovl.hidden = true; hist = []; notesMode = false;
    if (fresh || !load()) {
      const p = generate(N, diff, makeRng(seed ?? Math.floor(Math.random() * 4294967296)));
      given = p.puzzle; solution = p.solution; cells = p.puzzle.slice(); notes = new Array(N * N).fill(0); secs = 0; hints = 0; mistakes = 0;
      persist();
    }
    buildBoard();
    sel = cells.findIndex((v) => !v);
    layout(); paint();
  }

  function select(i: number) { if (phase !== "play") return; sel = i; ctx.sfx("tap"); paint(); }
  function snapshot() { hist.push({ cells, notes }); if (hist.length > 200) hist.shift(); }
  function press(d: number) {
    if (phase !== "play" || sel < 0 || given[sel]) { if (phase === "play") ctx.sfx("bad"); return; }
    snapshot();
    if (notesMode) {
      const r = toggleNote(spec, cells, notes, given, sel, d);
      if (!r.changed) { hist.pop(); ctx.sfx("bad"); return; }
      notes = r.notes; ctx.sfx("tap");
    } else {
      const r = setDigit(spec, cells, notes, solution, given, sel, d);
      if (!r.changed) { hist.pop(); return; }
      cells = r.cells; notes = r.notes;
      if (cells[sel]) { if (r.mistake) { mistakes++; ctx.sfx("bad"); } else ctx.sfx("place"); } else ctx.sfx("tap");
    }
    afterChange();
  }
  function erase() {
    if (phase !== "play" || sel < 0) return;
    const r = eraseCell(cells, notes, given, sel);
    if (!r.changed) { ctx.sfx("bad"); return; }
    snapshot(); cells = r.cells; notes = r.notes; ctx.sfx("tap"); afterChange();
  }
  function undo() {
    if (phase !== "play" || !hist.length) return;
    const s = hist.pop() as { cells: number[]; notes: number[] }; cells = s.cells; notes = s.notes; ctx.sfx("tap"); afterChange();
  }
  function toggleNotes() { if (phase !== "play") return; notesMode = !notesMode; ctx.sfx("tap"); paint(); }
  function hint() {
    if (phase !== "play" || hints >= MAX_HINTS) return;
    const i = hintCell(cells, solution, sel);
    if (i < 0) return;
    snapshot();
    const r = setDigit(spec, cells, notes, solution, given, i, solution[i]);
    cells = r.cells; notes = r.notes; hints++; sel = i; ctx.sfx("good"); afterChange();
  }
  function afterChange() {
    paint(); persist();
    if (isSolved(cells, solution)) win();
  }
  function win() {
    phase = "won";
    const prev = ctx.store.get<number>(bestKey(), 0), took = Math.max(1, secs);
    newRecord = !prev || took < prev;
    if (newRecord) ctx.store.set(bestKey(), took);
    ctx.store.set(saveKey(), null);
    ctx.sfx("win");
    const k = stars(hints, mistakes);
    title.textContent = "已完成。"; stars$.innerHTML = starsSvg(k); (stars$ as HTMLElement).dataset.stars = String(k);
    msg.textContent = newRecord ? `新纪录：${fmtTime(took)}` : `用时 ${fmtTime(secs)}，提示 ${hints} 次，错误 ${mistakes} 次。`;
    ovlBtn.textContent = "下一题"; stars$.hidden = false; ovl.hidden = false;
    paint();
  }
  function togglePause() {
    if (phase === "play") { phase = "pause"; title.textContent = "已暂停"; stars$.hidden = true; stars$.textContent = ""; msg.textContent = "点击继续。"; ovlBtn.textContent = "继续"; ovl.hidden = false; persist(); }
    else if (phase === "pause") { phase = "play"; ovl.hidden = true; }
    paint();
  }

  // ---- input ----
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (phase === "won") { if (k === "Enter") { e.preventDefault(); begin(true); } return; }
    if (phase === "pause") { if (k === "Enter" || k === " " || k === "p" || k === "P" || k === "Escape") { e.preventDefault(); togglePause(); } return; }
    const mv: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (mv[k]) {
      e.preventDefault();
      const cur = sel < 0 ? 0 : sel, r = Math.max(0, Math.min(N - 1, rowOf(spec, cur) + mv[k][0])), c = Math.max(0, Math.min(N - 1, colOf(spec, cur) + mv[k][1]));
      sel = r * N + c; paint(); return;
    }
    if (/^[1-9]$/.test(k)) { e.preventDefault(); if (+k <= N) press(+k); return; }
    if (k === "Backspace" || k === "Delete" || k === "0") { e.preventDefault(); erase(); return; }
    if (k === "n" || k === "N") { e.preventDefault(); toggleNotes(); return; }
    if (k === "z" || k === "Z") { e.preventDefault(); undo(); return; }
    if (k === "h" || k === "H") { e.preventDefault(); hint(); return; }
    if (k === "p" || k === "P" || k === "Escape") { e.preventDefault(); togglePause(); }
  };
  document.addEventListener("keydown", onKey);
  const onVis = () => { if (document.hidden && phase === "play") togglePause(); };
  document.addEventListener("visibilitychange", onVis);

  // ---- clock ----
  const timer = window.setInterval(() => { if (phase === "play") { secs++; timeEl.textContent = `用时：${fmtTime(secs)}`; if (secs % 5 === 0) persist(); } }, 1000);

  // ---- layout ----
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    const c = Math.max(20, Math.min(N === 9 ? 84 : 96, Math.floor(Math.min(w - 16, hh - 18) / N)));
    field.style.setProperty("--c", `${c}px`);
    padCols();
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);
  window.addEventListener("resize", layout);

  begin();
  const W = window as unknown as Record<string, unknown>;
  W.__sudoku = {
    state: () => ({ n: N, diff, given: given.slice(), solution: solution.slice(), cells: cells.slice(), notes: notes.slice(), hints, mistakes, secs, phase, sel, notesMode, newRecord }),
    tick: (k = 1) => { for (let i = 0; i < k; i++) if (phase === "play") secs++; paint(); },
    newGame: (n: Size, d: Diff, seed?: number) => { persist(); N = n; diff = d; begin(true, seed); },
    cell: () => parseFloat(field.style.getPropertyValue("--c")),
  };
  return () => {
    persist();
    clearInterval(timer); ro?.disconnect();
    document.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("resize", layout);
    delete W.__sudoku;
  };
}
