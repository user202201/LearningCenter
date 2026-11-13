import type { GameCtx } from "./ctx";
import "./hanoi.css";
import { newHanoi, canMove, move, undoMove, isWon, topOf, hint, minMoves, starsFor, MIN_DISCS, MAX_DISCS, type HState, type HMove } from "./hanoi-logic";

export const ICON = `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="100" height="100" rx="26" fill="#d0ebff"/><rect x="18" y="86" width="84" height="12" rx="6" fill="#c68642" stroke="#8d5524" stroke-width="3"/><rect x="56" y="26" width="8" height="60" rx="4" fill="#e0a458" stroke="#8d5524" stroke-width="2.5"/><rect x="34" y="68" width="52" height="18" rx="9" fill="#fa5252" stroke="#c92a2a" stroke-width="3"/><rect x="42" y="51" width="36" height="18" rx="9" fill="#fcc419" stroke="#e67700" stroke-width="3"/><rect x="49" y="34" width="22" height="18" rx="9" fill="#12b886" stroke="#087f5b" stroke-width="3"/><circle cx="55" cy="43" r="2.4" fill="#222"/><circle cx="65" cy="43" r="2.4" fill="#222"/><path d="M56 47 Q60 50 64 47" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round"/><circle cx="52" cy="60" r="2.6" fill="#222"/><circle cx="68" cy="60" r="2.6" fill="#222"/><path d="M55 64 Q60 68 65 64" fill="none" stroke="#222" stroke-width="2.2" stroke-linecap="round"/><circle cx="48" cy="77" r="3" fill="#222"/><circle cx="72" cy="77" r="3" fill="#222"/><path d="M52 81 Q60 87 68 81" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><circle cx="92" cy="26" r="5" fill="#fff" opacity=".8"/></svg>`;

// largest disc first (index n-1 is the largest): red -> purple, graded through the app's palette
const COLORS: [string, string][] = [["#be4bdb", "#862e9c"], ["#4c6ef5", "#364fc7"], ["#22b8cf", "#0b7285"], ["#20c997", "#087f5b"], ["#94d82d", "#5c940d"], ["#fcc419", "#e67700"], ["#ff922b", "#d9480f"], ["#fa5252", "#c92a2a"]];
const colorOf = (d: number, n: number) => COLORS[Math.min(7, Math.round((d / Math.max(1, n - 1)) * 7))];
const BASE_H = 22;

type Phase = "play" | "won";
export default function mount(root: HTMLElement, ctx: GameCtx): () => void {
  const { h } = ctx;
  let n = Math.max(MIN_DISCS, Math.min(MAX_DISCS, ctx.store.get<number>("level", 3)));
  const bestKey = () => `best-${n}`;
  const best = () => ctx.store.get<number>(bestKey(), 0);

  const movesEl = h("span", { class: "hn-stat", id: "hn-moves" }, "");
  const minEl = h("span", { class: "hn-stat", id: "hn-min" }, "");
  const timeEl = h("span", { class: "hn-stat", id: "hn-time" }, "");
  const bestEl = h("span", { class: "hn-stat best", id: "hn-best" }, "");
  const levelBtns = Array.from({ length: MAX_DISCS - MIN_DISCS + 1 }, (_, i) => {
    const k = MIN_DISCS + i, label = `${k} 个圆盘`;
    return h("button", { class: "hn-lv", "data-n": String(k), "aria-label": label, onclick: () => { ctx.sfx("tap"); stopDemo(); n = k; ctx.store.set("level", n); reset(); } }, String(k));
  });
  const undoBtn = h("button", { class: "mopt", id: "hn-undo", onclick: () => undo() }, "撤销");
  const hintBtn = h("button", { class: "mopt", id: "hn-hint", onclick: () => showHint() }, "提示");
  const restartBtn = h("button", { class: "mopt", id: "hn-restart", onclick: () => { ctx.sfx("tap"); stopDemo(); reset(); } }, "重来");
  const demoBtn = h("button", { class: "mopt", id: "hn-demo", onclick: () => (demo ? stopDemo() : startDemo()) }, "自动演示");
  const hud = h("div", { class: "hn-hud" },
    h("div", { class: "hn-stats" }, movesEl, minEl, timeEl, bestEl),
    h("div", { class: "hn-levels", role: "group", "aria-label": "圆盘数" }, ...levelBtns),
    h("div", { class: "hn-acts" }, undoBtn, hintBtn, restartBtn, demoBtn));

  const pegEls = [0, 1, 2].map((p) => { const label = `第 ${p + 1} 柱`; return h("div", { class: "hn-peg", "data-p": String(p), "aria-label": label }, h("i", { class: "hn-post" }), h("b", { class: "hn-no" }, String(p + 1))); });
  const base = h("div", { class: "hn-base" });
  const stage = h("div", { class: "hn-stage", id: "hn-stage" }, base, ...pegEls);
  const title = h("h2", {}, ""), starsEl = h("div", { class: "hn-stars", id: "hn-stars" }), msg = h("p", { id: "hn-msg" }, ""), rec = h("p", { class: "hn-rec", id: "hn-rec" }, "");
  const nextBtn = h("button", { class: "primary", id: "hn-next", onclick: () => { ctx.sfx("tap"); n = Math.min(MAX_DISCS, n + 1); ctx.store.set("level", n); reset(); } }, "下一级");
  const againBtn = h("button", { class: "primary", id: "hn-again", onclick: () => { ctx.sfx("tap"); reset(); } }, "再玩一次");
  const ovl = h("div", { class: "hn-ovl", id: "hn-ovl", hidden: true }, title, starsEl, msg, rec, h("div", { class: "hn-ovl-btns" }, nextBtn, againBtn));
  const field = h("div", { class: "hn-field" }, stage, ovl);
  const board = h("div", { class: "hn-board" }, field);
  root.append(h("div", { class: "hn-wrap" }, hud, board));

  let s: HState = newHanoi(n), hist: HMove[] = [], phase: Phase = "play";
  let sel = -1, cur = 0, kb = false, hintMv: HMove | null = null, startedAt = 0, endAt = 0, demoUsed = false;
  let demo = 0, demoMs = 420, timerId = 0, dh = 24, bw = 300, bh = 300;
  let discEls: HTMLElement[] = [];
  let drag: { id: number; x: number; y: number; peg: number; disc: number; on: boolean; moved: boolean } | null = null;
  const timers: number[] = [];

  const fmtTime = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const elapsed = () => (startedAt ? Math.floor(((endAt || Date.now()) - startedAt) / 1000) : 0);
  const refreshHud = () => {
    movesEl.textContent = `步数：${hist.length}`; minEl.textContent = `最少：${minMoves(n)}`; timeEl.textContent = `用时：${fmtTime(elapsed())}`;
    const b = best(); bestEl.textContent = `最佳：${b || "—"}`;
    levelBtns.forEach((b2) => b2.classList.toggle("on", Number(b2.dataset.n) === n));
    undoBtn.disabled = hist.length === 0 || phase === "won"; hintBtn.disabled = phase === "won";
    demoBtn.textContent = demo ? "停止演示" : "自动演示"; demoBtn.classList.toggle("on", !!demo); demoBtn.disabled = phase === "won";
  };

  function buildDiscs() {
    discEls.forEach((e) => e.remove());
    discEls = [];
    for (let d = 0; d < n; d++) {
      const [c, dk] = colorOf(d, n);
      const label = `圆盘 ${d + 1}`;
      const el = h("div", { class: "hn-disc", "data-d": String(d), "aria-label": label, style: `--c:${c};--dk:${dk}` }, h("i", { class: "hn-eye l" }), h("i", { class: "hn-eye r" }), h("b", { class: "hn-mouth" }));
      stage.append(el); discEls.push(el);
    }
  }
  function reset() {
    stopDemo();
    s = newHanoi(n); hist = []; phase = "play"; sel = -1; hintMv = null; startedAt = 0; endAt = 0; demoUsed = false; drag = null;
    ovl.hidden = true; buildDiscs(); layout(); refreshHud();
  }

  // ---- layout and drawing (all positions in px, so the animation is just a CSS transition) ----
  const discW = (d: number) => { const zw = bw / 3, maxW = zw * 0.92, minW = Math.min(maxW * 0.7, Math.max(dh * 1.7, zw * 0.3)); return n === 1 ? maxW : minW + ((maxW - minW) * d) / (n - 1); };
  function layout() {
    const W = board.clientWidth, H = board.clientHeight;
    bw = Math.max(210, Math.min(W - 14, 780));
    const fit = Math.floor((H - 8 - 5 - BASE_H - 12) / (n + 2));
    dh = Math.max(12, Math.min(fit, 64, Math.max(Math.round(bw * 0.11), Math.ceil((250 - BASE_H - 8) / (n + 2)))));
    bh = BASE_H + (n + 2) * dh + 8;
    stage.style.width = `${bw}px`; stage.style.height = `${bh}px`; stage.style.setProperty("--dh", `${dh}px`); stage.style.setProperty("--base", `${BASE_H}px`);
    stage.style.setProperty("--post", `${(n + 1) * dh + 4}px`);
    field.style.width = `${bw}px`; stage.classList.toggle("tiny", dh < 16);
    render();
  }
  function render() {
    const zw = bw / 3;
    s.pegs.forEach((stack, p) => stack.forEach((d, j) => {
      const el = discEls[d]; if (!el || (drag && drag.on && drag.disc === d)) return;
      const lifted = sel === p && j === stack.length - 1;
      const w = discW(d);
      el.style.width = `${w}px`; el.style.height = `${dh - 2}px`;
      el.style.left = `${zw * (p + 0.5) - w / 2}px`;
      el.style.bottom = `${BASE_H + (lifted ? (n + 1) * dh + 4 : j * dh) + 1}px`;
      el.style.transform = "";
      el.classList.toggle("lift", lifted);
      el.classList.toggle("hint-from", !!hintMv && hintMv.disc === d);
      el.style.zIndex = lifted ? "6" : String(2 + j);
    }));
    pegEls.forEach((pe, p) => {
      pe.classList.toggle("sel", sel === p); pe.classList.toggle("cur", kb && cur === p);
      pe.classList.toggle("hint-to", !!hintMv && hintMv.to === p);
    });
    stage.dataset.hint = hintMv ? `${hintMv.from}-${hintMv.to}` : "";
    stage.dataset.sel = String(sel);
  }

  // ---- moves ----
  function shake(p: number) {
    const el = discEls[topOf(s, p)]; if (!el) return;
    el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    timers.push(window.setTimeout(() => el.classList.remove("shake"), 450));
  }
  function tryMove(from: number, to: number) {
    if (phase !== "play") return;
    if (!canMove(s, from, to)) { ctx.sfx("bad"); shake(from); sel = -1; render(); return; }
    const m = move(s, from, to) as HMove;
    hist.push(m); hintMv = null; sel = -1;
    if (!startedAt) startedAt = Date.now();
    ctx.sfx("place");
    if (isWon(s)) win(); else { render(); }
    refreshHud();
  }
  function tapPeg(p: number) {
    if (phase !== "play") return;
    if (sel < 0) { if (s.pegs[p].length) { sel = p; hintMv = null; ctx.sfx("move"); render(); } return; }
    if (sel === p) { sel = -1; ctx.sfx("tap"); render(); return; }
    tryMove(sel, p);
  }
  function undo() {
    if (phase !== "play" || !hist.length) return;
    stopDemo(); undoMove(s, hist.pop() as HMove); sel = -1; hintMv = null; ctx.sfx("swap"); render(); refreshHud();
  }
  function showHint() {
    if (phase !== "play") return;
    stopDemo(); sel = -1; hintMv = hint(s); ctx.sfx("good"); render();
  }
  function startDemo() {
    if (phase !== "play") return;
    sel = -1; hintMv = null; demoUsed = true; ctx.sfx("tap");
    demo = window.setInterval(() => { const m = hint(s); if (!m) return stopDemo(); tryMove(m.from, m.to); }, demoMs);
    render(); refreshHud();
  }
  function stopDemo() { if (demo) { clearInterval(demo); demo = 0; if (phase === "play") refreshHud(); } }

  function win() {
    stopDemo(); phase = "won"; endAt = Date.now(); sel = -1; hintMv = null;
    const moves = hist.length, min = minMoves(n);
    starsEl.textContent = ""; msg.textContent = ""; rec.textContent = "";
    if (demoUsed) {
      title.textContent = "演示完成。"; starsEl.hidden = true;
    } else {
      const st = starsFor(moves, n), old = best(), isBest = !old || moves < old;
      if (isBest) ctx.store.set(bestKey(), moves);
      title.textContent = "已完成。"; starsEl.hidden = false;
      for (let i = 0; i < 3; i++) starsEl.append(h("span", { class: i < st ? "on" : "off" }, "★"));
      msg.textContent = moves === min ? "达到最少步数。" : `用了 ${moves} 步，最少需要 ${min} 步。`;
      if (isBest) rec.textContent = `新纪录：${moves}`;
    }
    rec.hidden = !rec.textContent; msg.hidden = !msg.textContent;
    nextBtn.hidden = n >= MAX_DISCS;
    ovl.hidden = false; ctx.sfx("win"); render(); refreshHud();
  }

  // ---- input: pointer (tap = pick / drop, drag), keyboard ----
  const pegAt = (x: number) => { const r = stage.getBoundingClientRect(), w = r.width - 2 * stage.clientLeft; return Math.max(0, Math.min(2, Math.floor(((x - r.left - stage.clientLeft) / w) * 3))); };
  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (demo) { stopDemo(); return; }
    if (phase !== "play" || drag) return;
    const p = pegAt(e.clientX), tgt = (e.target as HTMLElement).closest?.(".hn-disc") as HTMLElement | null;
    const disc = tgt ? Number(tgt.dataset.d) : -1;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, peg: p, disc: disc >= 0 && topOf(s, p) === disc ? disc : -1, on: false, moved: false };
    try { stage.setPointerCapture(e.pointerId); } catch { /* ok */ }
  };
  const onMove = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (drag.disc < 0) { if (Math.hypot(dx, dy) >= 8) drag.moved = true; return; }
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.on = true; sel = -1; hintMv = null; ctx.sfx("move"); render();
      const el = discEls[drag.disc]; el.classList.add("lift", "dragging"); el.style.zIndex = "9";
    }
    discEls[drag.disc].style.transform = `translate(${dx}px, ${dy}px)`;
    const over = pegAt(e.clientX);
    pegEls.forEach((pe, i) => pe.classList.toggle("over", i === over && over !== drag!.peg));
  };
  const finishDrag = (e: PointerEvent, cancel: boolean) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    pegEls.forEach((pe) => pe.classList.remove("over"));
    if (d.on) {
      const el = discEls[d.disc]; el.classList.remove("dragging");
      const to = cancel ? d.peg : pegAt(e.clientX);
      el.style.transform = "";
      if (to === d.peg) { render(); } else tryMove(d.peg, to);
    } else if (!cancel && !d.moved) tapPeg(d.peg);
  };
  const onUp = (e: PointerEvent) => finishDrag(e, false);
  const onCancel = (e: PointerEvent) => finishDrag(e, true);
  stage.addEventListener("pointerdown", onDown); stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp); stage.addEventListener("pointercancel", onCancel);

  const onKey = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (demo) { stopDemo(); if (e.key === " " || e.key === "Enter") e.preventDefault(); return; }
    const onBtn = e.target instanceof HTMLButtonElement;
    const peg = e.key === "1" || e.key === "ArrowLeft" ? 0 : e.key === "2" || e.key === "ArrowDown" ? 1 : e.key === "3" || e.key === "ArrowRight" ? 2 : -1;
    if (peg >= 0) { e.preventDefault(); kb = true; cur = peg; render(); return; }
    if (e.key === "Enter" || e.key === " ") {
      if (onBtn) return;
      e.preventDefault(); kb = true;
      if (phase === "won") { reset(); return; }
      tapPeg(cur); return;
    }
    if (e.key === "u" || e.key === "U" || e.key === "z" || e.key === "Z") { e.preventDefault(); undo(); }
    else if (e.key === "h" || e.key === "H") { e.preventDefault(); showHint(); }
    else if (e.key === "r" || e.key === "R") { e.preventDefault(); ctx.sfx("tap"); reset(); }
  };
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", layout);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => layout()) : null;
  ro?.observe(board);
  timerId = window.setInterval(() => { if (phase === "play" && startedAt) timeEl.textContent = `用时：${fmtTime(elapsed())}`; }, 250);

  reset();
  const g = window as unknown as Record<string, unknown>;
  g.__hanoi = {
    state: () => ({ n, pegs: s.pegs.map((p) => p.slice()), moves: hist.length, phase, sel, hint: hintMv, demo: !!demo, dh, bw, bh }),
    setDemoMs: (ms: number) => { demoMs = ms; },
  };
  return () => {
    stopDemo(); clearInterval(timerId); timers.forEach(clearTimeout); ro?.disconnect();
    document.removeEventListener("keydown", onKey); window.removeEventListener("resize", layout);
    delete g.__hanoi;
  };
}
