import type { GameCtx } from "./ctx";
import "./spotdiff.css";
import { SW, SH, DIFFICULTIES, DIFF_COUNTS, LEVELS_PER_DIFFICULTY, levelInfo, pickLevel, sceneMarkup, newGame, tap, foundCount, won, hintsLeft, hintLit, hint, stars, moveCursor, fmtTime, type Game, type LevelInfo } from "./spotdiff-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><rect x="22" y="18" width="60" height="38" rx="10" fill="#d0ebff" stroke="#0ca678" stroke-width="4"/><rect x="22" y="64" width="60" height="38" rx="10" fill="#d0ebff" stroke="#0ca678" stroke-width="4"/><circle cx="40" cy="37" r="10" fill="#ffd43b"/><circle cx="37" cy="35" r="1.8" fill="#3a2e39"/><circle cx="43" cy="35" r="1.8" fill="#3a2e39"/><path d="M36 40 Q40 44 44 40" fill="none" stroke="#3a2e39" stroke-width="2" stroke-linecap="round"/><circle cx="40" cy="83" r="10" fill="#ff8787"/><circle cx="37" cy="81" r="1.8" fill="#3a2e39"/><circle cx="43" cy="81" r="1.8" fill="#3a2e39"/><path d="M36 86 Q40 90 44 86" fill="none" stroke="#3a2e39" stroke-width="2" stroke-linecap="round"/><circle cx="66" cy="30" r="5" fill="#69db7c"/><circle cx="66" cy="76" r="5" fill="#69db7c"/><circle cx="84" cy="80" r="17" fill="rgba(255,255,255,.55)" stroke="#e8590c" stroke-width="6"/><path d="M96 93 L108 106" stroke="#e8590c" stroke-width="8" stroke-linecap="round"/></svg>`;

type Phase = "ready" | "play" | "won";
const STAR = "50,6 62,36 94,38 69,58 78,90 50,72 22,90 31,58 6,38 38,36";

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let difficulty = Math.max(0, Math.min(2, ctx.store.get<number>("diff", 0)));
  let info!: LevelInfo, g!: Game, phase: Phase = "ready", elapsed = 0, lastTick = 0, raf = 0;
  let cursor = { x: SW / 2, y: SH / 2 }, cursorOn = false, scale = 1, hintIdx = -1, record = false;
  const timers = new Set<number>();
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); };
  const best = () => ctx.store.get<number>(`best-${info.level}`, 0);

  const foundEl = h("span", { class: "sd-stat", id: "sd-found" }, "");
  const missEl = h("span", { class: "sd-stat", id: "sd-miss" }, "");
  const timeEl = h("span", { class: "sd-stat", id: "sd-time" }, "");
  const bestEl = h("span", { class: "sd-stat best", id: "sd-best" }, "");
  const diffBtn = h("button", { class: "mopt", id: "sd-diff", onclick: (e: Event) => { (e.currentTarget as HTMLElement).blur(); difficulty = (difficulty + 1) % 3; ctx.store.set("diff", difficulty); ctx.sfx("tap"); pick(); } }, "");
  const hintBtn = h("button", { class: "mopt", id: "sd-hint", onclick: (e: Event) => { (e.currentTarget as HTMLElement).blur(); ctx.sfx("tap"); useHint(); } }, "");
  const hud = h("div", { class: "sd-hud" }, foundEl, missEl, timeEl, bestEl, hintBtn, diffBtn);

  const mkPic = (side: string) => h("div", { class: "sd-pic", "data-pic": side });
  const picA = mkPic("a"), picB = mkPic("b");
  const title = h("h2", {}, ""), msg = h("p", {}, ""), recEl = h("p", { class: "rec", id: "sd-rec" }, "新纪录！"), starsEl = h("div", { class: "sd-stars", id: "sd-stars" });
  const startBtn = h("button", { class: "primary", id: "sd-start", onclick: (e: Event) => { (e.currentTarget as HTMLElement).blur(); ctx.sfx("tap"); if (phase === "won") nextPicture(); else begin(); } }, "开始");
  const ovl = h("div", { class: "sd-ovl", id: "sd-ovl" }, title, starsEl, msg, recEl, startBtn);
  const field = h("div", { class: "sd-field", id: "sd-field" }, picA, picB, ovl);
  const board = h("div", { class: "sd-board" }, field);
  root.append(h("div", { class: "sd-wrap" }, hud, board));

  const fxOf = (pic: HTMLElement) => pic.querySelector(".sd-fx") as SVGGElement;
  const curOf = (pic: HTMLElement) => pic.querySelector(".sd-cur") as SVGGElement;
  function build() {
    const mk = (diffs: typeof info.diffs) => `<svg viewBox="0 0 ${SW} ${SH}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">${sceneMarkup(info.scene, diffs)}<g class="sd-fx"></g><g class="sd-cur" style="display:none"><circle r="9"/><path d="M-13 0H-5M5 0H13M0 -13V-5M0 5V13"/></g></svg>`;
    picA.innerHTML = mk([]); picB.innerHTML = mk(info.diffs);
    for (const pic of [picA, picB]) pic.setAttribute("data-scene", info.scene.id);
  }
  const ringMarkup = (i: number) => { const s = g.spots[i], r = s.r * 0.9; return `<g data-found="${i}"><circle class="sd-ring" cx="${s.x}" cy="${s.y}" r="${r}"/><circle class="sd-ring-in" cx="${s.x}" cy="${s.y}" r="${r - 2.5}"/></g>`; };
  function drawFx() {
    for (const pic of [picA, picB]) fxOf(pic).innerHTML = g.found.map((f, i) => (f ? ringMarkup(i) : "")).join("");
    placeCursor();
  }
  function placeCursor() {
    for (const pic of [picA, picB]) { const c = curOf(pic); c.setAttribute("transform", `translate(${cursor.x} ${cursor.y})`); c.style.display = cursorOn && phase === "play" ? "" : "none"; }
  }
  function refreshHud() {
    foundEl.textContent = `找到：${foundCount(g)} / ${g.spots.length}`;
    missEl.textContent = `失误：${g.mistakes}`;
    timeEl.textContent = `用时：${fmtTime(elapsed)}`;
    const b = best(); bestEl.textContent = b ? `最快：${fmtTime(b)}` : "最快：--";
    hintBtn.textContent = `提示：${hintsLeft(g)}`; hintBtn.disabled = phase !== "play" || hintsLeft(g) <= 0;
    hintBtn.classList.toggle("lit", phase === "play" && hintLit(g));
    diffBtn.textContent = difficulty === 0 ? "难度：简单" : difficulty === 1 ? "难度：普通" : "难度：困难";
    diffBtn.classList.toggle("on", difficulty === 2);
  }
  function setOvl(t: string, m: string, b: string, show: boolean, extra = false) {
    title.textContent = t; msg.textContent = m; startBtn.textContent = b; ovl.hidden = !show;
    starsEl.hidden = !extra; recEl.hidden = !(extra && record);
  }

  /** a level of the chosen difficulty that was not seen yet */
  function pick() {
    const seen = ctx.store.get<number[]>(`seen-${difficulty}`, []);
    const r = pickLevel(difficulty, Array.isArray(seen) ? seen : []);
    ctx.store.set(`seen-${difficulty}`, r.seen);
    ctx.store.set("level", difficulty * LEVELS_PER_DIFFICULTY + r.k);
    setup(difficulty * LEVELS_PER_DIFFICULTY + r.k);
  }
  function setup(level: number) {
    info = levelInfo(level); g = newGame(level);
    phase = "ready"; elapsed = 0; hintIdx = -1; record = false; cursorOn = false; cursor = { x: SW / 2, y: SH / 2 };
    build(); drawFx();
    setOvl("找不同", `两幅图有 ${info.n} 处不同，请点击找出。`, "开始", true);
    layout(); refreshHud();
  }
  function begin() { if (phase !== "ready") return; phase = "play"; lastTick = performance.now(); setOvl("", "", "", false); refreshHud(); placeCursor(); }
  function nextPicture() { pick(); begin(); }

  function shake(pic: HTMLElement) { pic.classList.remove("sd-shake"); void pic.offsetWidth; pic.classList.add("sd-shake"); later(() => pic.classList.remove("sd-shake"), 420); }
  function addMiss(x: number, y: number) {
    for (const pic of [picA, picB]) {
      const fx = fxOf(pic); const id = `m${Math.random().toString(36).slice(2, 7)}`;
      fx.insertAdjacentHTML("beforeend", `<g id="${id}" class="sd-x"><path d="M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x + 5} ${y - 5}L${x - 5} ${y + 5}"/></g>`);
      later(() => fx.querySelector(`#${id}`)?.remove(), 750);
    }
  }
  function addRing(i: number) { for (const pic of [picA, picB]) fxOf(pic).insertAdjacentHTML("beforeend", ringMarkup(i)); }
  function useHint() {
    if (phase !== "play") return;
    const i = hint(g); if (i < 0) return;
    hintIdx = i; const s = g.spots[i];
    for (const pic of [picA, picB]) { const fx = fxOf(pic); fx.querySelector(".sd-hint")?.remove(); fx.insertAdjacentHTML("beforeend", `<circle class="sd-hint" cx="${s.x}" cy="${s.y}" r="${s.r * 1.1}"/>`); }
    later(() => { for (const pic of [picA, picB]) fxOf(pic).querySelector(".sd-hint")?.remove(); hintIdx = -1; }, 2600);
    refreshHud();
  }

  /** a tap at scene coordinates, on either picture */
  function hit(x: number, y: number, pic?: HTMLElement) {
    if (phase !== "play") return;
    const r = tap(g, x, y, 18 / scale);
    if (r.kind === "hit") {
      ctx.sfx("good"); addRing(r.i);
      if (hintIdx === r.i) { for (const p of [picA, picB]) fxOf(p).querySelector(".sd-hint")?.remove(); hintIdx = -1; }
      if (won(g)) finish();
    } else if (r.kind === "miss") {
      ctx.sfx("bad"); addMiss(x, y); if (pic) shake(pic);
    }
    refreshHud();
  }
  function finish() {
    phase = "won";
    const n = g.spots.length, st = stars(g.mistakes, elapsed, n), b = best();
    record = !b || elapsed < b;
    if (record) ctx.store.set(`best-${info.level}`, Math.max(1, Math.round(elapsed)));
    if (st > ctx.store.get<number>(`stars-${info.level}`, 0)) ctx.store.set(`stars-${info.level}`, st);
    starsEl.innerHTML = [1, 2, 3].map((k) => `<svg viewBox="0 0 100 96" class="${k <= st ? "on" : "off"}"><polygon points="${STAR}" stroke-width="6" stroke-linejoin="round"/></svg>`).join("");
    starsEl.setAttribute("data-stars", String(st));
    ctx.sfx("win");
    later(() => { if (phase !== "won") return; setOvl("已全部找到。", `用时 ${fmtTime(elapsed)}，失误 ${g.mistakes} 次`, "下一幅", true, true); refreshHud(); }, 600);
    placeCursor();
  }

  // ---- layout: the two pictures one above the other on a tall screen, side by side on a wide one ----
  function layout() {
    const W = board.clientWidth, H = board.clientHeight; if (!W || !H) return;
    const gap = 10, frame = 8, shadow = 6;
    const stack = Math.min(W - frame, (H - shadow - gap - 2 * frame) / 1.5);
    const side = Math.min((W - gap - 2 * frame) / 2, (H - frame - shadow) / 0.75);
    const col = stack >= side;
    const pw = Math.max(60, Math.floor(col ? stack : side)), ph = Math.round(pw * 0.75);
    field.classList.toggle("col", col);
    for (const pic of [picA, picB]) { pic.style.width = `${pw}px`; pic.style.height = `${ph}px`; }
    scale = pw / SW;
    field.style.width = `${col ? pw + frame : 2 * pw + 2 * frame + gap}px`;
    field.style.height = `${col ? 2 * ph + 2 * frame + gap : ph + frame}px`;
  }

  // ---- input ----
  const toScene = (pic: HTMLElement, e: PointerEvent) => { const b = pic.getBoundingClientRect(); return { x: ((e.clientX - b.left) / b.width) * SW, y: ((e.clientY - b.top) / b.height) * SH }; };
  const onDown = (e: PointerEvent) => {
    const pic = (e.target as HTMLElement).closest(".sd-pic") as HTMLElement | null;
    if (!pic || e.target instanceof HTMLButtonElement || !e.isPrimary) return;
    e.preventDefault(); const p = toScene(pic, e); hit(p.x, p.y, pic);
  };
  field.addEventListener("pointerdown", onDown);
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const dir: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const d = dir[e.key];
    if (d) { e.preventDefault(); if (phase !== "play") return; cursorOn = true; cursor = moveCursor(cursor, d[0], d[1], e.shiftKey ? 3 : 10); placeCursor(); return; }
    if (e.key === " " || e.key === "Enter") {
      if ((e.target as HTMLElement)?.tagName === "BUTTON") return;
      e.preventDefault();
      if (phase === "ready") begin(); else if (phase === "won") nextPicture(); else { cursorOn = true; hit(cursor.x, cursor.y, picB); placeCursor(); }
    } else if (e.key === "h" || e.key === "H") { e.preventDefault(); useHint(); }
  };
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  const tick = () => {
    raf = requestAnimationFrame(tick);
    const now = performance.now();
    if (phase === "play" && !document.hidden) { elapsed += Math.min(1, (now - lastTick) / 1000); const t = fmtTime(elapsed); if (timeEl.textContent !== `用时：${t}`) timeEl.textContent = `用时：${t}`; }
    lastTick = now;
  };

  // start: the level of the last time is not repeated: a picture not seen yet of the chosen difficulty
  pick();
  raf = requestAnimationFrame(tick);
  (window as unknown as Record<string, unknown>).__spotdiff = {
    game: () => g, phase: () => phase, info: () => info, scale: () => scale, elapsed: () => elapsed, setElapsed: (s: number) => { elapsed = s; },
    level: () => info.level, difficulty: () => difficulty, counts: DIFF_COUNTS, names: DIFFICULTIES,
  };
  return () => {
    cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers.clear(); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout); field.removeEventListener("pointerdown", onDown);
    delete (window as unknown as Record<string, unknown>).__spotdiff;
  };
}
