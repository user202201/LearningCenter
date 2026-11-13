import type { GameCtx } from "./ctx";
import "./reversi.css";
import * as R from "./reversi-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#c3fae8"/><rect x="18" y="18" width="84" height="84" rx="18" fill="#20c997" stroke="#0ca678" stroke-width="4"/><path d="M60 22V98M22 60H98" stroke="#0ca678" stroke-width="3"/><g transform="translate(40 40)"><circle r="17" fill="#343a40" stroke="#111" stroke-width="2.5"/><circle cx="-6" cy="-2" r="3.6" fill="#fff"/><circle cx="6" cy="-2" r="3.6" fill="#fff"/><circle cx="-5.4" cy="-1.6" r="1.7" fill="#111"/><circle cx="6.6" cy="-1.6" r="1.7" fill="#111"/><path d="M-6 6 Q0 12 6 6" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/></g><g transform="translate(80 80)"><circle r="17" fill="#fff" stroke="#adb5bd" stroke-width="2.5"/><circle cx="-6" cy="-2" r="3" fill="#222"/><circle cx="6" cy="-2" r="3" fill="#222"/><circle cx="-11" cy="5" r="3.4" fill="#ff8787" opacity=".6"/><circle cx="11" cy="5" r="3.4" fill="#ff8787" opacity=".6"/><path d="M-6 6 Q0 12 6 6" fill="none" stroke="#c2255c" stroke-width="2.6" stroke-linecap="round"/></g><g transform="translate(80 40)"><circle r="17" fill="#fff" stroke="#adb5bd" stroke-width="2.5"/><circle cx="-6" cy="-2" r="3" fill="#222"/><circle cx="6" cy="-2" r="3" fill="#222"/><path d="M-6 6 Q0 12 6 6" fill="none" stroke="#c2255c" stroke-width="2.6" stroke-linecap="round"/></g><circle cx="40" cy="80" r="6" fill="#fff" opacity=".55"/></svg>`;

const FACE_B = `<svg viewBox="-20 -20 40 40" class="rv-face"><circle cx="-6" cy="-1" r="3.6" fill="#fff"/><circle cx="6" cy="-1" r="3.6" fill="#fff"/><circle cx="-5.4" cy="-.6" r="1.7" fill="#111"/><circle cx="6.6" cy="-.6" r="1.7" fill="#111"/><circle cx="-11" cy="6" r="3" fill="#ff8787" opacity=".5"/><circle cx="11" cy="6" r="3" fill="#ff8787" opacity=".5"/><path d="M-5 6 Q0 11.5 5 6" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const FACE_W = `<svg viewBox="-20 -20 40 40" class="rv-face"><circle cx="-6" cy="-1" r="3" fill="#222"/><circle cx="6" cy="-1" r="3" fill="#222"/><circle cx="-6.8" cy="-2" r="1" fill="#fff"/><circle cx="5.2" cy="-2" r="1" fill="#fff"/><circle cx="-11" cy="6" r="3.2" fill="#ff8787" opacity=".6"/><circle cx="11" cy="6" r="3.2" fill="#ff8787" opacity=".6"/><path d="M-5 6 Q0 11.5 5 6" fill="none" stroke="#c2255c" stroke-width="2.4" stroke-linecap="round"/></svg>`;
const LEVELS: R.Level[] = ["easy", "normal", "hard"];
const LEVEL_TEXT: Record<R.Level, string> = { easy: "难度：简单", normal: "难度：普通", hard: "难度：困难" };
const SIZES = [8, 6];

interface Snap { b: Board; turn: number; last: number }
type Board = R.Board;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  let disposed = false;
  let n = SIZES.includes(ctx.store.get<number>("size", 8)) ? ctx.store.get<number>("size", 8) : 8;
  let level = LEVELS.includes(ctx.store.get<R.Level>("level", "normal")) ? ctx.store.get<R.Level>("level", "normal") : "normal";
  let human = ctx.store.get<number>("human", 1) === 2 ? 2 : 1;
  let hints = ctx.store.get<boolean>("hints", true);
  const bestKey = () => `best-${n}-${level}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);

  let b: Board = R.newBoard(n), turn = R.BLACK, last = -1, over = false, thinking = false, pending = 0, cur = -1, kbd = false;
  let hist: Snap[] = [];
  let cells: HTMLElement[] = [], discs: (HTMLElement | null)[] = [];

  /* ---------- the screen ---------- */
  const pill = (cls: string, id: string) => h("span", { class: "rv-stat " + cls, id });
  const youEl = pill("rv-you", "rv-you"), cpuEl = pill("rv-cpu", "rv-cpu"), turnEl = pill("rv-turn", "rv-turn"), bestEl = pill("best", "rv-best");
  const hud = h("div", { class: "rv-hud" }, youEl, cpuEl, turnEl, bestEl);
  const sizeBtn = h("button", { class: "mopt", id: "rv-size", onclick: () => { n = n === 8 ? 6 : 8; ctx.store.set("size", n); ctx.sfx("tap"); reset(); } }, "");
  const levelBtn = h("button", { class: "mopt", id: "rv-level", onclick: () => { level = LEVELS[(LEVELS.indexOf(level) + 1) % 3]; ctx.store.set("level", level); ctx.sfx("tap"); reset(); } }, "");
  const sideBtn = h("button", { class: "mopt", id: "rv-side", onclick: () => { human = human === 1 ? 2 : 1; ctx.store.set("human", human); ctx.sfx("tap"); reset(); } }, "");
  const hintBtn = h("button", { class: "mopt", id: "rv-hints", onclick: () => { hints = !hints; ctx.store.set("hints", hints); ctx.sfx("tap"); render(); } }, "");
  const undoBtn = h("button", { class: "mopt", id: "rv-undo", onclick: () => undo() }, "撤销");
  const newBtn = h("button", { class: "mopt", id: "rv-new", onclick: () => { ctx.sfx("tap"); reset(); } }, "新游戏");
  const opts = h("div", { class: "rv-opts" }, sizeBtn, levelBtn, sideBtn, hintBtn, undoBtn, newBtn);
  const grid = h("div", { class: "rv-grid", id: "rv-board", role: "grid" });
  const note = h("div", { class: "rv-note", id: "rv-note", hidden: true });
  const title = h("h2", {}, ""), msg = h("p", {}, ""), again = h("button", { class: "primary", id: "rv-again", onclick: () => { ctx.sfx("tap"); reset(); } }, "再来一局");
  const ovl = h("div", { class: "rv-ovl", id: "rv-ovl", hidden: true }, title, msg, again);
  const field = h("div", { class: "rv-field", id: "rv-field" }, grid, note, ovl);
  const board = h("div", { class: "rv-board" }, field);
  const wrap = h("div", { class: "rv-wrap" }, hud, board, opts);
  root.append(wrap);

  function build() {
    grid.replaceChildren(); cells = []; discs = [];
    grid.style.setProperty("--n", String(n));
    for (let i = 0; i < n * n; i++) {
      const cell = h("div", { class: "rv-cell", "data-i": String(i), role: "gridcell", onclick: () => tap(i) });
      cells.push(cell); discs.push(null); grid.append(cell);
    }
  }
  function discEl(c: number): HTMLElement {
    const d = h("div", { class: "rv-disc", "data-c": String(c) });
    d.innerHTML = c === R.BLACK ? FACE_B : FACE_W;
    return d;
  }
  const mine = () => !over && !thinking && turn === human;
  function render(flipped: number[] = [], placed = -1) {
    const legal = mine() && hints ? new Set(R.legalMoves(b, n, human)) : new Set<number>();
    for (let i = 0; i < n * n; i++) {
      const cell = cells[i], v = b[i];
      let d = discs[i];
      if (v === 0) { if (d) { d.remove(); discs[i] = null; } }
      else {
        if (!d) { d = discEl(v); discs[i] = d; cell.append(d); if (i === placed) d.classList.add("drop"); }
        else if (d.dataset.c !== String(v)) { d.dataset.c = String(v); d.innerHTML = v === R.BLACK ? FACE_B : FACE_W; }
        if (flipped.includes(i)) { d.classList.remove("flip"); void d.offsetWidth; d.classList.add("flip"); }
      }
      cell.classList.toggle("legal", legal.has(i));
      cell.classList.toggle("last", i === last);
      cell.classList.toggle("cur", kbd && i === cur);
      cell.dataset.c = String(v);
    }
    const k = R.counts(b), mineN = human === 1 ? k.black : k.white, cpuN = human === 1 ? k.white : k.black;
    const set = (el: HTMLElement, c: number, text: string) => { el.replaceChildren(h("span", { class: "rv-dot", "data-c": String(c) }), h("span", {}, text)); };
    set(youEl, human, `你：${mineN}`); set(cpuEl, R.other(human), `电脑：${cpuN}`);
    youEl.classList.toggle("on", !over && turn === human); cpuEl.classList.toggle("on", !over && turn !== human);
    turnEl.textContent = over ? "对局结束。" : thinking || turn !== human ? "电脑思考中…" : "轮到你。";
    turnEl.dataset.turn = String(over ? 0 : turn);
    bestEl.textContent = `最高：${best()}`;
    sizeBtn.textContent = n === 8 ? "棋盘：8×8" : "棋盘：6×6"; sizeBtn.classList.toggle("on", n === 6);
    levelBtn.textContent = LEVEL_TEXT[level];
    sideBtn.textContent = human === 1 ? "执黑先手" : "执白后手"; sideBtn.classList.toggle("on", human === 2);
    hintBtn.textContent = hints ? "提示：开" : "提示：关"; hintBtn.classList.toggle("on", hints);
    (undoBtn as HTMLButtonElement).disabled = thinking || !hist.length;
  }
  function showNote(t: string) { note.textContent = t; note.hidden = !t; }

  /* ---------- the game ---------- */
  function reset() {
    pending++; timers.forEach((t) => clearTimeout(t)); timers.clear();
    b = R.newBoard(n); turn = R.BLACK; last = -1; over = false; thinking = false; hist = []; cur = Math.floor(n / 2) * n + Math.floor(n / 2) - 1;
    ovl.hidden = true; showNote("");
    build(); layout(); render();
    afterMove(R.WHITE, false);   // black moves first: if the computer is black it plays now
  }
  /** after `mover` moved (or at the start): decide who is next, announce a pass, end the game, or let the computer play */
  function afterMove(mover: number, announce: boolean) {
    if (disposed) return;
    const nxt = announce ? R.nextToMove(b, n, mover) : turn;
    if (announce) {
      if (nxt === 0) { turn = R.other(mover); return finish(); }
      if (nxt === mover) {   // the other side has no move
        turn = nxt; showNote("无子可下，本方跳过。"); ctx.toast("无子可下，本方跳过。", 1800); ctx.sfx("bad");
        thinking = false; render();
        const my = pending; later(() => { if (my === pending) { showNote(""); afterMove(mover, false); } }, 1300);
        // the side that cannot move is the other one: the same `mover` plays again
        return;
      }
      turn = nxt;
    }
    if (turn !== human) { thinking = true; render(); const my = ++pending; later(() => { if (my === pending) cpuMove(); }, 420); }
    else { thinking = false; showNote(""); render(); }
  }
  function cpuMove() {
    if (over || disposed) return;
    const c = turn;
    const m = R.chooseMove(b, n, c, level);
    thinking = false;
    if (m < 0) return;
    place(m, c);
  }
  function place(i: number, c: number) {
    const f = R.applyMove(b, n, i, c);
    if (!f.length) return;
    last = i; kbd = kbd && c === human;
    const corner = R.corners(n).includes(i);
    ctx.sfx(corner ? "good" : f.length >= 3 ? "capture" : "place");
    render(f, i);
    afterMove(c, true);
  }
  function tap(i: number) {
    if (!mine() || !R.isLegal(b, n, i, human)) { if (mine() && !over) ctx.sfx("bad"); return; }
    hist.push({ b: Int8Array.from(b), turn, last });
    place(i, human);
  }
  function undo() {
    if (thinking || !hist.length) return;
    pending++; timers.forEach((t) => clearTimeout(t)); timers.clear();
    const s = hist.pop()!;
    b = Int8Array.from(s.b); turn = s.turn; last = s.last; over = false; thinking = false;
    ovl.hidden = true; showNote(""); ctx.sfx("tap"); render();
  }
  function finish() {
    over = true; thinking = false;
    const k = R.counts(b), w = R.winner(b), mineN = human === 1 ? k.black : k.white, cpuN = human === 1 ? k.white : k.black;
    const won = w === human, draw = w === 0;
    title.textContent = draw ? "平局。" : won ? "你赢了。" : "电脑获胜。";
    msg.textContent = `最终比分：你 ${mineN}，电脑 ${cpuN}。`;
    ovl.dataset.result = draw ? "draw" : won ? "win" : "lose";
    if (won && mineN - cpuN > best()) ctx.store.set(bestKey(), mineN - cpuN);
    ctx.sfx(draw ? "good" : won ? "win" : "lose");
    render();
    later(() => { if (over) ovl.hidden = false; }, 600);
  }

  /* ---------- keyboard ---------- */
  const onKey = (e: KeyboardEvent) => {
    if (disposed) return;
    const t = e.target as HTMLElement | null; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    const k = e.key;
    const mv: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (mv[k]) { e.preventDefault(); kbd = true; const x = Math.max(0, Math.min(n - 1, (cur % n) + mv[k][0])), y = Math.max(0, Math.min(n - 1, Math.floor(cur / n) + mv[k][1])); cur = y * n + x; render(); }
    else if (k === " " || k === "Enter") { if (t && t.tagName === "BUTTON") return; e.preventDefault(); kbd = true; if (over) reset(); else tap(cur); }
    else if (k === "z" || k === "Z") { e.preventDefault(); undo(); }
  };
  window.addEventListener("keydown", onKey);

  /* ---------- size ---------- */
  function layout() {
    const W = board.clientWidth, Hh = board.clientHeight;
    const s = Math.max(120, Math.floor(Math.min(W, Hh)) - 12);
    field.style.width = `${s}px`; field.style.height = `${s}px`;
  }
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);
  window.addEventListener("resize", layout);

  (window as unknown as { __reversi: unknown }).__reversi = {
    state: () => ({ board: Array.from(b), n, turn, human, over, thinking, level, last, hist: hist.length }),
    /** tests: put a position on the board (string of 0 / 1 / 2, row by row) with `t` to move */
    setup: (cells: string, t: number) => { pending++; timers.forEach((x) => clearTimeout(x)); timers.clear(); b = Int8Array.from(cells.split("").map(Number)); turn = t; over = false; thinking = false; hist = []; last = -1; ovl.hidden = true; showNote(""); render(); if (!R.hasMove(b, n, turn) && !R.hasMove(b, n, R.other(turn))) finish(); else afterMove(R.other(turn), true); },
  };
  reset();
  requestAnimationFrame(layout);
  return () => { disposed = true; timers.forEach((t) => clearTimeout(t)); timers.clear(); window.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout); ro?.disconnect(); delete (window as unknown as { __reversi?: unknown }).__reversi; root.replaceChildren(); };
}
