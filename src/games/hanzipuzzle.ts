import type { GameCtx } from "./ctx";
import "./hanzipuzzle.css";
import * as L from "./hanzipuzzle-logic";
import type { Level, Mode, OrderState, AssembleState, Box } from "./hanzipuzzle-logic";

const line = (x1: number, y1: number, x2: number, y2: number, c: string) => `<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#3a2e39" stroke-width="13" stroke-linecap="round"/><path d="M${x1} ${y1} L${x2} ${y2}" stroke="${c}" stroke-width="7.5" stroke-linecap="round"/>`;
export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d3f9d8"/><rect x="20" y="20" width="80" height="80" rx="14" fill="#fffdf5" stroke="#0ca678" stroke-width="4"/><path d="M60 22 V98 M22 60 H98" stroke="#96f2d7" stroke-width="2.5" stroke-dasharray="5 4" fill="none"/>${line(34, 52, 86, 52, "#fa5252")}${line(60, 32, 60, 90, "#ff922b")}${line(57, 62, 36, 88, "#40c057")}${line(63, 62, 84, 88, "#339af0")}<path d="M96 12 L99 21 L108 24 L99 27 L96 36 L93 27 L84 24 L93 21 Z" fill="#ffd43b" stroke="#f59f00" stroke-width="2" stroke-linejoin="round"/></svg>`;

const NS = "http://www.w3.org/2000/svg";
const sv = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, cls = ""): SVGElementTagNameMap[K] => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (cls) e.setAttribute("class", cls);
  return e;
};

/* ---------- the strokes of a character: the app's own files (public/strokes), cached by the service worker after the first use ---------- */
const buckets = new Map<string, Promise<Record<string, string[]> | null>>();
async function strokesOf(ch: string): Promise<string[] | null> {
  const key = (ch.codePointAt(0)! >> 8).toString(16);
  if (!buckets.has(key)) {
    buckets.set(key, fetch(`${import.meta.env.BASE_URL}strokes/${key}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    if (!(await buckets.get(key))) buckets.delete(key);
  }
  return (await buckets.get(key))?.[ch] ?? null;
}

type Phase = "ready" | "loading" | "play" | "done" | "over";
const LEVEL_NAME: Record<Level, string> = { easy: "难度：简单", normal: "难度：普通", hard: "难度：较难" };
const flip = "translate(0 900) scale(1 -1)";

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let mode: Mode = ctx.store.get<string>("mode", "order") === "assemble" ? "assemble" : "order";
  let level: Level = (L.LEVELS as string[]).includes(ctx.store.get<string>("level", "easy")) ? (ctx.store.get<string>("level", "easy") as Level) : "easy";
  const bestKey = () => `best-${mode}-${level}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);
  const reduced = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const progEl = h("span", { class: "hz-stat", id: "hz-prog" }, "");
  const scoreEl = h("span", { class: "hz-stat", id: "hz-score" }, "");
  const missEl = h("span", { class: "hz-stat", id: "hz-miss" }, "");
  const countEl = h("span", { class: "hz-stat", id: "hz-count" }, "");
  const bestEl = h("span", { class: "hz-stat best", id: "hz-best" }, "");
  const modeBtn = h("button", { class: "mopt", id: "hz-mode", onclick: () => { mode = mode === "order" ? "assemble" : "order"; ctx.store.set("mode", mode); ctx.sfx("tap"); reset(); } }, "");
  const levelBtn = h("button", { class: "mopt", id: "hz-level", onclick: () => { level = L.LEVELS[(L.LEVELS.indexOf(level) + 1) % L.LEVELS.length]; ctx.store.set("level", level); ctx.sfx("tap"); reset(); } }, "");
  const showBtn = h("button", { class: "mopt", id: "hz-show", onclick: () => { ctx.sfx("tap"); showOrder(); } }, "看笔顺");
  const hud = h("div", { class: "hz-hud" }, progEl, scoreEl, missEl, countEl, bestEl, modeBtn, levelBtn, showBtn);

  // the board: 田字格, the faint outline, the strokes that are in, the dragged one, sparkles
  const svg = sv("svg", { viewBox: "0 0 1024 1024" }, "hz-svg");
  svg.append(
    sv("rect", { x: 14, y: 14, width: 996, height: 996, rx: 40, fill: "none", stroke: "#96f2d7", "stroke-width": 3, "vector-effect": "non-scaling-stroke" }),
    ...[["512 14", "512 1010"], ["14 512", "1010 512"], ["14 14", "1010 1010"], ["1010 14", "14 1010"]].map(([a, b]) => sv("path", { d: `M${a} L${b}`, fill: "none", stroke: "#96f2d7", "stroke-width": 2, "stroke-dasharray": "7 6", "vector-effect": "non-scaling-stroke" })));
  const faintG = sv("g", { transform: flip, class: "hz-faint" });
  const placedG = sv("g", { transform: flip, class: "hz-placed" });
  const animG = sv("g", { class: "hz-anim" });
  svg.append(faintG, placedG, animG);
  const ghost = sv("svg", { viewBox: "0 0 1024 1024" }, "hz-ghost");
  const fx = sv("svg", { viewBox: "0 0 1024 1024" }, "hz-fx");
  const title = h("h2", {}, ""), msg = h("p", {}, ""), again = h("button", { class: "primary", id: "hz-start", onclick: () => { ctx.sfx("tap"); primary(); } }, "");
  const ovl = h("div", { class: "hz-ovl", id: "hz-ovl" }, title, msg, again);
  const field = h("div", { class: "hz-field", id: "hz-field" }, svg, ghost, fx, ovl);
  const board = h("div", { class: "hz-board" }, field);
  const tray = h("div", { class: "hz-tray", id: "hz-tray" });
  const nextBtn = h("button", { class: "primary hz-next", id: "hz-next", onclick: () => { ctx.sfx("tap"); nextChar(); } }, "");
  const nextWrap = h("div", { class: "hz-nextwrap" }, nextBtn);
  nextWrap.hidden = true;
  const trayArea = h("div", { class: "hz-trayarea" }, tray, nextWrap);
  root.append(h("div", { class: "hz-wrap" }, hud, board, trayArea));

  let phase: Phase = "ready";
  let chars: string[] = [], idx = 0, results: number[] = [];
  let strokes: string[] = [], boxes: Box[] = [];
  let st: OrderState | AssembleState = L.newOrder(1);
  let perm: number[] = [];
  let selected = -1, cursor = { x: 512, y: 512 }, animating = false, token = 0, lastScore = 0, newBest = false, failed = false;
  const timers: number[] = [];
  const later = (fn: () => void, ms: number) => { timers.push(window.setTimeout(fn, ms)); };
  let size = 300;

  const setOvl = (t: string, m: string, b: string, show: boolean) => { title.textContent = t; msg.textContent = m; again.textContent = b; again.hidden = !b; ovl.hidden = !show; };
  const mistakes = () => (phase === "play" || phase === "done" ? st.mistakes : 0);
  const refreshHud = () => {
    progEl.textContent = `第 ${Math.min(idx + 1, L.ROUND)} / ${L.ROUND} 个`;
    scoreEl.textContent = `得分：${L.stars(results)}`;
    missEl.textContent = `错误：${mistakes()}`;
    countEl.textContent = `共 ${strokes.length} 画`; countEl.hidden = !(phase === "play" || phase === "done");
    bestEl.textContent = `最高：${Math.max(best(), phase === "over" ? lastScore : 0)}`;
    modeBtn.textContent = mode === "order" ? "方式：按笔顺" : "方式：拼汉字"; modeBtn.classList.toggle("on", mode === "assemble");
    levelBtn.textContent = LEVEL_NAME[level];
    showBtn.disabled = !(phase === "play" || phase === "done") || animating;
  };

  function reset() {
    token++; animating = false; chars = []; idx = 0; results = []; strokes = []; boxes = []; selected = -1; lastScore = 0; failed = false;
    phase = "ready";
    clearBoard(); tray.replaceChildren(); nextWrap.hidden = true;
    setOvl("汉字笔画", mode === "order" ? "按笔顺，先点下一笔，再点田字格；也可以拖过去。" : "把散开的笔画拖到田字格里，拼成汉字。", "开始", true);
    refreshHud();
  }
  function clearBoard() { faintG.replaceChildren(); placedG.replaceChildren(); animG.replaceChildren(); ghost.replaceChildren(); fx.replaceChildren(); }

  function primary() {
    if (phase === "ready" || phase === "over") void begin();
  }
  async function begin() {
    const my = ++token;
    phase = "loading"; chars = L.pickRound(level); idx = 0; results = []; strokes = []; boxes = [];
    setOvl("加载中…", "", "", true); refreshHud();
    const got = await Promise.all(chars.map((c) => strokesOf(c)));
    if (my !== token) return;
    if (got.some((g) => !g || !g.length)) {
      phase = "ready"; failed = true;
      setOvl("汉字笔画", "没能加载笔画。请先联网打开一次，再试一次。", "再试一次", true); refreshHud();
      return;
    }
    failed = false; all = got as string[][];
    startChar();
  }
  let all: string[][] = [];

  function startChar() {
    strokes = all[idx]; boxes = strokes.map(L.pathBox);
    st = mode === "order" ? L.newOrder(strokes.length) : L.newAssemble(strokes.length);
    perm = L.scramble(strokes.length);
    selected = -1; cursor = { x: 512, y: 512 }; phase = "play";
    clearBoard(); nextWrap.hidden = true;
    // the faint outline of the whole character (the "answer", very faint); in "assemble" at the hard level there is none
    if (!(mode === "assemble" && level === "hard")) strokes.forEach((d) => faintG.append(sv("path", { d, fill: "#e9ecef" })));
    buildTray();
    setOvl("", "", "", false); refreshHud();
    (tray.querySelector<HTMLElement>(".hz-tile"))?.focus({ preventScroll: true });
    layout();
  }

  /* ---------- tiles ---------- */
  const tileEls = new Map<number, HTMLElement>();
  function tileSvg(i: number) {
    const s = sv("svg", {}, "hz-tsvg");
    s.setAttribute("aria-hidden", "true");
    const g = sv("g", { transform: flip });
    if (mode === "order") {
      s.setAttribute("viewBox", "0 0 1024 1024");
      strokes.forEach((d) => g.append(sv("path", { d, fill: "#edf0f2" })));
    } else {
      const b = boxes[i], side = Math.max(b.x1 - b.x0, b.y1 - b.y0, 120) + 90, c = L.centerOf(b);
      s.setAttribute("viewBox", `${c.x - side / 2} ${c.y - side / 2} ${side} ${side}`);
    }
    g.append(sv("path", { d: strokes[i], fill: L.COLORS[i % L.COLORS.length], stroke: "#3a2e39", "stroke-width": mode === "order" ? 24 : 12, "stroke-linejoin": "round" }));
    s.append(g);
    return s;
  }
  function buildTray() {
    tray.replaceChildren(); tileEls.clear();
    const n = strokes.length;
    tray.style.setProperty("--t", `${n <= 6 ? 66 : n <= 10 ? 58 : 50}px`);
    perm.forEach((i, pos) => {
      const b = h("button", { class: "hz-tile", "data-s": String(i), "aria-label": `笔画 ${pos + 1}`, onkeydown: (e: Event) => tileKey(e as KeyboardEvent, i), onpointerdown: (e: Event) => tileDown(e as PointerEvent, i) }, tileSvg(i));
      b.addEventListener("pointermove", (e) => tileMove(e, i));
      b.addEventListener("pointerup", (e) => tileUp(e, i));
      b.addEventListener("pointercancel", (e) => tileCancel(e));
      tileEls.set(i, b); tray.append(b);
    });
  }
  const tileOf = (i: number) => tileEls.get(i);
  function select(i: number) {
    selected = i;
    tileEls.forEach((el, k) => { el.classList.toggle("sel", k === i); el.setAttribute("aria-pressed", String(k === i)); });
    if (i < 0) hideGhost();
  }

  /* ---------- the ghost: the stroke at board size, following the finger / the keyboard cursor ---------- */
  function showGhost(i: number, x: number, y: number) {
    const c = L.centerOf(boxes[i]);
    ghost.replaceChildren();
    const g = sv("g", { transform: `translate(${x - c.x} ${y - c.y}) ${flip}`, opacity: 0.85 });
    g.append(sv("path", { d: strokes[i], fill: L.COLORS[i % L.COLORS.length], stroke: "#3a2e39", "stroke-width": 8, "stroke-linejoin": "round" }));
    ghost.append(g);
  }
  const hideGhost = () => { ghost.replaceChildren(); tileEls.forEach((el) => el.classList.remove("drag-src")); };
  const toBoard = (cx: number, cy: number) => { const r = field.getBoundingClientRect(); return { x: ((cx - r.left) / r.width) * L.SIZE, y: ((cy - r.top) / r.height) * L.SIZE, on: cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom }; };

  /* ---------- trying a stroke ---------- */
  function attempt(i: number, drop: { x: number; y: number } | null) {
    if (phase !== "play" || animating) return;
    if (mode === "order") {
      if (drop === null) return;
      const r = L.tryOrder(st as OrderState, i);
      if (r === "ok") { putStroke(i, i); }
      else if (r === "wrong") wrong(i);
    } else {
      const r = L.tryAssemble(st as AssembleState, i, drop, boxes);
      if (r.r === "ok") putStroke(i, r.home!);
      else if (r.r === "wrong") wrong(i);
    }
  }
  function putStroke(tile: number, home: number) {
    ctx.sfx("pop");
    const p = sv("path", { d: strokes[home], fill: L.COLORS[home % L.COLORS.length], stroke: "#3a2e39", "stroke-width": 6, "stroke-linejoin": "round" }, "hz-pop");
    p.setAttribute("data-home", String(home));
    placedG.append(p);
    const el = tileOf(tile); if (el) { el.classList.add("gone"); el.tabIndex = -1; (el as HTMLButtonElement).disabled = true; }
    select(-1); hideGhost();
    refreshHud();
    if (L.isDone(st)) complete();
    else focusTile();
  }
  function wrong(i: number) {
    ctx.sfx("bad");
    const el = tileOf(i);
    if (el) { el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake"); }
    field.classList.remove("hz-nope"); void field.offsetWidth; field.classList.add("hz-nope");
    select(-1); hideGhost(); refreshHud();
  }
  function focusTile() { const t = [...tray.querySelectorAll<HTMLElement>(".hz-tile:not(.gone)")][0]; t?.focus({ preventScroll: true }); }

  function complete() {
    phase = "done"; results[idx] = st.mistakes;
    faintG.replaceChildren();
    ctx.sfx("good");
    sparkle(); refreshHud();
    nextBtn.textContent = idx + 1 >= L.ROUND ? "看结果" : "下一个";
    nextWrap.hidden = false; nextBtn.focus({ preventScroll: true });
  }
  function sparkle() {
    fx.replaceChildren();
    const colors = ["#ffd43b", "#ff922b", "#ff8787", "#69db7c", "#74c0fc"];
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2, rr = 250 + (k % 3) * 80, x = 512 + Math.cos(a) * rr, y = 512 + Math.sin(a) * rr, sc = 0.5 + (k % 4) * 0.25;
      const s = sv("path", { d: "M0 -40 L10 -10 L40 0 L10 10 L0 40 L-10 10 L-40 0 L-10 -10 Z", fill: colors[k % colors.length], stroke: "#f59f00", "stroke-width": 3, transform: `translate(${x} ${y}) scale(${sc})` }, "hz-spark");
      s.style.animationDelay = `${(k % 5) * 60}ms`;
      fx.append(s);
    }
    later(() => { if (phase === "done") fx.replaceChildren(); }, 1800);
  }
  function nextChar() {
    if (phase !== "done") return;
    idx++;
    if (idx >= L.ROUND) return finish();
    startChar();
  }
  function finish() {
    phase = "over"; nextWrap.hidden = true;
    const sc = L.stars(results), old = best();
    newBest = L.isBest(sc, old); lastScore = sc;
    if (newBest) ctx.store.set(bestKey(), sc);
    ctx.sfx(sc >= 3 ? "win" : "good");
    clearBoard(); tray.replaceChildren();
    setOvl(sc >= 4 ? "太棒了！" : sc >= 2 ? "做得好！" : "再加油！", newBest && sc > 0 ? `新纪录：${sc}` : `得分：${sc} / ${L.ROUND}`, "再玩一次", true);
    if (sc > 0 && newBest) ctx.toast(`新纪录：${sc}`, 1500);
    refreshHud();
    again.focus({ preventScroll: true });
  }

  /* ---------- "show me the order" ---------- */
  function showOrder() {
    if ((phase !== "play" && phase !== "done") || animating) return;
    animating = true; select(-1); refreshHud();
    animG.replaceChildren();
    animG.append(sv("rect", { x: 0, y: 0, width: 1024, height: 1024, fill: "#fffdf5", opacity: 0.94 }));
    const g = sv("g", { transform: flip }); animG.append(g);
    const add = (k: number) => g.append(sv("path", { d: strokes[k], fill: L.COLORS[k % L.COLORS.length], stroke: "#3a2e39", "stroke-width": 6, "stroke-linejoin": "round" }, reduced() ? "" : "hz-pop"));
    const end = () => { animG.replaceChildren(); animating = false; refreshHud(); };
    if (reduced()) { strokes.forEach((_, k) => add(k)); later(end, 1800); return; }
    strokes.forEach((_, k) => later(() => { add(k); ctx.sfx("tap"); }, 250 + k * 520));
    later(end, 250 + strokes.length * 520 + 1100);
  }

  /* ---------- input: pointer (drag, tap-tap) ---------- */
  let drag: { id: number; tile: number; sx: number; sy: number; moved: boolean } | null = null;
  function tileDown(e: PointerEvent, i: number) {
    if (phase !== "play" || animating || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    drag = { id: e.pointerId, tile: i, sx: e.clientX, sy: e.clientY, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ok */ }
  }
  function tileMove(e: PointerEvent, i: number) {
    if (!drag || drag.id !== e.pointerId || drag.tile !== i) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 8) { drag.moved = true; select(i); tileOf(i)?.classList.add("drag-src"); }
    if (drag.moved) { const p = toBoard(e.clientX, e.clientY); showGhost(i, p.x, p.y); }
  }
  function tileUp(e: PointerEvent, i: number) {
    if (!drag || drag.id !== e.pointerId || drag.tile !== i) return;
    const d = drag; drag = null;
    if (d.moved) {
      const p = toBoard(e.clientX, e.clientY);
      hideGhost();
      if (!p.on) { select(-1); return; }
      attempt(i, { x: p.x, y: p.y });
    } else if (selected === i) {
      if (mode === "order") attempt(i, { x: 512, y: 512 }); else select(-1);
    } else { ctx.sfx("tap"); select(i); }
  }
  function tileCancel(e: PointerEvent) { if (drag && drag.id === e.pointerId) { drag = null; hideGhost(); select(-1); } }
  const onField = (e: MouseEvent) => {
    if (e.detail === 0 || phase !== "play" || animating || selected < 0) return;
    const p = toBoard(e.clientX, e.clientY);
    attempt(selected, { x: p.x, y: p.y });
  };
  field.addEventListener("click", onField);

  /* ---------- input: keyboard (Tab to a stroke, Enter to take it, arrows to move it over the board, Enter to put it down) ---------- */
  function tileKey(e: KeyboardEvent, i: number) {
    if (phase !== "play" || animating || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      if (selected !== i) { ctx.sfx("tap"); select(i); if (mode === "assemble") { cursor = { x: 512, y: 512 }; showGhost(i, cursor.x, cursor.y); } }
      else if (mode === "order") attempt(i, { x: 512, y: 512 });
      else attempt(i, { ...cursor });
    } else if (k === "Escape") { select(-1); }
    else if (mode === "assemble" && selected === i && k.startsWith("Arrow")) {
      e.preventDefault();
      const stp = 32;
      cursor = { x: Math.max(0, Math.min(1024, cursor.x + (k === "ArrowRight" ? stp : k === "ArrowLeft" ? -stp : 0))), y: Math.max(0, Math.min(1024, cursor.y + (k === "ArrowDown" ? stp : k === "ArrowUp" ? -stp : 0))) };
      showGhost(i, cursor.x, cursor.y);
    } else if (k === "ArrowRight" || k === "ArrowLeft") {
      e.preventDefault();
      const ts = [...tray.querySelectorAll<HTMLElement>(".hz-tile:not(.gone)")], at = ts.indexOf(e.currentTarget as HTMLElement);
      ts[(at + (k === "ArrowRight" ? 1 : ts.length - 1)) % ts.length]?.focus();
    }
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.key === "Enter" || e.key === " ") && e.target === document.body) {
      if (phase === "ready" || phase === "over") { e.preventDefault(); primary(); }
      else if (phase === "done") { e.preventDefault(); nextChar(); }
    }
  };
  document.addEventListener("keydown", onKey);

  /* ---------- layout ---------- */
  function layout() {
    const w = board.clientWidth, hh = board.clientHeight;
    size = Math.max(90, Math.floor(Math.min(w - 8, hh - 10)));
    field.style.width = `${size}px`; field.style.height = `${size}px`;
  }
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);

  reset();
  layout();
  const hook = {
    phase: () => phase, mode: () => mode, level: () => level, char: () => chars[idx] ?? "", chars: () => chars.slice(), idx: () => idx, results: () => results.slice(),
    n: () => strokes.length, mistakes: () => (phase === "play" || phase === "done" ? st.mistakes : 0), next: () => ("next" in st ? st.next : -1),
    tray: () => [...tray.querySelectorAll<HTMLElement>(".hz-tile")].map((t) => Number(t.dataset.s)),
    placed: () => placedG.children.length, animCount: () => animG.querySelectorAll("path").length, selected: () => selected, failed: () => failed,
    home: (i: number) => { const r = field.getBoundingClientRect(), c = L.centerOf(boxes[i]); return { x: r.left + (c.x / L.SIZE) * r.width, y: r.top + (c.y / L.SIZE) * r.height }; },
    boxes: () => boxes.slice(), fieldSize: () => size,
  };
  (window as unknown as Record<string, unknown>).__hanzi = hook;
  return () => {
    token++; timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout); field.removeEventListener("click", onField);
    delete (window as unknown as Record<string, unknown>).__hanzi;
  };
}
