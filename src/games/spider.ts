import type { GameCtx } from "./ctx";
import "./spider.css";
import * as L from "./spider-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
<rect x="6" y="14" width="108" height="94" rx="22" fill="#12b886" stroke="#0b7a5c" stroke-width="5"/>
<g transform="rotate(-12 36 62)"><rect x="12" y="30" width="48" height="66" rx="9" fill="#fffaf0" stroke="#4a3426" stroke-width="4"/><text x="21" y="52" font-size="18" font-weight="900" fill="#e03131" font-family="Arial,sans-serif">A</text><path d="M36 90C26 82 24 76 28 72C31 69 35 71 36 74C37 71 41 69 44 72C48 76 46 82 36 90Z" fill="#fa5252" stroke="#4a3426" stroke-width="3" stroke-linejoin="round"/></g>
<g transform="rotate(10 82 62)"><rect x="58" y="28" width="48" height="66" rx="9" fill="#fffaf0" stroke="#4a3426" stroke-width="4"/><text x="67" y="50" font-size="18" font-weight="900" fill="#364fc7" font-family="Arial,sans-serif">K</text></g>
<g transform="translate(86 78)"><g stroke="#2b1d5c" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M-8 -3L-19 -10M-9 2L-21 3M-8 7L-18 14M8 -3L19 -10M9 2L21 3M8 7L18 14"/></g><circle r="11" fill="#7048e8" stroke="#2b1d5c" stroke-width="3.5"/><circle cx="-4" cy="-2" r="3.4" fill="#fff"/><circle cx="4" cy="-2" r="3.4" fill="#fff"/><circle cx="-3.6" cy="-1.6" r="1.6" fill="#111"/><circle cx="4.4" cy="-1.6" r="1.6" fill="#111"/><path d="M-4 4Q0 8 4 4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/></g>
</svg>`;

const SUIT_FILL = ["#4c6ef5", "#fa5252", "#40c057", "#ff922b"];
const OUTLINE = "#4a3426";
const SHAPE = [
  `<path d="M20 2.5C9 14 3 19 6.5 27C10 33 17 31 19 27C19 32 17 35 13 37.5H27C23 35 21 32 21 27C23 31 30 33 33.5 27C37 19 31 14 20 2.5Z"/>`,
  `<path d="M20 35C6 25 2 15 8 9.5C13 5.5 18.5 8 20 13C21.5 8 27 5.5 32 9.5C38 15 34 25 20 35Z"/>`,
  `<g><circle cx="20" cy="11.5" r="8.5"/><circle cx="10.5" cy="23" r="8.5"/><circle cx="29.5" cy="23" r="8.5"/><path d="M16 38Q19 30 19 24L21 24Q21 30 24 38Z"/></g>`,
  `<path d="M20 2.5L36 20L20 37.5L4 20Z"/>`,
];
// where the little face sits on each shape
const FACE_Y = [20, 18.5, 19.5, 20];
const face = (y: number) => `<g><circle cx="15" cy="${y}" r="3.1" fill="#fff" stroke="${OUTLINE}" stroke-width="1"/><circle cx="25" cy="${y}" r="3.1" fill="#fff" stroke="${OUTLINE}" stroke-width="1"/><circle cx="15.5" cy="${y + .3}" r="1.5" fill="#222"/><circle cx="25.5" cy="${y + .3}" r="1.5" fill="#222"/><circle cx="11" cy="${y + 5}" r="2.2" fill="#ff8787" opacity=".7"/><circle cx="29" cy="${y + 5}" r="2.2" fill="#ff8787" opacity=".7"/><path d="M16.5 ${y + 5}Q20 ${y + 9} 23.5 ${y + 5}" fill="none" stroke="${OUTLINE}" stroke-width="1.8" stroke-linecap="round"/></g>`;
const DEFS = `<svg class="spider-defs" aria-hidden="true" width="0" height="0"><defs>${[0, 1, 2, 3].map((s) => {
  const shape = `<g fill="${SUIT_FILL[s]}" stroke="${OUTLINE}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">${SHAPE[s]}</g>`;
  return `<symbol id="spider-sm${s}" viewBox="0 0 40 40">${shape}</symbol><symbol id="spider-bg${s}" viewBox="0 0 40 40">${shape}${face(FACE_Y[s])}</symbol>`;
}).join("")}<symbol id="spider-spb" viewBox="0 0 40 40"><g stroke="#fff3bf" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M10 15L3 9M9 21L2 21M10 27L3 33M30 15L37 9M31 21L38 21M30 27L37 33"/></g><circle cx="20" cy="21" r="11" fill="#fff3bf" stroke="#4a3426" stroke-width="2.4"/><circle cx="15.5" cy="19" r="3.3" fill="#fff" stroke="#4a3426" stroke-width="1.2"/><circle cx="24.5" cy="19" r="3.3" fill="#fff" stroke="#4a3426" stroke-width="1.2"/><circle cx="16" cy="19.4" r="1.6" fill="#222"/><circle cx="25" cy="19.4" r="1.6" fill="#222"/><path d="M15 25Q20 30 25 25" fill="none" stroke="#4a3426" stroke-width="2" stroke-linecap="round"/></symbol></defs></svg>`;
const RANKS = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const LEVELS: [L.Suits, string][] = [[1, "一种花色"], [2, "两种花色"], [4, "四种花色"]];
const levelName = (n: number) => (LEVELS.find((l) => l[0] === n) ?? LEVELS[0])[1];

const DANCER = `<svg class="spider-dancer" viewBox="0 0 120 100"><g class="sp-all"><g stroke="#2b1d5c" stroke-width="5" stroke-linecap="round" fill="none"><path class="lg" d="M44 56L22 40L10 20"/><path class="lg" d="M42 62L16 62L6 48"/><path class="lg" d="M44 70L22 84L12 94"/><path class="lg" d="M48 76L36 92L32 98"/><path class="lr" d="M76 56L98 40L110 20"/><path class="lr" d="M78 62L104 62L114 48"/><path class="lr" d="M76 70L98 84L108 94"/><path class="lr" d="M72 76L84 92L88 98"/></g><circle cx="60" cy="62" r="24" fill="#7048e8" stroke="#2b1d5c" stroke-width="5"/><path d="M42 42L60 14L78 42Z" fill="#ffd43b" stroke="#2b1d5c" stroke-width="4" stroke-linejoin="round"/><circle cx="60" cy="14" r="4.5" fill="#ff6b6b" stroke="#2b1d5c" stroke-width="2.5"/><circle cx="50" cy="58" r="7.5" fill="#fff"/><circle cx="70" cy="58" r="7.5" fill="#fff"/><circle cx="51.5" cy="59" r="3.6" fill="#111"/><circle cx="71.5" cy="59" r="3.6" fill="#111"/><circle cx="41" cy="70" r="4.5" fill="#ff8787" opacity=".75"/><circle cx="79" cy="70" r="4.5" fill="#ff8787" opacity=".75"/><path d="M50 71Q60 82 70 71Z" fill="#c2255c" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></g></svg>`;

interface Pt { x: number; y: number }
interface Saved { suits: L.Suits; f: number[]; cols: number[][]; stock: number[][]; found: number[]; moves: number; score: number; hist: L.Snap[] }
interface Opts { instant?: boolean; spawn?: (id: number) => Pt | undefined; fly?: Map<number, Pt>; delay?: (id: number) => number }
const SAVE_HIST = 600;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let disposed = false;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); if (!disposed) fn(); }, ms); timers.add(t); return t; };
  const reduce = () => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };

  /* ---------- state ---------- */
  const lastLevel = ctx.store.get<number>("level", 1);
  let st: L.State = L.newGame(1);
  let sel: { col: number; idx: number } | null = null;
  let finished = false;
  const best = (n: number) => ctx.store.get<Record<string, number>>("best", {})[String(n)] ?? 0;

  const loadSaved = (): L.State | null => {
    const v = ctx.store.get<Saved | null>("save", null);
    if (!v || !Array.isArray(v.cols) || !Array.isArray(v.stock) || !Array.isArray(v.f)) return null;
    const s: L.State = { suits: v.suits, f: v.f, cols: v.cols, stock: v.stock, found: v.found ?? [], moves: v.moves | 0, score: v.score | 0, hist: Array.isArray(v.hist) ? v.hist : [] };
    return ([1, 2, 4] as number[]).includes(s.suits) && s.cols.length === L.COLS && L.audit(s) === null && !L.won(s) ? s : null;
  };
  const save = () => {
    if (L.won(st)) { ctx.store.set("save", null); return; }
    const v: Saved = { suits: st.suits, f: st.f, cols: st.cols, stock: st.stock, found: st.found, moves: st.moves, score: st.score, hist: st.hist.slice(-SAVE_HIST) };
    ctx.store.set("save", v);
  };

  /* ---------- DOM skeleton ---------- */
  const el = {
    stats: h("div", { class: "spider-stats", id: "spider-stats" }),
    undo: h("button", { id: "spider-undo", onclick: () => doUndo() }, "撤销") as HTMLButtonElement,
    hint: h("button", { id: "spider-hint", onclick: () => doHint() }, "提示"),
    neu: h("button", { id: "spider-new", class: "primary", onclick: () => showLevels(true) }, "新游戏"),
    board: h("div", { class: "spider-board", id: "spider-board" }),
  };
  const holder = h("div", { class: "spider-root" },
    h("div", { class: "spider-top" }, el.stats, h("div", { class: "spider-btns" }, el.undo, el.hint, el.neu)), el.board);
  root.append(holder);
  const defs = h("div", {}); defs.innerHTML = DEFS; el.board.append(defs.firstElementChild as Element);
  const trayLayer = h("div", {}); el.board.append(trayLayer);   // foundation + stock (rebuilt)
  const stockHost = { node: null as HTMLElement | null };
  let ov: HTMLElement | null = null;

  /* ---------- metrics ---------- */
  const M = { W: 0, H: 0, cw: 30, ch: 42, gap: 2, x0: 0, trayY: 4, ts: 1, tw: 30, th: 42, colsTop: 50, colsH: 200 };
  const measure = () => {
    const r = el.board.getBoundingClientRect();
    const W = Math.max(200, r.width), H = Math.max(120, r.height);
    const pad = W < 420 ? 3 : 8, gap = W < 420 ? 2 : Math.max(4, Math.min(10, Math.round(W * 0.011)));
    let cw = Math.min(96, Math.floor((W - 2 * pad - 9 * gap) / 10));
    let ch = Math.round(cw * 1.42);
    const ts = H < 330 ? 0.62 : 1;
    // the tallest sensible height: three cards of room under the tray at least
    const room = (c: number) => H - Math.round(c * ts) - 14 - c;
    while (ch > 30 && room(ch) < ch * 2.4) { ch--; cw = Math.floor(ch / 1.42); }
    M.W = W; M.H = H; M.cw = cw; M.ch = ch; M.gap = gap; M.ts = ts; M.tw = Math.round(cw * ts); M.th = Math.round(ch * ts);
    M.x0 = Math.round((W - (10 * cw + 9 * gap)) / 2);
    M.trayY = 5; M.colsTop = M.trayY + M.th + 8; M.colsH = H - M.colsTop - 3;
    el.board.style.setProperty("--cw", cw + "px"); el.board.style.setProperty("--ch", ch + "px");
  };
  const colX = (i: number) => M.x0 + i * (M.cw + M.gap);
  const stockPos = (): Pt => ({ x: colX(9) + M.cw - M.tw, y: M.trayY });
  const slotPos = (i: number): Pt => ({ x: colX(i), y: M.trayY });
  const offsets = (col: number): number[] => {
    const c = st.cols[col], uo = M.ch * 0.3, dO = M.ch * 0.11;
    let total = 0;
    for (let i = 0; i < c.length - 1; i++) total += L.isUp(c[i]) ? uo : dO;
    const avail = M.colsH - M.ch - 2, scale = total > avail ? Math.max(avail / total, 0.12) : 1;
    const ys: number[] = []; let y = 0;
    for (let i = 0; i < c.length; i++) { ys.push(y); y += (L.isUp(c[i]) ? uo : dO) * scale; }
    return ys;
  };
  const colAt = (x: number) => Math.max(0, Math.min(9, Math.floor((x - M.x0 + M.gap / 2) / (M.cw + M.gap))));

  /* ---------- cards ---------- */
  const els = new Map<number, HTMLElement>();
  const posOf = new Map<number, Pt>();
  const cardEl = (suit: number, rank: number, down: boolean) => {
    const e = h("div", { class: "spider-card" + (down ? " down" : "") });
    const inner = h("div", { class: "spider-in" });
    inner.innerHTML = `<div class="spider-front s${suit}"><div class="spider-idx"><b>${RANKS[rank]}</b><svg class="spider-mini" viewBox="0 0 40 40"><use href="#spider-sm${suit}"/></svg></div><svg class="spider-big" viewBox="0 0 40 40"><use href="#spider-bg${suit}"/></svg></div><div class="spider-back"><svg viewBox="0 0 40 40"><use href="#spider-spb"/></svg></div>`;
    e.append(inner);
    return e;
  };
  const place = (e: HTMLElement, p: Pt) => { e.style.transform = `translate(${p.x}px,${p.y}px)`; };
  const size = (e: HTMLElement) => { e.style.width = M.cw + "px"; e.style.height = M.ch + "px"; };
  const noTrans = (e: HTMLElement, on: boolean) => { e.classList.toggle("nt", on); };

  function render(o: Opts = {}) {
    const live = new Set<number>();
    const instant = !!o.instant || reduce();
    const touched: HTMLElement[] = [];
    const fresh = (id: number): HTMLElement => {
      const f = st.f[id];
      const e = cardEl(f >> 4, f & 15, true);
      e.dataset.id = String(id);
      size(e); noTrans(e, true); el.board.append(e); els.set(id, e);
      return e;
    };
    for (let col = 0; col < L.COLS; col++) {
      const ys = offsets(col);
      st.cols[col].forEach((c, idx) => {
        const id = L.idOf(c); live.add(id);
        let e = els.get(id);
        const isNew = !e;
        if (!e) e = fresh(id);
        const target: Pt = { x: colX(col), y: M.colsTop + ys[idx] };
        posOf.set(id, target);
        const wasDown = e.classList.contains("down");
        e.classList.toggle("down", !L.isUp(c));
        if (!isNew && wasDown && L.isUp(c) && !instant) { const inn = e.firstElementChild as HTMLElement; inn.classList.remove("flip"); void inn.offsetWidth; inn.classList.add("flip"); later(() => inn.classList.remove("flip"), 400); }
        e.dataset.col = String(col); e.dataset.idx = String(idx); e.dataset.up = L.isUp(c) ? "1" : "0";
        size(e);
        e.style.zIndex = String(idx + 1);
        e.classList.remove("flying", "dragging");
        if (isNew) {
          const sp = !instant ? o.spawn?.(id) : undefined;
          place(e, sp ?? target); noTrans(e, true); touched.push(e);
          void e.offsetWidth;
          if (sp) { e.style.transitionDelay = (o.delay?.(id) ?? 0) + "ms"; noTrans(e, false); place(e, target); later(() => { e!.style.transitionDelay = ""; }, 900); }
        } else if (instant) { noTrans(e, true); touched.push(e); place(e, target); }
        else { noTrans(e, false); e.style.transitionDelay = (o.delay?.(id) ?? 0) + "ms"; place(e, target); const ee = e; if (o.delay) later(() => { ee.style.transitionDelay = ""; }, 900); }
      });
    }
    // cards that left the columns: they fly (to the foundation / back to the stock) and go away
    const gone = [...els.keys()].filter((id) => !live.has(id));
    const flyIds = new Set([...(o.fly?.keys() ?? []), ...gone]);
    for (const id of flyIds) {
      if (live.has(id)) continue;
      let e = els.get(id);
      const target = o.fly?.get(id);
      if (!e) {
        if (!target || instant) continue;
        const sp = o.spawn?.(id); if (!sp) continue;
        e = fresh(id); e.classList.remove("down"); place(e, sp); void e.offsetWidth;
      }
      els.delete(id);
      if (!target || instant) { e.remove(); continue; }
      const ee = e;
      ee.style.zIndex = String(3000 + (o.delay?.(id) ?? 0)); noTrans(ee, true); void ee.offsetWidth; noTrans(ee, false);
      ee.classList.add("flying"); ee.style.transitionDelay = (o.delay?.(id) ?? 0) + "ms";
      place(ee, target);
      later(() => ee.remove(), 1200);
    }
    if (touched.length) { void el.board.offsetWidth; touched.forEach((e) => noTrans(e, false)); }
    refreshSel();
    drawSlots();
  }

  /* the dashed outlines of empty columns (also the hint target) */
  let slots: HTMLElement[] = [];
  function drawSlots() {
    if (!slots.length) for (let i = 0; i < L.COLS; i++) { const s = h("div", { class: "spider-slot", "data-col": i }); el.board.prepend(s); slots.push(s); }
    slots.forEach((s, i) => {
      s.style.display = st.cols[i].length ? "none" : "";
      s.style.width = M.cw + "px"; s.style.height = M.ch + "px"; s.style.left = colX(i) + "px"; s.style.top = M.colsTop + "px";
    });
  }

  /* ---------- tray: foundation + stock ---------- */
  let shownFound = 0;
  function drawTray(animateNew = false) {
    trayLayer.replaceChildren();
    for (let i = 0; i < L.RUNS; i++) {
      const p = slotPos(i);
      const slot = h("div", { class: "spider-fslot", "data-slot": i });
      slot.style.cssText = `left:${p.x}px;top:${p.y}px;width:${M.tw}px;height:${M.th}px`;
      if (i < st.found.length) {
        const c = cardEl(st.found[i], 13, false); c.classList.add("spider-static");
        c.style.cssText = `width:${M.cw}px;height:${M.ch}px;transform:scale(${M.ts});left:-2px;top:-2px`;
        slot.append(c);
        if (animateNew && i >= shownFound && !reduce()) slot.classList.add("pop");
      }
      trayLayer.append(slot);
    }
    shownFound = st.found.length;
    const sp = stockPos();
    const n = st.stock.length;
    const stock = h("button", { class: "spider-stock" + (n ? "" : " empty"), id: "spider-stock", "aria-label": "发牌", onclick: () => doDeal() });
    stock.style.cssText = `left:${sp.x}px;top:${sp.y}px;width:${M.tw}px;height:${M.th}px`;
    for (let i = 0; i < Math.min(n, 5); i++) {
      const c = cardEl(0, 1, true); c.classList.add("spider-static");
      c.style.cssText = `width:${M.cw}px;height:${M.ch}px;transform:scale(${M.ts});transform-origin:0 0;left:${-(Math.min(n, 5) - 1 - i) * 2.5 * M.ts}px;top:0`;
      stock.append(c);
    }
    if (n) stock.append(h("span", { class: "spider-badge", id: "spider-stock-n" }, String(n)));
    trayLayer.append(stock);
    stockHost.node = stock;
  }

  /* ---------- HUD ---------- */
  function hud() {
    el.stats.replaceChildren(
      h("span", { class: "spider-lv", id: "spider-level" }, levelName(st.suits)),
      h("span", { id: "spider-score" }, `得分：${st.score}`),
      h("span", { id: "spider-moves" }, `步数：${st.moves}`),
      h("span", { id: "spider-best" }, `最高分：${best(st.suits)}`),
      h("span", { id: "spider-runs" }, `收齐：${st.found.length} / ${L.RUNS}`),
    );
    el.undo.disabled = st.hist.length === 0 || finished;
  }

  /* ---------- selection / hint ---------- */
  function refreshSel() {
    for (const [id, e] of els) { const col = +(e.dataset.col ?? -1), idx = +(e.dataset.idx ?? -1); e.classList.toggle("sel", !!sel && sel.col === col && idx >= sel.idx && e.dataset.up === "1" && !e.classList.contains("flying")); void id; }
  }
  const select = (s: { col: number; idx: number } | null) => { sel = s; refreshSel(); };
  let hintTimer = 0;
  function clearHint() {
    window.clearTimeout(hintTimer); timers.delete(hintTimer);
    el.board.querySelectorAll(".hint").forEach((n) => n.classList.remove("hint"));
  }
  const runEls = (col: number, idx: number) => [...els.values()].filter((e) => +(e.dataset.col ?? -1) === col && +(e.dataset.idx ?? -1) >= idx);
  function shake(col: number, idx: number) {
    const list = runEls(col, idx);
    list.forEach((e) => { const i = e.firstElementChild as HTMLElement; e.classList.remove("shake"); void i.offsetWidth; e.classList.add("shake"); });
    later(() => list.forEach((e) => e.classList.remove("shake")), 450);
  }

  /* ---------- effects ---------- */
  function sparks(p: Pt) {
    if (reduce()) return;
    const cx = p.x + M.tw / 2, cy = p.y + M.th / 2;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + Math.random() * 0.3, d = 28 + Math.random() * 42;
      const s = h("div", { class: "spider-spark" + (i % 3 === 1 ? " b" : i % 3 === 2 ? " c" : "") });
      s.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
      el.board.append(s); later(() => s.remove(), 850);
    }
  }

  /* ---------- after any change ---------- */
  function afterOp(res: L.MoveResult, o: Opts = {}) {
    clearHint(); sel = null;
    const fly = new Map<number, Pt>(o.fly ?? []);
    const k0 = st.found.length - res.completed.length;
    res.completed.forEach((c, j) => c.ids.forEach((id, i) => { fly.set(id, slotPos(k0 + j)); }));
    const baseDelay = o.delay;
    const delay = (id: number) => (baseDelay ? baseDelay(id) : 0);
    const flyDelay = new Map<number, number>();
    res.completed.forEach((c) => c.ids.forEach((id, i) => flyDelay.set(id, i * 28)));
    render({ ...o, fly, delay: (id) => flyDelay.get(id) ?? delay(id) });
    drawTray(true);
    hud(); save();
    if (res.completed.length) {
      ctx.sfx("good");
      res.completed.forEach((_, j) => later(() => sparks(slotPos(k0 + j)), 520));
    }
    checkWin();
  }

  function doMove(from: number, idx: number, to: number): boolean {
    const res = L.move(st, from, idx, to);
    if (!res.ok) return false;
    if (!res.completed.length) ctx.sfx(res.flipped ? "place" : "move");
    afterOp(res);
    return true;
  }
  function doDeal() {
    if (finished || ov) return;
    clearHint();
    if (!st.stock.length) { ctx.toast("没有牌可以发了。"); ctx.sfx("bad"); return; }
    if (!L.canDeal(st)) { ctx.toast("有空列的时候不能发牌：先把牌放进空列。"); ctx.sfx("bad"); const s = slots.filter((q) => q.style.display !== "none"); s.forEach((q) => q.classList.add("hint")); later(() => s.forEach((q) => q.classList.remove("hint")), 1600); return; }
    const d = st.stock[st.stock.length - 1].slice();
    const dealt = new Map(d.map((c, i) => [L.idOf(c), i]));
    ctx.sfx("drop");
    const res = L.deal(st);
    afterOp(res, { spawn: (id) => (dealt.has(id) ? stockPos() : undefined), delay: (id) => (dealt.has(id) ? (dealt.get(id) as number) * 60 : 0) });
  }
  function doUndo() {
    if (finished || ov) return;
    if (!st.hist.length) { ctx.toast("没有可以撤销的步骤。"); return; }
    clearHint(); sel = null;
    const before = st.found.length, liveBefore = new Set(els.keys());
    L.undo(st);
    ctx.sfx("tap");
    const fly = new Map<number, Pt>();
    for (const id of liveBefore) if (!st.cols.some((c) => c.some((x) => L.idOf(x) === id))) fly.set(id, stockPos());
    const back = slotPos(Math.max(0, st.found.length));
    render({ spawn: (id) => (st.found.length < before ? back : undefined), fly });
    drawTray(false); hud(); save();
  }
  function doHint() {
    if (finished || ov) return;
    clearHint(); select(null);
    const s = L.suggest(st);
    ctx.sfx("tap");
    if (!s) { ctx.toast("没有可走的步了：试试撤销，或者开始新游戏。"); return; }
    if (s.kind === "deal") { stockHost.node?.classList.add("hint"); }
    else {
      const m = s.hint;
      runEls(m.from, m.idx).forEach((e) => e.classList.add("hint"));
      if (st.cols[m.to].length) { const top = els.get(L.idOf(st.cols[m.to][st.cols[m.to].length - 1])); top?.classList.add("hint"); }
      else slots[m.to]?.classList.add("hint");
    }
    hintTimer = later(clearHint, 2400);
  }

  /* ---------- tap logic ---------- */
  function tap(col: number, idx: number | null) {
    clearHint();
    if (sel) {
      if (idx !== null && sel.col === col && sel.idx === idx) {   // the same card again: the best place for it
        const to = L.bestTarget(st, col, idx);
        if (to === null) { ctx.sfx("bad"); shake(col, idx); select(null); return; }
        select(null); doMove(col, idx, to); return;
      }
      if (col !== sel.col && L.canDrop(st, sel.col, sel.idx, col)) { const s = sel; select(null); doMove(s.col, s.idx, col); return; }
      if (idx !== null && L.pickable(st, col, idx)) { ctx.sfx("tap"); select({ col, idx }); return; }
      ctx.sfx("bad"); shake(sel.col, sel.idx); select(null); return;
    }
    if (idx !== null && L.pickable(st, col, idx)) { ctx.sfx("tap"); select({ col, idx }); }
  }

  /* ---------- pointer: drag and tap ---------- */
  interface Pd { pid: number; x0: number; y0: number; col: number; idx: number | null; can: boolean; drag: boolean; run: HTMLElement[]; base: Pt[]; grab: number }
  let pd: Pd | null = null;
  const onDown = (e: PointerEvent) => {
    if (ov || finished) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest(".spider-stock") || t.closest(".spider-fslot")) return;
    const c = t.closest(".spider-card") as HTMLElement | null;
    const isCol = !!c && c.dataset.col !== undefined && !c.classList.contains("spider-static");
    const col = isCol ? +(c as HTMLElement).dataset.col! : colAt(e.clientX - el.board.getBoundingClientRect().left);
    const idx = isCol ? +(c as HTMLElement).dataset.idx! : null;
    pd = { pid: e.pointerId, x0: e.clientX, y0: e.clientY, col, idx, can: idx !== null && L.pickable(st, col, idx), drag: false, run: [], base: [], grab: 0 };
    try { el.board.setPointerCapture(e.pointerId); } catch { /* fine */ }
  };
  const onMove = (e: PointerEvent) => {
    if (!pd || e.pointerId !== pd.pid) return;
    const dx = e.clientX - pd.x0, dy = e.clientY - pd.y0;
    if (!pd.drag) {
      if (!pd.can || Math.hypot(dx, dy) < 7) return;
      pd.drag = true; clearHint(); select(null);
      pd.run = runEls(pd.col, pd.idx as number).sort((a, b) => +(a.dataset.idx as string) - +(b.dataset.idx as string));
      pd.base = pd.run.map((r) => posOf.get(+(r.dataset.id as string)) as Pt);
      pd.run.forEach((r, i) => { noTrans(r, true); r.classList.add("dragging"); r.style.transitionDelay = ""; r.style.zIndex = String(3000 + i); });
      ctx.sfx("tap");
    }
    pd.run.forEach((r, i) => place(r, { x: pd!.base[i].x + dx, y: pd!.base[i].y + dy }));
  };
  const onUp = (e: PointerEvent) => {
    if (!pd || e.pointerId !== pd.pid) return;
    const d = pd; pd = null;
    try { el.board.releasePointerCapture(e.pointerId); } catch { /* fine */ }
    if (d.drag) {
      const dx = e.clientX - d.x0;
      const cx = d.base[0].x + dx + M.cw / 2;
      const to = colAt(cx);
      d.run.forEach((r) => { r.classList.remove("dragging"); noTrans(r, false); });
      if (to !== d.col && L.canDrop(st, d.col, d.idx as number, to)) { doMove(d.col, d.idx as number, to); return; }
      // back to where it was
      d.run.forEach((r, i) => { place(r, d.base[i]); r.style.zIndex = String((+(r.dataset.idx as string)) + 1); });
      if (to !== d.col) { ctx.sfx("bad"); shake(d.col, d.idx as number); }
      return;
    }
    if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 12) tap(d.col, d.idx);
  };
  const onCancel = (e: PointerEvent) => {
    if (!pd || e.pointerId !== pd.pid) return;
    const d = pd; pd = null;
    if (d.drag) { d.run.forEach((r, i) => { r.classList.remove("dragging"); noTrans(r, false); place(r, d.base[i]); r.style.zIndex = String((+(r.dataset.idx as string)) + 1); }); }
  };
  el.board.addEventListener("pointerdown", onDown);
  el.board.addEventListener("pointermove", onMove);
  el.board.addEventListener("pointerup", onUp);
  el.board.addEventListener("pointercancel", onCancel);

  /* ---------- dialogs ---------- */
  function closeOv() { ov?.remove(); ov = null; }
  function showLevels(cancelable: boolean) {
    closeOv(); clearHint(); select(null);
    const inProgress = cancelable && !finished && st.moves > 0;
    const choices = h("div", { class: "spider-choices" });
    for (const [n, name] of LEVELS) choices.append(h("button", { id: `spider-lv${n}`, class: n === st.suits ? "on" : "", onclick: () => { ctx.sfx("tap"); startNew(n); } }, name));
    if (cancelable) choices.append(h("button", { id: "spider-cancel", onclick: () => closeOv() }, inProgress ? "继续当前这局" : "返回"));
    ov = h("div", { class: "spider-ov", id: "spider-levels" }, h("div", { class: "spider-dlg" }, h("h2", {}, "选择难度"), h("p", {}, "花色越多，越难"), choices));
    el.board.append(ov);
  }
  function startNew(n: L.Suits, rng?: () => number) {
    closeOv(); finished = false; sel = null; clearHint();
    st = L.newGame(n, rng);
    ctx.store.set("level", n);
    resetBoard();
    // the cards fly out of the stock, column by column
    const ids = new Map<number, number>();
    st.cols.forEach((c, ci) => c.forEach((x, ri) => ids.set(L.idOf(x), ri * 10 + ci * 3)));
    drawTray(false);
    render({ spawn: () => stockPos(), delay: (id) => (ids.get(id) ?? 0) * 3 });
    hud(); save(); ctx.sfx("swap");
  }
  function resetBoard() { for (const e of els.values()) e.remove(); els.clear(); posOf.clear(); shownFound = 0; }

  function checkWin() {
    if (!L.won(st) || finished) return;
    finished = true; hud();
    const lv = st.suits, bests = ctx.store.get<Record<string, number>>("best", {});
    const record = st.score > (bests[String(lv)] ?? 0);
    if (record) { bests[String(lv)] = st.score; ctx.store.set("best", bests); }
    ctx.store.set("save", null);
    const wins = ctx.store.get<Record<string, number>>("wins", {}); wins[String(lv)] = (wins[String(lv)] ?? 0) + 1; ctx.store.set("wins", wins);
    hud();
    later(() => {
      if (disposed) return;
      ctx.sfx("win");
      const dlg = h("div", { class: "spider-dlg" });
      const sp = h("div", {}); sp.innerHTML = DANCER;
      dlg.append(sp.firstElementChild as Element, h("h2", {}, "太棒了，你赢了！"), h("p", {}, `得分：${st.score}`), h("p", {}, `步数：${st.moves}`));
      if (record) dlg.append(h("p", { class: "spider-record", id: "spider-record" }, "新纪录！"));
      dlg.append(h("div", { class: "spider-choices" }, h("button", { class: "primary", id: "spider-again", onclick: () => startNew(st.suits) }, "再来一局"), h("button", { id: "spider-change", onclick: () => showLevels(false) }, "换个难度")));
      closeOv();
      ov = h("div", { class: "spider-ov", id: "spider-win" });
      if (!reduce()) {
        const cols = ["#ff6b6b", "#ffd43b", "#51cf66", "#4dabf7", "#da77f2", "#ff922b"];
        for (let i = 0; i < 70; i++) {
          const c = h("div", { class: "spider-conf" });
          c.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};--h:${el.board.clientHeight + 40}px;--t:${(1.8 + Math.random() * 1.8).toFixed(2)}s;--d:${(-Math.random() * 3).toFixed(2)}s`;
          ov.append(c);
        }
      }
      ov.append(dlg);
      el.board.append(ov);
    }, reduce() ? 0 : 900);
  }

  /* ---------- layout ---------- */
  let layoutTimer = 0;
  function relayout() {
    if (disposed) return;
    measure(); render({ instant: true }); drawTray(false);
  }
  const onResize = () => { window.clearTimeout(layoutTimer); layoutTimer = window.setTimeout(relayout, 30); timers.add(layoutTimer); };
  window.addEventListener("resize", onResize);
  let ro: ResizeObserver | null = null;
  try { ro = new ResizeObserver(() => { const r = el.board.getBoundingClientRect(); if (Math.abs(r.width - M.W) > 1 || Math.abs(r.height - M.H) > 1) onResize(); }); ro.observe(el.board); } catch { /* resize event only */ }

  /* ---------- test hook (also handy for debugging) ---------- */
  const mulberry = (a: number) => () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const hook = {
    get state() { return st; },
    metrics: () => ({ ...M }),
    newGame: (n: L.Suits, seed?: number) => startNew(n, seed === undefined ? undefined : mulberry(seed)),
    /** replace the whole game by a state (a nearly won one for the win screen) */
    load: (s: L.State) => { closeOv(); finished = false; sel = null; clearHint(); st = s; resetBoard(); measure(); render({ instant: true }); drawTray(false); hud(); save(); },
    pos: (id: number) => posOf.get(id),
    get selected() { return sel; },
  };
  (window as unknown as { __spider?: typeof hook }).__spider = hook;

  /* ---------- go ---------- */
  measure();
  const saved = loadSaved();
  if (saved) { st = saved; finished = false; render({ instant: true }); drawTray(false); hud(); }
  else startNew((([1, 2, 4] as number[]).includes(lastLevel) ? lastLevel : 1) as L.Suits);
  // the board may not have its final size yet when the module is mounted
  later(relayout, 60); later(relayout, 400);

  return () => {
    disposed = true;
    timers.forEach((t) => window.clearTimeout(t)); timers.clear();
    window.removeEventListener("resize", onResize);
    ro?.disconnect();
    el.board.removeEventListener("pointerdown", onDown); el.board.removeEventListener("pointermove", onMove);
    el.board.removeEventListener("pointerup", onUp); el.board.removeEventListener("pointercancel", onCancel);
    if ((window as unknown as { __spider?: unknown }).__spider === hook) delete (window as unknown as { __spider?: unknown }).__spider;
  };
}
