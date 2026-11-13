/** 空当接龙 (FreeCell): eight cascades, four free cells, four foundations. Drag a card or tap it, then tap where it goes. Rules: freecell-logic.ts. */
import "./freecell.css";
import type { GameCtx } from "./ctx";
import * as L from "./freecell-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="26" fill="#d3f9d8"/>
<g stroke="#3b2f2f" stroke-width="4" stroke-linejoin="round"><rect x="16" y="30" width="42" height="62" rx="9" fill="#fff8e1" transform="rotate(-12 37 61)"/><rect x="62" y="30" width="42" height="62" rx="9" fill="#fff8e1" transform="rotate(10 83 61)"/></g>
<path d="M37 82c-9-6-12-12-12-17 0-4 3-6 6-6 3 0 5 2 6 4 1-2 3-4 6-4 3 0 6 2 6 6 0 5-3 11-12 17z" fill="#f03e3e" stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round" transform="rotate(-12 37 61)"/>
<circle cx="33" cy="68" r="2.6" fill="#fff"/><circle cx="41" cy="68" r="2.6" fill="#fff"/><circle cx="33" cy="69" r="1.3" fill="#3b2f2f"/><circle cx="41" cy="69" r="1.3" fill="#3b2f2f"/><path d="M34 73q3 3 6 0" fill="none" stroke="#3b2f2f" stroke-width="1.8" stroke-linecap="round"/>
<path d="M83 42l12 14-12 14-12-14z" fill="#343a40" stroke="#3b2f2f" stroke-width="3" stroke-linejoin="round" transform="rotate(10 83 61)"/>
<g transform="rotate(10 83 61)"><circle cx="79" cy="55" r="2.6" fill="#fff"/><circle cx="87" cy="55" r="2.6" fill="#fff"/><circle cx="79" cy="56" r="1.3" fill="#3b2f2f"/><circle cx="87" cy="56" r="1.3" fill="#3b2f2f"/><path d="M80 60q3 3 6 0" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></g>
<g fill="none" stroke="#12b886" stroke-width="3.5" stroke-dasharray="4 5" stroke-linecap="round"><rect x="18" y="98" width="20" height="6" rx="3"/><rect x="82" y="98" width="20" height="6" rx="3"/></g></svg>`;

const DARK = "#3b2f2f";
/** the four cute suits: shape, colour, face position; `face` = eyes and a smile (left out on the tiny corner copies) */
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

interface Save { deal: number; moves: L.Move[]; t: number }
const mmss = (ms: number): string => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const h = ctx.h;
  const timers = new Set<number>();
  const later = (f: () => void, ms: number): number => { const id = window.setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); return id; };
  const reduced = (): boolean => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };
  let alive = true, raf = 0;

  // ---- state
  let deal = 0;
  let base: L.State = L.deal(1);
  let moves: L.Move[] = [];
  let state: L.State = base;
  let won = false, started = false, t0 = 0, elapsed = 0;
  let autoOn = ctx.store.get<boolean>("auto", true);
  let sel: { from: L.Loc; n: number } | null = null;
  let lastTap: { card: number; t: number } | null = null;
  let autoT = 0, stuckShown = false;
  let hintKey = "";

  // ---- DOM
  const dealChip = h("span", { class: "freecell-chip", id: "fc-deal" });
  const movesChip = h("span", { class: "freecell-chip", id: "fc-moves" });
  const timeChip = h("span", { class: "freecell-chip", id: "fc-time" });
  const winsChip = h("span", { class: "freecell-chip", id: "fc-wins" });
  const bestChip = h("span", { class: "freecell-chip", id: "fc-best" });
  const mkBtn = (id: string, text: string, f: () => void, cls = "") => h("button", { type: "button", id, class: "freecell-btn " + cls, onclick: f }, text);
  const undoBtn = mkBtn("fc-undo", "撤销", () => undo(), "alt");
  const hintBtn = mkBtn("fc-hint", "提示", () => hint(), "alt");
  const doneBtn = mkBtn("fc-done", "自动完成", () => autoComplete(), "gold");
  doneBtn.hidden = true;
  const newBtn = mkBtn("fc-new", "新局", () => newGame(randomDeal()));
  const pickBtn = mkBtn("fc-pick", "选局", () => pickDialog(), "alt");
  const autoBtn = mkBtn("fc-auto", "", () => { autoOn = !autoOn; ctx.store.set("auto", autoOn); autoLabel(); if (autoOn) scheduleAuto(120, "safe"); }, "alt");
  const msg = h("div", { class: "freecell-msg", id: "fc-msg", role: "status" });
  const board = h("div", { class: "freecell-board", id: "fc-board" });
  const wrap = h("div", { class: "freecell-wrap" },
    h("div", { class: "freecell-side" },
      h("div", { class: "freecell-hud" }, dealChip, movesChip, timeChip, winsChip, bestChip),
      h("div", { class: "freecell-btns" }, undoBtn, hintBtn, doneBtn, newBtn, pickBtn, autoBtn),
      msg),
    board);
  root.append(wrap);
  const autoLabel = () => { autoBtn.textContent = autoOn ? "自动收牌：开" : "自动收牌：关"; };
  autoLabel();

  const cellSlots = [0, 1, 2, 3].map((i) => { const e = h("div", { class: "freecell-slot cell", "data-cell": i }); board.append(e); return e; });
  const foundSlots = [0, 1, 2, 3].map((i) => { const e = h("div", { class: "freecell-slot found", "data-found": i }); e.innerHTML = SUIT_SMALL[i]; board.append(e); return e; });
  const colSlots = Array.from({ length: 8 }, (_, i) => { const e = h("div", { class: "freecell-slot col", "data-col": i }); board.append(e); return e; });
  const cardEls: HTMLElement[] = [];
  for (let c = 0; c < 52; c++) {
    const red = L.isRed(c), r = L.RANKS[L.rankOf(c)];
    const e = h("div", { class: "freecell-card " + (red ? "red" : "blk"), "data-card": c });
    e.innerHTML = `<div class="freecell-in"><div class="freecell-top"><span>${r}</span>${SUIT_SMALL[L.suitOf(c)]}</div><div class="freecell-big">${SUIT_BIG[L.suitOf(c)]}</div></div>`;
    cardEls.push(e); board.append(e);
  }

  // ---- layout
  interface Metrics { cw: number; ch: number; gap: number; x0: number; rowY: number; dy: number; bw: number; bh: number }
  let M: Metrics = { cw: 40, ch: 56, gap: 4, x0: 0, rowY: 60, dy: 16, bw: 320, bh: 400 };
  const slotX = (i: number): number => M.x0 + i * (M.cw + M.gap);
  function measure(): void {
    const bw = board.clientWidth, bh = board.clientHeight;
    if (bw < 50 || bh < 50) return;
    const gap = clamp(bw * 0.012, 3, 12), pad = clamp(bw * 0.008, 2, 8);
    const cwW = (bw - 2 * pad - 7 * gap) / 8;
    const cwH = bh / (3.68 * 1.42);
    const cw = Math.floor(Math.min(cwW, cwH, 100));
    const ch = Math.round(cw * 1.42);
    const vgap = Math.max(6, Math.round(ch * 0.12));
    const x0 = (bw - (8 * cw + 7 * gap)) / 2;
    const rowY = ch + vgap;
    let maxLen = 1;
    for (const c of state.cols) maxLen = Math.max(maxLen, c.length);
    const dy = maxLen <= 1 ? ch * 0.3 : clamp((bh - rowY - ch) / (maxLen - 1), 6, ch * 0.3);
    M = { cw, ch, gap, x0, rowY, dy, bw, bh };
    board.style.setProperty("--cw", cw + "px");
    board.style.setProperty("--ch", ch + "px");
  }
  const place = (e: HTMLElement, x: number, y: number) => { e.style.transform = `translate(${x}px,${y}px)`; };
  function positionSlots(): void {
    const sz = (e: HTMLElement, x: number, y: number) => { e.style.width = M.cw + "px"; e.style.height = M.ch + "px"; e.style.transform = `translate(${x}px,${y}px)`; e.style.left = "0"; e.style.top = "0"; };
    cellSlots.forEach((e, i) => sz(e, slotX(i), 0));
    foundSlots.forEach((e, i) => sz(e, slotX(4 + i), 0));
    colSlots.forEach((e, i) => sz(e, slotX(i), M.rowY));
  }
  /** where a card sits */
  function where(c: number): { x: number; y: number; z: number } {
    for (let i = 0; i < 8; i++) { const k = state.cols[i].indexOf(c); if (k >= 0) return { x: slotX(i), y: M.rowY + k * M.dy, z: 10 + k }; }
    const ci = state.cells.indexOf(c);
    if (ci >= 0) return { x: slotX(ci), y: 0, z: 5 };
    return { x: slotX(4 + L.suitOf(c)), y: 0, z: 1 + L.rankOf(c) };
  }
  function render(): void {
    measure();
    positionSlots();
    for (let c = 0; c < 52; c++) {
      const e = cardEls[c];
      if (e.classList.contains("drag")) continue;
      const p = where(c);
      place(e, p.x, p.y);
      e.style.zIndex = String(p.z);
    }
    const selected = new Set<number>();
    if (sel) { const cs = L.carried(state, sel.from, sel.n); if (cs) cs.forEach((c) => selected.add(c)); }
    cardEls.forEach((e, c) => e.classList.toggle("sel", selected.has(c)));
    const tg = targets();
    colSlots.forEach((e, i) => e.classList.toggle("tgt", tg.some((m) => m.to.t === "col" && m.to.i === i && state.cols[i].length === 0)));
    cellSlots.forEach((e, i) => e.classList.toggle("tgt", tg.some((m) => m.to.t === "cell" && m.to.i === i)));
    foundSlots.forEach((e, i) => e.classList.toggle("tgt", tg.some((m) => m.to.t === "found" && m.to.i === i)));
    board.dataset.cw = String(M.cw);
  }
  /** the moves of the selected card(s) */
  function targets(): L.Move[] { return sel ? L.movesFrom(state, sel.from, sel.n) : []; }
  const colHighlight = (m: L.Move | null) => { colSlots.forEach((e) => e.classList.remove("hint")); cellSlots.forEach((e) => e.classList.remove("hint")); foundSlots.forEach((e) => e.classList.remove("hint")); cardEls.forEach((e) => e.classList.remove("hint")); hintKey = ""; if (!m) return; hintKey = JSON.stringify(m); const cs = L.carried(state, m.from, m.n); if (cs) cardEls[cs[0]].classList.add("hint"); const t = m.to; if (t.t === "col") { const col = state.cols[t.i]; if (col.length) cardEls[col[col.length - 1]].classList.add("hint"); else colSlots[t.i].classList.add("hint"); } else if (t.t === "cell") cellSlots[t.i].classList.add("hint"); else foundSlots[t.i].classList.add("hint"); };

  // ---- hud
  const bestMap = (): Record<string, number> => ctx.store.get<Record<string, number>>("best", {});
  const userMoves = (): number => moves.filter((m) => !m.a).length;
  function hud(): void {
    dealChip.textContent = `第${deal}局`;
    movesChip.textContent = `步数：${userMoves()}`;
    timeChip.textContent = `时间：${mmss(started ? Date.now() - t0 : elapsed)}`;
    winsChip.textContent = `胜利：${ctx.store.get<number>("wins", 0)}`;
    const b = bestMap()[String(deal)];
    bestChip.textContent = `最少步数：${b ?? "-"}`;
    undoBtn.disabled = !moves.length || won;
    doneBtn.hidden = won || !L.isTrivial(state);
  }
  const say = (t: string, bad = false) => { msg.textContent = t; msg.classList.toggle("bad", bad); };
  const save = () => {
    if (deal <= 0) return;
    if (won || !moves.length) ctx.store.set("save", null);
    else ctx.store.set("save", { deal, moves, t: started ? Date.now() - t0 : elapsed } satisfies Save);
  };

  // ---- effects
  function sparkle(slot: number, color = "#fcc419"): void {
    if (reduced()) return;
    const cx = slotX(4 + slot) + M.cw / 2, cy = M.ch / 2;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + Math.random() * 0.5, d = M.cw * (0.5 + Math.random() * 0.6);
      const s = h("span", { class: "freecell-spark" });
      s.style.left = cx + "px"; s.style.top = cy + "px";
      s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d + "px");
      s.style.background = i % 2 ? color : "#ff922b";
      board.append(s); later(() => s.remove(), 750);
    }
  }
  const shake = (cards: number[]) => {
    cards.forEach((c) => { const e = cardEls[c]; e.classList.remove("shake"); void e.offsetWidth; e.classList.add("shake"); later(() => e.classList.remove("shake"), 450); });
  };

  // ---- the game
  function clearSel(): void { sel = null; }
  function reset(b: L.State, d: number, mv: L.Move[], el: number): void {
    stopAuto();
    base = b; deal = d; moves = mv; state = L.replay(b, mv); won = false; elapsed = el; started = el > 0 || mv.length > 0;
    t0 = Date.now() - el; sel = null; lastTap = null; stuckShown = false; say(""); colHighlight(null);
    ov?.remove(); ov = null; clearFly();
  }
  const randomDeal = (): number => 1 + Math.floor(Math.random() * L.MAX_DEAL);
  function newGame(n: number): void {
    reset(L.deal(n), n, [], 0);
    ctx.store.set("save", null);
    dealAnim();
    hud();
    ctx.sfx("tap");
  }
  function dealAnim(): void {
    measure(); positionSlots();
    if (reduced()) { render(); return; }
    const order: number[] = [];
    for (let k = 0; k < 7; k++) for (let i = 0; i < 8; i++) if (state.cols[i][k] !== undefined) order.push(state.cols[i][k]);
    board.classList.add("nofx");
    cardEls.forEach((e) => { place(e, M.bw / 2 - M.cw / 2, -M.ch); e.style.transitionDelay = ""; });
    void board.offsetWidth;
    board.classList.remove("nofx");
    order.forEach((c, k) => { cardEls[c].style.transitionDelay = k * 14 + "ms"; });
    render();
    later(() => cardEls.forEach((e) => (e.style.transitionDelay = "")), 52 * 14 + 400);
  }

  function doMove(m: L.Move, auto: boolean): boolean {
    if (won) return false;
    const ns = L.tryMove(state, m);
    if (!ns) return false;
    const cs = L.carried(state, m.from, m.n) ?? [];
    if (!started && !auto) { started = true; t0 = Date.now() - elapsed; }
    moves.push({ from: m.from, to: m.to, n: m.n, a: auto || undefined });
    state = ns; clearSel(); stuckShown = false; colHighlight(null);
    if (!auto) say("");
    cs.forEach((c) => { const e = cardEls[c]; e.classList.add("fly"); later(() => e.classList.remove("fly"), 320); });
    render(); hud(); save();
    if (m.to.t === "found") { sparkle(m.to.i); ctx.sfx("good"); } else ctx.sfx("move");
    if (L.isWon(state)) { win(); return true; }
    if (!auto) { if (autoOn) scheduleAuto(240, "safe"); else settle(); }
    return true;
  }
  function stopAuto(): void { if (autoT) { clearTimeout(autoT); timers.delete(autoT); autoT = 0; } }
  function scheduleAuto(delay: number, kind: "safe" | "all"): void {
    stopAuto();
    autoT = later(() => {
      autoT = 0;
      if (won || !alive) return;
      const m = kind === "all" ? L.upMove(state) : autoOn ? L.safeMove(state) : null;
      if (!m) { settle(); return; }
      doMove(m, true);
      if (!won) scheduleAuto(kind === "all" ? 90 : 170, kind);
    }, delay);
  }
  function autoComplete(): void { if (won || !L.isTrivial(state)) return; ctx.sfx("tap"); scheduleAuto(30, "all"); }
  /** the position stands still: stuck? */
  function settle(): void {
    hud();
    if (won || autoT) return;
    if (L.isStuck(state) && !stuckShown) { stuckShown = true; say("没有可以走的牌了！撤销几步再试试吧。", true); ctx.sfx("bad"); }
  }
  function undo(): void {
    if (won || !moves.length) return;
    stopAuto();
    while (moves.length && moves[moves.length - 1].a) moves.pop();
    moves.pop();
    state = L.replay(base, moves);
    clearSel(); stuckShown = false; say(""); colHighlight(null);
    render(); hud(); save(); ctx.sfx("tap");
  }
  function hint(): void {
    if (won) return;
    stopAuto();
    const r = L.hints(state);
    if (!r.move) { say("没有可以走的牌了！撤销几步再试试吧。", true); ctx.sfx("bad"); return; }
    clearSel(); render();
    colHighlight(r.move);
    say(r.unsolvable ? "这一局好像走不通了，撤销几步或换一局吧。" : "提示：试试这一步！", r.unsolvable);
    ctx.sfx("tap");
  }

  // ---- winning: the classic bouncing cards, confetti, a friendly overlay
  let ov: HTMLElement | null = null;
  let flyers: { e: HTMLElement; x: number; y: number; vx: number; vy: number; t: number; dead: boolean }[] = [];
  function clearFly(): void { cancelAnimationFrame(raf); raf = 0; flyers.forEach((f) => f.e.remove()); flyers = []; board.querySelectorAll(".freecell-conf").forEach((e) => e.remove()); }
  function win(): void {
    won = true; stopAuto();
    const best = bestMap(), key = String(deal), mv = userMoves();
    const wins = ctx.store.get<number>("wins", 0) + 1;
    let record = false;
    if (deal > 0) {
      ctx.store.set("wins", wins);
      if (best[key] === undefined || mv < best[key]) { best[key] = mv; ctx.store.set("best", best); record = true; }
    }
    ctx.store.set("save", null);
    elapsed = started ? Date.now() - t0 : elapsed; started = false;
    hud(); ctx.sfx("win");
    for (let s = 0; s < 4; s++) sparkle(s);
    const total = elapsed;
    if (reduced()) { showOverlay(record, mv, total); return; }
    startFlyers();
    confetti();
    later(() => showOverlay(record, mv, total), 1500);
  }
  function startFlyers(): void {
    const order: number[] = [];
    for (let r = 12; r >= 0; r--) for (let s = 0; s < 4; s++) order.push(r * 4 + s);
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
        e.className = "freecell-fly freecell-card " + (L.isRed(c) ? "red" : "blk");
        const p = where(c);
        board.append(e);
        const dir = Math.random() < 0.5 ? -1 : 1;
        flyers.push({ e, x: p.x, y: p.y, vx: dir * (M.bw * (0.25 + Math.random() * 0.45)), vy: -M.bh * (0.2 + Math.random() * 0.8), t: 0, dead: false });
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
      const e = h("span", { class: "freecell-conf" });
      e.style.left = Math.random() * 100 + "%"; e.style.background = cols[i % cols.length];
      e.style.setProperty("--dx", (Math.random() - 0.5) * 120 + "px"); e.style.setProperty("--dy", M.bh + 40 + "px"); e.style.setProperty("--rot", Math.random() * 900 - 450 + "deg");
      e.style.animationDuration = 1.8 + Math.random() * 1.6 + "s"; e.style.animationDelay = Math.random() * 0.9 + "s";
      board.append(e); later(() => e.remove(), 4600);
    }
  }
  function showOverlay(record: boolean, mv: number, ms: number): void {
    if (!alive) return;
    ov?.remove();
    ov = h("div", { class: "freecell-ov", id: "fc-win" },
      h("div", { class: "freecell-card-box" },
        h("h2", {}, "太棒了，通关啦！"),
        h("p", {}, `第${deal}局 · ${mv}步 · ${mmss(ms)}`),
        record && deal > 0 ? h("p", { id: "fc-record" }, "新纪录！") : null,
        h("div", { class: "freecell-row" },
          h("button", { type: "button", id: "fc-again", class: "freecell-btn", onclick: () => newGame(randomDeal()) }, "再来一局"),
          h("button", { type: "button", id: "fc-back", class: "freecell-btn alt", onclick: () => ctx.exit() }, "返回游戏列表"))));
    board.append(ov);
  }

  // ---- choose a deal
  function pickDialog(): void {
    if (ov) return;
    const inp = h("input", { id: "fc-num", type: "number", min: String(L.MIN_DEAL), max: String(L.MAX_DEAL), inputMode: "numeric", value: String(deal || 1) });
    const err = h("p", { id: "fc-err", class: "bad" });
    const go = () => {
      const n = Number(inp.value);
      if (!Number.isInteger(n) || n < L.MIN_DEAL || n > L.MAX_DEAL) { err.textContent = "请输入 1 到 32000 之间的整数。"; ctx.sfx("bad"); return; }
      ov?.remove(); ov = null; newGame(n);
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); e.stopPropagation(); });
    ov = h("div", { class: "freecell-ov", id: "fc-dialog" },
      h("div", { class: "freecell-card-box" },
        h("h2", {}, "选择牌局"),
        h("p", {}, "输入 1 到 32000 的局号"),
        inp, err,
        h("div", { class: "freecell-row" },
          h("button", { type: "button", id: "fc-go", class: "freecell-btn", onclick: go }, "开始"),
          h("button", { type: "button", id: "fc-rand", class: "freecell-btn alt", onclick: () => { ov?.remove(); ov = null; newGame(randomDeal()); } }, "随机"),
          h("button", { type: "button", id: "fc-cancel", class: "freecell-btn alt", onclick: () => { ov?.remove(); ov = null; } }, "取消"))));
    board.append(ov);
    inp.focus(); inp.select();
  }

  // ---- input: drag and drop, or tap a card then the target
  interface Press { id: number; x: number; y: number; card: number; from: L.Loc | null; n: number; dragging: boolean; ox: number; oy: number; group: number[] }
  let press: Press | null = null;
  const groupAt = (c: number): { from: L.Loc; n: number } | null => {
    for (let i = 0; i < 8; i++) {
      const col = state.cols[i], k = col.indexOf(c);
      if (k >= 0) return L.isRun(col.slice(k)) ? { from: { t: "col", i }, n: col.length - k } : null;
    }
    const ci = state.cells.indexOf(c);
    return ci >= 0 ? { from: { t: "cell", i: ci }, n: 1 } : null;
  };
  /** the target under a point of the board: a top-row slot or a column */
  function locAt(px: number, py: number): L.Loc | null {
    const r = board.getBoundingClientRect();
    const x = px - r.left, y = py - r.top;
    const idx = clamp(Math.round((x - M.x0 - M.cw / 2) / (M.cw + M.gap)), 0, 7);
    if (y < -20 || y > r.height + 20 || x < -20 || x > r.width + 20) return null;
    if (y < M.rowY - (M.rowY - M.ch) / 2) return idx < 4 ? { t: "cell", i: idx } : { t: "found", i: idx - 4 };
    return { t: "col", i: idx };
  }
  /** a move from `g` to a target place (a foundation target means "its own suit's"; a free cell target means "any free one" when that one is taken) */
  function moveTo(g: { from: L.Loc; n: number }, to: L.Loc): L.Move | null {
    const cs = L.carried(state, g.from, g.n);
    if (!cs) return null;
    if (to.t === "found") to = { t: "found", i: L.suitOf(cs[0]) };
    if (to.t === "cell" && state.cells[to.i] !== -1) { const e = state.cells.indexOf(-1); if (e >= 0) to = { t: "cell", i: e }; }
    const m: L.Move = { from: g.from, to, n: g.n };
    return L.isLegal(state, m) ? m : null;
  }
  const best = (ms: L.Move[]): L.Move | null => ms.find((m) => m.to.t === "found") ?? ms.find((m) => m.to.t === "col" && state.cols[m.to.i].length > 0) ?? ms.find((m) => m.to.t === "col") ?? ms[0] ?? null;

  function onTap(card: number, e: PointerEvent): void {
    const now = Date.now();
    const g = card >= 0 ? groupAt(card) : null;
    if (card >= 0 && lastTap && lastTap.card === card && now - lastTap.t < 420) {
      lastTap = null;
      if (g) { const m = best(L.movesFrom(state, g.from, g.n)); if (m && doMove(m, false)) return; shake(L.carried(state, g.from, g.n) ?? []); ctx.sfx("bad"); }
      return;
    }
    lastTap = card >= 0 ? { card, t: now } : null;
    if (sel) {
      // a second tap: on a target?
      const sg = { from: sel.from, n: sel.n };
      const sc = L.carried(state, sg.from, sg.n);
      if (card >= 0 && sc && sc.includes(card)) { clearSel(); render(); return; }
      let to: L.Loc | null = null;
      if (card >= 0) {
        for (let i = 0; i < 8; i++) if (state.cols[i].includes(card)) to = { t: "col", i };
        const ci = state.cells.indexOf(card);
        if (ci >= 0) to = null;
        else if (!to) to = { t: "found", i: L.suitOf(card) };
      } else to = locAt(e.clientX, e.clientY);
      const m = to ? moveTo(sg, to) : null;
      if (m) { lastTap = null; doMove(m, false); return; }
      if (card < 0) { shake(sc ?? []); ctx.sfx("bad"); clearSel(); render(); return; }
    }
    if (card < 0) { clearSel(); render(); return; }
    if (!g) { shake([card]); ctx.sfx("bad"); clearSel(); render(); return; }
    const ms = L.movesFrom(state, g.from, g.n);
    colHighlight(null);
    if (!ms.length) { shake(L.carried(state, g.from, g.n) ?? []); ctx.sfx("bad"); clearSel(); render(); return; }
    const up = ms.find((m) => m.to.t === "found");
    if (up || ms.length === 1) { lastTap = null; doMove((up ?? ms[0]), false); return; }
    sel = g; ctx.sfx("tap"); render();
  }

  const onDown = (e: PointerEvent) => {
    if (won || ov || press || (e.pointerType === "mouse" && e.button !== 0)) return;
    const el = (e.target as HTMLElement).closest?.(".freecell-card") as HTMLElement | null;
    const card = el ? Number(el.dataset.card) : -1;
    const g = card >= 0 ? groupAt(card) : null;
    press = { id: e.pointerId, x: e.clientX, y: e.clientY, card, from: g?.from ?? null, n: g?.n ?? 0, dragging: false, ox: 0, oy: 0, group: g ? (L.carried(state, g.from, g.n) ?? []) : [] };
    if (card >= 0) e.preventDefault();
  };
  const onMove = (e: PointerEvent) => {
    if (!press || e.pointerId !== press.id) return;
    const dx = e.clientX - press.x, dy = e.clientY - press.y;
    if (!press.dragging) {
      if (Math.hypot(dx, dy) < 7 || !press.from) return;
      press.dragging = true; clearSel(); colHighlight(null); render();
      press.group.forEach((c, k) => { const el = cardEls[c]; el.classList.add("drag"); el.style.zIndex = String(2000 + k); });
      try { board.setPointerCapture(e.pointerId); } catch { /* ok */ }
    }
    press.group.forEach((c) => { const p = where(c); place(cardEls[c], p.x + dx, p.y + dy); });
  };
  const endPress = (e: PointerEvent, cancelled: boolean) => {
    if (!press || e.pointerId !== press.id) return;
    const p = press; press = null;
    try { board.releasePointerCapture(e.pointerId); } catch { /* ok */ }
    if (!p.dragging) { if (!cancelled) onTap(p.card, e); return; }
    const group = p.group;
    group.forEach((c) => cardEls[c].classList.remove("drag"));
    const to = cancelled ? null : locAt(e.clientX, e.clientY);
    const g = { from: p.from as L.Loc, n: p.n };
    const same = to && to.t === g.from.t && to.i === g.from.i;
    const m = to && !same ? moveTo(g, to) : null;
    if (m) { doMove(m, false); return; }
    render();
    if (to && !same) { shake(group); ctx.sfx("bad"); }
  };
  const onUp = (e: PointerEvent) => endPress(e, false);
  const onCancel = (e: PointerEvent) => endPress(e, true);
  board.addEventListener("pointerdown", onDown);
  board.addEventListener("pointermove", onMove);
  board.addEventListener("pointerup", onUp);
  board.addEventListener("pointercancel", onCancel);
  const onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === "z" || e.key === "Z" || e.key === "Backspace") { e.preventDefault(); undo(); }
    else if (e.key === "h" || e.key === "H") hint();
  };
  window.addEventListener("keydown", onKey);
  const onResize = () => { render(); };
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (alive) render(); }) : null;
  ro?.observe(board);

  // the clock
  const clock = window.setInterval(() => { if (started && !won) timeChip.textContent = `时间：${mmss(Date.now() - t0)}`; }, 500);

  // ---- start: resume the game in progress, or a new random deal
  (() => {
    const sv = ctx.store.get<Save | null>("save", null);
    if (sv && Number.isInteger(sv.deal) && sv.deal >= 1 && Array.isArray(sv.moves)) {
      let st = L.deal(sv.deal), okAll = true;
      for (const m of sv.moves) { const ns = L.tryMove(st, m); if (!ns) { okAll = false; break; } st = ns; }
      if (okAll && !L.isWon(st)) { reset(L.deal(sv.deal), sv.deal, sv.moves, Number(sv.t) || 0); render(); hud(); later(() => { render(); settle(); if (autoOn) scheduleAuto(300, "safe"); }, 0); return; }
    }
    newGame(randomDeal());
  })();
  later(() => render(), 30);

  // ---- hook for the tests
  (window as unknown as Record<string, unknown>).__freecell = {
    get s() { return { deal, moves: userMoves(), all: moves.length, won, started, auto: autoOn, sel, state: JSON.parse(JSON.stringify(state)), stuck: stuckShown, flying: flyers.length, cw: M.cw, ch: M.ch, dy: M.dy }; },
    /** put any position on the table (not saved, deal 0) */
    load(st: L.State) { reset(JSON.parse(JSON.stringify(st)), 0, [], 0); render(); hud(); settle(); },
    apply(m: L.Move) { return doMove(m, false); },
    undo() { undo(); },
    newGame(n: number) { newGame(n); },
  };

  return () => {
    alive = false;
    if (started && deal > 0 && !won) { try { ctx.store.set("save", { deal, moves, t: Date.now() - t0 } satisfies Save); } catch { /* ok */ } }
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
    try { delete (window as unknown as Record<string, unknown>).__freecell; } catch { /* ok */ }
  };
}
