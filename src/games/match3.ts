/** 糖果消消乐 (match-3): swap two neighbouring candies (tap, tap or drag), 3+ in a line clear, candies fall, chains count a combo. Rules: match3-logic.ts. */
import "./match3.css";
import type { GameCtx } from "./ctx";
import * as L from "./match3-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="8" width="104" height="104" rx="26" fill="#ffe3ee"/>
<g stroke="#fff" stroke-width="3"><circle cx="38" cy="38" r="22" fill="#ff6b6b"/><rect x="62" y="18" width="42" height="42" rx="13" fill="#ffd43b"/><path d="M38 64 L60 100 L16 100Z" fill="#51cf66" stroke-linejoin="round"/><path d="M82 64 L102 82 L82 100 L62 82Z" fill="#4dabf7" stroke-linejoin="round"/></g>
<g fill="#343a40"><circle cx="31" cy="35" r="3"/><circle cx="45" cy="35" r="3"/><circle cx="75" cy="35" r="3"/><circle cx="91" cy="35" r="3"/><circle cx="32" cy="82" r="0"/><circle cx="76" cy="80" r="2.4"/><circle cx="88" cy="80" r="2.4"/></g>
<g fill="none" stroke="#343a40" stroke-width="2.6" stroke-linecap="round"><path d="M31 45q7 7 14 0"/><path d="M75 45q8 7 16 0"/><path d="M32 86q6 5 12 0"/><path d="M76 88q6 4 12 0"/></g>
<g stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".85"><path d="M68 28h30M68 38h30M68 48h30"/></g></svg>`;

const FILL = ["#ff6b6b", "#ffa94d", "#ffd43b", "#51cf66", "#4dabf7", "#cc5de8"];
const EDGE = ["#e03131", "#e8590c", "#f08c00", "#2f9e44", "#1c7ed6", "#9c36b5"];
const SHAPE = [
  `<circle cx="50" cy="52" r="38"`,
  `<rect x="14" y="16" width="72" height="72" rx="22"`,
  `<polygon points="50,10 86,30 86,70 50,90 14,70 14,30" stroke-linejoin="round"`,
  `<path d="M50 10C60 32 86 50 86 66A36 36 0 0 1 14 66C14 50 40 32 50 10Z"`,
  `<polygon points="50,8 90,50 50,92 10,50" stroke-linejoin="round"`,
  `<path d="M50 88C8 60 8 22 32 18C42 17 48 24 50 30C52 24 58 17 68 18C92 22 92 60 50 88Z"`,
];
const FACE_Y = [52, 52, 50, 62, 50, 48];
function candySvg(k: number, s: number): string {
  if (k === L.BOMB) {
    const dots = ["#ff6b6b", "#ffd43b", "#51cf66", "#4dabf7", "#cc5de8", "#ffa94d"].map((c, i) => `<circle cx="${50 + 30 * Math.cos(i * 1.047)}" cy="${52 + 30 * Math.sin(i * 1.047)}" r="6" fill="${c}"/>`).join("");
    return `<svg viewBox="0 0 100 100"><circle cx="50" cy="52" r="38" fill="#6f4e37" stroke="#4a3426" stroke-width="5"/>${dots}<ellipse cx="36" cy="32" rx="9" ry="5" fill="#fff" opacity=".35" transform="rotate(-30 36 32)"/><circle cx="40" cy="48" r="7" fill="#fff"/><circle cx="60" cy="48" r="7" fill="#fff"/><circle cx="41" cy="49" r="3.4" fill="#343a40"/><circle cx="61" cy="49" r="3.4" fill="#343a40"/><path d="M40 62Q50 72 60 62" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M50 14Q56 4 64 8" fill="none" stroke="#868e96" stroke-width="4" stroke-linecap="round"/><circle cx="66" cy="8" r="4" fill="#ffd43b"/></svg>`;
  }
  const y = FACE_Y[k];
  let stripes = "";
  if (s === 1) stripes = `<g stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"><path d="M22 ${y - 22}H78M16 ${y - 4}H84M22 ${y + 28}H78"/></g>`;
  if (s === 2) stripes = `<g stroke="#fff" stroke-width="7" stroke-linecap="round" opacity=".85"><path d="M26 20V82M74 20V82M50 12V90" transform="translate(0 0)"/></g>`;
  return `<svg viewBox="0 0 100 100">${SHAPE[k]} fill="${FILL[k]}" stroke="${EDGE[k]}" stroke-width="5"/>${stripes}<ellipse cx="34" cy="32" rx="9" ry="5" fill="#fff" opacity=".5" transform="rotate(-35 34 32)"/><ellipse cx="40" cy="${y - 2}" rx="6" ry="7.5" fill="#fff"/><ellipse cx="60" cy="${y - 2}" rx="6" ry="7.5" fill="#fff"/><circle cx="41" cy="${y - 1}" r="3.4" fill="#343a40"/><circle cx="61" cy="${y - 1}" r="3.4" fill="#343a40"/><path d="M41 ${y + 11}Q50 ${y + 20} 59 ${y + 11}" fill="none" stroke="#343a40" stroke-width="3.4" stroke-linecap="round"/><ellipse cx="30" cy="${y + 8}" rx="5" ry="3.2" fill="#ff8fab" opacity=".6"/><ellipse cx="70" cy="${y + 8}" rx="5" ry="3.2" fill="#ff8fab" opacity=".6"/></svg>`;
}

const HINT_MS = 6000;

export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const h = ctx.h;
  const timers = new Set<number>();
  let alive = true;
  const wait = (ms: number) => new Promise<void>((res) => { const id = window.setTimeout(() => { timers.delete(id); res(); }, ms); timers.add(id); });
  const later = (f: () => void, ms: number) => { const id = window.setTimeout(() => { timers.delete(id); f(); }, ms); timers.add(id); };

  const stars = (): number[] => { const s = ctx.store.get<number[]>("stars", []); return L.LEVELS.map((_, i) => (typeof s[i] === "number" ? s[i] : 0)); };
  const bests = (): number[] => { const s = ctx.store.get<number[]>("best", []); return L.LEVELS.map((_, i) => (typeof s[i] === "number" ? s[i] : 0)); };

  let view: "levels" | "play" = "levels";
  let level = 0, board: L.Board = [], rng = L.mulberry32(1), score = 0, moves = 0, target = 0, kinds = 6, combo = 0, bestCombo = 0;
  let runId = 0, busy = false, over = false, reached = false, sel: L.Pos | null = null, S = 40;
  let drag: { pos: L.Pos; x: number; y: number } | null = null;
  let hintTimer = 0, hinted: HTMLElement[] = [];
  const els = new Map<number, HTMLElement>();

  const wrap = h("div", { class: "match3-wrap" });
  root.append(wrap);
  let boardEl!: HTMLElement, area!: HTMLElement, hudLevel!: HTMLElement, hudMoves!: HTMLElement, hudScore!: HTMLElement, hudTarget!: HTMLElement, hudCombo!: HTMLElement, bar!: HTMLElement;

  function showLevels() {
    view = "levels"; busy = false; clearHint(); wrap.className = "match3-wrap"; wrap.textContent = ""; els.clear();
    const st = stars(), bs = bests();
    const g = h("div", { class: "match3-lvgrid" });
    L.LEVELS.forEach((_, i) => {
      const locked = i > 0 && st[i - 1] === 0;
      g.append(h("button", { class: "match3-lv", "data-level": String(i + 1), disabled: locked, title: bs[i] ? `最高：${bs[i]}` : "", onclick: () => { ctx.sfx("tap"); startLevel(i); } },
        locked ? "🔒" : String(i + 1), h("small", {}, locked ? "" : "★".repeat(st[i]) + "☆".repeat(3 - st[i]))));
    });
    wrap.append(h("div", { class: "match3-levels" }, h("h2", {}, "糖果消消乐：选择关卡"), h("span", { class: "match3-chip", id: "match3-total" }, `星星：${st.reduce((a, b) => a + b, 0)} / ${L.LEVELS.length * 3}`), g));
  }

  function buildPlay() {
    wrap.className = "match3-wrap playing"; wrap.textContent = ""; els.clear();
    hudLevel = h("span", { class: "match3-chip", id: "match3-level" });
    hudMoves = h("span", { class: "match3-chip", id: "match3-moves" });
    hudScore = h("span", { class: "match3-chip", id: "match3-score" });
    hudTarget = h("span", { class: "match3-chip", id: "match3-target" });
    hudCombo = h("span", { class: "match3-chip combo hide", id: "match3-combo" });
    bar = h("div", { class: "match3-bar", id: "match3-bar" }, h("i"));
    const btn = (id: string, t: string, f: () => void, alt = true) => h("button", { class: "match3-btn" + (alt ? " alt" : ""), id, onclick: () => { ctx.sfx("tap"); f(); } }, t);
    const hud = h("div", { class: "match3-hud" }, hudLevel, hudMoves, hudScore, hudTarget, hudCombo, bar,
      h("div", { class: "match3-btns" }, btn("match3-hint", "提示", showHint), btn("match3-restart", "重来", () => startLevel(level)), btn("match3-levels-btn", "选关", showLevels)));
    boardEl = h("div", { class: "match3-board", id: "match3-board" });
    area = h("div", { class: "match3-area" }, boardEl);
    wrap.append(hud, area);
    boardEl.addEventListener("pointerdown", onDown);
    boardEl.addEventListener("pointermove", onMove);
    boardEl.addEventListener("pointerup", onUp);
    boardEl.addEventListener("pointercancel", () => { drag = null; });
    fit();
  }

  function hudUpdate() {
    hudLevel.textContent = `第${level + 1}关`;
    hudMoves.textContent = `步数：${moves}`;
    hudScore.textContent = `得分：${score}`;
    hudTarget.textContent = `目标：${target}`;
    const pct = Math.min(100, (score / target) * 100);
    (bar.firstElementChild as HTMLElement).style.width = pct + "%";
    bar.classList.toggle("done", score >= target);
    if (combo >= 2) { hudCombo.textContent = `连击：${combo}`; hudCombo.classList.remove("hide"); } else hudCombo.classList.add("hide");
  }

  const place = (el: HTMLElement, r: number, c: number) => { el.style.transform = `translate(${c * S}px, ${r * S}px)`; };
  function candyEl(cd: { id: number; k: number; s: number }): HTMLElement {
    const el = h("div", { class: "match3-cell" + (cd.s ? " striped" : ""), "data-id": String(cd.id), "data-k": String(cd.k), "data-s": String(cd.s) });
    el.style.width = el.style.height = S + "px";
    el.innerHTML = candySvg(cd.k, cd.s);
    boardEl.append(el); els.set(cd.id, el);
    return el;
  }
  const cellEl = (r: number, c: number) => (board[r][c] ? els.get(board[r][c]!.id) : undefined);

  /** puts every element where the model says (also the safety net after every move) */
  function syncAll() {
    const want = new Set<number>();
    for (let r = 0; r < L.N; r++) for (let c = 0; c < L.N; c++) {
      const cd = board[r][c]!; want.add(cd.id);
      let el = els.get(cd.id);
      if (!el) el = candyEl(cd);
      el.dataset.r = String(r); el.dataset.c = String(c); el.dataset.k = String(cd.k); el.dataset.s = String(cd.s);
      el.className = "match3-cell" + (cd.s ? " striped" : "");
      place(el, r, c);
    }
    for (const [id, el] of [...els]) if (!want.has(id)) { el.remove(); els.delete(id); }
  }

  function fit() {
    if (view !== "play" || !area) return;
    const top = area.getBoundingClientRect().top + (document.scrollingElement?.scrollTop ?? 0);
    const ah = Math.max(80, Math.floor((window.visualViewport?.height ?? window.innerHeight) - top - 12));
    area.style.height = ah + "px"; area.style.flex = "none";
    const sz = Math.min(area.clientWidth, ah) - 12;
    if (sz < 40 || S * L.N === sz - (sz % L.N) && boardEl.style.width === S * L.N + "px") return;
    S = Math.floor(sz / L.N);
    boardEl.style.width = boardEl.style.height = S * L.N + "px";
    for (const el of els.values()) { el.style.width = el.style.height = S + "px"; }
    for (let r = 0; r < L.N; r++) for (let c = 0; c < L.N; c++) { const cd = board[r]?.[c]; const el = cd && els.get(cd.id); if (el) place(el, r, c); }
  }

  function startLevel(i: number, preset?: { rows: string[]; moves?: number; target?: number; seed?: number }) {
    level = i; view = "play"; runId++;
    const spec = L.LEVELS[i];
    const seed = preset?.seed ?? ((Date.now() & 0xffffff) + i * 104729);
    rng = L.mulberry32(seed);
    kinds = spec.kinds; target = preset?.target ?? spec.target; moves = preset?.moves ?? spec.moves;
    board = preset ? L.fromRows(preset.rows) : L.randomBoard(rng, kinds);
    score = 0; combo = 0; bestCombo = 0; busy = false; over = false; reached = false; sel = null; drag = null;
    buildPlay(); syncAll(); hudUpdate(); armHint();
  }

  // ---- hint
  function clearHint() { clearTimeout(hintTimer); timers.delete(hintTimer); hinted.forEach((e) => e.classList.remove("hint")); hinted = []; }
  function armHint() { clearHint(); if (view !== "play" || over) return; hintTimer = window.setTimeout(showHint, HINT_MS); timers.add(hintTimer); }
  function showHint() {
    if (busy || over || view !== "play") return;
    hinted.forEach((e) => e.classList.remove("hint")); hinted = [];
    const mv = L.findMove(board);
    if (!mv) return;
    hinted = mv.map(([r, c]) => cellEl(r, c)!).filter(Boolean);
    hinted.forEach((e) => e.classList.add("hint"));
  }

  // ---- effects
  const cellCenter = (r: number, c: number) => ({ x: (c + 0.5) * S, y: (r + 0.5) * S });
  function bits(r: number, c: number, k: number) {
    const p = cellCenter(r, c);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + Math.random(), d = S * (0.5 + Math.random() * 0.4);
      const b = h("i", { class: "match3-bit" });
      b.style.left = p.x + "px"; b.style.top = p.y + "px"; b.style.background = k === L.BOMB ? "#ffd43b" : FILL[k];
      b.style.setProperty("--dx", Math.cos(a) * d + "px"); b.style.setProperty("--dy", Math.sin(a) * d + "px");
      boardEl.append(b); later(() => b.remove(), 520);
    }
  }
  function text(r: number, c: number, s: string) {
    const p = cellCenter(r, c);
    const t = h("div", { class: "match3-txt" }, s);
    t.style.left = p.x + "px"; t.style.top = p.y + "px"; t.style.fontSize = Math.round(S * 0.42) + "px";
    boardEl.append(t); later(() => t.remove(), 820);
  }
  function beam(b: { r: number; c: number; kind: string }) {
    const e = h("div", { class: "match3-beam " + b.kind });
    if (b.kind === "row") { e.style.left = "0"; e.style.width = L.N * S + "px"; e.style.top = b.r * S + S * 0.2 + "px"; e.style.height = S * 0.6 + "px"; }
    else if (b.kind === "col") { e.style.top = "0"; e.style.height = L.N * S + "px"; e.style.left = b.c * S + S * 0.2 + "px"; e.style.width = S * 0.6 + "px"; }
    else { e.style.left = (b.c - 2.5) * S + "px"; e.style.top = (b.r - 2.5) * S + "px"; e.style.width = e.style.height = S * 6 + "px"; }
    boardEl.append(e); later(() => e.remove(), 460);
  }

  // ---- a move
  async function trySwap(a: L.Pos, b: L.Pos) {
    if (busy || over || view !== "play") return;
    clearHint(); setSel(null);
    busy = true;
    const ea = cellEl(a[0], a[1])!, eb = cellEl(b[0], b[1])!;
    ea.style.zIndex = "5";
    place(ea, b[0], b[1]); place(eb, a[0], a[1]); ctx.sfx("swap");
    if (!L.isValidSwap(board, a, b)) {
      await wait(190); if (!alive) return;
      place(ea, a[0], a[1]); place(eb, b[0], b[1]);
      ea.classList.add("shake"); eb.classList.add("shake"); ctx.sfx("bad");
      await wait(220); if (!alive) return;
      ea.classList.remove("shake"); eb.classList.remove("shake"); ea.style.zIndex = "";
      busy = false; armHint();
      return;
    }
    await wait(190); if (!alive) return;
    ea.style.zIndex = "";
    moves--; combo = 0;
    const res = L.resolveSwap(board, a, b, rng, kinds);
    for (const rd of res.rounds) {
      combo = rd.combo;
      rd.beams.forEach(beam);
      for (const cl of rd.cleared) {
        const el = els.get(cl.id); if (el) { el.classList.add("pop"); const id = cl.id; later(() => { els.get(id) === el && els.delete(id); el.remove(); }, 290); }
        bits(cl.r, cl.c, cl.k);
      }
      for (const cr of rd.created) {
        const el = els.get(cr.id); if (el) { el.innerHTML = candySvg(cr.k, cr.s); el.dataset.k = String(cr.k); el.dataset.s = String(cr.s); el.classList.toggle("striped", cr.s > 0); el.classList.add("born"); place(el, cr.r, cr.c); }
      }
      if (rd.cleared.length) { const m = rd.cleared[Math.floor(rd.cleared.length / 2)]; text(m.r, m.c, "+" + rd.score); }
      score += rd.score; bestCombo = Math.max(bestCombo, rd.combo);
      ctx.sfx(rd.combo >= 3 ? "line" : "pop"); if (rd.beams.length) ctx.sfx("good");
      hudUpdate();
      if (!reached && score >= target) { reached = true; ctx.toast("达到目标啦！还可以继续冲更高分！", 2200); }
      await wait(290); if (!alive) return;
      for (const f of rd.fall) { const el = els.get(f.id); if (el) { el.classList.add("fall"); place(el, f.tr, f.tc); } }
      for (const sp of rd.spawn) {
        const el = candyEl(sp); el.classList.remove("fall"); el.style.transition = "none"; place(el, sp.fromRow, sp.c);
        void el.offsetWidth; el.style.transition = ""; el.classList.add("fall"); place(el, sp.tr, sp.c);
      }
      await wait(330); if (!alive) return;
    }
    syncAll();
    for (const el of els.values()) el.classList.remove("fall", "born");
    combo = 0; hudUpdate();
    if (moves > 0 && !L.hasMoves(board)) {
      ctx.toast("没有可以消除的了，重新洗牌！", 2000);
      board = L.shuffle(board, rng);
      for (const el of els.values()) el.classList.add("fall");
      syncAll(); for (const el of els.values()) el.classList.add("fall");
      await wait(400); if (!alive) return;
      for (const el of els.values()) el.classList.remove("fall");
    }
    busy = false;
    if (moves <= 0) return finish();
    armHint();
  }

  function finish() {
    over = true; clearHint();
    const n = L.starsFor(score, target), won = score >= target;
    if (won) { const st = stars(); st[level] = Math.max(st[level], n); ctx.store.set("stars", st); }
    const bs = bests(); if (score > bs[level]) { bs[level] = score; ctx.store.set("best", bs); }
    ctx.store.set("last", level);
    ctx.sfx(won ? "win" : "lose");
    const my = runId;
    later(() => {
      if (!alive || view !== "play" || my !== runId) return;
      const isLast = level === L.LEVELS.length - 1;
      const btn = (id: string, t: string, f: () => void, alt: boolean) => h("button", { class: "match3-btn" + (alt ? " alt" : ""), id, onclick: () => { ctx.sfx("tap"); f(); } }, t);
      const btns = won
        ? [!isLast && btn("match3-next", "下一关", () => startLevel(level + 1), false), btn("match3-again", "再玩一次", () => startLevel(level), true), btn("match3-back", "选关", showLevels, true)]
        : [btn("match3-again", "再来一次", () => startLevel(level), false), btn("match3-back", "选关", showLevels, true)];
      boardEl.append(h("div", { class: "match3-ov", id: "match3-over", "data-result": won ? "won" : "lost" },
        h("h2", {}, won ? (isLast ? "全部通关！你是糖果大师！" : "过关啦！") : "步数用完了，再试一次吧！"),
        won ? h("div", { class: "match3-stars", id: "match3-stars" }, ...[0, 1, 2].map((i) => h("span", { class: i < n ? "on" : "off" }, "★"))) : null,
        h("p", {}, `得分：${score}`), ...btns));
    }, 500);
  }

  // ---- input
  function setSel(p: L.Pos | null) {
    if (sel) cellEl(sel[0], sel[1])?.classList.remove("sel");
    sel = p;
    if (p) { cellEl(p[0], p[1])?.classList.add("sel"); ctx.sfx("move"); }
  }
  const posOf = (e: PointerEvent): L.Pos | null => {
    const r = boardEl.getBoundingClientRect();
    const c = Math.floor(((e.clientX - r.left - 3) / (r.width - 6)) * L.N), q = Math.floor(((e.clientY - r.top - 3) / (r.height - 6)) * L.N);
    return c < 0 || q < 0 || c >= L.N || q >= L.N ? null : [q, c];
  };
  function onDown(e: PointerEvent) {
    if (busy || over) return;
    e.preventDefault();
    const p = posOf(e); if (!p) return;
    try { boardEl.setPointerCapture(e.pointerId); } catch { /* ok */ }
    drag = { pos: p, x: e.clientX, y: e.clientY };
    armHint(); hinted.forEach((x) => x.classList.remove("hint"));
  }
  function onMove(e: PointerEvent) {
    if (!drag || busy || over) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) < S * 0.4) return;
    const [r, c] = drag.pos;
    const to: L.Pos = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    const from = drag.pos; drag = null;
    if (to[0] < 0 || to[1] < 0 || to[0] >= L.N || to[1] >= L.N) return;
    void trySwap(from, to);
  }
  function onUp(e: PointerEvent) {
    if (!drag) return;
    const d = drag; drag = null;
    if (busy || over) return;
    const p = posOf(e) ?? d.pos;
    if (p[0] !== d.pos[0] || p[1] !== d.pos[1]) return;
    if (sel && sel[0] === p[0] && sel[1] === p[1]) setSel(null);
    else if (sel && L.adjacent(sel, p)) void trySwap(sel, p);
    else setSel(p);
  }
  const onResize = () => fit();
  const refit = window.setInterval(fit, 400);
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);

  (window as any).__m3 = {
    get s() { return { view, level, score, moves, target, busy, over, combo, bestCombo, sel, hintShown: hinted.length, elements: els.size, board: board.map((r) => r.map((c) => (c ? { k: c.k, s: c.s } : null))), S }; },
    load(rows: string[], o: { moves?: number; target?: number; seed?: number; level?: number } = {}) { startLevel(o.level ?? level, { rows, moves: o.moves, target: o.target, seed: o.seed }); },
  };

  showLevels();
  return () => {
    alive = false; clearInterval(refit);
    timers.forEach((t) => clearTimeout(t)); timers.clear();
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
    try { delete (window as any).__m3; } catch { /* ok */ }
  };
}
