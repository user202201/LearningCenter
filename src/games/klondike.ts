/** 经典纸牌 (Klondike solitaire, the classic "Windows Solitaire"): seven piles, a stock and a waste, four foundations. Drag a card (a run drags together) or tap it. Rules: klondike-logic.ts. */
import "./klondike.css";
import type { GameCtx } from "./ctx";
import * as L from "./klondike-logic";
import SEEDS from "./klondike-seeds.json";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="26" fill="#d3f9d8"/>
<g stroke="#3b2f2f" stroke-width="4" stroke-linejoin="round"><rect x="18" y="26" width="42" height="62" rx="9" fill="#20c997" transform="rotate(-12 39 57)"/><rect x="60" y="30" width="42" height="62" rx="9" fill="#fff8e1" transform="rotate(10 81 61)"/></g>
<g transform="rotate(-12 39 57)"><circle cx="39" cy="57" r="11" fill="#fff8e1" stroke="#3b2f2f" stroke-width="3"/><circle cx="35" cy="54" r="2.4" fill="#3b2f2f"/><circle cx="43" cy="54" r="2.4" fill="#3b2f2f"/><path d="M34 60q5 5 10 0" fill="none" stroke="#3b2f2f" stroke-width="2.4" stroke-linecap="round"/></g>
<path d="M81 80c-9-6-12-12-12-17 0-4 3-6 6-6 3 0 5 2 6 4 1-2 3-4 6-4 3 0 6 2 6 6 0 5-3 11-12 17z" fill="#f03e3e" stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round" transform="rotate(10 81 61)"/>
<g transform="rotate(10 81 61)"><circle cx="77" cy="66" r="2.6" fill="#fff"/><circle cx="85" cy="66" r="2.6" fill="#fff"/><circle cx="77" cy="67" r="1.3" fill="#3b2f2f"/><circle cx="85" cy="67" r="1.3" fill="#3b2f2f"/><path d="M78 71q3 3 6 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><text x="68" y="48" font-size="15" font-weight="900" font-family="Arial, sans-serif" fill="#e03131">K</text></g>
<g fill="none" stroke="#12b886" stroke-width="3.5" stroke-dasharray="4 5" stroke-linecap="round"><rect x="18" y="98" width="20" height="6" rx="3"/><rect x="82" y="98" width="20" height="6" rx="3"/></g></svg>`;

const DARK = "#3b2f2f";
/** the four suits as round cartoon shapes (colour-blind safe: each has its own shape as well as red / black); `face` = eyes and a smile (left out on the corner copies) */
const FACE = [{ ey: 21, my: 26 }, { ey: 18, my: 23 }, { ey: 15, my: 21 }, { ey: 21, my: 27 }];
function suitSvg(suit: number, face: boolean): string {
  const red = suit === 1 || suit === 2;
  const fill = red ? "#f03e3e" : "#495057";
  let body: string;
  if (suit === 0) {
    const shapes = `<circle cx="20" cy="12" r="8.5"/><circle cx="10.5" cy="25" r="8.5"/><circle cx="29.5" cy="25" r="8.5"/><path d="M17 24h6l3 13H14z"/>`;
    body = `<g fill="${DARK}" stroke="${DARK}" stroke-width="6" stroke-linejoin="round">${shapes}</g><g fill="${fill}">${shapes}</g>`;
  } else {
    const d = suit === 1 ? "M20 2.5 36.5 20 20 37.5 3.5 20z"
      : suit === 2 ? "M20 35C6 25 3 17.5 3 12 3 7 7 3.5 11.5 3.5 15 3.5 18 5.5 20 9.5 22 5.5 25 3.5 28.5 3.5 33 3.5 37 7 37 12 37 17.5 34 25 20 35z"
        : "M20 3C14 12 3.5 17 3.5 25.5 3.5 30.5 7.5 33.5 12 33.5 15 33.5 17 32 18 30 18 34 16 36.5 13 37.5H27C24 36.5 22 34 22 30 23 32 25 33.5 28 33.5 32.5 33.5 36.5 30.5 36.5 25.5 36.5 17 26 12 20 3z";
    body = `<path d="${d}" fill="${fill}" stroke="${DARK}" stroke-width="3" stroke-linejoin="round"/>`;
  }
  let f = "";
  if (face) {
    const { ey, my } = FACE[suit];
    f = `<circle cx="14.5" cy="${ey}" r="3.4" fill="#fff"/><circle cx="25.5" cy="${ey}" r="3.4" fill="#fff"/><circle cx="15" cy="${ey + 0.6}" r="1.7" fill="${DARK}"/><circle cx="26" cy="${ey + 0.6}" r="1.7" fill="${DARK}"/><path d="M16 ${my}q4 4.2 8 0" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>`;
  }
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${body}${f}</svg>`;
}
const SUIT_SMALL = [0, 1, 2, 3].map((s) => suitSvg(s, false));
const SUIT_BIG = [0, 1, 2, 3].map((s) => suitSvg(s, true));
/** the back of a card: mint with a little smiling face */
const BACK = `<svg viewBox="0 0 40 56" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="32" height="48" rx="4" fill="none" stroke="#fff" stroke-width="1.6" opacity=".85"/><path d="M20 8 34 28 20 48 6 28z" fill="none" stroke="#fff" stroke-width="1.2" opacity=".55"/><circle cx="20" cy="28" r="9" fill="#fff8e1" stroke="#087f5b" stroke-width="2"/><circle cx="16.8" cy="26" r="1.7" fill="#3b2f2f"/><circle cx="23.2" cy="26" r="1.7" fill="#3b2f2f"/><path d="M16 30.5q4 4 8 0" fill="none" stroke="#3b2f2f" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const RECYCLE = `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M31 15a13 13 0 1 0 2 9" fill="none" stroke="#087f5b" stroke-width="4.5" stroke-linecap="round"/><path d="M33 5v12H21z" fill="#087f5b"/></svg>`;

const mmss = (ms: number): string => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
type SeedList = Record<string, number[]>;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const h = ctx.h;
  const timers = new Set<number>();
  const later = (f: () => void, ms: number): number => { const id = window.setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); return id; };
  const reduced = (): boolean => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  let alive = true, raf = 0;

  // ---- state
  let draw: 1 | 3 = ctx.store.get<number>("draw", 1) === 3 ? 3 : 1;
  let solvable = ctx.store.get<boolean>("solvable", false);
  let seed = 0;
  let s: L.State = L.deal(1, draw);
  let hist: L.State[] = [];
  let won = false, started = false, t0 = 0, elapsed = 0;
  let autoT = 0, autoRun = false, stuckShown = false;
  let lastMoveAt = { x: -999, y: -999, t: 0 };
  let prevDown: boolean[] = new Array(52).fill(true);

  // ---- DOM
  const scoreChip = h("span", { class: "kl-stat", id: "kl-score" });
  const movesChip = h("span", { class: "kl-stat", id: "kl-moves" });
  const timeChip = h("span", { class: "kl-stat", id: "kl-time" });
  const bestChip = h("span", { class: "kl-stat best", id: "kl-best" });
  const mkBtn = (id: string, f: () => void) => h("button", { type: "button", id, class: "mopt", onclick: f }, "");
  const undoBtn = mkBtn("kl-undo", () => undo());
  const hintBtn = mkBtn("kl-hint", () => hint());
  const doneBtn = mkBtn("kl-done", () => autoComplete());
  const newBtn = mkBtn("kl-new", () => newGame(false));
  const againBtn = mkBtn("kl-replay", () => newGame(true));
  const drawBtn = mkBtn("kl-draw", () => { draw = draw === 1 ? 3 : 1; ctx.store.set("draw", draw); ctx.sfx("tap"); newGame(false); });
  const kindBtn = mkBtn("kl-kind", () => { solvable = !solvable; ctx.store.set("solvable", solvable); ctx.sfx("tap"); newGame(false); });
  undoBtn.textContent = "撤销"; hintBtn.textContent = "提示"; doneBtn.textContent = "自动完成"; doneBtn.hidden = true;
  newBtn.textContent = "新牌局"; againBtn.textContent = "重玩本局";
  const msg = h("div", { class: "kl-msg", id: "kl-msg", role: "status" });
  const board = h("div", { class: "kl-board", id: "kl-board" });
  root.append(h("div", { class: "kl-wrap" },
    h("div", { class: "kl-hud" }, scoreChip, movesChip, timeChip, bestChip, undoBtn, hintBtn, doneBtn, newBtn, againBtn, drawBtn, kindBtn, msg),
    board));

  const stockSlot = h("div", { class: "kl-slot stock", id: "kl-stock", "data-slot": "stock" });
  stockSlot.innerHTML = RECYCLE;
  const wasteSlot = h("div", { class: "kl-slot waste", id: "kl-waste" });
  const count = h("span", { class: "kl-count", id: "kl-count" });
  const foundSlots = [0, 1, 2, 3].map((i) => { const e = h("div", { class: "kl-slot found", "data-found": i }); e.innerHTML = SUIT_SMALL[i]; return e; });
  const pileSlots = Array.from({ length: 7 }, (_, i) => h("div", { class: "kl-slot pile", "data-pile": i }));
  board.append(stockSlot, wasteSlot, ...foundSlots, ...pileSlots, count);
  const cardEls: HTMLElement[] = [];
  for (let c = 0; c < 52; c++) {
    const red = L.isRed(c), r = L.RANKS[L.rankOf(c)];
    const e = h("div", { class: "kl-card down " + (red ? "red" : "blk"), "data-card": c });
    e.innerHTML = `<div class="kl-in"><div class="kl-face"><div class="kl-top"><span>${r}</span>${SUIT_SMALL[L.suitOf(c)]}</div><div class="kl-big">${SUIT_BIG[L.suitOf(c)]}</div></div><div class="kl-back">${BACK}</div></div>`;
    cardEls.push(e); board.append(e);
  }

  // ---- layout
  interface Metrics { top: number; vgap: number; cw: number; ch: number; gap: number; x0: number; rowY: number; dd: number; du: number; bw: number; bh: number; fan: number }
  let M: Metrics = { top: 4, vgap: 6, cw: 40, ch: 56, gap: 4, x0: 0, rowY: 62, dd: 6, du: 16, bw: 320, bh: 400, fan: 10 };
  const colX = (i: number): number => M.x0 + i * (M.cw + M.gap);
  const offsetOf = (k: number, down: number, dd: number, du: number): number => Math.min(k, down) * dd + Math.max(0, k - down) * du;
  function measure(): void {
    const bw = board.clientWidth, bh = board.clientHeight;
    if (bw < 50 || bh < 50) return;
    const gap = clamp(bw * 0.014, 4, 16), pad = clamp(bw * 0.01, 3, 12);
    let cw = Math.floor(Math.min((bw - 2 * pad - 6 * gap) / 7, bh / 4.4, 112));
    const top = clamp(Math.round(bw * 0.012), 4, 10);
    let ch = 0, rowY = 0, dd = 0, du = 0, vgap = 0;
    for (let tries = 0; tries < 30; tries++) {
      ch = Math.round(cw * 1.4);
      vgap = Math.max(6, Math.round(ch * 0.1));
      rowY = top + ch + vgap;
      dd = Math.max(3, ch * 0.12); du = ch * 0.3;
      const avail = bh - rowY - ch - 4;
      const need = (a: number, b: number): number => { let m = 0; for (let i = 0; i < 7; i++) { const n = s.tab[i].length; if (n) m = Math.max(m, offsetOf(n - 1, s.down[i], a, b)); } return m; };
      const n0 = need(dd, du);
      if (n0 <= avail) break;
      const f = avail / n0;
      dd = Math.max(3, dd * f); du = Math.max(ch * 0.19, du * f);
      if (need(dd, du) <= avail || cw < 24) break;
      cw = Math.floor(cw * 0.95);
    }
    const x0 = (bw - (7 * cw + 6 * gap)) / 2;
    M = { top, vgap, cw, ch, gap, x0, rowY, dd, du, bw, bh, fan: cw * 0.27 };
    board.style.setProperty("--cw", cw + "px");
    board.style.setProperty("--ch", ch + "px");
  }
  interface Pos { x: number; y: number; z: number; down: boolean }
  const place = (e: HTMLElement, x: number, y: number) => { e.style.transform = `translate(${x}px,${y}px)`; };
  function positions(): Pos[] {
    const pos: Pos[] = new Array(52);
    s.stock.forEach((c, j) => { pos[c] = { x: colX(0), y: M.top, z: 1 + j, down: true }; });
    const n = s.waste.length, fan = n ? clamp(s.draw === 1 ? 1 : s.fan, 1, Math.min(3, n)) : 0;
    s.waste.forEach((c, j) => { const k = j - (n - fan); pos[c] = { x: colX(1) + (k > 0 ? k * M.fan : 0), y: M.top, z: 20 + j, down: false }; });
    for (let su = 0; su < 4; su++) for (let r = 0; r < s.found[su]; r++) pos[r * 4 + su] = { x: colX(3 + su), y: M.top, z: 1 + r, down: false };
    for (let i = 0; i < 7; i++) s.tab[i].forEach((c, k) => { pos[c] = { x: colX(i), y: M.rowY + offsetOf(k, s.down[i], M.dd, M.du), z: 10 + k, down: k < s.down[i] }; });
    return pos;
  }
  function positionSlots(): void {
    const sz = (e: HTMLElement, x: number, y: number) => { e.style.width = M.cw + "px"; e.style.height = M.ch + "px"; e.style.transform = `translate(${x}px,${y}px)`; };
    sz(stockSlot, colX(0), M.top); sz(wasteSlot, colX(1), M.top);
    foundSlots.forEach((e, i) => sz(e, colX(3 + i), M.top));
    pileSlots.forEach((e, i) => sz(e, colX(i), M.rowY));
    count.style.transform = `translate(${colX(0) + M.cw - (count.offsetWidth || 20) - 3}px,${M.top + M.ch - (count.offsetHeight || 16) - 3}px)`;
    count.style.left = "0"; count.style.top = "0"; count.style.right = "auto"; count.style.bottom = "auto";
  }
  function render(): void {
    measure();
    count.textContent = String(s.stock.length);
    count.hidden = s.stock.length === 0;
    positionSlots();
    const pos = positions();
    for (let c = 0; c < 52; c++) {
      const e = cardEls[c], p = pos[c];
      if (!p) { e.style.display = "none"; continue; }
      e.style.display = "";
      if (e.classList.contains("drag")) continue;
      place(e, p.x, p.y);
      e.style.zIndex = String(p.z);
      if (prevDown[c] && !p.down) { if (!reduced()) { e.classList.remove("flip"); void e.offsetWidth; e.classList.add("flip"); later(() => e.classList.remove("flip"), 360); } }
      e.classList.toggle("down", p.down);
      prevDown[c] = p.down;
    }
    board.dataset.cw = String(M.cw);
  }

  // ---- hud
  const bestScore = (): number => ctx.store.get<number>(`best-${draw}`, 0);
  function hud(): void {
    scoreChip.textContent = `得分：${s.score}`;
    movesChip.textContent = `步数：${s.moves}`;
    timeChip.textContent = `时间：${mmss(started ? Date.now() - t0 : elapsed)}`;
    bestChip.textContent = `最高：${Math.max(bestScore(), s.score)}`;
    undoBtn.disabled = !hist.length || won;
    hintBtn.disabled = won;
    doneBtn.hidden = won || !L.autoPlan(s);
    drawBtn.textContent = draw === 1 ? "翻 1 张" : "翻 3 张"; drawBtn.classList.toggle("on", draw === 3);
    kindBtn.textContent = solvable ? "可解牌局" : "随机牌局"; kindBtn.classList.toggle("on", solvable);
  }
  const say = (t: string, bad = false) => { msg.textContent = t; msg.classList.toggle("bad", bad); };

  // ---- effects
  function sparkle(slot: number): void {
    if (reduced()) return;
    const cx = colX(3 + slot) + M.cw / 2, cy = M.top + M.ch / 2;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, d = M.cw * (0.5 + Math.random() * 0.6);
      const e = h("span", { class: "kl-spark" });
      e.style.left = cx + "px"; e.style.top = cy + "px";
      e.style.setProperty("--dx", Math.cos(a) * d + "px"); e.style.setProperty("--dy", Math.sin(a) * d + "px");
      e.style.background = i % 2 ? "#fcc419" : "#ff922b";
      board.append(e); later(() => e.remove(), 750);
    }
  }
  const shake = (cards: number[]) => cards.forEach((c) => { const e = cardEls[c]; e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); later(() => e.classList.remove("shake"), 450); });
  function clearHint(): void { board.querySelectorAll(".hint").forEach((e) => e.classList.remove("hint")); }
  function showHint(m: L.Move): void {
    clearHint();
    if (m.k === "draw") { (s.stock.length ? cardEls[s.stock[s.stock.length - 1]] : stockSlot).classList.add("hint"); return; }
    const cs = L.carried(s, m.from, m.n);
    if (cs) cardEls[cs[0]].classList.add("hint");
    if (m.to.t === "found") foundSlots[m.to.i].classList.add("hint");
    else if (m.to.t === "tab") { const p = s.tab[m.to.i]; (p.length ? cardEls[p[p.length - 1]] : pileSlots[m.to.i]).classList.add("hint"); }
  }

  // ---- the game
  const randomSeed = (): number => 1 + Math.floor(Math.random() * 2147483000);
  function pickSeed(): number {
    if (!solvable) return randomSeed();
    const list = (SEEDS as SeedList)[String(draw)];
    let v = list[Math.floor(Math.random() * list.length)];
    if (v === seed) v = list[(list.indexOf(v) + 1) % list.length];
    return v;
  }
  function stopAuto(): void { if (autoT) { clearTimeout(autoT); timers.delete(autoT); autoT = 0; } autoRun = false; }
  function reset(ns: L.State, sd: number): void {
    stopAuto(); clearFly();
    s = ns; seed = sd; hist = []; won = false; started = false; elapsed = 0; stuckShown = false;
    prevDown = new Array(52).fill(true);
    say(""); clearHint(); ov.hidden = true;
  }
  function newGame(same: boolean): void {
    const sd = same && seed ? seed : pickSeed();
    reset(L.deal(sd, draw), sd);
    dealAnim(); hud(); ctx.sfx("tap");
  }
  function dealAnim(): void {
    measure(); positionSlots();
    if (reduced()) { render(); return; }
    board.classList.add("nofx");
    cardEls.forEach((e) => { place(e, colX(0), M.top); e.style.transitionDelay = ""; });
    void board.offsetWidth;
    board.classList.remove("nofx");
    const order: number[] = [];
    for (let k = 0; k < 7; k++) for (let i = k; i < 7; i++) order.push(s.tab[i][k]);
    order.forEach((c, k) => { cardEls[c].style.transitionDelay = k * 18 + "ms"; });
    render();
    later(() => cardEls.forEach((e) => (e.style.transitionDelay = "")), order.length * 18 + 400);
  }
  function doMove(m: L.Move, auto: boolean): boolean {
    if (won) return false;
    const before = s;
    const ns = L.apply(s, m);
    if (!ns) return false;
    if (!started && !auto) { started = true; t0 = Date.now() - elapsed; }
    hist.push(before); s = ns; stuckShown = false; clearHint();
    if (!auto) say("");
    render(); hud();
    if (m.k === "draw") ctx.sfx(s.recycles > before.recycles ? "bad" : "move");
    else if (m.to.t === "found") { sparkle(m.to.i); ctx.sfx("good"); } else ctx.sfx("place");
    if (L.isWon(s)) { win(); return true; }
    if (!auto) settle();
    return true;
  }
  /** the position stands still: is anything left to do? */
  function settle(): void {
    if (won || autoRun) return;
    if (!L.hint(s) && !stuckShown) { stuckShown = true; say("无牌可走。请撤销或重新发牌。", true); ctx.sfx("bad"); }
  }
  function undo(): void {
    if (won || !hist.length) return;
    stopAuto();
    s = hist.pop() as L.State; stuckShown = false; clearHint(); say("");
    render(); hud(); ctx.sfx("tap");
  }
  function hint(): void {
    if (won) return;
    stopAuto();
    const r = L.hint(s);
    if (!r) { clearHint(); say("没有可用的提示。请撤销或重新发牌。", true); ctx.sfx("bad"); return; }
    showHint(r.move);
    say({ reveal: "提示：翻开一张暗牌。", found: "提示：把这张牌收到右上角。", space: "提示：腾出一个空列。", tab: "提示：移动这张牌。", draw: "提示：翻动牌堆。", recycle: "提示：重翻废牌堆。" }[r.kind]);
    ctx.sfx("tap");
  }
  function autoComplete(): void {
    if (won || autoRun) return;
    const plan = L.autoPlan(s);
    if (!plan) return;
    ctx.sfx("tap"); say("");
    autoRun = true;
    let i = 0;
    const step = () => {
      autoT = 0;
      if (!alive || won || !autoRun) return;
      if (i >= plan.length) { autoRun = false; return; }
      if (!doMove(plan[i++], true)) { autoRun = false; return; }
      if (!won) autoT = later(step, reduced() ? 20 : 85);
    };
    step();
  }

  // ---- winning: the classic bouncing cards, confetti, the overlay
  const ovTitle = h("h2", {}, ""), ovLine = h("p", {}, ""), ovRec = h("p", { class: "rec", id: "kl-record" }, "");
  const ovBtn = h("button", { type: "button", class: "primary", id: "kl-again", onclick: () => newGame(false) }, "再来一局");
  const ov = h("div", { class: "kl-ovl", id: "kl-win" }, ovTitle, ovLine, ovRec, ovBtn);
  ov.hidden = true;
  board.append(ov);
  let flyers: { e: HTMLElement; x: number; y: number; vx: number; vy: number; dead: boolean }[] = [];
  function clearFly(): void {
    cancelAnimationFrame(raf); raf = 0;
    for (const c of cardEls) c.style.visibility = "";
    flyers.forEach((f) => f.e.remove()); flyers = [];
    board.querySelectorAll(".kl-conf").forEach((e) => e.remove());
  }
  function win(): void {
    won = true; stopAuto();
    elapsed = started ? Date.now() - t0 : elapsed; started = false;
    const bonus = L.timeBonus(elapsed);
    s = { ...s, score: s.score + bonus };
    let record = false;
    if (s.score > bestScore()) { ctx.store.set(`best-${draw}`, s.score); record = true; }
    const bt = ctx.store.get<number>(`time-${draw}`, 0);
    if (!bt || elapsed < bt) ctx.store.set(`time-${draw}`, elapsed);
    ctx.store.set("wins", ctx.store.get<number>("wins", 0) + 1);
    hud(); ctx.sfx("win");
    for (let k = 0; k < 4; k++) sparkle(k);
    const finish = () => showOverlay(record, bonus);
    if (reduced()) { finish(); return; }
    startFlyers(); confetti();
    later(finish, 1700);
  }
  function startFlyers(): void {
    const pos = positions();
    const order: number[] = [];
    for (let r = 12; r >= 0; r--) for (let su = 0; su < 4; su++) order.push(r * 4 + su);
    const gravity = Math.max(900, M.bh * 3.2);
    const start = performance.now();
    let next = 0, last = start;
    const loop = (now: number) => {
      raf = 0;
      if (!alive) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      while (next < order.length && now - start > next * 95) {
        const c = order[next++];
        const e = cardEls[c].cloneNode(true) as HTMLElement;
        e.className = "kl-fly kl-card " + (L.isRed(c) ? "red" : "blk");
        board.append(e);
        cardEls[c].style.visibility = "hidden";   // the card itself leaves its pile (the clone flies), so no king stays in front of the animation
        const dir = Math.random() < 0.5 ? -1 : 1;
        flyers.push({ e, x: pos[c].x, y: pos[c].y, vx: dir * (M.bw * (0.25 + Math.random() * 0.45)), vy: -M.bh * (0.2 + Math.random() * 0.8), dead: false });
      }
      for (const f of flyers) {
        if (f.dead) continue;
        f.vy += gravity * dt; f.x += f.vx * dt; f.y += f.vy * dt;
        const floor = M.bh - M.ch;
        if (f.y > floor) { f.y = floor; f.vy = -f.vy * 0.78; if (Math.abs(f.vy) < 40) f.vy = -60; }
        if (f.x < -M.cw * 1.2 || f.x > M.bw + M.cw * 0.2) { f.dead = true; f.e.remove(); continue; }
        f.e.style.transform = `translate(${f.x}px,${f.y}px)`;
      }
      if (next < order.length || flyers.some((f) => !f.dead)) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function confetti(): void {
    const cols = ["#ff6b6b", "#ffd43b", "#51cf66", "#4dabf7", "#b197fc", "#ff922b"];
    for (let i = 0; i < 44; i++) {
      const e = h("span", { class: "kl-conf" });
      e.style.left = Math.random() * 100 + "%"; e.style.background = cols[i % cols.length];
      e.style.setProperty("--dx", (Math.random() - 0.5) * 120 + "px"); e.style.setProperty("--dy", M.bh + 40 + "px"); e.style.setProperty("--rot", Math.random() * 900 - 450 + "deg");
      e.style.animationDuration = 1.8 + Math.random() * 1.6 + "s"; e.style.animationDelay = Math.random() * 0.9 + "s";
      board.append(e); later(() => e.remove(), 4600);
    }
  }
  function showOverlay(record: boolean, bonus: number): void {
    if (!alive) return;
    ovTitle.textContent = "你赢了。";
    ovLine.textContent = `得分 ${s.score} · 步数 ${s.moves} · 时间 ${mmss(elapsed)}`;
    ovRec.textContent = record ? `新纪录：${s.score}` : bonus ? `时间奖励：${bonus}` : "";
    ovRec.hidden = !ovRec.textContent;
    ov.hidden = false;
    try { ovBtn.focus(); } catch { /* ok */ }
  }

  // ---- input: drag and drop, or tap
  interface Group { from: L.Loc; n: number }
  const groupOf = (c: number): Group | null => {
    for (let i = 0; i < 7; i++) { const k = s.tab[i].indexOf(c); if (k >= 0) return k >= s.down[i] ? { from: { t: "tab", i }, n: s.tab[i].length - k } : null; }
    if (s.waste.length && s.waste[s.waste.length - 1] === c) return { from: { t: "waste" }, n: 1 };
    const su = L.suitOf(c);
    if (L.foundCard(s, su) === c) return { from: { t: "found", i: su }, n: 1 };
    return null;
  };
  const inStock = (c: number): boolean => s.stock.includes(c);
  const colAt = (x: number): number => clamp(Math.floor((x - M.x0 + M.gap / 2) / (M.cw + M.gap)), 0, 6);
  /** the move a card group makes when dropped at a point (client coordinates); the column of the pointer first, then the column of the card itself */
  function dropMove(g: Group, px: number, py: number, cardCx: number): L.Move | null {
    const r = board.getBoundingClientRect();
    const x = px - r.left, y = py - r.top, cx = cardCx - r.left;
    if (y < -24 || y > r.height + 24 || x < -24 || x > r.width + 24) return null;
    const cs = L.carried(s, g.from, g.n);
    if (!cs) return null;
    if (y < M.rowY - M.vgap / 2) {
      if (colAt(x) < 3) return null;
      const m: L.Move = { k: "move", from: g.from, to: { t: "found", i: L.suitOf(cs[0]) }, n: g.n };
      return L.isLegal(s, m) ? m : null;
    }
    for (const col of [colAt(x), colAt(cx)]) {
      const m: L.Move = { k: "move", from: g.from, to: { t: "tab", i: col }, n: g.n };
      if (L.isLegal(s, m)) return m;
    }
    return null;
  }
  function onTap(card: number, e: PointerEvent): void {
    const stockHit = card >= 0 ? inStock(card) : colAt(e.clientX - board.getBoundingClientRect().left) === 0 && e.clientY - board.getBoundingClientRect().top < M.rowY - M.vgap / 2;
    if (stockHit) { if (!doMove({ k: "draw" }, false)) { ctx.sfx("bad"); } return; }
    if (card < 0) return;
    const g = groupOf(card);
    if (!g) { shake([card]); ctx.sfx("bad"); return; }
    const m = L.tapMove(s, g.from, g.n);
    if (m && doMove(m, false)) { lastMoveAt = { x: e.clientX, y: e.clientY, t: Date.now() }; return; }
    shake(L.carried(s, g.from, g.n) ?? []); ctx.sfx("bad");
  }
  interface Press { id: number; x: number; y: number; card: number; g: Group | null; dragging: boolean; group: number[] }
  let press: Press | null = null;
  const setTgt = (m: L.Move | null) => {
    board.querySelectorAll(".tgt").forEach((e) => e.classList.remove("tgt"));
    if (!m || m.k !== "move") return;
    if (m.to.t === "found") foundSlots[m.to.i].classList.add("tgt");
    else if (m.to.t === "tab") { const p = s.tab[m.to.i]; (p.length ? cardEls[p[p.length - 1]] : pileSlots[m.to.i]).classList.add("tgt"); }
  };
  const onDown = (e: PointerEvent) => {
    if (won || autoRun || press || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = (e.target as HTMLElement).closest?.(".kl-card") as HTMLElement | null;
    if (!el && !(e.target as HTMLElement).closest?.(".kl-slot")) return;
    if (Date.now() - lastMoveAt.t < 380 && Math.hypot(e.clientX - lastMoveAt.x, e.clientY - lastMoveAt.y) < 14) return;   // a double tap: the first tap already moved the card
    const card = el ? Number(el.dataset.card) : -1;
    const g = card >= 0 ? groupOf(card) : null;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, card, g, dragging: false, group: g ? (L.carried(s, g.from, g.n) ?? []) : [] };
    clearHint();
    if (card >= 0) e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.dragging) {
      if (Math.hypot(dx, dy) < 7 || !press.g) return;
      press.dragging = true; render();
      press.group.forEach((c, k) => { const el = cardEls[c]; el.classList.add("drag"); el.style.zIndex = String(2000 + k); });
      try { board.setPointerCapture(e.pointerId); } catch { /* ok */ }
    }
    const pos = positions();
    press.group.forEach((c) => place(cardEls[c], pos[c].x + dx, pos[c].y + dy));
    const r = board.getBoundingClientRect();
    setTgt(dropMove(press.g as Group, e.clientX, e.clientY, r.left + pos[press.group[0]].x + dx + M.cw / 2));
  };
  const endPress = (e: PointerEvent, cancelled: boolean) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press; press = null;
    try { board.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    setTgt(null);
    if (!p.dragging) { if (!cancelled) onTap(p.card, e); return; }
    const pos = positions();
    const dx = e.clientX - p.x;
    const r = board.getBoundingClientRect();
    const m = cancelled ? null : dropMove(p.g as Group, e.clientX, e.clientY, r.left + pos[p.group[0]].x + dx + M.cw / 2);
    p.group.forEach((c) => cardEls[c].classList.remove("drag"));
    if (m && doMove(m, false)) return;
    render();
    if (!cancelled) { shake(p.group); ctx.sfx("bad"); }
  };
  const onUp = (e: PointerEvent) => endPress(e, false);
  const onCancel = (e: PointerEvent) => endPress(e, true);
  board.addEventListener("pointerdown", onDown);
  board.addEventListener("pointermove", onMove);
  board.addEventListener("pointerup", onUp);
  board.addEventListener("pointercancel", onCancel);
  const keyPlay = (from: L.Loc, whole: boolean) => {
    if (won || autoRun) return;
    const n = from.t === "tab" ? (whole ? L.upCount(s, from.i) : Math.min(1, L.upCount(s, from.i))) : 1;
    const m = n > 0 ? L.tapMove(s, from, n) : null;
    if (m) doMove(m, false); else { ctx.sfx("bad"); }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (won) { if (k === "Enter" || k === "n" || k === "N") { newGame(false); } return; }
    if (k === "z" || k === "Z" || k === "Backspace") { e.preventDefault(); undo(); }
    else if (k === "h" || k === "H") hint();
    else if (k === " " || k === "d" || k === "D") { if ((e.target as HTMLElement)?.tagName === "BUTTON") return; e.preventDefault(); if (!autoRun) doMove({ k: "draw" }, false); }
    else if (k === "a" || k === "A") autoComplete();
    else if (k === "w" || k === "W") keyPlay({ t: "waste" }, false);
    else if (k >= "1" && k <= "7") { keyPlay({ t: "tab", i: Number(k) - 1 }, e.shiftKey || false); }
    else if (k === "!" || k === "@" || k === "#" || k === "$" || k === "%" || k === "^" || k === "&") keyPlay({ t: "tab", i: "!@#$%^&".indexOf(k) }, true);
  };
  window.addEventListener("keydown", onKey);
  const onResize = () => { if (alive) render(); };
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (alive) render(); }) : null;
  ro?.observe(board);
  const clock = window.setInterval(() => { if (started && !won) timeChip.textContent = `时间：${mmss(Date.now() - t0)}`; }, 500);

  newGame(false);
  later(() => render(), 30);

  // ---- hook for the tests
  (window as unknown as Record<string, unknown>).__klondike = {
    state: () => JSON.parse(JSON.stringify(s)) as L.State,
    info: () => ({ seed, draw, solvable, won, started, auto: autoRun, flying: flyers.length, hist: hist.length, cw: M.cw, ch: M.ch, du: M.du, dd: M.dd, elapsed }),
    /** puts any position on the table (not saved) */
    load(st: L.State, sd = 0) { reset(JSON.parse(JSON.stringify(st)), sd); render(); hud(); },
    apply: (m: L.Move) => doMove(m, false),
    undo: () => undo(),
    newGame(sd: number, d: 1 | 3 = draw) { draw = d; reset(L.deal(sd, d), sd); render(); hud(); },
    /** moves the clock of the running game (ms) */
    shiftClock(ms: number) { if (started) t0 -= ms; else elapsed += ms; hud(); },
  };

  return () => {
    alive = false;
    timers.forEach((t) => clearTimeout(t)); timers.clear();
    clearInterval(clock);
    cancelAnimationFrame(raf);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", onResize);
    ro?.disconnect();
    board.removeEventListener("pointerdown", onDown);
    board.removeEventListener("pointermove", onMove);
    board.removeEventListener("pointerup", onUp);
    board.removeEventListener("pointercancel", onCancel);
    try { delete (window as unknown as Record<string, unknown>).__klondike; } catch { /* ok */ }
  };
}
