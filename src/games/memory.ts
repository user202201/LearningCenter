import type { GameCtx } from "./ctx";
import "./memory.css";
import { ANIMAL_ART } from "./memory-art";
import { SIZES, MISS_MS, deal, flip, resolve, stars, fmtTime, type MemState } from "./memory-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><g transform="rotate(-9 42 62)"><rect x="14" y="30" width="54" height="64" rx="12" fill="#fff" stroke="#96f2d7" stroke-width="4"/><svg x="19" y="38" width="44" height="44" viewBox="0 0 64 64"><circle cx="32" cy="36" r="22" fill="#ffe066"/><circle cx="23" cy="32" r="3.2" fill="#2d2230"/><circle cx="41" cy="32" r="3.2" fill="#2d2230"/><path d="M27 38h10l-5 6z" fill="#ff8a3d"/><circle cx="19" cy="42" r="3.4" fill="#ff9aa8" opacity=".6"/><circle cx="45" cy="42" r="3.4" fill="#ff9aa8" opacity=".6"/></svg></g><g transform="rotate(10 78 62)"><rect x="54" y="28" width="52" height="64" rx="12" fill="#12b886" stroke="#0ca678" stroke-width="4"/><circle cx="80" cy="60" r="14" fill="#38d9a9" stroke="#96f2d7" stroke-width="4"/><circle cx="75" cy="55" r="3.500" fill="#fff"/></g><path d="M92 20l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#ffd43b"/></svg>`;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let sizeIdx = Math.max(0, Math.min(SIZES.length - 1, ctx.store.get<number>("size", 0)));
  const bestKey = () => `best-${SIZES[sizeIdx].id}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);

  const movesEl = h("span", { class: "mem-stat", id: "mem-moves" }, "");
  const timeEl = h("span", { class: "mem-stat", id: "mem-time" }, "");
  const bestEl = h("span", { class: "mem-stat best", id: "mem-best" }, "");
  const sizeBtns = SIZES.map((z, i) => h("button", { class: "mopt", id: `mem-size-${z.id}`, onclick: () => { sizeIdx = i; ctx.store.set("size", i); ctx.sfx("tap"); reset(); } }, `${z.rows}×${z.cols}`));
  const newBtn = h("button", { class: "mopt", id: "mem-new", onclick: () => { ctx.sfx("tap"); reset(); } }, "重新开始");
  const hud = h("div", { class: "mem-hud" }, movesEl, timeEl, bestEl, ...sizeBtns, newBtn);

  const grid = h("div", { class: "mem-grid", id: "mem-grid", role: "grid" });
  const title = h("h2", {}, ""), starsEl = h("div", { class: "mem-stars", id: "mem-stars" }, ""), msg = h("p", {}, "");
  const go = h("button", { class: "primary", id: "mem-start", onclick: () => { ctx.sfx("tap"); if (phase === "won") reset(); else begin(); } }, "开始");
  const ovl = h("div", { class: "mem-ovl", id: "mem-ovl" }, title, starsEl, msg, go);
  const field = h("div", { class: "mem-field", id: "mem-field" }, grid, ovl);
  const board = h("div", { class: "mem-board" }, field);
  root.append(h("div", { class: "mem-wrap" }, hud, board));

  type Phase = "ready" | "play" | "won";
  let s!: MemState, phase: Phase = "ready";
  let cards: HTMLElement[] = [];
  let sec = 0, timer = 0, missTimer = 0, cur = 0, cols = 4, rows = 3, cell = 0, winShown = 0;
  const timers: number[] = [];

  const setOvl = (t: string, m: string, b: string, st: number | null) => {
    title.textContent = t; msg.textContent = m; go.textContent = b; ovl.hidden = false;
    starsEl.hidden = st === null;
    if (st !== null) starsEl.replaceChildren(...[1, 2, 3].map((i) => h("span", { class: i <= st ? "" : "off" }, "★")));
  };
  const refreshHud = () => {
    movesEl.textContent = `步数：${s.moves}`; timeEl.textContent = `用时：${fmtTime(sec)}`;
    const b = best(); bestEl.textContent = b ? `最少：${b}` : "最少：-";
    sizeBtns.forEach((b2, i) => b2.classList.toggle("on", i === sizeIdx));
  };
  const paint = () => {
    cards.forEach((c, i) => {
      c.classList.toggle("up", s.up[i] && !s.matched[i]); c.classList.toggle("done", s.matched[i]);
      c.setAttribute("aria-label", s.up[i] ? ANIMAL_ART[s.cards[i]].name : "?");
      c.dataset.state = s.matched[i] ? "done" : s.up[i] ? "up" : "down";
      c.classList.toggle("cur", i === cur && phase !== "ready" && lastKey);
    });
  };
  let lastKey = false;

  function build() {
    grid.replaceChildren();
    cards = s.cards.map((a, i) => {
      const c = h("button", { class: "mem-card", "data-i": String(i), "data-animal": ANIMAL_ART[a].name, onclick: () => { lastKey = false; tap(i); } },
        h("div", { class: "mem-in" }, h("div", { class: "mem-face mem-back" }), h("div", { class: "mem-face mem-front", innerHTML: `<svg viewBox="0 0 64 64" aria-hidden="true">${ANIMAL_ART[a].art}</svg>` }))) as HTMLElement;
      grid.append(c); return c;
    });
  }
  function reset() {
    clearInterval(timer); clearTimeout(missTimer); missTimer = 0; timer = 0; winShown = 0;
    s = deal(SIZES[sizeIdx]); sec = 0; cur = 0; phase = "ready";
    build(); layout(); paint(); refreshHud();
    setOvl("记忆翻牌", "翻开两张一样的小动物，就能收走它们。", "开始", null);
  }
  function begin() { if (phase !== "ready") return; phase = "play"; ovl.hidden = true; }
  function startClock() { if (!timer) timer = window.setInterval(() => { sec++; refreshHud(); }, 1000); }

  function tap(i: number) {
    if (phase === "won") return;
    if (phase === "ready") begin();
    startClock();
    const r = flip(s, i);
    if (r.kind === "ignored") return;
    if (r.resolved) { clearTimeout(missTimer); missTimer = 0; }
    if (r.kind === "first") ctx.sfx("tap");
    else if (r.kind === "match") { ctx.sfx("good"); }
    else if (r.kind === "miss") {
      ctx.sfx("bad");
      for (const j of s.pending) { cards[j].classList.remove("shake"); void cards[j].offsetWidth; cards[j].classList.add("shake"); }
      missTimer = window.setTimeout(() => { missTimer = 0; resolve(s); paint(); }, MISS_MS);
    }
    paint(); refreshHud();
    if (s.won) win();
  }
  function win() {
    phase = "won"; clearInterval(timer); timer = 0;
    const old = best(), nb = old === 0 || s.moves < old;
    if (nb) ctx.store.set(bestKey(), s.moves);
    ctx.sfx("win"); refreshHud();
    const st = stars(s.moves, s.pairs);
    timers.push(window.setTimeout(() => {
      if (phase !== "won") return;
      setOvl("太棒了！", nb ? `新纪录：${s.moves} 步，用时 ${fmtTime(sec)}` : `${s.moves} 步，用时 ${fmtTime(sec)}`, "再玩一次", st); winShown = 1;
    }, 500));
  }

  // ---- layout: square-ish cards that fill the board; the grid turns to fit a wide or a tall board ----
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight; if (!w || !hh || !s) return;
    const z = s.size, wide = w > hh;
    cols = wide ? z.cols : z.rows; rows = wide ? z.rows : z.cols;
    const gap = Math.max(4, Math.min(10, Math.round(Math.min(w, hh) / 60)));
    const border = 8, availW = w - border - 4, availH = hh - border - 8;
    cell = Math.floor(Math.max(30, Math.min((availW - gap * (cols + 1)) / cols, (availH - gap * (rows + 1)) / rows, 150)));
    const fw = cell * cols + gap * (cols + 1), fh = cell * rows + gap * (rows + 1);
    field.style.width = `${fw}px`; field.style.height = `${fh}px`;
    grid.style.setProperty("--gap", `${gap}px`);
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`; grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
  }
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  // ---- keyboard: arrows move the yellow frame, Enter / Space turns the card ----
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "Enter" || k === " ") {
      if (e.target instanceof HTMLButtonElement && !(e.target as HTMLElement).classList.contains("mem-card")) return;
      e.preventDefault();
      if (phase === "won" && winShown) { reset(); return; }
      if (phase === "ready" && !ovl.hidden) { begin(); return; }
      lastKey = true; tap(cur); paint(); return;
    }
    if (k === "r" || k === "R") { reset(); return; }
    const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!d[k] || phase === "won") return;
    e.preventDefault();
    if (phase === "ready" && !ovl.hidden) begin();
    // the displayed grid has `cols` columns; cards are stored row by row for it
    const x = cur % cols, y = Math.floor(cur / cols);
    const nx = Math.max(0, Math.min(cols - 1, x + d[k][0])), ny = Math.max(0, Math.min(rows - 1, y + d[k][1]));
    cur = ny * cols + nx; lastKey = true; paint();
  };
  document.addEventListener("keydown", onKey);

  reset();
  (window as unknown as Record<string, unknown>).__memory = {
    state: () => s, phase: () => phase, cell: () => cell, cols: () => cols, rows: () => rows, finished: () => winShown, cur: () => cur,
  };
  return () => {
    clearInterval(timer); clearTimeout(missTimer); timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete (window as unknown as Record<string, unknown>).__memory;
  };
}
